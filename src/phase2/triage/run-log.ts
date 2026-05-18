/**
 * Persistenter Run-Logger fuer Bulk-Triage-Laeufe.
 *
 * Schreibt eine JSONL-Datei pro Run nach _intern/phase2/bulk-scan-runs/
 * {ISO-Date}.jsonl auf den Daten-Share. Errors werden sofort geflusht
 * (jeder Open/Append/Close-Cycle ein File-System-Roundtrip), Progress-Events
 * werden in-memory gepuffert und nur bei Bedarf bzw. bei Run-Ende gespiegelt.
 *
 * Bei Tab-Crash bleiben alle bis zum letzten Error-Flush geschriebenen Events
 * erhalten — der User kann sie nach Reload nachlesen.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **Bewusste Ausnahme zu CLAUDE.md Pitfall #10**: dieser Logger nutzt
 * `fh.createWritable({ keepExistingData: true })` mit `position: file.size`
 * direkt — NICHT `atomicWrite()` und NICHT `appendToFile()` aus
 * `core/services/infrastructure/atomic-write.ts`.
 *
 * Grund: `appendToFile()` liest die existierende Datei bei jedem Aufruf
 * komplett in den Speicher und schreibt sie + die neue Zeile zurueck (O(n)
 * pro Append). Bei 13k+ Antraegen pro Bulk-Lauf + Progress-Event alle 500
 * Antraege wuerde das jede Append-Zeit linear mit der Log-Groesse wachsen
 * lassen und am Ende des Laufs Minuten kosten.
 *
 * Sicherheits-Argument: das Risiko (Crash mid-write korrumpiert das File)
 * ist hier akzeptabel, weil (a) die JSONL pro Run neu angelegt wird (keine
 * langlebige Master-Datei), (b) Events einzeln und sofort geflusht werden,
 * (c) ein korrumpiertes Tail-Event wird beim Re-Parse einfach uebersprungen.
 *
 * NICHT zu `atomicWrite()` migrieren — das war wohlueberlegt.
 * ─────────────────────────────────────────────────────────────────────────
 */
import type { BulkScanStats } from './bulk-scan';

export interface RunLogStartEvent {
  type: 'start';
  ts: string;
  run_id: string;
  total_files: number;
  selected_paths: string[];
  classifier_version: number;
}

export interface RunLogErrorEvent {
  type: 'error';
  ts: string;
  filepath: string;
  filename: string;
  message: string;
  files_done_when_error: number;
}

export interface RunLogProgressEvent {
  type: 'progress';
  ts: string;
  done: number;
  total: number;
  cache_hits: number;
  errors: number;
}

export interface RunLogEndEvent {
  type: 'end';
  ts: string;
  stats: BulkScanStats;
}

export type RunLogEvent =
  | RunLogStartEvent
  | RunLogErrorEvent
  | RunLogProgressEvent
  | RunLogEndEvent;

const RUN_LOG_DIR_INTERN = '_intern';
const RUN_LOG_DIR_PHASE2 = 'phase2';
const RUN_LOG_DIR_RUNS = 'bulk-scan-runs';

function isoForFilename(): string {
  // 2026-05-05T08-46-12 — Doppelpunkte/Punkte entfernt fuer Windows-Kompat
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

interface WritableExt extends FileSystemWritableFileStream {
  write(data: { type: 'write'; position: number; data: string }): Promise<void>;
}

export class BulkRunLogger {
  private constructor(
    private dir: FileSystemDirectoryHandle,
    private filename: string,
    public readonly runId: string,
    public readonly relPath: string,
  ) {}

  /** Erzeugt Logger + leere Datei mit Header. */
  static async create(
    datenShare: FileSystemDirectoryHandle,
    selectedPaths: string[],
    totalFiles: number,
    classifierVersion: number,
  ): Promise<BulkRunLogger> {
    const intern = await datenShare.getDirectoryHandle(RUN_LOG_DIR_INTERN, { create: true });
    const phase2 = await intern.getDirectoryHandle(RUN_LOG_DIR_PHASE2, { create: true });
    const runs = await phase2.getDirectoryHandle(RUN_LOG_DIR_RUNS, { create: true });
    const runId = isoForFilename();
    const filename = `${runId}.jsonl`;
    const relPath = `${RUN_LOG_DIR_INTERN}/${RUN_LOG_DIR_PHASE2}/${RUN_LOG_DIR_RUNS}/${filename}`;
    const fh = await runs.getFileHandle(filename, { create: true });
    const w = await fh.createWritable();
    await w.close(); // Leere Datei als Anker
    const logger = new BulkRunLogger(runs, filename, runId, relPath);
    await logger.appendEvent({
      type: 'start',
      ts: new Date().toISOString(),
      run_id: runId,
      total_files: totalFiles,
      selected_paths: selectedPaths,
      classifier_version: classifierVersion,
    });
    return logger;
  }

  /** Schreibt ein Event sofort durch (FS-Roundtrip). */
  async appendEvent(event: RunLogEvent): Promise<void> {
    const line = JSON.stringify(event) + '\n';
    const fh = await this.dir.getFileHandle(this.filename);
    const file = await fh.getFile();
    // keepExistingData=true + position=size → echte Append-Semantik ohne
    // O(n)-Reread bei jedem Schreiben.
    const w = (await fh.createWritable({ keepExistingData: true })) as WritableExt;
    try {
      await w.write({ type: 'write', position: file.size, data: line });
    } finally {
      await w.close();
    }
  }

  async logError(
    filepath: string,
    filename: string,
    message: string,
    filesDoneWhenError: number,
  ): Promise<void> {
    await this.appendEvent({
      type: 'error',
      ts: new Date().toISOString(),
      filepath,
      filename,
      message: message.slice(0, 1000),
      files_done_when_error: filesDoneWhenError,
    });
  }

  async logProgress(stats: BulkScanStats): Promise<void> {
    await this.appendEvent({
      type: 'progress',
      ts: new Date().toISOString(),
      done: stats.done,
      total: stats.total,
      cache_hits: stats.cache_hit_skip + stats.cache_hit_manifest,
      errors: stats.errors,
    });
  }

  async logEnd(stats: BulkScanStats): Promise<void> {
    await this.appendEvent({
      type: 'end',
      ts: new Date().toISOString(),
      stats,
    });
  }
}
