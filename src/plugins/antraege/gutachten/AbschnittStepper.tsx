/**
 * Abschnitts-Stepper A–G (formverwandt zum `WorkflowStepper` der Antragsdetail-
 * seite, aber NICHT zweckentfremdet). Zustände rein typografisch: freigegeben =
 * gefüllter Pill, aktiv = medium + Primary-Unterstreichung (kein bunter Kreis),
 * offen = tertiary. `›`-Trenner. Klick auf einen Schritt mit Inhalt fokussiert ihn.
 */
import { ZIM_EP_WORKFLOW } from './workflow-definition';
import type { StepId, WorkflowRun } from './types';

export function AbschnittStepper(
  { run, onJump }: { run: WorkflowRun; onJump: (id: StepId) => void },
): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 flex-wrap pb-6">
      {ZIM_EP_WORKFLOW.map((def, i) => {
        const status = run.schritte[def.id]?.status ?? 'leer';
        const isActive = def.id === run.aktiverSchritt;
        const freigegeben = status === 'freigegeben';
        const klickbar = !isActive && status !== 'leer';

        let cls = 'px-2.5 py-1 rounded-full text-[12px] whitespace-nowrap';
        if (isActive) {
          cls += ' text-[var(--tf-primary)] font-medium underline decoration-[var(--tf-primary)] decoration-[1.5px] underline-offset-[5px]';
        } else if (freigegeben) {
          cls += ' bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]';
        } else {
          cls += ' text-[var(--tf-text-tertiary)]';
        }

        return (
          <div key={def.id} className="flex items-center gap-1.5">
            {klickbar ? (
              <button type="button" className={`${cls} hover:opacity-80`} onClick={() => onJump(def.id)} title={def.label}>
                {def.kurz}{freigegeben && <span className="ml-1 text-[11px] text-[var(--tf-text-tertiary)]">✓</span>}
              </button>
            ) : (
              <span className={cls} title={def.label}>{def.kurz}</span>
            )}
            {i < ZIM_EP_WORKFLOW.length - 1 && <span className="text-[var(--tf-text-tertiary)] text-[10px]">›</span>}
          </div>
        );
      })}
    </div>
  );
}
