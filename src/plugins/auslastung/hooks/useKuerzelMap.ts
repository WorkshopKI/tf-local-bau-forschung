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
import { isDatenShareReadable } from '@/core/services/infrastructure/smb-handle';
import {
  loadKuerzelMapLage,
  saveKuerzelMap,
  syncKuerzelMapWithAntraege,
  bootstrapKuerzelMap,
  buildAnonymMapFromKuerzelMap,
  emptyKuerzelMap,
  type KuerzelMapFile,
} from '../services/identitaet';
import type { AnonymMap } from '../services/identitaet';

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
  /** Letzter Lese-Versuch traf eine vorhandene, aber unlesbare Sidecar (v4.12).
   *  Sperrt jeden Write — siehe `syncWithAntraege`. */
  unlesbar: boolean;
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
  unlesbar: false,
  error: null,

  load: async (storage) => {
    if (get().loading || get().loaded) return;
    set({ loading: true, error: null });
    try {
      const lage = await loadKuerzelMapLage(storage);
      // Vorhandene, aber unlesbare Datei: NICHT als leere Map weiterreichen.
      // `loaded` bleibt false (der naechste Mount liest neu) und `unlesbar`
      // sperrt jeden Write, bis wieder ein echter Stand vorliegt.
      if (lage.status === 'unlesbar') {
        set({
          loading: false,
          loaded: false,
          unlesbar: true,
          error: 'Kürzel-Map auf dem Daten-Share ist derzeit nicht lesbar.',
        });
        return;
      }
      const f = lage.map;
      // v2.46.1: `loaded` (= Reload-Guard scharf) nur setzen, wenn der Daten-
      // Share beim Laden wirklich lesbar war — analog useAuslastungData.load
      // (v2.19.2). Der Plugin-onInit lädt VOR dem StartupScreen-Grant;
      // loadKuerzelMap schluckt den Permission-Fehler still und liefert
      // emptyKuerzelMap(). Ohne dieses Gate friert der Guard die leere Map fest
      // → leere anonymMap → leere historischeDeskriptorenByAnon →
      // matching-engine.ts:189 skippt jeden nicht-onboarded MA → „Keine
      // passenden MAs gefunden", bis zum Browser-Reload (pl, Anträge zuweisen).
      // shareReadable=false ⇒ loaded bleibt false ⇒ der Post-Grant-Mount
      // (AuslastungView / useAntraegeCache) lädt die echte Map nach.
      const shareReadable = await isDatenShareReadable(storage.idb);
      const current = get().file;
      // Ref-stable behalten wenn Inhalt identisch — sonst kaskadieren die 5
      // useMemos in useAntraegeCache (anonymMap, historischeAstByAnon, ...)
      // beim Initial-Mount mehrfach durch.
      if (isSameKuerzelContent(current, f)) {
        set({ loaded: shareReadable, loading: false, unlesbar: false });
      } else {
        set({ file: f, loaded: shareReadable, loading: false, unlesbar: false });
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  syncWithAntraege: async (storage, antraege) => {
    if (get().saving) return { added: [] };
    if (antraege.length === 0) return { added: [] };
    // Ohne verlaesslich gelesenen Stand wird NICHT geschrieben (v4.12):
    // `saveKuerzelMap` ersetzt die Datei vollstaendig. Der In-Memory-Stand waere
    // hier entweder der leere Anfangswert (load noch nicht durch) oder ein
    // Notbehelf nach einem Lesefehler — beides zurueckzuschreiben verschoebe
    // jede vergebene anonId (Pitfall #18). Der naechste Mount liest neu.
    if (!get().loaded || get().unlesbar) return { added: [] };

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
