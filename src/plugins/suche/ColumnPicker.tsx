/**
 * Dropdown zum Ein-/Ausblenden von Tabellen-Spalten.
 *
 * - Locked-Spalten (z.B. "Titel / Inhalt") sind checked + disabled.
 * - Spalten die nur fuer Antraege gelten werden visuell ausgegraut wenn der
 *   Typ-Pill auf "Dokumente" steht (Spec: nicht entfernen, nur visuell).
 * - Aenderung sofort applied (persistiert via Store).
 * - Reihenfolge fest aus `SEARCH_COLUMNS` — Drag-and-Drop bewusst nicht.
 */
import { useRef, useState } from 'react';
import { ChevronDown, Columns3 } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';
import { SEARCH_COLUMNS } from './columns';
import { useSucheStore } from './store';

export interface ColumnPickerProps {
  /** Aktiver Typ-Filter aus den Pills — beeinflusst nur das visuelle
   *  Greying-out, NICHT die Verfuegbarkeit der Spalten. */
  typeFilter: '' | 'antrag' | 'dokument' | 'bauantrag';
}

export function ColumnPicker({ typeFilter }: ColumnPickerProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const visibleColumns = useSucheStore(s => s.visibleColumns);
  const toggleColumn = useSucheStore(s => s.toggleColumn);

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
          {SEARCH_COLUMNS.map(c => {
            const checked = visibleColumns.includes(c.key);
            const disabled = c.locked === true;
            const greyed =
              (typeFilter === 'dokument' && c.appliesTo === 'antrag')
              || (typeFilter === 'antrag' && c.appliesTo === 'dokument');
            return (
              <label
                key={c.key}
                className={`flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer hover:bg-[var(--tf-hover)] ${
                  greyed ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]'
                } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleColumn(c.key)}
                />
                <span>{c.label}</span>
                {c.locked && (
                  <span className="ml-auto text-[10px] text-[var(--tf-text-tertiary)]">fix</span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
