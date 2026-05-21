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
import { ArrowDownUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode } from '../store';
import { useFilterState } from './useFilterState';
import { GROUPING_OPTIONS, type SortKey } from '../sort';
import type { GroupingMode } from '../antragGroups';
import { CollapsibleSeg, SegGroup } from './CollapsibleSeg';
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

const EXTRA_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'frist_asc', label: 'Frist (kürzeste zuerst)' },
  { key: 'akronym_asc', label: 'Akronym (A→Z)' },
  { key: 'antragsteller_asc', label: 'Antragsteller (A→Z)' },
];

const EXTRA_SORT_KEYS = new Set<SortKey>(EXTRA_SORT_OPTIONS.map(o => o.key));

const ANTRAGSDATUM_PLACEHOLDER = '—';

export function QuickfilterToolbar(): React.ReactElement {
  const antraege = useAntraegeStore(s => s.antraege);
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
  const phaseItems = useMemo(() => getPhaseItems(antraege), [antraege]);
  const phase = getPhaseFromActive(active);
  const onPhaseChange = (label: string): void => {
    applyPhase(label as PhaseLabel, (id, v) => setActiveValue(id, v), clearFilter);
  };

  // Kategorie
  const kategorieItems = useMemo(() => getKategorieItems(antraege), [antraege]);
  const kategorie = getKategorieFromActive(active);
  const onKategorieChange = (label: string): void => {
    applyKategorie(label as KategorieLabel, (id, v) => setActiveValue(id, v), clearFilter);
  };

  // Antragsdatum
  const antragsdatumValue =
    sortKey === 'antrag_desc' ? 'Neueste zuerst'
      : sortKey === 'antrag_asc' ? 'Älteste zuerst'
        : ANTRAGSDATUM_PLACEHOLDER;
  const onAntragsdatumChange = (label: string): void => {
    setSortForView(activeView, label === 'Älteste zuerst' ? 'antrag_asc' : 'antrag_desc');
  };

  // Extra-Sort (Frist / Akronym / Antragsteller)
  const extraSortValue: SortKey | '' = EXTRA_SORT_KEYS.has(sortKey) ? sortKey : '';
  const onExtraSortChange = (v: string): void => {
    if (v === '') return;
    setSortForView(activeView, v as SortKey);
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
        label="Antragsdatum"
        value={antragsdatumValue}
        defaultValue="Neueste zuerst"
        items={[{ label: 'Neueste zuerst' }, { label: 'Älteste zuerst' }]}
        onChange={onAntragsdatumChange}
      />

      <ExtraSortSelect value={extraSortValue} onChange={onExtraSortChange} />

      <div className="flex items-center gap-2 ml-2">
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">Gruppiert:</span>
        <SegGroup
          items={groupingItems}
          value={currentGroupingLabel}
          onChange={onGroupingChange}
          ariaLabel="Gruppierung"
        />
      </div>
    </div>
  );
}

function ExtraSortSelect({
  value,
  onChange,
}: {
  value: SortKey | '';
  onChange: (v: string) => void;
}): React.ReactElement {
  const active = value !== '';
  const title = active
    ? `Sortiert nach: ${EXTRA_SORT_OPTIONS.find(o => o.key === value)?.label ?? ''}`
    : 'Andere Sortierung';
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        aria-label="Weitere Sortierung"
        title={title}
        className={`h-8 gap-1 ${
          active
            ? 'px-2 bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
            : 'w-8 p-0 gap-0 justify-center bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
        } focus-visible:ring-0 focus-visible:border-transparent shadow-none [&_svg.lucide-chevron-down]:hidden text-[12px]`}
        style={{ border: '0.5px solid var(--tf-border)', borderRadius: '8px' }}
      >
        <ArrowDownUp size={13} />
        {/* SelectValue MUSS strukturell drin sein — Radix's Trigger nutzt es als
            Click-Anchor; conditional rendering hat den Klick komplett blockiert.
            Im inactive-State (value=undefined) rendert es nichts und nimmt keinen
            Platz ein, also kein visuelles Problem. */}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {EXTRA_SORT_OPTIONS.map(opt => (
          <SelectItem key={opt.key} value={opt.key} className="text-[12px]">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
