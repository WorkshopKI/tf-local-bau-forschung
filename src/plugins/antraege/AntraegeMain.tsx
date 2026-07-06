import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode, getEffectiveViewMode, getEffectiveTableGroupingMode } from './store';
import { useFilterState } from './filter/useFilterState';
import { ActiveFilterChips } from './filter/ActiveFilterChips';
import { QuickfilterToolbar } from './filter/QuickfilterToolbar';
import { GruppierenDropdown } from './filter/GruppierenDropdown';
import { getPhaseFromActive, STATUS_FILTER_ID } from './filter/phaseQuickfilter';
import { getKategorieFromActive, KATEGORIE_FILTER_ID } from './filter/kategorieQuickfilter';
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
import { sortDisablesGrouping, GROUPING_OPTIONS } from './sort';
import { TABLE_GROUPING_OPTIONS, type TableGroupingMode } from './tableGrouping';
import { StatusSectionHeader } from './StatusSectionHeader';
import { useStatusSectionCollapsed } from './useStatusSectionCollapsed';
import { AntraegeTable } from './AntraegeTable';
import { CardGrid } from './CardGrid';
import { ColumnPicker } from '@/components/data-table';
import { ANTRAG_TABLE_COLUMNS, MA_COLUMN_KEY } from './tableColumns';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import type { ViewMode } from './viewModes';
import { isAuslastungEnabled } from '@/config/feature-flags';
import { Alert } from '@/components/ui/alert';
import { AlertTriangle, Settings, PanelLeftClose } from 'lucide-react';
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
/** Detail-Panel hat eine harte Mindestbreite — daraus ergibt sich das
 *  dynamische obere Cap fuer die Liste (`viewport - DETAIL_MIN`). */
const DETAIL_MIN = 300;

interface Props {
  /** Wenn ein Detail-Panel offen ist, schrumpft die Liste auf eine
   *  resizable Sidebar. Header ist bereits außerhalb (in AntraegePage). */
  narrow?: boolean;
  /** Im Detail-Modus gesetzt: blendet einen Chevron-Button zum Einklappen
   *  der Liste in die Toolbar-Zeile ein. AntraegePage zeigt dann die
   *  „Anträge einblenden"-Leiste. */
  onCollapse?: () => void;
}

function loadNarrowWidth(): number {
  try {
    const v = Number(localStorage.getItem(NARROW_WIDTH_KEY));
    if (Number.isFinite(v) && v >= NARROW_MIN) return v;
  } catch { /* ignore */ }
  return NARROW_DEFAULT_WIDTH;
}

