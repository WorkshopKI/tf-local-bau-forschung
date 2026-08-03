/**
 * Reicher Tooltip an einer Baum-Zeile — für Inhalte, die ein `title`-Attribut
 * nicht trägt (mehrere Zeilen, Zahlen, Herkunftshinweise).
 *
 * **Der Inhalt wird erst beim Öffnen erzeugt.** Ein Baum hat viele Zeilen; sie
 * alle beim Rendern mit einem Tooltip-Körper zu füllen, kostet bei jedem
 * Neuaufbau, obwohl höchstens einer je sichtbar ist. `inhalt` ist deshalb eine
 * Funktion, kein Knoten.
 *
 * Das Öffnen selbst überlässt die Komponente Radix (Verzögerung, Tastatur-
 * Fokus, Kollisionsvermeidung) — nachgebaut wäre davon jedes Stück schlechter.
 */
import { useState } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

export interface TfTreeHoverCardProps {
  /** Erst bei `open` ausgewertet. */
  inhalt: () => React.ReactNode;
  children: React.ReactNode;
}

export function TfTreeHoverCard({ inhalt, children }: TfTreeHoverCardProps): React.ReactElement {
  const [offen, setOffen] = useState(false);
  // Liefert der Slot für DIESE Zeile nichts, erscheint keine Karte — sonst
  // klappte über Ordnerzeilen ein leerer Kasten auf.
  const koerper = offen ? inhalt() : null;
  return (
    <HoverCard open={offen} onOpenChange={setOffen}>
      {/* Radix' Trigger ist von Haus aus ein `<a>` — in einer Baumzeile wäre
          das ein Link, der nirgendwohin führt. `asChild` auf einen `span`. */}
      <HoverCardTrigger asChild>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
      </HoverCardTrigger>
      {koerper != null && koerper !== false && <HoverCardContent>{koerper}</HoverCardContent>}
    </HoverCard>
  );
}
