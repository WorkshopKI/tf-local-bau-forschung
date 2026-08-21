/**
 * Das Schreibfeld des Verlaufs — Bausteine, Textarea, `Strg+↵`, Knopfzeile.
 *
 * EIN Bauteil für vier Orte (v5.2): Schnell-Kommentar am `⋯`-Menü, der
 * Ergänzen-Knopf an der Kanban-Karte, der Verlauf im Detail-Panel und die Liste
 * „Mein Feedback" im Erfassungs-Panel. Bis dahin stand es zweimal fast gleich da;
 * mit den beiden neuen Wegen wären es vier Kopien gewesen — und die Fallen
 * darin (Entwurf nur bei bestätigtem Schreiben leeren, Escape nicht ans Popover
 * durchreichen) hätte jede für sich lernen müssen.
 *
 * **Bewusst ohne `TicketKontext`**: das Erfassungs-Panel kennt das Board nicht,
 * und `components/ → plugins/` ist die Richtung, gegen die der Zyklen-Check
 * steht. Wie geschrieben wird, kommt als `senden`-Callback herein.
 *
 * **Invariante**: geleert wird NUR, wenn `senden` `true` liefert. Der Entwurf ist
 * die einzige Kopie — bei einem Share-Fehler bleibt der Text stehen.
 */
import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { FeedbackComment } from '@/core/types/feedback';
import type { Baustein } from './beitragBausteine';
import './beitrag-feld.css';

/** Art eines Beitrags im Verlauf — dieselbe Menge wie `FeedbackComment.kind`. */
export type BeitragArt = NonNullable<FeedbackComment['kind']>;

/** Ein zweiter Knopf neben „Senden" — „Als Rückfrage" ODER „Als Ergänzung". */
export interface BeitragZusatzAktion {
  label: string;
  art: BeitragArt;
  titel?: string;
}

interface Props {
  bausteine: readonly Baustein[];
  platzhalter: string;
  /** Linke Spalte der Knopfzeile (Hinweistext). `Strg+↵ sendet` hängt die Zeile selbst an. */
  hinweis?: React.ReactNode;
  /** Steht links neben der Textarea (im Verlauf das Avatar). */
  vorspann?: React.ReactNode;
  /** Was der Primärknopf und `Strg+↵` schicken. */
  primaerArt?: BeitragArt;
  primaerLabel?: string;
  zusatzAktion?: BeitragZusatzAktion;
  /** Beim Mounten fokussieren (Popover, das genau dafür aufgeht). */
  autofokus?: boolean;
  /**
   * Zähler statt Ref: jede Erhöhung fokussiert das Feld. So können fremde Knöpfe
   * hierher zeigen, ohne dass eine imperative Handle durchgereicht wird.
   */
  fokusSignal?: number;
  /**
   * Escape bei nicht-leerem Entwurf. Wer einen Handler mitgibt, entscheidet
   * selbst, was Escape bedeutet (zurück ins Menü, Popover schließen); ohne
   * Handler bleibt die Taste unangetastet und erreicht den Wirt.
   */
  aufEscape?: () => void;
  /** Liefert, OB geschrieben wurde. `false` ⇒ der Entwurf bleibt stehen. */
  senden: (text: string, art: BeitragArt) => Promise<boolean>;
}

export function FeedbackBeitragFeld({
  bausteine,
  platzhalter,
  hinweis,
  vorspann,
  primaerArt = 'kommentar',
  primaerLabel,
  zusatzAktion,
  autofokus,
  fokusSignal = 0,
  aufEscape,
  senden,
}: Props): React.ReactElement {
  const [text, setText] = useState('');
  const feld = useRef<HTMLTextAreaElement>(null);
  const leer = !text.trim();

  useEffect(() => { if (autofokus) feld.current?.focus(); }, [autofokus]);

  useEffect(() => {
    if (fokusSignal === 0) return;
    const el = feld.current;
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.focus();
  }, [fokusSignal]);

  const lauf = useAsyncAction(async (art: BeitragArt) => {
    if (leer) return;
    if (await senden(text, art)) setText('');
  });

  const feldEl = (
    <textarea
      ref={feld}
      className="fb-kmt-feld"
      value={text}
      onChange={e => setText(e.target.value)}
      placeholder={platzhalter}
      onKeyDown={e => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void lauf.run(primaerArt);
        }
        // Nur bei angefangenem Entwurf abfangen: auf dem leeren Feld soll
        // Escape das tun, was es überall sonst tut (Popover schließen).
        if (e.key === 'Escape' && text && aufEscape) {
          e.preventDefault();
          e.stopPropagation();
          aufEscape();
        }
      }}
    />
  );

  return (
    <>
      {bausteine.length > 0 && (
        <div className="fb-bausteine">
          {bausteine.map(([label, vorlage]) => (
            <button
              key={label}
              type="button"
              onClick={() => { setText(vorlage); feld.current?.focus(); }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {vorspann ? (
        <div className="fb-compose-feld">
          {vorspann}
          {feldEl}
        </div>
      ) : feldEl}

      <div className="fb-kmt-zeile">
        <span className="fb-kmt-hinweis">
          {hinweis ? <>{hinweis} · </> : null}Strg+↵ sendet
        </span>
        {zusatzAktion && (
          <Button
            size="sm"
            variant="secondary"
            disabled={leer || lauf.busy}
            title={zusatzAktion.titel}
            onClick={() => lauf.run(zusatzAktion.art)}
          >
            {zusatzAktion.label}
          </Button>
        )}
        <Button size="sm" disabled={leer || lauf.busy} onClick={() => lauf.run(primaerArt)}>
          <Send size={13} aria-hidden /> {primaerLabel ?? 'Senden'}
        </Button>
      </div>
    </>
  );
}
