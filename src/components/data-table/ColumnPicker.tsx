/**
 * Generischer "Spalten ▼"-Dropdown.
 *
 * Props-basiert: nimmt `columns`, `visibleKeys`, `onToggleColumn` entgegen
 * — kein Plugin-spezifischer Store-Import. Plugin-Wrapper (z.B. Suche)
 * binden den eigenen Persistierungs-Store darum.
 *
 * Locked-Spalten sind checked + disabled (Spec: nicht entfernbar).
 * Drag-and-Drop fuer Reihenfolge bewusst nicht — Reihenfolge folgt der
 * uebergebenen `columns`-Liste.
 */
import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Columns3 } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';
import type { SortableColumn } from './types';

export interface ColumnPickerProps<T> {
  columns: SortableColumn<T>[];
  visibleKeys: string[];
  onToggleColumn: (key: string) => void;
  /** Optional: Funktion, die pro Spalte zusaetzliches Label-Rendering liefert
   *  (z.B. visuelles Greying bei Typ-Filtern in der Suche). Default: kein Extra. */
  renderColumnExtra?: (column: SortableColumn<T>) => ReactNode;
  /** Optional: pro Spalte ein "grayed"-Flag, das Text-Tertiary einfaerbt
   *  (ohne den Checkbox-Toggle zu deaktivieren). */
  isGrayed?: (column: SortableColumn<T>) => boolean;
}

export function ColumnPicker<T>({
  columns,
  visibleKeys,
  onToggleColumn,
  renderColumnExtra,
  isGrayed,
}: ColumnPickerProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <Columns3 size={14} />
        <span>Spalten</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 z-[100] w-[240px] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] shadow-md max-h-[360px] overflow-y-auto"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          {columns.map(c => {
            const checked = visibleKeys.includes(c.key);
            const disabled = c.locked === true;
            const grayed = isGrayed ? isGrayed(c) : false;
            return (
              <label
                key={c.key}
                className={`flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer hover:bg-[var(--tf-hover)] ${
                  grayed ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]'
                } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggleColumn(c.key)}
                />
                <span>{c.label}</span>
                {c.locked && (
                  <span className="ml-auto text-[10px] text-[var(--tf-text-tertiary)]">fix</span>
                )}
                {renderColumnExtra?.(c)}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
