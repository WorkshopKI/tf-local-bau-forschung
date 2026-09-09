/** Antraege: der VOLL-Store. Nicht mit der Slim-Projektion verwechseln (Pitfall #32) — die liegt in antrag-list-view.ts. */
import { IDBStore, CSV_STORES } from '../../storage/idb-store';
import { MAX_WRITES_PER_TX } from '../constants';
import type { Antrag } from '../types';
import { tx, req, waitTx } from './intern';

// ---------- Antraege ----------

export async function putAntraege(idb: IDBStore, antraege: Antrag[]): Promise<void> {
  for (let i = 0; i < antraege.length; i += MAX_WRITES_PER_TX) {
    const chunk = antraege.slice(i, i + MAX_WRITES_PER_TX);
    const t = tx(idb, CSV_STORES.ANTRAEGE, 'readwrite');
    const s = t.objectStore(CSV_STORES.ANTRAEGE);
    for (const a of chunk) s.put(a);
    await waitTx(t);
  }
}

export async function getAntrag(idb: IDBStore, az: string): Promise<Antrag | null> {
  const t = tx(idb, CSV_STORES.ANTRAEGE, 'readonly');
  return (await req(t.objectStore(CSV_STORES.ANTRAEGE).get(az))) ?? null;
}

export async function deleteAntrag(idb: IDBStore, az: string): Promise<void> {
  const t = tx(idb, CSV_STORES.ANTRAEGE, 'readwrite');
  t.objectStore(CSV_STORES.ANTRAEGE).delete(az);
  return waitTx(t);
}

/** Löscht Antraege per aktenzeichen-Key (chunked) — für inkrementelle
 *  Snapshot-Syncs: Records, die im neuen Snapshot nicht mehr vorkommen. */
export async function deleteAntraegeByKeys(idb: IDBStore, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += MAX_WRITES_PER_TX) {
    const chunk = keys.slice(i, i + MAX_WRITES_PER_TX);
    const t = tx(idb, CSV_STORES.ANTRAEGE, 'readwrite');
    const s = t.objectStore(CSV_STORES.ANTRAEGE);
    for (const k of chunk) s.delete(k);
    await waitTx(t);
  }
}

/** Liest Antraege per aktenzeichen-Key (keyed Multi-Get in EINER Transaction) —
 *  für den Delta-Snapshot-Schreiber: nur die geänderten Records, ohne den
 *  14k-Voll-Cursor. Nicht (mehr) vorhandene Keys werden übersprungen. */
export async function getAntraegeByKeys(idb: IDBStore, keys: string[]): Promise<Antrag[]> {
  if (keys.length === 0) return [];
  const t = tx(idb, CSV_STORES.ANTRAEGE, 'readonly');
  const s = t.objectStore(CSV_STORES.ANTRAEGE);
  const results = await Promise.all(keys.map(k => req<Antrag | undefined>(s.get(k))));
  return results.filter((a): a is Antrag => a != null);
}

export async function listAntraegeByProgramm(idb: IDBStore, programmId: string): Promise<Antrag[]> {
  const t = tx(idb, CSV_STORES.ANTRAEGE, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAEGE).index('programm_id');
  return (await req(idx.getAll(programmId))) as Antrag[];
}

/**
 * Iteriert alle Antraege eines Programms per Cursor und ruft `onRecord`
 * **synchron** pro Datensatz. Reihenfolge: aktenzeichen aufsteigend (der
 * `programm_id`-Index liefert pro Index-Key nach Primary-Key = aktenzeichen).
 *
 * Anders als `listAntraegeByProgramm` haelt es NIE alle Records gleichzeitig im
 * Speicher — der Aufrufer serialisiert jeden Record sofort und gibt das volle
 * Objekt zur GC frei. Fuer den Snapshot-Write bei 13k+ Antraegen, der sonst
 * ~470 MB Array-Peak (volle 461-Feld-Records) erzeugt → OOM.
 *
 * WICHTIG: `onRecord` MUSS synchron sein — ein `await` auf ein nicht-IDB-Promise
 * (z.B. FS-Write) wuerde die Transaktion schliessen und den Cursor abbrechen.
 */
