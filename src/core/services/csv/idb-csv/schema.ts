/** CSV-Schemas: Spalten-Mapping je Quelle. */
import { IDBStore, CSV_STORES } from '../../storage/idb-store';
import type { CsvSchema } from '../types';
import { tx, req, waitTx } from './intern';

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

/**
 * ALLE Schemas über alle Programme. Für Entscheidungen, die den Store als
 * Ganzes betreffen — allen voran die Vergabe einer Schema-Id: der Store ist
 * programm-übergreifend, eine nur gegen ein Programm geprüfte Id überschreibt
 * sonst die gleichnamige Quelle eines anderen.
 */
export async function listAllSchemas(idb: IDBStore): Promise<CsvSchema[]> {
  const t = tx(idb, CSV_STORES.CSV_SCHEMAS, 'readonly');
  return (await req(t.objectStore(CSV_STORES.CSV_SCHEMAS).getAll())) as CsvSchema[];
}

export async function deleteSchema(idb: IDBStore, id: string): Promise<void> {
  const t = tx(idb, CSV_STORES.CSV_SCHEMAS, 'readwrite');
  t.objectStore(CSV_STORES.CSV_SCHEMAS).delete(id);
  return waitTx(t);
}
