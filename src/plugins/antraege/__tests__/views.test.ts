import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getView, viewCount, type ViewKey } from '../views';
import { parseBearbeiterFilter } from '../bearbeiterFilter';
import { REAL_CSV_ANTRAEGE, TEST_TODAY } from './fixtures/real-csv-antraege';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TEST_TODAY));
});
afterAll(() => {
  vi.useRealTimers();
});

/** Erwartete Counts pro View gegen die CSV-Rohwert-Fixture. */
const EXPECTED: Record<ViewKey, { withPreFilter: number; withoutPreFilter: number }> = {
  // 11 offene (ohne Irrlaeufer) bzw. 13 (mit)
  meine_offenen: { withPreFilter: 11, withoutPreFilter: 13 },
  // SLA-basiert: diese_woche_faellig = #(offen ∧ daysSinceEingang ∈ [84, 90]),
  // ueberfaellig = #(offen ∧ daysSinceEingang > 90). Fixture: REAL-006
  // ist 87d (SLA-Risk diese Woche), REAL-004 ist 131d (ueberfaellig).
  diese_woche_faellig: { withPreFilter: 1, withoutPreFilter: 1 },
  ueberfaellig: { withPreFilter: 1, withoutPreFilter: 1 },
  bewilligt_jahr: { withPreFilter: 3, withoutPreFilter: 3 },
  alle: { withPreFilter: 18, withoutPreFilter: 20 },
};

describe('viewCount', () => {
  for (const key of Object.keys(EXPECTED) as ViewKey[]) {
    const exp = EXPECTED[key];
    it(`${key} mit Pre-Filter (vb_phase=9 ausgeblendet) → ${exp.withPreFilter}`, () => {
      expect(viewCount(key, [...REAL_CSV_ANTRAEGE], undefined, true)).toBe(exp.withPreFilter);
    });
    it(`${key} OHNE Pre-Filter (Irrlaeufer sichtbar) → ${exp.withoutPreFilter}`, () => {
      expect(viewCount(key, [...REAL_CSV_ANTRAEGE], undefined, false)).toBe(exp.withoutPreFilter);
    });
  }
});

describe('viewCount — Edge-Cases', () => {
  it('leerer Array → 0 fuer alle Views', () => {
    for (const v of ['meine_offenen', 'alle', 'bewilligt_jahr', 'ueberfaellig'] as ViewKey[]) {
      expect(viewCount(v, [], undefined, true)).toBe(0);
    }
  });
  it('Antrag ohne status → faellt aus isOpenStatus / meine_offenen', () => {
    const noStatus = [{
      aktenzeichen: 'X', programm_id: 'P', _updated_at: '2026-01-01T00:00:00Z',
    }];
    expect(viewCount('meine_offenen', noStatus as never, undefined, true)).toBe(0);
  });
  it('Default-Wert fuer applyVbPhasePreFilter ist true', () => {
    expect(viewCount('alle', [...REAL_CSV_ANTRAEGE])).toBe(EXPECTED.alle.withPreFilter);
  });
});

describe('Bearbeiter-Filter', () => {
  // Bearbeiter='ABC' matcht items mit tib_kuerz='abc'
  const bearb = parseBearbeiterFilter('ABC', false);
  it('viewCount(alle, bearbeiter=ABC) — nur tib_kuerz="abc" Items', () => {
    // Items mit tib_kuerz='abc': REAL-016, REAL-018
    expect(viewCount('alle', [...REAL_CSV_ANTRAEGE], bearb, true)).toBe(2);
  });
  it('viewCount(meine_offenen, bearbeiter=ABC) — nur das offene davon (REAL-016)', () => {
    expect(viewCount('meine_offenen', [...REAL_CSV_ANTRAEGE], bearb, true)).toBe(1);
  });
  it('viewCount(bewilligt_jahr, bearbeiter=ABC) — nur das bewilligte (REAL-018)', () => {
    expect(viewCount('bewilligt_jahr', [...REAL_CSV_ANTRAEGE], bearb, true)).toBe(1);
  });
});

describe('viewCount — Begleitphasen-Filter (Tab-Counts konsistent zur Liste)', () => {
  // „vn geprüft" → Kategorie begleitung; isOpenStatus schließt Begleitung ein,
  // d.h. ohne Begleit-Filter zählt der offene Begleit-Antrag mit.
  const data = [
    { aktenzeichen: 'BEGLEIT-1', programm_id: 'P', status: 'vn geprüft', _updated_at: '2026-01-01T00:00:00Z' },
    { aktenzeichen: 'OFFEN-1', programm_id: 'P', status: 'techn geprüft', _updated_at: '2026-01-01T00:00:00Z' },
  ] as never;

  it('ohne bearbeiter-Mode → Begleit zählt mit (Default includeBegleitung=true)', () => {
    expect(viewCount('meine_offenen', data, undefined, true)).toBe(2);
  });
  it('includeBegleitung=false → Begleit ausgeblendet (wie die Liste)', () => {
    const mode = parseBearbeiterFilter('alle', false); // active:false, includeBegleitung:false
    expect(viewCount('meine_offenen', data, mode, true)).toBe(1);
  });
  it('includeBegleitung=true → Begleit zählt mit', () => {
    const mode = parseBearbeiterFilter('alle', true);
    expect(viewCount('meine_offenen', data, mode, true)).toBe(2);
  });
});

describe('getView — Fallback', () => {
  it('liefert bekannten View', () => {
    expect(getView('alle').key).toBe('alle');
  });
  it('liefert Fallback bei unbekanntem Key', () => {
    expect(getView('fantasie' as ViewKey).key).toBe('alle');
  });
});
