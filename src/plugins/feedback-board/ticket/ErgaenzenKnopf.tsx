/**
 * „Ergänzung anhängen" direkt an der eigenen Kanban-Karte (v5.2).
 *
 * Der Weg gab es schon — im `⋯`-Menü, zwei Klicks tief und nur für Rollen ohne
 * Schreibrecht. Wer sein Ticket fortschreiben wollte, öffnete stattdessen das
 * Detail-Panel und bekam die ganze Akte: Kopf, Chips, Stepper, Beschreibung,
 * Verlauf, Sponsoring. Dieser Knopf ist dieselbe Mechanik mit einem Klick und
 * ohne Seitenwechsel — das Board bleibt stehen, das Detail bleibt zu.
 *
 * Bewusst ein eigenes Popover statt eines zweiten Modus im `⋯`-Menü: Radix'
 * Popover hat genau einen Trigger, und zwei Trigger an einem Popover wären ein
 * gemeinsamer Offen-Zustand für zwei verschiedene Absichten. Der Inhalt ist
 * derselbe geteilte Baustein.
 */
import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FeedbackBeitragFeld } from '@/components/feedback/FeedbackBeitragFeld';
import { feedbackNummer } from '@/components/feedback/feedbackUi';
import type { FeedbackItem } from '@/core/types/feedback';
import { bausteineFuer } from './bausteine';
import type { TicketKontext } from './typen';

export function ErgaenzenKnopf({ t, ctx }: {
  t: FeedbackItem;
  ctx: TicketKontext;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);

  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`fb-erg${offen ? ' offen' : ''}`}
          aria-label={`Ergänzung zu Ticket ${feedbackNummer(t)} anhängen`}
          title="Ergänzung anhängen"
          // Karte und Zeile öffnen auf Klick das Detail — genau das soll hier
          // nicht passieren.
          onClick={e => { e.stopPropagation(); setOffen(!offen); }}
        >
          <MessageSquarePlus size={14} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-[9px]" onClick={e => e.stopPropagation()}>
        <div className="fb-pop-lbl" style={{ padding: '0 0 6px' }}>
          Ergänzung · #{feedbackNummer(t)}
        </div>
        <FeedbackBeitragFeld
          bausteine={bausteineFuer(false, true)}
          platzhalter="Was möchtest du ergänzen?"
          primaerArt="ergaenzung"
          primaerLabel="Ergänzung anhängen"
          autofokus
          aufEscape={() => setOffen(false)}
          // Geschlossen wird erst nach bestätigtem Schreiben — sonst wäre der
          // Text mit dem Popover verschwunden.
          senden={async (text, art) => {
            const ok = await ctx.kommentiere(t, text, art);
            if (ok) setOffen(false);
            return ok;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
