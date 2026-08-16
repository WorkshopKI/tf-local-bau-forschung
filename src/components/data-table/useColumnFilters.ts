/**
 * Spalten-Filter-State + -Anwendung fuer eine Tabelle (generisch).
 *
 * - Kandidaten je `filterable`-Spalte aus den EINGABE-Rows (vor Spaltenfilter),
 *   damit die Optionen nicht kollabieren, sobald ein Filter aktiv ist.
 * - Anwendung: AND ueber Spalten, OR innerhalb eines Spalten-Sets. Leeres Set
 *   == kein Filter.
 * - Filter-Wert je Zeile: `col.filterAccessor(row)` (Fallback `String(accessor)`).
 *
 * Spiegelt die Suche-Logik (`SuchSeite` filterCandidatesByColumn + columnFiltered)
 * als wiederverwendbaren Hook. Die reine Logik (`deriveFilterCandidates` /
 * `applyColumnFilters`) ist exportiert + testbar ohne React.
 *
 * ## Facetten-Zahlen (`facettenBasis` + `zaehleFacette`)
 *
 * Hinter jedem Wert im Dropdown steht, wie viele Zeilen er liefern wuerde. Die
 * Zahl ist eine **einseitige** Facette: alle ANDEREN aktiven Spaltenfilter
 * zaehlen mit, der EIGENE nicht — eine Achse, die ihre eigenen Zaehler
 * beschneidet, springt bei jedem Klick und macht die Auswahl unumkehrbar.
 *
 * Drei Dinge, die die Zahl bewusst NICHT ist:
 * - **Nicht die sichtbare Zeilenzahl der Tabelle.** Der Verbraucher darf die
 *   gefilterten Zeilen danach noch verdichten oder ausblenden (die Foerdertabelle
 *   tut beides: Verbund-Zeilen und die Beendet-Achse). Gezaehlt werden die
 *   Datensaetze, auf denen der Filter arbeitet.
 * - **Nicht reaktiv auf die Haekchen im offenen Dropdown.** Basis sind die
 *   ANGEWENDETEN Filter; solange das Dropdown offen ist, aendert sich nichts.
 * - **Summe <= Zeilenzahl der Basis.** Leerwerte sind kein Kandidat (siehe
 *   `deriveFilterCandidates`) und werden auch nicht gezaehlt.
 */
import { useCallback, useMemo, useState } from 'react';
import { DATA_TABLE_COLLATOR } from './compareValues';
import type { SortableColumn } from './types';

/** Wie der Filter-Wert einer Zelle gewonnen wird. Injizierbar, weil die Suche
 *  ihre Werte ueber `getColumnFilterValue` projiziert (`filterType: 'year'`) —
 *  mit dem Default rechneten Facette und Filter dort auseinander. */
export type FilterWertVon<T> = (col: SortableColumn<T>, row: T) => string;

/**
 * Optionale FREMDHALTUNG des Filterstands.
 *
 * Ohne sie hält der Hook seinen Stand selbst — unverändertes Verhalten für alle
 * Bestands-Aufrufer. Mit ihr liegt er beim Verbraucher (Fördertabelle:
 * `kopfFilter.ts`), weil ihn dort etwas anderes als der Spaltenkopf lesen und
 * setzen können muss (ein gemerkter Reiter). Ein zweiter, hook-eigener Stand
 * daneben liefe unweigerlich auseinander, deshalb ist es ein Entweder-oder.
 */
export interface ColumnFilterSteuerung {
  stand: Record<string, Set<string>>;
  /** Leeres Set = Filter dieser Spalte entfernen (wie im hook-eigenen Modus). */
  setzeSpalte: (key: string, werte: Set<string>) => void;
}

export interface UseColumnFiltersResult<T> {
  columnFilters: Record<string, Set<string>>;
  setColumnFilter: (key: string, values: Set<string>) => void;
  filterCandidates: Record<string, string[]>;
  filteredRows: T[];
  /** Facetten-Zahlen der Spalte `key` — gerechnet erst beim Aufruf (nur die
   *  gerade geoeffnete Spalte), danach gecacht bis Rows/Spalten/Filter wechseln. */
  filterCounts: (key: string) => ReadonlyMap<string, number>;
}

/** Filter-Wert einer Zelle (Fallback: stringifizierter Sort-Accessor). */
export function columnFilterValue<T>(col: SortableColumn<T>, row: T): string {
  if (col.filterAccessor) return col.filterAccessor(row);
  const v = col.accessor(row);
  return v === undefined || v === null ? '' : String(v);
}

/** Distinct Werte je filterbarer Spalte, alphabetisch (de-Collation) oder in der
 *  von der Spalte vorgegebenen Reihenfolge (`filterSort`). Pure. */
