/**
 * Hybrid-Suche fuer die Antraege-Liste. Vereinigt drei Quellen:
 *
 *  1. **Substring** auf `verbund_titel` / `titel` / `projektbeschreibung_text`
 *     aus dem vollen Antrag-Store (siehe `services/search-corpus.ts`).
 *     Laeuft sync auf einer im RAM gehaltenen Map.
 *
 *  2. **Embedding-Match** gegen den Auslastungs-Korpus. Query wird via
 *     `embedText` embedded, Cosine ueber alle vorhandenen Antrags-
 *     Embeddings, Top-50 mit Score >= 0.55 als Treffer.
 *
 *  3. **DMS-Suchindex** (Orama BM25 + Vector auf Phase-2-DMS-Dokumenten).
 *     Treffer werden ueber das Phase-2-Manifest auf `matched_antrag_id`
 *     zurueckgemappt; nur Akz aus dem aktiven Programm bleiben uebrig.
 *
 *  Resultate werden zu einem Set<aktenzeichen> vereinigt und in den
 *  `AntraegeStore` geschrieben (`setHybridSearch`). `useFilteredAntraege`
 *  liest das Set und filtert die Listen-View entsprechend.
 *
 *  Der Hook wird genau einmal pro App-Mount in `AntraegePage` aufgerufen.
 *  Debounce: 300 ms zwischen Tastatur-Anschlag und Embedding/DMS-Auswertung.
 *  Substring-Treffer fliessen sofort ein, damit das Tipp-Feedback responsiv
 *  bleibt.
 */
import { useEffect, useRef } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAntraegeStore, type HybridUnavailableSource } from './store';
import {
  loadAntraegeTextCorpus,
  loadDmsFilenameToAkz,
  type AntragTextEntry,
} from './services/search-corpus';
import {
  ensureEmbeddingReady,
  embedText,
  cosineSimilarity,
} from '@/plugins/auslastung/services/embed-wrapper';
import { loadAllEmbeddings } from '@/plugins/auslastung/services/embedding-corpus';
import {
  loadManifest as loadMirrorManifest,
  loadBin as loadMirrorBin,
  parseCorpus as parseMirrorCorpus,
  applyCorpusToIdb as applyMirrorCorpus,
  checkCompat as checkMirrorCompat,
} from '@/plugins/auslastung/services/embedding-corpus-mirror';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import type { StorageService } from '@/core/services/storage';
import { hybridSearch, getOramaDB } from '@/core/services/search/orama-store';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { features } from '@/config/feature-flags';

/**
 * True wenn der aktive Build semantische Suche in der Antraege-Liste anbieten
 * darf. `volltextsuche` ist der Master-Switch der Such-Pipeline (auch ohne
 * Sidebar-Eintrag „Suche" sinnvoll — z.B. prod-User, die nur in der
 * Antraege-Suche semantisch mitsuchen wollen). `auslastung`/`dokumentenscan`/
 * `suche` impliziieren ihn ebenfalls, damit dev/pl/kurator/demo wie bisher
 * laufen ohne Config-Anpassung.
 *
 * Im schlanken prod-Build OHNE eines dieser Flags wuerde `ensureEmbeddingReady`
 * (laedt 300 MB ONNX-Modell im Main-Thread, siehe CLAUDE.md Pitfall #8) eine
 * Sekunden-Blockade ohne Mehrwert ausloesen — der Substring-Pfad bleibt aktiv.
 */
const SEMANTIC_SOURCES_ENABLED =
  features.volltextsuche === true
  || features.auslastung === true
  || features.dokumentenscan === true
  || features.suche === true;

/**
 * Schedule a callback im naechsten Idle-Window. Fallback `setTimeout(0)` in
 * Browsern ohne `requestIdleCallback` (Safari < 16.4). Wir benutzen das fuer
 * den Modell-Init, damit der Mount-Render des Antraege-Plugins nicht durch
 * den 300 MB ONNX-Load blockiert wird — der Init laeuft erst, wenn der
 * Main-Thread mind. einmal idle war.
 */
function scheduleIdle(cb: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(cb, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, 0);
  return () => window.clearTimeout(id);
}

/**
 * Modul-Singleton: stellt sicher, dass der Auto-Mirror-Bootstrap pro
 * Session genau einmal versucht wird (selbst wenn der Antraege-Hook
 * mehrfach remounted oder das Programm gewechselt wird). Eingehende
 * Folgeaufrufe warten auf das gleiche Promise — keine konkurrenten
 * IDB-Roundtrips/Share-Reads.
 */
