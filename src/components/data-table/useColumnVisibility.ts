/**
 * Spalten-Sichtbarkeits-State, persistiert in localStorage.
 *
 * Locked-Spalten sind immer sichtbar — auch wenn der User die
 * localStorage-Eintraege manuell editiert oder ein altes Snapshot mit
 * fehlenden Locked-Keys vorliegt, werden sie beim Laden + bei jedem Toggle
 * wieder ergaenzt.
 *
 * Pattern uebernommen aus `src/plugins/suche/store.ts`. Generic: kann von
 * jedem Plugin mit eigenen Spalten + eigenem `storageKey` genutzt werden.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SortableColumn } from './types';

export interface UseColumnVisibilityResult {
  visibleKeys: string[];
  toggleColumn: (key: string) => void;
  setVisibleKeys: (keys: string[]) => void;
  /** Ist `key` momentan sichtbar? */
  isVisible: (key: string) => boolean;
}

function loadFromStorage(
  storageKey: string,
  validKeys: ReadonlySet<string>,
  lockedKeys: ReadonlyArray<string>,
  defaultKeys: ReadonlyArray<string>,
): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [...defaultKeys];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...defaultKeys];
    const keys = parsed.filter((k): k is string => typeof k === 'string' && validKeys.has(k));
    for (const lockedKey of lockedKeys) {
      if (!keys.includes(lockedKey)) keys.push(lockedKey);
    }
    return keys;
  } catch {
    return [...defaultKeys];
  }
}

function saveToStorage(storageKey: string, keys: string[]): void {
  try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch { /* ignore */ }
}

export function useColumnVisibility<T>(
  storageKey: string,
  columns: SortableColumn<T>[],
): UseColumnVisibilityResult {
  const { validKeys, lockedKeys, defaultKeys } = useMemo(() => ({
    validKeys: new Set(columns.map(c => c.key)),
    lockedKeys: columns.filter(c => c.locked === true).map(c => c.key),
    defaultKeys: columns.filter(c => c.defaultVisible).map(c => c.key),
  }), [columns]);

  const [visibleKeys, setVisibleKeysState] = useState<string[]>(
    () => loadFromStorage(storageKey, validKeys, lockedKeys, defaultKeys),
  );

  // Wenn sich die Spalten-Definition (z.B. Dynamic Columns) aendert, alte
  // Eintraege aus localStorage gegen die neue valid-Set + locked-Liste
  // validieren — sonst koennen Stale-Keys bleiben.
  useEffect(() => {
    setVisibleKeysState(prev => {
      const filtered = prev.filter(k => validKeys.has(k));
      let changed = filtered.length !== prev.length;
      for (const lockedKey of lockedKeys) {
        if (!filtered.includes(lockedKey)) {
          filtered.push(lockedKey);
          changed = true;
        }
      }
      return changed ? filtered : prev;
    });
  }, [validKeys, lockedKeys]);

  const setVisibleKeys = useCallback((keys: string[]): void => {
    const next = [...keys];
    for (const lockedKey of lockedKeys) {
      if (!next.includes(lockedKey)) next.push(lockedKey);
    }
    saveToStorage(storageKey, next);
    setVisibleKeysState(next);
  }, [storageKey, lockedKeys]);

  const toggleColumn = useCallback((key: string): void => {
    if (lockedKeys.includes(key)) return;
    setVisibleKeysState(prev => {
      const next = prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key];
      saveToStorage(storageKey, next);
      return next;
    });
  }, [storageKey, lockedKeys]);

  const isVisible = useCallback(
    (key: string): boolean => visibleKeys.includes(key),
    [visibleKeys],
  );

  return { visibleKeys, toggleColumn, setVisibleKeys, isVisible };
}
