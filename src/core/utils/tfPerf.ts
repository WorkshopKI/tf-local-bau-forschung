import { runtimeConfig } from '@/config/runtime-config';

/** Aktiv in der development-Variante (build:dev) UND im vite dev server
 *  (variant 'custom' aus DEFAULT_CONFIG). In prod/demo no-op —
 *  Marker werden vom Bundler nicht entfernt, sind aber praktisch kostenlos.
 *  Console mit `[tf-perf]` filtern, um die Zahlen zu sehen. */
const ENABLED = runtimeConfig.variant === 'development' || runtimeConfig.variant === 'custom';

/**
 * Startet eine Messung und gibt eine end()-Callback zurück. Der Callback
 * loggt Label + Dauer + optionalen Zusatz.
 *
 * Beispiel:
 *   const end = tfPerfStart('useDashboardData memo');
 *   // ... arbeit ...
 *   end(`antraege=${antraege.length}`);
 */
export function tfPerfStart(label: string): (extra?: string) => void {
  if (!ENABLED) return () => { /* no-op */ };
  const t0 = performance.now();
  return (extra?: string) => {
    const dt = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[tf-perf] ${label}: ${dt.toFixed(1)}ms${extra ? ' ' + extra : ''}`);
  };
}

/** Einzelne info-Zeile (z.B. Record-Größe-Sample). */
export function tfPerfLog(msg: string): void {
  if (!ENABLED) return;
  // eslint-disable-next-line no-console
  console.log(`[tf-perf] ${msg}`);
}

export const tfPerfEnabled = ENABLED;
