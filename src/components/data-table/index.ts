/**
 * Barrel-Export fuer den generischen Tabellen-Baustein.
 * Konsumenten: Suche-Plugin (SearchColumn extends SortableColumn,
 * compareValues + SortIcon + ColumnPicker), Auslastungs-Plugin
 * (Klassifizierungs-Tabelle).
 */
export type { SortableColumn, SortDirection } from './types';
export { compareValues, DATA_TABLE_COLLATOR } from './compareValues';
export { useTableSort, type UseTableSortResult } from './useTableSort';
export { useColumnVisibility, type UseColumnVisibilityResult } from './useColumnVisibility';
export { useColumnWidths, type UseColumnWidthsResult } from './useColumnWidths';
export { useTotalTableWidth, type UseTotalTableWidthResult } from './useTotalTableWidth';
export { SortIcon, type SortIconProps } from './SortIcon';
export {
  ColumnPicker,
  gruppiereSpalten,
  type ColumnPickerProps,
  type SpaltenRubrik,
} from './ColumnPicker';
export { SortableTable, type SortableTableProps } from './SortableTable';
export { ColumnFilterDropdown, type ColumnFilterDropdownProps } from './ColumnFilterDropdown';
export { useColumnFilters, type UseColumnFiltersResult } from './useColumnFilters';
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
  TOTAL_GRIP_WIDTH,
  type TabellenModus,
  type TabellenStilOptionen,
} from './tableLayout';
