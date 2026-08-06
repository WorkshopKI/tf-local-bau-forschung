/**
 * Detail-Panel (v3.12, Handoff feedback-redesign) — löst `FeedbackBoardDetail` ab.
 *
 * Die eine Änderung, um die es geht: die Verwaltungsfelder stehen als feste
 * Aktionsleiste DIREKT unter dem Kopf, nicht in einem eingeklappten Akkordeon am
 * Ende des Panels. Status, Aufwand, Zuständigkeit und Bereich sind damit einen
 * Klick entfernt statt vier.
 *
 * Rollenabhängig:
 * - Entwickler-Sicht: die vier Chips + weiter unten der Verwaltungs-Block mit den
 *   selten gebrauchten Feldern (Kategorie, Priorität, Team-Antwort, FAQ, Prompt).
 * - Nutzer-Sicht: Status-Pill im Kopf, Fortschritts-Stepper + Dauer-Streifen im
 *   Körper, und am eigenen Ticket „Ticket bearbeiten" bzw. „Ergänzung hinzufügen"
 *   samt Klartext-Hinweis, warum gerade das eine und nicht das andere gilt.
 *
 * Bringt eigenes Scrollen mit (das Detail-Pane des MasterDetailLayout ist
 * overflow-hidden).
 */
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, MessageSquare, Pencil, Plus, X } from 'lucide-react';
import { FEEDBACK_STATUS, isSponsorableCategory } from '@/core/services/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import {
  CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS, STATUS_DOT, STATUS_LABELS,
} from '@/components/feedback/constants';
import {
  feedbackAuthorLabel, feedbackNummer, feedbackQaSegments, feedbackTitle, formatShortDate, getLucideIcon,
} from '@/components/feedback/feedbackUi';
import { FeedbackAvatar } from '@/components/feedback/FeedbackAvatar';
import { FeedbackScreenshots } from '@/components/feedback/FeedbackScreenshots';
import { FeedbackFiles } from '@/components/feedback/FeedbackFiles';
import { FeedbackVotePill } from '@/components/feedback/FeedbackVotePill';
import { FeedbackCommentThread } from '@/components/feedback/FeedbackCommentThread';
import { FeedbackStepper } from '@/components/feedback/FeedbackStepper';
import { FeedbackSponsorPanel } from '@/components/feedback/FeedbackSponsorPanel';
import { FeedbackVerwaltungBlock } from '@/components/feedback/FeedbackVerwaltungBlock';
import { FeedbackErgaenzenForm } from '@/components/feedback/FeedbackErgaenzenForm';
import { InlineChip } from './InlineChip';
import { DauerStreifen } from './DauerStreifen';
import {
  AufwandIcon, ZustaendigIcon, aufwandChipLabel, aufwandMenue, bereichMenue, statusMenue,
  ticketBereichLabel, zustaendigMenue,
} from './chipMenues';
import type { TicketKontext } from './typen';

interface Props {
  t: FeedbackItem;
  ctx: TicketKontext;
  config: FeedbackConfig;
  meId?: string;
  meName?: string;
  onClose: () => void;
  onChanged: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** Ungelesene Team-Antwort beim Öffnen. */
  unread?: boolean;
  /** Neue Kommentare beim Öffnen → im Thread hervorgehoben. */
  neueKommentare?: number;
  markSeen?: (t: FeedbackItem) => void;
}

