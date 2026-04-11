import { pipeline, AutoModel, AutoTokenizer, env,
  type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { EmbeddingModelConfig } from './model-registry';
import { pipelineLog } from './pipeline-logger';

// Transformers.js v4 env
env.useWasmCache = true;          // WASM-Binaries cachen fuer Offline

/** Major-Version von @huggingface/transformers fuer Index-Invalidierung */
export const TRANSFORMERS_LIB_VERSION = 4;

export type { EmbeddingModelConfig } from './model-registry';
export { EMBEDDING_MODELS, getModelById, getActiveModelId, setActiveModelId } from './model-registry';

export interface EmbeddingProgress {
  phase: 'loading' | 'ready' | 'embedding';
  modelProgress?: { status: string; loaded?: number; total?: number };
  current?: number;
  total?: number;
}

type ProgressCallback = (progress: EmbeddingProgress) => void;

function truncateAndNormalize(vec: number[], targetDim: number): number[] {
  const truncated = vec.slice(0, targetDim);
  const norm = Math.sqrt(truncated.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return truncated;
  return truncated.map(v => v / norm);
}

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
      pipelineLog.info('Embedding', `Lade ${modelConfig.label} (${modelConfig.downloadSize}) — ${device}`);
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
      pipelineLog.info('Embedding', `${modelConfig.label} bereit — ${device}`);
      onProgress?.({ phase: 'ready' });
    } catch (err) {
      pipelineLog.warn('Embedding', `Laden fehlgeschlagen: ${err}`);
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

    let result: number[];
    if (this.pipelineExtractor) {
      const output = await this.pipelineExtractor(input, { pooling: 'mean', normalize: true });
      result = Array.from(output.data as Float32Array);
    } else if (this.autoModel && this.autoTokenizer) {
      result = await this.embedWithAutoModel(input, config);
    } else {
      throw new Error('Model not initialized');
    }

    if (config.useMRL && config.mrlDimensions) {
      result = truncateAndNormalize(result, config.mrlDimensions);
    }
    return result;
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

      let vec: number[];
      if (this.pipelineExtractor) {
        const output = await this.pipelineExtractor(input, { pooling: 'mean', normalize: true });
        vec = Array.from(output.data as Float32Array);
      } else if (this.autoModel && this.autoTokenizer) {
        vec = await this.embedWithAutoModel(input, config);
      } else {
        throw new Error('Model not initialized');
      }

      if (config.useMRL && config.mrlDimensions) {
        vec = truncateAndNormalize(vec, config.mrlDimensions);
      }
      vectors.push(vec);

      await new Promise(r => setTimeout(r, 0));
      onProgress?.(i + 1, texts.length);
    }
    return vectors;
  }

  private async embedWithAutoModel(text: string, config: EmbeddingModelConfig): Promise<number[]> {
    const tokenizer = this.autoTokenizer as {
      (texts: string[], opts?: Record<string, boolean>): Record<string, unknown> & {
        attention_mask?: { dims: number[]; data: BigInt64Array | Int32Array };
      };
    };
    const model = this.autoModel as {
      (inputs: Record<string, unknown>): Promise<Record<string, {
        dims: number[]; data: Float32Array;
      }>>;
    };

    const inputs = tokenizer([text], { padding: true, truncation: true });
    const outputs = await model(inputs);

    let embedding: Float32Array;

    // Manche Modelle (Harrier) liefern sentence_embedding direkt
    if (outputs.sentence_embedding) {
      const se = outputs.sentence_embedding;
      embedding = new Float32Array(se.data.slice(0, se.dims[se.dims.length - 1]!));
    } else if (outputs.last_hidden_state) {
      const lastHidden = outputs.last_hidden_state;
      const dims = lastHidden.dims;
      const data = lastHidden.data;
      const seqLen = dims[1]!;
      const hiddenDim = dims[2]!;

      if (config.pooling === 'last-token') {
        let lastTokenIdx = seqLen - 1;
        const attentionMask = inputs.attention_mask;
        if (attentionMask?.data) {
          const maskData = attentionMask.data;
          for (let t = seqLen - 1; t >= 0; t--) {
            if (Number(maskData[t]) === 1) { lastTokenIdx = t; break; }
          }
        }
        embedding = new Float32Array(hiddenDim);
        const offset = lastTokenIdx * hiddenDim;
        for (let d = 0; d < hiddenDim; d++) embedding[d] = data[offset + d]!;
      } else if (config.pooling === 'cls') {
        embedding = new Float32Array(hiddenDim);
        for (let d = 0; d < hiddenDim; d++) embedding[d] = data[d]!;
      } else {
        // Mean pooling (default)
        embedding = new Float32Array(hiddenDim);
        for (let t = 0; t < seqLen; t++) {
          for (let d = 0; d < hiddenDim; d++) embedding[d]! += data[t * hiddenDim + d]!;
        }
        for (let d = 0; d < hiddenDim; d++) embedding[d]! /= seqLen;
      }
    } else {
      throw new Error('Model output has neither sentence_embedding nor last_hidden_state');
    }

    // L2 Normalize
    if (config.normalize) {
      let norm = 0;
      for (let d = 0; d < embedding.length; d++) norm += embedding[d]! * embedding[d]!;
      norm = Math.sqrt(norm);
      if (norm > 0) for (let d = 0; d < embedding.length; d++) embedding[d]! /= norm;
    }

    return Array.from(embedding.slice(0, config.dimensions));
  }

  destroy(): void {
    const modelName = this.currentModelId ?? 'unbekannt';
    if (this.pipelineExtractor && (this.pipelineExtractor as any).dispose) {
      try { (this.pipelineExtractor as any).dispose(); } catch { /* ignore */ }
    }
    if (this.autoModel && (this.autoModel as any).dispose) {
      try { (this.autoModel as any).dispose(); } catch { /* ignore */ }
    }
    this.pipelineExtractor = null;
    this.autoModel = null;
    this.autoTokenizer = null;
    this.currentModelId = null;
    this.loading = false;
    pipelineLog.info('Embedding', `Entladen: ${modelName}`);
  }
}

export const embeddingService = new EmbeddingService();
