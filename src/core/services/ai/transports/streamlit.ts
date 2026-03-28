export interface AITransport {
  name: string;
  ping(): Promise<boolean>;
  submitMessage(message: string, systemPrompt?: string): Promise<string>;
}

export class StreamlitBridgeTransport implements AITransport {
  name = 'Streamlit';
  private streamlitWindow: Window | null = null;
  private pending = new Map<string, {
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  constructor(private streamlitUrl = 'http://localhost:8501') {
    window.addEventListener('message', (event) => {
      if (!event.origin.includes('localhost')) return;
      const data = event.data as Record<string, unknown>;
      if (data?.type === 'tf-pong') {
        const p = this.pending.get('ping');
        if (p) { clearTimeout(p.timeout); p.resolve('pong'); this.pending.delete('ping'); }
      }
      if (data?.type === 'tf-response' && typeof data.id === 'string') {
        const p = this.pending.get(data.id);
        if (p) { clearTimeout(p.timeout); p.resolve(data.result as string); this.pending.delete(data.id); }
      }
    });
  }

  async ensureConnection(): Promise<void> {
    if (!this.streamlitWindow || this.streamlitWindow.closed) {
      this.streamlitWindow = window.open(this.streamlitUrl, 'teamflow-streamlit');
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.ensureConnection();
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { this.pending.delete('ping'); reject(new Error('Ping timeout')); }, 5000);
        this.pending.set('ping', { resolve: () => resolve(true), reject, timeout });
        this.streamlitWindow?.postMessage({ type: 'tf-ping' }, '*');
      });
    } catch {
      return false;
    }
  }

  async submitMessage(message: string): Promise<string> {
    await this.ensureConnection();
    const id = `msg-${Date.now()}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('Response timeout')); }, 60000);
      this.pending.set(id, { resolve, reject, timeout });
      this.streamlitWindow?.postMessage({ type: 'tf-request', id, message }, '*');
    });
  }
}
