/**
 * IDB-CRUD für den dedizierten Gedächtnis-Store (IDBStore v10).
 *
 * KeyPath `id`, Sekundär-Indexe `block` + `aktualisiert`. Reine Persistenz — die
 * Gate-/Opt-in-Logik lebt ausschließlich in recorder.ts, die Operations-Logik in
 * operationen.ts. Vorbild: assistent/protokoll/store.ts.
 *
 * WICHTIG (Invariante 1): Diese Datei schreibt NUR in die lokale IndexedDB —
 * kein `atomicWrite`, kein Sync, keine Share-Berührung.
 */

import type { IDBStore } from '../../storage/idb-store';
import { GEDAECHTNIS_STORE } from './types';
import type { GedaechtnisEintrag } from './types';

const AKTUALISIERT_INDEX = 'aktualisiert';

/** Alle Einträge (aktive + invalidierte). */
export async function alleEintraege(idb: IDBStore): Promise<GedaechtnisEintrag[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GEDAECHTNIS_STORE, 'readonly');
    const req = tx.objectStore(GEDAECHTNIS_STORE).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as GedaechtnisEintrag[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Schreibt einen Stapel Einträge (put — legt an ODER überschreibt) in EINER
 * Transaktion. Der Konsolidierungslauf berechnet den Ziel-Bestand vollständig
 * (rein, in operationen.ts) und persistiert ihn hier atomar.
 */
export async function schreibeStapel(idb: IDBStore, eintraege: GedaechtnisEintrag[]): Promise<void> {
  if (eintraege.length === 0) return;
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GEDAECHTNIS_STORE, 'readwrite');
    const store = tx.objectStore(GEDAECHTNIS_STORE);
    for (const e of eintraege) store.put(e);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Löscht EINEN Eintrag hart (Nutzer-Souveränität). */
export async function loescheEintrag(idb: IDBStore, id: string): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GEDAECHTNIS_STORE, 'readwrite');
    tx.objectStore(GEDAECHTNIS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Löscht ALLE Einträge („Alles vergessen"). Liefert die Anzahl gelöschter Einträge. */
export async function loescheAlle(idb: IDBStore): Promise<number> {
  const db = idb.getDb();
  const anzahl = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(GEDAECHTNIS_STORE, 'readonly');
    const req = tx.objectStore(GEDAECHTNIS_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(GEDAECHTNIS_STORE, 'readwrite');
    tx.objectStore(GEDAECHTNIS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return anzahl;
}

/**
 * Entfernt INVALIDIERTE Einträge mit `aktualisiert < cutoff` (deterministische
 * Retention). Aktive Einträge bleiben unberührt. Liefert die Anzahl gelöschter
 * Einträge. Cursor über den `aktualisiert`-Index (upperBound, offen).
 */
export async function entferneInvalidierteAelterAls(idb: IDBStore, cutoff: number): Promise<number> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GEDAECHTNIS_STORE, 'readwrite');
    const idx = tx.objectStore(GEDAECHTNIS_STORE).index(AKTUALISIERT_INDEX);
    const req = idx.openCursor(IDBKeyRange.upperBound(cutoff, true));
    let geloescht = 0;
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const e = cursor.value as GedaechtnisEintrag;
        if (e.status === 'invalidiert') {
          cursor.delete();
          geloescht++;
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(geloescht);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
