export interface EtaOptions {
  /** Mindestanzahl verarbeiteter Items, bevor eine ETA berechnet wird. Default 3. */
  minSamples?: number;
  /** Mindest-Messdauer in ms, bevor eine ETA berechnet wird. Default 0 (kein Untergrenze). */
  minElapsedMs?: number;
}

export function computeEta(
  elapsedMs: number,
  processed: number,
  total: number,
  opts: EtaOptions = {},
): string | null {
  const minSamples = opts.minSamples ?? 3;
  const minElapsedMs = opts.minElapsedMs ?? 0;
  if (processed < minSamples || total <= 0 || elapsedMs < minElapsedMs) return null;
  const remaining = (elapsedMs / processed) * (total - processed);
  return `~${formatDuration(remaining)} verbleibend`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}:${String(secs).padStart(2, '0')} min`;
}

export interface ThroughputSample {
  /** Wall-clock timestamp (Date.now()). */
  t: number;
  /** Anzahl bisher verarbeiteter Items zu diesem Zeitpunkt. */
  processed: number;
}

export interface EtaWindowOptions {
  /** Mindestanzahl Samples im Window, bevor eine ETA berechnet wird. Default 3. */
  minSamples?: number;
  /** Mindest-Spannweite des Sample-Windows in ms, bevor eine ETA berechnet wird. Default 1500. */
  minWindowMs?: number;
}

/**
 * ETA-Schaetzung aus einem Sliding-Window von Throughput-Samples.
 * Im Gegensatz zu {@link computeEta} (lineare Extrapolation aus dem
 * Gesamt-Mittelwert) reagiert diese Variante auf aktuelle Rate-Aenderungen —
 * gedacht fuer Pipelines mit ungleichmaessigem Durchsatz (z.B. CSV-Merge,
 * bei dem unchanged-Rows blitzschnell durchgezaehlt und changed-Rows teuer
 * sind). Caller verwaltet das Window selbst (push neuer Samples, abschneiden
 * der alten) und uebergibt das aktuelle Window.
 *
 * @param samples Zeitlich aufsteigend sortierte Throughput-Samples (älteste zuerst).
 * @param total   Gesamtanzahl Items in der laufenden Phase.
 * @param opts    Konfidenz-Schwellen.
 * @returns       String wie "~12s verbleibend" oder null wenn (a) zu wenige Samples,
 *                (b) Window zu kurz, (c) Throughput im Window ≤ 0 (keine Progression).
 */
export function computeEtaFromSamples(
  samples: readonly ThroughputSample[],
  total: number,
  opts: EtaWindowOptions = {},
): string | null {
  const minSamples = opts.minSamples ?? 3;
  const minWindowMs = opts.minWindowMs ?? 1500;
  if (samples.length < minSamples || total <= 0) return null;
  const first = samples[0] as ThroughputSample;
  const last = samples[samples.length - 1] as ThroughputSample;
  const windowMs = last.t - first.t;
  if (windowMs < minWindowMs) return null;
  const itemsInWindow = last.processed - first.processed;
  if (itemsInWindow <= 0) return null;
  const itemsPerMs = itemsInWindow / windowMs;
  const remaining = total - last.processed;
  if (remaining <= 0) return null;
  const remainingMs = remaining / itemsPerMs;
  return `~${formatDuration(remainingMs)} verbleibend`;
}
