/**
 * Kopfzeile(n) der `SortableTable`: Beschriftung, Sortier-Knopf, Spalten-Filter
 * und der Resize-Griff je Spalte.
 *
 * Der Zustand des Filter-Dropdowns (welche Spalte offen, an welchem Anker) lebt
 * hier — außerhalb des Kopfes braucht ihn niemand.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import { SortIcon } from './SortIcon';
import { ColumnFilterDropdown } from './ColumnFilterDropdown';
import { baueRubrikSpannen } from './rubrikSpannen';
import type { SortDirection, SortableColumn } from './types';

export interface TableHeadRowsProps<T> {
  columns: SortableColumn<T>[];
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  /** Rendert die Drag-Handles. */
  resizeEnabled: boolean;
  startResize: (key: string, e: React.MouseEvent<HTMLDivElement>) => void;
  /** Doppelklick auf den Griff: gezogene Breite verwerfen. Ohne diesen Callback
   *  bleibt der Doppelklick wirkungslos (und der Titel verspricht ihn nicht). */
  onColumnWidthReset?: (key: string) => void;
  /** Nur aktiv, wenn der Verbraucher alle drei Filter-Props durchreicht. */
  filtersEnabled: boolean;
  columnFilters?: Record<string, Set<string>>;
  onColumnFilterChange?: (key: string, values: Set<string>) => void;
  filterCandidates?: Record<string, string[]>;
  /** Erste Spalte beim waagerechten Scrollen stehen lassen. */
  stickyFirstColumn?: boolean;
  /** Zusätzliche erste Kopfzeile, die zusammenhängende Spalten unter ihrer
   *  Rubrik bündelt. */
  showGroupHeader?: boolean;
}

/** Stapelreihenfolge der klebenden Zellen. Der Kopf muss über den Datenzellen
 *  liegen, und in ihm die klebende Spalte über den scrollenden Köpfen — sonst
 *  schiebt sich beim Scrollen ein Spaltenkopf über die stehende Ecke. */
const Z_KOPF_STICKY = 40;
const Z_KOPF = 30;

