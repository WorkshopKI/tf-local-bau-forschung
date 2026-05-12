import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { groupStatusValues, type GroupedPhase, type PhaseId } from '../statusGroups';

interface Props {
  counts: Map<string, number>;
  selected: string[];
  onChange: (values: string[]) => void;
}

const fmt = (n: number): string => n.toLocaleString('de-DE');

/**
 * Status-Filter mit Phasen-Akkordeon (Design Option 7).
 *
 * Jede Phase ist eine eigene kollabierbare Row mit linker Akzent-Border
 * wenn die Phase aktive Filter hat. Default-Open: alle Phasen, die beim
 * Mount mindestens einen aktiven Status haben. Manuelles Schließen wird in
 * lokalem State gehalten (nicht persistiert).
 *
 * Shift-Klick auf eine Phase-Header toggelt alle Status-Werte der Phase
 * (übernommen aus der Vor-Akkordeon-Version). Normaler Klick togglet
 * Expand/Collapse.
 */
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

  const initialOpen = useMemo<Set<PhaseId>>(() => {
    const set = new Set<PhaseId>();
    for (const p of phases) {
      if (p.items.some(it => selectedSet.has(it.value))) set.add(p.id);
    }
    return set;
    // Initial-Berechnung läuft nur einmal beim Mount — danach übernimmt
    // der User die Steuerung via Klick. Bewusst keine Dep-Liste, damit
    // ein Außen-Reset nicht Phasen aufpoppen lässt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [openPhases, setOpenPhases] = useState<Set<PhaseId>>(initialOpen);

  // Wenn Such-Query gesetzt ist: alle gematchten Phasen auch öffnen, damit
  // der Treffer sichtbar wird. Beim Leeren des Querys NICHT automatisch
  // wieder schließen — User-State respektieren.
  useEffect(() => {
    if (!query.trim()) return;
    setOpenPhases(prev => {
      const next = new Set(prev);
      for (const p of filteredPhases) next.add(p.id);
      return next;
    });
  }, [query, filteredPhases]);

  const toggleOpen = (id: PhaseId): void => {
    setOpenPhases(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleStatus = (value: string): void => {
    const next = selectedSet.has(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const togglePhaseSelection = (phase: GroupedPhase): void => {
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

  const handlePhaseHeaderClick = (phase: GroupedPhase, e: React.MouseEvent): void => {
    if (e.shiftKey) {
      togglePhaseSelection(phase);
      return;
    }
    toggleOpen(phase.id);
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

      {/* Phasen-Akkordeon */}
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
            const isOpen = openPhases.has(phase.id);
            const hasActive = onCount > 0;

            return (
              <div key={phase.id} className="mb-0.5">
                {/* Phase-Header (kollabierbar) */}
                <button
                  type="button"
                  onClick={e => handlePhaseHeaderClick(phase, e)}
                  title="Klick: aufklappen · Shift-Klick: alle Stati der Phase togglen"
                  className="w-full flex items-center gap-1.5 cursor-pointer select-none hover:bg-[var(--tf-hover)] rounded-sm"
                  style={{
                    padding: '7px 6px',
                    borderLeft: `2px solid ${hasActive ? 'var(--tf-primary)' : 'transparent'}`,
                  }}
                >
                  <ChevronRight
                    size={12}
                    className="shrink-0 text-[var(--tf-text-tertiary)]"
                    style={{
                      transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                  />
                  <span
                    className={`text-[11px] font-medium uppercase ${
                      hasActive ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'
                    }`}
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {phase.label}
                  </span>
                  {hasActive ? (
                    <span
                      className="text-[11px] font-medium tabular-nums"
                      style={{ color: 'var(--tf-primary)' }}
                    >
                      {onCount}/{phase.items.length}
                    </span>
                  ) : null}
                  <span className="flex-1" />
                  <span
                    className={`text-[11px] tabular-nums ${
                      hasActive ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'
                    }`}
                  >
                    {fmt(totalCount)}
                  </span>
                </button>

                {/* Status-Items (offen) */}
                {isOpen ? (
                  <div style={{ paddingLeft: 18, paddingTop: 2, paddingBottom: 4 }}>
                    {phase.items.map(item => {
                      const isOn = selectedSet.has(item.value);
                      return (
                        <label
                          key={item.value}
                          className={`flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-[12.5px] ${
                            isOn
                              ? 'text-[var(--tf-text)] font-medium'
                              : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => toggleStatus(item.value)}
                            className="accent-[var(--tf-primary)]"
                          />
                          <span className="flex-1 truncate">{item.value}</span>
                          <span
                            className={`text-[11px] tabular-nums ${
                              isOn ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'
                            }`}
                          >
                            {fmt(item.count)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* Footer-Hint */}
      <div className="mt-2 px-0.5 text-[11px] text-[var(--tf-text-tertiary)] leading-snug">
        Shift-Klick auf Phase wählt alle Stati der Phase.
      </div>
    </div>
  );
}
