// User-Detail-Panel des öffentlichen Boards (rechte Spalte der Split-Ansicht).
// Inhaltlich die User-Variante des Kurator-Detail: rein lesend (Volltext,
// Kontext, Antwort vom Team, Screenshots) + Sponsoring/Voting — KEINE Kurator-
// Edit-Felder (Status/Priorität/Notizen/FAQ/Löschen). Bringt eigenes Scrollen
// mit (das MasterDetailLayout-Detail-Pane ist overflow-hidden).

import { MessageSquare, TrendingUp, User, X } from 'lucide-react';
import { getSponsoringProgress, isSponsorableCategory, isSponsoringOpen } from '@/core/services/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  EFFORT_SHORT_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from './constants';
import { feedbackAuthorLabel, formatRelativeTime, getLucideIcon } from './feedbackUi';
import { FeedbackScreenshots } from './FeedbackScreenshots';
import { SponsorButton } from './SponsorButton';

interface Props {
  ticket: FeedbackItem;
  config: FeedbackConfig;
  onClose: () => void;
  onChanged: () => void;
}

export function FeedbackBoardDetail({ ticket, config, onClose, onChanged }: Props): React.ReactElement {
  const Icon = getLucideIcon(ticket.category ? CATEGORY_ICONS[ticket.category] : 'MessageCircle');
  const author = feedbackAuthorLabel(ticket);
  const response = ticket.kurator_response?.trim();
  const isFeature = isSponsorableCategory(ticket.category);
  const hasEffort = !!ticket.effort_estimate;
  const progress = getSponsoringProgress(ticket, config);
  const open = isSponsoringOpen(ticket);

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <div className="space-y-3">
        {/* Header: Icon + Badges links, Close rechts */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Icon size={14} className="text-[var(--tf-text-secondary)] shrink-0" />
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]'}`}>
              {ticket.category ? CATEGORY_LABELS[ticket.category] : 'Unklassifiziert'}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${STATUS_COLORS[ticket.kurator_status]}`}>
              {STATUS_LABELS[ticket.kurator_status]}
            </span>
            {ticket.context?.page && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
                {ticket.context.page}
              </span>
            )}
            {hasEffort && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)]">
                {EFFORT_SHORT_LABELS[ticket.effort_estimate!]}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)] shrink-0" aria-label="Schließen"><X size={14} /></button>
        </div>

        {/* Autor + Zeit */}
        {author && (
          <p className="flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)]">
            <User size={11} className="shrink-0" />
            <span className="truncate">von {author} · {formatRelativeTime(ticket.created_at)}</span>
          </p>
        )}

        {/* Volltext */}
        <p className="text-[12.5px] text-[var(--tf-text)] whitespace-pre-wrap leading-relaxed">{ticket.text}</p>
        {ticket.llm_summary && ticket.llm_summary !== ticket.text && (
          <p className="text-[11.5px] text-[var(--tf-text-secondary)] italic">{ticket.llm_summary}</p>
        )}

        {/* Screenshots (voll, mit Überschrift) */}
        {ticket.attachments && ticket.attachments.length > 0 && (
          <FeedbackScreenshots attachments={ticket.attachments} />
        )}

        {/* Antwort vom Team */}
        {response && (
          <div
            className="p-2.5 rounded-[var(--tf-radius)] bg-[var(--tf-info-bg)]"
            style={{ borderLeft: '2px solid var(--tf-info-text)' }}
          >
            <p className="flex items-center gap-1 mb-0.5 text-[10.5px] font-medium text-[var(--tf-info-text)]">
              <MessageSquare size={11} className="shrink-0" />
              Antwort vom Team
            </p>
            <p className="text-[12px] text-[var(--tf-text)] whitespace-pre-wrap leading-snug">{response}</p>
          </div>
        )}

        {/* Sponsoring (nur bei sponsorbaren Kategorien = Ideen + UX) */}
        {isFeature && hasEffort && (
          <div className="p-2.5 rounded-[var(--tf-radius)] space-y-2" style={{ border: '0.5px solid var(--tf-border)' }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-[var(--tf-text)] inline-flex items-center gap-1"><TrendingUp size={11} /> Sponsoring</p>
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{progress.percentage}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
              <div
                className="h-full transition-all"
                style={{ width: `${progress.percentage}%`, background: progress.thresholdReached ? 'var(--tf-success-text)' : 'var(--tf-primary)' }}
              />
            </div>
            <p className="text-[10.5px] text-[var(--tf-text-tertiary)]">
              {progress.combinedPoints}/{progress.threshold} Pkt
              {progress.sponsorCount > 0 && ` · ${progress.sponsorCount} Sponsoren`}
            </p>
            <SponsorButton ticket={ticket} config={config} open={open} onChanged={onChanged} />
          </div>
        )}
        {isFeature && !hasEffort && (
          <p className="text-[11px] text-[var(--tf-text-tertiary)] italic">
            Aufwand-Schätzung ausstehend — Sponsoring noch nicht möglich.
          </p>
        )}
      </div>
    </div>
  );
}
