/**
 * Die Suchseite.
 *
 * Aufbau von oben nach unten (Handoff `_design/handoff/suche`):
 * Kopf · Suchfeld · Optionen · Deutung („Gesucht wird") · Facetten ·
 * Ergebniskopf · Liste ODER Tabelle · Assistent rechts.
 *
 * Diese Datei ORCHESTRIERT nur. Jede Zeile hat ihre eigene Komponente, jede
 * Rechnung ihr eigenes reines Modul — die Seite war mit 532 Zeilen schon an der
 * Grenze, und der Umbau hätte sie verdreifacht.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, Download, List, Table } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ViewModeToggle, type ViewModeOption } from '@/components/ui/ViewModeToggle';
import { DarstellungDropdown } from '@/components/ui/DarstellungDropdown';
import { isDokumentenscanEnabled, isSucheNatuerlicheSpracheEnabled } from '@/config/feature-flags';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { aktiveLeitbegriffe, planMarkierWoerter, planSchraenktEin } from '@/core/services/search/frageplan';
import { ermittleFrageplan } from '@/core/services/search/frageplan-lauf';
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
import { SearchInput } from './SearchInput';
import { SucheStartzustand, type StartEintrag } from './SucheStartzustand';
import type { StartReiterId } from './start/startReiter';
import { FrageAntwortKarte } from './antwort/FrageAntwortKarte';
import { useFrageAntwort } from './antwort/useFrageAntwort';
import { useAntwortBruecke } from './antwort/useAntwortBruecke';
import { GenannteChip } from './antwort/GenannteChip';
import { AntwortBelegProvider } from './antwort/AntwortBelegKontext';
import { spaltenMitAntwort, erzwungeneSpalten } from './antwort/antwortSpalte';
import { KeinTrefferZustand } from './KeinTrefferZustand';
import { TrefferListe } from './TrefferListe';
import { SuchMarkierungProvider } from './SuchMarkierung';
import { ErgebnisZahl } from './ErgebnisZahl';
import { SuchOptionenZeile } from './SuchOptionenZeile';
import { AehnlichkeitsZeile } from './AehnlichkeitsZeile';
import { DeutungsZeile } from './DeutungsZeile';
import { FacettenZeile } from './FacettenZeile';
import { SpaltenFilterChips, hatSpaltenFilter } from './SpaltenFilterChips';
import { SucheMeldung } from './SucheMeldung';
import { ANALYSE_MAX_RESULTS, useSearchResults } from './useSearchResults';
import { useKorpusZahlen } from './useKorpusZahlen';
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
import { useSuchOptionen } from '@/core/hooks/useSuchOptionen';
import { ChatPanelHost } from '@/plugins/chat/ChatPanelHost';
import { effectiveAssistentWidth, sucheAssistentUiStore } from './assistentPanel';
import { useAssistentPanel } from './useAssistentPanel';
import { antragDetailPfad } from '@/plugins/antraege/detailPfad';
import { hatLuecke } from '@/components/frage-vorschlaege';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
// Direkt am Quellmodul: das Barrel zöge `FeedbackPanel` mit (SeitenHilfeButton.tsx).
import { useFeedbackDialog } from '@/components/feedback/useFeedbackDialog';
import { wendeFacettenAn, aktiveFilterTexte, LEERE_WAHL, type FacettenId } from './facetten';
import { useErreichbareAntraege, useSuchRichtlinien, wendeRichtlinienAn } from './richtlinienWahl';
import { SuchRichtlinienChip } from './SuchRichtlinienChip';
import { autoSpalten } from './autoSpalten';
import { baueWortChips, markierWoerter, wirksameAnfrage } from './deutung';
import { pruefeWortformen } from '@/core/services/search/wortformen-pruefung';
import { baueSucheDarstellungsAchsen, vergleiche, type SucheAchsenId } from './darstellungsAchsen';
import { berechneAuswege, type Ausweg } from './auswege';
import type { GespeicherteSuche } from './gespeicherteSuchen';
import { useGespeicherteSuchen } from './useGespeicherteSuchen';
import { GespeicherteSuchenMenu } from './GespeicherteSuchenMenu';
import { haeufigsteAnfragen } from './suchseite-utils';

/** UI-Text fuer die Search-Phase-Badge. */
const PHASE_LABELS: Record<SearchPhase, string | null> = {
  idle: null,
  substring: 'Wortlaut-Treffer…',
  vector: 'Ähnlichkeits-Treffer…',
  orama: 'Dokumente…',
  done: null,
  error: null,
};

/** Wie viele Einträge der Startzustand je Spalte zeigt. */
const START_MAX = 5;

/** Nur zwei Ansichten — Karten hätten hier nichts zu zeigen, was die Liste
 *  nicht besser zeigt. */
const ANSICHT_OPTIONEN: ViewModeOption<'liste' | 'tabelle'>[] = [
  { mode: 'liste', label: 'Liste', Icon: List },
  { mode: 'tabelle', label: 'Tabelle', Icon: Table },
];

