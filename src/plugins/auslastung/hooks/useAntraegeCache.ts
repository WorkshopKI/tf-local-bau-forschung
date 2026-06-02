/**
 * Globaler Antraege-Cache fuer das Auslastungs-Modul + Einstellungen-Tab
 * "Meine Technologien".
 *
 * Architektur: Modul-globaler Zustand-Store + Hook-Wrapper, NICHT pro-Komponente
 * `useState`. So bezahlt nur der erste Konsument den IDB-Read (~1-2 s fuer
 * 5000 Antraege), alle nachfolgenden Konsumenten (z.B. Tab-Switches in den
 * Einstellungen) sehen die Daten sofort.
 *
 * Anders als der `dokument-review`-Hook nutzen wir hier den vollen
 * `Antrag`-Record (nicht das Slim-AntragListItem), weil wir die
 * Deskriptoren-Spalten (`techn_1..5`, `branche..5`, `anwendung_1..2`) und
 * den Abstract (`projektbeschreibung_text`) brauchen.
 *
 * v2.13: Aggregate (`anonymMap`, `verbuendeById`, `historische*ByAnon`,
 * `allDeskriptoren`) wandern aus den Component-useMemos in den Store. Damit
 * laufen die Single-Pass-Aggregationen ueber 5000+ Antraege genau einmal pro
 * Daten-Load — nicht pro Mount jedes Konsumenten (3 Tabs × 5 Aggregate).
 * Re-Mount nach Navigation findet die Werte ref-stable im Store, keine
 * Main-Thread-Blockade.
 *
 * Invalidierungs-Regeln:
 *  - Wechsel von `activeProgrammId` → Cache wird verworfen + neu geladen.
 *  - Externe Mutationen (CSV-Import, Antrag-Edit): Caller muss explizit
 *    `invalidateAntraegeCache()` aufrufen oder `cache.refresh()` triggern.
 *  - KuerzelMap-Append (neuer TIB): `ensureAggregates()` rechnet die Aggregate
 *    via Key-Vergleich nach.
 */
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { listAntraegeByProgramm, listVerbuendeByProgramm } from '@/core/services/csv/idb-csv';
import type { Antrag, Verbund } from '@/core/services/csv/types';
import type { StorageService } from '@/core/services/storage';
import { type AnonymMap } from '../services/anonym-map';
import { buildAnonymMapFromKuerzelMap, type KuerzelMapFile } from '../services/kuerzel-map';
import { useKuerzelMap } from './useKuerzelMap';
import {
  aggregateAntragCountByAnon,
  aggregateAstByAnon,
  aggregateMaProfilesByAnon,
  collectAllDeskriptorenMitCount,
} from '../services/profil-aggregator';
import { loadAllVerbundEmbeddings } from '../services/verbund-embedding';

interface AntraegeCache {
  antraege: Antrag[];
  /** Raw-Array aus dem Store — ref-stable ueber Re-Mount (im Gegensatz zu
   *  `verbuendeById`, das durch useMemo geht). Konsumenten, die Closure-
   *  Caches keyen, nutzen DIESE Property. */
  verbuende: Verbund[];
  /** Pro `verbund_id` das Verbund-Objekt aus dem `verbuende`-IDB-Store.
   *  Wird benoetigt fuer den korrekten Verbund-Titel + Akronym in der UI +
   *  im LLM-Klassifizierungs-Prompt (Verbund-Level-Felder werden vom
   *  CSV-Merger separat gespeichert, nicht auf dem Antrag-Objekt). */
  verbuendeById: Map<string, Verbund>;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  anonymMap: AnonymMap;
  historischeDeskriptorenByAnon: Map<string, string[]>;
  /** Pro anonId: AST-Name (lower+trim) → Anzahl bearbeiteter Antraege. Wird
   *  im MA-Match-AST-Boost ausgewertet. */
  historischeAstByAnon: Map<string, Map<string, number>>;
  /** Pro anonId: Gesamtzahl bearbeiteter historischer Antraege. Wird im
   *  Matcher genutzt, um „wenig Historie" zu erkennen (Kompetenz-Matrix-Boost). */
  historischeAntraegeCountByAnon: Map<string, number>;
  allDeskriptoren: Array<{ wert: string; count: number }>;
  refresh: () => Promise<void>;
}

