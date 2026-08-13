import { useState } from 'react';
import { Download, Filter, FileUp, Loader2, Search } from 'lucide-react';
import { useAntraegeStore, getEffectiveViewMode } from './store';
import { useAufnahmeUiStore } from './aufnahme-einfach';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import { useFilterState } from './filter/useFilterState';
import { VIEWS, type ViewKey } from './views';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { BereichChip } from '@/components/bereich/BereichChip';
import { menuLabel, isGutachtenWorkflowEnabled } from '@/config/feature-flags';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFilteredAntraege } from './useFilteredAntraege';
import { useShowInaktiveMasStore } from './useShowInaktiveMasStore';
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
 *  Fokus-Modus (`listeSichtbar === false`): es bleiben Titel + Hilfe. Alles andere
 *  im Kopf ist eine Aussage ÜBER DIE LISTE — der Bereichs-Chip nennt ihren
 *  Ausschnitt, die Profil-Pille ihren Kürzel-Filter, Sicht-Tabs/Suche/Export/
 *  Filter bedienen sie. Ohne Liste behaupten sie etwas über nichts, und der
 *  Nutzer, der genau einen Antrag vor sich hat, scrollt an ihnen vorbei. Kein
 *  State wird zurückgesetzt — Suchtext, aktive Sicht und Filter greifen
 *  unverändert, sobald die Liste wieder eingeblendet ist. */
