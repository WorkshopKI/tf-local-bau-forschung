// Kurator-Hub für Feedback: 4 Tabs (Tickets / FAQ / Sponsoring / Einstellungen).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { useStorage } from '@/core/hooks/useStorage';
import { getFeedbackList, loadFeedbackConfig } from '@/core/services/feedback';
import { FEEDBACK_STATUS } from '@/core/services/feedback/feedback-status';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';
import type { FeedbackCategory, FeedbackConfig, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { matchesFeedbackFilters, countForCategory, countForStatus, countForArea, type FeedbackFilterState } from './feedback-filter';
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
  // Archivierte sind standardmäßig überall ausgeblendet; Kurator kann sie per
  // Checkbox einblenden (Preference persistiert, einfaches LS-Flag laut CLAUDE.md).
  const [showArchived, setShowArchived] = useState(() => localStorage.getItem('teamflow_feedback_show_archived') === '1');
  const toggleArchived = useCallback((v: boolean): void => {
    setShowArchived(v);
    localStorage.setItem('teamflow_feedback_show_archived', v ? '1' : '0');
  }, []);
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

  // Ein einziger Filter-Zustand speist Liste UND Zähler (feedback-filter.ts) —
  // sonst driften Chip-Zahl und Listen-Länge auseinander (archivierte + cross-facet).
  const filterState = useMemo<FeedbackFilterState>(
    () => ({ category: filterCategory, status: filterStatus, area: filterArea, showArchived }),
    [filterCategory, filterStatus, filterArea, showArchived],
  );

  const filteredTickets = useMemo(
    () => tickets.filter(t => matchesFeedbackFilters(t, filterState)),
    [tickets, filterState],
  );

  // Filter-Items (Label + Facetten-Zähler) für die CollapsibleSeg-Chips — wie im
  // User-Board, aber Status granular (Kurator braucht die feinen Stati). Jeder
  // Zähler beantwortet „wie viele zeigt die Liste, wenn ich DIESE Facette wähle?"
  // (andere aktive Filter bleiben fix) → die gewählte Chip-Zahl == angezeigte Zeilen.
  const statusItems = useMemo<CollapsibleSegItem[]>(() => [
    { label: 'Alle', count: countForStatus(tickets, filterState, '') },
    { label: 'Neu', count: countForStatus(tickets, filterState, FEEDBACK_STATUS.neu) },
    { label: 'Geplant', count: countForStatus(tickets, filterState, FEEDBACK_STATUS.geplant) },
    { label: 'In Bearb.', count: countForStatus(tickets, filterState, FEEDBACK_STATUS.in_bearbeitung) },
    { label: 'Umgesetzt', count: countForStatus(tickets, filterState, FEEDBACK_STATUS.umgesetzt) },
    { label: 'Abgelehnt', count: countForStatus(tickets, filterState, FEEDBACK_STATUS.abgelehnt) },
    { label: 'Archiviert', count: countForStatus(tickets, filterState, FEEDBACK_STATUS.archiviert) },
  ], [tickets, filterState]);

  const kategorieItems = useMemo<CollapsibleSegItem[]>(() => [
    { label: 'Alle', count: countForCategory(tickets, filterState, '') },
    { label: 'Bug', count: countForCategory(tickets, filterState, 'problem') },
    { label: 'Idee', count: countForCategory(tickets, filterState, 'idea') },
    { label: 'UX', count: countForCategory(tickets, filterState, 'ux') },
    { label: 'Lob', count: countForCategory(tickets, filterState, 'praise') },
    { label: 'Frage', count: countForCategory(tickets, filterState, 'question') },
  ], [tickets, filterState]);

  // Bereich = context.page (Label, wie im Board). Chip-Set aus allen Tickets
  // (stabil), Zähler facettengefiltert. Alphabetisch.
  const bereichItems = useMemo<CollapsibleSegItem[]>(() => {
    const pages = new Set<string>();
    for (const t of tickets) {
      const p = t.context?.page;
      if (p) pages.add(p);
    }
    const items = Array.from(pages, page => ({ label: page, count: countForArea(tickets, filterState, page) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ label: 'Alle', count: countForArea(tickets, filterState, '') }, ...items];
  }, [tickets, filterState]);

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
                showArchived={showArchived}
                onToggleArchived={toggleArchived}
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
