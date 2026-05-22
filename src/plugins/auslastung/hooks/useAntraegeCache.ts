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
 * Invalidierungs-Regeln:
 *  - Wechsel von `activeProgrammId` → Cache wird verworfen + neu geladen.
 *  - Externe Mutationen (CSV-Import, Antrag-Edit): Caller muss explizit
 *    `invalidateAntraegeCache()` aufrufen oder `cache.refresh()` triggern.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { listAntraegeByProgramm } from '@/core/services/csv/idb-csv';
import type { Antrag } from '@/core/services/csv/types';
import type { StorageService } from '@/core/services/storage';
import { type AnonymMap } from '../services/anonym-map';
import { buildAnonymMapFromKuerzelMap } from '../services/kuerzel-map';
import { useKuerzelMap } from './useKuerzelMap';
import { aggregateAstByAnon, aggregateMaProfilesByAnon, collectAllDeskriptorenMitCount } from '../services/profil-aggregator';

interface AntraegeCache {
  antraege: Antrag[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  anonymMap: AnonymMap;
  historischeDeskriptorenByAnon: Map<string, string[]>;
  /** Pro anonId: AST-Name (lower+trim) → Anzahl bearbeiteter Antraege. Wird
   *  im MA-Match-AST-Boost ausgewertet. */
  historischeAstByAnon: Map<string, Map<string, number>>;
  allDeskriptoren: Array<{ wert: string; count: number }>;
  refresh: () => Promise<void>;
}

interface CacheStoreState {
  antraege: Antrag[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /** Programm-ID des aktuell gecachten States. null = nichts geladen. */
  cachedProgrammId: string | null;
  /** Laufende Refresh-Promise zum Dedupe paralleler Aufrufe. */
  refreshing: Promise<void> | null;
  /** Loesst den Refresh aus; idempotent fuer dieselbe programmId. */
  refresh: (storage: StorageService, programmId: string | null) => Promise<void>;
  /** Externe Invalidierung (CSV-Re-Import, Antrag-Edit). */
  invalidate: () => void;
}

const useCacheStore = create<CacheStoreState>((set, get) => ({
  antraege: [],
  loading: false,
  loaded: false,
  error: null,
  cachedProgrammId: null,
  refreshing: null,
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
      set({ antraege: [], loaded: true, error: null, cachedProgrammId: null });
      return;
    }
    const promise = (async () => {
      set({ loading: true, error: null });
      try {
        const all = await listAntraegeByProgramm(storage.idb, programmId);
        set({
          antraege: all,
          loaded: true,
          loading: false,
          error: null,
          cachedProgrammId: programmId,
          refreshing: null,
        });
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
    set({ antraege: [], loaded: false, cachedProgrammId: null, error: null });
  },
}));

/** Externer Trigger fuer Cache-Invalidierung (z.B. nach CSV-Import). */
export function invalidateAntraegeCache(): void {
  useCacheStore.getState().invalidate();
}

export function useAntraegeCache(): AntraegeCache {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const antraege = useCacheStore(s => s.antraege);
  const loading = useCacheStore(s => s.loading);
  const loaded = useCacheStore(s => s.loaded);
  const error = useCacheStore(s => s.error);
  const refreshAction = useCacheStore(s => s.refresh);
  const cachedProgrammId = useCacheStore(s => s.cachedProgrammId);

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

  const anonymMap = useMemo(
    () => buildAnonymMapFromKuerzelMap(kuerzelMapFile),
    [kuerzelMapFile],
  );
  const historischeDeskriptorenByAnon = useMemo(
    () => aggregateMaProfilesByAnon(antraege, anonymMap),
    [antraege, anonymMap],
  );
  const historischeAstByAnon = useMemo(
    () => aggregateAstByAnon(antraege, anonymMap),
    [antraege, anonymMap],
  );
  const allDeskriptoren = useMemo(
    () => collectAllDeskriptorenMitCount(antraege),
    [antraege],
  );

  return {
    antraege,
    loading,
    loaded,
    error,
    anonymMap,
    historischeDeskriptorenByAnon,
    historischeAstByAnon,
    allDeskriptoren,
    refresh,
  };
}
