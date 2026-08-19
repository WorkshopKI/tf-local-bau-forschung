import { describe, it, expect } from 'vitest';
import {
  freigeben, istInhaltsgleich, MAX_HISTORIE, neueFassung, uebernimmFassung, zurueckInEntwurf,
} from '@/core/meilensteine/versionierung';
import { baueSeedPlan } from '@/core/meilensteine/seed';
import type { MeilensteinPlan } from '@/core/meilensteine/typen';

const JETZT = '2026-08-01T10:00:00.000Z';

function basis(): MeilensteinPlan {
  return baueSeedPlan();
}

const eingabe = (p: MeilensteinPlan, aenderung: Partial<MeilensteinPlan> = {}) => ({
  knoten: aenderung.knoten ?? p.knoten,
  gesamtfristTage: aenderung.gesamtfristTage ?? p.gesamtfristTage,
  autor: 'ABC',
  jetzt: JETZT,
});

describe('neueFassung', () => {
  it('erhöht die Version, stempelt Autor/Zeit und legt den Vorstand in die Historie', () => {
    const p = basis();
    const n = neueFassung(p, eingabe(p, { gesamtfristTage: 100 }));
    expect(n.version).toBe(2);
    expect(n.autor).toBe('ABC');
    expect(n.stand).toBe(JETZT);
    expect(n.gesamtfristTage).toBe(100);
    expect(n.historie[0]!.version).toBe(1);
    expect(n.historie[0]!.gesamtfristTage).toBe(90);
  });

  it('startet als Entwurf — neue Fristen gelten erst nach Freigabe', () => {
    const p = basis();
    expect(p.status).toBe('freigegeben');
    expect(neueFassung(p, eingabe(p, { gesamtfristTage: 100 })).status).toBe('entwurf');
  });

  it('ist bei inhaltsgleicher Bearbeitung ein No-op', () => {
    const p = basis();
    expect(neueFassung(p, eingabe(p))).toBe(p);
  });

  it('wirft einen freigegebenen Plan nicht durch ein Leer-Speichern in den Entwurf', () => {
    const p = basis();
    expect(neueFassung(p, eingabe(p)).status).toBe('freigegeben');
  });

  it('kappt die Historie bei MAX_HISTORIE', () => {
    let p = basis();
    for (let i = 0; i < MAX_HISTORIE + 5; i++) {
      p = neueFassung(p, eingabe(p, { gesamtfristTage: 90 + i + 1 }));
    }
    expect(p.historie).toHaveLength(MAX_HISTORIE);
    expect(p.historie[0]!.version).toBe(p.version - 1);
  });

  it('hält die jüngste freigegebene Fassung fest, auch über MAX_HISTORIE hinaus', () => {
    // Der Auslieferungs-Plan ist freigegeben; jede weitere Speicherung ist ein
    // Entwurf. Ohne Ausnahme schob die 21. Speicherung die letzte Freigabe aus
    // der Historie — `freigegebeneFassung` lieferte danach `null`, alle Reiter
    // meldeten „Noch kein Plan freigegeben" und der geltende Plan war weg.
    let p = basis();
    expect(p.status).toBe('freigegeben');
    for (let i = 0; i < MAX_HISTORIE + 5; i++) {
      p = neueFassung(p, eingabe(p, { gesamtfristTage: 90 + i + 1 }));
    }
    expect(p.historie).toHaveLength(MAX_HISTORIE);
    const gehalten = p.historie.filter(h => h.status === 'freigegeben');
    expect(gehalten).toHaveLength(1);
    expect(gehalten[0]!.version).toBe(1);
    // Sie verdrängt den ÄLTESTEN Entwurf; das Fenster bleibt vorne lückenlos.
    expect(p.historie[0]!.version).toBe(p.version - 1);
  });

  it('kopiert die Knoten statt sie zu teilen', () => {
    const p = basis();
    const geaendert = p.knoten.map(k => ({ ...k, sollWoche: k.sollWoche + 1 }));
    const n = neueFassung(p, { ...eingabe(p), knoten: geaendert });
    geaendert[0]!.label = 'nachträglich verbogen';
    expect(n.knoten[0]!.label).not.toBe('nachträglich verbogen');
  });
});

