import type { AntragListItem } from '@/core/services/csv/types';
import type { ViewKey } from './views';
import { daysUntilFrist } from './views';
import type { GroupingMode } from './antragGroups';

export type SortKey =
  | 'bewilligung_desc'
  | 'bewilligung_asc'
  | 'antrag_desc'
  | 'antrag_asc'
  | 'frist_asc'
  | 'aktenzeichen_asc'
  | 'akronym_asc'
  | 'antragsteller_asc';

export interface SortOption {
  key: SortKey;
  /** Angezeigter Text in der „Sortiert nach"-Pille. Kurz genug für eine Zeile —
   *  die Richtung steht in Klammern, die Langfassung im `hinweis`. */
  label: string;
  /** Optionaler Hover-Text (`title` am Seg-Knopf). Nur dort nötig, wo die
   *  Kurzform die Richtung nicht vollständig erklärt. */
  hinweis?: string;
  compare: (a: AntragListItem, b: AntragListItem) => number;
}

function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  return String(v);
}

function compareDateDesc(a: AntragListItem, b: AntragListItem, field: 'bewilligung_datum' | 'antragsdatum'): number {
  const da = asString(a[field]);
  const db = asString(b[field]);
  if (!da && !db) return a.aktenzeichen.localeCompare(b.aktenzeichen);
  if (!da) return 1;
  if (!db) return -1;
  return db.localeCompare(da);
}

function compareDateAsc(a: AntragListItem, b: AntragListItem, field: 'bewilligung_datum' | 'antragsdatum'): number {
  const da = asString(a[field]);
  const db = asString(b[field]);
  if (!da && !db) return a.aktenzeichen.localeCompare(b.aktenzeichen);
  if (!da) return 1;
  if (!db) return -1;
  return da.localeCompare(db);
}

