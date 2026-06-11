import { useMemo, useState } from 'react';
import { Download, Filter, Loader2, Search } from 'lucide-react';
import { useAntraegeStore, getEffectiveViewMode } from './store';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import { useFilterState } from './filter/useFilterState';
import { VIEWS, viewCounts } from './views';
import { menuLabel, isAuslastungEnabled } from '@/config/feature-flags';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFilteredAntraege, hasExplicitVbPhaseFilter } from './useFilteredAntraege';
import { applyInaktiveExclusion } from './bearbeiterFilter';
import { useShowInaktiveMasStore } from './useShowInaktiveMasStore';
import { useInaktiveKuerzelSet } from '@/plugins/auslastung/hooks/useInaktiveKuerzelSet';
import { BearbeiterFilterPill } from './filter/BearbeiterFilterPill';
import { ViewModeToggle } from './ViewModeToggle';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useSemanticSearchMode } from '@/core/hooks/useSemanticSearchMode';
import { exportFilteredAntraegeXlsx } from './services/export-xlsx';

interface Props {
  filterOpen: boolean;
  onToggleFilter: () => void;
}

/** Volle Page-Breite über List- und Detail-Spalte:
 *  H1 + Subtitle + Tabs-Toolbar mit Search + Filter-Button. */
export function AntraegeHeader({ filterOpen, onToggleFilter }: Props): React.ReactElement {
  const antraege = useAntraegeStore(s => s.antraege);
  const activeView = useAntraegeStore(s => s.activeView);
  const setActiveView = useAntraegeStore(s => s.setActiveView);
  const search = useAntraegeStore(s => s.search);
  const setSearch = useAntraegeStore(s => s.setSearch);
  const searchIgnoreBearbeiter = useAntraegeStore(s => s.searchIgnoreBearbeiterFilter);
  const setSearchIgnoreBearbeiter = useAntraegeStore(s => s.setSearchIgnoreBearbeiterFilter);
  const hybridLoading = useAntraegeStore(s => s.hybridSearch.loading);
  const hybridUnavailable = useAntraegeStore(s => s.hybridSearch.unavailable);
  const downloadingCorpus = useAntraegeStore(s => s.hybridSearch.downloadingCorpus);
  // v2.62: Ähnlichkeitssuche opt-in (Session-Schalter, geteilt mit der Suchseite).
  const semanticEnabled = useSemanticSearchMode(s => s.enabled);
  const setSemanticEnabled = useSemanticSearchMode(s => s.setEnabled);
  const filterCount = useFilterState(s => s.active.length);
  const active = useFilterState(s => s.active);
  const definitions = useFilterState(s => s.definitions);
  // Im Compact-Modus (Tabelle) sollen die Header-Icons mit dem Tabellen-Rand
  // fluchten (kein pr-4); in List/Cards bleibt pr-4 für Bündigkeit mit den
  // px-4-Status-Badges der Cards.
  const viewMode = useAntraegeStore(s => getEffectiveViewMode(s.activeView, s.viewModeByTab));
  const actionPr = viewMode === 'compact' ? '' : 'pr-4';
  const { filtered, bearbeiterFilter } = useFilteredAntraege();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);
  const setShowInaktive = useShowInaktiveMasStore(s => s.setShowInaktive);
  const inaktiveKuerzel = useInaktiveKuerzelSet();
  const verbundById = useAntraegeStore(s => s.verbundById);
  // Export folgt der Tabellen-Ansicht: dieselben sichtbaren Spalten (+ MA-Spalte
  // im „alle"-/Übersichtsmodus, identisch zu AntraegeMain).
  const visibleColumns = useAntraegeColumnsStore(s => s.visibleColumns);
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const [exportBusy, setExportBusy] = useState(false);
  const searchActive = search.trim().length > 0;
  const showMaColumn = isAuslastungEnabled() && !bearbeiterFilter.active;

  const handleExport = async (): Promise<void> => {
    if (!activeProgrammId) return;
    setExportBusy(true);
    try {
      await exportFilteredAntraegeXlsx(
        filtered, storage.idb, activeProgrammId, verbundById, visibleColumns, showMaColumn,
      );
    } catch (err) {
      console.warn('[antraege-export] failed:', err);
    } finally {
      setExportBusy(false);
    }
  };
  const showEmbeddingBanner = search.trim().length >= 2 && hybridUnavailable.includes('embedding');
  // Checkbox nur zeigen wenn ein Bearbeiter-Filter ueberhaupt aktiv ist — sonst
  // gaebe es nichts zu ignorieren und der UI-Punkt waere irrefuehrend.
  const showIgnoreBearbeiterToggle = searchActive && bearbeiterFilter.active;

  const counts = useMemo(() => {
    // Pre-Filter konsistent zum Listenrendering: Irrlaeufer (vb_phase=9)
    // werden in den Tab-Counts ausgeblendet, AUSSER ein expliziter
    // vb_phase-Filter ist aktiv (dann uebernimmt die Sidebar die Kontrolle).
    const applyVbPhasePreFilter = !hasExplicitVbPhaseFilter(active, definitions);
    // Tab-Counts konsistent zur Liste: im „alle"-Modus Anträge inaktiver MAs
    // ausblenden (pl/dev; außerhalb ist das Set leer → No-op).
    const antraegeForCounts = applyInaktiveExclusion(antraege, bearbeiterFilter.active, inaktiveKuerzel, showInaktive);
    // Single-Pass: alle 6 View-Counts in einem Loop ueber `antraege` —
    // statt 6× viewCount() mit jeweils neuer `new Date()`-Allokation pro
    // Antrag im Predicate.
    return viewCounts(antraegeForCounts, bearbeiterFilter, applyVbPhasePreFilter);
  }, [antraege, bearbeiterFilter, active, definitions, inaktiveKuerzel, showInaktive]);

  return (
    <div
      className="shrink-0 pt-4 pb-0"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      {/* Inhalts-Wrapper teilt EXAKT die Content-Box von Toolbar + Liste/Tabelle
          (max-w-6xl px-8, Padding innen) — dadurch fluchten Header-Icons,
          „Spalten"-Dropdown und Tabellen-Rand. Die Unterkanten-Border läuft
          voll durch, weil sie auf dem äußeren (padding-freien) Container sitzt. */}
      <div className="max-w-6xl px-8">
        {/* Title — Tabs zeigen Ansicht + Counts. Bearbeiter-Filter-Pill sitzt
            direkt neben dem Titel, damit der User immer sieht, dass der
            Kuerzel-Filter aktiv ist — auch wenn die Quickfilter-Toolbar
            darunter expandiert ist. */}
        <div className="mb-3 flex items-center gap-3 flex-wrap">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-tight">
            {menuLabel('antraege', 'Förderanträge')}
          </h1>
          {bearbeiterFilter.active ? (
            <BearbeiterFilterPill
              tokens={bearbeiterFilter.tokens}
              includeBegleitung={bearbeiterFilter.includeBegleitung}
            />
          ) : null}
        </div>

        {/* Toolbar: Tabs links, Suche + Filter rechts (ml-auto). pr-4 (nur
            List/Cards) kompensiert das px-4-Innenpadding der AntragCard, damit
            die Filter-Button-Kante mit der Status-Badge-Kante fluchtet; im
            Compact-Modus kein pr → Icons treffen den Tabellen-Rand. */}
        <div className="flex items-end gap-4">
          <div className="flex items-end gap-5 min-w-0 overflow-x-auto overflow-y-hidden">
            {VIEWS.map(v => {
              const isActive = v.key === activeView;
              const cnt = counts[v.key];
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setActiveView(v.key)}
                  className={`pb-2.5 text-[14px] whitespace-nowrap cursor-pointer transition-colors ${
                    isActive
                      ? 'text-[var(--tf-text)] font-medium border-b-2 border-[var(--tf-text)] -mb-px'
                      : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
                  }`}
                >
                  {v.label}{' '}
                  <span className="text-[12px] text-[var(--tf-text-tertiary)]">
                    {cnt.toLocaleString('de-DE')}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={`flex items-center gap-2 shrink-0 pb-2 ml-auto ${actionPr}`}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exportBusy || filtered.length === 0 || !activeProgrammId}
              aria-label={`Liste als XLSX exportieren (${filtered.length} Anträge)`}
              title={`Liste als XLSX exportieren (${filtered.length} Anträge)`}
              className="h-8 w-8 p-0"
            >
              {exportBusy
                ? <Loader2 size={13} className="animate-spin" />
                : <Download size={13} />}
            </Button>
            <ViewModeToggle />
            <Button
              variant={filterOpen ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleFilter}
              aria-label={`Filter${filterCount > 0 ? ` (${filterCount} aktiv)` : ''}`}
              title={`Filter${filterCount > 0 ? ` (${filterCount} aktiv)` : ''}`}
              className="relative h-8 w-8 p-0"
            >
              <Filter size={13} />
              {filterCount > 0 && !filterOpen ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--tf-primary)' }}
                />
              ) : null}
            </Button>
          </div>
        </div>

        {/* Such-Zeile (eigene Zeile unter den Tabs): breites Suchfeld links,
            im „alle"-Modus der Inaktiv-MA-Toggle rechts daneben. */}
        <div className="mt-2 flex items-center gap-3 pr-4">
          <div className="relative flex-1 min-w-0 max-w-[640px]">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none"
            />
            <Input
              placeholder="Anträge durchsuchen (Titel, Beschreibung, Dokumente)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 pr-7 h-8 w-full text-[12.5px]"
              title={semanticEnabled
                ? 'Suche kombiniert Substring (Aktenzeichen/Akronym/Titel/Antragsteller/Verbund-Titel/Kurzbeschreibung), Embedding-Match aus dem Auslastungs-Korpus und DMS-Volltext-Treffer.'
                : 'Substring-Suche (Aktenzeichen/Akronym/Titel/Antragsteller/Verbund-Titel/Kurzbeschreibung). Für inhaltlich ähnliche Anträge rechts „Mit Ähnlichkeitssuche" wählen.'}
            />
            {hybridLoading ? (
              <Loader2
                size={12}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] animate-spin pointer-events-none"
                aria-label="Suche läuft"
              />
            ) : null}
          </div>
          <select
            value={semanticEnabled ? 'mit' : 'ohne'}
            onChange={e => setSemanticEnabled(e.target.value === 'mit')}
            aria-label="Ähnlichkeitssuche"
            title={semanticEnabled
              ? 'Ähnlichkeitssuche aktiv — semantische Treffer (Embedding-Modell geladen).'
              : 'Nur Wortlaut-Treffer. „Mit Ähnlichkeitssuche" lädt das Embedding-Modell (~einmalig 5–10 s, deutlich mehr Arbeitsspeicher) und findet auch inhaltlich ähnliche Anträge.'}
            className="h-8 shrink-0 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 text-[11.5px] text-[var(--tf-text)] cursor-pointer"
          >
            <option value="ohne">Ohne Ähnlichkeitssuche</option>
            <option value="mit">Mit Ähnlichkeitssuche</option>
          </select>
          {!bearbeiterFilter.active && isAuslastungEnabled() ? (
            <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer select-none shrink-0 whitespace-nowrap">
              <input
                type="checkbox"
                checked={showInaktive}
                onChange={e => setShowInaktive(e.target.checked)}
                className="accent-[var(--tf-primary)] cursor-pointer"
              />
              inaktive MAs
            </label>
          ) : null}
          {/* Im Suchzeilen-Slot (rechts neben dem Ähnlichkeits-Select) — exklusiv
              zur „inaktive MAs"-Checkbox (die nur ohne Bearbeiter-Filter erscheint),
              spart so die eigene Zeile darunter. */}
          {showIgnoreBearbeiterToggle ? (
            <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer select-none shrink-0 whitespace-nowrap">
              <input
                type="checkbox"
                checked={searchIgnoreBearbeiter}
                onChange={e => setSearchIgnoreBearbeiter(e.target.checked)}
                className="accent-[var(--tf-primary)] cursor-pointer"
              />
              Auch außerhalb meiner Anträge suchen
            </label>
          ) : null}
        </div>

        {downloadingCorpus ? (
          <div className="mt-1 mb-2 text-[11.5px] text-[var(--tf-text-tertiary)] flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
            <span>
              Ähnlichkeitssuche wird vorbereitet (Modell laden + Embedding-Korpus vom Daten-Share, einmalig ~5–15 s) — solange liefert die Suche Wortlaut-Treffer.
            </span>
          </div>
        ) : showEmbeddingBanner ? (
          <div className="mt-1 mb-2 text-[11.5px] text-[var(--tf-text-tertiary)] flex items-center gap-1.5">
            <span aria-hidden="true">ⓘ</span>
            <span>
              Semantische Suche inaktiv — Embedding-Korpus im Auslastungs-Modul bauen für mehr Treffer.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
