/**
 * Die Listenansicht (v3.12): sticky Spaltenkopf, 60 Zeilen auf einmal, der Rest
 * hinter „Weitere N laden".
 *
 * Der Container trägt `container-type: inline-size` (ticketsystem.css) — die
 * Spalten reagieren damit auf die Breite der LISTE, nicht auf die des Fensters.
 * Genau das ist der Fall, der zählt: sobald rechts das Detail-Panel aufgeht,
 * schrumpft die Liste, das Fenster nicht.
 */
import { useEffect, useState } from 'react';
import type { FeedbackItem } from '@/core/types/feedback';
import { TicketZeile } from './TicketZeile';
import type { TicketKontext } from './typen';

const SEITE = 60;

export function TicketListe({ tickets, ctx }: {
  tickets: readonly FeedbackItem[];
  ctx: TicketKontext;
}): React.ReactElement {
  const [limit, setLimit] = useState(SEITE);
  // Neue Filter/Sicht → wieder bei der ersten Seite anfangen.
  useEffect(() => { setLimit(SEITE); }, [tickets.length]);

  const rest = tickets.length - limit;

  return (
    <div className="fb-liste">
      <div className="fb-liste-kopf">
        {/* Platzhalter für die Auswahl-Checkbox der Zeile — ohne ihn stünden
            alle Überschriften um 25px gegen ihre Spalte versetzt. */}
        <span style={{ width: 15, flex: 'none' }} aria-hidden />
        <span className="fb-sp-typ">Typ</span>
        <span style={{ width: 44, flex: 'none' }}>Nr.</span>
        <span className="fb-sp-t">Ticket</span>
        <span className="fb-sp-s">Status</span>
        <span className="fb-sp-e">Aufwand</span>
        <span className="fb-sp-a">Ersteller</span>
        <span className="fb-sp-d">Bewegt</span>
        <span style={{ width: 22, flex: 'none' }} aria-hidden />
      </div>
      {tickets.slice(0, limit).map(t => (
        <TicketZeile key={t.id} t={t} ctx={ctx} />
      ))}
      {rest > 0 && (
        <button type="button" className="fb-mehr-laden" onClick={() => setLimit(l => l + SEITE)}>
          Weitere {Math.min(SEITE, rest)} von {rest} laden
        </button>
      )}
    </div>
  );
}
