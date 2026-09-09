/** Unterprogramme (Richtlinien) unterhalb eines Programms. */
import { IDBStore, CSV_STORES } from '../../storage/idb-store';
import type { Unterprogramm } from '../types';
import { tx, req, waitTx } from './intern';

// ---------- Unterprogramme ----------

export async function putUnterprogramm(idb: IDBStore, u: Unterprogramm): Promise<void> {
  const t = tx(idb, CSV_STORES.UNTERPROGRAMME, 'readwrite');
  t.objectStore(CSV_STORES.UNTERPROGRAMME).put(u);
  return waitTx(t);
}

export async function listUnterprogrammeByProgramm(idb: IDBStore, programmId: string): Promise<Unterprogramm[]> {
  const t = tx(idb, CSV_STORES.UNTERPROGRAMME, 'readonly');
  const idx = t.objectStore(CSV_STORES.UNTERPROGRAMME).index('programm_id');
  return (await req(idx.getAll(programmId))) as Unterprogramm[];
}

export async function getUnterprogramm(idb: IDBStore, id: string): Promise<Unterprogramm | null> {
  const t = tx(idb, CSV_STORES.UNTERPROGRAMME, 'readonly');
  return (await req(t.objectStore(CSV_STORES.UNTERPROGRAMME).get(id))) ?? null;
}

export async function deleteUnterprogramm(idb: IDBStore, id: string): Promise<void> {
  const t = tx(idb, CSV_STORES.UNTERPROGRAMME, 'readwrite');
  t.objectStore(CSV_STORES.UNTERPROGRAMME).delete(id);
  return waitTx(t);
}
