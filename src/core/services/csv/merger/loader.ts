/**
 * CSV-Source-Loader: lädt persistierte CSV-Texte aus IDB und parsed sie zu Rows.
 *
 * Stellt die Schema+Rows-Struktur für den Merge-Pfad bereit — sowohl single
 * als auch batched verwenden `loadAllSchemasWithRows` zum Pre-Loading.
 */

import type { IDBStore } from '../../storage/idb-store';
import { parseCsvAll } from '../parser';
import { loadCsvSourceFile } from '../schemaRegistry';
import { listSchemasByProgramm } from '../idb-csv';
import type { CsvSchema } from '../types';
import { findJoinColumn } from './helpers';

export interface SchemaWithRows {
  schema: CsvSchema;
  rows: Record<string, string>[];
}

async function loadSchemaRows(idb: IDBStore, schema: CsvSchema): Promise<Record<string, string>[]> {
  const text = await loadCsvSourceFile(idb, schema.id);
  if (!text) return [];
  // Importer normalisiert die CSV beim Speichern auf UTF-8 (siehe importer.ts
  // vor saveCsvSourceFile). Der hier zurückgelesene Text ist daher immer UTF-8,
  // unabhängig vom Original-Encoding der hochgeladenen Datei.
  const blob = new Blob([text], { type: 'text/csv' });
  const { rows } = await parseCsvAll(blob, {
    encoding: 'UTF-8',
    separator: schema.separator,
  });
  return rows;
}

export async function loadAllSchemasWithRows(
  idb: IDBStore,
  programmId: string,
): Promise<SchemaWithRows[]> {
  const schemas = await listSchemasByProgramm(idb, programmId);
  const out: SchemaWithRows[] = [];
  for (const s of schemas) {
    const rows = await loadSchemaRows(idb, s);
    out.push({ schema: s, rows });
  }
  return out;
}

/**
 * Bestimmt die Menge der Aktenzeichen über alle Schemas eines Programms.
 * Master-Schemas haben Vorrang (definitive Liste); fehlen Master, fallen wir
 * auf alle Schemas mit join_key='aktenzeichen' zurück.
 */
export function discoverAktenzeichen(schemas: SchemaWithRows[]): Set<string> {
  const all = new Set<string>();
  const masters = schemas.filter(s => s.schema.is_master);
  const pool = masters.length > 0 ? masters : schemas.filter(s => s.schema.join_key === 'aktenzeichen');
  for (const { schema, rows } of pool) {
    const joinCol = findJoinColumn(schema);
    if (!joinCol) continue;
    for (const r of rows) {
      const az = (r[joinCol] ?? '').trim();
      if (az) all.add(az);
    }
  }
  return all;
}
