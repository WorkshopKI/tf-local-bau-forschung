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
export { useTableSort, type UseTableSortResult } from './useTableSort';
export { useColumnVisibility, type UseColumnVisibilityResult } from './useColumnVisibility';
export { useColumnWidths, type UseColumnWidthsResult } from './useColumnWidths';
export {
  useTotalTableWidth,
  inhaltsBreiteKey,
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
export { ColumnFilterDropdown, type ColumnFilterDropdownProps } from './ColumnFilterDropdown';
export {
  useColumnFilters,
  facettenBasis,
  zaehleFacette,
  type UseColumnFiltersResult,
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
  wrapperKlassen,
  istScrollModus,
  type TabellenModus,
  type TabellenStilOptionen,
} from './tableLayout';
