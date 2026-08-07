/**
 * SegmentedToggle — generischer Mini-Segmented-Control (z.B. Tabelle/Karten).
 *
 * Aktive Option hat hellen Background + Border + Schatten; inaktive Optionen
 * sind transparent. Klick toggelt zur ausgewaehlten Option.
 *
 * Layout-Konvention (aus Handoff-Design):
 *   Container: border 0.5px / radius 8px / padding 2px / bg-secondary
 *   Buttons:   height 26px / padding 0 10px / font 12px / radius 6px
 *
 * **Aktiv wird ueber Flaeche + Rand markiert, nie ueber `font-weight`** — ein
 * Fett-Sprung verbreitert das Label und ruckelt bei jedem Wechsel den ganzen
 * Track (Pitfall #14, dieselbe Regel wie beim Haken-Slot der Toggle-Pills).
 *
 * Zwei additive Props fuer das Darstellungs-Menue (`DarstellungDropdown`), beide
 * mit dem bisherigen Verhalten als Default — die Bestandsaufrufer
 * (`FarbmodusToggle`, `MaListFilterBar`) bleiben unveraendert:
 * `rolle='auswahl'` fuer eine Einfachauswahl, die kein Tabpanel oeffnet, und
 * `breit` fuer die gestapelte Zeile, in der das Segment die Breite fuellt.
 */
export interface SegmentedToggleOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

interface Props<T extends string> {
  value: T;
  onChange: (id: T) => void;
  options: Array<SegmentedToggleOption<T>>;
  ariaLabel?: string;
  /**
   * `tabs` (Default) = Ansichts-Umschalter, der einen Bereich daneben tauscht.
   * `auswahl` = Einfachauswahl einer Einstellung (`radiogroup`/`radio`) — es
   * gibt kein zugehoeriges `tabpanel`, `tablist` waere dort eine Falschaussage.
   */
  rolle?: 'tabs' | 'auswahl';
  /** Fuellt die verfuegbare Breite, Optionen zu gleichen Teilen. */
  breit?: boolean;
}

export function SegmentedToggle<T extends string>({
  value, onChange, options, ariaLabel, rolle = 'tabs', breit = false,
}: Props<T>): React.ReactElement {
  const auswahl = rolle === 'auswahl';
  return (
    <div
      role={auswahl ? 'radiogroup' : 'tablist'}
      aria-label={ariaLabel}
      className={breit ? 'flex w-full items-center' : 'inline-flex items-center'}
      style={{
        border: '0.5px solid var(--tf-border)',
        borderRadius: 8,
        padding: 2,
        background: 'var(--tf-bg-secondary)',
        gap: 0,
      }}
    >
      {options.map(opt => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role={auswahl ? 'radio' : 'tab'}
            {...(auswahl ? { 'aria-checked': active } : { 'aria-selected': active })}
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors${
              breit ? ' flex-1 min-w-0' : ''
            } focus-visible:outline-2 focus-visible:outline-[var(--tf-primary)] focus-visible:outline-offset-1`}
            style={{
              height: 26,
              padding: '0 10px',
              fontSize: 12,
              borderRadius: 6,
              background: active ? 'var(--tf-bg)' : 'transparent',
              color: active ? 'var(--tf-text)' : 'var(--tf-text-secondary)',
              border: active ? '0.5px solid var(--tf-border)' : '0.5px solid transparent',
              boxShadow: active ? '0 1px 0 rgba(0,0,0,0.02)' : 'none',
            }}
          >
            {opt.icon && <span className="inline-flex">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
