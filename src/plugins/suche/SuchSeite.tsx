import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Badge } from '@/ui';
import { useUnifiedSearch } from '@/core/hooks/useUnifiedSearch';
import { isBauantraegeEnabled } from '@/config/feature-flags';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { SEARCH_COLUMNS, getColumnByKey, type SearchColumn } from './columns';
import { useSucheStore } from './store';
import { SearchToolbar } from './SearchToolbar';
import { SearchResultsTable } from './SearchResultsTable';
import { exportCSV, exportClipboard, exportXLSX } from './export';

type FilterId = '' | 'antrag' | 'dokument' | 'bauantrag';

const DEFAULT_SORT_KEY = 'score';

function matchesPillFilter(r: UnifiedSearchResult, filter: FilterId): boolean {
  if (filter === '') return true;
  if (filter === 'antrag') return r.type === 'antrag';
  if (filter === 'dokument') return r.type === 'dokument';
  if (filter === 'bauantrag') return r.type === 'dokument' && r.dokumentTyp === 'bauantrag';
  return true;
}

function compareValues(a: string | number, b: string | number, dir: 'asc' | 'desc'): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return dir === 'asc' ? a - b : b - a;
  }
  const sa = String(a);
  const sb = String(b);
  const cmp = sa.localeCompare(sb, 'de', { numeric: true, sensitivity: 'base' });
  return dir === 'asc' ? cmp : -cmp;
}

