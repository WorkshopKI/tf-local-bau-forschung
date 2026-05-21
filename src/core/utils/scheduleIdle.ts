/**
 * `requestIdleCallback`-Wrapper mit Safari-Fallback.
 *
 * Schedule eine Callback im naechsten Idle-Window des Browsers; faellt auf
 * `setTimeout(0)` zurueck in Browsern ohne `requestIdleCallback`-Support
 * (Safari < 16.4). Liefert eine Cancel-Funktion zurueck (kompatibel mit
 * useEffect-Cleanup-Return).
 *
 * Typische Nutzung: schwere Preload-Calls (IDB-Cursor-Loops, Embedding-Modell-
 * Init, Korpus-Loads), die nicht den initialen Mount-Render blockieren sollen.
 */
export function scheduleIdle(cb: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(cb, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, 0);
  return () => window.clearTimeout(id);
}
