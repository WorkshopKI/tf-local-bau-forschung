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

/** True, wenn die Sidecar-Inhalte fachlich identisch sind (gleiche Anzahl +
 *  gleiche Kuerzel/anonId in Reihenfolge). `updatedAt` ist absichtlich nicht
 *  Teil des Vergleichs — sonst wuerde jeder Save eine Ref-Aenderung erzwingen,
 *  obwohl der Inhalt invariant ist. Append-only-Invariante hilft: bei gleichem
 *  Inhalt sind auch die Indizes stabil.
 *
 *  Exportiert primaer fuer Tests; in der App wird sie nur unten im Store
 *  selbst genutzt. */
export function isSameKuerzelContent(a: KuerzelMapFile, b: KuerzelMapFile): boolean {
  if (a === b) return true;
  if (a.entries.length !== b.entries.length) return false;
  for (let i = 0; i < a.entries.length; i++) {
    // Beide Indizes existieren (Length-Check oben), aber noUncheckedIndexedAccess
    // verlangt explizite Bestaetigung.
    const ae = a.entries[i]!;
    const be = b.entries[i]!;
    if (ae.kuerzel !== be.kuerzel) return false;
  }
  return true;
}

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
      const current = get().file;
      // Ref-stable behalten wenn Inhalt identisch — sonst kaskadieren die 5
      // useMemos in useAntraegeCache (anonymMap, historischeAstByAnon, ...)
      // beim Initial-Mount mehrfach durch.
      if (isSameKuerzelContent(current, f)) {
        set({ loaded: true, loading: false });
      } else {
        set({ file: f, loaded: true, loading: false });
      }
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
      // Im Bootstrap-Pfad mit 0 Antraege-Kuerzeln waere `persisted` ein leerer
      // Map-Reshape — gleicher Inhalt wie current, aber neue Ref. Vergleichen
      // statt blind setzen, damit der useMemo-Cascade aussetzt.
      if (isSameKuerzelContent(current, persisted)) {
        set({ saving: false });
      } else {
        set({ file: persisted, saving: false });
      }
      return { added: isBootstrap ? base.entries.map(e => e.kuerzel) : added };
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  anonymMap: () => buildAnonymMapFromKuerzelMap(get().file),
}));
