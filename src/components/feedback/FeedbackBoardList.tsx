// Flache, selektierbare Ticket-Liste für das öffentliche Board (Split-Ansicht).
// Optik identisch zur Kurator-Liste (geteilte FeedbackTicketRow). Filter sitzen
// im Seiten-Header (FeedbackBoardPage), hier nur die Zeilen.

import type { FeedbackItem } from '@/core/types/feedback';
import { FeedbackTicketRow } from './FeedbackTicketRow';

interface Props {
  tickets: FeedbackItem[];
  selectedId?: string;
  onSelect: (ticket: FeedbackItem) => void;
  /** Board: user_id des angemeldeten Nutzers → eigene Zeilen werden markiert. */
  meineUserId?: string;
}

export function FeedbackBoardList({ tickets, selectedId, onSelect, meineUserId }: Props): React.ReactElement {
  if (tickets.length === 0) {
    return (
      <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-8">
        Keine Einträge.
      </p>
    );
  }

  return (
    <div>
      {tickets.map(ticket => (
        <FeedbackTicketRow
          key={ticket.id}
          ticket={ticket}
          selected={selectedId === ticket.id}
          onSelect={onSelect}
          mine={!!meineUserId && ticket.user_id === meineUserId}
        />
      ))}
    </div>
  );
}
