import { useEffect, useMemo } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { SortableTable, useTableSort, useColumnFilters, compareValues, useColumnWidths, useTotalTableWidth } from '@/components/data-table';
import { resolveAntragTableColumns } from './tableColumns';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import { useKategorieSpalten } from './useKategorieSpalten';
import { useAntraegeStore } from './store';
import {
  buildVerbundTableRows,
  buildStatusSectionRows,
  type AntragTableRow,
  type TableGroupingMode,
} from './tableGrouping';
import {
  partitionArbeitsvorrat,
  arbeitsvorratSectionOf,
  archivAufschluesselung,
  formatArchivAufschluesselung,
  isArchivCollapsedEffective,
  isArbeitsvorratView,
} from './arbeitsvorrat';
import { ArbeitsvorratSectionHeader } from './ArbeitsvorratSectionHeader';
import { useArbeitsvorratCollapsed } from './useArbeitsvorratCollapsed';

interface Props {
  filtered: AntragListItem[];
  visibleRows: number;
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  grouping: TableGroupingMode;
  /** „alle"-/Übersichtsmodus → MA-Spalte (tib_kuerz) automatisch einblenden. */
  showMaColumn: boolean;
  onOpenAntrag: (az: string) => void;
  onOpenVerbund: (id: string) => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Meldet die spaltengefilterte TV-Anzahl (vor Gruppierungs-Kollabierung)
   *  an die Toolbar in AntraegeMain — Quelle für die Trefferzahl-Anzeige in
   *  der Tabellen-Ansicht (List/Karten nutzen direkt `filtered.length`). */
  onFilteredCountChange?: (n: number) => void;
}

/** Section-Key-Funktion pro Zeile (Status-Phase oder Arbeitsvorrat-Sektion) bzw.
 *  `null` (keine Sektionierung). */
type SectionOf = ((row: AntragTableRow) => string) | null;
/** Archiv-Metadaten für den Arbeitsvorrat/Archiv-Split (nur View „Alle", ohne
 *  aktive Gruppierung). `null` außerhalb dieses Falls. */
type ArchivMeta = {
  count: number;
  inArbeitCount: number;
  /** Effektiver Collapsed-Zustand (bei aktiver Suche mit Archiv-Treffern offen). */
  collapsedEff: boolean;
  breakdown: string;
} | null;

/** Band-Header für `Gruppiert: Status` in der Tabelle — gleiche Optik wie
 *  `StatusSectionHeader` der List-View, aber nicht-kollabierbar (eingebettet
 *  in einer Tabellen-Zeile). */
function StatusBand({ label, count }: { label: string; count: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--tf-text-tertiary)]">
        {label}
      </span>
      <span className="text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">
        {count.toLocaleString('de-DE')}
      </span>
      <div className="flex-1 h-px bg-[var(--tf-border)]" />
    </div>
  );
}

/**
 * Tabellen-Ansicht der Förderanträge ("compact"-View-Mode) — eine echte
 * Header-Tabelle mit konfigurierbaren Spalten (Spalten-Picker im Header) +
 * Klick-auf-Header-Sortierung, gebaut auf der generischen `SortableTable`.
 *
 * Gruppierung (Toolbar-Pille im Compact-Modus):
 * - `none`: flach — `filtered` (bereits gefiltert + Toolbar-sortiert + Verbund-
 *   geclustert). Header-Sort überschreibt die Default-Reihenfolge.
 * - `verbund`: pro Verbund eine Zeile (Multi-TV kollabiert, Solo unverändert).
 * - `status`: jedes TV einzeln, in Status-Bänder gruppiert; Header-Sort wirkt
 *   section-stabil (innerhalb der Bänder).
 *
 * Header-Sort (`useTableSort`) läuft VOR dem Pagination-Slice, damit die
 * Sortierung über die ganze Liste greift, nicht nur die sichtbare Seite.
 */
