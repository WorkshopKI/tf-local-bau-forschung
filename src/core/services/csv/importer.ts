import type { IDBStore } from '../storage/idb-store';
import { logAudit } from '../infrastructure/audit-log';
import { acquireBuildLock, forceLock, releaseLock, startHeartbeat } from '../infrastructure/build-lock';
import { getDatenShareHandle } from '../infrastructure/smb-handle';
import { resolveSnapshotAuthor } from '../infrastructure/update-author';
import { writeProgrammSnapshot, writeProgrammSnapshotDelta } from './snapshot';
import {
  isDeltaSnapshotWriteEnabled, isMeilensteinMonitoringEnabled, isStatusCockpitEnabled,
} from '@/config/feature-flags';
import { BUILD_LOCK_STUFE, MAX_SKIP_WARNINGS } from './constants';
import { canonicalRowHash } from './hash';
import { sha1Hex } from './sha1';
import { parseCsvAllStreamed, readWithEncodingFallback } from './parser';
import { saveCsvSourceFile, saveSchema, loadSchema } from './schemaRegistry';
import {
  deleteRowHashes,
  getJoinValuesForSchema,
  getRowHashesForSchema,
  listAntraegeByProgramm,
  listSchemasByProgramm,
  putRowHashes,
} from './idb-csv';
import {
  loadScopedSchemasWithRows,
  recomputeMultipleBatched,
} from './merger';
import {
  findUnterprogrammColumn,
  getUnterprogrammFilter,
  recomputeUnterprogrammStats,
} from './unterprogrammRegistry';
import type { UnterprogrammFilter } from './unterprogrammRegistry';
import { logMem } from '../../utils/log-mem';
import type { CsvEncoding, CsvSchema, ImportResult } from './types';

export interface ImportProgress {
  phase: 'hashing' | 'parsing' | 'diffing' | 'merging' | 'finalizing' | 'done';
  done: number;
  total: number;
  /** Sub-Step-Beschreibung waehrend 'finalizing' (z.B. 'Snapshot speichern…'). */
  stage?: string;
}

