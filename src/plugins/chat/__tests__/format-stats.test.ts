import { describe, expect, it } from 'vitest';
import { formatStats, statsSourceLabel } from '../format-stats';

describe('formatStats', () => {
  it('volle llama.cpp-Stats: tok/s, Tokens, Prompt mit Zeit', () => {
    const s = formatStats({
      tokensPerSecond: 42.3, completionTokens: 256,
      promptTokens: 1024, promptMs: 800, generationMs: 6400,
      source: 'llamacpp-timings',
    });
    expect(s).toBe('42,3 tok/s · 256 Tokens · Prompt: 1.024 Tokens (0,8 s)');
  });

  it('usage ohne promptMs: Prompt ohne Zeit-Klammer', () => {
    const s = formatStats({
      tokensPerSecond: 20, completionTokens: 200, promptTokens: 1024,
      generationMs: 10000, source: 'usage-wallclock',
    });
    expect(s).toBe('20 tok/s · 200 Tokens · Prompt: 1.024 Tokens');
  });

  it('nur Wall-Clock: Dauer in Sekunden', () => {
    expect(formatStats({ generationMs: 4230, source: 'wallclock' })).toBe('4,2 s');
  });

  it('keine verwertbaren Felder → leerer String', () => {
    expect(formatStats({ source: 'wallclock' })).toBe('');
  });
});

describe('statsSourceLabel', () => {
  it('benennt die Quelle für den Tooltip', () => {
    expect(statsSourceLabel('llamacpp-timings')).toContain('llama.cpp');
    expect(statsSourceLabel('usage-wallclock')).toContain('Wall-Clock');
    expect(statsSourceLabel('wallclock')).toContain('Wall-Clock');
  });
});
