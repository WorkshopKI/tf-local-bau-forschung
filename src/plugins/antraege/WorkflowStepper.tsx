/**
 * 5-Step Workflow-Indicator fuer Foerderantraege.
 * Mapping aus den Vorgang-Status-Werten in src/core/utils/status-mappings.ts:
 *   eingereicht                       -> 0 Eingang
 *   in_pruefung / in_begutachtung     -> 2 Fachpruefung (Vollstaendigkeit ist Vorprozess; reale Statuswerte liefern hier nicht genug Granularitaet)
 *   nachbesserung / nachforderung     -> 2 Fachpruefung (warning-Akzent)
 *   bewilligt / genehmigt             -> 3 Bewilligung
 *   abgeschlossen / archiviert        -> 4 Schluss
 */
const STEPS = ['Eingang', 'Vollständigkeit', 'Fachprüfung', 'Bewilligung', 'Schluss'] as const;

const STATUS_TO_STEP: Record<string, number> = {
  eingereicht: 0,
  in_bearbeitung: 1,
  in_pruefung: 2,
  in_begutachtung: 2,
  nachbesserung: 2,
  nachforderung: 2,
  bewilligt: 3,
  genehmigt: 3,
  abgeschlossen: 4,
  archiviert: 4,
};

const WARNING_STATUSES = new Set(['nachbesserung', 'nachforderung']);
const ERROR_STATUSES = new Set(['abgelehnt']);

interface Props {
  status: string;
}

export function WorkflowStepper({ status }: Props): React.ReactElement {
  const activeStep = STATUS_TO_STEP[status] ?? 0;
  const isWarning = WARNING_STATUSES.has(status);
  const isError = ERROR_STATUSES.has(status);

  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const isActive = i === activeStep && !isError;
        const isPast = i < activeStep;
        const isFuture = i > activeStep;

        let className = 'px-2.5 py-1 rounded-full text-[11.5px] whitespace-nowrap';
        if (isError) {
          className += ' bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]';
        } else if (isActive && isWarning) {
          className += ' bg-[var(--tf-warning-bg,#fef3c7)] text-[var(--tf-warning-text,#92400e)]';
        } else if (isActive) {
          className += ' bg-[var(--tf-text)] text-[var(--tf-bg)]';
        } else if (isPast) {
          className += ' bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]';
        } else if (isFuture) {
          className += ' text-[var(--tf-text-tertiary)]';
        }

        return (
          <div key={label} className="flex items-center gap-1.5">
            <span className={className}>{label}</span>
            {i < STEPS.length - 1 && (
              <span className="text-[var(--tf-text-tertiary)] text-[10px]">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
