import { createActivityDeadline } from './deadline';
import type { GenerationStats } from '../generation-stats';
import { useBridgeStatus } from '../bridge-status';
import { useModellEskalation } from '../modell-eskalation';
import { waehleModellFuerLauf } from '../modell-wahl';
import { useBridgeModelle, leseKontextTokens, aufloesungFuer } from '../bridge-modelle';
import type { AngebotenesModell, KiRolle } from '../modell-katalog';

/**
 * Die Modell-Auswahlliste aus einer Bookmarklet-Nachricht übernehmen.
 *
 * Modul-lokal statt Methode: das ist eine reine Übersetzung fremder Daten in
 * unseren Store, ohne Bezug zum Transport-Zustand. Fremde Daten heisst hier
 * wörtlich — das Feld kommt aus einer Seite, die wir nicht kontrollieren, also
 * wird jeder Eintrag einzeln geprüft statt der Form vertraut.
 */
function uebernimmModellliste(data: Record<string, unknown>): void {
  if (!Array.isArray(data.modelle)) return;
  const liste: AngebotenesModell[] = [];
  for (const roh of data.modelle) {
    if (!roh || typeof roh !== 'object') continue;
    const m = roh as Record<string, unknown>;
    if (typeof m.text !== 'string' || !m.text.trim()) continue;
    liste.push({
      text: m.text,
      ...(typeof m.value === 'string' ? { value: m.value } : {}),
      ...(m.aktiv === true ? { aktiv: true } : {}),
    });
  }
  if (liste.length) useBridgeModelle.getState().meldeListe(liste);
}


// `KiRolle` wohnt im Katalog ([modell-katalog.ts](../modell-katalog.ts)) und wird
// hier nur benutzt. Bis v5 stand die Achse in DIESER Datei — ein Rollen-Begriff im
// Transport, obwohl sie über Transporte hinweg gilt. Sie hier ein zweites Mal zu
// deklarieren fiele nicht einmal auf: zwei strukturgleiche String-Unions nimmt der
// Compiler klaglos hin, und die Doppelquelle drifted erst beim dritten Wert.

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
  /** Nur Streamlit-Bridge: Ziel-Chat (Tab) in der KI-Oberfläche. DirectLLM
   *  ignoriert die Option.
   *
   *  Seit v2.274 auch hier (vorher nur in `SubmitMessageOptions`): das Feld war
   *  ausgespart, solange die agentische Variante eine Erprobung war. Inzwischen
   *  ist sie eine globale Nutzer-Einstellung (`useKiZiel`) und in allen
   *  Skill-Runnern verdrahtet — dass ausgerechnet der Chat sie ignorierte, war
   *  kein Schutz mehr, sondern ein toter Schalter. */
  ziel?: KiRolle;
  /**
   * Sampling-Temperatur. Nur API-Transports (DirectLLM/OpenRouter) — die
   * Streamlit-Bridge tippt in ein Chat-Feld und hat keine Stellschraube.
   * Fehlt der Wert, sendet der Transport das Feld nicht und es gilt die
   * Server-Voreinstellung. Werte: [sampling.ts](../sampling.ts).
   */
  temperatur?: number;
}

export interface SubmitMessageOptions {
  thinkingBudget?: 'none' | 'low' | 'medium' | 'high';
  responseFormat?: Record<string, unknown>;
  /** Siehe `ConversationOptions.signal`. */
  signal?: AbortSignal;
  /** Nur Streamlit-Bridge: Ziel-Chat (Tab) in der KI-Oberfläche. DirectLLM
   *  ignoriert die Option. Siehe `ConversationOptions.ziel` — seit v2.274 tragen
   *  beide Options-Typen das Feld. */
  ziel?: KiRolle;
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
  /** Optional (nur Streamlit-Bridge): true, wenn aktuell ein KI-Tab offen ist. Synchron —
   *  taugt für Preflight-Guards vor KI-CTAs (ohne `window.open`-Seiteneffekt). */
  hasLiveBridgeWindow?(): boolean;
  submitMessage(message: string, systemPrompt?: string, options?: SubmitMessageOptions): Promise<string>;
  /** Optional: setzt den Chat-Verlauf des Transports zurück (frischer Kontext).
   *  Nur die Streamlit-Bridge implementiert das (klickt den „Neuer Chat"-Button
   *  via Bookmarklet); stateless-API-Transports (DirectLLM) brauchen es nicht.
   *  Best-effort — `'ok'`, wenn ein Reset-Button gefunden+geklickt wurde,
   *  `'nicht-gefunden'` (kein Button) bzw. `'timeout'` (kein Fenster / keine
   *  Antwort in 15 s) sonst; der Lauf startet in jedem Fall.
   *  `ziel` (nur Streamlit): Reset im benannten Tab (Zweit-LLM-Erprobung). */
  resetChat?(ziel?: KiRolle): Promise<ResetErgebnis>;
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

      // Revision aus den beiden Handschlag-Nachrichten festhalten. Nur aus
      // diesen: sie sind die einzigen, die das Bookmarklet unaufgefordert über
      // sich selbst aussagt — bei tf-response wäre sie Beiwerk und würde bei
      // jeder Antwort erneut geschrieben. Fehlt das Feld, ist der leere String
      // die richtige Aussage („hat sich gemeldet, nennt keine Revision"), nicht
      // `null` („nie gehört").
      if (type === 'tf-pong' || type === 'tf-bridge-ready') {
        useBridgeStatus.getState().markRev(typeof data.rev === 'string' ? data.rev : '');
      }

