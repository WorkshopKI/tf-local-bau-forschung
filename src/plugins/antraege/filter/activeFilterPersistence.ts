/**
 * Persistenz der aktiven Förderanträge-Filter (`useFilterState.active` — die
 * Status-/Antragstyp-Quickfilter UND die Sidebar-Facetten) in localStorage,
 * damit die gesetzten Filter einen Reload/Seitenwechsel überleben und beim
 * nächsten Aufruf der Seite wieder angewandt werden (Nutzer-Wunsch Thomas).
 *
 * Reine UI-Preference (laut CLAUDE.md in localStorage erlaubt), origin-weit.
 * **Pro Programm gekeyt**: die `filterId`s beziehen sich auf die Filter-
 * Definitionen EINES Programms — beim Restore werden nur `filterId`s
 * übernommen, die noch eine Definition haben (stale IDs nach CSV-/Filter-Umbau
 * fallen still weg). PreCheck ist bewusst NICHT hier, sondern im
 * `useAntraegeStore`-Slot `precheckBucket` (eigener Persistenz-Key), weil es
 * kein `useFilterState.active`-Filter ist.
 */
import type { ActiveFilter } from '@/core/services/csv';

const STORAGE_KEY = 'teamflow_antraege_active_filters';

/** programmId → aktive Filter dieses Programms. */
type PersistedMap = Record<string, ActiveFilter[]>;

function readAll(): PersistedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as PersistedMap;
  } catch {
    return {};
  }
}

/**
 * Persistierte aktive Filter für ein Programm, defensiv gefiltert auf noch
 * gültige `filterId`s (die in `validIds` — den geladenen Definitionen —
 * vorkommen) und nicht-leere Werte.
 */
export function loadActiveFilters(programmId: string, validIds: Set<string>): ActiveFilter[] {
  const list = readAll()[programmId];
  if (!Array.isArray(list)) return [];
  return list.filter(
    (af): af is ActiveFilter =>
      !!af
      && typeof (af as ActiveFilter).filterId === 'string'
      && validIds.has((af as ActiveFilter).filterId)
      && (af as ActiveFilter).value !== null
      && (af as ActiveFilter).value !== undefined,
  );
}

/** Aktive Filter eines Programms speichern; leere Liste → Eintrag entfernen. */
export function saveActiveFilters(programmId: string, active: ActiveFilter[]): void {
  try {
    const all = readAll();
    if (active.length === 0) {
      delete all[programmId];
    } else {
      all[programmId] = active;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* localStorage nicht verfügbar — Filter bleiben nur für die Session */
  }
}
