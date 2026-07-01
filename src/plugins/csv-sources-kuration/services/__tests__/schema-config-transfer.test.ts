/**
 * Tests für den Schema-Konfigurations-Transfer (Export/Import als JSON).
 *
 * Kern-Garantien:
 *  - Export enthält nur die übertragbaren Felder (Name, Mapping, Merge-Parameter),
 *    nicht die instanz-spezifischen (id, source_file_name, checksum …).
 *  - Parse validiert die Kennung + Pflichtfelder und wirft sonst.
 *  - Apply überschreibt Name + Mapping, behält aber id/programm_id/created_at/
 *    is_master + die instanz-spezifischen Felder des Ziel-Schemas.
 */
import { describe, it, expect } from 'vitest';
import type { CsvSchema } from '@/core/services/csv/types';
import {
  buildSchemaConfigExport,
  parseSchemaConfig,
  applyConfigToSchema,
  SchemaConfigParseError,
  SCHEMA_CONFIG_KIND,
  SCHEMA_CONFIG_VERSION,
} from '../schema-config-transfer';

/** Gut kuratiertes Quell-Schema (z.B. lokal) — volles Mapping inkl. Label/Gruppe. */
const SOURCE: CsvSchema = {
  id: '9097-anb-aitisigpt',
  programm_id: 'p-local',
  csv_source_name: '9097_AnB_AitisiGPT',
  is_master: true,
  join_key: 'aktenzeichen',
  priority: 100,
  column_mapping: {
    AKZ: { canonical: 'aktenzeichen', type: 'string' },
    STATUS: { canonical: 'status', type: 'string', label: 'Status' },
    FOERDER: { custom: 'foerder_2024', type: 'number', group_path: ['Finanzen', '2024'] },
    JUNK: { ignore: true },
  },
  encoding: 'windows-1252',
  separator: ';',
  label_xlsx_header_rows: 3,
  file_checksum: 'abc',
  last_imported_at: '2026-06-20T19:21:30.000Z',
  last_row_count: 12139,
  source_file_name: '9097_AnB_AitisiGPT.csv',
  source_last_modified: 1_700_000_000_000,
  last_file_size: 999,
  created_at: '2026-01-01T00:00:00.000Z',
};

/** Ziel-Schema (z.B. Produktion) — Fixture-Name, fremde ID, eigene Instanz-Felder. */
const TARGET: CsvSchema = {
  id: 'antragsbasis-master',
  programm_id: 'p-prod',
  csv_source_name: 'Antragsbasis (Master)',
  is_master: true,
  join_key: 'aktenzeichen',
  priority: 100,
  column_mapping: { AKZ: { canonical: 'aktenzeichen', type: 'string' } },
  file_checksum: 'prod-checksum',
  last_imported_at: '2026-07-01T11:45:02.000Z',
  last_row_count: 12191,
  source_file_name: '9097_AnB_AitisiGPT.csv',
  source_last_modified: 1_710_000_000_000,
  last_file_size: 1234,
  created_at: '2026-06-26T00:00:00.000Z',
};

describe('buildSchemaConfigExport', () => {
  it('serialisiert nur die übertragbaren Felder + Kennung', () => {
    const exp = buildSchemaConfigExport(SOURCE, '2026-07-01T12:00:00.000Z');
    expect(exp.kind).toBe(SCHEMA_CONFIG_KIND);
    expect(exp.version).toBe(SCHEMA_CONFIG_VERSION);
    expect(exp.exportedAt).toBe('2026-07-01T12:00:00.000Z');
    expect(exp.sourceSchemaId).toBe('9097-anb-aitisigpt');
    expect(exp.config.csv_source_name).toBe('9097_AnB_AitisiGPT');
    expect(exp.config.column_mapping).toEqual(SOURCE.column_mapping);
    expect(exp.config.encoding).toBe('windows-1252');
    expect(exp.config.label_xlsx_header_rows).toBe(3);
  });

  it('trägt keine instanz-spezifischen Felder in den config-Block', () => {
    const exp = buildSchemaConfigExport(SOURCE, '2026-07-01T12:00:00.000Z');
    const cfg = exp.config as unknown as Record<string, unknown>;
    expect(cfg).not.toHaveProperty('id');
    expect(cfg).not.toHaveProperty('programm_id');
    expect(cfg).not.toHaveProperty('file_checksum');
    expect(cfg).not.toHaveProperty('source_file_name');
    expect(cfg).not.toHaveProperty('last_imported_at');
    expect(cfg).not.toHaveProperty('created_at');
  });

  it('roundtrip build → JSON → parse ergibt dasselbe Export-Objekt', () => {
    const exp = buildSchemaConfigExport(SOURCE, '2026-07-01T12:00:00.000Z');
    const parsed = parseSchemaConfig(JSON.stringify(exp));
    expect(parsed).toEqual(exp);
  });
});

