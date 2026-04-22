// Filterbare Ticket-Liste links im Admin-Layout — kompakte Zeilen statt Cards.

import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '@/components/feedback/constants';

interface Props {
  tickets: FeedbackItem[];
  loading: boolean;
  selectedId?: string;
  filterCategory: FeedbackCategory | '';
  filterStatus: FeedbackStatus | '';
  onFilterCategory: (v: FeedbackCategory | '') => void;
  onFilterStatus: (v: FeedbackStatus | '') => void;
  onSelect: (ticket: FeedbackItem) => void;
}

const STATUS_PILLS: { id: FeedbackStatus | ''; label: string }[] = [
  { id: '', label: 'Alle' },
  { id: 'neu', label: 'Neu' },
  { id: 'geplant', label: 'Geplant' },
  { id: 'in_bearbeitung', label: 'In Bearb.' },
  { id: 'umgesetzt', label: 'Umgesetzt' },
  { id: 'abgelehnt', label: 'Abgelehnt' },
];

const CATEGORY_PILLS: { id: FeedbackCategory | ''; label: string }[] = [
  { id: '', label: 'Alle' },
  { id: 'problem', label: 'Bug' },
  { id: 'idea', label: 'Idee' },
  { id: 'praise', label: 'Lob' },
  { id: 'question', label: 'Frage' },
];

const pillBase = 'px-2 py-0.5 rounded-full text-[11px] cursor-pointer transition-colors';
const pillActive = `${pillBase} bg-[var(--tf-primary)] text-white`;
const pillInactive = `${pillBase} text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]`;

export function FeedbackTicketList(props: Props): React.ReactElement {
  const { tickets, loading, selectedId, filterCategory, filterStatus, onFilterCategory, onFilterStatus, onSelect } = props;

  return (
    <div>
      {/* Filter-Pills */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--tf-text-tertiary)] font-medium w-[60px] shrink-0">Status</span>
          <div className="flex flex-wrap gap-1">
            {STATUS_PILLS.map(p => (
              <button key={p.id} type="button" onClick={() => onFilterStatus(p.id)}
                className={filterStatus === p.id ? pillActive : pillInactive}
                style={filterStatus !== p.id ? { border: '0.5px solid var(--tf-border)' } : undefined}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--tf-text-tertiary)] font-medium w-[60px] shrink-0">Kategorie</span>
          <div className="flex flex-wrap gap-1">
            {CATEGORY_PILLS.map(p => (
              <button key={p.id} type="button" onClick={() => onFilterCategory(p.id)}
                className={filterCategory === p.id ? pillActive : pillInactive}
                style={filterCategory !== p.id ? { border: '0.5px solid var(--tf-border)' } : undefined}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
        {loading && <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">Lade Tickets…</p>}
        {!loading && tickets.length === 0 && <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">Keine Tickets gefunden.</p>}
        {tickets.map(ticket => {
          const summary = ticket.llm_summary || ticket.text || '–';
          const isSelected = selectedId === ticket.id;
          const date = new Date(ticket.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
          const contextLine = [
            ticket.context.page,
            ticket.user_display_name || ticket.user_id,
          ].filter(Boolean).join(' · ');

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
              <p className="text-[10px] text-[var(--tf-text-tertiary)] truncate mt-0.5 ml-[calc(theme(spacing.1.5)*2+theme(spacing.2)+2ch)]" style={{ marginLeft: '4.5rem' }}>
                {contextLine}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
