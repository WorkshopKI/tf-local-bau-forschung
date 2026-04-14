import type { Msg } from "@/types";
import { hasApiKey, getApiKey, getEndpoint } from "./apiKeyService";
import { proxyFetch } from "./proxyFetch";
import { parseSSEStream } from "./sseParser";
import { DEFAULT_MODEL } from "@/lib/constants";

export async function streamChat({
  messages,
  model,
  reasoning,
  signal,
  onDelta,
  onThinking,
  onDone,
  onError,
}: {
  messages: Msg[];
  model?: string;
  reasoning?: { effort: string };
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  onThinking?: (text: string) => void;
  onDone: () => void;
  onError: (error: string, status?: number) => void;
}) {
  let resp: Response;
  try {
    if (hasApiKey()) {
      // ═══ DIRECT MODE: Client → OpenRouter/Provider ═══
      const body: Record<string, unknown> = {
        model: model || DEFAULT_MODEL,
        messages,
        stream: true,
      };
      if (reasoning) body.reasoning = reasoning;

      resp = await fetch(getEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "KI-Werkstatt",
        },
        body: JSON.stringify(body),
        signal,
      });
    } else {
      // ═══ PROXY MODE: Client → Edge Function → OpenRouter ═══
      try {
        const body: Record<string, unknown> = { messages, model: model || DEFAULT_MODEL };
        if (reasoning) body.reasoning = reasoning;
        resp = await proxyFetch(body, signal);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_AUTHENTICATED") {
          onError("Bitte melde dich an oder hinterlege einen API-Key in den Einstellungen.");
          return;
        }
        onError(e instanceof Error ? e.message : "Supabase nicht verfügbar. Bitte API-Key in den Einstellungen hinterlegen.");
        return;
      }
    }
  } catch (e) {
    if (signal?.aborted) {
      onDone();
      return;
    }
    onError(e instanceof Error ? e.message : "Netzwerkfehler");
    return;
  }

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({ error: "Unbekannter Fehler" }));
    const errMsg =
      errBody.error?.message || errBody.error || errBody.message || "LLM-Fehler";
    onError(errMsg, resp.status);
    return;
  }

  if (!resp.body) {
    onError("Keine Antwort vom Server");
    return;
  }

  // ═══ SSE Parsing via shared parser ═══
  try {
    await parseSSEStream(resp.body, { onDelta, onThinking, onDone }, signal);
  } catch (e) {
    if (signal?.aborted) {
      onDone();
      return;
    }
    onError(e instanceof Error ? e.message : "Stream-Fehler");
    return;
  }
  // onDone is called by parseSSEStream
}

// ═══ Save User Key (nur Workshop-Modus) ═══
export async function saveUserKey(
  apiKey: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke("save-user-key", {
      body: { apiKey },
    });
    if (error) {
      return { error: error.message || "Verbindungsfehler" };
    }
    return data ?? { success: true };
  } catch {
    return { error: "Supabase nicht verfügbar" };
  }
}
