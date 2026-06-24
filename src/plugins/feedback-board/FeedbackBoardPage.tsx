// Öffentliches Feedback-Board: Bugs + Features mit Sponsoring-Fortschritt.
// Drei Ansichten: Split (Liste + Detail, wie das Kurator-Dashboard, Default),
// gruppierte Karten, Sortier-Tabelle. Filter-Chips (CollapsibleSeg wie
// Förderanträge) + Sponsoring-Info-Banner gelten für alle Ansichten.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Columns2, LayoutGrid, List } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { MasterDetailLayout } from '@/components/master-detail';
import {
  BudgetBadge,
  CATEGORY_ORDER,
  FeedbackBoardDetail,
  FeedbackBoardList,
  FeedbackBoardListView,
  FeedbackCategoryGroup,
  type CategoryGroupKey,
  SponsoringInfoBanner,
} from '@/components/feedback';
import {
  getFeedbackList,
  getSponsoringProgress,
  isClassifiedAs,
  isSponsorableCategory,
  loadFeedbackConfig,
  FEEDBACK_STATUS,
  istOffen,
  istUmgesetzt,
  istArchiviert,
} from '@/core/services/feedback';
import { CollapsibleSeg, type CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';
import type { FeedbackCategory, FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';

type ViewMode = 'split' | 'card' | 'list';
type StatusFilter = 'all' | 'open' | 'done';

// Status als Gruppen (wie bisher auf dem Board): „Offen" = neu/geplant/in_bearbeitung.
const STATUS_TO_LABEL: Record<StatusFilter, string> = { all: 'Alle', open: 'Offen', done: 'Umgesetzt' };
const LABEL_TO_STATUS: Record<string, StatusFilter> = { Alle: 'all', Offen: 'open', Umgesetzt: 'done' };

// Kategorie wie im Kurator-Dashboard.
const KAT_TO_LABEL: Record<FeedbackCategory | '', string> = {
  '': 'Alle', problem: 'Bug', idea: 'Idee', ux: 'UX', praise: 'Lob', question: 'Frage',
};
const LABEL_TO_KAT: Record<string, FeedbackCategory | ''> = {
  Alle: '', Bug: 'problem', Idee: 'idea', UX: 'ux', Lob: 'praise', Frage: 'question',
};

// Eingeklappte Kategorie-Gruppen (Card-Ansicht) überleben Reloads via localStorage.
// Default leer = alles aufgeklappt. localStorage für simple UI-Flags lt. CLAUDE.md ok.
const COLLAPSED_CATS_KEY = 'tf-feedback-board-collapsed-cats';
// Zuletzt gewählte Ansicht überlebt Reloads; Default = Split (Erstansicht).
const VIEW_MODE_KEY = 'tf-feedback-board-view-mode';

function loadCollapsedCats(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_CATS_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function persistCollapsedCats(set: Set<string>): void {
  try {
    localStorage.setItem(COLLAPSED_CATS_KEY, JSON.stringify([...set]));
  } catch {
    /* localStorage nicht verfügbar — Collapse-State ist nur Komfort, ignorieren */
  }
}

function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (raw === 'split' || raw === 'card' || raw === 'list') return raw;
  } catch { /* ignore */ }
  return 'split';
}

export function FeedbackBoardPage(): React.ReactElement {
  const storage = useStorage();
  const [tickets, setTickets] = useState<FeedbackItem[]>([]);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterKategorie, setFilterKategorie] = useState<FeedbackCategory | ''>('');
  // Bereich = context.page-Label (CollapsibleSeg ist label-basiert). '' = Alle.
  const [filterArea, setFilterArea] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const changeViewMode = useCallback((mode: ViewMode): void => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* ignore */ }
  }, []);

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
  // „Feature" im Board-Sinn = sponsorbar (idea + ux) — beide werden nach
  // Sponsoring-Fortschritt sortiert und im Header als Features gezählt.
  const isFeature = (t: FeedbackItem): boolean => isSponsorableCategory(t.category);

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
    { label: 'UX', count: base.filter(t => t.category === 'ux').length },
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

  // Aktuell gewähltes Ticket (nur wenn es im gefilterten Set liegt — Filterwechsel
  // oder Löschen schließt das Detail automatisch).
  const selectedTicket = useMemo(
    () => filteredSorted.find(t => t.id === selectedId),
    [filteredSorted, selectedId],
  );

  const counts = useMemo(() => ({
    bugs: base.filter(isBug).length,
    features: base.filter(isFeature).length,
    sonstige: base.filter(t => !isBug(t) && !isFeature(t)).length,
  }), [base, isBug, isFeature]);

  // Gruppierung der Card-Ansicht nach Kategorie/Typ (feste Reihenfolge,
  // Unklassifiziert zuletzt). Reihenfolge innerhalb einer Gruppe = bereits
  // sortiertes filteredSorted. Leere Gruppen entfallen.
  const groups = useMemo(() => {
    const order: CategoryGroupKey[] = [...CATEGORY_ORDER, 'unclassified'];
    const buckets = new Map<CategoryGroupKey, FeedbackItem[]>();
    for (const t of filteredSorted) {
      const key: CategoryGroupKey = t.category ?? 'unclassified';
      const arr = buckets.get(key);
      if (arr) arr.push(t);
      else buckets.set(key, [t]);
    }
    return order
      .map(key => ({ key, items: buckets.get(key) ?? [] }))
      .filter(g => g.items.length > 0);
  }, [filteredSorted]);

  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => loadCollapsedCats());
  const toggleCat = useCallback((key: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persistCollapsedCats(next);
      return next;
    });
  }, []);

  const emptyHint = (
    <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-12">
      Keine Einträge. Nutze den Feedback-Button unten rechts um Ideen oder Bugs zu melden.
    </p>
  );
  const loadingHint = <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-8">Lade…</p>;

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-60px)] overflow-hidden">
      {/* Header (gilt für alle Ansichten) */}
      <div className="shrink-0 px-8 pt-6">
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

          {([
            ['split', Columns2, 'Split-Ansicht (Liste + Detail)'],
            ['card', LayoutGrid, 'Kartenansicht'],
            ['list', List, 'Listenansicht'],
          ] as const).map(([mode, Icon, title]) => (
            <button
              key={mode}
              type="button"
              onClick={() => changeViewMode(mode)}
              className={`p-1.5 rounded-[var(--tf-radius)] cursor-pointer transition-colors ${
                viewMode === mode
                  ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]'
                  : 'text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)]'
              }`}
              title={title}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'split' ? (
        <MasterDetailLayout
          listWidthKey="teamflow_feedback_board_narrow_width"
          onCloseDetail={() => setSelectedId(undefined)}
          detail={selectedTicket ? (
            <FeedbackBoardDetail
              ticket={selectedTicket}
              config={config}
              onClose={() => setSelectedId(undefined)}
              onChanged={handleChanged}
            />
          ) : undefined}
          list={(
            <div className={selectedTicket ? 'px-2 py-2' : 'px-8 py-2'}>
              {loading ? loadingHint : filteredSorted.length === 0 ? emptyHint : (
                <FeedbackBoardList
                  tickets={filteredSorted}
                  selectedId={selectedId}
                  onSelect={t => setSelectedId(t.id)}
                />
              )}
            </div>
          )}
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-6">
          {loading && loadingHint}
          {!loading && filteredSorted.length === 0 && emptyHint}
          {!loading && filteredSorted.length > 0 && viewMode === 'card' && (
            <div className="space-y-4">
              {groups.map(g => (
                <FeedbackCategoryGroup
                  key={g.key}
                  categoryKey={g.key}
                  items={g.items}
                  config={config}
                  collapsed={collapsedCats.has(g.key)}
                  onToggle={() => toggleCat(g.key)}
                  onChanged={handleChanged}
                />
              ))}
            </div>
          )}
          {!loading && filteredSorted.length > 0 && viewMode === 'list' && (
            <FeedbackBoardListView tickets={filteredSorted} config={config} />
          )}
        </div>
      )}
    </div>
  );
}
