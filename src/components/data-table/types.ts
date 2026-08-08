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

/** Schrift-Profil einer Zelle für die Breiten-Messung. Welche Pixel dahinter
 *  stehen, sagt `messung/textMessung.ts` — hier ist es nur ein Etikett. Der Typ
 *  wohnt bei `SortableColumn`, damit die Messung von den Typen abhängt und
 *  nicht umgekehrt.
 *
 *  Die drei `band*`-Profile gehören keiner Spalte: Balkenschrift,
 *  Spur-Beschriftung und Kürzel-Etage des VerlaufsBands, des ersten
 *  Verbrauchers der Messung außerhalb der Tabelle. */
export type MessSchrift =
  | 'zelle' | 'zelleKlein' | 'mono' | 'monoKlein' | 'badge' | 'kopf'
  | 'bandLabel' | 'bandSpur' | 'bandKuerzel';

export interface SortableColumn<T> {
  /** Stabiler Identifier — wird als Key, fuer Persistenz und Sort-State genutzt. */
  key: string;
  /** Anzeige-Label im Header und im Spalten-Picker. */
  label: string;
  /** Optionale Rubrik im Spalten-Picker (z.B. „Termine"). Wer sie nicht setzt,
   *  bekommt die Liste wie zuvor — ohne Überschriften. Die Reihenfolge der
   *  Rubriken folgt dem ersten Auftreten in der Spaltenliste. */
  gruppe?: string;
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
  /** Reihenfolge der Filter-Kandidaten. Default: `DATA_TABLE_COLLATOR.compare`
   *  (alphabetisch, de-Collation). Die Sortier-Hoheit liegt damit an EINER
   *  Stelle — der Spaltendefinition; das Filter-Dropdown ordnet nichts um. */
  filterSort?: (a: string, b: string) => number;
  /** Gruppe eines Filterwerts; der Gruppenschluessel ist zugleich seine
   *  Beschriftung. `null` = ungruppiert (haengt hinter den Gruppen). Gesetzt,
   *  rendert das Dropdown eine zweistufige Checkbox-Liste statt einer flachen. */
  filterGroupOf?: (value: string) => string | null;
  /** Export-spezifischer Zellwert (XLSX/CSV). Default: `accessor(row)`. Noetig wenn
   *  der Sort-`accessor` export-untauglich ist (z.B. ein Sentinel-Wert fuer leere
   *  Felder, der in Excel als grosse Zahl erscheinen wuerde). */
  exportValue?: (row: T) => string | number;

  // — Inhaltsabhängige Spaltenbreite (siehe `messung/spaltenBreite.ts`). Alle
  //   optional; ohne sie misst die Spalte über `exportValue ?? accessor`.

  /** Text, an dem die Spaltenbreite gemessen wird. Nur nötig, wo Anzeige und
   *  Export auseinandergehen (z.B. eine Geldspalte, deren Export bewusst die
   *  rohe Zahl liefert, während die Zelle `1.234.567 €` zeigt). */
  messText?: (row: T) => string;
  /** Schrift-Profil der Zelle. Default `'zelle'` (12,5px sans). */
  messSchrift?: MessSchrift;
  /** Pixel für Nicht-Text in der Zelle (Ampelpunkt, Badge-Polster, Icon-Knopf),
   *  die `measureText` nicht sieht. */
  messZuschlag?: number;
  /** Untergrenze der gemessenen Breite. Default: globale Untergrenze. */
  minWidth?: number;
  /** Obergrenze der gemessenen Breite — hält Freitext davon ab, die Tabelle
   *  aufzublasen. Default: globale Obergrenze. */
  maxWidth?: number;
  /** `false`: nicht messen, die gepflegte `width` gilt. Für Zellen, deren
   *  Platzbedarf kein Text ist (Eingabefelder, Auswahlmenüs). */
  autoWidth?: boolean;
}
