import { useAntraegeStore } from './store';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SnapshotStoreName } from '@/core/services/csv/snapshot';

/**
 * Lädt den Antraege-Store neu, wenn ein Snapshot-Sync das aktuell angezeigte
 * Programm betraf. Verhindert die „leere Homepage bis Reload": Nach einem
 * Snapshot-Sync stehen die Anträge in IDB, aber der In-Memory-Store wird sonst
 * nicht aktualisiert (TTL-Skip greift ohne `force`).
 *
 * Strict-Equality auf `programmId`: Sobald der User die (leere) Homepage sieht,
 * hat HomePages eigener Load `store.programmId` bereits auf das aktive Programm
 * gesetzt — der Sync schreibt genau dieses → Reload greift. Ist der Store noch
 * leer (`programmId === null`), gibt es keine stale UI und HomePages Mount lädt
 * ohnehin frisch; ein Reload auf ein evtl. nicht-aktives Programm wird vermieden.
 */
export async function refreshAntraegeStoreAfterSync(
  idb: IDBStore,
  programmId: string,
  reloadedStores: readonly SnapshotStoreName[],
): Promise<void> {
  if (!reloadedStores.includes('antraege') && !reloadedStores.includes('verbuende')) return;
  const store = useAntraegeStore.getState();
  if (store.programmId !== programmId) return;
  await store.loadAll(idb, programmId, { force: true });
}
