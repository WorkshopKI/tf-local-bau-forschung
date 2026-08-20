import { useMemo, useState } from 'react';
import type { FilterDefinition } from '@/core/services/csv';
import { PinNadel } from '../PinNadel';

interface Props {
  def: FilterDefinition;
  counts: Map<string, number>;
  selected: string;
  valueLabels?: Record<string, string>;
  onChange: (value: string) => void;
}

export function SingleSelectFacet({ def, counts, selected, valueLabels, onChange }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const values = useMemo(() => {
    const manual = def.config.werte_quelle === 'manual' ? def.config.manuelle_werte ?? [] : null;
    let keys = manual ? manual.slice() : Array.from(counts.keys());
    // Der gewählte Wert bleibt stehen, auch wenn eine andere Achse ihn gerade
    // auf null filtert — sonst wäre die Auswahl an ihrer eigenen Stelle nicht
    // mehr zurückzunehmen (v4.121, wie in `MultiSelectFacet`).
    if (selected && !keys.includes(selected)) keys.push(selected);
    const order = def.config.werte_reihenfolge ?? 'haeufigkeit';
    if (order === 'alphabetisch') {
      keys.sort((a, b) => a.localeCompare(b));
    } else if (order === 'haeufigkeit') {
      keys.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
    } else if (order === 'numerisch_absteigend') {
      keys.sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        const aNum = Number.isFinite(na);
        const bNum = Number.isFinite(nb);
        if (aNum && bNum) return nb - na;
        if (aNum) return -1;
        if (bNum) return 1;
        return a.localeCompare(b);
      });
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      keys = keys.filter(k => k.toLowerCase().includes(q));
    }
    if (def.config.leer_bucket && !keys.includes('(leer)') && counts.has('(leer)')) {
      keys.push('(leer)');
    }
    return keys;
  }, [def, counts, query, selected]);

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
        <label
          className="flex items-center justify-between gap-2 py-1 text-[12.5px] cursor-pointer hover:bg-[var(--tf-hover)] rounded px-1.5"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <input
              type="radio"
              name={def.id}
              checked={selected === ''}
              onChange={() => onChange('')}
              className="accent-[var(--tf-primary)]"
            />
            <span className="truncate text-[var(--tf-text-secondary)] italic">Alle</span>
          </div>
        </label>
        {values.map(v => {
          const n = counts.get(v) ?? 0;
          const label = valueLabels?.[v];
          return (
            <label
              key={v}
              className="group/pin flex items-center justify-between gap-2 py-1 text-[12.5px] cursor-pointer hover:bg-[var(--tf-hover)] rounded px-1.5"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <input
                  type="radio"
                  name={def.id}
                  checked={selected === v}
                  onChange={() => onChange(v)}
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
              <PinNadel
                pin={{ art: 'wert', filterId: def.id, wert: v }}
                bezeichnung={`${def.name} ${label ?? v}`}
              />
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
