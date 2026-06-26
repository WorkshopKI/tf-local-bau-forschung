/**
 * Tabellenansicht der Anfragen über den generischen `SortableTable`-Baustein
 * (Betreff · Absender · Status · Aufgenommen · Anhänge · Löschen). Spalten-Klick
 * öffnet das Detail; Default-Sortierung nach Aufnahmedatum (neueste zuerst).
 */
import { useMemo } from 'react';
import { SortableTable, useTableSort, type SortableColumn } from '@/components/data-table';
import { AnfrageStatusBadge } from './AnfrageStatusBadge';
import { AnfrageDeleteControl } from './AnfrageDeleteControl';
import { formatAnfrageDatum } from './format';
import { statusIndex } from './status';
import type { Anfrage } from './types';

interface Props {
  anfragen: Anfrage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AnfrageTabelle({ anfragen, selectedId, onSelect }: Props): React.ReactElement {
  const columns = useMemo<SortableColumn<Anfrage>[]>(() => [
    {
      key: 'betreff', label: 'Betreff', defaultVisible: true, sortable: true, width: 280, wrap: true,
      accessor: a => a.betreff || '',
      render: a => (
        <span className="text-[var(--tf-text)]">{a.betreff || '(ohne Betreff)'}</span>
      ),
    },
    {
      key: 'absender', label: 'Absender', defaultVisible: true, sortable: true, width: 200,
      accessor: a => a.absenderEmail || '',
      render: a => <span className="text-[var(--tf-text-secondary)]">{a.absenderEmail || '—'}</span>,
    },
    {
      key: 'status', label: 'Status', defaultVisible: true, sortable: true, width: 150, wrap: false,
      accessor: a => statusIndex(a.status),
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

  const { sortKey, sortDirection, toggleSort, sortedRows } = useTableSort(anfragen, columns, 'datum', 'desc');

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
      emptyContent="Keine Anfragen."
    />
  );
}
