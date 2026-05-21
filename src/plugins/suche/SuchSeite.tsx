import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { Badge } from '@/ui';
import { useUnifiedSearch } from '@/core/hooks/useUnifiedSearch';
import { isBauantraegeEnabled } from '@/config/feature-flags';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { SEARCH_COLUMNS, buildDynamicColumns, getColumnByKey, type SearchColumn } from './columns';
import { useSucheStore } from './store';
import { SearchToolbar } from './SearchToolbar';
import { SearchResultsTable } from './SearchResultsTable';
import { exportCSV, exportClipboard, exportXLSX } from './export';
import { useAnalysePipeline } from './useAnalysePipeline';
import { AnalysePipelineView } from './AnalysePipelineView';
import { ValidationBanner } from './ValidationBanner';
import {
  matchesPillFilter, compareValues, countResultsByType,
  type SuchePillFilterId,
} from './suchseite-utils';

type FilterId = SuchePillFilterId;

const DEFAULT_SORT_KEY = 'score';

export function SuchSeite(): React.ReactElement {
  const navigate = useNavigate();
  const visibleColumns = useSucheStore(s => s.visibleColumns);
  const analyse = useAnalysePipeline();

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterId>('');
  const [sortKey, setSortKey] = useState<string | null>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [toast, setToast] = useState<string | null>(null);

  const { results: searchResults, loading, counts, indexInfo, vectorReady } = useUnifiedSearch(query);
  const showBauantraege = isBauantraegeEnabled();
  const analyseActive = analyse.result !== null;

  // Wenn ein Analyse-Ergebnis vorliegt, zeigen wir das statt der Live-Suche.
  const dataSource: UnifiedSearchResult[] = analyse.result?.results ?? searchResults;
  const dynamicColumns = useMemo(
    () => analyse.result ? buildDynamicColumns(analyse.result.dynamicColumnKeys) : [],
    [analyse.result],
  );

  const handleQueryChange = (next: string): void => {
    setQuery(next);
    if (analyseActive) analyse.reset();
  };

  const filterChips = useMemo(() => {
    const pillCounts = countResultsByType(dataSource);
    const base: Array<{ id: FilterId; label: string; count: number }> = [
      { id: '', label: 'Alle', count: dataSource.length },
      { id: 'antrag', label: 'Foerderantraege', count: pillCounts.antraege },
      { id: 'dokument', label: 'Dokumente', count: pillCounts.dokumente },
    ];
    if (showBauantraege) base.push({ id: 'bauantrag', label: 'Bauantraege', count: pillCounts.bauantraege });
    return base;
  }, [dataSource, showBauantraege]);

  const pillFiltered = useMemo(
    () => dataSource.filter(r => matchesPillFilter(r, typeFilter)),
    [dataSource, typeFilter],
  );

  const allColumns = useMemo(() => [...SEARCH_COLUMNS, ...dynamicColumns], [dynamicColumns]);

  const filterCandidatesByColumn = useMemo<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const col of allColumns) {
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
  }, [pillFiltered, allColumns]);

  const columnFiltered = useMemo(() => {
    const entries = Object.entries(columnFilters).filter(([, set]) => set.size > 0);
    if (entries.length === 0) return pillFiltered;
    return pillFiltered.filter(r => entries.every(([key, set]) => {
      const col = allColumns.find(c => c.key === key) ?? getColumnByKey(key);
      if (!col) return true;
      const v = col.accessor(r);
      const s = v === undefined || v === null ? '' : String(v);
      return set.has(s);
    }));
  }, [pillFiltered, columnFilters, allColumns]);

  const sorted = useMemo(() => {
    if (!sortKey) return columnFiltered;
    const col = allColumns.find(c => c.key === sortKey) ?? getColumnByKey(sortKey);
    if (!col) return columnFiltered;
    const copy = [...columnFiltered];
    copy.sort((a, b) => compareValues(col.accessor(a), col.accessor(b), sortDirection));
    return copy;
  }, [columnFiltered, sortKey, sortDirection, allColumns]);

  const visibleColumnDefs = useMemo<SearchColumn[]>(() => {
    const visibleSet = new Set(visibleColumns);
    const staticCols = SEARCH_COLUMNS.filter(c => visibleSet.has(c.key));
    // Dynamische Spalten sind in der aktiven Analyse immer sichtbar.
    return [...staticCols, ...dynamicColumns];
  }, [visibleColumns, dynamicColumns]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleSort(key: string): void {
    if (sortKey !== key) { setSortKey(key); setSortDirection('asc'); return; }
    if (sortDirection === 'asc') { setSortDirection('desc'); return; }
    setSortKey(null);
  }

  function handleColumnFilterChange(key: string, values: Set<string>): void {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (values.size === 0) delete next[key]; else next[key] = values;
      return next;
    });
  }

  function handleRowClick(r: UnifiedSearchResult): void {
    if (r.type === 'antrag' && r.fkz) navigate(`/antraege/${encodeURIComponent(r.fkz)}`);
  }

  const startAnalyse = (): void => {
    if (!query.trim() || analyse.running || !analyse.available) return;
    analyse.start(query.trim());
  };

  const aiButtonDisabled = !query.trim() || analyse.running || analyse.checkingAvailability || !analyse.available;
  const aiButtonTooltip = !analyse.available
    ? `KI-Analyse nicht verfuegbar (${analyse.providerName} nicht erreichbar)`
    : `Aktive LLM: ${analyse.providerName}`;

  const noQuery = !query.trim();
  const showStepper = analyse.running && analyse.progress;
  const showResults = !showStepper && !noQuery && !loading && sorted.length > 0;
  const validation = analyse.result?.validation ?? null;

  return (
    <div className="px-8 pt-4 pb-6 max-w-[1400px]">
      <div className="flex flex-col items-start mb-4">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-4">Suche</h1>
        <div className="flex items-center gap-2 w-full max-w-3xl">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
            <input
              data-tour="search-input"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              disabled={analyse.running}
              placeholder="Suche oder analytische Frage…"
              autoFocus
              className="w-full pl-10 pr-4 py-3 text-[14px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius-lg)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)] disabled:opacity-60"
              style={{ border: '0.5px solid var(--tf-border)' }}
            />
          </div>
          <button
            type="button"
            onClick={startAnalyse}
            disabled={aiButtonDisabled}
            title={aiButtonTooltip}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <Sparkles size={14} />
            <span>Mit KI analysieren</span>
          </button>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {filterChips.map(chip => {
            const active = typeFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setTypeFilter(chip.id)}
                disabled={analyse.running}
                className={`px-3 py-1 text-[12px] rounded-full cursor-pointer transition-colors ${
                  active ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                } disabled:opacity-50`}
                style={!active ? { border: '0.5px solid var(--tf-border)' } : undefined}
              >
                {chip.label} <span className="opacity-70">{chip.count}</span>
              </button>
            );
          })}
          {!vectorReady && !analyseActive && <Badge variant="default">Embedding-Modell laedt…</Badge>}
          {analyseActive && (
            <button
              type="button"
              onClick={() => { analyse.reset(); setQuery(''); }}
              className="px-3 py-1 text-[12px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              Neue Analyse
            </button>
          )}
        </div>
      </div>

      {analyse.error && (
        <div className="mb-3 px-3 py-2 text-[12px] text-[var(--tf-text)] rounded"
          style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}>
          KI-Analyse fehlgeschlagen: {analyse.error}
        </div>
      )}

      {validation && <ValidationBanner validation={validation} />}

      {!showStepper && (
        <SearchToolbar
          disabled={sorted.length === 0}
          typeFilter={typeFilter}
          onExportCSV={() => exportCSV(sorted, visibleColumnDefs, query)}
          onExportXLSX={() => exportXLSX(sorted, visibleColumnDefs, query)}
          onExportClipboard={() => {
            void (async () => {
              try {
                await exportClipboard(sorted, visibleColumnDefs);
                setToast(`${sorted.length} Ergebnisse in Zwischenablage kopiert`);
              } catch { setToast('Kopieren fehlgeschlagen'); }
            })();
          }}
        />
      )}

      {toast && (
        <div role="status" className="mb-3 px-3 py-2 text-[12px] text-[var(--tf-text)] rounded"
          style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}>
          {toast}
        </div>
      )}

      {showStepper && analyse.progress && <AnalysePipelineView progress={analyse.progress} onCancel={analyse.cancel} />}
      {!showStepper && loading && <p className="text-[13px] text-[var(--tf-text-secondary)] text-center py-4">Suche…</p>}

      {!showStepper && noQuery && !loading && (
        <div className="text-center py-16">
          <Search size={40} className="text-[var(--tf-text-tertiary)] mx-auto mb-4" />
          <p className="text-[var(--tf-text-tertiary)]">
            {indexInfo.dokumenteImIndex.toLocaleString('de-DE')} Dokumente im Index ·{' '}
            {indexInfo.antraegeGeladen.toLocaleString('de-DE')} Antraege geladen
          </p>
        </div>
      )}

      {!showStepper && !noQuery && !loading && sorted.length === 0 && !analyseActive && (
        <div className="text-center py-16">
          <p className="text-[var(--tf-text-secondary)]">Keine Ergebnisse fuer &quot;{query}&quot;</p>
        </div>
      )}

      {showResults && (
        <>
          <div className="flex items-center justify-between mb-2 text-[11px] text-[var(--tf-text-tertiary)]">
            <span>
              {sorted.length} Ergebnisse{analyseActive ? ' (KI-Analyse)' : ''}
            </span>
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

      {/* searchResults-Counts (top-line via useUnifiedSearch) bleiben verfuegbar im Hover/Debug */}
      <span className="sr-only">{`unified-search: total=${counts.total} antraege=${counts.antraege} dokumente=${counts.dokumente}`}</span>
    </div>
  );
}

