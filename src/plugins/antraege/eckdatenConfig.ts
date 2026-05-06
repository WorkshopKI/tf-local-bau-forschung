import { CANONICAL_FIELD_KEYS, getCanonicalLabel } from '@/core/services/csv/constants';
import type { Antrag } from '@/core/services/csv/types';
import { findFieldValue } from './fieldLookup';

const STORAGE_KEY = 'teamflow_antraege_eckdaten_fields';

/** Custom-Felder, die zusaetzlich zur canonical-Liste in den Eckdaten waehlbar sind. */
const SPECIAL_FIELDS: Record<string, { label: string; lookup: string[] }> = {
  phase: {
    label: 'Phase',
    lookup: ['phase', 'vorhaben_phase', 'projektphase'],
  },
};

/** Felder, die NICHT in den Eckdaten waehlbar sind (sind anderswo prominent: Header, Antragsteller-Block, Liste). */
const EXCLUDED_CANONICAL = new Set([
  'titel',
  'antragsteller',
  'branche',
  'foerdergeber',
  'verbund_titel',
]);

/** Felder, die in Mono-Schrift gerendert werden (IDs, Aktenzeichen). */
const MONO_FIELDS = new Set([
  'aktenzeichen',
  'verbund_id',
  'unterprogramm_id',
]);

export const DEFAULT_ECKDATEN_FIELDS: string[] = [
  'unterprogramm_id',
  'phase',
  'antragsdatum',
  'bewilligung_datum',
];

/** Alle waehlbaren Field-Keys (canonical + special), in stabiler Reihenfolge. */
export const AVAILABLE_FIELDS: string[] = [
  ...CANONICAL_FIELD_KEYS.filter(k => !EXCLUDED_CANONICAL.has(k)),
  ...Object.keys(SPECIAL_FIELDS),
];

const AVAILABLE_SET = new Set(AVAILABLE_FIELDS);

export function loadEckdatenFields(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ECKDATEN_FIELDS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ECKDATEN_FIELDS;
    const cleaned = parsed.filter((x): x is string => typeof x === 'string' && AVAILABLE_SET.has(x));
    return cleaned.length > 0 ? cleaned : DEFAULT_ECKDATEN_FIELDS;
  } catch {
    return DEFAULT_ECKDATEN_FIELDS;
  }
}

export function saveEckdatenFields(fields: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
  } catch { /* ignore */ }
}

export function getFieldLabel(field: string): string {
  if (SPECIAL_FIELDS[field]) return SPECIAL_FIELDS[field].label;
  return getCanonicalLabel(field);
}

export interface FieldDisplay {
  label: string;
  value: string;
  mono: boolean;
}

function formatGermanDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }
  return iso;
}

function rawValueFor(field: string, antrag: Antrag): unknown {
  if (SPECIAL_FIELDS[field]) {
    return findFieldValue(antrag, SPECIAL_FIELDS[field].lookup);
  }
  return (antrag as Record<string, unknown>)[field];
}

/** Liefert {label, value, mono} fuer ein Feld auf einem Antrag, oder null wenn kein Wert vorhanden. */
export function getFieldDisplayInfo(field: string, antrag: Antrag): FieldDisplay | null {
  const raw = rawValueFor(field, antrag);
  if (raw === null || raw === undefined || raw === '') return null;

  const label = getFieldLabel(field);
  const mono = MONO_FIELDS.has(field);

  let value: string;
  if (field === 'foerdersumme' && typeof raw === 'number' && raw > 0) {
    value = raw.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  } else if (field.endsWith('_datum') && typeof raw === 'string') {
    value = formatGermanDate(raw);
  } else if (typeof raw === 'string') {
    if (raw.trim() === '') return null;
    value = raw;
  } else if (typeof raw === 'number') {
    value = raw.toLocaleString('de-DE');
  } else if (typeof raw === 'boolean') {
    value = raw ? 'Ja' : 'Nein';
  } else {
    value = String(raw);
  }

  return { label, value, mono };
}
