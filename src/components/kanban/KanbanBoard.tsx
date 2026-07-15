/**
 * Generische Kanban-Board-Shell (v2.228, extrahiert aus dem Feedback-Kanban
 * v2.225): Lane-Layout, getönte Lane-Köpfe (Akzent via `--lane-c` +
 * color-mix), 46px-Schmalschiene für leere Lanes, Dichte, 1–2 Karten-Spalten
 * je Lane. Domänenfrei — Karten-Renderer, Labels, Icons und Akzente kommen
 * vom Aufrufer (Feedback-Board, Home-Antrags-Widget).
 *
 * Zwei Layouts:
 *  - 'fest'  = 250px-Lanes + horizontaler Scroll (Feedback-Board, unverändert
 *              zur v2.225-Optik)
 *  - 'fluid' = Lanes teilen die verfügbare Breite (Widget-Kontext), eine
 *              2-spaltige Lane bekommt den doppelten Flex-Anteil
 */
/** Strukturell statt LucideIcon: auch dynamische Icon-Resolver (getLucideIcon
 *  im Feedback-Board liefert IconComponent) passen hier hinein. */
export type KanbanLaneIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  className?: string;
}>;

/** Lane-Tönung: Akzent (--lane-c, per Lane gesetzt) in eine Theme-Basis mischen. */
const mix = (pct: number, base: string): string =>
  `color-mix(in srgb, var(--lane-c) ${pct}%, ${base})`;

export interface KanbanBoardColumn<T> {
  /** React-Key + Identität der Lane. */
  key: string;
  label: string;
  icon: KanbanLaneIcon;
  /** CSS-Farbwert (Theme-Token, z.B. 'var(--tf-fb-lane-neu)') — wird als
   *  `--lane-c` injiziert; alle Tönungen entstehen per color-mix (dark-aware). */
  accent: string;
  items: T[];
  /** Zähler-Pill im Lane-Kopf (Default: items.length). Für gekappte Lanes
   *  (maxKartenProLane) die GESAMT-Zahl übergeben. */
  count?: number;
  /** Karten-Spalten innerhalb der Lane (Default 1). */
  spalten?: 1 | 2;
  /** Optionale Fußzeile unter den Karten (z.B. „+ N weitere →"). */
  footer?: React.ReactNode;
  /** Tooltip-/Titel-Zusatz der Schmalschiene (Default: `${label} — leer`). */
  leerTitel?: string;
}

interface KanbanBoardProps<T> {
  columns: KanbanBoardColumn<T>[];
  /** Karten-Renderer — MUSS ein Element mit stabilem `key` liefern. */
  renderCard: (item: T, col: KanbanBoardColumn<T>) => React.ReactNode;
  /** Kompakte Dichte (engere Karten-Abstände). */
  dense?: boolean;
  layout?: 'fest' | 'fluid';
}

export function KanbanBoard<T>({ columns, renderCard, dense, layout = 'fest' }: KanbanBoardProps<T>): React.ReactElement {
  const fest = layout === 'fest';
  return (
    <div className={fest ? 'flex gap-3.5 overflow-x-auto pb-3 items-start' : 'flex gap-3 overflow-x-auto items-start'}>
      {columns.map(col => {
        const Icon = col.icon;
        if (col.items.length === 0 && !col.footer) {
          return (
            <div
              key={col.key}
              className="shrink-0 w-[46px] py-2.5 flex items-start justify-center rounded-[15px]"
              style={{ ['--lane-c' as string]: col.accent, border: `1px dashed ${mix(30, 'var(--tf-border)')}` }}
              title={col.leerTitel ?? `${col.label} — leer`}
            >
              <span className="inline-flex items-center gap-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--tf-text-tertiary)] [writing-mode:vertical-rl] rotate-180">
                <Icon size={14} strokeWidth={1.5} style={{ color: 'var(--lane-c)' }} className="shrink-0" />
                {col.label}
                <span className="opacity-70 tabular-nums">0</span>
              </span>
            </div>
          );
        }
        const zweiSpaltig = (col.spalten ?? 1) === 2;
        const breite = fest
          ? 'shrink-0 w-[250px]'
          : zweiSpaltig
            ? 'flex-[2] basis-0 min-w-[300px]'
            : 'flex-1 basis-0 min-w-[170px]';
        return (
          <div
            key={col.key}
            className={`${breite} rounded-[15px] overflow-hidden bg-[var(--tf-bg)] px-3 pb-3 flex flex-col ${dense ? 'gap-1.5' : 'gap-[9px]'}`}
            style={{ ['--lane-c' as string]: col.accent, border: `0.5px solid ${mix(60, 'var(--tf-border)')}` }}
          >
            {/* Vollbreite getönte Kopfzeile (style-head) */}
            <div
              className="-mx-3 px-3 py-[11px] flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.07em]"
              style={{ background: mix(9, 'var(--tf-bg)'), borderBottom: `0.5px solid ${mix(15, 'var(--tf-border)')}` }}
            >
              <Icon size={18} strokeWidth={1.5} style={{ color: 'var(--lane-c)' }} className="shrink-0" />
              <span style={{ color: mix(58, 'var(--tf-text)') }}>{col.label}</span>
              <span
                className="ml-auto min-w-5 h-5 px-1.5 rounded-full grid place-items-center text-[11px] font-medium tabular-nums bg-[var(--tf-bg)]"
                style={{ color: mix(62, 'var(--tf-text)'), border: `0.5px solid ${mix(22, 'var(--tf-border)')}` }}
              >
                {col.count ?? col.items.length}
              </span>
            </div>
            {zweiSpaltig ? (
              <div className={`grid grid-cols-2 ${dense ? 'gap-1.5' : 'gap-[9px]'}`}>
                {col.items.map(item => renderCard(item, col))}
              </div>
            ) : (
              col.items.map(item => renderCard(item, col))
            )}
            {col.footer}
          </div>
        );
      })}
    </div>
  );
}
