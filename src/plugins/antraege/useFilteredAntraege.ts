import { useDeferredValue, useMemo, useRef } from 'react';
import { applyFilters } from '@/core/services/csv';
import type { AntragListItem } from '@/core/services/csv/types';
import type { ActiveFilter, FilterDefinition } from '@/core/services/csv/filter/types';
import { useAntraegeStore, getEffectiveSortKey } from './store';
import { useFilterState } from './filter/useFilterState';
import { getView, viewCounts, type AntragView, type ViewKey } from './views';
import { getSortOption } from './sort';
import { applyVerbundClustering } from './antragGroups';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import {
  applyBearbeiterFilter,
  applyInaktiveExclusion,
  hasAnyKuerzelData,
  type BearbeiterFilterMode,
} from './bearbeiterFilter';
import { useInaktiveKuerzelSet } from '@/plugins/auslastung/hooks/useInaktiveKuerzelSet';
import { useShowInaktiveMasStore } from './useShowInaktiveMasStore';
import { applyPrecheckBucket } from './filter/precheckQuickfilter';
import { applyProjektart, type TvCountOf } from './filter/projektartQuickfilter';
import { filtereStillstand } from './frage/letzteAktivitaet';
import { useAktivitaetsIndex } from './frage/useAktivitaetsIndex';
import { useWirksamerSuchtext } from './frage/suchtext';
import { filtereAmpelQuickfilter } from './eingangAmpel';
import { getStatusCategory } from '@/core/utils/status-canonical';
import { isIrrlaeufer, toVbPhaseNumber, IRRLAEUFER_PHASE } from '@/core/utils/vb-phase-mappings';
import { tfPerfStart } from '@/core/utils/tfPerf';
import { useBereich } from '@/core/hooks/useBereich';
import { istImBereich } from '@/core/status/betrachtungsbereich';

/**
 * Fordert die Sidebar-Auswahl die Irrläufer AUSDRÜCKLICH an? Nur dann tritt der
 * implizite Vorfilter (`vb_phase === 9`) zurück und überlässt der Auswahl die
 * Kontrolle. Aus dem Hook extrahiert, damit Header (viewCount) und
 * `useFilteredAntraege` dieselbe Logik nutzen.
 *
 * Bis v4.121 genügte hier ein aktiver Filter auf dem FELD, egal auf welchem
 * Wert. Ein Klick auf „Antragstyp → FuE" (`vb_phase = ['3']`) schaltete damit
 * den Vorfilter ab und liess die Irrläufer in die ZÄHLER zurück: ein
 * einschränkender Klick liess die Zahl am Reiter „Alle" von 12 295 auf 12 359
 * STEIGEN, während die Liste darunter (die den Wert 3 ja anwendet) unverändert
 * blieb. Gefragt ist nicht „ist das Feld im Spiel", sondern „ist die 9 gewählt".
 */
export function vbPhaseFilterZeigtIrrlaeufer(
  active: readonly ActiveFilter[],
  definitions: readonly FilterDefinition[],
): boolean {
  return active.some(af => {
    const def = definitions.find(d => d.id === af.filterId);
    if (def?.feld !== 'vb_phase') return false;
    const werte = Array.isArray(af.value)
      ? af.value
      : typeof af.value === 'string' ? [af.value] : null;
    // Keine abzählbare Werteliste (Bereichs-/Ja-Nein-Form): Kontrolle abgeben
    // wie bisher — eine Auswahl, die wir nicht deuten können, darf nicht stumm
    // beschnitten werden.
    if (werte === null) return true;
    return werte.some(v => toVbPhaseNumber(v) === IRRLAEUFER_PHASE);
  });
}

