import type { AITransport } from './streamlit';

export class DirectLLMTransport implements AITransport {
  name: string;

  constructor(
    private endpoint: string,
    private model: string,
    private apiKey?: string,
  ) {
    this.name = endpoint.includes('localhost') ? 'llama.cpp' : 'Cloud API';
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/v1/models`, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async submitMessage(message: string): Promise<string> {
    const res = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message.content ?? '';
  }
}
