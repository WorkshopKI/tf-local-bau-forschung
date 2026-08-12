/**
 * Verknüpfung mehrerer Stichwörter in der Suche (v3.50, dritte Option v4.5).
 *
 * Vorher gab es diese Wahl nicht — und zwar nicht als Voreinstellung, sondern
 * gar nicht: die Wortlaut-Stage prüfte die GANZE Anfrage als eine einzige
 * Zeichenkette (`substringMatches`), „laser schweißen" fand also nur die
 * wörtliche Phrase; Orama wiederum lief mit seinem Default `threshold: 1`, also
 * ODER. Zwei Stellen, zwei stillschweigend verschiedene Antworten auf dieselbe
 * Frage.
 *
 * Der Schalter macht sie zu EINER: „alle Wörter" (UND, Standard), „irgendein
 * Wort" (ODER) oder „genaue Wortfolge".
 *
 * `wortfolge` ist die WIEDERBELEBUNG des alten Verhaltens, nicht eine neue
 * Erfindung: die ganze Anfrage als ein Substring. Was bis v3.49 der einzige und
 * damit falsche Weg war, ist als ausdrücklich gewählte Option genau richtig —
 * wer „additive Fertigung" als Begriff meint, will keine Vorhaben, in denen
 * beide Wörter zufällig getrennt vorkommen.
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

/** `und` = alle Wörter müssen vorkommen, `oder` = irgendeines genügt,
 *  `wortfolge` = die Anfrage genau so, in dieser Reihenfolge. */
export type SuchVerknuepfung = 'und' | 'oder' | 'wortfolge';

const KEY = 'teamflow_suche_verknuepfung';

/** Beschriftung der Optionen — in der Sprache der Sachbearbeitung, nicht in der
 *  der Boolschen Algebra. Eine Quelle für Dropdown, Deutungszeile und Hilfe. */
export const VERKNUEPFUNG_LABEL: Record<SuchVerknuepfung, string> = {
  und: 'alle Wörter',
  oder: 'irgendein Wort',
  wortfolge: 'genaue Wortfolge',
};

/** Was zwischen zwei Wort-Chips der Deutungszeile steht. */
export const VERKNUEPFUNG_OPERATOR: Record<SuchVerknuepfung, string> = {
  und: 'UND',
  oder: 'ODER',
  wortfolge: 'gefolgt von',
};

/** Toleranter Leser: alles Unbekannte fällt auf UND zurück. */
export function parseVerknuepfung(roh: string | null): SuchVerknuepfung {
  if (roh === 'oder' || roh === 'wortfolge') return roh;
  return 'und';
}

function load(): SuchVerknuepfung {
  try {
    return parseVerknuepfung(localStorage.getItem(KEY));
  } catch {
    return 'und';
  }
}

/** Orama kennt keine Booleschen Operatoren, wohl aber `threshold`:
 *  0 = nur Dokumente mit ALLEN Tokens, 1 = irgendeines genügt.
 *
 *  Eine echte Phrasensuche hat Orama nicht. `wortfolge` verlangt deshalb
 *  ebenfalls alle Tokens (0) — die Reihenfolge prüft erst der Wortlaut-Pfad
 *  über den Antragstext. Für Dokumenttreffer heißt „genaue Wortfolge" damit
 *  ehrlicherweise „alle Wörter"; strenger wäre nur eine Nachprüfung am
 *  Chunk-Text, und die täuschte Genauigkeit vor, die der Index nicht hergibt. */
export function verknuepfungAlsThreshold(v: SuchVerknuepfung): number {
  return v === 'oder' ? 1 : 0;
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
