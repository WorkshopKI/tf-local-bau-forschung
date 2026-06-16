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
import { readBuildLock, isStale } from '@/core/services/infrastructure/build-lock';
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
import { validateHeaders, hasDrift, type HeaderValidation } from './csv-drift-check';

export interface RefreshCandidate {
  schemaId: string;
  schema: CsvSchema;
}

export interface PermissionNeededEntry {
  schemaId: string;
  schemaName: string;
}

export interface CollectResult {
  /** Quellen mit neuerem lastModified, bereit zum Auto-Update. */
  candidates: RefreshCandidate[];
  /** Quellen, deren Handle/Permission vom User neu erteilt werden muss. */
  permissionNeeded: PermissionNeededEntry[];
  /** Quellen ohne gespeichertes Datei-Handle (z.B. pl-Build: Schemas per
   *  Snapshot, aber nie eine Datei gepickt). */
  unlinked: PermissionNeededEntry[];
}

/**
 * Sammelt über alle Programme + Schemas hinweg, welche CSV-Quellen ein neueres
 * `lastModified` haben (`candidates`), welche eine neue Permission/Handle
 * brauchen (`permissionNeeded`) und welche noch gar nicht verknüpft sind
 * (`unlinked`). React-frei, damit sowohl der Banner-Hook
 * (`useCsvAutoRefreshCheck`) als auch der Start-Orchestrator (`runDataUpdate`)
 * denselben Pfad nutzen.
 */
export async function collectCandidates(idb: IDBStore): Promise<CollectResult> {
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
  for (const schema of all) {
    const r: UpdateCheckResult = await checkSourceForUpdate(idb, schema);
    if (r.state === 'update_available') {
      candidates.push({ schemaId: schema.id, schema });
    } else if (r.state === 'permission_required') {
      permissionNeeded.push({ schemaId: schema.id, schemaName: schema.csv_source_name });
    } else if (r.state === 'no_handle') {
      unlinked.push({ schemaId: schema.id, schemaName: schema.csv_source_name });
    }
  }
  return { candidates, permissionNeeded, unlinked };
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
  phase: 'reading' | 'validating' | 'importing' | 'persisting';
}

export interface RunAutoRefreshOptions {
  onProgress?: (p: RefreshProgress) => void;
  kuratorName?: string;
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

    if (hasDrift(validation)) {
      report.drift.push({ schemaId, schemaName: name, validation });
      continue;
    }

    opts.onProgress?.({ index: i, total: candidates.length, schemaName: name, phase: 'importing' });
    try {
      // Store-Refresh erfolgt gebuendelt im aufrufenden Hook useCsvAutoRefreshCheck
      // nach Abschluss der N-Quellen-Pipeline — ein Refresh pro Quelle waere redundant.
      const result = await importCsvSource(idb, schemaId, file, { // allow-import-no-refresh: Refresh erfolgt gebuendelt im Caller-Hook useCsvAutoRefreshCheck
        onLockConflict: async () => (opts.force ? 'force' : 'abort'),
      });

      opts.onProgress?.({ index: i, total: candidates.length, schemaName: name, phase: 'persisting' });
      await persistSourceMeta(idb, schemaId, file, handle, opts.kuratorName);

      if (result.importTimings) {
        report.importTimings.parseMs += result.importTimings.parseMs;
        report.importTimings.hashDiffMs += result.importTimings.hashDiffMs;
        report.importTimings.mergeMs += result.importTimings.mergeMs;
        report.importTimings.snapshotWriteMs += result.importTimings.snapshotWriteMs;
      }

      report.processed.push({
        schemaId,
        schemaName: name,
        rowCount: result.rowCount,
        skipped: result.skipped,
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
