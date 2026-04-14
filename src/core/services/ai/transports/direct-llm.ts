import type { AITransport, ConversationMessage, ConversationOptions } from './streamlit';

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

  async submitMessage(
    message: string,
    systemPrompt?: string,
    options?: {
      thinkingBudget?: 'none' | 'low' | 'medium' | 'high';
      responseFormat?: Record<string, unknown>;
    },
  ): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: message });

    const body: Record<string, unknown> = { model: this.model, messages, max_tokens: 1500 };

    if (options?.thinkingBudget) {
      body.reasoning = { effort: options.thinkingBudget };
    }
    if (options?.responseFormat) {
      body.response_format = options.responseFormat;
    }

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
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
    if (options?.thinkingBudget) body.reasoning = { effort: options.thinkingBudget };
    if (options?.responseFormat) body.response_format = options.responseFormat;

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
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
}
