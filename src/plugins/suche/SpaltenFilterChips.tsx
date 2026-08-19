/**
 * Die Spaltenfilter der Tabelle als Chips über dem Ergebnis.
 *
 * Sie stehen in derselben Zeile wie die Facetten und aus demselben Grund: seit
 * v4.111 gilt ein Spaltenfilter für BEIDE Ansichten, und in der Liste gibt es
 * keinen Spaltenkopf, an dem er sichtbar wäre. Ein Filter, den man nicht sieht,
 * ist ein Filter, den man nicht zurücknimmt — vorher war er in der Liste
 * überhaupt nicht wirksam, das war der Defekt daneben.
 *
 * In der Tabelle ist er damit doppelt sichtbar (Chip + markierter Spaltenkopf).
 * Das ist gewollt: die Facettenzeile führt denselben Gedanken schon aus, und
 * eine Zeile, die je nach Ansicht etwas anderes zeigt, wäre der nächste Fall
 * derselben Sorte.
 */
import { FilterChip } from '@/components/ui/FilterChip';
import { getColumnByKey } from './columns';

/** Trägt die Anfrage gerade einen Spaltenfilter? Für die Frage „kann das
 *  leere Ergebnis an einem Filter liegen". */
export function hatSpaltenFilter(filter: Record<string, ReadonlySet<string>>): boolean {
  return Object.values(filter).some(werte => werte.size > 0);
}

export function SpaltenFilterChips({ filter, onChange }: {
  filter: Record<string, ReadonlySet<string>>;
  /** Leeres Set = diesen Spaltenfilter weg. */
  onChange: (key: string, werte: Set<string>) => void;
}): React.ReactElement | null {
  const chips = Object.entries(filter).filter(([, werte]) => werte.size > 0);
  if (chips.length === 0) return null;

  return (
    <>
      {chips.map(([key, werte]) => {
        const label = getColumnByKey(key)?.label ?? key;
        return (
          <FilterChip
            key={key}
            label={label}
            // Ein einzelner Wert nennt sich selbst; bei mehreren stünde eine
            // Aufzählung im Chip, die den halben Kopf einnähme.
            value={werte.size === 1 ? [...werte][0] ?? '' : `${werte.size} Werte`}
            onRemove={() => onChange(key, new Set())}
            title={`Spaltenfilter „${label}" entfernen`}
          />
        );
      })}
    </>
  );
}
