/**
 * Die benannten Schritte des CSV-Imports.
 *
 * `importCsvSource` war bis v6.43 eine Prozedur von 469 Zeilen, deren Rumpf aus
 * genau EINEM `try`-Block bestand. Ihr eigener Doc-Kommentar zaehlte fuenf
 * Aufgaben auf, die Kommentar-Baender im Rumpf vierzehn — jede davon eine Ebene
 * tiefer als die Funktion, die sie enthielt.
 *
 * Hier stehen diese Phasen als benannte Funktionen. Die Aufteilung folgt zwei
 * Regeln, die aus der Vorgeschichte dieser Datei kommen:
 *
 *  1. KEIN Schritt schreibt in ein geteiltes, veraenderliches `result`- oder
 *     `timings`-Objekt. Jeder nimmt entgegen, was er braucht, und GIBT ZURUECK,
 *     was er ermittelt hat. Der Orchestrator setzt zusammen. Ein Schritt, der in
 *     fremden Zustand schreibt, laesst sich weder einzeln lesen noch einzeln
 *     testen — und genau das war der Zustand vorher.
 *
 *  2. Die drei ABBRUCH-SCHRANKEN bleiben im Orchestrator, sichtbar an einer
 *     Stelle. Besonders die vor dem Ersetzen der Share-Kopie: der Merge liest
 *     seine Zeilen ausschliesslich aus dieser Kopie. Wird sie ersetzt und der
 *     Lauf danach abgebrochen, beschreiben Row-Hashes, `file_checksum` und alle
 *     Antraege den ALTEN Stand, die Kopie aber den NEUEN — und der naechste,
 *     voellig unabhaengige Import einer ANDEREN Quelle rechnet die von ihm
 *     beruehrten Antraege mit den Werten des abgebrochenen Exports neu.
 *
 * Ebenfalls im Orchestrator bleibt die Speicher-Freigabe der geparsten Zeilen
 * vor dem Merge (OOM-Fix v2.61.5): ein Schritt, der die Zeilen laenger festhaelt,
 * bringt den Citrix-OOM zurueck.
 */
import type { IDBStore } from '../storage/idb-store';
import { logAudit } from '../infrastructure/audit-log';
import { getDatenShareHandle } from '../infrastructure/smb-handle';
import { resolveSnapshotAuthor } from '../infrastructure/update-author';
import { writeProgrammSnapshot, writeProgrammSnapshotDelta } from './snapshot';
import {
  isDeltaSnapshotWriteEnabled, isMeilensteinMonitoringEnabled, isStatusCockpitEnabled,
} from '@/config/feature-flags';
import { MAX_SKIP_WARNINGS } from './constants';
import { canonicalRowHash } from './hash';
import { parseCsvAllStreamed } from './parser';
import { getRowHashesForSchema, listAntraegeByProgramm, listSchemasByProgramm } from './idb-csv';
import { teileNachAbdeckung } from './loeschregel';
import { loadScopedSchemasWithRows, recomputeMultipleBatched } from './merger';
import { findJoinColumn } from './merger/helpers';
import {
  findUnterprogrammColumn, getUnterprogrammFilter, type UnterprogrammFilter,
} from './unterprogrammRegistry';
import { logMem } from '../../utils/log-mem';
import type { CsvSchema, ImportResult } from './types';
// Nur Typen — erzeugt keine Laufzeit-Kante (check-cycles.mjs zaehlt `import type`
// bewusst nicht als Kante), der Orchestrator bleibt der Besitzer dieser Vertraege.
import type { ImportOptions } from './importer';

type CsvRow = Record<string, string>;

/**
 * Urteil ueber die Unterprogramm-Zelle einer Master-Zeile.
 *
 * Der Schnitt entscheidet, ob eine nicht importierte Zeile als Loeschung zaehlt
 * (Team-Entscheidung 2026-08-13: gefiltert heisst „ich weiss es nicht", nicht
 * „gibt es nicht"):
 *
 *   - `aktiv`        → Zeile wird importiert
 *   - `deaktiviert`  → Code steht im Katalog, der Kurator hat ihn abgewaehlt.
 *                      Eine Entscheidung, also darf sie loeschen.
 *   - `unbekannt`    → Zelle leer oder Code nicht im Katalog. Eine Luecke im
 *                      Wissen, keine Aussage ueber den Antrag — nicht loeschen.
 */
