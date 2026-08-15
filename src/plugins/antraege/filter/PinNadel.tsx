/**
 * Die Nadel, mit der ein Filter nach oben in den Schnellzugriff wandert.
 *
 * Sie erscheint beim Überfahren ihrer Zeile und bleibt sichtbar, solange sie
 * steckt — eine dauerhaft gezeigte Nadel an jedem der ~40 Facettenwerte wäre ein
 * zweites Raster neben den Häkchen.
 *
 * Der Wirt setzt dafür `group/pin` auf seine Zeile. Eigener Gruppenname, weil
 * die Häufig-Liste bereits eine unbenannte `group` für ihre Textfarbe führt.
 */
import { Pin } from 'lucide-react';
import { usePinnedFilters, pinKey, MAX_PINS, type PinnedFilter } from './pinnedFilters';

interface Props {
  pin: PinnedFilter;
  /** Wie der Schnellzugriff im Tooltip heißt („Fristdatum überfällig"). */
  bezeichnung: string;
  /** Bleibt die steckende Nadel dauerhaft sichtbar? In der Filterleiste ja —
   *  dort ist sie die Anzeige „das steht oben". In der Schnellzugriff-Zeile
   *  selbst nicht: dort ist der Chip schon der Beweis, und sechs Nadeln daneben
   *  wären ein zweites Raster. Default `true`. */
  stetsSichtbar?: boolean;
}

export function PinNadel({ pin, bezeichnung, stetsSichtbar = true }: Props): React.ReactElement {
  const pins = usePinnedFilters(s => s.pins);
  const umschalten = usePinnedFilters(s => s.umschalten);
  const key = pinKey(pin);
  const gepinnt = pins.some(p => pinKey(p) === key);
  // Voll heißt: nur noch abnehmen. Der Knopf bleibt stehen und sagt warum —
  // eine still verschwundene Nadel läse sich wie „hier geht das nicht".
  const voll = !gepinnt && pins.length >= MAX_PINS;

  return (
    <button
      type="button"
      disabled={voll}
      aria-pressed={gepinnt}
      title={voll
        ? `Höchstens ${MAX_PINS} Schnellzugriffe — erst einen abnehmen`
        : gepinnt
          ? `„${bezeichnung}" aus dem Schnellzugriff nehmen`
          : `„${bezeichnung}" oben anpinnen`}
      aria-label={gepinnt
        ? `„${bezeichnung}" aus dem Schnellzugriff nehmen`
        : `„${bezeichnung}" oben anpinnen`}
      onClick={e => {
        // In der Facette sitzt die Nadel INNERHALB eines <label> — ohne das
        // hier setzte ihr Klick zugleich das Häkchen daneben.
        e.preventDefault();
        e.stopPropagation();
        umschalten(pin);
      }}
      className={`shrink-0 inline-flex h-[18px] w-[18px] items-center justify-center rounded transition-opacity ${
        gepinnt
          ? `text-[var(--tf-primary)] cursor-pointer ${stetsSichtbar ? 'opacity-100' : 'opacity-0 group-hover/pin:opacity-100 focus-visible:opacity-100'}`
          : voll
            ? 'opacity-0 group-hover/pin:opacity-40 text-[var(--tf-text-tertiary)] cursor-not-allowed'
            : 'opacity-0 group-hover/pin:opacity-100 focus-visible:opacity-100 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer'
      }`}
    >
      <Pin size={11} className={gepinnt ? 'fill-current' : undefined} />
    </button>
  );
}
