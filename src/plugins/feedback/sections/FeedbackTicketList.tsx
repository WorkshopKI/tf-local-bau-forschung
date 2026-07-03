// Reine Zeilen-Liste (Kurator) — die Filter-Chips sitzen im Seitenkopf
// (FeedbackAdminPage), analog zum öffentlichen Board (FeedbackBoardList), damit
// sie beim Scrollen der Liste stehen bleiben. Das Scrollen der Zeilen besorgt die
// List-Pane von MasterDetailLayout.

import type { FeedbackItem } from '@/core/types/feedback';
import { FeedbackTicketRow } from '@/components/feedback/FeedbackTicketRow';

interface Props {
  tickets: FeedbackItem[];
  loading: boolean;
  selectedId?: string;
  onSelect: (ticket: FeedbackItem) => void;
  /** 1-Klick-„Umgesetzt"-Abhaken direkt in der Zeile. */
  onToggleDone: (ticket: FeedbackItem) => Promise<void>;
}

export function FeedbackTicketList({ tickets, loading, selectedId, onSelect, onToggleDone }: Props): React.ReactElement {
  return (
    <div>
      {loading && <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">Lade Tickets…</p>}
      {!loading && tickets.length === 0 && <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">Keine Tickets gefunden.</p>}
      {tickets.map(ticket => (
        <FeedbackTicketRow
          key={ticket.id}
          ticket={ticket}
          selected={selectedId === ticket.id}
          onSelect={onSelect}
          onToggleDone={onToggleDone}
        />
      ))}
    </div>
  );
}
