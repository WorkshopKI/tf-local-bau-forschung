import { describe, it, expect } from 'vitest';
import { computeDashboardAggregate } from '@/plugins/home/dashboardAggregate';
import { parseBearbeiterFilter } from '../bearbeiterFilter';
import { SEED_ANTRAEGE, TEST_TODAY_MS } from './fixtures/seed-antraege';
import { REAL_CSV_ANTRAEGE } from './fixtures/real-csv-antraege';

const NEUTRAL = parseBearbeiterFilter(undefined, undefined);

const BAUANTRAEGE: never[] = [];

const FIXTURES = [
  { name: 'Bauantraege (Snake-Case)', data: SEED_ANTRAEGE },
  { name: 'Foerderantraege (CSV-Rohwerte)', data: REAL_CSV_ANTRAEGE },
] as const;

describe.each(FIXTURES)('computeDashboardAggregate — $name', ({ data }) => {
  it('total = 18 (2 Irrlaeufer ausgeblendet)', () => {
    const agg = computeDashboardAggregate(BAUANTRAEGE, data, NEUTRAL, {
      includeBauantraege: false, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.total).toBe(18);
  });
  it('inPruefung > 0 (deckt Bauantrag in_pruefung/in_begutachtung/in_bearbeitung UND Foerderantrag VN/techn/kaufm geprueft/Gutachten)', () => {
    const agg = computeDashboardAggregate(BAUANTRAEGE, data, NEUTRAL, {
      includeBauantraege: false, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.inPruefung).toBe(4);
  });
  it('nachforderung > 0 (deckt Bauantrag nachforderung/nachbesserung UND Foerderantrag NF gestellt)', () => {
    const agg = computeDashboardAggregate(BAUANTRAEGE, data, NEUTRAL, {
      includeBauantraege: false, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.nachforderung).toBe(2);
  });
  it('bewilligt > 0 (deckt Bauantrag genehmigt/bewilligt UND Foerderantrag bewilligt)', () => {
    const agg = computeDashboardAggregate(BAUANTRAEGE, data, NEUTRAL, {
      includeBauantraege: false, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.bewilligt).toBe(4);
  });
  it('offen = 18 - closed (closed = 4 bewilligt + 1 abgelehnt + 2 abgeschlossen)', () => {
    const agg = computeDashboardAggregate(BAUANTRAEGE, data, NEUTRAL, {
      includeBauantraege: false, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.offen).toBe(11);
  });
});

describe.each(FIXTURES)('Bearbeiter-Filter reduziert Counts — $name', ({ data }) => {
  it('bearbeiter=ABC → total = 2 (nur tib_kuerz="abc" items, vb_phase!=9)', () => {
    const bearb = parseBearbeiterFilter('ABC', false);
    const agg = computeDashboardAggregate(BAUANTRAEGE, data, bearb, {
      includeBauantraege: false, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.total).toBe(2);
  });
  it('bearbeiter=ABC → bewilligt = 1 (nur *-018)', () => {
    const bearb = parseBearbeiterFilter('ABC', false);
    const agg = computeDashboardAggregate(BAUANTRAEGE, data, bearb, {
      includeBauantraege: false, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.bewilligt).toBe(1);
  });
  it('bearbeiter=ABC → offen = 1 (nur *-016)', () => {
    const bearb = parseBearbeiterFilter('ABC', false);
    const agg = computeDashboardAggregate(BAUANTRAEGE, data, bearb, {
      includeBauantraege: false, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.offen).toBe(1);
  });
});

describe('computeDashboardAggregate — leere Eingaben', () => {
  it('beide leer → alle counts 0', () => {
    const agg = computeDashboardAggregate(BAUANTRAEGE, [], NEUTRAL, {
      includeBauantraege: true, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats).toEqual({
      total: 0, offen: 0, inPruefung: 0, nachforderung: 0, bewilligt: 0,
    });
  });
  it('includeAntraege=false → Antraege werden ignoriert', () => {
    const agg = computeDashboardAggregate(BAUANTRAEGE, SEED_ANTRAEGE, NEUTRAL, {
      includeBauantraege: true, includeAntraege: false, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.total).toBe(0);
  });
});

describe('computeDashboardAggregate — KUERZ-Detection', () => {
  it('anyKuerzelSeen=true wenn mindestens ein Antrag tib_kuerz hat', () => {
    const agg = computeDashboardAggregate(BAUANTRAEGE, SEED_ANTRAEGE, NEUTRAL, {
      includeBauantraege: false, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.anyKuerzelSeen).toBe(true);
  });
  it('anyKuerzelSeen=false bei Antraegen ohne KUERZ', () => {
    const ohneKuerz = SEED_ANTRAEGE.map(a => {
      const { tib_kuerz: _t, bib_kuerz: _b, ztp_kuerz: _z, pfm_kuerz: _p, ...rest } = a;
      return rest;
    });
    const agg = computeDashboardAggregate(BAUANTRAEGE, ohneKuerz, NEUTRAL, {
      includeBauantraege: false, includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.anyKuerzelSeen).toBe(false);
  });
});
