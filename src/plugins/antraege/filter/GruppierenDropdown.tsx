/**
 * „Gruppierung: {Wert} ▾"-Dropdown für die Förderanträge-Toolbar.
 *
 * Seit Journey-Paket 2 Phase 2 wohnt die Gruppieren-Steuerung nicht mehr als
 * Quickfilter-Segment in der Filter-Zeile, sondern als ruhiges Dropdown rechts
 * neben dem Spalten-Picker (`AntraegeMain`). Verhalten/State (per-View-
 * Gruppierung) bleiben unverändert — dies ist nur die Präsentation.
 *
 * Visuelle Familie = `ColumnPicker` (gerahmter Button + Menü, `useClickOutside`,
 * `--tf-*`-Theming), damit die beiden rechten Toolbar-Steuerungen fluchten.
 */
import { useRef, useState } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';

export interface GruppierenOption {
  key: string;
  label: string;
}

interface Props {
  options: readonly GruppierenOption[];
  /** Aktueller Gruppierungs-Key. */
  value: string;
  onChange: (key: string) => void;
}

export function GruppierenDropdown({ options, value, onChange }: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useClickOutside(containerRef, () => setOpen(false), open);

  const current = options.find(o => o.key === value) ?? options[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)] whitespace-nowrap"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <Layers size={14} className="text-[var(--tf-text-tertiary)]" />
        <span className="text-[var(--tf-text-tertiary)]">Gruppierung:</span>
        <span className="font-medium">{current?.label ?? 'Keine'}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute top-full right-0 mt-1 z-[100] min-w-[160px] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] shadow-md overflow-hidden"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          {options.map(o => {
            const active = o.key === value;
            return (
              <button
                key={o.key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(o.key); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer hover:bg-[var(--tf-hover)] ${
                  active ? 'text-[var(--tf-primary)] font-medium' : 'text-[var(--tf-text)]'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
