export type CanonicalField =
  | 'aktenzeichen'
  | 'akronym'
  | 'verbund_id'
  | 'titel'
  | 'antragsteller'
  | 'status'
  | 'vb_phase'
  | 'unterprogramm_id'
  | 'bewilligung_datum'
  | 'antragsdatum'
  // D_AZ1_1: Datum der vorläufigen Erstentscheidung (Ablehnung etc.), gegen die noch Widerspruch möglich ist.
  | 'erstentscheidung'
  | 'frist_datum'
  | 'vn_eingang_datum'
  | 'foerdersumme'
  | 'foerdergeber'
  | 'branche'
  | 'ort_ast'
  | 'laufzeitbeginn'
  | 'laufzeitende'
  // Bearbeiter / Begleitung (Namenskürzel aus dem CSV-Import).
  // Werden für den Profil-Filter „Nur meine Anträge" verwendet
  // (siehe `src/plugins/antraege/bearbeiterFilter.ts`).
  | 'tib_kuerz'
  | 'bib_kuerz'
  | 'ztp_kuerz'
  | 'pfm_kuerz'
  // E-Mail des TiB-Bearbeiters (v2.12) — Empfänger für den Zugangspasswort-Versand.
  | 'tib_mail'
  // Bemerkungsfeld (T_HINT) — Freitext-Notiz pro Antrag, in der Auslastungs-Detailansicht angezeigt.
  | 't_hint'
  // Vollständigkeits-Datum (D_XTEC): gesetzt, sobald alle TVs eines Verbundes eingegangen + erfasst sind.
  // Maßgeblich für die Vollständigkeit von FuE- (vb_phase 3) + DS-Anträgen (vb_phase 5).
  | 'd_xtec'
  // Vollständigkeits-Datum (D_ADV): Pendant zu D_XTEC für DL- (vb_phase 4) + NW-Anträge (vb_phase 1|2).
  | 'd_adv'
  // Verbund-Ebene (gemeinsam für alle TVs eines Verbundes)
  | 'verbund_titel'
  | 'verbund_status';

/**
 * Ebene eines Standardfelds:
 * - 'antrag': Wert pro Teilvorhaben/Antrag (Default — Status, Titel, Aktenzeichen…).
 * - 'verbund': Wert pro Verbund (gleich für alle TVs eines Verbundes — verbund_titel, verbund_status).
 */
export type CanonicalLevel = 'antrag' | 'verbund';

/**
 * Gebrandeter Status-Typ für Antrag/Verbund — verhindert direkte
 * String-Literal-Vergleiche zur Compile-Zeit (CLAUDE.md Pitfall #12).
 *
 *     // FALSCH:  antrag.status === 'bewilligt'   ← TS-Error nach Branding
 *     // RICHTIG: isBewilligtStatus(antrag.status)
 *
 * Die Helper in `src/core/utils/status-canonical.ts` akzeptieren `unknown`
 * und arbeiten case-insensitive — sie nehmen `AntragStatusRaw` transparent
 * an. Boundary-Cast via `asAntragStatusRaw()` nur an Schreib-Stellen
 * (CSV-Merger, Seed-Loader, Test-Fixtures).
 *
 * Vorgang.status (Bauantrag-Domain) bleibt als Union-Type — dort verhindert
 * die Union schon Typos. Branded ist nur die offene CSV-Status-Domäne.
 */
export type AntragStatusRaw = string & { readonly __brand: 'AntragStatusRaw' };
export const asAntragStatusRaw = (s: string): AntragStatusRaw => s as AntragStatusRaw;

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
  /** Geplanter Zeitraum aus XLSX-Spalte 'jahr', z.B. "2020-2025" oder "2020". Free-text. */
  geplanter_zeitraum?: string;
  /** Auto-berechnetes ältestes antragsdatum aller zugehörigen Anträge (ISO YYYY-MM-DD). */
  zeitraum_auto_von_cached?: string;
  /** Auto-berechnetes neuestes antragsdatum aller zugehörigen Anträge (ISO YYYY-MM-DD). */
  zeitraum_auto_bis_cached?: string;
  /** @deprecated ab v1.14: manuell editierbarer Zeitraum. UI rendert das Feld nicht mehr. */
  zeitraum_von?: string;
  /** @deprecated ab v1.14: siehe zeitraum_von. */
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
  /**
   * Dateiname der zuletzt via "CSV neu wählen" importierten Quelldatei.
   * Wird mit dem `lastModified`-Timestamp und dem persistierten
   * FileSystemFileHandle (siehe csv-source-handle.ts) für die Auto-
   * Update-Erkennung verwendet.
   */
  source_file_name?: string;
  /**
   * `File.lastModified` (epoch ms) zum Zeitpunkt des Imports. Wird mit
   * dem aktuellen Wert am Handle verglichen, um eine neue Version der
   * gleichen Datei zu erkennen.
   */
  source_last_modified?: number;
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
  status?: AntragStatusRaw;
  verbund_id?: string;
  foerdergeber?: string;
  branche?: string;
  dokumente?: AntragDokumentRef[];
  [key: string]: unknown;
  _field_sources: Record<string, string>;
  _updated_at: string;
}

