// Öffentliches Feedback-Board: Bugs + Features mit Sponsoring-Fortschritt.
// Sichtbar für alle User (nicht adminOnly).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { BudgetBadge, FeedbackBoardCard } from '@/components/feedback';
import { getFeedbackList, getSponsoringProgress, loadFeedbackConfig } from '@/core/services/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';

type Filter = 'all' | 'bugs' | 'features' | 'open' | 'done';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'bugs', label: 'Bugs' },
  { id: 'features', label: 'Features' },
  { id: 'open', label: 'Offen' },
  { id: 'done', label: 'Umgesetzt' },
];

export function FeedbackBoardPage(): React.ReactElement {
  const storage = useStorage();
  const [tickets, setTickets] = useState<FeedbackItem[]>([]);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [items, cfg] = await Promise.all([
        getFeedbackList(storage),
        loadFeedbackConfig(storage),
      ]);
      setTickets(items);
      setConfig(cfg);
    } finally {
      setLoading(false);
    }
  }, [storage]);

  useEffect(() => { void reload(); }, [reload]);

  const handleChanged = useCallback(() => {
    setRefreshKey(k => k + 1);
    void reload();
  }, [reload]);

  const filteredSorted = useMemo(() => {
    // Grund-Filter: nur Bugs (problem) + Features (idea); keine Fragen/Lob; keine archivierten
    const base = tickets.filter(t =>
      (t.category === 'problem' || t.category === 'idea')
      && t.admin_status !== 'archiviert'
    );
    const byFilter = base.filter(t => {
      switch (filter) {
        case 'bugs': return t.category === 'problem';
        case 'features': return t.category === 'idea';
        case 'open': return t.admin_status === 'neu' || t.admin_status === 'geplant' || t.admin_status === 'in_bearbeitung';
        case 'done': return t.admin_status === 'umgesetzt';
        case 'all':
        default: return true;
      }
    });
    return byFilter.sort((a, b) => {
      // 1) in_bearbeitung oben
      const aBearb = a.admin_status === 'in_bearbeitung' ? 0 : 1;
      const bBearb = b.admin_status === 'in_bearbeitung' ? 0 : 1;
      if (aBearb !== bBearb) return aBearb - bBearb;
      // 2) Features: Sponsoring-Progress absteigend
      if (a.category === 'idea' && b.category === 'idea') {
        const pa = getSponsoringProgress(a, config).percentage;
        const pb = getSponsoringProgress(b, config).percentage;
        if (pa !== pb) return pb - pa;
      }
      // 3) created_at desc
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tickets, filter, config]);

  const counts = useMemo(() => ({
    bugs: tickets.filter(t => t.category === 'problem' && t.admin_status !== 'archiviert').length,
    features: tickets.filter(t => t.category === 'idea' && t.admin_status !== 'archiviert').length,
  }), [tickets]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Feedback-Board</h1>
          <p className="text-[12.5px] text-[var(--tf-text-secondary)] mt-1">
            {counts.bugs} {counts.bugs === 1 ? 'Bug' : 'Bugs'} · {counts.features} Features
          </p>
        </div>
        <BudgetBadge refreshKey={refreshKey} />
      </div>

      {/* Filter-Pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-[12px] cursor-pointer transition-colors ${
              filter === f.id
                ? 'bg-[var(--tf-primary)] text-white'
                : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
            }`}
            style={filter !== f.id ? { border: '0.5px solid var(--tf-border)' } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading && <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-8">Lade…</p>}
      {!loading && filteredSorted.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-12">
          Keine Einträge. Nutze den Feedback-Button unten rechts um Ideen oder Bugs zu melden.
        </p>
      )}
      <div className="space-y-3">
        {filteredSorted.map(t => (
          <FeedbackBoardCard
            key={t.id}
            ticket={t}
            config={config}
            onChanged={handleChanged}
          />
        ))}
      </div>
    </div>
  );
}
