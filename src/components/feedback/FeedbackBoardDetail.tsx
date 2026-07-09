// User-Detail-Panel des öffentlichen Boards (rechte Spalte der Split-Ansicht,
// Redesign v2.208). Rein lesend für die Feedback-Inhalte + interaktiv für
// Sponsoring/Votes/Kommentare. KEINE Kurator-Edit-Felder. Neu: dateloser
// Fortschritts-Stepper, Sponsoring-Panel (großes X/Y + +/− + Budget-Hinweis),
// hervorgehobene Team-Antwort (ungelesen → rot + „Neu"). Bringt eigenes Scrollen
// mit (das MasterDetailLayout-Detail-Pane ist overflow-hidden).

import { useEffect, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { isSponsorableCategory } from '@/core/services/feedback';
import { EFFORT_LABELS } from '@/core/types/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  EFFORT_SIZE_LABELS,
  STATUS_DOT,
  STATUS_LABELS,
  STATUS_TINT,
} from './constants';
import { feedbackAuthorLabel, feedbackTitle, feedbackQaSegments, formatShortDate, getLucideIcon } from './feedbackUi';
import { FeedbackScreenshots } from './FeedbackScreenshots';
import { FeedbackFiles } from './FeedbackFiles';
import { FeedbackAvatar } from './FeedbackAvatar';
import { FeedbackVotePill } from './FeedbackVotePill';
import { FeedbackCommentThread } from './FeedbackCommentThread';
import { FeedbackStepper } from './FeedbackStepper';
import { FeedbackSponsorPanel } from './FeedbackSponsorPanel';

interface Props {
  ticket: FeedbackItem;
  config: FeedbackConfig;
  onClose: () => void;
  onChanged: () => void;
  meId?: string;
  meName?: string;
  /** Ungelesene Team-Antwort auf dieses (eigene) Feedback beim Öffnen. */
  unread?: boolean;
  /** Beim Öffnen als gesehen markieren (klärt Glocke + „Antwort"-Marker). */
  markSeen?: (ticket: FeedbackItem) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-2.5">{children}</p>
  );
}

