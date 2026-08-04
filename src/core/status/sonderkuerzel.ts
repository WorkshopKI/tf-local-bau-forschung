/**
 * Kürzel, welche die **Trigger-Tabelle** führt und der **Kürzel-Katalog** nicht —
 * und was die Fachseite dazu gesagt hat.
 *
 * Gemessen am echten Bestand (2447 Trigger-Zeilen, neun Richtlinien, Stand
 * August 2026) referenzieren die Trigger 221 verschiedene Kürzel; **genau vier**
 * fehlen im Katalog. Die Fachabstimmung hat sie am 04.08.2026 benannt (V6):
 *
 * | Kürzel | Was es ist | Vorkommen im Bestand |
 * |---|---|---|
 * | `ID` | Rollenvergabe | 30 eigene Zeilen in allen neun Richtlinien, alle `TRG.VorgEintragMail` |
 * | `TTV1`, `TTV2`, `TVB1` | Testkürzel | je 2 Zeilen, nur in 78 und 138 |
 *
 * **Warum das hier steht und nicht im Katalog.** Der Kürzel-Katalog ist
 * Fremddaten (`npm run gen:status-codes`, Pitfall #43) — was die Zuarbeit nicht
 * führt, tragen wir dort nicht nach. Diese Tabelle ist deshalb keine zweite
 * Katalogfassung, sondern die Antwort auf eine Rückfrage: sie erklärt vier
 * Tokens und behauptet sonst nichts. Sie hängt an keinem Feld, trägt keine
 * Rolle und geht in keine Ableitung ein.
 *
 * **Ein fünftes bliebe unbekannt.** Der Trigger-Import meldet weiterhin jedes
 * referenzierte Kürzel ohne Katalog-Eintrag; nur diese vier zieht er ab. Genau
 * dafür ist die Meldung da — sie war es, die diese Rückfrage ausgelöst hat.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { normKey } from './normalisierung';

/**
 * Warum ein Kürzel nicht im Katalog steht.
 *
 * `test` ist die einzige Art mit einer Folge für die Anzeige — Testkürzel sind
 * kein Arbeitsvorrat und gehören nicht in die Kandidatenliste des Navigators.
 */
export type SonderArt = 'rollenvergabe' | 'test';

export interface SonderKuerzel {
  /** Schreibweise der Zuarbeit. */
  kuerzel: string;
  art: SonderArt;
  /** Kurzbezeichnung — steht dort, wo sonst das Katalog-Label stünde. */
  label: string;
  /** Einordnung samt Herkunft der Aussage; erscheint als Zusatz der Erklärung. */
  zusatz: string;
}

const TEST_LABEL = 'Testkürzel der Zuarbeit';
const TEST_ZUSATZ = 'in C16 zum Testen angelegt, kein Arbeitsschritt (Fachabstimmung V6)';

/** Die vollständige Liste — vier Einträge, keine Heuristik, kein Präfix-Muster. */
export const SONDER_KUERZEL: readonly SonderKuerzel[] = [
  {
    kuerzel: 'ID',
    art: 'rollenvergabe',
    label: 'Rollenvergabe',
    zusatz: 'Zuständigkeiten am Vorgang — kein Eintrag im Kürzel-Katalog (Fachabstimmung V6)',
  },
  { kuerzel: 'TTV1', art: 'test', label: TEST_LABEL, zusatz: TEST_ZUSATZ },
  { kuerzel: 'TTV2', art: 'test', label: TEST_LABEL, zusatz: TEST_ZUSATZ },
  { kuerzel: 'TVB1', art: 'test', label: TEST_LABEL, zusatz: TEST_ZUSATZ },
];

const INDEX: ReadonlyMap<string, SonderKuerzel> = new Map(
  SONDER_KUERZEL.map(s => [normKey(s.kuerzel), s]),
);

/** Die **einzige** Lesestelle. `null` = wirklich unbekannt, nicht bloß ungeprüft. */
export function sonderKuerzel(roh: string): SonderKuerzel | null {
  return INDEX.get(normKey(roh)) ?? null;
}

/** Kürzel aus dem Testbetrieb des Fachsystems — nie ein nächster Schritt. */
export function istTestKuerzel(roh: string): boolean {
  return sonderKuerzel(roh)?.art === 'test';
}
