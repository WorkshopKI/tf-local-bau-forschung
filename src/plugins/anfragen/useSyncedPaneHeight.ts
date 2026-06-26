/**
 * Gemeinsame Pane-Höhe für ein Vorher/Nachher-Paar (Layout A): EIN Höhen-State
 * bindet beide Panes → der Resize-Griff zieht beide synchron. Höhe persistiert
 * pro Schlüssel in localStorage (file://-erlaubtes UI-Flag). Pointer-Events am
 * `window` (robuster Drag, gleiches Muster wie MasterDetailLayout).
 */
import { useCallback, useState } from 'react';

const MIN_H = 120;
const DEFAULT_H = 300;

function loadHeight(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    if (Number.isFinite(v) && v >= MIN_H) return v;
  } catch { /* ignore */ }
  return fallback;
}

export interface SyncedPaneHeight {
  /** Aktuelle Pane-Höhe in px (an beide Panes via `style={{ height }}` binden). */
  height: number;
  /** pointerdown-Handler für den Resize-Griff. */
  onResizerPointerDown: (e: React.PointerEvent) => void;
}

export function useSyncedPaneHeight(storageKey: string, initial = DEFAULT_H): SyncedPaneHeight {
  const [height, setHeight] = useState(() => loadHeight(storageKey, initial));

  const onResizerPointerDown = useCallback((e: React.PointerEvent): void => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    let latest = startH;
    document.body.style.userSelect = 'none';
    const onMove = (ev: PointerEvent): void => {
      const max = window.innerHeight * 0.72;
      latest = Math.max(MIN_H, Math.min(max, startH + (ev.clientY - startY)));
      setHeight(latest);
    };
    const onUp = (): void => {
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      try { localStorage.setItem(storageKey, String(Math.round(latest))); } catch { /* ignore */ }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [height, storageKey]);

  return { height, onResizerPointerDown };
}
