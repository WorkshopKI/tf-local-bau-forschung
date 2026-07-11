/**
 * Assistent-Gedächtnis (Phase 2) — Konsolidierung des Ereignisprotokolls in
 * benannte Memory-Blocks. Siehe types.ts (Invarianten + Schema) und
 * docs/architecture/assistent-gedaechtnis.md.
 */
export type {
  GedaechtnisBlock,
  GedaechtnisEintrag,
  EintragStatus,
  GedaechtnisOperation,
  AddOperation,
  UpdateOperation,
  InvalidateOperation,
  NoopOperation,
  VerworfeneOperation,
  LaufErgebnis,
  LaufMeta,
} from './types';
export {
  GEDAECHTNIS_STORE,
  GEDAECHTNIS_OPTIN_KEY,
  GEDAECHTNIS_LAUF_META_KEY,
  GEDAECHTNIS_BLOECKE,
  BLOCK_LABELS,
  MAX_EINTRAEGE_PRO_BLOCK,
  MAX_TEXT_LEN,
  INVALID_RETENTION_TAGE,
  MAX_EREIGNISSE_EINGABE,
} from './types';
export { istVerdaechtig } from './guard';
export type { VerdachtsErgebnis } from './guard';
export { wendeOperationenAn } from './operationen';
export type { OperationsKontext } from './operationen';
export {
  initGedaechtnis,
  istGedaechtnisAktiv,
  setzeGedaechtnisAktiv,
  neueGedaechtnisId,
  getGedaechtnisIdb,
  ladeAlleEintraege,
  ladeAktiveEintraege,
  persistiereEintraege,
  loescheGedaechtnisEintrag,
  loescheAllesGedaechtnis,
  ladeLaufMeta,
  schreibeLaufMeta,
} from './recorder';
export { baueEingabe } from './eingabe';
export type { KonsolidierungsEingabe } from './eingabe';
export { buildKonsolidierungsPrompt } from './prompt';
export { parseOperationsliste } from './parse';
export { fuehreKonsolidierungAus } from './konsolidierung';
export type {
  KonsolidierungsDeps,
  KonsolidierungsResultat,
  KonsolidierungsStatus,
} from './konsolidierung';
export {
  MINDESTINTERVALL_MS,
  gedaechtnisVoraussetzungenErfuellt,
  konsolidierungFaellig,
  starteKonsolidierungWennFaellig,
  starteKonsolidierungManuell,
} from './trigger';
