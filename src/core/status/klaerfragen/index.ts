/**
 * Der eine Einstieg in die Klärfragen-Ableitung. Siehe `typen.ts` für die
 * Abgrenzung zum Modul „Zu klären".
 */
export type {
  Herkunft, Klaerfrage, KlaerfragenBestand, KlaerfragenEingabe, BedeutungsZeile,
} from './typen';
export { HERKUENFTE, HERKUNFT_LABEL, HERKUNFT_ADRESSAT } from './typen';
export { KURZLABEL_SPITZE } from './ableitung';
export {
  FACHLICH_BESTAETIGT, bezeichnungsAbweichungen,
  type Bestaetigung, type BezeichnungsAbweichung,
} from './fachlich-bestaetigt';
export { ladeKlaerfragenBestand } from './bestand';

import {
  abweichungsFragen, bedeutungsFragen, dsFrage, markerFrage, textFragen, wertFragen,
} from './ableitung';
import { HERKUENFTE, type Klaerfrage, type KlaerfragenEingabe } from './typen';

const RANG: ReadonlyMap<string, number> = new Map(HERKUENFTE.map((h, i) => [h, i]));

/**
 * Alle Klärfragen, sortiert nach Herkunft und darin nach Vorkommen absteigend.
 *
 * **Die Reihenfolge ist die Aussage.** Die Datei geht reihum; jede Person
 * filtert auf ihre Herkunft und arbeitet von oben ab. Alphabetisch stünde ein
 * Kürzel mit drei Vorkommen über einem mit dreitausend.
 */
export function baueKlaerfragen(e: KlaerfragenEingabe): Klaerfrage[] {
  const alle = [
    ...bedeutungsFragen(e.bestand),
    ...markerFrage(e.bestand),
    ...dsFrage(e.bestand),
    ...wertFragen(e),
    ...textFragen(e.bestand),
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
