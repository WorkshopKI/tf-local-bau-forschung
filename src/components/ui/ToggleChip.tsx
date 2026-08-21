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
  /**
   * Kleiner Zusatz hinter dem Label, in Monospace und zurückgenommen — der
   * Bezeichner, unter dem die Kategorie anderswo geführt wird („TV 1 …049").
   * Wie {@link zahl} ein eigenes Feld, damit die Typografie hier entschieden
   * wird und nicht in jedem Aufrufer neu.
   */
  zusatz?: string;
  /**
   * Die **Form** des Chips.
   *
   * `pille` (Default) ist das Filter-Idiom der App: rund, mit Häkchen-Slot.
   *
   * `marke` ist eckig (6 px), häkchenlos und enger — für Leisten, die zugleich
   * **Legende** einer Marke sind. Eine runde Legende neben einer eckigen Marke
   * behauptet zwei verschiedene Dinge; die Form muss dieselbe sein wie die des
   * Zeichens, das sie erklärt (Statusverlauf: Rollen- und Träger-Marken).
   *
   * Ohne Häkchen trägt die Tönung den Zustand allein — die Schriftstärke bleibt
   * deshalb in **beiden** Zuständen 500, sonst wanderte die Zeile beim Klick
   * (Pitfall #14 gilt für jede Breitenänderung, nicht nur für den Haken).
   */
  form?: 'pille' | 'marke';
  /**
   * `normal` (Default) ist das Maß der Filter-Leisten — dort steht der Chip für
   * sich und darf atmen.
   *
   * `dicht` ist für Chip-Reihen **innerhalb** eines Formulars, wo die Höhe knapp
   * ist: der Regel-Bereich eines Meilensteins trägt vier Reihen übereinander,
   * und bei zwei gleichzeitig offenen Meilensteinen entscheidet jede
   * eingesparte Zeile darüber, ob man sie nebeneinander lesen kann. Gespart
   * wird an der **Polsterung**, nicht an der Schrift — 20 statt 26 px bei
   * gleicher Lesbarkeit.
   *
   * Der Häkchen-Slot bleibt in beiden Größen gerendert (Pitfall #14).
   */
  groesse?: 'normal' | 'dicht';
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
  zusatz,
  form = 'pille',
  groesse = 'normal',
  className,
}: ToggleChipProps): React.ReactElement {
  const marke = form === 'marke';
  const dicht = groesse === 'dicht';
  const mass = marke
    ? (dicht ? 'px-2 h-[20px] gap-1 ' : 'px-2.5 h-[26px] gap-1.5 ')
    : (dicht ? 'px-2 h-[20px] gap-1 ' : 'px-3 py-1 gap-1.5 ');
  const base =
    'inline-flex items-center text-[12px] '
    + mass
    + (marke ? 'rounded-[6px] font-medium ' : 'rounded-full ')
    + 'transition-colors focus-visible:outline-none focus-visible:ring-2 '
    + 'focus-visible:ring-[var(--tf-primary)]/40';
  // Ohne Häkchen muss der Aus-Zustand seinen Umriss selbst tragen: 0.08 Alpha
  // verschwindet neben einer getönten Fläche, 0.15 hält dagegen (der Wert des
  // Entwurfs). Die Pille behält ihren zarteren Rand — sie hat den Haken.
  const randAus = marke ? 'var(--tf-border-hover)' : 'var(--tf-border)';
  // In der Marken-Form trägt `base` die 500 bereits; sie darf im Aus-Zustand
  // nicht wegfallen, sonst wandert die Nachbarschaft beim Klick.
  const stark = marke ? '' : 'font-medium ';

  let stateCls: string;
  let stateStyle: React.CSSProperties;
  if (disabled) {
    stateCls = 'text-[var(--tf-text-tertiary)] cursor-not-allowed';
    stateStyle = { background: 'transparent', border: `0.5px solid ${randAus}` };
  } else if (selected && variant === 'dark') {
    stateCls = `${stark}cursor-pointer`;
    stateStyle = { background: 'var(--tf-text)', color: 'var(--tf-bg)', border: '0.5px solid var(--tf-text)' }; // allow-cta-fill: Toggle-Pill (Single-Select an), bewusst dunkle Voll-Füllung, kein Klick-CTA
  } else if (selected && tonung) {
    stateCls = `${stark}cursor-pointer`;
    stateStyle = {
      background: tonung.flaeche, color: tonung.text,
      border: '0.5px solid var(--tf-border-hover)',
    };
  } else if (selected) {
    stateCls = `text-[var(--tf-text)] ${stark}cursor-pointer`;
    stateStyle = { background: 'var(--tf-bg-secondary)', border: '0.5px solid var(--tf-border-hover)' };
  } else {
    stateCls = 'text-[var(--tf-text-secondary)] cursor-pointer hover:text-[var(--tf-text)]';
    stateStyle = { background: 'transparent', border: `0.5px solid ${randAus}` };
  }

  const showHaken = selected && !disabled && !marke;
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
      {/* Häkchen-Slot immer rendern (konstante Breite, Pitfall #14). Die
          Marken-Form hat gar keinen — dort ist die Breite ohnehin konstant. */}
      {!marke && (
        <span aria-hidden className={cn('inline-flex leading-none', showHaken ? '' : 'invisible')}>
          <Check size={dicht ? 11 : 13} strokeWidth={2.5} />
        </span>
      )}
      <span>{label}</span>
      {/* Der Bezeichner der Kategorie — leiser als das Label, aber lesbar. */}
      {zusatz !== undefined && (
        <span
          className="font-mono text-[10px] font-normal"
          style={{ color: selected ? 'currentColor' : 'var(--tf-text-tertiary)' }}
        >
          {zusatz}
        </span>
      )}
      {/* Die Zahl erbt im getönten An-Zustand `currentColor` — eine zweite Farbe
          hier machte den Chip zum Diagramm. Zurückgenommen wird sie über Größe
          und Schriftstärke, NICHT über `opacity`: 0,75 auf einer getönten Fläche
          drückte den gemessenen Kontrast von 4,7:1 auf ~3,3:1 (Pitfall #14 —
          Deckkraft ist auch hier das falsche Werkzeug). */}
      {zahl !== undefined && (
        <span
          className="tabular-nums text-[11.5px] font-normal"
          style={{ color: selected ? 'currentColor' : 'var(--tf-text-secondary)' }}
        >
          {zahl}
        </span>
      )}
    </button>
  );
}
