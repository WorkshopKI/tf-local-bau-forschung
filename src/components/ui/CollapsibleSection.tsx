import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  label: string;
  subtitle?: string;
  defaultOpen?: boolean;
  /** Optionaler localStorage-Key: ist er gesetzt, überlebt der Auf-/Zu-Zustand
   *  einen Reload (`'0'` = offen, `'1'` = zu — selbe Semantik wie
   *  `useCollapsedSection`). Ohne Key bleibt der Zustand rein in-memory
   *  (`defaultOpen`). */
  storageKey?: string;
  children: React.ReactNode;
}

/** Initialwert: bei gesetztem `storageKey` aus localStorage, sonst `defaultOpen`. */
function seedOpen(storageKey: string | undefined, defaultOpen: boolean): boolean {
  if (!storageKey) return defaultOpen;
  try {
    const v = window.localStorage.getItem(storageKey);
    if (v === '1') return false;
    if (v === '0') return true;
  } catch { /* localStorage nicht verfügbar — Default */ }
  return defaultOpen;
}

export function CollapsibleSection({
  label,
  subtitle,
  defaultOpen = false,
  storageKey,
  children,
}: CollapsibleSectionProps): React.ReactElement {
  const [open, setOpen] = useState(() => seedOpen(storageKey, defaultOpen));

  useEffect(() => {
    if (!storageKey) return;
    try { window.localStorage.setItem(storageKey, open ? '0' : '1'); } catch { /* ignore */ }
  }, [storageKey, open]);

  return (
    <div style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 w-full py-3 cursor-pointer text-left"
      >
        <ChevronRight
          size={14}
          className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-[13px] font-medium text-[var(--tf-text)]">{label}</span>
        {subtitle && (
          <span className="text-[13px] text-[var(--tf-text-tertiary)] ml-auto">{subtitle}</span>
        )}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pb-4 pt-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
