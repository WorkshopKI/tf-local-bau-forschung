// Tabellarische Listen-Ansicht für das öffentliche Feedback-Board.
// Read-only: Sponsoring-Aktionen erfolgen in der Card-Ansicht.

import { getSponsoringProgress } from '@/core/services/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  EFFORT_SHORT_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from './constants';

interface Props {
  tickets: FeedbackItem[];
  config: FeedbackConfig;
}

export function FeedbackBoardListView({ tickets, config }: Props): React.ReactElement {
  return (
    <div>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 py-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]"
        style={{ borderBottom: '0.5px solid var(--tf-border)' }}
      >
        <span className="w-14 shrink-0">Typ</span>
        <span className="flex-1 min-w-0">Titel</span>
        <span className="w-20 shrink-0">Status</span>
        <span className="w-28 shrink-0">Sponsoring</span>
        <span className="w-20 shrink-0 text-right">Aufwand</span>
      </div>

      {/* Rows */}
      {tickets.map(t => (
        <FeedbackListRow key={t.id} ticket={t} config={config} />
      ))}

      {tickets.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-8">
          Keine Einträge.
        </p>
      )}
    </div>
  );
}

// ── Einzelne Zeile ────────────────────────────────────────────────────────

function FeedbackListRow({ ticket, config }: { ticket: FeedbackItem; config: FeedbackConfig }): React.ReactElement {
  const isFeature = ticket.category === 'idea';
  const hasEffort = !!ticket.effort_estimate;
  const progress = isFeature && hasEffort ? getSponsoringProgress(ticket, config) : null;
  const summary = ticket.llm_summary || ticket.text || '–';

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 text-[12.5px]"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      {/* Typ */}
      <span className="w-14 shrink-0">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]'}`}>
          {ticket.category ? CATEGORY_LABELS[ticket.category] : '–'}
        </span>
      </span>

      {/* Titel */}
      <span className="flex-1 min-w-0 truncate text-[var(--tf-text)]">
        {summary}
      </span>

      {/* Status */}
      <span className="w-20 shrink-0">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${STATUS_COLORS[ticket.kurator_status]}`}>
          {STATUS_LABELS[ticket.kurator_status]}
        </span>
      </span>

      {/* Sponsoring */}
      <div className="w-28 shrink-0">
        {progress ? (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${progress.percentage}%`,
                  background: progress.thresholdReached ? 'var(--tf-success-text)' : 'var(--tf-primary)',
                }}
              />
            </div>
            <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">
              {progress.percentage}%
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">—</span>
        )}
      </div>

      {/* Aufwand */}
      <span className="w-20 shrink-0 text-right text-[11.5px] text-[var(--tf-text-secondary)]">
        {hasEffort ? EFFORT_SHORT_LABELS[ticket.effort_estimate!] : '—'}
      </span>
    </div>
  );
}
