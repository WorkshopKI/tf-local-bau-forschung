import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseUnterprogrammLabelXlsx,
  computeUnterprogrammLabelDiff,
  type UnterprogrammLabelEntry,
} from '../unterprogrammLabelXlsx';
import type { Unterprogramm } from '../types';

function makeXlsxFile(rows: unknown[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function makeUp(code: string, name?: string, geplanter_zeitraum?: string): Unterprogramm {
  return {
    id: code,
    programm_id: 'p1',
    code,
    name,
    geplanter_zeitraum,
    aktiv: true,
    antrag_count_cached: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('parseUnterprogrammLabelXlsx', () => {
  it('parst id/label/jahr Spalten', async () => {
    const file = makeXlsxFile([
      ['id', 'label', 'jahr'],
      ['47', 'Innovationsförderung', '2020-2025'],
      ['78', 'Markteinführung', '2018-2024'],
    ]);
    const out = await parseUnterprogrammLabelXlsx(file);
    expect(out).toEqual([
      { code: '47', label: 'Innovationsförderung', jahr: '2020-2025' },
      { code: '78', label: 'Markteinführung', jahr: '2018-2024' },
    ]);
  });

  it('konvertiert numerische ID-Werte zu String', async () => {
    const file = makeXlsxFile([
      ['id', 'label', 'jahr'],
      [47, 'Foo', 2020], // Excel speichert als Zahl
    ]);
    const out = await parseUnterprogrammLabelXlsx(file);
    expect(out[0]?.code).toBe('47');
    expect(out[0]?.jahr).toBe('2020');
  });

  it('akzeptiert Spalten case-insensitive und mit Leerzeichen', async () => {
    const file = makeXlsxFile([
      [' ID ', 'LABEL', 'Jahr'],
      ['47', 'Foo', '2020'],
    ]);
    const out = await parseUnterprogrammLabelXlsx(file);
    expect(out).toEqual([{ code: '47', label: 'Foo', jahr: '2020' }]);
  });

  it('jahr ist optional', async () => {
    const file = makeXlsxFile([
      ['id', 'label'],
      ['47', 'Foo'],
    ]);
    const out = await parseUnterprogrammLabelXlsx(file);
    expect(out).toEqual([{ code: '47', label: 'Foo', jahr: undefined }]);
  });

  it('überspringt leere Zeilen und Zeilen ohne Code', async () => {
    const file = makeXlsxFile([
      ['id', 'label', 'jahr'],
      ['', '', ''],
      ['', 'Foo', '2020'], // ohne Code → skip
      ['47', 'Bar', '2020'],
    ]);
    const out = await parseUnterprogrammLabelXlsx(file);
    expect(out).toHaveLength(1);
    expect(out[0]?.code).toBe('47');
  });

  it('wirft bei fehlender Pflicht-Spalte', async () => {
    const file = makeXlsxFile([
      ['code', 'name', 'jahr'], // 'id' und 'label' fehlen
      ['47', 'Foo', '2020'],
    ]);
    await expect(parseUnterprogrammLabelXlsx(file)).rejects.toThrow(/Pflicht-Spalten/);
  });

  it('wirft bei nur Header-Zeile', async () => {
    const file = makeXlsxFile([['id', 'label', 'jahr']]);
    await expect(parseUnterprogrammLabelXlsx(file)).rejects.toThrow(/keine Daten/);
  });
});

describe('computeUnterprogrammLabelDiff', () => {
  const existing: Unterprogramm[] = [
    makeUp('47', 'Bestehend', '2018-2022'),
    makeUp('78'), // ohne Label/Jahr
    makeUp('99', 'Identisch', '2020'),
  ];

  it('erkennt name_changed', () => {
    const imp: UnterprogrammLabelEntry[] = [{ code: '47', label: 'Neu', jahr: '2018-2022' }];
    const d = computeUnterprogrammLabelDiff(existing, imp);
    expect(d.rows[0]?.kind).toBe('name_changed');
    expect(d.rows[0]?.willChangeName).toBe(true);
    expect(d.rows[0]?.willChangeJahr).toBe(false);
    expect(d.summary.name_changed).toBe(1);
    expect(d.summary.zeitraum_changed).toBe(0);
  });

  it('erkennt zeitraum_changed', () => {
    const imp: UnterprogrammLabelEntry[] = [{ code: '47', label: 'Bestehend', jahr: '2099' }];
    const d = computeUnterprogrammLabelDiff(existing, imp);
    expect(d.rows[0]?.kind).toBe('zeitraum_changed');
    expect(d.rows[0]?.willChangeJahr).toBe(true);
    expect(d.summary.zeitraum_changed).toBe(1);
  });

  it('erkennt both_changed', () => {
    const imp: UnterprogrammLabelEntry[] = [{ code: '47', label: 'Neu', jahr: '2099' }];
    const d = computeUnterprogrammLabelDiff(existing, imp);
    expect(d.rows[0]?.kind).toBe('both_changed');
    expect(d.summary.name_changed).toBe(1);
    expect(d.summary.zeitraum_changed).toBe(1);
  });

  it('erkennt unchanged wenn Werte exakt gleich', () => {
    const imp: UnterprogrammLabelEntry[] = [{ code: '99', label: 'Identisch', jahr: '2020' }];
    const d = computeUnterprogrammLabelDiff(existing, imp);
    expect(d.rows[0]?.kind).toBe('unchanged');
    expect(d.summary.unchanged).toBe(1);
  });

  it('erkennt unknown_code', () => {
    const imp: UnterprogrammLabelEntry[] = [{ code: '999', label: 'Fremd', jahr: '2020' }];
    const d = computeUnterprogrammLabelDiff(existing, imp);
    expect(d.rows[0]?.kind).toBe('unknown_code');
    expect(d.rows[0]?.existing).toBeUndefined();
    expect(d.summary.unknown).toBe(1);
  });

  it('füllt leere bestehende Felder als name_changed', () => {
    const imp: UnterprogrammLabelEntry[] = [{ code: '78', label: 'Brandneu', jahr: '2024' }];
    const d = computeUnterprogrammLabelDiff(existing, imp);
    expect(d.rows[0]?.kind).toBe('both_changed');
    expect(d.rows[0]?.willChangeName).toBe(true);
    expect(d.rows[0]?.willChangeJahr).toBe(true);
  });

  it('verarbeitet die Beispiel-5er-Mischung aus dem Verifikations-Plan', () => {
    // 2 existierend + ändernd, 1 unbekannter Code, 1 identisch, 1 mit geändertem Jahr
    const imp: UnterprogrammLabelEntry[] = [
      { code: '47', label: 'Innovationsförderung NEU', jahr: '2018-2022' }, // name_changed
      { code: '78', label: 'Markteinführung', jahr: '2024' }, // both_changed
      { code: '999', label: 'Unbekannt', jahr: '2020' }, // unknown
      { code: '99', label: 'Identisch', jahr: '2020' }, // unchanged
      { code: '47', label: 'Bestehend', jahr: '2099' }, // duplicate code with zeitraum_changed (sollte als eigene Zeile bewertet werden)
    ];
    const d = computeUnterprogrammLabelDiff(existing, imp);
    expect(d.rows).toHaveLength(5);
    expect(d.rows.map(r => r.kind)).toEqual([
      'name_changed',
      'both_changed',
      'unknown_code',
      'unchanged',
      'zeitraum_changed',
    ]);
    expect(d.summary.unknown).toBe(1);
    expect(d.summary.unchanged).toBe(1);
  });
});
