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
import { memo, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Filter } from 'lucide-react';
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
  /** Finaler Commit (mouseup) — schreibt State + localStorage. */
  onColumnWidthChange: (key: string, width: number) => void;
  /** Live-Update waehrend des Drags — mutiert DOM direkt, kein React-Re-Render. */
  onColumnWidthDrag: (key: string, width: number) => void;
}

const MIN_RESIZE_WIDTH = 60;

function SearchTableHeaderInner(props: SearchTableHeaderProps): React.ReactElement {
  const {
    columns, sortKey, sortDirection, onSort,
    columnFilters, onColumnFilterChange, filterCandidatesByColumn,
    onColumnWidthChange, onColumnWidthDrag,
  } = props;
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);

  /** Drag-Handle Mousedown — Live-DOM-Mutation per mousemove (kein React-
   *  Re-Render der 80+ Zeilen × 10+ Spalten), finaler Commit on mouseup. */
  function startResize(key: string, e: React.MouseEvent<HTMLDivElement>): void {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget.parentElement as HTMLElement | null);
    const startWidth = th ? th.offsetWidth : 100;
    const startX = e.clientX;
    let latestWidth = startWidth;

    function onMove(ev: MouseEvent): void {
      const next = Math.max(MIN_RESIZE_WIDTH, startWidth + (ev.clientX - startX));
      latestWidth = next;
      onColumnWidthDrag(key, next);
    }
    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Finaler Commit ans React-State + localStorage.
      onColumnWidthChange(key, latestWidth);
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
                borderBottom: active ? `2px solid ${ACTIVE_FILTER_COLOR}` : '0.5px solid var(--tf-border)',
                borderRight: !isLastCol ? '0.5px solid var(--tf-border)' : undefined,
                backgroundColor: active ? 'rgba(29, 158, 117, 0.08)' : undefined,
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
                    title={active ? `Filter aktiv (${columnFilters[c.key]!.size})` : 'Filter'}
                    style={active ? { color: ACTIVE_FILTER_COLOR } : { color: 'var(--tf-text-secondary)' }}
                  >
                    {active
                      ? <Filter size={12} fill="currentColor" strokeWidth={2} />
                      : <ChevronDown size={14} strokeWidth={2.25} />}
                  </button>
                )}
              </div>
              {openFilterKey === c.key && (
                <FilterDropdown
                  candidates={filterCandidatesByColumn[c.key] ?? []}
                  selected={columnFilters[c.key] ?? new Set()}
                  onApply={(values) => { onColumnFilterChange(c.key, values); setOpenFilterKey(null); }}
                  onClose={() => setOpenFilterKey(null)}
                  formatLabel={c.formatFilterLabel}
                />
              )}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={`Spaltenbreite ${c.label} anpassen`}
                onMouseDown={(e) => startResize(c.key, e)}
                className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize hover:bg-[var(--tf-border-hover)] z-10"
                style={{ touchAction: 'none' }}
              />
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

// Header rendert pro Spalte einen Sort-Button + Filter-Dropdown + Resize-Handle;
// bei Such-/Filter-/Sort-State-Updates triggert SuchSeite einen Parent-Re-Render,
// der den Header sonst komplett neu mounten wuerde. memo() entkoppelt das.
export const SearchTableHeader = memo(SearchTableHeaderInner);

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
  formatLabel?: (value: string) => string;
}

function FilterDropdown(props: FilterDropdownProps): React.ReactElement {
  const { candidates, selected, onApply, onClose, formatLabel } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  // Leerer Filter im State == "kein Filter" == semantisch "alle Werte
  // erlaubt". Im UI muss das als "alle ausgewaehlt" gespiegelt werden,
  // sonst denkt der User er habe alles abgewaehlt. Bei Apply mit
  // local == candidates schicken wir wieder ein leeres Set zurueck.
  const [local, setLocal] = useState<Set<string>>(
    () => selected.size === 0 ? new Set(candidates) : new Set(selected)
  );

  useClickOutside(ref, onClose, true);

  const display = (v: string): string => formatLabel ? formatLabel(v) : v;

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return q ? candidates.filter(v => display(v).toLowerCase().includes(q)) : candidates;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, search, formatLabel]);

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
            <span className="truncate" title={display(v)}>{display(v)}</span>
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
          onClick={() => {
            // local == candidates -> kein Filter (leeres Set)
            const next = local.size === candidates.length ? new Set<string>() : local;
            onApply(next);
          }}
          className="flex-1 px-2 py-1 text-[12px] bg-[var(--tf-text)] text-[var(--tf-bg)] rounded"
        >
          Anwenden
        </button>
      </div>
    </div>
  );
}
