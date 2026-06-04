// Filterbare Ticket-Liste links im Admin-Layout — kompakte Zeilen statt Cards.

import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '@/components/feedback/constants';
import { CollapsibleSeg, type CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';

interface Props {
  tickets: FeedbackItem[];
  loading: boolean;
  selectedId?: string;
  filterCategory: FeedbackCategory | '';
  filterStatus: FeedbackStatus | '';
  filterArea: string;
  statusItems: CollapsibleSegItem[];
  kategorieItems: CollapsibleSegItem[];
  bereichItems: CollapsibleSegItem[];
  onFilterCategory: (v: FeedbackCategory | '') => void;
  onFilterStatus: (v: FeedbackStatus | '') => void;
  onFilterArea: (v: string) => void;
  onSelect: (ticket: FeedbackItem) => void;
}

// Label↔Wert-Maps für die label-basierte CollapsibleSeg (wie im User-Board).
// Status bleibt granular (Kurator braucht die feinen Stati); 'archiviert' wird im
// Filter nicht angeboten, ist im TO_LABEL-Record aber vollständig (Typ-Deckung).
const STATUS_TO_LABEL: Record<FeedbackStatus | '', string> = {
  '': 'Alle', neu: 'Neu', geplant: 'Geplant', in_bearbeitung: 'In Bearb.',
  umgesetzt: 'Umgesetzt', abgelehnt: 'Abgelehnt', archiviert: 'Archiviert',
};
const LABEL_TO_STATUS: Record<string, FeedbackStatus | ''> = {
  Alle: '', Neu: 'neu', Geplant: 'geplant', 'In Bearb.': 'in_bearbeitung',
  Umgesetzt: 'umgesetzt', Abgelehnt: 'abgelehnt',
};
const KAT_TO_LABEL: Record<FeedbackCategory | '', string> = {
  '': 'Alle', problem: 'Bug', idea: 'Idee', praise: 'Lob', question: 'Frage',
};
const LABEL_TO_KAT: Record<string, FeedbackCategory | ''> = {
  Alle: '', Bug: 'problem', Idee: 'idea', Lob: 'praise', Frage: 'question',
};

export function FeedbackTicketList(props: Props): React.ReactElement {
  const { tickets, loading, selectedId, filterCategory, filterStatus, filterArea, statusItems, kategorieItems, bereichItems, onFilterCategory, onFilterStatus, onFilterArea, onSelect } = props;

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
      </div>

      {/* List */}
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
        {loading && <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">Lade Tickets…</p>}
        {!loading && tickets.length === 0 && <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">Keine Tickets gefunden.</p>}
        {tickets.map(ticket => {
          const summary = ticket.llm_summary || ticket.text || '–';
          const isSelected = selectedId === ticket.id;
          const date = new Date(ticket.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
          const area = ticket.context?.page;
          const user = ticket.user_display_name || ticket.user_id;

          return (
            <button
              key={ticket.id}
              type="button"
              onClick={() => onSelect(ticket)}
              className={`w-full text-left px-2.5 py-2 transition-colors cursor-pointer ${
                isSelected ? 'bg-[var(--tf-primary-light)]/20' : 'hover:bg-[var(--tf-hover)]'
              }`}
              style={{
                borderBottom: '0.5px solid var(--tf-border)',
                borderLeft: isSelected ? '3px solid var(--tf-primary)' : '3px solid transparent',
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
        })}
      </div>
    </div>
  );
}
