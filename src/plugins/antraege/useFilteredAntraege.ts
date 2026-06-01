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
  filterByBegleitungPhase,
  hasAnyKuerzelData,
  type BearbeiterFilterMode,
} from './bearbeiterFilter';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { tfPerfStart } from '@/core/utils/tfPerf';

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
}

/** Zentrales Memo der View+Filter+Search+Sort-Pipeline. Header und List-Panel
 *  konsumieren beide das Resultat — sonst rechnet jeder dieselbe Pipeline
 *  doppelt. */
export function useFilteredAntraege(): FilteredAntraegeResult {
  const antraege = useAntraegeStore(s => s.antraege);
  const search = useAntraegeStore(s => s.search);
  const hybridMatchAkz = useAntraegeStore(s => s.hybridSearch.matchedAkz);
  const searchIgnoreBearbeiterFilter = useAntraegeStore(s => s.searchIgnoreBearbeiterFilter);
  const activeView = useAntraegeStore(s => s.activeView);
  const sortByView = useAntraegeStore(s => s.sortByView);
  const active = useFilterState(s => s.active);
  const definitions = useFilterState(s => s.definitions);
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();

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
    const filteredBase = applyFilters(byBearbeiter, active, definitions);
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
      countBase: byBearbeiter,
    };
  }, [antraege, active, definitions, deferredSearch, deferredHybridAkz, searchIgnoreBearbeiterFilter, activeView, sortByView, bearbeiterFilter]);
}
