/**
 * Der Vergleichsschlüssel für **Text-Joins gegen Fremddaten**: Status-Text ↔
 * Status-Code, Kürzel ↔ Katalog, Trigger-Parameter ↔ Kürzel.
 *
 * Warum eine zweite Normalisierung neben `normalisiereWert` (`typen.ts`):
 *
 * - `normalisiereWert` ist `trim + lowercase` und speist `wertId`. Diese IDs
 *   stehen in gespeicherten Fassungen (IDB und Share) und im
 *   `byte-identitaet`-Test. Dort NFC nachzurüsten änderte bestehende Schlüssel —
 *   eine stille Daten-Migration für einen Nutzen, den nur der Join braucht.
 * - Der Join dagegen trifft auf Fremdtext aus zwei Systemen: die CSV kommt aus
 *   dem Fachsystem, die Kataloge aus XLSX-Zuarbeiten. Ein „ü" liegt dort mal als
 *   ein Zeichen (NFC), mal als „u" + Kombinationszeichen (NFD) vor. Ohne
 *   `normalize('NFC')` scheitert „techn geprüft" gegen „techn geprüft" — zwei
 *   Zeichenketten, die auf dem Bildschirm identisch aussehen.
 *
 * Deshalb: `normKey` für Joins, `normalisiereWert` für IDs. Beide bleiben
 * deckungsgleich, solange der Text schon in NFC vorliegt — der Regelfall.
 *
 * Rein: keine IO, keine Uhr.
 */

/** NFC + trim + lowercase. Der Schlüssel jedes Text-Joins gegen Fremddaten. */
export function normKey(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

/**
 * Wie {@link normKey}, zusätzlich ohne Interpunktion und mit auf ein Leerzeichen
 * gestauchtem Weißraum. Die zweite Chance beim Status-Join: die Zuarbeit schreibt
 * „Stellungnahme zur Rücknahmeempf.", der Export „Stellungnahme zur
 * Rücknahmeempf" — derselbe Status, ein Punkt Unterschied.
 *
 * Bewusst NUR als Fallback nach dem exakten Treffer, damit zwei Statuswerte, die
 * sich echt nur in der Interpunktion unterscheiden, nicht verschmelzen.
 */
export function loseKey(s: string): string {
  return normKey(s).replace(/[.,;:!?'"„“”()\-–—/]/g, ' ').replace(/\s+/g, ' ').trim();
}