function beurteileUnterprogramm(
  zelle: string | undefined,
  filter: UnterprogrammFilter,
): 'aktiv' | 'deaktiviert' | 'unbekannt' {
  const code = (zelle ?? '').trim();
  if (filter.aktiv.has(code)) return 'aktiv';
  return filter.bekannt.has(code) ? 'deaktiviert' : 'unbekannt';
}

// `findJoinColumn` kommt aus merger/helpers.ts. Der Importer trug bis v6.43 eine
// eigene, byte-gleiche Kopie — sie fiel erst auf, als die Extraktion sie aus dem
// Modul-Privaten hob und der Guard `ein-name-eine-implementierung` anschlug.

/**
 * Teilt die Loeschkandidaten einer Quelle in „wirklich weg" und „eine andere
 * Quelle fuehrt den Antrag weiter". Die Regel selbst steht in
 * [loeschregel.ts](./loeschregel.ts) — sie gilt fuer jeden Vorgang, der eine
 * Quelle aus dem Bestand nimmt, nicht nur fuer den Import.
 */
async function teileLoeschkandidaten(
  idb: IDBStore,
  schema: CsvSchema,
  kandidaten: string[],
): Promise<{ zuLoeschen: string[]; gehalten: string[] }> {
  if (schema.join_key !== 'aktenzeichen') return { zuLoeschen: kandidaten, gehalten: [] };
  const andere = (await listSchemasByProgramm(idb, schema.programm_id))
    .filter(s => s.id !== schema.id);
  return teileNachAbdeckung(idb, andere, kandidaten);
}

export interface LeseErgebnis {
  rows: CsvRow[];
  headers: string[];
  parseErrors: NonNullable<ImportResult['parseErrors']>;
  joinCol: string;
  parseMs: number;
}

/**
 * Schritt 1: Datei lesen und auf Verwertbarkeit pruefen.
 *
 * Wirft, wenn die Join-Spalte in der GELESENEN Kopfzeile fehlt — bewusst VOR
 * jedem Share-Write und jedem Schema-Stempel. `findJoinColumn` loest gegen
 * `column_mapping` auf; wird die Spalte im Export umbenannt oder faellt sie weg,
 * bleibt das Mapping formal gueltig, `row[joinCol]` ist aber in JEDER Zeile
 * leer: alle bisherigen Join-Werte gaelten als entfernt, und der Merge loeschte
 * den kompletten Bestand der Quelle — im Auto-Refresh team-weit publiziert.
 */
export async function leseUndPruefe(
  idb: IDBStore, schemaId: string, schema: CsvSchema, csvBlob: Blob,
  effectiveEncoding: CsvSchema['encoding'], opts: ImportOptions,
): Promise<LeseErgebnis> {
  opts.onProgress?.({ phase: 'parsing', done: 0, total: csvBlob.size });
  const tParse = performance.now();
  const { rows, headers, parseErrors } = await parseCsvAllStreamed(csvBlob, {
    encoding: effectiveEncoding,
    separator: schema.separator,
    onProgress: (bytes, totalBytes) => {
      opts.onProgress?.({ phase: 'parsing', done: bytes, total: totalBytes });
    },
  });
  const parseMs = performance.now() - tParse;

  // PapaParse meldet verschobene Zeilen (falsche Feldzahl, ungeschlossene
  // Anfuehrungszeichen). Der Import uebernahm sie bis v4.x kommentarlos: die
  // Werte stehen dann in den falschen Spalten. Er laeuft weiter — ein einzelner
  // Ausreisser soll den Tages-Import nicht kippen —, aber er sagt es.
  if (parseErrors.length > 0) {
    const text = parseErrors.map(e => `${e.code}×${e.anzahl} (ab Zeile ${e.beispielZeile})`).join(', ');
    console.warn(
      `[csv-import] „${schema.csv_source_name}": ${text} — betroffene Zeilen sind gegenüber`
      + ' der Kopfzeile verschoben, ihre Werte landen in den falschen Spalten.',
    );
    await logAudit(idb, {
      action: 'csv_import_parse_fehler',
      details: { schemaId, schemaName: schema.csv_source_name, fehler: parseErrors },
    }).catch(() => undefined);
  }

  const joinCol = findJoinColumn(schema);
  if (!joinCol) throw new Error(`Schema ${schemaId}: join_key-Spalte nicht im Mapping`);
  if (!headers.includes(joinCol)) {
    throw new Error(
      `Join-Spalte "${joinCol}" fehlt in der Kopfzeile von „${schema.csv_source_name}" — `
      + `Import abgebrochen, damit die ${rows.length} Zeilen der Quelle nicht als gelöscht gelten. `
      + `Wurde die Spalte im Export umbenannt, die Quelle über „Spalten neu zuordnen" nachziehen.`,
    );
  }

  return { rows, headers, parseErrors, joinCol, parseMs };
}

