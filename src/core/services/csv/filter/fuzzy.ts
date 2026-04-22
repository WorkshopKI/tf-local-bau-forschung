export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length;
  const n = b.length;
  let prev: number[] = new Array<number>(n + 1).fill(0);
  let curr: number[] = new Array<number>(n + 1).fill(0);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n] ?? 0;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface FuzzyMatch {
  candidate: string;
  distance: number;
  confidence: number;
}

/**
 * Findet das beste Match unter candidates für query.
 * Confidence ist 1 - (distance / maxLen), normalisiert auf [0,1].
 * Gibt null zurück wenn distance > threshold.
 */
export function bestMatch(
  query: string,
  candidates: string[],
  threshold = 3,
): FuzzyMatch | null {
  const nq = normalize(query);
  if (!nq) return null;
  let best: FuzzyMatch | null = null;
  for (const c of candidates) {
    const nc = normalize(c);
    if (!nc) continue;
    const d = levenshtein(nq, nc);
    const maxLen = Math.max(nq.length, nc.length);
    const conf = maxLen === 0 ? 0 : 1 - d / maxLen;
    if (d <= threshold && (best === null || d < best.distance)) {
      best = { candidate: c, distance: d, confidence: conf };
    }
  }
  return best;
}
