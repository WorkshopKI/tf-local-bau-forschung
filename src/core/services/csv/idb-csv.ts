import { IDBStore, CSV_STORES, type CsvStoreName } from '../storage/idb-store';
import { MAX_WRITES_PER_TX } from './constants';
import type {
  Programm,
  Unterprogramm,
  CsvSchema,
  CsvRowHash,
  Antrag,
  AntragListItem,
  AntragHistorieEntry,
  Verbund,
  VerbundHistorieEntry,
  AkronymIndexEntry,
} from './types';

function tx(idb: IDBStore, stores: CsvStoreName | CsvStoreName[], mode: IDBTransactionMode): IDBTransaction {
  return idb.getDb().transaction(stores, mode);
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

// ---------- Programme ----------

export async function putProgramm(idb: IDBStore, p: Programm): Promise<void> {
  const t = tx(idb, CSV_STORES.PROGRAMME, 'readwrite');
  t.objectStore(CSV_STORES.PROGRAMME).put(p);
  return waitTx(t);
}

export async function getProgramm(idb: IDBStore, id: string): Promise<Programm | null> {
  const t = tx(idb, CSV_STORES.PROGRAMME, 'readonly');
  return (await req(t.objectStore(CSV_STORES.PROGRAMME).get(id))) ?? null;
}

export async function listProgramme(idb: IDBStore): Promise<Programm[]> {
  const t = tx(idb, CSV_STORES.PROGRAMME, 'readonly');
  return (await req(t.objectStore(CSV_STORES.PROGRAMME).getAll())) as Programm[];
}

/**
 * Roh-Delete eines Programm-Records. Macht KEINE Cascade — Aufrufer
 * (`programmRegistry.deleteProgramm`) ist verantwortlich für die Sicherheits-
 * Checks (0 Anträge, nicht das einzige Programm).
 */
export async function deleteProgrammRecord(idb: IDBStore, id: string): Promise<void> {
  const t = tx(idb, CSV_STORES.PROGRAMME, 'readwrite');
  t.objectStore(CSV_STORES.PROGRAMME).delete(id);
  return waitTx(t);
}

// ---------- Unterprogramme ----------

export async function putUnterprogramm(idb: IDBStore, u: Unterprogramm): Promise<void> {
  const t = tx(idb, CSV_STORES.UNTERPROGRAMME, 'readwrite');
  t.objectStore(CSV_STORES.UNTERPROGRAMME).put(u);
  return waitTx(t);
}

export async function listUnterprogrammeByProgramm(idb: IDBStore, programmId: string): Promise<Unterprogramm[]> {
  const t = tx(idb, CSV_STORES.UNTERPROGRAMME, 'readonly');
  const idx = t.objectStore(CSV_STORES.UNTERPROGRAMME).index('programm_id');
  return (await req(idx.getAll(programmId))) as Unterprogramm[];
}

export async function getUnterprogramm(idb: IDBStore, id: string): Promise<Unterprogramm | null> {
  const t = tx(idb, CSV_STORES.UNTERPROGRAMME, 'readonly');
  return (await req(t.objectStore(CSV_STORES.UNTERPROGRAMME).get(id))) ?? null;
}

export async function deleteUnterprogramm(idb: IDBStore, id: string): Promise<void> {
  const t = tx(idb, CSV_STORES.UNTERPROGRAMME, 'readwrite');
  t.objectStore(CSV_STORES.UNTERPROGRAMME).delete(id);
  return waitTx(t);
}

// ---------- Schemas ----------

export async function putSchema(idb: IDBStore, s: CsvSchema): Promise<void> {
  const t = tx(idb, CSV_STORES.CSV_SCHEMAS, 'readwrite');
  t.objectStore(CSV_STORES.CSV_SCHEMAS).put(s);
  return waitTx(t);
}

export async function getSchema(idb: IDBStore, id: string): Promise<CsvSchema | null> {
  const t = tx(idb, CSV_STORES.CSV_SCHEMAS, 'readonly');
  return (await req(t.objectStore(CSV_STORES.CSV_SCHEMAS).get(id))) ?? null;
}

export async function listSchemasByProgramm(idb: IDBStore, programmId: string): Promise<CsvSchema[]> {
  const t = tx(idb, CSV_STORES.CSV_SCHEMAS, 'readonly');
  const idx = t.objectStore(CSV_STORES.CSV_SCHEMAS).index('programm_id');
  return (await req(idx.getAll(programmId))) as CsvSchema[];
}

export async function deleteSchema(idb: IDBStore, id: string): Promise<void> {
  const t = tx(idb, CSV_STORES.CSV_SCHEMAS, 'readwrite');
  t.objectStore(CSV_STORES.CSV_SCHEMAS).delete(id);
  return waitTx(t);
}

// ---------- Row hashes ----------

export async function putRowHashes(idb: IDBStore, hashes: CsvRowHash[]): Promise<void> {
  for (let i = 0; i < hashes.length; i += MAX_WRITES_PER_TX) {
    const chunk = hashes.slice(i, i + MAX_WRITES_PER_TX);
    const t = tx(idb, CSV_STORES.CSV_ROW_HASHES, 'readwrite');
    const s = t.objectStore(CSV_STORES.CSV_ROW_HASHES);
    for (const h of chunk) s.put(h);
    await waitTx(t);
  }
}

export async function deleteRowHashes(idb: IDBStore, schemaId: string, joinValues: string[]): Promise<void> {
  for (let i = 0; i < joinValues.length; i += MAX_WRITES_PER_TX) {
    const chunk = joinValues.slice(i, i + MAX_WRITES_PER_TX);
    const t = tx(idb, CSV_STORES.CSV_ROW_HASHES, 'readwrite');
    const s = t.objectStore(CSV_STORES.CSV_ROW_HASHES);
    for (const jv of chunk) s.delete([schemaId, jv]);
    await waitTx(t);
  }
}

export async function getRowHashesForSchema(idb: IDBStore, schemaId: string): Promise<CsvRowHash[]> {
  const t = tx(idb, CSV_STORES.CSV_ROW_HASHES, 'readonly');
  const idx = t.objectStore(CSV_STORES.CSV_ROW_HASHES).index('csv_schema_id');
  return (await req(idx.getAll(schemaId))) as CsvRowHash[];
}

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

// ---------- Antraege List-View (Phase 2 / Slim-Projektion) ----------

export async function putAntraegeListView(
  idb: IDBStore,
  items: AntragListItem[],
): Promise<void> {
  for (let i = 0; i < items.length; i += MAX_WRITES_PER_TX) {
    const chunk = items.slice(i, i + MAX_WRITES_PER_TX);
    const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readwrite');
    const s = t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW);
    for (const it of chunk) s.put(it);
    await waitTx(t);
  }
}