export function AntraegeMain({ narrow = false, onCollapse }: Props): React.ReactElement {
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
  const activeView = useAntraegeStore(s => s.activeView);
  const viewMode = useAntraegeStore(s => getEffectiveViewMode(s.activeView, s.viewModeByTab));
  const tableGrouping = useAntraegeStore(s => getEffectiveTableGroupingMode(s.activeView, s.tableGroupingByView));
  const listGrouping = useAntraegeStore(s => getEffectiveGroupingMode(s.activeView, s.groupingByView));
  const setGroupingForView = useAntraegeStore(s => s.setGroupingForView);
  const setTableGroupingForView = useAntraegeStore(s => s.setTableGroupingForView);
  // Spalten-Picker (nur Tabellen-Ansicht) sitzt in der Toolbar-Zeile rechts —
  // teilt den State reaktiv mit der Tabelle über den globalen Store.
  const visibleColumns = useAntraegeColumnsStore(s => s.visibleColumns);
  const toggleColumn = useAntraegeColumnsStore(s => s.toggleColumn);
  const openAntrag = (az: string): void => navigate(`/antraege/${encodeURIComponent(az)}`);
  const openVerbund = (id: string): void => navigate(`/antraege/verbund/${encodeURIComponent(id)}`);
  const { definitions, active, clearFilter, init } = useFilterState();
  const { filtered, bearbeiterFilter, bearbeiterKuerzelMissing } = useFilteredAntraege();
  // Im „alle"-/Übersichtsmodus (pl/dev) wird je Antrag das MA-Kürzel angezeigt,
  // damit sichtbar ist, welcher Bearbeiter zuständig ist.
  const showMa = isAuslastungEnabled() && !bearbeiterFilter.active;
  // MA-Spalte (TIB-Kürzel) ist regulär im Picker wählbar — AUSSER im „alle"-/
  // Übersichtsmodus, wo sie ohnehin erzwungen wird (showMa): dort raus aus dem
  // Picker, damit keine wirkungslose Checkbox erscheint. In „meine Anträge"
  // bleibt sie wählbar (Use-Case: „auch außerhalb meiner Anträge suchen").
  const pickerColumns = useMemo(
    () => (showMa ? ANTRAG_TABLE_COLUMNS.filter(c => c.key !== MA_COLUMN_KEY) : ANTRAG_TABLE_COLUMNS),
    [showMa],
  );
  const [visibleRows, setVisibleRows] = useState(() => pageSizeForMode(viewMode));
  // Tabellen-Ansicht meldet ihre spaltengefilterte TV-Anzahl hierher; List/
  // Karten haben keine Spaltenfilter und nutzen direkt `filtered.length`.
  const [tableFilteredCount, setTableFilteredCount] = useState<number | null>(null);
  const [narrowWidth, setNarrowWidth] = useState(loadNarrowWidth);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Liste cappt dynamisch gegen Viewport - DETAIL_MIN, damit das
  // Detail-Panel immer mindestens DETAIL_MIN Pixel breit bleibt.
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );
  useEffect(() => {
    const handler = (): void => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const effectiveNarrowWidth = Math.min(
    narrowWidth,
    Math.max(NARROW_MIN, viewportWidth - DETAIL_MIN),
  );

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
      const dynMax = Math.max(NARROW_MIN, window.innerWidth - DETAIL_MIN);
      const next = Math.min(dynMax, Math.max(NARROW_MIN, drag.startWidth + delta));
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
    ? { width: effectiveNarrowWidth, flexShrink: 0, position: 'relative' }
    : {};
  const containerClass = narrow
    ? 'h-full flex'
    : 'flex-1 min-w-0 h-full flex';

  // Toolbar teilt dieselbe Content-Box wie die Liste/Tabelle, damit das
  // rechtsbündige „Spalten"-Dropdown (Compact) mit dem Tabellen-Rand fluchtet.
  // Nur die List-View trägt den max-w-6xl-Lesbarkeits-Cap; Tabelle (Compact)
  // + Cards nutzen die volle Breite → Toolbar-Box muss denselben Cap-Zustand
  // wie der Content darunter haben. narrow px-4.
  const toolbarClass = narrow
    ? 'px-4 pt-3'
    : viewMode === 'list'
      ? 'px-8 pt-3 max-w-6xl'
      : 'px-8 pt-3';
  // Karten- UND Tabellen-View nutzen die volle Browserbreite, damit auf breiten
  // Monitoren alle Spalten/Anträge mit wenig Scrollen sichtbar sind. Nur die
  // List-View behält max-w-6xl als Lesbarkeits-Cap für die Listen-Zeilen
  // (Text-Zeilen werden sonst unangenehm lang).
  const contentClass = narrow
    ? 'px-4 pb-4'
    : viewMode === 'list'
      ? 'px-8 pb-6 max-w-6xl'
      : 'px-8 pb-6';

  // Trefferzahl nach Filterung — immer auf TV-Ebene. In der Tabellen-Ansicht
  // zählt der spaltengefilterte Wert (Fallback `filtered.length` für das eine
  // Frame nach (Re-)Mount, bevor die Tabelle ihren ersten Wert meldet); in
  // List/Karten gibt es keine Spaltenfilter → `filtered.length`.
  const displayCount = viewMode === 'compact'
    ? (tableFilteredCount ?? filtered.length)
    : filtered.length;

  // Quickfilter-Segmente (Status/Antragstyp/PreCheck) haben ihre eigene Pille und
  // erzeugen KEINEN Chip. Ein aktiver system-status/system-vb-phase-Filter wird
  // nur dann als Chip gezeigt, wenn ihn KEINE Quickfilter-Pille „absorbiert" (z.B.
  // eine über die Sidebar gesetzte, nicht-Bucket-konforme Status-Kombination).
  // PreCheck lebt außerhalb von `active` → nie ein Chip.
  const chipActive = useMemo(() => {
    const phaseAbsorbed = getPhaseFromActive(active) !== 'Alle';
    const kategorieAbsorbed = getKategorieFromActive(active) !== 'Alle';
    return active.filter(af => {
      if (af.filterId === STATUS_FILTER_ID && phaseAbsorbed) return false;
      if (af.filterId === KATEGORIE_FILTER_ID && kategorieAbsorbed) return false;
      return true;
    });
  }, [active]);

  return (
    <div className={containerClass} style={containerStyle}>
      <div className="flex-1 min-w-0 h-full overflow-y-auto">
        {/* Zeile A: Quickfilter-Akkordeon (Status/Antragstyp/PreCheck/Sort) links,
            Gruppierung + (nur Tabelle) Spalten-Picker rechts. Zeile B darunter:
            aktive Sidebar-Filter-Chips links, Trefferzähler rechts. Toolbar in
            eigenem Container ohne max-w-*, damit die volle Viewport-Breite genutzt
            wird. Bearbeiter-Pill sitzt im Header neben dem Titel. */}
        <div className={toolbarClass}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              {onCollapse && (
                <button
                  type="button"
                  onClick={onCollapse}
                  aria-label="Liste einklappen"
                  title="Liste einklappen"
                  className="shrink-0 -ml-1 p-1 rounded-[6px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)] transition-colors cursor-pointer"
                >
                  <PanelLeftClose size={16} />
                </button>
              )}
              <QuickfilterToolbar />
            </div>
            <div className="shrink-0 flex items-center justify-end gap-2 flex-wrap">
              <GruppierenDropdown
                options={viewMode === 'compact' ? TABLE_GROUPING_OPTIONS : GROUPING_OPTIONS}
                value={viewMode === 'compact' ? tableGrouping : listGrouping}
                onChange={(key) => {
                  if (viewMode === 'compact') setTableGroupingForView(activeView, key as TableGroupingMode);
                  else setGroupingForView(activeView, key as GroupingMode);
                }}
              />
              {viewMode === 'compact' ? (
                <ColumnPicker
                  columns={pickerColumns}
                  visibleKeys={visibleColumns}
                  onToggleColumn={toggleColumn}
                />
              ) : null}
            </div>
          </div>
          {(chipActive.length > 0 || displayCount > 0) ? (
            <div className="mt-2 mb-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                {chipActive.length > 0 ? (
                  <ActiveFilterChips
                    active={chipActive}
                    definitions={definitions}
                    onRemove={clearFilter}
                    className="flex flex-wrap gap-1.5"
                  />
                ) : null}
              </div>
              {displayCount > 0 ? (
                <span
                  className="shrink-0 text-[12px] text-[var(--tf-text-tertiary)] tabular-nums whitespace-nowrap"
                  title="Anzahl Teilvorhaben nach Filterung"
                >
                  {displayCount.toLocaleString('de-DE')} {displayCount === 1 ? 'Antrag' : 'Anträge'}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mb-3" />
          )}
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
            <AntraegeTable
              filtered={filtered}
              visibleRows={visibleRows}
              selectedAktenzeichen={selectedAktenzeichen}
              selectedVerbundId={selectedVerbundId}
              grouping={tableGrouping}
              showMaColumn={showMa}
              onOpenAntrag={openAntrag}
              onOpenVerbund={openVerbund}
              sentinelRef={sentinelRef}
              onFilteredCountChange={setTableFilteredCount}
            />
          ) : viewMode === 'cards' ? (
            <CardGrid
              filtered={filtered}
              visibleRows={visibleRows}
              selectedAktenzeichen={selectedAktenzeichen}
              selectedVerbundId={selectedVerbundId}
              showMa={showMa}
              onOpenAntrag={openAntrag}
              onOpenVerbund={openVerbund}
              sentinelRef={sentinelRef}
            />
          ) : (
            <GroupedList
              filtered={filtered}
              visibleRows={visibleRows}
              selectedAktenzeichen={selectedAktenzeichen}
              showMa={showMa}
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
  /** „alle"-Modus → MA-Kürzel je TV-Zeile anzeigen. */
  showMa: boolean;
  onOpenAntrag: (az: string) => void;
  onOpenVerbund: (id: string) => void;
  narrow: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

function GroupedList({
  filtered,
  visibleRows,
  selectedAktenzeichen,
  showMa,
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
          showMa={showMa}
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
        showMa={showMa}
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

