/**
 * CSV-Auto-Refresh-Orchestrator.
 *
 * Wird vom Kurator-Banner aufgerufen, wenn der Background-Check
 * (useCsvAutoRefreshCheck) eine oder mehrere Quellen mit neuerem
 * `lastModified` gefunden hat.
 *
 * Ablauf pro Quelle (sequenziell):
 *   1. Datei via gespeichertem File-Handle laden (kein User-Picker).
 *   2. Header gegen Schema validieren — bei Drift: skip, sammeln, weiter.
 *   3. `importCsvSource()` aufrufen (laeuft inkl. BuildLock-Acquire,
 *      Snapshot-Write, Phase-2-Rematch).
 *   4. `source_last_modified` + `source_file_name` im Schema nachziehen,
 *      damit der naechste Background-Check die Quelle nicht erneut
 *      flaggt.
 *
 * Lock-Konflikte: `importCsvSource` macht selbst `acquireBuildLock`. Wenn
 * gleichzeitig ein anderer Kurator importiert, wirft der Importer den
 * Lock-Konflikt nach oben — wir fangen das ab und beenden den ganzen
 * Refresh-Lauf mit einem strukturierten Fehler (`BuildLockBusyError`).
 *
 * Permission-Verlust / fehlende Datei: kommt in `errors[]`, blockt aber
 * den Rest der Pipeline nicht.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  importCsvSource,
  loadSchema,
  saveSchema,
  parseCsvPreview,
  listSchemas,
  listProgramme,
} from '@/core/services/csv';
import type { CsvSchema } from '@/core/services/csv/types';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  readBuildLock,
  isStale,
  acquireBuildLock,
  forceLock,
  releaseLock,
  heartbeat,
  HEARTBEAT_INTERVAL_MS,
} from '@/core/services/infrastructure/build-lock';
import { getSmbHandle } from '@/core/services/infrastructure/smb-handle';
import { writeProgrammSnapshot, writeProgrammSnapshotDelta } from '@/core/services/csv/snapshot';
import { isDeltaSnapshotWriteEnabled } from '@/config/feature-flags';
import { BUILD_LOCK_STUFE } from '@/core/services/csv/constants';
import {
  loadFileFromStoredHandle,
  setCsvSourceHandle,
  checkSourceForUpdate,
  getCsvSourceDirHandle,
  getCsvDirFileMap,
  setCsvDirFileMapEntries,
  type UpdateCheckResult,
} from '../csv-source-handle';
import { loadSharedCsvFilenames } from '../csv-source-filenames';
import { validateHeaders, hasDrift, isNewColumnsOnlyDrift, type HeaderValidation } from './csv-drift-check';
import { adoptNewColumnsAsIgnoredMapping } from './new-column-mapping';

export interface RefreshCandidate {
  schemaId: string;
  schema: CsvSchema;
}

export interface PermissionNeededEntry {
  schemaId: string;
  schemaName: string;
}

export interface FileMissingEntry {
  schemaId: string;
  schemaName: string;
  reason: string;
}

export interface UpToDateEntry {
  schemaId: string;
  schemaName: string;
  /** Zuletzt importierte Datei (aus dem Schema) — für „Export vom …"-Diagnose. */
  fileName: string | null;
  sourceLastModified: number | null;
}

export interface CollectResult {
  /** Quellen mit neuerem lastModified, bereit zum Auto-Update. */
  candidates: RefreshCandidate[];
  /** Quellen, deren Handle/Permission vom User neu erteilt werden muss. */
  permissionNeeded: PermissionNeededEntry[];
  /** Quellen ohne gespeichertes Datei-Handle (z.B. pl-Build: Schemas per
   *  Snapshot, aber nie eine Datei gepickt). */
  unlinked: PermissionNeededEntry[];
  /**
   * Fixture-Quellen (`fixture-real-*`) — HART vom Auto-Refresh ausgeschlossen
   * (`local_fixture`). Bisher still verworfen. In einem Produktions-Build ein
   * Fehlkonfigurations-Signal: die echten Exporte werden nie importiert (der
   * 2026-06-Vorfall). Sichtbar-machen statt schweigen.
   */
  fixtures: PermissionNeededEntry[];
  /** Verknüpfte Quellen, deren Datei nicht (mehr) erreichbar war (`file_missing`). */
  fileMissing: FileMissingEntry[];
  /**
   * Quellen, die als „unverändert" erkannt wurden (mtime/Größe-Fast-Path oder
   * Checksum-Treffer). Für die Diagnose „warum wurde 0 importiert" — bei einem
   * Citrix-False-Negative landet die eigentlich neue Datei hier.
   */
  upToDate: UpToDateEntry[];
}

