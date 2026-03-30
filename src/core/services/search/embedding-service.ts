import { pipeline, AutoModel, AutoTokenizer,
  type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { EmbeddingModelConfig } from './model-registry';

export type { EmbeddingModelConfig } from './model-registry';
export { EMBEDDING_MODELS, getModelById, getActiveModelId, setActiveModelId } from './model-registry';

export interface EmbeddingProgress {
  phase: 'loading' | 'ready' | 'embedding';
  modelProgress?: { status: string; loaded?: number; total?: number };
  current?: number;
  total?: number;
}

type ProgressCallback = (progress: EmbeddingProgress) => void;

export class EmbeddingService {
  private pipelineExtractor: FeatureExtractionPipeline | null = null;
  private autoModel: unknown = null;
  private autoTokenizer: unknown = null;
  private loading = false;
  private currentModelId: string | null = null;

  getModelId(): string | null {
    return this.currentModelId;
  }

  async init(
    modelConfig: EmbeddingModelConfig,
    preferGPU = false,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    if (this.currentModelId === modelConfig.id && (this.pipelineExtractor || this.autoModel)) return;
    if (this.loading) return;

    if (this.currentModelId && this.currentModelId !== modelConfig.id) {
      this.destroy();
    }

    this.loading = true;
    try {
      onProgress?.({ phase: 'loading' });
      const device = preferGPU ? 'webgpu' : 'wasm';
      const progressCb = (p: Record<string, unknown>): void => {
        onProgress?.({
          phase: 'loading',
          modelProgress: {
            status: p.status as string,
            loaded: p.loaded as number | undefined,
            total: p.total as number | undefined,
          },
        });
      };

      if (modelConfig.strategy === 'pipeline') {
        this.pipelineExtractor = await (pipeline as Function)(
          'feature-extraction',
          modelConfig.name,
          {
            device,
            dtype: modelConfig.dtype ?? undefined,
            progress_callback: progressCb,
          },
        ) as FeatureExtractionPipeline;
      } else {
        this.autoTokenizer = await AutoTokenizer.from_pretrained(modelConfig.name, {
          progress_callback: progressCb,
        });
        this.autoModel = await AutoModel.from_pretrained(modelConfig.name, {
          dtype: modelConfig.dtype ?? 'q8',
          device,
          progress_callback: progressCb,
        });
      }

      this.currentModelId = modelConfig.id;
      onProgress?.({ phase: 'ready' });
    } catch (err) {
      this.loading = false;
      throw err;
    }
    this.loading = false;
  }

  isReady(): boolean {
    return this.pipelineExtractor !== null || this.autoModel !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }

  async embedSingle(
    text: string,
    config: EmbeddingModelConfig,
    mode: 'query' | 'document' = 'query',
  ): Promise<number[]> {
    const input = (mode === 'query' ? config.queryPrefix : config.documentPrefix) + text;

    if (this.pipelineExtractor) {
      const output = await this.pipelineExtractor(input, { pooling: 'mean', normalize: true });
      return Array.from(output.data as Float32Array);
    }
    if (this.autoModel && this.autoTokenizer) {
      return this.embedWithAutoModel(input, config);
    }
    throw new Error('Model not initialized');
  }

  async embedBatch(
    texts: string[],
    config: EmbeddingModelConfig,
    mode: 'query' | 'document' = 'document',
    onProgress?: (current: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<number[][]> {
    const prefix = mode === 'query' ? config.queryPrefix : config.documentPrefix;
    const vectors: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const input = prefix + texts[i]!;

      if (this.pipelineExtractor) {
        const output = await this.pipelineExtractor(input, { pooling: 'mean', normalize: true });
        vectors.push(Array.from(output.data as Float32Array));
      } else if (this.autoModel && this.autoTokenizer) {
        vectors.push(await this.embedWithAutoModel(input, config));
      } else {
        throw new Error('Model not initialized');
      }

      await new Promise(r => setTimeout(r, 0));
      onProgress?.(i + 1, texts.length);
    }
    return vectors;
  }

  private async embedWithAutoModel(text: string, config: EmbeddingModelConfig): Promise<number[]> {
    const tokenizer = this.autoTokenizer as {
      (texts: string[], opts?: Record<string, boolean>): Record<string, unknown>;
    };
    const model = this.autoModel as {
      (inputs: Record<string, unknown>): Promise<Record<string, {
        dims: number[]; data: Float32Array;
      }>>;
    };

    const inputs = tokenizer([text], { padding: true });
    const outputs = await model(inputs);

    const lastHidden = outputs.last_hidden_state;
    if (!lastHidden) throw new Error('Model output missing last_hidden_state');

    const dims = lastHidden.dims;
    const data = lastHidden.data;
    const seqLen = dims[1]!;
    const hiddenDim = dims[2]!;

    // Mean pooling
    const embedding = new Float32Array(hiddenDim);
    for (let t = 0; t < seqLen; t++) {
      for (let d = 0; d < hiddenDim; d++) {
        embedding[d]! += data[t * hiddenDim + d]!;
      }
    }
    for (let d = 0; d < hiddenDim; d++) {
      embedding[d]! /= seqLen;
    }

    // L2 Normalize
    if (config.normalize) {
      let norm = 0;
      for (let d = 0; d < hiddenDim; d++) norm += embedding[d]! * embedding[d]!;
      norm = Math.sqrt(norm);
      if (norm > 0) for (let d = 0; d < hiddenDim; d++) embedding[d]! /= norm;
    }

    return Array.from(embedding.slice(0, config.dimensions));
  }

  destroy(): void {
    this.pipelineExtractor = null;
    this.autoModel = null;
    this.autoTokenizer = null;
    this.currentModelId = null;
    this.loading = false;
  }
}

export const embeddingService = new EmbeddingService();