// Stabile Default-Refs fuer den leeren Anfangszustand — vermeidet
// unnoetige Re-Renders durch neue Object/Map-Identitaeten bei jedem Reset.
const EMPTY_ANONYM_MAP: AnonymMap = { toAnon: new Map(), toReal: new Map() };
const EMPTY_VERBUEND_BY_ID: ReadonlyMap<string, Verbund> = new Map();
const EMPTY_DESKR_BY_ANON: ReadonlyMap<string, string[]> = new Map();
const EMPTY_AST_BY_ANON: ReadonlyMap<string, Map<string, number>> = new Map();
const EMPTY_COUNT_BY_ANON: ReadonlyMap<string, number> = new Map();
const EMPTY_DESKR_LIST: ReadonlyArray<{ wert: string; count: number }> = [];

interface CacheStoreState {
  antraege: Antrag[];
  verbuende: Verbund[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /** Programm-ID des aktuell gecachten States. null = nichts geladen. */
  cachedProgrammId: string | null;
  /** Laufende Refresh-Promise zum Dedupe paralleler Aufrufe. */
  refreshing: Promise<void> | null;
  // Aggregate (v2.13) — berechnet im refresh() oder via ensureAggregates().
  anonymMap: AnonymMap;
  verbuendeById: Map<string, Verbund>;
  historischeDeskriptorenByAnon: Map<string, string[]>;
  historischeAstByAnon: Map<string, Map<string, number>>;
  historischeAntraegeCountByAnon: Map<string, number>;
  allDeskriptoren: Array<{ wert: string; count: number }>;
  /** Key der zuletzt berechneten Aggregate. Null = noch nichts. */
  aggregatesKey: string | null;
  /** Loesst den Refresh aus; idempotent fuer dieselbe programmId. */
  refresh: (storage: StorageService, programmId: string | null) => Promise<void>;
  /** Externe Invalidierung (CSV-Re-Import, Antrag-Edit). */
  invalidate: () => void;
  /** Berechnet die Aggregate neu, wenn sich die Eingaben geaendert haben
   *  (antraege-Ref, verbuende-Ref, kuerzelMapFile-Identity). No-op sonst. */
  ensureAggregates: () => void;
}

function buildAggregatesKey(
  programmId: string | null,
  antraege: Antrag[],
  verbuende: Verbund[],
  kuerzelMapFile: KuerzelMapFile,
): string {
  // Ref-Identitaeten reichen als Cache-Key — Zustand-Stores aendern Refs nur
  // bei echten Mutationen. updatedAt der kuerzel-map als Tiebreaker fuer den
  // (seltenen) Fall, dass die Ref gleich bleibt aber der Inhalt drifted.
  return `${programmId ?? '∅'}|${antraege.length}|${verbuende.length}|${kuerzelMapFile.entries.length}|${kuerzelMapFile.updatedAt}`;
}

function computeAggregates(antraege: Antrag[], verbuende: Verbund[], kuerzelMapFile: KuerzelMapFile): {
  anonymMap: AnonymMap;
  verbuendeById: Map<string, Verbund>;
  historischeDeskriptorenByAnon: Map<string, string[]>;
  historischeAstByAnon: Map<string, Map<string, number>>;
  historischeAntraegeCountByAnon: Map<string, number>;
  allDeskriptoren: Array<{ wert: string; count: number }>;
} {
  const anonymMap = buildAnonymMapFromKuerzelMap(kuerzelMapFile);
  return {
    anonymMap,
    verbuendeById: new Map(verbuende.map(v => [v.verbund_id, v])),
    historischeDeskriptorenByAnon: aggregateMaProfilesByAnon(antraege, anonymMap),
    historischeAstByAnon: aggregateAstByAnon(antraege, anonymMap),
    historischeAntraegeCountByAnon: aggregateAntragCountByAnon(antraege, anonymMap),
    allDeskriptoren: collectAllDeskriptorenMitCount(antraege),
  };
}

const useCacheStore = create<CacheStoreState>((set, get) => ({
  antraege: [],
  verbuende: [],
  loading: false,
  loaded: false,
  error: null,
  cachedProgrammId: null,
  refreshing: null,
  anonymMap: EMPTY_ANONYM_MAP,
  verbuendeById: EMPTY_VERBUEND_BY_ID as Map<string, Verbund>,
  historischeDeskriptorenByAnon: EMPTY_DESKR_BY_ANON as Map<string, string[]>,
  historischeAstByAnon: EMPTY_AST_BY_ANON as Map<string, Map<string, number>>,
  historischeAntraegeCountByAnon: EMPTY_COUNT_BY_ANON as Map<string, number>,
  allDeskriptoren: EMPTY_DESKR_LIST as Array<{ wert: string; count: number }>,
  aggregatesKey: null,
  refresh: async (storage, programmId) => {
    const s = get();
    // Hit: gleiche programmId schon geladen → no-op.
    if (programmId === s.cachedProgrammId && s.loaded && !s.error) return;
    // Dedupe: schon ein Refresh in-flight → an dessen Promise haengen.
    if (s.refreshing) {
      await s.refreshing;
      return;
    }
    if (!programmId) {
      set({
        antraege: [],
        verbuende: [],
        loaded: true,
        error: null,
        cachedProgrammId: null,
        anonymMap: EMPTY_ANONYM_MAP,
        verbuendeById: EMPTY_VERBUEND_BY_ID as Map<string, Verbund>,
        historischeDeskriptorenByAnon: EMPTY_DESKR_BY_ANON as Map<string, string[]>,
        historischeAstByAnon: EMPTY_AST_BY_ANON as Map<string, Map<string, number>>,
        historischeAntraegeCountByAnon: EMPTY_COUNT_BY_ANON as Map<string, number>,
        allDeskriptoren: EMPTY_DESKR_LIST as Array<{ wert: string; count: number }>,
        aggregatesKey: null,
      });
      return;
    }
    const promise = (async () => {
      set({ loading: true, error: null });
      try {
        // Antraege + Verbuende parallel laden (gleiche IDB, verschiedene Stores).
        // Plus Verbund-Embeddings als Cache-Warm: das Resultat landet im
        // modul-globalen Closure-Cache von verbund-embedding.ts und ist
        // beim ersten Mount der KlassifizierungsReview synchron lesbar
        // (Hebel B). Fehler werden geschluckt — der KlassifizierungsReview-
        // useEffect macht im Worst Case einen zweiten Versuch.
        const [allAntraege, allVerbuende] = await Promise.all([
          listAntraegeByProgramm(storage.idb, programmId),
          listVerbuendeByProgramm(storage.idb, programmId),
          loadAllVerbundEmbeddings(storage.idb).catch(() => null),
        ]);
        // Aggregate sofort mitberechnen, falls die kuerzel-map schon
        // geladen ist (B1-Pfad). Sonst bleiben sie auf den Default-Refs
        // und ensureAggregates() rechnet sie nach, sobald die kuerzel-map
        // im Hook-useEffect ankommt.
        const kuerzelState = useKuerzelMap.getState();
        const kuerzelMapFile = kuerzelState.loaded
          ? kuerzelState.file
          : null;
        if (kuerzelMapFile) {
          const agg = computeAggregates(allAntraege, allVerbuende, kuerzelMapFile);
          set({
            antraege: allAntraege,
            verbuende: allVerbuende,
            loaded: true,
            loading: false,
            error: null,
            cachedProgrammId: programmId,
            refreshing: null,
            ...agg,
            aggregatesKey: buildAggregatesKey(programmId, allAntraege, allVerbuende, kuerzelMapFile),
          });
        } else {
          set({
            antraege: allAntraege,
            verbuende: allVerbuende,
            loaded: true,
            loading: false,
            error: null,
            cachedProgrammId: programmId,
            refreshing: null,
            // Aggregate vorerst auf Default — werden durch ensureAggregates()
            // im Hook-useEffect nachgerechnet, sobald die kuerzel-map da ist.
            aggregatesKey: null,
          });
        }
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : String(err),
          loading: false,
          refreshing: null,
        });
      }
    })();
    set({ refreshing: promise });
    await promise;
  },
  invalidate: () => {
    set({
      antraege: [],
      verbuende: [],
      loaded: false,
      cachedProgrammId: null,
      error: null,
      anonymMap: EMPTY_ANONYM_MAP,
      verbuendeById: EMPTY_VERBUEND_BY_ID as Map<string, Verbund>,
      historischeDeskriptorenByAnon: EMPTY_DESKR_BY_ANON as Map<string, string[]>,
      historischeAstByAnon: EMPTY_AST_BY_ANON as Map<string, Map<string, number>>,
      historischeAntraegeCountByAnon: EMPTY_COUNT_BY_ANON as Map<string, number>,
      allDeskriptoren: EMPTY_DESKR_LIST as Array<{ wert: string; count: number }>,
      aggregatesKey: null,
    });
  },
  ensureAggregates: () => {
    const s = get();
    if (!s.loaded) return;
    const kuerzelState = useKuerzelMap.getState();
    if (!kuerzelState.loaded) return;
    const kuerzelMapFile = kuerzelState.file;
    const nextKey = buildAggregatesKey(s.cachedProgrammId, s.antraege, s.verbuende, kuerzelMapFile);
    if (nextKey === s.aggregatesKey) return; // no-op
    const agg = computeAggregates(s.antraege, s.verbuende, kuerzelMapFile);
    set({ ...agg, aggregatesKey: nextKey });
  },
}));

