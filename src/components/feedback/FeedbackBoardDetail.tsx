// User-Detail-Panel des öffentlichen Boards (rechte Spalte der Split-Ansicht,
// Redesign v2.199). Rein lesend für die Feedback-Inhalte + interaktiv für Votes
// und Kommentare. KEINE Kurator-Edit-Felder (Status/Priorität/Notizen/Löschen).
// Bringt eigenes Scrollen mit (das MasterDetailLayout-Detail-Pane ist
// overflow-hidden).

import { MessageSquare, TrendingUp, X } from 'lucide-react';
import { getSponsoringProgress, isSponsorableCategory, isSponsoringOpen } from '@/core/services/feedback';
import { EFFORT_LABELS } from '@/core/types/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  EFFORT_SIZE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from './constants';
import { feedbackAuthorLabel, feedbackTitle, feedbackQaSegments, formatShortDate, getLucideIcon } from './feedbackUi';
import { FeedbackScreenshots } from './FeedbackScreenshots';
import { FeedbackFiles } from './FeedbackFiles';
import { SponsorButton } from './SponsorButton';
import { FeedbackAvatar } from './FeedbackAvatar';
import { FeedbackVotePill } from './FeedbackVotePill';
import { FeedbackCommentThread } from './FeedbackCommentThread';

interface Props {
  ticket: FeedbackItem;
  config: FeedbackConfig;
  onClose: () => void;
  onChanged: () => void;
  meId?: string;
  meName?: string;
}

export function FeedbackBoardDetail({ ticket, config, onClose, onChanged, meId, meName }: Props): React.ReactElement {
  const Icon = getLucideIcon(ticket.category ? CATEGORY_ICONS[ticket.category] : 'MessageCircle');
  const mine = !!meId && ticket.user_id === meId;
  const author = mine ? 'Du' : (feedbackAuthorLabel(ticket) ?? 'Unbekannt');
  const response = ticket.kurator_response?.trim();
  const isFeature = isSponsorableCategory(ticket.category);
  const hasEffort = !!ticket.effort_estimate;
  const progress = getSponsoringProgress(ticket, config);
  const open = isSponsoringOpen(ticket);
  const segments = feedbackQaSegments(ticket);
  const isPraise = ticket.category === 'praise';
  const voteCount = ticket.votes?.length ?? 0;
  const iconTint = ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]';

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="flex-1 px-4 py-3 space-y-3.5">
        {/* Header: Typ-Pill · Status · Bereich · Aufwand · Close */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${iconTint}`}>
              <Icon size={12} strokeWidth={1.75} />
              {ticket.category ? CATEGORY_LABELS[ticket.category] : 'Unklassifiziert'}
            </span>
            {!isPraise && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${STATUS_COLORS[ticket.kurator_status]}`}>
                {STATUS_LABELS[ticket.kurator_status]}
              </span>
            )}
            {ticket.context?.page && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
                {ticket.context.page}
              </span>
            )}
            {hasEffort && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)] tabular-nums">
                {EFFORT_SIZE_LABELS[ticket.effort_estimate!]} · {EFFORT_LABELS[ticket.effort_estimate!]}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)] shrink-0" aria-label="Schließen"><X size={16} /></button>
        </div>

        {/* Titel + Autor */}
        <div>
          <h2 className="text-[18px] font-medium text-[var(--tf-text)] leading-snug">{feedbackTitle(ticket, 140)}</h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-tertiary)]">
            <FeedbackAvatar name={author} size={20} />
            <span className="truncate">von <span className="text-[var(--tf-text-secondary)]">{author}</span> · {formatShortDate(ticket.created_at)}</span>
          </p>
        </div>

        {/* Felder: alle Q&A ausgeschrieben */}
        {segments.length > 0 && (
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
        )}

        {/* Screenshots + beigefügte Dateien */}
        {ticket.attachments && ticket.attachments.length > 0 && (
          <>
            <FeedbackScreenshots attachments={ticket.attachments} />
            <FeedbackFiles attachments={ticket.attachments} />
          </>
        )}

        {/* Antwort vom Team */}
        {response && (
          <div className="p-2.5 rounded-[var(--tf-radius)] bg-[var(--tf-info-bg)]" style={{ borderLeft: '2px solid var(--tf-info-text)' }}>
            <p className="flex items-center gap-1 mb-0.5 text-[10.5px] font-medium text-[var(--tf-info-text)]">
              <MessageSquare size={11} className="shrink-0" /> Antwort vom Team
            </p>
            <p className="text-[12px] text-[var(--tf-text)] whitespace-pre-wrap leading-snug">{response}</p>
          </div>
        )}

        {/* Sponsoring (nur bei sponsorbaren Kategorien = Ideen + UX) — bleibt neben dem Vote als eigenes Signal */}
        {isFeature && hasEffort && (
          <div className="p-2.5 rounded-[var(--tf-radius)] space-y-2" style={{ border: '0.5px solid var(--tf-border)' }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-[var(--tf-text)] inline-flex items-center gap-1"><TrendingUp size={11} /> Sponsoring</p>
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{progress.percentage}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${progress.percentage}%`, background: progress.thresholdReached ? 'var(--tf-success-text)' : 'var(--tf-primary)' }} />
            </div>
            <p className="text-[10.5px] text-[var(--tf-text-tertiary)]">
              {progress.combinedPoints}/{progress.threshold} Pkt
              {progress.sponsorCount > 0 && ` · ${progress.sponsorCount} Sponsoren`}
            </p>
            <SponsorButton ticket={ticket} config={config} open={open} onChanged={onChanged} />
          </div>
        )}

        {/* Kommentare */}
        <div className="pt-1 border-t" style={{ borderColor: 'var(--tf-border)' }}>
          <div className="pt-3">
            <FeedbackCommentThread ticket={ticket} meId={meId} meName={meName} onChanged={onChanged} />
          </div>
        </div>
      </div>

      {/* Footer: Vote-Button + Hinweis */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-t" style={{ borderColor: 'var(--tf-border)' }}>
        <FeedbackVotePill ticket={ticket} meId={meId} meName={meName} onChanged={onChanged} prominent />
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {voteCount === 1 ? 'Stimme' : 'Stimmen'} · zeigt dem Team die Nachfrage
        </span>
      </div>
    </div>
  );
}
