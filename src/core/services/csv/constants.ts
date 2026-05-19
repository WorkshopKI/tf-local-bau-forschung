import type { CanonicalField, CanonicalLevel, FieldType } from './types';

interface CanonicalFieldDef {
  key: CanonicalField;
  type: FieldType;
  label: string;
  /** 'antrag' (Default) = pro Teilvorhaben; 'verbund' = pro Verbund (gleich für alle TVs). */
  level: CanonicalLevel;
}

export const CANONICAL_FIELDS: CanonicalFieldDef[] = [
  // Antrag-Ebene (TV)
  { key: 'aktenzeichen', type: 'string', label: 'Aktenzeichen', level: 'antrag' },
  { key: 'akronym', type: 'string', label: 'Akronym', level: 'antrag' },
  { key: 'verbund_id', type: 'string', label: 'Verbund-ID', level: 'antrag' },
  { key: 'titel', type: 'string', label: 'Titel (TV)', level: 'antrag' },
  { key: 'antragsteller', type: 'string', label: 'Antragsteller', level: 'antrag' },
  { key: 'status', type: 'string', label: 'Status (TV)', level: 'antrag' },
  { key: 'vb_phase', type: 'number', label: 'VB-Phase', level: 'antrag' },
  { key: 'unterprogramm_id', type: 'string', label: 'Unterprogramm-ID', level: 'antrag' },
  { key: 'bewilligung_datum', type: 'date', label: 'Bewilligungsdatum', level: 'antrag' },
  { key: 'antragsdatum', type: 'date', label: 'Antragsdatum', level: 'antrag' },
  { key: 'frist_datum', type: 'date', label: 'Fristdatum', level: 'antrag' },
  { key: 'vn_eingang_datum', type: 'date', label: 'Eingang VN-Sach', level: 'antrag' },
  { key: 'foerdersumme', type: 'number', label: 'Fördersumme', level: 'antrag' },
  // Bearbeiter / Begleitung — Namenskürzel pro Antrag, für den Profil-Filter „Nur meine".
  { key: 'tib_kuerz', type: 'string', label: 'Bearbeiter TiB (Kürzel)', level: 'antrag' },
  { key: 'bib_kuerz', type: 'string', label: 'Bearbeiter BIB (Kürzel)', level: 'antrag' },
  { key: 'ztp_kuerz', type: 'string', label: 'Begleitung ZTP (Kürzel)', level: 'antrag' },
  { key: 'pfm_kuerz', type: 'string', label: 'Begleitung PFM (Kürzel)', level: 'antrag' },
  // Verbund-Ebene (gleich für alle TVs eines Verbundes)
  { key: 'verbund_titel', type: 'string', label: 'Verbund-Titel', level: 'verbund' },
  { key: 'verbund_status', type: 'string', label: 'Verbund-Status', level: 'verbund' },
];

export const CANONICAL_FIELD_KEYS = CANONICAL_FIELDS.map(f => f.key);

/**
 * Bekannte abweichende CSV-Spaltennamen, die im Quell-System eingebürgert sind
 * und auf ein Canonical-Field gemappt werden sollen. Wird im CSV-Wizard für die
 * Name-basierte Auto-Suggestion genutzt (`buildSuggestionsFromColumnNames`),
 * sodass der Kurator die Mappings nicht bei jedem Import manuell setzen muss.
 *
 * Vergleich ist case-insensitiv und ignoriert `_`/`-`/Leerzeichen
 * (siehe `normalize()` im Helper) — `D_AAE` und `d_aae` matchen identisch.
 *
 * Direkte Key-Matches (z.B. `aktenzeichen` → `aktenzeichen`) müssen hier nicht
 * gelistet werden — die werden automatisch erkannt.
 */
export const CANONICAL_FIELD_NAME_ALIASES: Record<string, CanonicalField> = {
  d_aae: 'antragsdatum',
  d_abb: 'bewilligung_datum',
  d_vbe: 'vn_eingang_datum',
  org_afs: 'antragsteller',
  thema_ad: 'titel',
  vb_nummer: 'verbund_id',
};

/**
 * Whitelist der Felder, die in den schmalen `ANTRAEGE_LIST_VIEW`-Store
 * projiziert werden. Listen, Dashboards, Sort und Filter operieren
 * ausschließlich auf diesen Feldern. Custom-Felder aus den CSVs (z.B.
 * `foerdersumme_geplant_2024`) sind NICHT enthalten — Filter darauf
 * werden im Wizard mit Warn-Badge markiert.
 *
 * Wer hier ergänzt, muss `AntragListItem` in `csv/types.ts` und
 * `toAntragListItem()` in `csv/list-view.ts` mitnachziehen.
 */
export const LIST_VIEW_FIELDS: readonly string[] = [
  // Identifikation
  'aktenzeichen',
  'programm_id',
  // Anzeige
  'titel',
  'akronym',
  'status',
  'antragsteller',
  'branche',
  'vb_phase',
  // Sort + View-Predicates
  'frist_datum',
  'bewilligung_datum',
  'antragsdatum',
  'vn_eingang_datum',
  // Filter-Standards
  'foerdergeber',
  'verbund_id',
  'unterprogramm_id',
  // Bearbeiter-Filter
  'tib_kuerz',
  'bib_kuerz',
  'ztp_kuerz',
  'pfm_kuerz',
  // Meta
  '_updated_at',
];

export const LIST_VIEW_FIELDS_SET: ReadonlySet<string> = new Set(LIST_VIEW_FIELDS);

export function getCanonicalLabel(key: string): string {
  return CANONICAL_FIELDS.find(f => f.key === key)?.label ?? key;
}

export function getCanonicalLevel(key: string): CanonicalLevel {
  return CANONICAL_FIELDS.find(f => f.key === key)?.level ?? 'antrag';
}

export const HASH_SEPARATOR = '\u001f';
export const BUILD_LOCK_STUFE = 'csv-import';
export const MAX_SKIP_WARNINGS = 10;
export const MAX_WRITES_PER_TX = 500;

export const DEFAULT_PROGRAMM_ID = 'default-programm';
export const DEFAULT_PROGRAMM_NAME = 'Standard-Programm';
export const DEFAULT_SMB_HANDLE_KEY = 'daten-share';

// v1.9: Schemas liegen unter programm/schemas/, Imports unter programm/antraege/imports/.
export const CSV_SCHEMAS_SUBDIR = 'schemas';
export const CSV_SOURCES_SUBDIR = 'antraege/imports';

/** @deprecated Legacy-Subdirs vor v1.9 — Migration-Helper prüft auf diese Namen. */
export const LEGACY_CSV_SCHEMAS_SUBDIR = 'csv-schemas';
export const LEGACY_CSV_SOURCES_SUBDIR = 'csv-sources';
