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
    // 10 Datenzeilen → 10 Original-Keys + Lowercase-Aliase für mixed-case
    expect(map.size).toBeGreaterThanOrEqual(10);
    const entry = map.get('GLE0P601.docx');
    expect(entry).toBeDefined();
    expect(entry!.aktenplan).toBe('7 Irrelevante Unterlagen');
    expect(entry!.von).toBe('FFNF');
    // Lazy FKZ-Extraktion (extracted_fkz-Spalte fehlt im Original)
    expect(entry!.extractedFkz).toBe('16KN084935');
  });

  it('case-insensitive Lookup über Lowercase-Aliase', () => {
    const samplePath = path.resolve(__dirname, '../../../docs/phase-2/dms-sample.csv');
    const csv = readFileSync(samplePath, 'utf-8');
    const map = parseDmsCsv(csv);
    // GLEYL401.XLSM ist UPPER — Lowercase-Alias muss da sein
    expect(map.get('gleyl401.xlsm')).toBeDefined();
    expect(map.get('gleyl401.xlsm')!.aktenplan).toBe('0.2 Checklisten');
  });
});
