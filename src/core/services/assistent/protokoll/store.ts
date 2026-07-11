/**
 * IDB-CRUD für den dedizierten Ereignisprotokoll-Store (IDBStore v9).
 *
 * KeyPath `id`, Sekundär-Index `zeitstempel`. Append-orientiert; Retention läuft
 * über den Zeitstempel-Index (Cursor). Reine Persistenz — die Gate-/Opt-in-Logik
 * lebt ausschließlich in recorder.ts. Vorbild: src/phase2/scanner/manifest-store.ts
 * (nutzt `idb.getDb()`, kein eigener DB-Connect).
 *
 * WICHTIG (Invariante 1): Diese Datei schreibt NUR in die lokale IndexedDB —
 * kein `atomicWrite`, kein Sync, keine Share-Berührung.
 */

import type { IDBStore } from '../../storage/idb-store';
import { EREIGNISPROTOKOLL_STORE } from './types';
import type { AssistentEreignis, ProtokollStatistik } from './types';

const ZEIT_INDEX = 'zeitstempel';

/** Hängt ein Ereignis an (add — id ist eindeutig). */
export async function appendEreignis(idb: IDBStore, ereignis: AssistentEreignis): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EREIGNISPROTOKOLL_STORE, 'readwrite');
    tx.objectStore(EREIGNISPROTOKOLL_STORE).add(ereignis);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Liefert Ereignisse nach Zeit sortiert. `richtung: 'prev'` = neueste zuerst
 * (für die „letzte 100"-Ansicht), `'next'` = älteste zuerst (für Export).
 */
export async function listeNachZeit(
  idb: IDBStore,
  limit?: number,
  richtung: 'prev' | 'next' = 'prev',
): Promise<AssistentEreignis[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EREIGNISPROTOKOLL_STORE, 'readonly');
    const idx = tx.objectStore(EREIGNISPROTOKOLL_STORE).index(ZEIT_INDEX);
    const req = idx.openCursor(null, richtung);
    const out: AssistentEreignis[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && (limit == null || out.length < limit)) {
        out.push(cursor.value as AssistentEreignis);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Ereignisse mit `zeitstempel > ab` (aufsteigend). `ab = null` → alle.
 * Für die Gedächtnis-Konsolidierung (Phase 2): neue Ereignisse seit Wasserzeichen.
 */
export async function ladeSeit(idb: IDBStore, ab: number | null): Promise<AssistentEreignis[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EREIGNISPROTOKOLL_STORE, 'readonly');
    const idx = tx.objectStore(EREIGNISPROTOKOLL_STORE).index(ZEIT_INDEX);
    const range = ab == null ? null : IDBKeyRange.lowerBound(ab, true);
    const req = idx.openCursor(range, 'next');
    const out: AssistentEreignis[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out.push(cursor.value as AssistentEreignis);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Gesamtzahl der Ereignisse. */
export async function zaehle(idb: IDBStore): Promise<number> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EREIGNISPROTOKOLL_STORE, 'readonly');
    const req = tx.objectStore(EREIGNISPROTOKOLL_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Aggregat in EINEM Cursor-Pass über den Zeitstempel-Index (aufsteigend):
 * Gesamtzahl, je-Typ-Zähler, ältester/neuester Zeitstempel.
 */
export async function statistik(idb: IDBStore): Promise<ProtokollStatistik> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EREIGNISPROTOKOLL_STORE, 'readonly');
    const idx = tx.objectStore(EREIGNISPROTOKOLL_STORE).index(ZEIT_INDEX);
    const req = idx.openCursor(null, 'next');
    const jeTyp: Record<string, number> = {};
    let gesamt = 0;
    let aeltester: number | null = null;
    let neuester: number | null = null;
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const ev = cursor.value as AssistentEreignis;
        gesamt++;
        jeTyp[ev.typ] = (jeTyp[ev.typ] ?? 0) + 1;
        if (aeltester == null) aeltester = ev.zeitstempel; // erster = ältester (aufsteigend)
        neuester = ev.zeitstempel; // letzter = neuester
        cursor.continue();
      } else {
        resolve({ gesamt, jeTyp, aeltester, neuester });
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Löscht alle Ereignisse mit `zeitstempel < cutoff`. Liefert die Anzahl der
 * gelöschten Einträge. Cursor über den Zeitstempel-Index (upperBound, offen).
 */
export async function loescheAelterAls(idb: IDBStore, cutoff: number): Promise<number> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EREIGNISPROTOKOLL_STORE, 'readwrite');
    const idx = tx.objectStore(EREIGNISPROTOKOLL_STORE).index(ZEIT_INDEX);
    const req = idx.openCursor(IDBKeyRange.upperBound(cutoff, true));
    let geloescht = 0;
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        geloescht++;
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(geloescht);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Kappt auf `max` Einträge — ältester zuerst. Liefert die Anzahl der gelöschten
 * Einträge. No-op, wenn die Gesamtzahl <= max.
 */
export async function kapazitaetKappen(idb: IDBStore, max: number): Promise<number> {
  const gesamt = await zaehle(idb);
  const zuLoeschen = gesamt - max;
  if (zuLoeschen <= 0) return 0;
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EREIGNISPROTOKOLL_STORE, 'readwrite');
    const idx = tx.objectStore(EREIGNISPROTOKOLL_STORE).index(ZEIT_INDEX);
    const req = idx.openCursor(null, 'next'); // aufsteigend = ältester zuerst
    let geloescht = 0;
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && geloescht < zuLoeschen) {
        cursor.delete();
        geloescht++;
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(geloescht);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Löscht ALLE Ereignisse. Liefert die Anzahl der gelöschten Einträge. */
export async function loescheAlle(idb: IDBStore): Promise<number> {
  const anzahl = await zaehle(idb);
  const db = idb.getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(EREIGNISPROTOKOLL_STORE, 'readwrite');
    tx.objectStore(EREIGNISPROTOKOLL_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return anzahl;
}
