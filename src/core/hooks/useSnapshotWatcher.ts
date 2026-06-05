/**
 * Snapshot-Watcher: pollt im Hintergrund die Snapshot-Manifeste auf dem
 * Daten-Share und meldet, wenn ein anderer Kurator zwischendurch einen
 * neuen Datenbestand geschrieben hat.
 *
 * Polling-Intervall: 15 Min. Hochfrequenter waere SMB-Overkill (Manifest
 * ist ~1 KB, aber wird tatsaechlich nur nach Kurator-CSV-Refresh
 * geschrieben — typisch 0-2x pro Tag).
 *
 * Pauseregeln:
 *  - smbStatus !== 'online'  → kein Polling (Offline-Modus)
 *  - kein Daten-Share-Handle → kein Polling
 *
 * Verhalten:
 *  - Liest pro Programm das Manifest und vergleicht `snapshotVersion`
 *    gegen den lokal persistierten Wert (`snapshot-version-<programmId>`,
 *    geschrieben vom 1x/Tag-Sync in App.tsx).
 *  - Bei neuerer Version: setzt `availableUpdates`.
 *  - `applyNow()` triggert `syncProgrammSnapshot({ force: true })` fuer
 *    alle betroffenen Programme. Day-Throttle wird umgangen, weil
 *    User-Geste.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from './useStorage';
import { useSmbStatus } from './useSmbStatus';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { readText } from '@/core/services/infrastructure/atomic-write';
import { listProgramme } from '@/core/services/csv';
import { syncProgrammSnapshot } from '@/core/services/csv/snapshot-sync';
import { refreshAntraegeStoreAfterSync } from '@/plugins/antraege/snapshot-refresh';
import { bumpCsvSourcesSignal } from '@/core/services/csv/csv-sources-signal';
import { useAntraegeStore } from '@/plugins/antraege/store';
import type { ProgrammSnapshotManifest } from '@/core/services/csv/snapshot';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 Min
const SYNC_VERSION_KEY = (programmId: string): string => `snapshot-version-${programmId}`;

export interface AvailableSnapshot {
  programmId: string;
  programmName: string;
  newVersion: string;
  createdBy: string;
  createdAt: string;
}

export interface SnapshotWatcherState {
  availableUpdates: AvailableSnapshot[];
  applying: boolean;
  applyError: string | null;
  /**
   * Fortschritt waehrend `applyNow()` als Fraktion 0..1 (ueber alle
   * betroffenen Programme aggregiert), oder `null` solange noch kein
   * Store-Fortschritt vorliegt (Manifest-Phase / nicht laufend).
   */
  progress: number | null;
  /** Banner ausblenden bis zum naechsten Polling-Tick mit neuerem Snapshot. */
  dismissed: boolean;
  dismiss: () => void;
  applyNow: () => Promise<void>;
}

async function readManifest(
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
): Promise<ProgrammSnapshotManifest | null> {
  try {
    const programm = await smbHandle.getDirectoryHandle('programm');
    const antraegeDir = await programm.getDirectoryHandle('antraege');
    const snapshotDir = await antraegeDir.getDirectoryHandle('snapshot');
    const programmDir = await snapshotDir.getDirectoryHandle(programmId);
    const text = await readText(programmDir, 'manifest.json');
    if (!text) return null;
    return JSON.parse(text) as ProgrammSnapshotManifest;
  } catch {
    return null;
  }
}

interface UseSnapshotWatcherOptions {
  /**
   * Wird nach erfolgreichem `applyNow()` aufgerufen — z.B. um eine Toast-
   * Meldung zu zeigen ("Antragsdaten aktualisiert").
   */
  onSynced?: (info: { programmId: string; programmName: string; createdAt: string }) => void;
  /**
   * Steuert, ob das Polling laufen soll. Default: laeuft sobald Online +
   * Daten-Share-Handle verfuegbar. Caller (App.tsx) setzt das auf `false`
   * waehrend Onboarding/Startup-Screens, damit das Polling erst
   * nach App-Ready greift.
   */
  enabled?: boolean;
}

