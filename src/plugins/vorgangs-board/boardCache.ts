/**
 * Das gerechnete Board **über den Seitenwechsel hinweg** halten.
 *
 * Warum es das braucht: der Router hält keine Seite am Leben. Jede Rückkehr aufs
 * Board mountete den Hook neu, las den Bestand erneut aus IDB und rechnete ihn
 * erneut durch — gemessen mehrere Sekunden, bei jedem einzelnen Aufruf, für ein
 * Ergebnis, das sich zwischendurch gar nicht geändert hatte.
 *
 * **Ein Cache muss sagen, dass er einer ist.** Die Seite zeigt Alter und einen
 * „neu berechnen"-Knopf. Stille Momentaufnahmen sind genau die Art von
 * Unehrlichkeit, gegen die `trigger-share.ts` und der Wächter argumentieren —
 * ein Board, das ohne Hinweis vier Minuten alte Zahlen zeigt, wäre dasselbe in
 * klein.
 *
 * Vorbild für die Mechanik ist der TTL-Skip des Anträge-Stores
 * (`plugins/antraege/store.ts`), mit einer Verschärfung: scharf gestellt wird
 * nach **gelesenen** Sätzen, nicht nach Ergebniszeilen — siehe {@link setzen}.
 */
import { create } from 'zustand';
import type { MappingVersion } from '@/core/status';
import type { BoardZeile } from './useVorgangsBoard';

/**
 * Wie lange ein Ergebnis ohne neues Signal gilt.
 *
 * Fünf Minuten wie der Anträge-Store, bewusst als eigene Konstante statt als
 * Import über die Plugin-Grenze: die beiden dürfen sich unabhängig ändern.
 * Sie ist die **Obergrenze** der Schalheit, nicht der Normalfall — ein Import
 * entwertet über die Bestands-Generation sofort.
 */
export const BOARD_CACHE_TTL_MS = 5 * 60 * 1000;

export interface BoardCacheDaten {
  version: MappingVersion;
  zeilen: BoardZeile[];
  ausgeblendet: number;
  ladeMs: number;
}

interface BoardCacheState {
  schluessel: string | null;
  daten: BoardCacheDaten | null;
  /** Wann gerechnet wurde (für „berechnet vor N min"). */
  berechnetAm: number;
  /** `0` = nicht scharf. Wie `lastLoadedAt` im Anträge-Store. */
  standAt: number;
  /**
   * @param gelesen Sätze, die aus IDB **kamen** — inklusive der vom
   *   Betrachtungsbereich verworfenen. Siehe unten, warum nicht `zeilen.length`.
   */
  setzen: (schluessel: string, daten: BoardCacheDaten, gelesen: number) => void;
  entwerten: () => void;
}

export const useBoardCache = create<BoardCacheState>(set => ({
  schluessel: null,
  daten: null,
  berechnetAm: 0,
  standAt: 0,
  setzen: (schluessel, daten, gelesen) => set({
    schluessel,
    daten,
    berechnetAm: Date.now(),
    // Scharf nur, wenn wirklich etwas gelesen wurde — und gemessen an den
    // GELESENEN Sätzen, nicht an den Ergebniszeilen. Null Zeilen hat zwei sehr
    // verschiedene Ursachen:
    //  - Cold Start: die IDB ist noch nicht befüllt. Diesen Zustand
    //    festzuschreiben hiesse, die Seite bis zum Reload leer zu halten
    //    (derselbe Fehler, den `store.ts` als v2.21.3 dokumentiert).
    //  - Ein Betrachtungsbereich, der alles ausschliesst. Das ist eine echte,
    //    stabile Antwort — sie soll nicht bei jedem Besuch neu erarbeitet werden.
    // Der Unterschied ist hier gratis zu haben; `zeilen.length` könnte ihn nicht.
    standAt: gelesen > 0 ? Date.now() : 0,
  }),
  entwerten: () => set({ schluessel: null, daten: null, standAt: 0, berechnetAm: 0 }),
}));

/** Gilt der Eintrag noch? Rein — `jetzt` kommt von aussen. */
export function cacheGilt(
  state: Pick<BoardCacheState, 'schluessel' | 'daten' | 'standAt'>,
  schluessel: string,
  jetzt: number,
): boolean {
  return state.daten !== null
    && state.schluessel === schluessel
    && state.standAt > 0
    && jetzt - state.standAt < BOARD_CACHE_TTL_MS;
}
