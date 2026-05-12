import { Badge } from '@/ui';
import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { getVbPhaseLabel, getVbPhaseVariant } from '@/core/utils/vb-phase-mappings';
import { daysUntilFrist } from './views';

interface Props {
  antrag: AntragListItem;
  onClick: () => void;
  selected?: boolean;
  /** Kompakte Variante fuer den Split-View: kein Days-Indicator-Block, weniger Subtext. */
  narrow?: boolean;
  /** Wenn true (Default), wird die Tage-bis-Frist-Spalte links der Card gerendert.
   *  Bei nicht-deadline-fokussierten Views (Bewilligt, Alle) auf false setzen. */
  showDays?: boolean;
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

export function AntragCard({ antrag, onClick, selected = false, narrow = false, showDays = true }: Props): React.ReactElement {
  const days = daysUntilFrist(antrag);
  const daysFmt = formatDays(days);
  const showDaysColumn = showDays && !narrow;
  const titel = strOrNull(antrag.titel) ?? antrag.aktenzeichen;
  const akronym = strOrNull(antrag.akronym);
  const antragsteller = strOrNull(antrag.antragsteller);
  const status = strOrNull(antrag.status) ?? '';
  const phaseLabel = getVbPhaseLabel(antrag.vb_phase);

  const baseStyle = selected
    ? { background: 'var(--tf-bg-secondary)', borderColor: 'var(--tf-border-hover)' }
    : { borderColor: 'transparent' };

  const padding = narrow ? 'px-3 py-1.5' : 'px-4 py-2.5';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left ${padding} rounded-[var(--tf-radius)] transition-colors ${
        selected ? '' : 'hover:bg-[var(--tf-bg-secondary)]'
      }`}
      style={{ borderWidth: '0.5px', borderStyle: 'solid', ...baseStyle }}
    >
      <div className="flex items-start gap-3">
        {showDaysColumn && (
          <span
            className={`shrink-0 w-[44px] tabular-nums text-[12px] font-mono pt-[1px] ${
              daysFmt.tone === 'danger' ? 'text-[var(--tf-danger-text)]' : 'text-[var(--tf-text-tertiary)]'
            }`}
          >
            {daysFmt.text}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className={`font-mono text-[var(--tf-text-tertiary)] ${narrow ? 'text-[10.5px]' : 'text-[11px]'}`}>{antrag.aktenzeichen}</span>
            {akronym ? (
              <span className={`font-medium text-[var(--tf-text)] ${narrow ? 'text-[12.5px]' : 'text-[13px]'}`}>{akronym}</span>
            ) : null}
          </div>
          <div className={`text-[var(--tf-text-secondary)] truncate mt-0.5 ${narrow ? 'text-[12px]' : 'text-[12.5px]'}`}>
            {titel}
          </div>
          {!narrow && antragsteller ? (
            <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5 truncate">{antragsteller}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {phaseLabel ? (
            <Badge variant={getVbPhaseVariant(antrag.vb_phase)} className="min-w-[44px] justify-center">
              {phaseLabel}
            </Badge>
          ) : null}
          {status ? (
            <Badge variant={getStatusVariant(status)} className="min-w-[110px] justify-center whitespace-nowrap">
              {getStatusLabel(status)}
            </Badge>
          ) : null}
        </div>
      </div>
    </button>
  );
}
