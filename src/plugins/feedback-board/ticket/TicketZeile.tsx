/**
 * Listenzeile (v3.12) — dieselben Daten wie die Karte, aber in Spalten:
 * Typ · Nr. · Ticket (Titel + „Bereich · Text") · Status · Aufwand · Ersteller ·
 * Bewegt · ⋯
 *
 * Die Spalten fallen bei schmalem Container in fester Prioritätsreihenfolge weg
 * (Container-Query in ticketsystem.css) — sobald das Detail-Panel aufgeht,
 * bleibt der Titel und geht zuletzt.
 */
import { useState } from 'react';
import type { FeedbackItem } from '@/core/types/feedback';
import {
  CATEGORY_COLORS, CATEGORY_DOT, CATEGORY_LABELS, STATUS_DOT, STATUS_LABELS,
} from '@/components/feedback/constants';
import { FeedbackAvatar } from '@/components/feedback/FeedbackAvatar';
import { feedbackAuthorLabel, feedbackNummer, feedbackTitle, formatShortDate } from '@/components/feedback/feedbackUi';
import { AuswahlHaken, InlineChip } from './InlineChip';
import { TicketMenue } from './TicketMenue';
import { aufwandMenue, statusMenue, ticketBereichLabel } from './chipMenues';
import type { TicketKontext } from './typen';

/** Kurzvorschau: der Fließtext in einer Zeile, Umbrüche werden zu Leerzeichen. */
function einzeilig(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function TicketZeile({ t, ctx }: { t: FeedbackItem; ctx: TicketKontext }): React.ReactElement {
  const [menueOffen, setMenueOffen] = useState(false);
  const meins = ctx.istMeins(t);
  const gewaehlt = ctx.auswahl.has(t.id);
  const autor = feedbackAuthorLabel(t);
  const darf = ctx.darfSchreiben;

  return (
    <div
      className={[
        'fb-zeile',
        meins ? 'meins' : '',
        ctx.offeneId === t.id ? 'aktiv' : '',
        gewaehlt ? 'gewaehlt' : '',
      ].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      onClick={() => ctx.oeffne(t)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.oeffne(t); } }}
      onContextMenu={e => { e.preventDefault(); setMenueOffen(true); }}
    >
      {/* Nur mit Schreibrecht — siehe `TicketKarte`. */}
      {darf && (
        <AuswahlHaken
          gewaehlt={gewaehlt}
          label={`Ticket ${feedbackNummer(t)} auswählen`}
          onToggle={() => ctx.schalteAuswahl(t.id)}
        />
      )}
      {/* Der Typ als beschriftetes Badge, nicht als bloßer Punkt: vier
          Farbpunkte nebeneinander sind in einer langen Liste nicht
          auseinanderzuhalten, und die Bedeutung stünde nur im Tooltip. */}
      <span className="fb-sp-typ">
        <span className={`fb-typ ${t.category ? CATEGORY_COLORS[t.category] : 'fb-typ-leer'}`}>
          <span
            className="fb-typdot"
            style={{ background: t.category ? CATEGORY_DOT[t.category] : 'var(--tf-text-tertiary)' }}
            aria-hidden
          />
          {t.category ? CATEGORY_LABELS[t.category] : 'Offen'}
        </span>
      </span>
      <span className="fb-nr" style={{ width: 44, flex: 'none' }}>#{feedbackNummer(t)}</span>

      <div className="fb-sp-t">
        <div className="fb-z-titel">
          {feedbackTitle(t)}
          {t.kurator_response && ctx.istUngelesen(t) && meins && (
            <span className="fb-antwort" style={{ marginLeft: 8 }}>Antwort</span>
          )}
        </div>
        <div className="fb-z-sub">{ticketBereichLabel(t)} · {einzeilig(t.text)}</div>
      </div>

      <div className="fb-sp-s">
        <InlineChip
          dot={STATUS_DOT[t.kurator_status]}
          label={STATUS_LABELS[t.kurator_status]}
          menue={darf ? (schliessen => statusMenue(t, ctx, schliessen)) : undefined}
        />
      </div>

      <div className="fb-sp-e">
        <InlineChip
          leer={!t.effort_estimate}
          label={t.effort_estimate ?? '—'}
          menue={darf ? (schliessen => aufwandMenue(t, ctx, schliessen)) : undefined}
        />
      </div>

      <div className="fb-sp-a">
        <FeedbackAvatar name={autor ?? '—'} size={18} />
        <span className="truncate">{meins ? 'Du' : (autor ?? '—')}</span>
      </div>

      <div className="fb-sp-d">{formatShortDate(t.updated_at ?? t.created_at)}</div>

      <TicketMenue t={t} ctx={ctx} offen={menueOffen} setOffen={setMenueOffen} />
    </div>
  );
}
