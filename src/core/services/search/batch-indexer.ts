import EmbeddingWorker from '../../../workers/embedding.worker?worker&inline';
import type { StorageService } from '@/core/services/storage';
import type { VectorChunk } from './vector-store';

export interface IndexStatus {
  phase: string;
  total: number;
  processed: number;
  currentDoc: string;
  skipped: number;
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
  private worker: Worker | null = null;
  private ready = false;

  async init(preferGPU = false): Promise<void> {
    this.worker = new EmbeddingWorker();
    const device = preferGPU ? 'webgpu' : 'wasm';

    return new Promise((resolve, reject) => {
      if (!this.worker) { reject(new Error('No worker')); return; }
      this.worker.onmessage = (e: MessageEvent) => {
        const data = e.data as Record<string, unknown>;
        if (data.type === 'ready') { this.ready = true; resolve(); }
        else if (data.type === 'error') reject(new Error(data.error as string));
      };
      this.worker.postMessage({ type: 'init', device });
    });
  }

  async indexAll(
    storage: StorageService,
    onStatus: (status: IndexStatus) => void,
  ): Promise<VectorChunk[]> {
    if (!this.worker || !this.ready) throw new Error('Not initialized');

    const docs = await storage.idb.keys('doc:');
    const manifest = await storage.idb.get<Record<string, string>>('index-manifest') ?? {};
    const allChunks: VectorChunk[] = [];
    let processed = 0;
    let skipped = 0;

    onStatus({ phase: 'Scanning', total: docs.length, processed: 0, currentDoc: '', skipped: 0 });

    for (const key of docs) {
      const doc = await storage.idb.get<{ id: string; filename: string; markdown: string }>(key);
      if (!doc) continue;

      const hash = await hashText(doc.markdown);
      if (manifest[doc.id] === hash) {
        skipped++;
        processed++;
        onStatus({ phase: 'Skipping', total: docs.length, processed, currentDoc: doc.filename, skipped });
        continue;
      }

      onStatus({ phase: 'Chunking', total: docs.length, processed, currentDoc: doc.filename, skipped });
      const chunks = chunkText(doc.markdown);

      onStatus({ phase: 'Embedding', total: docs.length, processed, currentDoc: doc.filename, skipped });
      const vectors = await this.embedBatch(chunks);

      for (let i = 0; i < chunks.length; i++) {
        allChunks.push({
          id: `${doc.id}-${i}`,
          text: chunks[i] ?? '',
          source: doc.filename,
          type: 'dokument',
          vector: vectors[i] ?? [],
        });
      }

      manifest[doc.id] = hash;
      processed++;
      onStatus({ phase: 'Done', total: docs.length, processed, currentDoc: doc.filename, skipped });
    }

    await storage.idb.set('vector-chunks', allChunks);
    await storage.idb.set('index-manifest', manifest);
    await storage.idb.set('index-last-update', new Date().toISOString());

    return allChunks;
  }

  private embedBatch(texts: string[]): Promise<number[][]> {
    return new Promise((resolve, reject) => {
      if (!this.worker) { reject(new Error('No worker')); return; }
      this.worker.onmessage = (e: MessageEvent) => {
        const data = e.data as Record<string, unknown>;
        if (data.type === 'embeddings') resolve(data.vectors as number[][]);
        else if (data.type === 'error') reject(new Error(data.error as string));
      };
      this.worker.postMessage({ type: 'embed-batch', texts });
    });
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}
