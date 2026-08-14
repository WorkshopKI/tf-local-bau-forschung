/**
 * Multi-Source-Bulk-Triage-Runner.
 *
 * Sequenziell ueber eine Liste aktiver `DmsSourceEntry` iterieren und pro
 * Source einen Bulk-Scan durchfuehren. Zwischen Sources werden Stats akkumuliert
 * und in `last_index_stats` der Source-Entry gespeichert.
 *
 * Die DMS-CSV wird einmal global gelesen — das spart bei mehreren Sources
 * pro Run die teuren ~30s.
 */

import {
  BulkRunLogger,
  CLASSIFIER_VERSION,
  bulkScanFiles,
  loadDmsCsvFromShare,
  makeLoadBlobFromHandle,
  scanDocSource,
  type AktenplanLookup,
  type BulkScanStats,
  type DmsEntry,
} from '@/phase2';
import {
  getDmsSourceHandle,
  getDatenShareHandle,
} from '@/core/services/infrastructure/smb-handle';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  TRIAGE_TO_STATS_KEY,
  updateDmsSource,
  type DmsSourceEntry,
  type DmsSourceIndexStats,
} from '@/core/services/dms-sources';
import type { IDBStore } from '@/core/services/storage/idb-store';

export interface RunBulkTriageOptions {
  idb: IDBStore;
  programmId: string;
  sources: DmsSourceEntry[];
  fileExtensions: string[];
  maxDepth: number;
  signal?: AbortSignal;
  onSourceStart?: (source: DmsSourceEntry, index: number, total: number) => void;
  onSourceProgress?: (source: DmsSourceEntry, stats: BulkScanStats) => void;
  onSourceFinish?: (source: DmsSourceEntry, stats: BulkScanStats) => void;
  onLogPath?: (path: string | null) => void;
  onInfo?: (msg: string | null) => void;
}

export interface RunBulkTriageResult {
  /** Per-Source-Stats, in der Reihenfolge der `sources`-Liste. */
  perSource: Array<{ source: DmsSourceEntry; stats: BulkScanStats; skipped?: 'no_handle' | 'no_files' }>;
  aggregate: BulkScanStats;
  aborted: boolean;
}

function emptyAggregate(): BulkScanStats {
  return {
    total: 0,
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

function mergeStats(target: BulkScanStats, src: BulkScanStats): void {
  target.total += src.total;
  target.done += src.done;
  target.cache_hit_skip += src.cache_hit_skip;
  target.cache_hit_manifest += src.cache_hit_manifest;
  target.classified_relevant += src.classified_relevant;
  target.classified_irrelevant += src.classified_irrelevant;
  target.classified_pending += src.classified_pending;
  target.classified_review += src.classified_review;
  target.errors += src.errors;
  if (src.aborted) target.aborted = true;
}

function statsToIndexStats(stats: BulkScanStats): DmsSourceIndexStats {
  return {
    docs_total: stats.total,
    docs_relevant: stats.classified_relevant,
    docs_irrelevant: stats.classified_irrelevant,
    docs_review: stats.classified_review,
    docs_pending: stats.classified_pending,
    docs_errors: stats.errors,
  };
}

// re-export, damit die UI-Komponente nicht noch einen extra Import braucht
export { TRIAGE_TO_STATS_KEY };

export async function runBulkTriageForSources(
  opts: RunBulkTriageOptions,
): Promise<RunBulkTriageResult> {
  const aggregate = emptyAggregate();
  const perSource: RunBulkTriageResult['perSource'] = [];

  const datenShare = await getDatenShareHandle(opts.idb);
  if (!datenShare) {
    throw new Error('Kein Daten-Share-Handle. Onboarding nicht abgeschlossen?');
  }

  // DMS-CSV einmal global laden
  opts.onInfo?.('DMS-Index wird geladen…');
  const dms = await loadDmsCsvFromShare(datenShare);
  if (opts.signal?.aborted) {
    aggregate.aborted = true;
    aggregate.finished_at = new Date().toISOString();
    return { perSource, aggregate, aborted: true };
  }
  opts.onInfo?.(null);

  const dmsMap: Map<string, DmsEntry> = dms.entries ?? new Map();
  const aktenplan: Map<string, AktenplanLookup> = dms.aktenplan ?? new Map();

  for (let i = 0; i < opts.sources.length; i++) {
    if (opts.signal?.aborted) {
      aggregate.aborted = true;
      break;
    }
    const source = opts.sources[i];
    if (!source) continue;
    opts.onSourceStart?.(source, i, opts.sources.length);

    const handle = await getDmsSourceHandle(opts.idb, source.id);
    if (!handle) {
      perSource.push({
        source,
        stats: { ...emptyAggregate(), finished_at: new Date().toISOString() },
        skipped: 'no_handle',
      });
      continue;
    }

    // Scan der Source
    opts.onInfo?.(`"${source.label}": Verzeichnisse werden gescannt…`);
    const files = await scanDocSource(handle, {
      sub_roots: source.sub_roots,
      file_extensions: opts.fileExtensions,
      max_depth: opts.maxDepth,
      signal: opts.signal,
      source_id: source.id,
    });
    opts.onInfo?.(null);
    if (opts.signal?.aborted) {
      aggregate.aborted = true;
      break;
    }
    if (files.length === 0) {
      perSource.push({
        source,
        stats: { ...emptyAggregate(), finished_at: new Date().toISOString() },
        skipped: 'no_files',
      });
      continue;
    }

    // Run-Logger pro Source
    let runLog: BulkRunLogger | undefined;
    try {
      runLog = await BulkRunLogger.create(
        datenShare,
        source.sub_roots.length > 0 ? source.sub_roots : [`<source:${source.id}>`],
        files.length,
        CLASSIFIER_VERSION,
      );
      opts.onLogPath?.(runLog.relPath);
    } catch (logErr) {
      console.warn('[dms-sources/bulk-run] Run-Logger konnte nicht erstellt werden', logErr);
    }

    try {
      await logAudit(opts.idb, {
        action: 'dms_source_indexed_started',
        details: { id: source.id, label: source.label, files: files.length },
      });
    } catch { /* ignore */ }

    const ctx = {
      idb: opts.idb,
      programmId: opts.programmId,
      dmsMap,
      aktenplan,
      llmTransport: null,
    };
    const loadBlob = makeLoadBlobFromHandle(handle);
    const stats = await bulkScanFiles({
      ctx,
      files,
      loadBlob,
      signal: opts.signal,
      progressEvery: 25,
      runLog,
      onProgress: s => opts.onSourceProgress?.(source, { ...s }),
    });

    perSource.push({ source, stats });
    mergeStats(aggregate, stats);

    // Source-Metadaten aktualisieren
    try {
      await updateDmsSource(opts.idb, source.id, {
        last_indexed_at: new Date().toISOString(),
        last_index_stats: statsToIndexStats(stats),
      });
    } catch (e) {
      console.warn('[dms-sources/bulk-run] updateDmsSource fehlgeschlagen', e);
    }

    try {
      await logAudit(opts.idb, {
        action: 'dms_source_indexed_finished',
        details: {
          id: source.id,
          label: source.label,
          stats: statsToIndexStats(stats),
          aborted: stats.aborted,
        },
      });
    } catch { /* ignore */ }

    opts.onSourceFinish?.(source, stats);
  }

  aggregate.finished_at = new Date().toISOString();
  return {
    perSource,
    aggregate,
    aborted: aggregate.aborted,
  };
}
