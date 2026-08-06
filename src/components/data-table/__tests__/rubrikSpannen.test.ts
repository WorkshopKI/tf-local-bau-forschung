/**
 * Rubrik-Kopfzeile: zusammenhängende Strecken über den Spalten.
 */
import { describe, it, expect } from 'vitest';
import { baueRubrikSpannen } from '../rubrikSpannen';
import type { SortableColumn } from '../types';

interface Row { a: string }

function col(key: string, gruppe?: string): SortableColumn<Row> {
  return { key, label: key, gruppe, defaultVisible: true, sortable: false, accessor: r => r.a, render: () => null };
}

describe('baueRubrikSpannen', () => {
  it('bündelt aufeinanderfolgende Spalten derselben Rubrik', () => {
    const s = baueRubrikSpannen([col('a', 'X'), col('b', 'X'), col('c', 'Y')]);
    expect(s).toEqual([
      { name: 'X', span: 2, startKey: 'a' },
      { name: 'Y', span: 1, startKey: 'c' },
    ]);
  });

  it('die Summe der Spannen deckt IMMER alle Spalten ab — sonst verrutscht die Kopfzeile', () => {
    const spalten = [col('a', 'X'), col('b'), col('c', 'Y'), col('d', 'Y'), col('e', 'X')];
    const s = baueRubrikSpannen(spalten);
    expect(s.reduce((n, x) => n + x.span, 0)).toBe(spalten.length);
  });

  it('zerlegt eine unterbrochene Rubrik in mehrere Strecken statt sie zu verschmelzen', () => {
    const s = baueRubrikSpannen([col('a', 'X'), col('b', 'Y'), col('c', 'X')]);
    expect(s.map(x => [x.name, x.span])).toEqual([['X', 1], ['Y', 1], ['X', 1]]);
  });

  it('führt Spalten ohne Rubrik als namenlose Strecke', () => {
    const s = baueRubrikSpannen([col('a'), col('b'), col('c', 'X')]);
    expect(s[0]).toEqual({ name: null, span: 2, startKey: 'a' });
  });

  it('behandelt eine leere `gruppe` wie „keine Rubrik"', () => {
    const s = baueRubrikSpannen([col('a', '  '), col('b')]);
    expect(s).toEqual([{ name: null, span: 2, startKey: 'a' }]);
  });

  it('bleibt bei leerer Spaltenliste harmlos', () => {
    expect(baueRubrikSpannen([])).toEqual([]);
  });

  it('nimmt als Key die ERSTE Spalte der Strecke — stabil über Renders', () => {
    const s = baueRubrikSpannen([col('fkz', 'Antrag'), col('tib', 'Zuständigkeit'), col('bib', 'Zuständigkeit')]);
    expect(s.map(x => x.startKey)).toEqual(['fkz', 'tib']);
  });
});