export function SuchSeite(): React.ReactElement {
  const navigate = useNavigate();
  const visibleColumns = useSucheStore(s => s.visibleColumns);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterId>('');
  const [sortKey, setSortKey] = useState<string | null>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [toast, setToast] = useState<string | null>(null);

  const { results, loading, counts, indexInfo, vectorReady } = useUnifiedSearch(query);

  const showBauantraege = isBauantraegeEnabled();

  const filterChips = useMemo(() => {
    const base: Array<{ id: FilterId; label: string; count: number }> = [
      { id: '', label: 'Alle', count: counts.total },
      { id: 'antrag', label: 'Foerderantraege', count: counts.antraege },
      { id: 'dokument', label: 'Dokumente', count: counts.dokumente },
    ];
    if (showBauantraege) {
      base.push({ id: 'bauantrag', label: 'Bauantraege', count: counts.bauantraege });
    }
    return base;
  }, [counts, showBauantraege]);

  // Pipeline: pillFiltered → columnFiltered → sorted
  const pillFiltered = useMemo(
    () => results.filter(r => matchesPillFilter(r, typeFilter)),
    [results, typeFilter],
  );

  // Filter-Candidates aus pillFiltered (vor Spalten-Filtern) — sonst kollabieren
  // die Werte im Dropdown wenn der User einen Filter angewendet hat.
  const filterCandidatesByColumn = useMemo<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const col of SEARCH_COLUMNS) {
      if (!col.filterable) continue;
      const set = new Set<string>();
      for (const r of pillFiltered) {
        const v = col.accessor(r);
        const s = v === undefined || v === null || v === '' ? '' : String(v);
        if (s) set.add(s);
      }
      out[col.key] = Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
    }
    return out;
  }, [pillFiltered]);

  const columnFiltered = useMemo(() => {
    const entries = Object.entries(columnFilters).filter(([, set]) => set.size > 0);
    if (entries.length === 0) return pillFiltered;
    return pillFiltered.filter(r => entries.every(([key, set]) => {
      const col = getColumnByKey(key);
      if (!col) return true;
      const v = col.accessor(r);
      const s = v === undefined || v === null ? '' : String(v);
      return set.has(s);
    }));
  }, [pillFiltered, columnFilters]);

  const sorted = useMemo(() => {
    if (!sortKey) return columnFiltered;
    const col = getColumnByKey(sortKey);
    if (!col) return columnFiltered;
    const copy = [...columnFiltered];
    copy.sort((a, b) => compareValues(col.accessor(a), col.accessor(b), sortDirection));
    return copy;
  }, [columnFiltered, sortKey, sortDirection]);

  const visibleColumnDefs = useMemo<SearchColumn[]>(
    () => SEARCH_COLUMNS.filter(c => visibleColumns.includes(c.key)),
    [visibleColumns],
  );

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleSort(key: string): void {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }
    if (sortDirection === 'asc') { setSortDirection('desc'); return; }
    // war 'desc' → toggle off
    setSortKey(null);
  }

  function handleColumnFilterChange(key: string, values: Set<string>): void {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (values.size === 0) delete next[key];
      else next[key] = values;
      return next;
    });
  }

  function handleRowClick(r: UnifiedSearchResult): void {
    if (r.type === 'antrag' && r.fkz) {
      navigate(`/antraege/${encodeURIComponent(r.fkz)}`);
    }
  }

  function handleExportCSV(): void {
    exportCSV(sorted, visibleColumnDefs, query);
  }

  function handleExportXLSX(): void {
    exportXLSX(sorted, visibleColumnDefs, query);
  }

  async function handleExportClipboard(): Promise<void> {
    try {
      await exportClipboard(sorted, visibleColumnDefs);
      setToast(`${sorted.length} Ergebnisse in Zwischenablage kopiert`);
    } catch {
      setToast('Kopieren fehlgeschlagen');
    }
  }

  const noQuery = !query.trim();

  return (
    <div className="px-8 pt-4 pb-6 max-w-[1400px]">
      <div className="flex flex-col items-start mb-4">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-4">Suche</h1>
        <div className="relative w-full max-w-xl">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
          <input
            data-tour="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Suche nach Foerderantraegen, Dokumenten..."
            autoFocus
            className="w-full pl-10 pr-4 py-3 text-[14px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius-lg)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          />
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {filterChips.map(chip => {
            const active = typeFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setTypeFilter(chip.id)}
                className={`px-3 py-1 text-[12px] rounded-full cursor-pointer transition-colors ${
                  active
                    ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]'
                    : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                }`}
                style={!active ? { border: '0.5px solid var(--tf-border)' } : undefined}
              >
                {chip.label} <span className="opacity-70">{chip.count}</span>
              </button>
            );
          })}
          {!vectorReady && <Badge variant="default">Embedding-Modell laedt…</Badge>}
        </div>
      </div>

      <SearchToolbar
        disabled={sorted.length === 0}
        typeFilter={typeFilter}
        onExportCSV={handleExportCSV}
        onExportXLSX={handleExportXLSX}
        onExportClipboard={() => { void handleExportClipboard(); }}
      />

      {/* Toast (inline, kein position: fixed wegen file:// Constraint) */}
      {toast && (
        <div
          role="status"
          className="mb-3 px-3 py-2 text-[12px] text-[var(--tf-text)] rounded"
          style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}
        >
          {toast}
        </div>
      )}

      {/* Info / Loading / Empty / Tabelle */}
      {loading && <p className="text-[13px] text-[var(--tf-text-secondary)] text-center py-4">Suche…</p>}

      {noQuery && !loading && (
        <div className="text-center py-16">
          <Search size={40} className="text-[var(--tf-text-tertiary)] mx-auto mb-4" />
          <p className="text-[var(--tf-text-tertiary)]">
            {indexInfo.dokumenteImIndex.toLocaleString('de-DE')} Dokumente im Index ·{' '}
            {indexInfo.antraegeGeladen.toLocaleString('de-DE')} Antraege geladen
          </p>
        </div>
      )}

      {!noQuery && !loading && sorted.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[var(--tf-text-secondary)]">Keine Ergebnisse fuer &quot;{query}&quot;</p>
        </div>
      )}

      {!noQuery && !loading && sorted.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2 text-[11px] text-[var(--tf-text-tertiary)]">
            <span>{sorted.length} Ergebnisse</span>
            <span>
              {indexInfo.dokumenteImIndex.toLocaleString('de-DE')} Dokumente im Index ·{' '}
              {indexInfo.antraegeGeladen.toLocaleString('de-DE')} Antraege geladen
            </span>
          </div>
          <SearchResultsTable
            results={sorted}
            columns={visibleColumnDefs}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            columnFilters={columnFilters}
            onColumnFilterChange={handleColumnFilterChange}
            filterCandidatesByColumn={filterCandidatesByColumn}
            onRowClick={handleRowClick}
          />
        </>
      )}
    </div>
  );
}
