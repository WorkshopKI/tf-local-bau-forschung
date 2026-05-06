import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Antrag } from '@/core/services/csv/types';
import { FilterSidebar } from './filter/FilterSidebar';

interface Props {
  open: boolean;
  onClose: () => void;
  antraege: Antrag[];
  search: string;
  onSearchChange: (s: string) => void;
}

export function FilterDrawer({ open, onClose, antraege, search, onSearchChange }: Props): React.ReactElement | null {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 bg-black/20 cursor-default"
        aria-label="Filter schließen"
      />
      <aside
        className="w-[360px] h-full bg-[var(--tf-bg)] flex flex-col shadow-xl animate-in slide-in-from-right duration-150"
        style={{ borderLeft: '0.5px solid var(--tf-border)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '0.5px solid var(--tf-border)' }}
        >
          <span className="text-[13px] font-medium text-[var(--tf-text)]">Filter</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
            aria-label="Schließen"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <FilterSidebar
            antraege={antraege}
            search={search}
            onSearchChange={onSearchChange}
            hideSearch
          />
        </div>
      </aside>
    </div>
  );
}
