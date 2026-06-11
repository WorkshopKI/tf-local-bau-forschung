/**
 * Dezente Wiederaufnahme-Zeile („Zuletzt bearbeitet am … — Abschnitt X in Arbeit"
 * + „Weiter bei X"). Erscheint, sobald am Workflow gearbeitet wurde und der
 * aktive Schritt nicht freigegeben ist.
 */
import { stepDef } from './workflow-definition';
import { formatDate } from '../kurzfassung/kurzfassung-verlauf';
import type { StepId, WorkflowRun } from './types';

export function ResumeLine(
  { run, onWeiter }: { run: WorkflowRun; onWeiter: (id: StepId) => void },
): React.ReactElement {
  const def = stepDef(run.aktiverSchritt);
  return (
    <div className="flex items-center gap-3.5 mb-5 pl-3.5 border-l-[3px] border-[var(--tf-border-hover)] rounded-r-[8px] bg-[var(--tf-bg)] py-3 pr-4">
      <span className="flex-1 text-[13px] text-[var(--tf-text-secondary)]">
        Zuletzt bearbeitet am <span className="font-mono">{formatDate(run.geaendert_am)}</span> — Abschnitt {def.id} ({def.label}) in Arbeit
      </span>
      <button
        type="button"
        onClick={() => onWeiter(run.aktiverSchritt)}
        className="px-4 py-2 rounded-[8px] text-[13px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 whitespace-nowrap"
      >
        Weiter bei {def.id}
      </button>
    </div>
  );
}
