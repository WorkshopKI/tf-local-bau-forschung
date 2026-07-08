// Öffentliches Feedback-Board (Redesign v2.199): scannbare Karten-Liste + Kanban,
// Scope-Tabs (Alle/Von mir/Vom Team), Typ-Filter-Chips, Suche, Sortierung, und ein
// Detail-Drawer (Master-Detail-Split) mit Votes + Kommentaren. Ersetzt die frühere
// Split/Karten/Tabelle-Trias.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { List, Columns3, Search } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { MasterDetailLayout } from '@/components/master-detail';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { Input } from '@/components/ui/input';
import {
  BudgetBadge,
  FeedbackBoardDetail,
  FeedbackCard,
  FeedbackKanban,
  FeedbackTypeChips,
  type TypeChipItem,
  CATEGORY_DOT,
  feedbackTitle,
} from '@/components/feedback';
import {
  getFeedbackList,
  isClassifiedAs,
  isSponsorableCategory,
  loadFeedbackConfig,
  istArchiviert,
} from '@/core/services/feedback';
import type { FeedbackCategory, FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';

type ViewMode = 'liste' | 'board';
type Scope = 'alle' | 'mir' | 'team';
type Sort = 'neu' | 'votes';

const VIEW_MODE_KEY = 'tf-feedback-board-view-v2';
const SORT_KEY = 'tf-feedback-board-sort-v2';

function loadViewMode(): ViewMode {
  try { const r = localStorage.getItem(VIEW_MODE_KEY); if (r === 'liste' || r === 'board') return r; } catch { /* ignore */ }
  return 'liste';
}
function loadSort(): Sort {
  try { const r = localStorage.getItem(SORT_KEY); if (r === 'neu' || r === 'votes') return r; } catch { /* ignore */ }
  return 'neu';
}

const CATEGORY_CHIPS: Array<{ key: FeedbackCategory; label: string }> = [
  { key: 'problem', label: 'Problem' },
  { key: 'idea', label: 'Idee' },
  { key: 'ux', label: 'UX' },
  { key: 'praise', label: 'Lob' },
  { key: 'question', label: 'Frage' },
];

export function FeedbackBoardPage(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const kuerzel = useMeinKuerzel();
  // Identität für Scope + Votes + Kommentare: Kürzel (Login) → sonst Profilname.
  const meId = kuerzel ?? (profile?.name && profile.name !== 'anonymous' ? profile.name : undefined);
  const meName = profile?.name && profile.name !== 'anonymous' ? profile.name : kuerzel;

  const [tickets, setTickets] = useState<FeedbackItem[]>([]);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [scope, setScope] = useState<Scope>('alle');
  const [filterKategorie, setFilterKategorie] = useState<FeedbackCategory | ''>('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>(loadSort);
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const changeViewMode = useCallback((m: ViewMode): void => {
    setViewMode(m);
    try { localStorage.setItem(VIEW_MODE_KEY, m); } catch { /* ignore */ }
  }, []);
  const toggleSort = useCallback((): void => {
    setSort(s => {
      const next: Sort = s === 'neu' ? 'votes' : 'neu';
      try { localStorage.setItem(SORT_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const reload = useCallback(async (silent = false): Promise<void> => {
    if (!silent) setLoading(true);
    try {
      const [items, cfg] = await Promise.all([getFeedbackList(storage), loadFeedbackConfig(storage)]);
      setTickets(items);
      setConfig(cfg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [storage]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const handler = (): void => { void reload(true); };
    window.addEventListener('feedback-updated', handler);
    return () => window.removeEventListener('feedback-updated', handler);
  }, [reload]);
  useEffect(() => {
    const onVisible = (): void => { if (document.visibilityState === 'visible') void reload(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const handleChanged = useCallback(() => {
    setRefreshKey(k => k + 1);
    void reload(true);
  }, [reload]);

  const isBug = isClassifiedAs('problem');
  const isFeature = (t: FeedbackItem): boolean => isSponsorableCategory(t.category);

  // Nicht-archivierte Basis für Zähler + Filter.
  const base = useMemo(() => tickets.filter(t => !istArchiviert(t.kurator_status)), [tickets]);

  const counts = useMemo(() => ({
    probleme: base.filter(isBug).length,
    ideen: base.filter(isFeature).length,
    lob: base.filter(t => t.category === 'praise').length,
  }), [base, isBug]);

  const scopeItems = useMemo(() => {
    const mine = meId ? base.filter(t => t.user_id === meId).length : 0;
    return [
      { key: 'alle', label: 'Alle', count: base.length },
      { key: 'mir', label: 'Von mir', count: mine },
      { key: 'team', label: 'Vom Team', count: base.length - mine },
    ];
  }, [base, meId]);

  const typeChips: TypeChipItem[] = useMemo(() => [
    { key: '', label: 'Alle', count: base.length },
    ...CATEGORY_CHIPS.map(c => ({
      key: c.key, label: c.label, count: base.filter(t => t.category === c.key).length, dot: CATEGORY_DOT[c.key],
    })),
  ], [base]);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byFilter = base.filter(t => {
      if (scope === 'mir' && !(meId && t.user_id === meId)) return false;
      if (scope === 'team' && meId && t.user_id === meId) return false;
      if (filterKategorie && t.category !== filterKategorie) return false;
      if (q) {
        const hay = `${feedbackTitle(t)} ${t.text} ${t.context?.page ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return byFilter.sort((a, b) => {
      if (sort === 'votes') {
        const d = (b.votes?.length ?? 0) - (a.votes?.length ?? 0);
        if (d !== 0) return d;
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [base, scope, meId, filterKategorie, query, sort]);

  const selectedTicket = useMemo(
    () => filteredSorted.find(t => t.id === selectedId),
    [filteredSorted, selectedId],
  );

  const emptyHint = (
    <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-12">
      Keine Einträge. Nutze den Feedback-Button unten rechts, um Ideen oder Bugs zu melden.
    </p>
  );
  const loadingHint = <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-8">Lade…</p>;

  const listContent = (narrow: boolean): React.ReactNode => {
    if (loading) return loadingHint;
    if (filteredSorted.length === 0) return emptyHint;
    if (viewMode === 'board' && !narrow) {
      return (
        <FeedbackKanban
          tickets={filteredSorted}
          meineUserId={meId}
          meId={meId}
          meName={meName ?? undefined}
          onSelect={t => setSelectedId(t.id)}
          onChanged={handleChanged}
        />
      );
    }
    return (
      <div>
        {filteredSorted.map(t => (
          <FeedbackCard
            key={t.id}
            ticket={t}
            selected={selectedId === t.id}
            mine={!!meId && t.user_id === meId}
            meId={meId}
            meName={meName ?? undefined}
            onSelect={x => setSelectedId(x.id)}
            onChanged={handleChanged}
            narrow={narrow}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-60px)] overflow-hidden">
      {/* Kopf */}
      <div className="shrink-0 px-8 pt-6">
        <PageHeader
          title="Feedback"
          subtitle={
            <>
              <b className="text-[var(--tf-text-secondary)]">{counts.probleme}</b> Probleme{'  ·  '}
              <b className="text-[var(--tf-text-secondary)]">{counts.ideen}</b> Ideen{'  ·  '}
              <b className="text-[var(--tf-text-secondary)]">{counts.lob}</b> Lob
            </>
          }
          actions={<BudgetBadge refreshKey={refreshKey} />}
          className="mb-4"
        />

        {/* Scope-Tabs (eigene Zeile) */}
        <div className="mb-3">
          <ScopeTabs
            variant="tabs"
            items={scopeItems}
            activeKey={scope}
            onChange={k => setScope(k as Scope)}
            aria-label="Feedback-Sicht"
          />
        </div>

        {/* Typ-Filter-Chips (links) + Suche/Sort/View (rechts) */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
          <div className="min-w-0 flex-1">
            <FeedbackTypeChips items={typeChips} activeKey={filterKategorie} onChange={k => setFilterKategorie(k as FeedbackCategory | '')} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Feedback durchsuchen"
                className="pl-7 h-8 w-[200px] text-[12.5px]"
              />
            </div>
            <button
              type="button"
              onClick={toggleSort}
              title="Sortierung wechseln"
              className="h-8 px-3 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              {sort === 'neu' ? 'Neueste zuerst' : 'Meiste Votes'}
            </button>
            <div className="flex items-center gap-0.5 rounded-[var(--tf-radius)] p-0.5" style={{ border: '0.5px solid var(--tf-border)' }}>
              {([['liste', List, 'Liste'], ['board', Columns3, 'Board']] as const).map(([m, Icon, title]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => changeViewMode(m)}
                  title={title}
                  className={`p-1.5 rounded-[var(--tf-radius-sm)] cursor-pointer transition-colors ${
                    viewMode === m ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)]'
                  }`}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Inhalt: Master-Detail-Split */}
      <MasterDetailLayout
        listWidthKey="teamflow_feedback_board_narrow_width"
        onCloseDetail={() => setSelectedId(undefined)}
        detail={selectedTicket ? (
          <FeedbackBoardDetail
            ticket={selectedTicket}
            config={config}
            onClose={() => setSelectedId(undefined)}
            onChanged={handleChanged}
            meId={meId}
            meName={meName ?? undefined}
          />
        ) : undefined}
        list={(
          <div className={selectedTicket ? 'px-2 py-2' : 'px-8 py-2'}>
            {listContent(!!selectedTicket)}
          </div>
        )}
      />
    </div>
  );
}