function compareFristAsc(a: AntragListItem, b: AntragListItem): number {
  const da = daysUntilFrist(a);
  const db = daysUntilFrist(b);
  if (da === null && db === null) return a.aktenzeichen.localeCompare(b.aktenzeichen);
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

function compareTextAsc(a: AntragListItem, b: AntragListItem, field: 'akronym' | 'antragsteller'): number {
  const va = asString(a[field]).toLowerCase();
  const vb = asString(b[field]).toLowerCase();
  if (!va && !vb) return a.aktenzeichen.localeCompare(b.aktenzeichen);
  if (!va) return 1;
  if (!vb) return -1;
  return va.localeCompare(vb, 'de');
}

/** EINZIGE Quelle der Sortier-Optionen — Schlüssel, Beschriftung und Vergleich
 *  liegen zusammen, damit die Anzeige nicht von der Wirkung abweichen kann.
 *  Bis v2.372.4 führte [QuickfilterToolbar](filter/QuickfilterToolbar.tsx) eine
 *  eigene, kürzere Liste: `frist_asc` hieß dort „Frist (kürzeste zuerst)" und
 *  hier „Älteste Eingänge zuerst", und die drei hier fehlenden Schlüssel waren
 *  gar nicht wählbar — in der Sicht „Bewilligt" zeigte die Pille deshalb
 *  „Neueste zuerst", während nach Bewilligungsdatum sortiert wurde. */
export const SORT_OPTIONS: readonly SortOption[] = [
  {
    key: 'bewilligung_desc',
    label: 'Bewilligung (neueste)',
    hinweis: 'Bewilligungsdatum, neueste zuerst',
    compare: (a, b) => compareDateDesc(a, b, 'bewilligung_datum'),
  },
  {
    key: 'bewilligung_asc',
    label: 'Bewilligung (älteste)',
    hinweis: 'Bewilligungsdatum, älteste zuerst',
    compare: (a, b) => compareDateAsc(a, b, 'bewilligung_datum'),
  },
  {
    key: 'antrag_desc',
    label: 'Eingang (neueste)',
    hinweis: 'Antragseingang, neueste zuerst',
    compare: (a, b) => compareDateDesc(a, b, 'antragsdatum'),
  },
  {
    key: 'antrag_asc',
    label: 'Eingang (älteste)',
    hinweis: 'Antragseingang, älteste zuerst',
    compare: (a, b) => compareDateAsc(a, b, 'antragsdatum'),
  },
  {
    // Sortiert nach RESTLAUFZEIT der Frist, nicht nach Eingangsalter — die alte
    // Beschriftung „Älteste Eingänge zuerst" beschrieb `antrag_asc`.
    key: 'frist_asc',
    label: 'Frist (kürzeste)',
    hinweis: 'Frist, kürzeste Restlaufzeit zuerst — Überfällige oben',
    compare: compareFristAsc,
  },
  {
    key: 'aktenzeichen_asc',
    label: 'FKZ (A→Z)',
    compare: (a, b) => a.aktenzeichen.localeCompare(b.aktenzeichen),
  },
  {
    key: 'akronym_asc',
    label: 'Akronym (A→Z)',
    compare: (a, b) => compareTextAsc(a, b, 'akronym'),
  },
  {
    key: 'antragsteller_asc',
    label: 'Antragsteller (A→Z)',
    compare: (a, b) => compareTextAsc(a, b, 'antragsteller'),
  },
];

export const DEFAULT_SORT_BY_VIEW: Record<ViewKey, SortKey> = {
  meine_offenen: 'frist_asc',
  diese_woche_faellig: 'frist_asc',
  ueberfaellig: 'frist_asc',
  bewilligt_jahr: 'bewilligung_desc',
  // „Alle": neueste Antragseingänge zuerst (Journey-Paket 2 Phase 4) — das
  // aktuellste Geschehen oben statt FKZ-alphabetisch. Bestehende explizite
  // Nutzer-Overrides auf „Alle" bleiben Vorrang (store: `sortByView`).
  alle: 'antrag_desc',
};

export function getSortOption(key: SortKey): SortOption {
  return SORT_OPTIONS.find(o => o.key === key) ?? SORT_OPTIONS[5]!;
}

const BEWILLIGUNG_VIEWS: ReadonlySet<ViewKey> = new Set<ViewKey>(['bewilligt_jahr', 'alle']);
const BEWILLIGUNG_KEYS: ReadonlySet<SortKey> = new Set<SortKey>(['bewilligung_desc', 'bewilligung_asc']);

/** Liefert die im Sort-Dropdown sichtbaren Optionen pro View.
 *  Bewilligungsdatum-Sort ergibt nur in Tabs Sinn, in denen bewilligte
 *  Anträge garantiert oder regelmäßig auftauchen — sonst UX-Lärm. */
export function getSortOptionsForView(view: ViewKey): SortOption[] {
  if (BEWILLIGUNG_VIEWS.has(view)) return [...SORT_OPTIONS];
  return SORT_OPTIONS.filter(o => !BEWILLIGUNG_KEYS.has(o.key));
}

/** Validiert, ob ein (eventuell aus localStorage geladener) SortKey für die
 *  aktuelle View weiterhin erlaubt ist. Wird vom Store-Helper genutzt, um
 *  Altzustände sauber auf den View-Default zurückzufallen. */
export function isSortAllowedForView(key: SortKey, view: ViewKey): boolean {
  if (BEWILLIGUNG_KEYS.has(key) && !BEWILLIGUNG_VIEWS.has(view)) return false;
  return true;
}

// --------------------------------------------------------------------------
// Gruppierungs-Optionen
// --------------------------------------------------------------------------

export interface GroupingOption {
  key: GroupingMode;
  label: string;
}

/** Sichtbare Gruppierungs-Optionen für die UI-Toolbar (Quickfilter-Seg).
 *  Reihenfolge = Anzeige-Reihenfolge. Vor v1.17: 4 Werte inkl. `verbund`;
 *  seit Design-Handoff-Refactor: `verbund` aus der UI entfernt, neue `status`-
 *  Gruppierung ergänzt. `verbund` bleibt im Code (`antragGroups.ts`) für Tests
 *  und potenzielle programmatische Aufrufer. */
export const GROUPING_OPTIONS: readonly GroupingOption[] = [
  { key: 'none', label: 'Keine' },
  { key: 'status', label: 'Status' },
  { key: 'netzwerk', label: 'NW' },
  { key: 'netzwerk-by-size', label: 'NW-Größe' },
];

/** Default-Gruppierung pro View. Mit Wegfall von `verbund` als UI-Option
 *  fallen alle Views auf `none` zurück — explizit und vorhersagbar. */
export const DEFAULT_GROUPING_BY_VIEW: Record<ViewKey, GroupingMode> = {
  meine_offenen: 'none',
  diese_woche_faellig: 'none',
  ueberfaellig: 'none',
  bewilligt_jahr: 'none',
  alle: 'none',
};

export function getGroupingOption(key: GroupingMode): GroupingOption {
  return GROUPING_OPTIONS.find(o => o.key === key) ?? GROUPING_OPTIONS[0]!;
}

/** True für Sort-Keys, die Gruppen-Clustering auseinanderreißen würden.
 *  Antragsteller-Sort ist das einzige solche Verhalten: gleicher Antragsteller
 *  soll direkt nebeneinander stehen, nicht unter Verbund/Netzwerk-Headern
 *  verstreut. */
export function sortDisablesGrouping(key: SortKey): boolean {
  return key === 'antragsteller_asc';
}
