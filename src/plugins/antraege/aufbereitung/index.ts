/** Barrel der Antrag-Aufbereitung (Paket 1). */
export { parseVbGliederung } from './gliederung';
export {
  parsePipeTabellen, ernteTabellen, klassifiziereTabelle,
  normalisiereAnlage5, normalisiereZeitplanText, verglichZeitplaene, parseMonatRange,
  pruefeKapazitaet, kapazitaetProMaMonat, KAPAZITAET_GRENZE_PM,
  type MaMonatsLast,
} from './tabellen';
export { resolveVb, resolveAnlage5 } from './quellen';
export {
  aufbereitungKey, baueRun, computeAufbereitung, loadAufbereitung,
  istVeraltet, toggleOffenerPunkt, befundKey, uebernehmeOffenePunkte,
  type AufbereitungContext, type QuellEingang,
} from './store';
export {
  getOrComputeBaustein, leseBausteinCache, loescheBausteinCaches, istAufbereitungBausteinFreigeschaltet,
  aspekteCacheKey, steckbriefCacheKey, vbHashFuer,
  type BausteinResult, type BausteinStatus,
} from './bausteine';
export {
  PRUEF_ASPEKTE, ASPEKT_IDS, buildAspektePrompt, parseAspektMapping,
  berechneSubstanz, sektionZuAspekte, ermittleOhneAspekt, fehlendeAlsKandidaten,
  computeAspekteBaustein,
  type PruefAspekt, type AspektMapping, type AspektSubstanz, type OffenerPunktKandidat,
} from './aspekte';
export {
  ernteRisiken, zuordneRisiken, risikoFehltKandidaten, RISIKO_MATCH_SCHWELLE,
  type RisikoZuordnung,
} from './risiken';
export {
  buildSteckbriefPrompt, parseSteckbrief, extractLastJsonObject, computeSteckbriefBaustein,
  type SteckbriefDaten, type Belegt, type Zielmarkt, type Person,
} from './steckbrief';
export {
  useAufbereitung,
  type UseAufbereitungResult, type BausteinUiState, type BausteinUiStatus,
} from './useAufbereitung';
export { AufbereitungPage } from './AufbereitungPage';
export type {
  VbSektion, ApZeile, Befund, KlassifizierteTabelle, RohTabelle, TabellenKlasse,
  QuelleRef, RunTabelle, AufbereitungRun, RisikoEintrag,
} from './types';
