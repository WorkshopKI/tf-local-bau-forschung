// Kanban-Board-Ansicht (Redesign v2.225, Handoff feedback-kanban): farbige
// Status-Lanes (Akzent + color-mix-Tönungen) in fester Design-Reihenfolge
// Neu → Abgelehnt → Geplant → In Bearbeitung → Umgesetzt (Status kommt aus dem
// Feld, Konstanten aus FEEDBACK_STATUS, nie UI-Literale — Pitfall #21). Lob hat
// keinen Workflow und erscheint nur in der Liste (keine Lob-Spalte mehr).
// Das Lane-Layout (getönte Köpfe, 46px-Schmalschiene, Dichte) lebt seit v2.228
// in der generischen Shell @/components/kanban/KanbanBoard — hier bleiben nur
// die Feedback-Spezifika: Spalten-Ableitung (buildBoardColumns) + MiniCard
// („Akzent"-Stil: Typ-farbige Linkskante, Typ-Label, Footer mit Avatar +
// Metriken Datei/Kommentare/Punkte bzw. interaktive Vote-Pill).

import { useMemo } from 'react';
import { ArrowUp, FileText, MessageSquare } from 'lucide-react';
import type { FeedbackConfig, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import {
  FEEDBACK_STATUS,
  getSponsoringProgress,
  isSponsorableCategory,
} from '@/core/services/feedback';
import { KanbanBoard, type KanbanBoardColumn } from '@/components/kanban/KanbanBoard';
import {
  CATEGORY_LABELS,
  CATEGORY_TEXT_VAR,
  STATUS_COLUMN_ICONS,
  STATUS_LANE_ACCENT,
  STATUS_LABELS,
} from './constants';
import { feedbackAuthorLabel, feedbackTitle, formatShortDate, getLucideIcon } from './feedbackUi';
import { FeedbackAvatar } from './FeedbackAvatar';
import { FeedbackScreenshots } from './FeedbackScreenshots';
import { FeedbackVotePill } from './FeedbackVotePill';

// Spalten in Design-Reihenfolge (Handoff feedback-kanban): Abgelehnt rückt an
// Position 2 — daher explizit statt aus FEEDBACK_PIPELINE abgeleitet.
const BOARD_ORDER: readonly FeedbackStatus[] = [
  FEEDBACK_STATUS.neu,
  FEEDBACK_STATUS.abgelehnt,
  FEEDBACK_STATUS.geplant,
  FEEDBACK_STATUS.in_bearbeitung,
  FEEDBACK_STATUS.umgesetzt,
];

export interface BoardColumn {
  status: FeedbackStatus;
  items: FeedbackItem[];
}

/** Reine Spalten-Ableitung (testbar): feste BOARD_ORDER, Lob ausgeschlossen. */
export function buildBoardColumns(tickets: FeedbackItem[]): BoardColumn[] {
  const byStatus = new Map<FeedbackStatus, FeedbackItem[]>();
  for (const t of tickets) {
    if (t.category === 'praise') continue; // Lob hat keinen Workflow → nur Liste
    const arr = byStatus.get(t.kurator_status);
    if (arr) arr.push(t); else byStatus.set(t.kurator_status, [t]);
  }
  return BOARD_ORDER.map(s => ({ status: s, items: byStatus.get(s) ?? [] }));
}

interface Props {
  tickets: FeedbackItem[];
  config: FeedbackConfig;
  meineUserId?: string;
  meId?: string;
  meName?: string;
  /** Ungelesene Team-Antwort auf ein eigenes Feedback → „Antwort"-Badge. */
  isUnread?: (ticket: FeedbackItem) => boolean;
  onSelect: (ticket: FeedbackItem) => void;
  onChanged: () => void;
  /** Kompakte Dichte (Dichte-Umschalter der Seite). */
  dense?: boolean;
}

export function FeedbackKanban({ tickets, config, meineUserId, meId, meName, isUnread, onSelect, onChanged, dense }: Props): React.ReactElement {
  const columns = useMemo(() => buildBoardColumns(tickets), [tickets]);
  const boardCount = columns.reduce((n, c) => n + c.items.length, 0);

  // Nur Lob gefiltert (z.B. Typ-Chip „Lob") → Hinweis statt fünf leerer Schienen.
  if (boardCount === 0 && tickets.length > 0) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-12">
        Lob erscheint nur in der Listenansicht.
      </p>
    );
  }

  const boardColumns: KanbanBoardColumn<FeedbackItem>[] = columns.map(col => ({
    key: col.status,
    label: STATUS_LABELS[col.status],
    icon: getLucideIcon(STATUS_COLUMN_ICONS[col.status]),
    accent: STATUS_LANE_ACCENT[col.status],
    items: col.items,
  }));

  return (
    <KanbanBoard
      columns={boardColumns}
      dense={dense}
      layout="fest"
      renderCard={t => (
        <MiniCard
          key={t.id}
          ticket={t}
          config={config}
          mine={!!meineUserId && t.user_id === meineUserId}
          unread={!!isUnread?.(t)}
          meId={meId}
          meName={meName}
          onSelect={onSelect}
          onChanged={onChanged}
          dense={!!dense}
        />
      )}
    />
  );
}

