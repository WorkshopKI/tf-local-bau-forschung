/**
 * Das Zeichen fuers Ein- und Ausklappen — ein Chevron, keine Kante, kein
 * Dauer-Rahmen (Design-Handoff `_design/handoff/hide`, Variante B6).
 *
 * Warum kein lucide-Icon mehr: `PanelLeftClose`/`PanelLeftOpen` sind ein
 * Rechteck mit Trennlinie und Balken, dazu ein 5 px schmaler Chevron darin. Auf
 * 16 px zaehlt nur die Silhouette — und die hat das nackte Chevron, der
 * Panel-Rahmen nicht. Der Knopf darum war zusaetzlich dauerhaft umrandet: ein
 * Kasten um ein Glyph, das selbst ein Kasten ist.
 *
 * Geteilt wird hier BEIDES — Glyph und Knopf. Vorher lagen acht Aufrufe
 * verstreut in der App und drifteten auf drei Achsen auseinander (Icon-Groesse
 * 15/16/18, Hover-Flaeche `--tf-hover` vs. `--tf-bg-secondary`, Radius 6 px vs.
 * `--tf-radius`). Nur ein gemeinsames Bauteil haelt sie zwangslaeufig gleich.
 *
 * Bekannte Form-Kollision, bewusst in Kauf genommen: das nackte Chevron teilt
 * seine Form mit den Aufklappern der Filter-Abschnitte (`FilterSidebarItem`,
 * 14 px, dieselbe Farbe) und mit Abschnitts-Chevrons in rund 40 weiteren
 * Dateien. Getrennt wird durch Richtung (links statt rechts/unten) und Ort
 * (Kopfzeile, rechts aussen) — nicht durch die Form. Das ist die Entscheidung
 * des Handoffs, kein Versehen; die Alternative mit Kantenstummel wurde
 * verworfen.
 *
 * `offen` beschreibt den ZUSTAND der Leiste, nicht die Richtung des Klicks:
 * offen -> Chevron zeigt nach links (einklappen), zu -> nach rechts.
 */

interface IconProps {
  /** Kantenlaenge in px. 16 an 24er-Knoepfen, 18 an der App-Navigation. */
  size?: number;
  /** Zustand der Leiste: offen (Chevron nach links) oder eingeklappt. */
  offen?: boolean;
  className?: string;
}

/** Nur das Glyph — fuer Stellen, an denen die Trefferflaeche eine ganze Leiste
 *  ist (die 32-px-Schienen) und der Knopf unten deshalb nicht passt. */
export function EinklappIcon({ size = 16, offen = true, className }: IconProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={offen ? 'M10.6 4.4 6.4 8l4.2 3.6' : 'M6.4 4.4 10.6 8l-4.2 3.6'} />
    </svg>
  );
}

interface ButtonProps {
  /** Zustand der Leiste — steuert Glyph-Richtung UND `aria-expanded`. */
  offen: boolean;
  onClick: () => void;
  /** Text fuer `title` und `aria-label` (z.B. „Filterleiste einklappen"). */
  label: string;
  /** 30 x 30 statt 24 x 24, Glyph 18 px — nur die App-Navigation. */
  gross?: boolean;
  /** Ausschliesslich Platzierung (`ml-auto`, `-ml-1`); Aussehen kommt von hier. */
  className?: string;
}

export function EinklappButton({ offen, onClick, label, gross = false, className }: ButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={offen}
      className={
        'shrink-0 grid place-items-center rounded-[6px] cursor-pointer'
        + ' text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]'
        + ' hover:bg-[var(--tf-hover)] transition-colors'
        + (gross ? ' h-[30px] w-[30px]' : ' h-6 w-6')
        + (className ? ' ' + className : '')
      }
    >
      <EinklappIcon size={gross ? 18 : 16} offen={offen} />
    </button>
  );
}
