import { useRef, useState } from 'react';
import { Download, Filter, FileUp, Loader2, Search, Sparkles, X } from 'lucide-react';
import { useAntraegeStore } from './store';
import { useAufnahmeUiStore } from './aufnahme-einfach';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import { useFilterState } from './filter/useFilterState';
import { VIEWS, getView, type ViewKey } from './views';
import { EigeneReiterMenue } from './EigeneReiterMenue';
import { useEigeneReiter, passenderReiter, beschreibeZustand } from './eigeneReiter';
import { useAktuellerKern, wendeReiterAn } from './reiterZustand';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { BereichChip } from '@/components/bereich/BereichChip';
import { BearbeiterSichtChip } from '@/components/bearbeiter/BearbeiterSichtChip';
import { menuLabel, isGutachtenWorkflowEnabled, isSucheNatuerlicheSpracheEnabled } from '@/config/feature-flags';
import { FrageUmschalter, FrageDeutung } from './frage/FrageZeile';
import { useAntragsFrage } from './frage/useAntragsFrage';
import { FrageVorschlaege } from './frage/FrageVorschlaege';
import { useFrageVorschlaege } from './frage/useFrageVorschlaege';
import { useFrageOffen } from './frage/suchtext';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { useFilteredAntraege } from './useFilteredAntraege';
import { AehnlichkeitsHinweis } from './AehnlichkeitsHinweis';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { exportFilteredAntraegeXlsx } from './services/export-xlsx';
import { useKategorieSpalten } from './useKategorieSpalten';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

/** Der Knopf heißt nach dem, was er aufnimmt — was dabei passiert, sagt der
 *  Tooltip. „Aufnehmen" allein nannte nur die Tätigkeit und ließ offen, wovon
 *  die Rede ist (v4.75.2). */
/** Warum die Liste noch unverändert dasteht — Wortlaut nach der Dokumenten-Suche,
 *  nur der Schluss unterscheidet sich: dort entstehen Suchbegriffe, hier Filter. */
const FRAGE_OFFEN_HINWEIS =
  'Noch nicht gestellt — „Frage stellen" oder Eingabetaste übersetzt sie mit der '
  + 'internen KI in Filter, die danach als Pillen dastehen und einzeln änderbar sind.';

