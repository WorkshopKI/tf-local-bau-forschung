import { Badge } from '@/ui';
import type { Antrag } from '@/core/services/csv/types';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { daysUntilFrist } from './views';

interface Props {
  antrag: Antrag;
  onClick: () => void;
  selected?: boolean;
  /** Kompakte Variante fuer den Split-View: kein Days-Indicator-Block, weniger Subtext. */
  narrow?: boolean;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function formatDays(d: number | null): { text: string; tone: 'danger' | 'tertiary' } {
  if (d === null) return { text: '—', tone: 'tertiary' };
  if (d < 0) return { text: `${d}d`, tone: 'danger' };
  return { text: `+${d}d`, tone: 'tertiary' };
}

export function AntragCard({ antrag, onClick, selected = false, narrow = false }: Props): React.ReactElement {
  const days = daysUntilFrist(antrag);
  const daysFmt = formatDays(days);
  const titel = strOrNull(antrag.titel) ?? antrag.aktenzeichen;
  const akronym = strOrNull(antrag.akronym);
  const antragsteller = strOrNull(antrag.antragsteller);
  const status = strOrNull(antrag.status) ?? '';

  const baseStyle = selected
    ? { background: 'var(--tf-bg-secondary)', borderColor: 'var(--tf-border-hover)' }
    : { borderColor: 'transparent' };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-[var(--tf-radius)] transition-colors ${
        selected ? '' : 'hover:bg-[var(--tf-bg-secondary)]'
      }`}
      style={{ borderWidth: '0.5px', borderStyle: 'solid', ...baseStyle }}
    >
      <div className="flex items-start gap-3">
        {!narrow && (
          <span
            className={`shrink-0 w-[44px] tabular-nums text-[12px] font-mono pt-[2px] ${
              daysFmt.tone === 'danger' ? 'text-[var(--tf-danger-text)]' : 'text-[var(--tf-text-tertiary)]'
            }`}
          >
            {daysFmt.text}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">{antrag.aktenzeichen}</span>
            {akronym ? (
              <span className="text-[13px] font-medium text-[var(--tf-text)]">{akronym}</span>
            ) : null}
          </div>
          <div className={`text-[13px] text-[var(--tf-text)] ${narrow ? 'truncate' : 'truncate'} mt-0.5`}>
            {titel}
          </div>
          {!narrow && antragsteller ? (
            <div className="text-[12px] text-[var(--tf-text-tertiary)] mt-0.5 truncate">{antragsteller}</div>
          ) : null}
        </div>
        {status ? (
          <Badge variant={getStatusVariant(status)}>{getStatusLabel(status)}</Badge>
        ) : null}
      </div>
    </button>
  );
}
