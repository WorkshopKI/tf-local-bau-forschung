import { FulltextSearch } from './fulltext';
import type { SearchResult } from './fulltext';
import { VectorStore } from './vector-store';
import type { VectorSearchResult } from './vector-store';
import { QueryEmbedder } from './query-embedder';

export interface HybridResult {
  id: string;
  text: string;
  title: string;
  source: string;
  tags: string[];
  type: string;
  score: number;
  method: 'keyword' | 'vector' | 'hybrid';
}

export interface SearchCapabilities {
  keyword: boolean;
  vector: boolean;
  vectorLoading: boolean;
}

export class HybridSearch {
  constructor(
    private fulltext: FulltextSearch,
    private vectorStore: VectorStore,
    private queryEmbedder: QueryEmbedder,
  ) {}

  async search(query: string, filters?: { type?: string }): Promise<HybridResult[]> {
    const keywordResults = this.fulltext.search(query, filters);

    if (!this.queryEmbedder.isReady() || this.vectorStore.getChunkCount() === 0) {
      return keywordResults.map(r => ({ ...r, method: 'keyword' as const }));
    }

    try {
      const queryVector = await this.queryEmbedder.embed(query);
      const vectorResults = this.vectorStore.search(queryVector, 10, filters);
      return this.fuse(keywordResults, vectorResults);
    } catch {
      return keywordResults.map(r => ({ ...r, method: 'keyword' as const }));
    }
  }

  getCapabilities(): SearchCapabilities {
    return {
      keyword: true,
      vector: this.queryEmbedder.isReady() && this.vectorStore.getChunkCount() > 0,
      vectorLoading: this.queryEmbedder.isLoading(),
    };
  }

  private fuse(keyword: SearchResult[], vector: VectorSearchResult[]): HybridResult[] {
    const seen = new Map<string, HybridResult>();
    const k = 60;

    keyword.forEach((r, i) => {
      const rrf = 1 / (k + i + 1);
      const existing = seen.get(r.id);
      if (existing) {
        existing.score += rrf;
        existing.method = 'hybrid';
      } else {
        seen.set(r.id, { ...r, score: rrf, method: 'keyword' });
      }
    });

    vector.forEach((r, i) => {
      const rrf = 1 / (k + i + 1);
      const existing = seen.get(r.id);
      if (existing) {
        existing.score += rrf;
        existing.method = 'hybrid';
      } else {
        seen.set(r.id, { id: r.id, text: r.text, title: r.source, source: r.source, tags: [], type: r.type, score: rrf, method: 'vector' });
      }
    });

    return Array.from(seen.values()).sort((a, b) => b.score - a.score);
  }
}
