/**
 * Vordergrund-Lease-Wrapper um einen Transport (Bridge-Mutex, Assistent Phase 2).
 *
 * Skill-Läufe und Panel-Turns holen ihren Transport über die gegateten Bridge-
 * Getter; DIESER Wrapper zählt ihre aktive Bridge-Nutzung (in-flight I/O), OHNE
 * die Skill-Runner-State-Machine (`runSkillInner`/`fuehreAssistentTurnAus`)
 * anzufassen. Die Gedächtnis-Konsolidierung darf nur laufen, wenn der Zähler 0
 * ist, und bricht ab, sobald er (ein startender Skill/Panel-Turn) wieder steigt —
 * Vordergrund hat immer Vorrang.
 *
 * `ping` zählt NICHT (reiner Verfügbarkeits-Check, kein Bridge-Belegt). Optionale
 * Transport-Methoden werden nur gewrappt, wenn sie existieren (Feature-Detection
 * der Aufrufer bleibt intakt).
 */
import type { KiRolle } from './modell-katalog';
import type {
  AITransport,
  ConversationMessage,
  ConversationOptions,
  PingOptions,
  StreamCallbacks,
  SubmitMessageOptions,
} from './transports/streamlit';

/** Ergebnis eines Konsolidierungs-Lease (siehe AIBridge.getTransportForKonsolidierung). */
export interface TransportLease {
  /** Roher (ungewrappter) aktiver Transport — zählt selbst NICHT als Vordergrund. */
  transport: AITransport;
  /** Feuert, sobald ein Vordergrund-Consumer (Skill/Panel) die Bridge belegt. */
  signal: AbortSignal;
  /** Gibt den Lease frei (im finally des Konsolidierungslaufs aufzurufen). */
  freigeben: () => void;
}

export interface VordergrundHooks {
  /** Beginn einer Bridge-I/O-Operation (Zähler++). */
  betreten: () => void;
  /** Ende einer Bridge-I/O-Operation (Zähler--). */
  verlassen: () => void;
}

/** Wrappt eine Transport-Methode so, dass der Zähler um ihren await-Zyklus lebt. */
function mitLease<T>(hooks: VordergrundHooks, fn: () => Promise<T>): Promise<T> {
  hooks.betreten();
  return fn().finally(hooks.verlassen);
}

/**
 * Gibt einen Transport-Delegat zurück, der bei jeder Bridge-I/O-Methode
 * (`submitMessage`/`submitConversation`/`streamConversation`/`resetChat`) den
 * Vordergrund-Zähler hebt/senkt. `ping` und Metadaten passieren unverändert.
 */
export function wickleVordergrundLease(transport: AITransport, hooks: VordergrundHooks): AITransport {
  const wrapped: AITransport = {
    name: transport.name,
    displayName: transport.displayName,
    ping: (opts?: PingOptions) => transport.ping(opts),
    submitMessage: (message: string, systemPrompt?: string, options?: SubmitMessageOptions) =>
      mitLease(hooks, () => transport.submitMessage(message, systemPrompt, options)),
  };
  if (transport.resetChat) {
    const reset = transport.resetChat.bind(transport);
    wrapped.resetChat = (ziel?: KiRolle) => mitLease(hooks, () => reset(ziel));
  }
  if (transport.submitConversation) {
    const conv = transport.submitConversation.bind(transport);
    wrapped.submitConversation = (messages: ConversationMessage[], options?: ConversationOptions) =>
      mitLease(hooks, () => conv(messages, options));
  }
  if (transport.streamConversation) {
    const stream = transport.streamConversation.bind(transport);
    wrapped.streamConversation = (
      messages: ConversationMessage[],
      callbacks: StreamCallbacks,
      options?: ConversationOptions,
    ) => mitLease(hooks, () => stream(messages, callbacks, options));
  }
  return wrapped;
}

/**
 * Bridge-Mutex: ein Vordergrund-Ref-Zähler (Skill-Läufe + Panel-Turns) plus der
 * Abort-Controller des laufenden Konsolidierungs-Lease. Als eigene Klasse, damit
 * die Mutex-Logik unabhängig von der AIBridge (und deren realen Transporten)
 * testbar ist. AIBridge hält eine Instanz und delegiert.
 */
export class BridgeMutex {
  private vordergrundAktiv = 0;
  private konsolidierungAbort: AbortController | null = null;

  /** Wrappt einen Transport als Vordergrund-Consumer (zählt seine Bridge-I/O). */
  wrapVordergrund(transport: AITransport): AITransport {
    return wickleVordergrundLease(transport, {
      betreten: () => this.betrete(),
      verlassen: () => this.verlasse(),
    });
  }

  private betrete(): void {
    this.vordergrundAktiv++;
    // Startender Skill/Panel-Turn hat Vorrang → laufende Konsolidierung abbrechen.
    if (this.konsolidierungAbort) {
      this.konsolidierungAbort.abort();
      this.konsolidierungAbort = null;
    }
  }

  private verlasse(): void {
    if (this.vordergrundAktiv > 0) this.vordergrundAktiv--;
  }

  /**
   * Liefert einen Konsolidierungs-Lease — NUR wenn kein Vordergrund-I/O aktiv ist
   * und nicht bereits ein Lease läuft; sonst `null`. Der Transport kommt roh vom
   * Aufrufer (zählt NICHT als Vordergrund). Das `signal` feuert, sobald ein
   * Vordergrund-Consumer die Bridge belegt. `holeTransport` wird nur bei
   * erfolgreichem Lease aufgerufen.
   */
  versucheKonsolidierungsLease(holeTransport: () => AITransport): TransportLease | null {
    if (this.vordergrundAktiv > 0) return null;
    if (this.konsolidierungAbort) return null;
    const controller = new AbortController();
    this.konsolidierungAbort = controller;
    const freigeben = (): void => {
      if (this.konsolidierungAbort === controller) this.konsolidierungAbort = null;
    };
    return { transport: holeTransport(), signal: controller.signal, freigeben };
  }

  /** Test-Hilfe: ist gerade Vordergrund-I/O aktiv? */
  get vordergrundLaeuft(): boolean {
    return this.vordergrundAktiv > 0;
  }
}
