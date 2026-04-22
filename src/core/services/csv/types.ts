export type CanonicalField =
  | 'aktenzeichen'
  | 'akronym'
  | 'verbund_id'
  | 'titel'
  | 'antragsteller'
  | 'status'
  | 'unterprogramm_id'
  | 'bewilligung_datum'
  | 'antragsdatum'
  | 'frist_datum'
  | 'foerdersumme'
  | 'foerdergeber'
  | 'branche';

export type AntragDokumentTyp =
  | 'projektbeschreibung'
  | 'nachforderung'
  | 'gutachten'
  | 'verwendungsnachweis'
  | 'sonstiges';

export interface AntragDokumentRef {
  id: string;
  dateiname: string;
  typ?: AntragDokumentTyp;
  /** Relativpfad zum Dokumenten-Share. In Phase 2 genutzt, in Phase 1 leer. */
  dateipfad?: string;
  groesse_bytes?: number;
  /** ISO-Datum */
  erfasst_am?: string;
}

export type FieldType = 'string' | 'date' | 'number' | 'boolean';

export type JoinKey = 'aktenzeichen' | 'verbund_id' | 'akronym';

export type CsvEncoding = 'UTF-8' | 'windows-1252';
export type CsvSeparator = ';' | ',' | '\t' | '|';

export type AmbiguousMergeResolution = 'group' | 'label_repeated' | 'ignore';

export interface ColumnMappingEntry {
  canonical?: CanonicalField | string;
  custom?: string;
  type?: FieldType;
  required?: boolean;
  trackHistory?: boolean;
  ignore?: boolean;
  /** Lesbares Label aus Label-XLS (vorletzte Header-Zeile). Fallback: CSV-Spaltenname. */
  label?: string;
  /** Gruppen-Pfad aus Label-XLS (Zeilen über der Label-Zeile, top-down). Leere Ebenen entfernt. */
  group_path?: string[];
  /** Admin-Entscheidung für vertikal-merged Gruppen-Zellen (Label- und Gruppen-Zeile gemeinsam gemergt). */
  ambiguous_merge_resolution?: AmbiguousMergeResolution;
}

export type ColumnMapping = Record<string, ColumnMappingEntry>;

export interface Programm {
  id: string;
  name: string;
  created_at: string;
  smb_handle_key: string;
}

export interface Unterprogramm {
  id: string;                       // FM-Nummer als String, z.B. "4711" (= code)
  programm_id: string;
  code: string;                     // technischer Code aus CSV (= id, redundant für Klarheit)
  name?: string;                    // optional, vom Admin nachgepflegtes Klartext-Label
  zeitraum_von?: string;
  zeitraum_bis?: string;
  aktiv: boolean;                   // Import-Aktiv-Flag
  antrag_count_cached?: number;
  created_at: string;
  updated_at: string;
}

export interface CsvSchema {
  id: string;
  programm_id: string;
  csv_source_name: string;
  is_master: boolean;
  join_key: JoinKey;
  priority: number;
  column_mapping: ColumnMapping;
  /** Encoding der CSV-Datei. Defaults auf 'UTF-8' bei Alt-Einträgen ohne Feld. */
  encoding?: CsvEncoding;
  /** Spalten-Trennzeichen. Defaults auf ',' bei Alt-Einträgen ohne Feld. */
  separator?: CsvSeparator;
  /** Anzahl Header-Zeilen im zugehörigen Label-XLS (2-8). Persistiert für konsistente Re-Imports. */
  label_xlsx_header_rows?: number;
  file_checksum?: string;
  last_imported_at?: string;
  last_row_count?: number;
  created_at: string;
}

export interface CsvRowHash {
  csv_schema_id: string;
  join_value: string;
  row_hash: string;
}

export interface Antrag {
  aktenzeichen: string;
  programm_id: string;
  unterprogramm_id?: string;
  akronym?: string;
  titel?: string;
  antragsteller?: string;
  status?: string;
  verbund_id?: string;
  foerdergeber?: string;
  branche?: string;
  dokumente?: AntragDokumentRef[];
  [key: string]: unknown;
  _field_sources: Record<string, string>;
  _updated_at: string;
}

export interface AntragHistorieEntry {
  id: string;
  aktenzeichen: string;
  feld: string;
  alt_wert: unknown;
  neu_wert: unknown;
  geaendert_am: string;
  csv_schema_id: string;
}

export interface Verbund {
  verbund_id: string;
  programm_id: string;
  akronym?: string;
  titel?: string;
  teilantrags_ids: string[];
}

export interface AkronymIndexEntry {
  programm_id: string;
  akronym: string;
  aktenzeichen: string[];
}

export type ImportBucket = 'new' | 'changed' | 'unchanged' | 'removed';

export interface ImportResult {
  skipped: boolean;
  buckets: Record<ImportBucket, number>;
  durationMs: number;
  rowCount: number;
  skippedJoinValues?: string[];
  skippedInactiveUnterprogramm?: number;
  deletedByDeaktivierung?: Record<string, number>; // code → anzahl gelöschter Anträge
}

export interface ParsedRow {
  raw: Record<string, string>;
  joinValue: string;
}
