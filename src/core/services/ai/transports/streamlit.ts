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

export interface PingOptions {
  /** Streamlit-Bridge: bei FEHLENDEM Fenster-Handle KEIN `window.open` auslösen
   *  (rein passiver Verfügbarkeits-Check — pingt nur ein bereits offenes Fenster,
   *  sonst sofort `false`). Default `true` = altes Verhalten (Fenster bei Bedarf
   *  öffnen). Mount-/Refresh-Proben setzen `false`, damit das Öffnen der Detail-
   *  seite nicht ungefragt den KI-Tab aufmacht. DirectLLM ignoriert die Option
   *  (sein `/v1/models`-Fetch hat keinen Fenster-Seiteneffekt). */
  openIfNeeded?: boolean;
}

export interface AITransport {
  /** Interner Logik-Name (für Capability-/Domain-Checks, z.B.
   *  `transport.name === 'Streamlit'`). NICHT für die Anzeige verwenden. */
  name: string;
  /** Endnutzer-tauglicher Anzeige-Name (Tooltips, Status-Texte). Fällt auf
   *  `name` zurück, wenn nicht gesetzt. Vom Logik-Namen entkoppelt, damit das
   *  Wording geändert werden kann, ohne Vergleiche zu brechen. */
  displayName?: string;
  ping(opts?: PingOptions): Promise<boolean>;
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
  /** Aktive Streaming-Anfragen (streamConversation). Getrennt von `pending`,
   *  da hier inkrementell `onDelta` läuft und auf `StreamResult` aufgelöst wird. */
  private streams = new Map<string, {
    prev: string;
    onDelta: (text: string) => void;
    onReasoningDelta?: (text: string) => void;
    resolve: (r: StreamResult) => void;
    cleanup: () => void;
  }>();

