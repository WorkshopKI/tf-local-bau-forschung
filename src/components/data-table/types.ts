/**
 * Generische Tabellen-Bausteine — geteilt zwischen Suche und Auslastungs-
 * Klassifizierung.
 *
 * `SortableColumn<T>` beschreibt eine Spalte ohne Annahmen ueber die
 * Datenstruktur. Plugin-spezifische Erweiterungen (Filter, Resize, etc.)
 * werden via Interface-Extends ergaenzt — siehe `SearchColumn` im
 * Suche-Plugin.
 */
import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortableColumn<T> {
  /** Stabiler Identifier — wird als Key, fuer Persistenz und Sort-State genutzt. */
  key: string;
  /** Anzeige-Label im Header und im Spalten-Picker. */
  label: string;
  /** Sichtbar bei erstem Laden (kann vom User toggelt werden, ausser `locked`). */
  defaultVisible: boolean;
  /** Wenn `true`, kann die Spalte nicht ausgeblendet werden (z.B. Aktenzeichen). */
  locked?: boolean;
  /** Wenn `true`, ist der Header-Klick aktiv (Sort-Zyklus). */
  sortable: boolean;
  /** Default-Spaltenbreite in Pixel. Optional — Verbraucher kann auch ohne
   *  Fixed-Layout arbeiten. */
  width?: number;
  /** Wenn `true`: Zell-Inhalt wird umgebrochen statt ellipsis. Default false. */
  wrap?: boolean;
  /** Sort-/Export-Wert. Sollte primitiv sein (string | number). Leere Werte
   *  liefern `''` damit Sortierung deterministisch ist. */
  accessor: (row: T) => string | number;
  /** JSX fuer eine Zelle. Sollte `null` liefern wenn kein Inhalt. */
  render: (row: T) => ReactNode;
  /** Wenn `true`: Header zeigt einen Filter-Button (Dropdown mit den distinct
   *  Spaltenwerten). Nur wirksam, wenn der Tabellen-Verbraucher die Filter-Props
   *  durchreicht (z.B. `SortableTable` mit `columnFilters`/`filterCandidates`). */
  filterable?: boolean;
  /** Wert fuer Filter-Kandidaten + -Anwendung. Default: `String(accessor(row))`. */
  filterAccessor?: (row: T) => string;
  /** Anzeige-Mapper fuer die Filter-Dropdown-Werte. Default: Identitaet. */
  formatFilterLabel?: (value: string) => string;
}
