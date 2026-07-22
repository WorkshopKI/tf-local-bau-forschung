import { describe, it, expect } from 'vitest';
import {
  buildZahlenPrompt, parseZahlen, pruefeZahlWidersprueche, zahlenAntwortDiagnose, ZAHL_KATEGORIEN,
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
    // Härtung gegen die beobachtete Markdown-Tabelle statt JSON (Prod-Eval 2026-07-10).
    expect(p).toContain('keine Tabelle');
    // Kompakt-Ausgabe: Pretty-Print halbierte die Claim-Zahl im fixen Server-Budget.
    expect(p).toContain('kompakt');
  });

  it('lädt NICHT zur leeren claims-Liste ein (der verdaechtig-Guard verdoppelt dafür den Lauf)', () => {
    const p = buildZahlenPrompt(gliederung(), 'DER VB TEXT');
    expect(p).not.toContain('zulässiges Ergebnis');
    expect(p).not.toMatch(/leere\s+`?claims`?-Liste/);
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
    expect(d.claims[0]).toEqual({ wert: '>95 %', einheit: '%', kategorie: 'leistung', relevanz: 'detail', kontext: 'Erkennungsrate', sektionIds: ['k-3.1'] });
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

  // Prod-Eval 2026-07-10: das claims-Array wurde am Token-Limit abgeschnitten (äußeres
  // `{` schließt nie, Fence bleibt offen) → früher Total-Degradation. Jetzt bergen wir
  // die vollständig übertragenen Claims (Truncation-Salvage).
  it('rettet vollständige Claims aus abgeschnittener Antwort (offenes Array, offener Fence)', () => {
    const raw = [
      '```json',
      '{',
      '  "schemaVersion": 1,',
      '  "claims": [',
      '    {',
      '      "wert": "01.07.2024 - 30.06.2026",',
      '      "einheit": "Zeitraum",',
      '      "kategorie": "zeit",',
      '      "kontext": "Förderzeitraum des Projekts",',
      '      "sektionIds": ["k-9"]',
      '    },',
      '    {',
      '      "wert": "263.000 €",',
      '      "einheit": "€",',
      '      "kategorie": "kosten",',
      '      "kontext": "Beantragte Fördersumme",',
      '      "sektionIds": ["k-9"]',
      '    },',
      '  ', // abgeschnitten: kein weiteres Objekt, kein ], kein }, kein Fence-Ende
    ].join('\n');
    const d = parseZahlen(raw, SEKTION_IDS)!;
    expect(d).not.toBeNull();
    expect(d.schemaVersion).toBe(1);
    expect(d.claims).toHaveLength(2);
    expect(d.claims[0]!.wert).toBe('01.07.2024 - 30.06.2026');
    expect(d.claims[0]!.kategorie).toBe('zeit');
    expect(d.claims[1]!.wert).toBe('263.000 €');
    expect(d.claims[1]!.kategorie).toBe('kosten');
  });

  it('verwirft das angeschnittene letzte Objekt, behält das vollständige erste', () => {
    const raw = [
      '{ "schemaVersion": 1, "claims": [',
      '  { "wert": "24 Monate", "kategorie": "zeit", "sektionIds": ["k-9"] },',
      '  { "wert": "3,5 PM", "kategorie": "personal", "sekti', // mitten im Objekt abgeschnitten
    ].join('\n');
    const d = parseZahlen(raw, SEKTION_IDS)!;
    expect(d.claims).toHaveLength(1);
    expect(d.claims[0]!.wert).toBe('24 Monate');
  });

  // Prod-Eval 2026-07-10 (Fixture 017): das Modell stellt der JSON-Ausgabe eine
  // Markdown-Tabelle mit denselben Claims VORAN („Tabelle DANN JSON-Export"), und der
  // JSON-Teil ist zusätzlich am Token-Limit abgeschnitten (endet mitten in einer
  // sektionIds-Zeichenkette + Bridge-Trailing `:help[]`). Der Salvage keyt auf `"claims"`
  // (die Tabelle trägt das nicht) → die vollständigen JSON-Claims werden geborgen, die
  // Tabelle leckt NICHT als Pseudo-Claims ein, das angeschnittene letzte Objekt fällt raus.
  it('rettet die JSON-Claims aus „Tabelle DANN abgeschnittener JSON-Export" (Fixture 017)', () => {
    const raw = [
      'Extrahierte Zahlen-Claims (Wort-für-Wort, ungeändert aus dem Text)',
      '',
      'Wert (wörtlich)\tEinheit\tKategorie\tKontext\tSektion-ID(s)',
      '01.03.2025 - 28.02.2027\t-\tzeit\tFörderzeitraum\t[k-9]',
      '375.000 €\t€\tkosten\tBeantragte Fördersumme\t[k-9]',
      '>95 %\t%\tleistung\tErkennungsgenauigkeit\t[k-3.1]',
      '',
      'JSON-Export (wie gefordert)',
      '',
      '{',
      '  "schemaVersion": 1,',
      '  "claims": [',
      '    { "wert": "01.03.2025 - 28.02.2027", "einheit": "", "kategorie": "zeit", "kontext": "Förderzeitraum", "sektionIds": ["k-9"] },',
      '    { "wert": "375.000 €", "einheit": "€", "kategorie": "kosten", "kontext": "Beantragte Fördersumme", "sektionIds": ["k-9"] },',
      '    { "wert": ">95 %", "einheit": "%", "kategorie": "leistung", "kontext": "Erkennungsgenauigkeit", "sektionIds": ["k-3.1"] },',
      '    { "wert": "24 Monate", "einheit": "Monate", "kategorie": "zeit", "kontext": "Projektlaufzeit", "sektionIds": ["k-3. :help[]',
    ].join('\n');
    const d = parseZahlen(raw, SEKTION_IDS)!;
    expect(d).not.toBeNull();
    expect(d.schemaVersion).toBe(1);
    // 3 vollständige JSON-Claims; das abgeschnittene 4. Objekt fällt raus.
    expect(d.claims.map(c => c.wert)).toEqual(['01.03.2025 - 28.02.2027', '375.000 €', '>95 %']);
    // Die Tabelle hat KEINE zusätzlichen Claims erzeugt (jeder Wert genau 1×).
    expect(d.claims.filter(c => c.wert === '375.000 €')).toHaveLength(1);
  });

  // Reiner Text/Tabelle OHNE jeglichen JSON-Teil (kein `"claims"`, kein `{`) → es gibt
  // nichts deterministisch zu bergen → ehrliche Degradation (keine stille Fehldeutung).
  it('reine Prosa/Tabelle ohne JSON-Teil → null (Degradation)', () => {
    const raw = [
      '**Extrahierte Zahlen-Claims**',
      '',
      '| Wert | Einheit | Kategorie | Kontext | Sektion-ID(s) |',
      '| --- | --- | --- | --- | --- |',
      '| 24 Monate | Monate | zeit | Laufzeit | [k-9] |',
    ].join('\n');
    expect(parseZahlen(raw, SEKTION_IDS)).toBeNull();
  });
});

