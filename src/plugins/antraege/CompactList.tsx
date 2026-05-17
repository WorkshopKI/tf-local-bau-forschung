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
              {renderRows(section.groups)}
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

function StatusSectionHeader({ label, count }: { label: string; count: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-3 mb-1.5 mt-1 first:mt-0">
      <span className="text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--tf-text-tertiary)]">
        {label}
      </span>
      <span className="text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">
        {count.toLocaleString('de-DE')}
      </span>
      <div className="flex-1 h-px bg-[var(--tf-border)]" />
    </div>
  );
}
