/**
 * Tests fuer quartals-auslastung.ts.
 *
 * Schwerpunkte:
 *  1. `computeQuartalsAuslastung` — fest + pending + Dedup
 *  2. Verbund-Gruppierung (1 Verbund-Anteil pro MA)
 *  3. Stunden-Berechnung (echte TV-Anzahl × stundenProTV)
 *  4. `getTVCount` — Helper fuer in-App-Selbsteintragung
 */
import { describe, it, expect } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import {
  computeQuartalsAuslastung,
  getTVCount,
  EMPTY_AUSLASTUNG,
} from '../services/quartals-auslastung';
import type { Zuweisung } from '../types';

function makeAntrag(overrides: Partial<Antrag> & Pick<Antrag, 'aktenzeichen'>): Antrag {
  return {
    _updated_at: '2026-04-15T12:00:00Z',
    ...overrides,
  } as Antrag;
}

function makeZuweisung(overrides: Partial<Zuweisung> = {}): Zuweisung {
  return {
    antragId: '16EP260112',
    anonId: 'MA01',
    quartal: '2026-Q2',
    stunden: 9,
    status: 'selbst',
    ...overrides,
  };
}

const STD = 9;

describe('computeQuartalsAuslastung', () => {
  it('empty inputs → empty map', () => {
    const m = computeQuartalsAuslastung([], [], new Map(), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('fest: Einzelantrag mit tib_kuerz und passendem Quartal', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', akronym: 'CALYPSO', titel: 'KI-Antrag' }),
    ];
    const toAnon = new Map([['MUE', 'MA01']]);
    const m = computeQuartalsAuslastung(antraege, [], toAnon, '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.fest.antraege).toBe(1);
    expect(a.fest.tvs).toBe(1);
    expect(a.fest.stunden).toBe(9);
    expect(a.fest.aktenzeichenSet).toEqual(new Set(['A1']));
    expect(a.fest.verbuende[0]).toMatchObject({
      verbundId: null,
      aktenzeichen: ['A1'],
      akronym: 'CALYPSO',
      tvCount: 1,
      stunden: 9,
    });
    expect(a.pending.antraege).toBe(0);
  });

  it('fest: Verbund mit 4 TVs, alle MUE → 1 Antrag, 4 TVs, 36h', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'V1-TV1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1', verbund_titel: 'Verbund 1' }),
      makeAntrag({ aktenzeichen: 'V1-TV2', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV3', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV4', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
    ];
    const toAnon = new Map([['MUE', 'MA01']]);
    const m = computeQuartalsAuslastung(antraege, [], toAnon, '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.fest.antraege).toBe(1);
    expect(a.fest.tvs).toBe(4);
    expect(a.fest.stunden).toBe(36);
    expect(a.fest.aktenzeichenSet.size).toBe(4);
    expect(a.fest.verbuende[0]).toMatchObject({
      verbundId: 'V1',
      tvCount: 4,
      stunden: 36,
    });
  });

  it('fest: partielle Verbund-Verteilung (2 TVs MUE, 1 SCH, 1 blank)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'TV1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'TV2', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'TV3', tib_kuerz: 'SCH', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'TV4', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
    ];
    const toAnon = new Map([['MUE', 'MA01'], ['SCH', 'MA02']]);
    const m = computeQuartalsAuslastung(antraege, [], toAnon, '2026-Q2', STD);
    const mue = m.get('MA01')!;
    expect(mue.fest.antraege).toBe(1);
    expect(mue.fest.tvs).toBe(2);
    expect(mue.fest.stunden).toBe(18);
    const sch = m.get('MA02')!;
    expect(sch.fest.antraege).toBe(1);
    expect(sch.fest.tvs).toBe(1);
    expect(sch.fest.stunden).toBe(9);
  });

  it('fest: Quartal-Filter — anderes Quartal ausgeschlossen', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-01-15' }),  // Q1
      makeAntrag({ aktenzeichen: 'A2', tib_kuerz: 'MUE', antragsdatum: '2026-04-15' }),  // Q2
      makeAntrag({ aktenzeichen: 'A3', tib_kuerz: 'MUE', antragsdatum: '2026-07-15' }),  // Q3
    ];
    const toAnon = new Map([['MUE', 'MA01']]);
    const m = computeQuartalsAuslastung(antraege, [], toAnon, '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.fest.antraege).toBe(1);
    expect(a.fest.aktenzeichenSet).toEqual(new Set(['A2']));
  });

  it('fest: case-insensitive tib_kuerz, Whitespace toleriert', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: ' mue ', antragsdatum: '2026-04-15' }),
      makeAntrag({ aktenzeichen: 'A2', tib_kuerz: 'Mue', antragsdatum: '2026-04-15' }),
    ];
    const toAnon = new Map([['MUE', 'MA01']]);
    const m = computeQuartalsAuslastung(antraege, [], toAnon, '2026-Q2', STD);
    expect(m.get('MA01')!.fest.antraege).toBe(2);
  });

  it('fest: unbekanntes Kürzel ignoriert', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'XYZ', antragsdatum: '2026-04-15' }),
    ];
    const m = computeQuartalsAuslastung(antraege, [], new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('pending: Selbsteintragung wenn Antrag NICHT in fest', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', antragsdatum: '2026-04-15', akronym: 'TEST' }),
    ];
    const zuweisungen = [makeZuweisung({ antragId: 'A1', anonId: 'MA01', stunden: 9, status: 'selbst' })];
    const m = computeQuartalsAuslastung(antraege, zuweisungen, new Map(), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.fest.antraege).toBe(0);
    expect(a.pending.antraege).toBe(1);
    expect(a.pending.tvs).toBe(1);
    expect(a.pending.stunden).toBe(9);
    expect(a.pending.verbuende[0]?.aktenzeichen).toEqual(['A1']);
  });

  it('pending mit Verbund: TV-Count aus Antrags-Liste abgeleitet, 4 TVs zählen', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'V1-TV1', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV2', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV3', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'V1-TV4', antragsdatum: '2026-04-15', verbund_id: 'V1' }),
    ];
    // MA hat sich nur fuer V1-TV1 eingetragen — aber Verbund-Logik gruppiert
    // alle 4 in einen Eintrag? NEIN — pending zaehlt nur TVs aus den
    // konkret zugewiesenen Aktenzeichen, nicht alle Verbund-Geschwister.
    const zuweisungen = [makeZuweisung({ antragId: 'V1-TV1', anonId: 'MA01', stunden: 9, status: 'selbst' })];
    const m = computeQuartalsAuslastung(antraege, zuweisungen, new Map(), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.pending.antraege).toBe(1);  // 1 Verbund-Anteil (auch wenn nur 1 TV)
    expect(a.pending.tvs).toBe(1);
    expect(a.pending.stunden).toBe(9);
  });

  it('dedup: Antrag in fest UND Zuweisung-Eintrag → pending ignoriert', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15' }),
    ];
    const zuweisungen = [makeZuweisung({ antragId: 'A1', anonId: 'MA01', stunden: 9, status: 'selbst' })];
    const m = computeQuartalsAuslastung(antraege, zuweisungen, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.fest.antraege).toBe(1);
    expect(a.pending.antraege).toBe(0);
  });

  it('pending: vorgeschlagene + abgelehnte Zuweisungen werden ignoriert', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', antragsdatum: '2026-04-15' }),
      makeAntrag({ aktenzeichen: 'A2', antragsdatum: '2026-04-15' }),
    ];
    const zuweisungen = [
      makeZuweisung({ antragId: 'A1', anonId: 'MA01', status: 'vorgeschlagen' }),
      makeZuweisung({ antragId: 'A2', anonId: 'MA01', status: 'abgelehnt' }),
    ];
    const m = computeQuartalsAuslastung(antraege, zuweisungen, new Map(), '2026-Q2', STD);
    expect(m.get('MA01')?.pending.antraege ?? 0).toBe(0);
  });

  it('pending: Zuweisung mit Status "freigegeben" wird ebenfalls als pending gezählt', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', antragsdatum: '2026-04-15' }),
    ];
    const zuweisungen = [makeZuweisung({ antragId: 'A1', anonId: 'MA01', status: 'freigegeben' })];
    const m = computeQuartalsAuslastung(antraege, zuweisungen, new Map(), '2026-Q2', STD);
    expect(m.get('MA01')?.pending.antraege).toBe(1);
  });

  it('orphan: Zuweisung referenziert nicht-existenten Antrag → ignoriert', () => {
    const zuweisungen = [makeZuweisung({ antragId: 'GHOST', anonId: 'MA01', status: 'selbst' })];
    const m = computeQuartalsAuslastung([], zuweisungen, new Map(), '2026-Q2', STD);
    expect(m.size).toBe(0);
  });

  it('mehrere MAs: alle bekommen ihre eigenen Buckets', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15' }),
      makeAntrag({ aktenzeichen: 'A2', tib_kuerz: 'SCH', antragsdatum: '2026-04-15' }),
      makeAntrag({ aktenzeichen: 'A3', tib_kuerz: 'LÄK', antragsdatum: '2026-04-15' }),
    ];
    const toAnon = new Map([['MUE', 'MA01'], ['SCH', 'MA02'], ['LÄK', 'MA03']]);
    const m = computeQuartalsAuslastung(antraege, [], toAnon, '2026-Q2', STD);
    expect(m.size).toBe(3);
    expect(m.get('MA01')?.fest.antraege).toBe(1);
    expect(m.get('MA02')?.fest.antraege).toBe(1);
    expect(m.get('MA03')?.fest.antraege).toBe(1);
  });

  it('verbuende-Sortierung: nach antragsdatum desc', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', akronym: 'OLD' }),
      makeAntrag({ aktenzeichen: 'A2', tib_kuerz: 'MUE', antragsdatum: '2026-06-15', akronym: 'NEW' }),
      makeAntrag({ aktenzeichen: 'A3', tib_kuerz: 'MUE', antragsdatum: '2026-05-15', akronym: 'MID' }),
    ];
    const toAnon = new Map([['MUE', 'MA01']]);
    const m = computeQuartalsAuslastung(antraege, [], toAnon, '2026-Q2', STD);
    const v = m.get('MA01')!.fest.verbuende;
    expect(v.map(x => x.akronym)).toEqual(['NEW', 'MID', 'OLD']);
  });

  it('stundenProTV=0 → fallback auf 9', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15' }),
    ];
    const toAnon = new Map([['MUE', 'MA01']]);
    const m = computeQuartalsAuslastung(antraege, [], toAnon, '2026-Q2', 0);
    expect(m.get('MA01')!.fest.stunden).toBe(9);
  });
});

