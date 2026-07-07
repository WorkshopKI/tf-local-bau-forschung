// Kompakte, selektierbare Ticket-Zeile — geteilt zwischen Kurator-Liste
// (FeedbackTicketList) und dem alten Board-Split (FeedbackBoardList). Seit dem
// Redesign v2.199 im neuen Karten-Look (Typ-Icon, Titel, Kurz-Q&A, Status-Badge,
// Avatar) — deckungsgleich mit FeedbackCard, aber ohne interaktive Vote-Pill
// (Votes/Kommentare read-only) und mit dem optionalen Kurator-„Abhaken"-Knopf.
//
// Optional (nur Kurator-Liste): links ein Checkbox-artiger 1-Klick-„Abhaken"-Knopf
// (`onToggleDone`). Er ist ein EIGENER Button NEBEN dem Zeilen-Button (kein
// verschachteltes <button> in <button>) → Klick darauf wählt die Zeile nicht aus.

import { Check, MessageSquare, ThumbsUp } from 'lucide-react';
import type { FeedbackItem } from '@/core/types/feedback';
import { istUmgesetzt } from '@/core/services/feedback/feedback-status';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { CATEGORY_COLORS, CATEGORY_ICONS, STATUS_COLORS, STATUS_LABELS } from './constants';
import { feedbackAuthorLabel, feedbackTitle, feedbackQaSegments, formatShortDate, getLucideIcon } from './feedbackUi';
import { FeedbackAvatar } from './FeedbackAvatar';

interface Props {
  ticket: FeedbackItem;
  selected: boolean;
  onSelect: (ticket: FeedbackItem) => void;
  /** Optional (nur Kurator-Liste): 1-Klick-„Umgesetzt"-Abhaken links. Async —
   *  der Parent schreibt + reconciled; hier nur busy/Doppelklick-Schutz. */
  onToggleDone?: (ticket: FeedbackItem) => Promise<void>;
  /** Board: markiert das eigene Feedback (Akzentstrich + „Du"-Autor). */
  mine?: boolean;
}

export function FeedbackTicketRow({ ticket, selected, onSelect, onToggleDone, mine }: Props): React.ReactElement {
  const Icon = getLucideIcon(ticket.category ? CATEGORY_ICONS[ticket.category] : 'MessageCircle');
  const title = feedbackTitle(ticket);
  const segments = feedbackQaSegments(ticket);
  const author = mine ? 'Du' : (feedbackAuthorLabel(ticket) ?? '—');
  const date = formatShortDate(ticket.created_at);
  const done = istUmgesetzt(ticket.kurator_status);
  const commentCount = ticket.comments?.length ?? 0;
  const voteCount = ticket.votes?.length ?? 0;
  const iconTint = ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]';

  const toggle = useAsyncAction(async () => {
    if (onToggleDone) await onToggleDone(ticket);
  });

  return (
    <div
      className={`w-full flex items-stretch transition-colors ${selected ? 'bg-[var(--tf-primary-light)]/20' : 'hover:bg-[var(--tf-hover)]'}`}
      style={{
        borderBottom: '0.5px solid var(--tf-border)',
        borderLeft: selected ? '2.5px solid var(--tf-primary)' : mine ? '2.5px solid var(--tf-primary-light)' : '2.5px solid transparent',
      }}
    >
      {onToggleDone && (
        <button
          type="button"
          onClick={() => toggle.run()}
          disabled={toggle.busy}
          aria-pressed={done}
          title={done ? 'Umgesetzt — klicken, um zurück auf „Neu" zu setzen' : 'Als „Umgesetzt" abhaken'}
          className="group shrink-0 flex items-start pt-3 pl-2.5 pr-1 cursor-pointer disabled:cursor-wait"
        >
          <span
            className={`inline-flex items-center justify-center w-[17px] h-[17px] rounded-[4px] transition-colors ${
              done ? 'bg-[var(--tf-success-text)] text-white' : 'text-transparent group-hover:text-[var(--tf-text-secondary)] group-hover:bg-[var(--tf-bg-secondary)]'
            }`}
            style={{ border: done ? '1px solid var(--tf-success-text)' : '1.5px solid var(--tf-text-tertiary)' }}
          >
            <Check size={12} strokeWidth={3} />
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={() => onSelect(ticket)}
        className={`flex-1 min-w-0 text-left flex items-start gap-3 py-3 ${onToggleDone ? 'pl-1 pr-3' : 'px-3'} cursor-pointer`}
      >
        <span className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-[8px] shrink-0 ${iconTint}`}>
          <Icon size={16} strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={`flex-1 min-w-0 truncate text-[14px] font-medium ${done ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text)]'}`}>{title}</span>
            <span className="shrink-0 text-[11.5px] text-[var(--tf-text-tertiary)]">{date}</span>
          </div>
          {segments.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {segments.slice(0, 2).map((seg, i) => (
                <p key={i} className="truncate text-[12.5px] text-[var(--tf-text-secondary)]">
                  {(seg.shortFrage || seg.frage) && (
                    <span className="uppercase tracking-[0.04em] text-[10.5px] text-[var(--tf-text-tertiary)] mr-1.5">{seg.shortFrage || seg.frage}</span>
                  )}
                  {seg.antwort}
                </p>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {ticket.category !== 'praise' && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${STATUS_COLORS[ticket.kurator_status]}`}>{STATUS_LABELS[ticket.kurator_status]}</span>
            )}
            {ticket.context?.page && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{ticket.context.page}</span>
            )}
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <FeedbackAvatar name={author} size={20} />
              <span className="truncate text-[12px] text-[var(--tf-text-secondary)]">{author}</span>
            </span>
            <span className="ml-auto flex items-center gap-2.5 shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">
              {commentCount > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={13} /> {commentCount}</span>}
              {voteCount > 0 && <span className="inline-flex items-center gap-1"><ThumbsUp size={12} /> {voteCount}</span>}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
