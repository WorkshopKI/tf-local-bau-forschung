// „Dein Fortschritt"-Leiste (Redesign v2.208): erscheint nur in der Sicht „Von
// mir". Zeigt die Verteilung der eigenen Feedbacks über die Pipeline-Stationen
// + einen Pill für ungelesene Team-Antworten.

import { useMemo } from 'react';
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { FEEDBACK_PIPELINE } from '@/core/services/feedback';
import { STATUS_DOT, STATUS_LABELS } from './constants';

interface Props {
  items: FeedbackItem[];
  unread: number;
}

export function MyProgressBar({ items, unread }: Props): React.ReactElement {
  const byStatus = useMemo(() => {
    const map = new Map<FeedbackStatus, number>();
    for (const it of items) map.set(it.kurator_status, (map.get(it.kurator_status) ?? 0) + 1);
    return map;
  }, [items]);

  return (
    <div
      className="flex items-center gap-4 flex-wrap px-4 py-2.5 rounded-[var(--tf-radius-lg)] bg-[var(--tf-card-surface)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
        Dein Fortschritt
      </span>
      {FEEDBACK_PIPELINE.map(s => (
        <span key={s} className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[s] }} />
          {STATUS_LABELS[s]} <b className="font-medium text-[var(--tf-text)]">{byStatus.get(s) ?? 0}</b>
        </span>
      ))}
      {unread > 0 && (
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-fb-problem)] bg-[var(--tf-fb-problem-bg)] px-2.5 py-1 rounded-full">
          {unread} neue {unread > 1 ? 'Antworten' : 'Antwort'} vom Team
        </span>
      )}
    </div>
  );
}
