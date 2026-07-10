import { describe, it, expect } from 'vitest';
import {
  buildZahlenPrompt, parseZahlen, pruefeZahlWidersprueche, ZAHL_KATEGORIEN,
  type ZahlClaim,
} from '../zahlen';
import type { VbSektion } from '../gliederung';
import type { AufbereitungRun } from '../types';
import type { ApZeile } from '../tabellen';

const SEKTION_IDS = ['k-3.1', 'k-7', 'k-9'];

function gliederung(): VbSektion[] {
  return SEKTION_IDS.map((id, i) => ({ id, nummer: id.slice(2), titel: `T${i}`, ebene: 1 as const, start: i * 10, end: i * 10 + 10, quelle: 'heading' as const }));
}

function runMit(zeilen: ApZeile[], achseMax: number): AufbereitungRun {
  return {
    version: 1, antragKey: 'A', erzeugtAm: '2026-07-10T00:00:00.000Z',
    quellen: [], gliederung: gliederung(), tabellen: [],
    zeitplan: { zeilen, herkunft: 'anlage5', achseMax },
    befunde: [], offenePunkte: [],
  };
}

function claim(partial: Partial<ZahlClaim> & { wert: string; kategorie: string }): ZahlClaim {
  return { kontext: '', sektionIds: ['k-9'], ...partial };
}

describe('buildZahlenPrompt', () => {
  it('nennt Sektionen (ohne s-toc), Kategorien, VB-Text und fordert JSON', () => {
    const p = buildZahlenPrompt(gliederung(), 'DER VB TEXT');
    expect(p).toContain('[k-3.1]');
    expect(p).toContain('DER VB TEXT');
    expect(p).toContain('leistung:');
    expect(p).toContain('```json');
    expect(p).toContain('"claims"');
    expect(p).toContain('rechne nichts');
  });
});

describe('ZAHL_KATEGORIEN', () => {
  it('umfasst die 6 vorgesehenen IDs', () => {
    expect(ZAHL_KATEGORIEN.map(k => k.id)).toEqual(['leistung', 'zeit', 'personal', 'kosten', 'markt', 'sonstig']);
  });
});

describe('parseZahlen', () => {
  it('parst Claims, validiert Sektions-IDs, füllt Fallback-Kategorie', () => {
    const raw = ['```json', JSON.stringify({
      schemaVersion: 1,
      claims: [
        { wert: '>95 %', einheit: '%', kategorie: 'leistung', kontext: 'Erkennungsrate', sektionIds: ['k-3.1', 'unbekannt'] },
        { wert: '24 Monate', kategorie: 'quatsch', sektionIds: ['k-9'] }, // unbekannte Kategorie → sonstig
      ],
    }), '```'].join('\n');
    const d = parseZahlen(raw, SEKTION_IDS)!;
    expect(d.schemaVersion).toBe(1);
    expect(d.claims).toHaveLength(2);
    expect(d.claims[0]).toEqual({ wert: '>95 %', einheit: '%', kategorie: 'leistung', kontext: 'Erkennungsrate', sektionIds: ['k-3.1'] });
    expect(d.claims[1]!.kategorie).toBe('sonstig');
  });

  it('verwirft Claims ohne Wert ODER ohne gültige Sektions-ID (Fundstelle Pflicht)', () => {
    const raw = JSON.stringify({
      claims: [
        { kategorie: 'zeit', sektionIds: ['k-9'] },              // kein wert
        { wert: '5 %', kategorie: 'leistung', sektionIds: ['xx'] }, // keine gültige ID
        { wert: '5 %', kategorie: 'leistung', sektionIds: [] },     // leer
        { wert: '3 PM', kategorie: 'personal', sektionIds: ['k-7'] }, // ok
      ],
    });
    const d = parseZahlen(raw, SEKTION_IDS)!;
    expect(d.claims).toHaveLength(1);
    expect(d.claims[0]!.wert).toBe('3 PM');
  });

  it('kaputtes JSON / Prosa → null (Degradation)', () => {
    expect(parseZahlen('nur Prosa ohne JSON', SEKTION_IDS)).toBeNull();
  });

  it('leeres Objekt / fehlendes claims-Feld → 0 Claims (nicht null)', () => {
    expect(parseZahlen('{}', SEKTION_IDS)).toEqual({ schemaVersion: 1, claims: [] });
  });

  it('ignoriert das Bridge-Trailing-Artefakt nach dem JSON-Fence', () => {
    const raw = '```json\n{"schemaVersion":1,"claims":[{"wert":"24 Monate","kategorie":"zeit","sektionIds":["k-9"]}]}\n```\n``` :help[]';
    const d = parseZahlen(raw, SEKTION_IDS)!;
    expect(d.claims).toHaveLength(1);
    expect(d.claims[0]!.wert).toBe('24 Monate');
  });
});

