import type { GenerationStats } from '../generation-stats';

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ConversationOptions {
  thinkingBudget?: 'none' | 'low' | 'medium' | 'high';
  responseFormat?: Record<string, unknown>;
  maxTokens?: number;
  /** Optional abort signal. DirectLLM reicht's an `fetch()` durch, Streamlit
   *  rejected das pending-Promise; Streamlit kann den serverseitigen Run
   *  nicht stoppen — der laeuft fertig, aber das UI reagiert sofort. */
  signal?: AbortSignal;
}

export interface SubmitMessageOptions {
  thinkingBudget?: 'none' | 'low' | 'medium' | 'high';
  responseFormat?: Record<string, unknown>;
  /** Siehe `ConversationOptions.signal`. */
  signal?: AbortSignal;
}

export interface StreamCallbacks {
  /** Sichtbarer Antwort-Text, inkrementell. */
  onDelta: (text: string) => void;
  /** Reasoning-/Thinking-Text, inkrementell (reasoning_content | reasoning | <think>-Fallback). */
  onReasoningDelta?: (text: string) => void;
}

export interface StreamResult {
  /** Vollständiger (bei Abort: partieller) Antwort-Text. */
  content: string;
  /** Vollständiger Thinking-Text, falls das Modell Reasoning geliefert hat. */
  reasoning?: string;
  stats?: GenerationStats;
  /** true: per AbortSignal gestoppt — Partial-Content, KEIN throw (sonst malt
   *  useAsyncAction den absichtlichen Stop als Fehler in den Error-Banner). */
  aborted: boolean;
}

export interface AITransport {
  /** Interner Logik-Name (für Capability-/Domain-Checks, z.B.
   *  `transport.name === 'Streamlit'`). NICHT für die Anzeige verwenden. */
  name: string;
  /** Endnutzer-tauglicher Anzeige-Name (Tooltips, Status-Texte). Fällt auf
   *  `name` zurück, wenn nicht gesetzt. Vom Logik-Namen entkoppelt, damit das
   *  Wording geändert werden kann, ohne Vergleiche zu brechen. */
  displayName?: string;
  ping(): Promise<boolean>;
  submitMessage(message: string, systemPrompt?: string, options?: SubmitMessageOptions): Promise<string>;
  /** Optional: Multi-Turn-Chat. Nur DirectLLMTransport implementiert das aktuell.
   *  Components nutzen Feature-Detection (`if (transport.submitConversation) ...`). */
  submitConversation?(messages: ConversationMessage[], options?: ConversationOptions): Promise<string>;
  /** Optional: Streaming-Multi-Turn-Chat (SSE). Nur DirectLLMTransport.
   *  Feature-Detection wie submitConversation. */
  streamConversation?(
    messages: ConversationMessage[],
    callbacks: StreamCallbacks,
    options?: ConversationOptions,
  ): Promise<StreamResult>;
}

export class StreamlitBridgeTransport implements AITransport {
  name = 'Streamlit';
  displayName = 'Interne KI';
  private streamlitWindow: Window | null = null;
  private pending = new Map<string, {
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  constructor(private streamlitUrl = 'https://gpt.vdivde-it.de/') {
    window.addEventListener('message', (event) => {
      // Origin gegen die KONFIGURIERTE Streamlit-URL pinnen — nicht hart auf
      // 'localhost', da das interne gpt-oss ggf. unter Servername/IP läuft.
      // Unparsebare URL → akzeptieren (Single-Team-Trust-Modell, lokal/intern).
      const allowed = this.allowedOrigin();
      if (allowed && event.origin !== allowed) return;
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

  private allowedOrigin(): string | null {
    try { return new URL(this.streamlitUrl).origin; } catch { return null; }
  }

  /** Streamlit-URL ändern, OHNE den globalen `message`-Listener neu zu
   *  registrieren (sonst Listener-Leak bei jedem Settings-Save). Das gecachte
   *  Fenster wird verworfen → nächster `ensureConnection()` öffnet die neue URL.
   *  Wird von `AIBridge.switchProvider()` genutzt, um den EINEN Transport
   *  wiederzuverwenden statt neu anzulegen. */
  updateUrl(url: string): void {
    if (url && url !== this.streamlitUrl) {
      this.streamlitUrl = url;
      this.streamlitWindow = null;
    }
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

  async submitMessage(
    message: string,
    _systemPrompt?: string,
    options?: SubmitMessageOptions,
  ): Promise<string> {
    if (options?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    await this.ensureConnection();
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('Response timeout')); }, 60000);
      this.pending.set(id, { resolve, reject, timeout });
      // Abort-Listener: cleanup pending + reject. Der Streamlit-Backend-Run
      // laeuft serverseitig fertig, aber der Caller bekommt sofort den
      // AbortError und kann das UI freigeben.
      const onAbort = (): void => {
        const p = this.pending.get(id);
        if (!p) return;
        clearTimeout(p.timeout);
        this.pending.delete(id);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      options?.signal?.addEventListener('abort', onAbort, { once: true });
      this.streamlitWindow?.postMessage({ type: 'tf-request', id, message }, '*');
    });
  }
}