function Label({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="fb-d-label">{children}</div>;
}

export function TicketDetail({
  t, ctx, config, meId, meName, onClose, onChanged, onPrev, onNext, unread, neueKommentare, markSeen,
}: Props): React.ReactElement {
  const Icon = getLucideIcon(t.category ? CATEGORY_ICONS[t.category] : 'MessageCircle');
  const meins = ctx.istMeins(t);
  const autor = meins ? 'Du' : (feedbackAuthorLabel(t) ?? 'Unbekannt');
  const antwort = t.kurator_response?.trim();
  const segmente = feedbackQaSegments(t);
  const istLob = t.category === 'praise';
  const stimmen = t.votes?.length ?? 0;
  const dev = ctx.rolle === 'entwickler' && ctx.darfVerwalten;
  const typTint = t.category
    ? CATEGORY_COLORS[t.category]
    : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]';

  // Ungelesen-Zustand beim Öffnen einfrieren, damit die Hervorhebung sichtbar
  // bleibt, während markSeen die Glocke global klärt. Das Panel wird pro Ticket
  // gekeyt, der State startet also je Ticket frisch.
  const [antwortNeu] = useState(!!unread);
  const [kmtNeu] = useState(neueKommentare ?? 0);
  useEffect(() => { markSeen?.(t); }, [t, markSeen]);

  // Bearbeiten des Ticket-KOPFES (Titel/Felder/Anhänge).
  // Zwei Wege, bewusst getrennt:
  // - Verwalter dürfen jedes Ticket jederzeit nachziehen (seit v3.7).
  // - Der AUTOR darf sein eigenes Ticket ändern, solange es niemand angefasst
  //   hat (Status `neu`). Danach ist der Text die Bezugsgröße der Diskussion und
  //   bleibt stehen — Neues gehört als Ergänzung in den Verlauf.
  const [bearbeiten, setBearbeiten] = useState(false);
  useEffect(() => { setBearbeiten(false); }, [t.id]);
  const autorDarfEditieren = meins && t.kurator_status === FEEDBACK_STATUS.neu;
  const darfBearbeiten = ctx.darfVerwalten || autorDarfEditieren;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Kopf */}
      <div className="fb-d-kopf">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${typTint}`}>
          <Icon size={12} strokeWidth={1.75} aria-hidden />
          {t.category ? CATEGORY_LABELS[t.category] : 'Unklassifiziert'}
        </span>
        <span className="fb-nr">#{feedbackNummer(t)}</span>
        {/* Status als Pill nur in der Nutzer-Sicht: der Entwickler hat ihn
            gleich darunter als Chip, zweimal wäre er nur Rauschen. */}
        {!dev && !istLob && (
          <span className="fb-spill" style={{ '--fb-c': STATUS_DOT[t.kurator_status] } as React.CSSProperties}>
            <span className="fb-dot" aria-hidden />
            {STATUS_LABELS[t.kurator_status]}
          </span>
        )}
        <span className="ml-auto inline-flex gap-0.5">
          <button
            type="button"
            onClick={onPrev}
            disabled={!onPrev}
            title="Vorheriges Ticket"
            aria-label="Vorheriges Ticket"
            className="w-7 h-7 grid place-items-center rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!onNext}
            title="Nächstes Ticket"
            aria-label="Nächstes Ticket"
            className="w-7 h-7 grid place-items-center rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            <ChevronRight size={15} aria-hidden />
          </button>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="w-7 h-7 grid place-items-center rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          <X size={15} aria-hidden />
        </button>
      </div>

      {/* Aktionsleiste — ersetzt das eingeklappte „Verwaltung"-Akkordeon */}
      {dev ? (
        <div className="fb-d-aktionen">
          <InlineChip
            dot={STATUS_DOT[t.kurator_status]}
            label={STATUS_LABELS[t.kurator_status]}
            menue={schliessen => statusMenue(t, ctx, schliessen)}
          />
          <InlineChip
            icon={AufwandIcon}
            leer={!t.effort_estimate}
            label={aufwandChipLabel(t, true)}
            menue={schliessen => aufwandMenue(t, ctx, schliessen)}
          />
          <InlineChip
            icon={ZustaendigIcon}
            leer={!t.assignee}
            label={t.assignee ?? 'nicht zugewiesen'}
            menue={schliessen => zustaendigMenue(t, ctx, schliessen)}
          />
          <InlineChip
            klasse="bereich"
            label={ticketBereichLabel(t)}
            menue={schliessen => bereichMenue(t, ctx, schliessen)}
          />
        </div>
      ) : meins ? (
        <div className="fb-d-aktionen">
          {autorDarfEditieren ? (
            <button type="button" className="fb-abtn" onClick={() => setBearbeiten(true)}>
              <Pencil size={13} aria-hidden /> Ticket bearbeiten
            </button>
          ) : (
            <span className="fb-abtn leer" style={{ cursor: 'default' }}>
              <Plus size={13} aria-hidden /> Ergänzung unten anhängen
            </span>
          )}
          <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)]">
            {autorDarfEditieren
              ? 'Noch nicht angefasst — frei bearbeitbar.'
              : 'In Bearbeitung — Änderungen gehen als Ergänzung an das Team.'}
          </span>
        </div>
      ) : null}

      {/* Körper */}
      <div className="fb-d-body">
        <h2 className="fb-d-titel">{feedbackTitle(t, Infinity)}</h2>
        <div className="fb-d-meta">
          <FeedbackAvatar name={autor} size={20} />
          <b>{autor}</b>
          <span>· {formatShortDate(t.created_at)}</span>
          {t.updated_at && <span>· bearbeitet {formatShortDate(t.updated_at)}</span>}
          {stimmen > 0 && <span>· {stimmen} {stimmen === 1 ? 'Unterstützer' : 'Unterstützer'}</span>}
        </div>

        {bearbeiten ? (
          <div className="fb-d-block">
            <FeedbackErgaenzenForm
              ticket={t}
              nurLokal={!ctx.darfVerwalten}
              onFertig={() => setBearbeiten(false)}
              onChanged={onChanged}
            />
          </div>
        ) : (
          <div className="fb-d-block">
            <Label>
              Beschreibung
              {darfBearbeiten && (
                <button type="button" className="fb-edit" onClick={() => setBearbeiten(true)}>
                  <Pencil size={12} aria-hidden /> Bearbeiten
                </button>
              )}
            </Label>
            {istLob && segmente.length > 0 && !segmente[0]?.frage ? (
              <p className="text-[15px] italic leading-relaxed">„{segmente[0]?.antwort}"</p>
            ) : (
              <div className="space-y-3">
                {segmente.map((seg, i) => (
                  <div key={i}>
                    {seg.frage && (
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium mb-0.5">
                        {seg.frage}
                      </p>
                    )}
                    <p className="fb-d-text">{seg.antwort}</p>
                  </div>
                ))}
              </div>
            )}
            {meins && !autorDarfEditieren && !ctx.darfVerwalten && (
              <div className="fb-sperrhinweis">
                <Lock size={13} aria-hidden />
                <span>
                  Das Team arbeitet bereits daran — der ursprüngliche Text bleibt stehen.
                  Neues bitte unten als <b>Ergänzung</b> anhängen, dann sieht es der Entwickler.
                </span>
              </div>
            )}
          </div>
        )}

        {t.attachments && t.attachments.length > 0 && (
          <div className="fb-d-block">
            <Label>Anhänge</Label>
            <FeedbackScreenshots attachments={t.attachments} />
            <FeedbackFiles attachments={t.attachments} />
          </div>
        )}

        {/* Fortschritt + Dauer — die Antwort auf „was ist mit meinem Ticket?".
            Für den Entwickler überflüssig: er hat den Status als Chip oben. */}
        {!dev && !istLob && (
          <div className="fb-d-block">
            <Label>Fortschritt</Label>
            <FeedbackStepper status={t.kurator_status} />
            <DauerStreifen t={t} />
          </div>
        )}

        {antwort && (
          <div className="fb-d-block">
            <Label>Antwort vom Team</Label>
            <div
              className={`p-3 rounded-[var(--tf-radius-lg)] ${antwortNeu ? 'bg-[var(--tf-fb-problem-bg)]' : 'bg-[var(--tf-fb-idee-bg)]'}`}
              style={{ borderLeft: `2px solid ${antwortNeu ? 'var(--tf-fb-problem)' : 'var(--tf-fb-idee)'}` }}
            >
              {antwortNeu && (
                <p className="flex items-center gap-1.5 mb-1 text-[11px] font-medium text-[var(--tf-fb-problem)]">
                  <MessageSquare size={11} aria-hidden /> Neu
                </p>
              )}
              <p className="text-[12.5px] whitespace-pre-wrap leading-relaxed">{antwort}</p>
            </div>
          </div>
        )}

        {isSponsorableCategory(t.category) && t.effort_estimate && (
          <div className="fb-d-block">
            <Label>Sponsoring</Label>
            <FeedbackSponsorPanel ticket={t} config={config} meId={meId} onChanged={onChanged} />
          </div>
        )}

        <div className="fb-d-block">
          <FeedbackCommentThread
            ticket={t}
            meId={meId}
            meName={meName}
            onChanged={onChanged}
            neueKommentare={kmtNeu}
          />
        </div>

        {/* Die selten gebrauchten Felder bleiben eingeklappt am Ende: Kategorie,
            Priorität, interne Notiz, Team-Antwort, FAQ, Claude-Prompt, Löschen.
            Status und Aufwand sind daraus nach oben gewandert. */}
        {ctx.darfVerwalten && (
          <div className="fb-d-block">
            <CollapsibleSection label="Weitere Verwaltung" storageKey="tf-feedback-board-verwaltung-offen">
              <FeedbackVerwaltungBlock
                ticket={t}
                config={config}
                onChanged={onChanged}
                onDeleted={onClose}
              />
            </CollapsibleSection>
          </div>
        )}
      </div>

      {/* Fuß: budgetfreies „Ich auch"-Signal */}
      <div
        className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-t"
        style={{ borderColor: 'var(--tf-border)' }}
      >
        <FeedbackVotePill ticket={t} meId={meId} meName={meName} onChanged={onChanged} prominent />
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {stimmen === 1 ? 'Stimme' : 'Stimmen'} · zeigt dem Team die Nachfrage
        </span>
      </div>
    </div>
  );
}
