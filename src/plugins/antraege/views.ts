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
  | 'begleitung'
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
    // Der Schlüssel bleibt `meine_offenen`: daran hängen die persistierte
    // Sicht, die Sortier-Vorlieben und die Sprünge von der Startseite.
    // Antragsphase = Eingang bis Bewilligung (ca. 3–9 Monate, TIB/BIB).
    key: 'meine_offenen',
    label: 'Antragsphase',
    predicate: a => isOpenStatus(a.status) && !isBegleitungStatus(a.status),
  },
  {
    // Begleitphase = nach der Bewilligung, während der Antragsteller umsetzt
    // (3–4 Jahre, ZTP/PFM). Eigene Uhr: `computeFristDatum` rechnet hier ab
    // vn_eingang_datum + 6 Monate statt antragsdatum + 90 Tage. Beide Uhren in
    // einer Zahl zu addieren ergibt kein Arbeitssignal.
    key: 'begleitung',
    label: 'Begleitung',
    predicate: a => isBegleitungStatus(a.status),
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
 * Die Begleitphase wird NICHT mehr ausgeblendet: sie hat seit v2.402 eine eigene
 * Sicht. Der Profil-Haken `bearbeiter_inkl_begleitung` steuert nur noch, ob
 * ZTP-/PFM-Spalten beim Kürzel-Zuschnitt mitzählen (`spaltenFuer`).
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

/**
 * Single-Pass-Variante: berechnet die Counts fuer ALLE Views in einem Loop
 * ueber die Antraege. Im Header laufen sonst 6 separate `viewCount`-Aufrufe
 * mit jeweils einer Allokation pro Antrag (`new Date()` in `daysSinceEingang`,
 * `Number(d.slice(0,4))` in `yearOfBewilligung`). Bei 13k Antraegen spart
 * das ~65k Predicate-Calls auf ~13k mit gemeinsamen Zwischenwerten.
 *
 * Verhalten ist 1:1 aequivalent zu `VIEWS.map(v => viewCount(v.key, ...))` —
 * jeder Eintrag im Ergebnis-Record entspricht dem gleichnamigen View-Predicate.
 */
export function viewCounts(
  antraege: AntragListItem[],
  bearbeiter?: BearbeiterFilterMode,
  applyVbPhasePreFilter: boolean = true,
): Record<ViewKey, number> {
  const counts: Record<ViewKey, number> = {
    meine_offenen: 0,
    begleitung: 0,
    diese_woche_faellig: 0,
    ueberfaellig: 0,
    bewilligt_jahr: 0,
    alle: 0,
  };
  const currentYear = getCurrentYear();
  for (const a of antraege) {
    if (applyVbPhasePreFilter && isIrrlaeufer(a.vb_phase)) continue;
    if (bearbeiter && !antragMatchesBearbeiter(a, bearbeiter)) continue;

    counts.alle++;

    const open = isOpenStatus(a.status);
    const begl = isBegleitungStatus(a.status);
    if (open && !begl) counts.meine_offenen++;
    if (begl) counts.begleitung++;

    if (open && !begl) {
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
