// Detail-Panel des Feedback-Boards (rechte Spalte der Split-Ansicht,
// Redesign v2.208). Lesend für die Feedback-Inhalte + interaktiv für
// Sponsoring/Votes/Kommentare. Seit v2.364 ist es die EINZIGE Feedback-
// Bearbeitungsstelle: mit Verwaltungsrecht (`canManageFeedback`) hängt der
// Verwaltungs-Block darunter und „Ergänzen" steht offen (seit v3.7 an JEDEM
// Ticket, nicht nur am eigenen — Beta-Entscheidung). Dateloser
// Fortschritts-Stepper, Sponsoring-Panel (großes X/Y + +/− + Budget-Hinweis),
// hervorgehobene Team-Antwort (ungelesen → rot + „Neu"). Bringt eigenes Scrollen
// mit (das MasterDetailLayout-Detail-Pane ist overflow-hidden).

import { useEffect, useState } from 'react';
import { MessageSquare, Pencil, X } from 'lucide-react';
import { isSponsorableCategory, istMeinTicket } from '@/core/services/feedback';
import type { MeineIdentitaet } from '@/core/services/feedback';
import { EFFORT_LABELS } from '@/core/types/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
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
import { FeedbackVerwaltungBlock } from './FeedbackVerwaltungBlock';
import { FeedbackErgaenzenForm } from './FeedbackErgaenzenForm';

interface Props {
  ticket: FeedbackItem;
  config: FeedbackConfig;
  onClose: () => void;
  onChanged: () => void;
  meId?: string;
  meName?: string;
  /** Meine Identität — entscheidet, ob das Ticket mir gehört (feedbackIdentitaet). */
  ich: MeineIdentitaet;
  /** Ungelesene Team-Antwort auf dieses (eigene) Feedback beim Öffnen. */
  unread?: boolean;
  /** Neue Kommentare beim Öffnen → im Thread hervorgehoben. */
  neueKommentare?: number;
  /** Beim Öffnen als gesehen markieren (klärt Glocke + „Antwort"-Marker). */
  markSeen?: (ticket: FeedbackItem) => void;
  /** Verwaltungs-Block zeigen (Aufrufer entscheidet über `canManageFeedback`). */
  darfVerwalten?: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-2.5">{children}</p>
  );
}

export function FeedbackBoardDetail({ ticket, config, onClose, onChanged, meId, meName, ich, unread, neueKommentare, markSeen, darfVerwalten }: Props): React.ReactElement {
  const Icon = getLucideIcon(ticket.category ? CATEGORY_ICONS[ticket.category] : 'MessageCircle');
  const mine = istMeinTicket(ticket, ich);
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
  const [highlightKommentare] = useState(neueKommentare ?? 0);
  useEffect(() => { markSeen?.(ticket); }, [ticket, markSeen]);

  // „Ergänzen": nur auf Clients, die den Daten-Share schreiben können
  // (`darfVerwalten`) — read-only prod würde sonst lokal editieren, ohne dass es
  // beim Team ankommt. Dort bleibt der Kommentar-Thread.
  //
  // Seit v3.7 NICHT mehr auf den Autor beschränkt (Beta-Entscheidung): wer
  // Status, Team-Antwort und Löschen an fremden Tickets darf, darf auch deren
  // Text nachziehen. Fremd-Bearbeitungen setzen `updated_at` — damit gewinnt in
  // `mergeItems` der geteilte Stand, der lokale Altstand des Autors spielt die
  // alte Fassung also nicht zurück.
  const [bearbeiten, setBearbeiten] = useState(false);
  const darfErgaenzen = !!darfVerwalten;
  useEffect(() => { setBearbeiten(false); }, [ticket.id]);

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

        {/* Titel + Autor (+ „Ergänzen" für den Autor) */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 flex-1 text-[19px] font-medium text-[var(--tf-text)] leading-snug break-words">{feedbackTitle(ticket, Infinity)}</h2>
            {darfErgaenzen && !bearbeiten && (
              <button
                type="button"
                onClick={() => setBearbeiten(true)}
                title={mine
                  ? 'Eigenes Feedback ergänzen — Titel, Felder, weitere Anhänge'
                  : 'Ticket ergänzen — Titel, Felder, weitere Anhänge'}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-[var(--tf-radius)] text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer transition-colors"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <Pencil size={12} /> Ergänzen
              </button>
            )}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-tertiary)]">
            <FeedbackAvatar name={author} size={20} />
            <span className="truncate">
              von <span className="text-[var(--tf-text-secondary)]">{author}</span> · {formatShortDate(ticket.created_at)}
              {ticket.updated_at ? ` · bearbeitet ${formatShortDate(ticket.updated_at)}` : ''}
            </span>
          </p>
        </div>

        {/* Bearbeiten-Modus ersetzt die Felder-Anzeige unten */}
        {bearbeiten && (
          <FeedbackErgaenzenForm
            ticket={ticket}
            onFertig={() => setBearbeiten(false)}
            onChanged={onChanged}
          />
        )}

        {/* Fortschritt (dateloser Stepper) */}
        {!isPraise && (
          <div>
            <SectionLabel>Fortschritt</SectionLabel>
            <FeedbackStepper status={ticket.kurator_status} />
          </div>
        )}

        {/* Felder: alle Q&A ausgeschrieben (Lob als Zitat) — im Bearbeiten-Modus
            zeigt das Formular oben dieselben Werte editierbar. */}
        {!bearbeiten && segments.length > 0 && (
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
            <FeedbackCommentThread
              ticket={ticket}
              meId={meId}
              meName={meName}
              onChanged={onChanged}
              neueKommentare={highlightKommentare}
            />
          </div>
        </div>

        {/* Verwaltung — eingeklappt, damit das Panel für Verwalter nicht mit
            Formularfeldern aufmacht. Auf/Zu überlebt den Reload. */}
        {darfVerwalten && (
          <CollapsibleSection label="Verwaltung" storageKey="tf-feedback-board-verwaltung-offen">
            <FeedbackVerwaltungBlock
              ticket={ticket}
              config={config}
              onChanged={onChanged}
              onDeleted={onClose}
            />
          </CollapsibleSection>
        )}
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
