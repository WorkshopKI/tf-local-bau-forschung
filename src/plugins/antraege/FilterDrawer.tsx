import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { AntragListItem } from '@/core/services/csv/types';
import { FilterSidebar } from './filter/FilterSidebar';

interface Props {
  open: boolean;
  onClose: () => void;
  antraege: AntragListItem[];
  search: string;
  onSearchChange: (s: string) => void;
}

const DRAWER_WIDTH = 460;

/** Slide-In Drawer-Variante des Filter-Panels. Wird verwendet wenn ein
 *  Detail offen ist — überlagert das Detail (Backdrop), Detail-State bleibt
 *  erhalten. Im non-detail-Mode wird stattdessen die persistente
 *  FilterSidebar in der AntraegePage gerendert. */
export function FilterDrawer({ open, onClose, antraege, search, onSearchChange }: Props): React.ReactElement | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — semi-transparent, klickbar zum Schließen. */}
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/20"
      />
      {/* Drawer Panel */}
      <aside
        role="dialog"
        aria-label="Filter"
        className="fixed top-0 right-0 z-50 h-full bg-[var(--tf-bg)] shadow-xl flex flex-col"
        style={{ width: DRAWER_WIDTH, borderLeft: '0.5px solid var(--tf-border)' }}
      >
        <div
          className="shrink-0 flex items-center justify-between px-3 py-2"
          style={{ borderBottom: '0.5px solid var(--tf-border)' }}
        >
          <span className="text-[12px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
            Filter
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Filter schließen"
            className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            <X size={18} />
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
    </>
  );
}
