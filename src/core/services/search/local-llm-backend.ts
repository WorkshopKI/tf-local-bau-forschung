/**
 * Lokales LLM-Backend fuer Metadata-Extraktion via Transformers.js v4.
 * Unterstuetzt Gemma 4 E4B/E2B mit WebGPU oder WASM (CPU) Fallback.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ── State ── */

interface LocalLLMState {
  model: any | null;
  processor: any | null;
  ready: boolean;
  loading: boolean;
  device: 'webgpu' | 'wasm' | null;
  modelId: string | null;
}

const state: LocalLLMState = {
  model: null, processor: null,
  ready: false, loading: false,
  device: null, modelId: null,
};

/* ── VRAM Logging ── */

async function logVRAM(label: string): Promise<void> {
  try {
    const adapter = await (navigator as any).gpu?.requestAdapter();
    if (!adapter) { console.log(`[GPU] ${label} — kein WebGPU`); return; }
    const info = await adapter.requestAdapterInfo?.() ?? {};
    const device = await adapter.requestDevice();
    // WebGPU memoryBudget (experimentell, Chrome 120+)
    const usage = (device as any).adapterInfo?.memoryHeaps?.[0];
    const budgetMB = usage ? Math.round(usage.budget / 1024 / 1024) : null;
    const usedMB = usage ? Math.round(usage.usage / 1024 / 1024) : null;
    if (budgetMB !== null && usedMB !== null) {
      console.log(`[GPU] ${label} — ${usedMB} MB / ${budgetMB} MB VRAM (${info.description ?? 'GPU'})`);
    } else {
      console.log(`[GPU] ${label} — VRAM-Details nicht verfuegbar (${info.description ?? 'GPU'})`);
    }
    device.destroy();
  } catch {
    console.log(`[GPU] ${label} — VRAM-Abfrage fehlgeschlagen`);
  }
}

/* ── Public API ── */

export function isLocalReady(): boolean { return state.ready; }
export function getLocalDevice(): 'webgpu' | 'wasm' | null { return state.device; }

