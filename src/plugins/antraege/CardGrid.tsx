import { useMemo } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode } from './store';
import {
  buildAntragGroups,
  takeGroupsUntil,
  splitByStatusPhase,
  statusSectionIdOf,
  zaehleJeAbschnitt,
  type AntragGroup,
  type GroupingMode,
} from './antragGroups';
import { sortDisablesGrouping } from './sort';
import { AntragTile } from './AntragTile';
import { StatusSectionHeader } from './StatusSectionHeader';
import { useStatusSectionCollapsed } from './useStatusSectionCollapsed';

interface Props {
  filtered: AntragListItem[];
  visibleRows: number;
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  /** „alle"-Modus → MA-Kürzel je Kachel anzeigen. */
  showMa: boolean;
  onOpenAntrag: (az: string) => void;
  onOpenVerbund: (id: string) => void;
  sentinelRef: React.Ref<HTMLDivElement>;
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
  showMa,
  onOpenAntrag,
  onOpenVerbund,
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
  // Abschnitts-Zahlen über den VOLLEN Satz — aus `groups` gezogen wüchsen sie
  // beim Nachladen und summierten sich zur Seitengröße statt zum Bestand.
  const abschnittsGesamt = useMemo(
    () => zaehleJeAbschnitt(allGroups, statusSectionIdOf),
    [allGroups],
  );
  const collapsedSet = useStatusSectionCollapsed(s => s.collapsed);

  const renderTiles = (gs: AntragGroup[]): React.ReactElement => (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}
    >
      {gs.map(g => (
        <AntragTile
          key={g.tvs[0]!.aktenzeichen}
          group={g}
          selectedAktenzeichen={selectedAktenzeichen}
          selectedVerbundId={selectedVerbundId}
          showMa={showMa}
          onOpenAntrag={onOpenAntrag}
          onOpenVerbund={onOpenVerbund}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col">
      {effectiveMode === 'status' ? (
        <div className="flex flex-col gap-4">
          {splitByStatusPhase(groups).map(section => (
            <div key={section.id}>
              <StatusSectionHeader
                id={section.id}
                count={abschnittsGesamt.get(section.id) ?? section.groups.length}
              />
              {collapsedSet.has(section.id) ? null : renderTiles(section.groups)}
            </div>
          ))}
        </div>
      ) : (
        renderTiles(groups)
      )}
      {hasMoreGroups ? (
        <div ref={sentinelRef} className="py-4 text-center text-[11.5px] text-[var(--tf-text-tertiary)]">
          Lade weitere Einträge …
        </div>
      ) : null}
    </div>
  );
}
