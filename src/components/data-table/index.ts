/**
 * Barrel-Export fuer den generischen Tabellen-Baustein.
 * Konsumenten: Suche-Plugin (SearchColumn extends SortableColumn,
 * compareValues + SortIcon + ColumnPicker), Auslastungs-Plugin
 * (Klassifizierungs-Tabelle).
 */
export type { SortableColumn, SortDirection, MessSchrift, SpaltenHilfe } from './types';
export { SpaltenHilfeInhalt } from './SpaltenHilfeInhalt';
export {
  berechneAutoBreiten,
  kopfBreite,
  messTextVon,
  waehleMesskandidaten,
  MESS_DEFAULTS,
  type MessOptionen,
  type MesseBreite,
} from './messung/spaltenBreite';
export { useAutoColumnWidths, type AutoColumnWidthsParams } from './messung/useAutoColumnWidths';
export { compareValues, DATA_TABLE_COLLATOR } from './compareValues';
export {
  useTableSort,
  ladeSortStand,
  speichereSortStand,
  type UseTableSortResult,
  type SortStand,
} from './useTableSort';
export { useColumnVisibility, type UseColumnVisibilityResult } from './useColumnVisibility';
export { useColumnWidths, type UseColumnWidthsResult } from './useColumnWidths';
export { ladeBreiten, speichereBreiten, entferneBreite } from './columnWidthStorage';
export {
  useTotalTableWidth,
  inhaltsBreiteKey,
  ladeGesamtBreite,
  speichereGesamtBreite,
  ladeInhaltsBreite,
  speichereInhaltsBreite,
  type UseTotalTableWidthResult,
} from './useTotalTableWidth';
export { SortIcon, type SortIconProps } from './SortIcon';
export {
  ColumnPicker,
  gruppiereSpalten,
  type ColumnPickerProps,
  type SpaltenRubrik,
} from './ColumnPicker';
export {
  SortableTable,
  DEFAULT_MIN_COLUMN_WIDTH,
  type SortableTableProps,
} from './SortableTable';
export type { KopfHoehen } from './TableHeadRows';
export { ColumnFilterDropdown, type ColumnFilterDropdownProps } from './ColumnFilterDropdown';
export {
  useColumnFilters,
  facettenBasis,
  zaehleFacette,
  type UseColumnFiltersResult,
  type ColumnFilterSteuerung,
  type FilterWertVon,
} from './useColumnFilters';
export {
  computeTableSizing,
  effectiveColumnWidth,
  DEFAULT_COLUMN_WIDTH,
  RESPONSIVE_MIN_WIDTH,
  type TableSizing,
  type TableSizingOptions,
} from './tableSizing';
export {
  leiteModus,
  leiteTabellenStil,
  leiteKastenStil,
  wrapperKlassen,
  istScrollModus,
  type TabellenModus,
  type TabellenStilOptionen,
} from './tableLayout';
