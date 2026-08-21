/**
 * Das `⋯`-Menü an Karte und Zeile — die Handgriffe, für die man bisher ins
 * Detail-Panel musste. Rollenabhängig: der Entwickler triagiert, der Nutzer
 * unterstützt und kommentiert.
 *
 * Zwei Auslöser, EIN Menü (v3.18): der `⋯`-Knopf und der Rechtsklick auf Karte
 * bzw. Zeile. Deshalb ist der Offen-Zustand nach außen gereicht — der Rechtsklick
 * gehört der Karte, das Menü hängt aber am Knopf. Bewusst kein zweites Menü über
 * Radix' `ContextMenu`: zwei Implementierungen desselben Inhalts laufen
 * auseinander, sobald jemand einen Eintrag nur an einer Stelle ergänzt.
 *
 * Der Schnell-Kommentar ersetzt den Menüinhalt im selben Popover, statt ein
 * zweites zu öffnen — der Weg zurück ist „Abbrechen", nicht ein verwaister Dialog.
 * Er nimmt seine Art (`kommentar` / `ergaenzung`) vom Menüeintrag mit, der ihn
 * geöffnet hat: bis v5.2 landeten beide Einträge im selben Modus und
 * unterschieden sich nur im Label.
 */
import { useEffect, useState } from 'react';
import {
  Archive, CircleCheck, Eye, MessageCircleQuestion, MessageSquare, MessageSquarePlus,
  MoreHorizontal, UserRound,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FEEDBACK_STATUS } from '@/core/services/feedback';
import { STATUS_LABELS } from '@/components/feedback/constants';
import { feedbackNummer } from '@/components/feedback/feedbackUi';
import type { FeedbackItem } from '@/core/types/feedback';
import { PopLabel, PopTrenner, PopZeile } from './InlineChip';
import { SchnellKommentar } from './SchnellKommentar';
import type { KommentarArt, TicketKontext } from './typen';

export function TicketMenue({ t, ctx, offen, setOffen }: {
  t: FeedbackItem;
  ctx: TicketKontext;
  offen: boolean;
  setOffen: (v: boolean) => void;
}): React.ReactElement {
  const [modus, setModus] = useState<'menue' | KommentarArt>('menue');
  // Beim Schließen zurück auf die Menü-Ansicht — sonst öffnet der nächste Klick
  // ein Textfeld, obwohl jemand das Menü erwartet.
  useEffect(() => { if (!offen) setModus('menue'); }, [offen]);

  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`fb-mehr${offen ? ' offen' : ''}`}
          aria-label={`Aktionen für Ticket ${feedbackNummer(t)}`}
          onClick={e => { e.stopPropagation(); setOffen(!offen); }}
        >
          <MoreHorizontal size={14} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={modus !== 'menue' ? 'w-[300px] p-[9px]' : 'w-auto min-w-[204px] p-[5px]'}
        onClick={e => e.stopPropagation()}
      >
        {modus !== 'menue' ? (
          <SchnellKommentar
            t={t}
            ctx={ctx}
            art={modus}
            zurueck={() => setModus('menue')}
            fertig={() => setOffen(false)}
          />
        ) : (
          <MenueInhalt
            t={t}
            ctx={ctx}
            schliessen={() => setOffen(false)}
            schreibe={setModus}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function MenueInhalt({ t, ctx, schliessen, schreibe }: {
  t: FeedbackItem;
  ctx: TicketKontext;
  schliessen: () => void;
  schreibe: (art: KommentarArt) => void;
}): React.ReactElement {
  const nummer = feedbackNummer(t);
  const darf = ctx.darfSchreiben;
  const mir = ctx.meineId;
  const meins = ctx.istMeins(t);

  return (
    <>
      <PopLabel>#{nummer}</PopLabel>
      {/* „Ergänzung" gehört dem EIGENEN Ticket — und zwar unabhängig von der
          Rolle (v5.2). Die Bedingung stand bis v4.129 auf `!meins` und bot den
          Eintrag ausgerechnet an fremden Tickets an; danach auf
          `!darfSchreiben && meins` und nahm ihn damit jedem weg, der zugleich
          verwalten darf — sein Schreibrecht nimmt ihm die Autorenrolle nicht. */}
      {meins && (
        <PopZeile
          label="Ergänzung anhängen"
          icon={MessageSquarePlus}
          onClick={() => schreibe('ergaenzung')}
        />
      )}
      <PopZeile label="Kommentar schreiben" icon={MessageSquare} onClick={() => schreibe('kommentar')} />
      {darf && mir && (
        <PopZeile
          label={t.assignee === mir ? 'Zuweisung aufheben' : 'Mir zuweisen'}
          icon={UserRound}
          onClick={() => {
            const ziel = t.assignee === mir ? undefined : mir;
            ctx.aendere(t, { assignee: ziel },
              ziel ? `#${nummer} dir zugewiesen` : `#${nummer} · Zuweisung aufgehoben`);
            schliessen();
          }}
        />
      )}
      {darf && (
        <PopZeile
          label="Als umgesetzt markieren"
          icon={CircleCheck}
          onClick={() => {
            ctx.aendere(t, { kurator_status: FEEDBACK_STATUS.umgesetzt },
              `#${nummer} → ${STATUS_LABELS.umgesetzt}`);
            schliessen();
          }}
        />
      )}
      {darf && (
        <PopZeile
          label="Rückfrage an den Ersteller"
          icon={MessageCircleQuestion}
          onClick={() => schreibe('rueckfrage')}
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
              ctx.aendere(t, { kurator_status: FEEDBACK_STATUS.archiviert }, `#${nummer} archiviert`);
              schliessen();
            }}
          />
        </>
      )}
      <PopTrenner />
      <PopZeile label="Details öffnen" icon={Eye} onClick={() => { ctx.oeffne(t); schliessen(); }} />
    </>
  );
}
