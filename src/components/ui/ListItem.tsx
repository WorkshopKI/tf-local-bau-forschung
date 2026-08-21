/**
 * Trennlinie der DICHTEN Listenzeile — `--tf-border` auf 45 % gedaempft.
 *
 * Steht hier als Konstante, weil sie inzwischen zwei Zeilen-Arten traegt: die
 * dichte `ListItem`-Zeile (Startseite „Meine Antraege") und den Verbund-Trenner
 * im Nachtlauf-Widget. Beide sollen gleich leise gliedern; eine zweite,
 * abgeschriebene Prozentzahl waere beim naechsten Feinschliff auseinander
 * gelaufen. `color-mix` statt einer festen rgba-Angabe, sonst waere die Linie
 * im Dunkelmodus unsichtbar.
 */
export const TRENNLINIE_GEDAEMPFT = 'color-mix(in srgb, var(--tf-border) 45%, transparent)';

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
  /** Engere Zeile fuer lange Listen auf knappem Raum (nur `layout='stacked'`):
   *  Polster 12px → 6px, Abstand Icon↔Text 12px → 10px, Trennlinie auf 45%
   *  gedaempft. Spart ~14px je Zeile.
   *
   *  **Opt-in, bewusst kein neuer Standard**: `ListItem` traegt sieben Aufrufer
   *  (Einstellungen, Skill-Verwaltung, Startseite). Ein geaenderter Default
   *  haette alle mitgezogen, obwohl nur die Startseiten-Karte „Meine Antraege"
   *  unter Platzmangel leidet. */
  dicht?: boolean;
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
  /** Markiert die Zeile als aktiv/ausgewählt: setzt `aria-current` und das
   *  Selektions-Styling (`activeClassName` oder der neutrale Default-Tint). Für
   *  Nav-/Auswahl-Listen (z.B. Abschnitts-Navigation) statt reiner Tabellen. */
  active?: boolean;
  /** Tailwind-Klassen für den aktiven Zustand (überschreibt den Default-Tint).
   *  Nur wirksam mit `active`. Z.B. ein farbiger Links-Akzent via inset-Shadow. */
  activeClassName?: string;
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
  dicht = false,
  titleClassName,
  subtitleClassName,
  actions,
  onClick,
  last,
  active = false,
  activeClassName,
}: ListItemProps): React.ReactElement {
  const isInline = layout === 'inline';
  const titleClass = titleClassName ?? (isInline ? INLINE_TITLE_CLASS : DEFAULT_TITLE_CLASS);
  const subtitleClass = subtitleClassName ?? (isInline ? INLINE_SUBTITLE_CLASS : DEFAULT_SUBTITLE_CLASS);
  const eng = dicht && !isInline;
  const pad = isInline ? 'px-4 py-2.5' : (eng ? 'py-1.5' : 'py-3');
  const gap = eng ? 'gap-2.5' : 'gap-3';
  const trennFarbe = eng ? TRENNLINIE_GEDAEMPFT : 'var(--tf-border)';
  const hover = onClick
    ? (isInline ? 'cursor-pointer hover:bg-[var(--tf-bg-secondary)]' : 'cursor-pointer hover:opacity-70')
    : '';
  const activeCls = active ? (activeClassName ?? 'bg-[var(--tf-bg-secondary)]') : '';

  return (
    <div
      className={`flex items-center ${gap} ${pad} ${hover} ${activeCls}`}
      style={!last ? { borderBottom: `0.5px solid ${trennFarbe}` } : undefined}
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
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
