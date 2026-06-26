import { cn } from '@/lib/utils';

export interface StatusDotProps {
  /** Punkt-Farbe (CSS-Wert/Token — Ableitung kommt IMMER vom Aufrufer, keine
   *  Status-Domänenlogik in der Schicht). */
  color: string;
  /** Tooltip (native title). */
  title?: string;
  /** a11y-Label; Default = title. */
  ariaLabel?: string;
  /** Durchmesser in px (Default 6). */
  size?: number;
  className?: string;
}

/** Kleiner farbiger Status-Punkt für Listen/Tiles. */
export function StatusDot({
  color,
  title,
  ariaLabel,
  size = 6,
  className,
}: StatusDotProps): React.ReactElement {
  return (
    <span
      className={cn('inline-block rounded-full shrink-0', className)}
      style={{ width: size, height: size, background: color }}
      title={title}
      aria-label={ariaLabel ?? title}
    />
  );
}

export interface StatusBadgeProps {
  /** Anzeigetext des Badges. */
  label: React.ReactNode;
  /** Akzentfarbe für den führenden Punkt (CSS-Wert/Token). Weglassen = ohne Punkt. */
  color?: string;
  title?: string;
  className?: string;
}

/**
 * Pill-förmiges Status-Badge: optionaler farbiger Punkt + Label. Die Farbe
 * kommt immer vom Aufrufer — die Schicht kennt keine Status-Werte.
 */
export function StatusBadge({
  label,
  color,
  title,
  className,
}: StatusBadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium',
        'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]',
        className,
      )}
      style={{ border: '0.5px solid var(--tf-border)' }}
      title={title}
    >
      {color != null && <StatusDot color={color} size={6} />}
      {label}
    </span>
  );
}
