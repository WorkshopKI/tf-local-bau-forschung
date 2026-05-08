import { useMemo } from 'react';
import { applyFilters } from '@/core/services/csv';
import type { Antrag } from '@/core/services/csv/types';
import { useAntraegeStore, getEffectiveSortKey } from './store';
import { useFilterState } from './filter/useFilterState';
import { getView, type AntragView } from './views';
import { getSortOption } from './sort';
import { useProfile } from '@/core/hooks/useProfile';
import { parseBearbeiterFilter, applyBearbeiterFilter, type BearbeiterFilterMode } from './bearbeiterFilter';

export interface FilteredAntraegeResult {
  filtered: Antrag[];
  view: AntragView;
  bearbeiterFilter: BearbeiterFilterMode;
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

  const bearbeiterFilter = useMemo(
    () => parseBearbeiterFilter(profile?.bearbeiter_kuerzel, profile?.bearbeiter_inkl_begleitung),
    [profile?.bearbeiter_kuerzel, profile?.bearbeiter_inkl_begleitung],
  );

  return useMemo(() => {
    const view = getView(activeView);
    const byView = antraege.filter(a => view.predicate(a));
    // Bearbeiter-Filter (Profil-Kürzel) NACH der View, vor den Custom-Filtern.
    const byBearbeiter = applyBearbeiterFilter(byView, bearbeiterFilter);
    const filteredBase = applyFilters(byBearbeiter, active, definitions);
    const q = search.trim().toLowerCase();
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
    return { filtered: [...matched].sort(compare), view, bearbeiterFilter };
  }, [antraege, active, definitions, search, activeView, sortByView, bearbeiterFilter]);
}
