/**
 * Schema-Konfiguration zwischen Umgebungen übertragen (Export/Import als JSON).
 *
 * Use-Case: eine Umgebung (z.B. lokal/Dev) trägt das kuratierte, vollständige
 * Spalten-Mapping inkl. Labels; eine andere (z.B. Produktion) hat nach einem
 * Vorfall nur ein Teil-Mapping mit falschem Anzeige-Namen. Statt das Mapping dort
 * von Hand neu zu bauen, exportiert man die Konfiguration in der guten Umgebung
 * und importiert sie in das BESTEHENDE Schema der anderen.
 *
 * Bewusst NICHT übertragen (identitäts-/instanz-spezifisch): `id`, `programm_id`,
 * `created_at`, `source_file_name`/`source_last_modified`/`last_file_size`,
 * `file_checksum`, `last_imported_at`, `last_row_count`. `applyConfigToSchema`
 * behält diese Felder des Ziel-Schemas → die Ziel-ID bleibt stabil (keine
 * Row-Hash-/Snapshot-Migration), nur Name + Mapping + Merge-Parameter werden
 * überschrieben. `is_master` bleibt strukturell beim Ziel (1 Master pro Programm).
 *
 * Weil das Mapping danach neu ist, muss die Quelle einmal neu importiert werden,
 * damit die Änderung auf den bereits importierten Anträgen greift.
 */

import type { CsvSchema, ColumnMapping, JoinKey, CsvEncoding, CsvSeparator } from '@/core/services/csv/types';

export const SCHEMA_CONFIG_KIND = 'teamflow-csv-schema-config';
export const SCHEMA_CONFIG_VERSION = 1;

/** Übertragbare Teilmenge eines `CsvSchema` — ohne instanz-spezifische Felder. */
export interface TransferableSchemaConfig {
  csv_source_name: string;
  is_master: boolean;
  join_key: JoinKey;
  priority: number;
  column_mapping: ColumnMapping;
  encoding?: CsvEncoding;
  separator?: CsvSeparator;
  label_xlsx_header_rows?: number;
}

export interface SchemaConfigExport {
  kind: typeof SCHEMA_CONFIG_KIND;
  version: number;
  /** ISO-Zeitstempel (vom Aufrufer gestempelt — Funktion bleibt rein/testbar). */
  exportedAt: string;
  /** Ursprungs-Schema-ID, nur zur Nachvollziehbarkeit — beim Import NICHT übernommen. */
  sourceSchemaId: string;
  config: TransferableSchemaConfig;
}

export class SchemaConfigParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaConfigParseError';
  }
}

/** Serialisiert die übertragbaren Felder eines Schemas in ein Export-Objekt. */
export function buildSchemaConfigExport(schema: CsvSchema, exportedAt: string): SchemaConfigExport {
  return {
    kind: SCHEMA_CONFIG_KIND,
    version: SCHEMA_CONFIG_VERSION,
    exportedAt,
    sourceSchemaId: schema.id,
    config: {
      csv_source_name: schema.csv_source_name,
      is_master: schema.is_master,
      join_key: schema.join_key,
      priority: schema.priority,
      column_mapping: schema.column_mapping,
      ...(schema.encoding ? { encoding: schema.encoding } : {}),
      ...(schema.separator ? { separator: schema.separator } : {}),
      ...(schema.label_xlsx_header_rows != null ? { label_xlsx_header_rows: schema.label_xlsx_header_rows } : {}),
    },
  };
}

/** Parst + validiert eine exportierte Konfiguration. Wirft `SchemaConfigParseError`. */
export function parseSchemaConfig(json: string): SchemaConfigExport {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new SchemaConfigParseError('Datei ist kein gültiges JSON.');
  }
  if (!data || typeof data !== 'object') throw new SchemaConfigParseError('Unerwartetes Format.');
  const obj = data as Record<string, unknown>;
  if (obj.kind !== SCHEMA_CONFIG_KIND) {
    throw new SchemaConfigParseError('Keine TeamFlow-Schema-Konfiguration (falsche „kind"-Kennung).');
  }
  const cfg = obj.config as Record<string, unknown> | undefined;
  if (!cfg || typeof cfg !== 'object') throw new SchemaConfigParseError('„config"-Block fehlt.');
  if (typeof cfg.csv_source_name !== 'string' || !cfg.csv_source_name.trim()) {
    throw new SchemaConfigParseError('„csv_source_name" fehlt oder ist leer.');
  }
  if (!cfg.column_mapping || typeof cfg.column_mapping !== 'object') {
    throw new SchemaConfigParseError('„column_mapping" fehlt.');
  }
  if (Object.keys(cfg.column_mapping as object).length === 0) {
    throw new SchemaConfigParseError('„column_mapping" ist leer.');
  }
  if (cfg.join_key !== 'aktenzeichen' && cfg.join_key !== 'verbund_id' && cfg.join_key !== 'akronym') {
    throw new SchemaConfigParseError('„join_key" fehlt oder ist ungültig.');
  }
  if (typeof cfg.priority !== 'number') throw new SchemaConfigParseError('„priority" fehlt.');
  if (typeof cfg.is_master !== 'boolean') throw new SchemaConfigParseError('„is_master" fehlt.');
  return data as SchemaConfigExport;
}

/**
 * Übernimmt eine übertragbare Konfiguration in ein BESTEHENDES Schema: behält
 * dessen identitäts-/instanz-spezifische Felder (id, programm_id, created_at,
 * source_file_name, Checksums, last_*, is_master), überschreibt nur
 * Name + Mapping + Merge-Parameter. Liefert ein neues Objekt.
 */
export function applyConfigToSchema(target: CsvSchema, cfg: TransferableSchemaConfig): CsvSchema {
  const next: CsvSchema = {
    ...target,
    csv_source_name: cfg.csv_source_name,
    join_key: cfg.join_key,
    priority: cfg.priority,
    column_mapping: cfg.column_mapping,
    encoding: cfg.encoding ?? target.encoding,
    separator: cfg.separator ?? target.separator,
  };
  if (cfg.label_xlsx_header_rows != null) next.label_xlsx_header_rows = cfg.label_xlsx_header_rows;
  return next;
}
