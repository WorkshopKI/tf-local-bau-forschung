/**
 * Gesamt-Pixelbreite einer Tabelle, persistiert in localStorage.
 *
 * Gegenstück zu `useColumnWidths` (das die EINZEL-Spaltenbreiten hält): hier
 * geht es um die BREITE DER GANZEN TABELLE, gesteuert über den Griff am rechten
 * Tabellenrand der `SortableTable`. `null` = Default (Tabelle füllt den
 * Container proportional). Ein Zahlenwert pinnt die Tabelle auf diese Pixel-
 * Breite; die Spalten skalieren proportional (CSS `table-layout: fixed`).
 *
 * Finaler Commit on mouseup ruft `setTotalWidth(px)`; Doppelklick auf den Griff
 * ruft `setTotalWidth(null)` (Reset). Die Live-Mutation während des Drags läuft
 * direkt am DOM (siehe `SortableTable`) und braucht den Hook nicht pro Frame.
 */
import { useCallback, useState } from 'react';

export interface UseTotalTableWidthResult {
  /** Gepinnte Gesamtbreite in Pixeln, oder `null` für „Container füllen". */
  totalWidth: number | null;
  setTotalWidth: (width: number | null) => void;
}

function loadFromStorage(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return null;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function useTotalTableWidth(storageKey: string): UseTotalTableWidthResult {
  const [totalWidth, setWidthState] = useState<number | null>(() => loadFromStorage(storageKey));

  const setTotalWidth = useCallback((width: number | null): void => {
    setWidthState(width);
    try {
      if (width === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, String(Math.round(width)));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { totalWidth, setTotalWidth };
}
