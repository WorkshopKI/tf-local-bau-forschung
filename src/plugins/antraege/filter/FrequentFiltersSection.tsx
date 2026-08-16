import { Plus } from 'lucide-react';
import type { FrequentEntryView } from './frequentFilters';
import { PinNadel } from './PinNadel';

interface Props {
  entries: FrequentEntryView[];
  onApply: (entry: FrequentEntryView) => void;
}

/**
 * Liste der Top-N häufig genutzten Filter-Kombinationen. Wird leer NICHT
 * gerendert — Sektion-Header + Empty-State würden Platz verbrauchen ohne
 * Mehrwert. Der Container blendet die ganze Sektion aus wenn `entries.length === 0`.
 *
 * **Der Eintrag ist ein Sprung, die Nadel macht daraus einen Schalter.** Ein
 * Klick hier ERSETZT die Auswahl durch diesen Satz (siehe `applyFrequent` im
 * Container). Wer den Satz stattdessen den Tag über an- und abschalten will,
 * pinnt ihn oben an: der Chip legt dazu und nimmt beim Ausschalten nur sein
 * eigenes Zutun zurück (`pinnedFilters.ts`).
 */
export function FrequentFiltersSection({ entries, onApply }: Props): React.ReactElement | null {
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col">
      {entries.map(e => (
        // Die Nadel steht neben dem Eintrag statt darin — ein Knopf im Knopf
        // ist ungültiges HTML.
        <div
          key={e.signature}
          className="group/pin flex items-center gap-1 rounded px-1.5 hover:bg-[var(--tf-hover)]"
        >
          <button
            type="button"
            onClick={() => onApply(e)}
            title={`${e.label} · ${e.count}-mal angewendet · ersetzt die aktuelle Auswahl`}
            className="group min-w-0 flex-1 flex items-center gap-2 py-1 text-left cursor-pointer"
          >
            {/* Zwei Zeilen statt Kürzung mit „…": die Einträge unterscheiden
                sich am ENDE („… zur Rücknahme" / „… zur Ablehnung"), und genau
                das schnitt eine einzeilige Kürzung weg. Bei zwei Zeilen à 400 px
                bleibt kein realer Eintrag mehr unlesbar; die Langfassung steht
                weiterhin im `title` des Knopfes. */}
            <span className="min-w-0 flex-1 line-clamp-2 text-[12px] leading-[1.35] text-[var(--tf-text-secondary)] group-hover:text-[var(--tf-text)]">
              {e.label}
            </span>
            <Plus
              size={11}
              className="text-[var(--tf-text-tertiary)] group-hover:text-[var(--tf-text-secondary)] shrink-0"
            />
          </button>
          <PinNadel
            pin={{ art: 'kombination', signatur: e.signature, gesetzt: e.appliedFilters }}
            bezeichnung={e.label}
          />
        </div>
      ))}
    </div>
  );
}
