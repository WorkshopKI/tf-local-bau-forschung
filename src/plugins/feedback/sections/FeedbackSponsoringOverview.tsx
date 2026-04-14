// Admin-Tab "Sponsoring": Fortschritts-Übersicht + Schwellen-Konfiguration + Budget-Statistik.

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  getSponsoringProgress,
  loadAllLocalBudgets,
  saveFeedbackConfig,
} from '@/core/services/feedback';
import type { EffortEstimate, FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import {
  DEFAULT_BUDGET_POINTS_PER_QUARTER,
  DEFAULT_HOURS_TO_POINTS_FACTOR,
  DEFAULT_SPONSORING_THRESHOLDS,
} from '@/core/types/feedback';

interface Props {
  tickets: FeedbackItem[];
  config: FeedbackConfig;
  onConfigChanged: () => void;
}

const inputClass = 'px-2 py-1 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] w-full';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackSponsoringOverview({ tickets, config, onConfigChanged }: Props): React.ReactElement {
  const storage = useStorage();
  const [thresholds, setThresholds] = useState(config.sponsoring_thresholds ?? DEFAULT_SPONSORING_THRESHOLDS);
  const [hoursFactor, setHoursFactor] = useState(config.hours_to_points_factor ?? DEFAULT_HOURS_TO_POINTS_FACTOR);
  const [budgetPerQuarter, setBudgetPerQuarter] = useState(config.budget_points_per_quarter ?? DEFAULT_BUDGET_POINTS_PER_QUARTER);
  const [saved, setSaved] = useState(false);

  // Feature-Tickets mit effort sortiert nach Progress
  const featuresRanked = useMemo(() => {
    return tickets
      .filter(t => t.category === 'idea' && t.effort_estimate && t.admin_status !== 'archiviert')
      .map(t => ({ ticket: t, progress: getSponsoringProgress(t, config) }))
      .sort((a, b) => b.progress.percentage - a.progress.percentage);
  }, [tickets, config]);

  const budgetStats = useMemo(() => {
    const budgets = loadAllLocalBudgets();
    const withSpent = budgets.filter(b => b.points_spent > 0);
    const avg = withSpent.length > 0
      ? (withSpent.reduce((s, b) => s + b.points_spent, 0) / withSpent.length)
      : 0;
    return {
      totalUsers: budgets.length,
      activeSponsors: withSpent.length,
      avgSpent: avg,
    };
  }, []);

  const handleSaveThresholds = async (): Promise<void> => {
    await saveFeedbackConfig(storage, {
      ...config,
      sponsoring_thresholds: thresholds,
      hours_to_points_factor: hoursFactor,
      budget_points_per_quarter: budgetPerQuarter,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onConfigChanged();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Feature-Ranking */}
      <section>
        <h2 className="text-[13px] font-medium text-[var(--tf-text)] mb-2">Features nach Sponsoring-Fortschritt</h2>
        {featuresRanked.length === 0 ? (
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">
            Noch keine Feature-Tickets mit Aufwand-Schätzung. Admin muss zuerst Tickets einen Aufwand zuweisen.
          </p>
        ) : (
          <ul className="space-y-2">
            {featuresRanked.map(({ ticket, progress }, i) => {
              const summary = ticket.llm_summary || ticket.text || '–';
              return (
                <li key={ticket.id} className="p-2.5 rounded-[var(--tf-radius)]" style={inputStyle}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-[var(--tf-text)] line-clamp-2">
                        {i + 1}. {summary}
                      </p>
                      <p className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                        Aufwand: {ticket.effort_estimate} · Status: {ticket.admin_status}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${progress.thresholdReached ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]'}`}>
                      {progress.percentage}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden mt-1.5">
                    <div className={`h-full ${progress.thresholdReached ? 'bg-emerald-500' : 'bg-[var(--tf-primary)]'}`} style={{ width: `${progress.percentage}%` }} />
                  </div>
                  <p className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-1">
                    {progress.combinedPoints}/{progress.threshold} Pkt · {progress.sponsorCount} Sponsoren
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Schwellen-Konfiguration */}
      <section>
        <h2 className="text-[13px] font-medium text-[var(--tf-text)] mb-2">Schwellen & Budget</h2>
        <div className="p-3 rounded-[var(--tf-radius)] space-y-3" style={inputStyle}>
          <div className="grid grid-cols-4 gap-2">
            {(['S', 'M', 'L', 'XL'] as EffortEstimate[]).map(e => (
              <div key={e}>
                <label className="text-[10.5px] text-[var(--tf-text-tertiary)]">Schwelle {e}</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={thresholds[e]}
                  onChange={ev => setThresholds({ ...thresholds, [e]: Math.max(1, Number(ev.target.value) || 1) })}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10.5px] text-[var(--tf-text-tertiary)]">1 Stunde = … Punkte</label>
              <input
                type="number"
                min={1}
                max={20}
                value={hoursFactor}
                onChange={e => setHoursFactor(Math.max(1, Number(e.target.value) || 1))}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-[10.5px] text-[var(--tf-text-tertiary)]">Budget pro Quartal</label>
              <input
                type="number"
                min={1}
                max={100}
                value={budgetPerQuarter}
                onChange={e => setBudgetPerQuarter(Math.max(1, Number(e.target.value) || 1))}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveThresholds}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--tf-radius)] text-[12.5px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 cursor-pointer"
          >
            {saved ? <Check size={13} /> : null}
            {saved ? 'Gespeichert' : 'Einstellungen speichern'}
          </button>
        </div>
      </section>

      {/* Budget-Statistik */}
      <section>
        <h2 className="text-[13px] font-medium text-[var(--tf-text)] mb-2">Budget-Statistik (nur dieser Browser)</h2>
        <div className="p-3 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)]" style={inputStyle}>
          <p>Ø {budgetStats.avgSpent.toFixed(1)} Punkte ausgegeben · {budgetStats.activeSponsors} von {budgetStats.totalUsers} User haben gesponsort</p>
          <p className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-1">
            Hinweis: Budgets liegen in localStorage pro Browser. Team-weite Statistik erfordert separates Tracking (out of scope).
          </p>
        </div>
      </section>
    </div>
  );
}