  constructor(private streamlitUrl = 'https://gpt.vdivde-it.de/') {
    window.addEventListener('message', (event) => {
      // Origin gegen die KONFIGURIERTE Streamlit-URL pinnen — nicht hart auf
      // 'localhost', da das interne gpt-oss ggf. unter Servername/IP läuft.
      // Unparsebare URL → akzeptieren (Single-Team-Trust-Modell, lokal/intern).
      const allowed = this.allowedOrigin();
      if (allowed && event.origin !== allowed) return;
      const data = event.data as Record<string, unknown>;
      const type = data?.type;
      if (type !== 'tf-pong' && type !== 'tf-response' && type !== 'tf-stream'
        && type !== 'tf-bridge-ready' && type !== 'tf-app-ping') return;

      // Lebendes Fenster-Handle aus der eingehenden Nachricht übernehmen — das
      // EXAKTE Tab, in dem das Bookmarklet läuft. Robuster als `window.open`
      // (das einen schon offenen, benannten Tab neu laden und damit das injizierte
      // Bookmarklet löschen würde). Quelle: das `tf-bridge-ready`-Announce des
      // Bookmarklets beim Aktivieren.
      if (event.source) this.streamlitWindow = event.source as Window;

      if (type === 'tf-app-ping') {
        // Gegenrichtung: das Bookmarklet prüft, ob es UNSER App-Fenster erreicht.
        (event.source as Window | null)?.postMessage({ type: 'tf-app-pong' }, '*');
        return;
      }
      if (type === 'tf-pong') {
        const p = this.pending.get('ping');
        if (p) { clearTimeout(p.timeout); p.resolve('pong'); this.pending.delete('ping'); }
        return;
      }
      if (type === 'tf-stream' && typeof data.id === 'string') {
        // Inkrementeller Voll-Snapshot des bisherigen Antwort-Markdowns →
        // Delta-Suffix emittieren (nur bei sauberem Append; Reformat ignoriert,
        // der finale `tf-response` korrigiert via StreamResult.content).
        const s = this.streams.get(data.id);
        if (s) {
          const content = String(data.content ?? '');
          if (content.startsWith(s.prev)) {
            const suffix = content.slice(s.prev.length);
            if (suffix) s.onDelta(suffix);
          }
          s.prev = content;
        }
        return;
      }
      if (type === 'tf-response' && typeof data.id === 'string') {
        // Erst Streaming-Anfragen (StreamResult), dann Single-Shot (string).
        const s = this.streams.get(data.id);
        if (s) {
          s.cleanup();
          this.streams.delete(data.id);
          const reasoning = typeof data.reasoning === 'string' ? data.reasoning : '';
          if (reasoning) s.onReasoningDelta?.(reasoning);
          s.resolve({ content: String(data.result ?? s.prev), aborted: false, ...(reasoning ? { reasoning } : {}) });
          return;
        }
        const p = this.pending.get(data.id);
        if (p) { clearTimeout(p.timeout); p.resolve(data.result as string); this.pending.delete(data.id); }
      }
      // tf-bridge-ready: nur das Handle übernehmen (oben bereits geschehen).
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

  async ping(opts?: PingOptions): Promise<boolean> {
    try {
      const openIfNeeded = opts?.openIfNeeded ?? true;
      if (openIfNeeded) {
        await this.ensureConnection();
      } else if (!this.streamlitWindow || this.streamlitWindow.closed) {
        // Passiver Check: kein lebendes Bridge-Fenster → nicht erreichbar, OHNE
        // einen Tab zu öffnen (sonst poppt das bloße Öffnen der Verbund-Detail-
        // seite ungefragt den KI-Tab auf).
        return false;
      }
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
      // 200s — das Bookmarklet sammelt streamende Antworten bis ~180s (lange
      // Generierung / Thinking / Last); 60s würde lange Antworten abschneiden.
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('Response timeout')); }, 200000);
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

  /** Streaming-Variante: der Chat ([useChatController] runStreaming) bevorzugt
   *  diese Methode per Feature-Detection. Das Bookmarklet streamt den
   *  Antwort-Markdown via `tf-stream` (Voll-Snapshots) und finalisiert mit
   *  `tf-response {result, reasoning?}`, sobald das Streamlit-Skript idle ist.
   *  Streamlit ist single-turn: letzte User-Message, System-Prompt als Prefix. */
  async streamConversation(
    messages: ConversationMessage[],
    callbacks: StreamCallbacks,
    options?: ConversationOptions,
  ): Promise<StreamResult> {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const system = messages.find(m => m.role === 'system');
    const userText = lastUser?.content ?? '';
    const message = system?.content ? `${system.content}\n\n${userText}` : userText;

    if (options?.signal?.aborted) return { content: '', aborted: true };

    await this.ensureConnection();
    const id = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise<StreamResult>((resolve) => {
      // Safety-Cap über dem Bookmarklet-Hard-Cap (180s) — greift nur, wenn das
      // Bookmarklet gar nicht antwortet (Tab zu): liefert den Partial.
      const timeout = setTimeout(() => {
        const s = this.streams.get(id);
        if (!s) return;
        s.cleanup();
        this.streams.delete(id);
        resolve({ content: s.prev, aborted: false });
      }, 200000);

      const onAbort = (): void => {
        const s = this.streams.get(id);
        if (!s) return;
        s.cleanup();
        this.streams.delete(id);
        resolve({ content: s.prev, aborted: true }); // kein throw (mirror DirectLLM)
      };
      const cleanup = (): void => {
        clearTimeout(timeout);
        options?.signal?.removeEventListener('abort', onAbort);
      };

      this.streams.set(id, {
        prev: '',
        onDelta: callbacks.onDelta,
        ...(callbacks.onReasoningDelta ? { onReasoningDelta: callbacks.onReasoningDelta } : {}),
        resolve,
        cleanup,
      });
      options?.signal?.addEventListener('abort', onAbort, { once: true });
      this.streamlitWindow?.postMessage({ type: 'tf-request', id, message }, '*');
    });
  }
}
