/**
 * useMyUebernahmeWuensche — eigene Übernahme-Wünsche („Kann ich übernehmen").
 *
 * Hintergrund: Normale MAs (prod) haben nur `read` auf dem Daten-Share und
 * koennen `auslastung.json` nicht schreiben. Der Wunsch landet daher im
 * persoenlichen Ordner (`ZAH/auslastung-uebernahme.json`); die PL sammelt ihn
 * spaeter ein. Self-Ansichten (Home) muessen die eigenen Wünsche aus dem
 * persoenlichen Profil lesen — sonst sehen sie erst nach PL-Aggregation etwas
 * (Spiegelbild von `useMyAuslastungProfil`, Pitfall #24).
 *
 * Liefert `claim`/`undo` (schreiben den persoenlichen Ordner via `useAsyncAction`,
 * Pitfall #15) + `claimedSet` der lokal vorgemerkten Aktenzeichen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import {
  loadUebernahmeWuensche,
  writeUebernahmeWuensche,
} from '../services/uebernahme-wuensche';
import type { PersoenlicheUebernahmeWuensche, UebernahmeWunsch } from '../types';

export interface MyUebernahmeWuensche {
  /** Aktenzeichen, die der User lokal vorgemerkt hat. */
  claimedSet: Set<string>;
  wuensche: UebernahmeWunsch[];
  /** true bis die persoenliche Wunsch-Datei (Share/IDB-Cache) geladen ist. */
  loading: boolean;
  busy: boolean;
  error: string | null;
  /** Antrag vormerken („Kann ich übernehmen"). No-op wenn schon vorgemerkt. */
  claim: (antragId: string, anzahlTV: number, quartal: string) => Promise<void>;
  /** Vormerkung zuruecknehmen („Rückgängig"). */
  undo: (antragId: string) => Promise<void>;
}

export function useMyUebernahmeWuensche(): MyUebernahmeWuensche {
  const storage = useStorage();
  const { profile } = useProfile();
  const [wuensche, setWuensche] = useState<UebernahmeWunsch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      const data = await loadUebernahmeWuensche(storage.idb, persHandle);
      if (cancelled) return;
      setWuensche(data?.wuensche ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  const kuerzel = profile?.bearbeiter_kuerzel ?? '';

  // Persistiert eine neue Wunsch-Liste: lokal optimistisch setzen (UI reagiert
  // sofort, der IDB-Cache wird in writeUebernahmeWuensche immer geschrieben),
  // dann persoenlichen Ordner schreiben. Wirft writeUebernahmeWuensche (kein
  // Ordner verbunden), faengt useAsyncAction das ab — der Cache ist trotzdem da.
  const persistWuensche = useCallback(
    async (next: UebernahmeWunsch[]) => {
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      const data: PersoenlicheUebernahmeWuensche = {
        version: 1,
        kuerzel,
        wuensche: next,
        updatedAt: new Date().toISOString(),
      };
      setWuensche(next);
      await writeUebernahmeWuensche(storage.idb, persHandle, data);
    },
    [storage, kuerzel],
  );

  const claimAction = useAsyncAction(
    async (antragId: string, anzahlTV: number, quartal: string) => {
      if (wuensche.some(w => w.antragId === antragId)) return;
      await persistWuensche([
        ...wuensche,
        { antragId, quartal, anzahlTV, createdAt: new Date().toISOString() },
      ]);
    },
  );

  const undoAction = useAsyncAction(async (antragId: string) => {
    const next = wuensche.filter(w => w.antragId !== antragId);
    if (next.length === wuensche.length) return;
    await persistWuensche(next);
  });

  const claimedSet = useMemo(
    () => new Set(wuensche.map(w => w.antragId)),
    [wuensche],
  );

  return {
    claimedSet,
    wuensche,
    loading,
    busy: claimAction.busy || undoAction.busy,
    error: claimAction.error ?? undoAction.error,
    claim: claimAction.run,
    undo: undoAction.run,
  };
}
