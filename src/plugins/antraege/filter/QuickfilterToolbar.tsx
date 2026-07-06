/**
 * Quickfilter-Toolbar für die Förderanträge-Liste — **Akkordeon** in EINER
 * Zeile (Journey-Paket 2 Phase 2).
 *
 * Segmente (`CollapsibleSeg`, controlled): Status · Antragstyp · PreCheck ·
 * (nur List-/Karten-Ansicht) Sortiert-nach. Es ist immer höchstens **eine**
 * Pille offen — der Zustand ist ein einzelner `QuickfilterSegId | null`, pro
 * View persistiert (`quickfilterExpanded.ts`). Öffnen einer Pille schließt die
 * jeweils andere implizit.
 *
 * Filter-Backend:
 * - Status  → `useFilterState` (`system-status`, `phaseQuickfilter.ts`)
 * - Antragstyp → `useFilterState` (`system-vb-phase`, `kategorieQuickfilter.ts`)
 * - PreCheck → eigener Store-Slot `precheckBucket` (abgeleitete Klassifikation,
 *   kein Filter-Chip, siehe `precheckQuickfilter.ts`)
 * - Sort → `useAntraegeStore` (per-View)
 *
 * Die **Gruppieren**-Steuerung ist seit Phase 2 kein Segment mehr, sondern ein
 * Dropdown rechts in `AntraegeMain` (`GruppierenDropdown`).
 */
import { useEffect, useMemo, useState } from 'react';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveViewMode } from '../store';
import { useFilteredAntraege } from '../useFilteredAntraege';
import { useFilterState } from './useFilterState';
import { type SortKey } from '../sort';
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
import { getPrecheckItems, asPrecheckBucket } from './precheckQuickfilter';
import {
  loadExpandedSeg,
  saveExpandedSeg,
  toggleExpandedSeg,
  type QuickfilterSegId,
} from './quickfilterExpanded';

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
  const setSortForView = useAntraegeStore(s => s.setSortForView);

  const sortKey = getEffectiveSortKey(activeView, sortByView);
  // Tabellen-Ansicht ("compact") ist flach → jeder Spaltenkopf sortiert selbst,
  // daher das "Sortiert nach"-Segment dort ausblenden.
  const viewMode = useAntraegeStore(s => getEffectiveViewMode(s.activeView, s.viewModeByTab));

  const active = useFilterState(s => s.active);
  const setActiveValue = useFilterState(s => s.setActiveValue);
  const clearFilter = useFilterState(s => s.clearFilter);

  const precheckBucket = useAntraegeStore(s => s.precheckBucket);
  const setPrecheckBucket = useAntraegeStore(s => s.setPrecheckBucket);

  // Akkordeon-Zustand: höchstens ein offenes Segment, pro View persistiert.
  const [expandedSeg, setExpandedSeg] = useState<QuickfilterSegId | null>(() => loadExpandedSeg(activeView));
  useEffect(() => {
    setExpandedSeg(loadExpandedSeg(activeView));
  }, [activeView]);
  const handleToggle = (seg: QuickfilterSegId): void => {
    setExpandedSeg(prev => {
      const next = toggleExpandedSeg(prev, seg);
      saveExpandedSeg(activeView, next);
      return next;
    });
  };

  // Phase
  const phaseItems = useMemo(() => getPhaseItems(countBase), [countBase]);
  const phase = getPhaseFromActive(active);
  const onPhaseChange = (label: string): void => {
    applyPhase(label as PhaseLabel, (id, v) => setActiveValue(id, v), clearFilter);
  };

  // Antragstyp (Kategorie)
  const kategorieItems = useMemo(() => getKategorieItems(countBase), [countBase]);
  const kategorie = getKategorieFromActive(active);
  const onKategorieChange = (label: string): void => {
    applyKategorie(label as KategorieLabel, (id, v) => setActiveValue(id, v), clearFilter);
  };

  // PreCheck (abgeleiteter Bucket, eigener Store-Slot)
  const precheckItems = useMemo(() => getPrecheckItems(countBase), [countBase]);
  const onPrecheckChange = (label: string): void => {
    setPrecheckBucket(asPrecheckBucket(label));
  };

  // Sortiert nach (nur List-/Karten-Ansicht)
  const currentSortLabel =
    SORT_OPTIONS.find(o => o.key === sortKey)?.label ?? DEFAULT_SORT_LABEL;
  const onSortChange = (label: string): void => {
    const opt = SORT_OPTIONS.find(o => o.label === label);
    if (!opt) return;
    setSortForView(activeView, opt.key);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CollapsibleSeg
        label="Status"
        value={phase}
        items={phaseItems}
        onChange={onPhaseChange}
        expanded={expandedSeg === 'status'}
        onExpandToggle={() => handleToggle('status')}
      />
      <CollapsibleSeg
        label="Antragstyp"
        value={kategorie}
        items={kategorieItems}
        onChange={onKategorieChange}
        expanded={expandedSeg === 'antragstyp'}
        onExpandToggle={() => handleToggle('antragstyp')}
      />
      <CollapsibleSeg
        label="PreCheck"
        value={precheckBucket}
        items={precheckItems}
        onChange={onPrecheckChange}
        expanded={expandedSeg === 'precheck'}
        onExpandToggle={() => handleToggle('precheck')}
      />
      {viewMode === 'compact' ? null : (
        <CollapsibleSeg
          label="Sortiert nach"
          value={currentSortLabel}
          defaultValue={DEFAULT_SORT_LABEL}
          items={SORT_OPTIONS.map(o => ({ label: o.label }))}
          onChange={onSortChange}
          expanded={expandedSeg === 'sort'}
          onExpandToggle={() => handleToggle('sort')}
        />
      )}
    </div>
  );
}