/** Externer Trigger fuer Cache-Invalidierung (z.B. nach CSV-Import). */
export function invalidateAntraegeCache(): void {
  useCacheStore.getState().invalidate();
}

/** Externer Trigger fuer Antraege-Cache-Warmup, z.B. aus dem Auslastung-
 *  Plugin-onInit. Idempotent — nutzt den `refresh()`-Hit-Check intern. */
export async function warmupAntraegeCache(
  storage: StorageService,
  programmId: string | null,
): Promise<void> {
  await useCacheStore.getState().refresh(storage, programmId);
}

export function useAntraegeCache(): AntraegeCache {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const antraege = useCacheStore(s => s.antraege);
  const verbuende = useCacheStore(s => s.verbuende);
  const loading = useCacheStore(s => s.loading);
  const loaded = useCacheStore(s => s.loaded);
  const error = useCacheStore(s => s.error);
  const refreshAction = useCacheStore(s => s.refresh);
  const cachedProgrammId = useCacheStore(s => s.cachedProgrammId);
  // v2.13: Aggregate direkt aus dem Store, nicht mehr ueber useMemo-Kaskade
  // pro Hook-Instanz. Ref-stable ueber Re-Mounts.
  const anonymMap = useCacheStore(s => s.anonymMap);
  const verbuendeById = useCacheStore(s => s.verbuendeById);
  const historischeDeskriptorenByAnon = useCacheStore(s => s.historischeDeskriptorenByAnon);
  const historischeAstByAnon = useCacheStore(s => s.historischeAstByAnon);
  const historischeAntraegeCountByAnon = useCacheStore(s => s.historischeAntraegeCountByAnon);
  const allDeskriptoren = useCacheStore(s => s.allDeskriptoren);
  const ensureAggregates = useCacheStore(s => s.ensureAggregates);

  const kuerzelMapFile = useKuerzelMap(s => s.file);
  const kuerzelMapLoaded = useKuerzelMap(s => s.loaded);
  const loadKuerzelMap = useKuerzelMap(s => s.load);
  const syncKuerzelMap = useKuerzelMap(s => s.syncWithAntraege);

  const refresh = useCallback(async (): Promise<void> => {
    await refreshAction(storage, activeProgrammId);
  }, [refreshAction, storage, activeProgrammId]);

  // Initial-Load + Programm-Wechsel: nur loesen wenn Cache leer oder
  // programmId verschieden. Doppelaufrufe von parallelen Konsumenten werden
  // im Store deduped.
  useEffect(() => {
    if (activeProgrammId === cachedProgrammId && loaded && !error) return;
    void refresh();
  }, [refresh, activeProgrammId, cachedProgrammId, loaded, error]);

  // Lazy-load der persistenten Kuerzel-Map beim ersten Render.
  useEffect(() => {
    if (!kuerzelMapLoaded) void loadKuerzelMap(storage);
  }, [kuerzelMapLoaded, loadKuerzelMap, storage]);

  // Sync der Kuerzel-Map mit den geladenen Antraegen (Bootstrap falls leer,
  // sonst Append neuer Kuerzel). Idempotent — kein Write wenn nichts neu.
  useEffect(() => {
    if (!loaded || !kuerzelMapLoaded || antraege.length === 0) return;
    void syncKuerzelMap(storage, antraege).catch(err => {
      console.warn('[useAntraegeCache] kuerzel-map sync fehlgeschlagen:', err);
    });
  }, [loaded, kuerzelMapLoaded, antraege, storage, syncKuerzelMap]);

  // Aggregate-Trigger: rechnet nach, wenn antraege oder kuerzelMapFile sich
  // aendern. Beim Re-Mount sind beide Refs stabil → ensureAggregates checked
  // den Key und macht no-op. Nur bei echter Daten-Mutation laufen die
  // Single-Pass-Aggregationen.
  useEffect(() => {
    ensureAggregates();
  }, [ensureAggregates, antraege, verbuende, kuerzelMapFile, loaded, kuerzelMapLoaded]);

  return {
    antraege,
    verbuende,
    verbuendeById,
    loading,
    loaded,
    error,
    anonymMap,
    historischeDeskriptorenByAnon,
    historischeAstByAnon,
    historischeAntraegeCountByAnon,
    allDeskriptoren,
    refresh,
  };
}
