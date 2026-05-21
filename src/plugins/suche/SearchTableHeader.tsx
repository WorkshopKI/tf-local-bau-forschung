/**
 * Spaltenheader fuer die Suchtabelle. Pro Spalte:
 *  - Klick auf Label → Sortier-Toggle (unsorted → asc → desc → unsorted)
 *  - Optional: Chevron-Button → Filter-Dropdown mit Checkbox-Liste
 *
 * Filter-Dropdown ist absolut positioniert relativ zum `<th>`. Constraint
 * aus dem Spec: kein `position: fixed`. Klick ausserhalb schliesst ohne
 * Anwenden (lokaler State im Dropdown wird verworfen).
 *
 * Eindeutige Werte fuer den Filter kommen aus dem PRE-column-filter-Set
 * — sonst kollabieren die Choices: wenn der User auf Programm "X" gefiltert
 * hat, sollen die Status-Optionen weiterhin ALLE Stati zeigen die in X
 * vorkommen, nicht nur die schon angewendeten.
 */
import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';
import type { SearchColumn } from './columns';

const ACTIVE_FILTER_COLOR = '#1D9E75';

export interface SearchTableHeaderProps {
  columns: SearchColumn[];
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (key: string) => void;
  columnFilters: Record<string, Set<string>>;
  onColumnFilterChange: (key: string, values: Set<string>) => void;
  /** Pre-column-filter-Set: alle pillFiltered Ergebnisse (vor Spaltenfiltern). */
  filterCandidatesByColumn: Record<string, string[]>;
  onColumnWidthChange: (key: string, width: number) => void;
}

const MIN_RESIZE_WIDTH = 60;

export function SearchTableHeader(props: SearchTableHeaderProps): React.ReactElement {
  const { columns, sortKey, sortDirection, onSort, columnFilters, onColumnFilterChange, filterCandidatesByColumn, onColumnWidthChange } = props;
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);

  /** Drag-Handle Mousedown — startet globalen Mousemove/Mouseup-Listener, der
   *  die Spalte auf die neue Breite zieht. Min-Width: 60px. Pattern analog zu
   *  `AntraegePage.tsx`'s Filter-Panel-Resize. */
  function startResize(key: string, e: React.MouseEvent<HTMLDivElement>): void {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget.parentElement as HTMLElement | null);
    const startWidth = th ? th.offsetWidth : 100;
    const startX = e.clientX;

    function onMove(ev: MouseEvent): void {
      const next = Math.max(MIN_RESIZE_WIDTH, startWidth + (ev.clientX - startX));
      onColumnWidthChange(key, next);
    }
    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  return (
    <thead>
      <tr style={{ backgroundColor: 'var(--tf-bg-secondary)' }}>
        {columns.map((c, i) => {
          const active = columnFilters[c.key]?.size ? columnFilters[c.key]!.size > 0 : false;
          const isLastCol = i === columns.length - 1;
          return (
            <th
              key={c.key}
              className="text-left px-3 py-2 text-[12px] font-medium text-[var(--tf-text-secondary)] relative"
              style={{
                borderBottom: '0.5px solid var(--tf-border)',
                borderRight: !isLastCol ? '0.5px solid var(--tf-border)' : undefined,
              }}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => c.sortable && onSort(c.key)}
                  className={`flex items-center gap-1 ${c.sortable ? 'cursor-pointer hover:text-[var(--tf-text)]' : 'cursor-default'}`}
                  disabled={!c.sortable}
                >
                  <span>{c.label}</span>
                  {c.sortable && <SortIcon active={sortKey === c.key} direction={sortDirection} />}
                </button>
                {c.filterable && (
                  <button
                    type="button"
                    onClick={() => setOpenFilterKey(prev => prev === c.key ? null : c.key)}
                    className="ml-auto p-0.5 hover:bg-[var(--tf-hover)] rounded"
                    title="Filter"
                    style={active ? { color: ACTIVE_FILTER_COLOR } : { color: 'var(--tf-text-tertiary)' }}
                  >
                    <ChevronDown size={12} />
                  </button>
                )}
              </div>
              {openFilterKey === c.key && (
                <FilterDropdown
                  candidates={filterCandidatesByColumn[c.key] ?? []}
                  selected={columnFilters[c.key] ?? new Set()}
                  onApply={(values) => { onColumnFilterChange(c.key, values); setOpenFilterKey(null); }}
                  onClose={() => setOpenFilterKey(null)}
                />
              )}
              {!isLastCol && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Spaltenbreite ${c.label} anpassen`}
                  onMouseDown={(e) => startResize(c.key, e)}
                  className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize hover:bg-[var(--tf-border-hover)] z-10"
                  style={{ touchAction: 'none' }}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }): React.ReactElement {
  if (!active) return <ArrowUpDown size={11} style={{ color: 'var(--tf-text-tertiary)' }} />;
  return direction === 'asc'
    ? <ArrowUp size={11} style={{ color: 'var(--tf-text)' }} />
    : <ArrowDown size={11} style={{ color: 'var(--tf-text)' }} />;
}

interface FilterDropdownProps {
  candidates: string[];
  selected: Set<string>;
  onApply: (values: Set<string>) => void;
  onClose: () => void;
}

function FilterDropdown(props: FilterDropdownProps): React.ReactElement {
  const { candidates, selected, onApply, onClose } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [local, setLocal] = useState<Set<string>>(() => new Set(selected));

  useClickOutside(ref, onClose, true);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return q ? candidates.filter(v => v.toLowerCase().includes(q)) : candidates;
  }, [candidates, search]);

  const allChecked = visible.length > 0 && visible.every(v => local.has(v));

  function toggle(value: string): void {
    const next = new Set(local);
    if (next.has(value)) next.delete(value); else next.add(value);
    setLocal(next);
  }

  function toggleAll(): void {
    const next = new Set(local);
    if (allChecked) {
      for (const v of visible) next.delete(v);
    } else {
      for (const v of visible) next.add(v);
    }
    setLocal(next);
  }

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-[100] w-[240px] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] shadow-md"
      style={{ border: '0.5px solid var(--tf-border)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="p-2" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Werte suchen..."
          className="w-full px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded outline-none"
          style={{ border: '0.5px solid var(--tf-border)' }}
          autoFocus
        />
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        <label className="flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer hover:bg-[var(--tf-hover)] font-medium text-[var(--tf-text)]">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          <span>(Alle auswaehlen)</span>
        </label>
        {visible.length === 0 && (
          <p className="px-3 py-2 text-[11px] text-[var(--tf-text-tertiary)]">Keine Werte</p>
        )}
        {visible.map(v => (
          <label
            key={v}
            className="flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer hover:bg-[var(--tf-hover)] text-[var(--tf-text)]"
          >
            <input type="checkbox" checked={local.has(v)} onChange={() => toggle(v)} />
            <span className="truncate" title={v}>{v}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 p-2" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <button
          type="button"
          onClick={() => { setLocal(new Set()); onApply(new Set()); }}
          className="flex-1 px-2 py-1 text-[12px] text-[var(--tf-text-secondary)] rounded hover:bg-[var(--tf-hover)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Zuruecksetzen
        </button>
        <button
          type="button"
          onClick={() => onApply(local)}
          className="flex-1 px-2 py-1 text-[12px] bg-[var(--tf-text)] text-[var(--tf-bg)] rounded"
        >
          Anwenden
        </button>
      </div>
    </div>
  );
}
