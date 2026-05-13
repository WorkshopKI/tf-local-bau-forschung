import type { AntragListItem } from '@/core/services/csv/types';
import type { ViewKey } from './views';
import { daysUntilFrist } from './views';

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
  label: string;
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

export const SORT_OPTIONS: readonly SortOption[] = [
  {
    key: 'bewilligung_desc',
    label: 'Bewilligungsdatum (neueste zuerst)',
    compare: (a, b) => compareDateDesc(a, b, 'bewilligung_datum'),
  },
  {
    key: 'bewilligung_asc',
    label: 'Bewilligungsdatum (älteste zuerst)',
    compare: (a, b) => compareDateAsc(a, b, 'bewilligung_datum'),
  },
  {
    key: 'antrag_desc',
    label: 'Antragsdatum (neueste zuerst)',
    compare: (a, b) => compareDateDesc(a, b, 'antragsdatum'),
  },
  {
    key: 'antrag_asc',
    label: 'Antragsdatum (älteste zuerst)',
    compare: (a, b) => compareDateAsc(a, b, 'antragsdatum'),
  },
  {
    key: 'frist_asc',
    label: 'Frist (kürzeste zuerst)',
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
  nachforderungen: 'frist_asc',
  bewilligt_jahr: 'bewilligung_desc',
  alle: 'aktenzeichen_asc',
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
