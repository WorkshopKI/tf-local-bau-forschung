/** Akronym-Index: Akronym -> Antrag, je Programm. */
import { IDBStore, CSV_STORES } from '../../storage/idb-store';
import type { AkronymIndexEntry } from '../types';
import { tx, req, waitTx } from './intern';

// ---------- Akronym-Index ----------

export async function putAkronymEntry(idb: IDBStore, e: AkronymIndexEntry): Promise<void> {
  const t = tx(idb, CSV_STORES.AKRONYM_INDEX, 'readwrite');
  t.objectStore(CSV_STORES.AKRONYM_INDEX).put(e);
  return waitTx(t);
}

export async function getAkronymEntry(idb: IDBStore, programmId: string, akronym: string): Promise<AkronymIndexEntry | null> {
  const t = tx(idb, CSV_STORES.AKRONYM_INDEX, 'readonly');
  return (await req(t.objectStore(CSV_STORES.AKRONYM_INDEX).get([programmId, akronym]))) ?? null;
}

export async function deleteAkronymEntry(idb: IDBStore, programmId: string, akronym: string): Promise<void> {
  const t = tx(idb, CSV_STORES.AKRONYM_INDEX, 'readwrite');
  t.objectStore(CSV_STORES.AKRONYM_INDEX).delete([programmId, akronym]);
  return waitTx(t);
}
