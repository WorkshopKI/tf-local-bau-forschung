/**
 * Quickfilter-Toolbar für die Förderanträge-Liste.
 *
 * Hierarchie nach Design-Handoff
 * `_design/handoff/card-grid/design_handoff_filter_quickfilter/`:
 *
 *   [Phase: Alle ▸] [Kategorie: Alle ▸] [Antragsdatum: Neueste zuerst ▸] [⇅]
 *   Gruppiert: ( Keine | Status | NW | NW-Größe )
 *
 * Filter-Backend:
 * - Phase  → `useFilterState` (`system-status`-Filter, Single-Select via
 *   `phaseQuickfilter.ts`)
 * - Kategorie → `useFilterState` (`system-vb-phase`-Filter, Single-Select via
 *   `kategorieQuickfilter.ts`)
 * - Sort + Grouping → `useAntraegeStore` (per-View persistiert)
 */
import { useMemo } from 'react';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode, getEffectiveViewMode, getEffectiveTableGroupingMode } from '../store';
import { useFilteredAntraege } from '../useFilteredAntraege';
import { useFilterState } from './useFilterState';
import { GROUPING_OPTIONS, type SortKey } from '../sort';
import type { GroupingMode } from '../antragGroups';
import { TABLE_GROUPING_OPTIONS, type TableGroupingMode } from '../tableGrouping';
import { CollapsibleSeg } from './CollapsibleSeg';
import {
  getPhaseFromActive,
  getPhaseItems,
  applyPhase,
  type PhaseLabel,
} from './phaseQuickfilter';
import {
  getKategorieFromActive,
  getKategorieItems,
  applyKategorie,
  type KategorieLabel,
} from './kategorieQuickfilter';

/** Alle Sortier-Optionen in einer einzigen Liste — Source-of-Truth fuer
 *  die `Sortiert nach`-Quickfilter-Pille. Reihenfolge bestimmt die UI-
 *  Reihenfolge in der SegGroup. */
const SORT_OPTIONS: { label: string; key: SortKey }[] = [
  { label: 'Neueste zuerst', key: 'antrag_desc' },
  { label: 'Älteste zuerst', key: 'antrag_asc' },
  { label: 'Frist (kürzeste zuerst)', key: 'frist_asc' },
  { label: 'Akronym (A→Z)', key: 'akronym_asc' },
  { label: 'Antragsteller (A→Z)', key: 'antragsteller_asc' },
];

const DEFAULT_SORT_LABEL = 'Neueste zuerst';

