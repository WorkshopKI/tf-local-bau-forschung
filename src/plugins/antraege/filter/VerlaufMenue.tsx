/**
 * Der **Filter-Verlauf** als Menü im Kopf der Filterleiste.
 *
 * Bis v4.65 stand er als Dauer-Abschnitt „Häufig benutzt" ganz oben im Rumpf der
 * Leiste — über den Filter-Achsen, obwohl er keine ist. Er beantwortet eine
 * Erinnerungsfrage („wie hatte ich das neulich gemacht?"), nicht eine
 * Eingrenzungsfrage, und wechselte dabei unter der Hand seinen Inhalt. Als Menü
 * hinter einem Uhr-Knopf ist er da, wenn man ihn sucht, und weg, wenn nicht.
 *
 * **Ein Eintrag ERSETZT den Filterstand** — das ist die Bedeutung von
 * „wiederherstellen", nicht ein Versehen: der Eintrag ist der ganze Stand von
 * damals, nicht ein einzelner Wert, den man dazulegt. Wer einen Satz dauerhaft
 * an- und abschalten will, pinnt ihn über die Nadel an (`pinnedFilters.ts`) —
 * der Chip legt dann dazu und nimmt beim Ausschalten nur sein eigenes Zutun
 * zurück.
 */
import { useState } from 'react';
import { History } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FrequentFiltersSection } from './FrequentFiltersSection';
import type { FrequentEntryView } from './frequentFilters';

interface Props {
  eintraege: FrequentEntryView[];
  onAnwenden: (entry: FrequentEntryView) => void;
}

export function VerlaufMenue({ eintraege, onAnwenden }: Props): React.ReactElement | null {
  const [offen, setOffen] = useState(false);
  // Ohne Verlauf kein Knopf: ein Menü, das „noch nichts" sagt, ist ein
  // Bedienelement, das nur von sich selbst handelt.
  if (eintraege.length === 0) return null;

  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Zuletzt benutzte Filter"
          title="Zuletzt benutzte Filter"
          className="shrink-0 p-1 rounded-[6px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] transition-colors cursor-pointer"
        >
          <History size={15} />
        </button>
      </PopoverTrigger>
      {/* Breiter als ein übliches Menü (280 → 440), weil die Einträge sich am
          ENDE unterscheiden: „Status · Stellungnahme zur Rücknahme …" und
          „Status · Stellungnahme zur Ablehnung …" sind auf 207 px Textbreite
          dieselbe Zeile. Am echten Verlauf gemessen brauchte der längste Eintrag
          274 px — 440 deckt das mit Reserve. `align="start"`, weil der Knopf seit
          v4.70.1 links neben dem Titel sitzt: rechtsbündig liefe das Menü über
          den linken Fensterrand hinaus. */}
      <PopoverContent align="start" className="w-[440px] gap-1.5">
        <div className="px-1.5 text-[10.5px] font-medium uppercase text-[var(--tf-text-tertiary)]" style={{ letterSpacing: '0.08em' }}>
          Zuletzt benutzt
        </div>
        <FrequentFiltersSection
          entries={eintraege}
          onApply={e => { onAnwenden(e); setOffen(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}