const AUFNAHME_DETAIL =
  'Antragsdokumente aufnehmen: ein ZIP (oder einzelne PDF/DOCX) ablegen — das ' +
  'Förderkennzeichen wird aus dem Dateinamen gelesen, die Dateien werden in Text ' +
  'umgewandelt und unter dem jeweiligen Antrag in Ihrem persönlichen Ordner abgelegt. ' +
  'Von dort lesen Aufbereitung und Gutachten sie.';

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
  // Frage-Modus: derselbe Flag wie in der Dokumenten-Suche — dasselbe
  // Verfahren, dieselbe Freischaltung.
  const frageAn = isSucheNatuerlicheSpracheEnabled();
  const frage = useAntragsFrage();
  // Die Vorschlagsliste gibt es NUR im Frage-Modus: ein leeres Feld, das einen
  // ganzen Satz erwartet, ist die schwerste Eingabe der Seite. Der Stichwort-
  // Modus hat mit Feldsyntax und Ähnlichkeits-Hinweis seine eigenen Wegweiser.
  const feldRef = useRef<HTMLInputElement>(null);
  // Steht im Feld eine Frage, die noch niemand übersetzt hat? Dann trägt der
  // Kopf den Knopf und die Erklärung — und die Liste ignoriert den Text.
  const frageIstOffen = useFrageOffen();
  const vorschlaege = useFrageVorschlaege({
    feldRef,
    text: search,
    setText: setSearch,
    stelleFrage: q => { void frage.stelleFrage(q); },
    aktiviert: frageAn && frage.nlModus,
  });
  const searchIgnoreBearbeiter = useAntraegeStore(s => s.searchIgnoreBearbeiterFilter);
  const setSearchIgnoreBearbeiter = useAntraegeStore(s => s.setSearchIgnoreBearbeiterFilter);
  const hybridLoading = useAntraegeStore(s => s.hybridSearch.loading);
  const filterCount = useFilterState(s => s.active.length);
  // Zähler UND Ausblend-Zahl kommen aus derselben Pipeline wie die Liste — der
  // Kopf rechnet nichts nach (Pitfall #46).
  const { filtered, bearbeiterFilter, counts, ausgeblendet, stillstandUnpruefbar } = useFilteredAntraege();
  const stillstandTage = useAntraegeStore(s => s.stillstandTage);
  const setStillstandTage = useAntraegeStore(s => s.setStillstandTage);
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
  // Eigene Reiter: sie stehen HINTER den festen und tragen keine Zahl (siehe
  // `eigeneReiter.ts`). Markiert ist einer, solange der aktuelle Stand seine
  // Identität trifft — sonst leuchtet wieder der feste Reiter darunter.
  const eigeneReiter = useEigeneReiter(s => s.reiter);
  const kern = useAktuellerKern();
  const aktiverEigener = passenderReiter(eigeneReiter, kern);

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
    // WEISSER KOPF (v4.70, Rücknahme von v4.68): das Grau steht dort, wo es die
    // Vorlage hat — Filterleiste und Tabellenkopf. Über den Kopf gezogen ergab
    // es keine Fläche mehr, sondern verschluckte die Oberkante der Tabelle: das
    // Werkzeug-Band und der (ebenfalls graue) Tabellenkopf stiessen ohne Abstand
    // aneinander und lasen sich als ein Block.
    //
    // `pb-3` statt `pb-0` bleibt: die Such-Zeile sass sonst unmittelbar auf der
    // Trennlinie. Der Abstand gilt in BEIDEN Zuständen — im Fokus-Modus (ohne
    // Such-Zeile) trug ihn früher ein eigenes Padding am Titel-Block.
    <div
      // Knapper als früher (`pt-4 pb-3`): der Kopf steht über der Filterleiste,
      // und was er an Höhe nimmt, fehlt ihr unten — gemessen 145 px für drei
      // Zeilen à 32 px. Die 8 px hier sind eine viertel Filterzeile, die
      // Ersparnis am Merkmals-Raster (`FilterSidebarItem`) trägt den Rest.
      className="shrink-0 pt-3 pb-2"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      {/* Kopfzeile über die VOLLE Blattbreite (nur px-8), nicht in der
          max-w-6xl-Content-Box: der Hilfe-Knopf gehört auf jeder Seite an den
          rechten Blattrand (docs/architecture/ui-muster.md, Guard
          `hilfe-knopf-am-blattrand`). Der Titel steht dadurch unverändert an
          seiner Stelle — nur die Kopf-Aktionen rücken nach außen. */}
      <div className="px-8">
        {/* Title — Tabs zeigen Ansicht + Counts. Bearbeiter-Filter-Pill sitzt
            direkt neben dem Titel, damit der User immer sieht, dass der
            Kuerzel-Filter aktiv ist — auch wenn die Quickfilter-Toolbar
            darunter expandiert ist. */}
        <PageHeader
          className={listeSichtbar ? 'mb-2' : ''}
          title={menuLabel('antraege', 'Förderanträge')}
          meta={listeSichtbar ? (
            <span className="inline-flex items-center gap-1.5 flex-wrap">
              <BereichChip ausgeblendet={ausgeblendet} />
              {/* Steht in BEIDEN Sichten — sonst führte „Alle Bearbeiter" in
                  einen Zustand ohne sichtbaren Rückweg. */}
              <BearbeiterSichtChip />
              {/* Der Stillstands-Chip nennt die NICHT PRUEFBAREN. Ein Antrag
                  ohne datierbares Kuerzel steht nicht still — er laesst sich
                  nicht beurteilen, und ihn stumm zu den Unauffaelligen zu
                  schlagen waere eine Aussage ohne Grundlage. */}
              {stillstandTage !== null ? (
                <button
                  type="button"
                  onClick={() => setStillstandTage(null)}
                  title={stillstandUnpruefbar > 0
                    ? `${stillstandUnpruefbar} Antraege tragen kein datierbares Kuerzel und lassen sich nicht beurteilen — sie fehlen in dieser Liste. Klick hebt den Filter auf.`
                    : 'Klick hebt den Stillstands-Filter auf.'}
                  className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] transition-colors shrink-0"
                >
                  <span>{`Stillstand > ${stillstandTage} T.`}</span>
                  {stillstandUnpruefbar > 0 ? (
                    <span className="text-[var(--tf-text-tertiary)]">
                      {`· ${stillstandUnpruefbar} nicht pruefbar`}
                    </span>
                  ) : null}
                  <X size={11} />
                </button>
              ) : null}
            </span>
          ) : undefined}
          // Kopf-Aktionen am Blattrand, links neben der Hilfe (v4.70). Am Ende
          // der Reiter-Zeile standen sie verloren: dort trennte sie nichts von
          // den Reitern, und die Zeile handelt von der Sicht, nicht von
          // Werkzeugen. Im Fokus-Modus bleiben Titel + Hilfe — „Antragsdokumente"
          // braucht zwar keine Liste, aber der Kopf soll dort zusammenschrumpfen.
          actions={(
            <div className="flex items-center gap-2">
              {listeSichtbar && isGutachtenWorkflowEnabled() ? (
                <Tooltip text={AUFNAHME_DETAIL} maxWidth={340} wrapperClassName="flex items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => useAufnahmeUiStore.getState().toggle()}
                    aria-label="Antragsdokumente aufnehmen"
                    className="h-8 gap-1.5 px-2.5 font-normal"
                  >
                    <FileUp size={13} strokeWidth={1.75} />
                    <span className="text-[12px]">Antragsdokumente</span>
                  </Button>
                </Tooltip>
              ) : null}
              {listeSichtbar ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exportBusy || filtered.length === 0 || !activeProgrammId}
                  aria-label={`Liste als XLSX exportieren (${filtered.length} Anträge)`}
                  title={`Liste als XLSX exportieren (${filtered.length} Anträge)`}
                  className="h-8 w-8 p-0 font-normal"
                >
                  {exportBusy
                    ? <Loader2 size={13} strokeWidth={1.75} className="animate-spin" />
                    : <Download size={13} strokeWidth={1.75} />}
                </Button>
              ) : null}
              <SeitenHilfeButton pluginId="antraege" />
            </div>
          )}
        />
      </div>

      {/* Rumpf-Wrapper teilt EXAKT die Content-Box von Liste/Tabelle
          (max-w-6xl px-8, Padding innen) — dadurch fluchten Toolbar-Icons,
          „Spalten"-Dropdown und Tabellen-Rand. Die Unterkanten-Border läuft
          voll durch, weil sie auf dem äußeren (padding-freien) Container sitzt. */}
      <div className="max-w-6xl px-8">
        {/* Reiter-Zeile: die Sichten und am Ende das Lesezeichen für die eigenen.
            Werkzeuge stehen hier keine mehr — der Ansichts-Umschalter ist eine
            Achse im „Darstellung"-Menü geworden (v4.64), der Filter-Knopf in die
            Suchzeile gezogen, „Antragsdokumente" und Export in den Seitenkopf (v4.70).
            Zeile komplett nur bei sichtbarer Liste — im Fokus-Modus bliebe sonst
            eine leere Zeile mit ihrem Innenabstand stehen. */}
        {listeSichtbar ? (
          <div className="flex items-end gap-4">
            <ScopeTabs
              variant="tabs"
              // Trenner vor „Begleitung": links steht die Antragsphase mit ihrer
              // Uhr (Antragsdatum + 90 Tage) und der Fristen-Sicht darauf, rechts
              // der andere Lebensabschnitt mit eigener Uhr (VN-Eingang + 6 Monate)
              // und die Gesamtmenge. Ohne die Linie liest sich „Begleitung" wie
              // ein weiterer Schnitt durch die Antragsphase.
              //
              // Zweiter Trenner vor dem ersten eigenen Reiter: links steht, was
              // die App mitbringt, rechts, was sich jemand selbst eingerichtet
              // hat. Ohne die Linie sähe ein eigener Reiter aus wie eine fünfte
              // Werkseinstellung.
              items={[
                ...VIEWS.map(v => ({
                  key: v.key,
                  label: v.label,
                  count: counts[v.key],
                  trennerDavor: v.key === 'begleitung',
                })),
                ...eigeneReiter.map((r, i) => ({
                  key: r.id,
                  label: r.name,
                  title: beschreibeZustand(r.zustand, getView(r.zustand.basis).label),
                  trennerDavor: i === 0,
                })),
              ]}
              activeKey={aktiverEigener?.id ?? activeView}
              onChange={key => {
                const eigener = eigeneReiter.find(r => r.id === key);
                if (eigener) { wendeReiterAn(eigener.zustand); return; }
                setActiveView(key as ViewKey);
              }}
              aria-label="Ansicht"
            />
            {/* Der Weg zum eigenen Reiter sitzt am ENDE der Leiste, nicht in der
                Werkzeugzeile rechts: er handelt von den Reitern, nicht von der
                Liste. */}
            <EigeneReiterMenue />
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
                  ref={feldRef}
                  placeholder={frage.nlModus
                    ? 'Frage stellen, z. B. „alle Netzwerke, die für Phase 2 abgelehnt wurden" — Enter'
                    : 'Anträge durchsuchen (Titel, Akronym, FKZ, Antragsteller, Ort, Dokumente)'}
                  value={search}
                  onChange={e => { setSearch(e.target.value); vorschlaege.beiEingabe(); }}
                  onFocus={vorschlaege.beiFokus}
                  onBlur={vorschlaege.beiVerlust}
                  // Im Frage-Modus laeuft NICHTS beim Tippen: ein KI-Aufruf je
                  // Tastendruck waere weder bezahlbar noch sinnvoll. Erst Enter —
                  // und was Enter dann bedeutet, entscheidet `beiTaste`
                  // (Zeile waehlen / in die Luecke springen / fragen).
                  onKeyDown={vorschlaege.beiTaste}
                  className="pl-7 pr-7 h-8 w-full text-[12.5px]"
                  title={frage.nlModus
                    ? 'Ganze Frage eingeben und Enter drücken. Die interne KI übersetzt sie in Filter.'
                    : 'Wortlaut über Aktenzeichen/Akronym/Titel/Antragsteller/Ort/Bundesland/'
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
                <FrageVorschlaege steuerung={vorschlaege} />
              </div>
              {/* Umschalter und Knopf stehen RECHTS vom Feld: die Reihenfolge
                  bildet den Ablauf ab — erst schreiben, dann die Suchart, dann
                  abschicken. Links standen sie vor dem Feld und wirkten wie eine
                  Beschriftung des Filter-Knopfs daneben. */}
              {frageAn ? <FrageUmschalter frage={frage} /> : null}
              {/* Der Knopf steht nur da, solange die Frage NICHT übersetzt ist —
                  wortgleich zur Dokumenten-Suche. Die Eingabetaste tut dasselbe;
                  der Knopf sagt, DASS es eine Geste braucht, statt es den Nutzer
                  raten zu lassen. */}
              {frageAn && frage.nlModus && frageIstOffen ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Sparkles}
                  loading={frage.laeuft}
                  onClick={vorschlaege.absenden}
                  className="h-8 shrink-0"
                >
                  Frage stellen
                </Button>
              ) : null}
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

            {/* Zwei Gründe, warum die Liste noch steht, wie sie steht — der
                Lücken-Hinweis schlägt den allgemeinen, weil er der konkretere
                ist. Ohne diese Zeile sah eine getippte Frage aus wie eine
                gestellte (v4.107). */}
            {vorschlaege.hinweis !== null || frageIstOffen ? (
              <div className="mt-1 flex items-start gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">
                <Sparkles size={13} className="mt-[1px] shrink-0 text-[var(--tf-text-tertiary)]" aria-hidden />
                <span>{vorschlaege.hinweis ?? FRAGE_OFFEN_HINWEIS}</span>
              </div>
            ) : null}

            {/* Was die Frage gesetzt hat — und was von ihr nicht ankam. */}
            {frageAn ? <FrageDeutung frage={frage} /> : null}

            {/* Was die Suche gerade findet + der Weg zur Ähnlichkeit. Steht nur
                bei laufender Suche und ersetzt das Dauer-Auswahlfeld. */}
            <AehnlichkeitsHinweis />
          </>
        ) : null}
      </div>
    </div>
  );
}
