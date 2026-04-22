import { useMemo, useState } from 'react';
import type { FilterDefinition } from '@/core/services/csv';

interface Props {
  def: FilterDefinition;
  counts: Map<string, number>;
  selected: string[];
  valueLabels?: Record<string, string>;
  onChange: (values: string[]) => void;
}

export function MultiSelectFacet({ def, counts, selected, valueLabels, onChange }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const values = useMemo(() => {
    const manual = def.config.werte_quelle === 'manual' ? def.config.manuelle_werte ?? [] : null;
    let keys = manual
      ? manual.slice()
      : Array.from(counts.keys());

    const order = def.config.werte_reihenfolge ?? 'haeufigkeit';
    if (order === 'alphabetisch') {
      keys.sort((a, b) => a.localeCompare(b));
    } else if (order === 'haeufigkeit') {
      keys.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      keys = keys.filter(k => k.toLowerCase().includes(q));
    }
    if (def.config.leer_bucket && !keys.includes('(leer)') && counts.has('(leer)')) {
      keys.push('(leer)');
    }
    return keys;
  }, [def, counts, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const toggle = (v: string): void => {
    const next = selectedSet.has(v)
      ? selected.filter(s => s !== v)
      : [...selected, v];
    onChange(next);
  };

  const showSearch = values.length > 10;

  return (
    <div className="flex flex-col gap-1">
      {showSearch ? (
        <input
          type="text"
          placeholder="Werte suchen…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="mb-1 px-2 py-1 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12px]"
        />
      ) : null}
      <div className="max-h-[240px] overflow-y-auto">
        {values.map(v => {
          const n = counts.get(v) ?? 0;
          const label = valueLabels?.[v];
          return (
            <label
              key={v}
              className="flex items-center justify-between gap-2 py-1 text-[12.5px] cursor-pointer hover:bg-[var(--tf-bg-secondary)] rounded px-1.5"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={selectedSet.has(v)}
                  onChange={() => toggle(v)}
                  className="accent-[var(--tf-primary)]"
                />
                <span className="truncate text-[var(--tf-text)]">
                  {label ? (
                    <>
                      {label}
                      <span className="ml-1 text-[11px] text-[var(--tf-text-tertiary)] font-mono">({v})</span>
                    </>
                  ) : v}
                </span>
              </div>
              <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">{n}</span>
            </label>
          );
        })}
        {values.length === 0 ? (
          <div className="py-2 text-center text-[11.5px] text-[var(--tf-text-tertiary)]">
            Keine Werte
          </div>
        ) : null}
      </div>
    </div>
  );
}
