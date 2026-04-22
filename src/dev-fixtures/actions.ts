/**
 * Einzel-Aktionen außerhalb kompletter Szenarien — nützlich im Dev-Panel.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import { CSV_STORES, FILTER_STORE_NAME } from '@/core/services/storage/idb-store';
import type { UserProfile } from '@/core/types/config';
import { features } from '@/config/feature-flags';
import { maybeReloadAfterDestructive } from './reloadToast';

function assertDevFixtures(): void {
  if (!__TEAMFLOW_DEV_FIXTURES__ || !features.devFixtures) {
    throw new Error('dev-fixtures: action aufgerufen ohne aktive features.devFixtures.');
  }
}

function clearObjectStore(idb: IDBStore, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = idb.getDb();
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getAll<T>(idb: IDBStore, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const db = idb.getDb();
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/** Leert ausschließlich die CSV-bezogenen Stores + Filter-Store (keine Session, keine Handles). */
export async function clearAllCsvSources(idb: IDBStore): Promise<void> {
  assertDevFixtures();
  for (const name of Object.values(CSV_STORES) as string[]) {
    await clearObjectStore(idb, name);
  }
  await clearObjectStore(idb, FILTER_STORE_NAME);
  await maybeReloadAfterDestructive('CSV-Daten geleert');
}

/** Setzt profile.is_kurator = true und persistiert. */
export async function setKuratorOn(idb: IDBStore): Promise<void> {
  assertDevFixtures();
  const profile = await idb.get<UserProfile>('profile');
  if (!profile) throw new Error('Kein Profil vorhanden — Onboarding zuerst durchlaufen.');
  await idb.set('profile', { ...profile, is_kurator: true });
  await maybeReloadAfterDestructive('Kurator-Flag aktiviert');
}

/** Setzt profile.is_kurator = false und persistiert. */
export async function setKuratorOff(idb: IDBStore): Promise<void> {
  assertDevFixtures();
  const profile = await idb.get<UserProfile>('profile');
  if (!profile) throw new Error('Kein Profil vorhanden — Onboarding zuerst durchlaufen.');
  await idb.set('profile', { ...profile, is_kurator: false });
  await maybeReloadAfterDestructive('Kurator-Flag deaktiviert');
}

/** Dumpt Counts aller Stores + Sample der ersten Zeilen. */
export interface StateDump {
  generated_at: string;
  kv_keys: string[];
  stores: Record<string, { count: number; sample: unknown[] }>;
}

export async function exportCurrentState(idb: IDBStore): Promise<StateDump> {
  assertDevFixtures();
  const kv_keys = await idb.keys();
  const stores: StateDump['stores'] = {};
  const storeNames = [...Object.values(CSV_STORES), FILTER_STORE_NAME] as string[];
  for (const name of storeNames) {
    const items = await getAll<unknown>(idb, name);
    stores[name] = {
      count: items.length,
      sample: items.slice(0, 3),
    };
  }
  return {
    generated_at: new Date().toISOString(),
    kv_keys,
    stores,
  };
}
