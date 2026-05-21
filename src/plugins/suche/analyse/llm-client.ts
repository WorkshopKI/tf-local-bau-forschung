/**
 * Wrapper um `AITransport` der die Differenzen zwischen Streamlit (nur
 * `submitMessage(string)`) und DirectLLM (`submitConversation(messages)`)
 * verbirgt. Plus Timeout + AbortSignal-Komposition + Fehler-Klassen.
 *
 * Bewusst KEIN React-Code — Pipeline-Stufen rufen das aus Plain-Funktionen.
 */
import type {
  AITransport,
  ConversationMessage,
} from '@/core/services/ai/transports/streamlit';

export class LLMAbortError extends Error {
  constructor() { super('LLM-Aufruf abgebrochen'); this.name = 'LLMAbortError'; }
}
export class LLMTimeoutError extends Error {
  constructor(ms: number) { super(`LLM-Timeout nach ${ms}ms`); this.name = 'LLMTimeoutError'; }
}
export class LLMNetworkError extends Error {
  constructor(cause: unknown) {
    super(`LLM-Netzwerkfehler: ${(cause as Error)?.message ?? String(cause)}`);
    this.name = 'LLMNetworkError';
  }
}

export interface CallLLMOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxTokens?: number;
  thinkingBudget?: 'none' | 'low' | 'medium' | 'high';
  /** Wenn `true` und Transport ist DirectLLM-kompatibel: setzt
   *  `response_format: { type: 'json_object' }`. Streamlit ignoriert das. */
  jsonMode?: boolean;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_TOKENS = 4_000;

/** Kombiniert User-`signal` + Timeout in einen neuen AbortController.
 *  Returnt `{ signal, cleanup, didTimeout }`. */
function makeCombinedSignal(userSignal: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
  didTimeoutRef: { value: boolean };
} {
  const ctrl = new AbortController();
  const didTimeoutRef = { value: false };
  const onUserAbort = (): void => ctrl.abort();
  userSignal?.addEventListener('abort', onUserAbort, { once: true });
  if (userSignal?.aborted) ctrl.abort();
  const timer = setTimeout(() => { didTimeoutRef.value = true; ctrl.abort(); }, timeoutMs);
  const cleanup = (): void => {
    clearTimeout(timer);
    userSignal?.removeEventListener('abort', onUserAbort);
  };
  return { signal: ctrl.signal, cleanup, didTimeoutRef };
}

/**
 * Ruft das LLM mit System- + User-Prompt. Wenn `transport.submitConversation`
 * vorhanden ist, nutzt es Multi-Turn — sonst kombiniert es beide in eine
 * Single-Message (fuer Streamlit).
 */
export async function callLLM(
  transport: AITransport,
  systemPrompt: string,
  userPrompt: string,
  opts?: CallLLMOptions,
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { signal, cleanup, didTimeoutRef } = makeCombinedSignal(opts?.signal, timeoutMs);

  try {
    const responseFormat = opts?.jsonMode ? { type: 'json_object' } : undefined;
    let raw: string;
    if (typeof transport.submitConversation === 'function') {
      const messages: ConversationMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];
      raw = await transport.submitConversation(messages, {
        signal,
        maxTokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
        thinkingBudget: opts?.thinkingBudget,
        responseFormat,
      });
    } else {
      // Streamlit-Pfad: System + User in eine kombinierte Message.
      const combined = `${systemPrompt}\n\n---\n\nAUFGABE:\n${userPrompt}`;
      raw = await transport.submitMessage(combined, undefined, {
        signal,
        thinkingBudget: opts?.thinkingBudget,
        responseFormat,
      });
    }
    return raw;
  } catch (err) {
    if (didTimeoutRef.value) throw new LLMTimeoutError(timeoutMs);
    if ((err as Error)?.name === 'AbortError') throw new LLMAbortError();
    if (opts?.signal?.aborted) throw new LLMAbortError();
    throw new LLMNetworkError(err);
  } finally {
    cleanup();
  }
}
