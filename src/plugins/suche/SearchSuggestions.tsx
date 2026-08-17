import { useEffect, useRef } from 'react';
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
  /**
   * Meldet, welche Zeilen im Sichtfenster stehen (bzw. standen) — die Grundlage
   * dafür, dass die Liste ungekappt sein darf.
   *
   * Die Menge wächst nur: eine hinausgescrollte Zeile wird nicht zurückgemeldet,
   * weil ihre Zahl schon errechnet ist und beim Zurückscrollen sonst neu
   * gerechnet würde. Wird der Melder nicht übergeben, rechnet der Aufrufer wie
   * bisher alles.
   */
  onSichtbareKeys?: (keys: ReadonlySet<string>) => void;
}

/** Wie weit über das Sichtfenster hinaus schon gerechnet wird (px) — knapp
 *  eine Listenhöhe, damit beim Scrollen keine Lücke aufreißt. */
const VORLAUF = 260;

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
  onSichtbareKeys,
}: SearchSuggestionsProps): React.ReactElement {
  const hatVerlauf = items.some(v => v.art === 'verlauf');
  const listeRef = useRef<HTMLDivElement>(null);
  const gemeldet = useRef(new Set<string>());

  // Welche Zeilen im Sichtfenster stehen — aus der Scroll-Geometrie, NICHT über
  // einen `IntersectionObserver`. Der feuert in einem nicht dargestellten
  // Fenster gar nicht (in dev:local gemessen: 0 Meldungen), und dann stünde die
  // Liste ohne eine einzige Zahl da, sobald sie im Hintergrund geöffnet wurde.
  // `offsetTop` lesen und ein Scroll-Ereignis abwarten tut beides nicht.
  //
  // `VORLAUF` läuft der Bewegung ein Stück voraus, damit die Zahl schon da ist,
  // wenn die Zeile ankommt. Zurückgemeldet wird nie: die Zahl einer einmal
  // gesehenen Zeile bleibt gültig (siehe `onSichtbareKeys`).
  useEffect(() => {
    const root = listeRef.current;
    if (!root || !onSichtbareKeys) return;
    gemeldet.current = new Set();
    const melde = (): void => {
      const oben = root.scrollTop - VORLAUF;
      const unten = root.scrollTop + root.clientHeight + VORLAUF;
      let neu = false;
      for (const el of root.querySelectorAll<HTMLElement>('[data-probe-key]')) {
        const key = el.dataset.probeKey;
        if (key === undefined || gemeldet.current.has(key)) continue;
        if (el.offsetTop + el.offsetHeight < oben || el.offsetTop > unten) continue;
        gemeldet.current.add(key);
        neu = true;
      }
      if (neu) onSichtbareKeys(new Set(gemeldet.current));
    };
    melde();
    root.addEventListener('scroll', melde, { passive: true });
    return () => root.removeEventListener('scroll', melde);
  }, [items, onSichtbareKeys]);

  return (
    // 320 statt 240 px: die Werte-Liste ist ein Katalog zum Durchblättern —
    // seit v4.88 ohne Deckel, also bis 5 461 Zeilen —, und acht sichtbare
    // Zeilen machten daraus ein Guckloch. Sie scrollt, statt die Seite zu
    // überwachsen.
    <div
      ref={listeRef}
      role="listbox"
      aria-label="Vorschläge"
      className="absolute left-0 right-0 top-full mt-1 z-[100] max-h-[320px] overflow-y-auto overscroll-contain py-1 rounded-[var(--tf-radius)] bg-[var(--tf-bg)]"
      style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)' }}
    >
      {items.map((v, i) => {
        const Icon = ICON[v.art];
        const anzahl = treffer?.get(v.key);
        return (
          <div
            key={v.key}
            role="option"
            data-probe-key={v.key}
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
      {hatVerlauf && (
        <div
          className="mt-1 flex items-center gap-3 px-3 pt-1"
          style={{ borderTop: '0.5px solid var(--tf-border)' }}
        >
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-[11px] bg-transparent border-0 p-0 cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
          >
            Verlauf leeren
          </button>
        </div>
      )}
    </div>
  );
}
