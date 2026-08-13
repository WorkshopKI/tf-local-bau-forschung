import type { IDBStore } from '../storage/idb-store';
import { atomicWrite, readTextLage } from '../infrastructure/atomic-write';
import { getProgrammHandle } from '../infrastructure/smb-handle';
import { getDatenShareHandle } from '../infrastructure/smb-handle';
import { CSV_SCHEMAS_SUBDIR, CSV_SOURCES_SUBDIR } from './constants';
import { getSchema, listSchemasByProgramm, putSchema, deleteSchema as idbDeleteSchema } from './idb-csv';
import type { CsvSchema } from './types';

export async function saveSchema(idb: IDBStore, schema: CsvSchema): Promise<void> {
  await putSchema(idb, schema);
  const parent = await getDatenShareHandle(idb);
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

/**
 * Legt die Quell-CSV auf dem Share ab. **Kein best-effort**: der Merge liest
 * ausschliesslich diese Kopie zurück (`loadCsvSourceFile`), nicht die Datei, die
 * der Kurator ausgewählt hat. Scheitert der Write still, rechnet der nächste
 * Merge mit der ALTEN oder gar keiner Fassung dieser Quelle — und schreibt
 * Anträge, denen ihre Felder fehlen. Ein Fehler bricht den Import deshalb ab
 * (Aufrufer stempelt danach erst das Schema).
 *
 * Ohne Daten-Share ist das ein legitimer No-op: dann gibt es keine Kopie, und
 * der Merge weiss das (`loadCsvSourceFile` liefert `null`).
 */
export async function saveCsvSourceFile(idb: IDBStore, schemaId: string, blob: Blob): Promise<void> {
  const parent = await getDatenShareHandle(idb);
  if (!parent) return;
  const programm = await getProgrammHandle(parent);
  const path = `${CSV_SOURCES_SUBDIR}/${schemaId}.csv`;
  await atomicWrite(programm, path, blob, { skipBackup: true });
}

/**
 * Liest die Quell-Kopie zurück. `null` = es gibt keine (kein Share, noch nie
 * importiert) — eine Aussage, mit der der Merge leben kann. Eine VORHANDENE,
 * aber unlesbare Kopie wirft dagegen: „0 Zeilen" wäre dort eine Lüge, und der
 * Merge würde die Felder dieser Quelle aus jedem Antrag entfernen.
 */
export async function loadCsvSourceFile(idb: IDBStore, schemaId: string): Promise<string | null> {
  const parent = await getDatenShareHandle(idb);
  if (!parent) return null;
  const path = `${CSV_SOURCES_SUBDIR}/${schemaId}.csv`;
  let programm: FileSystemDirectoryHandle;
  try {
    programm = await getProgrammHandle(parent);
  } catch {
    return null;
  }
  const lage = await readTextLage(programm, path);
  if (lage.status === 'ok') return lage.text;
  if (lage.status === 'leer') return null;
  throw new Error(
    `Die gespeicherte Quell-Kopie „${schemaId}.csv" liess sich nicht lesen (Daten-Share erreichbar?).`,
  );
}
