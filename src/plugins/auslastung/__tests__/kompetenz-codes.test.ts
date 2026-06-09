import { describe, it, expect } from 'vitest';
import { deriveCode } from '../services/kompetenz-codes';
import { buildGeometry, COL_W } from '../services/kompetenz-geometry';
import type { KompetenzSchemaEntry } from '../types';

describe('deriveCode', () => {
  it('returns short labels unchanged', () => {
    expect(deriveCode('Energie')).toBe('Energie'); // 7 chars == maxLen
    expect(deriveCode('Bau')).toBe('Bau');
    expect(deriveCode('  Bau  ')).toBe('Bau'); // trims
  });

  it('truncates a single long word with a dot', () => {
    expect(deriveCode('Werkstofftechnik')).toBe('Werkst.');
    expect(deriveCode('Lebensmitteltechnologie')).toBe('Lebens.');
  });

  it('abbreviates slash-joined labels per part', () => {
    expect(deriveCode('Robotik/KI')).toBe('Rob/KI');
    expect(deriveCode('Software/Apps')).toBe('Sof/App');
  });

  it('marks multi-word labels with the first word + dot', () => {
    expect(deriveCode('Erneuerbare Energien')).toBe('Erneue.'); // first word long → truncated
    expect(deriveCode('Neue Werkstoffe')).toBe('Neue.'); // first word short → kept + dot
  });

  it('never returns an empty string for non-empty input and stays single-line', () => {
    const out = deriveCode('Künstliche Intelligenz & Maschinelles Lernen');
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toContain('\n');
  });
});

describe('buildGeometry', () => {
  const schema: KompetenzSchemaEntry[] = [
    { ueberId: 'IT', label: 'Industrielle Technologien', subKategorien: ['A', 'B', 'C'] },
    { ueberId: 'EU', label: 'Energie & Umwelt', subKategorien: ['D', 'E'] },
  ];

  it('produces ma + 5 capacity + comp + haupt columns when capacities shown', () => {
    const g = buildGeometry(schema, false);
    expect(g.cols[0]).toMatchObject({ kind: 'ma', stickyLeft: 0 });
    const caps = g.cols.filter(c => c.kind === 'cap');
    expect(caps).toHaveLength(4); // FuE/DS/DL/NW
    expect(g.cols.some(c => c.kind === 'absch')).toBe(true);
    expect(g.cols[g.cols.length - 1]).toMatchObject({ kind: 'haupt', stickyRight: 0 });
    // sticky-left offsets accumulate: ma=0, FuE=46, DS=100, DL=154, NW=208, Absch=262
    expect(caps.map(c => c.stickyLeft)).toEqual([46, 100, 154, 208]);
    expect(g.leftFrozenWidth).toBe(COL_W.ma + 4 * COL_W.kont + COL_W.absch); // 324
  });

  it('drops the capacity block when kapHidden', () => {
    const g = buildGeometry(schema, true);
    expect(g.cols.some(c => c.kind === 'cap' || c.kind === 'absch')).toBe(false);
    expect(g.leftFrozenWidth).toBe(COL_W.ma);
  });

  it('numbers comp columns globally and marks group edges', () => {
    const g = buildGeometry(schema, false);
    const comp = g.cols.filter(c => c.kind === 'comp');
    expect(comp.map(c => c.subIdx)).toEqual([0, 1, 2, 3, 4]);
    expect(g.totalSubCols).toBe(5);
    expect(g.groups).toEqual([
      { ueberId: 'IT', label: 'Industrielle Technologien', span: 3, start: 0 },
      { ueberId: 'EU', label: 'Energie & Umwelt', span: 2, start: 3 },
    ]);
    const itCols = comp.filter(c => c.ueberId === 'IT');
    expect(itCols[0]!.gsFirst).toBe(true);
    expect(itCols[itCols.length - 1]!.gsLast).toBe(true);
  });

  it('skips groups with zero subcategories', () => {
    const g = buildGeometry([{ ueberId: 'IT', label: 'IT', subKategorien: [] }], false);
    expect(g.groups).toHaveLength(0);
    expect(g.totalSubCols).toBe(0);
  });

  it('keeps the MA column narrow when anonymised (default), widens it for de-anon', () => {
    expect(buildGeometry(schema, false).cols[0]).toMatchObject({ kind: 'ma', width: COL_W.ma });
    const g = buildGeometry(schema, false, true);
    expect(g.cols[0]).toMatchObject({ kind: 'ma', width: COL_W.maWide, stickyLeft: 0 });
    // sticky-left offsets accumulate from the wider MA column
    const caps = g.cols.filter(c => c.kind === 'cap');
    expect(caps.map(c => c.stickyLeft)).toEqual([
      COL_W.maWide, COL_W.maWide + COL_W.kont, COL_W.maWide + 2 * COL_W.kont, COL_W.maWide + 3 * COL_W.kont,
    ]);
  });

  it('uses the narrow comp width for single-subcategory groups (e.g. NM)', () => {
    const g = buildGeometry([
      { ueberId: 'IT', label: 'IT', subKategorien: ['A', 'B'] },
      { ueberId: 'NM', label: 'Naturw. Methoden', subKategorien: ['Naturw.'] },
    ], false);
    const comp = g.cols.filter(c => c.kind === 'comp');
    expect(comp.find(c => c.ueberId === 'IT')!.width).toBe(COL_W.comp);
    expect(comp.find(c => c.ueberId === 'NM')!.width).toBe(COL_W.compNarrow);
  });
});