/** Leert die gesamte Slim-Projektion. Für den vollständigen Neuaufbau nach
 *  einem Snapshot-Sync (der den ANTRAEGE-Store via replaceStore komplett
 *  ersetzt, die List-View aber nicht berührt). */
export async function clearAntraegeListView(idb: IDBStore): Promise<void> {
  const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readwrite');
  t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW).clear();
  return waitTx(t);
}

export async function listAntraegeListViewByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<AntragListItem[]> {
  const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW).index('programm_id');
  return (await req(idx.getAll(programmId))) as AntragListItem[];
}

/** Programm-uebergreifender Voll-Scan des `ANTRAEGE_LIST_VIEW`-Stores.
 *  Wird fuer Cross-Programm-Lookups gebraucht — z.B. Netzwerk-Lead-Namen,
 *  deren Lead-Antrag in einem anderen Programm liegt als die TVs im
 *  aktiven Programm. Pro Datensatz ~14 schmale Felder, IDB-getAll() liefert
 *  auch bei 50k+ Records in < 1 s. */
export async function listAllAntraegeListView(idb: IDBStore): Promise<AntragListItem[]> {
  const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readonly');
  return (await req(t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW).getAll())) as AntragListItem[];
}

export async function deleteAntraegeListViewByAktenzeichen(
  idb: IDBStore,
  az: string,
): Promise<void> {
  const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readwrite');
  t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW).delete(az);
  return waitTx(t);
}

export async function countAntraegeListViewByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<number> {
  const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW).index('programm_id');
  return req(idx.count(programmId));
}

// ---------- Historie ----------

export async function appendHistory(idb: IDBStore, entries: AntragHistorieEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const t = tx(idb, CSV_STORES.ANTRAG_HISTORIE, 'readwrite');
  const s = t.objectStore(CSV_STORES.ANTRAG_HISTORIE);
  for (const e of entries) s.put(e);
  return waitTx(t);
}

export async function getHistoryByAz(idb: IDBStore, az: string): Promise<AntragHistorieEntry[]> {
  const t = tx(idb, CSV_STORES.ANTRAG_HISTORIE, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAG_HISTORIE).index('aktenzeichen');
  return (await req(idx.getAll(az))) as AntragHistorieEntry[];
}

