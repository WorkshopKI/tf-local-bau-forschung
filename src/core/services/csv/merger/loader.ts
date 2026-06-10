/**
 * CSV-Source-Loader: lädt persistierte CSV-Texte aus IDB und parsed sie zu Rows.
 *
 * Stellt die Schema+Rows-Struktur für den Merge-Pfad bereit — sowohl single
 * als auch batched verwenden `loadAllSchemasWithRows` zum Pre-Loading.
 */

import type { IDBStore } from '../../storage/idb-store';
import { parseCsvAll } from '../parser';
import { loadCsvSourceFile } from '../schemaRegistry';
import { listAntraegeByProgramm, listSchemasByProgramm } from '../idb-csv';
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

/** Findet die CSV-Spalte, die im Schema auf ein Canonical-Field gemappt ist. */
function findCanonicalColumn(schema: CsvSchema, canonical: string): string | null {
  const entry = Object.entries(schema.column_mapping).find(
    ([, e]) => e.canonical === canonical && !e.ignore,
  );
  return entry ? entry[0] : null;
}

/** Wie loadSchemaRows, behaelt aber nur Rows, deren Join-Spaltenwert im
 *  `allowed`-Set liegt. Die volle (geparste) rows-Array faellt direkt nach dem
 *  Filter zur GC → retained-Memory ist O(Treffer) statt O(alle Rows). Der
 *  Parse-Transient bleibt „eine Quelle" (sequentiell, wie loadAllSchemasWithRows). */
async function loadSchemaRowsFiltered(
  idb: IDBStore,
  schema: CsvSchema,
  joinCol: string,
  allowed: Set<string>,
): Promise<Record<string, string>[]> {
  if (allowed.size === 0) return [];
  const text = await loadCsvSourceFile(idb, schema.id);
  if (!text) return [];
  const blob = new Blob([text], { type: 'text/csv' });
  const { rows } = await parseCsvAll(blob, { encoding: 'UTF-8', separator: schema.separator });
  const filtered: Record<string, string>[] = [];
  for (const r of rows) {
    if (allowed.has((r[joinCol] ?? '').trim())) filtered.push(r);
  }
  return filtered;
}

/**
 * Delta-skopierte Variante von `loadAllSchemasWithRows` (v2.61.5, OOM-Fix für
 * RAM-knappe Citrix-Renderer): laedt pro Schema NUR die Rows, die zur
 * Neuberechnung der `touchedAz` noetig sind, statt jede CSV-Quelle des Programms
 * komplett in den RAM zu parsen.
 *
 * Zweiphasig wegen der Verbund-/Akronym-Joins:
 *  1. aktenzeichen-Join-Schemas auf `touchedAz` filtern (Master-Rows).
 *  2. Aus diesen Master-Rows + den `verbund_id`/`akronym` der bestehenden
 *     Antraege (touchedAz) die noetigen Sekundaer-Join-Schluessel ableiten.
 *  3. verbund_id-/akronym-Join-Schemas auf diese Schluessel filtern.
 *
 * Superset-sicher: lieber ein paar Rows zu viel laden als eine noetige
 * verpassen — das Merge-Ergebnis ist identisch zum Voll-Loader (getestet in
 * `merger-scoped-load.test.ts`). Bei `touchedAz` = alle Aktenzeichen
 * (Voll-Re-Import) entspricht das Resultat 1:1 `loadAllSchemasWithRows`.
 *
 * `removedAz` brauchen KEINE CSV-Rows: die Loeschung arbeitet ausschliesslich
 * auf den bestehenden Antrag-Records (siehe `removeAntragIntoBatch`).
 */
export async function loadScopedSchemasWithRows(
  idb: IDBStore,
  programmId: string,
  touchedAz: Set<string>,
): Promise<SchemaWithRows[]> {
  if (touchedAz.size === 0) return [];
  const schemas = await listSchemasByProgramm(idb, programmId);
  const azSchemas = schemas.filter(s => s.join_key === 'aktenzeichen');
  const secondarySchemas = schemas.filter(
    s => s.join_key === 'verbund_id' || s.join_key === 'akronym',
  );

  const out: SchemaWithRows[] = [];
  const neededVerbundIds = new Set<string>();
  const neededAkronyms = new Set<string>();

  // Phase 1: Master-/aktenzeichen-Schemas auf touchedAz filtern + Sekundaer-
  // Schluessel aus den geladenen Master-Rows einsammeln.
  for (const schema of azSchemas) {
    const joinCol = findJoinColumn(schema);
    const rows = joinCol ? await loadSchemaRowsFiltered(idb, schema, joinCol, touchedAz) : [];
    out.push({ schema, rows });
    const vbCol = findCanonicalColumn(schema, 'verbund_id');
    const akCol = findCanonicalColumn(schema, 'akronym');
    if (vbCol || akCol) {
      for (const r of rows) {
        if (vbCol) { const v = (r[vbCol] ?? '').trim(); if (v) neededVerbundIds.add(v); }
        if (akCol) { const a = (r[akCol] ?? '').trim(); if (a) neededAkronyms.add(a); }
      }
    }
  }

  // Phase 2 (Superset): Sekundaer-Schluessel zusaetzlich aus den bestehenden
  // Antraegen der touchedAz ziehen — falls ein neuer Master-Row die verbund_id
  // nicht mehr liefert, der bestehende Antrag aber noch daran haengt.
  if (secondarySchemas.length > 0) {
    const existing = await listAntraegeByProgramm(idb, programmId);
    for (const a of existing) {
      if (!touchedAz.has(a.aktenzeichen)) continue;
      if (typeof a.verbund_id === 'string' && a.verbund_id.trim()) neededVerbundIds.add(a.verbund_id.trim());
      if (typeof a.akronym === 'string' && a.akronym.trim()) neededAkronyms.add(a.akronym.trim());
    }
  }

  // Phase 3: Sekundaer-Schemas auf die abgeleiteten Schluessel filtern.
  for (const schema of secondarySchemas) {
    const joinCol = findJoinColumn(schema);
    const allowed = schema.join_key === 'verbund_id' ? neededVerbundIds : neededAkronyms;
    const rows = joinCol ? await loadSchemaRowsFiltered(idb, schema, joinCol, allowed) : [];
    out.push({ schema, rows });
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
