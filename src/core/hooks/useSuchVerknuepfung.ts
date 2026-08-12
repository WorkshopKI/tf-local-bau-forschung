/**
 * Verknüpfung mehrerer Stichwörter in der Suche (v3.50).
 *
 * Vorher gab es diese Wahl nicht — und zwar nicht als Voreinstellung, sondern
 * gar nicht: die Wortlaut-Stage prüfte die GANZE Anfrage als eine einzige
 * Zeichenkette (`substringMatches`), „laser schweißen" fand also nur die
 * wörtliche Phrase; Orama wiederum lief mit seinem Default `threshold: 1`, also
 * ODER. Zwei Stellen, zwei stillschweigend verschiedene Antworten auf dieselbe
 * Frage.
 *
 * Der Schalter macht sie zu EINER: „Alle Wörter" (UND, Standard) oder
 * „Irgendein Wort" (ODER), sichtbar neben dem Suchfeld.
 *
 * Gilt bewusst nur für WORTLAUT-Treffer. Die Ähnlichkeitssuche embeddet die
 * Anfrage als Ganzes — dort gibt es keine einzelnen Wörter, die man verknüpfen
 * könnte. Beide Stages laufen nebeneinander, deshalb bleibt der Schalter auch
 * im Ähnlichkeitsmodus bedienbar; sein Tooltip sagt, worauf er wirkt.
 *
 * Persistiert (localStorage, „simple flag" im Sinne der CLAUDE.md) — anders als
 * [[useSemanticSearchMode]], das bewusst pro Sitzung neutral startet, weil es
 * ~1 GB Arbeitsspeicher kostet. Eine Verknüpfungs-Wahl kostet nichts und ist
 * eine echte Arbeitsgewohnheit.
 */
import { create } from 'zustand';

/** `und` = alle Wörter müssen vorkommen, `oder` = irgendeines genügt. */
export type SuchVerknuepfung = 'und' | 'oder';

const KEY = 'teamflow_suche_verknuepfung';

function load(): SuchVerknuepfung {
  try {
    return localStorage.getItem(KEY) === 'oder' ? 'oder' : 'und';
  } catch {
    return 'und';
  }
}

/** Orama kennt keine Booleschen Operatoren, wohl aber `threshold`:
 *  0 = nur Dokumente mit ALLEN Tokens, 1 = irgendeines genügt. */
export function verknuepfungAlsThreshold(v: SuchVerknuepfung): number {
  return v === 'und' ? 0 : 1;
}

interface SuchVerknuepfungState {
  verknuepfung: SuchVerknuepfung;
  setVerknuepfung: (v: SuchVerknuepfung) => void;
}

export const useSuchVerknuepfung = create<SuchVerknuepfungState>(set => ({
  verknuepfung: load(),
  setVerknuepfung: (verknuepfung) => {
    try { localStorage.setItem(KEY, verknuepfung); } catch { /* ignore */ }
    set({ verknuepfung });
  },
}));