// ---------- Verbuende ----------

export async function putVerbund(idb: IDBStore, v: Verbund): Promise<void> {
  const t = tx(idb, CSV_STORES.VERBUENDE, 'readwrite');
  t.objectStore(CSV_STORES.VERBUENDE).put(v);
  return waitTx(t);
}

export async function getVerbund(idb: IDBStore, id: string): Promise<Verbund | null> {
  const t = tx(idb, CSV_STORES.VERBUENDE, 'readonly');
  return (await req(t.objectStore(CSV_STORES.VERBUENDE).get(id))) ?? null;
}

export async function deleteVerbund(idb: IDBStore, id: string): Promise<void> {
  const t = tx(idb, CSV_STORES.VERBUENDE, 'readwrite');
  t.objectStore(CSV_STORES.VERBUENDE).delete(id);
  return waitTx(t);
}

// ---------- Verbund-Historie ----------

export async function appendVerbundHistory(idb: IDBStore, entries: VerbundHistorieEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const t = tx(idb, CSV_STORES.VERBUND_HISTORIE, 'readwrite');
  const s = t.objectStore(CSV_STORES.VERBUND_HISTORIE);
  for (const e of entries) s.put(e);
  return waitTx(t);
}

export async function getVerbundHistoryByVerbund(idb: IDBStore, verbundId: string): Promise<VerbundHistorieEntry[]> {
  const t = tx(idb, CSV_STORES.VERBUND_HISTORIE, 'readonly');
  const idx = t.objectStore(CSV_STORES.VERBUND_HISTORIE).index('verbund_id');
  return (await req(idx.getAll(verbundId))) as VerbundHistorieEntry[];
}

export async function listVerbuendeByProgramm(idb: IDBStore, programmId: string): Promise<Verbund[]> {
  const t = tx(idb, CSV_STORES.VERBUENDE, 'readonly');
  const idx = t.objectStore(CSV_STORES.VERBUENDE).index('programm_id');
  return (await req(idx.getAll(programmId))) as Verbund[];
}

/** Alias for listVerbuendeByProgramm — matches snapshot import naming. */
export async function listVerbundsByProgramm(idb: IDBStore, programmId: string): Promise<Verbund[]> {
  return listVerbuendeByProgramm(idb, programmId);
}

// TODO: Wenn antrag_historie ueber 50k+ Eintraege waechst, einen
// programm_id-Index in der IDB-Schema-Migration ergaenzen. Aktuell laeuft
// listAntragHistorieByProgramm via getAll() + in-memory-filter (O(N)).
/**
 * Alle AntragHistorie-Eintraege fuer ein Programm.
 * ANTRAG_HISTORIE hat keinen programm_id-Index — getAll + In-Memory-Filter
 * nach bekannten Aktenzeichen. Akzeptabler Overhead fuer Snapshot-Write
 * (einmalig pro Re-Import).
 */
export async function listAntragHistorieByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<AntragHistorieEntry[]> {
  const antraege = await listAntraegeByProgramm(idb, programmId);
  const azSet = new Set(antraege.map(a => a.aktenzeichen));
  const t = tx(idb, CSV_STORES.ANTRAG_HISTORIE, 'readonly');
  const all = (await req(t.objectStore(CSV_STORES.ANTRAG_HISTORIE).getAll())) as AntragHistorieEntry[];
  return all.filter(e => azSet.has(e.aktenzeichen));
}

/**
 * Alle VerbundHistorie-Eintraege fuer ein Programm.
 * VERBUND_HISTORIE hat keinen programm_id-Index — getAll + In-Memory-Filter
 * nach Verbund-IDs des Programms.
 */
export async function listVerbundHistorieByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<VerbundHistorieEntry[]> {
  const verbuende = await listVerbuendeByProgramm(idb, programmId);
  const verbundIdSet = new Set(verbuende.map(v => v.verbund_id));
  const t = tx(idb, CSV_STORES.VERBUND_HISTORIE, 'readonly');
  const all = (await req(t.objectStore(CSV_STORES.VERBUND_HISTORIE).getAll())) as VerbundHistorieEntry[];
  return all.filter(e => verbundIdSet.has(e.verbund_id));
}

/**
 * Alle AkronymIndex-Eintraege fuer ein Programm.
 * AKRONYM_INDEX hat keinen separaten programm_id-Index (Composite-Key
 * [programm_id, akronym]) — getAll + In-Memory-Filter.
 */