export async function initLocalBackend(
  hfRepo: string,
  dtype: Record<string, string>,
  preferGPU: boolean,
  onProgress?: (msg: string) => void,
): Promise<boolean> {
  if (state.loading) return false;
  state.loading = true;

  try {
    const transformers = await import('@huggingface/transformers');

    // Verfuegbarkeits-Check
    if (!('Gemma4ForCausalLM' in transformers)) {
      onProgress?.('Gemma 4 wird von dieser Transformers.js-Version nicht unterstuetzt. Bitte API-Modell waehlen.');
      state.loading = false;
      return false;
    }

    const { Gemma4ForCausalLM, AutoProcessor } = transformers as any;

    // WebGPU pruefen
    let device: 'webgpu' | 'wasm' = 'wasm';
    if (preferGPU) {
      try {
        const adapter = await (navigator as any).gpu?.requestAdapter();
        if (adapter) {
          const info = await adapter.requestAdapterInfo?.() ?? {};
          onProgress?.(`WebGPU erkannt: ${info.description ?? 'GPU'}`);
          device = 'webgpu';
        } else {
          onProgress?.('Kein WebGPU — verwende CPU (langsamer)');
        }
      } catch {
        onProgress?.('WebGPU-Fehler — verwende CPU');
      }
    } else {
      onProgress?.('CPU-Modus gewaehlt');
    }

    // Processor laden
    onProgress?.('Processor laden...');
    state.processor = await AutoProcessor.from_pretrained(hfRepo);

    // Modell laden
    onProgress?.(`Modell laden (${device})...`);
    state.model = await Gemma4ForCausalLM.from_pretrained(hfRepo, {
      dtype,
      device,
      progress_callback: (info: any) => {
        if (info.status === 'progress' && info.total) {
          const pct = Math.round((info.loaded / info.total) * 100);
          onProgress?.(`Download: ${pct}%`);
        } else if (info.status === 'ready') {
          onProgress?.('Modell geladen');
        }
      },
    });

    state.device = device;
    state.modelId = hfRepo;
    state.ready = true;
    state.loading = false;
    console.log(`[LocalLLM] ✅ Geladen: ${hfRepo} (${device}, dtype: ${JSON.stringify(dtype)})`);
    await logVRAM('Nach Modell-Laden');
    onProgress?.(`Bereit (${device})`);
    return true;

  } catch (err) {
    console.error('[LocalLLM] Init failed:', err);

    // OOM-Fallback: WebGPU → WASM
    if (preferGPU && (String(err).includes('OOM') || String(err).includes('memory') || String(err).includes('out of memory'))) {
      onProgress?.('VRAM reicht nicht — versuche CPU-Modus...');
      state.model = null;
      state.processor = null;
      state.loading = false;
      return initLocalBackend(hfRepo, dtype, false, onProgress);
    }

    state.loading = false;
    onProgress?.(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export async function extractLocal(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!state.ready || !state.model || !state.processor) {
    throw new Error('Local LLM not initialized');
  }

  const messages = [
    { role: 'user', content: [{ type: 'text', text: systemPrompt + '\n\n' + userPrompt }] },
  ];

  const prompt = state.processor.apply_chat_template(messages, {
    enable_thinking: false,
    add_generation_prompt: true,
  });

  const inputs = await state.processor(prompt);

  const output = await state.model.generate({
    ...inputs,
    max_new_tokens: 512,
    do_sample: false,
  });

  // Nur neue Tokens dekodieren (nach dem Prompt)
  const promptLength = inputs.input_ids.dims[1];
  const newTokens = output.slice(null, [promptLength, null]);
  const decoded: string[] = state.processor.batch_decode(newTokens, {
    skip_special_tokens: true,
  });
  const result = decoded[0] ?? '';

  // GPU-Tensoren freigeben (verhindert OOM bei sequentiellen Calls)
  disposeTensors(output, newTokens, inputs);
  const newTokenCount = output.dims?.[1] ? output.dims[1] - promptLength : '?';
  console.log(`[LocalLLM] Inferenz: ${promptLength} prompt + ${newTokenCount} neue Tokens`);

  return result;
}

/** Gibt GPU-Tensoren frei um VRAM-Leaks zwischen generate()-Calls zu verhindern. */
function disposeTensors(...tensorsOrObjects: any[]): void {
  for (const item of tensorsOrObjects) {
    try {
      if (!item || typeof item !== 'object') continue;
      if ('dispose' in item && typeof item.dispose === 'function') {
        item.dispose();
      } else {
        // Input-Objekte enthalten verschachtelte Tensoren (input_ids, attention_mask, ...)
        for (const val of Object.values(item)) {
          if (val && typeof val === 'object' && 'dispose' in (val as any)) {
            (val as any).dispose();
          }
        }
      }
    } catch { /* Disposal-Fehler ignorieren */ }
  }
}

export function disposeLocalBackend(): void {
  const modelName = state.modelId ?? 'unbekannt';
  if (state.model?.dispose) {
    try { state.model.dispose(); } catch { /* ignore */ }
  }
  if (state.processor?.dispose) {
    try { state.processor.dispose(); } catch { /* ignore */ }
  }
  state.model = null;
  state.processor = null;
  state.ready = false;
  state.loading = false;
  state.device = null;
  state.modelId = null;
  console.log(`[LocalLLM] ❌ Entladen: ${modelName}`);
  logVRAM('Nach Modell-Entladen');
}

/* ── Smart Context Trimming ── */

export function smartTrim(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4; // Deutsch ≈ 4 Zeichen/Token
  if (text.length <= maxChars) return text;

  const headingBudget = Math.floor(maxChars * 0.15);
  const startBudget = Math.floor(maxChars * 0.55);
  const endBudget = Math.floor(maxChars * 0.30);

  const start = text.slice(0, startBudget);

  const headings = text.match(/^#{1,3}\s+.+$/gm) ?? [];
  const headingsText = headings.join('\n').slice(0, headingBudget);

  const end = text.slice(-endBudget);

  return `${start}\n\n[...Abschnitts-Uebersicht...]\n${headingsText}\n\n[...Dokumentende...]\n${end}`;
}
