import { useEffect, useRef } from 'react';
import type { ImportResult } from '@/core/services/csv/types';
import type { ImportProgress } from '@/core/services/csv';
import { computeEtaFromSamples, type ThroughputSample } from '@/core/utils/eta';

const WINDOW_MS = 5000;
const SAMPLE_INTERVAL_MS = 500;

interface Step4Props {
  progress: ImportProgress | null;
  result: ImportResult | null;
  error: string | null;
  cancelled?: boolean;
}

export function Step4Progress({ progress, result, error, cancelled }: Step4Props): React.ReactElement {
  const phaseRef = useRef<string | null>(null);
  const phaseStartDoneRef = useRef<number>(0);
  const samplesRef = useRef<ThroughputSample[]>([]);
  const lastSampleAtRef = useRef<number>(0);

  // Phase-change detection: reset refs and samples buffer.
  useEffect(() => {
    if (!progress) {
      phaseRef.current = null;
      samplesRef.current = [];
      lastSampleAtRef.current = 0;
      return;
    }
    if (progress.phase !== phaseRef.current) {
      phaseRef.current = progress.phase;
      phaseStartDoneRef.current = progress.done;
      samplesRef.current = [];
      lastSampleAtRef.current = 0;
    }
  }, [progress]);

  // Push throttled sample on every progress update — no setInterval needed.
  // The previous setInterval-based approach was broken: progress updates from
  // the importer arrive faster than 500 ms during merge, so React kept
  // clear/re-creating the interval before its first tick could fire.
  useEffect(() => {
    if (!progress || result || error) return;
    const now = Date.now();
    if (now - lastSampleAtRef.current < SAMPLE_INTERVAL_MS) return;
    lastSampleAtRef.current = now;
    const doneSincePhase = progress.done - phaseStartDoneRef.current;
    samplesRef.current = [
      ...samplesRef.current.filter(s => now - s.t < WINDOW_MS),
      { t: now, processed: doneSincePhase },
    ];
  }, [progress, result, error]);

  const totalInPhase = (progress?.total ?? 0) - phaseStartDoneRef.current;
  const eta = progress
    ? computeEtaFromSamples(samplesRef.current, totalInPhase, { minSamples: 3, minWindowMs: 1500 })
    : null;

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      {cancelled ? (
        <div className="text-[13px]">
          <strong>Import abgebrochen.</strong>{' '}
          <span className="text-[var(--tf-text-secondary)]">Keine Änderungen am Datenbestand.</span>
        </div>
      ) : error ? (
        <div className="text-red-700 text-[13px]">Fehler: {error}</div>
      ) : result ? (
        <div>
          {result.skipped ? (
            <div className="text-[13.5px]">
              <strong>Datei unverändert</strong> — Checksum stimmt mit letztem Import überein, nichts zu tun.
            </div>
          ) : (
            <div>
              <div className="text-[13.5px] mb-2"><strong>Import abgeschlossen</strong> ({result.rowCount} Zeilen, {(result.durationMs / 1000).toFixed(1)}s)</div>
              <div className="grid grid-cols-4 gap-2">
                <BucketCard label="Neu" value={result.buckets.new} />
                <BucketCard label="Geändert" value={result.buckets.changed} />
                <BucketCard label="Unverändert" value={result.buckets.unchanged} />
                <BucketCard label="Entfernt" value={result.buckets.removed} />
              </div>
              {result.skippedJoinValues && result.skippedJoinValues.length > 0 ? (
                <div className="mt-3 text-[12px] text-amber-700">
                  {result.skippedJoinValues.length} Zeilen mit leerem Join-Value übersprungen.
                </div>
              ) : null}
              {result.heldRemovals ? (
                <div className="mt-3 text-[12px] text-[var(--tf-text-secondary)]">
                  {result.heldRemovals.toLocaleString('de-DE')} Zeile(n) sind aus dieser Quelle
                  gefallen, ohne gelöscht zu werden — eine andere Quelle führt diese Anträge
                  weiter. Gelöscht wird erst, wenn ein Antrag in allen Quellen verschwunden ist.
                </div>
              ) : null}
              {result.skippedInactiveUnterprogramm ? (
                <div className="mt-2 text-[12px] text-[var(--tf-text-secondary)]">
                  {result.skippedInactiveUnterprogramm.toLocaleString('de-DE')} Zeilen in deaktivierten Unterprogrammen übersprungen.
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : progress ? (
        <div>
          <div className="text-[12.5px] mb-1 text-[var(--tf-text-secondary)]">
            {progress.phase === 'parsing'
              ? `Parse CSV… ${formatMb(progress.done)} / ${formatMb(progress.total)}`
              : progress.phase === 'diffing' ? `Diff berechnen… ${progress.done}/${progress.total}`
              : progress.phase === 'merging' ? `Merge Antraege… ${progress.done}/${progress.total}`
              : progress.phase === 'finalizing' ? `Finalisiere… ${progress.stage ?? ''}`
              : 'Läuft…'}
          </div>
          <div className="h-2 bg-[var(--tf-bg-secondary)] rounded overflow-hidden">
            <div
              className="h-full bg-[var(--tf-primary)] transition-all"
              style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '10%' }}
            />
          </div>
          <div className="flex justify-between text-[11px] h-4 mt-1">
            <span className="text-[var(--tf-text-tertiary)]">{eta ?? ' '}</span>
          </div>
        </div>
      ) : (
        <div className="text-[var(--tf-text-tertiary)]">Warte…</div>
      )}
    </div>
  );
}

function BucketCard({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-lg bg-[var(--tf-bg-secondary)] p-3">
      <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">{label}</div>
      <div className="text-[20px] font-medium text-[var(--tf-text)]">{value}</div>
    </div>
  );
}

function formatMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '?';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  if (mb < 10) return `${mb.toFixed(1)} MB`;
  return `${mb.toFixed(0)} MB`;
}
