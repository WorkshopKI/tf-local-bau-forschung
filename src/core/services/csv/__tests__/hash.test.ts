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

  it('ändert sich, wenn dieselbe Spalte auf ein anderes Zielfeld gemappt wird (custom → canonical)', () => {
    // Regression Bug v2.50: D_AZ1_1 war als Custom-Feld gemappt, wurde auf das
    // Standardfeld `erstentscheidung` umgestellt. Quellspalte + Wert unverändert →
    // ohne Ziel-Feld im Hash bliebe die Zeile „unverändert" und der force-Re-Import
    // würde das neue Standardfeld nie schreiben.
    const row = { AZ: '16KN1', D_AZ1_1: '15.03.2026' };
    const asCustom: ColumnMapping = { AZ: { canonical: 'aktenzeichen' }, D_AZ1_1: { custom: 'd_az1_1' } };
    const asCanonical: ColumnMapping = { AZ: { canonical: 'aktenzeichen' }, D_AZ1_1: { canonical: 'erstentscheidung' } };
    expect(canonicalRowHash(row, asCustom)).not.toBe(canonicalRowHash(row, asCanonical));
  });

  it('ändert sich, wenn nur der TYP korrigiert wird (string → date)', () => {
    // `detectFieldType` rät bei leeren Preview-Zellen 'string', und die
    // D_*-Spalten der C16-Exporte sind in den ersten Zeilen fast alle leer
    // (`sample_9097_AnB` hat 11 solcher Spalten). Korrigiert der Kurator den
    // Typ, lief der force-Re-Import bisher durch, ohne eine einzige Zeile als
    // geändert zu sehen: `coerceValue` wurde nie erneut angewandt, im Antrag
    // blieb „30.06.2028" stehen — während Filter-Engine und Spalten-Inventar
    // den deklarierten Typ glaubten und der Dialog Vollzug meldete.
    const row = { AZ: '16KN1', ZBE: '30.06.2028' };
    const alsText: ColumnMapping = { AZ: { canonical: 'aktenzeichen' }, ZBE: { custom: 'zbe', type: 'string' } };
    const alsDatum: ColumnMapping = { AZ: { canonical: 'aktenzeichen' }, ZBE: { custom: 'zbe', type: 'date' } };
    expect(canonicalRowHash(row, alsText)).not.toBe(canonicalRowHash(row, alsDatum));
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
