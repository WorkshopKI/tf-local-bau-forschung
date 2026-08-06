import { useEffect, useMemo } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { SortableTable, useTableSort, useColumnFilters, compareValues, useColumnWidths, useTotalTableWidth } from '@/components/data-table';
import { resolveAntragTableColumns } from './tableColumns';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import { useKategorieSpalten } from './useKategorieSpalten';
import { useAntraegeStore } from './store';
import { zaehleJeAbschnitt } from './antragGroups';
import {
  buildVerbundTableRows,
  buildStatusSectionRows,
  buildNetzwerkSectionRows,
  buildKuerzelSectionRows,
  type AntragTableRow,
  type TableGroupingMode,
  type TabellenAnsicht,
} from './tableGrouping';
import {
  partitionArbeitsvorrat,
  arbeitsvorratSectionOf,
  archivAufschluesselung,
  formatArchivAufschluesselung,
  istBeendetVersteckt,
  hatBeendetAchse,
} from './arbeitsvorrat';
import { ArbeitsvorratSectionHeader } from './ArbeitsvorratSectionHeader';
import { useBeendetSichtbarkeit } from './useBeendetSichtbarkeit';
import type { ZeilenMeldung } from './trefferZahl';

interface Props {
  filtered: AntragListItem[];
  visibleRows: number;
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  grouping: TableGroupingMode;
  /** Zeilen-Körnung: `antrag` verdichtet Verbünde zu einer Zeile. Orthogonal zur
   *  Gruppierung — siehe Kopfkommentar von `tableGrouping.ts`. */
  ansicht: TabellenAnsicht;
  /** „alle"-/Übersichtsmodus → MA-Spalte (tib_kuerz) automatisch einblenden. */
  showMaColumn: boolean;
  onOpenAntrag: (az: string) => void;
  onOpenVerbund: (id: string) => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Der Tabellenkasten wird selbst zum senkrechten Scroller, damit die
   *  Kopfzeile stehen bleibt (siehe `SortableTable.stickyHeader`). Dann wandert
   *  auch der Pagination-Sentinel MIT hinein — außerhalb stünde er im nicht
   *  scrollenden Elternteil, wäre dauerhaft sichtbar und lüde sofort alles nach. */
  stickyHeader?: boolean;
  /** Scroll-Container der Tabelle nach außen reichen (Scroll-Stand über den
   *  Detail-Split, `IntersectionObserver`-Root). Nur mit `stickyHeader`. */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  /** Meldet der Toolbar in AntraegeMain, was die Tabelle gerade zeigt: die
   *  spaltengefilterte TV-Anzahl und die Zeilen, die daraus werden. */
  onZeilenMeldung?: (m: ZeilenMeldung) => void;
}

/** Section-Key-Funktion pro Zeile (Gruppierungs-Abschnitt oder Arbeitsvorrat-
 *  Sektion) bzw. `null` (keine Sektionierung). */
type SectionOf = ((row: AntragTableRow) => string) | null;
/** Beschriftung eines Abschnitts-Schlüssels. `null`, wo der Renderer den
 *  Schlüssel selbst deutet (Arbeitsvorrat/Archiv). */
type LabelOf = ((key: string) => string) | null;

/** Band-Header der Gruppierung in der Tabelle — wie `StatusSectionHeader` der
 *  List-View, aber nicht-kollabierbar (eingebettet in einer Tabellen-Zeile).
 *
 *  **Ohne Trennlinie**, anders als die List-View-Variante: in der Tabelle sitzt
 *  das Band auf grauem Grund, der die Abgrenzung schon leistet. Die auslaufende
 *  Linie war eine zweite Aussage zur selben Sache — und stieß beim ersten Band
 *  direkt auf die Unterkante des Tabellenkopfes.
 *
 *  `grossbuchstaben` trennt zwei Sorten Beschriftung: die Status-Abschnitte sind
 *  feste Rubriken und stehen wie eh in Versalien. Netzwerk, FB und AB tragen
 *  dagegen ECHTE Bezeichner — Versalien verfälschen sie (`AAt` las sich als
 *  `AAT`, `SprayCloth · Phase 2` als `SPRAYCLOTH · PHASE 2`). */
