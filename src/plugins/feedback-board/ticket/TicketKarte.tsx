/**
 * Board-Karte (v3.12, Handoff feedback-redesign).
 *
 * Aufbau von oben nach unten:
 *   [Typ-Punkt] #Handle  [Antwort]              ⋯
 *   Titel (max. 3 Zeilen)
 *   [Screenshot 48px]
 *   (Bereich) (⏱ Aufwand) (👤 Zuständig)
 *   ── Avatar Name          ↑7  💬2  vor 3 Tagen
 *
 * Der Typ ist ein 8px-Punkt, keine Icon-Kachel: die Kachel kostete eine ganze
 * Zeile Höhe, und bei 15 Karten je Spalte entscheidet Höhe darüber, wie viel man
 * ohne Scrollen sieht.
 */
import { useState } from 'react';
// `ThumbsUp` und nicht `ArrowUp`: dieselbe Bedeutung wie in der interaktiven
// `FeedbackVotePill` im Detail-Panel („Hilfreich / Ich auch"). Zwei Glyphen für
// eine Aussage lesen sich als zwei Metriken. `ArrowUp` ist app-weit ein
// Richtungs-/Sortierpfeil.
import { MessageSquare, ThumbsUp } from 'lucide-react';
import type { FeedbackItem } from '@/core/types/feedback';
import type { TfBoardZiehProps } from '@/components/kanban/tf-board-types';
import { CATEGORY_DOT, CATEGORY_LABELS } from '@/components/feedback/constants';
import { FeedbackAvatar } from '@/components/feedback/FeedbackAvatar';
import { FeedbackScreenshots } from '@/components/feedback/FeedbackScreenshots';
import { FeedbackCommentHover } from '@/components/feedback/FeedbackCommentHover';
import { FeedbackAntwortHover } from '@/components/feedback/FeedbackAntwortHover';
import { feedbackAuthorLabel, feedbackNummer, feedbackTitle, formatShortDate } from '@/components/feedback/feedbackUi';
import { AuswahlHaken, InlineChip } from './InlineChip';
import { TicketMenue } from './TicketMenue';
import {
  AufwandIcon, ZustaendigIcon, aufwandChipLabel, aufwandMenue, ticketBereichLabel, zustaendigMenue,
} from './chipMenues';
import type { TicketKontext } from './typen';

/**
 * `zieh` kommt vom Board-Primitiv und wird nur gespreizt: heute steckt darin
 * `draggable` + `onDragStart`, später möglicherweise `ref`/`listeners` einer
 * Bibliothek. Die Karte schreibt selbst NIE in `dataTransfer` — sonst hinge die
 * Ziehmechanik an zwei Stellen (Guard `no-parallel-board-dnd`).
 */
export function TicketKarte({ t, ctx, zieh }: {
  t: FeedbackItem;
  ctx: TicketKontext;
  zieh?: TfBoardZiehProps;
}): React.ReactElement {
  const [menueOffen, setMenueOffen] = useState(false);
  const meins = ctx.istMeins(t);
  const gewaehlt = ctx.auswahl.has(t.id);
  const ungelesen = ctx.istUngelesen(t);
  const neueKmt = ctx.neueKommentare(t);
  const autor = feedbackAuthorLabel(t);
  const stimmen = t.votes?.length ?? 0;
  const kommentare = t.comments?.length ?? 0;
  // Schreiben darf nur, wer das Recht hat UND gerade die Entwickler-Sicht sieht
  // (die Vorschau soll zeigen, was der Ersteller sieht — inklusive „nicht änderbar").
  const darf = ctx.darfVerwalten && ctx.rolle === 'entwickler';

  return (
    <div
      className={[
        'fb-karte',
        meins ? 'meins' : '',
        ctx.offeneId === t.id ? 'aktiv' : '',
        gewaehlt ? 'gewaehlt' : '',
      ].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      {...zieh}
      onClick={() => ctx.oeffne(t)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.oeffne(t); } }}
      onContextMenu={e => { e.preventDefault(); setMenueOffen(true); }}
    >
      <div className="fb-karte-kopf">
        <AuswahlHaken
          gewaehlt={gewaehlt}
          label={`Ticket ${feedbackNummer(t)} auswählen`}
          onToggle={() => ctx.schalteAuswahl(t.id)}
        />
        <span
          className="fb-typdot"
          style={{ background: t.category ? CATEGORY_DOT[t.category] : 'var(--tf-text-tertiary)' }}
          title={t.category ? CATEGORY_LABELS[t.category] : 'Unklassifiziert'}
          aria-hidden
        />
        <span className="fb-nr">#{feedbackNummer(t)}</span>
        {t.kurator_response && (
          <FeedbackAntwortHover antwort={t.kurator_response} ungelesen={ungelesen && meins}>
            <span className={`fb-antwort${ungelesen && meins ? '' : ' neutral'}`}>Antwort</span>
          </FeedbackAntwortHover>
        )}
        <TicketMenue t={t} ctx={ctx} offen={menueOffen} setOffen={setMenueOffen} />
      </div>

      <div className="fb-titel">{feedbackTitle(t)}</div>

      {t.attachments && t.attachments.length > 0 && (
        <div className="fb-thumb">
          <FeedbackScreenshots attachments={t.attachments} variant="board" />
        </div>
      )}

      <div className="fb-chips">
        <InlineChip klasse="bereich" label={ticketBereichLabel(t)} />
        <InlineChip
          icon={AufwandIcon}
          leer={!t.effort_estimate}
          label={aufwandChipLabel(t, false)}
          menue={darf ? (schliessen => aufwandMenue(t, ctx, schliessen)) : undefined}
        />
        {darf && (
          <InlineChip
            icon={ZustaendigIcon}
            leer={!t.assignee}
            label={t.assignee ?? 'frei'}
            menue={schliessen => zustaendigMenue(t, ctx, schliessen)}
          />
        )}
      </div>

      <div className="fb-fuss">
        <FeedbackAvatar name={autor ?? '—'} size={18} />
        <span className="fb-wer">{meins ? 'Du' : (autor ?? '—')}</span>
        <span className="fb-met">
          {stimmen > 0 && <span title={`${stimmen} Unterstützer`}><ThumbsUp size={11} aria-hidden />{stimmen}</span>}
          {kommentare > 0 && (
            <FeedbackCommentHover comments={t.comments ?? []} neueKommentare={neueKmt}>
              <span title={undefined}><MessageSquare size={11} aria-hidden />{kommentare}</span>
            </FeedbackCommentHover>
          )}
          <span>{formatShortDate(t.updated_at ?? t.created_at)}</span>
        </span>
      </div>
    </div>
  );
}
