/**
 * Leichtgewichtiges Memory-Logging für die Citrix-OOM-Diagnose (v2.61.5).
 *
 * Hintergrund: Der CSV-Import + Cold-Start-Korpus konnten auf RAM-knappen
 * Citrix-Renderern (~6 GB/User) den Renderer mit „Out of Memory" abschießen.
 * Lokal nicht reproduzierbar — daher loggen wir den Heap-Stand an den
 * kritischen Phasen-Grenzen, damit der nächste Citrix-Testlauf den Peak (und
 * nach dem Fix dessen Absinken) sichtbar macht.
 *
 * `performance.memory` ist ein Chrome/Edge-spezifisches, NICHT standardisiertes
 * Feld (in Firefox/Safari nicht vorhanden) → defensiv abgefragt, sonst No-Op.
 * Bewusst `console.info` (kein UI): unter `file://` ist die DevTools-Konsole das
 * einzige verfügbare Diagnose-Fenster.
 */

interface PerfMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function logMem(label: string): void {
  const mem = (performance as Performance & { memory?: PerfMemory }).memory;
  if (!mem) return;
  const mb = (n: number): number => Math.round(n / 1048576);
  console.info(
    `[mem] ${label}: used ${mb(mem.usedJSHeapSize)} MB / total ${mb(mem.totalJSHeapSize)} MB / limit ${mb(mem.jsHeapSizeLimit)} MB`,
  );
}
