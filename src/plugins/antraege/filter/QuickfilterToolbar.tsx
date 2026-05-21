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
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode } from '../store';
import { useFilteredAntraege } from '../useFilteredAntraege';
import { useFilterState } from './useFilterState';
import { GROUPING_OPTIONS, type SortKey } from '../sort';
import type { GroupingMode } from '../antragGroups';
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
  const setSortForView = useAntraegeStore(s => s.setSortForView);
  const setGroupingForView = useAntraegeStore(s => s.setGroupingForView);

  const sortKey = getEffectiveSortKey(activeView, sortByView);
  const groupingMode = getEffectiveGroupingMode(activeView, groupingByView);

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

  // Gruppieren
  const groupingItems = GROUPING_OPTIONS.map(opt => ({ label: opt.label }));
  const currentGroupingLabel =
    GROUPING_OPTIONS.find(o => o.key === groupingMode)?.label ?? GROUPING_OPTIONS[0]!.label;
  const onGroupingChange = (label: string): void => {
    const opt = GROUPING_OPTIONS.find(o => o.label === label);
    if (!opt) return;
    setGroupingForView(activeView, opt.key as GroupingMode);
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
      <CollapsibleSeg
        label="Sortiert nach"
        value={currentSortLabel}
        defaultValue={DEFAULT_SORT_LABEL}
        items={SORT_OPTIONS.map(o => ({ label: o.label }))}
        onChange={onSortChange}
      />

      <CollapsibleSeg
        label="Gruppiert"
        value={currentGroupingLabel}
        items={groupingItems}
        onChange={onGroupingChange}
        defaultValue="Keine"
        startCollapsed
      />
    </div>
  );
}
