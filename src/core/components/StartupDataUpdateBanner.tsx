/**
 * StartupDataUpdateBanner — Fortschritts-Banner der Start-Datenaktualisierung.
 *
 * Vollbreite Banner-Zeile am oberen Rand des Inhalts (im ShellLayout, neben den
 * anderen Bannern), sichtbar solange der Start-Pass (`runDataUpdate` aus App.tsx)
 * läuft. Zeigt das phasen-basierte Label + einen determinierten Fortschrittsbalken
 * + Prozent — gleiche visuelle Sprache wie der CsvAutoRefreshBanner.
 *
 * Löst die frühere Spinner-Toast-Anzeige oben rechts ab; der Completion-Toast
 * („…aktualisiert (Stand: …)") bleibt davon unberührt.
 *
 * Determinierter Fortschritt für einen Daten-/Indexierungs-Pass — per
 * DESIGN_GUIDE (Kap. „Keine animierten Fortschrittsbalken … nur bei
 * Admin-Indexierung erlaubt") zulässig.
 */

import { useStartupDataStatus } from '@/core/services/csv/startup-data-status';
import { ProgressBar } from '@/components/ui/ProgressBar';

export function StartupDataUpdateBanner(): React.ReactElement | null {
  const progress = useStartupDataStatus(s => s.progress);
  if (!progress) return null;

  const pct = Math.min(100, Math.max(0, Math.round(progress.fraction * 100)));

  return (
    <div
      className="w-full px-4 py-2 flex items-center gap-2.5 text-[12.5px]"
      style={{
        background: 'var(--tf-primary-light)',
        color: 'var(--tf-text)',
        borderBottom: '0.5px solid var(--tf-primary)',
      }}
      role="status"
      aria-live="polite"
    >
      <span
        className="shrink-0 inline-block w-3.5 h-3.5 rounded-full border-2 border-[var(--tf-border)] border-t-[var(--tf-primary)] animate-spin"
        aria-hidden="true"
      />
      <span className="shrink-0 truncate max-w-[50%]">{progress.label}</span>
      <div className="flex-1 min-w-0">
        <ProgressBar value={progress.fraction} />
      </div>
      <span className="shrink-0 tabular-nums text-[var(--tf-text-secondary)]">{pct}%</span>
    </div>
  );
}
