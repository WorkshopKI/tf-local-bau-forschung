import { useMemo, useState } from 'react';
import { Download, Filter, FileUp, Loader2, Search } from 'lucide-react';
import { useAntraegeStore, getEffectiveViewMode } from './store';
import { useAufnahmeUiStore } from './aufnahme-einfach';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import { useFilterState } from './filter/useFilterState';
import { VIEWS, viewCounts, type ViewKey } from './views';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { BereichChip } from '@/components/bereich/BereichChip';
import { useBereich } from '@/core/hooks/useBereich';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import { menuLabel, isAuslastungEnabled, isGutachtenWorkflowEnabled } from '@/config/feature-flags';
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
import { useKategorieSpalten } from './useKategorieSpalten';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

interface Props {
  filterOpen: boolean;
  onToggleFilter: () => void;
  /** Ist die Antrags-Liste gerade sichtbar? `false` = Fokus-Modus (Liste im
   *  Detail eingeklappt) → alle Listen-Werkzeuge verschwinden, weil sie
   *  ausschliesslich auf die Liste wirken. Ableitung: `shouldShowList` in
   *  `listCollapse.ts` (Aufrufer berechnet EINMAL, siehe AntraegePage). */
  listeSichtbar: boolean;
}

/** Volle Page-Breite über List- und Detail-Spalte:
 *  H1 + Subtitle + Tabs-Toolbar mit Search + Filter-Button.
 *
 *  Fokus-Modus (`listeSichtbar === false`): es bleiben Titel + Profil-Pill +
 *  „Aufnehmen" (wirkt auf den offenen Antrag, nicht auf die Liste). Kein State
 *  wird zurückgesetzt — Suchtext, aktive Sicht und Filter greifen unverändert,
 *  sobald die Liste wieder eingeblendet ist. */
export function AntraegeHeader({ filterOpen, onToggleFilter, listeSichtbar }: Props): React.ReactElement {
  const alleAntraege = useAntraegeStore(s => s.antraege);
  const bereich = useBereich();
  // Tab-Zähler auf derselben Grundmenge wie die Liste — sonst nennt der Kopf
  // eine Zahl, die im Panel darunter nie erscheint (Pitfall #46).
  const antraege = useMemo(
    () => (bereich.menge === null
      ? alleAntraege
      : alleAntraege.filter(a => istImBereich(a.unterprogramm_id, bereich.menge))),
    [alleAntraege, bereich.menge],
  );
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
  // Der Export bildet exakt die Spalten der Ansicht ab — die kuratierten
  // Ordner-Spalten gehören dazu.
  const kategorieSpalten = useKategorieSpalten();

  const handleExport = async (): Promise<void> => {
    if (!activeProgrammId) return;
    setExportBusy(true);
    try {
      await exportFilteredAntraegeXlsx(
        filtered, storage.idb, activeProgrammId, verbundById, visibleColumns, showMaColumn,
        kategorieSpalten,
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
    // Single-Pass: alle View-Counts in einem Loop ueber `antraege` — statt
    // ein viewCount() je Sicht mit jeweils neuer `new Date()`-Allokation pro
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
      {/* Im Fokus-Modus fällt die Such-Zeile weg, die sonst den Abstand zur
          Kopf-Unterkante stellt → eigenes Bottom-Padding, damit die Border
          nicht an den Knöpfen klebt. */}
      <div className={`max-w-6xl px-8${listeSichtbar ? '' : ' pb-3'}`}>
        {/* Title — Tabs zeigen Ansicht + Counts. Bearbeiter-Filter-Pill sitzt
            direkt neben dem Titel, damit der User immer sieht, dass der
            Kuerzel-Filter aktiv ist — auch wenn die Quickfilter-Toolbar
            darunter expandiert ist. */}
        <PageHeader
          className="mb-3"
          title={menuLabel('antraege', 'Förderanträge')}
          meta={(
            <span className="inline-flex items-center gap-1.5 flex-wrap">
              <BereichChip ausgeblendet={alleAntraege.length - antraege.length} />
              {bearbeiterFilter.active && (
                <BearbeiterFilterPill
                  tokens={bearbeiterFilter.tokens}
                  includeBegleitung={bearbeiterFilter.includeBegleitung}
                />
              )}
            </span>
          )}
          actions={<SeitenHilfeButton pluginId="antraege" />}
        />

        {/* Toolbar: Tabs links, Suche + Filter rechts (ml-auto). pr-4 (nur
            List/Cards) kompensiert das px-4-Innenpadding der AntragCard, damit
            die Filter-Button-Kante mit der Status-Badge-Kante fluchtet; im
            Compact-Modus kein pr → Icons treffen den Tabellen-Rand. */}
        <div className="flex items-end gap-4">
          {listeSichtbar ? (
            <ScopeTabs
              variant="tabs"
              items={VIEWS.map(v => ({ key: v.key, label: v.label, count: counts[v.key] }))}
              activeKey={activeView}
              onChange={key => setActiveView(key as ViewKey)}
              aria-label="Ansicht"
            />
          ) : null}

          <div className={`flex items-center gap-2 shrink-0 pb-2 ml-auto ${actionPr}`}>
            {isGutachtenWorkflowEnabled() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => useAufnahmeUiStore.getState().toggle()}
                aria-label="Dokumente aufnehmen"
                title="Antragsdokumente (ZIP) aufnehmen"
                className="h-8 gap-1.5 px-2.5"
              >
                <FileUp size={13} />
                <span className="text-[12px]">Aufnehmen</span>
              </Button>
            )}
            {/* Export / Ansicht / Filter beziehen sich auf die LISTE — im
                Fokus-Modus raus. „Aufnehmen" oben bleibt. */}
            {listeSichtbar ? (
              <>
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
              </>
            ) : null}
          </div>
        </div>

        {/* Such-Zeile + Suchhinweise (eigene Zeile unter den Tabs): breites
            Suchfeld links, im „alle"-Modus der Inaktiv-MA-Toggle rechts daneben.
            Im Fokus-Modus komplett raus — die Suche trifft nur die Liste. Der
            Suchtext bleibt im Store und wirkt beim Wiedereinblenden weiter. */}
        {listeSichtbar ? (
          <>
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
          </>
        ) : null}
      </div>
    </div>
  );
}