describe('zahlenAntwortDiagnose', () => {
  it('sauberer JSON-Lauf → keine Auffälligkeit', () => {
    const raw = '```json\n{"schemaVersion":1,"claims":[{"wert":"24 Monate","kategorie":"zeit","sektionIds":["k-9"]}]}\n```';
    expect(zahlenAntwortDiagnose(raw)).toEqual({ hatTabelle: false, abgeschnitten: false });
  });

  it('vollständiger JSON MIT Tabellen-Präambel → hatTabelle, nicht abgeschnitten', () => {
    const raw = [
      'Wert\tEinheit\tKategorie\tKontext\tSektion',
      '24 Monate\tMonate\tzeit\tLaufzeit\t[k-9]',
      '375.000 €\t€\tkosten\tSumme\t[k-9]',
      '',
      '{ "schemaVersion": 1, "claims": [ { "wert": "24 Monate", "kategorie": "zeit", "sektionIds": ["k-9"] } ] }',
    ].join('\n');
    expect(zahlenAntwortDiagnose(raw)).toEqual({ hatTabelle: true, abgeschnitten: false });
  });

  it('Tabelle DANN abgeschnittener JSON → beide Flags', () => {
    const raw = [
      'Wert\tEinheit\tKategorie\tKontext\tSektion',
      '24 Monate\tMonate\tzeit\tLaufzeit\t[k-9]',
      '',
      '{ "schemaVersion": 1, "claims": [',
      '  { "wert": "24 Monate", "kategorie": "zeit", "sektionIds": ["k-9"] },',
      '  { "wert": "375.000 €", "kategorie": "kosten", "sekti', // abgeschnitten
    ].join('\n');
    expect(zahlenAntwortDiagnose(raw)).toEqual({ hatTabelle: true, abgeschnitten: true });
  });

  it('reiner JSON, aber abgeschnitten (ohne Tabelle) → nur abgeschnitten', () => {
    const raw = '{ "schemaVersion": 1, "claims": [ { "wert": "24 Monate", "kategorie": "zeit", "sektionIds": ["k-9"] },';
    expect(zahlenAntwortDiagnose(raw)).toEqual({ hatTabelle: false, abgeschnitten: true });
  });

  it('gar kein JSON (kein „claims") → nicht abgeschnitten (nichts zu bergen)', () => {
    expect(zahlenAntwortDiagnose('nur Prosa, keine Zahlen als JSON')).toEqual({ hatTabelle: false, abgeschnitten: false });
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
