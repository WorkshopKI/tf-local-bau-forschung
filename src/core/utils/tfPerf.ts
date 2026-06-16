import { runtimeConfig } from '@/config/runtime-config';

/** Opt-in-Flag: in JEDER Variante (auch production = pl/kurator) `[tf-perf]`-
 *  Marker einschalten. Einmal in der Console setzen + App neu laden:
 *  `localStorage.teamflow_perf='1'`. Gedacht für Performance-Messung der
 *  Start-Datenaktualisierung direkt im `file://`-Build gegen den echten Share
 *  (der Dev-Server hat kein SMB-Onboarding). */
function perfFlagSet(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('teamflow_perf') === '1';
  } catch {
    return false;
  }
}

/** Aktiv in der development-Variante (build:dev) UND im vite dev server
 *  (variant 'custom' aus DEFAULT_CONFIG) ODER wenn das `teamflow_perf`-
 *  localStorage-Flag gesetzt ist (pl/kurator-Messung). In prod/demo sonst
 *  no-op — Marker werden vom Bundler nicht entfernt, sind aber praktisch
 *  kostenlos. Console mit `[tf-perf]` filtern, um die Zahlen zu sehen. */
const ENABLED = runtimeConfig.variant === 'development' || runtimeConfig.variant === 'custom'
  || perfFlagSet();

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
