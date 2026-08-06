/**
 * Regression: der Spaltenfilter der „Erstentscheidung"-Spalte muss leere
 * Einträge (Anträge ohne Erstentscheidung) als wählbares „(leer)" anbieten —
 * sonst überspringt `deriveFilterCandidates` den leeren String und die
 * „ohne Erstentscheidung"-Anträge sind nicht filterbar.
 */
import { describe, it, expect } from 'vitest';
import { applyColumnFilters, deriveFilterCandidates } from '@/components/data-table/useColumnFilters';
import { ANTRAG_TABLE_COLUMNS } from '../tableColumns';
import type { AntragTableRow } from '../tableGrouping';

const erstentscheidung = ANTRAG_TABLE_COLUMNS.find(c => c.key === 'erstentscheidung');
const antragseingang = ANTRAG_TABLE_COLUMNS.find(c => c.key === 'antragsdatum');

function row(value?: string): AntragTableRow {
  return { aktenzeichen: '16DL260001', programm_id: 'p1', erstentscheidung: value } as unknown as AntragTableRow;
}

function eingang(akz: string, value?: string): AntragTableRow {
  return { aktenzeichen: akz, programm_id: 'p1', antragsdatum: value } as unknown as AntragTableRow;
}

describe('Erstentscheidung-Spaltenfilter', () => {
  it('ist filterbar und hat einen filterAccessor', () => {
    expect(erstentscheidung?.filterable).toBe(true);
    expect(typeof erstentscheidung?.filterAccessor).toBe('function');
  });

  it('leere/datumslose Erstentscheidung → wählbares „(leer)"', () => {
    expect(erstentscheidung!.filterAccessor!(row(undefined))).toBe('(leer)');
    expect(erstentscheidung!.filterAccessor!(row(''))).toBe('(leer)');
  });

  it('mit Datum → Jahr als Filter-Kandidat', () => {
    expect(erstentscheidung!.filterAccessor!(row('2025-03-15'))).toBe('2025');
    expect(erstentscheidung!.filterAccessor!(row('15.03.2024'))).toBe('2024');
  });
});

/**
 * Der Antragseingang-Filter geht über die ECHTE Spaltendefinition durch die
 * echte Filter-Kette — Kandidaten ableiten, Werte anhaken, Zeilen filtern.
 * Ein Test nur am `filterAccessor` bewiese die Ableitung, nicht die Wirkung.
 */
describe('Antragseingang-Spaltenfilter (Monate, neueste zuerst)', () => {
  const ROWS = [
    eingang('a', '13.08.2026'),
    eingang('b', '02.07.2026'),
    eingang('c', '2026-07-30'),
    eingang('d', '15.12.2025'),
    eingang('e', undefined),
  ];
  const SPALTEN = [antragseingang!];

  it('bietet Monate an — absteigend, „(leer)" zuletzt', () => {
    expect(deriveFilterCandidates(ROWS, SPALTEN).antragsdatum)
      .toEqual(['2026-08', '2026-07', '2025-12', '(leer)']);
  });

  it('beschriftet die Kandidaten deutsch und gruppiert nach Jahr', () => {
    expect(antragseingang!.formatFilterLabel!('2026-08')).toBe('August');
    expect(antragseingang!.filterGroupOf!('2026-08')).toBe('2026');
    expect(antragseingang!.filterGroupOf!('(leer)')).toBeNull();
  });

  it('ein angehaktes JAHR ist die Menge seiner Monatswerte', () => {
    const jahr2026 = new Set(['2026-08', '2026-07']);
    const treffer = applyColumnFilters(ROWS, SPALTEN, { antragsdatum: jahr2026 });
    expect(treffer.map(r => r.aktenzeichen)).toEqual(['a', 'b', 'c']);
  });

  it('ein einzelner Monat filtert auf den Monat, nicht auf das Jahr', () => {
    const treffer = applyColumnFilters(ROWS, SPALTEN, { antragsdatum: new Set(['2026-07']) });
    expect(treffer.map(r => r.aktenzeichen)).toEqual(['b', 'c']);
  });

  it('Zeilen ohne Datum bleiben über „(leer)" erreichbar', () => {
    // Vor der Umstellung lieferten sie '' und fielen still aus der Tabelle,
    // sobald irgendein Wert angehakt war.
    const treffer = applyColumnFilters(ROWS, SPALTEN, { antragsdatum: new Set(['(leer)']) });
    expect(treffer.map(r => r.aktenzeichen)).toEqual(['e']);
  });
});
