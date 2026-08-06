/**
 * Das Board (v3.12, Handoff feedback-redesign): eine Spalte je Status-Lane,
 * 262px breit, farbige Oberkante, Kopf mit Zähler und darunter die Summenzeile
 * („384 h geschätzt · 44 ungeschätzt") — der Triage-Blick, ohne eine Karte
 * aufzuklappen.
 *
 * Je Spalte werden zunächst 15 Karten gerendert, der Rest hängt hinter „+ N
 * weitere". Bei 500 Tickets wären es sonst mehrere hundert DOM-Knoten je Spalte,
 * von denen niemand mehr als die ersten zehn sieht.
 */
import { useEffect, useState } from 'react';
import type { FeedbackLane } from '@/components/feedback/feedbackLanes';
import { STATUS_LABELS } from '@/components/feedback/constants';
import { feedbackLaneAccent } from '@/components/feedback/feedbackLanes';
import type { LaneFarbmodus } from '@/components/kanban/laneAccent';
import type { FeedbackItem } from '@/core/types/feedback';
import { baueSpalten, type BoardSpalte } from '../boardSpalten';
import type { Dichte } from './dichte';
import { TicketKarte } from './TicketKarte';
import type { TicketKontext } from './typen';

const START_LIMIT = 15;
const NACHLADE_SCHRITT = 25;

export function TicketBoard({ tickets, lanes, farbmodus, dichte, ctx }: {
  tickets: readonly FeedbackItem[];
  lanes: readonly FeedbackLane[];
  farbmodus: LaneFarbmodus;
  dichte: Dichte;
  ctx: TicketKontext;
}): React.ReactElement {
  const spalten = baueSpalten(tickets, lanes);
  return (
    <div className={`fb-board${dichte ? ` ${dichte}` : ''}`}>
      {spalten.map((s, i) => (
        <Spalte
          key={s.status}
          spalte={s}
          akzent={feedbackLaneAccent(farbmodus, s.status, i)}
          ctx={ctx}
        />
      ))}
    </div>
  );
}

function Spalte({ spalte, akzent, ctx }: {
  spalte: BoardSpalte;
  akzent: string;
  ctx: TicketKontext;
}): React.ReactElement {
  const [limit, setLimit] = useState(START_LIMIT);
  const [ueber, setUeber] = useState(false);
  // Beim Wechsel der Sicht/Filter wieder oben anfangen — sonst zeigt eine frisch
  // gefilterte Spalte mit drei Treffern noch das aufgeklappte Limit von vorhin.
  useEffect(() => { setLimit(START_LIMIT); }, [spalte.tickets.length]);

  const rest = spalte.tickets.length - limit;
  const { stunden, ungeschaetzt } = spalte.summe;

  return (
    <div
      className={`fb-col${ueber ? ' ueber' : ''}`}
      style={{ '--fb-c': akzent } as React.CSSProperties}
      onDragOver={e => {
        if (!ctx.darfZiehen) return;
        // Ohne preventDefault lehnt der Browser den Drop ab — das ist die
        // Zusage „hier darf abgelegt werden", nicht bloß Kosmetik.
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setUeber(true);
      }}
      onDragLeave={e => {
        // Nur reagieren, wenn der Zeiger die Spalte wirklich verlässt: das
        // Überfahren einer Karte darin feuert sonst ein dragleave je Kind.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setUeber(false);
      }}
      onDrop={e => {
        e.preventDefault();
        setUeber(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) ctx.ziehePer(id, spalte.status);
      }}
    >
      <div className="fb-col-kopf">
        <span className="fb-typdot" style={{ background: akzent }} aria-hidden />
        <span className="fb-nm">{STATUS_LABELS[spalte.status]}</span>
        <span className="fb-n">{spalte.tickets.length}</span>
      </div>
      {(stunden > 0 || ungeschaetzt > 0) && (
        <div className="fb-col-summe">
          {stunden > 0 && <span>{stunden} h geschätzt</span>}
          {ungeschaetzt > 0 && <span>{ungeschaetzt} ungeschätzt</span>}
        </div>
      )}
      <div className="fb-col-karten">
        {spalte.tickets.length === 0 && <div className="fb-col-leer">—</div>}
        {spalte.tickets.slice(0, limit).map(t => (
          <TicketKarte key={t.id} t={t} ctx={ctx} />
        ))}
      </div>
      {rest > 0 && (
        <button
          type="button"
          className="fb-col-mehr"
          onClick={() => setLimit(l => l + NACHLADE_SCHRITT)}
        >
          + {rest} weitere
        </button>
      )}
    </div>
  );
}