/**
 * Sammelt über alle Programme + Schemas hinweg, welche CSV-Quellen ein neueres
 * `lastModified` haben (`candidates`), welche eine neue Permission/Handle
 * brauchen (`permissionNeeded`) und welche noch gar nicht verknüpft sind
 * (`unlinked`). React-frei, damit sowohl der Banner-Hook
 * (`useCsvAutoRefreshCheck`) als auch der Start-Orchestrator (`runDataUpdate`)
 * denselben Pfad nutzen.
 */
export async function collectCandidates(
  idb: IDBStore,
  opts?: { forceRecheck?: boolean },
): Promise<CollectResult> {
  const programme = await listProgramme(idb);
  const all: CsvSchema[] = [];
  for (const p of programme) {
    const s = await listSchemas(idb, p.id);
    all.push(...s);
  }

  // v2.28: lokale Filemap aus der geteilten Zuordnung (Daten-Ordner) seeden,
  // bevor wir prüfen — so löst ein frisch verknüpfter CSV-Ordner direkt per
  // Dateiname auf (kein teurer Header-Scan), auch auf einem neuen PL-Rechner.
  // Lokale Einträge (eigener Scan/Heal) haben Vorrang und werden NICHT überschrieben.
  try {
    const dir = await getCsvSourceDirHandle(idb);
    if (dir) {
      const [shared, local] = await Promise.all([loadSharedCsvFilenames(idb), getCsvDirFileMap(idb)]);
      const toSeed: Record<string, string> = {};
      for (const [sid, fn] of Object.entries(shared)) {
        if (!local[sid]) toSeed[sid] = fn;
      }
      if (Object.keys(toSeed).length > 0) await setCsvDirFileMapEntries(idb, toSeed);
    }
  } catch {
    /* best-effort — ein Seed-Fehler darf den Check nicht blockieren */
  }

  const candidates: RefreshCandidate[] = [];
  const permissionNeeded: PermissionNeededEntry[] = [];
  const unlinked: PermissionNeededEntry[] = [];
  const fixtures: PermissionNeededEntry[] = [];
  const fileMissing: FileMissingEntry[] = [];
  const upToDate: UpToDateEntry[] = [];
  for (const schema of all) {
    const r: UpdateCheckResult = await checkSourceForUpdate(idb, schema, opts);
    const base = { schemaId: schema.id, schemaName: schema.csv_source_name };
    switch (r.state) {
      case 'update_available':
        candidates.push({ schemaId: schema.id, schema });
        break;
      case 'permission_required':
        permissionNeeded.push(base);
        break;
      case 'no_handle':
        unlinked.push(base);
        break;
      case 'local_fixture':
        fixtures.push(base);
        break;
      case 'file_missing':
        fileMissing.push({ ...base, reason: r.reason });
        break;
      case 'up_to_date':
        upToDate.push({
          ...base,
          fileName: schema.source_file_name ?? null,
          sourceLastModified: schema.source_last_modified ?? null,
        });
        break;
    }
  }
  return { candidates, permissionNeeded, unlinked, fixtures, fileMissing, upToDate };
}

export interface DriftEntry {
  schemaId: string;
  schemaName: string;
  validation: HeaderValidation;
}

export interface ErrorEntry {
  schemaId: string;
  schemaName: string;
  message: string;
}

export interface ProcessedEntry {
  schemaId: string;
  schemaName: string;
  rowCount: number;
  skipped: boolean;
  /**
   * Reine neue CSV-Spalten, die im Auto-Refresh headless als `{ ignore: true }`
   * ins Schema übernommen wurden (nicht-blockierend — die Quelle landet NICHT in
   * `report.drift`, das Modal öffnet nicht). Undefiniert, wenn nichts adoptiert.
   */
  autoAdoptedColumns?: string[];
}

