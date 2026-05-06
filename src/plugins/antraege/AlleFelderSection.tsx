import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
  sourceNames,
  historyCounts,
  onOpenHistory,
}: Props): React.ReactElement {
  const [mode, setMode] = useState<Mode>('with_values');
  const [search, setSearch] = useState('');

  // Plain-Liste (alle Rows ueber alle Gruppen) fuer die Counts.
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
  const displayedCount = filteredGroups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Alle Felder</h3>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {displayedCount.toLocaleString('de-DE')} von {totalCount.toLocaleString('de-DE')} Feldern
        </span>
      </div>

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
        <div className="space-y-4">
          {filteredGroups.map(group => (
            <div
              key={group.label}
              className="overflow-hidden"
              style={{ border: '0.5px solid var(--tf-border)', borderRadius: 12 }}
            >
              {isGroupedView ? (
                <div
                  className="px-3 py-2 text-[12.5px] font-medium text-[var(--tf-text)]"
                  style={{ borderBottom: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }}
                >
                  {group.label}
                </div>
              ) : null}
              <table className="w-full text-[13px]">
                <tbody>
                  {group.rows.map((r, i) => (
                    <tr key={r.field} style={i > 0 ? { borderTop: '0.5px solid var(--tf-border)' } : undefined}>
                      <td className="p-3 align-top text-[var(--tf-text-secondary)] w-[220px]">{r.label}</td>
                      <td className="p-3 align-top">
                        <div className={isEmptyRow(r) ? 'text-[var(--tf-text-tertiary)] italic' : ''}>{r.value}</div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--tf-text-tertiary)]">
                          <span>Quelle: {r.sourceSchemaId ? (sourceNames[r.sourceSchemaId] ?? r.sourceSchemaId) : '—'}</span>
                          {historyCounts[r.field] ? (
                            <button
                              onClick={() => onOpenHistory(r.field)}
                              className="text-[var(--tf-primary)] hover:underline"
                            >
                              ↻ {historyCounts[r.field]} {historyCounts[r.field] === 1 ? 'Änderung' : 'Änderungen'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
