import type { GenerationStats } from '../generation-stats';
import { useBridgeStatus } from '../bridge-status';
import { createActivityDeadline } from './deadline';

/** Ziel-Chat in der Streamlit-App (Zweit-LLM-Erprobung, v2.203):
 *  'standard' = Tab „Chat" (klassisches AitisiGPT), 'agentisch' = Tab
 *  „Agentischer Chat" (Qwen-Agent). Ohne Angabe: aktiver Tab (bisheriges
 *  Verhalten; alte Bookmarklets ignorieren das Feld). */
export type BridgeZiel = 'standard' | 'agentisch';

/** Ergebnis eines `resetChat` (nur Streamlit): `'ok'` = Reset-Button gefunden +
 *  geklickt, `'nicht-gefunden'` = kein Button im DOM, `'timeout'` = kein Bridge-
 *  Fenster oder keine Bestätigung in 15 s. Alle drei sind best-effort — der Lauf
 *  startet in jedem Fall; `'nicht-gefunden'`/`'timeout'` werden dem Nutzer als
 *  mögliche Verlaufskontamination markiert (Pitfall #36). */
export type ResetErgebnis = 'ok' | 'nicht-gefunden' | 'timeout';

/** Antwort-Timeouts (v2.203, aktivitätsbasiert statt starr):
 *  - IDLE: feuert nur nach so viel Zeit OHNE Aktivität (tf-stream/tf-progress).
 *    200 s = der alte Fix-Wert — ALTE Bookmarklets ohne tf-progress-Heartbeat
 *    werden nicht strenger behandelt als bisher; neue melden alle ~10 s
 *    Aktivität, solange der Lauf lebt → Idle-Expiry heißt „Tab tot".
 *  - HARD: absoluter Deckel, 60 s über dem Bookmarklet-Hard-Cap (600 s). */