describe('freigeben / zurueckInEntwurf', () => {
  it('ist ein eigener Schritt mit eigenem Snapshot', () => {
    const p = neueFassung(basis(), eingabe(basis(), { gesamtfristTage: 100 }));
    const f = freigeben(p, 'PL', '2026-08-02T00:00:00.000Z', 'Abgestimmt im Jour fixe');
    expect(f.status).toBe('freigegeben');
    expect(f.version).toBe(p.version + 1);
    expect(f.kommentar).toBe('Abgestimmt im Jour fixe');
    expect(f.historie[0]!.status).toBe('entwurf');
  });

  it('ist ein No-op, wenn schon freigegeben bzw. schon Entwurf', () => {
    const p = basis();
    expect(freigeben(p, 'PL', JETZT)).toBe(p);
    const entwurf: MeilensteinPlan = { ...p, status: 'entwurf' };
    expect(zurueckInEntwurf(entwurf, 'PL', JETZT)).toBe(entwurf);
  });

  it('lässt den zuletzt freigegebenen Stand in der Historie zurück', () => {
    const zurueck = zurueckInEntwurf(basis(), 'PL', JETZT, 'Überarbeitung');
    expect(zurueck.status).toBe('entwurf');
    expect(zurueck.historie[0]!.status).toBe('freigegeben');
  });
});

describe('uebernimmFassung', () => {
  it('übernimmt eine alte Fassung als NEUE Fassung (Rollback nach vorne)', () => {
    const p1 = basis();
    const p2 = neueFassung(p1, eingabe(p1, { gesamtfristTage: 120 }));
    const p3 = uebernimmFassung(p2, 1, 'PL', '2026-08-03T00:00:00.000Z');
    expect(p3.version).toBe(3);
    expect(p3.gesamtfristTage).toBe(90);
    expect(p3.kommentar).toBe('Übernommen aus Fassung 1');
    // Die alte Fassung bleibt in der Historie, nichts wird zurückgeschnitten.
    expect(p3.historie.map(h => h.version)).toEqual([2, 1]);
  });

  it('rollt den Freigabe-Status NICHT mit — die Übernahme ist ein Entwurf', () => {
    const p1 = basis();
    const p2 = neueFassung(p1, eingabe(p1, { gesamtfristTage: 120 }));
    expect(uebernimmFassung(p2, 1, 'PL', JETZT).status).toBe('entwurf');
  });

  it('ist ein No-op bei unbekannter Fassung', () => {
    const p = basis();
    expect(uebernimmFassung(p, 99, 'PL', JETZT)).toBe(p);
  });
});

describe('istInhaltsgleich', () => {
  // Ein No-op ist an sich richtig — aber die Oberfläche muss ihn vorher
  // erkennen können, sonst steht dort ein Knopf, der beim Klick sichtbar nichts
  // tut (am echten Bestand traf das genau die oberste Historien-Zeile).
  it('erkennt die Fassung, deren Übernahme nichts ändern würde', () => {
    const p1 = basis();
    const p2 = neueFassung(p1, eingabe(p1, { gesamtfristTage: 120 }));
    const alt = p2.historie.find(h => h.version === 1)!;
    expect(istInhaltsgleich(p2, alt)).toBe(false);
    expect(uebernimmFassung(p2, 1, 'PL', JETZT)).not.toBe(p2);

    const p3 = freigeben(p2, 'PL', JETZT);          // gleicher Inhalt, neue Fassung
    const gleich = p3.historie.find(h => h.version === 2)!;
    expect(istInhaltsgleich(p3, gleich)).toBe(true);
    expect(uebernimmFassung(p3, 2, 'PL', JETZT)).toBe(p3);
  });
});
