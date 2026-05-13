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
import {
  parseBearbeiterFilter,
  applyBearbeiterFilter,
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
}

/** Zentrales Memo der View+Filter+Search+Sort-Pipeline. Header und List-Panel
 *  konsumieren beide das Resultat — sonst rechnet jeder dieselbe Pipeline
 *  doppelt. */
export function useFilteredAntraege(): FilteredAntraegeResult {
  const antraege = useAntraegeStore(s => s.antraege);
  const search = useAntraegeStore(s => s.search);
  const activeView = useAntraegeStore(s => s.activeView);
  const sortByView = useAntraegeStore(s => s.sortByView);
  const active = useFilterState(s => s.active);
  const definitions = useFilterState(s => s.definitions);
  const { profile } = useProfile();

  // Such-Eingabe entkoppeln: das Input bleibt responsiv, der teure
  // Filter+Sort-Pass läuft erst wenn React Idle-Zeit hat. Bei 13k+ Records
  // mit fetten Multi-CSV-Joins macht das den Unterschied zwischen
  // "stockt beim Tippen" und "flüssig".
  const deferredSearch = useDeferredValue(search);

  const bearbeiterFilter = useMemo(
    () => parseBearbeiterFilter(profile?.bearbeiter_kuerzel, profile?.bearbeiter_inkl_begleitung),
    [profile?.bearbeiter_kuerzel, profile?.bearbeiter_inkl_begleitung],
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
    // Bearbeiter-Filter (Profil-Kürzel) NACH der View, vor den Custom-Filtern.
    const byBearbeiter = applyBearbeiterFilter(byPreFilter, bearbeiterFilter);
    const filteredBase = applyFilters(byBearbeiter, active, definitions);
    const q = deferredSearch.trim().toLowerCase();
    const matched = q
      ? filteredBase.filter(a =>
          a.aktenzeichen.toLowerCase().includes(q)
          || (typeof a.akronym === 'string' && a.akronym.toLowerCase().includes(q))
          || (typeof a.titel === 'string' && a.titel.toLowerCase().includes(q))
          || (typeof a.antragsteller === 'string' && a.antragsteller.toLowerCase().includes(q)),
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
    };
  }, [antraege, active, definitions, deferredSearch, activeView, sortByView, bearbeiterFilter]);
}
