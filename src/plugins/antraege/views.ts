import type { AntragListItem } from '@/core/services/csv/types';
import { antragMatchesBearbeiter, type BearbeiterFilterMode } from './bearbeiterFilter';
import {
  isOpenStatus,
  isNachforderungStatus,
  isBewilligtStatus,
  isBegleitungStatus,
} from '@/core/utils/status-canonical';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { daysSinceEingang } from './eingangAmpel';

export type ViewKey =
  | 'meine_offenen'
  | 'diese_woche_faellig'
  | 'ueberfaellig'
  | 'nachforderungen'
  | 'bewilligt_jahr'
  | 'alle';

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

/** Pro-Aufruf ausgewertet, damit Tests via `vi.setSystemTime` ein
 *  deterministisches Heute injecten koennen (sonst frozen-at-module-load). */
function getCurrentYear(): number {
  return new Date().getFullYear();
}

export interface AntragView {
  key: ViewKey;
  label: string;
  predicate: (a: AntragListItem) => boolean;
}

export const VIEWS: AntragView[] = [
  {
    key: 'meine_offenen',
    label: 'Meine offenen',
    predicate: a => isOpenStatus(a.status),
  },
  {
    // Bearbeitungs-SLA: rote Eingangs-Ampel (>90 Tage) erreicht diese Woche.
    // Nur Antragsphase — Begleit-Antraege haben einen anderen Lebenszyklus
    // (VN-Frist = vn_eingang_datum + 6 Monate) und gehoeren NICHT in diese
    // antragsdatum-basierte View.
    key: 'diese_woche_faellig',
    label: 'SLA-Risiko (diese Woche)',
    predicate: a => {
      if (!isOpenStatus(a.status)) return false;
      if (isBegleitungStatus(a.status)) return false;
      const d = daysSinceEingang(a);
      return d !== null && d >= 84 && d <= 90;
    },
  },
  {
    // Bearbeitungs-SLA: rote Eingangs-Ampel (>90 Tage) bereits erreicht.
    // Begleitphase explizit ausgeschlossen (siehe diese_woche_faellig).
    key: 'ueberfaellig',
    label: 'Überfällig',
    predicate: a => {
      if (!isOpenStatus(a.status)) return false;
      if (isBegleitungStatus(a.status)) return false;
      const d = daysSinceEingang(a);
      return d !== null && d > 90;
    },
  },
  {
    key: 'nachforderungen',
    label: 'Nachforderungen',
    predicate: a => isNachforderungStatus(a.status),
  },
  {
    key: 'bewilligt_jahr',
    label: `Bewilligt ${getCurrentYear()}`,
    predicate: a => isBewilligtStatus(a.status) && yearOfBewilligung(a) === getCurrentYear(),
  },
  {
    key: 'alle',
    label: 'Alle',
    predicate: () => true,
  },
];

const FALLBACK_VIEW = VIEWS[VIEWS.length - 1] as AntragView;

export function getView(key: ViewKey): AntragView {
  return VIEWS.find(v => v.key === key) ?? FALLBACK_VIEW;
}

/**
 * Zaehlt Antraege fuer einen View-Key. Wendet die View-Predicate und optional
 * den Bearbeiter-Filter an. Standardmaessig wird der `vb_phase=9` (Irrlaeufer)
 * Pre-Filter mit angewendet — konsistent zum Listenrendering in
 * `useFilteredAntraege`. Header-Aufrufer geben `applyVbPhasePreFilter=false`,
 * wenn in der Sidebar ein expliziter `vb_phase`-Filter aktiv ist (dann sollen
 * Irrlaeufer wieder sichtbar werden).
 */
export function viewCount(
  key: ViewKey,
  antraege: AntragListItem[],
  bearbeiter?: BearbeiterFilterMode,
  applyVbPhasePreFilter: boolean = true,
): number {
  const v = getView(key);
  let n = 0;
  for (const a of antraege) {
    if (applyVbPhasePreFilter && isIrrlaeufer(a.vb_phase)) continue;
    if (!v.predicate(a)) continue;
    if (bearbeiter && !antragMatchesBearbeiter(a, bearbeiter)) continue;
    n++;
  }
  return n;
}
