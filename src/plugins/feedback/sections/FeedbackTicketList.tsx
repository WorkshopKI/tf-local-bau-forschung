// Filterbare Ticket-Liste links im Admin-Layout — kompakte Zeilen statt Cards.

import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { FeedbackTicketRow } from '@/components/feedback/FeedbackTicketRow';
import { CollapsibleSeg, type CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';

interface Props {
  tickets: FeedbackItem[];
  loading: boolean;
  selectedId?: string;
  filterCategory: FeedbackCategory | '';
  filterStatus: FeedbackStatus | '';
  filterArea: string;
  showArchived: boolean;
  onToggleArchived: (v: boolean) => void;
  statusItems: CollapsibleSegItem[];
  kategorieItems: CollapsibleSegItem[];
  bereichItems: CollapsibleSegItem[];
  onFilterCategory: (v: FeedbackCategory | '') => void;
  onFilterStatus: (v: FeedbackStatus | '') => void;
  onFilterArea: (v: string) => void;
  onSelect: (ticket: FeedbackItem) => void;
  /** 1-Klick-„Umgesetzt"-Abhaken direkt in der Zeile (Kurator-Liste). */
  onToggleDone: (ticket: FeedbackItem) => Promise<void>;
}

// Label↔Wert-Maps für die label-basierte CollapsibleSeg (wie im User-Board).
// Status bleibt granular (Kurator braucht die feinen Stati); 'archiviert' wird als
// eigener Chip angeboten (zeigt gezielt nur die Archivierten).
const STATUS_TO_LABEL: Record<FeedbackStatus | '', string> = {
  '': 'Alle', neu: 'Neu', geplant: 'Geplant', in_bearbeitung: 'In Bearb.',
  umgesetzt: 'Umgesetzt', abgelehnt: 'Abgelehnt', archiviert: 'Archiviert',
};
const LABEL_TO_STATUS: Record<string, FeedbackStatus | ''> = {
  Alle: '', Neu: 'neu', Geplant: 'geplant', 'In Bearb.': 'in_bearbeitung',
  Umgesetzt: 'umgesetzt', Abgelehnt: 'abgelehnt', Archiviert: 'archiviert',
};
const KAT_TO_LABEL: Record<FeedbackCategory | '', string> = {
  '': 'Alle', problem: 'Bug', idea: 'Idee', ux: 'UX', praise: 'Lob', question: 'Frage',
};
const LABEL_TO_KAT: Record<string, FeedbackCategory | ''> = {
  Alle: '', Bug: 'problem', Idee: 'idea', UX: 'ux', Lob: 'praise', Frage: 'question',
};

export function FeedbackTicketList(props: Props): React.ReactElement {
  const { tickets, loading, selectedId, filterCategory, filterStatus, filterArea, showArchived, onToggleArchived, statusItems, kategorieItems, bereichItems, onFilterCategory, onFilterStatus, onFilterArea, onSelect, onToggleDone } = props;

  return (
    <div>
      {/* Filter-Chips (CollapsibleSeg, identisch zum User-Board) */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <CollapsibleSeg
          label="Status"
          value={STATUS_TO_LABEL[filterStatus]}
          items={statusItems}
          onChange={l => onFilterStatus(LABEL_TO_STATUS[l] ?? '')}
        />
        <CollapsibleSeg
          label="Kategorie"
          value={KAT_TO_LABEL[filterCategory]}
          items={kategorieItems}
          onChange={l => onFilterCategory(LABEL_TO_KAT[l] ?? '')}
        />
        {bereichItems.length > 1 && (
          <CollapsibleSeg
            label="Bereich"
            value={filterArea || 'Alle'}
            items={bereichItems}
            onChange={l => onFilterArea(l === 'Alle' ? '' : l)}
            startCollapsed
          />
        )}
        <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] cursor-pointer ml-1">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => onToggleArchived(e.target.checked)}
            className="cursor-pointer accent-[var(--tf-primary)]"
          />
          Archivierte einblenden
        </label>
      </div>

      {/* List */}
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
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
    </div>
  );
}