export function useSnapshotWatcher(opts: UseSnapshotWatcherOptions = {}): SnapshotWatcherState {
  const storage = useStorage();
  const smbStatus = useSmbStatus();
  const enabled = opts.enabled !== false;

  const [availableUpdates, setAvailableUpdates] = useState<AvailableSnapshot[]>([]);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const mountedRef = useRef(true);
  const onSyncedRef = useRef(opts.onSynced);
  onSyncedRef.current = opts.onSynced;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const check = useCallback(async (): Promise<void> => {
    const handle = await getDatenShareHandle(storage.idb);
    if (!handle) return;
    const programme = await listProgramme(storage.idb);
    const updates: AvailableSnapshot[] = [];
    for (const p of programme) {
      const manifest = await readManifest(handle, p.id);
      if (!manifest) continue;
      const local = await storage.idb.get<string>(SYNC_VERSION_KEY(p.id));
      // Skalar-String und ISO-Vergleich: ISO-Strings sind lexikalisch
      // ordbar, das deckt den Normalfall (zwei ISO-Strings) ab.
      if (typeof local === 'string' && local === manifest.snapshotVersion) continue;
      // Falls local undefined oder anders → es gibt was Neueres.
      updates.push({
        programmId: p.id,
        programmName: p.name,
        newVersion: manifest.snapshotVersion,
        createdBy: manifest.createdBy,
        createdAt: manifest.createdAt,
      });
    }
    if (!mountedRef.current) return;
    // Wenn sich die Liste tatsaechlich geaendert hat: Dismiss-Flag zuruecksetzen,
    // damit ein neuer Snapshot wieder im Banner erscheint, auch wenn der User
    // den vorigen weggeklickt hatte.
    setAvailableUpdates(prev => {
      const same = prev.length === updates.length && prev.every((p, i) => p.newVersion === updates[i]?.newVersion);
      if (!same) setDismissed(false);
      return updates;
    });
  }, [storage.idb]);

  // Polling-Loop
  useEffect(() => {
    if (!enabled) return;
    if (smbStatus.status !== 'online') return;

    let alive = true;
    let timer: number | null = null;

    const tick = async (): Promise<void> => {
      if (!alive) return;
      try {
        await check();
      } catch (err) {
        console.warn('[snapshot-watcher] check failed', err);
      }
      if (!alive) return;
      timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    // Initial-Check mit kurzem Delay (5s), damit der App-Start-Sync
    // nicht doppelt feuert.
    timer = window.setTimeout(tick, 5_000);

    return () => {
      alive = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [enabled, smbStatus.status, check]);

  const dismiss = useCallback(() => setDismissed(true), []);

  const applyNow = useCallback(async () => {
    if (applying) return;
    if (availableUpdates.length === 0) return;
    setApplying(true);
    setApplyError(null);
    setProgress(null);
    try {
      const handle = await getDatenShareHandle(storage.idb);
      if (!handle) throw new Error('Daten-Share nicht verbunden');
      const total = availableUpdates.length;
      for (let i = 0; i < total; i++) {
        const u = availableUpdates[i];
        if (!u) continue;
        const r = await syncProgrammSnapshot(storage.idb, handle, u.programmId, {
          force: true,
          onProgress: sp => {
            if (!mountedRef.current) return;
            // sp.fraction ist eine monotone 0..1-Fraktion über alle Phasen
            // (Manifest → Stores inkl. Chunk-Fortschritt → List-View-Rebuild).
            setProgress((i + sp.fraction) / total);
          },
        });
        if (r.synced) {
          // In-Memory-Antraege-Store neu laden, damit Homepage/Listen die
          // frisch geladenen Daten ohne Browser-Reload zeigen.
          await refreshAntraegeStoreAfterSync(storage.idb, u.programmId, r.reloadedStores ?? []);
          if (r.createdAt) {
            onSyncedRef.current?.({
              programmId: u.programmId,
              programmName: u.programmName,
              createdAt: r.createdAt,
            });
          }
        } else if (useAntraegeStore.getState().antraege.length === 0) {
          // v2.21.3: synced:false, weil ein vorheriger (Startup-)Sync die
          // Version schon konsumiert hat — die Daten liegen dann bereits in der
          // IDB, nur der In-Memory-Store ist leer. „Jetzt laden" darf hier kein
          // stiller No-Op sein: Store aus der IDB nachladen.
          await refreshAntraegeStoreAfterSync(storage.idb, u.programmId, ['antraege']);
        }
      }
      // Frisch synchronisierte Schemas → CSV-Auto-Refresh-Check re-triggern,
      // damit der „CSV-Ordner verknüpfen"-Banner nach dem Sync erscheint.
      bumpCsvSourcesSignal();
      if (mountedRef.current) {
        setAvailableUpdates([]);
        setDismissed(false);
      }
    } catch (err) {
      if (mountedRef.current) setApplyError((err as Error).message);
    } finally {
      if (mountedRef.current) {
        setApplying(false);
        setProgress(null);
      }
    }
  }, [applying, availableUpdates, storage.idb]);

  return {
    availableUpdates,
    applying,
    applyError,
    progress,
    dismissed,
    dismiss,
    applyNow,
  };
}
