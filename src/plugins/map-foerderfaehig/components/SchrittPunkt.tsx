/**
 * Statuspunkt eines Prüfschritts — erledigt / Warnung / angefangen / offen.
 *
 * Rein darstellend: der Status kommt fertig aus `ansicht/schritte`. Farben
 * ausschliesslich über --tf-*-Tokens (Light und Dark tragen dieselbe Semantik).
 */
import { Check, TriangleAlert } from 'lucide-react';
import type { SchrittStatus } from '../ansicht/schritte';

const TITEL: Record<SchrittStatus, string> = {
  done: 'erledigt',
  warn: 'mit Warnung',
  partial: 'angefangen',
  todo: 'offen',
};

export function SchrittPunkt({ status }: { status: SchrittStatus }): React.ReactElement {
  const gemeinsam = 'inline-grid place-items-center rounded-full shrink-0 w-[15px] h-[15px]';

  if (status === 'todo') {
    return (
      <span
        className={gemeinsam}
        title={TITEL.todo}
        aria-label={TITEL.todo}
        style={{ border: '1.5px solid var(--tf-border-hover)' }}
      />
    );
  }

  const fuellung: Record<Exclude<SchrittStatus, 'todo'>, string> = {
    done: 'var(--tf-success-text)',
    warn: 'var(--tf-warning-text)',
    partial: 'var(--tf-primary)',
  };

  return (
    <span
      className={gemeinsam}
      title={TITEL[status]}
      aria-label={TITEL[status]}
      style={{ background: fuellung[status], color: 'var(--tf-on-primary)' }}
    >
      {status === 'done' && <Check size={10} strokeWidth={3} />}
      {status === 'warn' && <TriangleAlert size={10} strokeWidth={2.5} />}
      {status === 'partial' && (
        <span className="w-[5px] h-[5px] rounded-full bg-current" />
      )}
    </span>
  );
}
