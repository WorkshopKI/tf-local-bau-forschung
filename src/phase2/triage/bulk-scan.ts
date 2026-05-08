/**
 * Bulk-Scan-Loop ueber eine Liste von ScanFiles.
 *
 * - Concurrency-Pool: bis zu N Files gleichzeitig triagiert (Default 4).
 *   pdfjs laeuft im Web-Worker (siehe pdf-extract.ts) und mammoth haelt den
 *   Main-Thread; bei Concurrency >1 koennen mehrere Files parallel durch die
 *   Pipeline. SMB-File-Reads werden ebenfalls parallelisiert (loadBlob laeuft
 *   pro Worker-Coroutine).
 * - try/catch um triageFile() pro Datei: bei Parse-Errors (kaputtes PDF/DOCX)
 *   wird ein Manifest mit triage_state='review', triage_reason='parse_error: ...'
 *   geschrieben, damit ein Re-Run die Datei nicht erneut versucht und der Loop
 *   bei einer korrupten Datei nicht abbricht.
 * - Inkrementalitaet ist "kostenlos": triageFile() hat eingebaute Schnellpfade
 *   (Skip-Liste + Manifest-Cache via mtime+size_bytes). Beim 2. Lauf werden
 *   bekannte Files in O(1) uebersprungen.
 * - AbortSignal-Support fuer User-Abort aus dem UI.
 */
import type { ManifestEntry } from '../types';
import type { ScanFile } from '../scanner/scan-roots';
import { putManifestEntry } from '../scanner/manifest-store';
import { CLASSIFIER_VERSION, triageFile, type TriageContext } from './triage';
import type { BulkRunLogger } from './run-log';

export interface BulkScanStats {
  total: number;
  done: number;
  cache_hit_skip: number;
  cache_hit_manifest: number;
  classified_relevant: number;
  classified_irrelevant: number;
  classified_pending: number;
  classified_review: number;
  errors: number;
  current_file: string | null;
  started_at: string;
  finished_at: string | null;
  aborted: boolean;
}

export interface BulkScanOptions {
  ctx: TriageContext;
  files: ScanFile[];
  loadBlob: (file: ScanFile) => Promise<Blob | null>;
  signal?: AbortSignal;
  onProgress?: (stats: BulkScanStats, lastError?: string) => void;
  /** Wie oft (Files) onProgress getriggert wird. Default 25. */
  progressEvery?: number;
  /**
   * Optionaler Run-Logger — schreibt Errors + Start/End-Events nach
   * _intern/phase2/bulk-scan-runs/{ISO}.jsonl auf den Daten-Share, damit nach
   * Tab-Crashes nichts verloren geht.
   */
  runLog?: BulkRunLogger;
  /**
   * Yield-Pause alle N Files (in ms). Gibt dem Browser GC-Zeit, schuetzt vor
   * OOM bei langen Laeufen mit pdfjs/mammoth-Heap. Default 100ms alle 500
   * Files; bei 0 deaktiviert.
   */
  memoryYieldEveryFiles?: number;
  memoryYieldMs?: number;
  /**
   * Anzahl paralleler Worker-Coroutinen. Default 4. Bei 1 ist der Loop
   * sequentiell (alter Pfad). Bei hoeheren Werten: mehr SMB-Latenz-Hiding,
   * aber Peak-RAM steigt linear (jeder Worker haelt einen ArrayBuffer +
   * pdfjs-Doc waehrend Triage).
   */
  concurrency?: number;
}

function emptyStats(total: number): BulkScanStats {
  return {
    total,
    done: 0,
    cache_hit_skip: 0,
    cache_hit_manifest: 0,
    classified_relevant: 0,
    classified_irrelevant: 0,
    classified_pending: 0,
    classified_review: 0,
    errors: 0,
    current_file: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    aborted: false,
  };
}

function classifyResult(
  manifest: ManifestEntry,
  skipped: boolean,
  stats: BulkScanStats,
): void {
  if (skipped) {
    if (manifest.triage_reason.startsWith('cached: ')) {
      stats.cache_hit_manifest++;
    } else {
      stats.cache_hit_skip++;
    }
    return;
  }
  switch (manifest.triage_state) {
    case 'relevant':
      stats.classified_relevant++;
      break;
    case 'irrelevant':
      stats.classified_irrelevant++;
      break;
    case 'pending_antrag':
      stats.classified_pending++;
      break;
    case 'review':
      stats.classified_review++;
      break;
  }
}

