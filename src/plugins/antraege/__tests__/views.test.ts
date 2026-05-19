import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getView, viewCount, type ViewKey } from '../views';
import { parseBearbeiterFilter } from '../bearbeiterFilter';
import { SEED_ANTRAEGE, TEST_TODAY } from './fixtures/seed-antraege';
import { REAL_CSV_ANTRAEGE } from './fixtures/real-csv-antraege';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TEST_TODAY));
});
afterAll(() => {
  vi.useRealTimers();
});

/**
 * Erwartete Counts pro View. Strikt identisch fuer beide Fixtures — wenn
 * Fixture A gruen ist aber Fixture B failt, ist das der Bug.
 */
const EXPECTED: Record<ViewKey, { withPreFilter: number; withoutPreFilter: number }> = {
  // 11 offene (ohne Irrlaeufer) bzw. 13 (mit)
  meine_offenen: { withPreFilter: 11, withoutPreFilter: 13 },
  // SLA-basiert: diese_woche_faellig = #(offen ∧ daysSinceEingang ∈ [84, 90]),
  // ueberfaellig = #(offen ∧ daysSinceEingang > 90). Fixture: SEED-006/REAL-006
  // ist 87d (SLA-Risk diese Woche), SEED-004/REAL-004 ist 131d (ueberfaellig).
  diese_woche_faellig: { withPreFilter: 1, withoutPreFilter: 1 },
  ueberfaellig: { withPreFilter: 1, withoutPreFilter: 1 },
  nachforderungen: { withPreFilter: 2, withoutPreFilter: 2 },
  bewilligt_jahr: { withPreFilter: 3, withoutPreFilter: 3 },
  alle: { withPreFilter: 18, withoutPreFilter: 20 },
};

const FIXTURES = [
  { name: 'Fixture A (Bauantraege, Snake-Case)', data: SEED_ANTRAEGE },
  { name: 'Fixture B (Foerderantraege, CSV-Rohwerte)', data: REAL_CSV_ANTRAEGE },
] as const;

describe.each(FIXTURES)('viewCount mit $name', ({ data }) => {
  for (const key of Object.keys(EXPECTED) as ViewKey[]) {
    const exp = EXPECTED[key];
    it(`${key} mit Pre-Filter (vb_phase=9 ausgeblendet) → ${exp.withPreFilter}`, () => {
      expect(viewCount(key, [...data], undefined, true)).toBe(exp.withPreFilter);
    });
    it(`${key} OHNE Pre-Filter (Irrlaeufer sichtbar) → ${exp.withoutPreFilter}`, () => {
      expect(viewCount(key, [...data], undefined, false)).toBe(exp.withoutPreFilter);
    });
  }
});

describe('viewCount — Edge-Cases', () => {
  it('leerer Array → 0 fuer alle Views', () => {
    for (const v of ['meine_offenen', 'alle', 'bewilligt_jahr', 'nachforderungen'] as ViewKey[]) {
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
    expect(viewCount('alle', [...SEED_ANTRAEGE])).toBe(EXPECTED.alle.withPreFilter);
  });
});

describe.each(FIXTURES)('Bearbeiter-Filter mit $name', ({ data }) => {
  // Bearbeiter='ABC' matcht items mit tib_kuerz='abc'
  const bearb = parseBearbeiterFilter('ABC', false);
  it('viewCount(alle, bearbeiter=ABC) — nur tib_kuerz="abc" Items', () => {
    // Items mit tib_kuerz='abc': *-016, *-018 (beide Fixtures)
    expect(viewCount('alle', [...data], bearb, true)).toBe(2);
  });
  it('viewCount(meine_offenen, bearbeiter=ABC) — nur das offene davon (*-016)', () => {
    expect(viewCount('meine_offenen', [...data], bearb, true)).toBe(1);
  });
  it('viewCount(bewilligt_jahr, bearbeiter=ABC) — nur das bewilligte (*-018)', () => {
    expect(viewCount('bewilligt_jahr', [...data], bearb, true)).toBe(1);
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
