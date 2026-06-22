/**
 * Vertikale Abschnitts-Navigation (ersetzt den horizontalen `AbschnittStepper`
 * im breiten Layout). Pro Abschnitt: Buchstaben-Badge + voller Name + Status-
 * Symbol — Status rein aus `StepRun.status` (`leer`→offen, `entwurf`→in Arbeit,
 * `freigegeben`→✓). Der aktive Abschnitt ist grün hervorgehoben (`aria-current`).
 * Klick fokussiert den Abschnitt über `onJump` (= `weiterschaltenStep`); auch
 * leere Abschnitte sind klickbar (öffnet den Generieren-Prompt rechts).
 * Auf `ListItem` aufgebaut.
 */
import { useEffect, useRef } from 'react';
import { Check, Pencil, Circle } from 'lucide-react';
import { ListItem } from '@/components/ui/ListItem';
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

const ICON_BY_KEY = { check: Check, pencil: Pencil, circle: Circle } as const;

export function AbschnittNav(
  { run, steps, onJump }: { run: WorkflowRun; steps: WorkflowStep[]; onJump: (id: StepId) => void },
): React.ReactElement {
  const activeRef = useRef<HTMLDivElement | null>(null);

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
    <nav
      aria-label="Abschnitte"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-col rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]"
    >
      {steps.map(def => {
        const status: StepStatus = run.schritte[def.id]?.status ?? 'leer';
        const isActive = def.id === run.aktiverSchritt;
        const desc = stepNavDescriptor(status);
        const StatusIcon = ICON_BY_KEY[desc.icon];
        const gruen = isActive || status === 'freigegeben';

        const badge = (
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium ${
              gruen
                ? 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]'
                : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]'
            }`}
          >
            {def.kurz}
          </span>
        );
        const iconColor =
          desc.tone === 'success'
            ? 'text-[var(--tf-success-text)]'
            : isActive
              ? 'text-[var(--tf-success-text)]'
              : 'text-[var(--tf-text-tertiary)]';
        const meta = (
          <StatusIcon size={15} className={iconColor} aria-label={desc.statusLabel} />
        );

        return (
          <div key={def.id} ref={isActive ? activeRef : undefined} className={def.parentStepId ? 'pl-3' : ''}>
            <ListItem
              layout="inline"
              icon={badge}
              iconBare
              title={`${def.kurz} — ${def.label}`}
              titleClassName={`text-[13px] truncate flex-1 min-w-0 ${isActive ? 'font-medium text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'}`}
              subtitleClassName="hidden"
              meta={meta}
              onClick={() => onJump(def.id)}
              active={isActive}
              activeClassName="bg-[var(--tf-success-bg)] shadow-[inset_3px_0_0_var(--tf-success-text)]"
              last
            />
          </div>
        );
      })}
    </nav>
  );
}
