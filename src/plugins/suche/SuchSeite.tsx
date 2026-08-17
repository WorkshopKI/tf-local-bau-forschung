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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from 'zustand';
import { Loader2, Sparkles, Bookmark, Download, List, Table } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { KeinTrefferZustand } from './KeinTrefferZustand';
import { TrefferListe } from './TrefferListe';
import { SuchMarkierungProvider } from './SuchMarkierung';
import { SuchOptionenZeile } from './SuchOptionenZeile';
import { DeutungsZeile } from './DeutungsZeile';
import { FacettenZeile } from './FacettenZeile';
import { ANALYSE_MAX_RESULTS, useSearchResults } from './useSearchResults';
import { scheduleIdle } from '@/core/utils/scheduleIdle';
import {
  getProgrammCaches,
  getEmbeddings,
  isSemanticSearchActive,
  autoBootstrapEmbeddingMirror,
  invalidateEmbeddingsCache,
  searchAntraegeSubstring,
} from '@/plugins/antraege/services/antraege-search-service';
import type { AntragTextEntry } from '@/plugins/antraege/services/search-corpus';
import type { WertIndex } from '@/plugins/antraege/services/wert-index';
import { ensureEmbeddingReady } from '@/core/services/embedding-corpus';
import { useSemanticSearchMode } from '@/core/hooks/useSemanticSearchMode';
import { useSuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import { useSuchOptionen } from '@/core/hooks/useSuchOptionen';
import { ChatPanelHost } from '@/plugins/chat/ChatPanelHost';
import {
  clampAssistentWidth,
  effectiveAssistentWidth,
  sucheAssistentUiStore,
} from './assistentPanel';
import { VON_SUCHE_STATE_KEY } from './herkunft';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
// Direkt am Quellmodul statt am Feedback-Barrel: das Barrel zieht `FeedbackPanel`
// mit, und das lädt die Plugin-Config nach (siehe SeitenHilfeButton.tsx).
import { useFeedbackDialog } from '@/components/feedback/useFeedbackDialog';
import { wendeFacettenAn, aktiveFilterTexte, LEERE_WAHL, type FacettenId } from './facetten';
import { autoSpalten } from './autoSpalten';
import { baueWortChips, markierWoerter, wirksameAnfrage } from './deutung';
import { pruefeWortformen } from '@/core/services/search/wortformen-pruefung';
import { baueSucheDarstellungsAchsen, vergleiche, type SucheAchsenId } from './darstellungsAchsen';
import { berechneAuswege, type Ausweg } from './auswege';
import {
  ladeGespeicherte, speichereGespeicherte, merkeSuche, entferneSuche, vermerkeLauf,
  type GespeicherteSuche,
} from './gespeicherteSuchen';
import { haeufigsteSuchen } from './suchseite-utils';

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
  // Natürliche Sprache: nur sichtbar, wenn der Build sie mitbringt. Der Schalter
  // darf gemerkt sein, ohne dass die Oberfläche ihn zeigt — deshalb wird das Flag
  // an JEDER Stelle mitgeprüft, nicht nur beim Rendern des Umschalters.
  const nlFreigeschaltet = isSucheNatuerlicheSpracheEnabled();
  const nlModus = useSuchOptionen(s => s.natuerlicheSprache) && nlFreigeschaltet;
  const setNlModus = useSuchOptionen(s => s.setNatuerlicheSprache);

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
  const [gespeichert, setGespeichert] = useState<GespeicherteSuche[]>(() => ladeGespeicherte());
  // Die KI-Prüfung der Wortformen. Sitzungs-lokal wie die Abwahl selbst: sie
  // gilt für DIESE Anfrage, nicht für immer.
  const [variantenPruefungLaeuft, setVariantenPruefungLaeuft] = useState(false);
  const [gepruefteAnfrage, setGepruefteAnfrage] = useState<string | null>(null);
  const [gespeicherteMenuOffen, setGespeicherteMenuOffen] = useState(false);

  // Andockendes Assistenten-Panel (Journey-Paket 1, Phase 4).
  const [searchParams, setSearchParams] = useSearchParams();
  const assistentOpen = useStore(sucheAssistentUiStore, s => s.open);
  const assistentWidth = useStore(sucheAssistentUiStore, s => s.width);
  const assistentDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440);
  useEffect(() => {
    const handler = (): void => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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

  const {
    results: searchResults, loading, counts, indexInfo, vectorReady,
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

  // Facetten stehen VOR der Tabellen-Pipeline: sie gelten für Liste UND Tabelle.
  const nachFacetten = useMemo(
    () => wendeFacettenAn(searchResults, facettenWahl),
    [searchResults, facettenWahl],
  );

  // Spalten, die diese Anfrage selbst einblendet: die Belege, die sonst in
  // keiner Zeile stünden (Ort, Deskriptoren). Gerechnet auf der Menge NACH den
  // Facetten — die Spalte soll das erklären, was in der Tabelle steht.
  const autoColumnKeys = useMemo(
    () => autoSpalten(bereich, nachFacetten),
    [bereich, nachFacetten],
  );

  const {
    dataSource,
    sorted, analyseResults, visibleColumnDefs, filterCandidatesByColumn, filterCountsByColumn,
    sortKey, sortDirection, handleSort,
    columnFilters, handleColumnFilterChange,
    columnWidths, handleColumnWidthChange,
  } = useSearchResults({
    searchResults: nachFacetten,
    begruendungById: analyse.begruendungById,
    analyseActive,
    visibleColumns,
    autoColumnKeys,
  });

  // Die Liste sortiert nach der Darstellungs-Achse, die Tabelle nach ihrer
  // Spalte. Zwei Ansichten, zwei Bedienarten — eine gemeinsame Sortierung wäre
  // in einer der beiden immer die falsche.
  const listeSortiert = useMemo(
    () => [...dataSource].sort((a, b) => vergleiche(a, b, sortierung)),
    [dataSource, sortierung],
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

  // ---- Probelauf für Startzustand und Kein-Treffer-Auswege -------------------
  //
  // Nur die WORTLAUT-Stufe, synchron und ~10–30 ms. Orama blockiert je Lauf
  // 150–300 ms, die Vektorstufe bräuchte je Variante ein neues Embedding — beides
  // wäre bei mehreren Probeläufen hintereinander deutlich spürbar.
  const korpusRef = useRef<Map<string, AntragTextEntry> | null>(null);
  const [korpusBereit, setKorpusBereit] = useState(false);
  // Der Wertevorrat für die Vervollständigung — er fällt im selben Ladevorgang
  // ab wie der Korpus und wartet deshalb auf niemanden.
  const [wertIndex, setWertIndex] = useState<WertIndex | null>(null);
  useEffect(() => {
    if (!activeProgrammId) return;
    let abgebrochen = false;
    void getProgrammCaches(storage.idb, activeProgrammId)
      .then(c => {
        if (abgebrochen) return;
        korpusRef.current = c.textCorpus;
        setWertIndex(c.werteIndex);
        setKorpusBereit(true);
      })
      .catch(() => { /* best effort — ohne Korpus entfallen die Zahlen */ });
    return () => { abgebrochen = true; };
  }, [activeProgrammId, storage]);

  const probelauf = useCallback((
    q: string,
    opt: { verknuepfung: typeof verknuepfung; stammSuche: boolean; bereich: typeof bereich },
  ): number => {
    const korpus = korpusRef.current;
    if (!korpus || q.trim().length === 0) return 0;
    return searchAntraegeSubstring(q, korpus, opt).length;
  }, []);

  /**
   * Die Trefferzahl an einem Vorschlag — mit den EINGESTELLTEN Reglern gerechnet,
   * nicht mit den Standardwerten. Steht die Verknüpfung auf „irgendein Wort",
   * findet `ort:"Dresden" laser` etwas anderes als bei „alle Wörter", und die
   * Zahl in der Liste muss die Zahl nach dem Klick sein.
   */
  const zaehleVorschlag = useCallback(
    (anfrage: string): number | null => (
      korpusRef.current ? probelauf(anfrage, { verknuepfung, stammSuche, bereich }) : null
    ),
    [probelauf, verknuepfung, stammSuche, bereich],
  );

  const auswege = useMemo<Ausweg[]>(() => {
    if (!korpusBereit || sichtbar.length > 0 || !queryNotEmpty || showSpinner) return [];
    return berechneAuswege({
      query: wirksam,
      verknuepfung,
      stammSuche,
      bereich,
      aktiveFilter: aktiveFilterTexte(facettenWahl),
    }, probelauf);
  }, [korpusBereit, sichtbar.length, queryNotEmpty, showSpinner, wirksam,
    verknuepfung, stammSuche, bereich, facettenWahl, probelauf]);

  const startEintraege = useMemo<{ letzte: StartEintrag[]; haeufig: StartEintrag[] }>(() => {
    const zahl = (q: string): number | null =>
      korpusBereit ? probelauf(q, { verknuepfung, stammSuche, bereich }) : null;
    return {
      letzte: recentSearches.slice(0, START_MAX).map(q => ({ query: q, treffer: zahl(q) })),
      haeufig: haeufigsteSuchen(recentSearches, START_MAX).map(q => ({ query: q, treffer: zahl(q) })),
    };
  }, [recentSearches, korpusBereit, probelauf, verknuepfung, stammSuche, bereich]);

  const gespeicherteTreffer = useMemo(() => {
    const m = new Map<string, number>();
    if (!korpusBereit) return m;
    for (const g of gespeichert) {
      m.set(g.id, probelauf(g.query, {
        verknuepfung: g.verknuepfung, stammSuche: g.stammSuche, bereich: g.bereich,
      }));
    }
    return m;
  }, [gespeichert, korpusBereit, probelauf]);

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
    if (frage.length === 0 || useSucheStore.getState().planLaeuft) return;
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
      // Wer eine Frage gestellt hat, will sie oft weiterverfolgen. Das Panel geht
      // mit der Frage im Eingabefeld auf — abgeschickt wird sie NICHT: die Treffer
      // sind gerade erst da, und eine zweite Antwort, auf die niemand gewartet
      // hat, kostete einen weiteren Lauf.
      sucheAssistentUiStore.getState().setOpen(true);
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function oeffneTreffer(r: UnifiedSearchResult): void {
    if (r.type === 'antrag' && r.fkz) {
      navigate(`/antraege/${encodeURIComponent(r.fkz)}`, { state: { [VON_SUCHE_STATE_KEY]: true } });
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
    if (a.aenderung.query !== undefined) setQuery(a.aenderung.query);
    if (a.aenderung.verknuepfung !== undefined) setVerknuepfung(a.aenderung.verknuepfung);
    if (a.aenderung.stammSuche !== undefined) setStammSuche(a.aenderung.stammSuche);
    if (a.aenderung.bereich !== undefined) setBereich(a.aenderung.bereich);
    setToast(`Angepasst: ${a.text}`);
  }

  function diesenSuchlaufMerken(): void {
    const q = query.trim();
    if (!q) return;
    const eintrag: GespeicherteSuche = {
      id: q.toLowerCase(),
      name: q,
      query: q,
      verknuepfung,
      stammSuche,
      bereich,
      letzteTrefferzahl: sichtbar.length,
      zuletzt: new Date().toISOString().slice(0, 10),
    };
    const naechste = merkeSuche(gespeichert, eintrag);
    setGespeichert(naechste);
    speichereGespeicherte(naechste);
    setToast(`„${q}" gemerkt`);
  }

  function fuehreGespeicherteAus(g: GespeicherteSuche): void {
    setVerknuepfung(g.verknuepfung);
    setStammSuche(g.stammSuche);
    setBereich(g.bereich);
    starteSuche(g.query);
    const naechste = vermerkeLauf(
      gespeichert, g.id, gespeicherteTreffer.get(g.id) ?? 0, new Date().toISOString().slice(0, 10),
    );
    setGespeichert(naechste);
    speichereGespeicherte(naechste);
    setGespeicherteMenuOffen(false);
  }

  function loescheGespeicherte(id: string): void {
    const naechste = entferneSuche(gespeichert, id);
    setGespeichert(naechste);
    speichereGespeicherte(naechste);
  }

  const darstellungsAchsen = useMemo(
    () => baueSucheDarstellungsAchsen({ sortierung, dichte, ansicht }),
    [sortierung, dichte, ansicht],
  );

  const noQuery = !queryNotEmpty;
  const showResults = !noQuery && !frageOffen && sichtbar.length > 0;
  // Alles, was ein Ergebnis beschreibt — Deutung, Facetten, Trefferzahl, Liste,
  // Kein-Treffer-Hilfe — hängt an derselben Bedingung: es MUSS ein Ergebnis
  // geben. Eine offene Frage hat keines, und „0 Treffer" wäre dort keine
  // Auskunft, sondern eine Falschaussage.
  const zeigeErgebnisTeile = queryNotEmpty && !frageOffen;
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
  const analyseProgressLabel = analyse.running
    ? (analyse.progress?.totalBatches
        ? `KI erstellt Begründungen… Batch ${analyse.progress.currentBatch ?? 0}/${analyse.progress.totalBatches}`
        : 'KI erstellt Begründungen…')
    : null;
  const laufendeBegruendung = useMemo<ReadonlySet<string>>(
    () => (analyse.running ? new Set(ausgeklappt) : new Set<string>()),
    [analyse.running, ausgeklappt],
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-8 pt-4 pb-6">

          {/* ── Kopf ─────────────────────────────────────────────────────── */}
          {/* Volle Blattbreite (KEIN max-w-6xl wie die Zeilen darunter): die
              Kopf-Aktionen — und mit ihnen der Hilfe-Knopf — gehören an den
              rechten Blattrand (ui-muster.md, Guard `hilfe-knopf-am-blattrand`). */}
          <div className="mb-4 flex w-full items-center gap-3">
            <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Suche</h1>
            <span className="text-[12.5px] text-[var(--tf-text-tertiary)]" title="So viele Anträge stehen im Suchindex dieses Rechners — die Zahl gilt der ganzen Seite und ändert sich mit keiner Option darunter.">Index: {indexInfo.antraegeGeladen.toLocaleString('de-DE')} Anträge</span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setGespeicherteMenuOffen(o => !o)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
                >
                  <Bookmark size={13} aria-hidden />
                  Gespeicherte Suchen
                  <span className="text-[var(--tf-text-tertiary)]">{gespeichert.length}</span>
                </button>
                {gespeicherteMenuOffen && (
                  <div
                    className="absolute right-0 top-full z-20 mt-1 w-[320px] rounded-[11px] py-1"
                    style={{
                      background: 'var(--tf-sheet)',
                      border: '0.5px solid var(--tf-border)',
                      boxShadow: 'var(--tf-shadow-dialog)',
                    }}
                  >
                    {gespeichert.length === 0
                      ? (
                        <p className="px-3 py-2 text-[12.5px] text-[var(--tf-text-tertiary)]">
                          Noch nichts gemerkt.
                        </p>
                      )
                      : gespeichert.map(g => (
                        <div key={g.id} className="group flex items-center gap-2 px-1">
                          <button
                            type="button"
                            onClick={() => fuehreGespeicherteAus(g)}
                            className="min-w-0 flex-1 rounded-[6px] px-2 py-1.5 text-left hover:bg-[var(--tf-hover)] cursor-pointer"
                          >
                            <span className="block truncate text-[13px] text-[var(--tf-text)]">{g.name}</span>
                            <span className="block text-[11px] text-[var(--tf-text-tertiary)]">
                              {gespeicherteTreffer.get(g.id) ?? '—'} Treffer
                              {g.zuletzt ? ` · zuletzt ${g.zuletzt}` : ''}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => loescheGespeicherte(g.id)}
                            title="Aus den gespeicherten Suchen entfernen"
                            className="mr-1 rounded p-1 text-[var(--tf-text-tertiary)] opacity-0 hover:text-[var(--tf-text)] group-hover:opacity-100 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={diesenSuchlaufMerken}
                disabled={!queryNotEmpty}
                title="Diese Anfrage samt Optionen merken (nur auf diesem Gerät)"
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Diese Suche speichern
              </button>
              <SeitenHilfeButton pluginId="suche" />
            </div>
          </div>

          {/* ── Suchfeld ─────────────────────────────────────────────────── */}
          <div className="flex w-full max-w-6xl flex-wrap items-start gap-2">
            <SearchInput
              value={query}
              onValueChange={handleQueryChange}
              disabled={analyse.running}
              showSpinner={showSpinner || planLaeuft}
              onSubmit={nlModus ? () => { void frageStellen(); } : undefined}
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
              <button
                type="button"
                onClick={() => { void frageStellen(); }}
                disabled={planLaeuft || analyse.running}
                className="mt-[1px] inline-flex shrink-0 items-center gap-1.5 rounded-[var(--tf-radius-lg)] px-3 py-[9px] text-[13px] cursor-pointer disabled:opacity-60 disabled:cursor-default"
                style={{ background: 'var(--tf-primary)', color: 'var(--tf-on-primary)' }}
              >
                {planLaeuft ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}
                {planLaeuft ? 'Übersetze…' : 'Frage stellen'}
              </button>
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
              onNlModus={setNlModus}
              planAktiv={aktiverPlan !== null}
              planOhneAehnlichkeit={planSchraenktEin(planTeile)}
            />
          </div>

          {semanticEnabled && (semanticStatus === 'corpus-empty' || semanticStatus === 'model-failed') && (
            <div className="mt-2 flex w-full max-w-4xl items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
              <span aria-hidden="true">ⓘ</span>
              <span>
                {semanticStatus === 'corpus-empty'
                  ? 'Ähnlichkeitssuche ohne Wirkung: Auf diesem Rechner liegen keine Embedding-Vektoren (Korpus). Er wird beim Start automatisch vom Datenspeicher geladen, sofern dort vorhanden — sonst im Auslastungs-Modul „Vom Datenspeicher laden".'
                  : 'Ähnlichkeitssuche ohne Wirkung: Das Embedding-Modell konnte nicht geladen werden (Details in der Browser-Konsole, F12). Es werden nur Wortlaut-Treffer angezeigt.'}
              </span>
            </div>
          )}

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

          {/* ── Facetten ─────────────────────────────────────────────────── */}
          {zeigeErgebnisTeile && (
            <div className="mt-2.5 w-full max-w-6xl">
              <FacettenZeile
                results={searchResults}
                wahl={facettenWahl}
                onWahl={(id: FacettenId, werte) => setFacettenWahl({ ...facettenWahl, [id]: werte })}
                onLeeren={() => setFacettenWahl(LEERE_WAHL)}
              />
            </div>
          )}

          {/* ── Offene Frage ─────────────────────────────────────────────── */}
          {frageOffen && (
            <div
              className="mt-3 flex w-full max-w-6xl items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px] text-[var(--tf-text-secondary)]"
              style={{ background: 'var(--tf-desk)', border: '0.5px solid var(--tf-border)' }}
            >
              <Sparkles size={14} className="mt-[2px] shrink-0 text-[var(--tf-text-tertiary)]" aria-hidden />
              <span>
                Diese Frage ist noch nicht gestellt. „Frage stellen" (oder Eingabetaste)
                übersetzt sie mit der internen KI in Suchbegriffe — danach steht hier, wonach
                gesucht wurde, und jeder Begriff lässt sich einzeln abwählen.
              </span>
            </div>
          )}

          {/* ── Ergebniskopf ─────────────────────────────────────────────── */}
          {zeigeErgebnisTeile && (
            <div className="mt-3 flex w-full max-w-6xl flex-wrap items-center gap-2">
              <span className="text-[13px] text-[var(--tf-text)]">
                <b className="font-medium">
                  {trefferzahlSteht ? sichtbar.length.toLocaleString('de-DE') : '…'} Treffer
                </b>
                <span className="text-[var(--tf-text-secondary)]">
                  {' '}in {indexInfo.antraegeGeladen.toLocaleString('de-DE')} Anträgen
                </span>
              </span>

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
                  <ColumnPicker typeFilter="" erzwungeneKeys={autoColumnKeys} />
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
                  onExportCSV={() => exportCSV(sichtbar, visibleColumnDefs, query)}
                  onExportXLSX={() => exportXLSX(sichtbar, visibleColumnDefs, query)}
                  onExportClipboard={() => {
                    void (async () => {
                      try {
                        await exportClipboard(sichtbar, visibleColumnDefs);
                        setToast(`${sichtbar.length} Ergebnisse in Zwischenablage kopiert`);
                      } catch (err) {
                        setToast(`Kopieren fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
                      }
                    })();
                  }}
                />
              </div>
            </div>
          )}

          {analyse.error && (
            <div className="mt-3 rounded px-3 py-2 text-[12px] text-[var(--tf-text)]"
              style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}>
              KI-Analyse fehlgeschlagen: {analyse.error}
            </div>
          )}

          {analyseDone && analyse.result && analyse.result.warnings.length > 0 && (
            <div className="mt-3 rounded px-3 py-2 text-[12px] text-[var(--tf-text)]"
              style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}>
              {analyse.result.warnings.join(' · ')}
            </div>
          )}

          {toast && (
            <div role="status" className="mt-3 rounded px-3 py-2 text-[12px] text-[var(--tf-text)]"
              style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}>
              {toast}
            </div>
          )}

          {loading && sichtbar.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-[var(--tf-text-secondary)]">
              <Loader2 size={14} className="animate-spin" />
              <span>Suche läuft{phaseLabel ? ` · ${phaseLabel}` : '…'}</span>
            </div>
          )}

          {/* ── Startzustand ─────────────────────────────────────────────── */}
          {noQuery && !loading && (
            <SucheStartzustand
              textabschnitteImIndex={indexInfo.textabschnitteImIndex}
              letzte={startEintraege.letzte}
              haeufig={startEintraege.haeufig}
              gespeichert={gespeichert}
              gespeicherteTreffer={gespeicherteTreffer}
              wertIndex={wertIndex}
              zaehle={zaehleVorschlag}
              onSuche={starteSuche}
              onFrage={nlFreigeschaltet ? starteFrage : undefined}
              onEntferneLetzte={removeRecentSearch}
              onEntferneGespeicherte={loescheGespeicherte}
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
              hatFilter={aktiveFilterTexte(facettenWahl).length > 0}
              onAnwenden={wendeAuswegAn}
            />
          )}

          {/* ── Ergebnis ─────────────────────────────────────────────────── */}
          {showResults && ansicht === 'liste' && (
            <div className="mt-3 w-full max-w-6xl">
              <TrefferListe
                treffer={listeSortiert}
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
              />
            </div>
          )}

          {showResults && ansicht === 'tabelle' && (
            <div className="mt-3">
              {/* Dieselbe Markierung wie in der Liste: die Zellen-Renderer holen
                  die Wörter aus diesem Kontext (siehe SuchMarkierung.tsx). */}
              <SuchMarkierungProvider wortlaut={markWoerter} aehnlich={aktiveVariantenChips}>
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
                  onRowClick={oeffneTreffer}
                />
              </SuchMarkierungProvider>
            </div>
          )}

          <span className="sr-only">{`unified-search: total=${counts.total} antraege=${counts.antraege} dokumente=${counts.dokumente}`}</span>

          <AnalysePromptDialog
            open={promptDialogOpen}
            query={wirksam.trim()}
            results={analyseResults}
            totalCount={sichtbar.length}
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
              const gewaehlt = sichtbar.filter(r => auswahl.has(r.id));
              exportXLSX(gewaehlt, visibleColumnDefs, query);
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
              contextResults={sichtbar}
              contextQuery={wirksam.trim()}
              vorbelegung={aktiverPlan?.frage}
            />
          </div>
        </aside>
      )}
    </div>
  );
}
