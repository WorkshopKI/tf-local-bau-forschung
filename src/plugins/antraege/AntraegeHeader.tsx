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
import { BearbeiterSichtChip } from '@/components/bearbeiter/BearbeiterSichtChip';
import { menuLabel, isGutachtenWorkflowEnabled } from '@/config/feature-flags';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFilteredAntraege } from './useFilteredAntraege';
import { AehnlichkeitsHinweis } from './AehnlichkeitsHinweis';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
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
  const filterCount = useFilterState(s => s.active.length);
  // Im Compact-Modus (Tabelle) sollen die Header-Icons mit dem Tabellen-Rand
  // fluchten (kein pr-4); in List/Cards bleibt pr-4 für Bündigkeit mit den
  // px-4-Status-Badges der Cards.
  const viewMode = useAntraegeStore(s => getEffectiveViewMode(s.activeView, s.viewModeByTab));
  const actionPr = viewMode === 'compact' ? '' : 'pr-4';
  // Zähler UND Ausblend-Zahl kommen aus derselben Pipeline wie die Liste — der
  // Kopf rechnet nichts nach (Pitfall #46).
  const { filtered, bearbeiterFilter, counts, ausgeblendet } = useFilteredAntraege();
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
              {/* Steht in BEIDEN Sichten — sonst führte „Alle Bearbeiter" in
                  einen Zustand ohne sichtbaren Rückweg. */}
              <BearbeiterSichtChip />
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
        {/* Toolbar: Tabs links, Aktionen rechts (ml-auto). Seit v4.64 stehen dort
            nur noch „Aufnehmen" und der Export — der Ansichts-Umschalter ist eine
            Achse im „Darstellung"-Menü geworden, der Filter-Knopf in die Suchzeile
            gezogen. pr-4 (nur List/Cards) kompensiert das px-4-Innenpadding der
            AntragCard, damit die Knopf-Kante mit der Status-Badge-Kante fluchtet;
            im Compact-Modus kein pr → Icons treffen den Tabellen-Rand. */}
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
            </div>
          </div>
        ) : null}

        {/* Such-Zeile (eigene Zeile unter den Tabs): Filter-Knopf, breites
            Suchfeld, darunter der Hinweis zur laufenden Suche. Im Fokus-Modus
            komplett raus — die Suche trifft nur die Liste. Der Suchtext bleibt im
            Store und wirkt beim Wiedereinblenden weiter. */}
        {listeSichtbar ? (
          <>
            <div className="mt-2 flex items-center gap-2 pr-4">
              {/* Der Filter-Knopf steht seit v4.64 hier statt in der Zeile
                  darüber — die Leiste geht LINKS auf, also gehört ihr Schalter
                  an dieselbe Kante und nicht ans andere Ende des Kopfes.
                  Beschriftet statt nur Trichter, und die Anzahl als ZAHL statt
                  als Punkt: der Punkt sagte „irgendetwas filtert", die Zahl sagt
                  wie viel — und sie bleibt sichtbar, wenn die Leiste offen ist
                  (der Punkt verschwand genau dann). Die Marke nimmt in beiden
                  Zuständen ein Token-Paar, das für Kontrast ausgelegt ist:
                  gefüllt auf hellem Grund, aufgehellt auf der Primärfläche. */}
              <Button
                variant={filterOpen ? 'default' : 'outline'}
                size="sm"
                onClick={onToggleFilter}
                aria-label={`Filter${filterCount > 0 ? ` (${filterCount} aktiv)` : ''}`}
                title={filterOpen
                  ? `Filterleiste schließen${filterCount > 0 ? ` (${filterCount} aktiv)` : ''}`
                  : `Filterleiste öffnen${filterCount > 0 ? ` (${filterCount} aktiv)` : ''}`}
                className="h-8 shrink-0 gap-1.5 px-2.5"
              >
                <Filter size={13} />
                <span className="text-[12px]">Filter</span>
                {filterCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className={`ml-0.5 min-w-[16px] rounded-full px-1 text-center text-[10.5px] leading-[16px] tabular-nums ${
                      filterOpen
                        ? 'bg-primary-foreground/25 text-primary-foreground'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {filterCount}
                  </span>
                ) : null}
              </Button>
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
                  title={'Wortlaut über Aktenzeichen/Akronym/Titel/Antragsteller/Ort/Bundesland/'
                    + 'Verbund-Titel/Kurzbeschreibung UND den Volltext der aufgenommenen Dokumente. '
                    + 'Inhaltlich ähnliche Anträge kommen über den Hinweis unter dem Feld dazu.'}
                />
                {hybridLoading ? (
                  <Loader2
                    size={12}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] animate-spin pointer-events-none"
                    aria-label="Suche läuft"
                  />
                ) : null}
              </div>
              {/* Kontext-Häkchen zur laufenden Suche: erscheint nur, wenn ein
                  Bearbeiter-Filter die Treffer beschneiden würde. Die frühere
                  Nachbarschaft („inaktive MAs") ist mit v4.64 in die Filterleiste
                  gezogen — sie filtert die Liste, nicht die Suche. */}
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

            {/* Was die Suche gerade findet + der Weg zur Ähnlichkeit. Steht nur
                bei laufender Suche und ersetzt das Dauer-Auswahlfeld. */}
            <AehnlichkeitsHinweis />
          </>
        ) : null}
      </div>
    </div>
  );
}
