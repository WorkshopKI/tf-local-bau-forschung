/** Zeilen-Hashes — erkennen, welche CSV-Zeile sich geaendert hat. */
import { IDBStore, CSV_STORES } from '../../storage/idb-store';
import { MAX_WRITES_PER_TX } from '../constants';
import type { CsvRowHash } from '../types';
import { tx, req, waitTx } from './intern';

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

/**
 * Nur die Join-Werte einer Quelle — für die Frage „trägt diese Quelle den Wert
 * noch?" (Löschprüfung über alle Quellen, siehe importer.ts).
 *
 * Bewusst nicht `getRowHashesForSchema`: der Primary-Key ist
 * `[csv_schema_id, join_value]`, der Index liefert ihn direkt. Das spart bei
 * 14k Zeilen die Deserialisierung von 14k Objekten samt Hash-String.
 */
export async function getJoinValuesForSchema(idb: IDBStore, schemaId: string): Promise<Set<string>> {
  const t = tx(idb, CSV_STORES.CSV_ROW_HASHES, 'readonly');
  const idx = t.objectStore(CSV_STORES.CSV_ROW_HASHES).index('csv_schema_id');
  const keys = (await req(idx.getAllKeys(schemaId))) as [string, string][];
  return new Set(keys.map(k => k[1]));
}
