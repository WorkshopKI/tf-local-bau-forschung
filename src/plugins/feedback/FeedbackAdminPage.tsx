// Admin-Hub für Feedback: 3 Tabs (Tickets / FAQ / Einstellungen).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { getFeedbackList, loadFeedbackConfig } from '@/core/services/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';
import type { FeedbackCategory, FeedbackConfig, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { FeedbackTicketList } from './sections/FeedbackTicketList';
import { FeedbackTicketDetail } from './sections/FeedbackTicketDetail';
import { FeedbackFaqTab } from './sections/FeedbackFaqTab';
import { FeedbackConfigPanel } from './sections/FeedbackConfigPanel';
import { FeedbackSponsoringOverview } from './sections/FeedbackSponsoringOverview';

const TABS = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'faq', label: 'FAQ' },
  { id: 'sponsoring', label: 'Sponsoring' },
  { id: 'config', label: 'Einstellungen' },
];

export function FeedbackAdminPage(): React.ReactElement {
  const storage = useStorage();
  const [tab, setTab] = useState('tickets');
  const [tickets, setTickets] = useState<FeedbackItem[]>([]);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<FeedbackCategory | ''>('');
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | ''>('');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

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

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterStatus && t.admin_status !== filterStatus) return false;
      return true;
    });
  }, [tickets, filterCategory, filterStatus]);

  const faqs = useMemo(() => tickets.filter(t => t.is_faq), [tickets]);
  const selectedTicket = useMemo(() => tickets.find(t => t.id === selectedId) ?? null, [tickets, selectedId]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Feedback</h1>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)] mt-1">
          {tickets.length} {tickets.length === 1 ? 'Ticket' : 'Tickets'} · {faqs.length} FAQ-{faqs.length === 1 ? 'Eintrag' : 'Einträge'}
        </p>
      </div>

      <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'tickets' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <FeedbackTicketList
              tickets={filteredTickets}
              loading={loading}
              selectedId={selectedId}
              filterCategory={filterCategory}
              filterStatus={filterStatus}
              onFilterCategory={setFilterCategory}
              onFilterStatus={setFilterStatus}
              onSelect={t => setSelectedId(t.id)}
            />
            <div className="rounded-[var(--tf-radius)] p-3 lg:p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
              <FeedbackTicketDetail
                ticket={selectedTicket}
                onClose={() => setSelectedId(undefined)}
                onUpdated={reload}
              />
            </div>
          </div>
        )}
        {tab === 'faq' && <FeedbackFaqTab faqs={faqs} onChanged={reload} />}
        {tab === 'sponsoring' && <FeedbackSponsoringOverview tickets={tickets} config={config} onConfigChanged={reload} />}
        {tab === 'config' && <FeedbackConfigPanel />}
      </div>
    </div>
  );
}
