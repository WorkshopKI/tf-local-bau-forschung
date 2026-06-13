interface ListItemProps {
  title: string | React.ReactNode;
  subtitle?: string;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  /** Wenn true, wird das Icon ohne den runden 28px-Hintergrund gerendert.
   *  Sinnvoll für Pills/Badges (z.B. VB-Phase), die ihren eigenen Hintergrund
   *  mitbringen — der Circle würde sonst wie ein Pill-in-Circle aussehen. */
  iconBare?: boolean;
  /** Tailwind-Klassen-Override fuer den title-Absatz. Standard:
   *  `text-[13.5px] text-[var(--tf-text)] truncate`. Erlaubt Aufrufern
   *  eine spezifische Typografie (z.B. Konsistenz mit anderen Listen). */
  titleClassName?: string;
  /** Tailwind-Klassen-Override fuer den subtitle-Absatz. Standard:
   *  `text-[12px] text-[var(--tf-text-secondary)] truncate`. */
  subtitleClassName?: string;
  onClick?: () => void;
  last?: boolean;
}

const DEFAULT_TITLE_CLASS = 'text-[13.5px] text-[var(--tf-text)] truncate';
const DEFAULT_SUBTITLE_CLASS = 'text-[12px] text-[var(--tf-text-secondary)] truncate';

export function ListItem({
  title,
  subtitle,
  meta,
  icon,
  iconBare = false,
  titleClassName = DEFAULT_TITLE_CLASS,
  subtitleClassName = DEFAULT_SUBTITLE_CLASS,
  onClick,
  last,
}: ListItemProps): React.ReactElement {
  return (
    <div
      className={`flex items-center gap-3 py-3 ${onClick ? 'cursor-pointer hover:opacity-70' : ''}`}
      style={!last ? { borderBottom: '0.5px solid var(--tf-border)' } : undefined}
      onClick={onClick}
    >
      {icon && (
        iconBare ? (
          <div className="shrink-0">{icon}</div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-[var(--tf-bg-secondary)] flex items-center justify-center shrink-0">
            {icon}
          </div>
        )
      )}
      <div className="flex-1 min-w-0">
        <p className={titleClassName}>{title}</p>
        {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
      </div>
      {meta && <div className="shrink-0 flex items-center gap-2">{meta}</div>}
    </div>
  );
}
