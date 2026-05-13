import { useAntraegeStore, getEffectiveSortKey } from './store';
import { getSortOptionsForView, type SortKey, getSortOption } from './sort';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SortDropdown(): React.ReactElement {
  const activeView = useAntraegeStore(s => s.activeView);
  const sortByView = useAntraegeStore(s => s.sortByView);
  const setSortForView = useAntraegeStore(s => s.setSortForView);
  const currentKey = getEffectiveSortKey(activeView, sortByView);
  const currentLabel = getSortOption(currentKey).label;

  return (
    <Select
      value={currentKey}
      onValueChange={(v: string) => setSortForView(activeView, v as SortKey)}
    >
      <SelectTrigger
        size="sm"
        aria-label="Sortierung wählen"
        className="border-0 bg-transparent px-1.5 py-0 h-6 gap-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-bg-secondary)] focus-visible:ring-0 focus-visible:border-transparent shadow-none"
      >
        <span className="text-[var(--tf-text-tertiary)]">Sortiert:</span>
        <SelectValue>{currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {getSortOptionsForView(activeView).map(opt => (
          <SelectItem key={opt.key} value={opt.key} className="text-[12px]">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
