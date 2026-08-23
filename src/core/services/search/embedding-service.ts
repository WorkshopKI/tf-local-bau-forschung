import { pipeline, AutoModel, AutoTokenizer,
  type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { EmbeddingModelConfig } from './model-registry';
import { pipelineLog } from './pipeline-logger';
import { ensureOrtWasmBinary } from './ort-wasm-init';

// Transformers.js v4 env-Konfiguration (inkl. env.useWasmCache = false) lebt in ort-wasm-init.ts.

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
  /**
   * Worauf das geladene Modell rechnet.
   *
   * Gebraucht, seit ein Lauf mitten drin das Rechenwerk wechseln kann
   * ([geraet.ts](src/core/services/embedding-corpus/geraet.ts)): danach muss
   * jeder Anzeigende die WAHRHEIT nennen koennen und nicht das, was beim
   * Seitenaufbau moeglich schien.
   */
  private currentDevice: 'webgpu' | 'wasm' | null = null;
  /**
   * Der LAUFENDE Init — damit ein zweiter Aufrufer WARTET statt sofort
   * zurueckzukehren.
   *
   * Vorher stand hier `if (this.loading) return;`. Wer waehrend der
   * Modell-Ladezeit suchte (2,9 s aus dem HTTP-Cache, beim ersten Start der
   * ~200-MB-Download ueber SMB), bekam eine erfuellte Zusage auf ein Modell,
   * das noch nicht da war: `ensureEmbeddingReady` galt als erledigt, `isReady()`
   * war `false`, und die Suchseite meldete „Das Embedding-Modell konnte nicht
   * geladen werden" — ueber einen Fehler, der gar nicht stattfand, mit Verweis
   * auf die Konsole, die unter `file://` niemand offen hat.
   */
  private initPromise: Promise<void> | null = null;
  /**
   * Wer erfahren will, dass sich die Bereitschaft geaendert hat.
   *
   * Gebraucht, seit das Modell erst BEI BEDARF laedt (v4.113): der Ladelauf
   * startet jetzt haeufig woanders als beim Anzeigenden — die Suchseite ueber
   * `ensureEmbeddingReady`, der Indexlauf ueber `BatchIndexer.init`. React
   * rendert davon nichts neu, und das Abzeichen „Embedding-Modell laedt…" blieb
   * stehen, obwohl das Modell bereit war.
   */
  private hoerer = new Set<() => void>();

  getModelId(): string | null {
    return this.currentModelId;
  }

  /** Worauf das geladene Modell rechnet — `null`, solange keines geladen ist. */
  getDevice(): 'webgpu' | 'wasm' | null {
    return this.currentDevice;
  }

  /** Meldet jede Aenderung der Bereitschaft. Rueckgabe: abmelden. */
  subscribe(fn: () => void): () => void {
    this.hoerer.add(fn);
    return () => { this.hoerer.delete(fn); };
  }

  private melde(): void {
    for (const fn of this.hoerer) {
      try { fn(); } catch { /* ein Hoerer darf den Rest nicht mitreissen */ }
    }
  }

  async init(
    modelConfig: EmbeddingModelConfig,
    preferGPU = false,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    // Ein laufender Init wird ABGEWARTET, nicht uebersprungen. Danach die
    // Bedingung erneut pruefen: hat der Vorlauf ein ANDERES Modell geladen,
    // faellt der Aufruf durch auf den eigenen Ladelauf.
    while (this.initPromise) {
      await this.initPromise;
      if (this.currentModelId === modelConfig.id && (this.pipelineExtractor || this.autoModel)) return;
    }
    if (this.currentModelId === modelConfig.id && (this.pipelineExtractor || this.autoModel)) return;

    const lauf = this.ladeModell(modelConfig, preferGPU, onProgress);
    this.initPromise = lauf;
    try {
      await lauf;
    } finally {
      if (this.initPromise === lauf) this.initPromise = null;
    }
  }

  private async ladeModell(
    modelConfig: EmbeddingModelConfig,
    preferGPU: boolean,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    if (this.currentModelId && this.currentModelId !== modelConfig.id) {
      this.destroy();
    }

    this.loading = true;
    try {
      onProgress?.({ phase: 'loading' });
      const device = preferGPU ? 'webgpu' : 'wasm';
      pipelineLog.info('Embedding', `Lade ${modelConfig.label} (${modelConfig.downloadSize}) — ${device}`);
      // ORT-WASM als Inline-gzip bereitstellen, BEVOR die erste Pipeline/Session entsteht.
      await ensureOrtWasmBinary();
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
      this.currentDevice = device;
      pipelineLog.info('Embedding', `${modelConfig.label} bereit — ${device}`);
      onProgress?.({ phase: 'ready' });
    } catch (err) {
      pipelineLog.warn('Embedding', `Laden fehlgeschlagen: ${err}`);
      this.loading = false;
      this.melde();
      throw err;
    }
    this.loading = false;
    this.melde();
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
    this.currentDevice = null;
    this.loading = false;
    pipelineLog.info('Embedding', `Entladen: ${modelName}`);
    this.melde();
  }
}

export const embeddingService = new EmbeddingService();
