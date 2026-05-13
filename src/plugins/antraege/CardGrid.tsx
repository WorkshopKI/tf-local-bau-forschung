import { useMemo } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode } from './store';
import { buildAntragGroups, takeGroupsUntil, type GroupingMode } from './antragGroups';
import { sortDisablesGrouping } from './sort';
import { AntragTile } from './AntragTile';

interface Props {
  filtered: AntragListItem[];
  visibleRows: number;
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  onOpenAntrag: (az: string) => void;
  onOpenVerbund: (id: string) => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Card-Grid-View: Akronym-Tiles im responsive Grid. Verbund-TVs werden zu
 * einem Sammeltile (×N) zusammengefasst, ausser bei Antragsteller-Sort —
 * dort löst sich Clustering auf (`mode: 'none'`).
 */
export function CardGrid({
  filtered,
  visibleRows,
  selectedAktenzeichen,
  selectedVerbundId,
  onOpenAntrag,
  onOpenVerbund,
  sentinelRef,
}: Props): React.ReactElement {
  const sortKey = useAntraegeStore(s => getEffectiveSortKey(s.activeView, s.sortByView));
  const userGroupingMode = useAntraegeStore(s => getEffectiveGroupingMode(s.activeView, s.groupingByView));
  const netzwerkNames = useAntraegeStore(s => s.netzwerkNameById);
  const effectiveMode: GroupingMode = sortDisablesGrouping(sortKey) ? 'none' : userGroupingMode;

  // Clustering auf der vollen `filtered`-Liste — Pagination an Cluster-
  // Grenzen via `takeGroupsUntil` (siehe Kommentar in `AntraegeMain.tsx`).
  const allGroups = useMemo(
    () => buildAntragGroups(filtered, { mode: effectiveMode, netzwerkNames }),
    [filtered, effectiveMode, netzwerkNames],
  );
  const groups = useMemo(() => takeGroupsUntil(allGroups, visibleRows), [allGroups, visibleRows]);
  const hasMoreGroups = groups.length < allGroups.length;

  return (
    <div className="flex flex-col">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}
      >
        {groups.map(g => (
          <AntragTile
            key={g.tvs[0]!.aktenzeichen}
            group={g}
            selectedAktenzeichen={selectedAktenzeichen}
            selectedVerbundId={selectedVerbundId}
            onOpenAntrag={onOpenAntrag}
            onOpenVerbund={onOpenVerbund}
          />
        ))}
      </div>
      {hasMoreGroups ? (
        <div ref={sentinelRef} className="py-4 text-center text-[11.5px] text-[var(--tf-text-tertiary)]">
          Lade weitere Einträge …
        </div>
      ) : null}
    </div>
  );
}
