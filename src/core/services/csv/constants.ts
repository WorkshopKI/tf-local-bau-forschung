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
  { key: 'unterprogramm_id', type: 'string', label: 'Unterprogramm-ID', level: 'antrag' },
  { key: 'bewilligung_datum', type: 'date', label: 'Bewilligungsdatum', level: 'antrag' },
  { key: 'antragsdatum', type: 'date', label: 'Antragsdatum', level: 'antrag' },
  { key: 'frist_datum', type: 'date', label: 'Fristdatum', level: 'antrag' },
  { key: 'foerdersumme', type: 'number', label: 'Fördersumme', level: 'antrag' },
  // Verbund-Ebene (gleich für alle TVs eines Verbundes)
  { key: 'verbund_titel', type: 'string', label: 'Verbund-Titel', level: 'verbund' },
  { key: 'verbund_status', type: 'string', label: 'Verbund-Status', level: 'verbund' },
];

export const CANONICAL_FIELD_KEYS = CANONICAL_FIELDS.map(f => f.key);

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
