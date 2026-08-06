// Die Team-Antwort am Zeiger: hovert man das „Antwort"-Pill einer Feedback-Karte,
// steht die Antwort da — ohne Klick, ohne Wechsel ins Detail-Panel.
//
// Warum es das Pill überhaupt gibt (v3.7): `kurator_response` lag in jedem
// Board-Item, wurde aber nirgends gerendert. Das einzige Signal war ein rotes
// „Antwort"-Badge, doppelt gegated auf `mine && unread` — nach dem ersten Öffnen
// verschwand mit ihm JEDER Hinweis darauf, dass das Ticket beantwortet ist. Die
// Antwort ist per Datenmodell öffentlich („für alle auf dem Board sichtbar"),
// also zeigt das Pill sie jetzt dauerhaft und für jeden.
//
// Technik wie FeedbackCommentHover (Radix HoverCard statt des projekteigenen
// Tooltips): der ist `pointer-events-none` (nicht scrollbar, nicht markierbar),
// baut seinen Inhalt eager über hunderte Karten und kann nur oben/unten klemmen.

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

interface Props {
  /** Der volle Antworttext (bereits getrimmt; leer wird nicht gerendert). */
  antwort: string;
  /** Ungelesene Antwort auf ein eigenes Ticket → „Neu" in der Kopfzeile. */
  ungelesen?: boolean;
  /** Das Pill selbst; wird per `asChild` zum Trigger (Radix rendert sonst ein `<a>`). */
  children: React.ReactNode;
}

export function FeedbackAntwortHover({ antwort, ungelesen = false, children }: Props): React.ReactElement {
  const [offen, setOffen] = useState(false);

  return (
    // 500 ms wie bei der Kommentar-Vorschau (DESIGN_GUIDE: keine Delays unter
    // 500 ms), längeres Schließen wegen des kurzen Wegs vom kleinen Pill.
    <HoverCard open={offen} onOpenChange={setOffen} openDelay={500} closeDelay={200}>
      {/* KEIN stopPropagation: der Klick soll weiter zur Karte durchperlen und das
          Detail öffnen. Die Vorschau schließt dabei, sonst bliebe sie über dem
          geöffneten Panel stehen. Und KEIN `title` am selben Element — zwei
          Popups über einem Trigger war die Falle aus v2.416. */}
      <HoverCardTrigger asChild onClick={() => setOffen(false)}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="top" align="end" sideOffset={6} className="w-[340px] max-w-[340px] p-0">
        <div className="max-h-[280px] overflow-y-auto px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-1.5">
            <MessageSquare size={11} /> Antwort vom Team
            {ungelesen && (
              <span className="text-[9.5px] font-semibold text-[var(--tf-fb-problem)] normal-case tracking-normal">
                Neu
              </span>
            )}
          </p>
          <p className="whitespace-pre-wrap leading-snug text-[12px] text-[var(--tf-text-secondary)]">
            {antwort}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
