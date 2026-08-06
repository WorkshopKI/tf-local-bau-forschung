import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveGroupingMode, getEffectiveViewMode, getEffectiveTableGroupingMode, getEffectiveTableAnsicht } from './store';
import { useFilterState } from './filter/useFilterState';
import { ActiveFilterChips } from './filter/ActiveFilterChips';
import { FilterChip } from '@/components/ui/FilterChip';
import { AMPEL_BUCKET_LABEL } from './eingangAmpel';
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
  statusSectionIdOf,
  zaehleJeAbschnitt,
  type AntragGroup,
  type GroupingMode,
} from './antragGroups';
import { useFilteredAntraege } from './useFilteredAntraege';
import { sortDisablesGrouping, GROUPING_OPTIONS } from './sort';
import {
  TABLE_GROUPING_OPTIONS,
  TABLE_ANSICHT_OPTIONS,
  type TableGroupingMode,
  type TabellenAnsicht,
} from './tableGrouping';
import { StatusSectionHeader } from './StatusSectionHeader';
import { useStatusSectionCollapsed } from './useStatusSectionCollapsed';
import { ArbeitsvorratSectionHeader } from './ArbeitsvorratSectionHeader';
import { useBeendetSichtbarkeit } from './useBeendetSichtbarkeit';
import {
  hatBeendetAchse,
  istBeendetVersteckt,
  arbeitsvorratSectionOf,
  archivAufschluesselung,
  formatArchivAufschluesselung,
  ARBEITSVORRAT_LABEL,
  BEENDET_OPTIONS,
} from './arbeitsvorrat';
import { AntraegeTable } from './AntraegeTable';
import { CardGrid } from './CardGrid';
import { KompaktListe } from './KompaktListe';
import { getView } from './views';
import {
  berechneTrefferZahl,
  formatTrefferZahl,
  trefferZahlTitel,
  type ZeilenMeldung,
} from './trefferZahl';
import { ColumnPicker } from '@/components/data-table';
import {
  ANTRAG_TABLE_COLUMNS,
  MA_COLUMN_KEY,
  kategorieStatusColumns,
  spaltenHinweis,
} from './tableColumns';
import { useKategorieSpalten } from './useKategorieSpalten';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import type { ViewMode } from './viewModes';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { Alert } from '@/components/ui/alert';
import { AlertTriangle, Settings, PanelLeftClose, Rows3, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';

const ROW_PAGE = 60;
/** Card-View nutzt eine höhere Page-Size — Tiles sind kompakter, mehr passt
 *  in einen Scroll-Frame, und der Render-Cost pro Tile ist niedrig. */
const CARD_PAGE = 200;

function pageSizeForMode(mode: ViewMode): number {
  return mode === 'cards' ? CARD_PAGE : ROW_PAGE;
}
/** Feste Breite der Kompakt-Liste im Detail-Split (Journey-Paket 2 Phase 8).
 *  Ersetzt das frühere resizable Schmaler-Werden der Voll-Tabelle — im
 *  Detail-Modus rendert eine dedizierte Kompakt-Spalte (`KompaktListe`). */
const KOMPAKT_WIDTH = 232;

interface Props {
  /** Wenn ein Detail-Panel offen ist, schrumpft die Liste auf die schmale
   *  Kompakt-Spalte (`KompaktListe`). Header ist bereits außerhalb (AntraegePage). */
  narrow?: boolean;
  /** Im Detail-Modus gesetzt: Icon zum Einklappen der Liste in die
   *  „Anträge einblenden"-Leiste (AntraegePage rendert die Leiste). */
  onCollapse?: () => void;
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
  const tableAnsicht = useAntraegeStore(s => getEffectiveTableAnsicht(s.activeView, s.tableAnsichtByView));
  const setGroupingForView = useAntraegeStore(s => s.setGroupingForView);
  const setTableGroupingForView = useAntraegeStore(s => s.setTableGroupingForView);
  const setTableAnsichtForView = useAntraegeStore(s => s.setTableAnsichtForView);
  // Achse „Beendet" — eigener Schalter statt Kopplung an „Gruppierung: Keine".
  const beendetAusgeblendet = useBeendetSichtbarkeit(s => s.ausgeblendet);
  const setBeendetAusgeblendet = useBeendetSichtbarkeit(s => s.setAusgeblendet);
  // Spalten-Picker (nur Tabellen-Ansicht) sitzt in der Toolbar-Zeile rechts —
  // teilt den State reaktiv mit der Tabelle über den globalen Store.
  const visibleColumns = useAntraegeColumnsStore(s => s.visibleColumns);
  const toggleColumn = useAntraegeColumnsStore(s => s.toggleColumn);
  const setVisibleColumns = useAntraegeColumnsStore(s => s.setVisibleColumns);
  const openAntrag = (az: string): void => navigate(`/antraege/${encodeURIComponent(az)}`);
  const openVerbund = (id: string): void => navigate(`/antraege/verbund/${encodeURIComponent(id)}`);
  const { definitions, active, clearFilter, init } = useFilterState();
  const { filtered, bearbeiterFilter, bearbeiterKuerzelMissing } = useFilteredAntraege();
  // Ampel-Quickfilter (v2.229): sichtbarer, entfernbarer Chip — sonst filtert
  // der Widget-Klick unsichtbar weiter.
  const ampelQuickfilter = useAntraegeStore(s => s.ampelQuickfilter);
  const setAmpelQuickfilter = useAntraegeStore(s => s.setAmpelQuickfilter);
  // Im „alle"-/Übersichtsmodus (pl/dev) wird je Antrag das MA-Kürzel angezeigt,
  // damit sichtbar ist, welcher Bearbeiter zuständig ist.
  const showMa = isAuslastungFreigeschaltet() && !bearbeiterFilter.active;
  // MA-Spalte (TIB-Kürzel) ist regulär im Picker wählbar. Im „alle"-/
  // Übersichtsmodus wird sie ohnehin erzwungen (showMa) — dort stand sie bis
  // v3.5 gar nicht im Picker, „damit keine wirkungslose Checkbox erscheint".
  // Mit dem Spalten-Zähler wurde daraus ein Widerspruch: die Tabelle zeigte eine
  // Spalte mehr, als der Picker kannte. Jetzt steht sie drin, angehakt und
  // deaktiviert mit der Marke „auto" — der Einwand (keine wirkungslose
  // ANKLICKBARE Checkbox) bleibt gewahrt, der Zähler stimmt wieder.
  // Die kuratierten Ordner-Spalten stehen nicht in der Registry — sie folgen dem
  // Statuskatalog und kommen deshalb hier dazu.
  const kategorieSpalten = useKategorieSpalten();
  const pickerColumns = useMemo(
    () => [...ANTRAG_TABLE_COLUMNS, ...kategorieStatusColumns(kategorieSpalten)],
    [kategorieSpalten],
  );
  const erzwungeneSpalten = useMemo(() => (showMa ? [MA_COLUMN_KEY] : []), [showMa]);
  const [visibleRows, setVisibleRows] = useState(() => pageSizeForMode(viewMode));
  // Tabelle und gruppierte Liste melden hierher, was sie zeigen (TV-Anzahl nach
  // Spaltenfiltern + daraus entstandene Zeilen). Die Karten-Ansicht meldet
  // nichts — sie ist flach; `berechneTrefferZahl` verwirft dort die fremde
  // Meldung und zählt `filtered.length`.
  const [zeilenMeldung, setZeilenMeldung] = useState<ZeilenMeldung | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Scroll-Stand der Voll-Tabelle über den Detail-Split hinweg erhalten: im
  // Narrow-Modus rendert eine andere Teilbaum-Struktur (KompaktListe), der
  // Voll-Scroll-Container wird also aus- und wieder eingehängt. AntraegeMain
  // selbst bleibt gemountet → Ref überlebt, wir stellen den Stand nach dem
  // Zurückschalten wieder her.
  const wideScrollRef = useRef<HTMLDivElement | null>(null);
  const wideScrollTop = useRef(0);
  useLayoutEffect(() => {
    if (!narrow && wideScrollRef.current) {
      wideScrollRef.current.scrollTop = wideScrollTop.current;
    }
  }, [narrow]);

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

  const containerStyle: React.CSSProperties = narrow
    ? { width: KOMPAKT_WIDTH, flexShrink: 0, position: 'relative' }
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

  // Trefferzahl nach Filterung — Basis immer TV-Ebene, dazu die Zeilenzahl,
  // wenn eine Gruppierung verdichtet. Details + Guards in `trefferZahl.ts`.
  const treffer = berechneTrefferZahl(viewMode, filtered.length, zeilenMeldung);

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

  // Detail offen → schmale Kompakt-Spalte (Journey-Paket 2 Phase 8) statt der
  // schmaler skalierten Voll-Tabelle. Reihenfolge/Umfang bleiben die der
  // Vollansicht (`filtered`); Schließen des Details bringt die volle Tabelle
  // mit erhaltenem Scroll-Stand zurück (AntraegeMain bleibt gemountet).
  if (narrow) {
    return (
      <div className={containerClass} style={containerStyle}>
        <KompaktListe
          filtered={filtered}
          selectedAktenzeichen={selectedAktenzeichen}
          selectedVerbundId={selectedVerbundId}
          viewLabel={getView(activeView).label}
          onOpenAntrag={openAntrag}
          onOpenVerbund={openVerbund}
          onCollapse={onCollapse}
        />
      </div>
    );
  }

  return (
    <div className={containerClass} style={containerStyle}>
      <div
        ref={wideScrollRef}
        onScroll={e => { wideScrollTop.current = e.currentTarget.scrollTop; }}
        className="flex-1 min-w-0 h-full overflow-y-auto"
      >
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
              {/* Zeilen-Körnung — nur die Tabelle kennt diese Achse; Karten- und
                  Listen-Ansicht verdichten Verbünde nicht. */}
              {viewMode === 'compact' ? (
                <GruppierenDropdown
                  label="Ansicht:"
                  icon={Rows3}
                  options={TABLE_ANSICHT_OPTIONS}
                  value={tableAnsicht}
                  onChange={(key) => setTableAnsichtForView(activeView, key as TabellenAnsicht)}
                />
              ) : null}
              <GruppierenDropdown
                options={viewMode === 'compact' ? TABLE_GROUPING_OPTIONS : GROUPING_OPTIONS}
                value={viewMode === 'compact' ? tableGrouping : listGrouping}
                onChange={(key) => {
                  if (viewMode === 'compact') setTableGroupingForView(activeView, key as TableGroupingMode);
                  else setGroupingForView(activeView, key as GroupingMode);
                }}
              />
              {/* Sichtbarkeit der beendeten Anträge — unabhängig von Ansicht
                  und Gruppierung. Nur im „Alle"-Reiter (anderswo praktisch
                  nichts Terminales) und nicht in der Karten-Ansicht, die den
                  Split noch nie kannte. */}
              {hatBeendetAchse(activeView) && viewMode !== 'cards' ? (
                <GruppierenDropdown
                  label={`${ARBEITSVORRAT_LABEL.archiv}:`}
                  icon={Archive}
                  options={BEENDET_OPTIONS}
                  value={beendetAusgeblendet ? 'aus' : 'ein'}
                  onChange={(key) => setBeendetAusgeblendet(key === 'aus')}
                />
              ) : null}
              {viewMode === 'compact' ? (
                <ColumnPicker
                  columns={pickerColumns}
                  visibleKeys={visibleColumns}
                  onToggleColumn={toggleColumn}
                  onSetColumns={setVisibleColumns}
                  erzwungeneKeys={erzwungeneSpalten}
                  renderColumnExtra={c => {
                    const hinweis = spaltenHinweis(c.key);
                    return hinweis ? (
                      <span className="ml-auto pl-2 text-[10px] text-[var(--tf-text-tertiary)]">
                        {hinweis}
                      </span>
                    ) : null;
                  }}
                />
              ) : null}
            </div>
          </div>
          {(chipActive.length > 0 || ampelQuickfilter !== null || treffer.tv > 0) ? (
            <div className="mt-2 mb-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex items-center flex-wrap gap-1.5">
                {ampelQuickfilter !== null ? (
                  <FilterChip
                    label="Antragseingang"
                    value={`${AMPEL_BUCKET_LABEL[ampelQuickfilter.bucket]} (${
                      ampelQuickfilter.bucket === 'frisch'
                        ? `≤ ${ampelQuickfilter.schwellen.warnschwelleTage} T`
                        : ampelQuickfilter.bucket === 'warnung'
                          ? `${ampelQuickfilter.schwellen.warnschwelleTage + 1}–${ampelQuickfilter.schwellen.kritischSchwelleTage} T`
                          : `> ${ampelQuickfilter.schwellen.kritischSchwelleTage} T`
                    })`}
                    onRemove={() => setAmpelQuickfilter(null)}
                  />
                ) : null}
                {chipActive.length > 0 ? (
                  <ActiveFilterChips
                    active={chipActive}
                    definitions={definitions}
                    onRemove={clearFilter}
                    className="flex flex-wrap gap-1.5"
                  />
                ) : null}
              </div>
              {treffer.tv > 0 ? (
                <span
                  className="shrink-0 text-[12px] text-[var(--tf-text-tertiary)] tabular-nums whitespace-nowrap"
                  title={trefferZahlTitel(treffer)}
                >
                  {formatTrefferZahl(treffer)}
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
              ansicht={tableAnsicht}
              showMaColumn={showMa}
              onOpenAntrag={openAntrag}
              onOpenVerbund={openVerbund}
              sentinelRef={sentinelRef}
              onZeilenMeldung={setZeilenMeldung}
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
              onZeilenMeldung={setZeilenMeldung}
            />
          )}
        </div>
      </div>
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
  /** Meldet der Toolbar TV-Anzahl und die Karten, die daraus entstehen. */
  onZeilenMeldung?: (m: ZeilenMeldung) => void;
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
  onZeilenMeldung,
}: GroupedListProps): React.ReactElement {
  const sortKey = useAntraegeStore(s => getEffectiveSortKey(s.activeView, s.sortByView));
  const userGroupingMode = useAntraegeStore(s => getEffectiveGroupingMode(s.activeView, s.groupingByView));
  const netzwerkNames = useAntraegeStore(s => s.netzwerkNameById);
  const verbundById = useAntraegeStore(s => s.verbundById);
  const activeView = useAntraegeStore(s => s.activeView);
  const searchActive = useAntraegeStore(s => s.search.trim().length > 0);
  const beendetWunsch = useBeendetSichtbarkeit(s => s.ausgeblendet);
  const setBeendetAusgeblendet = useBeendetSichtbarkeit(s => s.setAusgeblendet);
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
  const collapsedSet = useStatusSectionCollapsed(s => s.collapsed);
  // Abschnitts-Zahlen über den VOLLEN Satz — aus den paginierten `groups`
  // gezogen wüchsen sie beim Nachladen und summierten sich zur Seitengröße.
  const abschnittsGesamt = useMemo(
    () => zaehleJeAbschnitt(allGroups, statusSectionIdOf),
    [allGroups],
  );

  // An die Toolbar melden, was hier steht. Jeder Modus außer `none` bündelt
  // Verbund-Cluster zu EINER Karte (auch `status` — siehe buildAntragGroups),
  // die Karten-Zahl liegt dann unter der TV-Zahl.
  useEffect(() => {
    onZeilenMeldung?.({
      quelle: 'list',
      tv: filtered.length,
      zeilen: effectiveMode === 'none' ? filtered.length : allGroups.length,
      art: effectiveMode === 'none' ? null : 'gruppe',
    });
  }, [filtered.length, allGroups.length, effectiveMode, onZeilenMeldung]);

  // Achse „Beendet": eigener Schalter, unabhängig von der Gruppierung — bis v3.5
  // hing die Trennung an „Gruppierung: Keine" und fiel damit still weg, sobald
  // gruppiert wurde. Jede Gruppe im `none`-Modus ist ein Solo-Antrag bzw. ein
  // Cluster → Sektions-Zuordnung über das erste TV (dominanter Status).
  const beendetAchse = hatBeendetAchse(activeView);
  const { inArbeitGroups, archivGroups } = useMemo(() => {
    if (!beendetAchse) return { inArbeitGroups: allGroups, archivGroups: [] as AntragGroup[] };
    const inArbeitGroups: AntragGroup[] = [];
    const archivGroups: AntragGroup[] = [];
    for (const g of allGroups) {
      (arbeitsvorratSectionOf(g.tvs[0]!) === 'archiv' ? archivGroups : inArbeitGroups).push(g);
    }
    return { inArbeitGroups, archivGroups };
  }, [beendetAchse, allGroups]);
  const inArbeitTvCount = useMemo(() => inArbeitGroups.reduce((s, g) => s + g.tvs.length, 0), [inArbeitGroups]);
  const archivTvCount = useMemo(() => archivGroups.reduce((s, g) => s + g.tvs.length, 0), [archivGroups]);
  const beendetVersteckt = istBeendetVersteckt({
    wunsch: beendetWunsch,
    suchAktiv: searchActive,
    beendet: archivGroups.length,
    arbeitsvorrat: inArbeitGroups.length,
  });
  const beendetAufschluesselung = useMemo(
    () => formatArchivAufschluesselung(archivAufschluesselung(archivGroups.flatMap(g => g.tvs))),
    [archivGroups],
  );
  // Die zwei Bänder trennen die Hälften nur dort, wo keine Gruppierung schon
  // Abschnitte setzt — verschachtelte Sektionen kennt die Liste nicht.
  const zweiBaender = effectiveMode === 'none' && !beendetVersteckt && archivGroups.length > 0;

  // Pagination auf der (ggf. umsortierten) Gruppenliste. Ausgeblendete Gruppen
  // bleiben aus der Pagination draußen.
  const { groups, hasMoreGroups } = useMemo(() => {
    const ordered = beendetVersteckt
      ? inArbeitGroups
      : (zweiBaender ? [...inArbeitGroups, ...archivGroups] : allGroups);
    const g = takeGroupsUntil(ordered, visibleRows);
    return { groups: g, hasMoreGroups: g.length < ordered.length };
  }, [beendetVersteckt, zweiBaender, inArbeitGroups, archivGroups, allGroups, visibleRows]);

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
            <div key={section.id}>
              <StatusSectionHeader
                id={section.id}
                count={abschnittsGesamt.get(section.id) ?? section.groups.length}
              />
              {collapsedSet.has(section.id) ? null : (
                <div className="flex flex-col gap-1">
                  {section.groups.map(renderGroup)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : zweiBaender ? (
        <div className="flex flex-col gap-3">
          {inArbeitGroups.length > 0 ? (
            <div>
              <ArbeitsvorratSectionHeader section="in_arbeit" count={inArbeitTvCount} />
              <div className="flex flex-col gap-1 mt-1.5">
                {groups.filter(g => arbeitsvorratSectionOf(g.tvs[0]!) === 'in_arbeit').map(renderGroup)}
              </div>
            </div>
          ) : null}
          <div>
            <ArbeitsvorratSectionHeader
              section="archiv"
              count={archivTvCount}
              collapsed={false}
              onToggle={() => setBeendetAusgeblendet(true)}
              breakdown={beendetAufschluesselung}
            />
            <div className="flex flex-col gap-1 mt-1.5">
              {groups.filter(g => arbeitsvorratSectionOf(g.tvs[0]!) === 'archiv').map(renderGroup)}
            </div>
          </div>
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
      {/* Ausgeblendetes Beendet: Streifen unter der Liste — steht unter JEDER
          Gruppierung, damit abzählbar bleibt, was gerade fehlt. */}
      {beendetVersteckt ? (
        <div className="px-3 py-2 mt-3 rounded-[10px]" style={{ border: '0.5px solid var(--tf-border)' }}>
          <ArbeitsvorratSectionHeader
            section="archiv"
            count={archivTvCount}
            collapsed
            onToggle={() => setBeendetAusgeblendet(false)}
            breakdown={beendetAufschluesselung}
            linie={false}
          />
        </div>
      ) : null}
    </div>
  );
}

