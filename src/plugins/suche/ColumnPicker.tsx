/**
 * Dropdown zum Ein-/Ausblenden von Tabellen-Spalten (Such-Wrapper).
 *
 * Bindet den `useSucheStore` (LocalStorage: `teamflow_suche_visible_columns`)
 * an den generischen `ColumnPicker` aus `@/components/data-table`. Visuelles
 * Greying fuer Antrag-/Dokument-spezifische Spalten haengt am aktuellen
 * Typ-Pill-Filter — die Verfuegbarkeit wird NICHT eingeschraenkt (Spec).
 */
import { ColumnPicker as GenericColumnPicker } from '@/components/data-table';
import { SEARCH_COLUMNS, type SearchColumn } from './columns';
import { useSucheStore } from './store';

export interface ColumnPickerProps {
  /** Aktiver Typ-Filter aus den Pills — beeinflusst nur das visuelle
   *  Greying-out, NICHT die Verfuegbarkeit der Spalten. */
  typeFilter: '' | 'antrag' | 'dokument';
  /** Spalten, die die Seite gerade selbst einblendet, weil sie den Beleg des
   *  Treffers tragen (`autoSpalten.ts`). Der geteilte Picker zeigt sie angehakt,
   *  deaktiviert und mit der Marke „auto" — und zaehlt sie mit, sonst stimmte
   *  „x von y" nicht mehr mit der Tabelle ueberein. */
  erzwungeneKeys?: readonly string[];
}

export function ColumnPicker({
  typeFilter, erzwungeneKeys,
}: ColumnPickerProps): React.ReactElement {
  const visibleColumns = useSucheStore(s => s.visibleColumns);
  const toggleColumn = useSucheStore(s => s.toggleColumn);

  return (
    <GenericColumnPicker
      columns={SEARCH_COLUMNS}
      visibleKeys={visibleColumns}
      onToggleColumn={toggleColumn}
      erzwungeneKeys={erzwungeneKeys}
      isGrayed={col => {
        // Sicheres Down-Cast — `SEARCH_COLUMNS` ist `SearchColumn[]`, der
        // generische Picker fasst die Spalten als `SortableColumn<...>`.
        const c = col as SearchColumn;
        return (typeFilter === 'dokument' && c.appliesTo === 'antrag')
          || (typeFilter === 'antrag' && c.appliesTo === 'dokument');
      }}
    />
  );
}
