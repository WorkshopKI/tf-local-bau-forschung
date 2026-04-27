import type { IDBStore } from '../storage/idb-store';
import { logAudit } from '../infrastructure/audit-log';
import { acquireBuildLock, forceLock, releaseLock } from '../infrastructure/build-lock';
import { BUILD_LOCK_STUFE, MAX_SKIP_WARNINGS } from './constants';
import { canonicalRowHash } from './hash';
import { sha1Hex } from './sha1';
import { parseCsvAll, readWithEncodingFallback } from './parser';
import { saveCsvSourceFile, saveSchema, loadSchema } from './schemaRegistry';
import {
  deleteRowHashes,
  getRowHashesForSchema,
  listAntraegeByProgramm,
  putRowHashes,
} from './idb-csv';
import {
  loadAllSchemasWithRows,
  recomputeAntrag,
  removeAntragAndCleanup,
} from './merger';
import {
  findUnterprogrammColumn,
  getActiveUnterprogrammCodes,
  recomputeAntragCounts,
} from './unterprogrammRegistry';
import type { CsvSchema, ImportResult } from './types';

export interface ImportProgress {
  phase: 'hashing' | 'parsing' | 'diffing' | 'merging' | 'done';
  done: number;
  total: number;
}

export interface ImportOptions {
  onProgress?: (p: ImportProgress) => void;
  onLockConflict?: (ageMinutes: number) => Promise<'force' | 'abort'>;
}

/**
 * Importiert eine CSV-Datei für das angegebene Schema.
 * - Build-Lock (csv-import) mit Force-Dialog
 * - SHA1-Skip wenn Datei identisch
 * - Row-Hash-Diff für new/changed/unchanged/removed Buckets
 * - Multi-CSV-Merge für betroffene Antraege
 * - Audit-Log-Eintrag
 */
export async function importCsvSource(
  idb: IDBStore,
  schemaId: string,
  csvBlob: Blob,
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const started = Date.now();
  const result: ImportResult = {
    skipped: false,
    buckets: { new: 0, changed: 0, unchanged: 0, removed: 0 },
    durationMs: 0,
    rowCount: 0,
    skippedJoinValues: [],
  };

  const schema = await loadSchema(idb, schemaId);
  if (!schema) throw new Error(`Schema ${schemaId} nicht gefunden`);

  // Build-Lock erwerben (mit Force-Dialog)
  const lockRes = await acquireBuildLock(idb, BUILD_LOCK_STUFE, { programm_id: schema.programm_id });
  if (!lockRes.acquired) {
    const decision = opts.onLockConflict ? await opts.onLockConflict(lockRes.ageMinutes) : 'abort';
    if (decision === 'abort') {
      throw new Error('Anderer Import läuft bereits. Abgebrochen.');
    }
    await forceLock(idb, BUILD_LOCK_STUFE, { programm_id: schema.programm_id });
  }

  try {
    // SHA-1 der Datei berechnen
    const fileSha = await sha1Hex(csvBlob);
    if (schema.file_checksum === fileSha) {
      result.skipped = true;
      result.durationMs = Date.now() - started;
      await logAudit(idb, {
        action: 'csv_import_skipped',
        details: { schemaId, reason: 'checksum_match' },
      });
      return result;
    }

    // Parse (mit Schema-persistierten Encoding/Separator, falls vorhanden)
    opts.onProgress?.({ phase: 'parsing', done: 0, total: 0 });
    const { rows } = await parseCsvAll(csvBlob, {
      encoding: schema.encoding,
      separator: schema.separator,
    });
    result.rowCount = rows.length;

    // Persist CSV to SMB (für Merge beim nächsten Recompute + für Backup).
    // CSV in UTF-8 normalisieren bevor sie auf den Share geht — der Merge-Pfad
    // (loadCsvSourceFile -> readText -> Blob.text()) dekodiert per Spec immer
    // als UTF-8. Ohne Normalisierung gehen Umlaute aus windows-1252-CSVs beim
    // Roundtrip kaputt.
    const { text: csvText } = await readWithEncodingFallback(csvBlob, schema.encoding);
    const utf8Blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    await saveCsvSourceFile(idb, schemaId, utf8Blob);

    // Row-Diff
    opts.onProgress?.({ phase: 'diffing', done: 0, total: rows.length });
    const joinCol = findJoinColumn(schema);
    if (!joinCol) throw new Error(`Schema ${schemaId}: join_key-Spalte nicht im Mapping`);
    const prevHashes = await getRowHashesForSchema(idb, schemaId);
    const prevMap = new Map(prevHashes.map(h => [h.join_value, h.row_hash]));

    // Unterprogramm-Filter (nur Master)
    const activeUpCodes = await getActiveUnterprogrammCodes(idb, schema);
    const upCol = activeUpCodes !== null ? findUnterprogrammColumn(schema) : null;

    const seen = new Set<string>();
    const newHashes: { csv_schema_id: string; join_value: string; row_hash: string }[] = [];
    const skippedWarnings: string[] = [];
    const changedJoinValues: string[] = [];
    const newJoinValues: string[] = [];
    let skippedInactive = 0;

    for (const row of rows) {
      const jv = (row[joinCol] ?? '').trim();
      if (!jv) {
        if (skippedWarnings.length < MAX_SKIP_WARNINGS) {
          skippedWarnings.push(`Leerer Join-Value in Zeile, Spalte "${joinCol}"`);
        }
        continue;
      }
      // Unterprogramm-Filter
      if (activeUpCodes !== null && upCol) {
        const upVal = (row[upCol] ?? '').trim();
        if (!activeUpCodes.has(upVal)) {
          skippedInactive++;
          continue;
        }
      }
      seen.add(jv);
      const hash = canonicalRowHash(row, schema.column_mapping);
      newHashes.push({ csv_schema_id: schemaId, join_value: jv, row_hash: hash });
      const prev = prevMap.get(jv);
      if (prev === undefined) {
        result.buckets.new++;
        newJoinValues.push(jv);
      } else if (prev !== hash) {
        result.buckets.changed++;
        changedJoinValues.push(jv);
      } else {
        result.buckets.unchanged++;
      }
    }

    result.skippedInactiveUnterprogramm = skippedInactive;

    const removedJoinValues: string[] = [];
    for (const [jv] of prevMap) {
      if (!seen.has(jv)) removedJoinValues.push(jv);
    }
    result.buckets.removed = removedJoinValues.length;
    result.skippedJoinValues = skippedWarnings;

    // Hashes persistieren (komplett ersetzen)
    await putRowHashes(idb, newHashes);
    if (removedJoinValues.length > 0) {
      await deleteRowHashes(idb, schemaId, removedJoinValues);
    }

    // Schema aktualisieren
    const updatedSchema: CsvSchema = {
      ...schema,
      file_checksum: fileSha,
      last_imported_at: new Date().toISOString(),
      last_row_count: rows.length,
    };
    await saveSchema(idb, updatedSchema);

    // Merge für alle betroffenen Antraege
    opts.onProgress?.({ phase: 'merging', done: 0, total: 0 });
    await runMergeForDeltas({
      idb,
      schema: updatedSchema,
      newJoinValues,
      changedJoinValues,
      removedJoinValues,
      onProgress: (done, total) =>
        opts.onProgress?.({ phase: 'merging', done, total }),
    });

    // Nach Merge: Antrag-Counts pro Unterprogramm neu berechnen (für Admin-Panel)
    if (schema.is_master) {
      await recomputeAntragCounts(idb, schema.programm_id);
    }

    result.durationMs = Date.now() - started;
    opts.onProgress?.({ phase: 'done', done: rows.length, total: rows.length });
    await logAudit(idb, {
      action: 'csv_import',
      details: {
        schemaId,
        schemaName: schema.csv_source_name,
        buckets: result.buckets,
        durationMs: result.durationMs,
        rowCount: result.rowCount,
        skippedInactiveUnterprogramm: result.skippedInactiveUnterprogramm ?? 0,
        activeUnterprogramme: activeUpCodes ? Array.from(activeUpCodes).sort() : null,
      },
    });
    return result;
  } finally {
    await releaseLock(idb).catch(() => undefined);
  }
}