export interface FilteredAntraegeResult {
  filtered: AntragListItem[];
  view: AntragView;
  bearbeiterFilter: BearbeiterFilterMode;
  /**
   * True wenn der Bearbeiter-Filter aktiv ist, aber keiner der Anträge eine
   * der relevanten KUERZ-Spalten gesetzt hat. UI kann das nutzen, um statt
   * einer kommentarlos leeren Liste einen Erklär-Hinweis zu zeigen.
   */
  bearbeiterKuerzelMissing: boolean;
  /**
   * Anträge nach View + Irrläufer-Pre-Filter + Bearbeiter-Filter, aber VOR
   * den Sidebar-Active-Filtern und der Such-Eingabe. Wird von den
   * Quickfilter-Pillen als Count-Basis genutzt, damit die Counts den
   * Kürzel-Filter widerspiegeln und stabil bleiben gegen Quickfilter-Wechsel.
   */
  countBase: AntragListItem[];
  /**
   * Teilvorhaben-Zahl des Verbunds eines Antrags, aus dem VOLLEN Bestand.
   * Herausgereicht, damit die Projektart-Pille ihre Zähler über dieselbe
   * Funktion bildet, die auch filtert — zwei Wege driften sonst auseinander.
   */
  tvCountOf: TvCountOf;
  /**
   * Zähler JE SICHT auf derselben Grundmenge wie die Liste — Bereich,
   * Inaktiv-Ausschluss und Irrläufer-Schalter inklusive. Alle Oberflächen, die
   * Sicht-Zahlen zeigen (Tab-Leiste, Schnellauswahl-Chips), lesen dieses Feld;
   * eine zweite Zählung auf der rohen Store-Liste driftet still von der Liste
   * darunter weg (Pitfall #46).
   */
  counts: Record<ViewKey, number>;
  /**
   * Wie viele Anträge der Betrachtungsbereich gerade wegnimmt — die Zahl für
   * den Chip. Ohne sie wäre die Einschränkung unsichtbar (Pitfall #46).
   */
  ausgeblendet: number;
  /**
   * Wie viele Anträge sich beim Stillstands-Filter **nicht beurteilen** ließen —
   * kein datierbares Kürzel, oder der Index steht noch nicht.
   *
   * `0`, solange keine Schwelle gesetzt ist. Muss angezeigt werden: sie
   * stillschweigend zu den Laufenden zu schlagen hieße, eine Aussage zu treffen,
   * für die die Grundlage fehlt — genau daran scheitern Ampeln, denen man später
   * nicht mehr glaubt.
   */
  stillstandUnpruefbar: number;
  /**
   * Der Stillstands-Index steht (noch) NICHT — dann ist „nicht prüfbar" nicht
   * die Eigenschaft einzelner Anträge, sondern der Zustand des Filters, und der
   * ganze Bestand steht ungefiltert da.
   *
   * Ohne diese Trennung behauptete der Chip, die genannten Anträge „fehlen in
   * dieser Liste" — sie waren alle darin (v4.124).
   */
  stillstandIndexFehlt: boolean;
  /** Warum der Stillstand nicht ermittelt werden konnte; `null` = kein Fehler. */
  stillstandFehler: string | null;
  /** Alter des benutzten Index in Sekunden; `null` = keiner da. */
  stillstandAlterSekunden: number | null;
}

/**
 * EIN Pipeline-Lauf fuer ALLE Aufrufer desselben Renders.
 *
 * `useMemo` merkt sich je Komponenten-Instanz — und dieser Hook haengt auf der
 * Antragsseite an sechs Stellen gleichzeitig (Kopf, Hauptteil, Massenleiste,
 * Filterspalte, Pin-Leiste, Schnellfilter). Aendert sich der Bestand, lief die
 * ganze Kette ueber 12 000 Zeilen sechsmal und lieferte sechsmal dasselbe.
 *
 * Der modul-lokale Speicher haelt genau EINEN Stand: dieselben Deps
 * (referenzgleich, Element fuer Element) ⇒ dasselbe Ergebnis. Das gilt nur
 * innerhalb eines Renderdurchgangs, und genau das ist der Fall, den es zu
 * decken gilt — sobald sich etwas aendert, faellt der Stand und wird einmal neu
 * gerechnet (v4.124).
 */
let letzteDeps: readonly unknown[] | null = null;
let letztesErgebnis: FilteredAntraegeResult | null = null;

function geteilt(
  deps: readonly unknown[], rechne: () => FilteredAntraegeResult,
): FilteredAntraegeResult {
  if (
    letzteDeps !== null && letztesErgebnis !== null
    && letzteDeps.length === deps.length
    && letzteDeps.every((d, i) => Object.is(d, deps[i]))
  ) {
    return letztesErgebnis;
  }
  const erg = rechne();
  letzteDeps = deps;
  letztesErgebnis = erg;
  return erg;
}

/** Zentrales Memo der View+Filter+Search+Sort-Pipeline. Header und List-Panel
 *  konsumieren beide das Resultat — sonst rechnet jeder dieselbe Pipeline
 *  doppelt. */
