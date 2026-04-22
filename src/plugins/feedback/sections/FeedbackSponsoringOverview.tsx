// Admin-Tab "Sponsoring": Feature-Ranking als Tabelle + Schwellen/Budget-Konfiguration.

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { getSponsoringProgress, loadAllLocalBudgets, saveFeedbackConfig } from '@/core/services/feedback';
import type { EffortEstimate, FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_BUDGET_POINTS_PER_QUARTER, DEFAULT_HOURS_TO_POINTS_FACTOR, DEFAULT_SPONSORING_THRESHOLDS } from '@/core/types/feedback';
import { EFFORT_SHORT_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/components/feedback/constants';

interface Props { tickets: FeedbackItem[]; config: FeedbackConfig; onConfigChanged: () => void; }

const inputClass = 'px-2 py-1 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] w-full';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackSponsoringOverview({ tickets, config, onConfigChanged }: Props): React.ReactElement {
  const storage = useStorage();
  const [thresholds, setThresholds] = useState(config.sponsoring_thresholds ?? DEFAULT_SPONSORING_THRESHOLDS);
  const [hoursFactor, setHoursFactor] = useState(config.hours_to_points_factor ?? DEFAULT_HOURS_TO_POINTS_FACTOR);
  const [budgetPerQuarter, setBudgetPerQuarter] = useState(config.budget_points_per_quarter ?? DEFAULT_BUDGET_POINTS_PER_QUARTER);
  const [saved, setSaved] = useState(false);

  const featuresRanked = useMemo(() => {
    return tickets
      .filter(t => t.category === 'idea' && t.effort_estimate && t.kurator_status !== 'archiviert')
      .map(t => ({ ticket: t, progress: getSponsoringProgress(t, config) }))
      .sort((a, b) => b.progress.percentage - a.progress.percentage);
  }, [tickets, config]);

  const budgetStats = useMemo(() => {
    const budgets = loadAllLocalBudgets();
    const withSpent = budgets.filter(b => b.points_spent > 0);
    const avg = withSpent.length > 0 ? withSpent.reduce((s, b) => s + b.points_spent, 0) / withSpent.length : 0;
    return { totalUsers: budgets.length, activeSponsors: withSpent.length, avgSpent: avg };
  }, []);

  const handleSave = async (): Promise<void> => {
    await saveFeedbackConfig(storage, { ...config, sponsoring_thresholds: thresholds, hours_to_points_factor: hoursFactor, budget_points_per_quarter: budgetPerQuarter });
    setSaved(true); setTimeout(() => setSaved(false), 1500); onConfigChanged();
  };

  return (
    <div className="space-y-6">
      {/* Feature-Ranking als Tabelle */}
      <section>
        <h2 className="text-[13px] font-medium text-[var(--tf-text)] mb-2">Features nach Sponsoring-Fortschritt</h2>
        {featuresRanked.length === 0 ? (
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">Noch keine Features mit Aufwand-Schätzung.</p>
        ) : (
          <div>
            <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
              <span className="w-6 shrink-0">#</span>
              <span className="flex-1 min-w-0">Feature</span>
              <span className="w-20 shrink-0">Status</span>
              <span className="w-36 shrink-0">Fortschritt</span>
              <span className="w-16 shrink-0">Aufwand</span>
              <span className="w-12 shrink-0 text-right">Spons.</span>
            </div>
            {featuresRanked.map(({ ticket, progress }, i) => (
              <div key={ticket.id} className="flex items-center gap-3 px-3 py-2 text-[12px]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
                <span className="w-6 shrink-0 text-[var(--tf-text-tertiary)]">{i + 1}</span>
                <span className="flex-1 min-w-0 text-[var(--tf-text)] truncate">{ticket.llm_summary || ticket.text || '–'}</span>
                <span className="w-20 shrink-0">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[ticket.kurator_status]}`}>{STATUS_LABELS[ticket.kurator_status]}</span>
                </span>
                <div className="w-36 shrink-0 flex items-center gap-2">
                  <div className="flex-1 h-[5px] rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
                    <div className="h-full" style={{ width: `${progress.percentage}%`, background: progress.thresholdReached ? 'var(--tf-success-text)' : 'var(--tf-primary)' }} />
                  </div>
                  <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums w-8 text-right">{progress.percentage}%</span>
                </div>
                <span className="w-16 shrink-0 text-[11px] text-[var(--tf-text-secondary)]">{EFFORT_SHORT_LABELS[ticket.effort_estimate!]}</span>
                <span className="w-12 shrink-0 text-right text-[11px] text-[var(--tf-text-secondary)]">{progress.sponsorCount}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Schwellen + Budget: 2 Spalten */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section>
          <h2 className="text-[13px] font-medium text-[var(--tf-text)] mb-2">Schwellen & Budget</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {(['S', 'M', 'L', 'XL'] as EffortEstimate[]).map(e => (
                <div key={e}>
                  <label className="text-[10px] text-[var(--tf-text-tertiary)]">{e}</label>
                  <input type="number" min={1} max={200} value={thresholds[e]}
                    onChange={ev => setThresholds({ ...thresholds, [e]: Math.max(1, Number(ev.target.value) || 1) })}
                    className={inputClass} style={inputStyle} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--tf-text-tertiary)]">1h = Punkte</label>
                <input type="number" min={1} max={20} value={hoursFactor}
                  onChange={e => setHoursFactor(Math.max(1, Number(e.target.value) || 1))}
                  className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="text-[10px] text-[var(--tf-text-tertiary)]">Budget/Quartal</label>
                <input type="number" min={1} max={100} value={budgetPerQuarter}
                  onChange={e => setBudgetPerQuarter(Math.max(1, Number(e.target.value) || 1))}
                  className={inputClass} style={inputStyle} />
              </div>
            </div>
            <button type="button" onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--tf-radius)] text-[12px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 cursor-pointer">
              {saved ? <Check size={13} /> : null} {saved ? 'Gespeichert' : 'Speichern'}
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-medium text-[var(--tf-text)] mb-2">Budget-Statistik</h2>
          <div className="flex gap-4 mb-2">
            <div className="text-center">
              <p className="text-[18px] font-medium text-[var(--tf-text)] tabular-nums">{budgetStats.avgSpent.toFixed(1)}</p>
              <p className="text-[10.5px] text-[var(--tf-text-tertiary)]">Ø Punkte ausgegeben</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-medium text-[var(--tf-text)] tabular-nums">{budgetStats.activeSponsors}/{budgetStats.totalUsers}</p>
              <p className="text-[10.5px] text-[var(--tf-text-tertiary)]">User aktiv</p>
            </div>
          </div>
          <p className="text-[10.5px] text-[var(--tf-text-tertiary)]">
            Budgets liegen in localStorage pro Browser. Team-weite Statistik erfordert die geteilte Feedback-Datei.
          </p>
        </section>
      </div>
    </div>
  );
}
