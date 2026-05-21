/**
 * Download-Icon-Dropdown rechts neben dem Suchfeld. Buendelt die drei
 * Export-Aktionen (CSV / Excel / Kopieren) hinter einem einzelnen Icon-Button —
 * analog zum Pattern auf der Foerderantraege-Liste ([AntraegeHeader.tsx:137]),
 * aber als Dropdown statt Single-Button.
 *
 * Bewusst kein Radix `DropdownMenu` (nicht installiert) — gleiches
 * useRef/useClickOutside-Pattern wie `ColumnPicker.tsx`, damit das ganze
 * Plugin konsistent bleibt.
 */
import { memo, useRef, useState } from 'react';
import { Copy, Download, FileSpreadsheet } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';

export interface SearchDownloadMenuProps {
  disabled: boolean;
  onExportCSV: () => void;
  onExportXLSX: () => void;
  onExportClipboard: () => void;
}

function SearchDownloadMenuInner(props: SearchDownloadMenuProps): React.ReactElement {
  const { disabled, onExportCSV, onExportXLSX, onExportClipboard } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useClickOutside(containerRef, () => setOpen(false), open);

  function run(handler: () => void): void {
    setOpen(false);
    handler();
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        aria-label="Ergebnisse exportieren"
        title="Ergebnisse exportieren"
        className="flex items-center justify-center w-10 h-10 text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <Download size={16} />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 z-[100] w-[220px] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] shadow-md py-1"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <button
            type="button"
            onClick={() => run(onExportCSV)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] text-left"
          >
            <FileSpreadsheet size={14} />
            <span>CSV exportieren</span>
          </button>
          <button
            type="button"
            onClick={() => run(onExportXLSX)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] text-left"
          >
            <Download size={14} />
            <span>Excel exportieren</span>
          </button>
          <button
            type="button"
            onClick={() => run(onExportClipboard)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] text-left"
          >
            <Copy size={14} />
            <span>In Zwischenablage kopieren</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Top-Toolbar-Komponente — wird vom SuchSeite-Parent oft re-rendered (Query-Updates),
// aber die Props (disabled + 3 stable callbacks via useCallback haetten zwar geholfen;
// hier reichts memo() weil die meisten Re-Renders gar nicht durch sie hindurch sollen).
export const SearchDownloadMenu = memo(SearchDownloadMenuInner);
