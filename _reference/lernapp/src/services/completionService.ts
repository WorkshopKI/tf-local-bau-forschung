/**
 * Non-Streaming LLM-Completion für strukturierte JSON-Antworten.
 * Unterstützt Proxy-Modus (Supabase, streamt SSE) und Direct-Modus (OpenRouter).
 */
import type { Msg } from "@/types";
import { hasApiKey, getApiKey, getEndpoint } from "./apiKeyService";
import { proxyFetch } from "./proxyFetch";
import { parseSSEStream } from "./sseParser";
import { DEFAULT_MODEL } from "@/lib/constants";

export async function complete({
  messages,
  model,
  temperature = 0.4,
}: {
  messages: Msg[];
  model?: string;
  temperature?: number;
}): Promise<string> {
  const selectedModel = model || DEFAULT_MODEL;
  let resp: Response;

  if (hasApiKey()) {
    // ═══ Direct-Modus: Non-Streaming JSON ═══
    resp = await fetch(getEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "KI-Werkstatt",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature,
        stream: false,
      }),
    });

    if (!resp.ok) {
      if (resp.status === 402) throw new Error("BUDGET_EXHAUSTED");
      if (resp.status === 429) throw new Error("RATE_LIMITED");
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || "LLM-Fehler");
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // ═══ Proxy-Modus: Streamt SSE, wir sammeln alles ═══
  resp = await proxyFetch({
    model: selectedModel,
    messages,
    temperature,
  });

  if (!resp.ok) {
    if (resp.status === 402) throw new Error("BUDGET_EXHAUSTED");
    if (resp.status === 429) throw new Error("RATE_LIMITED");
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || err.error || "LLM-Fehler");
  }

  // Proxy always returns SSE — collect via shared parser
  return parseSSEStream(resp.body!);
}
