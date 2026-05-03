/**
 * Holding-Bucket für Projektbeschreibungen, deren Antrag noch nicht
 * via CSV-Import / Snapshot-Sync angekommen ist.
 *
 * Trigger zum Re-Match:
 *  - importer.ts: am Ende von `importCsvSource` (Best-Effort)
 *  - App.tsx: Nach `syncProgrammSnapshot`-Erfolg, wenn `reloadedStores`
 *    `akronym_index` oder `antraege` enthält.
 */

import type { IDBStore } from '../../core/services/storage/idb-store';
import { PHASE2_STORES } from '../../core/services/storage/idb-store';
import { listAntraegeByAkronym, getAkronymEntry } from '../../core/services/csv/idb-csv';
import { matchByFkz } from '../matcher/matcher';
import type { ManifestEntry, PendingAntragEntry } from '../types';
import { putManifestEntry, getManifestEntry } from '../scanner/manifest-store';

function newId(): string {
  return `pend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function addPending(idb: IDBStore, entry: Omit<PendingAntragEntry, 'id' | 'enqueued_at'>): Promise<PendingAntragEntry> {
  const full: PendingAntragEntry = {
    ...entry,
    id: newId(),
    enqueued_at: new Date().toISOString(),
  };
  const db = idb.getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.PENDING_ANTRAEGE, 'readwrite');
    tx.objectStore(PHASE2_STORES.PENDING_ANTRAEGE).put(full);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return full;
}

export async function listAllPending(idb: IDBStore): Promise<PendingAntragEntry[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.PENDING_ANTRAEGE, 'readonly');
    const req = tx.objectStore(PHASE2_STORES.PENDING_ANTRAEGE).getAll();
    req.onsuccess = () => resolve((req.result as PendingAntragEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function listPendingByAkronym(idb: IDBStore, akronym: string): Promise<PendingAntragEntry[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.PENDING_ANTRAEGE, 'readonly');
    const idx = tx.objectStore(PHASE2_STORES.PENDING_ANTRAEGE).index('akronym');
    const req = idx.getAll(IDBKeyRange.only(akronym));
    req.onsuccess = () => resolve((req.result as PendingAntragEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Löscht alle Pending-Einträge — nur für Dev-Sessions. */
export async function clearAllPending(idb: IDBStore): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.PENDING_ANTRAEGE, 'readwrite');
    tx.objectStore(PHASE2_STORES.PENDING_ANTRAEGE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function deletePending(idb: IDBStore, id: string): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.PENDING_ANTRAEGE, 'readwrite');
    tx.objectStore(PHASE2_STORES.PENDING_ANTRAEGE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export interface RematchOutcome {
  resolved: number;            // wie viele wurden zugeordnet
  remaining: number;           // wie viele bleiben pending
}

/**
 * Versucht alle Pending-Einträge mit dem aktuellen Antrags-/Akronym-Bestand
 * zuzuordnen. Erfolgreich zugeordnete Einträge werden aus dem Bucket
 * entfernt, das zugehörige Manifest-Update auf `relevant` + match_method
 * `pending_antrag` gesetzt.
 */
export async function rematchOnSnapshotReload(
  idb: IDBStore,
  programmId: string,
): Promise<RematchOutcome> {
  const pendings = await listAllPending(idb);
  let resolved = 0;
  let remaining = 0;
  for (const p of pendings) {
    if (p.programm_id && p.programm_id !== programmId) {
      remaining++;
      continue;
    }
    let matchedAz: string | null = null;
    let method: 'fkz' | 'akronym' | null = null;

    // FKZ-Treffer hat Vorrang
    if (p.fkz_candidate) {
      const r = await matchByFkz(idb, p.fkz_candidate);
      if (r.matched_antrag_id) {
        matchedAz = r.matched_antrag_id;
        method = 'fkz';
      }
    }

    // Akronym-Lookup
    if (!matchedAz && p.akronym) {
      const idxEntry = await getAkronymEntry(idb, programmId, p.akronym);
      const candidates = idxEntry?.aktenzeichen ?? [];
      if (candidates.length === 0) {
        // fallback auf programm-übergreifenden Index
        const found = await listAntraegeByAkronym(idb, p.akronym);
        if (found.length === 1 && found[0]) {
          matchedAz = found[0].aktenzeichen;
          method = 'akronym';
        }
      } else if (candidates.length === 1 && candidates[0]) {
        matchedAz = candidates[0];
        method = 'akronym';
      }
      // mehrdeutig → bleibt pending
    }

    if (matchedAz) {
      // Manifest aktualisieren — falls existent
      const existing = await getManifestEntry(idb, p.filename);
      if (existing) {
        const updated: ManifestEntry = {
          ...existing,
          matched_antrag_id: matchedAz,
          match_method: 'pending_antrag',
          match_confidence: method === 'fkz' ? 'high' : 'medium',
          triage_state: 'relevant',
          requires_review: false,
        };
        await putManifestEntry(idb, updated);
      }
      await deletePending(idb, p.id);
      resolved++;
    } else {
      remaining++;
    }
  }
  return { resolved, remaining };
}
