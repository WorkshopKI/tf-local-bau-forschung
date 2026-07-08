// Kanban-Board-Ansicht (Redesign v2.199): Spalten nach amtlichem kurator_status
// (Pitfall #12 — Status kommt aus dem Feld, nicht aus Literalen der UI). Lob hat
// keinen Workflow → Lob-Einträge erscheinen NICHT auf dem Board (nur in der Liste).
// Kompakte Mini-Karten in getönten Lanes.

import { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { CATEGORY_COLORS, CATEGORY_ICONS, STATUS_COLORS, STATUS_LABELS } from './constants';
import { feedbackAuthorLabel, feedbackTitle, getLucideIcon } from './feedbackUi';
import { FeedbackVotePill } from './FeedbackVotePill';

// Spalten-Reihenfolge = amtliche Status ohne 'archiviert' (die Board-Basis
// blendet Archiviertes ohnehin aus).
const STATUS_COLUMNS: FeedbackStatus[] = ['neu', 'geplant', 'in_bearbeitung', 'umgesetzt', 'abgelehnt'];

interface Props {
  tickets: FeedbackItem[];
  meineUserId?: string;
  meId?: string;
  meName?: string;
  onSelect: (ticket: FeedbackItem) => void;
  onChanged: () => void;
}

export function FeedbackKanban({ tickets, meineUserId, meId, meName, onSelect, onChanged }: Props): React.ReactElement {
  const byStatus = useMemo(() => {
    const map = new Map<FeedbackStatus, FeedbackItem[]>();
    for (const t of tickets) {
      if (t.category === 'praise') continue; // Lob gehört nicht auf das Status-Board
      const arr = map.get(t.kurator_status);
      if (arr) arr.push(t); else map.set(t.kurator_status, [t]);
    }
    return map;
  }, [tickets]);

  const columns: Array<{ key: string; label: string; badgeCls: string; items: FeedbackItem[] }> =
    STATUS_COLUMNS.map(s => ({ key: s, label: STATUS_LABELS[s], badgeCls: STATUS_COLORS[s], items: byStatus.get(s) ?? [] }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {columns.map(col => (
        <div key={col.key} className="shrink-0 w-[216px] rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] p-2">
          <div className="flex items-center gap-2 mb-2 px-0.5">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${col.badgeCls}`}>{col.label}</span>
            <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">{col.items.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {col.items.length === 0 ? (
              <p className="text-[11px] text-[var(--tf-text-tertiary)] text-center py-4">—</p>
            ) : (
              col.items.map(t => (
                <MiniCard
                  key={t.id}
                  ticket={t}
                  mine={!!meineUserId && t.user_id === meineUserId}
                  meId={meId}
                  meName={meName}
                  onSelect={onSelect}
                  onChanged={onChanged}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniCard({ ticket, mine, meId, meName, onSelect, onChanged }: {
  ticket: FeedbackItem; mine: boolean; meId?: string; meName?: string;
  onSelect: (t: FeedbackItem) => void; onChanged: () => void;
}): React.ReactElement {
  const Icon = getLucideIcon(ticket.category ? CATEGORY_ICONS[ticket.category] : 'MessageCircle');
  const author = mine ? 'Du' : (feedbackAuthorLabel(ticket)?.split(' ')[0] ?? '—');
  const commentCount = ticket.comments?.length ?? 0;
  const iconTint = ticket.category ? CATEGORY_COLORS[ticket.category] : 'text-[var(--tf-text-tertiary)]';

  return (
    <div
      className="rounded-[var(--tf-radius)] bg-[var(--tf-bg)] shadow-sm hover:bg-[var(--tf-hover)] transition-colors"
      style={{ border: '0.5px solid var(--tf-border)', borderLeft: mine ? '2px solid var(--tf-primary-light)' : undefined }}
    >
      <button type="button" onClick={() => onSelect(ticket)} className="w-full text-left px-2.5 py-2 cursor-pointer">
        <div className="flex items-center gap-1.5">
          <Icon size={14} className={iconTint.split(' ').find(c => c.startsWith('text-')) ?? ''} strokeWidth={1.75} />
          <span className="flex-1 min-w-0 truncate text-[11px] text-[var(--tf-text-secondary)]">{author}</span>
          <span onClick={e => e.stopPropagation()}>
            <FeedbackVotePill ticket={ticket} meId={meId} meName={meName} onChanged={onChanged} />
          </span>
        </div>
        <p className="mt-1 text-[12px] text-[var(--tf-text)] line-clamp-2 leading-snug">{feedbackTitle(ticket, 120)}</p>
        <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-[var(--tf-text-tertiary)]">
          {ticket.context?.page && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{ticket.context.page}</span>
          )}
          {commentCount > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare size={11} /> {commentCount}</span>}
        </div>
      </button>
    </div>
  );
}
