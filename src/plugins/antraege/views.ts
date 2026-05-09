import type { AntragListItem } from '@/core/services/csv/types';
import { antragMatchesBearbeiter, type BearbeiterFilterMode } from './bearbeiterFilter';

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

export function daysUntilFrist(a: AntragListItem): number | null {
  const frist = a.frist_datum;
  if (typeof frist !== 'string' || !frist) return null;
  const ms = new Date(frist).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24));
}

function yearOfBewilligung(a: AntragListItem): number | null {
  const d = a.bewilligung_datum;
  if (typeof d !== 'string' || !d) return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

const CURRENT_YEAR = new Date().getFullYear();

export interface AntragView {
  key: ViewKey;
  label: string;
  predicate: (a: AntragListItem) => boolean;
  /** Wenn true, rendert die Liste die Tage-bis-Frist-Spalte vor jeder Card.
   *  Bei nicht-deadline-fokussierten Views (Bewilligt, Alle) ausschalten — sonst zeigt
   *  jede Reihe ein leeres "—", weil bewilligte Antraege keine offene Frist mehr haben. */
  showDaysColumn: boolean;
}

export const VIEWS: AntragView[] = [
  {
    key: 'meine_offenen',
    label: 'Meine offenen',
    predicate: a => OPEN_STATUSES.has(String(a.status)),
    showDaysColumn: true,
  },
  {
    key: 'diese_woche_faellig',
    label: 'Diese Woche fällig',
    predicate: a => {
      const d = daysUntilFrist(a);
      return d !== null && d >= 0 && d <= 7;
    },
    showDaysColumn: true,
  },
  {
    key: 'ueberfaellig',
    label: 'Überfällig',
    predicate: a => {
      const d = daysUntilFrist(a);
      return d !== null && d < 0 && OPEN_STATUSES.has(String(a.status));
    },
    showDaysColumn: true,
  },
  {
    key: 'nachforderungen',
    label: 'Nachforderungen',
    predicate: a => a.status === 'nachforderung' || a.status === 'nachbesserung',
    showDaysColumn: true,
  },
  {
    key: 'bewilligt_jahr',
    label: `Bewilligt ${CURRENT_YEAR}`,
    predicate: a => (a.status === 'bewilligt' || a.status === 'genehmigt') && yearOfBewilligung(a) === CURRENT_YEAR,
    showDaysColumn: false,
  },
  {
    key: 'alle',
    label: 'Alle',
    predicate: () => true,
    showDaysColumn: false,
  },
];

const FALLBACK_VIEW = VIEWS[VIEWS.length - 1] as AntragView;

export function getView(key: ViewKey): AntragView {
  return VIEWS.find(v => v.key === key) ?? FALLBACK_VIEW;
}

export function viewCount(
  key: ViewKey,
  antraege: AntragListItem[],
  bearbeiter?: BearbeiterFilterMode,
): number {
  const v = getView(key);
  let n = 0;
  for (const a of antraege) {
    if (!v.predicate(a)) continue;
    if (bearbeiter && !antragMatchesBearbeiter(a, bearbeiter)) continue;
    n++;
  }
  return n;
}
