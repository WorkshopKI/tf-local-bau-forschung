/**
 * Antraege-Hybrid-Suche als reine Service-Funktion.
 *
 * Vereinigt drei Treffer-Quellen zu einer score-tragenden Liste:
 *  1. **Substring** auf VB-/TV-/Abstract-/Deskriptor-Volltext
 *     (synchron, Score = 1.0, method = 'fulltext')
 *  2. **Embedding-Cosine** gegen den Auslastungs-Korpus (768d)
 *     (asynchron, Score = cosine, adaptive Schwelle Floor 0.35 + 90% der
 *     besten Cosine — siehe EMBEDDING_SCORE_FLOOR, method = 'vector')
 *  3. **DMS-Index-Treffer** via Orama-`hybridSearch` mit `filenameToAkz`-Mapping
 *     (asynchron, Score = orama-Score 0..1, method = 'hybrid')
 *
 * Dedup-Strategie bei mehreren Quellen pro Aktenzeichen: **max-score**, method
 * der jeweils besten Quelle.
 *
 * Programm-scoped: der Substring-Korpus wird pro `programmId` gecached, die
 * Embedding-Map ist global aber kompatibel zur Dimension des aktiven Modells.
 *
 * Zwei Konsumenten:
 *  - {@link useAntraegeHybridSearch} (Antraege-Plugin) — mapped `hits` auf das
 *    `matchedAkz`-Set und schreibt es in den `AntraegeStore`.
 *  - {@link useUnifiedSearch} (Suchseite) — mapped `hits` auf
 *    `UnifiedSearchResult` mit voll angereicherten Antrags-Feldern.
 */
