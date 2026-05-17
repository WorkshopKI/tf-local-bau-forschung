/**
 * Zustand-Store fuer die persistente `kuerzel ↔ anonId`-Map.
 *
 * Wird vom `useAntraegeCache` initialisiert + bei jedem Antraege-Refresh
 * synchronisiert. Code-Konsumenten lesen `anonymMap` direkt aus dem
 * `useAntraegeCache` (selektor auf `file` + `buildAnonymMapFromKuerzelMap`).
 *
 * Save-Lock via `saving`-Flag analog zu `useAuslastungData.persist`:
 * paralleler `syncWithAntraege`-Call fuegt sich in den naechsten Slot ein
 * (return early). Eine zweite Mutation kommt im naechsten Refresh wieder.
 */
import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';
import type { Antrag, AntragListItem } from '@/core/services/csv/types';
import {
  loadKuerzelMap,
  saveKuerzelMap,
  syncKuerzelMapWithAntraege,
  bootstrapKuerzelMap,
  buildAnonymMapFromKuerzelMap,
  emptyKuerzelMap,
  type KuerzelMapFile,
} from '../services/kuerzel-map';
import type { AnonymMap } from '../services/anonym-map';

interface KuerzelMapState {
  file: KuerzelMapFile;
  loading: boolean;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  load: (storage: StorageService) => Promise<void>;
  /** Bootstrap (wenn leer) + Sync neuer Kuerzel + Persist in einem Schritt.
   *  Idempotent: bei identischen antraege keine I/O. */
  syncWithAntraege: (storage: StorageService, antraege: Array<Antrag | AntragListItem>) => Promise<{ added: string[] }>;
  /** Liefert die `AnonymMap`-Sicht auf die aktuelle Datei. */
  anonymMap: () => AnonymMap;
}

export const useKuerzelMap = create<KuerzelMapState>((set, get) => ({
  file: emptyKuerzelMap(),
  loading: false,
  loaded: false,
  saving: false,
  error: null,

  load: async (storage) => {
    if (get().loading || get().loaded) return;
    set({ loading: true, error: null });
    try {
      const f = await loadKuerzelMap(storage);
      set({ file: f, loaded: true, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  syncWithAntraege: async (storage, antraege) => {
    if (get().saving) return { added: [] };
    if (antraege.length === 0) return { added: [] };

    const current = get().file;
    const isBootstrap = current.entries.length === 0;
    const base = isBootstrap ? bootstrapKuerzelMap(antraege) : current;
    const { map, added } = syncKuerzelMapWithAntraege(base, antraege);

    if (!isBootstrap && added.length === 0) return { added: [] };

    set({ saving: true, error: null });
    try {
      const persisted = await saveKuerzelMap(storage, map);
      set({ file: persisted, saving: false });
      return { added: isBootstrap ? base.entries.map(e => e.kuerzel) : added };
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  anonymMap: () => buildAnonymMapFromKuerzelMap(get().file),
}));
