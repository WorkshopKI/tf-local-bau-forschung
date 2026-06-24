// Kompakte, selektierbare Ticket-Zeile — geteilt zwischen Kurator-Liste
// (FeedbackTicketList) und öffentlichem Board (FeedbackBoardList), damit beide
// garantiert identisch aussehen (kein Drift). Reine Darstellung: Kategorie-Badge
// + 1-zeiliger Titel + Datum, 2. Zeile Bereich-Badge + Autor.

import type { FeedbackItem } from '@/core/types/feedback';
import { CATEGORY_COLORS, CATEGORY_LABELS } from './constants';

interface Props {
  ticket: FeedbackItem;
  selected: boolean;
  onSelect: (ticket: FeedbackItem) => void;
}

export function FeedbackTicketRow({ ticket, selected, onSelect }: Props): React.ReactElement {
  const summary = ticket.llm_summary || ticket.text || '–';
  const date = new Date(ticket.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
  const area = ticket.context?.page;
  const user = ticket.user_display_name || ticket.user_id;

  return (
    <button
      type="button"
      onClick={() => onSelect(ticket)}
      className={`w-full text-left px-2.5 py-2 transition-colors cursor-pointer ${
        selected ? 'bg-[var(--tf-primary-light)]/20' : 'hover:bg-[var(--tf-hover)]'
      }`}
      style={{
        borderBottom: '0.5px solid var(--tf-border)',
        borderLeft: selected ? '3px solid var(--tf-primary)' : '3px solid transparent',
      }}
    >
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]'}`}>
          {ticket.category ? CATEGORY_LABELS[ticket.category] : '–'}
        </span>
        <p className="flex-1 min-w-0 text-[12px] font-medium text-[var(--tf-text)] truncate">{summary}</p>
        <span className="text-[10px] text-[var(--tf-text-tertiary)] shrink-0">{date}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 truncate" style={{ marginLeft: '4.5rem' }}>
        {area && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] shrink-0">
            {area}
          </span>
        )}
        <span className="text-[10px] text-[var(--tf-text-tertiary)] truncate">{user}</span>
      </div>
    </button>
  );
}
