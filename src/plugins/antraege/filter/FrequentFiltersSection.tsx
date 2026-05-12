import { Plus } from 'lucide-react';
import type { FrequentEntry } from './frequentFilters';

interface Props {
  entries: FrequentEntry[];
  onApply: (entry: FrequentEntry) => void;
}

/**
 * Liste der Top-N häufig genutzten Filter-Kombinationen. Wird leer NICHT
 * gerendert — Sektion-Header + Empty-State würden Platz verbrauchen ohne
 * Mehrwert. Der Container blendet die ganze Sektion aus wenn `entries.length === 0`.
 */
export function FrequentFiltersSection({ entries, onApply }: Props): React.ReactElement | null {
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col">
      {entries.map(e => (
        <button
          key={e.signature}
          type="button"
          onClick={() => onApply(e)}
          className="flex items-center gap-2 px-1.5 py-1 rounded text-left cursor-pointer hover:bg-[var(--tf-hover)] group"
        >
          <span
            className="flex-1 truncate text-[12px] text-[var(--tf-text-secondary)] group-hover:text-[var(--tf-text)]"
            title={e.label}
          >
            {e.label}
          </span>
          <span className="text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">
            {e.count}
          </span>
          <Plus
            size={11}
            className="text-[var(--tf-text-tertiary)] group-hover:text-[var(--tf-text-secondary)]"
          />
        </button>
      ))}
    </div>
  );
}
