// Eigener Feedback-Verlauf — gefiltert nach user_id == profile.name.

import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { getMyFeedback, FEEDBACK_STATUS } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from './constants';
import { formatRelativeTime, getLucideIcon } from './feedbackUi';

export function MyFeedbackList(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const [items, setItems] = useState<FeedbackItem[] | null>(null);

  const load = useCallback((): void => {
    const userId = profile?.name ?? 'anonymous';
    void getMyFeedback(storage, userId).then(setItems);
  }, [storage, profile?.name]);

  useEffect(() => { load(); }, [load]);

  // Live-Refresh bei feedback-updated Event (Submit im Panel, Admin-Updates)
  useEffect(() => {
    const handler = (): void => load();
    window.addEventListener('feedback-updated', handler);
    return () => window.removeEventListener('feedback-updated', handler);
  }, [load]);

  if (items === null) {
    return <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Lade…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-6">
        Du hast noch kein Feedback abgesendet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(item => {
        const Icon = getLucideIcon(item.category ? CATEGORY_ICONS[item.category] : 'MessageCircle');
        const summary = item.llm_summary || item.text || '–';
        return (
          <div
            key={item.id}
            className="p-2.5 rounded-[var(--tf-radius)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="flex items-start gap-2">
              <Icon size={14} className="mt-0.5 text-[var(--tf-text-secondary)]" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] text-[var(--tf-text)] leading-snug line-clamp-2">{summary}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">
                    {item.category ? CATEGORY_LABELS[item.category] : 'Unklassifiziert'} · {formatRelativeTime(item.created_at)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[item.kurator_status]}`}>
                    {STATUS_LABELS[item.kurator_status]}
                  </span>
                </div>
                {item.kurator_status === FEEDBACK_STATUS.abgelehnt && item.kurator_notes && (
                  <p className="mt-1 text-[10.5px] text-[var(--tf-text-tertiary)] italic">
                    Hinweis: {item.kurator_notes}
                  </p>
                )}
                {item.kurator_response?.trim() && (
                  <div
                    className="mt-1.5 p-2 rounded-[var(--tf-radius)] bg-[var(--tf-info-bg)]"
                    style={{ borderLeft: '2px solid var(--tf-info-text)' }}
                  >
                    <p className="text-[9.5px] uppercase tracking-[0.06em] font-medium text-[var(--tf-info-text)] mb-0.5">
                      Antwort vom Team
                    </p>
                    <p className="text-[11px] text-[var(--tf-text)] whitespace-pre-wrap leading-snug">
                      {item.kurator_response.trim()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
