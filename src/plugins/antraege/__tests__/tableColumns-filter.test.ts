/**
 * Regression: der Spaltenfilter der „Erstentscheidung"-Spalte muss leere
 * Einträge (Anträge ohne Erstentscheidung) als wählbares „(leer)" anbieten —
 * sonst überspringt `deriveFilterCandidates` den leeren String und die
 * „ohne Erstentscheidung"-Anträge sind nicht filterbar.
 */
import { describe, it, expect } from 'vitest';
import { ANTRAG_TABLE_COLUMNS } from '../tableColumns';
import type { AntragTableRow } from '../tableGrouping';

const erstentscheidung = ANTRAG_TABLE_COLUMNS.find(c => c.key === 'erstentscheidung');

function row(value?: string): AntragTableRow {
  return { aktenzeichen: '16DL260001', programm_id: 'p1', erstentscheidung: value } as unknown as AntragTableRow;
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
