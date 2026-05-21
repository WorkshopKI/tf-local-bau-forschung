import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode, getEffectiveViewMode } from './store';
import { useFilterState } from './filter/useFilterState';
import { ActiveFilterChips } from './filter/ActiveFilterChips';
import { BearbeiterFilterPill } from './filter/BearbeiterFilterPill';
import { QuickfilterToolbar } from './filter/QuickfilterToolbar';
import { AntragGroupCard } from './AntragGroupCard';
import { NetzwerkClusterCard } from './NetzwerkClusterCard';
import {
  buildAntragGroups,
  takeGroupsUntil,
  splitByStatusPhase,
  type AntragGroup,
  type GroupingMode,
} from './antragGroups';
import { useFilteredAntraege } from './useFilteredAntraege';
import { sortDisablesGrouping } from './sort';
import { StatusSectionHeader } from './StatusSectionHeader';
import { useStatusSectionCollapsed } from './useStatusSectionCollapsed';
import { CompactList } from './CompactList';
import { CardGrid } from './CardGrid';
import type { ViewMode } from './viewModes';
import { Alert } from '@/components/ui/alert';
import { AlertTriangle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

const ROW_PAGE = 60;
/** Card-View nutzt eine höhere Page-Size — Tiles sind kompakter, mehr passt
 *  in einen Scroll-Frame, und der Render-Cost pro Tile ist niedrig. */
const CARD_PAGE = 200;

function pageSizeForMode(mode: ViewMode): number {
  return mode === 'cards' ? CARD_PAGE : ROW_PAGE;
}
const NARROW_WIDTH_KEY = 'teamflow_antraege_narrow_width';
const NARROW_DEFAULT_WIDTH = 460;
const NARROW_MIN = 320;
const NARROW_MAX = 720;

interface Props {
  /** Wenn ein Detail-Panel offen ist, schrumpft die Liste auf eine
   *  resizable Sidebar. Header ist bereits außerhalb (in AntraegePage). */
  narrow?: boolean;
}

function loadNarrowWidth(): number {
  try {
    const v = Number(localStorage.getItem(NARROW_WIDTH_KEY));
    if (Number.isFinite(v) && v >= NARROW_MIN && v <= NARROW_MAX) return v;
  } catch { /* ignore */ }
  return NARROW_DEFAULT_WIDTH;
}

export function AntraegeMain({ narrow = false }: Props): React.ReactElement {
  const storage = useStorage();
  const navigate = useNavigate();
  const {
    antraege,
    loading,
    programmId,
    selectedAktenzeichen,
    selectedVerbundId,
    loadAll,
  } = useAntraegeStore();
  const viewMode = useAntraegeStore(s => getEffectiveViewMode(s.activeView, s.viewModeByTab));
  const openAntrag = (az: string): void => navigate(`/antraege/${encodeURIComponent(az)}`);
  const openVerbund = (id: string): void => navigate(`/antraege/verbund/${encodeURIComponent(id)}`);
  const { definitions, active, clearFilter, init } = useFilterState();
  const { filtered, bearbeiterFilter, bearbeiterKuerzelMissing } = useFilteredAntraege();
  const [visibleRows, setVisibleRows] = useState(() => pageSizeForMode(viewMode));
  const [narrowWidth, setNarrowWidth] = useState(loadNarrowWidth);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  useEffect(() => {
    void loadAll(storage.idb, activeProgrammId ?? undefined);
  }, [loadAll, storage.idb, activeProgrammId]);

  useEffect(() => {
    if (programmId) void init(storage.idb, programmId);
  }, [programmId, storage.idb, init]);

  useEffect(() => {
    setVisibleRows(pageSizeForMode(viewMode));
  }, [filtered.length, programmId, viewMode]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (visibleRows >= filtered.length) return;
    const step = pageSizeForMode(viewMode);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleRows((v) => v + step);
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered.length, visibleRows, viewMode]);

  // Resize-Drag in Narrow-Mode.
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    dragRef.current = { startX: e.clientX, startWidth: narrowWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = ev.clientX - drag.startX;
      const next = Math.min(NARROW_MAX, Math.max(NARROW_MIN, drag.startWidth + delta));
      setNarrowWidth(next);
    };
    const onUp = (): void => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [narrowWidth]);

  useEffect(() => {
    try { localStorage.setItem(NARROW_WIDTH_KEY, String(narrowWidth)); } catch { /* ignore */ }
  }, [narrowWidth]);

  const containerStyle: React.CSSProperties = narrow
    ? { width: narrowWidth, flexShrink: 0, position: 'relative' }
    : {};
  const containerClass = narrow
    ? 'h-full flex'
    : 'flex-1 min-w-0 h-full flex';

  // Toolbar nutzt volle Viewport-Breite — sonst wraped `Gruppiert:` bei
  // aufgeklapptem Antragstyp obwohl rechts Platz waere.
  const toolbarClass = narrow ? 'px-4 pt-3' : 'px-8 pt-3';
  // Karten-View nutzt die volle Browserbreite, damit auf breiten Monitoren
  // alle Anträge mit wenig Scrollen sichtbar sind. List/Kompakt behalten
  // max-w-6xl als Lesbarkeits-Cap fuer die Listen-Zeilen (Zeilen werden
  // sonst unangenehm lang).
  const contentClass = narrow
    ? 'px-4 pb-4'
    : viewMode === 'cards'
      ? 'px-8 pb-6'
      : 'px-8 pb-6 max-w-6xl';

  return (
    <div className={containerClass} style={containerStyle}>
      <div className="flex-1 min-w-0 h-full overflow-y-auto">
        {/* QuickfilterToolbar (Phase / Kategorie / Antragsdatum + Extra-Sort
            + Gruppieren) links, Bearbeiter-Pill + ActiveFilterChips rechts.
            Toolbar in eigenem Container ohne max-w-*, damit die volle
            Viewport-Breite genutzt wird (Gruppiert: bricht sonst um). Liste
            darunter behaelt den Lesbarkeits-Cap. */}
        <div className={toolbarClass}>
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <QuickfilterToolbar />
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-end gap-3 flex-wrap">
              {bearbeiterFilter.active ? (
                <BearbeiterFilterPill
                  tokens={bearbeiterFilter.tokens}
                  includeBegleitung={bearbeiterFilter.includeBegleitung}
                />
              ) : null}
              {active.length > 0 ? (
                <ActiveFilterChips active={active} definitions={definitions} onRemove={clearFilter} />
              ) : null}
            </div>
          </div>
        </div>
        <div className={contentClass}>
          {bearbeiterKuerzelMissing && antraege.length > 0 ? (
            <Alert variant="warning" className="mb-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  Bearbeiter-Filter aktiv ({bearbeiterFilter.tokens.join(', ')}), aber die Bearbeiter-Spalten
                  {' '}<span className="font-mono">TiB_KUERZ</span> / <span className="font-mono">BIB_KUERZ</span>
                  {bearbeiterFilter.includeBegleitung ? <> / <span className="font-mono">ZTP_KUERZ</span> / <span className="font-mono">PFM_KUERZ</span></> : null}
                  {' '}sind in keiner der aktiven CSV-Quellen vorhanden.
                </p>
                <p className="mt-1 text-[12px] opacity-90">
                  Deshalb sehen Sie keine Treffer. Lösungen: Kürzel-Filter im Profil deaktivieren (Wert <span className="font-mono">alle</span> eintragen
                  oder leeren) oder eine CSV-Quelle mit den KUERZ-Spalten registrieren bzw. das Mapping ergänzen.
                </p>
                <div className="mt-1.5 flex items-center gap-3 text-[11.5px]">
                  <Link
                    to="/einstellungen"
                    className="inline-flex items-center gap-1 underline hover:no-underline"
                  >
                    <Settings size={12} /> Profil bearbeiten
                  </Link>
                </div>
              </div>
            </Alert>
          ) : null}

          {antraege.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">
              {loading
                ? 'Lade …'
                : 'Noch keine Anträge. Erst CSV-Source registrieren und importieren (Kuration → CSV-Quellen).'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">
              Keine Anträge matchen die aktuellen Filter.
            </div>
          ) : viewMode === 'compact' ? (
            <CompactList
              filtered={filtered}
              visibleRows={visibleRows}
              selectedAktenzeichen={selectedAktenzeichen}
              onOpenAntrag={openAntrag}
              sentinelRef={sentinelRef}
            />
          ) : viewMode === 'cards' ? (
            <CardGrid
              filtered={filtered}
              visibleRows={visibleRows}
              selectedAktenzeichen={selectedAktenzeichen}
              selectedVerbundId={selectedVerbundId}
              onOpenAntrag={openAntrag}
              onOpenVerbund={openVerbund}
              sentinelRef={sentinelRef}
            />
          ) : (
            <GroupedList
              filtered={filtered}
              visibleRows={visibleRows}
              selectedAktenzeichen={selectedAktenzeichen}
              onOpenAntrag={openAntrag}
              onOpenVerbund={openVerbund}
              narrow={narrow}
              sentinelRef={sentinelRef}
            />
          )}
        </div>
      </div>

      {/* Resize-Handle am rechten Rand der Liste im Narrow-Mode. */}
      {narrow && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Listenbreite ändern"
          onMouseDown={onResizeMouseDown}
          className="shrink-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--tf-border-hover)] transition-colors"
          style={{ borderLeft: '0.5px solid var(--tf-border)' }}
        />
      )}
    </div>
  );
}

