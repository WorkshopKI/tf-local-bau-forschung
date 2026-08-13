import { useAntraegeStore } from './store';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SnapshotStoreName } from '@/core/services/csv/snapshot';

/**
 * Lädt den Antraege-Store neu, wenn ein Snapshot-Sync das aktuell angezeigte
 * Programm betraf. Verhindert die „leere Homepage bis Reload": Nach einem
 * Snapshot-Sync stehen die Anträge in IDB, aber der In-Memory-Store wird sonst
 * nicht aktualisiert (TTL-Skip greift ohne `force`).
 *
 * Reload-Bedingung: der Sync betraf das gerade angezeigte Programm
 * (`store.programmId === programmId`) ODER der Store ist noch leer/uninitialisiert.
 * Letzteres deckt den Cold-Start ab: im Race ist `store.programmId` zum Zeitpunkt
 * des Sync-Refresh noch `null` (HomePages erster `loadAll` setzt die ID erst danach),
 * bzw. der Erst-`loadAll` las die noch leere IDB. Früher wurde hier auf
 * „HomePages Mount lädt ohnehin frisch" vertraut — das stimmt aber nicht, wenn der
 * leere Erst-Load den 5-Min-TTL armt: dann blieb die UI bis zum manuellen Reload
 * leer (v2.21.3). Bei leerem Store gibt es kein stale-UI-Risiko, also reloaden.
 */
export async function refreshAntraegeStoreAfterSync(
  idb: IDBStore,
  programmId: string,
  reloadedStores: readonly SnapshotStoreName[],
): Promise<void> {
  if (!reloadedStores.includes('antraege') && !reloadedStores.includes('verbuende')) return;
  const store = useAntraegeStore.getState();
  const coldOrMatching =
    store.programmId === programmId
    || store.programmId === null
    || store.antraege.length === 0;
  if (!coldOrMatching) return;
  // Der Netzwerk-Namen-Index wird EINMAL pro Session gelatcht und von
  // `loadAll(force)` nicht angefasst — ein im Nacht-Export neu hinzugekommenes
  // Netzwerk hieße sonst bis zum Browser-Reload „Netzwerk 1062".
  store.resetNetzwerkNameIndex();
  await store.loadAll(idb, programmId, { force: true });
}
