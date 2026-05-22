/**
 * Spalten-Pixelbreiten-State, persistiert in localStorage.
 *
 * Wird im Resize-Modus der `SortableTable` genutzt — finaler Commit on
 * mouseup ruft `setWidth(key, px)`, der Hook schreibt sofort in den State +
 * localStorage durch. Die Live-Mutation waehrend des Drags laeuft direkt
 * am DOM (siehe `SortableTable`) und braucht den Hook NICHT pro Frame
 * aufzurufen.
 *
 * Pattern uebernommen aus `useColumnVisibility.ts`. Anders als dort gibt
 * es kein "locked" — alle Spaltenbreiten sind editierbar.
 */
import { useCallback, useState } from 'react';

export interface UseColumnWidthsResult {
  widths: Record<string, number>;
  setWidth: (key: string, width: number) => void;
}

function loadFromStorage(
  storageKey: string,
  defaults: Record<string, number>,
): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...defaults };
    }
    const out: Record<string, number> = { ...defaults };
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return { ...defaults };
  }
}

function saveToStorage(storageKey: string, widths: Record<string, number>): void {
  try { localStorage.setItem(storageKey, JSON.stringify(widths)); } catch { /* ignore */ }
}

export function useColumnWidths(
  storageKey: string,
  defaults: Record<string, number>,
): UseColumnWidthsResult {
  const [widths, setWidthsState] = useState<Record<string, number>>(
    () => loadFromStorage(storageKey, defaults),
  );

  const setWidth = useCallback((key: string, width: number): void => {
    setWidthsState(prev => {
      const next = { ...prev, [key]: width };
      saveToStorage(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return { widths, setWidth };
}