export function useFilteredAntraege(): FilteredAntraegeResult {
  const alleAntraege = useAntraegeStore(s => s.antraege);
  const bereich = useBereich();
  const selectedAktenzeichen = useAntraegeStore(s => s.selectedAktenzeichen);
  const selectedVerbundId = useAntraegeStore(s => s.selectedVerbundId);
  /**
   * **Vorfilter Betrachtungsbereich** — vor der View, damit auch Tab-Zähler und
   * Quickfilter-Counts auf derselben Grundmenge rechnen.
   *
   * Der gerade geöffnete Datensatz bleibt sichtbar, auch wenn er außerhalb
   * liegt: sonst risse ein Deep-Link oder ein Suchtreffer ab, sobald man ihn
   * anklickt — genau der Fall, für den die Suche am Vollbestand bleibt.
   */
  const antraege = useMemo(() => {
    if (bereich.menge === null) return alleAntraege;
    return alleAntraege.filter(a =>
      istImBereich(a.unterprogramm_id, bereich.menge)
      || (selectedAktenzeichen !== null && a.aktenzeichen === selectedAktenzeichen)
      || (selectedVerbundId !== null && a.verbund_id === selectedVerbundId));
  }, [alleAntraege, bereich.menge, selectedAktenzeichen, selectedVerbundId]);
  // NICHT `s.search`: eine getippte, aber noch nicht übersetzte Frage ist kein
  // Suchbegriff (siehe `suchtext.ts`).
  const search = useWirksamerSuchtext();
  const hybridMatchAkz = useAntraegeStore(s => s.hybridSearch.matchedAkz);
  const searchIgnoreBearbeiterFilter = useAntraegeStore(s => s.searchIgnoreBearbeiterFilter);
  const activeView = useAntraegeStore(s => s.activeView);
  const sortByView = useAntraegeStore(s => s.sortByView);
  const precheckBucket = useAntraegeStore(s => s.precheckBucket);
  const projektart = useAntraegeStore(s => s.projektart);
  const verbundById = useAntraegeStore(s => s.verbundById);
  const ampelQuickfilter = useAntraegeStore(s => s.ampelQuickfilter);
  const kategorieQuickfilter = useAntraegeStore(s => s.kategorieQuickfilter);
  const stillstandTage = useAntraegeStore(s => s.stillstandTage);
  // Traege: der Hook rechnet erst, wenn eine Schwelle gesetzt ist.
  // Fehler und Alter werden mitgenommen und weitergereicht — ein Filter, der
  // sichtbar gesetzt ist und nichts tut, muss sagen warum (v4.124).
  const {
    index: aktivitaetsIndex, fehler: stillstandFehler, alterSekunden: stillstandAlterSekunden,
  } = useAktivitaetsIndex();
  // Einmal je Mount statt je Render — der Tageswechsel verschiebt jede
  // Liegezeit, und `new Date()` im Memo machte aus dem Filter einen Wackler.
  const stichtagRef = useRef<string>(new Date().toISOString());
  const stichtag = stichtagRef.current;
  const active = useFilterState(s => s.active);
  const definitions = useFilterState(s => s.definitions);
  // Profil-Kürzel UND Meine/Alle-Umschalter in einem — die Sicht ist hier ein
  // expliziter Parameter, kein stiller Filter weiter unten (Pitfall #46).
  const { mode: bearbeiterFilter } = useBearbeiterSicht();
  // „alle"-Modus: Anträge inaktiver MAs ausblenden (pl/dev). Außerhalb pl/dev
  // ist das Set leer → die Exklusions-Stufe ist ein No-op.
  const inaktiveKuerzel = useInaktiveKuerzelSet();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);

  // Such-Eingabe entkoppeln: das Input bleibt responsiv, der teure
  // Filter+Sort-Pass läuft erst wenn React Idle-Zeit hat. Bei 13k+ Records
  // mit fetten Multi-CSV-Joins macht das den Unterschied zwischen
  // "stockt beim Tippen" und "flüssig".
  const deferredSearch = useDeferredValue(search);
  const deferredHybridAkz = useDeferredValue(hybridMatchAkz);

  /**
   * Teilvorhaben-Zahl des Verbunds — aus `verbundById`, also aus dem VOLLEN
   * Bestand und nicht aus der gefilterten Liste. Nur so bleibt die Projektart
   * filter-unabhängig: zöge man sie aus den sichtbaren Zeilen, machte ein
   * Statusfilter, der ein TV eines 2-TV-Verbunds ausblendet, daraus ein
   * „Einzelprojekt".
   *
   * Ohne (oder mit unbekannter) `verbund_id` gilt 1 — ein Antrag ohne Verbund
   * hat faktisch ein Teilvorhaben, sich selbst.
   */
  const tvCountOf = useMemo<TvCountOf>(() => (a) => {
    const vid = typeof a.verbund_id === 'string' ? a.verbund_id.trim() : '';
    if (!vid) return 1;
    const anzahl = verbundById.get(vid)?.teilantrags_ids?.length;
    return typeof anzahl === 'number' && anzahl > 0 ? anzahl : 1;
  }, [verbundById]);

  const deps: unknown[] = [antraege, alleAntraege.length, active, definitions, deferredSearch, deferredHybridAkz, searchIgnoreBearbeiterFilter, activeView, sortByView, precheckBucket, projektart, tvCountOf, ampelQuickfilter, kategorieQuickfilter, bearbeiterFilter, inaktiveKuerzel, showInaktive, stillstandTage, aktivitaetsIndex, stichtag, stillstandFehler, stillstandAlterSekunden];
  return useMemo(() => geteilt(deps, (): FilteredAntraegeResult => {
    const end = tfPerfStart('useFilteredAntraege memo');
    const view = getView(activeView);
    const byView = antraege.filter(a => view.predicate(a));
    // Impliziter Irrläufer-Pre-Filter: vb_phase === 9 wird global ausgeblendet,
    // außer der User hat einen expliziten vb_phase-Filter in der Sidebar aktiviert
    // (egal welche Selektion — sobald der Filter aktiv ist, übernimmt er die Kontrolle).
    const explicitVbPhase = vbPhaseFilterZeigtIrrlaeufer(active, definitions);
    const byPreFilter = explicitVbPhase
      ? byView
      : byView.filter(a => !isIrrlaeufer(a.vb_phase));
    // Bearbeiter-Filter (Profil-Kürzel) NACH der View, vor den Custom-Filtern.
    // Override: wenn der User aktiv über die "Auch außerhalb meiner Anträge"-
    // Checkbox neben dem Suchfeld den Filter deaktiviert hat UND eine Such-
    // eingabe vorliegt, den Bearbeiter-Filter überspringen. Der Override wird
    // beim Leeren der Suche automatisch wieder ausgeschaltet (siehe store).
    const q = deferredSearch.trim().toLowerCase();
    const skipBearbeiter = searchIgnoreBearbeiterFilter && q.length > 0;
    const byBearbeiter = skipBearbeiter ? byPreFilter : applyBearbeiterFilter(byPreFilter, bearbeiterFilter);
    // Inaktiv-Ausblendung NACH dem Kürzel-Filter, VOR den Sidebar-Filtern —
    // damit auch die Quickfilter-Counts (countBase) die Ausblendung spiegeln.
    const byInaktive = applyInaktiveExclusion(byBearbeiter, bearbeiterFilter.active, inaktiveKuerzel, showInaktive);
    // Sicht-Zaehler aus DERSELBEN Grundmenge wie die Liste: Bereich (steckt
    // schon in `antraege`), Inaktiv-Ausschluss und derselbe Irrlaeufer-Schalter.
    // Die Exklusion wirkt je Datensatz, ist also unabhaengig davon, ob sie vor
    // oder nach View/Bearbeiter laeuft — sie darf hier auf die Basis, weil
    // `viewCounts` alle Sichten auf einmal zaehlt.
    // `skipBearbeiter` gilt hier MIT: „Auch außerhalb meiner Anträge suchen"
    // hebt den Kürzel-Zuschnitt für die Liste auf — zählte der Reiter darüber
    // weiter nur die eigenen, behauptete er WENIGER, als die Liste unter ihm
    // zeigt (Pitfall #46: die Zahl ist eine Zusage über genau diese Liste).
    const counts = viewCounts(
      applyInaktiveExclusion(antraege, bearbeiterFilter.active, inaktiveKuerzel, showInaktive),
      skipBearbeiter ? undefined : bearbeiterFilter,
      !explicitVbPhase,
    );
    // PreCheck-Quickfilter (abgeleitete Klassifikation, eigener Store-Slot) VOR
    // den Sidebar-Filtern — analog Status/Antragstyp; `countBase` (= byInaktive)
    // bleibt bewusst davor, damit die PreCheck-Pillen-Counts stabil sind.
    // Projektart-Quickfilter (abgeleitet aus Antragstyp + TV-Zahl des Verbunds),
    // wie PreCheck ein eigener Schritt VOR den Sidebar-Filtern und NACH
    // `countBase` — damit die Zähler der Pille stabil bleiben.
    const byProjektart = applyProjektart(byInaktive, projektart, tvCountOf);
    const byPrecheck = applyPrecheckBucket(byProjektart, precheckBucket);
    // Ampel-Quickfilter (v2.229, Klick auf eine Antragseingang-Widget-Zeile):
    // transient wie PreCheck, VOR den Sidebar-Filtern; nutzt die konfigurierten
    // Schwellen aus dem Widget → Liste zählt identisch zum Widget.
    const byAmpel = filtereAmpelQuickfilter(byPrecheck, ampelQuickfilter);
    // Kategorie-Quickfilter (v4.131, Klick auf „+ N weitere →" einer Kanban-Bahn
    // des Startseiten-Widgets): dieselbe Stelle und dieselbe Bauart wie der
    // Ampel-Filter. Verglichen wird die KATEGORIE-Fassade, nie ein Roh-Status
    // (Pitfall #12) — die Bahn ist selbst eine Kategorie.
    const byKategorie = kategorieQuickfilter === null
      ? byAmpel
      : byAmpel.filter(a => getStatusCategory(a.status) === kategorieQuickfilter);
    // Stillstand (v4.105): dieselbe Stelle wie die anderen abgeleiteten
    // Quickfilter — VOR den Sidebar-Filtern, NACH `countBase`. Er braucht einen
    // Bestandslauf, der `AntragListItem` nicht hergibt; solange der Index fehlt,
    // bleibt die Liste stehen und `stillstandUnpruefbar` sagt, dass niemand sie
    // geprueft hat. Eine leere Liste waehrend des Rechnens saehe aus wie
    // „nichts gefunden".
    const stillstand = stillstandTage === null
      ? { treffer: byKategorie, unpruefbar: 0 }
      : filtereStillstand(byKategorie, aktivitaetsIndex, stillstandTage, stichtag);
    const filteredBase = applyFilters(stillstand.treffer, active, definitions);
    // Hybrid-Suche: zusaetzlich zu den vier Slim-Feldern (akz/akronym/titel/
    // antragsteller) liefert `useAntraegeHybridSearch` ein Akz-Set mit
    // Treffern aus drei weiteren Quellen — Substring auf den CSV-Volltext-
    // feldern (verbund_titel/titel/projektbeschreibung_text), Embedding-
    // Match aus dem Auslastungs-Korpus, und DMS-Index-Treffer (Phase-2).
    // `null` heisst: Hook hat noch nicht geantwortet → keine Hybrid-Hits
    // einbeziehen, aber Substring auf Slim-Feldern bleibt aktiv.
    const matched = q
      ? filteredBase.filter(a =>
          a.aktenzeichen.toLowerCase().includes(q)
          || (typeof a.akronym === 'string' && a.akronym.toLowerCase().includes(q))
          || (typeof a.titel === 'string' && a.titel.toLowerCase().includes(q))
          || (typeof a.antragsteller === 'string' && a.antragsteller.toLowerCase().includes(q))
          || (deferredHybridAkz !== null && deferredHybridAkz.has(a.aktenzeichen)),
        )
      : filteredBase;
    const sortKey = getEffectiveSortKey(activeView, sortByView);
    const compare = getSortOption(sortKey).compare;
    const bearbeiterKuerzelMissing = bearbeiterFilter.active
      ? !hasAnyKuerzelData(antraege, bearbeiterFilter.includeBegleitung)
      : false;
    const sorted = [...matched].sort(compare);
    // Verbund-Teilvorhaben werden nach der primären Sortierung als Cluster
    // zusammengehalten (Position vom ersten TV, intern nach Aktenzeichen).
    // Ausnahme: Antragsteller-Sort soll Anträge desselben Antragstellers
    // nebeneinander zeigen — dort wäre die Verbund-Gruppierung kontraproduktiv.
    const clustered = sortKey === 'antragsteller_asc' ? sorted : applyVerbundClustering(sorted);
    end(`base=${antraege.length} → byView=${byView.length} → filtered=${matched.length}`);
    return {
      filtered: clustered,
      view,
      bearbeiterFilter,
      bearbeiterKuerzelMissing,
      countBase: byInaktive,
      tvCountOf,
      counts,
      ausgeblendet: alleAntraege.length - antraege.length,
      // Muss angezeigt werden: eine Liste, die die Unpruefbaren stumm weglaesst,
      // behauptet implizit, sie liefen — und dafuer fehlt die Grundlage.
      stillstandUnpruefbar: stillstand.unpruefbar,
      stillstandIndexFehlt: stillstandTage !== null && aktivitaetsIndex === null,
      stillstandFehler,
      stillstandAlterSekunden,
    };
  }), [antraege, alleAntraege.length, active, definitions, deferredSearch, deferredHybridAkz, searchIgnoreBearbeiterFilter, activeView, sortByView, precheckBucket, projektart, tvCountOf, ampelQuickfilter, kategorieQuickfilter, bearbeiterFilter, inaktiveKuerzel, showInaktive, stillstandTage, aktivitaetsIndex, stichtag, stillstandFehler, stillstandAlterSekunden]);
}
