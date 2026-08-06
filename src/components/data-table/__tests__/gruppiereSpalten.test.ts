import { describe, it, expect } from 'vitest';
import { gruppiereSpalten } from '../ColumnPicker';
import type { SortableColumn } from '../types';

interface Zeile { a?: string }

function spalte(key: string, gruppe?: string): SortableColumn<Zeile> {
  return {
    key,
    label: key.toUpperCase(),
    ...(gruppe !== undefined ? { gruppe } : {}),
    defaultVisible: false,
    sortable: false,
    accessor: () => '',
    render: () => null,
  };
}

describe('gruppiereSpalten', () => {
  it('laesst eine Liste ohne Rubriken flach — genau eine namenlose Rubrik', () => {
    const rubriken = gruppiereSpalten([spalte('a'), spalte('b'), spalte('c')]);
    expect(rubriken).toHaveLength(1);
    expect(rubriken[0]!.name).toBeNull();
    expect(rubriken[0]!.columns.map(c => c.key)).toEqual(['a', 'b', 'c']);
  });

  it('ordnet die Rubriken nach dem ERSTEN Auftreten, nicht alphabetisch', () => {
    const rubriken = gruppiereSpalten([
      spalte('a', 'Zuletzt'),
      spalte('b', 'Anfang'),
      spalte('c', 'Zuletzt'),
    ]);
    expect(rubriken.map(r => r.name)).toEqual(['Zuletzt', 'Anfang']);
  });

  it('zieht verstreute Spalten derselben Rubrik zusammen', () => {
    const rubriken = gruppiereSpalten([
      spalte('a', 'Eins'),
      spalte('b', 'Zwei'),
      spalte('c', 'Eins'),
      spalte('d', 'Zwei'),
    ]);
    expect(rubriken.map(r => [r.name, r.columns.map(c => c.key)])).toEqual([
      ['Eins', ['a', 'c']],
      ['Zwei', ['b', 'd']],
    ]);
  });

  it('behandelt fehlende und leere/whitespace-Rubriken gleich (namenlos)', () => {
    const rubriken = gruppiereSpalten([
      spalte('a'),
      spalte('b', '   '),
      spalte('c', ''),
      spalte('d', 'Echt'),
    ]);
    expect(rubriken.map(r => r.name)).toEqual([null, 'Echt']);
    expect(rubriken[0]!.columns.map(c => c.key)).toEqual(['a', 'b', 'c']);
  });

  it('trimmt den Rubriknamen, damit „ Termine" und „Termine" eine Rubrik sind', () => {
    const rubriken = gruppiereSpalten([spalte('a', ' Termine'), spalte('b', 'Termine ')]);
    expect(rubriken).toHaveLength(1);
    expect(rubriken[0]!.name).toBe('Termine');
  });

  it('verliert keine Spalte (Summenprobe)', () => {
    const spalten = [
      spalte('a', 'X'), spalte('b'), spalte('c', 'Y'), spalte('d', 'X'), spalte('e'),
    ];
    const rubriken = gruppiereSpalten(spalten);
    const summe = rubriken.reduce((n, r) => n + r.columns.length, 0);
    expect(summe).toBe(spalten.length);
    expect(rubriken.flatMap(r => r.columns.map(c => c.key)).sort()).toEqual(
      spalten.map(c => c.key).sort(),
    );
  });

  it('kollidiert nicht zwischen namenloser Rubrik und einem Sentinel-aehnlichen Namen', () => {
    const rubriken = gruppiereSpalten([spalte('a'), spalte('b', ' ohne')]);
    expect(rubriken.map(r => r.name)).toEqual([null, 'ohne']);
  });
});
