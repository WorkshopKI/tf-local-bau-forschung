// Punkte-Budget-Anzeige für den aktuellen User im aktuellen Quartal.
// Ampelfarbe: grün > 5, gelb 2-5, rot 0-1.

import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
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
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950'
    : remaining >= 2
      ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950'
      : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950';
  const quarterLabel = budget.quarter.replace('-', ' ');

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${color}`}
      title={`${remaining} von ${budget.points_total} Punkten übrig im aktuellen Quartal`}
    >
      <Coins size={12} />
      <span>{remaining}/{budget.points_total} Punkte</span>
      <span className="opacity-60 text-[10.5px]">({quarterLabel})</span>
    </div>
  );
}
