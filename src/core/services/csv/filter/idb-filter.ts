import { IDBStore, FILTER_STORE_NAME } from '../../storage/idb-store';
import type { FilterDefinition, UserPreset, FilterScope } from './types';
import { userPresetsKey } from './constants';

function tx(idb: IDBStore, mode: IDBTransactionMode): IDBTransaction {
  return idb.getDb().transaction(FILTER_STORE_NAME, mode);
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function waitTx(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function putFilter(idb: IDBStore, f: FilterDefinition): Promise<void> {
  const t = tx(idb, 'readwrite');
  t.objectStore(FILTER_STORE_NAME).put(f);
  return waitTx(t);
}

export async function getFilter(idb: IDBStore, id: string): Promise<FilterDefinition | null> {
  const t = tx(idb, 'readonly');
  return (await req(t.objectStore(FILTER_STORE_NAME).get(id))) ?? null;
}

export async function listFiltersByProgramm(idb: IDBStore, programmId: string): Promise<FilterDefinition[]> {
  const t = tx(idb, 'readonly');
  const idx = t.objectStore(FILTER_STORE_NAME).index('programm_id');
  return (await req(idx.getAll(programmId))) as FilterDefinition[];
}

export async function listFiltersByScope(
  idb: IDBStore,
  programmId: string,
  scope: FilterScope,
): Promise<FilterDefinition[]> {
  const all = await listFiltersByProgramm(idb, programmId);
  return all.filter(f => f.scope === scope);
}

export async function deleteFilterDef(idb: IDBStore, id: string): Promise<void> {
  const t = tx(idb, 'readwrite');
  t.objectStore(FILTER_STORE_NAME).delete(id);
  return waitTx(t);
}

// User-Presets: KV-Store (bestehender kv-store)

export async function getUserPresets(idb: IDBStore, programmId: string): Promise<UserPreset[]> {
  const existing = await idb.get<UserPreset[]>(userPresetsKey(programmId));
  return existing ?? [];
}

export async function setUserPresets(
  idb: IDBStore,
  programmId: string,
  presets: UserPreset[],
): Promise<void> {
  await idb.set(userPresetsKey(programmId), presets);
}
