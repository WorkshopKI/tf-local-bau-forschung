// Öffentliches Feedback-Board (Redesign v2.208 feedback-optimiert, Lanes +
// Dichte v2.225 feedback-kanban): scannbare Karten-Liste + farbiges Kanban
// (Lob nur in der Liste), gefüllte Scope-Segmente, Typ-Filter-Chips, Suche,
// 5-fach-Sortierung + Status-Filter, Dichte-Umschalter (Komfort/Kompakt),
// Benachrichtigungs-Glocke, „Dein Fortschritt"-Leiste und ein Detail-Panel
// (Master-Detail-Split) mit Stepper, Sponsoring-Panel, Votes + Kommentaren.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { List, Columns3, Rows3, Search, Settings2 } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { MasterDetailLayout } from '@/components/master-detail';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { Input } from '@/components/ui/input';
// Direkt an den Quellmodulen statt am Barrel: das Barrel zieht `FeedbackPanel` mit,
// und das laedt `@/plugins.config` — die Plugin-Liste fuehrt zurueck auf diese Seite
// (Laufzeit-Zyklus). Ohne die Sammel-Zeile ist der Weg jedes Symbols direkt.
import { BudgetBadge } from '@/components/feedback/BudgetBadge';
import { FeedbackBoardDetail } from '@/components/feedback/FeedbackBoardDetail';
import { FeedbackCard } from '@/components/feedback/FeedbackCard';
import { FeedbackKanban } from '@/components/feedback/FeedbackKanban';
import { FeedbackTypeChips, type TypeChipItem } from '@/components/feedback/FeedbackTypeChips';
import { FeedbackSortSelect, type FeedbackSort } from '@/components/feedback/FeedbackSortSelect';
import { FeedbackStatusSelect, type FeedbackStatusFilter } from '@/components/feedback/FeedbackStatusSelect';
import { NotificationBell } from '@/components/feedback/NotificationBell';
import { MyProgressBar } from '@/components/feedback/MyProgressBar';
import { useUnreadReplies } from '@/components/feedback/useUnreadReplies';
import { useUnreadComments } from '@/components/feedback/useUnreadComments';
import { useFeedbackNavStore } from '@/components/feedback/feedbackNavStore';
import { CATEGORY_DOT } from '@/components/feedback/constants';
import {
  getFeedbackList,
  isClassifiedAs,
  isSponsorableCategory,
  loadFeedbackConfig,
  istArchiviert,
} from '@/core/services/feedback';
import type { FeedbackCategory, FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';
import { canManageFeedback } from '@/config/feature-flags';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { FeedbackKanbanEinstellungen } from '@/components/feedback/FeedbackKanbanEinstellungen';
import {
  loadBoardKanbanConfig,
  saveBoardKanbanConfig,
  type BoardKanbanConfig,
} from '@/components/feedback/boardKanbanConfig';
import { FeedbackVerwaltungDialog } from './verwaltung/FeedbackVerwaltungDialog';
import { useAutoCollectFeedback } from './verwaltung/useAutoCollectFeedback';
import { filterAndSortBoard, type BoardScope } from './boardFilter';

type ViewMode = 'liste' | 'board';

// Key-Bump `_v3`: Standard ist jetzt „Board" (Fortschritt auf einen Blick);
// gewonnen hätte sonst der alte, in localStorage gespeicherte 'liste'-Eintrag.
const VIEW_MODE_KEY = 'tf-feedback-board-view-v3';
const SORT_KEY = 'tf-feedback-board-sort-v3';
const DENSITY_KEY = 'tf-feedback-board-density-v1';
// Derselbe Key wie im früheren Kurator-Dashboard — die Vorliebe zieht mit um.
const ARCHIV_KEY = 'teamflow_feedback_show_archived';
const SORT_VALUES: readonly FeedbackSort[] = ['neu', 'pkt', 'naht', 'sup', 'kmt'];

function loadViewMode(): ViewMode {
  try { const r = localStorage.getItem(VIEW_MODE_KEY); if (r === 'liste' || r === 'board') return r; } catch { /* ignore */ }
  return 'board';
}
function loadSort(): FeedbackSort {
  try {
    const r = localStorage.getItem(SORT_KEY);
    if (r && (SORT_VALUES as readonly string[]).includes(r)) return r as FeedbackSort;
  } catch { /* ignore */ }
  return 'neu';
}
function loadDense(): boolean {
  try { return localStorage.getItem(DENSITY_KEY) === 'dense'; } catch { /* ignore */ }
  return false;
}
function loadZeigeArchiv(): boolean {
  try { return localStorage.getItem(ARCHIV_KEY) === '1'; } catch { /* ignore */ }
  return false;
}

const CATEGORY_CHIPS: Array<{ key: FeedbackCategory; label: string }> = [
  { key: 'problem', label: 'Problem' },
  { key: 'idea', label: 'Idee' },
  { key: 'praise', label: 'Lob' },
  { key: 'question', label: 'Frage' },
];

export function FeedbackBoardPage(): React.ReactElement {
  const storage = useStorage();
  // Sammelt die persönlichen Feedback-/Stimmen-/Kommentar-Outboxen der
  // read-only-Nutzer ein (einmal pro App-Session, self-gated: ohne verbundene
  // User-Wurzel bzw. ohne Schreibrecht ein No-op). Hing bis v2.363 am
  // Kurator-Plugin — ohne diesen Aufruf versiegte prod-Feedback still.
  useAutoCollectFeedback();
  const { profile } = useProfile();
  const kuerzel = useMeinKuerzel();
  // Identität für Scope + Votes + Kommentare + Budget: Kürzel (Login) → sonst Profilname.
  const meId = kuerzel ?? (profile?.name && profile.name !== 'anonymous' ? profile.name : undefined);
  const meName = profile?.name && profile.name !== 'anonymous' ? profile.name : kuerzel;
  // Verwaltungsrecht (v2.364): Kurator-Profil ODER Build mit Share-Schreibrecht
  // (pl/kurator/as/dev). Ersetzt den früheren Menüpunkt Kuration → Feedback.
  const darfVerwalten = canManageFeedback(profile?.is_kurator === true || profile?.is_admin === true);

  const [tickets, setTickets] = useState<FeedbackItem[]>([]);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [scope, setScope] = useState<BoardScope>('alle');
  const [filterKategorie, setFilterKategorie] = useState<FeedbackCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatusFilter>('alle');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<FeedbackSort>(loadSort);
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [dense, setDense] = useState<boolean>(loadDense);
  const [zeigeArchiv, setZeigeArchiv] = useState<boolean>(loadZeigeArchiv);
  const [kanbanConfig, setKanbanConfig] = useState<BoardKanbanConfig>(loadBoardKanbanConfig);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [verwaltungOffen, setVerwaltungOffen] = useState(false);

  const changeViewMode = useCallback((m: ViewMode): void => {
    setViewMode(m);
    try { localStorage.setItem(VIEW_MODE_KEY, m); } catch { /* ignore */ }
  }, []);
  const changeSort = useCallback((s: FeedbackSort): void => {
    setSort(s);
    try { localStorage.setItem(SORT_KEY, s); } catch { /* ignore */ }
  }, []);
  const changeKanbanConfig = useCallback((cfg: BoardKanbanConfig): void => {
    setKanbanConfig(cfg);
    saveBoardKanbanConfig(cfg);
  }, []);
  const toggleDense = useCallback((): void => {
    setDense(d => {
      const next = !d;
      try { localStorage.setItem(DENSITY_KEY, next ? 'dense' : 'comfort'); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const changeZeigeArchiv = useCallback((v: boolean): void => {
    setZeigeArchiv(v);
    try { localStorage.setItem(ARCHIV_KEY, v ? '1' : '0'); } catch { /* ignore */ }
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
  // Deep-Link von einem read-only Widget (z.B. Feedback-Kanban der Startseite):
  // einmalig beim Mount das vorgemerkte Ticket öffnen (selectedTicket löst sich
  // reaktiv auf, sobald die Tickets geladen sind).
  useEffect(() => {
    const pending = useFeedbackNavStore.getState().consumePendingTicket();
    if (pending) setSelectedId(pending);
  }, []);
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

  // Nicht-archivierte Basis für Zähler + Filter. Verwalter dürfen die Archivierten
  // einblenden (Aufräum-Sicht) — für alle anderen bleiben sie unsichtbar.
  const archivSichtbar = darfVerwalten && zeigeArchiv;
  const base = useMemo(
    () => (archivSichtbar ? tickets : tickets.filter(t => !istArchiviert(t.kurator_status))),
    [tickets, archivSichtbar],
  );

  // Ungelesene Team-Antworten auf eigene Feedbacks (Glocke + Marker + „Neu"-Hervorhebung).
  const { count: unread, isUnread, markSeen: markAntwortSeen } = useUnreadReplies(base, meId);
  // Neue Kommentare an BELIEBIGEN Tickets (Marker + Hervorhebung im Hover).
  const { neuFuer, markSeen: markKommentareSeen } = useUnreadComments(base, meId);
  // Eine komponierte „gesehen"-Meldung: das Detail-Panel kennt weiterhin genau
  // einen Rückkanal, und beide Teile ignorieren selbst, was sie nichts angeht.
  const markSeen = useCallback((t: FeedbackItem): void => {
    markAntwortSeen(t);
    markKommentareSeen(t);
  }, [markAntwortSeen, markKommentareSeen]);

  const counts = useMemo(() => ({
    probleme: base.filter(isBug).length,
    ideen: base.filter(isFeature).length,
  }), [base, isBug]);

  const ownItems = useMemo(() => (meId ? base.filter(t => t.user_id === meId) : []), [base, meId]);

  const scopeItems = useMemo(() => [
    { key: 'alle', label: 'Alle', count: base.length },
    { key: 'mir', label: 'Von mir', count: ownItems.length },
    { key: 'team', label: 'Vom Team', count: base.length - ownItems.length },
  ], [base, ownItems]);

  const typeChips: TypeChipItem[] = useMemo(() => [
    { key: '', label: 'Alle', count: base.length },
    ...CATEGORY_CHIPS.map(c => ({
      key: c.key, label: c.label, count: base.filter(t => t.category === c.key).length, dot: CATEGORY_DOT[c.key],
    })),
  ], [base]);

  const filteredSorted = useMemo(
    () => filterAndSortBoard(
      base,
      { scope, meId, kategorie: filterKategorie, status: statusFilter, query, sort },
      config,
    ),
    [base, scope, meId, filterKategorie, statusFilter, query, sort, config],
  );

  const selectedTicket = useMemo(
    () => filteredSorted.find(t => t.id === selectedId),
    [filteredSorted, selectedId],
  );

  const emptyHint = (
    <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-12">
      Kein Feedback für diese Filter. Nutze den Feedback-Button unten rechts, um Ideen oder Bugs zu melden.
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
          config={config}
          meineUserId={meId}
          meId={meId}
          meName={meName ?? undefined}
          isUnread={isUnread}
          neueKommentare={neuFuer}
          onSelect={t => setSelectedId(t.id)}
          onChanged={handleChanged}
          dense={dense}
          lanes={kanbanConfig.lanes}
          farbmodus={kanbanConfig.farbmodus}
        />
      );
    }
    return (
      <div>
        {filteredSorted.map(t => (
          <FeedbackCard
            key={t.id}
            ticket={t}
            config={config}
            selected={selectedId === t.id}
            mine={!!meId && t.user_id === meId}
            unread={isUnread(t)}
            neueKommentare={neuFuer(t)}
            meId={meId}
            meName={meName ?? undefined}
            onSelect={x => setSelectedId(x.id)}
            onChanged={handleChanged}
            narrow={narrow}
            dense={dense}
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
              <b className="text-[var(--tf-text-secondary)]">{counts.ideen}</b> Ideen
            </>
          }
          actions={
            <div className="flex items-center gap-3">
              <NotificationBell count={unread} onClick={() => setScope('mir')} />
              <BudgetBadge refreshKey={refreshKey} bar />
              {/* Verwaltung (Inbox/FAQ/Sponsoring/Einstellungen) — löst den
                  früheren Menüpunkt Kuration → Feedback ab. */}
              {darfVerwalten && (
                <button
                  type="button"
                  onClick={() => setVerwaltungOffen(true)}
                  title="Feedback-Verwaltung — Inbox, FAQ, Sponsoring, Einstellungen"
                  aria-label="Feedback-Verwaltung öffnen"
                  className="h-8 w-8 grid place-items-center rounded-[var(--tf-radius)] cursor-pointer text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] transition-colors"
                  style={{ border: '0.5px solid var(--tf-border-hover)' }}
                >
                  <Settings2 size={15} />
                </button>
              )}
              <SeitenHilfeButton pluginId="feedback-board" />
            </div>
          }
          className="mb-4"
        />

        {/* Scope-Segmente (links) + Suche/Sort/View (rechts) */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <ScopeTabs
            variant="segmented"
            items={scopeItems}
            activeKey={scope}
            onChange={k => setScope(k as BoardScope)}
            aria-label="Feedback-Sicht"
          />
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Feedback durchsuchen"
                className="pl-7 h-8 w-[200px] text-[12.5px]"
              />
            </div>
            <FeedbackSortSelect value={sort} onChange={changeSort} />
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
            {/* Dichte-Umschalter (v2.225): Komfort ↔ Kompakt, gerätelokal persistiert. */}
            <button
              type="button"
              onClick={toggleDense}
              aria-pressed={dense}
              title={dense ? 'Komfortable Ansicht' : 'Kompakte Ansicht — mehr auf einen Blick'}
              className={`h-8 w-8 grid place-items-center rounded-[var(--tf-radius)] cursor-pointer transition-colors ${
                dense
                  ? 'bg-[var(--tf-primary)] text-[var(--tf-on-primary)] shadow-sm'
                  : 'text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]'
              }`}
              style={dense ? undefined : { border: '0.5px solid var(--tf-border-hover)' }}
            >
              <Rows3 size={15} />
            </button>
            {/* Lanes/Kartenspalten/Farben — nur relevant, solange das Board sichtbar
                ist (analog zum Status-Select, das nur die Liste zeigt). */}
            {viewMode === 'board' && (
              <FeedbackKanbanEinstellungen config={kanbanConfig} onChange={changeKanbanConfig} />
            )}
          </div>
        </div>

        {/* Typ-Filter-Chips (links) + Status-Filter (rechts, nur Liste) */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
          <div className="min-w-0 flex-1">
            <FeedbackTypeChips items={typeChips} activeKey={filterKategorie} onChange={k => setFilterKategorie(k as FeedbackCategory | '')} />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Aufräum-Sicht der Verwalter — Archivierte sind sonst überall aus. */}
            {darfVerwalten && (
              <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={zeigeArchiv}
                  onChange={e => changeZeigeArchiv(e.target.checked)}
                  className="cursor-pointer accent-[var(--tf-primary)]"
                />
                Archivierte einblenden
              </label>
            )}
            {viewMode !== 'board' && (
              <FeedbackStatusSelect value={statusFilter} onChange={setStatusFilter} />
            )}
          </div>
        </div>

        {/* Dein Fortschritt (nur eigene Sicht) */}
        {scope === 'mir' && ownItems.length > 0 && (
          <div className="mb-3">
            <MyProgressBar items={ownItems} unread={unread} />
          </div>
        )}
      </div>

      {/* Inhalt: Master-Detail-Split */}
      <MasterDetailLayout
        listWidthKey="teamflow_feedback_board_narrow_width"
        onCloseDetail={() => setSelectedId(undefined)}
        detail={selectedTicket ? (
          <FeedbackBoardDetail
            key={selectedTicket.id}
            ticket={selectedTicket}
            config={config}
            onClose={() => setSelectedId(undefined)}
            onChanged={handleChanged}
            meId={meId}
            meName={meName ?? undefined}
            unread={isUnread(selectedTicket)}
            neueKommentare={neuFuer(selectedTicket)}
            markSeen={markSeen}
            darfVerwalten={darfVerwalten}
          />
        ) : undefined}
        list={(
          <div className={selectedTicket ? 'px-2 py-2' : 'px-8 py-2'}>
            {listContent(!!selectedTicket)}
          </div>
        )}
      />

      {/* Verwaltung: die vier Aufgaben ohne Ticket-Bezug. `tickets` (nicht `base`)
          — FAQ + Sponsoring brauchen auch die archivierten. */}
      {darfVerwalten && (
        <FeedbackVerwaltungDialog
          open={verwaltungOffen}
          onClose={() => setVerwaltungOffen(false)}
          tickets={tickets}
          config={config}
          onChanged={handleChanged}
        />
      )}
    </div>
  );
}
