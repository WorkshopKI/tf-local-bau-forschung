import { Clock, Filter, ListFilter, X } from 'lucide-react';
import type { Vorschlag } from './vervollstaendigung';

/**
 * Vorschlags-Dropdown unter dem Such-Input.
 *
 * Bis v4.70 zeigte es nur den Verlauf; seit v4.71 stehen davor die
 * Vervollständigungen — Feldnamen (`ort:`) und echte Werte des Bestands
 * („Dresden"), siehe [vervollstaendigung.ts](src/plugins/suche/vervollstaendigung.ts).
 * EINE Liste für alle drei Quellen, mit durchgehender Tastatur-Navigation: zwei
 * übereinanderliegende Listen hätten zwei Auswahlmarken und eine Pfeiltaste, die
 * mal die eine und mal die andere bewegt.
 *
 * Rein praesentational — Filterung, Tastatur-Navigation (`activeIndex`) und
 * Persistenz liegen im Parent ([SearchInput](src/plugins/suche/SearchInput.tsx)).
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
  items: readonly Vorschlag[];
  activeIndex: number;
  onSelect: (v: Vorschlag) => void;
  /** Nur für Verlaufs-Einträge — die anderen Quellen kann man nicht löschen. */
  onRemove: (q: string) => void;
  onClear: () => void;
  onHover: (index: number) => void;
  /** Trefferzahl je Vorschlag (Schlüssel = `Vorschlag.key`), sobald gerechnet. */
  treffer?: ReadonlyMap<string, number>;
  /** „25 von 1.270 …" — steht nur da, wenn die Liste wirklich gekappt ist. */
  hinweis?: string | null;
}

const ICON = {
  feld: ListFilter,
  wert: Filter,
  verlauf: Clock,
} as const;

export function SearchSuggestions({
  items,
  activeIndex,
  onSelect,
  onRemove,
  onClear,
  onHover,
  treffer,
  hinweis,
}: SearchSuggestionsProps): React.ReactElement {
  const hatVerlauf = items.some(v => v.art === 'verlauf');
  return (
    // 320 statt 240 px: die Werte-Liste ist seit v4.71.1 ein Katalog zum
    // Durchblättern (bis 25 Einträge), und acht sichtbare Zeilen machten daraus
    // ein Guckloch. Sie scrollt weiterhin, statt die Seite zu überwachsen.
    <div
      role="listbox"
      aria-label="Vorschläge"
      className="absolute left-0 right-0 top-full mt-1 z-[100] max-h-[320px] overflow-y-auto py-1 rounded-[var(--tf-radius)] bg-[var(--tf-bg)]"
      style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)' }}
    >
      {items.map((v, i) => {
        const Icon = ICON[v.art];
        const anzahl = treffer?.get(v.key);
        return (
          <div
            key={v.key}
            role="option"
            aria-selected={i === activeIndex}
            onMouseEnter={() => onHover(i)}
            // mousedown-preventDefault haelt den Input-Fokus → kein Blur-Close,
            // sonst unmountet das Dropdown bevor der Klick `onSelect` erreicht.
            onMouseDown={e => e.preventDefault()}
            onClick={() => onSelect(v)}
            className={`group flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer ${
              i === activeIndex ? 'bg-[var(--tf-hover)]' : ''
            }`}
          >
            <Icon size={13} className="shrink-0 text-[var(--tf-text-tertiary)]" />
            <span
              className={`min-w-0 truncate text-[var(--tf-text)] ${v.art === 'feld' ? 'font-mono' : ''}`}
              title={v.anzeige}
            >
              {v.anzeige}
            </span>
            {v.erklaerung !== undefined && (
              <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">
                {v.erklaerung}
              </span>
            )}
            <span className="flex-1" />
            {anzahl !== undefined && (
              // Aus einem echten Probelauf, nicht aus dem Werte-Zähler: was hier
              // steht, ist die Zahl, die nach dem Klick auch dasteht.
              <span className="shrink-0 tabular-nums text-[11px] text-[var(--tf-text-tertiary)]">
                {anzahl.toLocaleString('de-DE')}
              </span>
            )}
            {v.art === 'verlauf' && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onRemove(v.anfrage); }}
                aria-label={`„${v.anfrage}" aus dem Verlauf entfernen`}
                className="shrink-0 p-0.5 bg-transparent border-0 cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              >
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}
      {(hatVerlauf || (hinweis !== null && hinweis !== undefined)) && (
        <div
          className="mt-1 flex items-center gap-3 px-3 pt-1"
          style={{ borderTop: '0.5px solid var(--tf-border)' }}
        >
          {hinweis !== null && hinweis !== undefined && (
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">{hinweis}</span>
          )}
          {hatVerlauf && (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto text-[11px] bg-transparent border-0 p-0 cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
            >
              Verlauf leeren
            </button>
          )}
        </div>
      )}
    </div>
  );
}
