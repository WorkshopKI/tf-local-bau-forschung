// Punkte-Budget-Anzeige für den aktuellen User im aktuellen Quartal.
// Farbpunkt (grün > 5, gelb 2-5, rot 0-1) + kompaktes Format: "7/10 Pkt (Q2) ?".

import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useProfile } from '@/core/hooks/useProfile';
import { useStorage } from '@/core/hooks/useStorage';
import { loadFeedbackConfig, loadUserBudget } from '@/core/services/feedback';
import { DEFAULT_BUDGET_POINTS_PER_QUARTER } from '@/core/types/feedback';
import type { UserBudget } from '@/core/types/feedback';

interface Props {
  /** Trigger-Key für Reload (z.B. nach Sponsoring). */
  refreshKey?: number;
}

export function BudgetBadge({ refreshKey }: Props): React.ReactElement | null {
  const { profile } = useProfile();
  const storage = useStorage();
  const [budget, setBudget] = useState<UserBudget | null>(null);

  useEffect(() => {
    if (!profile?.name) return;
    void loadFeedbackConfig(storage).then(cfg => {
      setBudget(loadUserBudget(profile.name, cfg.budget_points_per_quarter ?? DEFAULT_BUDGET_POINTS_PER_QUARTER));
    });
  }, [profile?.name, storage, refreshKey]);

  if (!budget) return null;

  const remaining = budget.points_total - budget.points_spent;
  const color = remaining > 5
    ? 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]'
    : remaining >= 2
      ? 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]'
      : 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]';
  const dotColor = remaining > 5
    ? 'bg-[var(--tf-success-text)]'
    : remaining >= 2
      ? 'bg-[var(--tf-warning-text)]'
      : 'bg-[var(--tf-danger-text)]';
  const shortQuarter = budget.quarter.split('-')[1] ?? budget.quarter;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${color}`}
      title={`${remaining} von ${budget.points_total} Punkten übrig im aktuellen Quartal`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
      <span>{remaining}/{budget.points_total} Pkt</span>
      <span className="opacity-60 text-[10.5px]">({shortQuarter})</span>
      <span title="Du hast pro Quartal Punkte die du auf Features setzen kannst.">
        <HelpCircle size={11} className="opacity-50 cursor-help" />
      </span>
    </div>
  );
}