export function QuickfilterToolbar(): React.ReactElement {
  // Counts auf der "Kürzel-gefilterten" Basis berechnen, nicht auf der
  // Roh-Liste — sonst zeigen die Pillen Counts der gesamten Kohorte
  // obwohl die Tabs oben (Offen / Alle …) bereits den Kürzel-Filter
  // anwenden. countBase = View + Irrläufer-Pre-Filter + Begleitphase +
  // Bearbeiter-Filter, ohne die Sidebar-Active-Filter (Stabilität).
  const { countBase } = useFilteredAntraege();
  const activeView = useAntraegeStore(s => s.activeView);
  const sortByView = useAntraegeStore(s => s.sortByView);
  const groupingByView = useAntraegeStore(s => s.groupingByView);
  const tableGroupingByView = useAntraegeStore(s => s.tableGroupingByView);
  const setSortForView = useAntraegeStore(s => s.setSortForView);
  const setGroupingForView = useAntraegeStore(s => s.setGroupingForView);
  const setTableGroupingForView = useAntraegeStore(s => s.setTableGroupingForView);

  const sortKey = getEffectiveSortKey(activeView, sortByView);
  const groupingMode = getEffectiveGroupingMode(activeView, groupingByView);
  const tableGroupingMode = getEffectiveTableGroupingMode(activeView, tableGroupingByView);
  // Tabellen-Ansicht ("compact") ist flach → Gruppierung hat keinen Effekt,
  // daher die "Gruppiert"-Pille dort ausblenden.
  const viewMode = useAntraegeStore(s => getEffectiveViewMode(s.activeView, s.viewModeByTab));

  const active = useFilterState(s => s.active);
  const setActiveValue = useFilterState(s => s.setActiveValue);
  const clearFilter = useFilterState(s => s.clearFilter);

  // Phase
  const phaseItems = useMemo(() => getPhaseItems(countBase), [countBase]);
  const phase = getPhaseFromActive(active);
  const onPhaseChange = (label: string): void => {
    applyPhase(label as PhaseLabel, (id, v) => setActiveValue(id, v), clearFilter);
  };

  // Kategorie
  const kategorieItems = useMemo(() => getKategorieItems(countBase), [countBase]);
  const kategorie = getKategorieFromActive(active);
  const onKategorieChange = (label: string): void => {
    applyKategorie(label as KategorieLabel, (id, v) => setActiveValue(id, v), clearFilter);
  };

  // Sortiert nach (unifiziert: Antragsdatum + Frist + Akronym + Antragsteller)
  const currentSortLabel =
    SORT_OPTIONS.find(o => o.key === sortKey)?.label ?? DEFAULT_SORT_LABEL;
  const onSortChange = (label: string): void => {
    const opt = SORT_OPTIONS.find(o => o.label === label);
    if (!opt) return;
    setSortForView(activeView, opt.key);
  };

  // Gruppieren (List-/Karten-View: Keine/Status/NW/NW-Größe)
  const groupingItems = GROUPING_OPTIONS.map(opt => ({ label: opt.label }));
  const currentGroupingLabel =
    GROUPING_OPTIONS.find(o => o.key === groupingMode)?.label ?? GROUPING_OPTIONS[0]!.label;
  const onGroupingChange = (label: string): void => {
    const opt = GROUPING_OPTIONS.find(o => o.label === label);
    if (!opt) return;
    setGroupingForView(activeView, opt.key as GroupingMode);
  };

  // Gruppieren in der Tabellen-Ansicht (eigene, kleinere Optionen:
  // Keine/Verbund/Status — eigener Store-Slot).
  const tableGroupingItems = TABLE_GROUPING_OPTIONS.map(opt => ({ label: opt.label }));
  const currentTableGroupingLabel =
    TABLE_GROUPING_OPTIONS.find(o => o.key === tableGroupingMode)?.label ?? TABLE_GROUPING_OPTIONS[0]!.label;
  const onTableGroupingChange = (label: string): void => {
    const opt = TABLE_GROUPING_OPTIONS.find(o => o.label === label);
    if (!opt) return;
    setTableGroupingForView(activeView, opt.key as TableGroupingMode);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CollapsibleSeg
        label="Status"
        value={phase}
        items={phaseItems}
        onChange={onPhaseChange}
      />
      <CollapsibleSeg
        label="Antragstyp"
        value={kategorie}
        items={kategorieItems}
        onChange={onKategorieChange}
      />
      {/* Tabellen-Ansicht: jeder Header ist sortierbar → "Sortiert nach"-Pille
          dort ausblenden (redundant). Der persistierte Sort bleibt als
          Default-Reihenfolge wirksam, der Header-Klick überschreibt ihn. */}
      {viewMode === 'compact' ? null : (
        <CollapsibleSeg
          label="Sortiert nach"
          value={currentSortLabel}
          defaultValue={DEFAULT_SORT_LABEL}
          items={SORT_OPTIONS.map(o => ({ label: o.label }))}
          onChange={onSortChange}
        />
      )}

      {viewMode === 'compact' ? (
        <CollapsibleSeg
          label="Gruppiert"
          value={currentTableGroupingLabel}
          items={tableGroupingItems}
          onChange={onTableGroupingChange}
          defaultValue="Keine"
          startCollapsed
        />
      ) : (
        <CollapsibleSeg
          label="Gruppiert"
          value={currentGroupingLabel}
          items={groupingItems}
          onChange={onGroupingChange}
          defaultValue="Keine"
          startCollapsed
        />
      )}
    </div>
  );
}
