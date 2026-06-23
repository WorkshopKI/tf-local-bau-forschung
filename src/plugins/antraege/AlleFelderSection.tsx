import { useMemo, useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { CsvSchema } from '@/core/services/csv/types';
import { type DisplayGroup, type DisplayRow } from './buildDisplayRows';

type Mode = 'with_values' | 'empty_only' | 'all';

interface Props {
  groups: DisplayGroup[];
  schemas: CsvSchema[];
  sourceNames: Record<string, string>;
  historyCounts: Record<string, number>;
  onOpenHistory: (field: string) => void;
  /** Header-Darstellung: 'compact' (11px uppercase, Default — z.B. im TV-Detail
   *  zwischen anderen Sub-Sektionen) oder 'section' (16px medium, wie die
   *  Top-Level-Abschnitte der Verbund-Detailseite). */
  headerVariant?: 'compact' | 'section';
}

function isEmptyRow(r: DisplayRow): boolean {
  if (r.rawValue === null || r.rawValue === undefined) return true;
  if (typeof r.rawValue === 'string' && r.rawValue.trim() === '') return true;
  return false;
}

const PILL_CLASS_ACTIVE = 'px-2.5 py-1 rounded-full text-[11.5px] bg-[var(--tf-text)] text-[var(--tf-bg)]';
const PILL_CLASS_IDLE = 'px-2.5 py-1 rounded-full text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-bg-secondary)] cursor-pointer';

export function AlleFelderSection({
  groups,
  historyCounts,
  onOpenHistory,
  headerVariant = 'compact',
}: Props): React.ReactElement {
  const [mode, setMode] = useState<Mode>('with_values');
  const [search, setSearch] = useState('');
  // Einklappbar (default zu) — bei 120–300 Feldern sonst endloses Scrollen bis zu
  // den darunterliegenden Sektionen. Wahl pro Browser persistiert.
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('teamflow_antrag_allefelder_open') === '1'; } catch { return false; }
  });
  const toggleOpen = (): void => {
    setOpen(prev => {
      const next = !prev;
      try { localStorage.setItem('teamflow_antrag_allefelder_open', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const allRows = useMemo(() => groups.flatMap(g => g.rows), [groups]);
  const totalCount = allRows.length;
  const withValuesCount = useMemo(() => allRows.filter(r => !isEmptyRow(r)).length, [allRows]);
  const emptyCount = totalCount - withValuesCount;

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .map(g => ({
        ...g,
        rows: g.rows.filter(r => {
          if (mode === 'with_values' && isEmptyRow(r)) return false;
          if (mode === 'empty_only' && !isEmptyRow(r)) return false;
          if (q && !r.label.toLowerCase().includes(q) && !r.field.toLowerCase().includes(q)) return false;
          return true;
        }),
      }))
      .filter(g => g.rows.length > 0);
  }, [groups, mode, search]);

  const isGroupedView = filteredGroups.length > 1 || filteredGroups.some(g => g.path.length > 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <button type="button" onClick={toggleOpen} aria-expanded={open} className="flex items-center gap-1.5 cursor-pointer">
          <ChevronRight
            size={headerVariant === 'section' ? 15 : 13}
            className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <h3 className={headerVariant === 'section'
            ? 'text-[16px] font-medium text-[var(--tf-text)]'
            : 'text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]'}>Alle Felder</h3>
        </button>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {totalCount.toLocaleString('de-DE')} Felder gesamt · {withValuesCount.toLocaleString('de-DE')} mit Werten
        </span>
      </div>

      {!open ? null : (
      <>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setMode('with_values')}
          className={mode === 'with_values' ? PILL_CLASS_ACTIVE : PILL_CLASS_IDLE}
        >
          Mit Werten <span className={mode === 'with_values' ? '' : 'text-[var(--tf-text-tertiary)]'}>{withValuesCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('empty_only')}
          className={mode === 'empty_only' ? PILL_CLASS_ACTIVE : PILL_CLASS_IDLE}
        >
          Leer ausgeblendet <span className={mode === 'empty_only' ? '' : 'text-[var(--tf-text-tertiary)]'}>{emptyCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('all')}
          className={mode === 'all' ? PILL_CLASS_ACTIVE : PILL_CLASS_IDLE}
        >
          Alle <span className={mode === 'all' ? '' : 'text-[var(--tf-text-tertiary)]'}>{totalCount}</span>
        </button>
        <div className="relative ml-auto w-[220px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none" />
          <Input
            placeholder="Feld suchen …"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 h-8"
          />
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="py-6 text-center text-[12px] text-[var(--tf-text-tertiary)] italic">
          Keine Felder matchen die aktuellen Filter.
        </div>
      ) : (
        <div className="space-y-5">
          {filteredGroups.map(group => (
            <div key={group.label}>
              {isGroupedView ? (
                <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
                  {group.label}
                </div>
              ) : null}
              <div>
                {group.rows.map((r, i) => (
                  <div
                    key={r.field}
                    className="grid grid-cols-[200px_1fr] gap-3 py-2"
                    style={{ borderTop: i === 0 ? undefined : '0.5px solid var(--tf-border)' }}
                  >
                    <div className="text-[12.5px] text-[var(--tf-text-secondary)] pt-px">{r.label}</div>
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className={`flex-1 min-w-0 text-[12.5px] ${isEmptyRow(r) ? 'text-[var(--tf-text-tertiary)] italic' : 'text-[var(--tf-text)]'}`}>
                        {r.value}
                      </span>
                      {historyCounts[r.field] ? (
                        <button
                          onClick={() => onOpenHistory(r.field)}
                          className="text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-primary)] cursor-pointer shrink-0"
                          aria-label={`${historyCounts[r.field]} Änderungen anzeigen`}
                          title={`${historyCounts[r.field]} ${historyCounts[r.field] === 1 ? 'Änderung' : 'Änderungen'}`}
                        >
                          ↻ {historyCounts[r.field]}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
