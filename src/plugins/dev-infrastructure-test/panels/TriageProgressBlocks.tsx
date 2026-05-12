/**
 * Live-Progress-Visualisierungen fuer das Phase-2 Triage-Panel.
 *
 * Aus `TriagePanel.tsx` extrahiert. Zwei eigenstaendige Bloecke:
 * - `ScanProgressBlock`: Verzeichnis-Scan mit ETA-Schaetzung
 * - `BulkProgressBlock`: Triage-Lauf mit kategorisierten Counts
 */
import { formatDuration, computeEta } from '@/core/utils/eta';
import type { BulkScanStats } from '@/phase2';
import type { ScanProgressState } from './useTriagePanel';

export function ScanProgressBlock({ scanProgress }: { scanProgress: ScanProgressState }): React.ReactElement {
  const elapsedMs = scanProgress.lastTick - scanProgress.startedAt;
  const ratePerSec = elapsedMs > 0 ? (scanProgress.filesSoFar * 1000) / elapsedMs : 0;
  const etaMs = scanProgress.estimatedTotal !== null
    && ratePerSec > 0
    && scanProgress.estimatedTotal > scanProgress.filesSoFar
    ? ((scanProgress.estimatedTotal - scanProgress.filesSoFar) / ratePerSec) * 1000
    : null;

  return (
    <div className="mt-4 rounded-[var(--tf-radius)] p-3 bg-[var(--tf-bg-secondary)]">
      <div className="text-[11px] uppercase text-[var(--tf-text-tertiary)] mb-1.5" style={{ letterSpacing: '0.08em' }}>
        Scan-Progress
      </div>
      {scanProgress.estimatedTotal !== null && (
        <div className="h-2 w-full overflow-hidden rounded bg-[var(--tf-bg)]">
          <div
            className="h-full bg-[var(--tf-primary)] transition-[width] duration-200"
            style={{
              width: `${Math.min(100, (scanProgress.filesSoFar / scanProgress.estimatedTotal) * 100)}%`,
            }}
          />
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-[var(--tf-text-secondary)]">
        <span>Files: {scanProgress.filesSoFar.toLocaleString('de-DE')}</span>
        {scanProgress.estimatedTotal !== null && (
          <span>~ {scanProgress.estimatedTotal.toLocaleString('de-DE')} erwartet</span>
        )}
        <span>{Math.round(ratePerSec).toLocaleString('de-DE')} Files/s</span>
        <span>vergangen: {formatDuration(elapsedMs)}</span>
        {etaMs !== null && <span>ETA: {formatDuration(etaMs)}</span>}
      </div>
      {scanProgress.dir && (
        <div className="mt-1 truncate text-[10.5px] text-[var(--tf-text-tertiary)]">
          aktuell: {scanProgress.dir || '<root>'}
        </div>
      )}
    </div>
  );
}

export function BulkProgressBlock({ bulkStats, bulkTick }: {
  bulkStats: BulkScanStats;
  bulkTick: number;
}): React.ReactElement {
  const startedAtMs = new Date(bulkStats.started_at).getTime();
  const finishedAtMs = bulkStats.finished_at ? new Date(bulkStats.finished_at).getTime() : bulkTick;
  const elapsedMs = Math.max(0, finishedAtMs - startedAtMs);
  const ratePerSec = elapsedMs > 0 ? (bulkStats.done * 1000) / elapsedMs : 0;
  const eta = !bulkStats.finished_at && !bulkStats.aborted
    ? computeEta(elapsedMs, bulkStats.done, bulkStats.total)
    : null;

  return (
    <div className="mt-4 rounded-[var(--tf-radius)] p-3 bg-[var(--tf-bg-secondary)]">
      <div className="text-[11px] uppercase text-[var(--tf-text-tertiary)] mb-1.5" style={{ letterSpacing: '0.08em' }}>
        Bulk-Progress
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-[var(--tf-bg)]">
        <div
          className="h-full bg-[var(--tf-primary)] transition-[width] duration-200"
          style={{
            width: `${bulkStats.total > 0 ? (bulkStats.done / bulkStats.total) * 100 : 0}%`,
          }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-[var(--tf-text-secondary)]">
        <span>{bulkStats.done.toLocaleString('de-DE')}/{bulkStats.total.toLocaleString('de-DE')}</span>
        <span>cache(skip): {bulkStats.cache_hit_skip}</span>
        <span>cache(manifest): {bulkStats.cache_hit_manifest}</span>
        <span>relevant: {bulkStats.classified_relevant}</span>
        <span>irrelevant: {bulkStats.classified_irrelevant}</span>
        <span>pending: {bulkStats.classified_pending}</span>
        <span>review: {bulkStats.classified_review}</span>
        <span className={bulkStats.errors > 0 ? 'text-amber-700' : ''}>errors: {bulkStats.errors}</span>
        {bulkStats.aborted && <span className="text-amber-700">(abgebrochen)</span>}
        {bulkStats.finished_at && !bulkStats.aborted && <span>(fertig)</span>}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-[var(--tf-text-secondary)]">
        <span>{ratePerSec.toFixed(1)} Files/s</span>
        <span>vergangen: {formatDuration(elapsedMs)}</span>
        {eta && <span className="text-[var(--tf-text)] font-medium">{eta}</span>}
      </div>
      {bulkStats.current_file && (
        <div className="mt-1 truncate text-[10.5px] text-[var(--tf-text-tertiary)]">
          aktuell: {bulkStats.current_file}
        </div>
      )}
    </div>
  );
}
