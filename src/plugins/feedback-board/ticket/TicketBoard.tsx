/**
 * Das Feedback-Board als Aufrufer des Board-Primitivs (`TfBoard`).
 *
 * Diese Datei entscheidet nur noch, WAS in einer Bahn steht — welche Karte in
 * welchen Status gehört, was die Summenzeile sagt, wann eine Bahn für die aktive
 * Sicht unerreichbar ist und wer ziehen darf. Wie eine Bahn aussieht, wann sie
 * zur Schmalschiene einklappt und wie ein Drop funktioniert, steht seit v3.45 in
 * `@/components/kanban` — vorher stand es hier ein zweites Mal neben der
 * geteilten Shell, mit eigenen Zahlen und ohne die 1|2-Kartenspalten, die das
 * Popover „Board anpassen" seit v3.12 anbietet und persistiert.
 *
 * Was dadurch NEU wirkt: die gewählte Spaltenzahl. Alles andere ist derselbe
 * Bestand an Verhalten wie in v3.44 (Einklappen je Bahn, Sicht-Zuschnitt,
 * Nachladen in 25er-Schritten, Ziehen mit Mehrfachauswahl).
 *
 * Die Bahnen bilden die GANZE Pipeline ab, die aktive Sicht schneidet sie aber
 * zu: in „Alles offen" kann UMGESETZT nie etwas enthalten. Eine solche Bahn sagt
 * das (`unerreichbar`), statt „0" zu melden — sonst sieht ein gerade umgesetztes
 * Ticket aus wie verloren (v3.39).
 */
import { STATUS_LABELS } from '@/components/feedback/constants';
import { feedbackLaneAccent, type FeedbackLane } from '@/components/feedback/feedbackLanes';
import type { LaneFarbmodus } from '@/components/kanban/laneAccent';
import { TfBoard } from '@/components/kanban/TfBoard';
import type { TfBoardBahn, TfBoardDnd } from '@/components/kanban/tf-board-types';
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { baueSpalten, zaehleOhneBahn } from '../boardSpalten';
import type { Dichte } from './dichte';
import { TicketKarte } from './TicketKarte';
import type { TicketKontext } from './typen';

/** Je Bahn zunächst 15 Karten, der Rest hinter „+ N weitere". Bei 500 Tickets
 *  wären es sonst mehrere hundert DOM-Knoten je Bahn, von denen niemand mehr als
 *  die ersten zehn sieht. */
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
  // Ausgeblendete Bahnen nehmen ihre Karten mit — das ist gewollt, aber der
  // Ergebniszähler über dem Board zählt sie weiter mit. Ohne diese Zeile stand
  // dort „42 von 42", während das Board 32 Karten zeigte (v4.129).
  const ohneBahn = zaehleOhneBahn(tickets, lanes);

  const bahnen = spalten.map((s, i): TfBoardBahn<FeedbackItem> => {
    const name = STATUS_LABELS[s.status];
    const { stunden, ungeschaetzt } = s.summe;
    return {
      key: s.status,
      label: name,
      accent: feedbackLaneAccent(farbmodus, s.status, i),
      items: s.tickets,
      spalten: s.spalten,
      // Der Triage-Blick, ohne eine Karte aufzuklappen.
      zusatz: stunden > 0 || ungeschaetzt > 0
        ? (
          <>
            {stunden > 0 && <span>{stunden} h geschätzt</span>}
            {ungeschaetzt > 0 && <span>{ungeschaetzt} ungeschätzt</span>}
          </>
        )
        : undefined,
      unerreichbar: s.ausserhalbDerSicht
        ? {
          hinweis: 'nicht in dieser Sicht',
          titel: `${name} — die Sicht „${sicht?.label ?? ''}" zeigt diesen Status nicht. Klicken zeigt alle Tickets.`,
          onKlick: sicht?.zeigeAlle,
        }
        : undefined,
    };
  });

  // Der Bahn-Schlüssel ist für das Primitiv eine Zeichenkette; hier bekommt er
  // seinen Status zurück. Ein Nachschlagen statt einer Typzusicherung: ein
  // fremder Schlüssel fällt so heraus, statt als Status durchgereicht zu werden.
  const statusZuKey = new Map<string, FeedbackStatus>(spalten.map(s => [s.status, s.status]));

  // Ziehen gibt es nur mit Schreibrecht in der Entwickler-Sicht — das Recht ist
  // board-weit, deshalb entscheidet es über die Naht als Ganzes. Die Regel „eine
  // markierte Karte nimmt die ganze Auswahl mit" bleibt in `ziehePer`.
  const dnd: TfBoardDnd<FeedbackItem> | undefined = ctx.darfZiehen
    ? {
      idOf: t => t.id,
      onDrop: (id, key) => {
        const ziel = statusZuKey.get(key);
        if (ziel) ctx.ziehePer(id, ziel);
      },
    }
    : undefined;

  return (
    <>
      <TfBoard
        label="Tickets nach Status"
        className={`fb-board${dichte ? ` ${dichte}` : ''}`}
        bahnen={bahnen}
        features={{ einklappbar: true, bahnScrollt: true }}
        nachladen={{ start: START_LIMIT, schritt: NACHLADE_SCHRITT }}
        dnd={dnd}
        renderCard={(t, _bahn, zieh) => <TicketKarte key={t.id} t={t} ctx={ctx} zieh={zieh} />}
      />
      {ohneBahn > 0 && (
        <p className="shrink-0 px-3 py-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
          {ohneBahn} {ohneBahn === 1 ? 'Ticket steht' : 'Tickets stehen'} in einer ausgeblendeten
          Spalte und {ohneBahn === 1 ? 'ist' : 'sind'} hier nicht zu sehen — die Listenansicht zeigt
          {ohneBahn === 1 ? ' es' : ' sie'}.
        </p>
      )}
    </>
  );
}
