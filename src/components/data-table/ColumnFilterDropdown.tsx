/**
 * Generisches Filter-Dropdown fuer Tabellen-Spalten — Checkbox-Liste der
 * distinct Spaltenwerte + Such-Feld + „Alle auswaehlen" / „Zuruecksetzen" /
 * „Anwenden". Portal-positioniert relativ zum Anchor-Button, damit das Dropdown
 * nicht vom overflow-Wrapper der Tabelle geclippt wird.
 *
 * Herausgeloest aus dem Suche-Plugin (`SearchTableHeader.FilterDropdown`), damit
 * auch andere Tabellen (Feedback-Board-Liste, …) Spaltenfilter bekommen — das
 * Verhalten ist identisch.
 *
 * Semantik: leerer Filter == „kein Filter" == alle Werte erlaubt. Im UI als
 * „alle ausgewaehlt" gespiegelt; bei Apply mit local == candidates geht wieder
 * ein leeres Set zurueck.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useClickOutside } from '@/core/hooks/useClickOutside';

export interface ColumnFilterDropdownProps {
  candidates: string[];
  selected: Set<string>;
  onApply: (values: Set<string>) => void;
  onClose: () => void;
  formatLabel?: (value: string) => string;
  anchorEl: HTMLElement | null;
}

export function ColumnFilterDropdown(props: ColumnFilterDropdownProps): React.ReactElement {
  const { candidates, selected, onApply, onClose, formatLabel, anchorEl } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [local, setLocal] = useState<Set<string>>(
    () => (selected.size === 0 ? new Set(candidates) : new Set(selected)),
  );
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useClickOutside(ref, onClose, true);

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const DROPDOWN_WIDTH = 240;
    const VIEWPORT_PAD = 8;
    const left = Math.max(
      VIEWPORT_PAD,
      Math.min(rect.left, window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_PAD),
    );
    setPos({ left, top: rect.bottom + 4 });
  }, [anchorEl]);

  const display = (v: string): string => (formatLabel ? formatLabel(v) : v);

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

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[1000] w-[240px] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] shadow-md"
      style={{ border: '0.5px solid var(--tf-border)', left: pos.left, top: pos.top }}
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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => { setLocal(new Set()); onApply(new Set()); }}
          className="flex-1"
        >
          Zuruecksetzen
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            // local == candidates → kein Filter (leeres Set)
            const next = local.size === candidates.length ? new Set<string>() : local;
            onApply(next);
          }}
          className="flex-1"
        >
          Anwenden
        </Button>
      </div>
    </div>,
    document.body,
  );
}