export interface DiffErgebnis {
  buckets: ImportResult['buckets'];
  newHashes: { csv_schema_id: string; join_value: string; row_hash: string }[];
  newJoinValues: string[];
  changedJoinValues: string[];
  removedJoinValues: string[];
  zuLoeschen: string[];
  gehalten: string[];
  skippedWarnings: string[];
  skippedInactive: number;
  unbekannteUnterprogramme: number;
  rowsWithoutJoinValue: number;
  upFilter: UnterprogrammFilter | null;
  hashDiffMs: number;
}

/**
 * Schritt 2: Row-Diff gegen die gespeicherten Hashes, inklusive
 * Unterprogramm-Filter und Loesch-Rueckhalt.
 *
 * Gefiltert heisst „ich weiss es nicht", nicht „gibt es nicht": ein Antrag,
 * dessen Zeile im Export steht, aber nicht auswertbar war, bleibt stehen.
 *
 * Zeilen OHNE Join-Wert bleiben davon unberuehrt — sie werden gezaehlt und
 * gemeldet, loesen aber keine Sonderbehandlung aus. Am echten Bestand gemessen:
 * die Projektbeschreibung fuehrt 28.926 von 43.149 Zeilen ohne Foerderkennzeichen,
 * weil sie Beteiligungen an Verbuenden listet und nicht Antraege. Der NORMALFALL
 * dieser Quelle also, kein Signal: wer daraufhin die Loeschungen des Laufs
 * aussetzt, legt sie fuer diese Quelle dauerhaft still. Ohne Join-Wert stand die
 * Zeile ausserdem nie in `prevMap` — sie kann fuer sich genommen gar keine
 * Loeschung ausloesen.
 */
