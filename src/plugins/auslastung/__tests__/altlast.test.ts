/**
 * Tests fuer altlast.ts.
 *
 * Schwerpunkte:
 *  1. Status-Filter: nur Kategorien `offen` + `nachforderung` (die 5 vom User
 *     benannten Status) — andere offene Status wie 'techn geprüft' zaehlen NICHT
 *  2. Quartal-Filter: Antraege aus Q-1..Q-7 (exklusiv aktuelles, gekappt bei Q-7)
 *  3. Dringlichkeits-Baender (`quartalBand`) + `tvsProBand`-Verteilung
 *  4. Verbund-Aggregation analog zu computeQuartalsAuslastung
 *  5. tib_kuerz/anonymMap-Mapping
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import { setStatusKatalogSnapshot } from '@/core/status/snapshot';
import { resetZahPhasenSnapshotFuerTests } from '@/core/status/zah-phasen';
import type { MappingVersion, StatusWertEintrag, ZahPhase } from '@/core/status/typen';
import { computeAltlasten, EMPTY_ALTLAST, quartalBand } from '../services/kapazitaet';

/** Test-Helper: nimmt `status` als plain string und castet im Output auf
 *  AntragStatusRaw (branded type, siehe CLAUDE.md Pitfall #12). Erlaubt
 *  `status: 'beantragt'` direkt im Aufrufer ohne `as AntragStatusRaw`. */
type AntragInit = Omit<Partial<Antrag>, 'status'> & Pick<Antrag, 'aktenzeichen'> & { status?: string };

function makeAntrag(overrides: AntragInit): Antrag {
  return {
    _updated_at: '2026-04-15T12:00:00Z',
    ...overrides,
  } as Antrag;
}

const STD = 9;

