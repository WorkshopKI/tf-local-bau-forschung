/**
 * Pipeline-Zusammenfassung. Klick auf eine Kachel filtert die Liste auf den
 * jeweiligen Status. Re-Match-Button taucht nur auf wenn pending > 0.
 */
import { useMemo, useState } from 'react';
import { ClipboardCheck, Loader2, RefreshCcw } from 'lucide-react';
import type { ManifestEntry, PendingAntragEntry } from '@/phase2';
import { useDokumentReviewStore } from '../store';

interface Props {
  entries: ManifestEntry[];
  pending: PendingAntragEntry[];
  onRematch: () => Promise<{ resolved: number; remaining: number } | undefined>;
}

interface Stats {
  relevant: number;
  irrelevant: number;
  review: number;
  pending: number;
  errors: number;
  total: number;
  lastClassifiedAt: string | null;
}

function formatGermanDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export function DashboardCard({ entries, pending, onRematch }: Props): React.ReactElement {
  const setViewMode = useDokumentReviewStore(s => s.setViewMode);
  const setConfidenceFilter = useDokumentReviewStore(s => s.setConfidenceFilter);
  const showToast = useDokumentReviewStore(s => s.showToast);
  const [rematching, setRematching] = useState(false);

  const stats = useMemo<Stats>(() => {
    let relevant = 0; let irrelevant = 0; let review = 0; let errors = 0;
    let last: string | null = null;
    for (const e of entries) {
      if (e.triage_state === 'relevant') relevant++;
      else if (e.triage_state === 'irrelevant') irrelevant++;
      if (e.requires_review || e.triage_state === 'review') review++;
      if (e.triage_reason.startsWith('error:')) errors++;
      if (!last || e.classified_at > last) last = e.classified_at;
    }
    return {
      relevant, irrelevant, review,
      pending: pending.length,
      errors,
      total: entries.length,
      lastClassifiedAt: last,
    };
  }, [entries, pending]);

  const handleRematch = async (): Promise<void> => {
    setRematching(true);
    try {
      const result = await onRematch();
      if (result) {
        showToast(`${result.resolved} aufgeloest, ${result.remaining} verbleibend.`);
      } else {
        showToast('Kein aktives Programm — bitte im Sidebar-Switcher waehlen.', 'error');
      }
    } finally {
      setRematching(false);
    }
  };

  return (
    <div
      className="border-[0.5px] rounded-[12px] bg-[var(--tf-bg)] p-[18px] flex flex-col gap-3"
      style={{ borderColor: 'var(--tf-border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-[var(--tf-text-secondary)]" />
          <h2 className="text-[14px] font-medium text-[var(--tf-text)]">Dokumenten-Triage</h2>
        </div>
        {stats.pending > 0 && (
          <button
            type="button"
            onClick={handleRematch}
            disabled={rematching}
            className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-40 cursor-pointer"
          >
            {rematching
              ? <Loader2 size={12} className="animate-spin" />
              : <RefreshCcw size={12} />}
            Pending re-matchen
          </button>
        )}
      </div>

      <div className="grid grid-cols-6 gap-2">
        <Tile color="emerald" label="relevant" count={stats.relevant} onClick={() => { setViewMode('all'); setConfidenceFilter('all'); }} />
        <Tile color="slate" label="irrelevant" count={stats.irrelevant} onClick={() => { setViewMode('all'); }} />
        <Tile color="amber" label="review" count={stats.review} onClick={() => setViewMode('review-queue')} />
        <Tile color="sky" label="pending" count={stats.pending} onClick={() => setViewMode('pending')} />
        <Tile color="rose" label="errors" count={stats.errors} onClick={() => { setViewMode('all'); }} />
        <Tile color="zinc" label="gesamt" count={stats.total} onClick={() => { setViewMode('all'); }} />
      </div>

      <div className="text-[11px] text-[var(--tf-text-tertiary)]">
        {stats.lastClassifiedAt
          ? <>Letzter Eintrag: {formatGermanDateTime(stats.lastClassifiedAt)}</>
          : 'Keine Daten — bitte zuerst im Suchindex-Plugin einen Bulk-Scan starten.'}
      </div>
    </div>
  );
}

interface TileProps {
  color: 'emerald' | 'slate' | 'amber' | 'sky' | 'rose' | 'zinc';
  label: string;
  count: number;
  onClick: () => void;
}

const TILE_COLORS: Record<TileProps['color'], string> = {
  emerald: 'text-emerald-800 bg-emerald-50',
  slate: 'text-slate-800 bg-slate-50',
  amber: 'text-amber-800 bg-amber-50',
  sky: 'text-sky-800 bg-sky-50',
  rose: 'text-rose-800 bg-rose-50',
  zinc: 'text-zinc-800 bg-zinc-50',
};

function Tile({ color, label, count, onClick }: TileProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start px-3 py-2 rounded-[8px] border-[0.5px] hover:opacity-90 cursor-pointer transition-opacity ${TILE_COLORS[color]}`}
      style={{ borderColor: 'var(--tf-border)' }}
    >
      <div className="text-[18px] font-semibold leading-none">{count.toLocaleString('de-DE')}</div>
      <div className="text-[10.5px] uppercase tracking-[0.08em] mt-1 opacity-80">{label}</div>
    </button>
  );
}
