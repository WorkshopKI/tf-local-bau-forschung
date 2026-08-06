// Kanban-Board-Ansicht (Redesign v2.225, Handoff feedback-kanban): farbige
// Status-Lanes (Akzent + color-mix-Tönungen). Welche Lanes in welcher
// Spaltenbreite erscheinen, kommt seit dem Anpassbar-Paket aus der persönlichen
// `BoardKanbanConfig` (boardKanbanConfig.ts) — Default ist die alte feste Folge
// Neu → Abgelehnt → Geplant → In Bearbeitung → Umgesetzt, alle einspaltig.
// Status kommt aus dem Feld, Konstanten aus FEEDBACK_STATUS/FEEDBACK_LANE_STATUS,
// nie UI-Literale (Pitfall #21). Lob hat keinen Workflow und erscheint nur in
// der Liste (keine Lob-Spalte mehr).
// Das Lane-Layout (getönte Köpfe, 46px-Schmalschiene, Dichte) lebt seit v2.228
// in der generischen Shell @/components/kanban/KanbanBoard — hier bleiben nur
// die Feedback-Spezifika: Spalten-Ableitung (buildBoardColumns) + MiniCard
// („Akzent"-Stil: Typ-farbige Linkskante, Typ-Label, Footer mit Avatar +
// Metriken Datei/Kommentare/Punkte bzw. interaktive Vote-Pill).

