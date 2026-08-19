/**
 * Embedding-Korpus — Public API.
 *
 * Drei Schichten:
 *  - `storage.ts` — IDB-CRUD fuer einzelne Vektoren
 *  - `signatur.ts` — aus WELCHEM Vektorraum die Vektoren stammen
 *  - `wrapper.ts` — Modell-Init + embedText + Cosine + Centroid
 *  - `mirror.ts`  — SMB-Sync (Manifest + Bin)
 *
 * Konsumenten:
 *  - `src/plugins/auslastung/services/embedding-corpus.ts` —
 *    Antrag-spezifische Build-Pipeline + Text-Builder
 *  - `src/plugins/antraege/useAntraegeHybridSearch.ts` —
 *    Hybrid-Suche (semantische Treffer im Search-Input)
 *
 * **Backward-Compat:** IDB-Prefix `auslastung-emb:*` und SMB-Pfade
 * `_intern/auslastung-embedding-corpus.*` bleiben unveraendert — bestehende
 * User-Caches und Team-Shares funktionieren weiter.
 */
export {
  EMBEDDING_CORPUS_IDB_PREFIX,
  loadEmbedding,
  storeEmbedding,
  deleteEmbedding,
  loadAllEmbeddings,
  countEmbeddings,
  listEmbeddingKeys,
  clearEmbeddings,
} from './storage';

export {
  ensureEmbeddingReady,
  embedText,
  cosineSimilarity,
  meanCentroid,
  getCurrentEmbeddingConfig,
} from './wrapper';

export {
  CORPUS_BUILD_VERSION,
  aktuelleKorpusSignatur,
  signaturenGleich,
  signaturText,
  signaturAusManifest,
  ladeKorpusSignatur,
  merkeKorpusSignatur,
} from './signatur';
export type { KorpusSignatur } from './signatur';

export {
  CORPUS_MANIFEST_PATH,
  CORPUS_BIN_PATH,
  getCorpusBuildVersion,
  hashAktenzeichenSet,
  serializeCorpus,
  parseCorpus,
  checkCompat,
  loadManifest,
  loadBin,
  saveCorpusToShare,
  applyCorpusToIdb,
  applyCorpusStreamed,
} from './mirror';

export type { EmbeddingCorpusManifest, CompatStatus } from './mirror';
