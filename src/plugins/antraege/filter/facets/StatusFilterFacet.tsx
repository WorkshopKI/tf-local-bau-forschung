import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { groupStatusValues, type GroupedPhase } from '../statusGroups';

interface Props {
  counts: Map<string, number>;
  selected: string[];
  onChange: (values: string[]) => void;
}

const fmt = (n: number): string => n.toLocaleString('de-DE');

export function StatusFilterFacet({ counts, selected, onChange }: Props): React.ReactElement {
  const [query, setQuery] = useState('');

  const phases = useMemo(() => groupStatusValues(counts), [counts]);

  const filteredPhases = useMemo<GroupedPhase[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return phases;
    return phases
      .map(p => ({
        ...p,
        items: p.items.filter(it => it.value.toLowerCase().includes(q)),
      }))
      .filter(p => p.items.length > 0);
  }, [phases, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleStatus = (value: string): void => {
    const next = selectedSet.has(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const togglePhase = (phase: GroupedPhase): void => {
    const phaseValues = phase.items.map(it => it.value);
    const allOn = phaseValues.length > 0 && phaseValues.every(v => selectedSet.has(v));
    if (allOn) {
      onChange(selected.filter(v => !phaseValues.includes(v)));
    } else {
      const merged = new Set(selected);
      phaseValues.forEach(v => merged.add(v));
      onChange(Array.from(merged));
    }
  };

  const isEmpty = filteredPhases.length === 0;

  return (
    <div className="flex flex-col">
      {/* Status-Suche */}
      <div className="relative mb-2">
        <Search
          size={11}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Status suchen…"
          aria-label="Status suchen"
          className="w-full pl-7 pr-2 py-1.5 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12px] text-[var(--tf-text)] placeholder:text-[var(--tf-text-tertiary)] focus:outline-none focus:border-[var(--tf-text-secondary)]"
        />
      </div>

      {/* Scroll-Container — wir geben dem Status-Filter viel Hoehe, weil er
          der Haupt-Filter ist und im Default-Layout als einziger ausgeklappt
          erscheint. Andere Sektionen sind standardmaessig kollabiert, deshalb
          ist hier viel Platz verfuegbar. Cap bei 70vh haelt Header/Footer
          der Sidebar sichtbar. */}
      <div className="max-h-[70vh] overflow-y-auto -mx-1 px-1">
        {isEmpty ? (
          <div
            role="status"
            aria-live="polite"
            className="py-3 text-center text-[11.5px] text-[var(--tf-text-tertiary)]"
          >
            Kein Status gefunden
          </div>
        ) : (
          filteredPhases.map(phase => {
            const phaseValues = phase.items.map(it => it.value);
            const onCount = phaseValues.reduce(
              (n, v) => (selectedSet.has(v) ? n + 1 : n),
              0,
            );
            const totalCount = phase.items.reduce((n, it) => n + it.count, 0);
            const allSelected = phaseValues.length > 0 && onCount === phaseValues.length;
            return (
              <div key={phase.id} className="mb-2">
                {/* Phase-Header */}
                <button
                  type="button"
                  role="button"
                  aria-pressed={allSelected}
                  onClick={() => togglePhase(phase)}
                  className="w-full flex items-center gap-1.5 py-1 cursor-pointer select-none"
                  style={{ borderBottom: '0.5px solid var(--tf-border)' }}
                >
                  <span
                    className="text-[10px] font-semibold uppercase text-[var(--tf-text)] flex-1 text-left"
                    style={{ letterSpacing: '0.6px' }}
                  >
                    {phase.label}
                  </span>
                  {onCount > 0 ? (
                    <span
                      className="text-[10px] font-mono text-white px-1.5 rounded-full bg-[var(--tf-text)] tabular-nums"
                      style={{ height: 14, lineHeight: '14px' }}
                    >
                      {fmt(onCount)}
                    </span>
                  ) : null}
                  <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)] tabular-nums">
                    {fmt(totalCount)}
                  </span>
                </button>

                {/* Status-Items */}
                <div className="mt-1">
                  {phase.items.map(item => {
                    const isOn = selectedSet.has(item.value);
                    return (
                      <label
                        key={item.value}
                        className={`flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-[12.5px] ${
                          isOn
                            ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] font-medium'
                            : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-bg-secondary)]/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={() => toggleStatus(item.value)}
                          className="accent-[var(--tf-primary)]"
                        />
                        <span className="flex-1 truncate">{item.value}</span>
                        <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)] tabular-nums">
                          {fmt(item.count)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer-Hint */}
      <div className="mt-2 px-0.5 text-[11px] text-[var(--tf-text-tertiary)] leading-snug">
        Klick auf Phasen-Header wählt alle Stati der Phase.
      </div>
    </div>
  );
}
