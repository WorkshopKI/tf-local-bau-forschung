import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from 'zustand';
import { Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { isDokumentenscanEnabled } from '@/config/feature-flags';
import { isKuratorFreigeschaltet } from '@/core/modul-freischaltung';
import { useUnifiedSearch, type SearchPhase } from '@/core/hooks/useUnifiedSearch';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { useSucheStore } from './store';
import { ColumnPicker } from './ColumnPicker';
import { SearchDownloadMenu } from './SearchDownloadMenu';
import { SearchResultsTable } from './SearchResultsTable';
import { exportCSV, exportClipboard, exportXLSX } from './export';
import { useAnalysePipeline } from './useAnalysePipeline';
import { AnalysePromptDialog } from './AnalysePromptDialog';
import { CollapsibleSeg } from '@/plugins/antraege/filter/CollapsibleSeg';
import type { KategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import { SearchInput } from './SearchInput';
import { SucheLeerzustand } from './SucheLeerzustand';
import { IndexInfoZeile } from './IndexInfoZeile';
import { ANALYSE_MAX_RESULTS, useSearchResults } from './useSearchResults';
import { scheduleIdle } from '@/core/utils/scheduleIdle';
import {
  getProgrammCaches,
  getEmbeddings,
  isSemanticSearchActive,
  autoBootstrapEmbeddingMirror,
  invalidateEmbeddingsCache,
} from '@/plugins/antraege/services/antraege-search-service';
import { ensureEmbeddingReady } from '@/core/services/embedding-corpus';
import { useSemanticSearchMode } from '@/core/hooks/useSemanticSearchMode';
import { useSuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import { ChatPanelHost } from '@/plugins/chat/ChatPanelHost';
import {
  clampAssistentWidth,
  effectiveAssistentWidth,
  sucheAssistentUiStore,
} from './assistentPanel';
import { VON_SUCHE_STATE_KEY } from './herkunft';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

/** UI-Text fuer die Search-Phase-Badge. */
const PHASE_LABELS: Record<SearchPhase, string | null> = {
  idle: null,
  substring: 'Substring-Treffer…',
  vector: 'Embedding-Treffer…',
  orama: 'Dokumente…',
  done: null,
  error: null,
};

export function SuchSeite(): React.ReactElement {
  const navigate = useNavigate();
  const visibleColumns = useSucheStore(s => s.visibleColumns);
  const addRecentSearch = useSucheStore(s => s.addRecentSearch);
  const analysePrompt = useSucheStore(s => s.analysePrompt);
  const setAnalysePrompt = useSucheStore(s => s.setAnalysePrompt);
  const analyse = useAnalysePipeline();
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  // v2.62: Ähnlichkeitssuche ist opt-in (Session-Schalter, geteilt mit dem
  // Förderanträge-Suchfeld). Default „Ohne" — Modell lädt erst nach Umschalten.
  const semanticEnabled = useSemanticSearchMode(s => s.enabled);
  const setSemanticEnabled = useSemanticSearchMode(s => s.setEnabled);
  // Verknüpfung mehrerer Stichwörter (UND/ODER) — wirkt auf die Wortlaut-Stages.
  const verknuepfung = useSuchVerknuepfung(s => s.verknuepfung);
  const setVerknuepfung = useSuchVerknuepfung(s => s.setVerknuepfung);
  // Die Suchseite besitzt ihren eigenen vollen Assistenten (ChatPanelHost, mit
  // „+"-Menü/Verlauf/Anhängen). Das schlanke shell-weite Assistent-Panel (Phase 1)
  // ist auf `/suche` bewusst NICHT gemountet (ShellLayout `activeId !== 'suche'`),
  // damit hier kein Doppel-Panel entsteht — der lokale Chat unten ist die Quelle.
  // Die SPINE am rechten Blattrand rendert seit v3.50 das ShellLayout (ein
  // Streifen auf jeder Seite); sie schaltet über `sucheAssistentUiStore` genau
  // dieses Panel. Deshalb steht hier kein eigener „Assistent"-Knopf mehr.

  // Die Query liegt im Store (sitzungs-lokal, siehe store.ts): mit `useState`
  // war sie beim Zurückkommen aus der Antrags-Detailseite weg — der Klick auf
  // einen Treffer war eine Einbahnstraße.
  const query = useSucheStore(s => s.query);
  const setQuery = useSucheStore(s => s.setQuery);
  // Such-Pipeline laeuft auf der ge-deferreden Query, damit das Input-Feld
  // frame-perfect bleibt waehrend Orama+Embedding+Filter+Sort durchlaufen.
  const deferredQuery = useDeferredValue(query);
  const [toast, setToast] = useState<string | null>(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);

  // Andockendes Assistenten-Panel (Journey-Paket 1, Phase 4). Offen-Flag +
  // Breite liegen im `sucheAssistentUiStore` (localStorage-gespiegelt), damit
  // die Spine im ShellLayout denselben Schalter bedient.
  const [searchParams, setSearchParams] = useSearchParams();
  const assistentOpen = useStore(sucheAssistentUiStore, s => s.open);
  const assistentWidth = useStore(sucheAssistentUiStore, s => s.width);
  const assistentDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  // Fensterbreite tracken → dynamischer Panel-Max + Render-Klemme (analog
  // MasterDetailLayout): eine breit gespeicherte Breite passt sich einem
  // kleineren Fenster an, statt die Tabelle zu verdrängen.
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440);
  useEffect(() => {
    const handler = (): void => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // `?assistent=1` (Redirect von `/chat` bzw. Command „Assistent öffnen") einmalig
  // konsumieren: Panel öffnen und den Param entfernen, damit ein manuelles
  // Schließen nicht rückgängig gemacht wird.
  useEffect(() => {
    if (searchParams.get('assistent') !== '1') return;
    sucheAssistentUiStore.getState().setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('assistent');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const closeAssistent = useCallback((): void => {
    sucheAssistentUiStore.getState().setOpen(false);
  }, []);

  const onAssistentResize = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    assistentDragRef.current = { startX: e.clientX, startWidth: assistentWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent): void => {
      const drag = assistentDragRef.current;
      if (!drag) return;
      // Panel rechts: nach links draggen → breiter (Delta invertiert).
      sucheAssistentUiStore.getState().setWidth(
        clampAssistentWidth(drag.startWidth + (drag.startX - ev.clientX), window.innerWidth),
      );
    };
    const onUp = (): void => {
      assistentDragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [assistentWidth]);

  const { results: searchResults, loading, counts, indexInfo, vectorReady, searchPhase, semanticStatus } = useUnifiedSearch(deferredQuery);
  const deferredPhase = useDeferredValue(searchPhase);
  const phaseLabel = PHASE_LABELS[deferredPhase];
  const queryNotEmpty = query.trim() !== '';
  const showSpinner = loading || (queryNotEmpty && deferredPhase !== 'done' && deferredPhase !== 'error');
  // „aktiv" = es gibt ein Begründung-Overlay (läuft gerade ODER fertig).
  const analyseActive = analyse.begruendungById !== null;
  const analyseDone = analyse.result !== null && !analyse.running;

  // Filter-/Sort-/Spalten-Pipeline (extrahiert nach useSearchResults.ts).
  const {
    typeFilter, setTypeFilter,
    antragstypFilter, setAntragstypFilter,
    filterChips, antragstypItems, antragstypApplicable,
    sorted, analyseResults, visibleColumnDefs, filterCandidatesByColumn, filterCountsByColumn,
    sortKey, sortDirection, handleSort,
    columnFilters, handleColumnFilterChange,
    columnWidths, handleColumnWidthChange,
  } = useSearchResults({
    searchResults,
    begruendungById: analyse.begruendungById,
    analyseActive,
    visibleColumns,
  });

  // Eager Preload beim Mount der Suche-Seite (Hintergrund, idle). Der
  // Substring-Korpus (~1-1.5s) laedt immer — er traegt die Default-Suche.
  // Modell + Embedding-Korpus laden seit v2.62 NUR nach Opt-in.
  useEffect(() => {
    if (!activeProgrammId) return;
    const cancel = scheduleIdle(() => {
      void getProgrammCaches(storage.idb, activeProgrammId).catch(() => { /* best effort */ });
      if (!semanticEnabled || !isSemanticSearchActive()) return;
      void ensureEmbeddingReady(storage.idb).catch(() => { /* best effort */ });
      // v2.62.2: Korpus-Bootstrap auch hier — sonst bleibt die Vector-Stage auf
      // einem Rechner mit leerem lokalen Embedding-Cache dauerhaft leer.
      void (async () => {
        try {
          await autoBootstrapEmbeddingMirror(storage, status => {
            console.info('[suche] embedding mirror bootstrap:', status);
          });
        } catch (err) {
          console.warn('[suche] embedding mirror bootstrap fehlgeschlagen:', err);
        }
        invalidateEmbeddingsCache();
        void getEmbeddings(storage.idb).catch(() => { /* best effort */ });
      })();
    });
    return cancel;
  }, [activeProgrammId, storage, semanticEnabled]);

  const handleQueryChange = (next: string): void => {
    setQuery(next);
    if (analyseActive) analyse.reset();
  };

  // Beispiel-Chip im Leerzustand: identisch zu getippter Suche — dieselbe
  // deferredQuery-Pipeline PLUS Verlaufs-Eintrag (bei getippter Suche käme der
  // sonst erst bei Enter/Blur).
  const runExampleSearch = useCallback((q: string): void => {
    setQuery(q);
    addRecentSearch(q);
    if (analyseActive) analyse.reset();
  }, [addRecentSearch, analyseActive, analyse]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleRowClick(r: UnifiedSearchResult): void {
    // Herkunft mitgeben: die Detailseite blendet dann „Zurück zur Suche" ein.
    // Der Suchzustand selbst liegt im Store und wartet dort (siehe store.ts).
    if (r.type === 'antrag' && r.fkz) {
      navigate(`/antraege/${encodeURIComponent(r.fkz)}`, { state: { [VON_SUCHE_STATE_KEY]: true } });
    }
  }

  /** „Mit KI analysieren": öffnet den Assistenten mit den aktuellen Treffern als
   *  Kontext (`contextResults` hängt schon am Panel). Die zeilenweise
   *  Begründungs-Analyse ist ein eigener Einstieg — sie sitzt bei ihrem
   *  Gegenstück „Begründungen entfernen" in der Chip-Zeile. */
  const openAssistentMitTreffern = (): void => {
    if (sorted.length === 0) return;
    sucheAssistentUiStore.getState().setOpen(true);
  };

  const openAnalysePrompt = (): void => {
    const q = query.trim();
    if (!q || analyse.running || sorted.length === 0) return;
    setPromptDialogOpen(true);
  };

  const confirmAnalyse = (): void => {
    const q = query.trim();
    if (!q || analyseResults.length === 0) return;
    setPromptDialogOpen(false);
    addRecentSearch(q);
    analyse.start(q, analyseResults, analysePrompt);
  };

  // „Mit KI analysieren" öffnet nur das Panel — kein Provider-Kontakt, also auch
  // kein `ping()` beim Mount (das würde die Streamlit-Bridge ihr Fenster öffnen
  // lassen). Ohne Treffer wäre „diese Treffer analysieren" sinnlos; erreichbar
  // bleibt der Assistent dann über die Spine am rechten Rand.
  const aiButtonDisabled = sorted.length === 0;
  const aiButtonTooltip = 'Assistent öffnen — er kennt die aktuellen Treffer als Kontext';
  // Die zeilenweise Begründungs-Analyse: optimistisch enabled, die echte
  // Provider-Prüfung passiert lazy in `analyse.start()`.
  const begruendenTooltip = `Erzeugt je Trefferzeile eine KI-Begründung (max. ${ANALYSE_MAX_RESULTS}, Provider: ${analyse.providerName})`;

  const noQuery = !query.trim();
  const showResults = !noQuery && sorted.length > 0;
  const analyseProgressLabel = analyse.running
    ? (analyse.progress?.totalBatches
        ? `KI erstellt Begründungen… Batch ${analyse.progress.currentBatch ?? 0}/${analyse.progress.totalBatches}`
        : 'KI erstellt Begründungen…')
    : null;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-8 pt-4 pb-6">
      <div className="flex flex-col items-start mb-4">
        <div className="flex w-full max-w-4xl items-center gap-3 mb-4">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Suche</h1>
          <div className="ml-auto shrink-0"><SeitenHilfeButton pluginId="suche" /></div>
        </div>
        {/* `flex-wrap` + weitere Deckelung als die Zeilen darunter: das Suchfeld
            ist ziehbar — wächst es über die Zeile hinaus, rutschen die
            Bedienelemente sauber in die nächste Zeile, statt gequetscht zu
            werden. `items-start`, damit sie beim hohen Feld oben bleiben. */}
        <div className="flex flex-wrap items-start gap-2 w-full max-w-6xl">
          <SearchInput
            value={query}
            onValueChange={handleQueryChange}
            disabled={analyse.running}
            showSpinner={showSpinner}
          />
          <select
            value={semanticEnabled ? 'mit' : 'ohne'}
            onChange={e => setSemanticEnabled(e.target.value === 'mit')}
            aria-label="Ähnlichkeitssuche"
            title={semanticEnabled
              ? 'Ähnlichkeitssuche aktiv — semantische Treffer (Embedding-Modell geladen).'
              : 'Nur Wortlaut-Treffer. „Mit Ähnlichkeitssuche" lädt das Embedding-Modell (~einmalig 5–10 s, deutlich mehr Arbeitsspeicher) und findet auch inhaltlich ähnliche Anträge.'}
            className="h-10 shrink-0 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 text-[12.5px] text-[var(--tf-text)] cursor-pointer"
          >
            <option value="ohne">Ohne Ähnlichkeitssuche</option>
            <option value="mit">Mit Ähnlichkeitssuche</option>
          </select>
          <select
            value={verknuepfung}
            onChange={e => setVerknuepfung(e.target.value === 'oder' ? 'oder' : 'und')}
            aria-label="Verknüpfung mehrerer Wörter"
            title={'Bei mehreren Stichwörtern: „Alle Wörter" findet nur Vorhaben, in denen jedes Wort vorkommt (auch an verschiedenen Stellen), „Irgendein Wort" schon bei einem.'
              + (semanticEnabled
                ? ' Gilt für Wortlaut-Treffer — die Ähnlichkeitssuche vergleicht die Anfrage als Ganzes und bleibt unberührt.'
                : '')}
            className="h-10 shrink-0 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 text-[12.5px] text-[var(--tf-text)] cursor-pointer"
          >
            <option value="und">Alle Wörter</option>
            <option value="oder">Irgendein Wort</option>
          </select>
          <button
            type="button"
            onClick={openAssistentMitTreffern}
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
                  // Grund mitgeben statt verwerfen: „fehlgeschlagen" allein sagt dem
                  // Nutzer nicht, ob er es gleich nochmal versuchen kann.
                } catch (err) {
                  setToast(`Kopieren fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
                }
              })();
            }}
          />
        </div>
        {semanticEnabled && (semanticStatus === 'corpus-empty' || semanticStatus === 'model-failed') ? (
          <div className="flex items-center gap-1.5 w-full max-w-4xl mt-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
            <span aria-hidden="true">ⓘ</span>
            <span>
              {semanticStatus === 'corpus-empty'
                ? 'Ähnlichkeitssuche ohne Wirkung: Auf diesem Rechner liegen keine Embedding-Vektoren (Korpus). Er wird beim Start automatisch vom Datenspeicher geladen, sofern dort vorhanden — sonst im Auslastungs-Modul „Vom Datenspeicher laden".'
                : 'Ähnlichkeitssuche ohne Wirkung: Das Embedding-Modell konnte nicht geladen werden (Details in der Browser-Konsole, F12). Es werden nur Wortlaut-Treffer angezeigt.'}
            </span>
          </div>
        ) : null}
        {showResults && (
          <div className="flex items-center gap-2 w-full max-w-4xl mt-2 text-[11px] text-[var(--tf-text-tertiary)]">
            <span>
              {sorted.length} Ergebnisse{analyseActive ? ' (KI-Analyse)' : ''}
            </span>
            <span aria-hidden="true">·</span>
            <IndexInfoZeile
              textabschnitteImIndex={indexInfo.textabschnitteImIndex}
              antraegeGeladen={indexInfo.antraegeGeladen}
            />
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
                aria-pressed={active}
                className={`px-3 py-1 text-[12px] rounded-full cursor-pointer transition-colors border-[0.5px] disabled:opacity-50 ${
                  active
                    ? 'bg-[var(--tf-primary-light)] border-transparent text-[var(--tf-primary)] font-medium'
                    : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]'
                }`}
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
          {analyse.running && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] text-[var(--tf-text-secondary)] rounded-full" style={{ border: '0.5px solid var(--tf-border)' }}>
              <Loader2 size={11} className="animate-spin" />
              {analyseProgressLabel}
              <button type="button" onClick={analyse.cancel} className="ml-1 underline hover:text-[var(--tf-text)]">
                Abbrechen
              </button>
            </span>
          )}
          {/* Zeilenweise KI-Begründung: sitzt bei ihrem Gegenstück
              „Begründungen entfernen", damit Starten und Abräumen an derselben
              Stelle wohnen. */}
          {showResults && !analyseActive && !analyse.running && (
            <button
              type="button"
              onClick={openAnalysePrompt}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
              title={begruendenTooltip}
            >
              <Sparkles size={11} />
              Treffer begründen
            </button>
          )}
          {analyseDone && (
            <button
              type="button"
              onClick={() => analyse.reset()}
              className="px-3 py-1 text-[12px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
              title="Entfernt die KI-Begründung-Spalte; Treffer bleiben erhalten"
            >
              Begründungen entfernen
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
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

      {analyseDone && analyse.result && analyse.result.warnings.length > 0 && (
        <div className="mb-3 px-3 py-2 text-[12px] text-[var(--tf-text)] rounded"
          style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}>
          {analyse.result.warnings.join(' · ')}
        </div>
      )}

      {toast && (
        <div role="status" className="mb-3 px-3 py-2 text-[12px] text-[var(--tf-text)] rounded"
          style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}>
          {toast}
        </div>
      )}

      {loading && sorted.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-[var(--tf-text-secondary)]">
          <Loader2 size={14} className="animate-spin" />
          <span>Suche laeuft{phaseLabel ? ` · ${phaseLabel}` : '…'}</span>
        </div>
      )}

      {noQuery && !loading && (
        <SucheLeerzustand
          antraegeGeladen={indexInfo.antraegeGeladen}
          textabschnitteImIndex={indexInfo.textabschnitteImIndex}
          onExample={runExampleSearch}
          kuratorVariant={isKuratorFreigeschaltet() && isDokumentenscanEnabled()}
          onOpenDokumentenquellen={() => navigate('/kuration/dokumentenquellen')}
        />
      )}

      {!noQuery && !loading && !showSpinner && sorted.length === 0 && (
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
          filterCountsByColumn={filterCountsByColumn}
          columnWidths={columnWidths}
          onColumnWidthChange={handleColumnWidthChange}
          onRowClick={handleRowClick}
        />
      )}

      {/* searchResults-Counts (top-line via useUnifiedSearch) bleiben verfuegbar im Hover/Debug */}
      <span className="sr-only">{`unified-search: total=${counts.total} antraege=${counts.antraege} dokumente=${counts.dokumente}`}</span>

      <AnalysePromptDialog
        open={promptDialogOpen}
        query={query.trim()}
        results={analyseResults}
        totalCount={sorted.length}
        instruction={analysePrompt}
        onInstructionChange={setAnalysePrompt}
        providerName={analyse.providerName}
        onConfirm={confirmAnalyse}
        onCancel={() => setPromptDialogOpen(false)}
      />
        </div>
      </div>
      {assistentOpen && (
        <aside className="shrink-0 h-full min-h-0 overflow-hidden flex" style={{ width: effectiveAssistentWidth(assistentWidth, viewportWidth) }}>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Assistent-Panel-Breite ändern"
            onMouseDown={onAssistentResize}
            className="shrink-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--tf-border-hover)] transition-colors"
            style={{ borderLeft: '0.5px solid var(--tf-border)' }}
          />
          <div className="flex-1 min-w-0 h-full">
            <ChatPanelHost onClose={closeAssistent} contextResults={sorted} contextQuery={query.trim()} />
          </div>
        </aside>
      )}
    </div>
  );
}
