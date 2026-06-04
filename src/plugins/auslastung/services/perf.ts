/**
 * Opt-in Perf-Logging für die Cold-Load-Messung des Auslastungs-Moduls.
 *
 * TEMPORÄR (v2.26.x): dient nur dazu, den Engpass beim Modul-Öffnen zu messen
 * (volles `getAll` der Anträge vs. Aggregat-Compute vs. Embeddings) — wird mit
 * dem eigentlichen Optimierungs-Fix wieder entfernt/ersetzt.
 *
 * Standardmäßig AUS (kein Prod-Spam). Einschalten in der Browser-Console:
 *   localStorage.setItem('tf-perf','1')  → Seite neu laden → Modul öffnen.
 */
export const PERF: boolean = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('tf-perf') === '1';
  } catch {
    return false;
  }
})();

/** `performance.now()` nur wenn PERF an, sonst 0 (kein Overhead). */
export function perfNow(): number {
  return PERF ? performance.now() : 0;
}

/** Misst die Dauer von `fn` in `slot.v` (ms), wenn PERF an. Sonst transparent. */
export async function timed<T>(fn: () => Promise<T>, slot: { v: number }): Promise<T> {
  if (!PERF) return fn();
  const s = performance.now();
  try {
    return await fn();
  } finally {
    slot.v = performance.now() - s;
  }
}