export interface ImportOptions {
  signal?: AbortSignal;
  onProgress?: (p: ImportProgress) => void;
  onLockConflict?: (ageMinutes: number) => Promise<'force' | 'abort'>;
  /**
   * Wird EINMAL nach dem Parsen mit den rohen Export-Zeilen aufgerufen.
   *
   * Für Konsumenten, die den Export selbst sehen müssen statt seines gemergten
   * Ergebnisses — heute das Import-Diff-Journal: es datiert Änderungen an
   * `D_`-Spalten, und ein gemergter Wert ist eine Mischung mehrerer Quellen.
   * Die Zeilen liegen an dieser Stelle ohnehin im Speicher, ein zweiter Parse
   * über eine 67-MB-Datei wäre reine Verschwendung.
   *
   * Best-effort: ein Fehler darf den Import nicht abbrechen — das Journal ist
   * eine Begleitung, keine Voraussetzung.
   */
  onRows?: (rows: Record<string, string>[], headers: string[]) => Promise<void>;
  /**
   * Ueberschreibt schema.encoding fuer DIESEN Import. Wichtig beim Re-Import
   * der gespeicherten SMB-Datei: die wird in saveCsvSourceFile immer als
   * UTF-8 normalisiert geschrieben — egal was schema.encoding sagt. Beim
   * Wieder-Lesen muessen wir dann auch UTF-8 erzwingen, sonst landet ein
   * windows-1252-Decode auf UTF-8-Bytes → Mojibake → Hash-Drift bei jedem
   * Re-Import.
   */
  encodingOverride?: CsvEncoding;
  /**
   * Umgeht den SHA-1-Datei-Checksum-Skip (Zeile unten). Wird von EXPLIZITEN,
   * vom Kurator ausgeloesten Re-Imports gesetzt (Wizard-Abschluss, „Neue
   * Spalten uebernehmen", „CSV neu waehlen") — dort ist die Absicht eindeutig
   * „jetzt neu verarbeiten", auch wenn die Datei byte-gleich ist (z.B. weil nur
   * das Column-Mapping geaendert wurde). Der Row-Hash-Diff (`canonicalRowHash`
   * bezieht das Mapping ein) erkennt dann die geaenderten Zeilen und merged neu.
   * Der automatische Auto-Refresh setzt das NICHT — dort ist der Checksum-Skip
   * als „hat sich die Datei geaendert?"-Optimierung korrekt.
   */
  force?: boolean;
  /**
   * Überspringt den Snapshot-Write ans Daten-Share. Wird vom Batch-Caller
   * (`runAutoRefresh`) gesetzt: bei N gleichzeitig importierten Quellen schreibt
   * sonst JEDE den vollen Snapshot (~14k Records + SHA-256, touched-unabhängig,
   * ~25 s/Stück, Messung v2.96). Stattdessen schreibt der Caller den Snapshot
   * EINMAL nach dem Batch. Der lokale Antrag-/Hash-Stand wird trotzdem voll
   * gemerged — nur das Publizieren auf den Share wird gebündelt.
   */
  deferSnapshotWrite?: boolean;
  /**
   * Der AUFRUFER hält den Build-Lock bereits über den ganzen Lauf (heute nur
   * `runAutoRefresh`). Dann übernimmt der Importer weder Acquire/Force noch
   * Heartbeat noch Release.
   *
   * Grund (v3.46.1): pro Quelle neu zu locken erzeugt pro Quelle ein
   * Freigabe-Fenster. Ein noch laufender Heartbeat-Schlag legte die gerade
   * gelöschte Lock-Datei darin neu an → die NÄCHSTE Quelle lief gegen den
   * eigenen Nachhall und der Lauf brach ab (belegt im Audit-Log: `release`,
   * eine Sekunde später ein `force` gegen den eigenen Namen). Die vier
   * Dialog-Aufrufer setzen das NICHT — sie sind Einzel-Importe und locken
   * weiterhin selbst.
   */
  lockHeldByCaller?: boolean;
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
  const timings = { parseMs: 0, hashDiffMs: 0, mergeMs: 0, snapshotWriteMs: 0 };
  const result: ImportResult = {
    skipped: false,
    buckets: { new: 0, changed: 0, unchanged: 0, removed: 0 },
    durationMs: 0,
    rowCount: 0,
    skippedJoinValues: [],
    importTimings: timings,
  };

  const schema = await loadSchema(idb, schemaId);
  if (!schema) throw new Error(`Schema ${schemaId} nicht gefunden`);

  // Build-Lock erwerben (mit Force-Dialog) — außer der Aufrufer hält ihn schon
  // über den ganzen Lauf (`lockHeldByCaller`).
  if (!opts.lockHeldByCaller) {
    const lockRes = await acquireBuildLock(idb, BUILD_LOCK_STUFE, { programm_id: schema.programm_id });
    if (!lockRes.acquired) {
      const decision = opts.onLockConflict ? await opts.onLockConflict(lockRes.ageMinutes) : 'abort';
      if (decision === 'abort') {
        throw new Error('Anderer Import läuft bereits. Abgebrochen.');
      }
      await forceLock(idb, BUILD_LOCK_STUFE, { programm_id: schema.programm_id });
    }
  }

  // Heartbeat-Takt: hält den Lock während des (langen) Imports frisch, damit
  // ein parallel laufender Import nicht durch die kurze csv-import-Stale-Schwelle
  // (3 Min) fälschlich als abgestürzt übernommen wird. Stürzt DIESER Tab ab,
  // stoppt der Heartbeat → der Lock altert und gibt sich nach ~3 Min selbst frei
  // (Crash-Recovery, v2.61.5). Best-effort: Heartbeat-Fehler dürfen den Import
  // nicht abbrechen. `startHeartbeat().stop()` wartet den laufenden Schlag ab —
  // siehe build-lock.ts.
  const hb = opts.lockHeldByCaller ? null : startHeartbeat(idb);