import { useMemo } from 'react';
import { ArrowUp, FileText, MessageSquare } from 'lucide-react';
import type { FeedbackConfig, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import {
  getSponsoringProgress,
  isSponsorableCategory,
  istMeinTicket,
} from '@/core/services/feedback';
import type { MeineIdentitaet } from '@/core/services/feedback';
import { KanbanBoard, type KanbanBoardColumn } from '@/components/kanban/KanbanBoard';
import type { LaneFarbmodus } from '@/components/kanban/laneAccent';
import { feedbackLaneAccent, type FeedbackLane } from './feedbackLanes';
import {
  CATEGORY_LABELS,
  CATEGORY_TEXT_VAR,
  STATUS_COLUMN_ICONS,
  STATUS_LABELS,
} from './constants';
import { feedbackAuthorLabel, feedbackTitle, formatShortDate, getLucideIcon } from './feedbackUi';
import { FeedbackAvatar } from './FeedbackAvatar';
import { FeedbackAntwortHover } from './FeedbackAntwortHover';
import { FeedbackCommentHover } from './FeedbackCommentHover';
import { FeedbackScreenshots } from './FeedbackScreenshots';
import { FeedbackVotePill } from './FeedbackVotePill';

export interface BoardColumn {
  status: FeedbackStatus;
  items: FeedbackItem[];
  spalten: 1 | 2;
}

/**
 * Reine Spalten-Ableitung (testbar): Reihenfolge + Spaltenzahl kommen aus den
 * KONFIGURIERTEN Lanes (Default = FEEDBACK_LANE_STATUS, alle einspaltig).
 * Lob bleibt ausgeschlossen — es hat keinen Workflow und lebt nur in der Liste.
 */
export function buildBoardColumns(tickets: FeedbackItem[], lanes: FeedbackLane[]): BoardColumn[] {
  const byStatus = new Map<FeedbackStatus, FeedbackItem[]>();
  for (const t of tickets) {
    if (t.category === 'praise') continue; // Lob hat keinen Workflow → nur Liste
    const arr = byStatus.get(t.kurator_status);
    if (arr) arr.push(t); else byStatus.set(t.kurator_status, [t]);
  }
  return lanes.map(l => ({
    status: l.status,
    items: byStatus.get(l.status) ?? [],
    spalten: l.spalten,
  }));
}

interface Props {
  tickets: FeedbackItem[];
  config: FeedbackConfig;
  /** Meine Identität — entscheidet die „Du"-Kennzeichnung (feedbackIdentitaet). */
  ich: MeineIdentitaet;
  meId?: string;
  meName?: string;
  /** Ungelesene Team-Antwort auf ein eigenes Feedback → „Antwort"-Badge. */
  isUnread?: (ticket: FeedbackItem) => boolean;
  /** Seit dem letzten Ansehen hinzugekommene Kommentare → „+N"-Badge. */
  neueKommentare?: (ticket: FeedbackItem) => number;
  onSelect: (ticket: FeedbackItem) => void;
  onChanged: () => void;
  /** Kompakte Dichte (Dichte-Umschalter der Seite). */
  dense?: boolean;
  /** Konfigurierte Lanes (Reihenfolge + Kartenspalten) — aus boardKanbanConfig. */
  lanes: FeedbackLane[];
  /** Farbmodus der Lane-Köpfe. */
  farbmodus: LaneFarbmodus;
}

export function FeedbackKanban({ tickets, config, ich, meId, meName, isUnread, neueKommentare, onSelect, onChanged, dense, lanes, farbmodus }: Props): React.ReactElement {
  const columns = useMemo(() => buildBoardColumns(tickets, lanes), [tickets, lanes]);
  const boardCount = columns.reduce((n, c) => n + c.items.length, 0);

  // Nur Lob gefiltert (z.B. Typ-Chip „Lob") → Hinweis statt fünf leerer Schienen.
  if (boardCount === 0 && tickets.length > 0) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-12">
        Lob erscheint nur in der Listenansicht.
      </p>
    );
  }

  const boardColumns: KanbanBoardColumn<FeedbackItem>[] = columns.map((col, i) => ({
    key: col.status,
    label: STATUS_LABELS[col.status],
    icon: getLucideIcon(STATUS_COLUMN_ICONS[col.status]),
    accent: feedbackLaneAccent(farbmodus, col.status, i),
    items: col.items,
    spalten: col.spalten,
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
          mine={istMeinTicket(t, ich)}
          unread={!!isUnread?.(t)}
          neueKommentare={neueKommentare?.(t) ?? 0}
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
function MiniCard({ ticket, config, mine, unread, neueKommentare, meId, meName, onSelect, onChanged, dense }: {
  ticket: FeedbackItem; config: FeedbackConfig; mine: boolean; unread: boolean;
  neueKommentare: number;
  meId?: string; meName?: string; onSelect: (t: FeedbackItem) => void; onChanged: () => void;
  dense: boolean;
}): React.ReactElement {
  const accent = ticket.category ? CATEGORY_TEXT_VAR[ticket.category] : 'var(--tf-text-tertiary)';
  const typeLabel = ticket.category ? CATEGORY_LABELS[ticket.category] : 'Feedback';
  const antwort = ticket.kurator_response?.trim();
  const antwortUngelesen = mine && unread;
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
          {/* Team-Antwort (v3.7): sichtbar, SOLANGE es eine gibt — nicht nur
              solange sie ungelesen ist. Rot = ungelesene Antwort auf mein
              eigenes Ticket (wie bisher), sonst neutral. Text im Hover. */}
          {antwort && (
            <FeedbackAntwortHover antwort={antwort} ungelesen={antwortUngelesen}>
              <span
                className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap cursor-pointer ${
                  antwortUngelesen
                    ? 'bg-[var(--tf-fb-problem-bg)] text-[var(--tf-fb-problem)]'
                    : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]'
                }`}
              >
                Antwort
              </span>
            </FeedbackAntwortHover>
          )}
          {/* Neue Kommentare gehören nach OBEN: die Fuß-Metrik bei 11 px erfüllt
              „besser sichtbar" nicht, hier ist die Aufmerksamkeitszone der Karte.
              Blau grenzt bewusst gegen das rote „Antwort"-Badge ab — Team-Antwort
              ist etwas anderes als eine laufende Diskussion. */}
          {neueKommentare > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--tf-fb-idee-bg)] text-[var(--tf-fb-idee)] whitespace-nowrap tabular-nums"
              title={`${neueKommentare} neue${neueKommentare > 1 ? '' : 'r'} Kommentar${neueKommentare > 1 ? 'e' : ''} seit deinem letzten Besuch`}
            >
              <MessageSquare size={9} strokeWidth={2} /> +{neueKommentare}
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
            // Kein `title` mehr: es konkurrierte mit der Hover-Vorschau (zwei
            // Popups über demselben Icon).
            <FeedbackCommentHover comments={ticket.comments ?? []} neueKommentare={neueKommentare}>
              <span className={`inline-flex items-center gap-1 tabular-nums ${neueKommentare > 0 ? 'font-semibold text-[var(--tf-fb-idee)]' : ''}`}>
                <MessageSquare size={12} strokeWidth={1.75} /> {commentCount}
              </span>
            </FeedbackCommentHover>
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