const RESPONSE_IDLE_TIMEOUT_MS = 200_000;
const RESPONSE_HARD_TIMEOUT_MS = 660_000;

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
  /** Nur Streamlit-Bridge: Ziel-Chat (Tab) in der KI-Oberfläche. DirectLLM
   *  ignoriert die Option. Bewusst NUR hier (nicht in `ConversationOptions`) —
   *  die produktive Zweit-LLM-Verdrahtung (Streaming/QS) ist ein späteres Paket. */
  ziel?: BridgeZiel;
  /** Nur Streamlit-Bridge: Abschluss-Marker. Das Bookmarklet finalisiert die Antwort
   *  NICHT auf dem kurzen Idle-Fenster, solange sie diesen Text nicht enthält — Schutz
   *  gegen zu frühen Abbruch langer, zweiteiliger Antworten (z. B. „Finaler Text" bei
   *  Gutachten-Abschnitten, wenn `isRunning()` in der Pause vor dem Schluss-Abschnitt
   *  fälschlich false liest). Fehlt der Marker dauerhaft, greift der 150-s-Backstop. */
  erwarteAbschluss?: string;
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
  /** Optional: setzt den Chat-Verlauf des Transports zurück (frischer Kontext).
   *  Nur die Streamlit-Bridge implementiert das (klickt den „Neuer Chat"-Button
   *  via Bookmarklet); stateless-API-Transports (DirectLLM) brauchen es nicht.
   *  Best-effort — `'ok'`, wenn ein Reset-Button gefunden+geklickt wurde,
   *  `'nicht-gefunden'` (kein Button) bzw. `'timeout'` (kein Fenster / keine
   *  Antwort in 15 s) sonst; der Lauf startet in jedem Fall.
   *  `ziel` (nur Streamlit): Reset im benannten Tab (Zweit-LLM-Erprobung). */
  resetChat?(ziel?: BridgeZiel): Promise<ResetErgebnis>;
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
  /** `cancel` beendet die Antwort-Deadline (Erfolgs-/Cleanup-Pfad); `touch`
   *  (nur bei aktivitätsbasierter Deadline gesetzt) meldet Lauf-Aktivität
   *  (tf-stream/tf-progress) und schiebt das Idle-Timeout. */
  private pending = new Map<string, {
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    cancel: () => void;
    touch?: () => void;
  }>();
  /** Aktive Streaming-Anfragen (streamConversation). Getrennt von `pending`,
   *  da hier inkrementell `onDelta` läuft und auf `StreamResult` aufgelöst wird. */
  private streams = new Map<string, {
    prev: string;
    onDelta: (text: string) => void;
    onReasoningDelta?: (text: string) => void;
    resolve: (r: StreamResult) => void;
    cleanup: () => void;
    touch?: () => void;
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
        && type !== 'tf-progress'
        && type !== 'tf-bridge-ready' && type !== 'tf-app-ping' && type !== 'tf-reset-done') return;

      // Lebendes Fenster-Handle aus der eingehenden Nachricht übernehmen — das
      // EXAKTE Tab, in dem das Bookmarklet läuft. Robuster als `window.open`
      // (das einen schon offenen, benannten Tab neu laden und damit das injizierte
      // Bookmarklet löschen würde). Quelle: das `tf-bridge-ready`-Announce des
      // Bookmarklets beim Aktivieren.
      if (event.source) this.streamlitWindow = event.source as Window;

      // Jede zugelassene Inbound-Nachricht (richtige Origin) beweist eine lebende
      // Bridge → verbunden. Deckt alle „→ connected"-Faelle in EINER Zeile ab
      // (tf-bridge-ready / tf-pong / tf-app-ping / tf-stream / tf-response / tf-reset-done).
      useBridgeStatus.getState().markActivity();

      if (type === 'tf-app-ping') {
        // Gegenrichtung: das Bookmarklet prüft, ob es UNSER App-Fenster erreicht.
        (event.source as Window | null)?.postMessage({ type: 'tf-app-pong' }, '*');
        return;
      }
      if (type === 'tf-pong') {
        const p = this.pending.get('ping');
        if (p) { p.cancel(); p.resolve('pong'); this.pending.delete('ping'); }
        return;
      }
      if (type === 'tf-reset-done' && typeof data.id === 'string') {
        const p = this.pending.get(data.id);
        if (p) { p.cancel(); p.resolve(data.found ? 'gefunden' : 'nicht-gefunden'); this.pending.delete(data.id); }
        return;
      }
      if (type === 'tf-progress' && typeof data.id === 'string') {
        // ~10-s-Heartbeat des Bookmarklets während eines Laufs (auch VOR dem
        // ersten Token, wenn es noch keine tf-stream-Snapshots gibt) → das
        // Idle-Timeout der zugehörigen Anfrage schieben.
        this.pending.get(data.id)?.touch?.();
        this.streams.get(data.id)?.touch?.();
        return;
      }
      if (type === 'tf-stream' && typeof data.id === 'string') {
        // Inkrementeller Voll-Snapshot des bisherigen Antwort-Markdowns →
        // Delta-Suffix emittieren (nur bei sauberem Append; Reformat ignoriert,
        // der finale `tf-response` korrigiert via StreamResult.content).
        // Zählt zusätzlich als Aktivität für das Idle-Timeout — auch für
        // Single-Shot-Anfragen (`pending`), die keine Deltas konsumieren.
        this.pending.get(data.id)?.touch?.();
        const s = this.streams.get(data.id);
        if (s) {
          s.touch?.();
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
        if (p) { p.cancel(); p.resolve(data.result as string); this.pending.delete(data.id); }
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
      // Neue URL → die alte Verbindung gilt nicht mehr; Status auf `unknown`
      // (nicht `disconnected` — ueber das neue Endpoint wissen wir noch nichts).
      useBridgeStatus.getState().reset();
    }
  }

  /** Synchroner, kostenfreier Erreichbarkeits-Check (kein postMessage): lebt das
   *  per `tf-bridge-ready` gecapturte Bridge-Fenster noch? `false`, sobald der
   *  Nutzer den KI-Tab schliesst (`window.closed` flippt sofort). Treibt die
   *  schnelle Tab-geschlossen-Erkennung im Heartbeat. */
  hasLiveBridgeWindow(): boolean {
    return !!this.streamlitWindow && !this.streamlitWindow.closed;
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
        useBridgeStatus.getState().setConnected(false);
        return false;
      }
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { this.pending.delete('ping'); reject(new Error('Ping timeout')); }, 5000);
        this.pending.set('ping', { resolve: () => resolve(true), reject, cancel: () => clearTimeout(timeout) });
        this.streamlitWindow?.postMessage({ type: 'tf-ping' }, '*');
      });
    } catch {
      // Timeout / Throw → Bridge nicht erreichbar (der Erfolgsfall flippt bereits
      // ueber das eingehende `tf-pong` → markActivity auf `connected`).
      useBridgeStatus.getState().setConnected(false);
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
      // Aktivitätsbasiert (v2.203): tf-stream/tf-progress schieben das
      // Idle-Timeout — lange Läufe unter Server-Last (1–2 min+) laufen durch,
      // solange der Lauf lebt. Idle-Expiry OHNE Aktivität (kein Abort!) deutet
      // auf einen toten/geschlossenen Tab → getrennt.
      const deadline = createActivityDeadline({
        idleMs: RESPONSE_IDLE_TIMEOUT_MS,
        hardMs: RESPONSE_HARD_TIMEOUT_MS,
        onExpire: () => {
          this.pending.delete(id);
          useBridgeStatus.getState().setConnected(false);
          reject(new Error('Response timeout'));
        },
      });
      this.pending.set(id, { resolve, reject, cancel: deadline.cancel, touch: deadline.touch });
      // Abort-Listener: cleanup pending + reject. Der Streamlit-Backend-Run
      // laeuft serverseitig fertig, aber der Caller bekommt sofort den
      // AbortError und kann das UI freigeben.
      const onAbort = (): void => {
        const p = this.pending.get(id);
        if (!p) return;
        p.cancel();
        this.pending.delete(id);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      options?.signal?.addEventListener('abort', onAbort, { once: true });
      this.streamlitWindow?.postMessage({
        type: 'tf-request', id, message,
        ...(options?.ziel ? { ziel: options.ziel } : {}),
        ...(options?.erwarteAbschluss ? { erwarte: options.erwarteAbschluss } : {}),
      }, '*');
    });
  }

  /** Setzt den Streamlit-Chat zurück (frischer Kontext): schickt `tf-reset`, das
   *  Bookmarklet klickt den „Neuer Chat"/„Zurücksetzen"-Button und antwortet mit
   *  `tf-reset-done {found}`. KEIN `window.open` (das würde das Bookmarklet
   *  löschen) — ohne lebendes Bridge-Fenster sofort `'timeout'`. Timeout 15 s
   *  (`ziel`-Routing braucht ggf. einen Tab-Wechsel + Eingabefeld-Wartezeit). */
  async resetChat(ziel?: BridgeZiel): Promise<ResetErgebnis> {
    if (!this.streamlitWindow || this.streamlitWindow.closed) return 'timeout';
    const id = `reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise<ResetErgebnis>((resolve) => {
      const timeout = setTimeout(() => { this.pending.delete(id); resolve('timeout'); }, 15000);
      this.pending.set(id, {
        resolve: (v: string) => resolve(v === 'gefunden' ? 'ok' : 'nicht-gefunden'),
        reject: () => resolve('nicht-gefunden'),
        cancel: () => clearTimeout(timeout),
      });
      this.streamlitWindow?.postMessage({ type: 'tf-reset', id, ...(ziel ? { ziel } : {}) }, '*');
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
      // Aktivitätsbasierter Safety-Cap (v2.203) über den Bookmarklet-Deadlines
      // (NO_PROGRESS 150 s / hard 600 s) — Idle-Expiry greift nur, wenn das
      // Bookmarklet gar nicht (mehr) antwortet (Tab zu): liefert den Partial.
      const deadline = createActivityDeadline({
        idleMs: RESPONSE_IDLE_TIMEOUT_MS,
        hardMs: RESPONSE_HARD_TIMEOUT_MS,
        onExpire: () => {
          const s = this.streams.get(id);
          if (!s) return;
          s.cleanup();
          this.streams.delete(id);
          resolve({ content: s.prev, aborted: false });
        },
      });

      const onAbort = (): void => {
        const s = this.streams.get(id);
        if (!s) return;
        s.cleanup();
        this.streams.delete(id);
        resolve({ content: s.prev, aborted: true }); // kein throw (mirror DirectLLM)
      };
      const cleanup = (): void => {
        deadline.cancel();
        options?.signal?.removeEventListener('abort', onAbort);
      };

      this.streams.set(id, {
        prev: '',
        onDelta: callbacks.onDelta,
        ...(callbacks.onReasoningDelta ? { onReasoningDelta: callbacks.onReasoningDelta } : {}),
        resolve,
        cleanup,
        touch: deadline.touch,
      });
      options?.signal?.addEventListener('abort', onAbort, { once: true });
      this.streamlitWindow?.postMessage({ type: 'tf-request', id, message }, '*');
    });
  }
}
