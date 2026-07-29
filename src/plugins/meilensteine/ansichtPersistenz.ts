/**
 * Merkt die Ansicht der Seite „Fristen & Meilensteine" über Reloads hinweg:
 * aktiver Tab, Eingangs-Zeitraum, die Pills der Übersicht und „nur meine" der
 * Wochen-Liste. Ohne das stellt jeder, der die Seite mehrmals am Tag öffnet,
 * dieselben Filter immer wieder von Hand ein.
 *
 * Reine UI-Preference → localStorage (laut CLAUDE.md dafür erlaubt), EIN Key für
 * alles. Vorbild ist `antraege/filter/activeFilterPersistence.ts`: defensiv
 * lesen, unbekannte Werte still verwerfen, Schreibfehler schlucken — die Ansicht
 * gilt dann eben nur für die laufende Sitzung.
 *
 * BEWUSST NICHT gemerkt: der freie Suchtext. Ein gesetzter Zeitraum und eine
 * gesetzte Pill sind beim Öffnen als aktiv erkennbar, ein alter Suchbegriff
 * filtert die Liste dagegen unauffällig weiter. Er wird darum hier verworfen —
 * an genau einer Stelle statt an jedem Aufrufer.
 */
import { ANTRAGSTYP_BUCKETS } from '@/core/utils/vb-phase-mappings';
import { PROGNOSE_REIHENFOLGE } from './labels';
import {
  standardBereich, standardFilter, type DatumBereich, type UebersichtFilter,
} from './monitoringLogic';

/** Die vier Bereiche der Seite. */
export type TabKey = 'uebersicht' | 'woche' | 'auswertung' | 'konfiguration';

const TABS: readonly TabKey[] = ['uebersicht', 'woche', 'auswertung', 'konfiguration'];

/**
 * Einstiegs-Tab beim allerersten Besuch: die Arbeitsliste, nicht die Übersicht —
 * „was ist jetzt fällig" ist die tägliche Frage an dieses Modul.
 */
export const STANDARD_TAB: TabKey = 'woche';

const STORAGE_KEY = 'teamflow_meilensteine_ansicht';

/**
 * Sentinel für „Alle Eingänge". Nötig, weil `null` beim Lesen nicht von „noch nie
 * etwas gespeichert" zu unterscheiden wäre — die bewusste Wahl „alle" würde beim
 * nächsten Laden sonst still zum Jahres-Standard zurückspringen.
 */
const ALLE = 'alle';

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

interface Gespeichert {
  tab?: TabKey;
  bereich?: DatumBereich | typeof ALLE;
  uebersicht?: Omit<UebersichtFilter, 'suche'>;
  wocheNurMeine?: boolean;
}

function readAll(): Gespeichert {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Gespeichert;
  } catch {
    return {};
  }
}

/** Teil-Aktualisierung: die übrigen Felder bleiben stehen. */
function writePatch(patch: Gespeichert): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), ...patch }));
  } catch {
    /* localStorage nicht verfügbar — die Ansicht gilt nur für diese Sitzung */
  }
}

function istBereich(wert: unknown): wert is DatumBereich {
  const b = wert as DatumBereich | null;
  return !!b && typeof b === 'object'
    && typeof b.von === 'string' && ISO_TAG.test(b.von)
    && typeof b.bis === 'string' && ISO_TAG.test(b.bis);
}

/** Werte, die es heute noch gibt — nach einem Umbau fallen alte still weg. */
function nurBekannte<T extends string>(werte: unknown, erlaubt: readonly T[]): T[] {
  if (!Array.isArray(werte)) return [];
  return werte.filter(
    (w): w is T => typeof w === 'string' && (erlaubt as readonly string[]).includes(w),
  );
}

export function ladeTab(): TabKey {
  const tab = readAll().tab;
  return typeof tab === 'string' && (TABS as readonly string[]).includes(tab)
    ? tab as TabKey
    : STANDARD_TAB;
}

export function speichereTab(tab: TabKey): void {
  writePatch({ tab });
}

/** Gespeicherter Eingangs-Zeitraum; `null` = „Alle Eingänge". */
export function ladeBereich(currentYear: number): DatumBereich | null {
  const bereich = readAll().bereich;
  if (bereich === ALLE) return null;
  return istBereich(bereich)
    ? { von: bereich.von, bis: bereich.bis }
    : standardBereich(currentYear);
}

export function speichereBereich(bereich: DatumBereich | null): void {
  writePatch({ bereich: bereich ?? ALLE });
}

/**
 * „nur meine": ohne eigenes Kürzel IMMER aus — der Filter würde sonst alles
 * ausblenden und der Schalter dazu ist gar nicht sichtbar. Mit Kürzel gilt die
 * gespeicherte Wahl, und beim ersten Besuch der Standard „an".
 */
function nurMeineAus(gespeichert: unknown, hatKuerzel: boolean): boolean {
  if (!hatKuerzel) return false;
  return typeof gespeichert === 'boolean' ? gespeichert : true;
}

/** Pills der Übersicht; `suche` startet immer leer (siehe Kopf-Kommentar). */
export function ladeUebersichtFilter(hatKuerzel: boolean): UebersichtFilter {
  const u = readAll().uebersicht;
  if (!u || typeof u !== 'object' || Array.isArray(u)) return standardFilter(hatKuerzel);
  return {
    suche: '',
    typen: nurBekannte(u.typen, ANTRAGSTYP_BUCKETS),
    prognosen: nurBekannte(u.prognosen, PROGNOSE_REIHENFOLGE),
    nurMeine: nurMeineAus(u.nurMeine, hatKuerzel),
  };
}

export function speichereUebersichtFilter(filter: UebersichtFilter): void {
  writePatch({
    uebersicht: {
      typen: filter.typen,
      prognosen: filter.prognosen,
      nurMeine: filter.nurMeine,
    },
  });
}

export function ladeWocheNurMeine(hatKuerzel: boolean): boolean {
  return nurMeineAus(readAll().wocheNurMeine, hatKuerzel);
}

export function speichereWocheNurMeine(nurMeine: boolean): void {
  writePatch({ wocheNurMeine: nurMeine });
}
