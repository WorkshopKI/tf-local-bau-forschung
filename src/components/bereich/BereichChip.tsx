/**
 * Der **Betrachtungsbereich-Chip** im Kopf jeder Datensicht.
 *
 * „Kein Zustand ohne Anzeige" (Pitfall #46): eine Liste, die 6 952 Anträge
 * ausblendet, muss das sagen — sonst hält der Leser die gezeigte Menge für den
 * ganzen Bestand und sucht vergeblich nach einem alten Vorhaben. Der Chip nennt
 * darum beides: was gilt und was fehlt.
 *
 * Klick öffnet die Auswahl (drei Stufen + Programm-Liste in Klartext). Der
 * Chip erscheint in allen Build-Varianten — auch dort, wo der Status-Katalog
 * nicht lädt und der Standard-Bereich aus dem Code kommt.
 */
import { useState } from 'react';
import { Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBereich } from '@/core/hooks/useBereich';
import { useRichtlinienLabels, richtlinienLabel } from '@/core/hooks/useRichtlinienLabels';
import { BereichPanel } from './BereichPanel';

export function BereichChip({ ausgeblendet }: {
  /**
   * Wie viele Datensätze der Bereich gerade wegnimmt. Der Aufrufer kennt seine
   * Grundmenge; ein Chip, der die Zahl selbst rechnete, müsste den Bestand ein
   * zweites Mal laden und liefe der Sicht hinterher.
   */
  ausgeblendet?: number;
}): React.ReactElement {
  const bereich = useBereich();
  const labels = useRichtlinienLabels();
  const [offen, setOffen] = useState(false);

  const text = bereich.modus === 'alle'
    ? 'Anzeige: alle Richtlinien'
    : bereich.modus === 'auswahl'
      ? `Anzeige: ${bereich.programme.length} ausgewählte Richtlinien`
      : `Anzeige: letzte 3 Richtlinien (${bereich.programme.length} Programme)`;

  const titel = bereich.modus === 'alle'
    ? 'Der ganze Bestand — auch stillgelegte Altprogramme. Klick zum Wechseln.'
    : `${bereich.programme.map(p => richtlinienLabel(p, labels, true)).join(' · ')} — Klick zum Wechseln.`;

  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={titel}
          className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] transition-colors shrink-0"
        >
          <Layers size={11} />
          <span>{text}</span>
          {ausgeblendet !== undefined && ausgeblendet > 0 && (
            <span className="text-[var(--tf-text-tertiary)]">
              · {ausgeblendet.toLocaleString('de-DE')} ausgeblendet
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px]">
        <BereichPanel bereich={bereich} labels={labels} />
      </PopoverContent>
    </Popover>
  );
}
