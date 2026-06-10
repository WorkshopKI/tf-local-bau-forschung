/**
 * Zustand-Store fuer den geteilten Embedding-Korpus auf dem SMB-Daten-Share.
 *
 * Lifecycle:
 *  - `loadManifest(storage)` — beim Mount der UI-Section (klein, ohne 42 MB
 *    Bin-Roundtrip).
 *  - `downloadAndApply(storage)` — laedt Bin, parsed Vektoren, schreibt sie
 *    in den lokalen IDB-Cache. Caller pruefte vorher Kompat + Hash.
 *  - `uploadFromIdb(storage, modellId, dim, builderProfile)` — serialisiert
 *    den aktuellen IDB-Cache und schreibt Manifest+Bin atomar auf den
 *    Share. Build-Lock-Schutz fuer den Schreib-Block (kurz, ~5 sec).
 *
 * Konsumenten:
 *  - Auslastungs-Admin `EmbeddingCorpusSection.tsx` (Build + Upload + Status)
 *  - Antraege-Hybrid-Search-Hook (Auto-Download fuer prod-User)
 */
import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  loadAllEmbeddings,
  loadManifest,
  loadBin,
  saveCorpusToShare,
  serializeCorpus,
  applyCorpusStreamed,
  type EmbeddingCorpusManifest,
} from '@/core/services/embedding-corpus';
import {
  acquireBuildLock,
  heartbeat,
  releaseLock,
} from '@/core/services/infrastructure/build-lock';
import { logMem } from '@/core/utils/log-mem';

const LOCK_STUFE = 'auslastung-corpus';

interface EmbeddingCorpusMirrorState {
  manifest: EmbeddingCorpusManifest | null;
  manifestLoaded: boolean;
  loading: boolean;
  downloading: boolean;
  downloadProgress: { done: number; total: number } | null;
  uploading: boolean;
  error: string | null;
  /** Manifest vom Share lesen (klein, immer wenn die Korpus-Section oeffnet).
   *  Idempotent — Doppel-Aufrufe schaden nicht. */
  loadManifest: (storage: StorageService) => Promise<void>;
  /** Bin downloaden + in IDB cachen. Caller MUSS vorher Kompat pruefen. */
  downloadAndApply: (storage: StorageService) => Promise<{ count: number } | null>;
  /** Aktuellen lokalen Cache auf Share hochladen. Mit Build-Lock.
   *  `opts.skipLock`: Lock NICHT selbst akquirieren — der Caller hält ihn schon
   *  (z.B. `EmbeddingCorpusSection.build()` lockt über den ganzen Build+Upload).
   *  Ohne das würde der Re-Acquire den eigenen, noch aktiven Lock sehen und
   *  fälschlich „Build läuft bereits" werfen. */
  uploadFromIdb: (
    storage: StorageService,
    modellId: string,
    dim: number,
    builderProfile?: string,
    opts?: { skipLock?: boolean },
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
      logMem(`corpus:download-start (count=${m.antraegeCount})`);
      const bin = await loadBin(storage, m.binBytes);
      if (!bin) {
        throw new Error('Bin-Datei konnte nicht vom Share geladen werden oder ist korrupt.');
      }
      // Streamend anwenden statt parseCorpus → 80-MB-Map → applyCorpusToIdb:
      // spart die Zwischen-Map und yieldet periodisch (Cold-Start-Memory, v2.61.5).
      const count = await applyCorpusStreamed(
        storage.idb as IDBStore,
        m,
        bin,
        (done, total) => set({ downloadProgress: { done, total } }),
      );
      logMem(`corpus:applied (count=${count})`);
      set({ downloading: false, downloadProgress: null });
      return { count };
    } catch (err) {
      set({ downloading: false, downloadProgress: null, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  uploadFromIdb: async (storage, modellId, dim, builderProfile, opts) => {
    if (get().uploading) return;
    set({ uploading: true, error: null });
    let lockAcquired = false;
    const skipLock = opts?.skipLock === true;
    try {
      if (!skipLock) {
        const lockResult = await acquireBuildLock(storage.idb as IDBStore, LOCK_STUFE);
        if (!lockResult.acquired) {
          const ageMin = Math.round(lockResult.ageMinutes);
          throw new Error(
            `Build laeuft bereits (${lockResult.existing.kurator_name}, gestartet vor ${ageMin} min, Stufe "${lockResult.existing.stufe}"). Sync abgebrochen.`,
          );
        }
        lockAcquired = true;
      }

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
