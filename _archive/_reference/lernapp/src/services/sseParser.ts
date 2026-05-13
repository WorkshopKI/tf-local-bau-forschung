/**
 * Shared SSE (Server-Sent Events) stream parser.
 * Used by llmService (streaming) and completionService (collecting).
 */

export interface SSECallbacks {
  onDelta?: (text: string) => void;
  onThinking?: (text: string) => void;
  onDone?: () => void;
}

/**
 * Parse an SSE stream from an LLM response body.
 * Calls onDelta for content chunks and onThinking for reasoning chunks.
 * Returns the full collected content string.
 */
export async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  callbacks: SSECallbacks = {},
  signal?: AbortSignal,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") {
          callbacks.onDone?.();
          return result;
        }
        try {
          const parsed = JSON.parse(json);
          const delta = parsed.choices?.[0]?.delta;
          const message = parsed.choices?.[0]?.message;

          // Streaming delta
          if (delta) {
            if (delta.content) {
              result += delta.content;
              callbacks.onDelta?.(delta.content);
            }
            const thinking = delta.reasoning_content || delta.reasoning;
            if (thinking) callbacks.onThinking?.(thinking);
          }
          // Non-streaming message (some proxies return full message in SSE)
          else if (message?.content) {
            result += message.content;
            callbacks.onDelta?.(message.content);
          }
        } catch {
          // Could be incomplete JSON — push back and wait for more data
          buf = line + "\n" + buf;
          break;
        }
      }
    }
  } catch (e) {
    if (signal?.aborted) {
      callbacks.onDone?.();
      return result;
    }
    throw e;
  }

  callbacks.onDone?.();
  return result;
}
