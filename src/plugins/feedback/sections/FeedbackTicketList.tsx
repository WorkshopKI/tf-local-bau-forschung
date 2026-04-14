// Filterbare Ticket-Liste links im Admin-Layout.

import * as Icons from 'lucide-react';
import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/components/feedback/constants';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
function getIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) return icon as IconComponent;
  return Icons.HelpCircle;
}

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

const inputClass = 'px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackTicketList(props: Props): React.ReactElement {
  const { tickets, loading, selectedId, filterCategory, filterStatus, onFilterCategory, onFilterStatus, onSelect } = props;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterCategory} onChange={e => onFilterCategory(e.target.value as FeedbackCategory | '')} className={inputClass} style={inputStyle}>
          <option value="">Alle Kategorien</option>
          {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => onFilterStatus(e.target.value as FeedbackStatus | '')} className={inputClass} style={inputStyle}>
          <option value="">Alle Status</option>
          {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="space-y-1.5 max-h-[calc(100vh-260px)] overflow-y-auto">
        {loading && <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">Lade Tickets…</p>}
        {!loading && tickets.length === 0 && <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">Keine Tickets gefunden.</p>}
        {tickets.map(ticket => {
          const Icon = getIcon(CATEGORY_ICONS[ticket.category]);
          const summary = ticket.llm_summary || ticket.text || '–';
          const isSelected = selectedId === ticket.id;
          const date = new Date(ticket.created_at).toLocaleDateString('de-DE');
          const contextLine = [
            ticket.context.page,
            ticket.context.screenRefLabel ? `→ ${ticket.context.screenRefLabel}` : null,
            ticket.user_display_name || ticket.user_id,
          ].filter(Boolean).join(' · ');

          return (
            <button
              key={ticket.id}
              type="button"
              onClick={() => onSelect(ticket)}
              className={`w-full text-left p-2.5 rounded-[var(--tf-radius)] transition-colors cursor-pointer ${
                isSelected ? 'bg-[var(--tf-primary-light)]/30' : 'hover:bg-[var(--tf-hover)]'
              }`}
              style={{
                border: '0.5px solid var(--tf-border)',
                borderLeft: isSelected ? '3px solid var(--tf-primary)' : '0.5px solid var(--tf-border)',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium ${CATEGORY_COLORS[ticket.category]}`}>
                  <Icon size={11} />
                  {CATEGORY_LABELS[ticket.category]}
                </span>
                {ticket.is_faq && (
                  <span className="text-[9.5px] px-1 rounded bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] font-medium">FAQ</span>
                )}
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[ticket.admin_status]}`}>
                  {STATUS_LABELS[ticket.admin_status]}
                </span>
                <span className="text-[10px] text-[var(--tf-text-tertiary)] ml-auto">{date}</span>
              </div>
              <p className="text-[12.5px] text-[var(--tf-text)] leading-snug line-clamp-2">{summary}</p>
              <p className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-1 truncate">{contextLine}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
