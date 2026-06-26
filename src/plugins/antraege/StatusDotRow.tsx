import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusCategory } from '@/core/utils/status-canonical';
import { getStatusLabel } from '@/core/utils/status-mappings';
import { getStatusCategoryColor, getStatusCategoryLabel } from './groupAggregates';
import { StatusDot } from '@/components/ui/StatusBadge';

interface Props {
  tvs: AntragListItem[];
  /** Maximale Anzahl sichtbarer Punkte. Überlauf zeigt "+N". */
  maxVisible?: number;
}

/**
 * Reihe von kleinen Status-Dots für die Verbund-Tile. Ein Dot pro TV, Farbe
 * aus der Status-Kategorie (`getStatusCategory()`). Bei `tvs.length > maxVisible`
 * werden nur die ersten `maxVisible - 1` Dots gezeigt + `+N`-Text.
 *
 * Hover-Tooltip auf jedem Dot zeigt `FKZ — Status`.
 */
export function StatusDotRow({ tvs, maxVisible = 7 }: Props): React.ReactElement {
  const visible = tvs.length <= maxVisible ? tvs : tvs.slice(0, maxVisible - 1);
  const overflow = tvs.length - visible.length;

  return (
    <div className="flex items-center gap-[3px] justify-center">
      {visible.map(tv => {
        const cat = getStatusCategory(tv.status);
        const statusLabel = typeof tv.status === 'string' && tv.status.trim().length > 0
          ? getStatusLabel(tv.status.trim())
          : getStatusCategoryLabel(cat);
        return (
          <StatusDot
            key={tv.aktenzeichen}
            color={getStatusCategoryColor(cat)}
            title={`${tv.aktenzeichen} — ${statusLabel}`}
            ariaLabel={statusLabel}
          />
        );
      })}
      {overflow > 0 ? (
        <span
          className="ml-[2px] text-[9px] tabular-nums text-[var(--tf-text-tertiary)]"
          title={`${overflow} weitere`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
