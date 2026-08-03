import { useDeferredValue, useMemo } from 'react';
import { applyFilters } from '@/core/services/csv';
import type { AntragListItem } from '@/core/services/csv/types';
import type { ActiveFilter, FilterDefinition } from '@/core/services/csv/filter/types';
import { useAntraegeStore, getEffectiveSortKey } from './store';
import { useFilterState } from './filter/useFilterState';
import { getView, type AntragView } from './views';
import { getSortOption } from './sort';
import { applyVerbundClustering } from './antragGroups';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import {
  parseBearbeiterFilter,
  applyBearbeiterFilter,
  applyInaktiveExclusion,
  filterByBegleitungPhase,
  hasAnyKuerzelData,
  type BearbeiterFilterMode,
} from './bearbeiterFilter';
import { useInaktiveKuerzelSet } from '@/plugins/auslastung/hooks/useInaktiveKuerzelSet';
import { useShowInaktiveMasStore } from './useShowInaktiveMasStore';
import { applyPrecheckBucket } from './filter/precheckQuickfilter';
import { filtereAmpelQuickfilter } from './eingangAmpel';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { tfPerfStart } from '@/core/utils/tfPerf';
import { useBereich } from '@/core/hooks/useBereich';
import { istImBereich } from '@/core/status/betrachtungsbereich';

/** True wenn die User mind. einen Filter auf das Feld `vb_phase` aktiv hat —
 *  in dem Fall wird der implizite Irrlaeufer-Pre-Filter deaktiviert, damit die
 *  Sidebar-Selektion die Kontrolle uebernimmt. Aus dem Hook extrahiert, damit
 *  Header (viewCount) und `useFilteredAntraege` dieselbe Logik nutzen. */
export function hasExplicitVbPhaseFilter(
  active: readonly ActiveFilter[],
  definitions: readonly FilterDefinition[],
): boolean {
  return active.some(af => {
    const def = definitions.find(d => d.id === af.filterId);
    return def?.feld === 'vb_phase';
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
   * Anträge nach View + Irrläufer-Pre-Filter + Begleitphase + Bearbeiter-
   * Filter, aber VOR den Sidebar-Active-Filtern und der Such-Eingabe. Wird
   * von den Quickfilter-Pillen als Count-Basis genutzt, damit die Counts
   * den Kürzel-Filter widerspiegeln und stabil bleiben gegen Quickfilter-
   * Wechsel.
   */
  countBase: AntragListItem[];
  /**
   * Wie viele Anträge der Betrachtungsbereich gerade wegnimmt — die Zahl für
   * den Chip. Ohne sie wäre die Einschränkung unsichtbar (Pitfall #46).
   */
  ausgeblendet: number;
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
  const search = useAntraegeStore(s => s.search);
  const hybridMatchAkz = useAntraegeStore(s => s.hybridSearch.matchedAkz);
  const searchIgnoreBearbeiterFilter = useAntraegeStore(s => s.searchIgnoreBearbeiterFilter);
  const activeView = useAntraegeStore(s => s.activeView);
  const sortByView = useAntraegeStore(s => s.sortByView);
  const precheckBucket = useAntraegeStore(s => s.precheckBucket);
  const ampelQuickfilter = useAntraegeStore(s => s.ampelQuickfilter);
  const active = useFilterState(s => s.active);
  const definitions = useFilterState(s => s.definitions);
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();
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

  const bearbeiterFilter = useMemo(
    () => parseBearbeiterFilter(meinKuerzel, profile?.bearbeiter_inkl_begleitung),
    [meinKuerzel, profile?.bearbeiter_inkl_begleitung],
  );

  return useMemo(() => {
    const end = tfPerfStart('useFilteredAntraege memo');
    const view = getView(activeView);
    const byView = antraege.filter(a => view.predicate(a));
    // Impliziter Irrläufer-Pre-Filter: vb_phase === 9 wird global ausgeblendet,
    // außer der User hat einen expliziten vb_phase-Filter in der Sidebar aktiviert
    // (egal welche Selektion — sobald der Filter aktiv ist, übernimmt er die Kontrolle).
    const explicitVbPhase = hasExplicitVbPhaseFilter(active, definitions);
    const byPreFilter = explicitVbPhase
      ? byView
      : byView.filter(a => !isIrrlaeufer(a.vb_phase));
    // Phase-Filter (Begleitphase): wirkt unabhaengig vom Kuerzel-Filter.
    // Ohne aktiven Toggle werden VN-/ZB-Stati ausgeblendet.
    const byPhase = filterByBegleitungPhase(byPreFilter, bearbeiterFilter.includeBegleitung);
    // Bearbeiter-Filter (Profil-Kürzel) NACH der View, vor den Custom-Filtern.
    // Override: wenn der User aktiv über die "Auch außerhalb meiner Anträge"-
    // Checkbox neben dem Suchfeld den Filter deaktiviert hat UND eine Such-
    // eingabe vorliegt, den Bearbeiter-Filter überspringen. Der Override wird
    // beim Leeren der Suche automatisch wieder ausgeschaltet (siehe store).
    const q = deferredSearch.trim().toLowerCase();
    const skipBearbeiter = searchIgnoreBearbeiterFilter && q.length > 0;
    const byBearbeiter = skipBearbeiter ? byPhase : applyBearbeiterFilter(byPhase, bearbeiterFilter);
    // Inaktiv-Ausblendung NACH dem Kürzel-Filter, VOR den Sidebar-Filtern —
    // damit auch die Quickfilter-Counts (countBase) die Ausblendung spiegeln.
    const byInaktive = applyInaktiveExclusion(byBearbeiter, bearbeiterFilter.active, inaktiveKuerzel, showInaktive);
    // PreCheck-Quickfilter (abgeleitete Klassifikation, eigener Store-Slot) VOR
    // den Sidebar-Filtern — analog Status/Antragstyp; `countBase` (= byInaktive)
    // bleibt bewusst davor, damit die PreCheck-Pillen-Counts stabil sind.
    const byPrecheck = applyPrecheckBucket(byInaktive, precheckBucket);
    // Ampel-Quickfilter (v2.229, Klick auf eine Antragseingang-Widget-Zeile):
    // transient wie PreCheck, VOR den Sidebar-Filtern; nutzt die konfigurierten
    // Schwellen aus dem Widget → Liste zählt identisch zum Widget.
    const byAmpel = filtereAmpelQuickfilter(byPrecheck, ampelQuickfilter);
    const filteredBase = applyFilters(byAmpel, active, definitions);
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
      ausgeblendet: alleAntraege.length - antraege.length,
    };
  }, [antraege, alleAntraege.length, active, definitions, deferredSearch, deferredHybridAkz, searchIgnoreBearbeiterFilter, activeView, sortByView, precheckBucket, ampelQuickfilter, bearbeiterFilter, inaktiveKuerzel, showInaktive]);
}
