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
import type { MappingVersion, StatusFeldEintrag, UnkuratierterFund } from './typen';
import { STATUS_KATALOG_STORE } from './stores';
import { baueSeedVersion } from './seed';

const AKTIV_KEY = 'status-katalog:aktiv';
const UNKURATIERT_KEY = 'status-katalog:unkuratiert';
const UNKURATIERT_FELDER_KEY = 'status-katalog:unkuratierte-felder';

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
 * Die gespeicherte aktive Fassung — oder `null`, wenn noch keine abgelegt ist.
 * Reiner Lesepfad ohne Seiteneffekt.
 */
export async function ladeGespeicherteFassung(idb: IDBStore): Promise<MappingVersion | null> {
  const nr = await getAktiveVersionsnummer(idb);
  if (nr == null) return null;
  return getVersion(idb, nr);
}

/**
 * Die aktive Katalog-Version zum LESEN. Ohne gespeicherte Fassung ist das der
 * Seed — als Rückfall, **nicht** als abgelegte Fassung.
 *
 * **Lesen schreibt hier nichts** (seit v4.85.1). Bis dahin legte dieser Aufruf
 * den Seed als Fassung 1 ab und aktivierte ihn. Das lief am Kaltstart schief:
 * `ensureListViewProjection` und `initStatusKatalog` rufen ihn, BEVOR der
 * Ordner-Picker gelaufen ist — der Seed wurde also festgeschrieben, während der
 * Share nur noch nicht lesbar war. Damit galt auf einer frischen Installation
 * der Auslieferungsstand als kuratierte Fassung 1, und ein Speichern im Cockpit
 * konnte ihn über die Team-Fassung veröffentlichen. Wer eine wirklich
 * **abgelegte** Fassung braucht (Fassungsliste, Reaktivieren), ruft
 * {@link sorgeFuerGespeicherteFassung}.
 */
export async function ladeAktiveVersion(idb: IDBStore): Promise<MappingVersion> {
  return (await ladeGespeicherteFassung(idb)) ?? baueSeedVersion();
}

/**
 * Wie {@link ladeAktiveVersion}, legt den Seed aber als Fassung 1 ab und
 * aktiviert ihn, wenn noch nichts gespeichert ist — ab dann ist die gespeicherte
 * Fassung maßgeblich (Editor-Änderungen überleben Neustarts).
 *
 * Genau ein Aufrufer: das Status-Cockpit beim Öffnen. Dort hängt die Oberfläche
 * an einer abgelegten Fassung (Versionsliste, Rückweg auf eine ältere Nummer),
 * und wer das Cockpit öffnet, hat den Ordner längst freigegeben.
 */
export async function sorgeFuerGespeicherteFassung(idb: IDBStore): Promise<MappingVersion> {
  const gespeichert = await ladeGespeicherteFassung(idb);
  if (gespeichert) return gespeichert;
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

/**
 * Zweiter Puffer: Statusspalten, die in den CSV-Quellen stehen, aber im Katalog
 * fehlen. Ebenfalls gerätelokal — er hält fest, was DIESE Installation in IHREN
 * Programm-Schemas gesehen hat; ein anderer Rechner mit anderen Programmen
 * findet andere Spalten.
 */
export async function ladeUnkuratierteFelder(idb: IDBStore): Promise<StatusFeldEintrag[]> {
  return (await idb.get<StatusFeldEintrag[]>(UNKURATIERT_FELDER_KEY)) ?? [];
}

export async function speichereUnkuratierteFelder(
  idb: IDBStore, felder: StatusFeldEintrag[],
): Promise<void> {
  await idb.set(UNKURATIERT_FELDER_KEY, felder);
}
