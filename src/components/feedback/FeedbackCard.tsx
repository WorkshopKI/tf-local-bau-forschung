// Scannbare Feedback-Kartenzeile (Redesign v2.208, feedback-optimiert).
// [Typ-Icon] [Body: Titel(+„Antwort")+Datum · EINE Vorschauzeile · Meta+Mini-Stepper]
// [Rechte Spalte: Anhang-Thumbnail + Sponsor-Leiste]. Eigene Einträge tragen einen
// feinen Akzentstrich links. Hybrid: Sponsor-Leiste bei sponsorbaren Ideen/UX,
// Vote-Pill sonst (Problem/Frage/Lob).
//
// Die anklickbare Fläche ist ein `div role="button"`, KEIN <button> — die Vote-Pill
// sitzt mitten in der Meta-Zeile und ist selbst ein <button>; verschachtelt ist das
// ungültiges HTML (React meldet es als Hydration-Fehler). Gleiches Muster wie die
// Board-Karte in FeedbackKanban.tsx. Die Sibling-Lösung aus FeedbackTicketRow.tsx
// (eigener Knopf NEBEN der Zeile) trägt hier nicht: sie setzt voraus, dass der
// zweite Knopf am Rand steht, nicht im Textfluss. Klick auf die Pill wählt die
// Karte nicht mit aus — FeedbackVotePill stoppt die Propagation selbst.

import { MessageSquare, Paperclip } from 'lucide-react';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { EFFORT_LABELS } from '@/core/types/feedback';
import { getSponsoringProgress, isSponsorableCategory } from '@/core/services/feedback';
import { istUmgesetzt } from '@/core/services/feedback/feedback-status';
import { CATEGORY_COLORS, CATEGORY_ICONS, EFFORT_SIZE_LABELS, STATUS_DOT, STATUS_LABELS, STATUS_TINT } from './constants';
import { feedbackAuthorLabel, feedbackTitle, feedbackQaSegments, formatShortDate, getLucideIcon } from './feedbackUi';
import { FeedbackAvatar } from './FeedbackAvatar';
import { FeedbackVotePill } from './FeedbackVotePill';
import { FeedbackScreenshots } from './FeedbackScreenshots';
import { FeedbackMiniStepper } from './FeedbackMiniStepper';
import { FeedbackSponsorBar } from './FeedbackSponsorBar';

interface Props {
  ticket: FeedbackItem;
  config: FeedbackConfig;
  selected: boolean;
  mine: boolean;
  meId?: string;
  meName?: string;
  /** Ungelesene Team-Antwort auf dieses (eigene) Feedback → „Antwort"-Marker. */
  unread?: boolean;
  onSelect: (ticket: FeedbackItem) => void;
  onChanged: () => void;
  /** Schmale Variante bei offenem Detail (weniger Beiwerk). */
  narrow?: boolean;
  /** Kompakte Dichte (v2.225, Dichte-Umschalter): engere Zeile, 1-zeilige
   *  Vorschau, schmale rechte Spalte mit entkleideter Sponsor-Leiste. */
  dense?: boolean;
}

