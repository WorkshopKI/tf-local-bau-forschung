/**
 * 5-Step Workflow-Indicator fuer Foerderantraege.
 *
 * Der aktive Step wird in der Status-Variante (success/warning/info/error/default) eingefaerbt —
 * dadurch ist die Status-Info im Stepper enthalten und braucht kein separates Status-Badge im Header.
 *
 * Mapping aus den Vorgang-Status-Werten in src/core/utils/status-mappings.ts:
 *   eingereicht                      -> 0 Eingang        (info)
 *   in_bearbeitung                   -> 1 Vollstaendigkeit (warning)
 *   in_pruefung / in_begutachtung    -> 2 Fachpruefung   (info / warning)
 *   nachbesserung / nachforderung    -> 2 Fachpruefung   (warning)
 *   abgelehnt                        -> 2 Fachpruefung   (error)
 *   bewilligt / genehmigt            -> 3 Bewilligung    (success)
 *   abgeschlossen / archiviert       -> 4 Schluss        (default)
 */
import { getStatusVariant, type BadgeVariant } from '@/core/utils/status-mappings';

const STEPS = ['Eingang', 'Vollständigkeit', 'Fachprüfung', 'Bewilligung', 'Schluss'] as const;

const STATUS_TO_STEP: Record<string, number> = {
  eingereicht: 0,
  in_bearbeitung: 1,
  in_pruefung: 2,
  in_begutachtung: 2,
  nachbesserung: 2,
  nachforderung: 2,
  abgelehnt: 2,
  bewilligt: 3,
  genehmigt: 3,
  abgeschlossen: 4,
  archiviert: 4,
};

function activeClassFor(variant: BadgeVariant): string {
  switch (variant) {
    case 'success':
      return 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]';
    case 'warning':
      return 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]';
    case 'info':
      return 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]';
    case 'error':
      return 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]';
    default:
      return 'bg-[var(--tf-text)] text-[var(--tf-bg)]';
  }
}

interface Props {
  status: string;
}

export function WorkflowStepper({ status }: Props): React.ReactElement {
  const activeStep = STATUS_TO_STEP[status] ?? 0;
  const variant = getStatusVariant(status);
  const activeClass = activeClassFor(variant);

  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const isActive = i === activeStep;
        const isPast = i < activeStep;

        let className = 'px-2.5 py-1 rounded-full text-[11.5px] whitespace-nowrap';
        if (isActive) {
          className += ` ${activeClass}`;
        } else if (isPast) {
          className += ' bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]';
        } else {
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