export function SuchSeite(): React.ReactElement {
  const navigate = useNavigate();
  const visibleColumns = useSucheStore(s => s.visibleColumns);
  const addRecentSearch = useSucheStore(s => s.addRecentSearch);
  const recentSearches = useSucheStore(s => s.recentSearches);
  const anfrageZaehler = useSucheStore(s => s.anfrageZaehler);
  const removeRecentSearch = useSucheStore(s => s.removeRecentSearch);
  const analysePrompt = useSucheStore(s => s.analysePrompt);
  const setAnalysePrompt = useSucheStore(s => s.setAnalysePrompt);
  const analyse = useAnalysePipeline();
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);

  const semanticEnabled = useSemanticSearchMode(s => s.enabled);
  const setSemanticEnabled = useSemanticSearchMode(s => s.setEnabled);
  const verknuepfung = useSuchVerknuepfung(s => s.verknuepfung);
  const setVerknuepfung = useSuchVerknuepfung(s => s.setVerknuepfung);
  const stammSuche = useSuchOptionen(s => s.stammSuche);
  const setStammSuche = useSuchOptionen(s => s.setStammSuche);
  const bereich = useSuchOptionen(s => s.bereich);
  const setBereich = useSuchOptionen(s => s.setBereich);
  const abgewaehlteVarianten = useSuchOptionen(s => s.abgewaehlteVarianten);
  const toggleVariante = useSuchOptionen(s => s.toggleVariante);
  // Welche Förder-Richtlinien in der Trefferliste stehen dürfen. Eigene, gemerkte
  // Auswahl — NICHT der Betrachtungsbereich der Arbeitslisten: der steht auf
  // „letzte 3 Richtlinien", die Suche im Grundzustand auf alle (Pitfall #46).
  const richtlinien = useSuchRichtlinien();
  const richtlinienMenge = richtlinien.menge;
  // Natürliche Sprache: nur sichtbar, wenn der Build sie mitbringt. Der Schalter
  // darf gemerkt sein, ohne dass die Oberfläche ihn zeigt — deshalb wird das Flag
  // an JEDER Stelle mitgeprüft, nicht nur beim Rendern des Umschalters.
  const nlFreigeschaltet = isSucheNatuerlicheSpracheEnabled();
  const nlModus = useSuchOptionen(s => s.natuerlicheSprache) && nlFreigeschaltet;
  const setNlModus = useSuchOptionen(s => s.setNatuerlicheSprache);
  /**
   * Welchen Reiter der Startzustand zeigen soll — Wunsch, nicht Zustand.
   *
   * Der Nonce ist kein Zierrat: zweimal auf „einer Frage" zu schalten muss den
   * Reiter zweimal öffnen, auch wenn die Id dieselbe bleibt (gleiches Muster wie
   * `WerkbankSection.vorbelegung`). Gemerkt wird er NICHT — die eigene Reiterwahl
   * soll den Moduswechsel überleben.
   */
  const [reiterWunsch, setReiterWunsch] = useState<{ id: StartReiterId; nonce: number } | null>(null);

  const query = useSucheStore(s => s.query);
  const setQuery = useSucheStore(s => s.setQuery);
  const abgewaehlteWoerter = useSucheStore(s => s.abgewaehlteWoerter);
  const toggleWort = useSucheStore(s => s.toggleWort);
  const facettenWahl = useSucheStore(s => s.facettenWahl);
  const setFacettenWahl = useSucheStore(s => s.setFacettenWahl);
  const ansicht = useSucheStore(s => s.ansicht);
  const setAnsicht = useSucheStore(s => s.setAnsicht);
  const sortierung = useSucheStore(s => s.sortierung);
  const setSortierung = useSucheStore(s => s.setSortierung);
  const dichte = useSucheStore(s => s.dichte);
  const setDichte = useSucheStore(s => s.setDichte);
  const frageplan = useSucheStore(s => s.frageplan);
  const abgewaehlteBegriffe = useSucheStore(s => s.abgewaehlteBegriffe);
  const toggleBegriff = useSucheStore(s => s.toggleBegriff);
  const planLaeuft = useSucheStore(s => s.planLaeuft);
  const planFehler = useSucheStore(s => s.planFehler);
  const aiBridge = useAIBridge();

  /**
   * Der aktive Plan — nur, solange er zur Eingabe passt.
   *
   * Der Store verwirft ihn beim Tippen; diese zweite Prüfung deckt den Fall ab,
   * dass die Eingabe auf einem anderen Weg gesetzt wurde (Beispiel-Klick,
   * gemerkte Suche, Deep-Link). Ein Plan, der eine andere Frage beschreibt als
   * die im Feld, wäre eine Legende, die lügt.
   */
  const aktiverPlan = frageplan !== null && frageplan.frage === query.trim() ? frageplan : null;

  /** Darf die KI Treffer begründen? Nur zu einer Frage — Begründung siehe
   *  `TrefferZeile`. Gilt für BEIDE Wege in dieselbe Ausgabe („Warum?" je Zeile,
   *  „Alle begründen" als Stapel); nur einen zu sperren erzeugte Begründungen,
   *  die die Zeile dann nicht anzeigt. */
  const mitBegruendung = aktiverPlan !== null;

  /**
   * Die Leitbegriffe, mit denen tatsächlich gesucht wird — memoisiert, weil sie
   * im Dep-Array des Such-Effekts stehen. Eine bei jedem Render neu gebaute
   * Liste liefe endlos.
   */
  const planTeile = useMemo(
    () => (aktiverPlan ? aktiveLeitbegriffe(aktiverPlan, abgewaehlteBegriffe) : undefined),
    [aktiverPlan, abgewaehlteBegriffe],
  );

  /**
   * Eine Frage steht im Feld, ist aber noch nicht gestellt.
   *
   * In diesem Zustand sucht die Seite GAR NICHT. Vorher lief hier der getippte
   * Satz als Stichwortsuche mit — „Welche Vorhaben drehen sich um Normung?"
   * ergab null Treffer, und daneben standen Regler, die auf diese Nullsuche
   * wirkten. Wer eine Frage formuliert, hat noch nichts gefragt; die Seite tut
   * bis dahin nichts und sagt das auch.
   */
  const frageOffen = nlModus && query.trim() !== '' && aktiverPlan === null;

  // Die Suche läuft auf der WIRKSAMEN Anfrage — ohne die in der Deutungszeile
  // abgewählten Wörter. Was im Feld steht, bleibt unangetastet: der Nutzer soll
  // seine Eingabe wiedererkennen und die Abwahl zurücknehmen können.
  //
  // Mit Plan entfällt das: dort steht eine FRAGE im Feld, deren Wörter nie
  // Suchbegriffe waren — abgewählt werden die Leitbegriffe des Plans, und das
  // geschieht über `planTeile`, nicht über den Anfragetext.
  const wirksam = useMemo(
    () => {
      if (frageOffen) return '';
      return aktiverPlan ? query : wirksameAnfrage(query, verknuepfung, abgewaehlteWoerter);
    },
    [frageOffen, aktiverPlan, query, verknuepfung, abgewaehlteWoerter],
  );
  const deferredQuery = useDeferredValue(wirksam);
  const [toast, setToast] = useState<string | null>(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [ausgeklappt, setAusgeklappt] = useState<ReadonlySet<string>>(new Set());
  const [auswahl, setAuswahl] = useState<ReadonlySet<string>>(new Set());

  // Die KI-Prüfung der Wortformen. Sitzungs-lokal wie die Abwahl selbst: sie
  // gilt für DIESE Anfrage, nicht für immer.
  const [variantenPruefungLaeuft, setVariantenPruefungLaeuft] = useState(false);
  const [gepruefteAnfrage, setGepruefteAnfrage] = useState<string | null>(null);
  const [gespeicherteMenuOffen, setGespeicherteMenuOffen] = useState(false);

  // Andockendes Assistenten-Panel (Journey-Paket 1, Phase 4) — Breite, Ziehen,
  // Deep-Link wohnen in `useAssistentPanel`.
  const {
    open: assistentOpen,
    width: assistentWidth,
    viewportWidth,
    close: closeAssistent,
    onResize: onAssistentResize,
  } = useAssistentPanel();

  const {
    results: searchResults, loading, counts, indexInfo, vectorReady, semantikBefund,
    searchPhase, semanticStatus, varianten,
  } = useUnifiedSearch(deferredQuery, planTeile);
  const deferredPhase = useDeferredValue(searchPhase);
  const phaseLabel = PHASE_LABELS[deferredPhase];
  const queryNotEmpty = query.trim() !== '';
  // Eine offene Frage sucht nicht — also dreht sich auch kein Rad. Ohne diese
  // Ausnahme liefe der Spinner endlos, weil `deferredPhase` bei leerer Anfrage
  // nie auf `done` läuft.
  const showSpinner = !frageOffen
    && (loading || (queryNotEmpty && deferredPhase !== 'done' && deferredPhase !== 'error'));
  const analyseActive = analyse.begruendungById !== null;
  const analyseDone = analyse.result !== null && !analyse.running;

  // Die Richtlinien-Auswahl steht VOR den Facetten: deren Zahlen sind eine
  // Zusage, und sie müssen auf der Menge gelten, die tatsächlich erscheint.
  const nachRichtlinien = useMemo(
    () => wendeRichtlinienAn(searchResults, richtlinienMenge),
    [searchResults, richtlinienMenge],
  );
  const richtlinienAusgeblendet = searchResults.length - nachRichtlinien.length;
  // Der Nenner der Ergebniszeile: unter einer Einschränkung sind nicht mehr
  // alle Anträge des Index durchsucht worden, und „0 Treffer in 14 225
  // Anträgen" behauptete genau das.
  const erreichbar = useErreichbareAntraege({
    idb: storage.idb,
    programmId: activeProgrammId,
    gesamt: indexInfo.antraegeGeladen,
    menge: richtlinienMenge,
  });
  // Das Auswahl-Panel geht unter diesem Kopf auf, nicht über ihm — die Zahl,
  // die sich beim Umschalten ändert, muss dabei sichtbar bleiben.
  const ergebnisKopf = useRef<HTMLDivElement>(null);

  // Facetten stehen VOR der Tabellen-Pipeline: sie gelten für Liste UND Tabelle.
  const nachFacetten = useMemo(
    () => wendeFacettenAn(nachRichtlinien, facettenWahl),
    [nachRichtlinien, facettenWahl],
  );

  // Spalten, die diese Anfrage selbst einblendet: die Belege, die sonst in
  // keiner Zeile stünden (Ort, Deskriptoren). Gerechnet auf der Menge NACH den
  // Facetten — die Spalte soll das erklären, was in der Tabelle steht.
  const autoBasis = useMemo(() => autoSpalten(bereich, nachFacetten), [bereich, nachFacetten]);

  const {
    columnFiltered,
    sorted, analyseResults, visibleColumnDefs, filterCandidatesByColumn, filterCountsByColumn,
    sortKey, sortDirection, handleSort,
    columnFilters, handleColumnFilterChange, setzeSpaltenFilterZurueck,
    columnWidths, handleColumnWidthChange,
  } = useSearchResults({
    searchResults: nachFacetten,
    begruendungById: analyse.begruendungById,
    analyseActive,
    visibleColumns,
    autoColumnKeys: autoBasis,
  });

  // Die Liste sortiert nach der Darstellungs-Achse, die Tabelle nach ihrer
  // Spalte. Zwei Ansichten, zwei Bedienarten — eine gemeinsame Sortierung wäre
  // in einer der beiden immer die falsche.
  // Sortiert wird `columnFiltered`, NICHT `dataSource`: ein Ansichtswechsel darf
  // die Reihenfolge tauschen, nie die Menge (Begründung am Feld selbst).
  const listeSortiert = useMemo(
    () => [...columnFiltered].sort((a, b) => vergleiche(a, b, sortierung)),
    [columnFiltered, sortierung],
  );
  const sichtbar = ansicht === 'liste' ? listeSortiert : sorted;

  // Markiert wird, wonach GESUCHT wurde. Bei einer Frage sind das die Nadeln des
  // Plans — aus „Welche Vorhaben drehen sich um Normung?" würden sonst „welche"
  // und „drehen" im Treffertext angestrichen.
  const markWoerter = useMemo(
    () => (aktiverPlan
      ? planMarkierWoerter(aktiverPlan, abgewaehlteBegriffe)
      : markierWoerter(query, verknuepfung, abgewaehlteWoerter)),
    [aktiverPlan, abgewaehlteBegriffe, query, verknuepfung, abgewaehlteWoerter],
  );
  const aktiveVariantenChips = useMemo(
    () => varianten.filter(v => !abgewaehlteVarianten.includes(v.toLowerCase())),
    [varianten, abgewaehlteVarianten],
  );

  // Eager Preload beim Mount (Hintergrund, idle).
  useEffect(() => {
    if (!activeProgrammId) return;
    const cancel = scheduleIdle(() => {
      void getProgrammCaches(storage.idb, activeProgrammId).catch(() => { /* best effort */ });
      if (!semanticEnabled || !isSemanticSearchActive()) return;
      void ensureEmbeddingReady(storage.idb).catch(() => { /* best effort */ });
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

  // ---- Zahlen aus dem Wortlaut-Korpus ---------------------------------------
  const { korpusBereit, wertIndex, probelauf, zaehleVorschlag } = useKorpusZahlen({
    storage, activeProgrammId, verknuepfung, stammSuche, bereich, richtlinienMenge,
  });

  const auswege = useMemo<Ausweg[]>(() => {
    if (!korpusBereit || sichtbar.length > 0 || !queryNotEmpty || showSpinner) return [];
    return berechneAuswege({
      query: wirksam,
      verknuepfung,
      stammSuche,
      bereich,
      aktiveFilter: aktiveFilterTexte(facettenWahl),
      richtlinien: richtlinienMenge,
    }, probelauf);
  }, [korpusBereit, sichtbar.length, queryNotEmpty, showSpinner, wirksam,
    verknuepfung, stammSuche, bereich, facettenWahl, richtlinienMenge, probelauf]);

  const startEintraege = useMemo<{ letzte: StartEintrag[]; haeufig: StartEintrag[] }>(() => {
    const zahl = (q: string): number | null =>
      korpusBereit ? probelauf(q, { verknuepfung, stammSuche, bereich }) : null;
    const letzte = recentSearches.slice(0, START_MAX);
    return {
      letzte: letzte.map(q => ({ query: q, treffer: zahl(q) })),
      // Was oben schon steht, kommt unten nicht noch einmal — sonst stünde
      // dieselbe Anfrage zweimal auf einer Seite, unter zwei Überschriften.
      haeufig: haeufigsteAnfragen(anfrageZaehler, recentSearches, letzte, START_MAX)
        .map(q => ({ query: q, treffer: zahl(q) })),
    };
  }, [recentSearches, anfrageZaehler, korpusBereit, probelauf, verknuepfung, stammSuche, bereich]);

  const gemerkt = useGespeicherteSuchen(probelauf, korpusBereit);

  // ---- Aktionen -------------------------------------------------------------

  const handleQueryChange = (next: string): void => {
    setQuery(next);
    setFacettenWahl(LEERE_WAHL);
    setAuswahl(new Set());
    setAusgeklappt(new Set());
    if (analyseActive) analyse.reset();
  };

  const starteSuche = useCallback((q: string): void => {
    setQuery(q);
    addRecentSearch(q);
    setFacettenWahl(LEERE_WAHL);
    setAuswahl(new Set());
    if (analyseActive) analyse.reset();
  }, [setQuery, addRecentSearch, setFacettenWahl, analyseActive, analyse]);

  /**
   * Ein Frage-Beispiel anklicken: Text UND Modus setzen, dann übersetzen.
   *
   * Beides zusammen, nicht nur der Text — eine Frage, die als Stichwortsuche
   * liefe, fände nichts und brächte damit genau das Gegenteil dessen bei, wofür
   * das Beispiel dasteht.
   */
  /**
   * Die Frage von der internen KI in einen Frageplan übersetzen lassen.
   *
   * Bewusst an EINER Geste (Enter / Knopf) und nicht am Tippen: ein KI-Aufruf je
   * Tastendruck wäre weder bezahlbar noch erträglich. Danach rechnet die Suche
   * ohne weiteren Aufruf — auch das Abwählen eines Leitbegriffs.
   */
  const frageStellen = useCallback(async (frageArg?: string): Promise<void> => {
    // Der Beispiel-Klick reicht seine Frage MIT: `query` trägt sie in demselben
    // Render noch nicht, und ein Lauf auf dem alten Text übersetzte die vorige
    // Frage ein zweites Mal.
    const frage = (frageArg ?? query).trim();
    if (frage.length === 0 || hatLuecke(frage) || useSucheStore.getState().planLaeuft) return;
    const store = useSucheStore.getState();
    store.setPlanLaeuft(true);
    store.setPlanFehler(null);
    try {
      const res = await ermittleFrageplan(aiBridge, frage, new Date().getFullYear());
      if (!res.ok) {
        // Der Verbindungsfall hat schon den app-weiten Verbinden-Dialog geöffnet;
        // eine zweite Meldung daneben wäre Lärm. Die Eingabe bleibt in jedem Fall
        // stehen — sie ist das, was der Nutzer gerade formuliert hat.
        store.setPlanFehler(res.verbindungFehlt ? null : res.fehler);
        return;
      }
      store.setFrageplan(res.plan);
      addRecentSearch(frage);
      // Facetten des Plans setzen. Sie erscheinen dadurch als dieselben
      // entfernbaren Chips wie selbst gesetzte Filter — ein von der KI gesetzter
      // Filter darf nicht unsichtbarer sein als ein eigener.
      setFacettenWahl({
        ...LEERE_WAHL,
        status: [...res.plan.facetten.status],
        jahr: [...res.plan.facetten.jahr],
      });
      if (res.plan.bereich) setBereich(res.plan.bereich);
      setAuswahl(new Set());
      setAusgeklappt(new Set());
      if (analyseActive) analyse.reset();
      // Das Panel geht NICHT mehr von selbst auf (v4.89). Es tat es bis dahin mit
      // der Frage im Eingabefeld, und der Nutzer musste dieselbe Frage ein
      // zweites Mal abschicken, um eine Antwort zu bekommen — links ein
      // Suchauftrag, rechts eine Wissensfrage, gemeint war sie einmal. Die
      // Antwort steht jetzt als Karte über der Trefferliste; das Panel bleibt
      // für Rückfragen da und hat die Frage weiterhin im Feld (`vorbelegung`).
    } finally {
      useSucheStore.getState().setPlanLaeuft(false);
    }
  }, [query, aiBridge, addRecentSearch, setFacettenWahl, setBereich, analyseActive, analyse]);

  /**
   * Ein Frage-Beispiel anklicken: Text UND Modus setzen, dann übersetzen.
   *
   * Beides zusammen, nicht nur der Text — eine Frage, die als Stichwortsuche
   * liefe, fände nichts und brächte damit genau das Gegenteil dessen bei, wofür
   * das Beispiel dasteht.
   */
  /**
   * „Von der KI prüfen": EIN Lauf über die eingesammelten Wortformen.
   *
   * Das Ergebnis landet in derselben Abwahl-Liste, die auch der Klick auf einen
   * Chip füllt — die KI drückt nur Knöpfe, die der Nutzer auch selbst drücken
   * könnte. Deshalb braucht der Suchpfad davon nichts zu wissen, und jedes
   * aussortierte Wort steht danach durchgestrichen da statt zu verschwinden.
   */
  const variantenPruefen = useCallback(async (): Promise<void> => {
    if (varianten.length === 0 || variantenPruefungLaeuft) return;
    const woerter = baueWortChips(query, verknuepfung, abgewaehlteWoerter)
      .filter(c => c.aktiv)
      .map(c => c.wert);
    if (woerter.length === 0) return;
    setVariantenPruefungLaeuft(true);
    try {
      const res = await pruefeWortformen(aiBridge, woerter, varianten);
      if (!res.ok) {
        // Der Verbindungsfall hat schon den app-weiten Dialog geöffnet; eine
        // zweite Meldung daneben wäre Lärm.
        if (!res.verbindungFehlt) setToast(res.fehler);
        return;
      }
      useSuchOptionen.getState().waehleVariantenAb(res.aussortiert);
      setGepruefteAnfrage(wirksam);
      setToast(res.aussortiert.length === 0
        ? 'Die KI hat keine unpassenden Wortformen gefunden.'
        : `${res.aussortiert.length} Wortformen aussortiert — durchgestrichen und einzeln zurückholbar.`);
    } finally {
      setVariantenPruefungLaeuft(false);
    }
  }, [varianten, variantenPruefungLaeuft, query, verknuepfung, abgewaehlteWoerter, aiBridge, wirksam]);

  const starteFrage = useCallback((f: string): void => {
    setNlModus(true);
    setQuery(f);
    setFacettenWahl(LEERE_WAHL);
    setAuswahl(new Set());
    if (analyseActive) analyse.reset();
    void frageStellen(f);
  }, [setNlModus, setQuery, setFacettenWahl, analyseActive, analyse, frageStellen]);

  /**
   * Die Suchart umschalten — und den Einstieg mitnehmen.
   *
   * Wer auf „einer Frage" stellt, hat gerade entschieden, dass er anders suchen
   * will, und weiß in aller Regel noch nicht, wie eine Frage aussehen darf, die
   * diese Suche beantwortet. Der Reiter „Fragen" steht genau dafür da; ihn
   * selbst suchen zu lassen, ist eine Aufgabe, die der Umschalter schon
   * beantwortet hat. Zurück auf „Stichworten" schaltet den Reiter NICHT zurück:
   * das wäre eine Entscheidung über den Einstieg, die niemand getroffen hat.
   */
  const wechsleSuchart = useCallback((an: boolean): void => {
    setNlModus(an);
    if (an) setReiterWunsch(prev => ({ id: 'fragen', nonce: (prev?.nonce ?? 0) + 1 }));
  }, [setNlModus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function oeffneTreffer(r: UnifiedSearchResult): void {
    if (r.type === 'antrag' && r.fkz) {
      navigate(antragDetailPfad({ aktenzeichen: r.fkz })); // Rückweg: core/nav/herkunft.ts
    }
  }

  /** „Warum?": klappt auf und startet — falls noch keine Begründung da ist —
   *  einen Lauf für GENAU DIESE Zeile über dieselbe Pipeline wie der Batch.
   *  Ohne Frage klappt derselbe Knopf nur die Aktionen auf und ruft keine KI. */
  function warum(r: UnifiedSearchResult): void {
    setAusgeklappt(prev => {
      const next = new Set(prev);
      if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
      return next;
    });
    if (!mitBegruendung) return;
    const schonDa = analyse.begruendungById?.[r.id] !== undefined;
    if (!schonDa && !analyse.running && wirksam.trim().length > 0) {
      analyse.start(wirksam.trim(), [r], analysePrompt);
    }
  }

  function aehnlicheAntraege(r: UnifiedSearchResult): void {
    starteSuche(r.title);
    setSemanticEnabled(true);
  }

  /**
   * „Als unpassend melden" öffnet das FEEDBACK-Panel der App, vorbefüllt.
   *
   * Bewusst der vorhandene Weg statt eines eigenen Kanals: ein zweiter
   * Rückmeldeweg hätte kein Board, keine Antwort und keinen Empfänger. Und
   * bewusst ehrlich beschriftet — die Meldung ändert kein Ranking, sie sagt dem
   * Team Bescheid.
   */
  function alsUnpassendMelden(r: UnifiedSearchResult): void {
    useFeedbackDialog.getState().openDialog({
      vorbelegung: {
        kategorie: 'problem',
        titel: `Suchtreffer „${r.title}"${r.fkz ? ` (${r.fkz})` : ''} passt nicht zu „${wirksam}"`,
      },
    });
  }

  function waehle(r: UnifiedSearchResult): void {
    setAuswahl(prev => {
      const next = new Set(prev);
      if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
      return next;
    });
  }

  const openAssistentMitTreffern = (): void => {
    if (sichtbar.length === 0) return;
    sucheAssistentUiStore.getState().setOpen(true);
  };

  const openAnalysePrompt = (): void => {
    if (!wirksam.trim() || analyse.running || sichtbar.length === 0) return;
    setPromptDialogOpen(true);
  };

  const confirmAnalyse = (): void => {
    const q = wirksam.trim();
    if (!q || analyseResults.length === 0) return;
    setPromptDialogOpen(false);
    addRecentSearch(q);
    analyse.start(q, analyseResults, analysePrompt);
  };

  function wendeAuswegAn(a: Ausweg): void {
    if (a.aenderung.filterLeeren) setFacettenWahl(LEERE_WAHL);
    if (a.aenderung.richtlinienOeffnen) richtlinien.setModus('alle');
    if (a.aenderung.query !== undefined) setQuery(a.aenderung.query);
    if (a.aenderung.verknuepfung !== undefined) setVerknuepfung(a.aenderung.verknuepfung);
    if (a.aenderung.stammSuche !== undefined) setStammSuche(a.aenderung.stammSuche);
    if (a.aenderung.bereich !== undefined) setBereich(a.aenderung.bereich);
    setToast(`Angepasst: ${a.text}`);
  }

  function diesenSuchlaufMerken(): void {
    const q = query.trim();
    if (!q) return;
    // Trefferzahl und Datum stempelt der Hook — sie müssen mit derselben Latte
    // gemessen sein, gegen die sie später verglichen werden (siehe `merken`).
    gemerkt.merken({
      id: q.toLowerCase(),
      name: q,
      query: q,
      verknuepfung,
      stammSuche,
      bereich,
    });
    setToast(`„${q}" gemerkt`);
  }

  /** Eine gemerkte Suche ausführen: sie bringt ihre eigenen Regler mit, deshalb
   *  steht das hier und nicht im Hook — dort wohnen diese Regler nicht. */
  function fuehreGespeicherteAus(g: GespeicherteSuche): void {
    setVerknuepfung(g.verknuepfung);
    setStammSuche(g.stammSuche);
    setBereich(g.bereich);
    starteSuche(g.query);
    gemerkt.vermerke(g.id);
    setGespeicherteMenuOffen(false);
  }

  const darstellungsAchsen = useMemo(
    () => baueSucheDarstellungsAchsen({ sortierung, dichte, ansicht }),
    [sortierung, dichte, ansicht],
  );

  const noQuery = !queryNotEmpty;
  const showResults = !noQuery && !frageOffen && sichtbar.length > 0;
  // Alles, was ein Ergebnis beschreibt — Deutung, Facetten, Trefferzahl, Liste,
  // Kein-Treffer-Hilfe — hängt an derselben Bedingung: es MUSS ein Ergebnis
  // geben. „0 Treffer" wäre bei offener Frage keine Auskunft, sondern falsch.
  const zeigeErgebnisTeile = queryNotEmpty && !frageOffen;
  const zeigeStartzustand = noQuery && !loading;
  /**
   * Darf der Ergebniskopf eine Trefferzahl BEHAUPTEN?
   *
   * Nicht, solange der erste Lauf dieser Anfrage offen ist und noch nichts
   * angekommen ist: `results` steht dann auf der leeren Startmenge, und die
   * Zeile schriebe „0 Treffer" — durch die 300 ms Entprellung plus Korpus-Lauf
   * lange genug, um gelesen zu werden, bevor die echte Liste erscheint.
   * Gemeldet als „kurz 0 Treffer, dann die richtige Trefferliste"; es war nie
   * ein Ergebnis, sondern eine Zahl vor der Messung.
   *
   * Beim Weitertippen bleibt die Zahl des vorigen Laufs stehen (`sichtbar` ist
   * dann nicht leer) — eine kurz veraltete Zahl ist ehrlicher als eine falsche.
   */
  const trefferzahlSteht = !showSpinner || sichtbar.length > 0;

  /**
   * Die Antwort auf die gestellte Frage.
   *
   * Gerechnet wird über `sichtbar` — dieselbe Menge, die der Ergebniskopf
   * beziffert und die Tabelle darunter zeigt. Über `searchResults` (vor den
   * Facetten) wäre die Karte schneller fertig, sagte aber „aus 663 Treffern"
   * über eine Liste mit 87: zwei Zahlen für dieselbe Sache, und eine davon
   * falsch. Der Lauf startet erst, wenn die Suche fertig ist.
   */
  const frageAntwort = useFrageAntwort(aiBridge, aktiverPlan, sichtbar, trefferzahlSteht && !loading);
  const analyseProgressLabel = analyse.running
    ? (analyse.progress?.totalBatches
        ? `KI erstellt Begründungen… Batch ${analyse.progress.currentBatch ?? 0}/${analyse.progress.totalBatches}`
        : 'KI erstellt Begründungen…')
    : null;
  const laufendeBegruendung = useMemo<ReadonlySet<string>>(
    () => (analyse.running ? new Set(ausgeklappt) : new Set<string>()),
    [analyse.running, ausgeklappt],
  );

  // Die Verbindung zwischen der Antwort oben und der Liste darunter — Belege
  // je Zeile, der Filter „nur die genannten" und der Sprung. Warum sie auf
  // `sichtbar` und nicht auf ihrem eigenen Ergebnis arbeitet, steht im Modul.
  const bruecke = useAntwortBruecke({
    treffer: sichtbar,
    antwort: frageAntwort.antwort,
    aufAntragsseite: fkz => navigate(antragDetailPfad({ aktenzeichen: fkz })),
    wechsleZurListe: () => { if (ansicht !== 'liste') setAnsicht('liste'); },
  });
  const { belege: antwortBelege, angezeigt, genannteAnzahl } = bruecke;
  // Warum die KI-Spalte NACH der Pipeline dazukommt: `antwortSpalte.ts`.
  const spalten = useMemo(() => spaltenMitAntwort(visibleColumnDefs, genannteAnzahl), [visibleColumnDefs, genannteAnzahl]);

  return (
    <div className="flex h-full min-h-0">
      {/* `relative` ist hier kein Zierrat, sondern das, was die zweite
          Scrollleiste verhindert. Gemeldet: „es gibt eine doppelte Scrollleiste
          rechts, die ganz außen scrollt die gesamte Seite weg."

          Der nächste positionierte Vorfahre war der Seiten-Scroller des Shells
          (`flex-1 overflow-y-auto relative`, ShellLayout). Absolut positionierte
          Nachfahren der Trefferliste hingen damit an IHM — und ein overflow-
          Vorfahre klemmt einen absolut positionierten Nachfahren nur, wenn er
          auch sein Bezugsrahmen ist. Sie entkamen also diesem Scroller hier und
          bliesen den äußeren auf 10.632 px auf, obwohl dessen einziges Kind
          exakt containerhoch war. Gemessen: mit `relative` fällt die äußere
          Leiste von 10 px auf 0, die innere scrollt unverändert. */}
      <div className="relative flex-1 min-w-0 overflow-y-auto">
        <div className="px-8 pt-4 pb-6">

          {/* ── Kopf ─────────────────────────────────────────────────────── */}
          {/* Volle Blattbreite (KEIN max-w-6xl wie die Zeilen darunter): die
              Kopf-Aktionen — und mit ihnen der Hilfe-Knopf — gehören an den
              rechten Blattrand (ui-muster.md, Guard `hilfe-knopf-am-blattrand`). */}
          <div className="mb-4 flex w-full items-center gap-3">
            <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Suche</h1>
            <span className="text-[12.5px] text-[var(--tf-text-tertiary)]" title="So viele Anträge stehen im Suchindex dieses Rechners — die Zahl gilt der ganzen Seite und ändert sich mit keiner Option darunter.">Index: {indexInfo.antraegeGeladen.toLocaleString('de-DE')} Anträge</span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {/* „Speichern" LINKS vom Menü: erst merken, dann nachschlagen —
                  und weil die Gruppe rechtsbündig ist (`ml-auto`), wächst sie
                  nach links, statt beim Erscheinen die Nachbarn zu verschieben.
                  Sichtbar erst, wenn es etwas zu speichern GIBT (dieselbe
                  Bedingung wie Deutung, Facetten und Liste): eine getippte,
                  nicht gestellte Frage ist kein Suchlauf. */}
              {zeigeErgebnisTeile && (
                <button
                  type="button"
                  onClick={diesenSuchlaufMerken}
                  title="Diese Anfrage samt Optionen merken (nur auf diesem Gerät)"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
                >
                  Diese Suche speichern
                </button>
              )}
              <GespeicherteSuchenMenu
                liste={gemerkt.liste}
                treffer={gemerkt.treffer}
                offen={gespeicherteMenuOffen}
                onToggle={() => setGespeicherteMenuOffen(o => !o)}
                onAusfuehren={fuehreGespeicherteAus}
                onLoeschen={gemerkt.loeschen}
              />
              <SeitenHilfeButton pluginId="suche" />
            </div>
          </div>

          {/* ── Suchfeld ─────────────────────────────────────────────────── */}
          <div className="flex w-full max-w-6xl flex-wrap items-start gap-2">
            <SearchInput
              value={query}
              onValueChange={handleQueryChange}
              disabled={analyse.running} showSpinner={showSpinner || planLaeuft}
              frageModus={nlModus}
              onSubmit={nlModus ? (f: string) => { void frageStellen(f); } : undefined}
              platzhalter={nlModus ? 'Frage stellen, z. B. „Welche Vorhaben drehen sich um Normung?"' : undefined}
              // Im Frage-Modus schweigt die Vervollständigung: dort schreibt
              // niemand `ort:`, und ein Vorschlag zur Feldsyntax mitten in einem
              // Satz wäre eine Antwort auf eine Frage, die keiner gestellt hat.
              wertIndex={nlModus ? null : wertIndex}
              zaehle={nlModus ? undefined : zaehleVorschlag}
            />
            {/* Der Knopf steht nur im Frage-Modus da — und nur, solange die Frage
                noch nicht übersetzt ist. Enter tut dasselbe; der Knopf sagt, DASS
                es eine Geste braucht, statt es den Nutzer raten zu lassen. */}
            {nlModus && queryNotEmpty && aktiverPlan === null && (
              <Button
                variant="primary" size="sm" icon={Sparkles}
                loading={planLaeuft}
                disabled={analyse.running || hatLuecke(query)}
                onClick={() => { void frageStellen(); }}
                className="mt-[1px]"
              >
                Frage stellen
              </Button>
            )}
          </div>

          {nlModus && planFehler !== null && (
            <div className="mt-2 flex w-full max-w-4xl items-start gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
              <span aria-hidden="true">ⓘ</span>
              <span>{planFehler}</span>
            </div>
          )}

          {/* ── Optionen ─────────────────────────────────────────────────── */}
          <div className="mt-2 w-full max-w-6xl">
            <SuchOptionenZeile
              verknuepfung={verknuepfung}
              onVerknuepfung={setVerknuepfung}
              stammSuche={stammSuche}
              onStammSuche={setStammSuche}
              bereich={bereich}
              onBereich={setBereich}
              semantischAn={semanticEnabled}
              onSemantisch={setSemanticEnabled}
              semantischLaedt={semanticEnabled && !vectorReady}
              nlVerfuegbar={nlFreigeschaltet}
              nlModus={nlModus}
              onNlModus={wechsleSuchart}
              planAktiv={aktiverPlan !== null}
              planOhneAehnlichkeit={planSchraenktEin(planTeile)}
            />
          </div>

          <AehnlichkeitsZeile
            an={semanticEnabled} status={semanticStatus} befund={semantikBefund}
            bestand={indexInfo.antraegeGeladen}
          />

          {/* ── Deutung ──────────────────────────────────────────────────── */}
          {zeigeErgebnisTeile && (
            <div className="mt-2.5 w-full max-w-6xl">
              <DeutungsZeile
                query={query}
                verknuepfung={verknuepfung}
                abgewaehlteWoerter={abgewaehlteWoerter}
                onToggleWort={toggleWort}
                plan={aktiverPlan}
                abgewaehlteBegriffe={abgewaehlteBegriffe}
                onToggleBegriff={toggleBegriff}
                varianten={varianten}
                abgewaehlteVarianten={abgewaehlteVarianten}
                onToggleVariante={toggleVariante}
                onVariantenPruefen={nlFreigeschaltet ? () => { void variantenPruefen(); } : undefined}
                variantenPruefungLaeuft={variantenPruefungLaeuft}
                variantenGeprueft={gepruefteAnfrage !== null && gepruefteAnfrage === wirksam}
                stammSuche={stammSuche}
                onStammSucheAn={() => setStammSuche(true)}
              />
            </div>
          )}

          {/* ── Richtlinien + Facetten ───────────────────────────────────── */}
          {/* Der Chip steht im Ergebniskopf hinter der Zahl, auf die er wirkt —
              sonst nur im Startzustand, dessen Zahlen („Additive Fertigung ·
              531 Treffer") ebenso heruntergezählt sind (Pitfall #46). Bei
              offener Frage steht keine Zahl da, also auch kein Grund dafür. */}
          <div className="mt-2.5 flex w-full max-w-6xl flex-wrap items-center gap-2">
            {zeigeStartzustand && (
              <SuchRichtlinienChip
                bereich={richtlinien}
                ausgeblendet={richtlinienAusgeblendet}
                ergebnisKopf={ergebnisKopf}
              />
            )}
            {zeigeErgebnisTeile && (
              <FacettenZeile
                results={nachRichtlinien}
                wahl={facettenWahl}
                onWahl={(id: FacettenId, werte) => setFacettenWahl({ ...facettenWahl, [id]: werte })}
                // Räumt beides weg: ein „Filter zurücksetzen", das die Chips
                // neben sich stehen lässt, hält sein Wort nicht.
                onLeeren={() => { setFacettenWahl(LEERE_WAHL); setzeSpaltenFilterZurueck(); }}
              />
            )}
            {zeigeErgebnisTeile && (
              <SpaltenFilterChips filter={columnFilters} onChange={handleColumnFilterChange} />
            )}
            {/* Warum der Chip hier und nicht vor den Facetten steht: im Modul. */}
            <GenannteChip
              anzahl={genannteAnzahl}
              aktiv={bruecke.nurGenannte}
              onToggle={bruecke.schalteNurGenannte}
            />
          </div>

          {/* ── Offene Frage ─────────────────────────────────────────────── */}
          {frageOffen && (
            <div
              className="mt-3 flex w-full max-w-6xl items-center gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px] text-[var(--tf-text-secondary)]"
              style={{ background: 'var(--tf-desk)', border: '0.5px solid var(--tf-border)' }}
            >
              <Sparkles size={14} className="shrink-0 text-[var(--tf-text-tertiary)]" aria-hidden />
              {/* Eine Zeile, gemessen: max-w-6xl (1 152 px) minus px-3, Icon und
                  gap lassen bei 12,5 px rund 1 106 px — etwa 175 Zeichen. Die
                  Vorfassung hatte 211 und brach deshalb immer um. Wer hier Text
                  ergänzt, misst am gerenderten `<span>` nach (getClientRects),
                  nicht an der Absicht. */}
              <span>
                Noch nicht gestellt — „Frage stellen" oder Eingabetaste übersetzt sie
                mit der internen KI in Suchbegriffe, die danach hier stehen und abwählbar sind.
              </span>
            </div>
          )}

          {/* ── Antwort auf die Frage ────────────────────────────────────── */}
          {/* Steht ÜBER der Trefferliste und unter der Deutungszeile: erst was
              gesucht wurde, dann was dabei herauskam, dann die Treffer selbst.
              Nur im Frage-Modus — eine Stichwortsuche stellt keine Frage. */}
          {aktiverPlan !== null && (
            <FrageAntwortKarte
              laeuft={frageAntwort.laeuft}
              antwort={frageAntwort.antwort}
              fehler={frageAntwort.fehler}
              gesamt={frageAntwort.gesamt}
              onFkz={bruecke.springeZuFkz}
            />
          )}

          {/* ── Ergebniskopf ─────────────────────────────────────────────── */}
          {zeigeErgebnisTeile && (
            <div ref={ergebnisKopf} className="mt-3 flex w-full max-w-6xl flex-wrap items-center gap-2">
              <ErgebnisZahl
                steht={trefferzahlSteht}
                anzahl={angezeigt.length}
                erreichbar={erreichbar}
                gesamt={indexInfo.antraegeGeladen}
              />
              {/* Direkt hinter der Zahl, auf die er wirkt. In der Facettenzeile
                  stand er neben Filtern, die nur diese eine Anfrage betreffen —
                  er gilt aber bis auf Widerruf. */}
              <SuchRichtlinienChip
                bereich={richtlinien}
                ausgeblendet={richtlinienAusgeblendet}
                ergebnisKopf={ergebnisKopf}
              />

              {!vectorReady && semanticEnabled && !analyseActive && (
                <Badge variant="default">Embedding-Modell lädt…</Badge>
              )}
              {phaseLabel && !analyseActive && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-[var(--tf-text-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
                  <Loader2 size={11} className="animate-spin" />
                  {phaseLabel}
                </span>
              )}
              {analyse.running && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-[var(--tf-text-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
                  <Loader2 size={11} className="animate-spin" />
                  {analyseProgressLabel}
                  <button type="button" onClick={analyse.cancel} className="ml-1 underline hover:text-[var(--tf-text)]">
                    Abbrechen
                  </button>
                </span>
              )}

              <div className="ml-auto flex items-center gap-2">
                <ViewModeToggle
                  value={ansicht}
                  onChange={setAnsicht}
                  options={ANSICHT_OPTIONEN}
                  ariaLabel="Ansicht"
                />
                {ansicht === 'tabelle' && (
                  <ColumnPicker typeFilter="" erzwungeneKeys={erzwungeneSpalten(autoBasis, genannteAnzahl)} />
                )}
                <button
                  type="button"
                  onClick={openAssistentMitTreffern}
                  disabled={sichtbar.length === 0}
                  title="Assistent öffnen — er kennt die aktuellen Treffer als Kontext"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                >
                  <Sparkles size={13} />
                  Mit KI analysieren
                </button>
                {mitBegruendung && !analyseActive && !analyse.running && sichtbar.length > 0 && (
                  <button
                    type="button"
                    onClick={openAnalysePrompt}
                    title={`Erzeugt je Trefferzeile eine KI-Begründung (max. ${ANALYSE_MAX_RESULTS}, Provider: ${analyse.providerName})`}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
                    style={{ border: '0.5px solid var(--tf-border)' }}
                  >
                    Alle begründen
                  </button>
                )}
                {analyseDone && (
                  <button
                    type="button"
                    onClick={() => analyse.reset()}
                    className="inline-flex h-8 items-center rounded-[8px] px-2.5 text-[12.5px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
                    style={{ border: '0.5px solid var(--tf-border)' }}
                    title="Entfernt die KI-Begründungen; Treffer bleiben erhalten"
                  >
                    Begründungen entfernen
                  </button>
                )}
                {/* Rechts vor dem Download: der einzige Knopf der Leiste, der mit
                    dem Zustand WÄCHST („Darstellung: Kompakt") — links verschob
                    er bei jeder Wahl alles dahinter. Fehlt ganz, wo keine Achse
                    gilt (Tabelle, siehe `darstellungsAchsen.ts`). */}
                {darstellungsAchsen.length > 0 && (
                  <DarstellungDropdown
                    achsen={darstellungsAchsen}
                    onChange={(id: SucheAchsenId, key: string) => {
                      if (id === 'sortierung') setSortierung(key as typeof sortierung);
                      else setDichte(key as typeof dichte);
                    }}
                    titel="Sortierung und Dichte der Trefferliste"
                    className="h-8"
                  />
                )}
                <SearchDownloadMenu
                  disabled={sichtbar.length === 0}
                  onExportCSV={() => exportCSV(angezeigt, spalten, query)}
                  onExportXLSX={() => exportXLSX(angezeigt, spalten, query)}
                  onExportClipboard={() => {
                    void (async () => {
                      try {
                        await exportClipboard(angezeigt, spalten);
                        setToast(`${angezeigt.length} Ergebnisse in Zwischenablage kopiert`);
                      } catch (err) {
                        setToast(`Kopieren fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
                      }
                    })();
                  }}
                />
              </div>
            </div>
          )}

          {analyse.error && <SucheMeldung text={`KI-Analyse fehlgeschlagen: ${analyse.error}`} />}

          {analyseDone && analyse.result && analyse.result.warnings.length > 0 && (
            <SucheMeldung text={analyse.result.warnings.join(' · ')} />
          )}

          {toast && <SucheMeldung text={toast} status />}

          {loading && sichtbar.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-[var(--tf-text-secondary)]">
              <Loader2 size={14} className="animate-spin" />
              <span>Suche läuft{phaseLabel ? ` · ${phaseLabel}` : '…'}</span>
            </div>
          )}

          {/* ── Startzustand ─────────────────────────────────────────────── */}
          {zeigeStartzustand && (
            <SucheStartzustand
              textabschnitteImIndex={indexInfo.textabschnitteImIndex}
              letzte={startEintraege.letzte}
              haeufig={startEintraege.haeufig}
              gespeichert={gemerkt.liste}
              gespeicherteTreffer={gemerkt.treffer}
              wertIndex={wertIndex}
              zaehle={zaehleVorschlag}
              onSuche={starteSuche}
              onWiederholen={q => { starteSuche(q); if (nlModus) void frageStellen(q); }}
              onFrage={nlFreigeschaltet ? starteFrage : undefined}
              gewuenschterReiter={reiterWunsch}
              onEntferneLetzte={removeRecentSearch}
              onEntferneGespeicherte={gemerkt.loeschen}
              kuratorVariant={isKuratorFreigeschaltet() && isDokumentenscanEnabled()}
              onOpenDokumentenquellen={() => navigate('/kuration/dokumentenquellen')}
            />
          )}

          {/* ── Kein Treffer ─────────────────────────────────────────────── */}
          {zeigeErgebnisTeile && !loading && !showSpinner && sichtbar.length === 0 && (
            <KeinTrefferZustand
              query={query}
              woerter={markWoerter}
              auswege={auswege}
              hatFilter={aktiveFilterTexte(facettenWahl).length > 0 || richtlinienMenge !== null
                || hatSpaltenFilter(columnFilters)}
              onAnwenden={wendeAuswegAn}
            />
          )}

          {/* ── Ergebnis ─────────────────────────────────────────────────── */}
          {showResults && ansicht === 'liste' && (
            <div className="mt-3 w-full max-w-6xl">
              <TrefferListe
                treffer={angezeigt}
                woerter={markWoerter}
                varianten={aktiveVariantenChips}
                kompakt={dichte === 'kompakt'}
                ausgeklappt={ausgeklappt}
                auswahl={auswahl}
                laufendeBegruendung={laufendeBegruendung}
                onOeffnen={oeffneTreffer}
                onWarum={warum}
                onAehnliche={aehnlicheAntraege}
                onUnpassend={alsUnpassendMelden}
                onWaehlen={waehle}
                begruendungHinweis={analyse.error}
                mitBegruendung={mitBegruendung}
                antwortBelege={antwortBelege}
                sprungZiel={bruecke.sprung}
              />
            </div>
          )}

          {showResults && ansicht === 'tabelle' && (
            <div className="mt-3">
              {/* Dieselbe Markierung wie in der Liste: die Zellen-Renderer holen
                  die Wörter aus diesem Kontext (siehe SuchMarkierung.tsx). */}
              <AntwortBelegProvider belege={antwortBelege}>
              <SuchMarkierungProvider wortlaut={markWoerter} aehnlich={aktiveVariantenChips}>
                <SearchResultsTable
                  results={angezeigt}
                  columns={spalten}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  columnFilters={columnFilters}
                  onColumnFilterChange={handleColumnFilterChange}
                  filterCandidatesByColumn={filterCandidatesByColumn}
                  filterCountsByColumn={filterCountsByColumn}
                  columnWidths={columnWidths}
                  onColumnWidthChange={handleColumnWidthChange}
                  onRowClick={oeffneTreffer}
                />
              </SuchMarkierungProvider>
              </AntwortBelegProvider>
            </div>
          )}

          <span className="sr-only">{`unified-search: total=${counts.total} antraege=${counts.antraege} dokumente=${counts.dokumente}`}</span>

          <AnalysePromptDialog
            open={promptDialogOpen}
            query={wirksam.trim()}
            results={analyseResults}
            totalCount={angezeigt.length}
            instruction={analysePrompt}
            onInstructionChange={setAnalysePrompt}
            providerName={analyse.providerName}
            onConfirm={confirmAnalyse}
            onCancel={() => setPromptDialogOpen(false)}
          />
        </div>
      </div>

      {/* ── Mehrfachauswahl ─────────────────────────────────────────────── */}
      {auswahl.size > 0 && (
        <div
          role="toolbar"
          aria-label="Auswahl"
          className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-[10px] px-3 py-2"
          style={{ background: 'var(--tf-text)', boxShadow: 'var(--tf-shadow-dialog)' }}
        >
          <span className="text-[12.5px] text-[var(--tf-sheet)]">
            {auswahl.size} ausgewählt
          </span>
          <button
            type="button"
            onClick={() => {
              const gewaehlt = angezeigt.filter(r => auswahl.has(r.id));
              exportXLSX(gewaehlt, spalten, query);
            }}
            className="inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 text-[12px] text-[var(--tf-sheet)] hover:opacity-80 cursor-pointer"
            style={{ border: '0.5px solid var(--tf-sheet)' }}
          >
            <Download size={12} aria-hidden />
            Exportieren
          </button>
          <button
            type="button"
            onClick={() => {
              sucheAssistentUiStore.getState().setOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 text-[12px] text-[var(--tf-sheet)] hover:opacity-80 cursor-pointer"
            style={{ border: '0.5px solid var(--tf-sheet)' }}
          >
            <Sparkles size={12} aria-hidden />
            Mit KI vergleichen
          </button>
          <button
            type="button"
            onClick={() => setAuswahl(new Set())}
            className="rounded-[7px] px-2 py-1 text-[12px] text-[var(--tf-sheet)] hover:opacity-80 cursor-pointer"
          >
            Auswahl leeren
          </button>
        </div>
      )}

      {assistentOpen && (
        <aside className="flex h-full min-h-0 shrink-0 overflow-hidden" style={{ width: effectiveAssistentWidth(assistentWidth, viewportWidth) }}>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Assistent-Panel-Breite ändern"
            onMouseDown={onAssistentResize}
            className="h-full w-[4px] shrink-0 cursor-col-resize transition-colors hover:bg-[var(--tf-border-hover)]"
            style={{ borderLeft: '0.5px solid var(--tf-border)' }}
          />
          <div className="h-full min-w-0 flex-1">
            <ChatPanelHost
              onClose={closeAssistent}
              contextResults={angezeigt}
              contextQuery={wirksam.trim()}
              vorbelegung={aktiverPlan?.frage}
            />
          </div>
        </aside>
      )}
    </div>
  );
}
