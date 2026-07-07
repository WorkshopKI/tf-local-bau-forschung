// Vote-Pill (Redesign v2.199): budgetfreies „Ich auch"-Like. Daumen-hoch + Zahl;
// abgestimmt = gefüllt (Info-Blau). Toggle über `toggleVote` (useAsyncAction, kein
// silent-fail). Genutzt in der Karte (kompakt) und im Detail-Footer (prominent).

import { ThumbsUp } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { toggleVote } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';

interface Props {
  ticket: FeedbackItem;
  /** Identität des aktuellen Nutzers (Kürzel/Name); undefined → nur Anzeige, kein Toggle. */
  meId?: string;
  meName?: string;
  /** Nach dem Toggle neu laden. */
  onChanged: () => void;
  /** Größere Darstellung für den Detail-Footer. */
  prominent?: boolean;
}

export function FeedbackVotePill({ ticket, meId, meName, onChanged, prominent }: Props): React.ReactElement {
  const storage = useStorage();
  const votes = ticket.votes ?? [];
  const voted = !!meId && votes.some(v => v.user_id === meId);
  const count = votes.length;

  const vote = useAsyncAction(async () => {
    if (!meId) return;
    await toggleVote(storage, ticket.id, meId, meName);
    onChanged();
  });

  const pad = prominent ? 'h-7 px-2.5 gap-1.5 text-[12px]' : 'h-[22px] px-2 gap-1 text-[11px]';
  const iconSize = prominent ? 14 : 12;

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); void vote.run(); }}
      disabled={!meId || vote.busy}
      aria-pressed={voted}
      title={voted ? 'Stimme zurückziehen' : 'Hilfreich / Ich auch'}
      className={`inline-flex items-center rounded-full shrink-0 transition-colors cursor-pointer disabled:cursor-default ${pad} ${
        voted
          ? 'bg-[var(--tf-info-text)] text-white border-transparent'
          : 'bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-info-text)] hover:border-[var(--tf-info-text)]'
      }`}
      style={{ border: voted ? undefined : '0.5px solid var(--tf-border-hover)' }}
    >
      <ThumbsUp size={iconSize} fill={voted ? 'currentColor' : 'none'} strokeWidth={voted ? 0 : 1.75} />
      <span className="tabular-nums font-medium">{count}</span>
    </button>
  );
}
