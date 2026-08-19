/**
 * Der eine Einstieg in die Klärfragen-Ableitung. Siehe `typen.ts` für die
 * Abgrenzung zum Modul „Zu klären".
 */
export type {
  Herkunft, Klaerfrage, KlaerfragenBestand, KlaerfragenEingabe, BedeutungsZeile,
} from './typen';
export {
  HERKUENFTE, HERKUNFT_LABEL, HERKUNFT_ADRESSAT, STILLGELEGTE_HERKUENFTE,
} from './typen';
export { KURZLABEL_SPITZE, vorkommenFuerWortlaut } from './ableitung';
export {
  FACHLICH_BESTAETIGT, bezeichnungsAbweichungen,
  type Bestaetigung, type BezeichnungsAbweichung,
} from './fachlich-bestaetigt';
export {
  ktPaare, ktVerstoesse, ktFragen,
  type KtPaar, type KtVerstoss, type KtSeite,
} from './kt-konvention';
export { ladeKlaerfragenBestand } from './bestand';

import {
  abweichungsFragen, bedeutungsFragen, dsFrage, wertFragen,
} from './ableitung';
import { ktFragen } from './kt-konvention';
import { HERKUENFTE, type Klaerfrage, type KlaerfragenEingabe } from './typen';

const RANG: ReadonlyMap<string, number> = new Map(HERKUENFTE.map((h, i) => [h, i]));

/**
 * Alle Klärfragen, sortiert nach Herkunft und darin nach Vorkommen absteigend.
 *
 * **Die Reihenfolge ist die Aussage.** Die Datei geht reihum; jede Person
 * filtert auf ihre Herkunft und arbeitet von oben ab. Alphabetisch stünde ein
 * Kürzel mit drei Vorkommen über einem mit dreitausend.
 */
export function baueKlaerfragen(
  e: KlaerfragenEingabe,
  /** Wie viele Kurzlabel-Zeilen die Liste führt — Parameter der Prüfbarkeit wegen. */
  spitze?: number,
): Klaerfrage[] {
  // Ruhende Kürzel stellen keine Frage: über sie lässt sich am Bestand nichts
  // belegen. Die WERT-Herkünfte bleiben unberührt — sie hängen an Rohstatus-
  // Werten, nicht an Kürzeln, und die stehen unabhängig davon in den Daten.
  const ruhend = e.ruhendeCodes ?? new Set<string>();
  const alle = [
    ...bedeutungsFragen(e.bestand, e.offeneBedeutungen, ruhend),
    ...dsFrage(e.bestand),
    ...ktFragen(undefined, ruhend),
    ...wertFragen(e, spitze),
    ...abweichungsFragen(e.bestand),
  ];
  return alle.sort((a, b) =>
    (RANG.get(a.herkunft) ?? 0) - (RANG.get(b.herkunft) ?? 0)
    || (b.vorkommen ?? -1) - (a.vorkommen ?? -1)
    || a.betrifft.localeCompare(b.betrifft, 'de'));
}

/** Wie viele Fragen je Herkunft — der Zähler über der Liste. */
export function zaehleJeHerkunft(fragen: readonly Klaerfrage[]): Map<string, number> {
  const z = new Map<string, number>();
  for (const f of fragen) z.set(f.herkunft, (z.get(f.herkunft) ?? 0) + 1);
  return z;
}

/** Was ein Lauf **nicht** fragt — in Fragen gerechnet, nicht in Kürzeln. */
export interface Auslassungen {
  /** Fragen, die wegen eines ruhenden Kürzels entfallen sind. */
  ruhende: number;
  /** Kurzlabel-Zeilen jenseits der {@link KURZLABEL_SPITZE}. */
  kurzlabelRest: number;
}

/**
 * Wie viel eine Erhebung verschweigt — **gemessen**, nicht geschätzt.
 *
 * Zwei Auslassungen sind eingebaut, und beide standen bis v4.120 falsch bzw.
 * gar nicht auf dem Bildschirm:
 *
 * - **Ruhende Kürzel.** Die Zeile nannte die Zahl der ruhenden KÜRZEL („243
 *   ruhende Kürzel ausgelassen") über einer Liste mit **einer** Frage. Sie las
 *   sich, als fehlten 243 Einträge; unterdrückt waren in Wahrheit null. Gezählt
 *   wird deshalb die Differenz der FRAGEN — derselbe Lauf einmal mit und einmal
 *   ohne Ruhe-Filter.
 * - **Die Kurzlabel-Spitze.** `wertFragen` führt nur die häufigsten
 *   {@link KURZLABEL_SPITZE}; der Rest verschwand ohne ein Wort. In einer Datei,
 *   die wochenlang unterwegs ist, liest sich das als vollständige Liste.
 *
 * Rein: dieselben Ableitungen, nur zweimal aufgerufen. Der teure Teil ist der
 * Bestandslauf davor, nicht das Rechnen hier.
 */
export function klaerfragenAuslassungen(
  e: KlaerfragenEingabe, spitze?: number,
): Auslassungen {
  const jetzt = baueKlaerfragen(e, spitze);
  const ohneRuhe = baueKlaerfragen({ ...e, ruhendeCodes: undefined }, spitze);
  const alleKurz = wertFragen(e, Number.POSITIVE_INFINITY)
    .filter(f => f.herkunft === 'kurzlabel').length;
  const gezeigteKurz = jetzt.filter(f => f.herkunft === 'kurzlabel').length;
  return {
    ruhende: ohneRuhe.length - jetzt.length,
    kurzlabelRest: alleKurz - gezeigteKurz,
  };
}
