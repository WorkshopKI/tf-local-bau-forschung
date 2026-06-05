/**
 * useAuslastungShareWatcher (v2.31) — Live-Sicht für andere PL-Rechner.
 *
 * Hintergrund: Kompetenz-/Kapazitäts-Edits werden seit v2.31 sofort auf
 * `_intern/auslastung.json` geschrieben (Auto-Save in `useKompetenzMatrixModel`).
 * Zwei Tabs DESSELBEN Browsers gleicht bereits `useAuslastungCrossTabSync` ab
 * (localStorage-Ping). PLs auf ANDEREN Rechnern teilen aber keine IndexedDB/
 * Handle und sahen die Änderung bisher erst beim nächsten Modul-Open/Reload.
 *
 * Dieser Hook pollt — solange das Auslastungs-Modul offen + SMB online ist —
 * alle `POLL_INTERVAL_MS` das `lastModified` der Datei (reine Metadaten, kein
 * Voll-Read) und lädt bei einer Änderung über die bestehende Store-Action
 * `reloadFromShare` nach (mit deren Kein-Clobber-/`istEcht`-Guard: kein Reload
 * während eigener Writes, kein Übernehmen eines transienten `.tmp`-Leer-Reads).
 *
 * Self-Trigger: der eigene Auto-Save bumpt `lastModified` ebenfalls → der erste
 * Tick danach löst einen idempotenten Reload aus (lädt denselben Stand, kein
 * sichtbarer Effekt dank `istEcht`-Guard). Bewusst in Kauf genommen statt
 * fragiler Timestamp-Korrelation. Reine Lese-Operation → kein readwrite-Handle
 * nötig (auch read-only-Varianten könnten mitlesen; relevant ist nur pl/dev,
 * wo das Modul überhaupt rendert).
 */
import { useEffect, useRef } from 'react';
import type { StorageService } from '@/core/services/storage';
import { useStorage } from '@/core/hooks/useStorage';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { AUSLASTUNG_JSON_PATH } from '../types';
import { useAuslastungData } from './useAuslastungData';

const POLL_INTERVAL_MS = 20_000;
/** Erster Tick verzögert, damit Mount-Load/onInit nicht doppelt feuern. */
const INITIAL_DELAY_MS = 3_000;

/** Liest das `lastModified` von `_intern/auslastung.json` — nur Metadaten, kein
 *  Voll-Read. `null` wenn Handle/Datei (noch) fehlen oder Permission entzogen. */
async function readLastModified(storage: StorageService): Promise<number | null> {
  try {
    const root = await getDatenShareHandle(storage.idb);
    if (!root) return null;
    const segs = AUSLASTUNG_JSON_PATH.split('/');
    let dir: FileSystemDirectoryHandle = root;
    for (let i = 0; i < segs.length - 1; i++) {
      dir = await dir.getDirectoryHandle(segs[i]!);
    }
    const file = await dir.getFileHandle(segs[segs.length - 1]!);
    return (await file.getFile()).lastModified;
  } catch {
    return null;
  }
}

export function useAuslastungShareWatcher(): void {
  const storage = useStorage();
  const smbStatus = useSmbStatus();
  const seenRef = useRef<number | null>(null);

  useEffect(() => {
    if (smbStatus.status !== 'online') return;
    let alive = true;
    let timer: number | null = null;

    const tick = async (): Promise<void> => {
      if (!alive) return;
      const lm = await readLastModified(storage);
      if (alive && lm !== null && lm !== seenRef.current) {
        seenRef.current = lm;
        // Reload ist no-op während eigener Writes (saving/persistDirty/loading)
        // und übernimmt keinen transienten Leer-Read.
        await useAuslastungData.getState().reloadFromShare(storage);
      }
      if (!alive) return;
      timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };

    timer = window.setTimeout(() => void tick(), INITIAL_DELAY_MS);
    return () => {
      alive = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [smbStatus.status, storage]);
}