export interface RefreshReport {
  processed: ProcessedEntry[];
  drift: DriftEntry[];
  errors: ErrorEntry[];
  /** Aufsummiertes Per-Phasen-Timing über alle importierten Quellen (ms) —
   *  fürs Performance-Logging des Daten-Update-Orchestrators. */
  importTimings: { parseMs: number; hashDiffMs: number; mergeMs: number; snapshotWriteMs: number };
}

export interface RefreshProgress {
  index: number;
  total: number;
  schemaName: string;
  phase: 'reading' | 'validating' | 'importing' | 'persisting' | 'publishing';
}

export interface RunAutoRefreshOptions {
  onProgress?: (p: RefreshProgress) => void;
  kuratorName?: string;
  /**
   * Nach allen Merges, ABER vor dem (sekundenlangen) gebündelten Snapshot-Write
   * aufgerufen — mit den Programm-IDs, die echte Deltas hatten. Der Caller
   * aktualisiert hier den In-Memory-Store, sodass der lokale User die neuen
   * Anträge sofort sieht und nicht auf das Publizieren für die anderen Rechner
   * wartet (v2.96.3). Best-effort: Fehler dürfen den Publish nicht verhindern.
   */
  onAfterMerge?: (programmIds: string[]) => Promise<void>;
  /**
   * Übergeht die Lock-Prüfung und übernimmt einen bestehenden (Fremd-)Lock per
   * `forceLock`. Wird vom „Trotzdem aktualisieren"-Button im Banner gesetzt
   * (v2.61.5), wenn ein abgestürzter Import einen Lock hinterlassen hat. Im
   * Normalfall (`false`) bricht ein Fremd-Lock den Lauf mit `BuildLockBusyError` ab.
   */
  force?: boolean;
}

/**
 * Geworfen wenn ein anderer Kurator gerade einen Lock haelt.
 * Banner zeigt: "Kurator X aktualisiert gerade seit Y Min".
 */
export class BuildLockBusyError extends Error {
  constructor(public blockingKurator: string, public ageMinutes: number) {
    super(`Lock besetzt von ${blockingKurator} seit ${Math.round(ageMinutes)} Min`);
    this.name = 'BuildLockBusyError';
  }
}

async function probeLock(idb: IDBStore, ownKuratorName: string | undefined): Promise<void> {
  const existing = await readBuildLock(idb);
  if (!existing || isStale(existing)) return;
  if (existing.kurator_name && existing.kurator_name === ownKuratorName) return;
  const ageMs = Date.now() - Date.parse(existing.heartbeat);
  throw new BuildLockBusyError(existing.kurator_name ?? 'unbekannt', ageMs / 60_000);
}

async function persistSourceMeta(
  idb: IDBStore,
  schemaId: string,
  file: File,
  handle: FileSystemFileHandle | null,
  kuratorName: string | undefined,
): Promise<void> {
  if (handle) {
    try {
      await setCsvSourceHandle(idb, schemaId, handle);
    } catch (e) {
      console.warn('[auto-refresh] persist handle failed', e);
    }
  }
  const fresh = await loadSchema(idb, schemaId);
  if (fresh) {
    await saveSchema(idb, {
      ...fresh,
      source_file_name: file.name,
      source_last_modified: file.lastModified,
      last_file_size: file.size,
    });
  }
  await logAudit(idb, {
    action: 'csv_source_auto_updated',
    user: kuratorName,
    details: {
      schemaId,
      fileName: file.name,
      lastModified: new Date(file.lastModified).toISOString(),
    },
  });
}

/**
 * Übernimmt reine neue CSV-Spalten headless als `{ ignore: true }` ins Schema
 * (kein Kurator-Dialog, spiegelt `CsvAddColumnsDialog` headless). Persistiert das
 * gemergte Mapping VOR dem Import — der Importer liest das Schema frisch aus der
 * IDB (`loadSchema` in importer.ts), sodass die adoptierten Spalten bekannt sind.
 * `loadSchema` bewusst FRISCH (nicht der in `collectCandidates` gefangene
 * `candidate.schema`, der zwischenzeitliche Writes verpassen könnte). Schreibt
 * einen Audit-Eintrag und liefert die adoptierten Spaltennamen zurück (für den
 * nicht-blockierenden Report). Wirft bei fehlendem Schema — der Aufrufer behandelt
 * den Fehler dann wie bisher blockierend.
 */
