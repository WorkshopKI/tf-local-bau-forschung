/**
 * Trennt Reasoning-/Thinking-Anteile von der sichtbaren Antwort.
 *
 * Fallback für Modelle, die ihr Reasoning NICHT über `delta.reasoning_content`
 * (llama.cpp --reasoning-format) bzw. `delta.reasoning` (OpenRouter) liefern,
 * sondern inline als `<think>…</think>` in den Content streamen (z.B. Qwen).
 *
 * - createThinkTagSplitter: Streaming-Variante (State-Machine mit Hold-back-Buffer
 *   für Tags, die über Delta-Grenzen verteilt ankommen)
 * - extractThinking: Single-Shot-Variante für den Non-Streaming-Pfad
 *   (verallgemeinert stripThinking aus search/browser-llm.ts, ohne Wegwerfen)
 */

const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

/** Länge des längsten Suffix von `text`, der ein echter Präfix von `tag` ist. */
function heldSuffixLength(text: string, tag: string): number {
  const max = Math.min(text.length, tag.length - 1);
  for (let len = max; len > 0; len--) {
    if (text.endsWith(tag.slice(0, len))) return len;
  }
  return 0;
}

export interface ThinkTagSplitter {
  /** Content-Delta anfüttern; emittiert via Callbacks. */
  pushContent(s: string): void;
  /** Stream-Ende: zurückgehaltenen Rest emittieren (im Think-Modus als Thinking). */
  flush(): void;
}

export function createThinkTagSplitter(
  onContent: (s: string) => void,
  onThinking: (s: string) => void,
): ThinkTagSplitter {
  let mode: 'normal' | 'inThink' = 'normal';
  let pending = '';

  const emit = (s: string): void => {
    if (s === '') return;
    if (mode === 'inThink') onThinking(s);
    else onContent(s);
  };

  return {
    pushContent(s: string): void {
      pending += s;
      for (;;) {
        const tag = mode === 'normal' ? OPEN_TAG : CLOSE_TAG;
        const idx = pending.indexOf(tag);
        if (idx === -1) break;
        emit(pending.slice(0, idx));
        pending = pending.slice(idx + tag.length);
        mode = mode === 'normal' ? 'inThink' : 'normal';
      }
      // Möglichen Tag-Anfang am Ende zurückhalten, bis das nächste Delta ihn auflöst
      const tag = mode === 'normal' ? OPEN_TAG : CLOSE_TAG;
      const held = heldSuffixLength(pending, tag);
      if (pending.length > held) {
        emit(pending.slice(0, pending.length - held));
        pending = pending.slice(pending.length - held);
      }
    },
    flush(): void {
      emit(pending);
      pending = '';
    },
  };
}

/** Non-Streaming-Fallback: ersten <think>-Block abtrennen. */
export function extractThinking(text: string): { content: string; thinking?: string } {
  const open = text.indexOf(OPEN_TAG);
  if (open === -1) return { content: text };
  const before = text.slice(0, open);
  const rest = text.slice(open + OPEN_TAG.length);
  const close = rest.indexOf(CLOSE_TAG);
  if (close === -1) {
    // Unterminiert (z.B. Abbruch mitten im Reasoning): alles dahinter ist Thinking
    return { content: before.trim(), thinking: rest.trim() };
  }
  const thinking = rest.slice(0, close).trim();
  const content = (before + rest.slice(close + CLOSE_TAG.length)).trim();
  return thinking ? { content, thinking } : { content };
}
