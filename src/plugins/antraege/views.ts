import type { AntragListItem } from '@/core/services/csv/types';
import { antragMatchesBearbeiter, type BearbeiterFilterMode } from './bearbeiterFilter';
import {
  isOpenStatus,
  isBegleitungStatus,
} from '@/core/utils/status-canonical';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { fristTageVon } from './fristAnzeige';

export type ViewKey =
  | 'meine_offenen'
  | 'fristen'
  | 'begleitung'
  | 'alle';

// `daysUntilFrist` (rohes `frist_datum`, ungeachtet des Verfahrensschritts) ist
// mit v4.121 entfallen. Es hatte genau einen Aufrufer — die Sortierung „Frist
// (kürzeste)" —, und dort war es falsch: das Feld trug auch dort ein Datum, wo
// die Uhr steht. Wer Restzeit braucht, nimmt `fristTageVon` aus `fristAnzeige.ts`;
// das ist dieselbe Quelle, aus der die Zelle ihren Text zieht.

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
    // Alles mit LAUFENDER Uhr, nach Dringlichkeit gestaffelt.
    //
    // Bis v4.65 standen hier zwei Reiter nebeneinander: „Diese Woche" (0–6 Tage)
    // und „Überfällig" (< 0). Das ist dasselbe Fenster an zwei Stellen derselben
    // Skala — und die Staffelung dafuer gibt es seit v4.62 als Gruppierung
    // (`FRIST_AMPEL_STUFEN`: ueberfaellig · ≤ 14 T · ≤ 30 T · > 30 T). Der Reiter
    // oeffnet deshalb gruppiert, mit „Ueberfaellig" als erstem Abschnitt; beide
    // frueheren Klicks sind darin enthalten, und was in den naechsten Wochen
    // anrollt, sieht man dazu.
    //
    // Ein angehaltener Vorgang hat keine Restzeit (`fristTageVon` liefert `null`)
    // und gehoert deshalb nicht hierher — er ist fertig oder wartend, nicht faellig.
    //
    // Begleitphase bleibt aussen vor: sie hat ihre eigene Sicht und mit 3–4
    // Jahren Laufzeit einen anderen Takt.
    key: 'fristen',
    label: 'Fristen',
    predicate: a => !isBegleitungStatus(a.status) && fristTageVon(a) !== null,
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
 * Die Begleitphase wird NICHT mehr ausgeblendet: sie hat seit v2.404 eine eigene
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
    fristen: 0,
    begleitung: 0,
    alle: 0,
  };
  for (const a of antraege) {
    if (applyVbPhasePreFilter && isIrrlaeufer(a.vb_phase)) continue;
    if (bearbeiter && !antragMatchesBearbeiter(a, bearbeiter)) continue;

    counts.alle++;

    const open = isOpenStatus(a.status);
    const begl = isBegleitungStatus(a.status);
    if (open && !begl) counts.meine_offenen++;
    if (begl) counts.begleitung++;

    if (!begl && fristTageVon(a) !== null) counts.fristen++;
  }
  return counts;
}
