/**
 * Tests fuer die reine Filter-Logik aus useColumnFilters.ts:
 *  - deriveFilterCandidates: distinct Werte je filterable-Spalte (vor Filter),
 *    nutzt filterAccessor falls gesetzt, sonst den Sort-accessor.
 *  - applyColumnFilters: AND ueber Spalten, OR im Set, leeres Set = kein Filter.
 *  - facettenBasis / zaehleFacette: die Zahlen hinter den Dropdown-Eintraegen.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveFilterCandidates, applyColumnFilters, facettenBasis, zaehleFacette,
} from '../useColumnFilters';
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

  it('respektiert filterSort der Spalte statt der de-Collation', () => {
    const umgekehrt: SortableColumn<Row>[] = [{
      ...COLUMNS[0]!, filterSort: (a, b) => b.localeCompare(a),
    }];
    expect(deriveFilterCandidates(ROWS, umgekehrt).typ).toEqual(['Lob', 'Idee', 'Bug']);
  });

  it('ohne filterSort bleibt es bei der bisherigen Reihenfolge', () => {
    expect(deriveFilterCandidates(ROWS, COLUMNS).typ).toEqual(['Bug', 'Idee', 'Lob']);
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

  it('ein injizierter Wert-Zugriff gewinnt ueber den Default', () => {
    // Der Suche-Pfad projiziert seine Filterwerte selbst (`filterType: 'year'`).
    const nurAnfangsbuchstabe = (c: SortableColumn<Row>, r: Row): string =>
      String(c.accessor(r)).slice(0, 1);
    const res = applyColumnFilters(ROWS, COLUMNS, { typ: new Set(['L']) }, nurAnfangsbuchstabe);
    expect(res.map(r => r.id)).toEqual(['a', 'c']);
  });
});

describe('facettenBasis — der eigene Filter zaehlt nicht mit', () => {
  it('laesst den EIGENEN Filter weg', () => {
    const basis = facettenBasis(ROWS, COLUMNS, { typ: new Set(['Lob']) }, 'typ');
    expect(basis.map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('wendet FREMDE Filter an', () => {
    const basis = facettenBasis(ROWS, COLUMNS, { bereich: new Set(['Home']) }, 'typ');
    expect(basis.map(r => r.id)).toEqual(['a', 'd']);
  });

  it('beides gleichzeitig gesetzt → nur der fremde wirkt', () => {
    const basis = facettenBasis(
      ROWS, COLUMNS, { typ: new Set(['Lob']), bereich: new Set(['Home']) }, 'typ',
    );
    expect(basis.map(r => r.id)).toEqual(['a', 'd']);
  });

  it('reicht einen injizierten Wert-Zugriff durch', () => {
    const ersterBuchstabe = (c: SortableColumn<Row>, r: Row): string =>
      String(c.accessor(r)).slice(0, 1);
    const basis = facettenBasis(
      ROWS, COLUMNS, { bereich: new Set(['H']) }, 'typ', ersterBuchstabe,
    );
    expect(basis.map(r => r.id)).toEqual(['a', 'd']);
  });
});

describe('zaehleFacette', () => {
  const typ = COLUMNS[0]!;

  it('zaehlt je Wert', () => {
    expect([...zaehleFacette(ROWS, typ)]).toEqual([['Lob', 2], ['Bug', 1], ['Idee', 1]]);
  });

  it('ein unter fremden Filtern leerer Wert FEHLT im Ergebnis', () => {
    // Die Konvention, auf die sich das Dropdown verlaesst: `counts.get(v) ?? 0`.
    // Der Wert bleibt in der Kandidatenliste stehen, nur eben mit 0.
    const zahlen = zaehleFacette(facettenBasis(ROWS, COLUMNS, { bereich: new Set(['Home']) }, 'typ'), typ);
    expect(zahlen.get('Lob')).toBe(1);
    expect(zahlen.get('Idee')).toBe(1);
    expect(zahlen.has('Bug')).toBe(false);
    expect(zahlen.get('Bug') ?? 0).toBe(0);
  });

  it('Leerwerte zaehlen nicht — Summe bleibt <= Zeilenzahl der Basis', () => {
    // Spalte ohne `filterAccessor`: der fehlende Bereich liefert '' und ist
    // weder Kandidat (siehe deriveFilterCandidates) noch Zaehler.
    const roh: SortableColumn<Row> = {
      key: 'bereichRoh', label: 'Bereich', defaultVisible: true, sortable: true,
      filterable: true, accessor: r => r.bereich ?? '', render: () => null,
    };
    const zahlen = zaehleFacette(ROWS, roh);
    expect([...zahlen.keys()]).toEqual(['Home', 'Suche']);
    const summe = [...zahlen.values()].reduce((n, v) => n + v, 0);
    expect(summe).toBe(3);
    expect(summe).toBeLessThanOrEqual(ROWS.length);
  });

  it('leere Basis → leeres Ergebnis', () => {
    expect(zaehleFacette([], typ).size).toBe(0);
  });
});
