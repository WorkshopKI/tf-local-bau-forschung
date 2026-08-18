/**
 * Die zuletzt gestellten Fragen an die Förderantrags-Liste.
 *
 * Ein **eigener** Verlauf, getrennt vom Verlauf der Dokumenten-Suche: dort
 * stehen Stichworte und Feldausdrücke (`ort:Dresden`), hier ganze Sätze. In
 * einer Liste gemischt wären beide unbrauchbar — ein Stichwort als Frage-
 * Vorschlag läuft in einen KI-Aufruf, der nichts zu übersetzen hat.
 *
 * **In `localStorage`, nicht in der IndexedDB** — eine kurze Liste kurzer
 * Zeichenketten, dieselbe Bauform wie `teamflow_suche_recent_queries`
 * ([store.ts](src/plugins/suche/store.ts)). Damit ist sie gerätelokal und
 * verlässt den Rechner nie: eine Frage kann ein Kürzel und ein Thema enthalten,
 * und beides gehört niemandem außer dem, der gefragt hat.
 *
 * **Gemerkt wird erst, was funktioniert hat.** Der Eintrag entsteht nach einem
 * Lauf mit Plan (`useAntragsFrage`), nicht beim Drücken der Eingabetaste. Ein
 * Abschnitt „Zuletzt gefragt", der Fragen anbietet, die schon einmal an einer
 * fehlenden KI-Verbindung gescheitert sind, verspräche eine Wiederholung, die
 * nichts wiederholt.
 */
import { create } from 'zustand';
import { pushRecentSearch } from '@/core/services/search/anfrage-verlauf';

const KEY = 'teamflow_antraege_frage_verlauf';

/**
 * Kürzer als der Verlauf der Suche (15): ganze Fragen sind lang, die Liste
 * steht unter einem Eingabefeld, und was älter als zehn Fragen ist, sucht man
 * schneller neu als in einer Liste, die den halben Bildschirm füllt.
 */
const MAX = 10;

function lies(): string[] {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return [];
    const geparst = JSON.parse(roh) as unknown;
    if (!Array.isArray(geparst)) return [];
    return geparst
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function schreibe(liste: string[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(liste)); } catch { /* ignore */ }
}

interface FrageVerlaufStore {
  verlauf: string[];
  /** Nimmt eine erfolgreich übersetzte Frage vorne auf. */
  merke: (frage: string) => void;
  /** Nimmt eine einzelne Frage heraus (das ✕ an der Zeile). */
  entferne: (frage: string) => void;
  leere: () => void;
}

export const useFrageVerlauf = create<FrageVerlaufStore>((set, get) => ({
  verlauf: lies(),
  merke: (frage: string) => {
    const naechster = pushRecentSearch(get().verlauf, frage, MAX);
    if (naechster === get().verlauf) return;
    schreibe(naechster);
    set({ verlauf: naechster });
  },
  entferne: (frage: string) => {
    const naechster = get().verlauf.filter(e => e !== frage);
    schreibe(naechster);
    set({ verlauf: naechster });
  },
  leere: () => {
    schreibe([]);
    set({ verlauf: [] });
  },
}));
