/**
 * Antwort-Auswahl aus dem AitisiGPT-Chat-Roster (Echo-Anker).
 *
 * Reine, DOM-freie Fassung der Auswahl-Logik aus dem Bookmarklet
 * `bridge-snippet.source.js` (`findAnswerMsg` → `selectAnswerIndex`). Das
 * Bookmarklet muss standalone bleiben (`?raw`-Inlining, kein Import), daher wird
 * die Kern-Logik hier **gespiegelt** statt geteilt. Der Drift-Test
 * (`__tests__/answer-selection.test.ts`) extrahiert die JS-Funktion zwischen den
 * `<answer-selection-core>`-Markern und lässt beide Implementierungen gegen
 * dieselben Fixtures laufen — jede Divergenz schlägt fehl.
 *
 * WARUM Anker statt Position (Bug-Klasse 10, recurring-bug-classes.md): Das
 * Antwort-Fenster ist ein fremdes DOM. „Die letzte Nachricht" bricht, weil
 * AitisiGPT NACH der Antwort eine Folge-Begrüßung anhängt; eine Zähl-Baseline
 * bricht am Render-Race. Stabil ist nur: die ERSTE Nicht-User-Nachricht NACH dem
 * Prompt-Echo (der letzten User-Nachricht). Kein Echo → `null` (nicht raten).
 * Beleg-Historie: v2.157.1 → v2.159.1 → v2.159.3 → v2.159.4.
 */

/** Ein Chat-Roster-Eintrag, reduziert auf das für die Auswahl Nötige. */
export interface RosterMsg {
  /** True, wenn es die eigene (Prompt-Echo-)Nachricht ist. Im DOM: `img[alt*="user"]`. */
  isUser: boolean;
  /** Der (Markdown-)Text der Nachricht. Für die Index-Auswahl irrelevant. */
  text: string;
}

/**
 * Index der Antwort im Roster: erste Nicht-User-Nachricht NACH der letzten
 * User-Nachricht. `-1`, wenn kein Prompt-Echo existiert oder danach keine
 * Nicht-User-Nachricht folgt. WORTGLEICH gespiegelt im Bookmarklet
 * (`selectAnswerIndex(flags)` zwischen den `<answer-selection-core>`-Markern).
 */
export function selectAnswerIndex(flags: readonly boolean[]): number {
  let lastUser = -1;
  for (let i = flags.length - 1; i >= 0; i--) {
    if (flags[i]) { lastUser = i; break; } // Index unseres Prompt-Echos
  }
  if (lastUser < 0) return -1; // Prompt-Echo nicht gefunden → nicht raten
  for (let j = lastUser + 1; j < flags.length; j++) {
    if (!flags[j]) return j; // erste Nicht-User-Nachricht danach
  }
  return -1;
}

/** Wählt die Antwort-Nachricht aus dem Roster (oder `null`). */
export function selectAnswer(roster: readonly RosterMsg[]): RosterMsg | null {
  const idx = selectAnswerIndex(roster.map(m => m.isUser));
  return idx < 0 ? null : (roster[idx] ?? null);
}
