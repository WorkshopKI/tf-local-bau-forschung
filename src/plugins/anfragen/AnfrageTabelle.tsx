/**
 * Tabellenansicht der Anfragen über den generischen `SortableTable`-Baustein.
 * Betreff · Absender · Art · Thema · Firma · Name · Status · Aufgenommen · Anhänge.
 * Die intern getaggten Metadaten (Antragsart/Themengruppe/Firma) sind automatisch
 * Spalten-Filter (Header-Dropdown); Spalten-Klick sortiert, Zeilen-Klick öffnet das
 * Detail.
 */
import { useMemo } from 'react';
import {
  SortableTable, useTableSort, useColumnFilters, useColumnWidths, type SortableColumn,
} from '@/components/data-table';
import { AnfrageStatusBadge } from './AnfrageStatusBadge';
import { AnfrageDeleteControl } from './AnfrageDeleteControl';
import { formatAnfrageDatum } from './format';
import { statusIndex, STATUS_LABEL } from './status';
import type { Anfrage } from './types';

interface Props {
  anfragen: Anfrage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Sentinel für leere/nicht getaggte Metadaten — wird ein echter Filter-Kandidat. */
const NICHT_GETAGGT = '(nicht getaggt)';

/** Zell-Render eines Metadaten-Felds: Wert, „…" (ausstehend/fehlt) oder Warn-Punkt. */
function metaCell(a: Anfrage, wert: string): React.ReactElement {
  if (a.metadaten?.status === 'fehlgeschlagen') {
    return <span className="text-[var(--tf-warning-text)]" title={a.metadaten.fehler}>⚠</span>;
  }
  if (!a.metadaten || a.metadaten.status !== 'getaggt') {
    return <span className="text-[var(--tf-text-tertiary)]">…</span>;
  }
  return wert
    ? <span className="text-[var(--tf-text-secondary)]">{wert}</span>
    : <span className="text-[var(--tf-text-tertiary)]">—</span>;
}

/** Filter-Wert eines Metadaten-Felds (Sentinel, wenn leer/nicht getaggt). */
const metaFilter = (a: Anfrage, wert: string | undefined): string =>
  (a.metadaten?.status === 'getaggt' && wert ? wert : NICHT_GETAGGT);

export function AnfrageTabelle({ anfragen, selectedId, onSelect }: Props): React.ReactElement {
  const columns = useMemo<SortableColumn<Anfrage>[]>(() => [
    {
      key: 'betreff', label: 'Betreff', defaultVisible: true, sortable: true, width: 240, wrap: true,
      accessor: a => a.betreff || '',
      render: a => (
        <span className="text-[var(--tf-text)]">{a.betreff || '(ohne Betreff)'}</span>
      ),
    },
    {
      key: 'absender', label: 'Absender', defaultVisible: true, sortable: true, width: 190,
      accessor: a => a.absenderEmail || '',
      render: a => <span className="text-[var(--tf-text-secondary)]">{a.absenderEmail || '—'}</span>,
    },
    {
      key: 'antragsart', label: 'Art', defaultVisible: true, sortable: true, filterable: true, width: 140, wrap: false,
      accessor: a => a.metadaten?.antragsart ?? '',
      filterAccessor: a => metaFilter(a, a.metadaten?.antragsart),
      render: a => metaCell(a, a.metadaten?.antragsart ?? ''),
    },
    {
      key: 'themengruppe', label: 'Thema', defaultVisible: true, sortable: true, filterable: true, width: 170, wrap: false,
      accessor: a => a.metadaten?.themengruppe ?? '',
      filterAccessor: a => metaFilter(a, a.metadaten?.themengruppe),
      render: a => metaCell(a, a.metadaten?.themengruppe ?? ''),
    },
    {
      key: 'firma', label: 'Firma', defaultVisible: true, sortable: true, filterable: true, width: 160, wrap: false,
      accessor: a => a.metadaten?.firma ?? '',
      filterAccessor: a => metaFilter(a, a.metadaten?.firma),
      render: a => metaCell(a, a.metadaten?.firma ?? ''),
    },
    {
      // Name: hohe Kardinalität → sortierbar, aber KEIN Dropdown-Filter.
      key: 'name', label: 'Name', defaultVisible: true, sortable: true, width: 140, wrap: false,
      accessor: a => a.metadaten?.name ?? '',
      render: a => metaCell(a, a.metadaten?.name ?? ''),
    },
    {
      key: 'status', label: 'Status', defaultVisible: true, sortable: true, filterable: true, width: 150, wrap: false,
      accessor: a => statusIndex(a.status),
      filterAccessor: a => STATUS_LABEL[a.status],
      render: a => <AnfrageStatusBadge status={a.status} />,
    },
    {
      key: 'datum', label: 'Aufgenommen', defaultVisible: true, sortable: true, width: 110, wrap: false,
      accessor: a => a.erstelltAm || '',
      render: a => <span className="text-[var(--tf-text-secondary)]">{formatAnfrageDatum(a.erstelltAm)}</span>,
    },
    {
      key: 'anhaenge', label: 'Anhänge', defaultVisible: true, sortable: true, width: 80, wrap: false,
      accessor: a => a.hatAnhaenge,
      render: a => <span className="text-[var(--tf-text-tertiary)]">{a.hatAnhaenge > 0 ? a.hatAnhaenge : '—'}</span>,
    },
    {
      key: 'actions', label: '', defaultVisible: true, sortable: false, width: 90, wrap: false,
      accessor: () => '',
      render: a => (
        <div className="flex justify-end">
          <AnfrageDeleteControl anfrage={a} />
        </div>
      ),
    },
  ], []);

  const defaultWidths = useMemo(
    () => Object.fromEntries(columns.map(c => [c.key, c.width ?? 120])),
    [columns],
  );
  const { widths, setWidth, resetWidth } = useColumnWidths('teamflow_anfragen_table_widths', defaultWidths);
  const { columnFilters, setColumnFilter, filterCandidates, filteredRows, filterCounts } = useColumnFilters(anfragen, columns);
  const { sortKey, sortDirection, toggleSort, sortedRows } = useTableSort(filteredRows, columns, 'datum', 'desc');

  return (
    <SortableTable
      rows={sortedRows}
      columns={columns}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={toggleSort}
      rowKey={a => a.id}
      onRowClick={a => onSelect(a.id)}
      isRowSelected={a => a.id === selectedId}
      columnFilters={columnFilters}
      onColumnFilterChange={setColumnFilter}
      filterCandidates={filterCandidates}
      filterCounts={filterCounts}
      columnWidths={widths}
      onColumnWidthChange={setWidth}
      onColumnWidthReset={resetWidth}
      emptyContent="Keine Anfragen."
    />
  );
}
