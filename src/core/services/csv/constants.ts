import type { CanonicalField, FieldType } from './types';

export const CANONICAL_FIELDS: { key: CanonicalField; type: FieldType; label: string }[] = [
  { key: 'aktenzeichen', type: 'string', label: 'Aktenzeichen' },
  { key: 'akronym', type: 'string', label: 'Akronym' },
  { key: 'verbund_id', type: 'string', label: 'Verbund-ID' },
  { key: 'titel', type: 'string', label: 'Titel' },
  { key: 'antragsteller', type: 'string', label: 'Antragsteller' },
  { key: 'status', type: 'string', label: 'Status' },
  { key: 'unterprogramm_id', type: 'string', label: 'Unterprogramm-ID' },
  { key: 'bewilligung_datum', type: 'date', label: 'Bewilligungsdatum' },
  { key: 'antragsdatum', type: 'date', label: 'Antragsdatum' },
  { key: 'frist_datum', type: 'date', label: 'Fristdatum' },
  { key: 'foerdersumme', type: 'number', label: 'Fördersumme' },
];

export const CANONICAL_FIELD_KEYS = CANONICAL_FIELDS.map(f => f.key);

export function getCanonicalLabel(key: string): string {
  return CANONICAL_FIELDS.find(f => f.key === key)?.label ?? key;
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
