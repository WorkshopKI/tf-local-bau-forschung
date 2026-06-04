import { Clock, X } from 'lucide-react';

/**
 * Vorschlags-Dropdown unter dem Such-Input: zeigt die zuletzt verwendeten
 * Anfragen (Recent-Search-Historie). Rein praesentational — Filterung,
 * Tastatur-Navigation (`activeIndex`) und Persistenz liegen im Parent
 * ([SuchSeite](src/plugins/suche/SuchSeite.tsx)).
 *
 * Stil nach DESIGN_GUIDE (Panel-Konvention wie ColumnPicker): `--tf-*`-Tokens,
 * 0.5px-Border, z-[100], max-h 240px. Die Zeile (`div` mit `onClick`) ruft auf
 * ihrem `mousedown` `e.preventDefault()` auf — DAS hält den Input-Fokus und
 * verhindert, dass der `onBlur`-Commit im Parent das Dropdown schließt, bevor der
 * Klick ankommt (ein nicht-fokussierbares Element allein blurrt den Input in
 * Chromium/Firefox trotzdem → Fokus fällt auf `<body>`). Gleiches Typeahead-
 * Pattern wie in `dokument-review/AntragAutocomplete`. Die fokussierbaren Buttons
 * (✕, „Verlauf leeren") liegen innerhalb des Wrappers, daher greift dort der
 * `relatedTarget`-Guard des Parents.
 */
export interface SearchSuggestionsProps {
  items: string[];
  activeIndex: number;
  onSelect: (q: string) => void;
  onRemove: (q: string) => void;
  onClear: () => void;
  onHover: (index: number) => void;
}

export function SearchSuggestions({
  items,
  activeIndex,
  onSelect,
  onRemove,
  onClear,
  onHover,
}: SearchSuggestionsProps): React.ReactElement {
  return (
    <div
      role="listbox"
      aria-label="Zuletzt gesucht"
      className="absolute left-0 right-0 top-full mt-1 z-[100] max-h-[240px] overflow-y-auto py-1 rounded-[var(--tf-radius)] bg-[var(--tf-bg)]"
      style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)' }}
    >
      {items.map((q, i) => (
        <div
          key={q}
          role="option"
          aria-selected={i === activeIndex}
          onMouseEnter={() => onHover(i)}
          // mousedown-preventDefault haelt den Input-Fokus → kein Blur-Close,
          // sonst unmountet das Dropdown bevor der Klick `onSelect` erreicht.
          onMouseDown={e => e.preventDefault()}
          onClick={() => onSelect(q)}
          className={`group flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer ${
            i === activeIndex ? 'bg-[var(--tf-hover)]' : ''
          }`}
        >
          <Clock size={13} className="shrink-0 text-[var(--tf-text-tertiary)]" />
          <span className="flex-1 min-w-0 truncate text-[var(--tf-text)]" title={q}>{q}</span>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemove(q); }}
            aria-label={`„${q}" aus dem Verlauf entfernen`}
            className="shrink-0 p-0.5 bg-transparent border-0 cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <div className="mt-1 px-3 pt-1" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] bg-transparent border-0 p-0 cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
        >
          Verlauf leeren
        </button>
      </div>
    </div>
  );
}
