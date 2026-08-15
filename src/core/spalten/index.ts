/**
 * Selbst angelegte Spalten der Fördertabelle — Barrel.
 *
 * Konzept + Begründung des Zuschnitts: [docs/architecture/eigene-spalten.md].
 */
export type {
  EigeneSpalte, EigeneSpalteArt, FeldSpalte, SammelSpalte, RegelSpalte,
  SpaltenRegel, SpaltenFarbe, SpaltenHerkunft,
} from './typen';
export {
  FREIE_SPALTE_PREFIX, spaltenId, herkunftVon, istFreieSpalte, slugVon,
} from './typen';
export { feldRefs, alleFeldRefs, hilfeAus, type LabelVon } from './ableitung';
export {
  loeseFreieFelder, istGemappt, freieFelderSignatur, type FreiesFeld,
} from './aufloesung';
export { berechneZelle, type Zellwert, type Rohwerte } from './anzeige';
export { baueFreiRoh, type FreiRoh } from './projektion';
