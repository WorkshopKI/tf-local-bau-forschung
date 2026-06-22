/**
 * Vertikale Abschnitts-Rail des Werkstatt-Layouts (Design-Handoff
 * `workflow-mit-bearbeiten`, `.g-rail`): sticky Stepper mit Verbindungslinie,
 * 28px-Buchstaben-Badge in drei Zuständen (Entwurf/Aktiv/Freigegeben) + Häkchen
 * rechts bei Freigabe. Status rein aus `StepRun.status`; Klick fokussiert den
 * Abschnitt über `onJump` (= `weiterschaltenStep`), auch leere (öffnet den
 * Generieren-Prompt). Tastatur: ↑/↓ springt zwischen Abschnitten.
 *
 * Styles in `gutachten.css` (gescopt unter `.gutachten-werkstatt`).
 */
import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import type { WorkflowStep } from '@/core/services/skills';
import { nextStepId } from './nav-layout';
import type { StepId, StepStatus, WorkflowRun } from './types';

/** Anzeige-Ableitung eines Abschnitts-Status (pur, testbar). */
export interface StepNavDescriptor {
  /** Welches Symbol rechts steht. */
  icon: 'check' | 'pencil' | 'circle';
  /** Kurzer Status-Text (Tooltip/aria). */
  statusLabel: string;
  /** Tone für Badge-/Icon-Farbe. */
  tone: 'success' | 'arbeit' | 'offen';
}

/** Mappt `StepStatus` → Anzeige (Symbol/Label/Tone). Einzige Status-Quelle. */
export function stepNavDescriptor(status: StepStatus): StepNavDescriptor {
  switch (status) {
    case 'freigegeben':
      return { icon: 'check', statusLabel: 'freigegeben', tone: 'success' };
    case 'entwurf':
      return { icon: 'pencil', statusLabel: 'in Arbeit', tone: 'arbeit' };
    default:
      return { icon: 'circle', statusLabel: 'offen', tone: 'offen' };
  }
}

export function AbschnittNav(
  { run, steps, onJump, onResizeStart }: {
    run: WorkflowRun;
    steps: WorkflowStep[];
    onJump: (id: StepId) => void;
    /** Pointer-Down auf der rechten Ziehleiste (Rail-Breite anpassen). Fehlt → keine Leiste. */
    onResizeStart?: (e: React.PointerEvent) => void;
  },
): React.ReactElement {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Aktiven Eintrag in den sichtbaren Bereich scrollen (z.B. nach Tastatur-Sprung).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [run.aktiverSchritt]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onJump(nextStepId(steps, run.aktiverSchritt, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onJump(nextStepId(steps, run.aktiverSchritt, -1));
    }
  };

  return (
    <aside
      className="g-rail sticky"
      aria-label="Abschnitte"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="g-rail-line" />
      {onResizeStart && (
        <div
          className="g-rail-resize"
          onPointerDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Abschnittsliste-Breite anpassen"
          title="Breite ziehen"
        />
      )}
      {steps.map(def => {
        const status: StepStatus = run.schritte[def.id]?.status ?? 'leer';
        const isActive = def.id === run.aktiverSchritt;
        const freigegeben = status === 'freigegeben';
        const desc = stepNavDescriptor(status);
        const badgeCls = freigegeben ? ' freigegeben' : isActive ? ' active' : '';

        return (
          <button
            key={def.id}
            ref={isActive ? activeRef : undefined}
            type="button"
            className={`g-step${isActive ? ' active' : ''}${def.parentStepId ? ' sub' : ''}`}
            onClick={() => onJump(def.id)}
            aria-current={isActive ? 'step' : undefined}
            title={`${def.kurz} — ${def.label} (${desc.statusLabel})`}
          >
            <span className={`g-step-badge${badgeCls}`}>
              {freigegeben ? <Check className="g-sbi" aria-label="freigegeben" /> : def.kurz}
            </span>
            <span className="g-step-txt">
              <span className="g-step-title">{def.kurz} — {def.label}</span>
            </span>
            {freigegeben && <span className="g-step-done"><Check className="g-sdi" /></span>}
          </button>
        );
      })}
    </aside>
  );
}