      // Die von der KI-Seite angebotene Modell-Auswahl übernehmen — sie fährt auf
      // JEDER Nachricht mit, die das Bookmarklet unaufgefordert schickt. Dadurch
      // erfährt die App von einer geänderten Liste schon beim Ping und nicht erst,
      // wenn ein Auftrag daran scheitert (Drift-Anzeige in Einstellungen → KI).
      uebernimmModellliste(data);

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
        // Das Bookmarklet meldet, was die KI-Seite als Chatlänge ANZEIGT
        // („… von 62k") — die einzige ehrliche Quelle für das Fenster. Der Katalog
        // ist nur der Rückfall und ist in der Vergangenheit still gedriftet.
        //
        // Gelernt wird unter dem MODELLNAMEN, nicht unter einer Rolle: nur so
        // bekommt auch ein Modell, das dieser Build gar nicht kennt, sein richtiges
        // Fenster — und kann danach die Rolle `stark` tragen, ohne dass jemand den
        // Katalog anfasst.
        if (typeof data.modell === 'string' && typeof data.kontextText === 'string') {
          const tokens = leseKontextTokens(data.kontextText);
          if (tokens > 0) useBridgeModelle.getState().lerneFenster(data.modell, tokens);
        }
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


  /**
   * Das Modell, mit dem diese Nutzlast tatsächlich fährt — Auto-Wechsel nach
   * Umfang ([modell-wahl.ts](../modell-wahl.ts)).
   *
   * **Hier, weil hier die GANZE Nutzlast steht.** Alles davor misst nur einen
   * Teil (die Vorhabensbeschreibung), und mehrere Pfade umgehen `runSkill`
   * ganz — Assistent-Turn, Chat, Aufbereitungs-Bausteine, Feedback,
   * Gedächtnis. Der Transport ist die einzige Stelle, an der keiner vorbeikommt.
   *
   * `runSkill` trifft dieselbe Entscheidung noch einmal, weil es sie FRÜHER
   * braucht (der Zeichen-Cap hängt am Modell). Der Doppelaufruf ist unschädlich:
   * die Funktion ist idempotent, ein bereits angehobenes Ziel wird nicht weiter
   * angehoben. Wer das hier als Dopplung wegräumt, nimmt den Nicht-Skill-Pfaden
   * den Auto-Wechsel.
   */
  private zielFuerNutzlast(message: string, gewuenscht?: KiRolle): KiRolle | undefined {
    // Ohne ausdrückliches Ziel wird die Modell-Auswahl der KI-Seite gar nicht
    // angefasst — dann gibt es auch nichts anzuheben.
    if (!gewuenscht) return undefined;
    const wahl = waehleModellFuerLauf(gewuenscht, message.length);
    if (wahl.eskaliert) {
      useModellEskalation.getState().melde(gewuenscht, wahl, Date.now());
    }
    return wahl.modell;
  }

  /**
   * Rolle → der Optionstext, den das Bookmarklet auswählen soll.
   *
   * `undefined` heisst „Auswahl nicht anfassen" und ist der ehrliche Zustand,
   * solange die Liste unbekannt ist: wir können keine Option benennen, die wir nie
   * gesehen haben. Sobald die Bridge sich einmal gemeldet hat, steht die Liste —
   * sie fährt auf jedem Ping mit.
   */
  private modellFuer(rolle?: KiRolle): string | undefined {
    if (!rolle) return undefined;
    const text = aufloesungFuer(rolle).text;
    return text || undefined;
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
      const modell = this.modellFuer(this.zielFuerNutzlast(message, options?.ziel));
      this.streamlitWindow?.postMessage({
        type: 'tf-request', id, message,
        ...(modell ? { modell } : {}),
        ...(options?.erwarteAbschluss ? { erwarte: options.erwarteAbschluss } : {}),
      }, '*');
    });
  }

  /** Setzt den Streamlit-Chat zurück (frischer Kontext): schickt `tf-reset`, das
   *  Bookmarklet klickt den „Neuer Chat"/„Zurücksetzen"-Button und antwortet mit
   *  `tf-reset-done {found}`. KEIN `window.open` (das würde das Bookmarklet
   *  löschen) — ohne lebendes Bridge-Fenster sofort `'timeout'`. Timeout 15 s
   *  (`ziel`-Routing braucht ggf. einen Tab-Wechsel + Eingabefeld-Wartezeit). */
  async resetChat(ziel?: KiRolle): Promise<ResetErgebnis> {
    if (!this.streamlitWindow || this.streamlitWindow.closed) return 'timeout';
    const id = `reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise<ResetErgebnis>((resolve) => {
      const timeout = setTimeout(() => { this.pending.delete(id); resolve('timeout'); }, 15000);
      this.pending.set(id, {
        resolve: (v: string) => resolve(v === 'gefunden' ? 'ok' : 'nicht-gefunden'),
        reject: () => resolve('nicht-gefunden'),
        cancel: () => clearTimeout(timeout),
      });
      const modell = this.modellFuer(ziel);
      this.streamlitWindow?.postMessage({ type: 'tf-reset', id, ...(modell ? { modell } : {}) }, '*');
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
      // `modell` nur senden, wenn auflösbar — ohne das Feld fasst das Bookmarklet
      // die Modell-Auswahl gar nicht an und der Lauf fährt auf dem, was die Seite
      // eingestellt hat. Das ist der richtige Zustand, solange wir die Liste nicht
      // kennen: einen Namen zu raten hiesse, ein Fenster anzunehmen, das wir nicht
      // gesehen haben.
      const modell = this.modellFuer(this.zielFuerNutzlast(message, options?.ziel));
      this.streamlitWindow?.postMessage(
        { type: 'tf-request', id, message, ...(modell ? { modell } : {}) },
        '*',
      );
    });
  }
}
