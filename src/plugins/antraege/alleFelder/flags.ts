/**
 * Technologie-Kennzeichen-Konsolidierung (Hebel 3 der „Alle Felder"-Optimierung).
 *
 * Die ~49 booleschen Deskriptor-Felder (Y/N) werden aus der flachen Liste
 * gehoben und zu EINER Akkordeon-Gruppe zusammengefasst — pro Unterbereich eine
 * Zusammenfassungszeile (grüne Chips für „Y", sonst „keine zutreffend · 0/N").
 *
 * **Erkennung muss zwei Umgebungen abdecken** (siehe Plan, „harte Stellen"):
 * - **Echte SMB-Schemas** (Label-XLS) liefern `group_path = ['Technologie-
 *   Kennzeichen', '<Unterbereich>']` → Erkennung über den Gruppen-Pfad.
 * - **Committete Fixtures** (`docs/fixtures/schema-c.ts`) setzen KEIN
 *   `group_path` und mappen die Flags als `type:'boolean'`-`zt_*`-Custom-Felder
 *   → Erkennung über Feld-Typ / Key-Präfix; die Rows landen sonst in
 *   „Weitere Felder" und werden von hier in einen synthetischen Cluster gehoben.
 *
 * TV- und VB-Ebene desselben Deskriptors (z.B. `…_tv` + `…_vb`, gleiches Label)
 * werden zu EINEM Eintrag gemerged (`isYes` = ODER beider Spalten).
 */
import type { DisplayRow, DisplayGroup } from './buildDisplayRows';
import type { CsvSchema, FieldType } from '@/core/services/csv/types';

/** Normalisiert ein Label/Key für robustes Matching (lowercase, nur a–z/0–9/Umlaut). */
export function normLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
}

/** Keyword-Fragmente (normalisiert), die in IRGENDEINER group_path-Ebene einen
 *  Technologie-Kennzeichen-Cluster markieren. Bewusst `includes` statt exakt:
 *  echte Schemas hängen Ebenen-Suffixe an („Zukunftstechnologien (TV-Ebene)"). */
const FLAG_ROOT_KEYWORDS = ['zukunftstechnolog', 'technologiekennzeichen'];

/** `true`, wenn der group_path (irgendeine Ebene) ein Technologie-Kennzeichen-Cluster ist. */
export function isFlagGroupPath(path: string[]): boolean {
  return path.some(p => {
    const n = normLabel(p);
    return FLAG_ROOT_KEYWORDS.some(k => n.includes(k));
  });
}

const BOOLISH_TOKENS = new Set(['y', 'n', 'j', 'ja', 'nein', 'yes', 'no', 'true', 'false', '0', '1', 'x']);

function isEmptyRaw(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  return typeof raw === 'string' && raw.trim() === '';
}

/** `true`, wenn der Rohwert ein reiner Boolean-Token ist (tolerant gegen „Y / N"-Merge). */
function isBoolishRaw(raw: unknown): boolean {
  if (raw === true || raw === false) return true;
  if (typeof raw === 'number') return raw === 0 || raw === 1;
  if (typeof raw !== 'string') return false;
  const tokens = raw.split('/').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
  return tokens.length > 0 && tokens.every(t => BOOLISH_TOKENS.has(t));
}

/**
 * Inhaltsbasierte Flag-Erkennung: eine Gruppe ist ein Flag-Cluster, wenn ALLE
 * ihre befüllten Werte reine Boolean-Tokens sind (≥2 befüllte). Robust gegen
 * fehlende/abweichende `group_path`-Labels UND gegen string-statt-boolean
 * gemappte Y/N-Spalten — genau der Grund, warum die reine Pfad-/Typ-Erkennung am
 * echten Datenbestand 0 Flags fand.
 */
export function isBoolishGroup(rows: DisplayRow[]): boolean {
  const nonEmpty = rows.filter(r => !isEmptyRaw(r.rawValue));
  return nonEmpty.length >= 2 && nonEmpty.every(r => isBoolishRaw(r.rawValue));
}

/** Gesamt-Entscheid für eine Gruppe: group_path-Keyword ODER boolean-Inhalt. */
export function isFlagGroup(group: DisplayGroup): boolean {
  return isFlagGroupPath(group.path) || isBoolishGroup(group.rows);
}

/** Unterbereichs-Name eines Flag-Gruppen-Eintrags = Blattname des group_path (sonst Label). */
export function leafSubgroup(group: DisplayGroup): string {
  return group.path.length > 0 ? group.path[group.path.length - 1]! : group.label;
}

/**
 * Schema-Feldtyp für einen Antrag-Feld-Key (canonical oder custom) aus den
 * beteiligten CSV-Schemas. `undefined`, wenn kein Schema das Feld mappt.
 */
