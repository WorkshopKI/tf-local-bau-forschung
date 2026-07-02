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
export { ColumnPicker, type ColumnPickerProps } from './ColumnPicker';
export { SortableTable, type SortableTableProps } from './SortableTable';
export { ColumnFilterDropdown, type ColumnFilterDropdownProps } from './ColumnFilterDropdown';
export { useColumnFilters, type UseColumnFiltersResult } from './useColumnFilters';
