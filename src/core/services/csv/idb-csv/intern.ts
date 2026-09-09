/**
 * Transaktions-Helfer der CSV-Stores — modul-intern.
 *
 * Bewusst NICHT ueber index.ts exportiert: sie sind das Innenleben dieses
 * Ordners, kein Teil seines Vertrags nach aussen.
 */
import type { IDBStore, CsvStoreName } from '../../storage/idb-store';

export function tx(
  idb: IDBStore, stores: CsvStoreName | CsvStoreName[], mode: IDBTransactionMode,
): IDBTransaction {
  return idb.getDb().transaction(stores, mode);
}

export function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function waitTx(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