  try {
    // SHA-1 der Datei berechnen
    const fileSha = await sha1Hex(csvBlob);
    // `force` umgeht den Skip: ein expliziter Re-Import (z.B. nach Mapping-
    // Aenderung) muss auch bei byte-gleicher Datei neu verarbeiten.
    if (!opts.force && schema.file_checksum === fileSha) {
      result.skipped = true;
      result.durationMs = Date.now() - started;
      await logAudit(idb, {
        action: 'csv_import_skipped',
        details: { schemaId, reason: 'checksum_match' },
      });
      return result;
    }

    // Parse (mit Schema-persistierten Encoding/Separator, falls vorhanden).
    // encodingOverride hat Vorrang — wird vom Re-Import-Dialog auf 'UTF-8'
    // gesetzt, weil die SMB-gespeicherte Datei immer UTF-8 ist.
    const effectiveEncoding = opts.encodingOverride ?? schema.encoding;
    opts.signal?.throwIfAborted();
    opts.onProgress?.({ phase: 'parsing', done: 0, total: csvBlob.size });
    const tParse = performance.now();
    let { rows, headers, parseErrors } = await parseCsvAllStreamed(csvBlob, {
      encoding: effectiveEncoding,
      separator: schema.separator,
      onProgress: (bytes, totalBytes) => {
        opts.onProgress?.({ phase: 'parsing', done: bytes, total: totalBytes });
      },
    });
    timings.parseMs = performance.now() - tParse;
    result.rowCount = rows.length;

    // PapaParse meldet verschobene Zeilen (falsche Feldzahl, ungeschlossene
    // Anführungszeichen). Der Import übernahm sie bisher kommentarlos: die
    // Werte stehen dann in den falschen Spalten. Er läuft weiter — ein einzelner
    // Ausreisser soll den Tages-Import nicht kippen —, aber er sagt es.
    if (parseErrors.length > 0) {
      result.parseErrors = parseErrors;
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

    // Die Join-Spalte muss in der GELESENEN Kopfzeile stehen, nicht nur im
    // Mapping. `findJoinColumn` löst gegen `column_mapping` auf — wird die
    // Spalte im Export umbenannt oder fällt sie weg, bleibt das Mapping formal
    // gültig, `row[joinCol]` ist aber in JEDER Zeile leer: `seen` bleibt leer,
    // alle bisherigen Join-Werte landen in `removedJoinValues`, und der Merge
    // löscht den kompletten Bestand der Quelle — im Auto-Refresh team-weit
    // publiziert, während die Quelle als erledigt gestempelt wird und nie
    // wieder anläuft. Der Abbruch steht bewusst VOR `saveCsvSourceFile` und
    // vor jedem Schema-Stempel: so bleibt die Share-Kopie unangetastet und der
    // nächste Lauf versucht es erneut, statt den Fehler stillzulegen.
    const joinCol = findJoinColumn(schema);
    if (!joinCol) throw new Error(`Schema ${schemaId}: join_key-Spalte nicht im Mapping`);
    if (!headers.includes(joinCol)) {
      throw new Error(
        `Join-Spalte "${joinCol}" fehlt in der Kopfzeile von „${schema.csv_source_name}" — `
        + `Import abgebrochen, damit die ${result.rowCount} Zeilen der Quelle nicht als gelöscht gelten. `
        + `Wurde die Spalte im Export umbenannt, die Quelle über „Spalten neu zuordnen" nachziehen.`,
      );
    }

    // Rohe Export-Zeilen durchreichen (Journal). Best-effort: ein Fehler hier
    // darf den Import nicht abbrechen.
    if (opts.onRows) {
      await opts.onRows(rows, headers).catch((err: unknown) =>
        console.warn('[csv-import] onRows fehlgeschlagen', err));
    }

    // Persist CSV to SMB (für Merge beim nächsten Recompute + für Backup).
    // CSV in UTF-8 normalisieren bevor sie auf den Share geht — der Merge-Pfad
    // (loadCsvSourceFile -> readText -> Blob.text()) dekodiert per Spec immer
    // als UTF-8. Ohne Normalisierung gehen Umlaute aus windows-1252-CSVs beim
    // Roundtrip kaputt.
    const { text: csvText } = await readWithEncodingFallback(csvBlob, effectiveEncoding);
    const utf8Blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    await saveCsvSourceFile(idb, schemaId, utf8Blob);

    // Row-Diff
    const tDiff = performance.now();
    opts.onProgress?.({ phase: 'diffing', done: 0, total: rows.length });
    const prevHashes = await getRowHashesForSchema(idb, schemaId);
    const prevMap = new Map(prevHashes.map(h => [h.join_value, h.row_hash]));

    // Unterprogramm-Filter (nur Master)
    const upFilter = await getUnterprogrammFilter(idb, schema);
    const upCol = upFilter !== null ? findUnterprogrammColumn(schema) : null;

    const seen = new Set<string>();
    const newHashes: { csv_schema_id: string; join_value: string; row_hash: string }[] = [];
    const skippedWarnings: string[] = [];
    const changedJoinValues: string[] = [];
    const newJoinValues: string[] = [];
    let skippedInactive = 0;
    // Zeilen, die im Export STEHEN, deren Unterprogramm der Import aber nicht
    // auflösen konnte. Sie werden nicht importiert — dürfen aber auch nicht als
    // Löschung durchgehen, sonst löscht eine leere Zelle den Antrag.
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
          result.buckets.new++;
          newJoinValues.push(jv);
        } else if (prev !== hash) {
          result.buckets.changed++;
          changedJoinValues.push(jv);
        } else {
          result.buckets.unchanged++;
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

    result.skippedInactiveUnterprogramm = skippedInactive;
    if (nichtAufgeloest.size > 0) result.unknownUnterprogramm = nichtAufgeloest.size;
    if (rowsWithoutJoinValue > 0) result.rowsWithoutJoinValue = rowsWithoutJoinValue;

    // Gefiltert heisst „ich weiss es nicht", nicht „gibt es nicht": ein Antrag,
    // dessen Zeile im Export steht, aber nicht auswertbar war, bleibt stehen.
    //
    // Zeilen OHNE Join-Wert bleiben davon unberührt — sie werden gezählt und
    // gemeldet, lösen aber keine Sonderbehandlung aus. Am echten Bestand
    // gemessen: die Projektbeschreibung führt 28 926 von 43 149 Zeilen ohne
    // Förderkennzeichen (Irrläufer, frühe Phasen; alle Felder belegt, nur eben
    // ohne FKZ). Solche Zeilen sind der NORMALFALL dieser Quelle, kein Signal.
    // Wer daraufhin die Löschungen des Laufs aussetzt, legt sie für diese Quelle
    // dauerhaft still. Ohne Join-Wert stand die Zeile ausserdem nie in `prevMap`
    // — sie kann für sich genommen gar keine Löschung auslösen.
    const removedJoinValues: string[] = [];
    for (const [jv] of prevMap) {
      if (!seen.has(jv) && !nichtAufgeloest.has(jv)) removedJoinValues.push(jv);
    }

    // Gelöscht wird erst, wenn der Antrag in ALLEN Quellen verschwunden ist.
    // Die Quellen haben unterschiedlich lange Historien — dass eine Zeile in
    // DIESEM Export fehlt, heisst nicht, dass es den Antrag nicht mehr gibt.
    const { zuLoeschen, gehalten } = await teileLoeschkandidaten(idb, schema, removedJoinValues);
    result.buckets.removed = zuLoeschen.length;
    if (gehalten.length > 0) {
      result.heldRemovals = gehalten.length;
      result.heldRemovalExamples = gehalten.slice(0, MAX_SKIP_WARNINGS);
      console.info(
        `[csv-import] ${gehalten.length} Löschung(en) zurückgehalten — andere Quellen führen`
        + ` diese Anträge weiter: ${result.heldRemovalExamples.join(', ')}`
        + `${gehalten.length > MAX_SKIP_WARNINGS ? ' …' : ''}`,
      );
      await logAudit(idb, {
        action: 'csv_import_loeschung_zurueckgehalten',
        details: {
          schemaId,
          schemaName: schema.csv_source_name,
          anzahl: gehalten.length,
          beispiele: result.heldRemovalExamples,
        },
      }).catch(() => undefined);
    }
    result.skippedJoinValues = skippedWarnings;
    timings.hashDiffMs = performance.now() - tDiff;

    // Frühwarnung CSV-Format-Drift: wenn fast ALLE Zeilen als „geändert" gelten,
    // hat sich meist nicht der Inhalt, sondern das Export-FORMAT geändert
    // (Encoding, Zahlen-/Datumsformatierung, z.B. via Excel-Roundtrip). Der
    // Import ist dann korrekt, aber unnötig teuer (Voll-Merge + Voll-Write).
    const changedRows = result.buckets.new + result.buckets.changed;
    if (rows.length > 200 && changedRows > rows.length * 0.8) {
      const pct = Math.round((changedRows / rows.length) * 100);
      console.warn(`[csv-import] möglicher CSV-Format-Drift: ${changedRows}/${rows.length} Zeilen (${pct}%) als geändert erkannt — Encoding/Zahlen-/Datumsformat des Exports prüfen (nicht über Excel speichern).`);
      await logAudit(idb, {
        action: 'csv_import_format_drift_warning',
        details: { schemaId, schemaName: schema.csv_source_name, changedRows, totalRows: rows.length, pct },
      }).catch(() => undefined);
    }

    // updatedSchema in-memory bauen (Cancel-Barriere bereits passiert)
    const updatedSchema: CsvSchema = {
      ...schema,
      file_checksum: fileSha,
      last_imported_at: new Date().toISOString(),
      last_row_count: rows.length,
      // Quelldatei-Baseline HIER stempeln — VOR saveSchema + writeProgrammSnapshot
      // (unten), damit der Share-Snapshot den frischen lastModified traegt. Sonst
      // lesen Snapshot-only-Konsumenten (pl-Build / jeder Rechner nach „clear site
      // data") einen veralteten oder leeren `source_last_modified` und melden die
      // Quelle bei JEDEM Cold-Start als „neue Daten" (Auto-Refresh-Fehlalarm,
      // checkSourceForUpdate). Bisher wurde dieses Feld nur post-import in
      // persistCsvSourceMeta/persistSourceMeta gesetzt — also in der LOKALEN IDB
      // des Importeurs, NACH dem Snapshot-Write. `instanceof File`-Guard: der
      // Recompute-/SMB-Reimport-Pfad uebergibt einen Blob ohne sinnvolle
      // lastModified — dort die Original-Baseline NICHT ueberschreiben.
      ...(csvBlob instanceof File
        ? { source_file_name: csvBlob.name, source_last_modified: csvBlob.lastModified, last_file_size: csvBlob.size }
        : {}),
    };

    // Letzte Cancel-Barriere vor IDB-Writes
    opts.signal?.throwIfAborted();

    // Nur wenn es echte Deltas gibt, die teuren Schritte (Merge, Unterprogramm-
    // Statistik, Snapshot-Write ~50-100 MB + SHA-256, Phase-2-Rematch) fahren.
    // Ein force-Re-Import ohne Aenderungen (gleiche Datei + gleiches Mapping)
    // aktualisiert nur Hashes/Schema und ist damit quasi-instant — kein voller
    // 13k-Recompute + kein synchrones JSON.stringify des gesamten Programms.
    // Zurückgehaltene Löschungen zählen bewusst NICHT als Delta: am Antrags-
    // Bestand ändert sich nichts, nur die Row-Hashes dieser Quelle ziehen nach
    // (weiter unten, ausserhalb dieses Gates).
    const hasDeltas =
      newJoinValues.length > 0 || changedJoinValues.length > 0 || zuLoeschen.length > 0;

    // Speicher freigeben (v2.61.5 OOM-Fix): die geparsten Rows dieser Quelle
    // werden ab hier nicht mehr gebraucht (Diff fertig, rowCount + Schema
    // gestempelt). Der Merge liest die Quelle ohnehin frisch vom Share
    // (loadScopedSchemasWithRows) → kein Datenverlust, aber eine volle
    // Quell-Kopie weniger gleichzeitig im RAM neben dem Merge-Cache.
    rows = [];

    // Merge für alle betroffenen Antraege (IDB-Writes pro Antrag)
    let mergeTouched: string[] = [];
    let mergeRemoved: string[] = [];
    if (hasDeltas) {
      opts.onProgress?.({ phase: 'merging', done: 0, total: 0 });
      const tMerge = performance.now();
      const mr = await runMergeForDeltas({
        idb,
        schema: updatedSchema,
        newJoinValues,
        changedJoinValues,
        removedJoinValues: zuLoeschen,
        onProgress: (done, total) =>
          opts.onProgress?.({ phase: 'merging', done, total }),
      });
      mergeTouched = mr.touchedAz;
      mergeRemoved = mr.removedAz;
      timings.mergeMs = performance.now() - tMerge;
    }
    // Geänderte/entfernte Antrag-Keys nach oben reichen — der Batch-Caller
    // (runAutoRefresh) sammelt sie für EINEN Delta-Snapshot-Write (v2.97).
    result.changedAktenzeichen = mergeTouched;
    result.removedAktenzeichen = mergeRemoved;

    // Hashes + Schema NACH erfolgreichem Merge persistieren — Cancel zwischen
    // Diff und Merge hat dann nichts in IDB hinterlassen.
    opts.onProgress?.({ phase: 'finalizing', done: 0, total: 4, stage: 'Row-Hashes speichern' });
    await putRowHashes(idb, newHashes);
    // Bewusst die VOLLE Liste, auch die zurückgehaltenen: die Row-Hashes
    // spiegeln, was DIESE Quelle trägt — und die trägt die Zeile nicht mehr.
    // Bliebe der Hash stehen, hielte diese Quelle den Antrag später gegen die
    // Löschung durch die letzte verbleibende Quelle fest, und er stürbe nie.
    if (removedJoinValues.length > 0) {
      await deleteRowHashes(idb, schemaId, removedJoinValues);
    }
    await saveSchema(idb, updatedSchema);

    // Nach Merge: Antrag-Counts + Auto-Zeitraum pro Unterprogramm neu berechnen (für Admin-Panel).
    // Ohne Deltas bleiben die Counts gleich → ueberspringen.
    if (schema.is_master && hasDeltas) {
      opts.onProgress?.({ phase: 'finalizing', done: 1, total: 4, stage: 'Unterprogramm-Statistiken' });
      await recomputeUnterprogrammStats(idb, schema.programm_id);
    }

    // Snapshot ins Daten-Share — best-effort, blockiert den Import-Result nicht.
    // Bei 13k+ Antraegen sind die JSONL-Files ~50-100 MB — der Write kann
    // 10-20 s dauern, daher hier eine eigene 'finalizing'-Sub-Stage damit der
    // User nicht im "100%-Stillstand" haengt. Ohne Deltas ist der Antraege-Stand
    // unveraendert → der vorhandene Snapshot ist bereits aktuell, Write entfaellt.
    if (hasDeltas && !opts.deferSnapshotWrite) try {
      const handle = await getDatenShareHandle(idb);
      if (handle) {
        opts.onProgress?.({ phase: 'finalizing', done: 2, total: 4, stage: 'Snapshot in Daten-Share schreiben (kann einige Sekunden dauern)' });
        // Urheber-Identität fürs `createdBy` (Nachname-Fallback statt „unbekannt",
        // wenn kein Kürzel/Kurator-Name vorhanden — z.B. pl/as mit Kürzel „alle").
        const kuratorName = await resolveSnapshotAuthor(idb);
        const tSnap = performance.now();
        if (isDeltaSnapshotWriteEnabled()) {
          await writeProgrammSnapshotDelta(idb, handle, schema.programm_id, kuratorName, { touchedAz: mergeTouched, removedAz: mergeRemoved });
        } else {
          await writeProgrammSnapshot(idb, handle, schema.programm_id, kuratorName);
        }
        timings.snapshotWriteMs = performance.now() - tSnap;
        opts.onProgress?.({ phase: 'finalizing', done: 3, total: 4, stage: 'Audit-Log' });
        // Audit-Write selbst defensiv — sonst landet ein erfolgreicher Snapshot
        // mit einem fehlgeschlagenen Audit faelschlich im snapshot_failed-catch.
        await logAudit(idb, {
          action: 'snapshot_written',
          details: { programmId: schema.programm_id, schemaId },
        }).catch(() => undefined);
      }
    } catch (e) {
      await logAudit(idb, {
        action: 'snapshot_failed',
        details: { programmId: schema.programm_id, schemaId, error: (e as Error).message },
      }).catch(() => undefined);
      console.warn('[csv-import] Snapshot-Write fehlgeschlagen:', e);
      // Der Import selbst ist durch (IDB steht), aber das Team sieht ihn nicht.
      // Ohne diese Zeile meldete der Wizard „Import abgeschlossen", während der
      // Schwund-Guard (v4.9.0) den Write gerade absichtlich abgebrochen hatte.
      result.publishError = (e as Error).message;
    }

    result.durationMs = Date.now() - started;
    opts.onProgress?.({ phase: 'done', done: result.rowCount, total: result.rowCount });
    await logAudit(idb, {
      action: 'csv_import',
      details: {
        schemaId,
        schemaName: schema.csv_source_name,
        buckets: result.buckets,
        durationMs: result.durationMs,
        rowCount: result.rowCount,
        skippedInactiveUnterprogramm: result.skippedInactiveUnterprogramm ?? 0,
        heldRemovals: result.heldRemovals ?? 0,
        unknownUnterprogramm: result.unknownUnterprogramm ?? 0,
        rowsWithoutJoinValue: result.rowsWithoutJoinValue ?? 0,
        activeUnterprogramme: upFilter ? Array.from(upFilter.aktiv).sort() : null,
      },
    });

    // Phase 2: Pending-Antrag-Bucket nach Import re-matchen, damit
    // Projektbeschreibungen, die vor dem Antrag eingegangen sind, jetzt
    // automatisch zugeordnet werden. Best-effort, blockiert das Result nicht.
    // Ohne neue/geaenderte Antraege gibt es nichts neu zu matchen → ueberspringen.
    if (hasDeltas) try {
      const { rematchOnSnapshotReload } = await import('../../../phase2');
      await rematchOnSnapshotReload(idb, schema.programm_id);
    } catch (e) {
      console.warn('[csv-import] phase2 pending re-match fehlgeschlagen:', e);
    }

    // Status-System neu: Auto-Discovery unbekannter Statuswerte + Historie-
    // Reconcile (append-only Status-Events). Best-effort, gated hinter
    // `statusCockpit`; ohne Deltas gibt es nichts Neues → ueberspringen.
    if (hasDeltas && isStatusCockpitEnabled()) try {
      const { nachImportStatusPflege } = await import('@/core/status/import-integration');
      await nachImportStatusPflege(
        idb, schema.programm_id, result.changedAktenzeichen ?? [], new Date().toISOString(),
      );
    } catch (e) {
      console.warn('[csv-import] Status-System Nachpflege fehlgeschlagen:', e);
    }

    // Bearbeitungs-Meilensteine: Frist-Projektion der offenen Verbuende neu
    // rechnen. Best-effort, gated hinter `meilensteinMonitoring`; ohne Deltas
    // aendert sich am Stand nichts → ueberspringen.
    if (hasDeltas && isMeilensteinMonitoringEnabled()) try {
      const { nachImportMeilensteinPflege } = await import('@/core/meilensteine/import-integration');
      await nachImportMeilensteinPflege(idb, schema.programm_id, new Date().toISOString());
    } catch (e) {
      console.warn('[csv-import] Meilenstein-Nachpflege fehlgeschlagen:', e);
    }
    return result;
  } finally {
    if (hb) {
      await hb.stop();
      await releaseLock(idb).catch(() => undefined);
    }
  }
}

/**
 * Urteil über die Unterprogramm-Zelle einer Master-Zeile.
 *
 * Der Schnitt entscheidet, ob eine nicht importierte Zeile als Löschung zählt
 * (Team-Entscheidung 2026-08-13: gefiltert heisst „ich weiss es nicht", nicht
 * „gibt es nicht"):
 *
 *   - `aktiv`        → Zeile wird importiert
 *   - `deaktiviert`  → Code steht im Katalog, der Kurator hat ihn abgewählt.
 *                      Eine Entscheidung, also darf sie löschen.
 *   - `unbekannt`    → Zelle leer oder Code nicht im Katalog. Eine Lücke im
 *                      Wissen, keine Aussage über den Antrag — nicht löschen.
 */
function beurteileUnterprogramm(
  zelle: string | undefined,
  filter: UnterprogrammFilter,
): 'aktiv' | 'deaktiviert' | 'unbekannt' {
  const code = (zelle ?? '').trim();
  if (filter.aktiv.has(code)) return 'aktiv';
  return filter.bekannt.has(code) ? 'deaktiviert' : 'unbekannt';
}

/**
 * Teilt die Löschkandidaten einer Quelle in „wirklich weg" und „eine andere
 * Quelle führt den Antrag weiter".
 *
 * Fachliche Regel (Team-Entscheidung 2026-08-13): ein Antrag wird erst gelöscht,
 * wenn er in ALLEN Quellen verschwunden ist. Die Quellen reichen unterschiedlich
 * weit zurück — Master und Begleitung führen den Bestand bis 2015, die
 * Projektbeschreibung bis 2012. „Fehlt in diesem Export" ist deshalb keine
 * Aussage über die Existenz des Antrags, sondern über den Horizont der Quelle.
 *
 * Geprüft wird gegen die Row-Hashes der anderen Quellen, nicht gegen deren
 * Dateien: die Hashes spiegeln exakt, was die Quelle bei ihrem letzten Import
 * getragen hat, und werden am Ende jedes Imports mitgezogen. Dadurch löst sich
 * der Rückhalt von selbst auf, sobald die letzte Quelle die Zeile fallen lässt
 * — auch innerhalb desselben Auto-Refresh-Laufs und unabhängig davon, in
 * welcher Reihenfolge die Quellen dran waren.
 *
 * Nur Quellen mit `join_key === 'aktenzeichen'` zählen: die Join-Werte der
 * verbund_id-/akronym-Quellen sind Verbund-Nummern und Akronyme, keine
 * Aktenzeichen — ihre Übereinstimmung wäre reiner Zufall.
 *
 * Bekannte Grenze: eine stillgelegte Quelle, die nie wieder importiert wird,
 * hält ihre Row-Hashes und damit ihre Anträge dauerhaft fest. Wer eine Quelle
 * ausser Betrieb nimmt, muss sie entfernen (`removeSchema`) — sonst altert der
 * Bestand nicht mehr.
 */
async function teileLoeschkandidaten(
  idb: IDBStore,
  schema: CsvSchema,
  kandidaten: string[],
): Promise<{ zuLoeschen: string[]; gehalten: string[] }> {
  if (kandidaten.length === 0 || schema.join_key !== 'aktenzeichen') {
    return { zuLoeschen: kandidaten, gehalten: [] };
  }
  const andere = (await listSchemasByProgramm(idb, schema.programm_id))
    .filter(s => s.id !== schema.id && s.join_key === 'aktenzeichen');
  if (andere.length === 0) return { zuLoeschen: kandidaten, gehalten: [] };

  const zuLoeschen: string[] = [];
  const gehalten: string[] = [];
  const offen = new Set(kandidaten);
  for (const s of andere) {
    if (offen.size === 0) break;
    for (const jv of await getJoinValuesForSchema(idb, s.id)) {
      if (offen.delete(jv)) gehalten.push(jv);
    }
  }
  for (const jv of kandidaten) {
    if (offen.has(jv)) zuLoeschen.push(jv);
  }
  return { zuLoeschen, gehalten };
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

async function runMergeForDeltas(args: MergeArgs): Promise<{ touchedAz: string[]; removedAz: string[] }> {
  const { idb, schema, newJoinValues, changedJoinValues, removedJoinValues, onProgress } = args;
  const touchedAz = new Set<string>();
  let removedAz: string[] = [];

  if (schema.join_key === 'aktenzeichen') {
    for (const jv of [...newJoinValues, ...changedJoinValues]) touchedAz.add(jv);
    removedAz = removedJoinValues;
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
