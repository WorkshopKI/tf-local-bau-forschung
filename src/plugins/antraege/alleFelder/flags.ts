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
import type { DisplayRow } from './buildDisplayRows';
import type { CsvSchema, FieldType } from '@/core/services/csv/types';

/** Normalisiert ein Label/Key für robustes Matching (lowercase, nur a–z/0–9/Umlaut). */
export function normLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
}

/** Top-Level-`group_path`-Labels (normalisiert), die einen Flag-Cluster markieren. */
const FLAG_ROOT_LABELS = new Set<string>([
  normLabel('Technologie-Kennzeichen'),
  normLabel('Technologiekennzeichen'),
  normLabel('Zukunftstechnologien'),
]);

/** `true`, wenn der Gruppen-Pfad (group_path) ein Technologie-Kennzeichen-Cluster ist. */
export function isFlagGroupPath(path: string[]): boolean {
  return path.length > 0 && FLAG_ROOT_LABELS.has(normLabel(path[0]!));
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