export function FeedbackCard({ ticket, config, selected, mine, meId, meName, unread, onSelect, onChanged, narrow, dense }: Props): React.ReactElement {
  const Icon = getLucideIcon(ticket.category ? CATEGORY_ICONS[ticket.category] : 'MessageCircle');
  const title = feedbackTitle(ticket, Infinity);
  const lead = feedbackQaSegments(ticket)[0]?.antwort;
  const author = feedbackAuthorLabel(ticket) ?? '—';
  const date = formatShortDate(ticket.created_at);
  const done = istUmgesetzt(ticket.kurator_status);
  const isPraise = ticket.category === 'praise';
  const commentCount = ticket.comments?.length ?? 0;
  const hasShot = (ticket.attachments ?? []).some(a => a.kind !== 'file');
  const fileCount = (ticket.attachments ?? []).filter(a => a.kind === 'file').length;
  const effort = ticket.effort_estimate;
  const iconTint = ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]';

  // Hybrid: Sponsor-Leiste nur bei sponsorbaren Kategorien mit Schwelle (Aufwand);
  // sonst die budgetfreie Vote-Pill als „ich auch"-Signal.
  const showBar = isSponsorableCategory(ticket.category) && getSponsoringProgress(ticket, config).threshold > 0;
  const showRightCol = !narrow && (hasShot || showBar);

  return (
    <div
      className={`w-full flex items-stretch transition-colors ${selected ? 'bg-[var(--tf-primary-light)]/20' : 'hover:bg-[var(--tf-hover)]'}`}
      style={{
        borderBottom: '0.5px solid var(--tf-border)',
        borderLeft: selected ? '2.5px solid var(--tf-primary)' : mine ? '2.5px solid var(--tf-primary-light)' : '2.5px solid transparent',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(ticket)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(ticket); } }}
        className={`flex-1 min-w-0 text-left flex items-start gap-3 cursor-pointer ${dense ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
      >
        {/* Typ-Icon-Quadrat */}
        <span className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-[8px] shrink-0 ${iconTint}`}>
          <Icon size={16} strokeWidth={1.75} />
        </span>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            {/* Voll umbrechend — der Titel wird bewusst nie gekürzt (der Nutzer
                soll ihn ganz lesen können); break-words fängt lange Wörter/URLs. */}
            <span className={`flex-1 min-w-0 break-words font-medium ${dense ? 'text-[13.5px]' : 'text-[14px]'} ${done ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text)]'}`}>{title}</span>
            {mine && unread && (
              <span className="shrink-0 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[var(--tf-fb-problem-bg)] text-[var(--tf-fb-problem)]" title="Neue Antwort vom Team">
                Antwort
              </span>
            )}
            <span className="ml-auto shrink-0 whitespace-nowrap text-[11.5px] text-[var(--tf-text-tertiary)]">{date}</span>
          </div>

          {!narrow && lead && (
            <p className={`text-[12.5px] text-[var(--tf-text-secondary)] leading-normal ${dense ? 'mt-1 line-clamp-1' : 'mt-1.5 line-clamp-2'}`}>{lead}</p>
          )}

          {/* Meta */}
          <div className={`flex items-center flex-wrap ${dense ? 'mt-1.5 gap-2' : 'mt-2 gap-2.5'}`}>
            {!isPraise && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_TINT[ticket.kurator_status]}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT[ticket.kurator_status] }} />
                {STATUS_LABELS[ticket.kurator_status]}
              </span>
            )}
            {mine && !isPraise && <FeedbackMiniStepper status={ticket.kurator_status} />}
            {ticket.context?.page && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-[var(--tf-card-surface)] text-[var(--tf-text-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
                {ticket.context.page}
              </span>
            )}
            {!mine && (
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <FeedbackAvatar name={author} size={20} />
                <span className="truncate text-[12px] text-[var(--tf-text-secondary)]">{author.split(' ')[0]}</span>
              </span>
            )}
            {effort && (
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)] tabular-nums">
                {EFFORT_SIZE_LABELS[effort]} · {EFFORT_LABELS[effort]}
              </span>
            )}
            <span className="ml-auto flex items-center gap-2.5 shrink-0">
              {fileCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)]" title={`${fileCount} Datei${fileCount > 1 ? 'en' : ''} angehängt`}>
                  <Paperclip size={12} /> {fileCount}
                </span>
              )}
              {commentCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)]" title={`${commentCount} Kommentar${commentCount > 1 ? 'e' : ''}`}>
                  <MessageSquare size={13} /> {commentCount}
                </span>
              )}
              {!showBar && <FeedbackVotePill ticket={ticket} meId={meId} meName={meName} onChanged={onChanged} />}
            </span>
          </div>
        </div>
      </div>

      {/* Rechte Spalte: Thumbnail + Sponsor-Leiste (klick öffnet Detail; Thumbnail
          stoppt Bubbling → Lightbox). Dense: schmale 44px-Spalte, entkleidete Leiste. */}
      {showRightCol && (
        <div
          className={`shrink-0 self-center py-3 flex flex-col ${dense ? 'pr-2.5 w-[56px] gap-1.5 items-center' : 'pr-3 w-[172px] gap-2'}`}
          onClick={() => onSelect(ticket)}
        >
          {hasShot && (
            <div onClick={e => e.stopPropagation()}>
              <FeedbackScreenshots attachments={ticket.attachments!} compact variant={dense ? 'thumb44' : undefined} />
            </div>
          )}
          {showBar && <FeedbackSponsorBar ticket={ticket} config={config} meId={meId} dense={dense} />}
        </div>
      )}
    </div>
  );
}
