// Voller Fortschritts-Stepper fürs Detail (Redesign v2.208). Datelos — das
// Datenmodell hält keinen Status-Verlauf; Position rein aus dem aktuellen Status
// (feedbackStepperPosition, Pitfall #21). Abgelehnt = Seitenpfad (Neu → ✕ Abgelehnt).

import { Fragment } from 'react';
import type { FeedbackStatus } from '@/core/types/feedback';
import { FEEDBACK_PIPELINE, feedbackStepperPosition } from '@/core/services/feedback';
import { STATUS_DOT, STATUS_LABELS, STATUS_SOFT } from './constants';

type NodeState = 'done' | 'now' | 'todo' | 'rejected';

function StepNode({ label, dotColor, filled, state, ring }: {
  label: string;
  dotColor: string;
  filled: boolean;
  state: NodeState;
  ring?: string;
}): React.ReactElement {
  const strong = state === 'done' || state === 'now' || state === 'rejected';
  return (
    <div className="flex flex-col items-center gap-1.5 w-16 text-center shrink-0">
      <span
        className="w-[13px] h-[13px] rounded-full grid place-items-center text-[8px] text-white leading-none"
        style={{
          background: filled ? dotColor : 'var(--tf-bg)',
          border: `1.5px solid ${filled ? dotColor : 'var(--tf-border-hover)'}`,
          boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
        }}
      >
        {state === 'rejected' ? '✕' : ''}
      </span>
      <span className={`text-[11px] leading-tight ${strong ? 'text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-tertiary)]'}`}>
        {label}
      </span>
    </div>
  );
}

export function FeedbackStepper({ status }: { status: FeedbackStatus }): React.ReactElement {
  const pos = feedbackStepperPosition(status);

  if (pos.rejected) {
    return (
      <div className="flex items-start">
        <StepNode label={STATUS_LABELS.neu} dotColor={STATUS_DOT.neu} filled state="done" />
        <div className="flex-1 h-[1.5px] mt-[6px]" style={{ background: 'var(--tf-fb-problem)' }} />
        <StepNode label={STATUS_LABELS.abgelehnt} dotColor="var(--tf-text-tertiary)" filled state="rejected" />
      </div>
    );
  }

  return (
    <div className="flex items-start">
      {FEEDBACK_PIPELINE.map((s, i) => {
        const reached = i <= pos.index;
        const done = i < pos.index;
        const now = i === pos.index;
        return (
          <Fragment key={s}>
            {i > 0 && (
              <div
                className={`flex-1 h-[1.5px] mt-[6px] ${reached ? '' : 'bg-[var(--tf-border-hover)]'}`}
                style={reached ? { background: 'var(--tf-primary)' } : undefined}
              />
            )}
            <StepNode
              label={STATUS_LABELS[s]}
              dotColor={STATUS_DOT[s]}
              filled={reached}
              state={done ? 'done' : now ? 'now' : 'todo'}
              ring={now ? STATUS_SOFT[status] : undefined}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
