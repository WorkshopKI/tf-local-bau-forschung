import type { AntragListItem } from '@/core/services/csv/types';
import { antragMatchesBearbeiter, type BearbeiterFilterMode } from './bearbeiterFilter';
import {
  isOpenStatus,
  isBewilligtStatus,
  isBegleitungStatus,
} from '@/core/utils/status-canonical';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { daysSinceEingang } from './eingangAmpel';

export type ViewKey =
  | 'meine_offenen'
  | 'diese_woche_faellig'
  | 'ueberfaellig'
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
    label: 'Offen',
    predicate: a => isOpenStatus(a.status),
  },
  {
    // Bearbeitungs-SLA: rote Eingangs-Ampel (>90 Tage) erreicht diese Woche.
    // Nur Antragsphase — Begleit-Antraege haben einen anderen Lebenszyklus
    // (VN-Frist = vn_eingang_datum + 6 Monate) und gehoeren NICHT in diese
    // antragsdatum-basierte View.
    key: 'diese_woche_faellig',
    label: 'Diese Woche',
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
 *
 * Begleitphase (VN-/ZB-Stati) wird — konsistent zur Liste — ausgeblendet, wenn
 * der Profil-Toggle „inkl. Begleitung" aus ist (`bearbeiter.includeBegleitung`).
 * Ohne `bearbeiter`-Mode wird NICHT begleit-gefiltert (Default true) → die
 * Counts entsprechen dann dem reinen View-Predicate (Test-/Edge-Verhalten).
 */
export function viewCount(
  key: ViewKey,
  antraege: AntragListItem[],
  bearbeiter?: BearbeiterFilterMode,
  applyVbPhasePreFilter: boolean = true,
): number {
  const v = getView(key);
  const includeBegleitung = bearbeiter?.includeBegleitung ?? true;
  let n = 0;
  for (const a of antraege) {
    if (applyVbPhasePreFilter && isIrrlaeufer(a.vb_phase)) continue;
    if (!includeBegleitung && isBegleitungStatus(a.status)) continue;
    if (!v.predicate(a)) continue;
    if (bearbeiter && !antragMatchesBearbeiter(a, bearbeiter)) continue;
    n++;
  }
  return n;
}

/**
 * Single-Pass-Variante: berechnet die Counts fuer ALLE Views in einem Loop
 * ueber die Antraege. Im Header laufen sonst 5 separate `viewCount`-Aufrufe
 * mit jeweils einer Allokation pro Antrag (`new Date()` in `daysSinceEingang`,
 * `Number(d.slice(0,4))` in `yearOfBewilligung`). Bei 13k Antraegen spart
 * das ~65k Predicate-Calls auf ~13k mit gemeinsamen Zwischenwerten.
 *
 * Verhalten ist 1:1 aequivalent zu `VIEWS.map(v => viewCount(v.key, ...))` —
 * jeder Eintrag im Ergebnis-Record entspricht dem gleichnamigen View-Predicate.
 * Inkl. des Begleitphasen-Filters (siehe `viewCount`): bei `includeBegleitung=
 * false` werden VN-/ZB-Stati universell uebersprungen, damit die Tab-Counts mit
 * der gerenderten Liste (`useFilteredAntraege` → `filterByBegleitungPhase`)
 * uebereinstimmen.
 */
export function viewCounts(
  antraege: AntragListItem[],
  bearbeiter?: BearbeiterFilterMode,
  applyVbPhasePreFilter: boolean = true,
): Record<ViewKey, number> {
  const counts: Record<ViewKey, number> = {
    meine_offenen: 0,
    diese_woche_faellig: 0,
    ueberfaellig: 0,
    bewilligt_jahr: 0,
    alle: 0,
  };
  const currentYear = getCurrentYear();
  const includeBegleitung = bearbeiter?.includeBegleitung ?? true;
  for (const a of antraege) {
    if (applyVbPhasePreFilter && isIrrlaeufer(a.vb_phase)) continue;
    if (!includeBegleitung && isBegleitungStatus(a.status)) continue;
    if (bearbeiter && !antragMatchesBearbeiter(a, bearbeiter)) continue;

    counts.alle++;

    const open = isOpenStatus(a.status);
    if (open) counts.meine_offenen++;

    if (open && !isBegleitungStatus(a.status)) {
      const d = daysSinceEingang(a);
      if (d !== null) {
        if (d >= 84 && d <= 90) counts.diese_woche_faellig++;
        if (d > 90) counts.ueberfaellig++;
      }
    }

    if (isBewilligtStatus(a.status) && yearOfBewilligung(a) === currentYear) {
      counts.bewilligt_jahr++;
    }
  }
  return counts;
}
