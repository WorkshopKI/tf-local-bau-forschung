/**
 * Tests fuer den Module-globalen Closure-Cache in `buildVerbundClassificationViews`
 * (Hebel A aus Performance-Patch v2.12).
 *
 * Hintergrund: beim Re-Mount der KlassifizierungsReview-Komponente (Plugin-
 * Wechsel) wurden vorher pro Mount ~690 ms Stage-2-Cosine-Similarity neu
 * gerechnet. Der Cache haelt das Ergebnis bei ref-identischen Inputs — alle
 * Store-Refs aus Zustand sind bei Re-Mount stabil, daher O(1)-Hit.
 *
 * Alle sieben Cache-Key-Parts werden einzeln getestet.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Antrag, Verbund } from '@/core/services/csv/types';
import {
  buildVerbundClassificationViews,
  invalidateVerbundClassificationCache,
} from '../services/verbund-aggregation';
import type { Klassifizierung, UeberKategorie } from '../types';

// `status` als plain string nehmen + via `as Antrag` casten — vermeidet
// asAntragStatusRaw-Boilerplate (Pitfall #12 aus CLAUDE.md, gleiches Pattern
// wie in altlast.test.ts).
type AntragInit = Omit<Partial<Antrag>, 'status'> & Pick<Antrag, 'aktenzeichen'> & { status?: string };

function makeAntrag(overrides: AntragInit): Antrag {
  return {
    _updated_at: '2026-04-15T12:00:00Z',
    ...overrides,
  } as Antrag;
}

describe('buildVerbundClassificationViews — Closure-Cache', () => {
  beforeEach(() => {
    invalidateVerbundClassificationCache();
  });

  it('Folge-Call mit identischen Refs liefert dasselbe Ergebnis-Array (===)', () => {
    const antraege: Antrag[] = [makeAntrag({ aktenzeichen: 'A1', akronym: 'X' })];
    const kategorien: UeberKategorie[] = [];
    const persisted: Klassifizierung[] = [];
    const verbuende: Verbund[] = [];
    const a = buildVerbundClassificationViews(antraege, null, kategorien, persisted, undefined, false, verbuende);
    const b = buildVerbundClassificationViews(antraege, null, kategorien, persisted, undefined, false, verbuende);
    expect(b).toBe(a);
  });

  it('andere antraege-Ref → Re-Compute', () => {
    const k: UeberKategorie[] = [];
    const p: Klassifizierung[] = [];
    const v: Verbund[] = [];
    const a = buildVerbundClassificationViews([makeAntrag({ aktenzeichen: 'A' })], null, k, p, undefined, false, v);
    const b = buildVerbundClassificationViews([makeAntrag({ aktenzeichen: 'B' })], null, k, p, undefined, false, v);
    expect(b).not.toBe(a);
  });

  it('anderes jahr → Re-Compute (Pool-Filter aendert sich)', () => {
    const antraege: Antrag[] = [];
    const k: UeberKategorie[] = [];
    const p: Klassifizierung[] = [];
    const v: Verbund[] = [];
    const a = buildVerbundClassificationViews(antraege, null, k, p, undefined, false, v);
    const b = buildVerbundClassificationViews(antraege, 2026, k, p, undefined, false, v);
    expect(b).not.toBe(a);
  });

  it('andere kategorien-Ref → Re-Compute', () => {
    const antraege: Antrag[] = [];
    const p: Klassifizierung[] = [];
    const v: Verbund[] = [];
    const a = buildVerbundClassificationViews(antraege, null, [], p, undefined, false, v);
    const b = buildVerbundClassificationViews(antraege, null, [], p, undefined, false, v);
    expect(b).not.toBe(a);  // verschiedene Array-Literale, verschiedene Refs
  });

  it('andere persisted-Ref → Re-Compute', () => {
    const antraege: Antrag[] = [];
    const k: UeberKategorie[] = [];
    const v: Verbund[] = [];
    const a = buildVerbundClassificationViews(antraege, null, k, [], undefined, false, v);
    const b = buildVerbundClassificationViews(antraege, null, k, [], undefined, false, v);
    expect(b).not.toBe(a);
  });

  it('andere verbundEmbeddings-Ref → Re-Compute', () => {
    const antraege: Antrag[] = [];
    const k: UeberKategorie[] = [];
    const p: Klassifizierung[] = [];
    const v: Verbund[] = [];
    const map1 = new Map([['V1', [0.1, 0.2]]]);
    const map2 = new Map([['V1', [0.1, 0.2]]]);
    const a = buildVerbundClassificationViews(antraege, null, k, p, map1, false, v);
    const b = buildVerbundClassificationViews(antraege, null, k, p, map2, false, v);
    expect(b).not.toBe(a);
  });

  it('stage2Aktiv true ↔ false → Re-Compute', () => {
    const antraege: Antrag[] = [];
    const k: UeberKategorie[] = [];
    const p: Klassifizierung[] = [];
    const v: Verbund[] = [];
    const a = buildVerbundClassificationViews(antraege, null, k, p, undefined, false, v);
    const b = buildVerbundClassificationViews(antraege, null, k, p, undefined, true, v);
    expect(b).not.toBe(a);
  });

  it('andere verbuende-Ref → Re-Compute', () => {
    const antraege: Antrag[] = [];
    const k: UeberKategorie[] = [];
    const p: Klassifizierung[] = [];
    const a = buildVerbundClassificationViews(antraege, null, k, p, undefined, false, []);
    const b = buildVerbundClassificationViews(antraege, null, k, p, undefined, false, []);
    expect(b).not.toBe(a);
  });

  it('invalidateVerbundClassificationCache zwingt Re-Compute', () => {
    const antraege: Antrag[] = [];
    const k: UeberKategorie[] = [];
    const p: Klassifizierung[] = [];
    const v: Verbund[] = [];
    const a = buildVerbundClassificationViews(antraege, null, k, p, undefined, false, v);
    invalidateVerbundClassificationCache();
    const b = buildVerbundClassificationViews(antraege, null, k, p, undefined, false, v);
    expect(b).not.toBe(a);
  });

  it('Pool-Filterung im Service: jahr=2026 filtert antraege ohne datum/2026-Prefix raus', () => {
    const antraege: Antrag[] = [
      makeAntrag({ aktenzeichen: 'A1', antragsdatum: '2026-04-15' }),
      makeAntrag({ aktenzeichen: 'A2', antragsdatum: '2025-12-01' }),
      makeAntrag({ aktenzeichen: 'A3', antragsdatum: '2026-01-01' }),
    ];
    const views = buildVerbundClassificationViews(antraege, 2026, [], [], undefined, false, []);
    const aktenzeichen = views.map(v => v.tvs[0]!.aktenzeichen).sort();
    expect(aktenzeichen).toEqual(['A1', 'A3']);
  });

  it('Pool-Filterung: TiB-Kuerzel raus, irrlaeufer raus, abgelehnt raus', () => {
    const antraege: Antrag[] = [
      makeAntrag({ aktenzeichen: 'A1', antragsdatum: '2026-04-15' }),                          // ok
      makeAntrag({ aktenzeichen: 'A2', antragsdatum: '2026-04-15', tib_kuerz: 'MUE' }),        // raus (zugewiesen)
      makeAntrag({ aktenzeichen: 'A3', antragsdatum: '2026-04-15', status: 'irrläufer' }),     // raus
      makeAntrag({ aktenzeichen: 'A4', antragsdatum: '2026-04-15', status: 'abgelehnt/zurückgezogen' }), // raus
    ];
    const views = buildVerbundClassificationViews(antraege, 2026, [], [], undefined, false, []);
    expect(views.map(v => v.tvs[0]!.aktenzeichen)).toEqual(['A1']);
  });

  it('jahr=null → keine Pool-Filterung', () => {
    const antraege: Antrag[] = [
      makeAntrag({ aktenzeichen: 'A1', antragsdatum: '2025-04-15' }),
      makeAntrag({ aktenzeichen: 'A2', antragsdatum: '2026-04-15', tib_kuerz: 'MUE' }),
      makeAntrag({ aktenzeichen: 'A3', status: 'irrläufer' }),
    ];
    const views = buildVerbundClassificationViews(antraege, null, [], [], undefined, false, []);
    expect(views.length).toBe(3);
  });
});
