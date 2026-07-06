/**
 * Eine Artefakt-Karte (Journey-Paket 2 Phase 7): kompakte Fortschritts-Kachel für
 * ein Artefakt (Gutachten / Nachforderung). Generische Hülle — der Inhalt (Titel,
 * Badge, Fortschritt, Zustandszeile, Aktion) kommt vom Aufrufer (`ArtefaktLeiste`).
 *
 * Nur bestehende Tokens; die einzige Farbe im Kopf ist der amber Frist-Badge
 * (`--tf-warning-*`), den der Aufrufer als `badge` reicht.
 */
import { ArrowRight } from 'lucide-react';

interface Props {
  /** Caps-Titel, z. B. `GUTACHTEN`. */
  titel: string;
  /** Rechts oben: Zähl-Text (`4 / 7 freigegeben`) oder amber Frist-Badge. */
  badge?: React.ReactNode;
  /** 3px-Fortschrittsbalken; `null` = kein Balken. */
  progress?: { value: number; max: number } | null;
  /** Zustandszeile unten links (eine Zeile, umbruchsicher). */
  zeile: React.ReactNode;
  /** Aktions-Button unten rechts (Sprung in die Werkstatt). */
  aktion?: { label: string; onClick: () => void } | null;
}

export function ArtefaktKarte({ titel, badge, progress, zeile, aktion }: Props): React.ReactElement {
  const pct = progress && progress.max > 0
    ? Math.round((progress.value / progress.max) * 100)
    : 0;

  return (
    <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-4 py-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">{titel}</span>
        <span className="flex-1" />
        {badge}
      </div>

      {progress ? (
        <div className="h-[3px] rounded-full bg-[var(--tf-border)] overflow-hidden mb-3">
          <div className="h-full rounded-full bg-[var(--tf-text-secondary)]" style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="mb-3" />
      )}

      <div className="flex items-center gap-3">
        <span className="flex-1 min-w-0 text-[12.5px] text-[var(--tf-text-secondary)] truncate">{zeile}</span>
        {aktion ? (
          <button
            type="button"
            onClick={aktion.onClick}
            className="shrink-0 inline-flex items-center gap-1 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] px-3 py-1 text-[12px] text-[var(--tf-text)] hover:border-[var(--tf-primary)] hover:text-[var(--tf-primary)] transition-colors"
          >
            {aktion.label}
            <ArrowRight size={13} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
