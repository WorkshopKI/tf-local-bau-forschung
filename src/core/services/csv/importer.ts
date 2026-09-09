import type { IDBStore } from '../storage/idb-store';
import { logAudit } from '../infrastructure/audit-log';
import { acquireBuildLock, forceLock, releaseLock, startHeartbeat } from '../infrastructure/build-lock';
import { BUILD_LOCK_STUFE, MAX_SKIP_WARNINGS } from './constants';
import { sha1Hex } from './sha1';
import { readWithEncodingFallback } from './parser';
import { saveCsvSourceFile, saveSchema, loadSchema } from './schemaRegistry';
import { schreibeLokalenStempel, stempelFuerDatei } from './lokaler-stempel';
import { deleteRowHashes, putRowHashes } from './idb-csv';
import { recomputeUnterprogrammStats } from './unterprogrammRegistry';
// Die benannten Phasen des Laufs. Der Orchestrator unten haelt nur noch das
// zusammen, was ueber sie hinweg gilt: Lock + Heartbeat, die drei
// Abbruch-Schranken, die Speicher-Freigabe vor dem Merge und das ImportResult.
import {
  baueAktualisiertesSchema,
  berechneRowDiff,
  laufeNachImportIntegrationen,
  leseUndPruefe,
  runMergeForDeltas,
  schreibeSnapshot,
  warneBeiFormatDrift,
} from './importer-schritte';
import type { CsvEncoding, ImportResult } from './types';

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
    result.fileChecksum = fileSha;
    // `force` umgeht den Skip: ein expliziter Re-Import (z.B. nach Mapping-
    // Aenderung) muss auch bei byte-gleicher Datei neu verarbeiten.
    if (!opts.force && schema.file_checksum === fileSha) {
      result.skipped = true;
      result.durationMs = Date.now() - started;
      // Auch „byte-gleich, nichts zu tun" ist ein Beleg dieses Rechners: der
      // Team-Stempel, der den Skip erlaubt hat, kann beim naechsten Sync durch
      // eine fremde Sicht ersetzt sein — der lokale nicht.
      if (csvBlob instanceof File) await schreibeLokalenStempel(idb, schemaId, stempelFuerDatei(csvBlob, fileSha));
      await logAudit(idb, {
        action: 'csv_import_skipped',
        details: { schemaId, reason: 'checksum_match' },
      });
      return result;
    }


    // ---- Schritt 1: lesen und pruefen ------------------------------------
    // Wirft, wenn die Join-Spalte in der GELESENEN Kopfzeile fehlt — bewusst VOR
    // jedem Share-Write und jedem Schema-Stempel, damit die Share-Kopie
    // unangetastet bleibt und der naechste Lauf es erneut versucht.
    const effectiveEncoding = opts.encodingOverride ?? schema.encoding;
    opts.signal?.throwIfAborted();
    const lese = await leseUndPruefe(idb, schemaId, schema, csvBlob, effectiveEncoding, opts);
    let rows = lese.rows;
    timings.parseMs = lese.parseMs;
    result.rowCount = rows.length;
    if (lese.parseErrors.length > 0) result.parseErrors = lese.parseErrors;

    // Rohe Export-Zeilen durchreichen (Journal). Best-effort: ein Fehler hier
    // darf den Import nicht abbrechen.
    if (opts.onRows) {
      await opts.onRows(rows, lese.headers).catch((err: unknown) =>
        console.warn('[csv-import] onRows fehlgeschlagen', err));
    }

    // ---- Share-Kopie ersetzen --------------------------------------------
    // CSV in UTF-8 normalisieren, bevor sie auf den Share geht — der Merge-Pfad
    // (loadCsvSourceFile -> readText -> Blob.text()) dekodiert per Spec immer als
    // UTF-8. Ohne Normalisierung gehen Umlaute aus windows-1252-CSVs beim
    // Roundtrip kaputt.
    const { text: csvText } = await readWithEncodingFallback(csvBlob, effectiveEncoding);
    const utf8Blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    // ABBRUCH-SCHRANKE 2 von 3 — die wichtigste, und deshalb steht sie hier im
    // Orchestrator und nicht in einem Schritt: Der Merge liest seine Zeilen
    // ausschliesslich aus dieser Kopie. Wurde sie ersetzt und der Lauf danach
    // abgebrochen, beschrieben Row-Hashes, `file_checksum` und alle Antraege den
    // ALTEN Stand, die Kopie aber den NEUEN — und der naechste, voellig
    // unabhaengige Import einer ANDEREN Quelle rechnete die von ihm beruehrten
    // Antraege mit den Werten des abgebrochenen Exports neu. Der Bestand wurde
    // zur Mischung und so publiziert; der Dialog hatte „Keine Änderungen am
    // Datenbestand" zugesagt.
    opts.signal?.throwIfAborted();
    await saveCsvSourceFile(idb, schemaId, utf8Blob);

    // ---- Schritt 2: Row-Diff ---------------------------------------------
    const diff = await berechneRowDiff({
      idb, schemaId, schema, rows, joinCol: lese.joinCol, opts,
    });
    result.buckets = diff.buckets;
    result.skippedJoinValues = diff.skippedWarnings;
    result.skippedInactiveUnterprogramm = diff.skippedInactive;
    if (diff.unbekannteUnterprogramme > 0) result.unknownUnterprogramm = diff.unbekannteUnterprogramme;
    if (diff.rowsWithoutJoinValue > 0) result.rowsWithoutJoinValue = diff.rowsWithoutJoinValue;
    if (diff.gehalten.length > 0) {
      result.heldRemovals = diff.gehalten.length;
      result.heldRemovalExamples = diff.gehalten.slice(0, MAX_SKIP_WARNINGS);
    }
    timings.hashDiffMs = diff.hashDiffMs;

    // ---- Schritt 3: Frühwarnung Format-Drift ------------------------------
    await warneBeiFormatDrift(
      idb, schemaId, schema, rows.length, diff.buckets.new + diff.buckets.changed,
    );

    // ---- Schritt 4: aktualisiertes Schema in-memory -----------------------
    const updatedSchema = await baueAktualisiertesSchema(
      idb, schema, csvBlob, fileSha, rows.length,
    );

    // ABBRUCH-SCHRANKE 3 von 3: letzte vor den IDB-Writes.
    opts.signal?.throwIfAborted();

    // Nur wenn es echte Deltas gibt, die teuren Schritte (Merge, Unterprogramm-
    // Statistik, Snapshot-Write, Phase-2-Rematch) fahren. Ein force-Re-Import
    // ohne Aenderungen aktualisiert nur Hashes/Schema und ist quasi-instant.
    // Zurueckgehaltene Loeschungen zaehlen bewusst NICHT als Delta: am
    // Antrags-Bestand aendert sich nichts, nur die Row-Hashes dieser Quelle
    // ziehen nach (weiter unten, ausserhalb dieses Gates).
    const hasDeltas = diff.newJoinValues.length > 0
      || diff.changedJoinValues.length > 0
      || diff.zuLoeschen.length > 0;

    // Speicher freigeben (v2.61.5 OOM-Fix) — bleibt bewusst im Orchestrator: die
    // geparsten Rows werden ab hier nicht mehr gebraucht (Diff fertig, rowCount +
    // Schema gestempelt), und der Merge liest die Quelle ohnehin frisch vom
    // Share. Ein Schritt, der die Zeilen laenger festhaelt, bringt den
    // Citrix-OOM zurueck.
    rows = [];

    // ---- Schritt 5: Merge (IDB-Writes pro Antrag) -------------------------
    let mergeTouched: string[] = [];
    let mergeRemoved: string[] = [];
    if (hasDeltas) {
      opts.onProgress?.({ phase: 'merging', done: 0, total: 0 });
      const tMerge = performance.now();
      const mr = await runMergeForDeltas({
        idb,
        schema: updatedSchema,
        newJoinValues: diff.newJoinValues,
        changedJoinValues: diff.changedJoinValues,
        removedJoinValues: diff.zuLoeschen,
        onProgress: (done, total) => opts.onProgress?.({ phase: 'merging', done, total }),
      });
      mergeTouched = mr.touchedAz;
      mergeRemoved = mr.removedAz;
      timings.mergeMs = performance.now() - tMerge;
    }
    // Geaenderte/entfernte Antrag-Keys nach oben reichen — der Batch-Caller
    // (runAutoRefresh) sammelt sie fuer EINEN Delta-Snapshot-Write (v2.97).
    result.changedAktenzeichen = mergeTouched;
    result.removedAktenzeichen = mergeRemoved;

    // Hashes + Schema NACH erfolgreichem Merge persistieren — ein Cancel zwischen
    // Diff und Merge hat dann nichts in IDB hinterlassen.
    opts.onProgress?.({ phase: 'finalizing', done: 0, total: 4, stage: 'Row-Hashes speichern' });
    await putRowHashes(idb, diff.newHashes);
    // Bewusst die VOLLE Liste, auch die zurueckgehaltenen: die Row-Hashes
    // spiegeln, was DIESE Quelle traegt — und die traegt die Zeile nicht mehr.
    // Bliebe der Hash stehen, hielte diese Quelle den Antrag spaeter gegen die
    // Loeschung durch die letzte verbleibende Quelle fest, und er stuerbe nie.
    if (diff.removedJoinValues.length > 0) {
      await deleteRowHashes(idb, schemaId, diff.removedJoinValues);
    }
    await saveSchema(idb, updatedSchema);
    // Lokaler Beleg „DIESER Rechner hat DIESE Datei verarbeitet" — im kv-Store,
    // nie im Schema (das reist im Snapshot und wird beim Sync ersetzt). Nur fuer
    // echte Dateien: der Recompute-/SMB-Reimport-Pfad uebergibt einen Blob ohne
    // sinnvolle Metadaten.
    if (csvBlob instanceof File) await schreibeLokalenStempel(idb, schemaId, stempelFuerDatei(csvBlob, fileSha));

    // Nach Merge: Antrag-Counts + Auto-Zeitraum pro Unterprogramm neu berechnen
    // (fuer das Admin-Panel). Ohne Deltas bleiben die Counts gleich.
    if (schema.is_master && hasDeltas) {
      opts.onProgress?.({ phase: 'finalizing', done: 1, total: 4, stage: 'Unterprogramm-Statistiken' });
      await recomputeUnterprogrammStats(idb, schema.programm_id);
    }

    // ---- Schritt 6: Snapshot ins Daten-Share ------------------------------
    // Best-effort, blockiert das Result nicht. Ohne Deltas ist der Antraege-Stand
    // unveraendert → der vorhandene Snapshot ist bereits aktuell, Write entfaellt.
    if (hasDeltas && !opts.deferSnapshotWrite) {
      const snap = await schreibeSnapshot({
        idb, schemaId, schema, opts, mergeTouched, mergeRemoved,
      });
      timings.snapshotWriteMs = snap.snapshotWriteMs;
      if (snap.publishError !== undefined) result.publishError = snap.publishError;
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
        activeUnterprogramme: diff.upFilter ? Array.from(diff.upFilter.aktiv).sort() : null,
      },
    });

    // ---- Schritt 7: nachlaufende Integrationen ----------------------------
    // Phase-2-Rematch, Status-System, Meilensteine — alle best-effort und alle
    // nur bei echten Deltas.
    if (hasDeltas) {
      await laufeNachImportIntegrationen(idb, schema, result.changedAktenzeichen ?? []);
    }
    return result;
  } finally {
    if (hb) {
      await hb.stop();
      await releaseLock(idb).catch(() => undefined);
    }
  }
}
