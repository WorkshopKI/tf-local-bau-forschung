import { embeddingService } from './embedding-service';
import type { EmbeddingProgress } from './embedding-service';
import type { EmbeddingModelConfig } from './model-registry';
import type { StorageService } from '@/core/services/storage';
import type { VectorChunk } from './vector-store';

export interface IndexStatus {
  phase: string;
  total: number;
  processed: number;
  currentDoc: string;
  skipped: number;
  modelProgress?: { status: string; loaded?: number; total?: number };
  chunkProgress?: { current: number; total: number };
}

function chunkText(text: string, size = 200, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(' '));
    if (i + size >= words.length) break;
  }
  return chunks.length > 0 ? chunks : [text];
}

async function hashText(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class BatchIndexer {
  private ready = false;
  private modelConfig: EmbeddingModelConfig | null = null;

  async init(
    modelConfig: EmbeddingModelConfig,
    preferGPU = false,
    onStatus?: (status: IndexStatus) => void,
  ): Promise<void> {
    this.modelConfig = modelConfig;
    await embeddingService.init(modelConfig, preferGPU, (p: EmbeddingProgress) => {
      onStatus?.({
        phase: p.phase === 'loading' ? 'Modell laden' : 'Bereit',
        total: 0, processed: 0, currentDoc: '', skipped: 0,
        modelProgress: p.modelProgress,
      });
    });
    this.ready = true;
  }

  async indexAll(
    storage: StorageService,
    onStatus: (status: IndexStatus) => void,
    signal?: AbortSignal,
  ): Promise<VectorChunk[]> {
    if (!this.ready || !this.modelConfig) throw new Error('Not initialized');

    // Auto-force full reindex bei Modellwechsel
    const currentIndexModel = await storage.idb.get<string>('index-model-id');
    if (currentIndexModel && currentIndexModel !== this.modelConfig.id) {
      await storage.idb.delete('index-manifest');
    }

    const docs = await storage.idb.keys('doc:');
    const manifest = await storage.idb.get<Record<string, string>>('index-manifest') ?? {};
    const allChunks: VectorChunk[] = [];
    let processed = 0;
    let skipped = 0;

    onStatus({ phase: 'Scanning', total: docs.length, processed: 0, currentDoc: '', skipped: 0 });

    for (const key of docs) {
      if (signal?.aborted) break;

      const doc = await storage.idb.get<{ id: string; filename: string; markdown: string }>(key);
      if (!doc) continue;

      const hash = await hashText(doc.markdown);
      if (manifest[doc.id] === hash) {
        skipped++; processed++;
        onStatus({ phase: 'Skipping', total: docs.length, processed, currentDoc: doc.filename, skipped });
        continue;
      }

      onStatus({ phase: 'Chunking', total: docs.length, processed, currentDoc: doc.filename, skipped });
      const chunks = chunkText(doc.markdown);

      onStatus({ phase: 'Embedding', total: docs.length, processed, currentDoc: doc.filename, skipped });
      const vectors = await embeddingService.embedBatch(
        chunks, this.modelConfig, 'document',
        (current, total) => {
          onStatus({
            phase: 'Embedding', total: docs.length, processed,
            currentDoc: doc.filename, skipped,
            chunkProgress: { current, total },
          });
        },
        signal,
      );

      for (let i = 0; i < chunks.length; i++) {
        allChunks.push({
          id: `${doc.id}-${i}`, text: chunks[i] ?? '',
          source: doc.filename, type: 'dokument', vector: vectors[i] ?? [],
        });
      }

      manifest[doc.id] = hash;
      processed++;
      onStatus({ phase: 'Done', total: docs.length, processed, currentDoc: doc.filename, skipped });
    }

    await storage.idb.set('vector-chunks', allChunks);
    await storage.idb.set('index-manifest', manifest);
    await storage.idb.set('index-last-update', new Date().toISOString());
    await storage.idb.set('index-model-id', this.modelConfig.id);

    return allChunks;
  }

  destroy(): void {
    this.ready = false;
    this.modelConfig = null;
  }
}
