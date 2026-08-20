/**
 * Der Zähler eines EINGEKLAPPTEN Kanban-Widgets: je Bahn eine getönte Pille mit
 * Bezeichnung und Zahl. Wo das Board zugeklappt ist, ersetzt sie die Bahnen —
 * die Aussage „wie viel liegt wo" bleibt sichtbar, ohne dass die Karten laden.
 *
 * Stand bis v3.44 zweimal wortgleich in `AntragKanbanWidget` und
 * `FeedbackKanbanWidget` — bis auf `max-w-[110px]` gegen `max-w-[120px]`, was
 * kein Entwurf war, sondern der Zwilling. Es gilt die 120: Status-KATEGORIEN
 * („Nachforderung läuft") sind länger als Feedback-Status.
 *
 * Die Pille ist bewusst Tailwind und nicht `tf-board.css`: sie ist kein Teil der
 * Bahn-Geometrie, sondern das, was an ihrer Stelle steht.
 */

/** Was eine Pille zeigt. Beide Aufrufer bilden ihre Lanes darauf ab — das
 *  Bauteil kennt weder Status-Kategorie noch Feedback-Status. */
export interface LanePill {
  key: string;
  label: string;
  /** Fertiger CSS-Farbwert (Theme-Token), wie `TfBoardBahn.accent`. */
  accent: string;
  gesamt: number;
}

export function LanePills({ pills }: { pills: readonly LanePill[] }): React.ReactElement {
  return (
    <>
      {pills.map(p => (
        <span
          key={p.key}
          title={p.label}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[11px] tabular-nums max-w-[120px]"
          style={{
            color: `color-mix(in srgb, ${p.accent} 70%, var(--tf-text))`,
            background: `color-mix(in srgb, ${p.accent} 12%, var(--tf-bg))`,
          }}
        >
          <span className="truncate">{p.label}</span>
          {p.gesamt}
        </span>
      ))}
    </>
  );
}