interface GroupedListProps {
  filtered: import('@/core/services/csv/types').AntragListItem[];
  visibleRows: number;
  selectedAktenzeichen: string | null;
  onOpenAntrag: (az: string) => void;
  onOpenVerbund: (id: string) => void;
  narrow: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

function GroupedList({
  filtered,
  visibleRows,
  selectedAktenzeichen,
  onOpenAntrag,
  onOpenVerbund,
  narrow,
  sentinelRef,
}: GroupedListProps): React.ReactElement {
  const sortKey = useAntraegeStore(s => getEffectiveSortKey(s.activeView, s.sortByView));
  const userGroupingMode = useAntraegeStore(s => getEffectiveGroupingMode(s.activeView, s.groupingByView));
  const netzwerkNames = useAntraegeStore(s => s.netzwerkNameById);
  const verbundById = useAntraegeStore(s => s.verbundById);
  // Antragsteller-Sort überschreibt die User-Wahl: gleicher Antragsteller
  // soll direkt nebeneinander stehen, nicht durch Cluster-Header zerrissen.
  const effectiveMode: GroupingMode = sortDisablesGrouping(sortKey) ? 'none' : userGroupingMode;
  // Clustering läuft auf der vollen `filtered`-Liste — sonst zerschneidet
  // die Pagination Netzwerke/Verbünde, deren TVs im Sort-Order über die
  // `visibleRows`-Grenze gestreut sind. Pagination greift erst beim
  // `takeGroupsUntil` an Cluster-Grenzen (Overshoot bei sehr großen
  // Clustern akzeptiert — bevorzugt komplette Cluster über exakte TV-Zahl).
  const allGroups = useMemo(
    () => buildAntragGroups(filtered, { mode: effectiveMode, netzwerkNames, verbundById }),
    [filtered, effectiveMode, netzwerkNames, verbundById],
  );
  const groups = useMemo(() => takeGroupsUntil(allGroups, visibleRows), [allGroups, visibleRows]);
  const hasMoreGroups = groups.length < allGroups.length;
  const collapsedSet = useStatusSectionCollapsed(s => s.collapsed);

  const renderGroup = (g: AntragGroup): React.ReactElement => {
    const isNetzwerkSuper = g.netzwerkId !== null && (g.subGroups?.length ?? 0) > 0;
    if (isNetzwerkSuper) {
      return (
        <NetzwerkClusterCard
          key={g.tvs[0]!.aktenzeichen}
          group={g}
          selectedAktenzeichen={selectedAktenzeichen}
          onOpenAntrag={onOpenAntrag}
          onOpenVerbund={onOpenVerbund}
          narrow={narrow}
        />
      );
    }
    return (
      <AntragGroupCard
        key={g.tvs[0]!.aktenzeichen}
        group={g}
        selectedAktenzeichen={selectedAktenzeichen}
        onOpenAntrag={onOpenAntrag}
        onOpenVerbund={onOpenVerbund}
        narrow={narrow}
      />
    );
  };

  return (
    <div className="flex flex-col">
      {effectiveMode === 'status' ? (
        <div className="flex flex-col gap-3">
          {splitByStatusPhase(groups).map(section => (
            <div key={section.label}>
              <StatusSectionHeader label={section.label} count={section.groups.length} />
              {collapsedSet.has(section.label) ? null : (
                <div className="flex flex-col gap-1">
                  {section.groups.map(renderGroup)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map(renderGroup)}
        </div>
      )}
      {hasMoreGroups ? (
        <div ref={sentinelRef} className="py-4 text-center text-[11.5px] text-[var(--tf-text-tertiary)]">
          Lade weitere Einträge …
        </div>
      ) : null}
    </div>
  );
}