export function deriveFilterCandidates<T>(
  rows: T[],
  columns: SortableColumn<T>[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const col of columns) {
    if (!col.filterable) continue;
    const set = new Set<string>();
    for (const r of rows) {
      const v = columnFilterValue(col, r);
      if (v) set.add(v);
    }
    out[col.key] = Array.from(set).sort(col.filterSort ?? DATA_TABLE_COLLATOR.compare);
  }
  return out;
}

/** AND ueber Spalten, OR im Set. Leeres/fehlendes Set = kein Filter. Pure. */
export function applyColumnFilters<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  columnFilters: Record<string, ReadonlySet<string>>,
  wertVon: FilterWertVon<T> = columnFilterValue,
): T[] {
  const entries = Object.entries(columnFilters).filter(([, s]) => s.size > 0);
  if (entries.length === 0) return rows;
  const colByKey = new Map(columns.map(c => [c.key, c]));
  return rows.filter(r => entries.every(([key, set]) => {
    const col = colByKey.get(key);
    if (!col) return true;
    return set.has(wertVon(col, r));
  }));
}

/**
 * Zeilen, gegen die die Facette der Spalte `key` gerechnet wird: alle
 * Spaltenfilter AUSSER dem eigenen. Delegiert an `applyColumnFilters` — es soll
 * keine zweite Stelle geben, die weiss, wie ein Spaltenfilter wirkt. Pure.
 */
export function facettenBasis<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  columnFilters: Record<string, ReadonlySet<string>>,
  key: string,
  wertVon: FilterWertVon<T> = columnFilterValue,
): T[] {
  const ohneEigenen: Record<string, ReadonlySet<string>> = {};
  for (const [k, set] of Object.entries(columnFilters)) {
    if (k !== key) ohneEigenen[k] = set;
  }
  return applyColumnFilters(rows, columns, ohneEigenen, wertVon);
}

/**
 * Trefferzahl je Filterwert der Spalte ueber `basis`.
 *
 * Leerwerte (`''`) zaehlen nicht — sie sind auch kein Kandidat, es gaebe keine
 * Zeile im Dropdown, an der die Zahl stuende. Ein Wert mit 0 FEHLT im Ergebnis;
 * der Aufrufer liest `counts.get(v) ?? 0`. Pure.
 */
export function zaehleFacette<T>(
  basis: readonly T[],
  col: SortableColumn<T>,
  wertVon: FilterWertVon<T> = columnFilterValue,
): Map<string, number> {
  const zaehler = new Map<string, number>();
  for (const r of basis) {
    const v = wertVon(col, r);
    if (!v) continue;
    zaehler.set(v, (zaehler.get(v) ?? 0) + 1);
  }
  return zaehler;
}

export function useColumnFilters<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  steuerung?: ColumnFilterSteuerung,
): UseColumnFiltersResult<T> {
  // Der hook-eigene Stand wird IMMER angelegt (Hook-Reihenfolge bleibt gleich),
  // aber nur gelesen, wenn keine Fremdhaltung übergeben ist.
  const [eigenerStand, setEigenerStand] = useState<Record<string, Set<string>>>({});
  const columnFilters = steuerung ? steuerung.stand : eigenerStand;

  const fremdSetzen = steuerung?.setzeSpalte;
  const setColumnFilter = useCallback((key: string, values: Set<string>): void => {
    if (fremdSetzen) { fremdSetzen(key, values); return; }
    setEigenerStand(prev => {
      const next = { ...prev };
      if (values.size === 0) delete next[key]; else next[key] = values;
      return next;
    });
  }, [fremdSetzen]);

  const filterCandidates = useMemo(() => deriveFilterCandidates(rows, columns), [rows, columns]);
  const filteredRows = useMemo(() => applyColumnFilters(rows, columns, columnFilters), [rows, columns, columnFilters]);

  // Ein Cache je Generation (Rows/Spalten/Filter). Bewusst mutierend: gerechnet
  // wird nur die Spalte, deren Dropdown gerade offen ist — ein Record ueber ALLE
  // filterbaren Spalten waeren in der Foerdertabelle ~25 Durchlaeufe a ~8.000
  // Zeilen bei jedem Filterklick statt einem beim Oeffnen. Verwirft React den
  // Memo, wird neu gerechnet — nie falsch, nur noch einmal.
  const zaehlerCache = useMemo(
    () => new Map<string, Map<string, number>>(),
    [rows, columns, columnFilters],
  );
  const filterCounts = useCallback((key: string): ReadonlyMap<string, number> => {
    let treffer = zaehlerCache.get(key);
    if (!treffer) {
      const col = columns.find(c => c.key === key);
      treffer = col
        ? zaehleFacette(facettenBasis(rows, columns, columnFilters, key), col)
        : new Map<string, number>();
      zaehlerCache.set(key, treffer);
    }
    return treffer;
  }, [zaehlerCache, rows, columns, columnFilters]);

  return { columnFilters, setColumnFilter, filterCandidates, filteredRows, filterCounts };
}