// Board-Karte im „Akzent"-Stil (Handoff feedback-kanban): Typ-farbige Linkskante
// statt mine-Kante (Eigenheit zeigt nur noch „Du" im Footer).
function MiniCard({ ticket, config, mine, unread, meId, meName, onSelect, onChanged, dense }: {
  ticket: FeedbackItem; config: FeedbackConfig; mine: boolean; unread: boolean;
  meId?: string; meName?: string; onSelect: (t: FeedbackItem) => void; onChanged: () => void;
  dense: boolean;
}): React.ReactElement {
  const accent = ticket.category ? CATEGORY_TEXT_VAR[ticket.category] : 'var(--tf-text-tertiary)';
  const typeLabel = ticket.category ? CATEGORY_LABELS[ticket.category] : 'Feedback';
  const author = mine ? 'Du' : (feedbackAuthorLabel(ticket) ?? '—');
  const commentCount = ticket.comments?.length ?? 0;
  const fileCount = (ticket.attachments ?? []).filter(a => a.kind === 'file').length;
  const hasShot = (ticket.attachments ?? []).some(a => a.kind !== 'file');
  const progress = getSponsoringProgress(ticket, config);
  const showPts = isSponsorableCategory(ticket.category) && progress.threshold > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(ticket)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(ticket); } }}
      className={`block text-left rounded-[10px] bg-[var(--tf-bg)] shadow-sm hover:shadow-md hover:-translate-y-px hover:border-[var(--tf-border-hover)] transition cursor-pointer ${dense ? 'px-2.5 py-2' : 'px-3 pt-[11px] pb-2.5'}`}
      style={{ border: '0.5px solid var(--tf-border)', borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.07em]" style={{ color: accent }}>
          {typeLabel}
        </span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {mine && unread && (
            <span className="text-[9.5px] font-semibold px-2 py-0.5 rounded-full bg-[var(--tf-fb-problem-bg)] text-[var(--tf-fb-problem)] whitespace-nowrap" title="Neue Antwort vom Team">
              Antwort
            </span>
          )}
          <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums whitespace-nowrap">{formatShortDate(ticket.created_at)}</span>
        </span>
      </div>

      <p className={`font-semibold text-[var(--tf-text)] ${dense ? 'mt-1.5 text-[12px] leading-[1.3] line-clamp-2' : 'mt-[9px] text-[13px] leading-[1.35] line-clamp-3'}`}>
        {feedbackTitle(ticket, 120)}
      </p>

      {!dense && hasShot && (
        <div className="mt-[9px]" onClick={e => e.stopPropagation()}>
          <FeedbackScreenshots attachments={ticket.attachments!} variant="board" />
        </div>
      )}

      {/* Footer: Avatar + Name links, Metriken/Vote rechts */}
      <div
        className={`flex items-center gap-2 ${dense ? 'mt-2 pt-1.5' : 'mt-[11px] pt-[9px]'}`}
        style={{ borderTop: '0.5px solid var(--tf-border)' }}
      >
        <FeedbackAvatar name={author} size={18} />
        <span className="min-w-0 truncate text-[11.5px] text-[var(--tf-text-secondary)]">{author}</span>
        <span className="ml-auto flex items-center gap-[11px] shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">
          {fileCount > 0 && (
            <span className="inline-flex" title={`${fileCount} Datei${fileCount > 1 ? 'en' : ''} angehängt`}>
              <FileText size={12} strokeWidth={1.75} />
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums" title={`${commentCount} Kommentar${commentCount > 1 ? 'e' : ''}`}>
              <MessageSquare size={12} strokeWidth={1.75} /> {commentCount}
            </span>
          )}
          {showPts ? (
            <span className="inline-flex items-center gap-1 tabular-nums" title={`${progress.combinedPoints} von ${progress.threshold} Pkt`}>
              <ArrowUp size={12} strokeWidth={1.75} className="text-[var(--tf-fb-lob)]" /> {progress.combinedPoints}
            </span>
          ) : (
            <span onClick={e => e.stopPropagation()}>
              <FeedbackVotePill ticket={ticket} meId={meId} meName={meName} onChanged={onChanged} />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
