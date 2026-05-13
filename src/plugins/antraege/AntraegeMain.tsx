import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode, getEffectiveViewMode } from './store';
import { useFilterState } from './filter/useFilterState';
import { ActiveFilterChips } from './filter/ActiveFilterChips';
import { BearbeiterFilterPill } from './filter/BearbeiterFilterPill';
import { AntragGroupCard } from './AntragGroupCard';
import { NetzwerkClusterCard } from './NetzwerkClusterCard';
import { buildAntragGroups, type GroupingMode } from './antragGroups';
import { useFilteredAntraege } from './useFilteredAntraege';
import { SortDropdown } from './SortDropdown';
import { GroupingDropdown } from './GroupingDropdown';
import { sortDisablesGrouping } from './sort';
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

  // Karten-View nutzt die volle Browserbreite, damit auf breiten Monitoren
  // alle Anträge mit wenig Scrollen sichtbar sind. List/Kompakt behalten
  // max-w-6xl als Lesbarkeits-Cap (Zeilen werden sonst unangenehm lang).
  const innerClass = narrow
    ? 'px-4 pt-3 pb-4'
    : viewMode === 'cards'
      ? 'px-8 pt-3 pb-6'
      : 'px-8 pt-3 pb-6 max-w-6xl';

  return (
    <div className={containerClass} style={containerStyle}>
      <div className="flex-1 min-w-0 h-full overflow-y-auto">
        <div className={innerClass}>
          {/* Sort-Dropdown + Profil-Pill links, ActiveFilterChips rechts.
              Profil-Pill direkt neben SortDropdown, weil sie wie Sort eine
              persistente Voreinstellung repräsentiert (nicht inline änderbar). */}
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <SortDropdown />
              <GroupingDropdown />
              {bearbeiterFilter.active ? (
                <BearbeiterFilterPill tokens={bearbeiterFilter.tokens} />
              ) : null}
            </div>
            {active.length > 0 ? (
              <div className="flex-1 min-w-0 flex justify-end">
                <ActiveFilterChips active={active} definitions={definitions} onRemove={clearFilter} />
              </div>
            ) : null}
          </div>

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
  // Antragsteller-Sort überschreibt die User-Wahl: gleicher Antragsteller
  // soll direkt nebeneinander stehen, nicht durch Cluster-Header zerrissen.
  const effectiveMode: GroupingMode = sortDisablesGrouping(sortKey) ? 'none' : userGroupingMode;
  const groups = useMemo(
    () => buildAntragGroups(filtered.slice(0, visibleRows), { mode: effectiveMode, netzwerkNames }),
    [filtered, visibleRows, effectiveMode, netzwerkNames],
  );
  return (
    <div className="flex flex-col gap-1">
      {groups.map(g => {
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
      })}
      {visibleRows < filtered.length ? (
        <div ref={sentinelRef} className="py-4 text-center text-[11.5px] text-[var(--tf-text-tertiary)]">
          Lade weitere Einträge …
        </div>
      ) : null}
    </div>
  );
}
