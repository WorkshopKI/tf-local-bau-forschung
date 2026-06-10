import type { GenerationStats } from '@/core/services/ai/generation-stats';

const num = (n: number): string => n.toLocaleString('de-DE');
const secs = (ms: number): string =>
  `${(ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`;

/** Kompakte Stats-Zeile unter der Antwort, z.B. `42,3 tok/s · 256 Tokens · Prompt: 1.024 Tokens (0,8 s)`. */
export function formatStats(stats: GenerationStats): string {
  const parts: string[] = [];
  if (stats.tokensPerSecond != null) parts.push(`${num(stats.tokensPerSecond)} tok/s`);
  if (stats.completionTokens != null) parts.push(`${num(stats.completionTokens)} Tokens`);
  if (stats.promptTokens != null) {
    const zeit = stats.promptMs != null ? ` (${secs(stats.promptMs)})` : '';
    parts.push(`Prompt: ${num(stats.promptTokens)} Tokens${zeit}`);
  }
  if (parts.length === 0 && stats.generationMs != null && stats.generationMs > 0) {
    parts.push(secs(stats.generationMs));
  }
  return parts.join(' · ');
}

export function statsSourceLabel(source: GenerationStats['source']): string {
  switch (source) {
    case 'llamacpp-timings': return 'Quelle: llama.cpp-Timings (serverseitig gemessen)';
    case 'usage-wallclock': return 'Quelle: API-usage + Wall-Clock (First-Token-Latenz)';
    case 'wallclock': return 'Quelle: Wall-Clock (keine Token-Zahlen verfügbar)';
  }
}
