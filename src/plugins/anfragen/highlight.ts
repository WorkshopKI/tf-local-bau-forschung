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

/* ------------------------------------------------------------------ *
 * Mehr-Art-Highlighting (Layout A): das Original markiert PII (amber),
 * der anonymisierte Text Platzhalter (blau) UND etwaige Leaks (rot,
 * übermalt), die finale Antwort die eingesetzten Originale (blau).
 * ------------------------------------------------------------------ */

export type MarkKind = 'leak' | 'placeholder' | 'pii';

export interface KindedRange {
  start: number;
  /** Exklusiv. */
  end: number;
  kind: MarkKind;
}

export interface KindedSegment {
  text: string;
  /** `null` = unmarkiert. */
  kind: MarkKind | null;
}

/** Höhere Zahl = höhere Priorität bei Überlappung (rot > blau > amber). */
const KIND_PRIORITY: Record<MarkKind, number> = { pii: 0, placeholder: 1, leak: 2 };

/** CSS-Klasse je Markierungs-Art (geteilt von Read-only-Pane + Editor-Backdrop). */
export const MARK_CLASS: Record<MarkKind, string> = {
  leak: 'mk-leak',
  placeholder: 'mk-ph',
  pii: 'mk-pii',
};

/**
 * Wie `buildSegments`, aber mit mehreren Markierungs-Arten. Überlappende Ranges
 * werden zeichenweise nach Priorität aufgelöst (`leak > placeholder > pii`) und
 * danach zu maximalen gleich-Kind-Läufen zusammengefasst. Deckt den ganzen Text
 * lückenlos ab (jedes Zeichen genau einmal).
 */
export function buildKindedSegments(text: string, ranges: KindedRange[]): KindedSegment[] {
  const n = text.length;
  if (n === 0) return [];
  const kindAt: (MarkKind | null)[] = new Array<MarkKind | null>(n).fill(null);
  for (const r of ranges) {
    const start = Math.max(0, Math.min(n, r.start));
    const end = Math.max(0, Math.min(n, r.end));
    for (let i = start; i < end; i++) {
      const cur = kindAt[i] ?? null;
      if (cur === null || KIND_PRIORITY[r.kind] > KIND_PRIORITY[cur]) kindAt[i] = r.kind;
    }
  }
  const segs: KindedSegment[] = [];
  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || (kindAt[i] ?? null) !== (kindAt[runStart] ?? null)) {
      segs.push({ text: text.slice(runStart, i), kind: kindAt[runStart] ?? null });
      runStart = i;
    }
  }
  return segs;
}

/** Treffer (Export-Guard) → KindedRanges einer Art. */
export function trefferToRanges(treffer: Treffer[], kind: MarkKind): KindedRange[] {
  return treffer.map(t => ({ start: t.index, end: t.index + t.laenge, kind }));
}

/** Platzhalter `[TYP_N]` im Text als KindedRanges (kind `placeholder`). */
const PLATZHALTER_RE = /\[[A-Z][A-Z0-9_]*_\d+\]/g;
export function platzhalterRanges(text: string): KindedRange[] {
  const ranges: KindedRange[] = [];
  for (const m of text.matchAll(PLATZHALTER_RE)) {
    if (m.index === undefined) continue;
    ranges.push({ start: m.index, end: m.index + m[0].length, kind: 'placeholder' });
  }
  return ranges;
}
