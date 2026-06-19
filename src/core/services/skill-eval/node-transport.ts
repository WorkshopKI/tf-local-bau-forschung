/**
 * Node-tauglicher `AITransport` für die Skill-Eval-Harness.
 *
 * Spiegelt nur die OpenAI-kompatible Request-/Response-Form von
 * {@link DirectLLMTransport} (`/v1/chat/completions`, `/v1/models`), aber OHNE
 * jede Browser-API: kein `window`, kein `performance`, kein SSE-Streaming. Die
 * Eval läuft non-streaming (kein Thinking/Live-Preview nötig) und in Node gegen
 * erreichbare HTTP-Endpunkte (interner llama.cpp-Server, OpenRouter, …).
 *
 * Bewusst NICHT `DirectLLMTransport` wiederverwendet: das referenziert
 * `window.location.origin` (OpenRouter-Header) und bricht damit in Node.
 */
import type {
  AITransport,
  ConversationMessage,
  ConversationOptions,
  SubmitMessageOptions,
} from '@/core/services/ai/transports/streamlit';

export interface NodeTransportOptions {
  /** Basis-URL des Endpunkts (mit oder ohne `/v1` — wird normalisiert). */
  baseUrl: string;
  /** Modell-ID, die im Request-Body landet. */
  model: string;
  /** Optionaler Bearer-Token (OpenRouter/Cloud). Fehlt er → kein Auth-Header. */
  apiKey?: string;
  /** Zusätzliche Header (z.B. `HTTP-Referer`/`X-Title` für OpenRouter). */
  extraHeaders?: Record<string, string>;
  /** Sampling-Temperatur. Default 0 — deterministische Eval-Läufe. */
  temperature?: number;
  /** Logik-Name (`AITransport.name`). Default `'NodeLLM'`. */
  name?: string;
  /** Anzeige-Name (`AITransport.displayName`). Default = `name`. */
  displayName?: string;
}

export class NodeOpenAITransport implements AITransport {
  readonly name: string;
  readonly displayName: string;

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly temperature: number;

  constructor(options: NodeTransportOptions) {
    this.name = options.name ?? 'NodeLLM';
    this.displayName = options.displayName ?? this.name;
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.extraHeaders = options.extraHeaders ?? {};
    this.temperature = options.temperature ?? 0;
    // Normalisieren: ein evtl. vorhandenes `/v1` am Ende strippen — wir hängen
    // den Pfad selbst an (gleiche Logik wie DirectLLMTransport).
    this.baseUrl = options.baseUrl.replace(/\/v1\/?$/, '');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    return { ...headers, ...this.extraHeaders };
  }

  private buildBody(
    messages: ConversationMessage[],
    options?: { maxTokens?: number; responseFormat?: Record<string, unknown> },
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: this.temperature,
    };
    if (typeof options?.maxTokens === 'number') body.max_tokens = options.maxTokens;
    if (options?.responseFormat) body.response_format = options.responseFormat;
    return body;
  }

  /** Gemeinsamer non-streaming Chat-Completion-Call. */
  private async chat(
    messages: ConversationMessage[],
    options?: { maxTokens?: number; responseFormat?: Record<string, unknown>; signal?: AbortSignal },
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(this.buildBody(messages, options)),
      ...(options?.signal ? { signal: options.signal } : {}),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${this.model} — ${await readErrorDetail(res)}`);
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, { headers: this.getHeaders() });
      return res.ok;
    } catch {
      return false;
    }
  }

  async submitMessage(
    message: string,
    systemPrompt?: string,
    options?: SubmitMessageOptions,
  ): Promise<string> {
    const messages: ConversationMessage[] = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt } as ConversationMessage] : []),
      { role: 'user', content: message },
    ];
    return this.chat(messages, {
      ...(options?.responseFormat ? { responseFormat: options.responseFormat } : {}),
      ...(options?.signal ? { signal: options.signal } : {}),
    });
  }

  async submitConversation(
    messages: ConversationMessage[],
    options?: ConversationOptions,
  ): Promise<string> {
    return this.chat(messages, {
      ...(typeof options?.maxTokens === 'number' ? { maxTokens: options.maxTokens } : {}),
      ...(options?.responseFormat ? { responseFormat: options.responseFormat } : {}),
      ...(options?.signal ? { signal: options.signal } : {}),
    });
  }
}

/** Best-effort Fehlertext aus dem Response-Body (max. 300 Zeichen). */
async function readErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return JSON.stringify(body).slice(0, 300);
  } catch {
    return res.statusText;
  }
}
