// Kompakte, selektierbare Ticket-Zeile — geteilt zwischen Kurator-Liste
// (FeedbackTicketList) und öffentlichem Board (FeedbackBoardList), damit beide
// garantiert identisch aussehen (kein Drift). Reine Darstellung: Kategorie-Badge
// + 1-zeiliger Titel + Datum, 2. Zeile Bereich-Badge + Autor.
//
// Optional (nur Kurator-Liste): links ein Checkbox-artiger 1-Klick-„Abhaken"-Knopf
// (`onToggleDone`). Er ist ein EIGENER Button NEBEN dem Zeilen-Button (kein
// verschachteltes <button> in <button>) → Klick darauf wählt die Zeile nicht aus.
// Fehlt die Prop (Board), rendert die Zeile pixelgleich wie zuvor.

import { Check, ImageIcon } from 'lucide-react';
import type { FeedbackItem } from '@/core/types/feedback';
import { istUmgesetzt } from '@/core/services/feedback/feedback-status';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { CATEGORY_COLORS, CATEGORY_LABELS } from './constants';
import { formatShortDate, feedbackQaSegments } from './feedbackUi';

interface Props {
  ticket: FeedbackItem;
  selected: boolean;
  onSelect: (ticket: FeedbackItem) => void;
  /** Optional (nur Kurator-Liste): 1-Klick-„Umgesetzt"-Abhaken links. Async —
   *  der Parent schreibt + reconciled; hier nur busy/Doppelklick-Schutz. */
  onToggleDone?: (ticket: FeedbackItem) => Promise<void>;
  /** Board: markiert das eigene Feedback (weicher Primary-Akzent + „Dein
   *  Feedback"-Badge), damit man den Status seiner Tickets wiederfindet. */
  mine?: boolean;
}

export function FeedbackTicketRow({ ticket, selected, onSelect, onToggleDone, mine }: Props): React.ReactElement {
  // Frage/Antwort-Paare (je Paar eine Zeile, Frage fett) statt einer langen
  // truncate-Zeile — deutlich lesbarer. Leer → „–"-Fallback.
  const segments = feedbackQaSegments(ticket);
  const date = formatShortDate(ticket.created_at);
  const area = ticket.context?.page;
  const user = ticket.user_display_name || ticket.user_id;
  const hasShot = (ticket.attachments?.length ?? 0) > 0;
  const done = istUmgesetzt(ticket.kurator_status);
  const toggle = useAsyncAction(async () => {
    if (onToggleDone) await onToggleDone(ticket);
  });

  return (
    <div
      className={`w-full flex items-stretch transition-colors ${
        selected ? 'bg-[var(--tf-primary-light)]/20' : 'hover:bg-[var(--tf-hover)]'
      }`}
      style={{
        borderBottom: '0.5px solid var(--tf-border)',
        borderLeft: selected
          ? '3px solid var(--tf-primary)'
          : mine
          ? '3px solid var(--tf-primary-light)'
          : '3px solid transparent',
      }}
    >
      {onToggleDone && (
        <button
          type="button"
          onClick={() => toggle.run()}
          disabled={toggle.busy}
          aria-pressed={done}
          title={done ? 'Umgesetzt — klicken, um zurück auf „Neu" zu setzen' : 'Als „Umgesetzt" abhaken'}
          className="group shrink-0 flex items-center pl-2.5 pr-1 cursor-pointer disabled:cursor-wait"
        >
          <span
            className={`inline-flex items-center justify-center w-[17px] h-[17px] rounded-[4px] transition-colors ${
              done
                ? 'bg-[var(--tf-success-text)] text-white'
                : 'text-transparent group-hover:text-[var(--tf-text-secondary)] group-hover:bg-[var(--tf-bg-secondary)]'
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
        className={`flex-1 min-w-0 text-left ${onToggleDone ? 'pl-1.5 pr-2.5' : 'px-2.5'} py-2 cursor-pointer`}
      >
        {/* Zeile 1: Badges (eigenes Feedback ganz links) + Bild/Datum rechts */}
        <div className="flex items-center gap-2">
          {mine && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 bg-[var(--tf-primary-light)] text-[var(--tf-primary)]">
              Dein Feedback
            </span>
          )}
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]'}`}>
            {ticket.category ? CATEGORY_LABELS[ticket.category] : '–'}
          </span>
          <div className="flex-1" />
          <span
            className="shrink-0 w-3 flex justify-center text-[var(--tf-text-tertiary)]"
            title={hasShot ? `Enthält ${ticket.attachments!.length} Screenshot${ticket.attachments!.length > 1 ? 's' : ''}` : undefined}
          >
            {hasShot && <ImageIcon size={11} />}
          </span>
          <span className="text-[10px] text-[var(--tf-text-tertiary)] shrink-0">{date}</span>
        </div>
        {/* Zeile 2..n: je Frage-/Antwort-Paar eine Zeile (Frage fett) */}
        <div className="mt-1 space-y-0.5">
          {segments.length === 0 ? (
            <p className="text-[12px] text-[var(--tf-text-tertiary)]">–</p>
          ) : (
            segments.map((seg, i) => (
              <p
                key={i}
                className={`text-[12px] truncate ${done ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text)]'}`}
              >
                {seg.frage && <span className="font-semibold">{seg.frage} </span>}
                {seg.antwort}
              </p>
            ))
          )}
        </div>
        {/* Meta: Bereich-Badge + Autor */}
        <div className="flex items-center gap-1.5 mt-1 truncate">
          {area && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] shrink-0">
              {area}
            </span>
          )}
          <span className="text-[10px] text-[var(--tf-text-tertiary)] truncate">{user}</span>
        </div>
      </button>
    </div>
  );
}
