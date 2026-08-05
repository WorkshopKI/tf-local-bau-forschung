/**
 * Filter-Dropdown mit **Mehrfachauswahl** — der Toolbar-Filter für Achsen mit
 * mehr als einer Handvoll Werten (DESIGN_GUIDE Kap. 5: Dropdown statt Pills ab
 * >6 Optionen oder wenn die Werte aus den Daten kommen).
 *
 * Domänenfrei und ohne Store-Bindung: der Aufrufer reicht Optionen, Auswahl und
 * `onChange` durch. **Leere Auswahl heißt „kein Filter"** (alle Werte) — die
 * übliche Facetten-Semantik, nicht „nichts anzeigen".
 *
 * Visuelle Familie = `GruppierenDropdown` + `ColumnPicker` (gerahmter Button,
 * `--tf-*`-Theming, `useClickOutside`), damit alle Toolbar-Steuerungen der App
 * fluchten. Ein natives `<select>` gehört in Formulare, nicht in eine
 * Filter-Leiste: es zeichnet ein Betriebssystem-Menü in fremden Farben und kann
 * keine brauchbare Mehrfachauswahl.
 */
import { useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';

export interface MultiSelectOption {
  wert: string;
  label: string;
  /** Trefferzahl neben dem Wert. Weggelassen → keine Zahl. */
  anzahl?: number;
}

/** Schnellweg über der Liste (Vorbelegung setzen, Auswahl leeren, …). */
export interface MultiSelectAktion {
  label: string;
  onClick: () => void;
  /** Trifft die aktuelle Auswahl genau diesen Schnellweg? Nur Anzeige. */
  aktiv?: boolean;
}

export interface MultiSelectDropdownProps {
  /** Was ausgewählt wird, im Plural — „Jahrgänge", „Fördervarianten". */
  einheit: string;
  /** Beschriftung bei leerer Auswahl, z.B. „Alle Fördervarianten". */
  alleLabel: string;
  optionen: readonly MultiSelectOption[];
  ausgewaehlt: readonly string[];
  onChange: (werte: string[]) => void;
  /**
   * Überschreibt die abgeleitete Button-Beschriftung — für Auswahlen, die einen
   * eigenen Namen haben („Letzte 3 Jahre" statt „3 Jahrgänge").
   */
  labelOverride?: string | null;
  aktionen?: readonly MultiSelectAktion[];
}

export function MultiSelectDropdown({
  einheit,
  alleLabel,
  optionen,
  ausgewaehlt,
  onChange,
  labelOverride,
  aktionen,
}: MultiSelectDropdownProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offen, setOffen] = useState(false);
  useClickOutside(containerRef, () => setOffen(false), offen);
  const listenId = useId();

  const gewaehlt = useMemo(() => new Set(ausgewaehlt), [ausgewaehlt]);
  // Labels der Auswahl — für Beschriftung und Tooltip. Werte, die es in den
  // Optionen nicht (mehr) gibt, stehen mit ihrem Rohwert da statt zu
  // verschwinden: eine Auswahl, die niemand sieht, wäre ein stiller Filter.
  const gewaehlteLabels = useMemo(
    () => ausgewaehlt.map(w => optionen.find(o => o.wert === w)?.label ?? w),
    [ausgewaehlt, optionen],
  );

  const beschriftung = labelOverride
    ?? (gewaehlteLabels.length === 0
      ? alleLabel
      : gewaehlteLabels.length === 1
        ? gewaehlteLabels[0]
        : `${gewaehlteLabels.length} ${einheit}`);

  const umschalten = (wert: string): void => {
    onChange(
      gewaehlt.has(wert)
        ? ausgewaehlt.filter(w => w !== wert)
        : [...ausgewaehlt, wert],
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={offen}
        aria-controls={offen ? listenId : undefined}
        // Der Tooltip nennt die volle Auswahl — „3 Jahrgänge" allein sagt
        // nicht, welche.
        title={gewaehlteLabels.length > 1 ? gewaehlteLabels.join(', ') : undefined}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)] whitespace-nowrap cursor-pointer"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <span className={gewaehlteLabels.length > 0 ? 'font-medium' : undefined}>
          {beschriftung}
        </span>
        <ChevronDown size={12} className="text-[var(--tf-text-tertiary)]" />
      </button>
      {offen && (
        <div
          id={listenId}
          role="listbox"
          aria-multiselectable
          aria-label={einheit}
          className="absolute top-full left-0 mt-1 z-[100] min-w-[220px] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] shadow-md max-h-[360px] overflow-y-auto"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          {aktionen && aktionen.length > 0 && (
            <div style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
              {aktionen.map(a => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => a.onClick()}
                  className={`flex w-full items-center px-3 py-1.5 text-[12px] cursor-pointer hover:bg-[var(--tf-hover)] ${
                    a.aktiv ? 'text-[var(--tf-primary)] font-medium' : 'text-[var(--tf-text)]'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {optionen.length === 0 && (
            <p className="px-3 py-2 text-[11.5px] text-[var(--tf-text-tertiary)]">Keine Werte</p>
          )}
          {optionen.map(o => (
            <label
              key={o.wert}
              role="option"
              aria-selected={gewaehlt.has(o.wert)}
              className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] cursor-pointer hover:bg-[var(--tf-hover)] text-[var(--tf-text)]"
            >
              <span className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={gewaehlt.has(o.wert)}
                  onChange={() => umschalten(o.wert)}
                  className="accent-[var(--tf-primary)] shrink-0"
                />
                <span className="truncate" title={o.label}>{o.label}</span>
              </span>
              {o.anzahl !== undefined && (
                <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">
                  {o.anzahl.toLocaleString('de-DE')}
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
