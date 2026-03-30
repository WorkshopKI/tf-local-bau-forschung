import type { OramaSearchResult } from '@/core/services/search/orama-store';

export interface RAGChunk {
  source: string;
  text: string;
  score: number;
  method: string;
}

export function searchResultsToRAGChunks(results: OramaSearchResult[]): RAGChunk[] {
  return results.map(r => ({
    source: r.source || r.title,
    text: r.text,
    score: r.score,
    method: r.method,
  }));
}

export function buildRAGContextString(
  chunks: RAGChunk[],
  maxChunks = 5,
  maxCharsPerChunk = 1500,
): string {
  if (chunks.length === 0) return '';

  const selected = chunks.slice(0, maxChunks);
  const parts = selected.map((c, i) =>
    `--- Quelle ${i + 1}: ${c.source} (Relevanz: ${Math.round(c.score * 100)}%) ---\n${c.text.slice(0, maxCharsPerChunk)}`,
  );

  return [
    '\n\n--- Relevante Dokumente aus dem Archiv ---',
    ...parts,
    '--- Ende Archiv-Context ---',
    'Nutze die obigen Dokumente als Referenz. Verweise auf die Quellen wenn du daraus zitierst.',
  ].join('\n\n');
}
