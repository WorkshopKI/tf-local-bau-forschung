import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { applyFilters } from '@/core/services/csv/filter/engine';
import type { ActiveFilter, FilterDefinition } from '@/core/services/csv/filter/types';
import type { AntragListItem } from '@/core/services/csv/types';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { getView, type ViewKey } from '../views';
import { hasExplicitVbPhaseFilter } from '../useFilteredAntraege';
import { parseBearbeiterFilter, applyBearbeiterFilter } from '../bearbeiterFilter';
import { SEED_ANTRAEGE, TEST_TODAY } from './fixtures/seed-antraege';
import { REAL_CSV_ANTRAEGE } from './fixtures/real-csv-antraege';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TEST_TODAY));
});
afterAll(() => {
  vi.useRealTimers();
});

/** Spiegel der Pipeline in `useFilteredAntraege` — als reine Funktion, damit der Test
 *  ohne React-Hook-Lifecycle laufen kann. Schritte: View-Predicate, Pre-Filter (vb_phase=9),
 *  Bearbeiter-Filter, Custom-Filter. */
function runPipeline(
  data: readonly AntragListItem[],
  viewKey: ViewKey,
  active: ActiveFilter[],
  definitions: FilterDefinition[],
  bearbeiter: ReturnType<typeof parseBearbeiterFilter>,
): AntragListItem[] {
  const view = getView(viewKey);
  const byView = data.filter(a => view.predicate(a));
  const explicit = hasExplicitVbPhaseFilter(active, definitions);
  const byPreFilter = explicit ? byView : byView.filter(a => !isIrrlaeufer(a.vb_phase));
  const byBearbeiter = applyBearbeiterFilter(byPreFilter, bearbeiter);
  return applyFilters(byBearbeiter, active, definitions);
}

const NEUTRAL = parseBearbeiterFilter(undefined, undefined);
const ABC = parseBearbeiterFilter('ABC', false);

const STATUS_FILTER_DEF: FilterDefinition = {
  id: 'filter-status',
  programm_id: 'TEST-PROG',
  scope: 'system',
  name: 'Status',
  feld: 'status',
  typ: 'multi_select',
  config: { werte_quelle: 'auto' },
  anzeige_reihenfolge: 1,
  versteckt: false,
  erstellt_am: '2026-01-01',
  aktualisiert_am: '2026-01-01',
};

const VB_PHASE_FILTER_DEF: FilterDefinition = {
  id: 'filter-vbphase',
  programm_id: 'TEST-PROG',
  scope: 'system',
  name: 'VB-Phase',
  feld: 'vb_phase',
  typ: 'multi_select',
  config: { werte_quelle: 'auto' },
  anzeige_reihenfolge: 2,
  versteckt: false,
  erstellt_am: '2026-01-01',
  aktualisiert_am: '2026-01-01',
};

const DEFS = [STATUS_FILTER_DEF, VB_PHASE_FILTER_DEF];

describe('View "alle" + Status-Filter — beide Welten', () => {
  it('Bauantraege: Filter ["bewilligt"] matcht NUR Bauantrag "bewilligt" (Substring-Vergleich, Rohwert)', () => {
    const active: ActiveFilter[] = [{ filterId: 'filter-status', value: ['bewilligt'] }];
    const result = runPipeline(SEED_ANTRAEGE, 'alle', active, DEFS, NEUTRAL);
    // SEED-007 (bewilligt), SEED-009 (bewilligt), SEED-018 (bewilligt) — NICHT SEED-008 (genehmigt)
    expect(result.map(r => r.aktenzeichen).sort()).toEqual(['SEED-007', 'SEED-009', 'SEED-018']);
  });
  it('Foerderantraege: Filter ["bewilligt"] matcht alle Foerderantrag "bewilligt"-Items', () => {
    const active: ActiveFilter[] = [{ filterId: 'filter-status', value: ['bewilligt'] }];
    const result = runPipeline(REAL_CSV_ANTRAEGE, 'alle', active, DEFS, NEUTRAL);
    expect(result.map(r => r.aktenzeichen).sort()).toEqual(['REAL-007', 'REAL-008', 'REAL-009', 'REAL-018']);
  });
});

