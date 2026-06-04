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
import { memo, useState } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import { SortIcon, ColumnFilterDropdown } from '@/components/data-table';
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
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(null);

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
                    onClick={(e) => {
                      if (openFilterKey === c.key) {
                        setOpenFilterKey(null);
                        setFilterAnchor(null);
                      } else {
                        setFilterAnchor(e.currentTarget);
                        setOpenFilterKey(c.key);
                      }
                    }}
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
                <ColumnFilterDropdown
                  candidates={filterCandidatesByColumn[c.key] ?? []}
                  selected={columnFilters[c.key] ?? new Set()}
                  onApply={(values) => {
                    onColumnFilterChange(c.key, values);
                    setOpenFilterKey(null);
                    setFilterAnchor(null);
                  }}
                  onClose={() => { setOpenFilterKey(null); setFilterAnchor(null); }}
                  formatLabel={c.formatFilterLabel}
                  anchorEl={filterAnchor}
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
// Das Filter-Dropdown ist generisch nach @/components/data-table ausgelagert
// (ColumnFilterDropdown) — identisches Verhalten, von der Feedback-Liste mitgenutzt.
export const SearchTableHeader = memo(SearchTableHeaderInner);
