/**
 * Das Board (v3.12, Handoff feedback-redesign): eine Spalte je Status-Lane,
 * farbige Oberkante, Kopf mit Zähler und darunter die Summenzeile („384 h
 * geschätzt · 44 ungeschätzt") — der Triage-Blick, ohne eine Karte aufzuklappen.
 *
 * Zwei Abweichungen vom Handoff, beide aus dem Platzhaushalt (v3.19):
 * - Die Spalten sind mitwachsend (`flex`), nicht fest 262px. Neben dem
 *   Detail-Panel blieb sonst weniger als eine Spaltenbreite übrig.
 * - Eine LEERE Lane klappt zur Schmalschiene ein — dieselbe Lösung wie in der
 *   geteilten `KanbanBoard`-Shell, aus der das Feedback-Board kam. Sie bleibt
 *   ein vollwertiges Drop-Ziel: während eines Ziehens klappen alle Schienen
 *   auf (`.fb-board.zieht`), und ein Klick faltet eine einzelne dauerhaft aus.
 *
 * Je Spalte werden zunächst 15 Karten gerendert, der Rest hängt hinter „+ N
 * weitere". Bei 500 Tickets wären es sonst mehrere hundert DOM-Knoten je Spalte,
 * von denen niemand mehr als die ersten zehn sieht.
 *
 * Die Bahnen bilden die GANZE Pipeline ab, die aktive Sicht schneidet sie aber
 * zu: in „Alles offen" kann UMGESETZT nie etwas enthalten. Eine solche Bahn
 * sagt das (`ausserhalbDerSicht`), statt „0" zu melden — sonst sieht ein gerade
 * umgesetztes Ticket aus wie verloren (v3.39).
 */
import { useEffect, useState } from 'react';
import type { FeedbackLane } from '@/components/feedback/feedbackLanes';
import { STATUS_LABELS } from '@/components/feedback/constants';
import { feedbackLaneAccent } from '@/components/feedback/feedbackLanes';
import type { LaneFarbmodus } from '@/components/kanban/laneAccent';
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { baueSpalten, type BoardSpalte } from '../boardSpalten';
import type { Dichte } from './dichte';
import { TicketKarte } from './TicketKarte';
import type { TicketKontext } from './typen';

const START_LIMIT = 15;
const NACHLADE_SCHRITT = 25;

/** Die aktive Sicht, soweit das Board sie kennen muss: was sie zeigen kann, wie
 *  sie heißt und wie man sie verlässt. */
export interface BoardSicht {
  label: string;
  kannStatus: (status: FeedbackStatus) => boolean;
  zeigeAlle: () => void;
}

export function TicketBoard({ tickets, lanes, farbmodus, dichte, ctx, sicht }: {
  tickets: readonly FeedbackItem[];
  lanes: readonly FeedbackLane[];
  farbmodus: LaneFarbmodus;
  dichte: Dichte;
  ctx: TicketKontext;
  sicht?: BoardSicht;
}): React.ReactElement {
  const spalten = baueSpalten(tickets, lanes, sicht?.kannStatus);
  // Ein Ziehen irgendwo im Board faltet die leeren Schienen auf. `dragstart`
  // und `dragend` steigen auf — der Zustand gehört deshalb hierher und nicht
  // in jede einzelne Karte.
  const [zieht, setZieht] = useState(false);
  return (
    <div
      className={`fb-board${dichte ? ` ${dichte}` : ''}${zieht ? ' zieht' : ''}`}
      onDragStart={() => setZieht(true)}
      onDragEnd={() => setZieht(false)}
      onDrop={() => setZieht(false)}
    >
      {spalten.map((s, i) => (
        <Spalte
          key={s.status}
          spalte={s}
          akzent={feedbackLaneAccent(farbmodus, s.status, i)}
          ctx={ctx}
          sicht={sicht}
        />
      ))}
    </div>
  );
}

function Spalte({ spalte, akzent, ctx, sicht }: {
  spalte: BoardSpalte;
  akzent: string;
  ctx: TicketKontext;
  sicht?: BoardSicht;
}): React.ReactElement {
  const [limit, setLimit] = useState(START_LIMIT);
  const [ueber, setUeber] = useState(false);
  const [entfaltet, setEntfaltet] = useState(false);
  // Beim Wechsel der Sicht/Filter wieder oben anfangen — sonst zeigt eine frisch
  // gefilterte Spalte mit drei Treffern noch das aufgeklappte Limit von vorhin.
  useEffect(() => { setLimit(START_LIMIT); }, [spalte.tickets.length]);

  const rest = spalte.tickets.length - limit;
  const { stunden, ungeschaetzt } = spalte.summe;
  const aus = spalte.ausserhalbDerSicht;
  const name = STATUS_LABELS[spalte.status];
  // Eine unerreichbare Bahn bleibt IMMER Schiene: aufgeklappt zeigte sie eine
  // leere Spalte und behauptete damit erneut, hier sei nichts.
  const schiene = spalte.tickets.length === 0 && (aus || !entfaltet);
  // Klick: die erreichbar-leere Bahn klappt auf, die unerreichbare wechselt in
  // eine Sicht, die ihren Inhalt zeigt — das ist die Frage, die sie auslöst.
  const beiKlick = aus
    ? sicht?.zeigeAlle
    : (): void => setEntfaltet(true);

  return (
    <div
      className={`fb-col${schiene ? ' leer' : ''}${aus ? ' ausserhalb' : ''}${ueber ? ' ueber' : ''}`}
      role={schiene && beiKlick ? 'button' : undefined}
      tabIndex={schiene && beiKlick ? 0 : undefined}
      title={schiene
        ? (aus
          ? `${name} — die Sicht „${sicht?.label ?? ''}" zeigt diesen Status nicht. Klicken zeigt alle Tickets.`
          : `${name} — leer, zum Aufklappen klicken`)
        : undefined}
      onClick={schiene ? beiKlick : undefined}
      onKeyDown={schiene && beiKlick
        ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); beiKlick(); } }
        : undefined}
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
      {/* Die Schiene sitzt im SELBEN Knoten wie die volle Spalte — sonst hinge
          das Drop-Ziel an zwei Stellen und liefe auseinander. */}
      {schiene && (
        <span className="fb-schiene">
          <span className="fb-dot" />
          {name}
          {/* Kein „0" an der unerreichbaren Bahn: die Zahl beantwortete die
              Frage „wie viele sind umgesetzt?" mit der Antwort auf eine andere. */}
          {aus
            ? <span className="fb-aus">nicht in dieser Sicht</span>
            : <span className="fb-n">0</span>}
        </span>
      )}
      {!schiene && (
      <div className="fb-col-kopf">
        <span className="fb-typdot" style={{ background: akzent }} aria-hidden />
        <span className="fb-nm">{name}</span>
        <span className="fb-n">{spalte.tickets.length}</span>
      </div>
      )}
      {!schiene && (stunden > 0 || ungeschaetzt > 0) && (
        <div className="fb-col-summe">
          {stunden > 0 && <span>{stunden} h geschätzt</span>}
          {ungeschaetzt > 0 && <span>{ungeschaetzt} ungeschätzt</span>}
        </div>
      )}
      <div className="fb-col-karten">
        {/* Der Gedankenstrich gehört zur AUFGEKLAPPTEN Spalte. In der 44px-Schiene
            stand er unter der Beschriftung und sagte ein zweites Mal „nichts da". */}
        {spalte.tickets.length === 0 && !schiene && <div className="fb-col-leer">—</div>}
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
