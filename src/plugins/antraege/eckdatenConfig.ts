import { CANONICAL_FIELD_KEYS, getCanonicalLabel } from '@/core/services/csv/constants';
import { formatDatumsWert } from '@/core/services/csv';
import type { Antrag } from '@/core/services/csv/types';
import { getVbPhaseLabel } from '@/core/utils/vb-phase-mappings';
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
  'vb_phase',
  'unterprogramm_id',
  'antragsdatum',
  'bewilligung_datum',
];

/** Alle waehlbaren Field-Keys (canonical + special), in stabiler Reihenfolge. */
export const AVAILABLE_FIELDS: string[] = [
  ...CANONICAL_FIELD_KEYS.filter(k => !EXCLUDED_CANONICAL.has(k)),
  ...Object.keys(SPECIAL_FIELDS),
];

const AVAILABLE_SET = new Set(AVAILABLE_FIELDS);

/**
 * Die gespeicherte Feldauswahl.
 *
 * **Die leere Auswahl ist ein Zustand, kein Fehler** (v4.124): der Editor bietet
 * „alle entfernen" und „Zurücksetzen" als ZWEI Bedienwege an und hat für die
 * leere Auswahl einen eigenen Leerzustand. Vorher machte der Rückfall
 * (`cleaned.length > 0 ? … : DEFAULT`) beide ununterscheidbar — wer alles
 * entfernte und speicherte, hatte beim nächsten Laden die vier Standardfelder
 * zurück, ohne Meldung. Ein leer GESPEICHERTES Array bleibt deshalb leer;
 * der Rückfall greift nur noch da, wo er hingehört: kein Eintrag, kaputtes
 * JSON, kein Array — oder eine Auswahl, deren Keys es allesamt nicht mehr gibt.
 */
export function loadEckdatenFields(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ECKDATEN_FIELDS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ECKDATEN_FIELDS;
    if (parsed.length === 0) return [];
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

export interface FieldDisplayOpts {
  /** Code→Name-Map der Unterprogramme — wenn gesetzt, zeigt das Feld
   *  `unterprogramm_id` den sprechenden Namen statt der nackten Nummer
   *  (Fallback: Nummer, falls kein Label bekannt). */
  unterprogrammLabels?: ReadonlyMap<string, string>;
}

function rawValueFor(field: string, antrag: Antrag): unknown {
  if (SPECIAL_FIELDS[field]) {
    return findFieldValue(antrag, SPECIAL_FIELDS[field].lookup);
  }
  return (antrag as Record<string, unknown>)[field];
}

/** Liefert {label, value, mono} fuer ein Feld auf einem Antrag, oder null wenn kein Wert vorhanden. */
export function getFieldDisplayInfo(field: string, antrag: Antrag, opts?: FieldDisplayOpts): FieldDisplay | null {
  const raw = rawValueFor(field, antrag);
  if (raw === null || raw === undefined || raw === '') return null;

  const label = getFieldLabel(field);
  let mono = MONO_FIELDS.has(field);

  let value: string;
  if (field === 'vb_phase') {
    const label = getVbPhaseLabel(raw);
    if (label === null) return null;
    value = label;
  } else if (field === 'unterprogramm_id') {
    // Statt der Unterprogramm-Nummer den sprechenden Namen zeigen (z.B.
    // "138" → "ZIM FuE-Projekte 2025"). Ohne bekanntes Label bleibt die
    // Nummer stehen (dann weiterhin Mono, sonst Klartext-Label).
    const code = typeof raw === 'string' ? raw.trim() : String(raw).trim();
    if (code === '') return null;
    const name = opts?.unterprogrammLabels?.get(code);
    if (name) {
      value = name;
      mono = false;
    } else {
      value = code;
    }
  } else if (field === 'foerdersumme' && typeof raw === 'number' && raw > 0) {
    value = raw.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  } else if (typeof raw === 'string') {
    if (raw.trim() === '') return null;
    // Datums-Formatierung feldnamens-UNABHÄNGIG über die zentrale Anzeige-Kette.
    // Die alte Heuristik („endet auf `_datum`") traf von neun Datumsfeldern nur
    // drei — `antragsdatum` und `erstentscheidung` standen roh im ISO-Format
    // direkt neben dem deutsch formatierten `bewilligung_datum` (v4.124).
    // `formatDatumsWert` ist streng: was sich nicht als ganzes Datum lesen lässt
    // (Aktenzeichen, Fließtext), bleibt unverändert.
    value = formatDatumsWert(raw);
  } else if (typeof raw === 'number') {
    value = raw.toLocaleString('de-DE');
  } else if (typeof raw === 'boolean') {
    value = raw ? 'Ja' : 'Nein';
  } else {
    value = String(raw);
  }

  return { label, value, mono };
}
