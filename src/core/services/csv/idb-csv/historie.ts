/** Antrags-Historie (append-only). */
import { IDBStore, CSV_STORES } from '../../storage/idb-store';
import type { AntragHistorieEntry } from '../types';
import { tx, req, waitTx } from './intern';

// ---------- Historie ----------

export async function appendHistory(idb: IDBStore, entries: AntragHistorieEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const t = tx(idb, CSV_STORES.ANTRAG_HISTORIE, 'readwrite');
  const s = t.objectStore(CSV_STORES.ANTRAG_HISTORIE);
  for (const e of entries) s.put(e);
  return waitTx(t);
}

export async function getHistoryByAz(idb: IDBStore, az: string): Promise<AntragHistorieEntry[]> {
  const t = tx(idb, CSV_STORES.ANTRAG_HISTORIE, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAG_HISTORIE).index('aktenzeichen');
  return (await req(idx.getAll(az))) as AntragHistorieEntry[];
}