describe('pruefeZahlWidersprueche — Laufzeit vs. Zeitplan-Horizont', () => {
  const run = runMit([], 24);

  it('Abweichung → Befund', () => {
    const b = pruefeZahlWidersprueche([claim({ wert: '18 Monate', kategorie: 'zeit' })], run);
    expect(b).toHaveLength(1);
    expect(b[0]!.key).toMatch(/^zahl-widerspruch:laufzeit:/);
    expect(b[0]!.aspektId).toBe('H');
    expect(b[0]!.text).toContain('18 Monate');
  });

  it('Übereinstimmung → kein Befund', () => {
    expect(pruefeZahlWidersprueche([claim({ wert: '24 Monate', kategorie: 'zeit' })], run)).toHaveLength(0);
  });

  it('nicht sicher parsebarer Wert → kein Befund (kein Fuzzy)', () => {
    expect(pruefeZahlWidersprueche([claim({ wert: 'ca. zwei Jahre', kategorie: 'zeit' })], run)).toHaveLength(0);
  });
});

describe('pruefeZahlWidersprueche — PM vs. Anlage-5-Summe', () => {
  // Zwei Ober-APs ohne Kinder → summePm = 48.
  const zeilen: ApZeile[] = [
    { nummer: '1', bezeichnung: 'AP1', istUnterAp: false, pm: 20 },
    { nummer: '2', bezeichnung: 'AP2', istUnterAp: false, pm: 28 },
  ];
  const run = runMit(zeilen, 24);

  it('Abweichung → Befund', () => {
    const b = pruefeZahlWidersprueche([claim({ wert: '50 PM', kategorie: 'personal', sektionIds: ['k-7'] })], run);
    expect(b).toHaveLength(1);
    expect(b[0]!.key).toMatch(/^zahl-widerspruch:pm:/);
    expect(b[0]!.text).toContain('48,0 PM');
  });

  it('Übereinstimmung (48 PM) → kein Befund', () => {
    expect(pruefeZahlWidersprueche([claim({ wert: '48 PM', kategorie: 'personal', sektionIds: ['k-7'] })], run)).toHaveLength(0);
  });

  it('Einheit-basiert (wert „48", einheit „PM") → kein Befund bei Übereinstimmung', () => {
    expect(pruefeZahlWidersprueche([claim({ wert: '48', einheit: 'PM', kategorie: 'personal', sektionIds: ['k-7'] })], run)).toHaveLength(0);
  });

  it('nicht sicher parsebarer PM-Wert → kein Befund', () => {
    expect(pruefeZahlWidersprueche([claim({ wert: 'mehrere Personenmonate', kategorie: 'personal', sektionIds: ['k-7'] })], run)).toHaveLength(0);
  });

  it('ohne Zeitplan → keine Befunde', () => {
    const ohneZeitplan: AufbereitungRun = { ...run, zeitplan: null };
    expect(pruefeZahlWidersprueche([claim({ wert: '50 PM', kategorie: 'personal' })], ohneZeitplan)).toHaveLength(0);
  });
});