import {
  ensureEmbeddingReady,
  embedText,
  cosineSimilarity,
  loadAllEmbeddings,
  loadManifest as loadMirrorManifest,
  loadBin as loadMirrorBin,
  parseCorpus as parseMirrorCorpus,
  applyCorpusToIdb as applyMirrorCorpus,
  checkCompat as checkMirrorCompat,
} from '@/core/services/embedding-corpus';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import { hybridSearch, getOramaDB } from '@/core/services/search/orama-store';
import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { useSemanticSearchMode } from '@/core/hooks/useSemanticSearchMode';
import { verknuepfungAlsThreshold, type SuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import {
  loadAntraegeTextCorpus,
  loadDmsFilenameToAkz,
  type AntragTextEntry,
} from './search-corpus';
import type { HybridUnavailableSource } from '../store';

/**
 * Substring/Embedding/DMS-Pipeline darf laufen.
 *
 * v3.0: Die Oder-Kette ist entfallen — `suche` war in JEDER Variante an und hat
 * die anderen Glieder damit seit jeher ueberstimmt. Die Konstante bleibt als
 * benannter Anker stehen, weil das Laufzeit-Gate darunter auf sie verweist.
 *
 * Bewusst KEIN Bezug zur Modul-Freischaltung: das hier ist eine modul-globale
 * Konstante, sie wuerde sich sonst mitten in der Sitzung aendern.
 */
const SEMANTIC_SOURCES_ENABLED = true;

/**
 * Laufzeit-Gate der semantischen Quellen (v2.62): Build-Flag UND Session-Opt-in.
 * Die Ähnlichkeitssuche ist opt-in — Standard „Ohne", der User schaltet sie
 * über das Dropdown neben dem Suchfeld ein. Erst dann dürfen Modell-Init,
 * Embedding-Map und Vector-/DMS-Stages laufen. Alle Konsumenten (searchAntraege,
 * useUnifiedSearch, Preload-Hooks) routen durch diesen Helper.
 */
export function isSemanticSearchActive(): boolean {
  return SEMANTIC_SOURCES_ENABLED && useSemanticSearchMode.getState().enabled;
}

/**
 * Adaptive Schwelle fuer Embedding-Treffer (v2.62.4).
 *
 * Die fruehere starre 0.55-Schwelle stammte aus einer Validierung auf dem
 * v1-Korpus (nur Titel/Abstract). Auf dem v2-Korpus (lange Texte inkl.
 * Deskriptoren) staucht sich die Cosine-Skala fuer kurze Queries: Messung
 * pl-Echtdaten, Query „Bilderkennung" (eindeutig relevante Treffer im
 * Korpus) → beste Cosine 0.437 → 0 Treffer ueber 0.55, Aehnlichkeitssuche
 * wirkte tot. Daher relativ zur besten Cosine des Laufs schneiden:
 *  - `FLOOR` = absolute Untergrenze (Garbage-Schutz: liegt selbst die beste
 *    Cosine darunter, ist die Query semantisch nicht im Korpus → 0 Treffer).
 *  - `RELATIVE_CUTOFF` = behalte Treffer ≥ 90% der besten Cosine — adaptiert
 *    sich an die Query-Laenge (kurze Query: Band z.B. 0.39–0.44; lange
 *    Query: Band z.B. 0.63–0.70). `TOP_K` deckelt die Menge zusaetzlich.
 */
const EMBEDDING_SCORE_FLOOR = 0.35;
const EMBEDDING_RELATIVE_CUTOFF = 0.9;
const EMBEDDING_TOP_K = 50;
const MIN_QUERY_LEN_FOR_SEMANTIC = 2;
const COSINE_YIELD_INTERVAL = 2000;
const DMS_HIT_LIMIT = 100;

export type SearchMethod = 'fulltext' | 'vector' | 'hybrid';

export interface AntragSearchHit {
  aktenzeichen: string;
  /** 0..1 normalisiert. Substring=1.0, Embedding=cosine, DMS=orama-Score. */
  score: number;
  method: SearchMethod;
}

export interface AntraegeSearchResult {
  hits: AntragSearchHit[];
  unavailable: HybridUnavailableSource[];
}

export interface SearchAntraegeOptions {
  query: string;
  idb: IDBStore;
  programmId: string;
  abortSignal: AbortSignal;
}

interface ProgrammCaches {
  programmId: string;
  textCorpus: Map<string, AntragTextEntry>;
  filenameToAkz: Map<string, string>;
}

// ----- Modul-Caches -----------------------------------------------------------

let cachedProgrammCaches: ProgrammCaches | null = null;
let cachedProgrammLoadPromise: Promise<ProgrammCaches> | null = null;

let cachedEmbeddings: Map<string, number[]> | null = null;
let cachedEmbeddingsLoadPromise: Promise<Map<string, number[]>> | null = null;
let cachedEmbeddingsDim: number | null = null;

let mirrorBootstrapPromise: Promise<void> | null = null;

export type MirrorBootstrapStatus =
  | 'idle' | 'no-action-needed' | 'downloading' | 'applying'
  | 'done' | 'incompatible' | 'error';

export async function getProgrammCaches(
  idb: IDBStore,
  programmId: string,
): Promise<ProgrammCaches> {
  if (cachedProgrammCaches && cachedProgrammCaches.programmId === programmId) {
    return cachedProgrammCaches;
  }
  if (cachedProgrammLoadPromise) return cachedProgrammLoadPromise;
  cachedProgrammLoadPromise = (async () => {
    const [textCorpus, filenameToAkz] = await Promise.all([
      loadAntraegeTextCorpus(idb, programmId),
      loadDmsFilenameToAkz(idb),
    ]);
    const result = { programmId, textCorpus, filenameToAkz };
    cachedProgrammCaches = result;
    return result;
  })();
  try {
    return await cachedProgrammLoadPromise;
  } finally {
    cachedProgrammLoadPromise = null;
  }
}

export async function getEmbeddings(idb: IDBStore): Promise<Map<string, number[]>> {
  if (cachedEmbeddings) return cachedEmbeddings;
  if (cachedEmbeddingsLoadPromise) return cachedEmbeddingsLoadPromise;
  cachedEmbeddingsLoadPromise = (async () => {
    const map = await loadAllEmbeddings(idb);
    cachedEmbeddings = map;
    const first = map.values().next().value;
    cachedEmbeddingsDim = Array.isArray(first) ? first.length : null;
    return map;
  })();
  try {
    return await cachedEmbeddingsLoadPromise;
  } finally {
    cachedEmbeddingsLoadPromise = null;
  }
}

/** Cleart die Modul-Caches. Wird beim Programm-Switch via Hook getriggert. */
export function clearAntraegeSearchCaches(): void {
  cachedProgrammCaches = null;
  cachedProgrammLoadPromise = null;
  cachedEmbeddings = null;
  cachedEmbeddingsLoadPromise = null;
  cachedEmbeddingsDim = null;
}

/** Embedding-Cache invalidieren — z.B. nach einem Mirror-Bootstrap der
 *  frische Vektoren in die IDB geschrieben hat. */
export function invalidateEmbeddingsCache(): void {
  cachedEmbeddings = null;
  cachedEmbeddingsLoadPromise = null;
  cachedEmbeddingsDim = null;
}

// ----- Mirror-Bootstrap (Best-Effort Download vom SMB-Share) -----------------

/**
 * Best-Effort Auto-Download des Embedding-Korpus vom SMB-Daten-Share fuer
 * schlanke Varianten ohne Auslastungs-Plugin. Wird nur einmal pro Session
 * versucht (Singleton-Promise). Fehler werden ge-warned, nicht propagiert.
 */
export async function autoBootstrapEmbeddingMirror(
  storage: StorageService,
  onStatus?: (status: MirrorBootstrapStatus) => void,
): Promise<void> {
  if (mirrorBootstrapPromise) return mirrorBootstrapPromise;
  mirrorBootstrapPromise = (async () => {
    try {
      const idb = storage.idb;
      const existing = await loadAllEmbeddings(idb);
      if (existing.size > 0) { onStatus?.('no-action-needed'); return; }
      const manifest = await loadMirrorManifest(storage);
      if (!manifest) { onStatus?.('no-action-needed'); return; }
      const modelId = await getActiveModelId(idb);
      const cfg = getModelById(modelId);
      const compat = checkMirrorCompat(manifest, cfg.id, cfg.dimensions);
      if (compat.kind !== 'compatible') {
        console.warn(
          `[antraege-search-service] embedding mirror inkompatibel mit aktivem Modell (${compat.kind}) — kein Auto-Download.`,
        );
        onStatus?.('incompatible');
        return;
      }
      onStatus?.('downloading');
      const bin = await loadMirrorBin(storage, manifest.binBytes);
      if (!bin) { onStatus?.('error'); return; }
      const map = parseMirrorCorpus(manifest, bin);
      onStatus?.('applying');
      await applyMirrorCorpus(idb, map);
      onStatus?.('done');
    } catch (err) {
      mirrorBootstrapPromise = null;
      onStatus?.('error');
      throw err;
    }
  })();
  return mirrorBootstrapPromise;
}

// ----- Helpers ---------------------------------------------------------------

/**
 * Anfrage in Wörter zerlegen (klein geschrieben, Leerraum-getrennt). Rein und
 * exportiert, damit die Verknüpfungs-Logik ohne Korpus testbar bleibt.
 *
 * Bewusst KEINE Faltung (`falte()`): die Korpus-Felder sind nur `toLowerCase()`
 * (siehe `search-corpus.ts`), eine gefaltete Anfrage würde dort auf ungefalteten
 * Text treffen und Umlaut-Wörter schlechter finden als heute.
 */
export function zerlegeAnfrage(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
}

/**
 * Wortlaut-Treffer über den Antrags-Textkorpus.
 *
 * Bis v3.49 wurde die GANZE Anfrage als eine Zeichenkette gesucht — „laser
 * schweißen" fand nur die wörtliche Phrase, nie ein Vorhaben, in dem beide
 * Wörter getrennt stehen. Jetzt zählt jedes Wort für sich: `und` verlangt alle,
 * `oder` genügt eines. Ein Ein-Wort-Anfrage verhält sich in beiden Modi wie
 * bisher.
 *
 * `verknuepfung` ist ein EXPLIZITER Parameter, kein Griff in den Store: der
 * Aufrufer entscheidet, ob die Wahl des Nutzers auf seiner Seite gilt (die
 * Suchseite reicht sie durch, die Förderanträge-Liste bleibt beim Standard).
 */
function substringMatches(
  query: string,
  textCorpus: Map<string, AntragTextEntry>,
  verknuepfung: SuchVerknuepfung = 'und',
): Set<string> {
  const out = new Set<string>();
  const woerter = zerlegeAnfrage(query);
  if (woerter.length === 0) return out;
  for (const [akz, entry] of textCorpus.entries()) {
    const trifft = (w: string): boolean =>
      entry.vbLower.includes(w)
      || entry.tvLower.includes(w)
      || entry.absLower.includes(w)
      || entry.descriptorsLower.includes(w)
      || entry.akronymLower.includes(w)
      || entry.akzLower.includes(w);
    if (verknuepfung === 'oder' ? woerter.some(trifft) : woerter.every(trifft)) {
      out.add(akz);
    }
  }
  return out;
}

/** Effektiver Score-Cutoff fuer einen Lauf: nie unter dem absoluten Floor,
 *  sonst relativ zur besten Cosine (adaptive Schwelle, s.o.). Pure — testbar. */
export function computeEmbeddingCutoff(bestScore: number): number {
  return Math.max(EMBEDDING_SCORE_FLOOR, bestScore * EMBEDDING_RELATIVE_CUTOFF);
}

async function topKEmbeddingMatches(
  queryVec: number[],
  embeddings: Map<string, number[]>,
  topK: number,
  signal?: AbortSignal,
): Promise<Array<{ akz: string; score: number }>> {
  // Pass 1: Kandidaten ≥ Floor sammeln + beste Cosine tracken (der relative
  // Cutoff ist erst NACH dem Scan bekannt). Kandidaten-Menge bleibt klein
  // (nur ≥ Floor), kein zweiter Cosine-Pass noetig.
  const candidates: Array<{ akz: string; score: number }> = [];
  let i = 0;
  // Diagnose (v2.62.3): beste Cosine + Dim-Skips mitzählen — bei 0 Treffern
  // unterscheidet das Schwelle-zu-streng / Vektorraum-inkompatibel /
  // Dim-Mismatch. Unter file:// ist die Console die einzige Spur.
  let best = -Infinity;
  let bestAkz = '';
  let skippedDim = 0;
  for (const [akz, vec] of embeddings.entries()) {
    if (vec.length !== queryVec.length) { skippedDim++; continue; }
    const s = cosineSimilarity(queryVec, vec);
    if (s > best) { best = s; bestAkz = akz; }
    if (s >= EMBEDDING_SCORE_FLOOR) candidates.push({ akz, score: s });
    if (++i % COSINE_YIELD_INTERVAL === 0) {
      await new Promise(r => setTimeout(r, 0));
      if (signal?.aborted) return [];
    }
  }
  const cutoff = computeEmbeddingCutoff(best);
  const hits = candidates.filter(c => c.score >= cutoff);
  if (hits.length === 0) {
    console.info(
      `[antraege-search] Vector: 0 Treffer (Floor ${EMBEDDING_SCORE_FLOOR}) — beste Cosine ${Number.isFinite(best) ? best.toFixed(3) : 'n/a'}`
      + (bestAkz ? ` (${bestAkz})` : '')
      + (skippedDim > 0 ? `; ${skippedDim} Vektoren mit fremder Dimension übersprungen` : ''),
    );
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}

/** Dedup-Strategie: max-score gewinnt, method-Tag wandert mit. */
function mergeHit(
  acc: Map<string, AntragSearchHit>,
  hit: AntragSearchHit,
): void {
  const prev = acc.get(hit.aktenzeichen);
  if (!prev || hit.score > prev.score) acc.set(hit.aktenzeichen, hit);
}

// ----- Public API ------------------------------------------------------------

/**
 * Fuehrt die Antrags-Hybrid-Suche aus und liefert dedupliziert/sortierte
 * Treffer mit Scores. Pure Funktion ohne Side-Effects auf Stores.
 *
 * Bei Abbruch via `abortSignal` wirft die Funktion `DOMException('Aborted')`.
 */
export async function searchAntraege(
  opts: SearchAntraegeOptions,
): Promise<AntraegeSearchResult> {
  const { query, idb, programmId, abortSignal } = opts;
  const merged = new Map<string, AntragSearchHit>();
  const unavailable: HybridUnavailableSource[] = [];

  const caches = await getProgrammCaches(idb, programmId);
  if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  // Quelle 1: Substring (sync)
  for (const akz of substringMatches(query, caches.textCorpus)) {
    mergeHit(merged, { aktenzeichen: akz, score: 1.0, method: 'fulltext' });
  }

  // Ohne Opt-in enden wir nach der Substring-Quelle — bewusst auch ohne
  // `unavailable`-Eintrag (kein irreführender „Embedding fehlt"-Hinweis,
  // der User hat die Ähnlichkeitssuche schlicht nicht eingeschaltet).
  if (!isSemanticSearchActive()) {
    return { hits: sortByScore(merged), unavailable };
  }
  if (query.length < MIN_QUERY_LEN_FOR_SEMANTIC) {
    return { hits: sortByScore(merged), unavailable };
  }

  // Embedding-Service initialisieren (lazy, idempotent).
  let modelReady = false;
  try {
    await ensureEmbeddingReady(idb);
    modelReady = true;
  } catch (err) {
    console.warn('[antraege-search-service] embedding init failed:', err);
    unavailable.push('embedding');
  }
  if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  let queryVec: number[] | null = null;
  if (modelReady) {
    try {
      queryVec = await embedText(query, 'query');
    } catch (err) {
      console.warn('[antraege-search-service] query embed failed:', err);
    }
  }
  if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  // Quelle 2: Embedding-Korpus
  if (queryVec && modelReady) {
    try {
      const embeddings = await getEmbeddings(idb);
      if (embeddings.size === 0) {
        if (!unavailable.includes('embedding')) unavailable.push('embedding');
      } else if (cachedEmbeddingsDim !== null && cachedEmbeddingsDim !== queryVec.length) {
        console.warn(
          `[antraege-search-service] embedding dim mismatch: query=${queryVec.length} corpus=${cachedEmbeddingsDim}`,
        );
        if (!unavailable.includes('embedding')) unavailable.push('embedding');
      } else {
        const embHits = await topKEmbeddingMatches(
          queryVec, embeddings, EMBEDDING_TOP_K, abortSignal,
        );
        for (const h of embHits) {
          mergeHit(merged, { aktenzeichen: h.akz, score: h.score, method: 'vector' });
        }
      }
    } catch (err) {
      console.warn('[antraege-search-service] embedding search failed:', err);
      if (!unavailable.includes('embedding')) unavailable.push('embedding');
    }
  } else if (modelReady) {
    if (!unavailable.includes('embedding')) unavailable.push('embedding');
  }
  if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  // Quelle 3: DMS-Index (Orama hybridSearch)
  if (getOramaDB() === null) {
    unavailable.push('dms');
  } else {
    try {
      const dmsHits = hybridSearch(query, queryVec, {
        type: 'dokument',
        limit: DMS_HIT_LIMIT,
      });
      for (const hit of dmsHits) {
        const akz = caches.filenameToAkz.get(hit.source);
        if (akz) {
          mergeHit(merged, { aktenzeichen: akz, score: hit.score, method: 'hybrid' });
        }
      }
    } catch (err) {
      console.warn('[antraege-search-service] DMS search failed:', err);
      unavailable.push('dms');
    }
  }

  return { hits: sortByScore(merged), unavailable };
}

function sortByScore(merged: Map<string, AntragSearchHit>): AntragSearchHit[] {
  return Array.from(merged.values()).sort((a, b) => b.score - a.score);
}

/** Test-only: liest die aktuell gecachte Embedding-Dimension. `null` wenn
 *  noch nichts geladen ist. */
export function _getCachedEmbeddingsDim(): number | null {
  return cachedEmbeddingsDim;
}

// ----- Streaming-API (Stage-by-Stage) ----------------------------------------
//
// Die drei Funktionen unten geben dem Caller eine progressive Pipeline:
// Substring-Hits sind sofort verfuegbar (sync, <20 ms bei warmem Korpus);
// Vector- und DMS-Hits kommen async hinterher. `useUnifiedSearch` orchestriert
// das in drei Render-Stages, damit der User schon Treffer sieht waehrend
// Embedding + Orama noch laufen.
//
// Die bestehende `searchAntraege` bleibt unveraendert (sie ist aequivalent zu
// Substring + Vector + DMS in einem Aufruf) und wird weiter von
// `useAntraegeHybridSearch` genutzt.

/** Stage 1: Substring-Match (sync). Akz-Liste von Antraegen deren Volltext die
 *  Anfrage-Wörter enthaelt (Verknüpfung siehe `substringMatches`).
 *  Score = 1.0, method = 'fulltext'. */
export function searchAntraegeSubstring(
  query: string,
  textCorpus: Map<string, AntragTextEntry>,
  verknuepfung: SuchVerknuepfung = 'und',
): string[] {
  return Array.from(substringMatches(query, textCorpus, verknuepfung));
}

/** Stage 2: Embedding-Cosine-Match (async, mit Yield-Loop). Braucht einen
 *  bereits berechneten queryVec; ruft `topKEmbeddingMatches` intern auf. */
export async function searchAntraegeVector(
  queryVec: number[],
  embeddings: Map<string, number[]>,
  signal: AbortSignal,
): Promise<Array<{ akz: string; score: number }>> {
  if (embeddings.size === 0) return [];
  if (cachedEmbeddingsDim !== null && cachedEmbeddingsDim !== queryVec.length) {
    console.warn(
      `[antraege-search-service] embedding dim mismatch: query=${queryVec.length} corpus=${cachedEmbeddingsDim}`,
    );
    return [];
  }
  return topKEmbeddingMatches(queryVec, embeddings, EMBEDDING_TOP_K, signal);
}

/** Stage 3 (Antraege-Anteil): DMS-Index-Match → Antrag-Hits via filenameToAkz.
 *  Sync (Orama selbst ist sync). Liefert leere Liste wenn Index nicht da ist. */
export function searchAntraegeDms(
  query: string,
  queryVec: number[] | null,
  filenameToAkz: Map<string, string>,
  verknuepfung: SuchVerknuepfung = 'und',
): Array<{ akz: string; score: number }> {
  if (getOramaDB() === null) return [];
  try {
    const dmsHits = hybridSearch(query, queryVec, {
      type: 'dokument',
      limit: DMS_HIT_LIMIT,
      threshold: verknuepfungAlsThreshold(verknuepfung),
    });
    const out: Array<{ akz: string; score: number }> = [];
    for (const hit of dmsHits) {
      const akz = filenameToAkz.get(hit.source);
      if (akz) out.push({ akz, score: hit.score });
    }
    return out;
  } catch (err) {
    console.warn('[antraege-search-service] DMS search failed:', err);
    return [];
  }
}

/** Re-export der Streaming-Konstanten, damit Caller (z.B. useUnifiedSearch)
 *  konsistente Schwellen verwenden. Das frühere statische
 *  `SEMANTIC_SOURCES_ENABLED` ist hier raus — Caller nutzen das Laufzeit-Gate
 *  `isSemanticSearchActive()` (Build-Flag + Session-Opt-in, v2.62). */
export const STREAMING_CONSTS = {
  MIN_QUERY_LEN_FOR_SEMANTIC,
} as const;
