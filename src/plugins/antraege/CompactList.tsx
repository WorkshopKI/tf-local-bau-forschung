import { useMemo } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode } from './store';
import { buildAntragGroups, takeGroupsUntil, type GroupingMode } from './antragGroups';
import { sortDisablesGrouping } from './sort';
import { CompactGroup } from './CompactGroup';

interface Props {
  filtered: AntragListItem[];
  visibleRows: number;
  selectedAktenzeichen: string | null;
  onOpenAntrag: (az: string) => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Kompakt-Liste: einzeilig pro TV mit minimaler Höhe. Wiederverwendet
 * `buildAntragGroups` und respektiert dieselben Gruppierungs- und Sort-
 * Regeln wie die List-View (Antragsteller-Sort löst Cluster auf).
 */
export function CompactList({
  filtered,
  visibleRows,
  selectedAktenzeichen,
  onOpenAntrag,
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
    <div className="flex flex-col gap-0.5">
      {groups.map(g => (
        <CompactGroup
          key={g.tvs[0]!.aktenzeichen}
          group={g}
          selectedAktenzeichen={selectedAktenzeichen}
          onOpenAntrag={onOpenAntrag}
        />
      ))}
      {hasMoreGroups ? (
        <div ref={sentinelRef} className="py-3 text-center text-[11px] text-[var(--tf-text-tertiary)]">
          Lade weitere Einträge …
        </div>
      ) : null}
    </div>
  );
}
