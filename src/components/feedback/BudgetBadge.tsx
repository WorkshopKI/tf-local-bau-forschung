// Punkte-Budget-Anzeige für den aktuellen User im aktuellen Quartal.
// Farbpunkt (grün > 5, gelb 2-5, rot 0-1) + kompaktes Format: "7/10 Pkt (Q2) ?".

import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useProfile } from '@/core/hooks/useProfile';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { loadFeedbackConfig, loadUserBudget } from '@/core/services/feedback';
import { DEFAULT_BUDGET_POINTS_PER_QUARTER } from '@/core/types/feedback';
import type { UserBudget } from '@/core/types/feedback';

interface Props {
  /** Trigger-Key für Reload (z.B. nach Sponsoring). */
  refreshKey?: number;
  /** Board-Kopf-Variante (Redesign v2.208): „Budget Q3 [Track] N/10 Pkt", grün. */
  bar?: boolean;
}

export function BudgetBadge({ refreshKey, bar }: Props): React.ReactElement | null {
  const { profile } = useProfile();
  const storage = useStorage();
  const meinKuerzel = useMeinKuerzel();
  const [budget, setBudget] = useState<UserBudget | null>(null);

  // Identität = Session-Kürzel ?? Profilname (Pitfall #27) — GENAU die, die
  // `SponsorButton`/`FeedbackSponsorPanel` als Budget-Schlüssel schreiben.
  // Bis v4.129 stand hier nur `profile.name`: auf einem Rechner mit MA-Login
  // führte der localStorage zwei Konten derselben Person nebeneinander
  // (`…_v1_<Kürzel>` schrieb die Vergabe, `…_v1_<Profilname>` las die Pille),
  // und die Pille blieb bei 10/10 stehen, während Punkte längst vergeben waren.
  const budgetId = meinKuerzel ?? profile?.name;

  useEffect(() => {
    if (!budgetId) return;
    void loadFeedbackConfig(storage).then(cfg => {
      setBudget(loadUserBudget(budgetId, cfg.budget_points_per_quarter ?? DEFAULT_BUDGET_POINTS_PER_QUARTER));
    });
  }, [budgetId, storage, refreshKey]);

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

  if (bar) {
    const pct = budget.points_total > 0 ? Math.max(0, Math.min(100, (remaining / budget.points_total) * 100)) : 0;
    return (
      <div
        className="inline-flex items-center gap-2.5 h-[34px] px-3 rounded-full text-[12px] font-medium bg-[var(--tf-fb-lob-bg)] text-[var(--tf-fb-lob)]"
        title={`Dein Sponsoring-Budget: ${remaining} von ${budget.points_total} Punkten übrig im aktuellen Quartal`}
      >
        <span className="opacity-85">Budget {shortQuarter}</span>
        <span className="w-[46px] h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--tf-fb-lob-border)' }}>
          <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--tf-fb-lob)' }} />
        </span>
        <span className="tabular-nums">
          {remaining}<span className="opacity-80 font-normal">/{budget.points_total} Pkt</span>
        </span>
      </div>
    );
  }

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
