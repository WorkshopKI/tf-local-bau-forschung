/**
 * Der Chip einer **Richtlinien-Auswahl** — Beschriftung, Tooltip, Auswahl-Panel.
 *
 * Rein darstellend: der Aufrufer reicht herein, *welche* Auswahl gemeint ist.
 * Zwei gibt es — den Betrachtungsbereich (Arbeitsvorrat, Standard = letzte drei
 * Richtlinien) und die Richtlinien der Suche (Trefferliste, Standard = alle).
 * Sie haben verschiedene Speicher und verschiedene Grundzustände, aber
 * denselben Bedienweg; ein zweiter, abgeschriebener Chip liefe davon weg.
 *
 * „Kein Zustand ohne Anzeige" (Pitfall #46): eine Liste, die Datensätze
 * ausblendet, muss das sagen — sonst hält der Leser die gezeigte Menge für den
 * ganzen Bestand und sucht vergeblich nach einem alten Vorhaben.
 *
 * **Beziffert wird nur die Abweichung** (v4.70). Im Grundzustand steht nur die
 * Beschriftung; die Ausgeblendet-Zahl wiederholte dort täglich dieselbe
 * Selbstverständlichkeit. Sie ist nicht verschwunden: der Tooltip trägt sie in
 * jedem Zustand, das Panel ohnehin.
 *
 * Die **Beschriftung kommt aus `bereichsLabel`**, nicht aus dieser Datei: Zahl
 * und Wort haben damit eine Quelle. Eine hartcodierte „3" neben einem
 * gerechneten „(N Programme)" hat schon einmal auseinandergelaufen.
 */
import { useState } from 'react';
import { Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { bereichsLabel, type BereichModus } from '@/core/status/betrachtungsbereich';
import type { Bereich } from '@/core/hooks/useBereich';
import { useRichtlinienLabels, richtlinienLabel } from '@/core/hooks/useRichtlinienLabels';
import { BereichPanel } from './BereichPanel';

export function BereichAuswahlChip({
  bereich, ausgeblendet, einleitung, grundModus = 'standard', praefix,
}: {
  bereich: Bereich;
  /**
   * Wie viele Datensätze die Auswahl gerade wegnimmt. Der Aufrufer kennt seine
   * Grundmenge; ein Chip, der die Zahl selbst rechnete, müsste den Bestand ein
   * zweites Mal laden und liefe der Sicht hinterher.
   */
  ausgeblendet?: number;
  /** Was diese Auswahl bewirkt — steht oben im Panel. */
  einleitung?: React.ReactNode;
  /** Der Zustand, der sich nicht beziffert, weil er nichts wegnimmt. */
  grundModus?: Extract<BereichModus, 'standard' | 'alle'>;
  /** Worauf die Auswahl wirkt — „Anzeige" am Arbeitsvorrat, „Treffer" an der Suche. */
  praefix?: string;
}): React.ReactElement {
  const labels = useRichtlinienLabels();
  const [offen, setOffen] = useState(false);

  const text = bereichsLabel(bereich.modus, bereich.programme, praefix);
  // Der Grundzustand ist der Normalfall; er beziffert sich nicht selbst.
  // Sobald jemand davon abweicht, steht die Zahl wieder da (siehe unten).
  const beziffert = bereich.modus !== grundModus;

  const zahlSatz = ausgeblendet !== undefined && ausgeblendet > 0
    ? ` Ausgeblendet: ${ausgeblendet.toLocaleString('de-DE')}.`
    : '';
  const titel = (bereich.modus === 'alle'
    ? 'Der ganze Bestand — auch stillgelegte Altprogramme.'
    : `${bereich.programme.map(p => richtlinienLabel(p, labels, true)).join(' · ')}.`)
    + `${zahlSatz} Klick zum Wechseln.`;

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
          {beziffert && ausgeblendet !== undefined && ausgeblendet > 0 && (
            <span className="text-[var(--tf-text-tertiary)]">
              · {ausgeblendet.toLocaleString('de-DE')} ausgeblendet
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px]">
        <BereichPanel bereich={bereich} labels={labels} einleitung={einleitung} />
      </PopoverContent>
    </Popover>
  );
}