export function forEachAntragByProgramm(
  idb: IDBStore,
  programmId: string,
  onRecord: (a: Antrag) => void,
): Promise<void> {
  const t = tx(idb, CSV_STORES.ANTRAEGE, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAEGE).index('programm_id');
  const cursorReq = idx.openCursor(IDBKeyRange.only(programmId));
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (!cursor) return; // fertig — Promise löst über waitTx (t.oncomplete)
    onRecord(cursor.value as Antrag);
    cursor.continue();
  };
  return waitTx(t);
}

/**
 * Gechunkter Bulk-Read der vollen Antraege eines Programms (v2.63.1).
 *
 * `forEachAntragByProgramm` (Cursor) kostet pro Record einen IDB-Roundtrip —
 * bei ~14k Records ~40+ s, waehrend EIN `getAll` dieselben Records in ~2 s
 * deserialisiert (gemessen, pl-Echtdaten). Diese Variante kombiniert beides:
 * Bulk-Speed bei beschraenktem Peak (chunkSize × ~36 KB statt ~470 MB).
 *
 * Mechanik: erst alle Primary-Keys (aktenzeichen) des Programms billig per
 * `index.getAllKeys`, dann pro Chunk ein `store.getAll(bound(first, last))`.
 * Der Bound-Range kann Records FREMDER Programme einschliessen (aktenzeichen
 * ist global unique, andere Programme koennten interleaven) → Filter auf
 * `programm_id`. `onChunk` darf async sein (jeder Chunk ist eine eigene TX).
 * Reihenfolge: aktenzeichen aufsteigend (wie der Cursor).
 */
export async function forEachAntragChunkByProgramm(
  idb: IDBStore,
  programmId: string,
  onChunk: (records: Antrag[]) => void | Promise<void>,
  chunkSize = 500,
): Promise<void> {
  const tKeys = tx(idb, CSV_STORES.ANTRAEGE, 'readonly');
  const keys = (await req(
    tKeys.objectStore(CSV_STORES.ANTRAEGE).index('programm_id').getAllKeys(programmId),
  )) as string[];
  for (let i = 0; i < keys.length; i += chunkSize) {
    const slice = keys.slice(i, i + chunkSize);
    const first = slice[0]!;
    const last = slice[slice.length - 1]!;
    const t = tx(idb, CSV_STORES.ANTRAEGE, 'readonly');
    const records = (await req(
      t.objectStore(CSV_STORES.ANTRAEGE).getAll(IDBKeyRange.bound(first, last)),
    )) as Antrag[];
    await onChunk(records.filter(r => r.programm_id === programmId));
  }
}

/** Billiger Index-Count auf dem vollen ANTRAEGE-Store — fuer den
 *  List-View-Backfill-Check (kein Voll-Load nur fuer einen Laengen-Vergleich,
 *  v2.63: bis dahin lud `ensureListViewProjection` bei JEDEM Start alle
 *  13k vollen Records nur zum Zaehlen). */
export async function countAntraegeByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<number> {
  const t = tx(idb, CSV_STORES.ANTRAEGE, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAEGE).index('programm_id');
  return req(idx.count(programmId));
}

export async function listAntraegeByVerbund(idb: IDBStore, verbundId: string): Promise<Antrag[]> {
  const t = tx(idb, CSV_STORES.ANTRAEGE, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAEGE).index('verbund_id');
  return (await req(idx.getAll(verbundId))) as Antrag[];
}

export async function listAntraegeByAkronym(idb: IDBStore, akronym: string): Promise<Antrag[]> {
  const t = tx(idb, CSV_STORES.ANTRAEGE, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAEGE).index('akronym');
  return (await req(idx.getAll(akronym))) as Antrag[];
}
