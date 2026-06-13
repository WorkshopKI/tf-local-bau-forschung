interface ListItemProps {
  title: string | React.ReactNode;
  subtitle?: string;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  /** Wenn true, wird das Icon ohne den runden 28px-Hintergrund gerendert.
   *  Sinnvoll für Pills/Badges (z.B. VB-Phase), die ihren eigenen Hintergrund
   *  mitbringen — der Circle würde sonst wie ein Pill-in-Circle aussehen. */
  iconBare?: boolean;
  /** Layout des Titel/Subtitle-Bereichs. `'stacked'` (Default) = Titel über
   *  Subtitle (zweizeilig, heutiges Verhalten). `'inline'` = Titel und Subtitle
   *  nebeneinander in einer Zeile (Titel `whitespace-nowrap`, Subtitle
   *  `truncate flex-1`) — für einzeilige Daten-Zeilen mit Aktions-Buttons
   *  (z.B. Skill-/Regel-Liste). Bündelt das passende Zeilen-Chrome (px-4 py-2.5,
   *  Hover-Background) für die Verwendung in einem gerundeten Listen-Container. */
  layout?: 'stacked' | 'inline';
  /** Tailwind-Klassen-Override fuer den title-Absatz. Standard (stacked):
   *  `text-[13.5px] text-[var(--tf-text)] truncate`; (inline):
   *  `text-[13.5px] font-medium text-[var(--tf-text)] whitespace-nowrap`.
   *  Erlaubt Aufrufern eine spezifische Typografie. */
  titleClassName?: string;
  /** Tailwind-Klassen-Override fuer den subtitle-Absatz. Standard (stacked):
   *  `text-[12px] text-[var(--tf-text-secondary)] truncate`; (inline):
   *  `text-[12px] text-[var(--tf-text-tertiary)] truncate flex-1 min-w-0`. */
  subtitleClassName?: string;
  /** Rechtsbündiger Aktions-Slot NACH `meta` (z.B. RowAction-Buttons, Switch).
   *  Klicks darin lösen die Zeilen-`onClick` NICHT aus — der
   *  Stop-Propagation-Wrapper ist eingebaut. */
  actions?: React.ReactNode;
  onClick?: () => void;
  last?: boolean;
}

const DEFAULT_TITLE_CLASS = 'text-[13.5px] text-[var(--tf-text)] truncate';
const DEFAULT_SUBTITLE_CLASS = 'text-[12px] text-[var(--tf-text-secondary)] truncate';
const INLINE_TITLE_CLASS = 'text-[13.5px] font-medium text-[var(--tf-text)] whitespace-nowrap';
const INLINE_SUBTITLE_CLASS = 'text-[12px] text-[var(--tf-text-tertiary)] truncate flex-1 min-w-0';

export function ListItem({
  title,
  subtitle,
  meta,
  icon,
  iconBare = false,
  layout = 'stacked',
  titleClassName,
  subtitleClassName,
  actions,
  onClick,
  last,
}: ListItemProps): React.ReactElement {
  const isInline = layout === 'inline';
  const titleClass = titleClassName ?? (isInline ? INLINE_TITLE_CLASS : DEFAULT_TITLE_CLASS);
  const subtitleClass = subtitleClassName ?? (isInline ? INLINE_SUBTITLE_CLASS : DEFAULT_SUBTITLE_CLASS);
  const pad = isInline ? 'px-4 py-2.5' : 'py-3';
  const hover = onClick
    ? (isInline ? 'cursor-pointer hover:bg-[var(--tf-bg-secondary)]' : 'cursor-pointer hover:opacity-70')
    : '';

  return (
    <div
      className={`flex items-center gap-3 ${pad} ${hover}`}
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
      {isInline ? (
        // Einzeilig: Titel (nowrap) + Subtitle (flex-1 truncate) als direkte
        // Flex-Geschwister — der Subtitle trägt das `flex-1` und schiebt
        // meta/actions nach rechts (auch bei leerem Subtitle stabil).
        <>
          <p className={titleClass}>{title}</p>
          <p className={subtitleClass}>{subtitle}</p>
        </>
      ) : (
        <div className="flex-1 min-w-0">
          <p className={titleClass}>{title}</p>
          {subtitle && <p className={subtitleClass}>{subtitle}</p>}
        </div>
      )}
      {meta && <div className="shrink-0 flex items-center gap-2">{meta}</div>}
      {actions && (
        <div className="shrink-0 flex items-center" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