export function AntraegeHeader({ filterOpen, onToggleFilter, listeSichtbar }: Props): React.ReactElement {
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
  // Im Compact-Modus (Tabelle) sollen die Header-Icons mit dem Tabellen-Rand
  // fluchten (kein pr-4); in List/Cards bleibt pr-4 für Bündigkeit mit den
  // px-4-Status-Badges der Cards.
  const viewMode = useAntraegeStore(s => getEffectiveViewMode(s.activeView, s.viewModeByTab));
  const actionPr = viewMode === 'compact' ? '' : 'pr-4';
  // Zähler UND Ausblend-Zahl kommen aus derselben Pipeline wie die Liste — der
  // Kopf rechnet nichts nach (Pitfall #46).
  const { filtered, bearbeiterFilter, counts, ausgeblendet } = useFilteredAntraege();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);
  const setShowInaktive = useShowInaktiveMasStore(s => s.setShowInaktive);
  const verbundById = useAntraegeStore(s => s.verbundById);
  // Export folgt der Tabellen-Ansicht: dieselben sichtbaren Spalten (+ MA-Spalte
  // im „alle"-/Übersichtsmodus, identisch zu AntraegeMain).
  const visibleColumns = useAntraegeColumnsStore(s => s.visibleColumns);
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const [exportBusy, setExportBusy] = useState(false);
  const searchActive = search.trim().length > 0;
  const showMaColumn = isAuslastungFreigeschaltet() && !bearbeiterFilter.active;
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

  return (
    <div
      className="shrink-0 pt-4 pb-0"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      {/* Kopfzeile über die VOLLE Blattbreite (nur px-8), nicht in der
          max-w-6xl-Content-Box: der Hilfe-Knopf gehört auf jeder Seite an den
          rechten Blattrand (docs/architecture/ui-muster.md, Guard
          `hilfe-knopf-am-blattrand`). Der Titel steht dadurch unverändert an
          seiner Stelle — nur die Kopf-Aktionen rücken nach außen. */}
      {/* Im Fokus-Modus fällt die Such-Zeile weg, die sonst den Abstand zur
          Kopf-Unterkante stellt → eigenes Bottom-Padding, damit die Border
          nicht an den Knöpfen klebt. */}
      <div className={`px-8${listeSichtbar ? '' : ' pb-3'}`}>
        {/* Title — Tabs zeigen Ansicht + Counts. Bearbeiter-Filter-Pill sitzt
            direkt neben dem Titel, damit der User immer sieht, dass der
            Kuerzel-Filter aktiv ist — auch wenn die Quickfilter-Toolbar
            darunter expandiert ist. */}
        <PageHeader
          className={listeSichtbar ? 'mb-3' : ''}
          title={menuLabel('antraege', 'Förderanträge')}
          meta={listeSichtbar ? (
            <span className="inline-flex items-center gap-1.5 flex-wrap">
              <BereichChip ausgeblendet={ausgeblendet} />
              {bearbeiterFilter.active && (
                <BearbeiterFilterPill
                  tokens={bearbeiterFilter.tokens}
                  includeBegleitung={bearbeiterFilter.includeBegleitung}
                />
              )}
            </span>
          ) : undefined}
          actions={<SeitenHilfeButton pluginId="antraege" />}
        />
      </div>

      {/* Rumpf-Wrapper teilt EXAKT die Content-Box von Liste/Tabelle
          (max-w-6xl px-8, Padding innen) — dadurch fluchten Toolbar-Icons,
          „Spalten"-Dropdown und Tabellen-Rand. Die Unterkanten-Border läuft
          voll durch, weil sie auf dem äußeren (padding-freien) Container sitzt. */}
      <div className="max-w-6xl px-8">
        {/* Toolbar: Tabs links, Suche + Filter rechts (ml-auto). pr-4 (nur
            List/Cards) kompensiert das px-4-Innenpadding der AntragCard, damit
            die Filter-Button-Kante mit der Status-Badge-Kante fluchtet; im
            Compact-Modus kein pr → Icons treffen den Tabellen-Rand. */}
        {/* Toolbar-Zeile komplett nur bei sichtbarer Liste — im Fokus-Modus bliebe
            sonst eine leere Zeile mit ihrem Innenabstand stehen. */}
        {listeSichtbar ? (
          <div className="flex items-end gap-4">
            <ScopeTabs
              variant="tabs"
              // Trenner vor „Diese Woche": links teilen „Antragsphase" und
              // „Begleitung" den Bestand in zwei Hälften mit je eigener Uhr
              // (Antragsdatum + 90 Tage vs. VN-Eingang + 6 Monate), rechts
              // stehen Zeitschnitte darauf und „Alle". Ohne die Linie liest
              // sich „Begleitung" wie ein weiterer Zeitschnitt.
              items={VIEWS.map(v => ({
                key: v.key,
                label: v.label,
                count: counts[v.key],
                trennerDavor: v.key === 'diese_woche_faellig',
              }))}
              activeKey={activeView}
              onChange={key => setActiveView(key as ViewKey)}
              aria-label="Ansicht"
            />

            <div className={`flex items-center gap-2 shrink-0 pb-2 ml-auto ${actionPr}`}>
              {/* „Aufnehmen" nimmt Antragsdokumente auf und braucht dafür keine
                  Liste — es steht hier trotzdem im Listen-Zweig, weil der Kopf im
                  Fokus-Modus auf Titel + Hilfe zusammenschrumpfen soll. */}
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
        ) : null}

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
                  placeholder="Anträge durchsuchen (Titel, Akronym, FKZ, Antragsteller, Ort, Dokumente)"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-7 pr-7 h-8 w-full text-[12.5px]"
                  title={semanticEnabled
                    ? 'Suche kombiniert Substring (Aktenzeichen/Akronym/Titel/Antragsteller/Ort/Bundesland/Verbund-Titel/Kurzbeschreibung), Embedding-Match aus dem Auslastungs-Korpus und DMS-Volltext-Treffer.'
                    : 'Substring-Suche (Aktenzeichen/Akronym/Titel/Antragsteller/Ort/Bundesland/Verbund-Titel/Kurzbeschreibung). Für inhaltlich ähnliche Anträge rechts „Mit Ähnlichkeitssuche" wählen.'}
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
              {!bearbeiterFilter.active && isAuslastungFreigeschaltet() ? (
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
