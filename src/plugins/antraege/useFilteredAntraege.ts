import { useMemo } from 'react';
import { applyFilters } from '@/core/services/csv';
import type { Antrag } from '@/core/services/csv/types';
import { useAntraegeStore } from './store';
import { useFilterState } from './filter/useFilterState';
import { getView, type AntragView } from './views';

export interface FilteredAntraegeResult {
  filtered: Antrag[];
  view: AntragView;
}

/** Zentrales Memo der View+Filter+Search-Pipeline. Header und List-Panel
 *  konsumieren beide das Resultat — sonst rechnet jeder dieselbe Pipeline
 *  doppelt. */
export function useFilteredAntraege(): FilteredAntraegeResult {
  const antraege = useAntraegeStore(s => s.antraege);
  const search = useAntraegeStore(s => s.search);
  const activeView = useAntraegeStore(s => s.activeView);
  const active = useFilterState(s => s.active);
  const definitions = useFilterState(s => s.definitions);

  return useMemo(() => {
    const view = getView(activeView);
    const byView = antraege.filter(a => view.predicate(a));
    const filteredBase = applyFilters(byView, active, definitions);
    const q = search.trim().toLowerCase();
    const matched = q
      ? filteredBase.filter(a =>
          a.aktenzeichen.toLowerCase().includes(q)
          || (typeof a.akronym === 'string' && a.akronym.toLowerCase().includes(q))
          || (typeof a.titel === 'string' && a.titel.toLowerCase().includes(q))
          || (typeof a.antragsteller === 'string' && a.antragsteller.toLowerCase().includes(q)),
        )
      : filteredBase;
    return { filtered: [...matched].sort(view.compare), view };
  }, [antraege, active, definitions, search, activeView]);
}
