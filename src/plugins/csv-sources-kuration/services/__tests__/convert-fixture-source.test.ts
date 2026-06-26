/**
 * „Demo-Quelle → echte Quelle umwandeln": macht aus einem Fixture-Schema
 * (`fixture-real-*`, vom Auto-Refresh ausgeschlossen) eine echte Quelle mit
 * neuer Nicht-Fixture-ID — Mapping/Join/Priorität bleiben erhalten, der
 * Import-Zustand wird zurückgesetzt (die echte Datei ist noch nicht importiert).
 */
import { describe, it, expect } from 'vitest';
import { deriveRealSchemaId, buildRealSchemaFromFixture } from '../convert-fixture-source';
import { isFixtureSchemaId } from '@/core/services/seed/fixture-ids';
import type { CsvSchema } from '@/core/services/csv/types';

function fixture(over: Partial<CsvSchema> = {}): CsvSchema {
  return {
    id: 'fixture-real-anb',
    programm_id: 'p1',
    csv_source_name: 'Antragsbasis (Master)',
    is_master: true,
    join_key: 'aktenzeichen',
    priority: 100,
    column_mapping: { FKZ: { canonical: 'foerderkennzeichen' }, AKZ: {} },
    encoding: 'windows-1252',
    separator: ';',
    file_checksum: 'abc123',
    last_imported_at: '2026-06-25T00:00:00.000Z',
    last_row_count: 44,
    source_file_name: 'demo.csv',
    source_last_modified: 1_700_000_000_000,
    last_file_size: 999,
    created_at: '2026-06-01T00:00:00.000Z',
    ...over,
  } as CsvSchema;
}

describe('deriveRealSchemaId', () => {
  it('slugifiziert den Quellnamen', () => {
    expect(deriveRealSchemaId('Antragsbasis (Master)', new Set())).toBe('antragsbasis-master');
  });

  it('vermeidet Kollisionen mit bestehenden IDs', () => {
    expect(deriveRealSchemaId('Bewilligungsdetails', new Set(['bewilligungsdetails']))).toBe('bewilligungsdetails-1');
  });

  it('liefert nie eine Fixture-ID', () => {
    expect(isFixtureSchemaId(deriveRealSchemaId('fixture real anb', new Set()))).toBe(false);
  });

  it('fällt bei leerem/symbolischem Namen auf "quelle" zurück', () => {
    expect(deriveRealSchemaId('()', new Set())).toBe('quelle');
  });
});

describe('buildRealSchemaFromFixture', () => {
  it('übernimmt Mapping/Join/Priorität/Encoding und setzt die neue Nicht-Fixture-ID', () => {
    const r = buildRealSchemaFromFixture(fixture(), 'antragsbasis-master');
    expect(r.id).toBe('antragsbasis-master');
    expect(isFixtureSchemaId(r.id)).toBe(false);
    expect(r.column_mapping).toEqual({ FKZ: { canonical: 'foerderkennzeichen' }, AKZ: {} });
    expect(r.join_key).toBe('aktenzeichen');
    expect(r.priority).toBe(100);
    expect(r.is_master).toBe(true);
    expect(r.encoding).toBe('windows-1252');
    expect(r.csv_source_name).toBe('Antragsbasis (Master)');
  });

  it('setzt den Import-Zustand zurück (echte Datei noch nicht importiert)', () => {
    const r = buildRealSchemaFromFixture(fixture(), 'x');
    expect(r.file_checksum).toBeUndefined();
    expect(r.last_imported_at).toBeUndefined();
    expect(r.last_row_count).toBeUndefined();
    expect(r.source_file_name).toBeUndefined();
    expect(r.source_last_modified).toBeUndefined();
    expect(r.last_file_size).toBeUndefined();
  });
});
