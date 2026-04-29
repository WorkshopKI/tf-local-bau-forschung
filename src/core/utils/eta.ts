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