describe('computeAltlasten', () => {
  it('empty inputs → empty map', () => {
    const m = computeAltlasten([], new Map(), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('ungueltiges aktuellesQuartal → empty map', () => {
    const m = computeAltlasten([], new Map(), 'invalid', STD);
    expect(m.size).toBe(0);
  });

  it('status=beantragt + Q-1 → zaehlt als Altlast', () => {
    const antraege = [
      makeAntrag({
        aktenzeichen: 'A1',
        tib_kuerz: 'MUE',
        antragsdatum: '2026-01-15',  // Q1 = Q-1 fuer Q2-Aktuell
        status: 'beantragt',
        akronym: 'TEST',
      }),
    ];
    const toAnon = new Map([['MUE', 'MA01']]);
    const m = computeAltlasten(antraege, toAnon, '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.antraege).toBe(1);
    expect(a.tvs).toBe(1);
    expect(a.stunden).toBe(9);
    expect(a.tvsProBand).toEqual([1, 0, 0]);  // Q-1 = Band 1
    expect(a.quartale).toEqual(['2026-Q1']);  // distinct vorkommende Quartale
    expect(a.verbuende[0]).toMatchObject({ akronym: 'TEST', tvCount: 1, status: 'beantragt', altlastBand: 1 });
  });

  it('alle 5 User-Status zaehlen', () => {
    const userStatuses = ['beantragt', 'bearbeitungsreif', 'NL eingegangen', 'NF gestellt', 'keine weiteren NF'];
    for (const status of userStatuses) {
      const antraege = [
        makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status }),
      ];
      const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
      expect(m.get('MA01')?.antraege, `Status "${status}" sollte als Altlast zaehlen`).toBe(1);
    }
  });

  it('status=techn geprueft (in_pruefung) zaehlt NICHT als Altlast', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'techn geprüft' }),
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('status=bewilligt zaehlt NICHT als Altlast', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'bewilligt' }),
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('status=VN geprueft (begleitung) zaehlt NICHT als Altlast', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'VN geprüft' }),
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('status=bewilligungsreif (entscheidung) zaehlt NICHT', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'bewilligungsreif' }),
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('Antrag im aktuellen Quartal Q0 zaehlt NICHT (exklusiv-Filter)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', status: 'beantragt' }),  // Q2
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('Antrag aus Q-3 zaehlt jetzt (Band 3, Rot)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2025-08-15', status: 'beantragt' }),  // Q3-2025 = Q-3
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.antraege).toBe(1);
    expect(a.tvsProBand).toEqual([0, 0, 1]);
    expect(a.verbuende[0]).toMatchObject({ altlastBand: 3 });
  });

  it('Antrag aus Q-7 zaehlt noch (Band 3, letzte gezaehlte Stufe)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2024-08-15', status: 'beantragt' }),  // Q3-2024 = Q-7
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.get('MA01')?.tvsProBand).toEqual([0, 0, 1]);
  });

  it('Antrag aelter als Q-7 (Q-8) zaehlt NICHT (Kappung)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2024-05-15', status: 'beantragt' }),  // Q2-2024 = Q-8
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('Antrag aus Q-2 (Q4 Vorjahr) zaehlt (Band 2)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2025-11-15', status: 'beantragt' }),  // Q4-2025 = Q-2
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.antraege).toBe(1);
    expect(a.tvsProBand).toEqual([0, 1, 0]);
  });

  it('Verbund mit 3 TVs, alle gleicher MA, alle in Q-1, alle offen → 1 Antrag, 3 TVs', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'V1-TV1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'beantragt', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV2', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'NF gestellt', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV3', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'bearbeitungsreif', verbund_id: 'V1' }),
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.antraege).toBe(1);
    expect(a.tvs).toBe(3);
    expect(a.stunden).toBe(27);
    // Repraesentativ-Status = erster Teilantrag der Gruppe (Iterations-Reihenfolge).
    expect(a.verbuende[0]).toMatchObject({ status: 'beantragt' });
  });

  it('Verbund mit 3 TVs, 2 MUE + 1 SCH → MUE 1 Antrag/2 TVs, SCH 1 Antrag/1 TV', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'V1-TV1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'beantragt', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV2', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'beantragt', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV3', tib_kuerz: 'SCH', antragsdatum: '2026-01-15', status: 'beantragt', verbund_id: 'V1' }),
    ];
    const toAnon = new Map([['MUE', 'MA01'], ['SCH', 'MA02']]);
    const m = computeAltlasten(antraege, toAnon, '2026-Q2', STD);
    expect(m.get('MA01')).toMatchObject({ antraege: 1, tvs: 2 });
    expect(m.get('MA02')).toMatchObject({ antraege: 1, tvs: 1 });
  });

  it('Mix: offene + bewilligte im selben Verbund → nur offene TVs zaehlen', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'V1-TV1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'beantragt', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV2', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'bewilligt', verbund_id: 'V1' }),
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.antraege).toBe(1);
    expect(a.tvs).toBe(1);  // nur die TV mit status=beantragt
  });

  it('unbekanntes tib_kuerz → ignoriert', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'XYZ', antragsdatum: '2026-01-15', status: 'beantragt' }),
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('fehlendes antragsdatum → ignoriert', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', status: 'beantragt' }),  // kein antragsdatum
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('case-insensitive tib_kuerz + Whitespace', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: ' mue ', antragsdatum: '2026-01-15', status: 'beantragt' }),
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.get('MA01')?.antraege).toBe(1);
  });

  it('verbuende-Sortierung: aelteste zuerst', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2025-11-15', status: 'beantragt', akronym: 'OLD' }),  // Q4-2025
      makeAntrag({ aktenzeichen: 'A2', tib_kuerz: 'MUE', antragsdatum: '2026-03-15', status: 'beantragt', akronym: 'NEW' }),  // Q1-2026
      makeAntrag({ aktenzeichen: 'A3', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'beantragt', akronym: 'MID' }),  // Q1-2026
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    const v = m.get('MA01')!.verbuende;
    expect(v.map(x => x.akronym)).toEqual(['OLD', 'MID', 'NEW']);
  });

  it('stundenProTV=0 → fallback auf 9', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'beantragt' }),
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', 0);
    expect(m.get('MA01')?.stunden).toBe(9);
  });

  it('mehrere MAs bekommen unabhaengige Buckets mit ihren eigenen Quartalen/Baendern', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'beantragt' }),   // Q-1
      makeAntrag({ aktenzeichen: 'A2', tib_kuerz: 'SCH', antragsdatum: '2025-11-15', status: 'NF gestellt' }), // Q-2
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01'], ['SCH', 'MA02']]), '2026-Q2', STD);
    expect(m.size).toBe(2);
    expect(m.get('MA01')?.quartale).toEqual(['2026-Q1']);
    expect(m.get('MA01')?.tvsProBand).toEqual([1, 0, 0]);
    expect(m.get('MA02')?.quartale).toEqual(['2025-Q4']);
    expect(m.get('MA02')?.tvsProBand).toEqual([0, 1, 0]);
  });

  it('ein MA mit Antraegen aus mehreren Baendern → tvsProBand summiert korrekt', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'beantragt' }),   // Q-1 → Band 1
      makeAntrag({ aktenzeichen: 'A2', tib_kuerz: 'MUE', antragsdatum: '2025-11-15', status: 'beantragt' }),   // Q-2 → Band 2
      makeAntrag({ aktenzeichen: 'A3', tib_kuerz: 'MUE', antragsdatum: '2025-08-15', status: 'beantragt' }),   // Q-3 → Band 3
      makeAntrag({ aktenzeichen: 'A4', tib_kuerz: 'MUE', antragsdatum: '2024-08-15', status: 'beantragt' }),   // Q-7 → Band 3
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.tvs).toBe(4);
    expect(a.tvsProBand).toEqual([1, 1, 2]);
    expect(a.tvsProBand[0] + a.tvsProBand[1] + a.tvsProBand[2]).toBe(a.tvs);
    expect(a.quartale).toEqual(['2024-Q3', '2025-Q3', '2025-Q4', '2026-Q1']);
  });
});

