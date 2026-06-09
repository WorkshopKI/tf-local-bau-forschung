// Tabellarische Listen-Ansicht für das öffentliche Feedback-Board.
// Read-only: Sponsoring-Aktionen erfolgen in der Card-Ansicht.
//
// Sortier- + filterbare Spalten-Header über die generische data-table-Basis
// (wie die Suche-Tabelle): `SortableTable` + `useTableSort` + `useColumnFilters`.
// Default-Reihenfolge = die kuratierte Sortierung aus FeedbackBoardPage
// (sortKey=null → unverändert), bis der User eine Spalte sortiert. Die
// Spalten-Filter greifen ZUSÄTZLICH zu den Top-Chips (UND-kombiniert).

import { useMemo } from 'react';
import { getSponsoringProgress, isSponsorableCategory } from '@/core/services/feedback';
import { EFFORT_HOURS } from '@/core/types/feedback';
import type { EffortEstimate, FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import {
  SortableTable,
  useTableSort,
  useColumnFilters,
  useColumnWidths,
  type SortableColumn,
} from '@/components/data-table';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  EFFORT_SHORT_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from './constants';
import { feedbackAuthorLabel } from './feedbackUi';
import { FeedbackScreenshots } from './FeedbackScreenshots';

interface Props {
  tickets: FeedbackItem[];
  config: FeedbackConfig;
}

export function FeedbackBoardListView({ tickets, config }: Props): React.ReactElement {
  const columns = useMemo(() => buildColumns(config), [config]);
  const defaultWidths = useMemo(
    () => Object.fromEntries(columns.map(c => [c.key, c.width ?? 120])),
    [columns],
  );
  const { widths, setWidth } = useColumnWidths('tf-feedback-board-list-widths', defaultWidths);
  const { columnFilters, setColumnFilter, filterCandidates, filteredRows } = useColumnFilters(tickets, columns);
  const { sortKey, sortDirection, toggleSort, sortedRows } = useTableSort(filteredRows, columns, null, 'desc');

  return (
    <SortableTable
      rows={sortedRows}
      columns={columns}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={toggleSort}
      rowKey={t => t.id}
      columnFilters={columnFilters}
      onColumnFilterChange={setColumnFilter}
      filterCandidates={filterCandidates}
      columnWidths={widths}
      onColumnWidthChange={setWidth}
      emptyContent="Keine Einträge."
    />
  );
}

function effortRank(e?: EffortEstimate): number {
  return e ? EFFORT_HOURS[e] : 0;
}

function buildColumns(config: FeedbackConfig): SortableColumn<FeedbackItem>[] {
  return [
    {
      key: 'typ', label: 'Typ', defaultVisible: true, sortable: true, filterable: true, width: 96, wrap: false,
      accessor: t => (t.category ? CATEGORY_LABELS[t.category] : 'Unklassifiziert'),
      render: t => (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${t.category ? CATEGORY_COLORS[t.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]'}`}>
          {t.category ? CATEGORY_LABELS[t.category] : '–'}
        </span>
      ),
    },
    {
      key: 'bereich', label: 'Bereich', defaultVisible: true, sortable: true, filterable: true, width: 120, wrap: false,
      accessor: t => t.context?.page ?? '',
      filterAccessor: t => t.context?.page ?? '(kein)',
      render: t => (t.context?.page
        ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{t.context.page}</span>
        : <span className="text-[var(--tf-text-tertiary)]">—</span>),
    },
    {
      key: 'titel', label: 'Titel', defaultVisible: true, sortable: true, width: 360,
      accessor: t => t.llm_summary || t.text || '',
      render: t => <span className="text-[var(--tf-text)] whitespace-pre-wrap">{t.llm_summary || t.text || '–'}</span>,
    },
    {
      key: 'von', label: 'Von', defaultVisible: true, sortable: true, filterable: true, width: 120, wrap: false,
      accessor: t => feedbackAuthorLabel(t) ?? '',
      filterAccessor: t => feedbackAuthorLabel(t) ?? '(unbekannt)',
      render: t => {
        const author = feedbackAuthorLabel(t);
        return author
          ? <span className="text-[12px] text-[var(--tf-text-secondary)]">{author}</span>
          : <span className="text-[11px] text-[var(--tf-text-tertiary)]">—</span>;
      },
    },
    {
      key: 'antwort', label: 'Antwort', defaultVisible: true, sortable: true, filterable: true, width: 220, wrap: true,
      accessor: t => t.kurator_response?.trim() ?? '',
      filterAccessor: t => (t.kurator_response?.trim() ? 'beantwortet' : '(offen)'),
      render: t => {
        const response = t.kurator_response?.trim();
        return response
          ? <span className="text-[11.5px] text-[var(--tf-text)] whitespace-pre-wrap">{response}</span>
          : <span className="text-[11px] text-[var(--tf-text-tertiary)]">—</span>;
      },
    },
    {
      key: 'status', label: 'Status', defaultVisible: true, sortable: true, filterable: true, width: 120, wrap: false,
      accessor: t => STATUS_LABELS[t.kurator_status],
      render: t => (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${STATUS_COLORS[t.kurator_status]}`}>
          {STATUS_LABELS[t.kurator_status]}
        </span>
      ),
    },
    {
      key: 'sponsoring', label: 'Sponsoring', defaultVisible: true, sortable: true, width: 124, wrap: false,
      // Nicht-sponsorbar / ohne Aufwand → -1, damit sie unter den bewerteten landen.
      accessor: t => ((isSponsorableCategory(t.category) && t.effort_estimate) ? getSponsoringProgress(t, config).percentage : -1),
      render: t => {
        const progress = (isSponsorableCategory(t.category) && t.effort_estimate) ? getSponsoringProgress(t, config) : null;
        return progress ? (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
              <div
                className="h-full"
                style={{ width: `${progress.percentage}%`, background: progress.thresholdReached ? 'var(--tf-success-text)' : 'var(--tf-primary)' }}
              />
            </div>
            <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">{progress.percentage}%</span>
          </div>
        ) : <span className="text-[11px] text-[var(--tf-text-tertiary)]">—</span>;
      },
    },
    {
      key: 'aufwand', label: 'Aufwand', defaultVisible: true, sortable: true, filterable: true, width: 104, wrap: false,
      accessor: t => effortRank(t.effort_estimate),
      filterAccessor: t => t.effort_estimate ?? '(keiner)',
      formatFilterLabel: v => (v === '(keiner)' ? v : (EFFORT_SHORT_LABELS[v as EffortEstimate] ?? v)),
      render: t => <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{t.effort_estimate ? EFFORT_SHORT_LABELS[t.effort_estimate] : '—'}</span>,
    },
    {
      key: 'bilder', label: 'Bilder', defaultVisible: true, sortable: true, width: 96, wrap: true,
      // Sortwert = Anzahl Screenshots; Zelle rendert die kompakten Thumbnails
      // (Klick = Lightbox) bzw. „—" wenn keine vorhanden.
      accessor: t => t.attachments?.length ?? 0,
      render: t => (t.attachments && t.attachments.length > 0
        ? <FeedbackScreenshots attachments={t.attachments} compact />
        : <span className="text-[11px] text-[var(--tf-text-tertiary)]">—</span>),
    },
  ];
}
