import { useMemo } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode } from './store';
import {
  buildAntragGroups,
  takeGroupsUntil,
  splitByStatusPhase,
  type AntragGroup,
  type GroupingMode,
} from './antragGroups';
import { sortDisablesGrouping } from './sort';
import { CompactGroup } from './CompactGroup';
import { StatusSectionHeader } from './StatusSectionHeader';
import { useStatusSectionCollapsed } from './useStatusSectionCollapsed';

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
  const verbundById = useAntraegeStore(s => s.verbundById);
  const effectiveMode: GroupingMode = sortDisablesGrouping(sortKey) ? 'none' : userGroupingMode;

  // Clustering auf der vollen `filtered`-Liste — Pagination an Cluster-
  // Grenzen via `takeGroupsUntil` (siehe Kommentar in `AntraegeMain.tsx`).
  const allGroups = useMemo(
    () => buildAntragGroups(filtered, { mode: effectiveMode, netzwerkNames, verbundById }),
    [filtered, effectiveMode, netzwerkNames, verbundById],
  );
  const groups = useMemo(() => takeGroupsUntil(allGroups, visibleRows), [allGroups, visibleRows]);
  const hasMoreGroups = groups.length < allGroups.length;
  const collapsedSet = useStatusSectionCollapsed(s => s.collapsed);

  const renderRows = (gs: AntragGroup[]): React.ReactElement => (
    <div className="flex flex-col gap-0.5">
      {gs.map(g => (
        <CompactGroup
          key={g.tvs[0]!.aktenzeichen}
          group={g}
          selectedAktenzeichen={selectedAktenzeichen}
          onOpenAntrag={onOpenAntrag}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col">
      {effectiveMode === 'status' ? (
        <div className="flex flex-col gap-3">
          {splitByStatusPhase(groups).map(section => (
            <div key={section.label}>
              <StatusSectionHeader label={section.label} count={section.groups.length} />
              {collapsedSet.has(section.label) ? null : renderRows(section.groups)}
            </div>
          ))}
        </div>
      ) : (
        renderRows(groups)
      )}
      {hasMoreGroups ? (
        <div ref={sentinelRef} className="py-3 text-center text-[11px] text-[var(--tf-text-tertiary)]">
          Lade weitere Einträge …
        </div>
      ) : null}
    </div>
  );
}
