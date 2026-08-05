// Kommentar-Vorschau am Zeiger: hovert man die 💬-Metrik einer Feedback-Karte,
// stehen die letzten Kommentare da — ohne Klick, ohne Wechsel ins Detail-Panel.
//
// Radix' HoverCard statt des projekteigenen Tooltips, aus drei Gründen: der
// Tooltip ist `pointer-events-none` (nicht scrollbar, nicht markierbar), er baut
// seinen Inhalt eager (hier: hunderte Karten je Render), und er kann nur
// oben/unten klemmen — die Metrik sitzt am unteren Rand einer Karte in einer
// `overflow-hidden`-Spur, wo es das Portal + den Kollisions-Flip von Radix
// braucht. Muster übernommen von TfTreeHoverCard.

import { useState } from 'react';
import type { FeedbackComment } from '@/core/types/feedback';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { waehleKommentarVorschau } from './feedbackUi';
import { FeedbackCommentList } from './FeedbackCommentList';

/** Grenzen der Vorschau — hier, nicht an den Aufrufern, damit Board und Liste
 *  nicht auseinanderlaufen. Ältere zählt die Liste als „+N ältere" aus. */
const MAX_EINTRAEGE = 4;
const MAX_ZEICHEN = 220;

interface Props {
  comments: readonly FeedbackComment[];
  /** Zahl neuer Kommentare → die letzten N werden in der Vorschau hervorgehoben. */
  neueKommentare?: number;
  /** Die Metrik selbst; wird per `asChild` zum Trigger (Radix rendert sonst ein `<a>`). */
  children: React.ReactNode;
}

export function FeedbackCommentHover({ comments, neueKommentare = 0, children }: Props): React.ReactElement {
  const [offen, setOffen] = useState(false);

  // Erst bei offener Karte rechnen: sichtbar ist immer höchstens eine.
  const vorschau = offen
    ? waehleKommentarVorschau(comments, {
        maxEintraege: MAX_EINTRAEGE,
        maxZeichen: MAX_ZEICHEN,
        neuAnzahl: neueKommentare,
      })
    : null;

  return (
    // 500 ms hier statt im geteilten Default (DESIGN_GUIDE: keine Tooltip-Delays
    // unter 500 ms) — der Default gehört dem Baum und bleibt unangetastet.
    // Längeres Schließen als dort, weil der Weg vom 12-px-Icon weiter ist.
    <HoverCard open={offen} onOpenChange={setOffen} openDelay={500} closeDelay={200}>
      {/* KEIN stopPropagation — anders als bei der Vote-Pill nebenan soll der
          Klick weiter zur Karte durchperlen und das Detail öffnen. Die Vorschau
          schließt sich dabei, sonst bliebe sie über dem geöffneten Panel stehen. */}
      <HoverCardTrigger asChild onClick={() => setOffen(false)}>
        {children}
      </HoverCardTrigger>
      {vorschau && vorschau.eintraege.length > 0 && (
        <HoverCardContent side="top" align="end" sideOffset={6} className="w-[340px] max-w-[340px] p-0">
          <div className="max-h-[280px] overflow-y-auto px-3 py-2.5">
            <FeedbackCommentList
              eintraege={vorschau.eintraege}
              aeltereAnzahl={vorschau.aeltereAnzahl}
              variante="hover"
            />
          </div>
        </HoverCardContent>
      )}
    </HoverCard>
  );
}
