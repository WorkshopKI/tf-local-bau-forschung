import { Check, ChevronDown, ChevronUp } from 'lucide-react';
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
 * Mit `onVerschiebe` (v3.41) kommt je Zeile ein Pfeilpaar dazu und die Liste
 * wird zur Reihenfolge-Ansicht: sie zeigt die Lanes so, wie das Board sie stellt
 * — die abgewählten mitten drin, damit ihr Platz sichtbar bleibt. Ohne die Prop
 * bleibt alles, wie es war.
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
  /**
   * Optional: Zeile um einen Platz verschieben (−1 hoch, +1 runter). Ist die
   * Prop gesetzt, IST die Zeilenfolge die Lane-Folge — der Aufrufer muss
   * `options` dann in seiner eigenen Reihenfolge liefern, nicht in Katalogfolge.
   * Ohne die Prop bleibt die Liste, was sie war (Home-Widgets).
   */
  onVerschiebe?: (key: string, richtung: -1 | 1) => void;
  /** Ab dieser Zeilenzahl scrollt die Liste statt das Popover zu sprengen. */
  maxSichtbareZeilen?: number;
}

export function LaneListe({
  options,
  spaltenProKey,
  onToggle,
  onSpalten,
  onVerschiebe,
  maxSichtbareZeilen = 6,
}: LaneListeProps): React.ReactElement {
  const scrollt = options.length > maxSichtbareZeilen;
  return (
    <div role="group">
      {/* Spalten-Überschrift über dem Schalter — ersetzt die frühere
          Erklär-Fußnote („Klick auf ‚· N Sp.' schaltet …"). */}
      <div className="flex items-center gap-2 pb-1 pr-[1px]">
        {/* Über den Häkchen, damit die Spalte sich als Sichtbarkeit liest und
            nicht als bloße Auswahl. */}
        <span className="flex-1 pl-1.5 text-[9.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
          Sichtbar
        </span>
        {onVerschiebe ? (
          <span className="shrink-0 w-[44px] text-center text-[9.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
            Folge
          </span>
        ) : null}
        <span className="shrink-0 w-[49px] text-center text-[9.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
          Spalten
        </span>
      </div>
      <div className={cn('flex flex-col', scrollt && 'max-h-[240px] overflow-y-auto pr-1')}>
      {options.map((opt, i) => {
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

            {onVerschiebe ? (
              <span className="shrink-0 inline-flex">
                <VerschiebeKnopf
                  richtung={-1}
                  label={opt.label}
                  aktiv={i > 0}
                  onKlick={() => onVerschiebe(opt.key, -1)}
                />
                <VerschiebeKnopf
                  richtung={1}
                  label={opt.label}
                  aktiv={i < options.length - 1}
                  onKlick={() => onVerschiebe(opt.key, 1)}
                />
              </span>
            ) : null}

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

/** Ein Platz hoch/runter. Am Rand der Liste gedämpft statt entfernt — sonst
 *  rutschte die ganze Zeile in der ersten und letzten Position (Pitfall #14). */
function VerschiebeKnopf({ richtung, label, aktiv, onKlick }: {
  richtung: -1 | 1;
  label: string;
  aktiv: boolean;
  onKlick: () => void;
}): React.ReactElement {
  const Pfeil = richtung === -1 ? ChevronUp : ChevronDown;
  const wohin = richtung === -1 ? 'nach vorn' : 'nach hinten';
  return (
    <button
      type="button"
      aria-label={`Lane „${label}" ${wohin}`}
      aria-disabled={!aktiv}
      title={aktiv ? `„${label}" ${wohin}` : `„${label}" steht schon ganz ${richtung === -1 ? 'vorn' : 'hinten'}`}
      onClick={aktiv ? onKlick : undefined}
      className={cn(
        'w-[22px] h-[22px] grid place-items-center rounded-[var(--tf-radius-sm)] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40',
        aktiv
          ? 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer'
          : 'text-[var(--tf-text-tertiary)] cursor-not-allowed',
      )}
    >
      <Pfeil size={13} strokeWidth={2} />
    </button>
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
