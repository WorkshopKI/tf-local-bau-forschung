// Öffentliches Feedback-Board: Bugs + Features mit Sponsoring-Fortschritt.
// Card- und Listen-Ansicht, Filter-Chips (CollapsibleSeg wie Förderanträge), Sponsoring-Info-Banner.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  BudgetBadge,
  FeedbackBoardCard,
  FeedbackBoardListView,
  SponsoringInfoBanner,
} from '@/components/feedback';
import {
  getFeedbackList,
  getSponsoringProgress,
  isClassifiedAs,
  loadFeedbackConfig,
  FEEDBACK_STATUS,
  istOffen,
  istUmgesetzt,
  istArchiviert,
} from '@/core/services/feedback';
import { CollapsibleSeg, type CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';
import type { FeedbackCategory, FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';

type ViewMode = 'card' | 'list';
type StatusFilter = 'all' | 'open' | 'done';

// Status als Gruppen (wie bisher auf dem Board): „Offen" = neu/geplant/in_bearbeitung.
const STATUS_TO_LABEL: Record<StatusFilter, string> = { all: 'Alle', open: 'Offen', done: 'Umgesetzt' };
const LABEL_TO_STATUS: Record<string, StatusFilter> = { Alle: 'all', Offen: 'open', Umgesetzt: 'done' };

// Kategorie wie im Kurator-Dashboard.
const KAT_TO_LABEL: Record<FeedbackCategory | '', string> = {
  '': 'Alle', problem: 'Bug', idea: 'Idee', praise: 'Lob', question: 'Frage',
};
const LABEL_TO_KAT: Record<string, FeedbackCategory | ''> = {
  Alle: '', Bug: 'problem', Idee: 'idea', Lob: 'praise', Frage: 'question',
};

export function FeedbackBoardPage(): React.ReactElement {
  const storage = useStorage();
  const [tickets, setTickets] = useState<FeedbackItem[]>([]);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterKategorie, setFilterKategorie] = useState<FeedbackCategory | ''>('');
  // Bereich = context.page-Label (CollapsibleSeg ist label-basiert). '' = Alle.
  const [filterArea, setFilterArea] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // silent: kein Loading-Spinner (für Hintergrund-Re-Reads bei Tab-Fokus —
  // verhindert „Lade…"-Flackern bei jedem Tab-Wechsel).
  const reload = useCallback(async (silent = false): Promise<void> => {
    if (!silent) setLoading(true);
    try {
      const [items, cfg] = await Promise.all([
        getFeedbackList(storage),
        loadFeedbackConfig(storage),
      ]);
      setTickets(items);
      setConfig(cfg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [storage]);

  useEffect(() => { void reload(); }, [reload]);

  // Live-Refresh bei globalem feedback-updated Event (nur im eigenen Tab)
  useEffect(() => {
    const handler = (): void => { void reload(); };
    window.addEventListener('feedback-updated', handler);
    return () => window.removeEventListener('feedback-updated', handler);
  }, [reload]);

  // Offene Übersichten anderer User: beim Zurückwechseln auf den Tab die
  // geteilte feedback.json neu einlesen → zwischenzeitlich von PL/Kurator
  // hinzugefügtes Feedback erscheint ohne manuellen Reload.
  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void reload(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const handleChanged = useCallback(() => {
    setRefreshKey(k => k + 1);
    void reload();
  }, [reload]);

  // Helfer schließen Pending-Tickets (LLM noch nicht durch / fehlgeschlagen) aus.
  const isBug = isClassifiedAs('problem');
  const isFeature = isClassifiedAs('idea');

  // Nicht-archivierte Basis für Filter-Optionen + -Zähler.
  const base = useMemo(() => tickets.filter(t => !istArchiviert(t.kurator_status)), [tickets]);

  // Filter-Items (Label + Zähler) für die CollapsibleSeg-Chips.
  const statusItems: CollapsibleSegItem[] = useMemo(() => {
    const open = base.filter(t => istOffen(t.kurator_status)).length;
    const done = base.filter(t => istUmgesetzt(t.kurator_status)).length;
    return [
      { label: 'Alle', count: base.length },
      { label: 'Offen', count: open },
      { label: 'Umgesetzt', count: done },
    ];
  }, [base]);

  const kategorieItems: CollapsibleSegItem[] = useMemo(() => [
    { label: 'Alle', count: base.length },
    { label: 'Bug', count: base.filter(t => t.category === 'problem').length },
    { label: 'Idee', count: base.filter(t => t.category === 'idea').length },
    { label: 'Lob', count: base.filter(t => t.category === 'praise').length },
    { label: 'Frage', count: base.filter(t => t.category === 'question').length },
  ], [base]);

  // Bereich = context.page (Label). Distinct page-Labels + Zähler, alphabetisch.
  const bereichItems: CollapsibleSegItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of base) {
      const p = t.context?.page;
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const items = Array.from(counts, ([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ label: 'Alle', count: base.length }, ...items];
  }, [base]);

  const filteredSorted = useMemo(() => {
    // Drei unabhängige Filter (UND-kombiniert), wie im Kurator-Dashboard.
    const byFilter = base.filter(t => {
      if (filterKategorie && t.category !== filterKategorie) return false;
      if (filterArea && t.context?.page !== filterArea) return false;
      if (filterStatus === 'open' && !istOffen(t.kurator_status)) return false;
      if (filterStatus === 'done' && !istUmgesetzt(t.kurator_status)) return false;
      return true;
    });
    return byFilter.sort((a, b) => {
      const aBearb = a.kurator_status === FEEDBACK_STATUS.in_bearbeitung ? 0 : 1;
      const bBearb = b.kurator_status === FEEDBACK_STATUS.in_bearbeitung ? 0 : 1;
      if (aBearb !== bBearb) return aBearb - bBearb;
      if (isFeature(a) && isFeature(b)) {
        const pa = getSponsoringProgress(a, config).percentage;
        const pb = getSponsoringProgress(b, config).percentage;
        if (pa !== pb) return pb - pa;
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [base, filterStatus, filterKategorie, filterArea, config, isFeature]);

  const counts = useMemo(() => ({
    bugs: base.filter(isBug).length,
    features: base.filter(isFeature).length,
    sonstige: base.filter(t => !isBug(t) && !isFeature(t)).length,
  }), [base, isBug, isFeature]);

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Feedback Übersicht</h1>
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
            {counts.bugs} {counts.bugs === 1 ? 'Bug' : 'Bugs'} · {counts.features} Features
            {counts.sonstige > 0 && ` · ${counts.sonstige} Sonstige`}
          </p>
        </div>
        <BudgetBadge refreshKey={refreshKey} />
      </div>

      {/* Info-Banner */}
      <SponsoringInfoBanner />

      {/* Filter-Chips (CollapsibleSeg, wie Förderanträge) + View-Toggle */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <CollapsibleSeg
          label="Status"
          value={STATUS_TO_LABEL[filterStatus]}
          items={statusItems}
          onChange={l => setFilterStatus(LABEL_TO_STATUS[l] ?? 'all')}
        />
        <CollapsibleSeg
          label="Kategorie"
          value={KAT_TO_LABEL[filterKategorie]}
          items={kategorieItems}
          onChange={l => setFilterKategorie(LABEL_TO_KAT[l] ?? '')}
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