export async function berechneRowDiff(args: {
  idb: IDBStore; schemaId: string; schema: CsvSchema; rows: CsvRow[];
  joinCol: string; opts: ImportOptions;
}): Promise<DiffErgebnis> {
  const { idb, schemaId, schema, rows, joinCol, opts } = args;
  const tDiff = performance.now();
  opts.onProgress?.({ phase: 'diffing', done: 0, total: rows.length });
  const prevHashes = await getRowHashesForSchema(idb, schemaId);
  const prevMap = new Map(prevHashes.map(h => [h.join_value, h.row_hash]));

  const upFilter = await getUnterprogrammFilter(idb, schema);
  const upCol = upFilter !== null ? findUnterprogrammColumn(schema) : null;

  const buckets = { new: 0, changed: 0, unchanged: 0, removed: 0 };
  const seen = new Set<string>();
  const newHashes: DiffErgebnis['newHashes'] = [];
  const skippedWarnings: string[] = [];
  const changedJoinValues: string[] = [];
  const newJoinValues: string[] = [];
  let skippedInactive = 0;
  const nichtAufgeloest = new Set<string>();
  let rowsWithoutJoinValue = 0;

  const DIFF_PROGRESS_STEP = 500;
  let diffDone = 0;

  for (const row of rows) {
    const jv = (row[joinCol] ?? '').trim();
    const upUrteil = upFilter && upCol ? beurteileUnterprogramm(row[upCol], upFilter) : 'aktiv';
    if (!jv) {
      rowsWithoutJoinValue++;
      if (skippedWarnings.length < MAX_SKIP_WARNINGS) {
        skippedWarnings.push(`Leerer Join-Value in Zeile, Spalte "${joinCol}"`);
      }
    } else if (upUrteil === 'unbekannt') {
      nichtAufgeloest.add(jv);
    } else if (upUrteil === 'deaktiviert') {
      skippedInactive++;
    } else {
      seen.add(jv);
      const hash = canonicalRowHash(row, schema.column_mapping);
      newHashes.push({ csv_schema_id: schemaId, join_value: jv, row_hash: hash });
      const prev = prevMap.get(jv);
      if (prev === undefined) {
        buckets.new++;
        newJoinValues.push(jv);
      } else if (prev !== hash) {
        buckets.changed++;
        changedJoinValues.push(jv);
      } else {
        buckets.unchanged++;
      }
    }
    diffDone++;
    if (diffDone % DIFF_PROGRESS_STEP === 0) {
      opts.onProgress?.({ phase: 'diffing', done: diffDone, total: rows.length });
      await new Promise(r => setTimeout(r, 0));
      opts.signal?.throwIfAborted();
    }
  }
  opts.onProgress?.({ phase: 'diffing', done: diffDone, total: rows.length });

  const removedJoinValues: string[] = [];
  for (const [jv] of prevMap) {
    if (!seen.has(jv) && !nichtAufgeloest.has(jv)) removedJoinValues.push(jv);
  }

  // Geloescht wird erst, wenn der Antrag in ALLEN Quellen verschwunden ist. Die
  // Quellen haben unterschiedlich lange Historien — dass eine Zeile in DIESEM
  // Export fehlt, heisst nicht, dass es den Antrag nicht mehr gibt.
  const { zuLoeschen, gehalten } = await teileLoeschkandidaten(idb, schema, removedJoinValues);
  buckets.removed = zuLoeschen.length;
  if (gehalten.length > 0) {
    const beispiele = gehalten.slice(0, MAX_SKIP_WARNINGS);
    console.info(
      `[csv-import] ${gehalten.length} Löschung(en) zurückgehalten — andere Quellen führen`
      + ` diese Anträge weiter: ${beispiele.join(', ')}`
      + `${gehalten.length > MAX_SKIP_WARNINGS ? ' …' : ''}`,
    );
    await logAudit(idb, {
      action: 'csv_import_loeschung_zurueckgehalten',
      details: { schemaId, schemaName: schema.csv_source_name, anzahl: gehalten.length, beispiele },
    }).catch(() => undefined);
  }

  return {
    buckets, newHashes, newJoinValues, changedJoinValues, removedJoinValues,
    zuLoeschen, gehalten, skippedWarnings, skippedInactive,
    unbekannteUnterprogramme: nichtAufgeloest.size, rowsWithoutJoinValue,
    upFilter, hashDiffMs: performance.now() - tDiff,
  };
}

/**
 * Schritt 3: Fruehwarnung CSV-Format-Drift.
 *
 * Wenn fast ALLE Zeilen als „geaendert" gelten, hat sich meist nicht der Inhalt,
 * sondern das Export-FORMAT geaendert (Encoding, Zahlen-/Datumsformatierung,
 * z.B. via Excel-Roundtrip). Der Import ist dann korrekt, aber unnoetig teuer.
 */
export async function warneBeiFormatDrift(
  idb: IDBStore, schemaId: string, schema: CsvSchema, rowCount: number, changedRows: number,
): Promise<void> {
  if (rowCount <= 200 || changedRows <= rowCount * 0.8) return;
  const pct = Math.round((changedRows / rowCount) * 100);
  console.warn(`[csv-import] möglicher CSV-Format-Drift: ${changedRows}/${rowCount} Zeilen (${pct}%) als geändert erkannt — Encoding/Zahlen-/Datumsformat des Exports prüfen (nicht über Excel speichern).`);
  await logAudit(idb, {
    action: 'csv_import_format_drift_warning',
    details: { schemaId, schemaName: schema.csv_source_name, changedRows, totalRows: rowCount, pct },
  }).catch(() => undefined);
}

/**
 * Schritt 4: das aktualisierte Schema in-memory bauen.
 *
 * `file_checksum` beschreibt die VERKNUEPFTE Exportdatei — genau wie
 * `source_file_name`/`source_last_modified`/`last_file_size` daneben. Der
 * Remap-Dialog reicht die auf dem Share gespeicherte, nach UTF-8 normalisierte
 * Kopie als Blob herein; deren SHA weicht bei jeder windows-1252- oder
 * BOM-Quelle ab. Wuerde er trotzdem gestempelt, beschriebe der Checksum ab dem
 * Re-Mapping eine andere Datei, und Ampel wie Banner meldeten einmalig „neuer
 * Export" fuer eine unveraenderte Datei — team-weit, denn der falsche Checksum
 * reist ueber den Share mit.
 *
 * Die Quelldatei-Baseline wird HIER gestempelt, vor `saveSchema` und
 * `writeProgrammSnapshot`, damit der Share-Snapshot den frischen `lastModified`
 * traegt. Sonst lesen Snapshot-only-Konsumenten (pl-Build, jeder Rechner nach
 * „clear site data") einen veralteten Wert und melden die Quelle bei JEDEM
 * Cold-Start als „neue Daten".
 */