describe('parseSchemaConfig', () => {
  const validJson = (): string =>
    JSON.stringify(buildSchemaConfigExport(SOURCE, '2026-07-01T12:00:00.000Z'));

  it('parst eine gültige Konfiguration', () => {
    expect(parseSchemaConfig(validJson()).config.csv_source_name).toBe('9097_AnB_AitisiGPT');
  });

  it('wirft bei kaputtem JSON', () => {
    expect(() => parseSchemaConfig('{ not json')).toThrow(SchemaConfigParseError);
  });

  it('wirft bei falscher kind-Kennung', () => {
    expect(() => parseSchemaConfig(JSON.stringify({ kind: 'anderes', config: {} }))).toThrow(/kind/i);
  });

  it('wirft bei fehlendem column_mapping', () => {
    const bad = { kind: SCHEMA_CONFIG_KIND, version: 1, config: { csv_source_name: 'X', join_key: 'aktenzeichen', priority: 1, is_master: false } };
    expect(() => parseSchemaConfig(JSON.stringify(bad))).toThrow(/column_mapping/i);
  });

  it('wirft bei leerem column_mapping', () => {
    const bad = { kind: SCHEMA_CONFIG_KIND, version: 1, config: { csv_source_name: 'X', column_mapping: {}, join_key: 'aktenzeichen', priority: 1, is_master: false } };
    expect(() => parseSchemaConfig(JSON.stringify(bad))).toThrow(/leer/i);
  });

  it('wirft bei ungültigem join_key', () => {
    const bad = { kind: SCHEMA_CONFIG_KIND, version: 1, config: { csv_source_name: 'X', column_mapping: { A: {} }, join_key: 'foo', priority: 1, is_master: false } };
    expect(() => parseSchemaConfig(JSON.stringify(bad))).toThrow(/join_key/i);
  });
});

describe('applyConfigToSchema', () => {
  it('überschreibt Name + Mapping + Merge-Parameter aus der Konfiguration', () => {
    const { config } = buildSchemaConfigExport(SOURCE, '2026-07-01T12:00:00.000Z');
    const next = applyConfigToSchema(TARGET, config);
    expect(next.csv_source_name).toBe('9097_AnB_AitisiGPT');
    expect(next.column_mapping).toEqual(SOURCE.column_mapping);
    expect(next.join_key).toBe('aktenzeichen');
    expect(next.priority).toBe(100);
    expect(next.encoding).toBe('windows-1252');
    expect(next.separator).toBe(';');
    expect(next.label_xlsx_header_rows).toBe(3);
  });

  it('behält die identitäts-/instanz-spezifischen Felder des Ziel-Schemas', () => {
    const { config } = buildSchemaConfigExport(SOURCE, '2026-07-01T12:00:00.000Z');
    const next = applyConfigToSchema(TARGET, config);
    expect(next.id).toBe('antragsbasis-master');
    expect(next.programm_id).toBe('p-prod');
    expect(next.created_at).toBe('2026-06-26T00:00:00.000Z');
    expect(next.source_file_name).toBe('9097_AnB_AitisiGPT.csv');
    expect(next.file_checksum).toBe('prod-checksum');
    expect(next.last_row_count).toBe(12191);
  });

  it('ändert is_master des Ziels nicht (strukturell)', () => {
    const nonMasterTarget: CsvSchema = { ...TARGET, is_master: false };
    const { config } = buildSchemaConfigExport(SOURCE, '2026-07-01T12:00:00.000Z'); // config.is_master = true
    const next = applyConfigToSchema(nonMasterTarget, config);
    expect(next.is_master).toBe(false);
  });

  it('mutiert das Ziel-Schema nicht (frisches Objekt)', () => {
    const { config } = buildSchemaConfigExport(SOURCE, '2026-07-01T12:00:00.000Z');
    const before = JSON.stringify(TARGET);
    const next = applyConfigToSchema(TARGET, config);
    expect(next).not.toBe(TARGET);
    expect(JSON.stringify(TARGET)).toBe(before);
  });
});
