/**
 * Spalten-Konfiguration fuer die Excel-artige Suchtabelle.
 *
 * Pro Spalte:
 *  - `accessor`: liefert den sortier-/filterbaren Rohwert (auch fuer Export).
 *  - `render`: liefert das JSX fuer eine Zelle.
 *
 * Konvention: leere Zellen liefern `''` aus `accessor` und `null` aus `render`,
 * damit Sortierung deterministisch ist und Tailwind keinen Layout-Shift macht.
 */
import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { Badge } from '@/ui';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { getStatusCategoryColor } from '@/plugins/antraege/groupAggregates';

export type SearchColumnAppliesTo = 'both' | 'antrag' | 'dokument';

export interface SearchColumn {
  key: string;
  label: string;
  width: number | 'auto';
  defaultVisible: boolean;
  sortable: boolean;
  filterable: boolean;
  locked?: boolean;
  appliesTo: SearchColumnAppliesTo;
  accessor: (r: UnifiedSearchResult) => string | number;
  render: (r: UnifiedSearchResult) => ReactNode;
}

const METHOD_LABELS: Record<string, string> = {
  fulltext: 'BM25', vector: 'Vektor', hybrid: 'Hybrid',
};

function safeString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function MethodPill({ method }: { method: string }): ReactNode {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
      {METHOD_LABELS[method] ?? method}
    </span>
  );
}

function TypeBadge({ r }: { r: UnifiedSearchResult }): ReactNode {
  if (r.type === 'antrag') {
    const dotColor = r.statusKategorie ? getStatusCategoryColor(r.statusKategorie) : '#d1d5db';
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-800">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
        Antrag
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-violet-50 text-violet-800">
      <FileText size={10} aria-hidden />
      Dok
    </span>
  );
}

function StatusBadge({ r }: { r: UnifiedSearchResult }): ReactNode {
  if (r.type !== 'antrag' || !r.status) return null;
  const color = r.statusKategorie ? getStatusCategoryColor(r.statusKategorie) : '#9ca3af';
  return (
    <span
      className="inline-block text-[11px] px-2 py-0.5 rounded"
      style={{ backgroundColor: `${color}22`, color, border: `0.5px solid ${color}44` }}
      title={r.statusKategorie}
    >
      {r.status}
    </span>
  );
}

export const SEARCH_COLUMNS: SearchColumn[] = [
  {
    key: 'type', label: 'Typ', width: 80, defaultVisible: true,
    sortable: false, filterable: true, appliesTo: 'both',
    accessor: r => r.type === 'antrag' ? 'Antrag' : (r.dokumentTyp ?? 'Dokument'),
    render: r => <TypeBadge r={r} />,
  },
  {
    key: 'fkzDatei', label: 'FKZ / Datei', width: 130, defaultVisible: true,
    sortable: true, filterable: false, appliesTo: 'both',
    accessor: r => r.type === 'antrag' ? safeString(r.fkz) : safeString(r.dateiname),
    render: r => r.type === 'antrag'
      ? <span className="font-mono text-[12px] text-[var(--tf-text)]">{r.fkz}</span>
      : <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.dateiname}>{r.dateiname}</span>,
  },
  {
    key: 'programm', label: 'Programm', width: 100, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'both',
    accessor: r => safeString(r.programm ?? r.zugehoerigesProgramm),
    render: r => (
      <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">
        {r.programm ?? r.zugehoerigesProgramm ?? ''}
      </span>
    ),
  },
  {
    key: 'titelInhalt', label: 'Titel / Inhalt', width: 'auto', defaultVisible: true,
    sortable: true, filterable: false, locked: true, appliesTo: 'both',
    accessor: r => safeString(r.title),
    render: r => (
      <div className="min-w-0">
        <span className="font-medium text-[13px] text-[var(--tf-text)]">{r.title}</span>
        {r.snippet && (
          <>
            <span className="text-[12px] text-[var(--tf-text-tertiary)]"> — </span>
            <span className="text-[12px] text-[var(--tf-text-secondary)]">{r.snippet}</span>
          </>
        )}
      </div>
    ),
  },
  {
    key: 'status', label: 'Status', width: 110, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.status),
    render: r => <StatusBadge r={r} />,
  },
  {
    key: 'score', label: 'Relevanz', width: 80, defaultVisible: true,
    sortable: true, filterable: false, appliesTo: 'both',
    accessor: r => r.score,
    render: r => (
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[12px] text-[var(--tf-text)]">{r.score.toFixed(2)}</span>
        <MethodPill method={r.method} />
      </span>
    ),
  },
  {
    key: 'antragsteller', label: 'Antragsteller', width: 180, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.antragsteller),
    render: r => r.antragsteller
      ? <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.antragsteller}>{r.antragsteller}</span>
      : null,
  },
  {
    key: 'antragsdatum', label: 'Antragsdatum', width: 100, defaultVisible: false,
    sortable: true, filterable: false, appliesTo: 'antrag',
    accessor: r => safeString(r.antragsdatum),
    render: r => r.antragsdatum
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono">{r.antragsdatum}</span>
      : null,
  },
  {
    key: 'nwGroesse', label: 'NW-Groesse', width: 90, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.nwGroesse),
    render: r => r.nwGroesse
      ? <span className="text-[12px] text-[var(--tf-text)]">{r.nwGroesse}</span>
      : null,
  },
  {
    key: 'kategorie', label: 'Kategorie', width: 100, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.kategorie),
    render: r => r.kategorie
      ? <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.kategorie}>{r.kategorie}</span>
      : null,
  },
  {
    key: 'dokumentTyp', label: 'Dokumenttyp', width: 110, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'dokument',
    accessor: r => safeString(r.dokumentTyp),
    render: r => r.dokumentTyp
      ? <Badge variant="default">{r.dokumentTyp}</Badge>
      : null,
  },
  {
    key: 'method', label: 'Suchmethode', width: 90, defaultVisible: false,
    sortable: false, filterable: true, appliesTo: 'both',
    accessor: r => safeString(r.method),
    render: r => <MethodPill method={r.method} />,
  },
];

export const DEFAULT_VISIBLE_COLUMN_KEYS: string[] =
  SEARCH_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);

export const LOCKED_COLUMN_KEYS: string[] =
  SEARCH_COLUMNS.filter(c => c.locked).map(c => c.key);

export function getColumnByKey(key: string): SearchColumn | undefined {
  return SEARCH_COLUMNS.find(c => c.key === key);
}