function findJoinColumn(schema: CsvSchema): string | null {
  const entry = Object.entries(schema.column_mapping).find(
    ([, e]) => e.canonical === schema.join_key && !e.ignore,
  );
  return entry ? entry[0] : null;
}

interface MergeArgs {
  idb: IDBStore;
  schema: CsvSchema;
  newJoinValues: string[];
  changedJoinValues: string[];
  removedJoinValues: string[];
  onProgress?: (done: number, total: number) => void;
}

async function runMergeForDeltas(args: MergeArgs): Promise<void> {
  const { idb, schema, newJoinValues, changedJoinValues, removedJoinValues, onProgress } = args;
  const cache = await loadAllSchemasWithRows(idb, schema.programm_id);
  const touchedAz = new Set<string>();

  // Antraege deren identity über aktenzeichen geht → direkter Az
  if (schema.join_key === 'aktenzeichen') {
    for (const jv of [...newJoinValues, ...changedJoinValues]) touchedAz.add(jv);
    for (const jv of removedJoinValues) {
      await removeAntragAndCleanup(idb, jv, schema.programm_id);
    }
  } else {
    // Join via verbund_id / akronym → finde alle Antraege im Programm die davon betroffen sind
    const all = await listAntraegeByProgramm(idb, schema.programm_id);
    const changedSet = new Set([...newJoinValues, ...changedJoinValues, ...removedJoinValues]);
    for (const a of all) {
      const key = schema.join_key === 'akronym'
        ? (typeof a.akronym === 'string' ? a.akronym : undefined)
        : (typeof a.verbund_id === 'string' ? a.verbund_id : undefined);
      if (key && changedSet.has(key)) touchedAz.add(a.aktenzeichen);
    }
  }

  const azList = [...touchedAz];
  let done = 0;
  for (const az of azList) {
    await recomputeAntrag(idb, az, schema.programm_id, cache);
    done++;
    onProgress?.(done, azList.length);
  }
}