export function FeedbackBoardDetail({ ticket, config, onClose, onChanged, meId, meName, unread, markSeen }: Props): React.ReactElement {
  const Icon = getLucideIcon(ticket.category ? CATEGORY_ICONS[ticket.category] : 'MessageCircle');
  const mine = !!meId && ticket.user_id === meId;
  const author = mine ? 'Du' : (feedbackAuthorLabel(ticket) ?? 'Unbekannt');
  const response = ticket.kurator_response?.trim();
  const isFeature = isSponsorableCategory(ticket.category);
  const hasEffort = !!ticket.effort_estimate;
  const segments = feedbackQaSegments(ticket);
  const isPraise = ticket.category === 'praise';
  const voteCount = ticket.votes?.length ?? 0;
  const iconTint = ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]';

  // Ungelesen-Zustand beim Öffnen einfrieren, damit die Hervorhebung sichtbar
  // bleibt, während markSeen die Glocke/den Listen-Marker global klärt. Der
  // Aufrufer keyt dieses Panel per ticket.id → useState wird pro Ticket frisch.
  const [highlightReply] = useState(!!unread);
  useEffect(() => { markSeen?.(ticket); }, [ticket, markSeen]);

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="flex-1 px-4 py-3 space-y-4">
        {/* Header: Typ-Pill · Status · Bereich · Aufwand · Close */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${iconTint}`}>
              <Icon size={12} strokeWidth={1.75} />
              {ticket.category ? CATEGORY_LABELS[ticket.category] : 'Unklassifiziert'}
            </span>
            {!isPraise && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_TINT[ticket.kurator_status]}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT[ticket.kurator_status] }} />
                {STATUS_LABELS[ticket.kurator_status]}
              </span>
            )}
            {ticket.context?.page && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-[var(--tf-card-surface)] text-[var(--tf-text-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
                {ticket.context.page}
              </span>
            )}
            {hasEffort && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)] tabular-nums">
                {EFFORT_SIZE_LABELS[ticket.effort_estimate!]} · {EFFORT_LABELS[ticket.effort_estimate!]}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)] shrink-0" aria-label="Schließen"><X size={16} /></button>
        </div>

        {/* Titel + Autor */}
        <div>
          <h2 className="text-[19px] font-medium text-[var(--tf-text)] leading-snug">{feedbackTitle(ticket, 140)}</h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-tertiary)]">
            <FeedbackAvatar name={author} size={20} />
            <span className="truncate">von <span className="text-[var(--tf-text-secondary)]">{author}</span> · {formatShortDate(ticket.created_at)}</span>
          </p>
        </div>

        {/* Fortschritt (dateloser Stepper) */}
        {!isPraise && (
          <div>
            <SectionLabel>Fortschritt</SectionLabel>
            <FeedbackStepper status={ticket.kurator_status} />
          </div>
        )}

        {/* Felder: alle Q&A ausgeschrieben (Lob als Zitat) */}
        {segments.length > 0 && (
          isPraise && !segments[0]?.frage ? (
            <p className="text-[15px] italic text-[var(--tf-text)] leading-relaxed">„{segments[0]?.antwort}"</p>
          ) : (
            <div className="space-y-3">
              {segments.map((seg, i) => (
                <div key={i}>
                  {seg.frage && (
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium mb-0.5">{seg.frage}</p>
                  )}
                  <p className="text-[13.5px] text-[var(--tf-text)] whitespace-pre-wrap leading-relaxed">{seg.antwort}</p>
                </div>
              ))}
            </div>
          )
        )}

        {/* Screenshots + beigefügte Dateien */}
        {ticket.attachments && ticket.attachments.length > 0 && (
          <>
            <FeedbackScreenshots attachments={ticket.attachments} />
            <FeedbackFiles attachments={ticket.attachments} />
          </>
        )}

        {/* Antwort vom Team — ungelesen (eigenes Feedback) → rot + „Neu" */}
        {response && (
          <div
            className={`p-3 rounded-[var(--tf-radius-lg)] ${highlightReply ? 'bg-[var(--tf-fb-problem-bg)]' : 'bg-[var(--tf-fb-idee-bg)]'}`}
            style={{ borderLeft: `2px solid ${highlightReply ? 'var(--tf-fb-problem)' : 'var(--tf-fb-idee)'}` }}
          >
            <p className={`flex items-center gap-1.5 mb-1 text-[11px] font-medium ${highlightReply ? 'text-[var(--tf-fb-problem)]' : 'text-[var(--tf-fb-idee)]'}`}>
              <MessageSquare size={11} className="shrink-0" /> Antwort vom Team
              {highlightReply && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--tf-fb-problem)] text-white">Neu</span>}
            </p>
            <p className="text-[12.5px] text-[var(--tf-text)] whitespace-pre-wrap leading-relaxed">{response}</p>
          </div>
        )}

        {/* Sponsoring (nur sponsorbare Kategorien = Ideen + UX, mit Aufwand) */}
        {isFeature && hasEffort && (
          <div>
            <SectionLabel>Sponsoring</SectionLabel>
            <FeedbackSponsorPanel ticket={ticket} config={config} meId={meId} onChanged={onChanged} />
          </div>
        )}

        {/* Kommentare */}
        <div className="pt-1 border-t" style={{ borderColor: 'var(--tf-border)' }}>
          <div className="pt-3">
            <FeedbackCommentThread ticket={ticket} meId={meId} meName={meName} onChanged={onChanged} />
          </div>
        </div>
      </div>

      {/* Footer: Vote-Button + Hinweis (budgetfreies „Ich auch"-Signal) */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-t" style={{ borderColor: 'var(--tf-border)' }}>
        <FeedbackVotePill ticket={ticket} meId={meId} meName={meName} onChanged={onChanged} prominent />
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {voteCount === 1 ? 'Stimme' : 'Stimmen'} · zeigt dem Team die Nachfrage
        </span>
      </div>
    </div>
  );
}
