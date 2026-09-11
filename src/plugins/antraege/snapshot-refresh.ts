import { markiereBestandGeaendert } from '@/core/services/bestand-generation';
import { listProgramme } from '@/core/services/csv';
import { ensureListViewProjection } from '@/core/services/csv/list-view-migration';
import { holeNeuereFassung } from '@/core/status';
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
  // HIER, nicht unter dem `coldOrMatching`-Ausstieg: die Zeile darüber IST die
  // Aussage „der Bestand hat sich geändert". Der Ausstieg darunter entscheidet
  // nur, ob DIESER Store neu laden muss — die Bestands-Seiten müssten es
  // trotzdem, und ihr Cache bliebe still auf dem alten Stand stehen.
  markiereBestandGeaendert();
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

/**
 * Holt eine neuere Status-Fassung vom Share und zieht nach, was an ihr hängt —
 * am Anfang jeder Datenaktualisierung (`runDataUpdate`, Snapshot-Watcher).
 *
 * Die Fassung bestimmt, wie die App den Bestand LIEST (Kategorien, ZAH-Phasen,
 * Klartexte, To-do-Regeln, Ordner-Spalten). Wechselt sie, ändert sich kein
 * einziger Record — deshalb zieht dieser Schritt selbst nach:
 *  1. die Slim-Projektion, deren `kat_status`-Spalten über die Fassung
 *     aufgelöst werden. `ensureListViewProjection` baut nur neu, wenn sich
 *     dadurch die Signatur ändert (die Fassung steht in ihr);
 *  2. den Anträge-Store samt Bestands-Generation: die Seiten zeichnen neu und
 *     ihre Caches (Bestandslauf, Vorgangs-Regeln) lesen die neue Fassung. Ohne
 *     das hielte eine offene Seite die alte bis zum nächsten Neuzeichnen fest.
 *
 * VOR dem Snapshot-Sync aufrufen: ein neuer Datenbestand projiziert dann gleich
 * mit der neuen Fassung. Best-effort, wirft nicht.
 *
 * @returns die neue Fassungsnummer oder `null`, wenn nichts gewechselt hat.
 */
export async function zieheFassungNach(idb: IDBStore): Promise<number | null> {
  const neu = await holeNeuereFassung(idb);
  if (neu === null) return null;
  try {
    await ensureListViewProjection(idb);
  } catch (err) {
    console.warn('[fassung] Ordner-Spalten konnten nicht neu projiziert werden', err);
  }
  try {
    for (const p of await listProgramme(idb)) {
      await refreshAntraegeStoreAfterSync(idb, p.id, ['antraege', 'verbuende']);
    }
  } catch (err) {
    console.warn('[fassung] Anträge konnten nicht nachgeladen werden', err);
  }
  console.info(`[fassung] Status-Fassung ${neu} vom Share übernommen`);
  return neu;
}