export function AntraegeTable({
  filtered,
  visibleRows,
  selectedAktenzeichen,
  selectedVerbundId,
  grouping,
  showMaColumn,
  onOpenAntrag,
  onOpenVerbund,
  sentinelRef,
  onFilteredCountChange,
}: Props): React.ReactElement {
  const visibleColumns = useAntraegeColumnsStore(s => s.visibleColumns);
  const verbundById = useAntraegeStore(s => s.verbundById);
  // Arbeitsvorrat/Archiv-Split greift nur im „Alle"-Tab ohne aktive Gruppierung.
  const activeView = useAntraegeStore(s => s.activeView);
  const searchActive = useAntraegeStore(s => s.search.trim().length > 0);
  const archivPersistedCollapsed = useArbeitsvorratCollapsed(s => s.archivCollapsed);
  const toggleArchiv = useArbeitsvorratCollapsed(s => s.toggle);
  const arbeitsvorratEnabled = isArbeitsvorratView(activeView, grouping);
  // Persistierte Spalten-Pixelbreiten (Resize via Drag-Handles der SortableTable).
  const { widths, setWidth } = useColumnWidths('teamflow_antraege_table_col_widths', {});
  // Persistierte Gesamt-Tabellenbreite (Griff am rechten Rand). null = Default
  // (Tabelle füllt die Content-Box); Zahl = gepinnt, Spalten skalieren proportional.
  const { totalWidth, setTotalWidth } = useTotalTableWidth('teamflow_antraege_table_total_width');
  // Einblendbare Ordner-Spalten aus dem Statuskatalog (leer ohne Flag).
  const kategorieSpalten = useKategorieSpalten();
  // Registry-Reihenfolge beibehalten (nicht Toggle-Reihenfolge des Stores).
  // Im „alle"-Modus die MA-Spalte direkt nach der gelockten FKZ-Spalte
  // einblenden (auto-verwaltet, nicht im Spalten-Picker).
  const columns = useMemo(
    () => resolveAntragTableColumns(visibleColumns, showMaColumn, kategorieSpalten),
    [visibleColumns, showMaColumn, kategorieSpalten],
  );

  // VB-Titel ist nicht in `AntragListItem` projiziert (Verbund-Level-Feld) → einmal
  // aus `verbundById` an die Row anhängen. Überlebt alle drei Gruppierungs-Modi
  // (Solo-/Lead-Spread in buildVerbundTableRows, Objekt-Durchreichung in
  // buildStatusSectionRows) und versorgt sowohl die „VB Titel"-Spalte als auch den
  // Spaltenkopf-Filter mit korrekten Werten.
  const enriched = useMemo<AntragTableRow[]>(
    () => filtered.map(a => {
      const t = a.verbund_id ? verbundById.get(a.verbund_id)?.titel : undefined;
      return t ? { ...a, verbund_titel: t } : a;
    }),
    [filtered, verbundById],
  );

  // Spaltenkopf-Filter (Header-Dropdown, wie in der Suche). Kandidaten aus der
  // EINGABE-Liste `enriched` (= Segment-/Sidebar-/Such-gefiltert) → view-scoped
  // und stabil; angewandt VOR der Gruppierung, also pro Einzel-Antrag.
  const { columnFilters, setColumnFilter, filterCandidates, filteredRows } =
    useColumnFilters(enriched, columns);

  // Spaltengefilterte TV-Anzahl an die Toolbar melden (vor der Gruppierungs-
  // Kollabierung → TV-Level, nicht Verbund-Zeilen). Effekt statt direktem
  // Aufruf, weil setState eines Eltern-Elements im Render verboten ist.
  useEffect(() => {
    onFilteredCountChange?.(filteredRows.length);
  }, [filteredRows.length, onFilteredCountChange]);

  // Basis-Zeilen je Gruppierungs-Modus (vor Header-Sort + Slice).
  const { allRows, sectionOf, archivMeta } = useMemo<{
    allRows: AntragTableRow[];
    sectionOf: SectionOf;
    archivMeta: ArchivMeta;
  }>(() => {
    if (grouping === 'verbund') {
      return { allRows: buildVerbundTableRows(filteredRows, verbundById), sectionOf: null, archivMeta: null };
    }
    if (grouping === 'status') {
      const built = buildStatusSectionRows(filteredRows);
      return { allRows: built.rows, sectionOf: built.sectionOf, archivMeta: null };
    }
    if (arbeitsvorratEnabled) {
      const { inArbeit, archiv } = partitionArbeitsvorrat(filteredRows);
      // Sektionieren nur, wenn es überhaupt etwas zu archivieren gibt.
      if (archiv.length > 0) {
        // Bei leerem Arbeitsvorrat (nur terminale Anträge) das Archiv immer
        // aufklappen — sonst zeigt die Tabelle „Keine Anträge" trotz Daten.
        const collapsedEff = inArbeit.length === 0
          ? false
          : isArchivCollapsedEffective(archivPersistedCollapsed, searchActive, archiv.length);
        // Eingeklapptes Archiv → seine Zeilen bleiben aus der Tabelle draußen
        // (kein Pagination-Verbrauch); der Kopf wird als Streifen unter der
        // Tabelle gerendert.
        const rows = collapsedEff ? inArbeit : [...inArbeit, ...archiv];
        return {
          allRows: rows,
          sectionOf: (r: AntragTableRow) => arbeitsvorratSectionOf(r),
          archivMeta: {
            count: archiv.length,
            inArbeitCount: inArbeit.length,
            collapsedEff,
            breakdown: formatArchivAufschluesselung(archivAufschluesselung(archiv)),
          },
        };
      }
    }
    return { allRows: filteredRows, sectionOf: null, archivMeta: null };
  }, [grouping, arbeitsvorratEnabled, filteredRows, verbundById, archivPersistedCollapsed, searchActive]);

  // storageKey → die Klick-auf-Spaltenkopf-Sortierung überlebt Reload/Seiten-
  // wechsel (Nutzer-Wunsch). Global (nicht per-View), konsistent mit den
  // ebenfalls global persistierten Spaltenbreiten oben.
  const { sortKey, sortDirection, toggleSort, sortedRows } =
    useTableSort(allRows, columns, null, 'desc', 'teamflow_antraege_table_sort');

  // Sektionierte Modi (Status-Gruppierung ODER Arbeitsvorrat/Archiv): section-
  // stabile Sortierung — Section-Reihenfolge bleibt, nur INNERHALB jeder Section
  // wird nach der aktiven Spalte sortiert. (Der globale `sortedRows` von
  // `useTableSort` würde die Sections zerreißen.)
  const orderedRows = useMemo(() => {
    if (sectionOf === null) return sortedRows;
    if (!sortKey) return allRows;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return allRows;
    const out: AntragTableRow[] = [];
    let i = 0;
    while (i < allRows.length) {
      const sec = sectionOf(allRows[i]!);
      let j = i;
      while (j < allRows.length && sectionOf(allRows[j]!) === sec) j++;
      const slice = allRows.slice(i, j);
      slice.sort((a, b) => compareValues(col.accessor(a), col.accessor(b), sortDirection));
      out.push(...slice);
      i = j;
    }
    return out;
  }, [sectionOf, sortedRows, allRows, columns, sortKey, sortDirection]);

  const rows = useMemo(() => orderedRows.slice(0, visibleRows), [orderedRows, visibleRows]);
  const hasMore = visibleRows < orderedRows.length;

  const sectionProps = sectionOf !== null
    ? {
        sectionKeyOf: (r: AntragTableRow) => sectionOf(r),
        renderSectionHeader: (key: string, count: number): React.ReactNode => {
          if (grouping === 'status') return <StatusBand label={key} count={count} />;
          // Arbeitsvorrat/Archiv: eigene Bänder. Zähler kommen aus archivMeta
          // (Gesamt der Sektion), nicht aus dem Slice-Count der SortableTable —
          // sonst wüchse „ABGESCHLOSSEN · n" erst beim Scrollen. Das Archiv-Band
          // in der Tabelle ist immer aufgeklappt (eingeklappt → Streifen unten).
          if (key === 'archiv') {
            return (
              <ArbeitsvorratSectionHeader
                section="archiv"
                count={archivMeta?.count ?? count}
                collapsed={false}
                onToggle={toggleArchiv}
                breakdown={archivMeta?.breakdown}
              />
            );
          }
          return <ArbeitsvorratSectionHeader section="in_arbeit" count={archivMeta?.inArbeitCount ?? count} />;
        },
      }
    : {};

  return (
    <div className="flex flex-col">
      <SortableTable<AntragTableRow>
        rows={rows}
        columns={columns}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        rowKey={r => r.aktenzeichen}
        onRowClick={r => (r._verbund ? onOpenVerbund(r._verbund.verbundId) : onOpenAntrag(r.aktenzeichen))}
        isRowSelected={r =>
          r._verbund ? r._verbund.verbundId === selectedVerbundId : r.aktenzeichen === selectedAktenzeichen
        }
        emptyContent="Keine Anträge."
        fitContentWidth
        columnWidths={widths}
        onColumnWidthChange={setWidth}
        totalWidth={totalWidth}
        onTotalWidthChange={setTotalWidth}
        columnFilters={columnFilters}
        onColumnFilterChange={setColumnFilter}
        filterCandidates={filterCandidates}
        {...sectionProps}
      />
      {hasMore ? (
        <div ref={sentinelRef} className="py-3 text-center text-[11px] text-[var(--tf-text-tertiary)]">
          Lade weitere Einträge …
        </div>
      ) : null}
      {/* Eingeklapptes Archiv: Kopf-Streifen unter der Tabelle (seine Zeilen sind
          bewusst nicht Teil der Tabelle → keine Pagination). Klick klappt auf. */}
      {archivMeta?.collapsedEff && archivMeta.count > 0 ? (
        <div className="px-3 py-2 mt-1 rounded-[10px]" style={{ border: '0.5px solid var(--tf-border)' }}>
          <ArbeitsvorratSectionHeader
            section="archiv"
            count={archivMeta.count}
            collapsed
            onToggle={toggleArchiv}
            breakdown={archivMeta.breakdown}
          />
        </div>
      ) : null}
    </div>
  );
}
