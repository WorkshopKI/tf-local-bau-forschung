/** Verbuende und ihre Historie. */
import { IDBStore, CSV_STORES } from '../../storage/idb-store';
import type { Verbund, VerbundHistorieEntry } from '../types';
import { tx, req, waitTx } from './intern';

// ---------- Verbuende ----------

export async function putVerbund(idb: IDBStore, v: Verbund): Promise<void> {
  const t = tx(idb, CSV_STORES.VERBUENDE, 'readwrite');
  t.objectStore(CSV_STORES.VERBUENDE).put(v);
  return waitTx(t);
}

export async function getVerbund(idb: IDBStore, id: string): Promise<Verbund | null> {
  const t = tx(idb, CSV_STORES.VERBUENDE, 'readonly');
  return (await req(t.objectStore(CSV_STORES.VERBUENDE).get(id))) ?? null;
}

export async function deleteVerbund(idb: IDBStore, id: string): Promise<void> {
  const t = tx(idb, CSV_STORES.VERBUENDE, 'readwrite');
  t.objectStore(CSV_STORES.VERBUENDE).delete(id);
  return waitTx(t);
}

// ---------- Verbund-Historie ----------

export async function appendVerbundHistory(idb: IDBStore, entries: VerbundHistorieEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const t = tx(idb, CSV_STORES.VERBUND_HISTORIE, 'readwrite');
  const s = t.objectStore(CSV_STORES.VERBUND_HISTORIE);
  for (const e of entries) s.put(e);
  return waitTx(t);
}

export async function getVerbundHistoryByVerbund(idb: IDBStore, verbundId: string): Promise<VerbundHistorieEntry[]> {
  const t = tx(idb, CSV_STORES.VERBUND_HISTORIE, 'readonly');
  const idx = t.objectStore(CSV_STORES.VERBUND_HISTORIE).index('verbund_id');
  return (await req(idx.getAll(verbundId))) as VerbundHistorieEntry[];
}
