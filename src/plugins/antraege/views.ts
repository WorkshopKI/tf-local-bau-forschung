import type { Antrag } from '@/core/services/csv/types';

export type ViewKey =
  | 'meine_offenen'
  | 'diese_woche_faellig'
  | 'ueberfaellig'
  | 'nachforderungen'
  | 'bewilligt_jahr'
  | 'alle';

const OPEN_STATUSES = new Set([
  'eingereicht',
  'in_begutachtung',
  'in_pruefung',
  'in_bearbeitung',
  'nachbesserung',
  'nachforderung',
]);

export function daysUntilFrist(a: Antrag): number | null {
  const frist = a.frist_datum;
  if (typeof frist !== 'string' || !frist) return null;
  const ms = new Date(frist).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24));
}

function yearOfBewilligung(a: Antrag): number | null {
  const d = a.bewilligung_datum;
  if (typeof d !== 'string' || !d) return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

const CURRENT_YEAR = new Date().getFullYear();

export interface AntragView {
  key: ViewKey;
  label: string;
  predicate: (a: Antrag) => boolean;
  /** Anzeige-Hinweis unter der Suche, z.B. "Sortiert nach Frist (aufsteigend)". */
  sortHint: string;
  /** Vergleichs-Funktion zur Sortierung der Liste in dieser View. */
  compare: (a: Antrag, b: Antrag) => number;
}

function sortByFristAsc(a: Antrag, b: Antrag): number {
  const da = daysUntilFrist(a);
  const db = daysUntilFrist(b);
  if (da === null && db === null) return a.aktenzeichen.localeCompare(b.aktenzeichen);
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

function sortByBewilligungDesc(a: Antrag, b: Antrag): number {
  const da = a.bewilligung_datum;
  const db = b.bewilligung_datum;
  if (typeof da !== 'string' && typeof db !== 'string') return a.aktenzeichen.localeCompare(b.aktenzeichen);
  if (typeof da !== 'string') return 1;
  if (typeof db !== 'string') return -1;
  return db.localeCompare(da);
}

function sortByAz(a: Antrag, b: Antrag): number {
  return a.aktenzeichen.localeCompare(b.aktenzeichen);
}

export const VIEWS: AntragView[] = [
  {
    key: 'meine_offenen',
    label: 'Meine offenen',
    predicate: a => OPEN_STATUSES.has(String(a.status)),
    sortHint: 'Sortiert nach Frist (aufsteigend)',
    compare: sortByFristAsc,
  },
  {
    key: 'diese_woche_faellig',
    label: 'Diese Woche fällig',
    predicate: a => {
      const d = daysUntilFrist(a);
      return d !== null && d >= 0 && d <= 7;
    },
    sortHint: 'Sortiert nach Frist (aufsteigend)',
    compare: sortByFristAsc,
  },
  {
    key: 'ueberfaellig',
    label: 'Überfällig',
    predicate: a => {
      const d = daysUntilFrist(a);
      return d !== null && d < 0 && OPEN_STATUSES.has(String(a.status));
    },
    sortHint: 'Sortiert nach Überfälligkeit',
    compare: sortByFristAsc,
  },
  {
    key: 'nachforderungen',
    label: 'Nachforderungen',
    predicate: a => a.status === 'nachforderung' || a.status === 'nachbesserung',
    sortHint: 'Sortiert nach Frist',
    compare: sortByFristAsc,
  },
  {
    key: 'bewilligt_jahr',
    label: `Bewilligt ${CURRENT_YEAR}`,
    predicate: a => (a.status === 'bewilligt' || a.status === 'genehmigt') && yearOfBewilligung(a) === CURRENT_YEAR,
    sortHint: 'Sortiert nach Bewilligungsdatum (neuste zuerst)',
    compare: sortByBewilligungDesc,
  },
  {
    key: 'alle',
    label: 'Alle',
    predicate: () => true,
    sortHint: 'Sortiert nach Aktenzeichen',
    compare: sortByAz,
  },
];

const FALLBACK_VIEW = VIEWS[VIEWS.length - 1] as AntragView;

export function getView(key: ViewKey): AntragView {
  return VIEWS.find(v => v.key === key) ?? FALLBACK_VIEW;
}

export function viewCount(key: ViewKey, antraege: Antrag[]): number {
  const v = getView(key);
  let n = 0;
  for (const a of antraege) if (v.predicate(a)) n++;
  return n;
}
