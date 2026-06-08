// Kurator-Hub für Feedback: 4 Tabs (Tickets / FAQ / Sponsoring / Einstellungen).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { getFeedbackList, loadFeedbackConfig } from '@/core/services/feedback';
import { FEEDBACK_STATUS } from '@/core/services/feedback/feedback-status';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';
import type { FeedbackCategory, FeedbackConfig, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { FeedbackTicketList } from './sections/FeedbackTicketList';
import { FeedbackTicketDetail } from './sections/FeedbackTicketDetail';
import { FeedbackFaqTab } from './sections/FeedbackFaqTab';
import { FeedbackConfigPanel } from './sections/FeedbackConfigPanel';
import { FeedbackSponsoringOverview } from './sections/FeedbackSponsoringOverview';
import { FeedbackInboxTab } from './sections/FeedbackInboxTab';
import { useAutoCollectFeedback } from './hooks/useAutoCollectFeedback';
import type { CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';

export function FeedbackAdminPage(): React.ReactElement {
  const storage = useStorage();
  // v2.22: User-Feedback-Outboxen beim Öffnen automatisch einsammeln (ohne Review).
  useAutoCollectFeedback();
  const [tab, setTab] = useState('tickets');
  const [tickets, setTickets] = useState<FeedbackItem[]>([]);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<FeedbackCategory | ''>('');
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | ''>('');
  const [filterArea, setFilterArea] = useState<string>('');
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

  useEffect(() => {
    const handler = (): void => { void reload(); };
    window.addEventListener('feedback-updated', handler);
    return () => window.removeEventListener('feedback-updated', handler);
  }, [reload]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterStatus && t.kurator_status !== filterStatus) return false;
      if (filterArea && t.context?.page !== filterArea) return false;
      return true;
    });
  }, [tickets, filterCategory, filterStatus, filterArea]);

  // Filter-Items (Label + Zähler) für die CollapsibleSeg-Chips — wie im User-Board,
  // aber Status granular (Kurator braucht die feinen Stati). Zähler über das volle
  // `tickets` (inkl. archivierter — der Admin verwaltet auch die).
  const statusItems = useMemo<CollapsibleSegItem[]>(() => [
    { label: 'Alle', count: tickets.length },
    { label: 'Neu', count: tickets.filter(t => t.kurator_status === FEEDBACK_STATUS.neu).length },
    { label: 'Geplant', count: tickets.filter(t => t.kurator_status === FEEDBACK_STATUS.geplant).length },
    { label: 'In Bearb.', count: tickets.filter(t => t.kurator_status === FEEDBACK_STATUS.in_bearbeitung).length },
    { label: 'Umgesetzt', count: tickets.filter(t => t.kurator_status === FEEDBACK_STATUS.umgesetzt).length },
    { label: 'Abgelehnt', count: tickets.filter(t => t.kurator_status === FEEDBACK_STATUS.abgelehnt).length },
  ], [tickets]);

  const kategorieItems = useMemo<CollapsibleSegItem[]>(() => [
    { label: 'Alle', count: tickets.length },
    { label: 'Bug', count: tickets.filter(t => t.category === 'problem').length },
    { label: 'Idee', count: tickets.filter(t => t.category === 'idea').length },
    { label: 'UX', count: tickets.filter(t => t.category === 'ux').length },
    { label: 'Lob', count: tickets.filter(t => t.category === 'praise').length },
    { label: 'Frage', count: tickets.filter(t => t.category === 'question').length },
  ], [tickets]);

  // Bereich = context.page (Label, wie im Board). Distinct + Zähler, alphabetisch.
  const bereichItems = useMemo<CollapsibleSegItem[]>(() => {
    const counts = new Map<string, number>();
    for (const t of tickets) {
      const p = t.context?.page;
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const items = Array.from(counts, ([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ label: 'Alle', count: tickets.length }, ...items];
  }, [tickets]);

  const faqs = useMemo(() => tickets.filter(t => t.is_faq), [tickets]);
  const selectedTicket = useMemo(() => tickets.find(t => t.id === selectedId) ?? null, [tickets, selectedId]);

  const tabs = useMemo(() => [
    { id: 'tickets', label: 'Tickets', badge: tickets.length },
    { id: 'inbox', label: 'Inbox' },
    { id: 'faq', label: 'FAQ', badge: faqs.length },
    { id: 'sponsoring', label: 'Sponsoring' },
    { id: 'config', label: 'Einstellungen' },
  ], [tickets.length, faqs.length]);

  return (
    <div className="p-6">
      {/* Header: einzeilig */}
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Feedback</h1>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          {tickets.length} {tickets.length === 1 ? 'Ticket' : 'Tickets'} · {faqs.length} FAQ
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'tickets' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FeedbackTicketList
                tickets={filteredTickets}
                loading={loading}
                selectedId={selectedId}
                filterCategory={filterCategory}
                filterStatus={filterStatus}
                filterArea={filterArea}
                statusItems={statusItems}
                kategorieItems={kategorieItems}
                bereichItems={bereichItems}
                onFilterCategory={setFilterCategory}
                onFilterStatus={setFilterStatus}
                onFilterArea={setFilterArea}
                onSelect={t => setSelectedId(t.id)}
              />
            </div>
            <div className="rounded-[var(--tf-radius)] p-3 lg:p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
              <FeedbackTicketDetail
                ticket={selectedTicket}
                onClose={() => setSelectedId(undefined)}
                onUpdated={reload}
              />
            </div>
          </div>
        )}
        {tab === 'inbox' && <FeedbackInboxTab />}
        {tab === 'faq' && <FeedbackFaqTab faqs={faqs} onChanged={reload} />}
        {tab === 'sponsoring' && <FeedbackSponsoringOverview tickets={tickets} config={config} onConfigChanged={reload} />}
        {tab === 'config' && <FeedbackConfigPanel />}
      </div>
    </div>
  );
}
