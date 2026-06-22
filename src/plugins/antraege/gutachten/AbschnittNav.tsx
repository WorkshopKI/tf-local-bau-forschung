/**
 * Vertikale Abschnitts-Rail des Werkstatt-Layouts (Design-Handoff
 * `workflow-stepper-neu`, „Docked Rail" `.g-rail.docked`): an die Entwurf-Karte
 * angedockt (gemeinsamer Rahmen, kein Gap), grauer Grund, aktiver Schritt hebt sich
 * weiß ab. Steps + Verbindungslinie liegen sticky im `.g-rail-inner` und scrollen
 * bei langen Karten mit. 28px-Buchstaben-Badge in drei Zuständen (Entwurf/Aktiv/
 * Freigegeben — Badge zeigt IMMER den Buchstaben, freigegeben = grüner Kreis) +
 * kleines Häkchen rechts vom Titel-Label bei Freigabe. Label nur der Titel (der
 * Buchstabe steckt im Badge). Status rein aus `StepRun.status`; Klick fokussiert
 * den Abschnitt über `onJump` (= `weiterschaltenStep`), auch leere (öffnet den
 * Generieren-Prompt). Tastatur: ↑/↓ springt zwischen Abschnitten.
 *
 * Die Breite kommt als `railWidth` (inline), die Ziehleiste rendert der Container
 * (`GutachtenSection`) als Flex-Kind zwischen Rail und Karte.
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
  { run, steps, onJump, railWidth }: {
    run: WorkflowRun;
    steps: WorkflowStep[];
    onJump: (id: StepId) => void;
    /** Breite der angedockten Rail (px) — vom Container per Ziehleiste gesteuert. */
    railWidth: number;
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
      className="g-rail docked"
      style={{ width: railWidth }}
      aria-label="Abschnitte"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="g-rail-inner">
        <div className="g-rail-line" />
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
              {/* Badge zeigt immer den Buchstaben; freigegeben = grüner Kreis (kein Häkchen-Ersatz). */}
              <span className={`g-step-badge${badgeCls}`}>{def.kurz}</span>
              {/* Label nur der Titel (Buchstabe steckt im Badge). */}
              <span className="g-step-txt">
                <span className="g-step-title">{def.label}</span>
              </span>
              {freigegeben && <span className="g-step-done"><Check className="g-sdi" aria-label="freigegeben" /></span>}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
