/** Textbaustein-Katalog (NF / RNE / ABL) — Barrel-Export. */
export type {
  BausteinArtefaktTyp,
  BausteinStatus,
  KatalogRef,
  TextbausteinKatalog,
  TextbausteinRecord,
  TextbausteinSnapshot,
} from './types';
export {
  bearbeiteBaustein,
  rollbackBaustein,
  setzeBausteinStatus,
  type AenderungsKontext,
  type BausteinAenderung,
} from './versionierung';
export {
  bewerteBausteine,
  freigegebeneBausteine,
  sucheBausteine,
  zerlegeBegriffe,
  type BausteinTreffer,
  type BewertungsOptionen,
  type SuchbarerBaustein,
} from './suche';
export {
  leererKatalog,
  mergeFehlendeNfBausteine,
  nfSeedAlsRecords,
  NF_MIGRATION_TS,
  type SeedErgaenzung,
} from './migration';
export {
  cacheTextbausteinKatalog,
  loadTextbausteinKatalog,
  normalizeBaustein,
  normalizeKatalog,
  readCachedTextbausteinKatalog,
  readTextbausteinKatalog,
  writeTextbausteinKatalog,
  TEXTBAUSTEIN_CACHE_KEY,
  TEXTBAUSTEIN_PATH,
  type GeladenerKatalog,
} from './storage';
