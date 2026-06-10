/**
 * Generierungs-Statistik (Token/s, Prompt-Processing) aus Streaming-Responses.
 *
 * Drei Quellen, absteigende Genauigkeit:
 * 1. llama.cpp `timings` (Final-Chunk) — serverseitig gemessen, exakt
 * 2. OpenAI/OpenRouter `usage` + clientseitige Wall-Clock (First-Token-Latenz ≈ Prompt-Processing)
 * 3. nur Wall-Clock — keine Token-Zahlen, bewusst KEINE Schätzung
 */

export interface LlamaCppTimings {
  prompt_n?: number;
  prompt_ms?: number;
  predicted_n?: number;
  predicted_ms?: number;
  predicted_per_second?: number;
}

export interface OpenAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

export interface GenerationStats {
  promptTokens?: number;
  completionTokens?: number;
  /** Prompt-Verarbeitung in ms (llama.cpp: prompt_ms; sonst First-Token-Latenz). */
  promptMs?: number;
  /** Reine Generierungsdauer in ms. */
  generationMs?: number;
  tokensPerSecond?: number;
  source: 'llamacpp-timings' | 'usage-wallclock' | 'wallclock';
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

export function computeStats(input: {
  timings?: LlamaCppTimings;
  usage?: OpenAIUsage;
  /** performance.now() beim Request-Start. */
  tStart: number;
  /** performance.now() beim ersten Content-/Reasoning-Delta, null wenn keins kam. */
  tFirstToken: number | null;
  /** performance.now() am Stream-Ende. */
  tEnd: number;
}): GenerationStats {
  const { timings, usage, tStart, tFirstToken, tEnd } = input;

  if (timings && (timings.predicted_n != null || timings.prompt_n != null)) {
    const stats: GenerationStats = { source: 'llamacpp-timings' };
    if (timings.prompt_n != null) stats.promptTokens = timings.prompt_n;
    if (timings.prompt_ms != null) stats.promptMs = timings.prompt_ms;
    if (timings.predicted_n != null) stats.completionTokens = timings.predicted_n;
    if (timings.predicted_ms != null) stats.generationMs = timings.predicted_ms;
    if (timings.predicted_per_second != null) {
      stats.tokensPerSecond = round1(timings.predicted_per_second);
    } else if (timings.predicted_n != null && timings.predicted_ms) {
      stats.tokensPerSecond = round1(timings.predicted_n / (timings.predicted_ms / 1000));
    }
    return stats;
  }

  if (usage && (usage.completion_tokens != null || usage.prompt_tokens != null)) {
    const stats: GenerationStats = { source: 'usage-wallclock' };
    if (usage.prompt_tokens != null) stats.promptTokens = usage.prompt_tokens;
    if (usage.completion_tokens != null) stats.completionTokens = usage.completion_tokens;
    if (tFirstToken != null) stats.promptMs = tFirstToken - tStart;
    const generationMs = tEnd - (tFirstToken ?? tStart);
    stats.generationMs = generationMs;
    if (usage.completion_tokens != null && generationMs > 0) {
      stats.tokensPerSecond = round1(usage.completion_tokens / (generationMs / 1000));
    }
    return stats;
  }

  return { generationMs: tEnd - tStart, source: 'wallclock' };
}
