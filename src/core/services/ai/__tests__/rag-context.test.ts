import { describe, expect, it } from 'vitest';
import {
  buildRAGContextString,
  searchResultsToRAGChunks,
  type RAGChunk,
} from '../rag-context';
import type { OramaSearchResult } from '@/core/services/search/orama-store';

function makeResult(overrides: Partial<OramaSearchResult> = {}): OramaSearchResult {
  return {
    id: 'r1',
    text: 'Beispiel-Chunk-Text',
    title: 'Beispiel.pdf',
    source: 'archiv/beispiel.pdf',
    score: 0.9,
    method: 'hybrid',
    ...overrides,
  } as OramaSearchResult;
}

describe('searchResultsToRAGChunks', () => {
  it('nutzt source bevorzugt, fällt auf title zurück', () => {
    const chunks = searchResultsToRAGChunks([
      makeResult({ source: 'archiv/A.pdf', title: 'A.pdf' }),
      makeResult({ source: '', title: 'B.pdf' }),
    ]);
    expect(chunks[0]?.source).toBe('archiv/A.pdf');
    expect(chunks[1]?.source).toBe('B.pdf');
  });

  it('mappt Felder 1:1: text/score/method', () => {
    const chunks = searchResultsToRAGChunks([
      makeResult({ text: 'foo', score: 0.42, method: 'vector' }),
    ]);
    expect(chunks[0]?.text).toBe('foo');
    expect(chunks[0]?.score).toBe(0.42);
    expect(chunks[0]?.method).toBe('vector');
  });

  it('leeres Input → leeres Output', () => {
    expect(searchResultsToRAGChunks([])).toEqual([]);
  });
});

describe('buildRAGContextString', () => {
  it('liefert leeren String wenn keine Chunks', () => {
    expect(buildRAGContextString([])).toBe('');
  });

  it('Header + Footer-Hint umschließen die Quellen', () => {
    const chunks: RAGChunk[] = [
      { source: 'A.pdf', text: 'Inhalt A', score: 0.9, method: 'hybrid' },
    ];
    const out = buildRAGContextString(chunks);
    expect(out).toContain('--- Relevante Dokumente aus dem Archiv ---');
    expect(out).toContain('--- Ende Archiv-Context ---');
    expect(out).toContain('Nutze die obigen Dokumente als Referenz');
  });

  it('rundet Score auf Prozent', () => {
    const chunks: RAGChunk[] = [
      { source: 'A.pdf', text: 'x', score: 0.875, method: 'hybrid' },
    ];
    const out = buildRAGContextString(chunks);
    expect(out).toContain('Relevanz: 88%');
  });

  it('limitiert auf maxChunks (Default 5)', () => {
    const chunks: RAGChunk[] = Array.from({ length: 8 }, (_, i) => ({
      source: `doc${i}.pdf`,
      text: `Inhalt ${i}`,
      score: 0.5,
      method: 'hybrid',
    }));
    const out = buildRAGContextString(chunks);
    expect(out).toContain('doc0.pdf');
    expect(out).toContain('doc4.pdf');
    expect(out).not.toContain('doc5.pdf');
    expect(out).not.toContain('doc7.pdf');
  });

  it('respektiert custom maxChunks-Argument', () => {
    const chunks: RAGChunk[] = Array.from({ length: 5 }, (_, i) => ({
      source: `doc${i}.pdf`,
      text: 'x',
      score: 0.5,
      method: 'hybrid',
    }));
    const out = buildRAGContextString(chunks, 2);
    expect(out).toContain('doc0.pdf');
    expect(out).toContain('doc1.pdf');
    expect(out).not.toContain('doc2.pdf');
  });

  it('truncated chunk-text auf maxCharsPerChunk', () => {
    const longText = 'x'.repeat(2000);
    const chunks: RAGChunk[] = [{ source: 'A.pdf', text: longText, score: 0.9, method: 'hybrid' }];
    const out = buildRAGContextString(chunks, 5, 100);
    // 100 'x' im Chunk, aber nicht 2000.
    expect(out).toContain('x'.repeat(100));
    expect(out).not.toContain('x'.repeat(101));
  });

  it('Quellen-Index ist 1-basiert', () => {
    const chunks: RAGChunk[] = [
      { source: 'A.pdf', text: 'a', score: 0.9, method: 'hybrid' },
      { source: 'B.pdf', text: 'b', score: 0.8, method: 'hybrid' },
    ];
    const out = buildRAGContextString(chunks);
    expect(out).toContain('Quelle 1');
    expect(out).toContain('Quelle 2');
    expect(out).not.toContain('Quelle 0');
  });
});
