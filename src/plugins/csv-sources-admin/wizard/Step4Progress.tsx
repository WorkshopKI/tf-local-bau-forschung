import { useEffect, useRef, useState } from 'react';
import type { ImportResult } from '@/core/services/csv/types';
import type { ImportProgress } from '@/core/services/csv';
import { computeEta } from '@/core/utils/eta';

interface Step4Props {
  progress: ImportProgress | null;
  result: ImportResult | null;
  error: string | null;
}

export function Step4Progress({ progress, result, error }: Step4Props): React.ReactElement {
  const phaseRef = useRef<string | null>(null);
  const phaseStartRef = useRef<number>(Date.now());
  const phaseStartDoneRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  // Phase-change detection: reset refs and elapsed.
  useEffect(() => {
    if (!progress) {
      phaseRef.current = null;
      return;
    }
    if (progress.phase !== phaseRef.current) {
      phaseRef.current = progress.phase;
      phaseStartRef.current = Date.now();
      phaseStartDoneRef.current = progress.done;
      setElapsed(0);
    }
  }, [progress]);

  // Tick elapsed while a phase is running.
  useEffect(() => {
    if (!progress || result || error) return;
    const id = setInterval(() => {
      setElapsed(Date.now() - phaseStartRef.current);
    }, 500);
    return () => clearInterval(id);
  }, [progress, result, error]);

  const doneSincePhase = (progress?.done ?? 0) - phaseStartDoneRef.current;
  const totalInPhase = (progress?.total ?? 0) - phaseStartDoneRef.current;
  const eta = progress
    ? computeEta(elapsed, doneSincePhase, totalInPhase, { minSamples: 50, minElapsedMs: 1500 })
    : null;

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      {error ? (
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
            {progress.phase === 'parsing' ? 'Parse CSV…' :
             progress.phase === 'diffing' ? `Diff berechnen… ${progress.done}/${progress.total}` :
             progress.phase === 'merging' ? `Merge Antraege… ${progress.done}/${progress.total}` :
             'Läuft…'}
          </div>
          <div className="h-2 bg-[var(--tf-bg-secondary)] rounded overflow-hidden">
            <div
              className="h-full bg-[var(--tf-text)] transition-all"
              style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '10%' }}
            />
          </div>
          <div className="flex justify-between text-[11px] h-4 mt-1">
            <span className="text-[var(--tf-text-tertiary)]">{eta ?? ' '}</span>
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
