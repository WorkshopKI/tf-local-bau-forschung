/**
 * Bulk-Leiste (v3.18) — erscheint, sobald mindestens ein Ticket markiert ist,
 * mittig über dem Arbeitsbereich.
 *
 * Dunkel abgesetzt, weil sie über dem Inhalt schwebt und kein Teil davon ist.
 * Jede Aktion nennt im Toast die Zahl der betroffenen Tickets und lässt sich
 * zurücknehmen — bei fünfzig Tickets ist das kein Komfort, sondern die
 * Voraussetzung dafür, dass man sich überhaupt traut.
 */
import { useState } from 'react';
import { Archive, ChevronDown, UserRound, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FEEDBACK_STATUS } from '@/core/services/feedback';
import { EFFORT_HOURS, EFFORT_LABELS, EFFORT_ORDER, type FeedbackItem } from '@/core/types/feedback';
import { STATUS_DOT, STATUS_LABELS } from '@/components/feedback/constants';
import { FEEDBACK_LANE_STATUS } from '@/components/feedback/feedbackLanes';
import { PopLabel, PopTrenner, PopZeile } from './InlineChip';
import type { TicketKontext } from './typen';

export function BulkLeiste({ gewaehlt, ctx, onLeeren }: {
  gewaehlt: readonly FeedbackItem[];
  ctx: TicketKontext;
  onLeeren: () => void;
}): React.ReactElement {
  const n = gewaehlt.length;
  const wieViele = `${n} ${n === 1 ? 'Ticket' : 'Tickets'}`;
  const andere = ctx.personen.filter(p => p !== ctx.meineId);

  // Zweiter Riegel neben der Sichtbarkeit (v4.129): die Leiste ändert bis zu
  // fünfzig Tickets auf einmal, inklusive „Archivieren". Sie darf nichts tun,
  // was die Karte darunter nicht auch dürfte.
  const anwenden = (patch: Parameters<TicketKontext['aendere']>[1], text: string): void => {
    if (!ctx.darfSchreiben) return;
    ctx.aendereViele(gewaehlt, patch, text);
    onLeeren();
  };

  return (
    <div className="fb-bulk" role="toolbar" aria-label="Aktionen für die Auswahl">
      <span className="fb-bulk-n">{n} ausgewählt</span>

      <BulkMenue label="Status">
        {schliessen => (
          <>
            <PopLabel>Status für {wieViele}</PopLabel>
            {FEEDBACK_LANE_STATUS.map(s => (
              <PopZeile
                key={s}
                label={STATUS_LABELS[s]}
                dot={STATUS_DOT[s]}
                onClick={() => {
                  anwenden({ kurator_status: s }, `${wieViele} → ${STATUS_LABELS[s]}`);
                  schliessen();
                }}
              />
            ))}
          </>
        )}
      </BulkMenue>

      <BulkMenue label="Aufwand">
        {schliessen => (
          <>
            <PopLabel>Aufwand für {wieViele}</PopLabel>
            {EFFORT_ORDER.map(e => (
              <PopZeile
                key={e}
                label={e}
                sub={EFFORT_LABELS[e]}
                onClick={() => {
                  anwenden(
                    { effort_estimate: e, effort_hours: EFFORT_HOURS[e] },
                    `${wieViele} · Aufwand ${e}`,
                  );
                  schliessen();
                }}
              />
            ))}
            <PopTrenner />
            <PopZeile
              label="Schätzung entfernen"
              onClick={() => {
                anwenden(
                  { effort_estimate: undefined, effort_hours: undefined },
                  `${wieViele} · Schätzung entfernt`,
                );
                schliessen();
              }}
            />
          </>
        )}
      </BulkMenue>

      <BulkMenue label="Zuweisen">
        {schliessen => (
          <>
            <PopLabel>Zuständig für {wieViele}</PopLabel>
            {ctx.meineId && (
              <PopZeile
                label="Mir zuweisen"
                icon={UserRound}
                onClick={() => {
                  anwenden({ assignee: ctx.meineId }, `${wieViele} dir zugewiesen`);
                  schliessen();
                }}
              />
            )}
            {andere.map(p => (
              <PopZeile
                key={p}
                label={p}
                onClick={() => { anwenden({ assignee: p }, `${wieViele} → ${p}`); schliessen(); }}
              />
            ))}
            <PopTrenner />
            <PopZeile
              label="Zuweisung aufheben"
              onClick={() => {
                anwenden({ assignee: undefined }, `${wieViele} · Zuweisung aufgehoben`);
                schliessen();
              }}
            />
          </>
        )}
      </BulkMenue>

      <button
        type="button"
        className="fb-bulk-b"
        onClick={() => anwenden(
          { kurator_status: FEEDBACK_STATUS.archiviert },
          `${wieViele} archiviert`,
        )}
      >
        <Archive size={13} aria-hidden /> Archivieren
      </button>

      <button type="button" className="fb-bulk-b fb-bulk-x" onClick={onLeeren} aria-label="Auswahl aufheben">
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

/** Kontrolliert wie der `InlineChip`: der Inhalt bekommt seinen eigenen
 *  Schließer, weil Radix beim Klick auf eine Menüzeile nicht von selbst zugeht. */
function BulkMenue({ label, children }: {
  label: string;
  children: (schliessen: () => void) => React.ReactNode;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button type="button" className="fb-bulk-b">
          {label}
          <ChevronDown size={11} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="w-auto min-w-[196px] p-[5px]">
        {children(() => setOffen(false))}
      </PopoverContent>
    </Popover>
  );
}
