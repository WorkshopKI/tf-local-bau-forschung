// TODO(refactor v2.4+): 429 Zeilen — opportunistisch splitten, wenn diese Datei naechstes Mal angefasst wird.
// Vorschlag: SearchFilters.tsx + SearchResults.tsx + ResultDetails.tsx extrahieren.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessageCircle, Search, Sparkles } from 'lucide-react';
import { Badge } from '@/ui';
import { useUnifiedSearch, type SearchPhase } from '@/core/hooks/useUnifiedSearch';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { isBauantraegeEnabled } from '@/config/feature-flags';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { SEARCH_COLUMNS, buildDynamicColumns, getColumnByKey, getColumnFilterValue, type SearchColumn } from './columns';
import { useSucheStore } from './store';
import { ColumnPicker } from './ColumnPicker';
import { SearchDownloadMenu } from './SearchDownloadMenu';
import { SearchResultsTable } from './SearchResultsTable';
import { exportCSV, exportClipboard, exportXLSX } from './export';
import { useAnalysePipeline } from './useAnalysePipeline';
import { AnalysePipelineView } from './AnalysePipelineView';
import { ValidationBanner } from './ValidationBanner';
import {
  matchesPillFilter, compareValues, countResultsByType, SUCHE_COLLATOR,
  getSucheAntragstypItems, matchesSucheAntragstyp,
  type SuchePillFilterId,
} from './suchseite-utils';
import { CollapsibleSeg } from '@/plugins/antraege/filter/CollapsibleSeg';
import type { KategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import { scheduleIdle } from '@/core/utils/scheduleIdle';
import {
  getProgrammCaches,
  getEmbeddings,
} from '@/plugins/antraege/services/antraege-search-service';
import { ensureEmbeddingReady } from '@/core/services/embedding-corpus';

/** UI-Text fuer die Search-Phase-Badge. */
const PHASE_LABELS: Record<SearchPhase, string | null> = {
  idle: null,
  substring: 'Substring-Treffer…',
  vector: 'Embedding-Treffer…',
  orama: 'Dokumente…',
  done: null,
  error: null,
};

type FilterId = SuchePillFilterId;

const DEFAULT_SORT_KEY = 'score';
const COLUMN_WIDTHS_KEY = 'teamflow_suche_column_widths';
const MIN_COLUMN_WIDTH = 60;

function loadColumnWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COLUMN_WIDTHS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= MIN_COLUMN_WIDTH) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function SuchSeite(): React.ReactElement {
  const navigate = useNavigate();
  const visibleColumns = useSucheStore(s => s.visibleColumns);
  const analyse = useAnalysePipeline();
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);

  const [query, setQuery] = useState('');
  // Such-Pipeline laeuft auf der ge-deferreden Query, damit das Input-Feld
  // frame-perfect bleibt waehrend Orama+Embedding+Filter+Sort durchlaufen
  // (Pattern analog zum Foerderantraege-Plugin, useFilteredAntraege.ts).
  const deferredQuery = useDeferredValue(query);
  const [typeFilter, setTypeFilter] = useState<FilterId>('');
  const [antragstypFilter, setAntragstypFilter] = useState<KategorieLabel>('Alle');
  const [sortKey, setSortKey] = useState<string | null>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => loadColumnWidths());
  const [toast, setToast] = useState<string | null>(null);

  const handleColumnWidthChange = (key: string, width: number): void => {
    const clamped = Math.max(MIN_COLUMN_WIDTH, Math.round(width));
    setColumnWidths(prev => {
      const next = { ...prev, [key]: clamped };
      try { localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const { results: searchResults, loading, counts, indexInfo, vectorReady, searchPhase } = useUnifiedSearch(deferredQuery);
  // Phase-Badge nicht synchron-flackern lassen: deferred, damit React beim
  // Stage-Wechsel keine Render-Stalls macht.
  const deferredPhase = useDeferredValue(searchPhase);
  const phaseLabel = PHASE_LABELS[deferredPhase];
  const queryNotEmpty = query.trim() !== '';
  // Spinner sichtbar wenn entweder die Pipeline laeuft (loading) oder der
  // User getippt hat aber deferredQuery noch nicht durch (Initialer
  // useDeferredValue-Delay vor T=DEBOUNCE_MS — sonst stumme Phase).
  const showSpinner = loading || (queryNotEmpty && deferredPhase !== 'done' && deferredPhase !== 'error');
  const showBauantraege = isBauantraegeEnabled();
  const analyseActive = analyse.result !== null;

  // Eager Preload beim Mount der Suche-Seite (Hintergrund, idle). Loadet
  // Programm-Caches (Substring-Korpus ~1-1.5s) + Embedding-Modell (~2.5-4s) +
  // Embedding-Korpus (~0.2-0.4s) — alles Module-Level-Singletons mit Promise-
  // Dedup, sodass parallele Search-Calls dieselbe Promise reusen. Wenn der
  // User getippt hat bevor diese fertig sind, awaitet die Pipeline auf
  // dieselbe Promise (kein Doppel-Load).
  useEffect(() => {
    if (!activeProgrammId) return;
    const cancel = scheduleIdle(() => {
      void getProgrammCaches(storage.idb, activeProgrammId).catch(() => { /* best effort */ });
      void ensureEmbeddingReady(storage.idb).catch(() => { /* best effort */ });
      void getEmbeddings(storage.idb).catch(() => { /* best effort */ });
    });
    return cancel;
  }, [activeProgrammId, storage]);

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

  // Antragstyp ist ein Foerderantrag-Konzept (vb_phase → FuE/DS/DL/NW). Counts
  // ueber die gesamte Treffer-Liste (stabil). Sichtbar/aktiv nur fuer die
  // Antrag-Pills ('' = Alle, 'antrag') — bei Dokument-/Bauantrag-Pills waere er
  // irrelevant und wuerde die Liste leeren, daher dort nicht angewandt.
  const antragstypItems = useMemo(() => getSucheAntragstypItems(dataSource), [dataSource]);
  const antragstypApplicable = typeFilter === '' || typeFilter === 'antrag';
  const antragstypFiltered = useMemo(() => {
    if (antragstypFilter === 'Alle' || !antragstypApplicable) return pillFiltered;
    return pillFiltered.filter(r => matchesSucheAntragstyp(r, antragstypFilter));
  }, [pillFiltered, antragstypFilter, antragstypApplicable]);

  const allColumns = useMemo(() => [...SEARCH_COLUMNS, ...dynamicColumns], [dynamicColumns]);

  // Per-Result-Spalten-Cache fuer Filter-Werte. Erste Aggregation ueber 1000
  // Treffer × 14 Spalten = 14.000 Accessor-Calls; jede Folge-Aggregation
  // (Sort-Click, Filter-Toggle, Resize) ist dann nur noch Map.get statt
  // Funktionsaufruf. WeakMap-Refs werden mit den Result-Objekten GC'd, wenn
  // die naechste Query reinkommt — kein manuelles Invalidieren noetig.
  const filterValueCacheRef = useRef<WeakMap<UnifiedSearchResult, Map<string, string>>>(new WeakMap());

  const cachedFilterValue = (col: SearchColumn, r: UnifiedSearchResult): string => {
    const cache = filterValueCacheRef.current;
    let perResult = cache.get(r);
    if (!perResult) {
      perResult = new Map<string, string>();
      cache.set(r, perResult);
    }
    let v = perResult.get(col.key);
    if (v === undefined) {
      v = getColumnFilterValue(col, r);
      perResult.set(col.key, v);
    }
    return v;
  };

  const filterCandidatesByColumn = useMemo<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const col of allColumns) {
      if (!col.filterable) continue;
      const set = new Set<string>();
      for (const r of pillFiltered) {
        const s = cachedFilterValue(col, r);
        if (s) set.add(s);
      }
      out[col.key] = Array.from(set).sort(SUCHE_COLLATOR.compare);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cachedFilterValue ist stable per ref
  }, [pillFiltered, allColumns]);

  const columnFiltered = useMemo(() => {
    const entries = Object.entries(columnFilters).filter(([, set]) => set.size > 0);
    if (entries.length === 0) return antragstypFiltered;
    return antragstypFiltered.filter(r => entries.every(([key, set]) => {
      const col = allColumns.find(c => c.key === key) ?? getColumnByKey(key);
      if (!col) return true;
      return set.has(cachedFilterValue(col, r));
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cachedFilterValue ist stable per ref
  }, [antragstypFiltered, columnFilters, allColumns]);

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
    if (!query.trim() || analyse.running) return;
    analyse.start(query.trim());
  };

  // Button ist optimistisch enabled (sobald Query nicht leer ist). Die echte
  // Provider-Pruefung passiert lazy in `analyse.start()` — beim Mount der
  // Suche-Seite KEIN `ping()`, damit die Streamlit-Bridge nicht ihr
  // localhost:8501-Fenster automatisch oeffnet.
  const aiButtonDisabled = !query.trim() || analyse.running;
  const aiButtonTooltip = `Mit KI analysieren (Provider: ${analyse.providerName})`;

  const noQuery = !query.trim();
  const showStepper = analyse.running && analyse.progress;
  // Streaming: Tabelle zeigen sobald Stage 1 Treffer emittet hat, auch wenn
  // Stage 2/3 noch laufen. Die Phase-Badge oben signalisiert „kommt noch".
  const showResults = !showStepper && !noQuery && sorted.length > 0;
  const validation = analyse.result?.validation ?? null;

  return (
    <div className="px-8 pt-4 pb-6">
      <div className="flex flex-col items-start mb-4">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-4">Suche</h1>
        <div className="flex items-center gap-2 w-full max-w-4xl">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
            <input
              data-tour="search-input"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              disabled={analyse.running}
              placeholder="Suche oder analytische Frage…"
              autoFocus
              className="w-full h-10 pl-10 pr-10 text-[14px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius-lg)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)] disabled:opacity-60"
              style={{ border: '0.5px solid var(--tf-border)' }}
            />
            {showSpinner && (
              <Loader2
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] animate-spin"
                aria-label="Suche laeuft"
              />
            )}
          </div>
          <button
            type="button"
            onClick={startAnalyse}
            disabled={aiButtonDisabled}
            title={aiButtonTooltip}
            className="flex items-center gap-1.5 h-10 px-3 text-[13px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <Sparkles size={14} />
            <span>Mit KI analysieren</span>
          </button>
          <SearchDownloadMenu
            disabled={sorted.length === 0}
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
        </div>
        {showResults && (
          <div className="flex items-center gap-2 w-full max-w-4xl mt-2 text-[11px] text-[var(--tf-text-tertiary)]">
            <span>
              {sorted.length} Ergebnisse{analyseActive ? ' (KI-Analyse)' : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {indexInfo.textabschnitteImIndex.toLocaleString('de-DE')} Textabschnitte im Index ·{' '}
              {indexInfo.antraegeGeladen.toLocaleString('de-DE')} Antraege geladen
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 mt-3 flex-wrap w-full">
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
          {showResults && antragstypApplicable && (
            <CollapsibleSeg
              label="Antragstyp"
              value={antragstypFilter}
              items={antragstypItems}
              onChange={label => setAntragstypFilter(label as KategorieLabel)}
            />
          )}
          {!vectorReady && !analyseActive && <Badge variant="default">Embedding-Modell laedt…</Badge>}
          {phaseLabel && !analyseActive && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] text-[var(--tf-text-secondary)] rounded-full" style={{ border: '0.5px solid var(--tf-border)' }}>
              <Loader2 size={11} className="animate-spin" />
              {phaseLabel}
            </span>
          )}
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
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled
              title="Kommt bald"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--tf-text-tertiary)] rounded opacity-60 cursor-not-allowed"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              <MessageCircle size={14} />
              <span>An Chatbot…</span>
            </button>
            <ColumnPicker typeFilter={typeFilter} />
          </div>
        </div>
      </div>

      {analyse.error && (
        <div className="mb-3 px-3 py-2 text-[12px] text-[var(--tf-text)] rounded"
          style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}>
          KI-Analyse fehlgeschlagen: {analyse.error}
        </div>
      )}

      {validation && <ValidationBanner validation={validation} />}

      {toast && (
        <div role="status" className="mb-3 px-3 py-2 text-[12px] text-[var(--tf-text)] rounded"
          style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}>
          {toast}
        </div>
      )}

      {showStepper && analyse.progress && <AnalysePipelineView progress={analyse.progress} onCancel={analyse.cancel} />}
      {!showStepper && loading && sorted.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-[var(--tf-text-secondary)]">
          <Loader2 size={14} className="animate-spin" />
          <span>Suche laeuft{phaseLabel ? ` · ${phaseLabel}` : '…'}</span>
        </div>
      )}

      {!showStepper && noQuery && !loading && (
        <div className="text-center py-16">
          <Search size={40} className="text-[var(--tf-text-tertiary)] mx-auto mb-4" />
          <p className="text-[var(--tf-text-tertiary)]">
            {indexInfo.textabschnitteImIndex.toLocaleString('de-DE')} Textabschnitte im Index ·{' '}
            {indexInfo.antraegeGeladen.toLocaleString('de-DE')} Antraege geladen
          </p>
        </div>
      )}

      {!showStepper && !noQuery && !loading && !showSpinner && sorted.length === 0 && !analyseActive && (
        <div className="text-center py-16">
          <p className="text-[var(--tf-text-secondary)]">Keine Ergebnisse fuer &quot;{query}&quot;</p>
        </div>
      )}

      {showResults && (
        <SearchResultsTable
          results={sorted}
          columns={visibleColumnDefs}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          columnFilters={columnFilters}
          onColumnFilterChange={handleColumnFilterChange}
          filterCandidatesByColumn={filterCandidatesByColumn}
          columnWidths={columnWidths}
          onColumnWidthChange={handleColumnWidthChange}
          onRowClick={handleRowClick}
        />
      )}

      {/* searchResults-Counts (top-line via useUnifiedSearch) bleiben verfuegbar im Hover/Debug */}
      <span className="sr-only">{`unified-search: total=${counts.total} antraege=${counts.antraege} dokumente=${counts.dokumente}`}</span>
    </div>
  );
}

