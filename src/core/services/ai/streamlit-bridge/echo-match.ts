/**
 * Echo-Erkennung über den INHALT der gesendeten Nachricht (Stufe-2-Fallback).
 *
 * Die primäre Echo-Erkennung des Bookmarklets ist die Avatar-Heuristik
 * (`img[alt*="user"]`). Ändert die fremde AitisiGPT-UI ihr Avatar-Markup, findet
 * `selectAnswerIndex` KEIN Prompt-Echo mehr → die Antwort wird nie finalisiert →
 * Timeout trotz fertiger Antwort (Vorfall 2026-07: „Ende der Response nicht
 * erkannt"). Fallback: wir KENNEN den gesendeten Text — das Echo lässt sich über
 * einen normalisierten Prefix-Vergleich am Nachrichtentext selbst erkennen.
 *
 * Bewusst NUR als Stufe 2 (wenn die Avatar-Heuristik gar keinen User findet):
 * inhalts-primär hätte False-Positives, wenn eine Antwort mit einem wörtlichen
 * Prompt-Zitat beginnt.
 *
 * Wie `answer-selection.ts` ist die Kern-Logik im Bookmarklet
 * `bridge-snippet.source.js` **gespiegelt** (zwischen den
 * `<echo-match-core>`-Markern; `?raw`-Inlining → kein Import). Der Drift-Test
 * (`__tests__/echo-match.test.ts`) extrahiert die JS-Fassung und lässt beide
 * gegen dieselben Fixtures laufen.
 */

/**
 * Normalform für den Echo-Vergleich: NFC, lowercase, alles außer
 * `[a-z0-9äöüß]` entfernt, auf 64 Zeichen gekappt. Überlebt so
 * Markdown-Rendering (`**fett**` → „fett" im gescrapten Text),
 * Whitespace-Reflow und dekomponierte Umlaute (Pitfall #22).
 */
export function normForEcho(s: string): string {
  return String(s || '').normalize('NFC').toLowerCase().replace(/[^a-z0-9äöüß]/g, '').slice(0, 64);
}

/**
 * Ist `msgText` das Echo von `promptText`? Kurze Prompts (< 12 normalisierte
 * Zeichen, z. B. der Rechen-Selbsttest) verlangen exakte Gleichheit — sonst
 * würde „Ja" jede Nachricht matchen; längere matchen per Prefix (die 64er-Kappe
 * macht den Vergleich unabhängig von einem abgeschnittenen Ende).
 */
export function isEchoText(msgText: string, promptText: string): boolean {
  const np = normForEcho(promptText);
  if (!np) return false;
  const nm = normForEcho(msgText);
  if (np.length < 12) return nm === np;
  return nm.indexOf(np) === 0;
}
