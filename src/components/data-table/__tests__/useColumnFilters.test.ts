/**
 * Tests fuer die reine Filter-Logik aus useColumnFilters.ts:
 *  - deriveFilterCandidates: distinct Werte je filterable-Spalte (vor Filter),
 *    nutzt filterAccessor falls gesetzt, sonst den Sort-accessor.
 *  - applyColumnFilters: AND ueber Spalten, OR im Set, leeres Set = kein Filter.
 */
import { describe, it, expect } from 'vitest';
import { deriveFilterCandidates, applyColumnFilters } from '../useColumnFilters';
import type { SortableColumn } from '../types';

interface Row { id: string; typ: string; bereich?: string; n: number }

const COLUMNS: SortableColumn<Row>[] = [
  { key: 'typ', label: 'Typ', defaultVisible: true, sortable: true, filterable: true, accessor: r => r.typ, render: () => null },
  {
    key: 'bereich', label: 'Bereich', defaultVisible: true, sortable: true, filterable: true,
    accessor: r => r.bereich ?? '', filterAccessor: r => r.bereich ?? '(kein)', render: () => null,
  },
  // numerische Spalte ohne filterable → taucht NICHT in den Kandidaten auf
  { key: 'n', label: 'N', defaultVisible: true, sortable: true, accessor: r => r.n, render: () => null },
];

const ROWS: Row[] = [
  { id: 'a', typ: 'Lob', bereich: 'Home', n: 1 },
  { id: 'b', typ: 'Bug', bereich: 'Suche', n: 2 },
  { id: 'c', typ: 'Lob', bereich: undefined, n: 3 },
  { id: 'd', typ: 'Idee', bereich: 'Home', n: 4 },
];

describe('deriveFilterCandidates', () => {
  it('liefert distinct, sortierte Werte nur fuer filterable-Spalten', () => {
    const cands = deriveFilterCandidates(ROWS, COLUMNS);
    expect(Object.keys(cands).sort()).toEqual(['bereich', 'typ']); // 'n' fehlt (nicht filterable)
    expect(cands.typ).toEqual(['Bug', 'Idee', 'Lob']);
    // filterAccessor-Fallback fuer fehlenden Bereich → '(kein)'
    expect(cands.bereich).toEqual(['(kein)', 'Home', 'Suche']);
  });
});

describe('applyColumnFilters', () => {
  it('leeres Filter-Objekt → alle Rows', () => {
    expect(applyColumnFilters(ROWS, COLUMNS, {}).map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('OR innerhalb eines Spalten-Sets', () => {
    const res = applyColumnFilters(ROWS, COLUMNS, { typ: new Set(['Lob', 'Idee']) });
    expect(res.map(r => r.id)).toEqual(['a', 'c', 'd']);
  });

  it('AND ueber mehrere Spalten', () => {
    const res = applyColumnFilters(ROWS, COLUMNS, {
      typ: new Set(['Lob']),
      bereich: new Set(['Home']),
    });
    expect(res.map(r => r.id)).toEqual(['a']);
  });

  it('matcht den filterAccessor-Wert (kein Bereich → (kein))', () => {
    const res = applyColumnFilters(ROWS, COLUMNS, { bereich: new Set(['(kein)']) });
    expect(res.map(r => r.id)).toEqual(['c']);
  });

  it('leeres Set fuer eine Spalte wird ignoriert (kein Filter)', () => {
    const res = applyColumnFilters(ROWS, COLUMNS, { typ: new Set() });
    expect(res.map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