let mirrorBootstrapPromise: Promise<void> | null = null;

/**
 * Best-Effort Auto-Download des Embedding-Korpus vom SMB-Daten-Share fuer
 * schlanke Varianten ohne Auslastungs-Plugin (prod-User).
 *
 * Pfad:
 *  1. Lokaler IDB-Cache schon befuellt? → nichts tun.
 *  2. Manifest vom Share lesen (klein, ~ einige KB). Kein Manifest? → still raus.
 *  3. Modell + Dim kompatibel mit dem lokal aktiven Modell? → sonst still raus.
 *  4. Bin laden (~42 MB im LAN, akzeptabel), parsen, in IDB schreiben.
 *
 * Fehler werden ge-warned aber nicht propagiert — der Substring-Pfad bleibt
 * funktional. Wird nur einmal pro Session versucht (Singleton-Promise).
 */
async function autoBootstrapEmbeddingMirror(storage: StorageService): Promise<void> {
  if (mirrorBootstrapPromise) return mirrorBootstrapPromise;
  mirrorBootstrapPromise = (async () => {
    try {
      const idb = storage.idb;
      // (1) Schon ein lokaler Cache vorhanden — Auto-Mirror nicht noetig.
      const existing = await loadAllEmbeddings(idb);
      if (existing.size > 0) return;
      // (2) Manifest vom Share lesen.
      const manifest = await loadMirrorManifest(storage);
      if (!manifest) return;
      // (3) Kompat-Check gegen das aktiv konfigurierte Modell.
      const modelId = await getActiveModelId(idb);
      const cfg = getModelById(modelId);
      const compat = checkMirrorCompat(manifest, cfg.id, cfg.dimensions);
      if (compat.kind !== 'compatible') {
        console.warn(
          `[useAntraegeHybridSearch] embedding mirror inkompatibel mit aktivem Modell (${compat.kind}) — kein Auto-Download.`,
        );
        return;
      }
      // (4) Bin laden + in IDB schreiben. `applyMirrorCorpus` yieldet
      // alle 100 Eintraege; bei ~13k Antraegen sind das ~130 micro-Pausen.
      const bin = await loadMirrorBin(storage, manifest.binBytes);
      if (!bin) return;
      const map = parseMirrorCorpus(manifest, bin);
      await applyMirrorCorpus(idb, map);
    } catch (err) {
      // Singleton-Fehlversuch: NICHT cachen, damit der naechste Page-Mount
      // nochmal probieren darf (z.B. wenn der User in der Zwischenzeit
      // Share-Zugriff erteilt hat).
      mirrorBootstrapPromise = null;
      throw err;
    }
  })();
  return mirrorBootstrapPromise;
}

/** Schwelle fuer Embedding-Treffer (Cosine, L2-normalisiert -> [-1, 1]).
 *  0.55 ist empirisch gut: schliesst „Künstliche Intelligenz" -> „KI" /
 *  „Machine Learning" ein, blockiert thematisch fremde Antraege. Kann
 *  spaeter ueber Build-Config tweakbar gemacht werden. */
const EMBEDDING_THRESHOLD = 0.55;
const EMBEDDING_TOP_K = 50;
/** Mindestlaenge des Queries, bevor Embedding/DMS triggern. Bei < 2 nur
 *  Substring — verhindert dass ein einzelner Buchstabe Tausende semantischer
 *  Treffer aufmacht. */
const MIN_QUERY_LEN_FOR_SEMANTIC = 2;
const DEBOUNCE_MS = 500;
/** Yield-Intervall im Cosine-Loop (in Iterationen). Bei ~13k × 768d sind das
 *  ~50–120 ms ohne Yielding; mit Yield alle 2000 bleibt die UI smooth. */
const COSINE_YIELD_INTERVAL = 2000;
/** DMS-Index-Treffer (Orama hybridSearch). Mehr als der Default-Limit, damit
 *  wir nach Filter auf aktives Programm noch genug haben. */
const DMS_HIT_LIMIT = 100;

interface ProgrammCaches {
  programmId: string;
  textCorpus: Map<string, AntragTextEntry>;
  filenameToAkz: Map<string, string>;
}

/** Pro-Programm-Caches: textCorpus + filenameToAkz werden bei Programm-Switch
 *  geladen und so lange im Modul-Scope gehalten, bis ein anderes Programm
 *  aktiv wird. Verhindert dass jeder Re-Mount des Hooks die teuren IDB-Reads
 *  wiederholt. */
let cachedProgrammCaches: ProgrammCaches | null = null;
let cachedProgrammLoadPromise: Promise<ProgrammCaches> | null = null;

