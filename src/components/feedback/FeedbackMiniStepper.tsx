// Kompakter 4-Segment-Fortschritts-Stepper für eigene Listen-Karten (Redesign
// v2.208). Position deterministisch aus dem Status (feedbackStepperPosition,
// Pitfall #21). Abgelehnt = Seitenpfad („✕ Abgelehnt").

import type { FeedbackStatus } from '@/core/types/feedback';
import { FEEDBACK_PIPELINE, feedbackStepperPosition } from '@/core/services/feedback';
import { STATUS_DOT, STATUS_LABELS } from './constants';

export function FeedbackMiniStepper({ status }: { status: FeedbackStatus }): React.ReactElement {
  const pos = feedbackStepperPosition(status);
  if (pos.rejected) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)]" title="Abgelehnt">
        <span aria-hidden>✕</span> Abgelehnt
      </span>
    );
  }
  const dot = STATUS_DOT[status];
  return (
    <span
      className="inline-flex items-center gap-[3px]"
      title={STATUS_LABELS[status]}
      aria-label={`Fortschritt: ${STATUS_LABELS[status]}`}
    >
      {FEEDBACK_PIPELINE.map((s, i) => {
        const on = i <= pos.index;
        return (
          <span
            key={s}
            className={`w-[14px] h-1 rounded-[2px] ${on ? '' : 'bg-[var(--tf-border-hover)] opacity-40'}`}
            style={on ? { background: dot } : undefined}
          />
        );
      })}
    </span>
  );
}
