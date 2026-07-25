import { describe, it, expect } from 'vitest';
import { baueSeedKnoten, baueSeedPlan, SEED_GESAMTFRIST_TAGE, SEED_STAND } from '@/core/meilensteine/seed';
import { ANTRAG_SLA_DAYS } from '@/core/services/csv/frist';
import { baueKontext, pruefeBedingung } from '@/core/status';

describe('Meilenstein-Seed (Plan v1)', () => {
  it('ist deterministisch (zwei Aufrufe deep-equal)', () => {
    expect(baueSeedPlan()).toEqual(baueSeedPlan());
  });

  it('ist Version 1, autorlos, freigegeben, mit festem Zeitstempel', () => {
    const p = baueSeedPlan();
    expect(p.version).toBe(1);
    expect(p.autor).toBeNull();
    expect(p.status).toBe('freigegeben');
    expect(p.stand).toBe(SEED_STAND);
    expect(p.historie).toEqual([]);
  });

  it('erfindet keine zweite Gesamtfrist (deckungsgleich mit ANTRAG_SLA_DAYS)', () => {
    expect(SEED_GESAMTFRIST_TAGE).toBe(ANTRAG_SLA_DAYS);
    expect(baueSeedPlan().gesamtfristTage).toBe(ANTRAG_SLA_DAYS);
  });

  it('bildet die fachliche Struktur MST 1 … 6 inklusive Unter-Meilensteinen ab', () => {
    const nummern = baueSeedKnoten().map(k => k.nummer);
    expect(nummern).toEqual([
      '1', '1.1', '1.2', '1.3', '1.4', '1.4.1', '1.4.2', '1.4.3',
      '2', '3', '4', '5', '6',
    ]);
  });

  it('vergibt eindeutige IDs und verweist nur auf existierende Eltern', () => {
    const knoten = baueSeedKnoten();
    const ids = knoten.map(k => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of knoten) {
      if (k.elternId === null) continue;
      expect(ids).toContain(k.elternId);
    }
  });

  it('hält Soll-Wochen der Kinder innerhalb ihres Elternteils', () => {
    const knoten = baueSeedKnoten();
    const byId = new Map(knoten.map(k => [k.id, k]));
    for (const k of knoten) {
      if (k.elternId === null) continue;
      const eltern = byId.get(k.elternId);
      expect(eltern).toBeDefined();
      expect(k.sollWoche).toBeLessThanOrEqual(eltern!.sollWoche);
    }
  });

  it('lässt die Soll-Wochen der Wurzel-Meilensteine monoton wachsen', () => {
    const wurzeln = baueSeedKnoten()
      .filter(k => k.elternId === null)
      .sort((a, b) => a.sortierung - b.sortierung);
    for (let i = 1; i < wurzeln.length; i++) {
      expect(wurzeln[i]!.sollWoche).toBeGreaterThan(wurzeln[i - 1]!.sollWoche);
    }
  });

  it('markiert jede nicht eindeutig belegbare Zuordnung als unbestätigt', () => {
    const bestaetigt = baueSeedKnoten().filter(k => !k.unbestaetigt).map(k => k.id);
    // Nur Knoten mit eindeutiger kanonischer Quelle gelten als bestätigt.
    expect(bestaetigt.sort()).toEqual(['mst-1', 'mst-1-1', 'mst-1-2', 'mst-1-4', 'mst-6']);
  });

  it('schaltet Knoten ohne bekannte Quelle inaktiv statt sie zu raten', () => {
    const inaktiv = baueSeedKnoten().filter(k => !k.aktiv).map(k => k.id);
    expect(inaktiv.sort()).toEqual(['mst-1-4-2', 'mst-4', 'mst-5']);
    // Ein inaktiver Knoten ist immer auch als unbestätigt gekennzeichnet.
    for (const k of baueSeedKnoten()) {
      if (!k.aktiv) expect(k.unbestaetigt).toBe(true);
    }
  });

  it('zählt Sammel-Knoten nicht selbst in die Frist-Prognose', () => {
    const knoten = baueSeedKnoten();
    const elternIds = new Set(knoten.map(k => k.elternId).filter((v): v is string => v !== null));
    for (const k of knoten) {
      if (elternIds.has(k.id)) expect(k.relevantFuerFrist).toBe(false);
    }
  });

  it('erfüllt Sammel-Knoten nie über die eigene Bedingung (leeres ODER)', () => {
    const sammel = baueSeedKnoten().filter(k => k.id === 'mst-1' || k.id === 'mst-1-4');
    const ctx = baueKontext({ status: 'bewilligt', antragsdatum: '01.01.2026' });
    expect(sammel).toHaveLength(2);
    for (const k of sammel) {
      expect(pruefeBedingung(k.bedingung, ctx, '2026-07-25T00:00:00.000Z')).toBe(false);
    }
  });

  it('greift für 1.1 und 6 auf die kanonischen Datumsfelder zu', () => {
    const byId = new Map(baueSeedKnoten().map(k => [k.id, k]));
    const heute = '2026-07-25T00:00:00.000Z';
    const leer = baueKontext({});
    const gefuellt = baueKontext({ antragsdatum: '2026-01-15', bewilligung_datum: '2026-04-01' });

    for (const id of ['mst-1-1', 'mst-6']) {
      const k = byId.get(id);
      expect(k).toBeDefined();
      expect(pruefeBedingung(k!.bedingung, leer, heute)).toBe(false);
      expect(pruefeBedingung(k!.bedingung, gefuellt, heute)).toBe(true);
    }
  });
});
