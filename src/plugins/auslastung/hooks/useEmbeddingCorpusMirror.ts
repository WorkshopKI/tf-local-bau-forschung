/**
 * Zustand-Store fuer den geteilten Embedding-Korpus auf dem SMB-Daten-Share.
 *
 * Lifecycle:
 *  - `loadManifest(storage)` — beim Mount der EmbeddingCorpusSection,
 *    liest nur das kleine Manifest (kein 42 MB Roundtrip).
 *  - `downloadAndApply(storage, idb, onProgress)` — laedt Bin, parsed
 *    Vektoren, schreibt sie in den lokalen IDB-Cache. Caller pruefte
 *    vorher Kompat + Hash.
 *  - `uploadFromIdb(storage, idb, modellId, dim, builderProfile)` —
 *    serialisiert den aktuellen IDB-Cache und schreibt Manifest+Bin
 *    atomar auf den Share. Build-Lock-Schutz fuer den Schreib-Block
 *    (kurz, ~5 sec).
 */
import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { loadAllEmbeddings } from '../services/embedding-corpus';
import {
  loadManifest,
  loadBin,
  saveCorpusToShare,
  serializeCorpus,
  parseCorpus,
  applyCorpusToIdb,
  type EmbeddingCorpusManifest,
} from '../services/embedding-corpus-mirror';
import {
  acquireBuildLock,
  heartbeat,
  releaseLock,
} from '@/core/services/infrastructure/build-lock';

const LOCK_STUFE = 'auslastung-corpus';

interface EmbeddingCorpusMirrorState {
  manifest: EmbeddingCorpusManifest | null;
  manifestLoaded: boolean;
  loading: boolean;
  downloading: boolean;
  downloadProgress: { done: number; total: number } | null;
  uploading: boolean;
  error: string | null;
  /** Manifest vom Share lesen (klein, immer wenn Auslastungs-Tab oeffnet).
   *  Idempotent — Doppel-Aufrufe schaden nicht. */
  loadManifest: (storage: StorageService) => Promise<void>;
  /** Bin downloaden + in IDB cachen. Caller MUSS vorher Kompat pruefen. */
  downloadAndApply: (storage: StorageService) => Promise<{ count: number } | null>;
  /** Aktuellen lokalen Cache auf Share hochladen. Mit Build-Lock. */
  uploadFromIdb: (
    storage: StorageService,
    modellId: string,
    dim: number,
    builderProfile?: string,
  ) => Promise<void>;
  /** Reset z.B. nach Modellwechsel — UI-Hint. */
  reset: () => void;
}

export const useEmbeddingCorpusMirror = create<EmbeddingCorpusMirrorState>((set, get) => ({
  manifest: null,
  manifestLoaded: false,
  loading: false,
  downloading: false,
  downloadProgress: null,
  uploading: false,
  error: null,

  loadManifest: async (storage) => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const m = await loadManifest(storage);
      set({ manifest: m, manifestLoaded: true, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  downloadAndApply: async (storage) => {
    const m = get().manifest;
    if (!m) return null;
    if (get().downloading) return null;
    set({ downloading: true, downloadProgress: { done: 0, total: m.antraegeCount }, error: null });
    try {
      const bin = await loadBin(storage, m.binBytes);
      if (!bin) {
        throw new Error('Bin-Datei konnte nicht vom Share geladen werden oder ist korrupt.');
      }
      const embs = parseCorpus(m, bin);
      await applyCorpusToIdb(
        storage.idb as IDBStore,
        embs,
        (done, total) => set({ downloadProgress: { done, total } }),
      );
      set({ downloading: false, downloadProgress: null });
      return { count: embs.size };
    } catch (err) {
      set({ downloading: false, downloadProgress: null, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  uploadFromIdb: async (storage, modellId, dim, builderProfile) => {
    if (get().uploading) return;
    set({ uploading: true, error: null });
    let lockAcquired = false;
    try {
      const lockResult = await acquireBuildLock(storage.idb as IDBStore, LOCK_STUFE);
      if (!lockResult.acquired) {
        const ageMin = Math.round(lockResult.ageMinutes);
        throw new Error(
          `Build laeuft bereits (${lockResult.existing.kurator_name}, gestartet vor ${ageMin} min, Stufe "${lockResult.existing.stufe}"). Sync abgebrochen.`,
        );
      }
      lockAcquired = true;

      const embs = await loadAllEmbeddings(storage.idb as IDBStore);
      if (embs.size === 0) {
        throw new Error('Lokaler Embedding-Cache ist leer — nichts hochzuladen.');
      }
      // Heartbeat einmal in der Mitte (Serialize kann bei 13k Vektoren
      // ~1-2 sec brauchen; voller Block <10 sec; Lock-Stale ist 2h)
      await heartbeat(storage.idb as IDBStore);
      const { manifest, bin } = await serializeCorpus(embs, modellId, dim, builderProfile);
      await saveCorpusToShare(storage, manifest, bin);
      set({ manifest, manifestLoaded: true, uploading: false });
    } catch (err) {
      set({ uploading: false, error: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      if (lockAcquired) {
        await releaseLock(storage.idb as IDBStore).catch(() => undefined);
      }
    }
  },

  reset: () => set({
    manifest: null,
    manifestLoaded: false,
    error: null,
  }),
}));