export async function baueAktualisiertesSchema(
  idb: IDBStore, schema: CsvSchema, csvBlob: Blob, fileSha: string, rowCount: number,
): Promise<CsvSchema> {
  return {
    ...schema,
    ...(csvBlob instanceof File ? { file_checksum: fileSha } : {}),
    last_imported_at: new Date().toISOString(),
    last_row_count: rowCount,
    // `instanceof File`-Guard: der Recompute-/SMB-Reimport-Pfad uebergibt einen
    // Blob ohne sinnvolle Metadaten — dort die Original-Baseline NICHT ueberschreiben.
    ...(csvBlob instanceof File
      ? {
          source_file_name: csvBlob.name,
          source_last_modified: csvBlob.lastModified,
          last_file_size: csvBlob.size,
          // Wessen Sicht dieser Stempel ist — die Divergenz-Warnung nennt ihn.
          source_stamped_by: await resolveSnapshotAuthor(idb).catch(() => undefined),
        }
      : {}),
  };
}

interface MergeArgs {
  idb: IDBStore;
  schema: CsvSchema;
  newJoinValues: string[];
  changedJoinValues: string[];
  removedJoinValues: string[];
  onProgress?: (done: number, total: number) => void;
}

/** Schritt 5: Merge aller betroffenen Antraege (IDB-Writes pro Antrag). */
export async function runMergeForDeltas(
  args: MergeArgs,
): Promise<{ touchedAz: string[]; removedAz: string[] }> {
  const { idb, schema, newJoinValues, changedJoinValues, removedJoinValues, onProgress } = args;
  const touchedAz = new Set<string>();
  let removedAz: string[] = [];

  if (schema.join_key === 'aktenzeichen') {
    for (const jv of [...newJoinValues, ...changedJoinValues]) touchedAz.add(jv);
    removedAz = removedJoinValues;
  } else {
    // Join via verbund_id / akronym → finde alle Antraege im Programm, die davon betroffen sind
    const all = await listAntraegeByProgramm(idb, schema.programm_id);
    const changedSet = new Set([...newJoinValues, ...changedJoinValues, ...removedJoinValues]);
    for (const a of all) {
      const key = schema.join_key === 'akronym'
        ? (typeof a.akronym === 'string' ? a.akronym : undefined)
        : (typeof a.verbund_id === 'string' ? a.verbund_id : undefined);
      if (key && changedSet.has(key)) touchedAz.add(a.aktenzeichen);
    }
  }

  // Delta-skopiert laden (v2.61.5 OOM-Fix): nur die CSV-Rows, die zur
  // Neuberechnung der touchedAz noetig sind — NICHT mehr alle Quellen des
  // Programms komplett (das war der Citrix-OOM-Treiber). Reihenfolge bewusst
  // NACH der touchedAz-Ermittlung.
  logMem(`merge:start (touched=${touchedAz.size}, removed=${removedAz.length})`);
  const cache = await loadScopedSchemasWithRows(idb, schema.programm_id, touchedAz);
  logMem(`merge:scoped-loaded (schemas=${cache.length})`);

  await recomputeMultipleBatched(
    idb,
    schema.programm_id,
    { touchedAz: [...touchedAz], removedAz, schemasCache: cache },
    onProgress,
  );
  logMem('merge:done');
  return { touchedAz: [...touchedAz], removedAz };
}

/**
 * Schritt 6: Snapshot ins Daten-Share — best-effort, blockiert das Import-Result
 * nicht. Bei 13k+ Antraegen sind die JSONL-Files 50–100 MB und der Write kann
 * 10–20 s dauern, daher eine eigene `finalizing`-Sub-Stage.
 *
 * Gibt `publishError` zurueck, wenn der Write scheitert: der Import selbst ist
 * dann durch (IDB steht), aber das Team sieht ihn nicht. Ohne diese Rueckgabe
 * meldete der Wizard „Import abgeschlossen", waehrend der Schwund-Guard (v4.9.0)
 * den Write gerade absichtlich abgebrochen hatte.
 */
