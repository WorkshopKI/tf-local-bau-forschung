// Kurator-Hub für Feedback: 4 Tabs (Tickets / FAQ / Sponsoring / Einstellungen).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { MasterDetailLayout } from '@/components/master-detail';
import { useStorage } from '@/core/hooks/useStorage';
import { getFeedbackList, loadFeedbackConfig, updateFeedback } from '@/core/services/feedback';
import { FEEDBACK_STATUS, toggleUmgesetzt } from '@/core/services/feedback/feedback-status';
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
import { CollapsibleSeg, type CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';

// Label↔Wert-Maps für die label-basierte CollapsibleSeg (wie im User-Board).
// Status bleibt granular (Kurator braucht die feinen Stati); 'archiviert' ist ein
// eigener Chip (zeigt gezielt nur die Archivierten).
const STATUS_TO_LABEL: Record<FeedbackStatus | '', string> = {
  '': 'Alle', neu: 'Neu', geplant: 'Geplant', in_bearbeitung: 'In Bearb.',
  umgesetzt: 'Umgesetzt', abgelehnt: 'Abgelehnt', archiviert: 'Archiviert',
};
const LABEL_TO_STATUS: Record<string, FeedbackStatus | ''> = {
  Alle: '', Neu: 'neu', Geplant: 'geplant', 'In Bearb.': 'in_bearbeitung',
  Umgesetzt: 'umgesetzt', Abgelehnt: 'abgelehnt', Archiviert: 'archiviert',
};
const KAT_TO_LABEL: Record<FeedbackCategory | '', string> = {
  '': 'Alle', problem: 'Bug', idea: 'Idee', praise: 'Lob', question: 'Frage',
};
const LABEL_TO_KAT: Record<string, FeedbackCategory | ''> = {
  Alle: '', Bug: 'problem', Idee: 'idea', Lob: 'praise', Frage: 'question',
};

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
  const [rowError, setRowError] = useState<string | null>(null);

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

  // 1-Klick-„Umgesetzt"-Abhaken direkt in der Liste: optimistisch sofort umschalten
  // (snappy), dann schreiben. updateFeedback feuert 'feedback-updated' → reload()
  // reconciled auf den autoritativen Stand. Bei Schreibfehler: Fehler zeigen +
  // reload (Optimismus verwerfen), kein Silent-Fail.
  const handleToggleDone = useCallback(async (ticket: FeedbackItem): Promise<void> => {
    setRowError(null);
    const next = toggleUmgesetzt(ticket.kurator_status);
    setTickets(prev => prev.map(t => (t.id === ticket.id ? { ...t, kurator_status: next } : t)));
    try {
      await updateFeedback(storage, ticket.id, { kurator_status: next });
    } catch (e) {
      setRowError(`„Umgesetzt" konnte nicht gespeichert werden: ${e instanceof Error ? e.message : String(e)}`);
      await reload();
    }
  }, [storage, reload]);

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
          <div className="flex flex-col" style={{ height: 'calc(100vh - 165px)' }}>
            {/* Filter-Chips im Seitenkopf (immer sichtbar — analog Board) */}
            <div className="shrink-0 flex flex-wrap items-center gap-1.5 mb-3">
              <CollapsibleSeg
                label="Status"
                value={STATUS_TO_LABEL[filterStatus]}
                items={statusItems}
                onChange={l => setFilterStatus(LABEL_TO_STATUS[l] ?? '')}
              />
              <CollapsibleSeg
                label="Kategorie"
                value={KAT_TO_LABEL[filterCategory]}
                items={kategorieItems}
                onChange={l => setFilterCategory(LABEL_TO_KAT[l] ?? '')}
              />
              {bereichItems.length > 1 && (
                <CollapsibleSeg
                  label="Bereich"
                  value={filterArea || 'Alle'}
                  items={bereichItems}
                  onChange={l => setFilterArea(l === 'Alle' ? '' : l)}
                  startCollapsed
                />
              )}
              <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] cursor-pointer ml-1">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={e => toggleArchived(e.target.checked)}
                  className="cursor-pointer accent-[var(--tf-primary)]"
                />
                Archivierte einblenden
              </label>
            </div>
            {rowError && (
              <p className="shrink-0 mb-2 text-[11px] text-[var(--tf-danger-text)]">{rowError}</p>
            )}
            {/* Resizable Split (Liste | Detail) — Drag-Handle + persistierte Breite */}
            <MasterDetailLayout
              listWidthKey="teamflow_feedback_kurator_list_width"
              narrowDefaultWidth={480}
              onCloseDetail={() => setSelectedId(undefined)}
              detail={selectedTicket ? (
                <div className="h-full overflow-y-auto p-3 lg:p-4">
                  <FeedbackTicketDetail
                    ticket={selectedTicket}
                    onClose={() => setSelectedId(undefined)}
                    onUpdated={reload}
                  />
                </div>
              ) : undefined}
              list={(
                <div className="px-1 py-1">
                  <FeedbackTicketList
                    tickets={filteredTickets}
                    loading={loading}
                    selectedId={selectedId}
                    onSelect={t => setSelectedId(t.id)}
                    onToggleDone={handleToggleDone}
                  />
                </div>
              )}
            />
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