describe('EMPTY_ALTLAST', () => {
  it('hat leere Werte', () => {
    expect(EMPTY_ALTLAST.antraege).toBe(0);
    expect(EMPTY_ALTLAST.tvs).toBe(0);
    expect(EMPTY_ALTLAST.stunden).toBe(0);
    expect(EMPTY_ALTLAST.tvsProBand).toEqual([0, 0, 0]);
    expect(EMPTY_ALTLAST.quartale).toEqual([]);
    expect(EMPTY_ALTLAST.verbuende).toEqual([]);
  });
});

describe('quartalBand', () => {
  const CURR = '2026-Q2';
  it('Q-1 → Band 1', () => expect(quartalBand('2026-Q1', CURR)).toBe(1));
  it('Q-2 (Vorjahr Q4) → Band 2', () => expect(quartalBand('2025-Q4', CURR)).toBe(2));
  it('Q-3 → Band 3', () => expect(quartalBand('2025-Q3', CURR)).toBe(3));
  it('Q-7 → Band 3 (letzte gezaehlte Stufe)', () => expect(quartalBand('2024-Q3', CURR)).toBe(3));
  it('Q-8 → null (Kappung)', () => expect(quartalBand('2024-Q2', CURR)).toBeNull());
  it('aktuelles Quartal → null', () => expect(quartalBand('2026-Q2', CURR)).toBeNull());
  it('zukuenftiges Quartal → null', () => expect(quartalBand('2026-Q3', CURR)).toBeNull());
  it('Jahres-Wechsel: Q-1 ueber Jahresgrenze', () => expect(quartalBand('2025-Q4', '2026-Q1')).toBe(1));
  it('ungueltiges Antrags-Quartal → null', () => expect(quartalBand('kaputt', CURR)).toBeNull());
  it('ungueltiges aktuelles Quartal → null', () => expect(quartalBand('2026-Q1', 'kaputt')).toBeNull());
});

// ─── Regressionsgatter: ein Phasen-Umbau darf die Altlast nicht leeren ───────

/**
 * Die Katalog-Fassung 19 (05.08.2026) hat die ZAH-Phase „Vollstaendigkeit"
 * aufgeloest und ihre Codes 33–37 an „Pruefung" gehaengt — eine gewollte
 * fachliche Entscheidung (5-Phasen-Schnitt der AB/FB-Abstimmung). Weil
 * `pruefung` die Arbeitsliste `in_pruefung` vorgibt und `snapshot.ts` die
 * Kategorie aus Phase + Code NEU rechnet, verloren dabei vier der fuenf
 * Altlast-Status ihre Kategorie (`offen`/`nachforderung`): der Altanträge-Balken
 * fiel im Bestand von 395 auf 22 Teilvorhaben und war bei 22 von 32 MAs ganz
 * leer, obwohl sich an den Antraegen nichts geaendert hatte.
 *
 * Diese Tests halten die Trennung fest: der **Verfahrensschritt** ist beweglich,
 * die **Arbeitsliste** steht still (Pitfall #50). Sie muessen unter JEDEM
 * Phasenschnitt gruen sein — deshalb setzen sie den Schnitt hier aktiv, statt
 * (wie die Tests oben) auf dem Seed zu laufen, wo die Luecke unsichtbar bleibt.
 */