export function TableHeadRows<T>({
  columns,
  sortKey,
  sortDirection,
  onSort,
  resizeEnabled,
  startResize,
  onColumnWidthReset,
  filtersEnabled,
  columnFilters,
  onColumnFilterChange,
  filterCandidates,
  stickyFirstColumn = false,
  showGroupHeader = false,
}: TableHeadRowsProps<T>): React.ReactElement {
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const spannen = useMemo(
    () => (showGroupHeader ? baueRubrikSpannen(columns) : []),
    [showGroupHeader, columns],
  );
  const rubrikRef = useRef<HTMLTableRowElement | null>(null);
  const rubrikHoehe = useRubrikHoehe(rubrikRef, showGroupHeader);

  return (
    <thead>
      {showGroupHeader && (
        <tr
          ref={rubrikRef}
          className="text-left text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]"
          style={{ background: 'var(--tf-bg-secondary)' }}
        >
          {spannen.map((s, i) => {
            // Die erste Strecke darf nur dann mitkleben, wenn sie GENAU eine
            // Spalte umfasst — sonst zöge sie die halbe Kopfzeile mit.
            const sticky = stickyFirstColumn && i === 0 && s.span === 1;
            return (
              <th
                key={s.startKey}
                colSpan={s.span}
                className={
                  sticky
                    ? 'px-3 pt-1.5 pb-0.5 align-bottom bg-[var(--tf-bg-secondary)]'
                    : 'px-3 pt-1.5 pb-0.5 align-bottom'
                }
                style={{
                  // Trennlinie nur ZWISCHEN Rubriken, nicht nach der letzten.
                  borderRight: i < spannen.length - 1 ? '0.5px solid var(--tf-border)' : undefined,
                  ...(sticky ? { position: 'sticky', left: 0, zIndex: Z_KOPF_STICKY } : null),
                }}
              >
                {/* Namenlose Strecken bleiben leer, statt eine Ersatz-Beschriftung
                    zu erfinden. */}
                <span className="block truncate">{s.name ?? ''}</span>
              </th>
            );
          })}
        </tr>
      )}
      <tr
        className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]"
        style={{ background: 'var(--tf-bg-secondary)' }}
      >
        {columns.map((c, i) => {
          const active = sortKey === c.key;
          const ariaSort = active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
          const filterActive = filtersEnabled && (columnFilters?.[c.key]?.size ?? 0) > 0;
          // Vertikale Trennlinie als Resize-Hinweis: nur wenn Resize aktiv ist
          // (Linie deckt sich pixelgenau mit der Greifzone) und nicht bei der
          // letzten Spalte. Spiegelt das Muster aus SearchTableHeader. Die
          // Greifzone reicht darüber hinaus in die Rubrikzeile hinein; die zeigt
          // bewusst NUR ihre eigene, gröbere Teilung — Spaltenlinien dort oben
          // zerschnitten die Bänder, die die Zeile gerade bündeln soll.
          const isLastCol = i === columns.length - 1;
          const sticky = stickyFirstColumn && i === 0;
          return (
            <th
              key={c.key}
              // Der graue Grund sitzt normalerweise am `<tr>`; eine klebende
              // Zelle braucht ihn selbst, sonst scrollt der Nachbarinhalt
              // sichtbar dahinter durch.
              className={
                sticky
                  ? 'group/kopf px-3 py-1.5 align-middle relative bg-[var(--tf-bg-secondary)]'
                  : 'group/kopf px-3 py-1.5 align-middle relative'
              }
              aria-sort={ariaSort}
              style={{
                ...(resizeEnabled && !isLastCol
                  ? { borderRight: '0.5px solid var(--tf-border)' }
                  : null),
                ...(sticky
                  ? { position: 'sticky', left: 0, zIndex: Z_KOPF_STICKY }
                  : stickyFirstColumn
                    ? { position: 'relative', zIndex: Z_KOPF }
                    : null),
              }}
            >
              {/* Kein `min-w-0`/`break-words` hier: eine Überschrift aus
                  EINEM Wort behält als Flex-Element die Breite dieses
                  Wortes und läuft bei zu schmaler Spalte über den Rand.
                  Der naheliegende Umbruch macht es schlimmer — gemessen an
                  der Antrags-Tabelle, deren 72-px-Spalte „TIB" dann mitten
                  im Wort trennte und die Kopfzeile um 16 px wachsen ließ.
                  Die Spaltenbreite ist die richtige Stellschraube; im
                  Status-Katalog gibt der längste Kopf sie vor. */}
              <div className="flex items-center gap-1">
                {c.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className="flex items-center gap-1.5 cursor-pointer hover:text-[var(--tf-text)]"
                    title={`Nach ${c.label} sortieren`}
                  >
                    <span>{c.label}</span>
                    <SortIcon active={active} direction={sortDirection} />
                  </button>
                ) : (
                  // `title` auch hier: bei schmaler Spalte legt sich der
                  // Filter-Chevron beim Überfahren über das Ende der
                  // Beschriftung. Der Sortier-Knopf trägt seinen Titel schon.
                  <span title={c.label}>{c.label}</span>
                )}
              </div>
              {/* Der Chevron liegt AUSSERHALB des Textflusses (rechts neben der
                  Beschriftung, links vom Resize-Griff) und erscheint erst beim
                  Überfahren des Kopfes. Im Fluss reservierte er 21 px in JEDER
                  filterbaren Spalte — bei „BIB" mehr, als der Inhalt überhaupt
                  braucht. `opacity-0` wäre hier falsch: das behält den Platz,
                  und genau der soll frei werden.

                  Wo ein Filter LIEGT, bleibt er dauerhaft sichtbar (das ist
                  Information, keine Bedien-Andeutung) — und nur dann rechnet
                  `kopfBreite` seinen Platz mit ein, damit er die Überschrift
                  nicht dauerhaft verdeckt. */}
              {filtersEnabled && c.filterable && (
                <button
                  type="button"
                  onClick={(e) => {
                    if (openFilterKey === c.key) {
                      setOpenFilterKey(null);
                      setFilterAnchor(null);
                    } else {
                      setFilterAnchor(e.currentTarget);
                      setOpenFilterKey(c.key);
                    }
                  }}
                  className={
                    'absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer'
                    + ' bg-[var(--tf-bg-secondary)] hover:bg-[var(--tf-hover)]'
                    + (filterActive || openFilterKey === c.key
                      ? ''
                      : ' opacity-0 group-hover/kopf:opacity-100 focus-visible:opacity-100')
                  }
                  title={filterActive ? `Filter aktiv (${columnFilters![c.key]!.size})` : 'Filter'}
                  style={filterActive ? { color: 'var(--tf-primary)' } : { color: 'var(--tf-text-secondary)' }}
                >
                  {filterActive
                    ? <Filter size={12} fill="currentColor" strokeWidth={2} />
                    : <ChevronDown size={13} strokeWidth={2.25} />}
                </button>
              )}
              {filtersEnabled && c.filterable && openFilterKey === c.key && (
                <ColumnFilterDropdown
                  candidates={filterCandidates![c.key] ?? []}
                  selected={columnFilters![c.key] ?? new Set()}
                  onApply={(values) => {
                    onColumnFilterChange!(c.key, values);
                    setOpenFilterKey(null);
                    setFilterAnchor(null);
                  }}
                  onClose={() => { setOpenFilterKey(null); setFilterAnchor(null); }}
                  formatLabel={c.formatFilterLabel}
                  groupOf={c.filterGroupOf}
                  anchorEl={filterAnchor}
                />
              )}
              {resizeEnabled && (
                <ResizeGriff
                  label={c.label}
                  onMouseDown={e => startResize(c.key, e)}
                  onDoubleClick={onColumnWidthReset ? () => onColumnWidthReset(c.key) : undefined}
                  ueberhang={rubrikHoehe}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/**
 * Höhe der Rubrikzeile in Pixeln — der Betrag, um den die Spaltengriffe nach
 * OBEN aus ihrer Zelle herausragen müssen.
 *
 * Gemessen statt gerechnet: die Zeile ist so hoch, wie ihre Zeilenhöhe und ihre
 * Polsterung sie machen (hier 23 px), und das hängt an der geladenen Schrift und
 * am Zoom. Ein Zahlwert im Code stimmte nur für den Stand, in dem er entstand.
 */
function useRubrikHoehe(
  ref: React.RefObject<HTMLTableRowElement | null>,
  aktiv: boolean,
): number {
  const [hoehe, setHoehe] = useState(0);
  useLayoutEffect(() => {
    const tr = ref.current;
    if (!aktiv || !tr) { setHoehe(0); return; }
    const messen = (): void => setHoehe(tr.offsetHeight);
    messen();
    // Kein Rückkopplungs-Risiko: der Griff ist absolut positioniert und geht
    // nicht in die Zeilenhöhe ein.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(messen);
    ro.observe(tr);
    return () => ro.disconnect();
  }, [ref, aktiv]);
  return hoehe;
}

function ResizeGriff({
  label,
  onMouseDown,
  onDoubleClick,
  ueberhang = 0,
}: {
  label: string;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: () => void;
  /** Pixel, um die der Griff über die OBERKANTE seiner Zelle hinausragt. Der
   *  Griff sitzt in der Spaltenzeile; ohne diesen Überhang wäre die Rubrikzeile
   *  darüber eine tote Fläche (gemessen: 23 von 53 px Kopfhöhe), obwohl sie
   *  optisch zum selben Spaltenkopf gehört. */
  ueberhang?: number;
}): ReactNode {
  const titel = onDoubleClick
    ? `Ziehen: Spalte „${label}" breiter/schmaler · Doppelklick: an den Inhalt anpassen`
    : `Ziehen: Spalte „${label}" breiter/schmaler`;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Spaltenbreite ${label} anpassen`}
      title={titel}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize hover:bg-[var(--tf-border-hover)] z-10"
      style={{
        touchAction: 'none',
        ...(ueberhang > 0 ? { top: -ueberhang, height: `calc(100% + ${ueberhang}px)` } : null),
      }}
    />
  );
}