/** Embedding-Map pro Session. Wird beim ersten Query-Trigger geladen und
 *  danach im RAM gehalten — `loadAllEmbeddings` macht 13k IDB-Round-trips
 *  und ist mit ~4–6 s zu teuer fuer jeden Tastatur-Anschlag. */
let cachedEmbeddings: Map<string, number[]> | null = null;
let cachedEmbeddingsLoadPromise: Promise<Map<string, number[]>> | null = null;
let cachedEmbeddingsDim: number | null = null;

async function getProgrammCaches(idb: IDBStore, programmId: string): Promise<ProgrammCaches> {
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

async function getEmbeddings(idb: IDBStore): Promise<Map<string, number[]>> {
  if (cachedEmbeddings) return cachedEmbeddings;
  if (cachedEmbeddingsLoadPromise) return cachedEmbeddingsLoadPromise;
  cachedEmbeddingsLoadPromise = (async () => {
    const map = await loadAllEmbeddings(idb);
    cachedEmbeddings = map;
    // Dimension aus dem ersten Eintrag merken — wir vergleichen sie spaeter
    // mit der Query-Vektor-Dim, um Modell-Mismatch zu erkennen.
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

/** Findet Top-K Akz aus dem Embedding-Korpus mit Cosine >= threshold.
 *  Async wegen periodischem Yielding alle 2000 Iterationen — verhindert
 *  Long-Tasks > 50 ms auch wenn der Korpus auf 30k+ Antraege waechst. */
async function topKEmbeddingMatches(
  queryVec: number[],
  embeddings: Map<string, number[]>,
  topK: number,
  threshold: number,
  signal?: AbortSignal,
): Promise<string[]> {
  const hits: Array<{ akz: string; score: number }> = [];
  let i = 0;
  for (const [akz, vec] of embeddings.entries()) {
    if (vec.length !== queryVec.length) continue;
    const s = cosineSimilarity(queryVec, vec);
    if (s >= threshold) hits.push({ akz, score: s });
    if (++i % COSINE_YIELD_INTERVAL === 0) {
      await new Promise(r => setTimeout(r, 0));
      if (signal?.aborted) return [];
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK).map(h => h.akz);
}

function substringMatches(
  query: string,
  textCorpus: Map<string, AntragTextEntry>,
): Set<string> {
  // Substring auf die drei CSV-Volltext-Felder. Der Header-Substring auf
  // titel/akronym/akz/antragsteller laeuft separat in `useFilteredAntraege`
  // (auf der AntragListItem-Slim-View). Hier nur die Erweiterungs-Felder —
  // mit vorberechneten lowercase-Strings: pro Keystroke nur eine
  // toLowerCase()-Allokation (auf dem Query), keine 39 k toLowerCase-Calls
  // auf den Korpus-Strings.
  const out = new Set<string>();
  const q = query.toLowerCase();
  for (const [akz, entry] of textCorpus.entries()) {
    if (
      entry.vbLower.includes(q)
      || entry.tvLower.includes(q)
      || entry.absLower.includes(q)
    ) {
      out.add(akz);
    }
  }
  return out;
}

interface RunOptions {
  query: string;
  idb: IDBStore;
  programmId: string;
  abortSignal: AbortSignal;
}

interface RunResult {
  matchedAkz: Set<string>;
  unavailable: HybridUnavailableSource[];
}

async function runHybridSearch(opts: RunOptions): Promise<RunResult> {
  const { query, idb, programmId, abortSignal } = opts;
  const matched = new Set<string>();
  const unavailable: HybridUnavailableSource[] = [];

  const caches = await getProgrammCaches(idb, programmId);
  if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  // ----- Quelle 1: Substring (sync) -----
  const subHits = substringMatches(query, caches.textCorpus);
  for (const akz of subHits) matched.add(akz);

  // Schlanke Builds (prod ohne Auslastung/DMS/Suche): kein Modell-Init,
  // kein Cosine-Loop. Substring-Pfad oben ist alles, was hier sinnvoll
  // ist — der Embedding-Korpus existiert nicht, der DMS-Index ist leer.
  if (!SEMANTIC_SOURCES_ENABLED) {
    return { matchedAkz: matched, unavailable };
  }

  // ----- Quelle 2 + 3: Embedding + DMS — nur wenn Query lang genug -----
  if (query.length < MIN_QUERY_LEN_FOR_SEMANTIC) {
    return { matchedAkz: matched, unavailable };
  }

  // Embedding-Service initialisieren (lazy, idempotent).
  let modelReady = false;
  try {
    await ensureEmbeddingReady(idb);
    modelReady = true;
  } catch (err) {
    console.warn('[useAntraegeHybridSearch] embedding init failed:', err);
    unavailable.push('embedding');
  }
  if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  // Query-Vektor einmal berechnen — wird sowohl fuer Embedding-Source als
  // auch fuer DMS-Source benutzt (beide nutzen das gleiche aktive Modell).
  let queryVec: number[] | null = null;
  if (modelReady) {
    try {
      queryVec = await embedText(query, 'query');
    } catch (err) {
      console.warn('[useAntraegeHybridSearch] query embed failed:', err);
    }
  }
  if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  // ----- Quelle 2: Embedding-Korpus -----
  if (queryVec && modelReady) {
    try {
      const embeddings = await getEmbeddings(idb);
      if (embeddings.size === 0) {
        if (!unavailable.includes('embedding')) unavailable.push('embedding');
      } else if (cachedEmbeddingsDim !== null && cachedEmbeddingsDim !== queryVec.length) {
        // Modell-Mismatch: Korpus wurde mit anderem Modell gebaut. Cosine
        // waere mathematisch sinnlos.
        console.warn(
          `[useAntraegeHybridSearch] embedding dim mismatch: query=${queryVec.length} corpus=${cachedEmbeddingsDim}`,
        );
        if (!unavailable.includes('embedding')) unavailable.push('embedding');
      } else {
        const embHits = await topKEmbeddingMatches(
          queryVec,
          embeddings,
          EMBEDDING_TOP_K,
          EMBEDDING_THRESHOLD,
          abortSignal,
        );
        for (const akz of embHits) matched.add(akz);
      }
    } catch (err) {
      console.warn('[useAntraegeHybridSearch] embedding search failed:', err);
      if (!unavailable.includes('embedding')) unavailable.push('embedding');
    }
  } else if (modelReady) {
    if (!unavailable.includes('embedding')) unavailable.push('embedding');
  }
  if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  // ----- Quelle 3: DMS-Index (Orama hybridSearch) -----
  if (getOramaDB() === null) {
    // Kein DMS-Index initialisiert (Phase-2 nicht gelaufen oder Index nicht
    // geladen). Stille Source — kein Banner.
    unavailable.push('dms');
  } else {
    try {
      const dmsHits = hybridSearch(query, queryVec, {
        type: 'dokument',
        limit: DMS_HIT_LIMIT,
      });
      for (const hit of dmsHits) {
        const akz = caches.filenameToAkz.get(hit.source);
        if (akz) matched.add(akz);
      }
    } catch (err) {
      console.warn('[useAntraegeHybridSearch] DMS search failed:', err);
      unavailable.push('dms');
    }
  }

  return { matchedAkz: matched, unavailable };
}

/** Cleart die internen Modul-Caches. Wird bei Programm-Switch via Effect
 *  getriggert; testbar exportiert fuer Unit-Tests. */
export function clearAntraegeSearchCaches(): void {
  cachedProgrammCaches = null;
  cachedProgrammLoadPromise = null;
  cachedEmbeddings = null;
  cachedEmbeddingsLoadPromise = null;
  cachedEmbeddingsDim = null;
}

/** Mount-once-Hook fuer `AntraegePage`. Side-Effect: schreibt
 *  `hybridSearch`-State in den `AntraegeStore`. */
export function useAntraegeHybridSearch(): void {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const search = useAntraegeStore(s => s.search);
  const setHybridSearch = useAntraegeStore(s => s.setHybridSearch);

  // Modul-Caches invalidieren wenn das Programm wechselt — die textCorpus-
  // Map ist programmspezifisch, die Embedding-Map und filenameToAkz sind
  // global, koennen aber durch neue Programme andere Akz enthalten. Wir
  // werfen alle Caches weg und laden lazy nach.
  const prevProgrammRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevProgrammRef.current !== null && prevProgrammRef.current !== activeProgrammId) {
      clearAntraegeSearchCaches();
    }
    prevProgrammRef.current = activeProgrammId;
  }, [activeProgrammId]);

  // Background-Preload in zwei Stufen:
  //
  // Stufe 1 (sofort, asynchron): `getProgrammCaches` — Cursor-Walk ueber die
  // Antraege, baut den Substring-Korpus. Cheap (~36 KB Peak-Memory, kein
  // Modell), kann ohne Schaden direkt nach Mount laufen — der erste
  // Substring-Match braucht das warme Cache.
  //
  // Stufe 2 (im naechsten Idle-Window, nur wenn semantische Suche aktiv):
  // Auto-Mirror-Download des Embedding-Korpus vom SMB-Daten-Share (best
  // effort) + `ensureEmbeddingReady` (lädt 300 MB ONNX-Modell im Main-Thread)
  // + `getEmbeddings`. Wir verschieben das via `requestIdleCallback`, damit
  // der Mount-Render des Antraege-Plugins NICHT durch den Modell-Init
  // blockiert wird ("Seite reagiert nicht" beim Oeffnen). User sieht
  // sofort die Liste; semantische Treffer kommen, sobald das Modell warm ist.
  //
  // Schlanke Varianten (prod/kurator ohne Volltextsuche/Auslastung/DMS/Suche)
  // ueberspringen Stufe 2 komplett — Substring-Pfad bleibt aktiv.
  useEffect(() => {
    if (!activeProgrammId) return;
    let cancelled = false;
    let cancelIdle: (() => void) | null = null;
    void (async () => {
      try {
        await getProgrammCaches(storage.idb, activeProgrammId);
        if (cancelled) return;
        if (!SEMANTIC_SOURCES_ENABLED) return;

        // Stufe 2: erst im Idle-Window — Mount darf nicht warten.
        cancelIdle = scheduleIdle(() => {
          if (cancelled) return;
          // Modell-Init kann parallel zum Mirror-Bootstrap laufen — beide
          // sind unabhaengig (Modell-Load vs. IDB-Schreibvorgang).
          ensureEmbeddingReady(storage.idb).catch(err => {
            console.warn('[useAntraegeHybridSearch] preload embedding model failed:', err);
          });
          // Korpus: erst Auto-Mirror-Download (best effort), DANN in den
          // RAM-Cache via `getEmbeddings`. Sequenzielle Verkettung wichtig,
          // sonst caced `getEmbeddings` die leere IDB-Map bevor der Download
          // schreibt und der User sieht bis zum naechsten Programm-Switch
          // keine semantischen Treffer.
          void (async () => {
            try {
              await autoBootstrapEmbeddingMirror(storage);
            } catch (err) {
              console.warn('[useAntraegeHybridSearch] mirror bootstrap failed:', err);
            }
            if (cancelled) return;
            getEmbeddings(storage.idb).catch(err => {
              console.warn('[useAntraegeHybridSearch] preload embeddings failed:', err);
            });
          })();
        });
      } catch (err) {
        if (cancelled) return;
        console.warn('[useAntraegeHybridSearch] preload corpus failed:', err);
      }
    })();
    return () => {
      cancelled = true;
      cancelIdle?.();
    };
  }, [activeProgrammId, storage]);

  useEffect(() => {
    const q = search.trim();
    if (!q || !activeProgrammId) {
      // Kein Query — Filter inaktiv, kein Loading, keine Banner.
      setHybridSearch({ matchedAkz: null, loading: false, unavailable: [] });
      return;
    }

    const abort = new AbortController();

    // Substring-Quelle laeuft sofort (sync) und liefert eine erste
    // Trefferliste — der User sieht waehrend Embedding-/DMS-Setup schon
    // exakte Matches. Embedding/DMS erweitern das Set spaeter via setState.
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      // Loading-Flag setzen, sobald die async Quellen anlaufen.
      setHybridSearch({ matchedAkz: null, loading: true, unavailable: [] });
      void (async () => {
        try {
          const result = await runHybridSearch({
            query: q,
            idb: storage.idb,
            programmId: activeProgrammId,
            abortSignal: abort.signal,
          });
          if (cancelled || abort.signal.aborted) return;
          setHybridSearch({
            matchedAkz: result.matchedAkz,
            loading: false,
            unavailable: result.unavailable,
          });
        } catch (err) {
          if (cancelled || abort.signal.aborted) return;
          if ((err as Error).name === 'AbortError') return;
          console.warn('[useAntraegeHybridSearch] failed:', err);
          setHybridSearch({ matchedAkz: new Set(), loading: false, unavailable: [] });
        }
      })();
    }, DEBOUNCE_MS);

    // Sofortige (synchrone) Substring-Auswertung, damit das Filter-Set in
    // weniger als 100 ms eine erste Antwort liefert — die teuren Quellen
    // schichten sich danach drauf.
    if (cachedProgrammCaches && cachedProgrammCaches.programmId === activeProgrammId) {
      const subHits = substringMatches(q, cachedProgrammCaches.textCorpus);
      setHybridSearch({ matchedAkz: subHits, loading: true, unavailable: [] });
    }

    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [search, activeProgrammId, storage, setHybridSearch]);
}
