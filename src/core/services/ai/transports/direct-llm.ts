import type { AITransport } from './streamlit';

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
    options?: { thinkingBudget?: 'none' | 'low' | 'medium' | 'high' },
  ): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: message });

    const body: Record<string, unknown> = { model: this.model, messages };

    if (options?.thinkingBudget) {
      body.reasoning = { effort: options.thinkingBudget };
    }

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message.content ?? '';
  }
}
