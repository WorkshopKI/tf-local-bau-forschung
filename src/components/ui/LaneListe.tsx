import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lane-Auswahl als bündige ZEILENLISTE — geteilt von der Home-Widget-Config
 * (Popover + Einstellungen › Widgets) und dem Feedback-Board-Popover.
 *
 * Ersetzt die frühere Chip-Wolke, in der die Spaltenzahl als verstecktes
 * zweites Klickziel („· 2 Sp.") IM Chip steckte und eine Fußnote brauchte.
 * Jetzt: eine Zeile je Lane, Auswahl links, Spaltenzahl rechts — zwei sichtbare,
 * getrennte Bedienelemente nebeneinander (nie verschachtelt).
 *
 * Layout-stabil (DESIGN_GUIDE Kap. 5 / Pitfall #14): Häkchen-Slot und
 * Spalten-Schalter sind IMMER gerendert; abgewählte Zeilen dämpfen den Schalter
 * per Farbe + `aria-disabled` statt ihn zu entfernen (kein Layout-Shift) und
 * ohne `opacity-40` (Anti-Pattern).
 */
export interface LaneListeOption {
  /** Stabile Identität (StatusCategory bzw. FeedbackStatus). */
  key: string;
  label: string;
  /** CSS-Farbwert der Lane (Theme-Token) — als Punkt vor dem Label. */
  akzent?: string;
}

export interface LaneListeProps {
  options: LaneListeOption[];
  /** Nur enthaltene Keys sind gewählt; der Wert ist die Kartenspaltenzahl. */
  spaltenProKey: Map<string, 1 | 2>;
  onToggle: (key: string) => void;
  onSpalten: (key: string, spalten: 1 | 2) => void;
  /** Ab dieser Zeilenzahl scrollt die Liste statt das Popover zu sprengen. */
  maxSichtbareZeilen?: number;
}

export function LaneListe({
  options,
  spaltenProKey,
  onToggle,
  onSpalten,
  maxSichtbareZeilen = 6,
}: LaneListeProps): React.ReactElement {
  const scrollt = options.length > maxSichtbareZeilen;
  return (
    <div role="group">
      {/* Spalten-Überschrift über dem Schalter — ersetzt die frühere
          Erklär-Fußnote („Klick auf ‚· N Sp.' schaltet …"). */}
      <div className="flex items-center gap-2 pb-1 pr-[1px]">
        <span className="flex-1" />
        <span className="shrink-0 w-[49px] text-center text-[9.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
          Spalten
        </span>
      </div>
      <div className={cn('flex flex-col', scrollt && 'max-h-[240px] overflow-y-auto pr-1')}>
      {options.map(opt => {
        const spalten = spaltenProKey.get(opt.key);
        const gewaehlt = spalten !== undefined;
        return (
          <div key={opt.key} className="flex items-center gap-2 py-[3px]">
            <button
              type="button"
              role="checkbox"
              aria-checked={gewaehlt}
              onClick={() => onToggle(opt.key)}
              className={cn(
                'min-w-0 flex-1 inline-flex items-center gap-2 px-1.5 py-1 rounded-[var(--tf-radius-sm)]',
                'text-[12.5px] text-left cursor-pointer transition-colors',
                'hover:bg-[var(--tf-bg-secondary)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40',
                gewaehlt
                  ? 'text-[var(--tf-text)] font-medium'
                  : 'text-[var(--tf-text-secondary)]',
              )}
            >
              {/* Häkchen-Slot immer rendern (konstante Breite, Pitfall #14). */}
              <span aria-hidden className={cn('inline-flex leading-none shrink-0', gewaehlt ? '' : 'invisible')}>
                <Check size={13} strokeWidth={2.5} />
              </span>
              {opt.akzent ? (
                <span
                  aria-hidden
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{ background: opt.akzent }}
                />
              ) : null}
              <span className="truncate">{opt.label}</span>
            </button>

            <SpaltenSchalter
              wert={spalten ?? 1}
              aktiv={gewaehlt}
              label={opt.label}
              onWaehle={n => onSpalten(opt.key, n)}
            />
          </div>
        );
      })}
      </div>
    </div>
  );
}

/** Kleiner 1|2-Segmentschalter rechts in der Zeile. Bei abgewählter Lane
 *  gedämpft + nicht bedienbar, aber gerendert (konstante Zeilenbreite). */
function SpaltenSchalter({ wert, aktiv, label, onWaehle }: {
  wert: 1 | 2;
  aktiv: boolean;
  label: string;
  onWaehle: (n: 1 | 2) => void;
}): React.ReactElement {
  return (
    <span
      className="shrink-0 inline-flex rounded-[var(--tf-radius-sm)] overflow-hidden"
      style={{ border: `0.5px solid ${aktiv ? 'var(--tf-border-hover)' : 'var(--tf-border)'}` }}
      title={aktiv ? `Kartenspalten der Lane „${label}"` : 'Lane erst auswählen'}
    >
      {([1, 2] as const).map((n, i) => {
        const an = aktiv && wert === n;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} Kartenspalte${n === 1 ? '' : 'n'}`}
            aria-pressed={an}
            aria-disabled={!aktiv}
            onClick={aktiv ? () => onWaehle(n) : undefined}
            className={cn(
              'w-6 h-[22px] grid place-items-center text-[11px] tabular-nums transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40',
              !aktiv
                ? 'text-[var(--tf-text-tertiary)] cursor-not-allowed'
                : an
                  ? 'bg-[var(--tf-bg-secondary)] font-medium text-[var(--tf-text)] cursor-pointer'
                  : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer',
            )}
            style={i === 1 ? { borderLeft: '0.5px solid var(--tf-border)' } : undefined}
          >
            {n}
          </button>
        );
      })}
    </span>
  );
}
