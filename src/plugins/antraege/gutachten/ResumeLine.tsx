/**
 * Dezente Wiederaufnahme-Zeile („Zuletzt bearbeitet am … — Abschnitt X in Arbeit"
 * + „Weiter bei X"). Erscheint, sobald am Workflow gearbeitet wurde und der
 * aktive Schritt nicht freigegeben ist.
 */
import type { WorkflowStep } from '@/core/services/skills';
import { Button } from '@/components/ui/button';
import { formatDate } from '../kurzfassung/kurzfassung-verlauf';
import type { StepId, WorkflowRun } from './types';

export function ResumeLine(
  { run, steps, onWeiter }: { run: WorkflowRun; steps: WorkflowStep[]; onWeiter: (id: StepId) => void },
): React.ReactElement {
  const def = steps.find(s => s.id === run.aktiverSchritt) ?? { id: run.aktiverSchritt, kurz: run.aktiverSchritt, label: run.aktiverSchritt };
  return (
    <div className="flex items-center gap-3.5 mb-5 pl-3.5 border-l-[3px] border-[var(--tf-border-hover)] rounded-r-[8px] bg-[var(--tf-bg)] py-3 pr-4">
      <span className="flex-1 text-[13px] text-[var(--tf-text-secondary)]">
        Zuletzt bearbeitet am <span className="font-mono">{formatDate(run.geaendert_am)}</span> — Abschnitt {def.kurz} ({def.label}) in Arbeit
      </span>
      <Button
        type="button"
        variant="primary"
        onClick={() => onWeiter(run.aktiverSchritt)}
        className="whitespace-nowrap"
      >
        Weiter bei {def.kurz}
      </Button>
    </div>
  );
}