describe('computeQuartalsAuslastung — antraegeProTyp (v2.16)', () => {
  it('fest: zählt pro Antragstyp via vb_phase (3 → FuE)', () => {
    const antraege = [makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', vb_phase: 3 })];
    const m = computeQuartalsAuslastung(antraege, [], new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.get('MA01')!.fest.antraegeProTyp).toEqual({ FuE: 1 });
    expect(m.get('MA01')!.fest.tvsProTyp).toEqual({ FuE: 1 });
  });

  it('tvsProTyp zählt TVs, antraegeProTyp Verbund-Anteile (3-TV-Verbund FuE)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'V1-A', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1', vb_phase: 3 }),
      makeAntrag({ aktenzeichen: 'V1-B', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1', vb_phase: 3 }),
      makeAntrag({ aktenzeichen: 'V1-C', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1', vb_phase: 3 }),
    ];
    const m = computeQuartalsAuslastung(antraege, [], new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.fest.antraegeProTyp).toEqual({ FuE: 1 }); // 1 Verbund-Anteil
    expect(a.fest.tvsProTyp).toEqual({ FuE: 3 });       // 3 TVs
  });

  it('fest: 4-TV-Verbund zählt 1 pro Verbund-Anteil (nicht pro TV)', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'V1-TV1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1', vb_phase: 5 }),
      makeAntrag({ aktenzeichen: 'V1-TV2', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1', vb_phase: 5 }),
      makeAntrag({ aktenzeichen: 'V1-TV3', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1', vb_phase: 5 }),
      makeAntrag({ aktenzeichen: 'V1-TV4', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1', vb_phase: 5 }),
    ];
    const m = computeQuartalsAuslastung(antraege, [], new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.get('MA01')!.fest.antraegeProTyp).toEqual({ DS: 1 });
  });

  it('fest FuE + pending DS am selben MA → getrennt je Bucket', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', vb_phase: 3 }),
      makeAntrag({ aktenzeichen: 'A2', antragsdatum: '2026-04-15', vb_phase: 5 }),
    ];
    const z = [makeZuweisung({ antragId: 'A2', anonId: 'MA01', status: 'selbst' })];
    const m = computeQuartalsAuslastung(antraege, z, new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    const a = m.get('MA01')!;
    expect(a.fest.antraegeProTyp).toEqual({ FuE: 1 });
    expect(a.pending.antraegeProTyp).toEqual({ DS: 1 });
  });

  it('Irrläufer (vb_phase 9) → kein Bucket', () => {
    const antraege = [makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', vb_phase: 9 })];
    const m = computeQuartalsAuslastung(antraege, [], new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.get('MA01')!.fest.antraegeProTyp).toEqual({});
  });

  it('EMPTY_AUSLASTUNG hat leere antraegeProTyp + tvsProTyp', () => {
    expect(EMPTY_AUSLASTUNG.fest.antraegeProTyp).toEqual({});
    expect(EMPTY_AUSLASTUNG.pending.antraegeProTyp).toEqual({});
    expect(EMPTY_AUSLASTUNG.fest.tvsProTyp).toEqual({});
    expect(EMPTY_AUSLASTUNG.pending.tvsProTyp).toEqual({});
  });
});

describe('computeQuartalsAuslastung — per-Typ-Stunden (v2.31)', () => {
  it('DS-Verbund (vb_phase 5) verbraucht tvCount × 4,5 statt × Standard', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'D1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1', vb_phase: 5 }),
      makeAntrag({ aktenzeichen: 'D2', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', verbund_id: 'V1', vb_phase: 5 }),
    ];
    const m = computeQuartalsAuslastung(antraege, [], new Map([['MUE', 'MA01']]), '2026-Q2', STD, { DS: 4.5 });
    const a = m.get('MA01')!;
    expect(a.fest.tvs).toBe(2);
    expect(a.fest.stunden).toBe(9);            // 2 TVs × 4,5 h
    expect(a.fest.verbuende[0]!.stunden).toBe(9);
    expect(a.fest.tvsProTyp).toEqual({ DS: 2 });
  });

  it('gemischte Buckets: FuE Standard 9, DS Override 4,5 → Summe je Faktor', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'F1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', vb_phase: 3 }),
      makeAntrag({ aktenzeichen: 'D1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', vb_phase: 5 }),
    ];
    const m = computeQuartalsAuslastung(antraege, [], new Map([['MUE', 'MA01']]), '2026-Q2', STD, { DS: 4.5 });
    // 1 FuE-TV × 9 + 1 DS-TV × 4,5 = 13,5
    expect(m.get('MA01')!.fest.stunden).toBe(13.5);
  });

  it('ohne per-Typ-Map → Standard-Faktor (Backward-Compat)', () => {
    const antraege = [makeAntrag({ aktenzeichen: 'D1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15', vb_phase: 5 })];
    const m = computeQuartalsAuslastung(antraege, [], new Map([['MUE', 'MA01']]), '2026-Q2', STD);
    expect(m.get('MA01')!.fest.stunden).toBe(9);
  });
});

describe('getTVCount', () => {
  it('Einzelantrag (kein verbund_id) → 1', () => {
    expect(getTVCount([], undefined, 'A1')).toBe(1);
    expect(getTVCount([], null, 'A1')).toBe(1);
    expect(getTVCount([], '', 'A1')).toBe(1);
  });

  it('Verbund mit 4 TVs → 4', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'TV1', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'TV2', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'TV3', verbund_id: 'V1' }),
      makeAntrag({ aktenzeichen: 'TV4', verbund_id: 'V1' }),
    ];
    expect(getTVCount(antraege, 'V1', 'TV1')).toBe(4);
  });

  it('Verbund ohne Treffer in Liste → 1 (defensiv)', () => {
    expect(getTVCount([], 'V1', 'X1')).toBe(1);
  });
});

describe('EMPTY_AUSLASTUNG', () => {
  it('hat leere Buckets', () => {
    expect(EMPTY_AUSLASTUNG.fest.antraege).toBe(0);
    expect(EMPTY_AUSLASTUNG.pending.antraege).toBe(0);
    expect(EMPTY_AUSLASTUNG.fest.tvs).toBe(0);
    expect(EMPTY_AUSLASTUNG.pending.stunden).toBe(0);
  });
});
