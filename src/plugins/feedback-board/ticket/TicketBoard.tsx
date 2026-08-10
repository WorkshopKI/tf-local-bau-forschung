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
 *   auf (`.fb-board.zieht`), und ein Klick faltet eine einzelne aus.
 *
 * Aufklappen ist umkehrbar (v3.41.1). Bis dahin war es eine Einbahnstraße: die
 * aufgeklappte leere Bahn verlor mit der Schiene auch ihren Klick, ihre Rolle
 * und ihren Titel — sie ließ sich nur noch durch Neuladen einklappen. Der Weg
 * zurück steht dort, wo der Blick in einer leeren Spalte landet: statt eines
 * stummen Gedankenstrichs trägt der Leer-Hinweis jetzt das Einklappen.
 *
 * Seit v3.43 gilt das für JEDE Bahn: ein Klick auf den Spaltenkopf legt auch
 * eine gefüllte auf die Schiene, damit die Nachbarn breiter lesbar werden. Sie
 * behält dabei ihre Zahl und bleibt Drop-Ziel — eingeklappt ist eine Sicht,
 * kein Ausblenden (das entscheidet weiterhin die Lane-Auswahl unter „Board
 * anpassen"). Der Zustand ist bewusst NICHT gespeichert: er beantwortet die
 * Frage „was schaue ich mir gerade an", nicht „wie soll mein Board aussehen".
 * Während eines Ziehens bleibt die von Hand eingeklappte Bahn schmal — sonst
 * spränge das Board bei jeder Karte in die Anordnung zurück, die man eben
 * verlassen hat.
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
import { PanelLeftClose } from 'lucide-react';
import type { FeedbackLane } from '@/components/feedback/feedbackLanes';
import { STATUS_LABELS } from '@/components/feedback/constants';
import { feedbackLaneAccent } from '@/components/feedback/feedbackLanes';
import type { LaneFarbmodus } from '@/components/kanban/laneAccent';
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { baueSpalten, istSchiene, spaltenAnsicht, type BoardSpalte, type SpaltenWunsch } from '../boardSpalten';
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
  const [wunsch, setWunsch] = useState<SpaltenWunsch>('auto');
  // Beim Wechsel der Sicht/Filter wieder oben anfangen — sonst zeigt eine frisch
  // gefilterte Spalte mit drei Treffern noch das aufgeklappte Limit von vorhin.
  useEffect(() => { setLimit(START_LIMIT); }, [spalte.tickets.length]);

  const rest = spalte.tickets.length - limit;
  const { stunden, ungeschaetzt } = spalte.summe;
  const aus = spalte.ausserhalbDerSicht;
  const name = STATUS_LABELS[spalte.status];
  const ansicht = spaltenAnsicht(spalte, wunsch);
  const schiene = istSchiene(ansicht);
  const zu = ansicht === 'voll-schiene';
  const anzahl = spalte.tickets.length;
  // Klick auf die Schiene: die von Hand eingeklappte Bahn geht zurück auf
  // Automatik, die erreichbar-leere klappt auf, und die unerreichbare wechselt
  // in eine Sicht, die ihren Inhalt zeigt — das ist die Frage, die sie auslöst.
  const beiKlick = aus
    ? sicht?.zeigeAlle
    : (): void => setWunsch(zu ? 'auto' : 'offen');

  // Was die Schiene über sich sagt: die unerreichbare nennt die Sicht, die
  // eingeklappte ihre Zahl, die leere ihre Leere. Alle drei nennen den Ausweg.
  let schienenTitel = `${name} — leer, zum Aufklappen klicken`;
  if (aus) {
    schienenTitel = `${name} — die Sicht „${sicht?.label ?? ''}" zeigt diesen Status nicht. Klicken zeigt alle Tickets.`;
  } else if (zu) {
    schienenTitel = `${name} — ${anzahl} ${anzahl === 1 ? 'Ticket' : 'Tickets'}, zum Aufklappen klicken`;
  }

  return (
    <div
      className={`fb-col${schiene ? ' leer' : ''}${zu ? ' zu' : ''}${aus ? ' ausserhalb' : ''}${ueber ? ' ueber' : ''}`}
      role={schiene && beiKlick ? 'button' : undefined}
      tabIndex={schiene && beiKlick ? 0 : undefined}
      title={schiene ? schienenTitel : undefined}
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
              Frage „wie viele sind umgesetzt?" mit der Antwort auf eine andere.
              Die von Hand eingeklappte Bahn trägt hier ihren echten Bestand —
              schmal heißt nicht leer. */}
          {aus
            ? <span className="fb-aus">nicht in dieser Sicht</span>
            : <span className="fb-n">{anzahl}</span>}
        </span>
      )}
      {/* Der Kopf IST der Einklapp-Schalter (v3.43): ein Ziel statt eines
          zusätzlichen Knopfs neben der Zahl, und dieselbe Geste wie auf der
          Schiene — dort klickt man die ganze Fläche, hier die ganze Zeile. */}
      {!schiene && (
      <button
        type="button"
        className="fb-col-kopf"
        title={`${name} — Spalte einklappen`}
        onClick={() => setWunsch('zu')}
      >
        <span className="fb-typdot" style={{ background: akzent }} aria-hidden />
        <span className="fb-nm">{name}</span>
        <span className="fb-n">{anzahl}</span>
        <PanelLeftClose className="fb-zu" size={13} aria-hidden />
      </button>
      )}
      {!schiene && (stunden > 0 || ungeschaetzt > 0) && (
        <div className="fb-col-summe">
          {stunden > 0 && <span>{stunden} h geschätzt</span>}
          {ungeschaetzt > 0 && <span>{ungeschaetzt} ungeschätzt</span>}
        </div>
      )}
      <div className="fb-col-karten">
        {/* Nur die von Hand aufgeklappte leere Bahn kommt hier an — und sie ist
            die einzige, aus der ohne diesen Knopf kein Weg zurückführt. */}
        {ansicht === 'leer-offen' && (
          <button
            type="button"
            className="fb-col-leer"
            title={`${name} — leer, zum Einklappen klicken`}
            onClick={() => setWunsch('auto')}
          >
            leer — einklappen
          </button>
        )}
        {/* Auf der Schiene bleiben die Karten aus dem DOM — sonst stünden bei
            einer eingeklappten Bahn 15 Karten in 44px Breite. */}
        {!schiene && spalte.tickets.slice(0, limit).map(t => (
          <TicketKarte key={t.id} t={t} ctx={ctx} />
        ))}
      </div>
      {!schiene && rest > 0 && (
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
