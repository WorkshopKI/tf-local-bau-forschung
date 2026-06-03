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
import {
  getFeedbackList,
  getSponsoringProgress,
  isClassifiedAs,
  loadFeedbackConfig,
} from '@/core/services/feedback';
import type { FeedbackCategory, FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';

type ViewMode = 'card' | 'list';
type StatusFilter = 'all' | 'open' | 'done';

const pillBase = 'px-2.5 py-1 rounded-full text-[11.5px] cursor-pointer transition-colors';
const pillActive = `${pillBase} bg-[var(--tf-primary)] text-white`;
const pillInactive = `${pillBase} text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]`;

// Status als Gruppen (wie bisher auf dem Board): „Offen" = neu/geplant/in_bearbeitung.
const STATUS_PILLS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'open', label: 'Offen' },
  { id: 'done', label: 'Umgesetzt' },
];

// Kategorie wie im Kurator-Dashboard (CATEGORY_PILLS).
const CATEGORY_PILLS: { id: FeedbackCategory | ''; label: string }[] = [
  { id: '', label: 'Alle' },
  { id: 'problem', label: 'Bug' },
  { id: 'idea', label: 'Idee' },
  { id: 'praise', label: 'Lob' },
  { id: 'question', label: 'Frage' },
];

export function FeedbackBoardPage(): React.ReactElement {
  const storage = useStorage();
  const [tickets, setTickets] = useState<FeedbackItem[]>([]);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterKategorie, setFilterKategorie] = useState<FeedbackCategory | ''>('');
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

  // Distinct Bereiche (context.route → page-Label) aus den Tickets, für die
  // Bereich-Filter-Pills (z.B. „alle Tickets zur Homepage"). Wie im Kurator-Dashboard.
  const areas = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tickets) {
      const route = t.context?.route;
      if (!route) continue;
      if (!map.has(route)) map.set(route, t.context.page || route);
    }
    return Array.from(map, ([route, label]) => ({ route, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tickets]);

  const filteredSorted = useMemo(() => {
    // Alle nicht-archivierten Einträge — inkl. Lob/Frage/Unklassifiziert.
    // Drei unabhängige Filter (UND-kombiniert), wie im Kurator-Dashboard.
    const base = tickets.filter(t => t.kurator_status !== 'archiviert');
    const byFilter = base.filter(t => {
      if (filterKategorie && t.category !== filterKategorie) return false;
      if (filterArea && t.context?.route !== filterArea) return false;
      if (filterStatus === 'open' && !(t.kurator_status === 'neu' || t.kurator_status === 'geplant' || t.kurator_status === 'in_bearbeitung')) return false;
      if (filterStatus === 'done' && t.kurator_status !== 'umgesetzt') return false;
      return true;
    });
    return byFilter.sort((a, b) => {
      const aBearb = a.kurator_status === 'in_bearbeitung' ? 0 : 1;
      const bBearb = b.kurator_status === 'in_bearbeitung' ? 0 : 1;
      if (aBearb !== bBearb) return aBearb - bBearb;
      if (isFeature(a) && isFeature(b)) {
        const pa = getSponsoringProgress(a, config).percentage;
        const pb = getSponsoringProgress(b, config).percentage;
        if (pa !== pb) return pb - pa;
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tickets, filterStatus, filterKategorie, filterArea, config, isFeature]);

  const counts = useMemo(() => {
    const active = tickets.filter(t => t.kurator_status !== 'archiviert');
    return {
      bugs: active.filter(isBug).length,
      features: active.filter(isFeature).length,
      sonstige: active.filter(t => !isBug(t) && !isFeature(t)).length,
    };
  }, [tickets, isBug, isFeature]);

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

      {/* Filter: Status / Kategorie / Bereich (UND-kombiniert) + View-Toggle */}
      <div className="space-y-1.5 mb-4">
        {/* Status + View-Toggle */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--tf-text-tertiary)] font-medium w-[68px] shrink-0">Status</span>
          <div className="flex flex-wrap gap-1">
            {STATUS_PILLS.map(p => (
              <button key={p.id} type="button" onClick={() => setFilterStatus(p.id)}
                className={filterStatus === p.id ? pillActive : pillInactive}
                style={filterStatus !== p.id ? { border: '0.5px solid var(--tf-border)' } : undefined}>
                {p.label}
              </button>
            ))}
          </div>
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
        {/* Kategorie */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--tf-text-tertiary)] font-medium w-[68px] shrink-0">Kategorie</span>
          <div className="flex flex-wrap gap-1">
            {CATEGORY_PILLS.map(p => (
              <button key={p.id} type="button" onClick={() => setFilterKategorie(p.id)}
                className={filterKategorie === p.id ? pillActive : pillInactive}
                style={filterKategorie !== p.id ? { border: '0.5px solid var(--tf-border)' } : undefined}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {/* Bereich */}
        {areas.length > 0 && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--tf-text-tertiary)] font-medium w-[68px] shrink-0 mt-1">Bereich</span>
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => setFilterArea('')}
                className={filterArea === '' ? pillActive : pillInactive}
                style={filterArea !== '' ? { border: '0.5px solid var(--tf-border)' } : undefined}>
                Alle
              </button>
              {areas.map(a => (
                <button key={a.route} type="button" onClick={() => setFilterArea(a.route)}
                  className={filterArea === a.route ? pillActive : pillInactive}
                  style={filterArea !== a.route ? { border: '0.5px solid var(--tf-border)' } : undefined}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
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
