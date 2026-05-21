/**
 * Toolbar oberhalb der Suchtabelle: drei Export-Buttons + "An Chatbot…"
 * (disabled, kommt mit der Chatbot-Phase) + Spalten-Picker.
 *
 * Reine Praesentations-/Wireup-Komponente — die Logik (welche Spalten
 * sichtbar, welche Resultate sortiert) lebt in der `SuchSeite`.
 */
import { Copy, Download, FileSpreadsheet, MessageCircle } from 'lucide-react';
import { ColumnPicker } from './ColumnPicker';

export interface SearchToolbarProps {
  disabled: boolean;
  typeFilter: '' | 'antrag' | 'dokument' | 'bauantrag';
  onExportCSV: () => void;
  onExportXLSX: () => void;
  onExportClipboard: () => void;
}

export function SearchToolbar(props: SearchToolbarProps): React.ReactElement {
  const { disabled, typeFilter, onExportCSV, onExportXLSX, onExportClipboard } = props;
  const btnStyle = { border: '0.5px solid var(--tf-border)' };
  const btnCls =
    'flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--tf-text)] rounded ' +
    'hover:bg-[var(--tf-hover)] disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <button type="button" onClick={onExportCSV} disabled={disabled} className={btnCls} style={btnStyle}>
        <FileSpreadsheet size={14} />
        <span>CSV</span>
      </button>
      <button type="button" onClick={onExportXLSX} disabled={disabled} className={btnCls} style={btnStyle}>
        <Download size={14} />
        <span>Excel</span>
      </button>
      <button type="button" onClick={onExportClipboard} disabled={disabled} className={btnCls} style={btnStyle}>
        <Copy size={14} />
        <span>Kopieren</span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          disabled
          title="Kommt bald"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--tf-text-tertiary)] rounded opacity-60 cursor-not-allowed"
          style={btnStyle}
        >
          <MessageCircle size={14} />
          <span>An Chatbot…</span>
        </button>
        <ColumnPicker typeFilter={typeFilter} />
      </div>
    </div>
  );
}
