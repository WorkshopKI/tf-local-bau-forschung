import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToggleChipProps {
  /** Chip-Beschriftung. */
  label: React.ReactNode;
  /** An-Zustand (gewählt). */
  selected: boolean;
  /** Klick-Handler (feuert nicht, wenn `disabled`). */
  onToggle: () => void;
  /** Nicht wählbar — gedämpft + `title`-Tooltip mit Grund (kein `opacity-40`). */
  disabled?: boolean;
  /** Tooltip (Grund bei `disabled`, Volltext bei gekürztem Label). */
  title?: string;
  /**
   * `neutral` = helle Surface-Füllung im An-Zustand (Multi-Select, Default).
   * `dark`    = dunkle Voll-Füllung mit invertiertem Text — für die
   *            Single-Select-Hauptkategorie, damit sie sich abhebt.
   */
  variant?: 'neutral' | 'dark';
  /**
   * Zahl hinter dem Label (Treffer, Termine, Einträge) — gedämpft und in
   * Tabellenziffern, damit die Chips einer Reihe gleich breit bleiben.
   *
   * Steht bewusst als eigenes Feld statt im `label`: nur so bleibt sie
   * typografisch zurückgenommen, und nur so kann sie im An-Zustand die
   * Tönung mitnehmen, ohne sie zu übertönen.
   */
  zahl?: number;
  /**
   * Eigene Tönung im An-Zustand — für Chips, die eine **Kategorie** wählen und
   * dieselbe Farbe tragen, mit der ihre Kategorie überall sonst markiert ist
   * (die Rollen des Statusverlaufs). Die Leiste ist dadurch selbst die Legende;
   * eine zweite gibt es nicht.
   *
   * Wirkt nur bei `selected` und ohne `disabled`; der Aus-Zustand bleibt
   * neutral, sonst leuchtete die Leiste in fünf Farben, ohne etwas zu sagen.
   */
  tonung?: { text: string; flaeche: string };
  className?: string;
}

/**
 * Domänenfreier Toggle-Chip mit drei Zuständen (an / aus / nicht wählbar).
 * Kanonisches Muster gemäß DESIGN_GUIDE Kap. 5 / CLAUDE.md Pitfall #14:
 *  - **Layout-stabil**: Häkchen-Slot IMMER gerendert, im Aus-/Disabled-Zustand
 *    per `invisible` versteckt → konstante Chip-Breite (kein horizontaler Shift).
 *  - **Klarer Kontrast** statt `opacity-40`; **kein Durchstreichen** im Aus-Zustand.
 *  - **A11y**: `aria-pressed={selected}` am umschließenden Button.
 *
 * Anders als `KategoriePill` (farbcodiert, plugin-lokal) ist dieser Chip neutral
 * — die einzige Farbdifferenzierung ist `variant='dark'` für Single-Select.
 */
export function ToggleChip({
  label,
  selected,
  onToggle,
  disabled = false,
  title,
  variant = 'neutral',
  zahl,
  tonung,
  className,
}: ToggleChipProps): React.ReactElement {
  const base =
    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] transition-colors '
    + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40';

  let stateCls: string;
  let stateStyle: React.CSSProperties;
  if (disabled) {
    stateCls = 'text-[var(--tf-text-tertiary)] cursor-not-allowed';
    stateStyle = { background: 'transparent', border: '0.5px solid var(--tf-border)' };
  } else if (selected && variant === 'dark') {
    stateCls = 'font-medium cursor-pointer';
    stateStyle = { background: 'var(--tf-text)', color: 'var(--tf-bg)', border: '0.5px solid var(--tf-text)' }; // allow-cta-fill: Toggle-Pill (Single-Select an), bewusst dunkle Voll-Füllung, kein Klick-CTA
  } else if (selected && tonung) {
    stateCls = 'font-medium cursor-pointer';
    stateStyle = {
      background: tonung.flaeche, color: tonung.text,
      border: '0.5px solid var(--tf-border-hover)',
    };
  } else if (selected) {
    stateCls = 'text-[var(--tf-text)] font-medium cursor-pointer';
    stateStyle = { background: 'var(--tf-bg-secondary)', border: '0.5px solid var(--tf-border-hover)' };
  } else {
    stateCls = 'text-[var(--tf-text-secondary)] cursor-pointer hover:text-[var(--tf-text)]';
    stateStyle = { background: 'transparent', border: '0.5px solid var(--tf-border)' };
  }

  const showHaken = selected && !disabled;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      aria-pressed={selected}
      title={title}
      className={cn(base, stateCls, className)}
      style={stateStyle}
    >
      {/* Häkchen-Slot immer rendern (konstante Breite, Pitfall #14). */}
      <span aria-hidden className={cn('inline-flex leading-none', showHaken ? '' : 'invisible')}>
        <Check size={13} strokeWidth={2.5} />
      </span>
      <span>{label}</span>
      {/* Die Zahl erbt im getönten An-Zustand `currentColor` und wird nur
          zurückgenommen — eine zweite Farbe hier machte den Chip zum Diagramm. */}
      {zahl !== undefined && (
        <span
          className="tabular-nums text-[11.5px] font-normal"
          style={{ color: selected && tonung ? 'currentColor' : 'var(--tf-text-tertiary)',
            opacity: selected && tonung ? 0.75 : 1 }}
        >
          {zahl}
        </span>
      )}
    </button>
  );
}
