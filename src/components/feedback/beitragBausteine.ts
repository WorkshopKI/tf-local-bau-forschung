/**
 * Textbausteine für die Schreibfelder des Verlaufs — Schnell-Kommentar am
 * `⋯`-Menü, Ergänzen-Knopf an der Karte, Verlauf im Detail-Panel und die Liste
 * „Mein Feedback" im Erfassungs-Panel. Sie sparen nicht das Denken, sondern den
 * Anfang.
 *
 * EINE Quelle für alle vier: die Bausteine standen bis v3.19 nur im Menü, bis
 * v5.2 im Board-Plugin — das Erfassungs-Panel hätte sie sonst abgeschrieben, und
 * die nächste Formulierungsrunde hätte zwei Orte zu pflegen gehabt. Sie liegen
 * hier statt in `plugins/feedback-board/`, weil `components/ → plugins/` die
 * Richtung ist, gegen die der Zyklen-Check steht; die alte Datei re-exportiert.
 */

/** [Beschriftung, eingesetzter Textanfang] */
export type Baustein = readonly [string, string];

/** Der Baustein, der dem Autor seines eigenen Tickets immer zusteht. */
const ERGAENZUNG: Baustein = ['Ergänzung', 'Ergänzung: '];

export const BAUSTEINE_DEV: readonly Baustein[] = [
  ['Umsetzung', 'Umsetzung: '],
  ['Rückfrage', 'Kurze Rückfrage, bevor ich anfange: '],
  ['Erledigt', 'Ist umgesetzt und ab dem nächsten Release verfügbar. '],
  ['Nicht möglich', 'Das lässt sich so nicht umsetzen, weil '],
];

export const BAUSTEINE_NUTZER: readonly Baustein[] = [
  ERGAENZUNG,
  ['Antwort', ''],
];

/**
 * Welche Bausteine gelten?
 *
 * `dev` entscheidet die Grundmenge (triagieren vs. mitteilen), `meins` hängt
 * „Ergänzung" davor: das Fortschreiben gehört dem **eigenen Ticket**, nicht
 * einer Rolle. Bis v5.2 hing der Baustein allein an `!dev` — wer Schreibrecht
 * hatte, konnte sein eigenes Ticket nicht als Autor ergänzen.
 *
 * Zweites Argument optional, damit Bestandsaufrufe unverändert kompilieren.
 */
export function bausteineFuer(dev: boolean, meins = false): readonly Baustein[] {
  const basis = dev ? BAUSTEINE_DEV : BAUSTEINE_NUTZER;
  if (!meins || basis.some(([label]) => label === ERGAENZUNG[0])) return basis;
  return [ERGAENZUNG, ...basis];
}