export function fieldType(field: string, schemas: CsvSchema[]): FieldType | undefined {
  for (const s of schemas) {
    const mapping = s.column_mapping;
    if (!mapping) continue;
    for (const entry of Object.values(mapping)) {
      if ((entry.canonical === field || entry.custom === field) && entry.type) return entry.type;
    }
  }
  return undefined;
}

/**
 * Loose-Flag-Erkennung für Rows OHNE Flag-`group_path` (Fixture-Pfad): Boolean-
 * Feldtyp laut Schema ODER `zt_`-Key-Präfix. Bewusst NICHT wertbasiert
 * (`Y`/`N`) — leere Felder würden sonst massenhaft als Flags fehlklassifiziert.
 */
export function isLooseFlagRow(row: DisplayRow, schemas: CsvSchema[]): boolean {
  if (row.field.startsWith('zt_')) return true;
  return fieldType(row.field, schemas) === 'boolean';
}

/**
 * `true`, wenn der Rohwert „Ja" bedeutet. Tolerant gegen die Verbund-Merge-
 * Schreibweise `"Y / N"` (VerbundAlleFelder joint divergente TV-Werte) — ein
 * Deskriptor gilt verbundweit als „Y", sobald IRGENDEIN TV (oder die TV-/VB-
 * Spalte) „Y" trägt.
 */
export function flagValueIsYes(raw: unknown): boolean {
  if (raw === true) return true;
  if (typeof raw === 'number') return raw === 1;
  if (typeof raw !== 'string') return false;
  return raw.split('/').some(tok => YES_TOKENS.has(tok.trim().toLowerCase()));
}

const YES_TOKENS = new Set(['y', 'yes', 'j', 'ja', 'true', '1', 'x']);

/** Entfernt TV-/VB-Ebenen-Marker aus einem Key, damit `…_tv`/`…_vb` zum selben Deskriptor mergen. */
function flagBaseKey(field: string): string {
  return field.replace(/_(tv|vb)(_\d+)?$/i, '').replace(/_\d+$/, '');
}

/** Bereinigt ein Flag-Label fürs Display: streicht TV-/VB-Ebenen-Suffixe + `Zt`-Präfix der Slug-Prettifizierung. */
function cleanFlagLabel(label: string): string {
  return label
    .replace(/\s*\((?:TV|VB)[^)]*\)\s*$/i, '')
    .replace(/\s+(?:TV|VB)\b\s*$/i, '')
    .replace(/^Zt\s+/i, '')
    .trim();
}

export interface FlagDescriptor {
  label: string;
  isYes: boolean;
}

export interface FlagSubgroup {
  name: string;
  descriptors: FlagDescriptor[];
  total: number;
  yesCount: number;
}

interface TaggedFlagRow {
  row: DisplayRow;
  subgroup: string;
}

/**
 * Baut die konsolidierten Flag-Unterbereiche aus den getaggten Flag-Rows:
 * - Gruppiert nach Unterbereich (erste Vorkommens-Reihenfolge bleibt).
 * - Merged TV-/VB-Varianten desselben Deskriptors (`isYes` = ODER).
 * - Sortiert Deskriptoren alphabetisch je Unterbereich.
 */
export function assembleFlagCluster(flagRows: TaggedFlagRow[]): FlagSubgroup[] {
  const order: string[] = [];
  const bySub = new Map<string, Map<string, FlagDescriptor>>();

  for (const { row, subgroup } of flagRows) {
    if (!bySub.has(subgroup)) {
      bySub.set(subgroup, new Map());
      order.push(subgroup);
    }
    const descriptors = bySub.get(subgroup)!;
    const base = flagBaseKey(row.field);
    const cleaned = cleanFlagLabel(row.label);
    // Merge-Key: Basis-Key (falls Suffix gestrippt wurde) sonst normalisiertes Label.
    const descriptorId = base !== row.field ? base : normLabel(cleaned);
    const yes = flagValueIsYes(row.rawValue);
    const existing = descriptors.get(descriptorId);
    if (existing) {
      existing.isYes = existing.isYes || yes;
      // Bevorzuge ein Label ohne Slug-Artefakte (kürzer / mit Sonderzeichen).
      if (cleaned.length > 0 && cleaned.length < existing.label.length) existing.label = cleaned;
    } else {
      descriptors.set(descriptorId, { label: cleaned || row.label, isYes: yes });
    }
  }

  return order.map(name => {
    const descriptors = [...bySub.get(name)!.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'));
    return {
      name,
      descriptors,
      total: descriptors.length,
      yesCount: descriptors.filter(d => d.isYes).length,
    };
  });
}

/** Unterbereichs-Name für eine Loose-Flag-Row (kein `group_path` vorhanden, Fixture-Pfad). */
export function looseFlagSubgroup(row: DisplayRow): string {
  return row.field.startsWith('zt_') ? 'Zukunftstechnologien' : 'Sonstige Kennzeichen';
}
