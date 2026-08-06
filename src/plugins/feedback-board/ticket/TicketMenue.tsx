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
 */
import { useEffect, useRef, useState } from 'react';
import {
  Archive, CircleCheck, Eye, MessageCircleQuestion, MessageSquare, MoreHorizontal, Send, UserRound,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { FEEDBACK_STATUS } from '@/core/services/feedback';
import { STATUS_LABELS } from '@/components/feedback/constants';
import { feedbackNummer } from '@/components/feedback/feedbackUi';
import type { FeedbackItem } from '@/core/types/feedback';
import { PopLabel, PopTrenner, PopZeile } from './InlineChip';
import type { KommentarArt, TicketKontext } from './typen';

/** Textbausteine — sie sparen nicht das Denken, sondern den Anfang. */
const BAUSTEINE_DEV: ReadonlyArray<readonly [string, string]> = [
  ['Umsetzung', 'Umsetzung: '],
  ['Rückfrage', 'Kurze Rückfrage, bevor ich anfange: '],
  ['Erledigt', 'Ist umgesetzt und ab dem nächsten Release verfügbar. '],
  ['Nicht möglich', 'Das lässt sich so nicht umsetzen, weil '],
];
const BAUSTEINE_NUTZER: ReadonlyArray<readonly [string, string]> = [
  ['Ergänzung', 'Ergänzung: '],
  ['Antwort', ''],
];

export function TicketMenue({ t, ctx, offen, setOffen }: {
  t: FeedbackItem;
  ctx: TicketKontext;
  offen: boolean;
  setOffen: (v: boolean) => void;
}): React.ReactElement {
  const [modus, setModus] = useState<'menue' | 'kommentar'>('menue');
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
        className={modus === 'kommentar' ? 'w-[300px] p-[9px]' : 'w-auto min-w-[204px] p-[5px]'}
        onClick={e => e.stopPropagation()}
      >
        {modus === 'kommentar' ? (
          <SchnellKommentar
            t={t}
            ctx={ctx}
            zurueck={() => setModus('menue')}
            fertig={() => setOffen(false)}
          />
        ) : (
          <MenueInhalt
            t={t}
            ctx={ctx}
            schliessen={() => setOffen(false)}
            kommentieren={() => setModus('kommentar')}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function MenueInhalt({ t, ctx, schliessen, kommentieren }: {
  t: FeedbackItem;
  ctx: TicketKontext;
  schliessen: () => void;
  kommentieren: () => void;
}): React.ReactElement {
  const nummer = feedbackNummer(t);
  const darf = ctx.darfVerwalten && ctx.rolle === 'entwickler';
  const mir = ctx.meineId;
  const meins = ctx.istMeins(t);

  return (
    <>
      <PopLabel>#{nummer}</PopLabel>
      <PopZeile label="Kommentar schreiben" icon={MessageSquare} onClick={kommentieren} />
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
        <PopZeile label="Rückfrage an den Ersteller" icon={MessageCircleQuestion} onClick={kommentieren} />
      )}
      {!darf && !meins && (
        <PopZeile label="Ergänzung anhängen" icon={MessageSquare} onClick={kommentieren} />
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

function SchnellKommentar({ t, ctx, zurueck, fertig }: {
  t: FeedbackItem;
  ctx: TicketKontext;
  zurueck: () => void;
  fertig: () => void;
}): React.ReactElement {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const dev = ctx.darfVerwalten && ctx.rolle === 'entwickler';
  const bausteine = dev ? BAUSTEINE_DEV : BAUSTEINE_NUTZER;
  const meins = ctx.istMeins(t);
  const leer = !text.trim();

  const senden = (art: KommentarArt): void => {
    if (leer) return;
    ctx.kommentiere(t, text, art);
    fertig();
  };

  return (
    <div>
      <div className="fb-pop-lbl" style={{ padding: '0 0 6px' }}>
        {dev ? 'Kommentar an den Ersteller' : 'Kommentar'} · #{feedbackNummer(t)}
      </div>
      <div className="fb-bausteine">
        {bausteine.map(([label, vorlage]) => (
          <button
            key={label}
            type="button"
            onClick={() => { setText(vorlage); ref.current?.focus(); }}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        className="fb-kmt-feld"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={dev ? 'Was wurde umgesetzt / was fehlt noch?' : 'Was möchtest du ergänzen?'}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); senden('kommentar'); }
          // Esc schließt sonst nur das Popover und der Text wäre weg — erst
          // zurück ins Menü, den Entwurf verwirft der Nutzer selbst.
          if (e.key === 'Escape' && text) { e.preventDefault(); e.stopPropagation(); zurueck(); }
        }}
      />
      <div className="fb-kmt-zeile">
        <span className="fb-kmt-hinweis">Strg+↵ sendet</span>
        {dev && (
          <Button size="sm" variant="secondary" disabled={leer} onClick={() => senden('rueckfrage')}>
            Als Rückfrage
          </Button>
        )}
        {!dev && meins && (
          <Button size="sm" variant="secondary" disabled={leer} onClick={() => senden('ergaenzung')}>
            Als Ergänzung
          </Button>
        )}
        <Button size="sm" disabled={leer} onClick={() => senden('kommentar')}>
          <Send size={13} aria-hidden /> Senden
        </Button>
      </div>
    </div>
  );
}