function StatusBand({
  label,
  count,
  grossbuchstaben = true,
}: { label: string; count: number; grossbuchstaben?: boolean }): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-[11px] tracking-[0.08em] font-medium text-[var(--tf-text-tertiary)] ${
          grossbuchstaben ? 'uppercase' : ''
        }`}
      >
        {label}
      </span>
      <span className="text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">
        {count.toLocaleString('de-DE')}
      </span>
    </div>
  );
}

/**
 * Tabellen-Ansicht der Förderanträge ("compact"-View-Mode) — eine echte
 * Header-Tabelle mit konfigurierbaren Spalten (Spalten-Picker im Header) +
 * Klick-auf-Header-Sortierung, gebaut auf der generischen `SortableTable`.
 *
 * Drei unabhängige Toolbar-Achsen, in dieser Reihenfolge ausgewertet (siehe
 * Kopfkommentar von `tableGrouping.ts`):
 *
 * 1. **Ansicht** — `antrag`: pro Verbund eine Zeile (Multi-TV kollabiert, Solo
 *    unverändert). `antrag-mit-tv`: jedes Teilvorhaben eine eigene Zeile.
 * 2. **Beendet** (nur Reiter „Alle") — terminale Zeilen ausgeblendet (Streifen
 *    unter der Tabelle) oder eingeblendet. Läuft NACH der Verdichtung, damit ein
 *    Verbund als Ganzes beurteilt wird.
 * 3. **Gruppierung** — `none`: flach; sind beendete Zeilen sichtbar, trennen
 *    zwei Bänder (Arbeitsvorrat/Beendet) die Hälften. `status`/`netzwerk`/`fb`/
 *    `ab`: Bänder über den Zeilen; Header-Sort wirkt section-stabil (innerhalb
 *    der Bänder).
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
  ansicht,
  showMaColumn,
  onOpenAntrag,
  onOpenVerbund,
  sentinelRef,
  onZeilenMeldung,
  stickyHeader = false,
  scrollContainerRef,
  onScroll,
}: Props): React.ReactElement {
  const visibleColumns = useAntraegeColumnsStore(s => s.visibleColumns);
  const verbundById = useAntraegeStore(s => s.verbundById);
  // Netzwerk-Namen für die NW-Bänder (Cross-Programm-Index, einmal pro Session).
  const netzwerkNameById = useAntraegeStore(s => s.netzwerkNameById);
  // Achse 3 (Beendet): eigener Schalter, nur im „Alle"-Tab.
  const activeView = useAntraegeStore(s => s.activeView);
  const searchActive = useAntraegeStore(s => s.search.trim().length > 0);
  const beendetWunsch = useBeendetSichtbarkeit(s => s.ausgeblendet);
  const setBeendetAusgeblendet = useBeendetSichtbarkeit(s => s.setAusgeblendet);
  const beendetAchse = hatBeendetAchse(activeView);
  // Persistierte Spalten-Pixelbreiten (Resize via Drag-Handles der SortableTable).
  const { widths, setWidth, resetWidth } = useColumnWidths('teamflow_antraege_table_col_widths', {});
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
  const { columnFilters, setColumnFilter, filterCandidates, filteredRows, filterCounts } =
    useColumnFilters(enriched, columns);

  // Achse 1 (Ansicht): Zeilen-Körnung. Läuft VOR der Gruppierung — eine
  // Verbund-Zeile wird also nach den Werten ihres Lead-TVs einsortiert.
  const baseRows = useMemo<AntragTableRow[]>(
    () => (ansicht === 'antrag' ? buildVerbundTableRows(filteredRows, verbundById) : filteredRows),
    [ansicht, filteredRows, verbundById],
  );

  // Achse 3 (Beendet): terminale Zeilen sind eine EIGENE Sichtbarkeits-Frage,
  // unabhängig von Ansicht und Gruppierung. Getrennt wird nach der Verdichtung
  // — eine Verbund-Zeile trägt den dominanten Status ihres Verbundes, und den
  // erst nach dem Zusammenfassen zu kennen ist der Punkt.
  const { inArbeit, archiv } = useMemo(
    () => (beendetAchse
      ? partitionArbeitsvorrat(baseRows)
      : { inArbeit: baseRows, archiv: [] as AntragTableRow[] }),
    [beendetAchse, baseRows],
  );
  const beendetVersteckt = istBeendetVersteckt({
    wunsch: beendetWunsch,
    suchAktiv: searchActive,
    beendet: archiv.length,
    arbeitsvorrat: inArbeit.length,
  });
  const beendetAufschluesselung = useMemo(
    () => formatArchivAufschluesselung(archivAufschluesselung(archiv)),
    [archiv],
  );

  // Achse 2 (Gruppierung): Abschnitts-Bänder über den sichtbaren Zeilen (vor
  // Header-Sort + Slice).
  const { allRows, sectionOf, labelOf } = useMemo<{
    allRows: AntragTableRow[];
    sectionOf: SectionOf;
    labelOf: LabelOf;
  }>(() => {
    // Versteckte Zeilen bleiben aus der Tabelle draußen (kein Pagination-
    // Verbrauch); ihr Kopf wird als Streifen unter der Tabelle gerendert.
    const sichtbar = beendetVersteckt ? inArbeit : baseRows;
    if (grouping === 'status' || grouping === 'netzwerk' || grouping === 'fb' || grouping === 'ab') {
      const built = grouping === 'status'
        ? buildStatusSectionRows(sichtbar)
        : grouping === 'netzwerk'
          ? buildNetzwerkSectionRows(sichtbar, netzwerkNameById)
          : buildKuerzelSectionRows(sichtbar, grouping === 'fb' ? 'tib_kuerz' : 'bib_kuerz');
      return { allRows: built.rows, sectionOf: built.sectionOf, labelOf: built.labelOf };
    }
    // Ohne Gruppierung und mit sichtbarem Beendet-Teil: die zwei Bänder. Sie
    // sind hier keine dritte Gruppierung, sondern die Grenze zwischen den zwei
    // Hälften — ohne sie wäre nicht zu sehen, wo der Arbeitsvorrat endet.
    if (archiv.length > 0 && !beendetVersteckt) {
      return {
        allRows: [...inArbeit, ...archiv],
        sectionOf: (r: AntragTableRow) => arbeitsvorratSectionOf(r),
        labelOf: null,
      };
    }
    return { allRows: sichtbar, sectionOf: null, labelOf: null };
  }, [grouping, beendetVersteckt, inArbeit, archiv, baseRows, netzwerkNameById]);

  // Abschnitts-Gesamtzahlen über `allRows` (= vor Header-Sort und Pagination).
  // NICHT der Zähler, den `SortableTable` an `renderSectionHeader` reicht: der
  // kommt aus dem gerenderten Slice und wüchse beim Nachladen — seine Summe war
  // exakt die Seitengröße. Der Arbeitsvorrat-Zweig umging das schon einzeln;
  // jetzt gilt es für alle Bänder über denselben Weg.
  const abschnittsGesamt = useMemo(
    () => (sectionOf === null ? null : zaehleJeAbschnitt(allRows, sectionOf)),
    [allRows, sectionOf],
  );

  // An die Toolbar melden, was hier steht. Effekt statt direktem Aufruf, weil
  // setState eines Eltern-Elements im Render verboten ist.
  //
  // Eine abweichende Zeilenzahl gibt es NUR in der Ansicht „Antrag" — nur dort
  // fasst die Tabelle mehrere TV zu einer Zeile zusammen. Gezählt wird auf
  // `baseRows`, nicht auf `allRows`: bei ausgeblendetem Beendet-Teil ist
  // `allRows` ebenfalls kürzer, aber das ist keine Verdichtung, sondern ein
  // ausgeblendeter Abschnitt (dessen Streifen unter der Tabelle steht und seine
  // Zahl selbst nennt); als „Zeilen" ausgewiesen wäre es eine Falschaussage.
  const zeilen = ansicht === 'antrag' ? baseRows.length : filteredRows.length;
  useEffect(() => {
    onZeilenMeldung?.({
      quelle: 'compact',
      tv: filteredRows.length,
      zeilen,
      art: ansicht === 'antrag' ? 'verbund' : null,
    });
  }, [filteredRows.length, zeilen, ansicht, onZeilenMeldung]);

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
        renderSectionHeader: (key: string, slice: number): React.ReactNode => {
          // `slice` ist bewusst nur der Rückfall: er zählt die gerenderten
          // Zeilen, die Gesamtzahl steht in `abschnittsGesamt`.
          const count = abschnittsGesamt?.get(key) ?? slice;
          // Gruppierungs-Bänder: der Schlüssel ist eine stabile Id (Abschnitt,
          // Netzwerk-Id, Kürzel) — die Beschriftung kommt vom Builder. Bis v3.0
          // stand der Schlüssel roh im Band („VOR-ENTSCHEIDUNG").
          if (labelOf !== null) {
            return (
              <StatusBand
                label={labelOf(key)}
                count={count}
                grossbuchstaben={grouping === 'status'}
              />
            );
          }
          // Arbeitsvorrat/Beendet: eigene Bänder. Das Beendet-Band ist hier immer
          // aufgeklappt (ausgeblendet → Streifen unter der Tabelle).
          if (key === 'archiv') {
            return (
              <ArbeitsvorratSectionHeader
                section="archiv"
                count={count}
                collapsed={false}
                onToggle={() => setBeendetAusgeblendet(true)}
                breakdown={beendetAufschluesselung}
                linie={false}
              />
            );
          }
          return <ArbeitsvorratSectionHeader section="in_arbeit" count={count} linie={false} />;
        },
      }
    : {};

  const ladeStreifen = hasMore ? (
    <div ref={sentinelRef} className="py-3 text-center text-[11px] text-[var(--tf-text-tertiary)]">
      Lade weitere Einträge …
    </div>
  ) : null;

  return (
    <div className={stickyHeader ? 'flex flex-col flex-1 min-h-0' : 'flex flex-col'}>
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
        // Spaltenbreiten aus dem Inhalt. Gemessen wird `allRows` — der volle
        // gefilterte Satz VOR Header-Sortierung und Pagination. Auf `rows`
        // gemessen würde jede nachgeladene Seite die Breiten neu setzen, auf
        // `orderedRows` jeder Sortierklick. Die Signatur trennt zusätzlich zwei
        // Filterergebnisse gleicher Länge (zwei O(1)-Zugriffe).
        autoColumnWidth
        // FKZ bleibt beim Blättern nach rechts stehen — sonst weiß man bei
        // 25 Spalten nicht mehr, welche Zeile man gerade liest.
        stickyFirstColumn
        // Rubrik-Bänder über den Spaltenköpfen. Trägt erst, seit die Registry
        // nach Rubrik geordnet ist — vorher zerfiel „Antrag" in fünf Strecken.
        showGroupHeader
        measureRows={allRows}
        measureSignature={`${allRows[0]?.aktenzeichen ?? ''}|${allRows[allRows.length - 1]?.aktenzeichen ?? ''}`}
        columnWidths={widths}
        onColumnWidthChange={setWidth}
        onColumnWidthReset={resetWidth}
        totalWidth={totalWidth}
        onTotalWidthChange={setTotalWidth}
        columnFilters={columnFilters}
        onColumnFilterChange={setColumnFilter}
        filterCandidates={filterCandidates}
        filterCounts={filterCounts}
        // Der Kopf bleibt stehen — dafür wird dieser Kasten der senkrechte
        // Scroller, und der Lade-Streifen muss MIT hinein.
        stickyHeader={stickyHeader}
        scrollContainerRef={scrollContainerRef}
        onScroll={onScroll}
        footerSlot={stickyHeader ? ladeStreifen : undefined}
        {...sectionProps}
      />
      {stickyHeader ? null : ladeStreifen}
      {/* Ausgeblendetes Beendet: Streifen unter der Tabelle (seine Zeilen sind
          bewusst nicht Teil der Tabelle → keine Pagination). Klick blendet ein
          und setzt damit denselben Schalter wie die Toolbar. Er steht unter
          JEDER Gruppierung — was ausgeblendet ist, bleibt abzählbar. */}
      {beendetVersteckt ? (
        <div className="px-3 py-2 mt-1 rounded-[10px]" style={{ border: '0.5px solid var(--tf-border)' }}>
          <ArbeitsvorratSectionHeader
            section="archiv"
            count={archiv.length}
            collapsed
            onToggle={() => setBeendetAusgeblendet(false)}
            breakdown={beendetAufschluesselung}
          />
        </div>
      ) : null}
    </div>
  );
}
