// Scannbare Feedback-Kartenzeile (Redesign v2.199) für die Board-Liste.
// [Typ-Icon] [Body: Titel+Datum · Q&A-Kurzzeilen · Meta] [Anhang-Thumbnail].
// Eigene Einträge tragen einen feinen Akzentstrich links. Ersetzt für das
// öffentliche Board die alte FeedbackTicketRow.

import { MessageSquare } from 'lucide-react';
import type { FeedbackItem } from '@/core/types/feedback';
import { istUmgesetzt } from '@/core/services/feedback/feedback-status';
import { CATEGORY_COLORS, CATEGORY_ICONS, STATUS_COLORS, STATUS_LABELS } from './constants';
import { feedbackAuthorLabel, feedbackTitle, feedbackQaSegments, formatShortDate, getLucideIcon } from './feedbackUi';
import { FeedbackAvatar } from './FeedbackAvatar';
import { FeedbackVotePill } from './FeedbackVotePill';
import { FeedbackScreenshots } from './FeedbackScreenshots';

interface Props {
  ticket: FeedbackItem;
  selected: boolean;
  mine: boolean;
  meId?: string;
  meName?: string;
  onSelect: (ticket: FeedbackItem) => void;
  onChanged: () => void;
  /** Schmale Variante bei offenem Detail (weniger Beiwerk). */
  narrow?: boolean;
}

export function FeedbackCard({ ticket, selected, mine, meId, meName, onSelect, onChanged, narrow }: Props): React.ReactElement {
  const Icon = getLucideIcon(ticket.category ? CATEGORY_ICONS[ticket.category] : 'MessageCircle');
  const title = feedbackTitle(ticket);
  const segments = feedbackQaSegments(ticket);
  const author = mine ? 'Du' : (feedbackAuthorLabel(ticket) ?? '—');
  const date = formatShortDate(ticket.created_at);
  const done = istUmgesetzt(ticket.kurator_status);
  const commentCount = ticket.comments?.length ?? 0;
  const hasShot = (ticket.attachments?.length ?? 0) > 0;
  const iconTint = ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]';

  return (
    <div
      className={`w-full flex items-stretch transition-colors ${selected ? 'bg-[var(--tf-primary-light)]/20' : 'hover:bg-[var(--tf-hover)]'}`}
      style={{
        borderBottom: '0.5px solid var(--tf-border)',
        borderLeft: selected ? '2.5px solid var(--tf-primary)' : mine ? '2.5px solid var(--tf-primary-light)' : '2.5px solid transparent',
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(ticket)}
        className="flex-1 min-w-0 text-left flex items-start gap-3 px-3 py-3 cursor-pointer"
      >
        {/* Typ-Icon-Quadrat */}
        <span className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-[8px] shrink-0 ${iconTint}`}>
          <Icon size={16} strokeWidth={1.75} />
        </span>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={`flex-1 min-w-0 truncate text-[14px] font-medium ${done ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text)]'}`}>{title}</span>
            <span className="shrink-0 text-[11.5px] text-[var(--tf-text-tertiary)]">{date}</span>
          </div>

          {!narrow && segments.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {segments.slice(0, 3).map((seg, i) => (
                <p key={i} className="truncate text-[12.5px] text-[var(--tf-text-secondary)]">
                  {(seg.shortFrage || seg.frage) && (
                    <span className="uppercase tracking-[0.04em] text-[10.5px] text-[var(--tf-text-tertiary)] mr-1.5">
                      {seg.shortFrage || seg.frage}
                    </span>
                  )}
                  {seg.antwort}
                </p>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            {ticket.category !== 'praise' && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${STATUS_COLORS[ticket.kurator_status]}`}>
                {STATUS_LABELS[ticket.kurator_status]}
              </span>
            )}
            {ticket.context?.page && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
                {ticket.context.page}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <FeedbackAvatar name={author} size={20} />
              <span className="truncate text-[12px] text-[var(--tf-text-secondary)]">{author}</span>
            </span>
            <span className="ml-auto flex items-center gap-2.5 shrink-0">
              {commentCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)]" title={`${commentCount} Kommentar${commentCount > 1 ? 'e' : ''}`}>
                  <MessageSquare size={13} /> {commentCount}
                </span>
              )}
              <FeedbackVotePill ticket={ticket} meId={meId} meName={meName} onChanged={onChanged} />
            </span>
          </div>
        </div>
      </button>

      {/* Anhang-Thumbnail (stoppt Bubbling → öffnet Lightbox, nicht das Detail) */}
      {!narrow && hasShot && (
        <div className="shrink-0 self-center pr-3 py-3" onClick={e => e.stopPropagation()}>
          <FeedbackScreenshots attachments={ticket.attachments!} compact />
        </div>
      )}
    </div>
  );
}
