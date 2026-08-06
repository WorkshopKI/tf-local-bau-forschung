/**
 * Das `⋯`-Menü an Karte und Zeile (v3.12) — die Handgriffe, für die man bisher
 * ins Detail-Panel musste. Rollenabhängig: der Entwickler triagiert, der Nutzer
 * unterstützt und kommentiert.
 *
 * E1 deckt die Aktionen ab, die genau ein Ticket betreffen. Der Rechtsklick als
 * zweiter Auslöser und der Schnell-Kommentar im Popover folgen in E2 — hier
 * bleibt „Details öffnen" der Weg zum Kommentarfeld.
 */
import { useState } from 'react';
import { Archive, CircleCheck, Eye, MessageCircleQuestion, MoreHorizontal, UserRound } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FEEDBACK_STATUS } from '@/core/services/feedback';
import { STATUS_LABELS } from '@/components/feedback/constants';
import { feedbackNummer } from '@/components/feedback/feedbackUi';
import type { FeedbackItem } from '@/core/types/feedback';
import { PopLabel, PopTrenner, PopZeile } from './InlineChip';
import type { TicketKontext } from './typen';

export function TicketMenue({ t, ctx }: { t: FeedbackItem; ctx: TicketKontext }): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const nummer = feedbackNummer(t);
  const schliessen = (): void => setOffen(false);
  const darf = ctx.darfVerwalten && ctx.rolle === 'entwickler';
  const mir = ctx.meineId;

  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`fb-mehr${offen ? ' offen' : ''}`}
          aria-label={`Aktionen für Ticket ${nummer}`}
          onClick={e => e.stopPropagation()}
        >
          <MoreHorizontal size={14} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto min-w-[204px] p-[5px]"
        onClick={e => e.stopPropagation()}
      >
        <PopLabel>#{nummer}</PopLabel>
        {darf && mir && (
          <PopZeile
            label={t.assignee === mir ? 'Zuweisung aufheben' : 'Mir zuweisen'}
            icon={UserRound}
            onClick={() => {
              const ziel = t.assignee === mir ? undefined : mir;
              ctx.aendere(
                t,
                { assignee: ziel },
                ziel ? `#${nummer} dir zugewiesen` : `#${nummer} · Zuweisung aufgehoben`,
              );
              schliessen();
            }}
          />
        )}
        {darf && (
          <PopZeile
            label="Als umgesetzt markieren"
            icon={CircleCheck}
            onClick={() => {
              ctx.aendere(
                t,
                { kurator_status: FEEDBACK_STATUS.umgesetzt },
                `#${nummer} → ${STATUS_LABELS.umgesetzt}`,
              );
              schliessen();
            }}
          />
        )}
        {darf && (
          <PopZeile
            label="Auf Rückfrage setzen"
            icon={MessageCircleQuestion}
            onClick={() => {
              ctx.aendere(
                t,
                { kurator_status: FEEDBACK_STATUS.rueckfrage },
                `#${nummer} → ${STATUS_LABELS.rueckfrage}`,
              );
              schliessen();
            }}
          />
        )}
        {darf && (
          <>
            <PopTrenner />
            <PopZeile
              label="Archivieren"
              icon={Archive}
              gefahr
              onClick={() => {
                ctx.aendere(
                  t,
                  { kurator_status: FEEDBACK_STATUS.archiviert },
                  `#${nummer} archiviert`,
                );
                schliessen();
              }}
            />
            <PopTrenner />
          </>
        )}
        <PopZeile
          label="Details öffnen"
          icon={Eye}
          onClick={() => { ctx.oeffne(t); schliessen(); }}
        />
      </PopoverContent>
    </Popover>
  );
}
