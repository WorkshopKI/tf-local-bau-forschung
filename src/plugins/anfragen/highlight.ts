/**
 * Pure Segment-Bildung für das Live-Highlight im ReviewEditor: aus dem Text +
 * den Guard-Treffern eine Folge aus normalen und markierten Segmenten bauen
 * (überlappende Treffer werden gemerged). Bewusst getrennt vom UI, damit die
 * Intervall-/Off-by-one-Logik testbar bleibt.
 */
import type { Treffer } from './services/export-guard';

export interface Segment {
  text: string;
  mark: boolean;
}

/** Treffer-Bereiche zu nicht-überlappenden, aufsteigenden Intervallen mergen. */
export function mergeRanges(treffer: Treffer[]): Array<[number, number]> {
  const ranges = treffer
    .map(t => [t.index, t.index + t.laenge] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

export function buildSegments(text: string, treffer: Treffer[]): Segment[] {
  const ranges = mergeRanges(treffer);
  if (ranges.length === 0) return [{ text, mark: false }];
  const segs: Segment[] = [];
  let pos = 0;
  for (const [start, end] of ranges) {
    if (start > pos) segs.push({ text: text.slice(pos, start), mark: false });
    segs.push({ text: text.slice(start, end), mark: true });
    pos = end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), mark: false });
  return segs;
}
