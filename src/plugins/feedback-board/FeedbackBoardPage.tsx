// Öffentliches Feedback-Board: Bugs + Features mit Sponsoring-Fortschritt.
// Card- und Listen-Ansicht, Filter-Pills, Sponsoring-Info-Banner.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  BudgetBadge,
  FeedbackBoardCard,
  FeedbackBoardListView,
  SponsoringInfoBanner,
} from '@/components/feedback';
import { getFeedbackList, getSponsoringProgress, loadFeedbackConfig } from '@/core/services/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';

type Filter = 'all' | 'bugs' | 'features' | 'open' | 'done';
type ViewMode = 'card' | 'list';

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
  const [viewMode, setViewMode] = useState<ViewMode>('card');
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

  // Live-Refresh bei globalem feedback-updated Event
  useEffect(() => {
    const handler = (): void => { void reload(); };
    window.addEventListener('feedback-updated', handler);
    return () => window.removeEventListener('feedback-updated', handler);
  }, [reload]);

  const handleChanged = useCallback(() => {
    setRefreshKey(k => k + 1);
    void reload();
  }, [reload]);

  const filteredSorted = useMemo(() => {
    const base = tickets.filter(t =>
      (t.category === 'problem' || t.category === 'idea')
      && t.kurator_status !== 'archiviert'
    );
    const byFilter = base.filter(t => {
      switch (filter) {
        case 'bugs': return t.category === 'problem';
        case 'features': return t.category === 'idea';
        case 'open': return t.kurator_status === 'neu' || t.kurator_status === 'geplant' || t.kurator_status === 'in_bearbeitung';
        case 'done': return t.kurator_status === 'umgesetzt';
        case 'all':
        default: return true;
      }
    });
    return byFilter.sort((a, b) => {
      const aBearb = a.kurator_status === 'in_bearbeitung' ? 0 : 1;
      const bBearb = b.kurator_status === 'in_bearbeitung' ? 0 : 1;
      if (aBearb !== bBearb) return aBearb - bBearb;
      if (a.category === 'idea' && b.category === 'idea') {
        const pa = getSponsoringProgress(a, config).percentage;
        const pb = getSponsoringProgress(b, config).percentage;
        if (pa !== pb) return pb - pa;
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tickets, filter, config]);

  const counts = useMemo(() => ({
    bugs: tickets.filter(t => t.category === 'problem' && t.kurator_status !== 'archiviert').length,
    features: tickets.filter(t => t.category === 'idea' && t.kurator_status !== 'archiviert').length,
  }), [tickets]);

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Feedback-Board</h1>
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
            {counts.bugs} {counts.bugs === 1 ? 'Bug' : 'Bugs'} · {counts.features} Features
          </p>
        </div>
        <BudgetBadge refreshKey={refreshKey} />
      </div>

      {/* Info-Banner */}
      <SponsoringInfoBanner />

      {/* Filter-Pills + View-Toggle */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
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

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setViewMode('card')}
          className={`p-1.5 rounded-[var(--tf-radius)] cursor-pointer transition-colors ${
            viewMode === 'card'
              ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]'
              : 'text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)]'
          }`}
          title="Kartenansicht"
        >
          <LayoutGrid size={15} />
        </button>
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={`p-1.5 rounded-[var(--tf-radius)] cursor-pointer transition-colors ${
            viewMode === 'list'
              ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]'
              : 'text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)]'
          }`}
          title="Listenansicht"
        >
          <List size={15} />
        </button>
      </div>

      {/* Content */}
      {loading && <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-8">Lade…</p>}
      {!loading && filteredSorted.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-12">
          Keine Einträge. Nutze den Feedback-Button unten rechts um Ideen oder Bugs zu melden.
        </p>
      )}
      {!loading && filteredSorted.length > 0 && viewMode === 'card' && (
        <div className="space-y-3">
          {filteredSorted.map(t => (
            <FeedbackBoardCard key={t.id} ticket={t} config={config} onChanged={handleChanged} />
          ))}
        </div>
      )}
      {!loading && filteredSorted.length > 0 && viewMode === 'list' && (
        <FeedbackBoardListView tickets={filteredSorted} config={config} />
      )}
    </div>
  );
}
