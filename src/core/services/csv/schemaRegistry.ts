import type { IDBStore } from '../storage/idb-store';
import { atomicWrite, readText } from '../infrastructure/atomic-write';
import { getProgrammHandle } from '../infrastructure/smb-handle';
import { getSmbHandle } from '../infrastructure/smb-handle';
import { CSV_SCHEMAS_SUBDIR, CSV_SOURCES_SUBDIR } from './constants';
import { getSchema, listSchemasByProgramm, putSchema, deleteSchema as idbDeleteSchema } from './idb-csv';
import type { CsvSchema } from './types';

export async function saveSchema(idb: IDBStore, schema: CsvSchema): Promise<void> {
  await putSchema(idb, schema);
  const parent = await getSmbHandle(idb);
  if (!parent) return;
  try {
    const programm = await getProgrammHandle(parent);
    const path = `${CSV_SCHEMAS_SUBDIR}/${schema.id}.json`;
    await atomicWrite(programm, path, JSON.stringify(schema, null, 2));
  } catch {
    // Best-effort SMB-sync — IDB ist Primary
  }
}

export async function loadSchema(idb: IDBStore, id: string): Promise<CsvSchema | null> {
  return getSchema(idb, id);
}

export async function listSchemas(idb: IDBStore, programmId: string): Promise<CsvSchema[]> {
  return listSchemasByProgramm(idb, programmId);
}

export async function findMasterSchema(idb: IDBStore, programmId: string): Promise<CsvSchema | null> {
  const all = await listSchemasByProgramm(idb, programmId);
  return all.find(s => s.is_master) ?? null;
}

export async function removeSchema(idb: IDBStore, id: string): Promise<void> {
  await idbDeleteSchema(idb, id);
  // File-System-Cleanup ist best-effort — wir lassen ältere JSON-Dateien liegen
}

export async function saveCsvSourceFile(idb: IDBStore, schemaId: string, blob: Blob): Promise<void> {
  const parent = await getSmbHandle(idb);
  if (!parent) return;
  try {
    const programm = await getProgrammHandle(parent);
    const path = `${CSV_SOURCES_SUBDIR}/${schemaId}.csv`;
    await atomicWrite(programm, path, blob);
  } catch {
    /* best-effort */
  }
}

export async function loadCsvSourceFile(idb: IDBStore, schemaId: string): Promise<string | null> {
  const parent = await getSmbHandle(idb);
  if (!parent) return null;
  try {
    const programm = await getProgrammHandle(parent);
    const path = `${CSV_SOURCES_SUBDIR}/${schemaId}.csv`;
    return await readText(programm, path);
  } catch {
    return null;
  }
}
