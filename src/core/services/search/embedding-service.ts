import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

export interface EmbeddingProgress {
  phase: 'loading' | 'ready' | 'embedding';
  modelProgress?: { status: string; loaded?: number; total?: number };
  current?: number;
  total?: number;
}

type ProgressCallback = (progress: EmbeddingProgress) => void;

export class EmbeddingService {
  private extractor: FeatureExtractionPipeline | null = null;
  private loading = false;

  async init(
    preferGPU = false,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    if (this.extractor || this.loading) return;
    this.loading = true;

    try {
      onProgress?.({ phase: 'loading' });

      const device = preferGPU ? 'webgpu' : 'wasm';
      this.extractor = await (pipeline as Function)(
        'feature-extraction',
        EMBEDDING_MODEL,
        {
          device: device as 'wasm' | 'webgpu',
          progress_callback: (p: Record<string, unknown>) => {
            onProgress?.({
              phase: 'loading',
              modelProgress: {
                status: p.status as string,
                loaded: p.loaded as number | undefined,
                total: p.total as number | undefined,
              },
            });
          },
        },
      ) as FeatureExtractionPipeline;

      onProgress?.({ phase: 'ready' });
    } catch (err) {
      this.loading = false;
      throw err;
    }

    this.loading = false;
  }

  isReady(): boolean {
    return this.extractor !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }

  async embedSingle(text: string): Promise<number[]> {
    if (!this.extractor) throw new Error('Model not initialized');
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  async embedBatch(
    texts: string[],
    onProgress?: (current: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<number[][]> {
    if (!this.extractor) throw new Error('Model not initialized');

    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const output = await this.extractor(texts[i]!, { pooling: 'mean', normalize: true });
      vectors.push(Array.from(output.data as Float32Array));

      // Micro-Batching: Event-Loop freigeben damit UI rendern kann
      await new Promise(r => setTimeout(r, 0));
      onProgress?.(i + 1, texts.length);
    }
    return vectors;
  }

  destroy(): void {
    this.extractor = null;
  }
}

// Singleton — wird zwischen BatchIndexer und QueryEmbedder geteilt
export const embeddingService = new EmbeddingService();
