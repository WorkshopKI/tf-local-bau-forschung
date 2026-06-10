import { describe, expect, it } from 'vitest';
import { computeStats } from '../generation-stats';

describe('computeStats', () => {
  it('priorisiert llama.cpp-timings (inkl. fertigem tok/s)', () => {
    const stats = computeStats({
      timings: {
        prompt_n: 1024,
        prompt_ms: 800,
        predicted_n: 256,
        predicted_ms: 6400,
        predicted_per_second: 40,
      },
      usage: { prompt_tokens: 999, completion_tokens: 999 },
      tStart: 0,
      tFirstToken: 500,
      tEnd: 9000,
    });
    expect(stats).toEqual({
      promptTokens: 1024,
      promptMs: 800,
      completionTokens: 256,
      generationMs: 6400,
      tokensPerSecond: 40,
      source: 'llamacpp-timings',
    });
  });

  it('berechnet tok/s aus predicted_n/predicted_ms, wenn predicted_per_second fehlt', () => {
    const stats = computeStats({
      timings: { predicted_n: 100, predicted_ms: 2000 },
      tStart: 0,
      tFirstToken: null,
      tEnd: 3000,
    });
    expect(stats.tokensPerSecond).toBe(50);
    expect(stats.source).toBe('llamacpp-timings');
  });

  it('usage + Wall-Clock: promptMs = First-Token-Latenz, tok/s über Stream-Dauer', () => {
    const stats = computeStats({
      usage: { prompt_tokens: 1024, completion_tokens: 200 },
      tStart: 0,
      tFirstToken: 800,
      tEnd: 10800,
    });
    expect(stats).toEqual({
      promptTokens: 1024,
      completionTokens: 200,
      promptMs: 800,
      generationMs: 10000,
      tokensPerSecond: 20,
      source: 'usage-wallclock',
    });
  });

  it('usage ohne First-Token-Zeitpunkt: tok/s über Gesamtfenster, kein promptMs', () => {
    const stats = computeStats({
      usage: { completion_tokens: 50 },
      tStart: 0,
      tFirstToken: null,
      tEnd: 5000,
    });
    expect(stats.promptMs).toBeUndefined();
    expect(stats.generationMs).toBe(5000);
    expect(stats.tokensPerSecond).toBe(10);
    expect(stats.source).toBe('usage-wallclock');
  });

  it('nur Wall-Clock: keine Token-Schätzung', () => {
    const stats = computeStats({ tStart: 100, tFirstToken: null, tEnd: 4100 });
    expect(stats).toEqual({ generationMs: 4000, source: 'wallclock' });
  });

  it('keine Division durch 0 bei generationMs=0', () => {
    const stats = computeStats({
      usage: { completion_tokens: 5 },
      tStart: 0,
      tFirstToken: 0,
      tEnd: 0,
    });
    expect(stats.tokensPerSecond).toBeUndefined();
  });
});
