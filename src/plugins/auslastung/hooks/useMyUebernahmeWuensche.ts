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
 *
 * Ruecknahme einer bereits PL-eingesammelten („Pending") Vormerkung: das geteilte
 * `auslastung.json` ist read-only, also kann die `selbst`-Zuweisung nicht direkt
 * entfernt werden. `undo` schreibt deshalb (a) die persoenliche Datei OHNE den
 * Wunsch — der durable Retraktions-Vertrag, den der PL-Reconciler beim naechsten
 * Einsammeln umsetzt — und (b) ein browser-lokales Optimistic-Overlay
 * (`retractedSet`), das die „Vorgemerkt"-Anzeige sofort unterdrueckt, bis die PL
 * neu einsammelt (dann self-healing prune via `pendingSet`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import {
  loadUebernahmeWuensche,
  writeUebernahmeWuensche,
} from '../services/uebernahme-wuensche';
import { PERSOENLICH_AUSLASTUNG_RETRACTED_IDB_KEY } from '../types';
import type {
  PersoenlicheUebernahmeWuensche,
  RetractedPendingCache,
  UebernahmeWunsch,
} from '../types';

export interface MyUebernahmeWuensche {
  /** Aktenzeichen, die der User lokal vorgemerkt hat. */
  claimedSet: Set<string>;
  /** Optimistic-Overlay: lokal zurueckgenommene „Pending"-Vormerkungen. Solange
   *  eine id hier steht, gilt sie in der UI NICHT mehr als vorgemerkt — auch
   *  wenn `auslastung.json` sie noch als `selbst`-Zuweisung fuehrt. */
  retractedSet: Set<string>;
  wuensche: UebernahmeWunsch[];
  /** true bis die persoenliche Wunsch-Datei (Share/IDB-Cache) geladen ist. */
  loading: boolean;
  busy: boolean;
  error: string | null;
  /** Antrag vormerken („Kann ich übernehmen"). No-op wenn schon vorgemerkt. */
  claim: (antragId: string, anzahlTV: number, quartal: string) => Promise<void>;
  /** Vormerkung zuruecknehmen („Rückgängig"). Wirkt auch fuer bereits
   *  eingesammelte (Pending) Vormerkungen. */
  undo: (antragId: string) => Promise<void>;
}

/**
 * @param pendingSet — Aktenzeichen, die im Store (`auslastung.json`) als
 *   `selbst`-Zuweisung stehen. Wird ausschliesslich fuers self-healing Prune des
 *   Ruecknahme-Overlays genutzt. `undefined` = „noch nicht bereit" (Store laedt) —
 *   dann wird NICHT geprunt (ein leeres Set wuerde das Overlay sonst vorzeitig
 *   leeren).
 */
export function useMyUebernahmeWuensche(
  pendingSet?: ReadonlySet<string>,
): MyUebernahmeWuensche {
  const storage = useStorage();
  const meinKuerzel = useMeinKuerzel();
  const [wuensche, setWuensche] = useState<UebernahmeWunsch[]>([]);
  const [retracted, setRetracted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      const data = await loadUebernahmeWuensche(storage.idb, persHandle);
      const overlay = await storage.idb
        .get<RetractedPendingCache>(PERSOENLICH_AUSLASTUNG_RETRACTED_IDB_KEY)
        .catch(() => null);
      if (cancelled) return;
      setWuensche(data?.wuensche ?? []);
      setRetracted(new Set(overlay?.antragIds ?? []));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  const kuerzel = meinKuerzel ?? '';

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

  // Browser-lokales Overlay nach IDB schreiben (nie auf den SMB-Share — kein
  // Vertrag, siehe File-Header).
  const persistRetracted = useCallback(
    async (next: Set<string>) => {
      const cache: RetractedPendingCache = {
        version: 1,
        antragIds: [...next],
        updatedAt: new Date().toISOString(),
      };
      await storage.idb.set(PERSOENLICH_AUSLASTUNG_RETRACTED_IDB_KEY, cache);
    },
    [storage],
  );

  const claimAction = useAsyncAction(
    async (antragId: string, anzahlTV: number, quartal: string) => {
      // Re-Claim hebt eine vorherige Ruecknahme auf — sonst bliebe der Antrag
      // durchs Overlay weiter unterdrueckt.
      if (retracted.has(antragId)) {
        const nextRetracted = new Set(retracted);
        nextRetracted.delete(antragId);
        setRetracted(nextRetracted);
        await persistRetracted(nextRetracted);
      }
      if (wuensche.some(w => w.antragId === antragId)) return;
      await persistWuensche([
        ...wuensche,
        { antragId, quartal, anzahlTV, createdAt: new Date().toISOString() },
      ]);
    },
  );

  const undoAction = useAsyncAction(async (antragId: string) => {
    // (a) Optimistic: Pending-Anzeige SOFORT unterdruecken (vor dem evtl.
    //     werfenden File-Write, damit die UI auch ohne Ordner reagiert).
    const nextRetracted = new Set(retracted).add(antragId);
    setRetracted(nextRetracted);
    await persistRetracted(nextRetracted);
    // (b) Durable: Wunsch aus der persoenlichen Datei entfernen. Auch wenn er
    //     lokal nicht (mehr) vorhanden ist (pending-only) wird die Datei
    //     geschrieben — so existiert eine Datei OHNE die id, die der PL beim
    //     naechsten Einsammeln gegen die `selbst`-Zuweisung reconciled (entfernt).
    const next = wuensche.filter(w => w.antragId !== antragId);
    await persistWuensche(next);
  });

  const claimedSet = useMemo(
    () => new Set(wuensche.map(w => w.antragId)),
    [wuensche],
  );

  // Self-healing prune: eine zurueckgenommene id braucht keine Unterdrueckung
  // mehr, sobald sie nicht mehr pending ist (PL hat neu eingesammelt → die
  // `selbst`-Zuweisung ist weg) oder wieder gewuenscht wird. Haelt das Overlay
  // beschraenkt. `pendingSet === undefined` ⇒ Store noch nicht bereit ⇒ nicht prunen.
  useEffect(() => {
    if (retracted.size === 0 || !pendingSet) return;
    let changed = false;
    const next = new Set(retracted);
    for (const id of retracted) {
      if (claimedSet.has(id) || !pendingSet.has(id)) {
        next.delete(id);
        changed = true;
      }
    }
    if (changed) {
      setRetracted(next);
      void persistRetracted(next);
    }
  }, [retracted, pendingSet, claimedSet, persistRetracted]);

  return {
    claimedSet,
    retractedSet: retracted,
    wuensche,
    loading,
    busy: claimAction.busy || undoAction.busy,
    error: claimAction.error ?? undoAction.error,
    claim: claimAction.run,
    undo: undoAction.run,
  };
}
