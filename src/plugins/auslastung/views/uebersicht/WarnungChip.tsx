/**
 * WarnungChip — klickbarer Chip mit Count-Pill, Label und optionalem Suffix.
 *
 * Varianten:
 *  - `warning`: warm-orange Background + Border + Text (für offene Probleme).
 *  - `success`: grünes Background + Border + Text (für "0 betroffen — alles gut").
 *
 * Klick ruft `onClick` auf — typischerweise wird die MA-Liste auf den
 * Treffer-Filter gesetzt (z.B. "MAs ohne Buchungen anzeigen").
 */
interface Props {
  count: number;
  label: string;
  /** Optional, z.B. "→ filtern" oder "→ zuordnen". */
  suffix?: string;
  variant: 'warning' | 'success';
  onClick?: () => void;
  /** Reine Anzeige (kein Klick, kein Hover-Effekt). */
  disabled?: boolean;
}

export function WarnungChip({
  count, label, suffix, variant, onClick, disabled,
}: Props): React.ReactElement {
  const bg = `var(--tf-${variant}-bg)`;
  const text = `var(--tf-${variant}-text)`;
  const borderColor = variant === 'warning' ? 'hsl(38, 70%, 78%)' : 'hsl(145, 40%, 78%)';
  const hoverBg = variant === 'warning' ? 'hsl(38, 90%, 88%)' : 'hsl(145, 50%, 90%)';

  const interactive = !!onClick && !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 cursor-pointer disabled:cursor-default transition-colors"
      style={{
        padding: '8px 12px 8px 10px',
        borderRadius: 8,
        background: bg,
        border: `0.5px solid ${borderColor}`,
        color: text,
        fontSize: 12.5,
        lineHeight: 1.3,
      }}
      onMouseEnter={e => {
        if (interactive) e.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={e => {
        if (interactive) e.currentTarget.style.background = bg;
      }}
    >
      <span
        className="font-mono inline-flex items-center justify-center"
        style={{
          fontSize: 12,
          fontWeight: 500,
          padding: '3px 7px',
          borderRadius: 'var(--tf-radius-pill)',
          background: 'var(--tf-bg)',
          border: `0.5px solid ${borderColor}`,
          color: text,
          minWidth: 22,
        }}
      >
        {count}
      </span>
      <span>{label}</span>
      {suffix && interactive && (
        <span style={{ opacity: 0.7 }}>{suffix}</span>
      )}
    </button>
  );
}
