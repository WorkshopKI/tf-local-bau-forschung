import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusCategory } from '@/core/utils/status-canonical';
import { getStatusLabel } from '@/core/utils/status-mappings';
import { getStatusCategoryColor, getStatusCategoryLabel } from './groupAggregates';

interface Props {
  tvs: AntragListItem[];
  /** Maximale Anzahl sichtbarer Balken. Überlauf zeigt "+N" — Default 5
   *  passt auf die 110px-AntragTile-Breite ohne zu quetschen. */
  maxVisible?: number;
}

/**
 * Horizontale Reihe kleiner farbiger Balken — ein Balken pro TV im Verbund.
 * Farbe = Status-Kategorie (`getStatusCategoryColor`). Bei `tvs.length > maxVisible`
 * werden `maxVisible - 1` Balken gezeigt + `+N`-Text.
 *
 * Optisch lange Striche statt Punkte (StatusDotRow): wirkt im Card-Header
 * mehr wie ein Phase-Indikator, weniger wie ein generischer Counter.
 */
export function StatusBarRow({ tvs, maxVisible = 5 }: Props): React.ReactElement {
  const visible = tvs.length <= maxVisible ? tvs : tvs.slice(0, maxVisible - 1);
  const overflow = tvs.length - visible.length;

  return (
    <div className="flex items-center gap-[2px]">
      {visible.map(tv => {
        const cat = getStatusCategory(tv.status);
        const statusLabel = typeof tv.status === 'string' && tv.status.trim().length > 0
          ? getStatusLabel(tv.status.trim())
          : getStatusCategoryLabel(cat);
        return (
          <span
            key={tv.aktenzeichen}
            className="inline-block w-[10px] h-[3px] rounded-[1px]"
            style={{ background: getStatusCategoryColor(cat) }}
            title={`${tv.aktenzeichen} — ${statusLabel}`}
            aria-label={statusLabel}
          />
        );
      })}
      {overflow > 0 ? (
        <span
          className="ml-[2px] text-[9px] tabular-nums text-[var(--tf-text-tertiary)] leading-none"
          title={`${overflow} weitere`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
