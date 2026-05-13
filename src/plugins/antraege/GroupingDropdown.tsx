import { useAntraegeStore, getEffectiveGroupingMode, getEffectiveSortKey } from './store';
import {
  GROUPING_OPTIONS,
  getGroupingOption,
  sortDisablesGrouping,
} from './sort';
import type { GroupingMode } from './antragGroups';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Dropdown zur Auswahl der Listen-Gruppierung (Verbund / Netzwerk / Keine).
 * Bei aktivem Antragsteller-Sort wird der Dropdown disabled — Antragsteller-
 * Reihen sollen nicht durch Cluster-Header zerrissen werden.
 */
export function GroupingDropdown(): React.ReactElement {
  const activeView = useAntraegeStore(s => s.activeView);
  const groupingByView = useAntraegeStore(s => s.groupingByView);
  const sortByView = useAntraegeStore(s => s.sortByView);
  const setGroupingForView = useAntraegeStore(s => s.setGroupingForView);

  const sortKey = getEffectiveSortKey(activeView, sortByView);
  const disabled = sortDisablesGrouping(sortKey);
  const currentKey = disabled ? 'none' : getEffectiveGroupingMode(activeView, groupingByView);
  const currentLabel = getGroupingOption(currentKey).label;

  const title = disabled
    ? 'Gruppierung deaktiviert bei Antragsteller-Sort'
    : undefined;

  return (
    <Select
      value={currentKey}
      onValueChange={(v: string) => setGroupingForView(activeView, v as GroupingMode)}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label="Gruppierung wählen"
        title={title}
        className="border-0 bg-transparent px-1.5 py-0 h-6 gap-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-bg-secondary)] focus-visible:ring-0 focus-visible:border-transparent shadow-none disabled:opacity-50"
      >
        <span className="text-[var(--tf-text-tertiary)]">Gruppiert:</span>
        <SelectValue>{currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {GROUPING_OPTIONS.map(opt => (
          <SelectItem key={opt.key} value={opt.key} className="text-[12px]">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
