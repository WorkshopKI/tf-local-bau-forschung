/**
 * canonicalRowHash — die Zeilen-Fingerprints des CSV-Imports.
 *
 * Fokus: das Hash bezieht das Column-Mapping ein. Das ist die Grundlage des
 * `force`-Re-Imports — wird eine Spalte (z.B. T_HINT) zum Mapping hinzugefuegt,
 * aendert sich der Hash jeder Zeile, sodass der Row-Diff (sobald der Datei-
 * Checksum-Skip per `force` umgangen ist) alle Zeilen als „changed" erkennt und
 * neu merged.
 */
import { describe, it, expect } from 'vitest';
import { canonicalRowHash } from '../hash';
import type { ColumnMapping } from '../types';

describe('canonicalRowHash', () => {
  it('ändert sich, wenn eine Spalte zum Mapping hinzukommt', () => {
    const row = { AZ: '16KN1', T_HINT: 'Bemerkung' };
    const before: ColumnMapping = { AZ: { canonical: 'aktenzeichen' } };
    const after: ColumnMapping = {
      AZ: { canonical: 'aktenzeichen' },
      T_HINT: { canonical: 't_hint' },
    };
    expect(canonicalRowHash(row, before)).not.toBe(canonicalRowHash(row, after));
  });

  it('gleiches Mapping + gleiche Zeile → gleicher Hash (deterministisch)', () => {
    const row = { AZ: '16KN1', X: 'y' };
    const m: ColumnMapping = { AZ: { canonical: 'aktenzeichen' }, X: { custom: 'x' } };
    expect(canonicalRowHash(row, m)).toBe(canonicalRowHash(row, m));
  });

  it('ignorierte Spalten zählen nicht zum Hash', () => {
    const row = { AZ: '1', X: 'y' };
    const withIgnored: ColumnMapping = { AZ: { canonical: 'aktenzeichen' }, X: { ignore: true } };
    const without: ColumnMapping = { AZ: { canonical: 'aktenzeichen' } };
    expect(canonicalRowHash(row, withIgnored)).toBe(canonicalRowHash(row, without));
  });
});
