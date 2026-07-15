/**
 * Reine Klemm-Logik für die ziehbare Zwei-Spalten-Breite (node-testbar, kein
 * React/DOM). Rundet, klemmt auf [min, max] und fällt bei NaN/Infinity auf den
 * Default zurück.
 */
export function clampBreite(
  px: number,
  minBreite: number,
  maxBreite: number,
  defaultBreite: number,
): number {
  if (!Number.isFinite(px)) return defaultBreite;
  return Math.max(minBreite, Math.min(maxBreite, Math.round(px)));
}
