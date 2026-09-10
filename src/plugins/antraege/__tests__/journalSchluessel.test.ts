/**
 * Der Assistent nimmt einen Journal-Lauf der Seite mit, statt `stand.json`
 * (über 5 MB, ungecacht) ein zweites Mal zu lesen. Die Detailseite stempelt
 * ihren Stichtag sekundengenau — der Schlüssel muss deshalb ohne ihn passen,
 * aber nie über fremde Anträge oder einen alten Datenstand.
 */
import { describe, expect, it } from 'vitest';
import { schluesselPasst } from '../status/useJournalChroniken';

describe('schluesselPasst', () => {
  const key = '1700|2026-09-10T08:12:33.456Z|AZ-1|AZ-2';

  it('passt unabhängig vom Stichtag und von der Reihenfolge der Aktenzeichen', () => {
    expect(schluesselPasst(key, ['AZ-2', 'AZ-1'], 1700)).toBe(true);
  });

  it('passt nicht bei anderem Datenstand', () => {
    expect(schluesselPasst(key, ['AZ-1', 'AZ-2'], 1800)).toBe(false);
  });

  it('passt nicht bei Teil- oder Obermenge', () => {
    expect(schluesselPasst(key, ['AZ-1'], 1700)).toBe(false);
    expect(schluesselPasst(key, ['AZ-1', 'AZ-2', 'AZ-3'], 1700)).toBe(false);
  });
});