export async function schreibeSnapshot(args: {
  idb: IDBStore; schemaId: string; schema: CsvSchema; opts: ImportOptions;
  mergeTouched: string[]; mergeRemoved: string[];
}): Promise<{ snapshotWriteMs: number; publishError?: string }> {
  const { idb, schemaId, schema, opts, mergeTouched, mergeRemoved } = args;
  try {
    const handle = await getDatenShareHandle(idb);
    if (!handle) return { snapshotWriteMs: 0 };
    opts.onProgress?.({ phase: 'finalizing', done: 2, total: 4, stage: 'Snapshot in Daten-Share schreiben (kann einige Sekunden dauern)' });
    // Urheber-Identitaet fuers `createdBy` (Nachname-Fallback statt „unbekannt",
    // wenn kein Kuerzel/Kurator-Name vorhanden — z.B. pl/as mit Kuerzel „alle").
    const kuratorName = await resolveSnapshotAuthor(idb);
    const tSnap = performance.now();
    if (isDeltaSnapshotWriteEnabled()) {
      await writeProgrammSnapshotDelta(idb, handle, schema.programm_id, kuratorName, { touchedAz: mergeTouched, removedAz: mergeRemoved });
    } else {
      await writeProgrammSnapshot(idb, handle, schema.programm_id, kuratorName);
    }
    const snapshotWriteMs = performance.now() - tSnap;
    opts.onProgress?.({ phase: 'finalizing', done: 3, total: 4, stage: 'Audit-Log' });
    // Audit-Write selbst defensiv — sonst landet ein erfolgreicher Snapshot mit
    // einem fehlgeschlagenen Audit faelschlich im snapshot_failed-catch.
    await logAudit(idb, {
      action: 'snapshot_written',
      details: { programmId: schema.programm_id, schemaId },
    }).catch(() => undefined);
    return { snapshotWriteMs };
  } catch (e) {
    await logAudit(idb, {
      action: 'snapshot_failed',
      details: { programmId: schema.programm_id, schemaId, error: (e as Error).message },
    }).catch(() => undefined);
    console.warn('[csv-import] Snapshot-Write fehlgeschlagen:', e);
    return { snapshotWriteMs: 0, publishError: (e as Error).message };
  }
}

/**
 * Schritt 7: die nachlaufenden Integrationen. Alle drei best-effort und alle
 * drei nur bei echten Deltas — ohne neue oder geaenderte Antraege gibt es nichts
 * neu zu matchen, kein neues Statuswort und keine verschobene Frist.
 */
export async function laufeNachImportIntegrationen(
  idb: IDBStore, schema: CsvSchema, changedAktenzeichen: string[],
): Promise<void> {
  // Phase 2: Pending-Antrag-Bucket re-matchen, damit Projektbeschreibungen, die
  // vor dem Antrag eingegangen sind, jetzt automatisch zugeordnet werden.
  try {
    const { rematchOnSnapshotReload } = await import('../../../phase2');
    await rematchOnSnapshotReload(idb, schema.programm_id);
  } catch (e) {
    console.warn('[csv-import] phase2 pending re-match fehlgeschlagen:', e);
  }

  // Status-System: Auto-Discovery unbekannter Statuswerte + Historie-Reconcile.
  if (isStatusCockpitEnabled()) {
    try {
      const { nachImportStatusPflege } = await import('@/core/status/import-integration');
      await nachImportStatusPflege(idb, schema.programm_id, changedAktenzeichen, new Date().toISOString());
    } catch (e) {
      console.warn('[csv-import] Status-System Nachpflege fehlgeschlagen:', e);
    }
  }

  // Bearbeitungs-Meilensteine: Frist-Projektion der offenen Verbuende neu rechnen.
  if (isMeilensteinMonitoringEnabled()) {
    try {
      const { nachImportMeilensteinPflege } = await import('@/core/meilensteine/import-integration');
      await nachImportMeilensteinPflege(idb, schema.programm_id, new Date().toISOString());
    } catch (e) {
      console.warn('[csv-import] Meilenstein-Nachpflege fehlgeschlagen:', e);
    }
  }
}
