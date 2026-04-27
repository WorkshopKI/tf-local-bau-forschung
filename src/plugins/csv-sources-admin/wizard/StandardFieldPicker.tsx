import { useEffect, useMemo, useRef, useState } from 'react';
import { Zap, Search } from 'lucide-react';
import type { LabelSuggestion } from '@/core/services/csv';
import type { PerColumnDecision } from './useCsvWizardState';

interface Props {
  /** Standardfeld-Key, das belegt werden soll (z.B. 'aktenzeichen'). */
  canonical: string;
  /** Anzeigename des Standardfelds für den Header. */
  canonicalLabel: string;
  /** Alle CSV-Spalten der Preview. */
  allColumns: string[];
  /** Aktuelle Mapping-Entscheidungen (zum Filtern unbelegter Spalten). */
  decisions: Record<string, PerColumnDecision>;
  /** Optionale Labels pro CSV-Spalte (aus XLS). */
  labelByColumn: Map<string, string>;
  /** Suggestions aus XLS-Match, gefiltert auf canonical. */
  suggestions: LabelSuggestion[];
  /** User-Wahl. */
  onSelect: (csvColumn: string) => void;
  /** Picker schließen ohne Auswahl. */
  onClose: () => void;
}

/**
 * Inline-Popover für das Belegen eines Standardfeld-Slots.
 * Zeigt unbelegte CSV-Spalten, Suggestions ≥60% mit ⚡-Badge oben, dann alphabetisch.
 * Click-outside und Escape schließen den Picker.
 */
export function StandardFieldPicker({
  canonical,
  canonicalLabel,
  allColumns,
  decisions,
  labelByColumn,
  suggestions,
  onSelect,
  onClose,
}: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent): void => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const items = useMemo(() => {
    // Unbelegte Spalten = nicht 'canonical' (oder canonical mit anderem Ziel als das aktuelle Standardfeld)
    // ABER: erlaubt sind Spalten, die aktuell auf canonical=<this> stehen (User will evtl. wechseln) oder mode='custom'/'ignore'.
    const free = allColumns.filter(col => {
      const d = decisions[col];
      if (!d) return true;
      if (d.mode === 'canonical' && d.canonical && d.canonical !== canonical) return false;
      return true;
    });

    const suggMap = new Map<string, number>();
    for (const s of suggestions) {
      if (s.canonical === canonical && s.confidence >= 0.6) suggMap.set(s.csvColumn, s.confidence);
    }

    const q = query.trim().toLowerCase();
    const matchesQuery = (col: string): boolean => {
      if (!q) return true;
      if (col.toLowerCase().includes(q)) return true;
      const lab = labelByColumn.get(col);
      if (lab && lab.toLowerCase().includes(q)) return true;
      return false;
    };

    const withSugg: { col: string; conf: number }[] = [];
    const rest: string[] = [];
    for (const col of free) {
      if (!matchesQuery(col)) continue;
      const conf = suggMap.get(col);
      if (conf !== undefined) withSugg.push({ col, conf });
      else rest.push(col);
    }
    withSugg.sort((a, b) => b.conf - a.conf);
    rest.sort((a, b) => a.localeCompare(b));
    return { withSugg, rest };
  }, [allColumns, decisions, canonical, suggestions, query, labelByColumn]);

  const totalCount = items.withSugg.length + items.rest.length;

  return (
    <div
      ref={containerRef}
      className="absolute z-30 top-full left-0 mt-1 rounded-md shadow-lg"
      style={{
        background: 'var(--tf-bg)',
        border: '0.5px solid var(--tf-border-hover)',
        width: 360,
        maxHeight: 360,
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="px-2.5 py-2 border-b-[0.5px] border-[var(--tf-border)]">
        <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-1">
          CSV-Spalte für <span className="font-medium text-[var(--tf-text)]">{canonicalLabel}</span> wählen
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Suchen…"
            className="w-full h-7 pl-6 pr-2 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12px]"
          />
        </div>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
        {totalCount === 0 ? (
          <div className="px-2.5 py-3 text-[11.5px] text-[var(--tf-text-tertiary)] italic">
            Keine passenden Spalten gefunden.
          </div>
        ) : (
          <>
            {items.withSugg.length > 0 ? (
              <div>
                <div className="px-2.5 py-1 text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] bg-[var(--tf-bg-secondary)]">
                  Vorschläge
                </div>
                {items.withSugg.map(({ col, conf }) => (
                  <PickerRow
                    key={col}
                    col={col}
                    label={labelByColumn.get(col)}
                    confidence={conf}
                    onSelect={() => onSelect(col)}
                  />
                ))}
              </div>
            ) : null}
            {items.rest.length > 0 ? (
              <div>
                {items.withSugg.length > 0 ? (
                  <div className="px-2.5 py-1 text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] bg-[var(--tf-bg-secondary)]">
                    Alle Spalten
                  </div>
                ) : null}
                {items.rest.map(col => (
                  <PickerRow
                    key={col}
                    col={col}
                    label={labelByColumn.get(col)}
                    onSelect={() => onSelect(col)}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

interface PickerRowProps {
  col: string;
  label?: string;
  confidence?: number;
  onSelect: () => void;
}

function PickerRow({ col, label, confidence, onSelect }: PickerRowProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[var(--tf-bg-secondary)] transition"
    >
      {confidence !== undefined ? (
        <Zap size={11} className="shrink-0 text-blue-600" />
      ) : (
        <span className="w-[11px] shrink-0" />
      )}
      <span className="font-mono text-[11.5px] text-[var(--tf-text)] shrink-0">{col}</span>
      {label && label !== col ? (
        <span className="text-[11px] text-[var(--tf-text-tertiary)] truncate flex-1">{label}</span>
      ) : (
        <span className="flex-1" />
      )}
      {confidence !== undefined ? (
        <span className="text-[11px] tabular-nums text-blue-600 shrink-0">
          {Math.round(confidence * 100)}%
        </span>
      ) : null}
    </button>
  );
}