async function persistParseErrorManifest(
  ctx: TriageContext,
  file: ScanFile,
  message: string,
): Promise<ManifestEntry> {
  const manifest: ManifestEntry = {
    filename: file.filename,
    filepath: file.filepath,
    source_id: file.source_id,
    size_bytes: file.size_bytes,
    mtime: file.mtime,
    classifier_version: CLASSIFIER_VERSION,
    classified_at: new Date().toISOString(),
    doc_type: 'sonstiges',
    triage_state: 'review',
    triage_stage: 1,
    triage_source: 'stage1',
    triage_reason: `parse_error: ${message.slice(0, 200)}`,
    extracted_fkz: null,
    extracted_akronym: null,
    matched_antrag_id: null,
    match_method: null,
    match_confidence: 'orphan',
    candidate_antrag_ids: [],
    requires_review: true,
    creator_kuerzel: null,
    dms_bezeichnung: null,
    dms_aktenplan: null,
  };
  await putManifestEntry(ctx.idb, manifest);
  return manifest;
}

export async function bulkScanFiles(opts: BulkScanOptions): Promise<BulkScanStats> {
  const { ctx, files, loadBlob, signal, onProgress, runLog } = opts;
  const progressEvery = opts.progressEvery ?? 25;
  const memYieldEvery = opts.memoryYieldEveryFiles ?? 500;
  const memYieldMs = opts.memoryYieldMs ?? 100;
  const concurrency = Math.max(1, Math.min(16, opts.concurrency ?? 4));
  const stats = emptyStats(files.length);
  // Initialer Progress-Tick, damit das UI sofort die Total-Zahl sieht.
  onProgress?.(stats);

  // Geteilter Index — Worker holen sich den naechsten freien Slot. JavaScript
  // ist single-threaded, daher ist `nextIndex++` atomic ohne Lock.
  let nextIndex = 0;

  // Verhindern dass mehrere Worker gleichzeitig fuer denselben Schwellenwert
  // (z.B. done=500) den Memory-Yield ausloesen — wir markieren erledigte
  // Schwellen.
  const yieldedAt = new Set<number>();

  async function processFile(file: ScanFile): Promise<void> {
    stats.current_file = file.filepath;

    let lastError: string | undefined;
    try {
      const r = await triageFile(ctx, file, loadBlob);
      classifyResult(r.manifest, r.skipped, stats);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = `${file.filepath}: ${msg}`;
      stats.errors++;
      try {
        await persistParseErrorManifest(ctx, file, msg);
      } catch (persistErr) {
        const persistMsg = persistErr instanceof Error ? persistErr.message : String(persistErr);
        lastError = `${file.filepath}: ${msg} | persist: ${persistMsg}`;
      }
      if (runLog) {
        try {
          await runLog.logError(file.filepath, file.filename, msg, stats.done);
        } catch (logErr) {
          console.warn('[phase2/bulk-scan] runLog.logError fehlgeschlagen', logErr);
        }
      }
    }

    stats.done++;

    const isFirst = stats.done === 1;
    const isLast = stats.done === files.length;
    const tickDue = stats.done % progressEvery === 0;
    if (isFirst || isLast || tickDue || lastError) {
      onProgress?.(stats, lastError);
      // Yield damit das UI rendern kann.
      await new Promise(r => setTimeout(r, 0));
    }

    // Memory-Schutz: alle memYieldEvery Files eine laengere Pause + bewusster
    // setTimeout, damit der Browser-GC durchlaufen kann. Bei Concurrency >1
    // sorgt `yieldedAt` dafuer, dass nur ein Worker pro Schwellenwert yieldet.
    if (memYieldEvery > 0 && memYieldMs > 0 && stats.done > 0 && stats.done % memYieldEvery === 0) {
      const threshold = stats.done;
      if (!yieldedAt.has(threshold)) {
        yieldedAt.add(threshold);
        await new Promise(r => setTimeout(r, memYieldMs));
      }
    }
  }

  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) {
        stats.aborted = true;
        return;
      }
      const i = nextIndex;
      nextIndex += 1;
      if (i >= files.length) return;
      const file = files[i];
      if (!file) continue;
      await processFile(file);
    }
  }

  const workers: Promise<void>[] = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  stats.current_file = null;
  stats.finished_at = new Date().toISOString();
  onProgress?.(stats);
  if (runLog) {
    try {
      await runLog.logEnd(stats);
    } catch (logErr) {
      console.warn('[phase2/bulk-scan] runLog.logEnd fehlgeschlagen', logErr);
    }
  }
  return stats;
}
