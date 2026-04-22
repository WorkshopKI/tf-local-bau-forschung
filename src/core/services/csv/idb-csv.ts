import { IDBStore, CSV_STORES, type CsvStoreName } from '../storage/idb-store';
import { MAX_WRITES_PER_TX } from './constants';
import type {
  Programm,
  Unterprogramm,
  CsvSchema,
  CsvRowHash,
  Antrag,
  AntragHistorieEntry,
  Verbund,
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

export async function listVerbuendeByProgramm(idb: IDBStore, programmId: string): Promise<Verbund[]> {
  const t = tx(idb, CSV_STORES.VERBUENDE, 'readonly');
  const idx = t.objectStore(CSV_STORES.VERBUENDE).index('programm_id');
  return (await req(idx.getAll(programmId))) as Verbund[];
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