const FASSUNG19_PHASEN: ZahPhase[] = [
  { id: 'eingang', reihenfolge: 10, label: 'Eingang', kategorieVorgabe: 'offen' },
  { id: 'pruefung', reihenfolge: 20, label: 'In Prüfung', kategorieVorgabe: 'in_pruefung' },
  { id: 'entscheidung', reihenfolge: 30, label: 'Erstentscheidung', kategorieVorgabe: 'entscheidung' },
  { id: 'begleitung', reihenfolge: 40, label: 'Begleitung', kategorieVorgabe: 'begleitung' },
  { id: 'abgeschlossen', reihenfolge: 50, label: 'Abgeschlossen', kategorieVorgabe: 'abgeschlossen' },
];

/** Ein Wert-Eintrag, wie die Fassung ihn fuehrt (Code + kuratierte Phase). */
function wertEintrag(code: number, wert: string, zahPhaseId: string): StatusWertEintrag {
  return {
    id: `status::${wert.toLowerCase()}`,
    feldId: 'status',
    wert,
    kategorie: 'sonstige',   // bewusst falsch: der Snapshot rechnet neu (Pitfall #45)
    prominenz: 'normal',
    aktiv: true,
    unkuratiert: false,
    code,
    zahPhaseId: zahPhaseId as StatusWertEintrag['zahPhaseId'],
  };
}

/** Die Fassung 19, auf die fuer die Altlast relevanten Codes eingedampft. */
function fassung19(): MappingVersion {
  return {
    version: 19,
    autor: null,
    zeitstempel: '2026-08-05T19:45:50.206Z',
    felder: [],
    zahPhasen: FASSUNG19_PHASEN,
    werte: [
      wertEintrag(31, 'beantragt', 'eingang'),
      wertEintrag(33, 'unvollständig', 'pruefung'),
      wertEintrag(34, 'bearbeitungsreif', 'pruefung'),
      wertEintrag(35, 'NF gestellt', 'pruefung'),
      wertEintrag(36, 'NL eingegangen', 'pruefung'),
      wertEintrag(37, 'keine weiteren NF', 'pruefung'),
      wertEintrag(38, 'techn geprüft', 'pruefung'),
      wertEintrag(59, 'bewilligt', 'begleitung'),
    ],
  };
}

describe('computeAltlasten unter einem geaenderten Phasenschnitt (Fassung 19)', () => {
  afterEach(() => {
    setStatusKatalogSnapshot(null);
    resetZahPhasenSnapshotFuerTests();
  });

  it('alle 5 User-Status zaehlen weiter, obwohl „Vollständigkeit" aufgeloest ist', () => {
    setStatusKatalogSnapshot(fassung19());
    const userStatuses = ['beantragt', 'bearbeitungsreif', 'NL eingegangen', 'NF gestellt', 'keine weiteren NF'];
    for (const status of userStatuses) {
      const antraege = [
        makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status }),
      ];
      const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
      expect(
        m.get('MA01')?.antraege,
        `Status "${status}" muss auch unter dem 5-Phasen-Schnitt als Altlast zaehlen`,
      ).toBe(1);
    }
  });

  it('die Abgrenzung nach oben haelt: „techn geprueft" und „bewilligt" zaehlen weiterhin NICHT', () => {
    setStatusKatalogSnapshot(fassung19());
    for (const status of ['techn geprüft', 'bewilligt']) {
      const antraege = [
        makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status }),
      ];
      const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
      expect(m.size, `Status "${status}" darf keine Altlast sein`).toBe(0);
    }
  });

  it('Baender und Verbund-Aggregation bleiben vom Phasenschnitt unberuehrt', () => {
    setStatusKatalogSnapshot(fassung19());
    const antraege = [
      makeAntrag({ aktenzeichen: 'V1-TV1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'NF gestellt', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV2', tib_kuerz: 'MUE', antragsdatum: '2026-01-15', status: 'NL eingegangen', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'A3', tib_kuerz: 'MUE', antragsdatum: '2025-11-15', status: 'bearbeitungsreif' }),
    ];
    const m = computeAltlasten(antraege, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.antraege).toBe(2);          // 1 Verbund + 1 Einzelantrag
    expect(a.tvs).toBe(3);
    expect(a.tvsProBand).toEqual([2, 1, 0]);
  });
});
