export interface VectorChunk {
  id: string;
  text: string;
  source: string;
  type: string;
  vector: number[];
}

export interface VectorSearchResult {
  id: string;
  text: string;
  source: string;
  type: string;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) * (a[i] ?? 0);
    normB += (b[i] ?? 0) * (b[i] ?? 0);
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class VectorStore {
  private chunks: VectorChunk[] = [];

  load(chunks: VectorChunk[]): void {
    this.chunks = chunks;
  }

  async loadFromStorage(idb: { get: <T>(key: string) => Promise<T | null> }): Promise<void> {
    const data = await idb.get<VectorChunk[]>('vector-chunks');
    if (data) this.chunks = data;
  }

  search(queryVector: number[], topK = 10, filters?: { type?: string }): VectorSearchResult[] {
    return this.chunks
      .filter(c => !filters?.type || c.type === filters.type)
      .map(c => ({
        id: c.id,
        text: c.text,
        source: c.source,
        type: c.type,
        score: cosineSimilarity(queryVector, c.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  getChunkCount(): number {
    return this.chunks.length;
  }
}
