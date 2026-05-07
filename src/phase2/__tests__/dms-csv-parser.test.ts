import { describe, it, expect } from 'vitest';
import { parseCsvLine, parseCsvText } from '../dms-csv/parser';
import { parseDmsCsv } from '../dms-csv/loader';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('parseCsvLine', () => {
  it('split einfache Felder', () => {
    expect(parseCsvLine('a;b;c', ';')).toEqual(['a', 'b', 'c']);
  });

  it('handles trailing separator als leeres Feld', () => {
    expect(parseCsvLine('a;b;', ';')).toEqual(['a', 'b', '']);
  });

  it('handles gequotete Felder mit Semikolon innen', () => {
    expect(parseCsvLine('"a;b";c', ';')).toEqual(['a;b', 'c']);
  });

  it('handles escaped Anführungszeichen ("")', () => {
    expect(parseCsvLine('"a""b";c', ';')).toEqual(['a"b', 'c']);
  });

  it('handles leeres Feld', () => {
    expect(parseCsvLine(';;', ';')).toEqual(['', '', '']);
  });
});

describe('parseCsvText', () => {
  it('strippt BOM und liefert Header + Rows', () => {
    const csv = '﻿a;b;c\n1;2;3\n4;5;6\n';
    const { header, rows } = parseCsvText(csv, ';');
    expect(header).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([['1', '2', '3'], ['4', '5', '6']]);
  });

  it('toleriert CRLF', () => {
    const csv = 'a;b\r\n1;2\r\n';
    const { rows } = parseCsvText(csv, ';');
    expect(rows).toEqual([['1', '2']]);
  });
});

describe('parseDmsCsv', () => {
  it('liest die Sample-CSV als Map<DocID, DmsEntry> ein', () => {
    const samplePath = path.resolve(__dirname, '../../../docs/phase-2/dms-sample.csv');
    const csv = readFileSync(samplePath, 'utf-8');
    const map = parseDmsCsv(csv);
    // Map-Keys sind durchgängig lowercase — exakt eine Map-Zeile pro CSV-Zeile.
    expect(map.size).toBe(10);
    // Lookup nur via lowercase-Schlüssel; entry.docId behält Original-Case.
    const entry = map.get('sample005.docx');
    expect(entry).toBeDefined();
    expect(entry!.docId).toBe('SAMPLE005.docx');
    expect(entry!.aktenplan).toBe('7 Irrelevante Unterlagen');
    expect(entry!.von).toBe('KU5');
    // Lazy FKZ-Extraktion (extracted_fkz-Spalte fehlt im Original)
    expect(entry!.extractedFkz).toBe('16KN000001');
  });

  it('case-insensitive Lookup über lowercase-Schlüssel', () => {
    const samplePath = path.resolve(__dirname, '../../../docs/phase-2/dms-sample.csv');
    const csv = readFileSync(samplePath, 'utf-8');
    const map = parseDmsCsv(csv);
    // SAMPLE010.XLSM ist UPPER — Lookup über lowercase-Variante.
    expect(map.get('sample010.xlsm')).toBeDefined();
    expect(map.get('sample010.xlsm')!.aktenplan).toBe('0.2 Checklisten');
    // Original-Case-Lookup gibt es nicht mehr — Stage 0 normalisiert.
    expect(map.get('SAMPLE010.XLSM')).toBeUndefined();
  });
});
