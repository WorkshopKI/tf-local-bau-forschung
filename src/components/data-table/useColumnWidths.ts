/**
 * Spalten-Pixelbreiten-State, persistiert in localStorage.
 *
 * Wird im Resize-Modus der `SortableTable` genutzt — finaler Commit on
 * mouseup ruft `setWidth(key, px)`, der Hook schreibt sofort in den State +
 * localStorage durch. Die Live-Mutation waehrend des Drags laeuft direkt
 * am DOM (siehe `useColumnResize`) und braucht den Hook NICHT pro Frame
 * aufzurufen.
 *
 * `resetWidth` LOESCHT den Eintrag, statt einen neuen Wert zu schreiben — nur so
 * folgt die Spalte danach wieder der gemessenen Inhaltsbreite (siehe
 * `columnWidthStorage.ts`).
 *
 * Pattern uebernommen aus `useColumnVisibility.ts`. Anders als dort gibt
 * es kein "locked" — alle Spaltenbreiten sind editierbar.
 */
import { useCallback, useState } from 'react';
import { entferneBreite, ladeBreiten, speichereBreiten } from './columnWidthStorage';

export interface UseColumnWidthsResult {
  widths: Record<string, number>;
  setWidth: (key: string, width: number) => void;
  /** Override entfernen → die Spalte folgt wieder Messung bzw. `column.width`. */
  resetWidth: (key: string) => void;
}

export function useColumnWidths(
  storageKey: string,
  defaults: Record<string, number>,
): UseColumnWidthsResult {
  const [widths, setWidthsState] = useState<Record<string, number>>(
    () => ladeBreiten(storageKey, defaults),
  );

  const setWidth = useCallback((key: string, width: number): void => {
    setWidthsState(prev => {
      const next = { ...prev, [key]: width };
      speichereBreiten(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const resetWidth = useCallback((key: string): void => {
    setWidthsState(prev => {
      const next = entferneBreite(prev, key);
      if (next === prev) return prev;
      speichereBreiten(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return { widths, setWidth, resetWidth };
}
