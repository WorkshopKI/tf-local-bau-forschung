// Detail-Sponsoring-Panel (Redesign v2.208): großes X/Y Pkt, Sponsoren-Zahl,
// Fortschrittsbalken, „Ziel erreicht"-Zustand ODER +/−-Vergabe (über den
// bestehenden SponsorButton compact) + Budget-Hinweis. Rechnet über
// getSponsoringProgress; Budget aus loadUserBudget (gleiche Identität wie der
// SponsorButton: Kürzel/Name via meId, Pitfall #27).

import { getSponsoringProgress, isSponsoringOpen, loadUserBudget } from '@/core/services/feedback';
import { DEFAULT_BUDGET_POINTS_PER_QUARTER } from '@/core/types/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { SponsorButton } from './SponsorButton';

interface Props {
  ticket: FeedbackItem;
  config: FeedbackConfig;
  /** Identität (Kürzel/Name) für den Budget-Hinweis; undefined → Hinweis aus. */
  meId?: string;
  onChanged: () => void;
}

export function FeedbackSponsorPanel({ ticket, config, meId, onChanged }: Props): React.ReactElement {
  const p = getSponsoringProgress(ticket, config);
  const open = isSponsoringOpen(ticket);
  const budget = meId
    ? loadUserBudget(meId, config.budget_points_per_quarter ?? DEFAULT_BUDGET_POINTS_PER_QUARTER)
    : null;
  const remaining = budget ? budget.points_total - budget.points_spent : null;
  const shortQuarter = budget ? (budget.quarter.split('-')[1] ?? budget.quarter) : '';

  return (
    <div
      className="rounded-[var(--tf-radius-lg)] p-3.5 bg-[var(--tf-card-surface)] space-y-3"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="text-[20px] font-medium text-[var(--tf-text)] tabular-nums leading-none">
          {p.combinedPoints}
          <span className="text-[13px] font-normal text-[var(--tf-text-tertiary)]"> / {p.threshold} Pkt</span>
        </span>
        <span className="text-[12px] text-[var(--tf-text-secondary)]">
          {p.sponsorCount} {p.sponsorCount === 1 ? 'Sponsor' : 'Sponsoren'}
        </span>
      </div>

      <div className="h-2 rounded-full bg-[var(--tf-fb-sponsor-track)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${p.percentage}%`, background: 'var(--tf-fb-lob)' }} />
      </div>

      {p.thresholdReached ? (
        <p className="text-[12.5px] font-medium text-[var(--tf-fb-lob)]">✓ Ziel erreicht — beim Team eingeplant</p>
      ) : (
        <SponsorButton ticket={ticket} config={config} open={open} onChanged={onChanged} compact />
      )}

      {remaining != null && budget != null && (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] leading-relaxed">
          Du hast noch <b className="font-medium text-[var(--tf-text-secondary)]">{remaining} von {budget.points_total} Pkt</b>
          {shortQuarter ? ` in ${shortQuarter}` : ''}. Punkte zeigen dem Team, was dir wichtig ist.
        </p>
      )}
    </div>
  );
}