/**
 * Schmale Listen-Projektion eines Antrags. Wird in einem separaten IDB-Store
 * (`ANTRAEGE_LIST_VIEW`) gehalten, damit Listen/Dashboards/Filter ohne den
 * vollen 461-Feld-Record (~36 KB) auskommen — IDB-getAll von ~14 Feldern
 * spart bei 13k+ Records ~95 % structured-clone-Volumen.
 *
 * Detail-View arbeitet weiterhin auf `Antrag` (via `getAntrag(idb, az)`).
 *
 * **Whitelist** der Felder: siehe `LIST_VIEW_FIELDS` in `csv/constants.ts`.
 * Wer hier ein Feld ergänzt, muss `LIST_VIEW_FIELDS` + `toAntragListItem()`
 * mitnachziehen, sonst rendert die Liste das Feld nicht.
 */
export interface AntragListItem {
  aktenzeichen: string;
  programm_id: string;
  // Anzeige
  titel?: string;
  akronym?: string;
  status?: AntragStatusRaw;
  antragsteller?: string;
  branche?: string;
  /** Wiedereinreicher-Hinweis (CSV-Spalte `T_XSW`, custom-Feld `t_xsw`).
   *  Freitext mit den TIB-Kürzeln des damaligen Bearbeiters. Wird in den
   *  Titel-Ansichten rot/fett hinter dem VB-Titel gerendert (siehe
   *  `src/plugins/antraege/xsw.ts`). */
  t_xsw?: string;
  /** Verbund-Phasen-Code aus CSV-Spalte `VB_PHASE` (1=NW1, 2=NW2, 3=FuE, 4=DL, 5=DS, 9=Irrläufer). */
  vb_phase?: number;
  // Sort + View-Predicates
  frist_datum?: string;
  bewilligung_datum?: string;
  /** D_AZ1_1 = Datum der vorläufigen Erstentscheidung (z.B. Ablehnung). Leer,
   *  solange noch keine Erstentscheidung getroffen wurde; gegen eine getroffene
   *  Entscheidung kann noch Widerspruch eingelegt werden. */
  erstentscheidung?: string;
  antragsdatum?: string;
  /** D_VBE = Eingang VN-Sach (Begleitphase). Basis fuer die VN-Frist
   *  (vn_eingang_datum + 6 Monate). Leer bis der Verwendungsnachweis im
   *  Foyer eingelaufen ist. */
  vn_eingang_datum?: string;
  /** Projekt-Laufzeitbeginn (CSV-Header LFZ_TV_B). ISO YYYY-MM-DD oder Roh-String. */
  laufzeitbeginn?: string;
  /** Projekt-Laufzeitende (CSV-Header LFZ_TV_E). ISO YYYY-MM-DD oder Roh-String. */
  laufzeitende?: string;
  /** Bewilligte Foerdersumme in EUR (Canonical foerdersumme). */
  foerdersumme?: number;
  /** Ort des Antragstellers (CSV-Header ORT_AST, Direct-Match auf Canonical ort_ast). */
  ort_ast?: string;
  // Filter-Standards
  foerdergeber?: string;
  verbund_id?: string;
  unterprogramm_id?: string;
  // Bearbeiter-Filter (Canonical-Mapping macht lowercase, Slim-Store
  // speichert ausschließlich kanonisierte lowercase-Keys).
  tib_kuerz?: string;
  bib_kuerz?: string;
  ztp_kuerz?: string;
  pfm_kuerz?: string;
  // Meta
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

export interface VerbundHistorieEntry {
  id: string;
  verbund_id: string;
  /** Canonical-Key: 'verbund_titel' | 'verbund_status' (kommt aus CANONICAL_FIELDS). */
  feld: string;
  alt_wert: unknown;
  neu_wert: unknown;
  /** ISO-Timestamp. */
  geaendert_am: string;
  csv_schema_id: string;
}

export interface Verbund {
  verbund_id: string;
  programm_id: string;
  akronym?: string;
  titel?: string;
  /** Verbund-Status (gleich für alle TVs eines Verbundes). */
  status?: AntragStatusRaw;
  teilantrags_ids: string[];
  /** Quellen pro VB-Feld (csv_schema_id) — analog zu Antrag._field_sources. */
  _field_sources?: Record<string, string>;
  /** ISO-Timestamp letzte Schreibung. */
  _updated_at?: string;
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