async function adoptNewColumnsAsIgnored(
  idb: IDBStore,
  schemaId: string,
  newColumns: string[],
  kuratorName: string | undefined,
): Promise<string[]> {
  const fresh = await loadSchema(idb, schemaId);
  if (!fresh) throw new Error(`Schema ${schemaId} nicht gefunden`);
  const merged = adoptNewColumnsAsIgnoredMapping(fresh.column_mapping, newColumns);
  await saveSchema(idb, { ...fresh, column_mapping: merged });
  await logAudit(idb, {
    action: 'csv_schema_columns_auto_ignored',
    user: kuratorName,
    details: { schemaId, columns: newColumns },
  });
  return newColumns;
}

/**
 * Faehrt eine Liste von Refresh-Kandidaten sequenziell ab. Wirft
 * `BuildLockBusyError`, wenn ein anderer Kurator gerade laeuft (vor dem
 * ersten Import). Innerhalb der Pipeline werden Lock-Konflikte ebenfalls
 * als `BuildLockBusyError` re-thrown, damit der Caller einheitlich
 * reagieren kann.
 */
export async function runAutoRefresh(
  idb: IDBStore,
  candidates: RefreshCandidate[],
  opts: RunAutoRefreshOptions = {},
): Promise<RefreshReport> {
  const report: RefreshReport = {
    processed: [], drift: [], errors: [],
    importTimings: { parseMs: 0, hashDiffMs: 0, mergeMs: 0, snapshotWriteMs: 0 },
  };
  if (candidates.length === 0) return report;

  // Programme, deren Snapshot nach dem Batch EINMAL geschrieben werden muss
  // (statt pro importierter Quelle, v2.96.2).
  const programmeToPublish = new Set<string>();
  // Pro Programm: Vereinigung der geänderten/entfernten Aktenzeichen über alle
  // importierten Quellen — Basis für EINEN Delta-Snapshot-Write (v2.97).
  const changeByProgramm = new Map<string, { touched: Set<string>; removed: Set<string> }>();

  // force = User-„Trotzdem aktualisieren": Lock-Probe überspringen, der
  // Importer übernimmt den Lock unten per onLockConflict → 'force'.
  if (!opts.force) await probeLock(idb, opts.kuratorName);

  await logAudit(idb, {
    action: 'csv_auto_refresh_started',
    user: opts.kuratorName,
    details: { count: candidates.length, schemaIds: candidates.map(c => c.schemaId) },
  });

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate) continue;
    const { schemaId, schema } = candidate;
    const name = schema.csv_source_name;

    opts.onProgress?.({ index: i, total: candidates.length, schemaName: name, phase: 'reading' });
    let file: File;
    let handle: FileSystemFileHandle | null;
    try {
      const loaded = await loadFileFromStoredHandle(idb, schemaId);
      file = loaded.file;
      handle = loaded.handle;
    } catch (err) {
      report.errors.push({ schemaId, schemaName: name, message: (err as Error).message });
      continue;
    }

    opts.onProgress?.({ index: i, total: candidates.length, schemaName: name, phase: 'validating' });
    let validation: HeaderValidation;
    try {
      const preview = await parseCsvPreview(file, 1, {
        encoding: schema.encoding,
        separator: schema.separator,
      });
      validation = validateHeaders(schema, preview.headers);
    } catch (err) {
      report.errors.push({ schemaId, schemaName: name, message: `Preview fehlgeschlagen: ${(err as Error).message}` });
      continue;
    }

    // Drift-Behandlung:
    //  - Reine `newColumns`-Drift (nichts fehlt, nur Zusatzspalten): headless als
    //    `{ ignore: true }` adoptieren, dann normal importieren. Unbeaufsichtigt,
    //    damit der tägliche Auto-Import nicht blockiert (Zusatzspalten werden beim
    //    Import ohnehin ignoriert).
    //  - `missingFromCsv > 0`: bleibt blockierend (report.drift → Modal), weil eine
    //    verschwundene gemappte Spalte echte Felder leeren kann.
    let autoAdopted: string[] = [];
    if (hasDrift(validation)) {
      if (isNewColumnsOnlyDrift(validation)) {
        try {
          autoAdopted = await adoptNewColumnsAsIgnored(idb, schemaId, validation.newColumns, opts.kuratorName);
        } catch (err) {
          // Adopt fehlgeschlagen → wie bisher blockierend behandeln, statt still
          // mit unvollständigem Schema zu importieren.
          console.warn('[auto-refresh] Auto-Adopt neuer Spalten fehlgeschlagen', err);
          report.drift.push({ schemaId, schemaName: name, validation });
          continue;
        }
      } else {
        report.drift.push({ schemaId, schemaName: name, validation });
        continue;
      }
    }

    opts.onProgress?.({ index: i, total: candidates.length, schemaName: name, phase: 'importing' });
    try {
      // Store-Refresh erfolgt gebuendelt im aufrufenden Hook useCsvAutoRefreshCheck
      // nach Abschluss der N-Quellen-Pipeline — ein Refresh pro Quelle waere redundant.
      const result = await importCsvSource(idb, schemaId, file, { // allow-import-no-refresh: Refresh erfolgt gebuendelt im Caller-Hook useCsvAutoRefreshCheck
        onLockConflict: async () => (opts.force ? 'force' : 'abort'),
        // Snapshot-Write bündeln: bei N Quellen schreibt sonst jede den vollen
        // Snapshot (~25 s, touched-unabhängig). Wir publizieren EINMAL nach dem
        // Batch (siehe unten).
        deferSnapshotWrite: true,
      });

      opts.onProgress?.({ index: i, total: candidates.length, schemaName: name, phase: 'persisting' });
      await persistSourceMeta(idb, schemaId, file, handle, opts.kuratorName);

      if (result.importTimings) {
        report.importTimings.parseMs += result.importTimings.parseMs;
        report.importTimings.hashDiffMs += result.importTimings.hashDiffMs;
        report.importTimings.mergeMs += result.importTimings.mergeMs;
        report.importTimings.snapshotWriteMs += result.importTimings.snapshotWriteMs;
      }

      // Programm zum Publizieren vormerken, wenn dieser Import echte Deltas hatte
      // (sonst ist der vorhandene Snapshot bereits aktuell). Geänderte/entfernte
      // Aktenzeichen je Programm sammeln (für den gebündelten Delta-Write).
      const hadDeltas = result.buckets.new + result.buckets.changed + result.buckets.removed > 0;
      if (hadDeltas) {
        programmeToPublish.add(schema.programm_id);
        const acc = changeByProgramm.get(schema.programm_id) ?? { touched: new Set<string>(), removed: new Set<string>() };
        for (const k of result.changedAktenzeichen ?? []) acc.touched.add(k);
        for (const k of result.removedAktenzeichen ?? []) acc.removed.add(k);
        changeByProgramm.set(schema.programm_id, acc);
      }

      report.processed.push({
        schemaId,
        schemaName: name,
        rowCount: result.rowCount,
        skipped: result.skipped,
        ...(autoAdopted.length > 0 ? { autoAdoptedColumns: autoAdopted } : {}),
      });
    } catch (err) {
      const msg = (err as Error).message;
      // Wenn der Importer-interne Lock auf einen Fremd-Kurator stoesst,
      // wird die Pipeline komplett abgebrochen — sonst laufen wir gegen
      // den naechsten Lock und produzieren N Fehler in Folge.
      if (msg.includes('Anderer Import läuft')) {
        const existing = await readBuildLock(idb);
        await logAudit(idb, {
          action: 'csv_auto_refresh_lock_conflict',
          user: opts.kuratorName,
          details: { blocking_kurator: existing?.kurator_name ?? 'unbekannt', schemaId },
        });
        await logAudit(idb, {
          action: 'csv_auto_refresh_complete',
          user: opts.kuratorName,
          details: {
            processed: report.processed.length,
            drift: report.drift.length,
            errors: report.errors.length,
            aborted_reason: 'lock_conflict',
          },
        });
        throw new BuildLockBusyError(
          existing?.kurator_name ?? 'unbekannt',
          existing ? (Date.now() - Date.parse(existing.heartbeat)) / 60_000 : 0,
        );
      }
      report.errors.push({ schemaId, schemaName: name, message: msg });
    }
  }

  // Lokalen Store JETZT aktualisieren (nach allen Merges, vor dem ~25-s-Publish):
  // der lokale User sieht die neuen Anträge sofort, statt auf das Publizieren für
  // die anderen Rechner zu warten (v2.96.3). Best-effort.
  if (programmeToPublish.size > 0 && opts.onAfterMerge) {
    await opts.onAfterMerge([...programmeToPublish]).catch(err =>
      console.warn('[csv-auto-refresh] onAfterMerge fehlgeschlagen', err));
  }

  // Gebündelter Snapshot-Write: EINMAL pro betroffenem Programm statt pro Quelle
  // (v2.96.2). Unter Build-Lock, mit Heartbeat (ein Write kann ~25 s dauern).
  if (programmeToPublish.size > 0) {
    opts.onProgress?.({ index: 0, total: programmeToPublish.size, schemaName: 'Datenbestand', phase: 'publishing' });
    const handle = await getSmbHandle(idb);
    if (handle) {
      const tSnap = Date.now();
      // Lock holen — die Einzel-Importe hatten ihn je gehalten+freigegeben, hier
      // sollte er frei sein. Falls nicht (Fremd-Schreiber im Mikro-Fenster):
      // übernehmen, weil WIR die frisch gemergten Daten besitzen und publizieren
      // müssen (sonst bliebe der Merge lokal, da source_last_modified schon
      // gestempelt ist → kein Re-Import). Single-Team-Trust-Modell.
      const lockRes = await acquireBuildLock(idb, BUILD_LOCK_STUFE, {});
      if (!lockRes.acquired) {
        await forceLock(idb, BUILD_LOCK_STUFE, {});
        await logAudit(idb, {
          action: 'csv_auto_refresh_snapshot_force',
          user: opts.kuratorName,
          details: { blocking_kurator: lockRes.existing.kurator_name },
        });
      }
      const hb = setInterval(() => void heartbeat(idb).catch(() => undefined), HEARTBEAT_INTERVAL_MS);
      try {
        const identity = opts.kuratorName ?? 'unbekannt';
        const deltaMode = isDeltaSnapshotWriteEnabled();
        for (const pid of programmeToPublish) {
          if (deltaMode) {
            const acc = changeByProgramm.get(pid) ?? { touched: new Set<string>(), removed: new Set<string>() };
            const r = await writeProgrammSnapshotDelta(idb, handle, pid, identity, { touchedAz: [...acc.touched], removedAz: [...acc.removed] });
            await logAudit(idb, { action: 'snapshot_written', details: { programmId: pid, source: 'csv_auto_refresh_batch', mode: r.mode } }).catch(() => undefined);
          } else {
            await writeProgrammSnapshot(idb, handle, pid, identity);
            await logAudit(idb, { action: 'snapshot_written', details: { programmId: pid, source: 'csv_auto_refresh_batch' } }).catch(() => undefined);
          }
        }
      } catch (e) {
        await logAudit(idb, {
          action: 'snapshot_failed',
          details: { error: (e as Error).message, source: 'csv_auto_refresh_batch' },
        }).catch(() => undefined);
        console.warn('[csv-auto-refresh] Snapshot-Batch-Write fehlgeschlagen:', e);
      } finally {
        clearInterval(hb);
        await releaseLock(idb).catch(() => undefined);
      }
      report.importTimings.snapshotWriteMs += Date.now() - tSnap;
    }
  }

  await logAudit(idb, {
    action: 'csv_auto_refresh_complete',
    user: opts.kuratorName,
    details: {
      processed: report.processed.length,
      drift: report.drift.length,
      errors: report.errors.length,
    },
  });

  return report;
}
