/**
 * Textbausteine für die beiden Kommentar-Wege (Schnell-Kommentar im `⋯`-Menü und
 * der Verlauf im Detail-Panel). Sie sparen nicht das Denken, sondern den Anfang.
 *
 * EINE Quelle für beide: die Bausteine standen bis v3.19 nur im Menü — der
 * Verlauf hätte sie sonst abgeschrieben, und die nächste Formulierungsrunde
 * hätte zwei Orte zu pflegen gehabt.
 */

/** [Beschriftung, eingesetzter Textanfang] */
export type Baustein = readonly [string, string];

export const BAUSTEINE_DEV: readonly Baustein[] = [
  ['Umsetzung', 'Umsetzung: '],
  ['Rückfrage', 'Kurze Rückfrage, bevor ich anfange: '],
  ['Erledigt', 'Ist umgesetzt und ab dem nächsten Release verfügbar. '],
  ['Nicht möglich', 'Das lässt sich so nicht umsetzen, weil '],
];

export const BAUSTEINE_NUTZER: readonly Baustein[] = [
  ['Ergänzung', 'Ergänzung: '],
  ['Antwort', ''],
];

export function bausteineFuer(dev: boolean): readonly Baustein[] {
  return dev ? BAUSTEINE_DEV : BAUSTEINE_NUTZER;
}