export async function listAkronymIndexByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<AkronymIndexEntry[]> {
  const t = tx(idb, CSV_STORES.AKRONYM_INDEX, 'readonly');
  const all = (await req(t.objectStore(CSV_STORES.AKRONYM_INDEX).getAll())) as AkronymIndexEntry[];
  return all.filter(e => e.programm_id === programmId);
}

/**
 * Alle CsvRowHash-Eintraege fuer eine Liste von Schema-IDs.
 * Ruft getRowHashesForSchema pro Schema auf und konkateniert die Ergebnisse.
 */
export async function listRowHashesBySchemas(
  idb: IDBStore,
  schemaIds: string[],
): Promise<CsvRowHash[]> {
  const results: CsvRowHash[] = [];
  for (const schemaId of schemaIds) {
    const hashes = await getRowHashesForSchema(idb, schemaId);
    results.push(...hashes);
  }
  return results;
}

// ---------- Akronym-Index ----------

export async function putAkronymEntry(idb: IDBStore, e: AkronymIndexEntry): Promise<void> {
  const t = tx(idb, CSV_STORES.AKRONYM_INDEX, 'readwrite');
  t.objectStore(CSV_STORES.AKRONYM_INDEX).put(e);
  return waitTx(t);
}

export async function getAkronymEntry(idb: IDBStore, programmId: string, akronym: string): Promise<AkronymIndexEntry | null> {
  const t = tx(idb, CSV_STORES.AKRONYM_INDEX, 'readonly');
  return (await req(t.objectStore(CSV_STORES.AKRONYM_INDEX).get([programmId, akronym]))) ?? null;
}

export async function deleteAkronymEntry(idb: IDBStore, programmId: string, akronym: string): Promise<void> {
  const t = tx(idb, CSV_STORES.AKRONYM_INDEX, 'readwrite');
  t.objectStore(CSV_STORES.AKRONYM_INDEX).delete([programmId, akronym]);
  return waitTx(t);
}

// ---------- Wartung ----------

export interface ClearAntragDataResult {
  antraege: number;
  verbuende: number;
  historie: number;
  rowHashes: number;
}

async function countStore(idb: IDBStore, store: CsvStoreName): Promise<number> {
  const t = tx(idb, store, 'readonly');
  return req(t.objectStore(store).count());
}

async function clearStoreFully(idb: IDBStore, store: CsvStoreName): Promise<void> {
  const t = tx(idb, store, 'readwrite');
  t.objectStore(store).clear();
  return waitTx(t);
}

/**
 * Loescht alle importierten Antrags-Daten + Historie + Akronym-Index +
 * Row-Hashes. Behaelt PROGRAMME, UNTERPROGRAMME, CSV_SCHEMAS — der Kurator
 * kann unmittelbar danach via "Re-Import" der bestehenden Schemas neu
 * laden, ohne den Wizard erneut zu durchlaufen.
 *
 * Use-Case: Encoding-Mojibake im IDB. User bereinigt die Quell-CSV extern
 * und re-importiert.
 */
export async function clearAntragData(idb: IDBStore): Promise<ClearAntragDataResult> {
  const result: ClearAntragDataResult = {
    antraege: await countStore(idb, CSV_STORES.ANTRAEGE),
    verbuende: await countStore(idb, CSV_STORES.VERBUENDE),
    historie:
      (await countStore(idb, CSV_STORES.ANTRAG_HISTORIE)) +
      (await countStore(idb, CSV_STORES.VERBUND_HISTORIE)),
    rowHashes: await countStore(idb, CSV_STORES.CSV_ROW_HASHES),
  };
  await clearStoreFully(idb, CSV_STORES.ANTRAEGE);
  await clearStoreFully(idb, CSV_STORES.VERBUENDE);
  await clearStoreFully(idb, CSV_STORES.ANTRAG_HISTORIE);
  await clearStoreFully(idb, CSV_STORES.VERBUND_HISTORIE);
  await clearStoreFully(idb, CSV_STORES.AKRONYM_INDEX);
  await clearStoreFully(idb, CSV_STORES.CSV_ROW_HASHES);
  return result;
}

export async function countAntragData(idb: IDBStore): Promise<ClearAntragDataResult> {
  return {
    antraege: await countStore(idb, CSV_STORES.ANTRAEGE),
    verbuende: await countStore(idb, CSV_STORES.VERBUENDE),
    historie:
      (await countStore(idb, CSV_STORES.ANTRAG_HISTORIE)) +
      (await countStore(idb, CSV_STORES.VERBUND_HISTORIE)),
    rowHashes: await countStore(idb, CSV_STORES.CSV_ROW_HASHES),
  };
}
