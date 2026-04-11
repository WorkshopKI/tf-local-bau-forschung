/**
 * Browser-basierte LLM-Inferenz via Transformers.js v4 + WebGPU.
 * Nutzt Nemotron 3 Nano 4B (ONNX, q4) fuer Metadata-Extraktion.
 * Nur fuer Power-User mit GPU (6 GB+ VRAM).
 */

import type { TextGenerationPipeline } from '@huggingface/transformers';
import { pipelineLog } from './pipeline-logger';

export async function checkWebGPU(): Promise<boolean> {
  if (!('gpu' in navigator)) return false;
  try {
    const adapter = await (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu.requestAdapter();
    return !!adapter;
  } catch { return false; }
}

function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

interface GenerateOptions {
  maxNewTokens?: number;
  temperature?: number;
}

export class BrowserLLM {
  private generator: TextGenerationPipeline | null = null;
  private loading = false;
  private _ready = false;
  private currentModelId: string | null = null;

  async init(
    modelId: string,
    onProgress?: (msg: string) => void,
  ): Promise<boolean> {
    if (this._ready && this.currentModelId === modelId) return true;
    if (this.loading) return false;

    if (this._ready && this.currentModelId !== modelId) {
      this.dispose();
    }

    this.loading = true;
    try {
      onProgress?.('Transformers.js laden...');
      const { pipeline } = await import('@huggingface/transformers');

      pipelineLog.info('BrowserLLM', `Lade ${modelId} (q4, WebGPU)...`);

      this.generator = await (pipeline as Function)('text-generation', modelId, {
        dtype: 'q4',
        device: 'webgpu',
        progress_callback: (p: Record<string, unknown>) => {
          if (p.status === 'progress' && typeof p.loaded === 'number' && typeof p.total === 'number') {
            const pct = Math.round((p.loaded / p.total) * 100);
            onProgress?.(`Modell laden: ${pct}%`);
          } else if (typeof p.status === 'string') {
            onProgress?.(String(p.status));
          }
        },
      }) as TextGenerationPipeline;

      this._ready = true;
      this.currentModelId = modelId;
      pipelineLog.info('BrowserLLM', `${modelId} bereit (WebGPU)`);
      onProgress?.('Browser-LLM bereit');
      return true;
    } catch (err) {
      pipelineLog.warn('BrowserLLM', `Laden fehlgeschlagen: ${err}`);
      console.error('[BrowserLLM] Init failed:', err);
      onProgress?.(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      this.loading = false;
    }
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    opts?: GenerateOptions,
  ): Promise<string> {
    if (!this.generator) throw new Error('BrowserLLM not initialized');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const output = await (this.generator as Function)(messages, {
      max_new_tokens: opts?.maxNewTokens ?? 1500,
      do_sample: false,
      tokenizer_encode_kwargs: { enable_thinking: false },
    });

    // Extrahiere assistant-Antwort
    const generated = (output as Array<{ generated_text: unknown }>)[0]?.generated_text;
    let raw = '';
    if (Array.isArray(generated)) {
      const assistantMsg = generated.find((m: { role: string; content?: string }) => m.role === 'assistant');
      raw = assistantMsg?.content ?? '';
    } else {
      raw = String(generated ?? '');
    }

    // Safety-Net: Thinking-Tokens strippen
    return stripThinking(raw);
  }

  isReady(): boolean {
    return this._ready;
  }

  isLoading(): boolean {
    return this.loading;
  }

  getModelId(): string | null {
    return this.currentModelId;
  }

  dispose(): void {
    const modelName = this.currentModelId ?? 'unbekannt';
    if (this.generator && (this.generator as any).dispose) {
      try { (this.generator as any).dispose(); } catch { /* ignore */ }
    }
    this.generator = null;
    this._ready = false;
    this.currentModelId = null;
    this.loading = false;
    pipelineLog.info('BrowserLLM', `Entladen: ${modelName}`);
  }
}

export const browserLLM = new BrowserLLM();
