/**
 * Die Facettenzeile über dem Ergebnis.
 *
 * Rechnung und Regeln stehen in der reinen
 * [facetten.ts](src/plugins/suche/facetten.ts); hier steht die Bedienung.
 *
 * Gesetzte Filter erscheinen ZUSÄTZLICH als entfernbarer Chip. Das ist kein
 * Zierrat: ein Menü zeigt seinen Zustand nur, solange man es offen hält — ein
 * Filter, den man nicht sieht, ist ein Filter, den man nicht zurücknimmt.
 */
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import { FilterChip } from '@/components/ui/FilterChip';
import {
  FACETTEN_REIHENFOLGE,
  FACETTEN_LABEL,
  facettenOptionen,
  aktiveFilterChips,
  istWahlLeer,
  type FacettenWahl,
  type FacettenId,
} from './facetten';
import type { UnifiedSearchResult } from '@/core/types/search-result';

export function FacettenZeile({
  results,
  wahl,
  onWahl,
  onLeeren,
}: {
  /** Die Treffermenge VOR den Facetten — die Zahlen zählen darauf. */
  results: readonly UnifiedSearchResult[];
  wahl: FacettenWahl;
  onWahl: (id: FacettenId, werte: string[]) => void;
  onLeeren: () => void;
}): React.ReactElement | null {
  if (results.length === 0) return null;
  const chips = aktiveFilterChips(wahl);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {FACETTEN_REIHENFOLGE.map(id => {
        const optionen = facettenOptionen(results, id, wahl);
        if (optionen.length === 0) return null;
        return (
          <MultiSelectDropdown
            key={id}
            einheit={FACETTEN_LABEL[id]}
            alleLabel={FACETTEN_LABEL[id]}
            optionen={optionen}
            ausgewaehlt={wahl[id]}
            onChange={werte => onWahl(id, werte)}
          />
        );
      })}

      {chips.map(chip => (
        <FilterChip
          key={`${chip.id}:${chip.wert}`}
          label={chip.facette}
          value={chip.wertLabel}
          onRemove={() => onWahl(chip.id, wahl[chip.id].filter(w => w !== chip.wert))}
        />
      ))}

      {!istWahlLeer(wahl) && (
        <button
          type="button"
          onClick={onLeeren}
          className="h-7 rounded-[8px] px-2 text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Filter zurücksetzen
        </button>
      )}
    </div>
  );
}
