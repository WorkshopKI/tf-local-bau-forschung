import type {
  AITransport,
  ConversationMessage,
  ConversationOptions,
  StreamCallbacks,
  StreamResult,
} from './streamlit';
import { createSSEParser } from '../sse-parser';
import { createThinkTagSplitter } from '../thinking-parser';
import { computeStats, type LlamaCppTimings, type OpenAIUsage } from '../generation-stats';

/** Shape eines OpenAI-kompatiblen Streaming-Chunks (llama.cpp + OpenRouter). */
interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string; reasoning_content?: string; reasoning?: string };
  }>;
  usage?: OpenAIUsage;
  timings?: LlamaCppTimings;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export class DirectLLMTransport implements AITransport {
  name: string;

  private baseUrl: string;

  constructor(
    private endpoint: string,
    private model: string,
    private apiKey?: string,
  ) {
    if (endpoint.includes('localhost')) this.name = 'llama.cpp';
    else if (endpoint.includes('openrouter')) this.name = 'OpenRouter';
    else this.name = 'Cloud API';

    // Normalize: strip trailing /v1 if present — we add it ourselves
    this.baseUrl = endpoint.replace(/\/v1\/?$/, '');
  }

  /**
   * llama.cpp-spezifische Body-Felder + Thinking-Steuerung. Endpoint-gated wie
   * `stream_options` (ältere llama.cpp-Builds lehnen unbekannte Params ab,
   * OpenRouter kennt die llama.cpp-Felder nicht):
   * - `cache_prompt`: Prefix-Cache explizit aktivieren (Default true in aktuellen
   *   Builds; sichert ältere ab) — Folge-Turns verarbeiten nur den neuen Suffix.
   * - `thinkingBudget: 'none'` → `chat_template_kwargs.enable_thinking = false`
   *   (Qwen-Template-Switch via --jinja); OpenRouter bekommt weiter `reasoning.effort`.
   */
  private applyLlamaCppFields(
    body: Record<string, unknown>,
    thinkingBudget?: 'none' | 'low' | 'medium' | 'high',
  ): void {
    const isOpenRouter = this.endpoint.includes('openrouter');
    if (!isOpenRouter) body.cache_prompt = true;
    if (thinkingBudget === 'none' && !isOpenRouter) {
      body.chat_template_kwargs = { enable_thinking: false };
    } else if (thinkingBudget) {
      body.reasoning = { effort: thinkingBudget };
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    if (this.endpoint.includes('openrouter')) {
      headers['HTTP-Referer'] = window.location.origin || 'https://teamflow.local';
      headers['X-Title'] = 'TeamFlow';
    }
    return headers;
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, { headers: this.getHeaders() });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getActiveModel(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, { headers: this.getHeaders() });
      if (!res.ok) return null;
      const data = await res.json() as { data?: Array<{ id?: string }> };
      const id = data?.data?.[0]?.id;
      return typeof id === 'string' && id.length > 0 ? id : null;
    } catch {
      return null;
    }
  }

  async submitMessage(
    message: string,
    systemPrompt?: string,
    options?: {
      thinkingBudget?: 'none' | 'low' | 'medium' | 'high';
      responseFormat?: Record<string, unknown>;
      signal?: AbortSignal;
    },
  ): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: message });

    const body: Record<string, unknown> = { model: this.model, messages, max_tokens: 1500 };

    this.applyLlamaCppFields(body, options?.thinkingBudget);
    if (options?.responseFormat) {
      body.response_format = options.responseFormat;
    }

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!res.ok) {
      let detail = '';
      try { const body = await res.json(); detail = JSON.stringify(body).slice(0, 300); } catch { /* ignore */ }
      console.error(`[DirectLLM] ${res.status} ${this.model}:`, detail);
      throw new Error(`API error: ${res.status} — ${detail || res.statusText}`);
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message.content ?? '';
  }

  async submitConversation(
    messages: ConversationMessage[],
    options?: ConversationOptions,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: options?.maxTokens ?? 1500,
    };
    this.applyLlamaCppFields(body, options?.thinkingBudget);
    if (options?.responseFormat) body.response_format = options.responseFormat;

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!res.ok) {
      let detail = '';
      try { const errBody = await res.json(); detail = JSON.stringify(errBody).slice(0, 300); } catch { /* ignore */ }
      console.error(`[DirectLLM/conversation] ${res.status} ${this.model}:`, detail);
      throw new Error(`API error: ${res.status} — ${detail || res.statusText}`);
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message.content ?? '';
  }

  async streamConversation(
    messages: ConversationMessage[],
    callbacks: StreamCallbacks,
    options?: ConversationOptions,
  ): Promise<StreamResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: options?.maxTokens ?? 1500,
      stream: true,
    };
    this.applyLlamaCppFields(body, options?.thinkingBudget);
    // stream_options nur bei OpenRouter — ältere llama.cpp-Builds lehnen unbekannte
    // Params ab; llama.cpp liefert `timings` ohnehin im Final-Chunk.
    if (this.endpoint.includes('openrouter')) body.stream_options = { include_usage: true };

    const tStart = performance.now();
    let content = '';
    let reasoning = '';
    let tFirstToken: number | null = null;
    let timings: LlamaCppTimings | undefined;
    let usage: OpenAIUsage | undefined;
    let aborted = false;

    const emitReasoning = (text: string): void => {
      if (tFirstToken === null) tFirstToken = performance.now();
      reasoning += text;
      callbacks.onReasoningDelta?.(text);
    };
    const splitter = createThinkTagSplitter(
      text => {
        if (tFirstToken === null) tFirstToken = performance.now();
        content += text;
        callbacks.onDelta(text);
      },
      emitReasoning,
    );

    const handlePayload = (payload: string): void => {
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(payload) as StreamChunk;
      } catch {
        console.warn('[DirectLLM/stream] Unparsebarer SSE-Payload übersprungen:', payload.slice(0, 120));
        return;
      }
      if (chunk.timings) timings = chunk.timings;
      if (chunk.usage) usage = chunk.usage;
      // OpenRouter-Usage-Chunk hat leeres choices-Array → guarden
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) return;
      const reasoningDelta = delta.reasoning_content ?? delta.reasoning;
      if (typeof reasoningDelta === 'string' && reasoningDelta.length > 0) emitReasoning(reasoningDelta);
      if (typeof delta.content === 'string' && delta.content.length > 0) splitter.pushContent(delta.content);
    };

    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      if (!res.ok) {
        let detail = '';
        try { const errBody = await res.json(); detail = JSON.stringify(errBody).slice(0, 300); } catch { /* ignore */ }
        console.error(`[DirectLLM/stream] ${res.status} ${this.model}:`, detail);
        throw new Error(`API error: ${res.status} — ${detail || res.statusText}`);
      }
      if (!res.body) throw new Error('Streaming nicht verfügbar (Response ohne Body)');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSSEParser();
      let done = false;
      while (!done) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        for (const payload of parser.push(decoder.decode(value, { stream: true }))) {
          if (payload === '[DONE]') { done = true; break; }
          handlePayload(payload);
        }
      }
      for (const payload of parser.end()) {
        if (payload !== '[DONE]') handlePayload(payload);
      }
    } catch (err) {
      // Absichtlicher Stop (AbortSignal) → Partial-Result statt Fehler.
      if (options?.signal?.aborted || isAbortError(err)) {
        aborted = true;
      } else {
        throw err;
      }
    } finally {
      splitter.flush();
    }

    const stats = computeStats({ timings, usage, tStart, tFirstToken, tEnd: performance.now() });
    return {
      content,
      ...(reasoning ? { reasoning } : {}),
      stats,
      aborted,
    };
  }
}
