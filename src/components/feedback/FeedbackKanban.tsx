// Kanban-Board-Ansicht (Redesign v2.208, feedback-optimiert): Spalten nach
// amtlichem kurator_status (Pitfall #12 — Status kommt aus dem Feld, aus
// FEEDBACK_PIPELINE + abgelehnt, nie aus UI-Literalen) plus eine eigene Lob-
// Spalte (Lob hat keinen Workflow). Leere Spalten klappen auf eine schmale
// 46px-Schiene mit vertikalem Label zusammen.

import { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import type { FeedbackConfig, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import {
  FEEDBACK_PIPELINE,
  FEEDBACK_STATUS,
  getSponsoringProgress,
  isSponsorableCategory,
} from '@/core/services/feedback';
import { CATEGORY_COLORS, CATEGORY_ICONS, STATUS_DOT, STATUS_LABELS } from './constants';
import { feedbackAuthorLabel, feedbackTitle, getLucideIcon } from './feedbackUi';
import { FeedbackVotePill } from './FeedbackVotePill';
import { FeedbackSponsorBar } from './FeedbackSponsorBar';

// Status-Spalten = Pipeline (neu → umgesetzt) + abgelehnt. Kein Literal.
const STATUS_COLUMNS: FeedbackStatus[] = [...FEEDBACK_PIPELINE, FEEDBACK_STATUS.abgelehnt];

interface Column {
  key: string;
  label: string;
  dot: string;
  items: FeedbackItem[];
}

interface Props {
  tickets: FeedbackItem[];
  config: FeedbackConfig;
  meineUserId?: string;
  meId?: string;
  meName?: string;
  /** Ungelesene Team-Antwort auf ein eigenes Feedback → „neu"-Punkt. */
  isUnread?: (ticket: FeedbackItem) => boolean;
  onSelect: (ticket: FeedbackItem) => void;
  onChanged: () => void;
}

export function FeedbackKanban({ tickets, config, meineUserId, meId, meName, isUnread, onSelect, onChanged }: Props): React.ReactElement {
  const columns = useMemo<Column[]>(() => {
    const byStatus = new Map<FeedbackStatus, FeedbackItem[]>();
    const lob: FeedbackItem[] = [];
    for (const t of tickets) {
      if (t.category === 'praise') { lob.push(t); continue; }
      const arr = byStatus.get(t.kurator_status);
      if (arr) arr.push(t); else byStatus.set(t.kurator_status, [t]);
    }
    const statusCols: Column[] = STATUS_COLUMNS.map(s => ({
      key: s, label: STATUS_LABELS[s], dot: STATUS_DOT[s], items: byStatus.get(s) ?? [],
    }));
    return [...statusCols, { key: 'lob', label: 'Lob', dot: 'var(--tf-fb-lob)', items: lob }];
  }, [tickets]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 items-start">
      {columns.map(col => col.items.length === 0 ? (
        <div
          key={col.key}
          className="shrink-0 w-[46px] py-2 flex items-start justify-center rounded-[var(--tf-radius-lg)]"
          style={{ border: '0.5px dashed var(--tf-border)' }}
          title={`${col.label} — leer`}
        >
          <span className="inline-flex items-center gap-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--tf-text-tertiary)] [writing-mode:vertical-rl] rotate-180">
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: col.dot }} />
            {col.label}
            <span className="opacity-70 tabular-nums">{col.items.length}</span>
          </span>
        </div>
      ) : (
        <div
          key={col.key}
          className="shrink-0 w-[236px] rounded-[var(--tf-radius-lg)] bg-[var(--tf-card-surface)] p-2.5 flex flex-col gap-2"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <div className="flex items-center gap-2 px-1 pb-1 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--tf-text-secondary)]">
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: col.dot }} />
            {col.label}
            <span className="ml-auto text-[var(--tf-text-tertiary)] tabular-nums">{col.items.length}</span>
          </div>
          {col.items.map(t => (
            <MiniCard
              key={t.id}
              ticket={t}
              config={config}
              mine={!!meineUserId && t.user_id === meineUserId}
              unread={!!isUnread?.(t)}
              meId={meId}
              meName={meName}
              onSelect={onSelect}
              onChanged={onChanged}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniCard({ ticket, config, mine, unread, meId, meName, onSelect, onChanged }: {
  ticket: FeedbackItem; config: FeedbackConfig; mine: boolean; unread: boolean;
  meId?: string; meName?: string; onSelect: (t: FeedbackItem) => void; onChanged: () => void;
}): React.ReactElement {
  const Icon = getLucideIcon(ticket.category ? CATEGORY_ICONS[ticket.category] : 'MessageCircle');
  const author = mine ? 'Du' : (feedbackAuthorLabel(ticket)?.split(' ')[0] ?? '—');
  const commentCount = ticket.comments?.length ?? 0;
  const iconTint = ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]';
  const showBar = isSponsorableCategory(ticket.category) && getSponsoringProgress(ticket, config).threshold > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(ticket)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(ticket); } }}
      className="block text-left rounded-[var(--tf-radius)] bg-[var(--tf-bg)] shadow-sm hover:border-[var(--tf-border-hover)] transition-colors cursor-pointer px-2.5 py-2"
      style={{ border: '0.5px solid var(--tf-border)', borderLeft: mine ? '2px solid var(--tf-primary)' : undefined }}
    >
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded-[6px] shrink-0 ${iconTint}`}>
          <Icon size={13} strokeWidth={1.75} />
        </span>
        <span className="flex-1 min-w-0 truncate text-[11px] text-[var(--tf-text-secondary)]">{author}</span>
        {mine && unread && <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-[var(--tf-fb-problem)]" title="Neue Antwort vom Team" />}
      </div>
      <p className="mt-2 text-[12.5px] text-[var(--tf-text)] line-clamp-3 leading-snug">{feedbackTitle(ticket, 120)}</p>
      <div className="mt-2 flex items-center gap-2 text-[10.5px] text-[var(--tf-text-tertiary)]">
        {ticket.context?.page && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--tf-card-surface)] text-[var(--tf-text-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
            {ticket.context.page}
          </span>
        )}
        {commentCount > 0 && <span className="ml-auto inline-flex items-center gap-0.5"><MessageSquare size={11} /> {commentCount}</span>}
      </div>
      {showBar ? (
        <FeedbackSponsorBar ticket={ticket} config={config} meId={meId} variant="board" />
      ) : (
        <div className="mt-2" onClick={e => e.stopPropagation()}>
          <FeedbackVotePill ticket={ticket} meId={meId} meName={meName} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}
