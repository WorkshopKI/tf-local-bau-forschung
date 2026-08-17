/**
 * Ein Textfeld, das beim Schreiben mitwächst UND sich danach ziehen lässt.
 *
 * Reine Arithmetik, kein DOM, kein React — die beiden Rechnungen, die dabei
 * schiefgehen können, an einer Stelle und einmal getestet.
 *
 * **Warum das eine geteilte Rechnung ist.** Auto-Wachsen und Zieh-Anfasser
 * schreiben beide `style.height`; naiv nebeneinander überschreiben sie sich
 * gegenseitig, und je nach Reihenfolge springt das Feld beim nächsten
 * Tastendruck auf die Inhaltshöhe zurück. Die Auflösung ist, dass die gezogene
 * Höhe als **Mindest**höhe wirkt, nicht als feste — dann konkurrieren nur noch
 * Untergrenzen, und die größte gewinnt.
 *
 * Herkunft: `berechneKommentarHoehe`/`clampKommentarHoehe` aus dem
 * Feedback-Kommentarfeld ([feedbackUi.ts](../../components/feedback/feedbackUi.ts)),
 * das seinerseits als „Rezept aus dem Chat-Composer" entstand — der Composer
 * hatte die Fassung mit Zieh-Anfasser aber nie zurückbekommen und deckelte bis
 * v4.86 auf neun Zeilen, ohne ziehbar zu sein. Beide lesen jetzt hier.
 */

/**
 * Gemerkte Mindesthöhe (px) aus einem localStorage-Rohwert.
 *
 * Defekt/leer/NaN → `undefined` = „nichts gemerkt", die Grundhöhe gilt. Geklemmt
 * auf `[min, max]`, damit ein Alt-Eintrag aus einer anderen Fenstergröße das
 * Feld weder verschwinden noch die Fläche schlucken lässt.
 */
export function clampGemerkteHoehe(roh: string | null, min: number, max: number): number | undefined {
  if (roh === null || roh.trim() === '') return undefined;
  const px = Number(roh);
  if (!Number.isFinite(px)) return undefined;
  return Math.round(Math.max(min, Math.min(max, px)));
}

/**
 * Zielhöhe eines mitwachsenden Feldes.
 *
 * Drei Untergrenzen konkurrieren, die größte gewinnt: der geschriebene Inhalt
 * (`scrollHoehe`), die vom Nutzer gezogene Mindesthöhe (`gemerkt`) und die
 * Grundhöhe des leeren Feldes (`grundHoehe`, = `rows`). Gedeckelt bei `max` —
 * darüber scrollt das Feld intern.
 */
export function berechneAutoHoehe(
  scrollHoehe: number,
  grundHoehe: number,
  gemerkt: number | undefined,
  max: number,
): number {
  const untergrenzen = [scrollHoehe, grundHoehe, gemerkt ?? 0].filter(n => Number.isFinite(n));
  return Math.round(Math.min(max, Math.max(0, ...untergrenzen)));
}
