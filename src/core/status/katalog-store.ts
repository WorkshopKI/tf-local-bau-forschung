/**
 * Lokaler Cache des Status-Katalogs (pro Build-Variante).
 *
 * - Mapping-Versionen liegen im dedizierten Store `status_katalog` (KeyPath
 *   `version`) — beliebig viele, aktivierbar, nie mutiert.
 * - Der Zeiger auf die aktive Version und der Unkuratiert-Puffer liegen als
 *   `kv`-Keys (`status-katalog:aktiv`, `status-katalog:unkuratiert`) — kein
 *   Index nötig.
 *
 * **Quelle der Wahrheit ist seit v2.332 der Daten-Share** — die Team-Fassung
 * liegt als Sidecar (`katalog-share.ts`) und wird beim App-Start hierher
 * gespiegelt. Dieses Modul kennt den Share nicht; es bleibt reine IDB-Schicht,
 * damit der heiße Import-Pfad (Reconcile, Auto-Discovery) nie SMB anfasst.
 *
 * Der **Unkuratiert-Puffer bleibt gerätelokal**: er hält fest, was DIESE
 * Installation beim Import gesehen hat.
 *
 * Raw-Transaktionen über `idb.getDb()` (Vorbild: assistent/protokoll/store.ts).
 */
import type { IDBStore } from '@/core/services/storage';
import type { MappingVersion, UnkuratierterFund } from './typen';
import { STATUS_KATALOG_STORE } from './stores';
import { baueSeedVersion } from './seed';

const AKTIV_KEY = 'status-katalog:aktiv';
const UNKURATIERT_KEY = 'status-katalog:unkuratiert';

/** Alle gespeicherten Versionen, aufsteigend nach Versionsnummer. */
export async function listeVersionen(idb: IDBStore): Promise<MappingVersion[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATUS_KATALOG_STORE, 'readonly');
    const req = tx.objectStore(STATUS_KATALOG_STORE).getAll();
    req.onsuccess = () =>
      resolve((req.result as MappingVersion[]).sort((a, b) => a.version - b.version));
    req.onerror = () => reject(req.error);
  });
}

export async function getVersion(idb: IDBStore, version: number): Promise<MappingVersion | null> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATUS_KATALOG_STORE, 'readonly');
    const req = tx.objectStore(STATUS_KATALOG_STORE).get(version);
    req.onsuccess = () => resolve((req.result as MappingVersion | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Legt eine Versionsfassung ab (put — Versionsnummer ist der Key). */
export async function speichereVersion(idb: IDBStore, version: MappingVersion): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATUS_KATALOG_STORE, 'readwrite');
    tx.objectStore(STATUS_KATALOG_STORE).put(version);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAktiveVersionsnummer(idb: IDBStore): Promise<number | null> {
  return idb.get<number>(AKTIV_KEY);
}

export async function setzeAktiv(idb: IDBStore, version: number): Promise<void> {
  await idb.set(AKTIV_KEY, version);
}

/**
 * Lädt die aktive Katalog-Version. Beim allerersten Aufruf ohne gespeicherten
 * Katalog wird der Seed (Version 1) geschrieben und aktiviert — ab dann ist die
 * gespeicherte Fassung maßgeblich (Editor-Änderungen überleben Neustarts).
 */
export async function ladeAktiveVersion(idb: IDBStore): Promise<MappingVersion> {
  const nr = await getAktiveVersionsnummer(idb);
  if (nr != null) {
    const v = await getVersion(idb, nr);
    if (v) return v;
  }
  const seed = baueSeedVersion();
  await speichereVersion(idb, seed);
  await setzeAktiv(idb, seed.version);
  return seed;
}

/** Nächste freie Versionsnummer (max + 1, mindestens 2). */
export async function naechsteVersionsnummer(idb: IDBStore): Promise<number> {
  const alle = await listeVersionen(idb);
  return alle.reduce((m, v) => Math.max(m, v.version), 1) + 1;
}

// --- Unkuratiert-Puffer -----------------------------------------------------

export async function ladeUnkuratiert(idb: IDBStore): Promise<UnkuratierterFund[]> {
  return (await idb.get<UnkuratierterFund[]>(UNKURATIERT_KEY)) ?? [];
}

export async function speichereUnkuratiert(
  idb: IDBStore, funde: UnkuratierterFund[],
): Promise<void> {
  await idb.set(UNKURATIERT_KEY, funde);
}