describe('View "nachforderungen" — beide Welten', () => {
  it('Bauantraege: nur Bauantrag nachforderung/nachbesserung', () => {
    const result = runPipeline(SEED_ANTRAEGE, 'nachforderungen', [], [], NEUTRAL);
    expect(result.map(r => r.aktenzeichen).sort()).toEqual(['SEED-005', 'SEED-006']);
  });
  it('Foerderantraege: nur Foerderantrag "NF gestellt" (View-Predicate ueber Kategorie)', () => {
    const result = runPipeline(REAL_CSV_ANTRAEGE, 'nachforderungen', [], [], NEUTRAL);
    expect(result.map(r => r.aktenzeichen).sort()).toEqual(['REAL-005', 'REAL-006']);
  });
});

describe('View "meine_offenen" + Bearbeiter-Filter — Intersection', () => {
  it('Bauantraege: bearbeiter=ABC → nur SEED-016', () => {
    const result = runPipeline(SEED_ANTRAEGE, 'meine_offenen', [], [], ABC);
    expect(result.map(r => r.aktenzeichen)).toEqual(['SEED-016']);
  });
  it('Foerderantraege: bearbeiter=ABC → nur REAL-016', () => {
    const result = runPipeline(REAL_CSV_ANTRAEGE, 'meine_offenen', [], [], ABC);
    expect(result.map(r => r.aktenzeichen)).toEqual(['REAL-016']);
  });
});

describe('vb_phase-Filter steuert den Irrlaeufer-Pre-Filter', () => {
  it('View "alle" + vb_phase-Filter [9] → Irrlaeufer sind sichtbar (Pre-Filter deaktiviert)', () => {
    const active: ActiveFilter[] = [{ filterId: 'filter-vbphase', value: ['9'] }];
    const result = runPipeline(SEED_ANTRAEGE, 'alle', active, DEFS, NEUTRAL);
    // SEED-013, SEED-014 (beide vb_phase=9)
    expect(result.map(r => r.aktenzeichen).sort()).toEqual(['SEED-013', 'SEED-014']);
  });
  it('View "alle" + vb_phase-Filter [3] → nur FuE-Antraege', () => {
    const active: ActiveFilter[] = [{ filterId: 'filter-vbphase', value: ['3'] }];
    const result = runPipeline(SEED_ANTRAEGE, 'alle', active, DEFS, NEUTRAL);
    // Alle mit vb_phase=3: SEED-003, 004, 005, 007, 009, 010, 011, 018
    expect(result.map(r => r.aktenzeichen).sort()).toEqual([
      'SEED-003', 'SEED-004', 'SEED-005', 'SEED-007', 'SEED-009', 'SEED-010', 'SEED-018',
    ]);
  });
  it('View "alle" ohne Filter → Irrlaeufer ausgeblendet (Pre-Filter aktiv)', () => {
    const result = runPipeline(SEED_ANTRAEGE, 'alle', [], [], NEUTRAL);
    expect(result.find(r => r.aktenzeichen === 'SEED-013')).toBeUndefined();
    expect(result.find(r => r.aktenzeichen === 'SEED-014')).toBeUndefined();
    expect(result).toHaveLength(18);
  });
});

describe('hasExplicitVbPhaseFilter', () => {
  it('false bei leeren actives', () => {
    expect(hasExplicitVbPhaseFilter([], DEFS)).toBe(false);
  });
  it('false bei nicht-vb_phase Filter', () => {
    const active: ActiveFilter[] = [{ filterId: 'filter-status', value: ['bewilligt'] }];
    expect(hasExplicitVbPhaseFilter(active, DEFS)).toBe(false);
  });
  it('true bei vb_phase Filter', () => {
    const active: ActiveFilter[] = [{ filterId: 'filter-vbphase', value: ['3'] }];
    expect(hasExplicitVbPhaseFilter(active, DEFS)).toBe(true);
  });
  it('false bei unbekannter filter-ID', () => {
    const active: ActiveFilter[] = [{ filterId: 'unknown', value: ['x'] }];
    expect(hasExplicitVbPhaseFilter(active, DEFS)).toBe(false);
  });
});
