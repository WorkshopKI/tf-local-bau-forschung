import { describe, it, expect, beforeEach, vi } from 'vitest';

// Tests laufen in Node (vitest.config.mts: environment 'node') → kein localStorage.
// Minimaler In-Memory-Stub, damit get/setLlmContextTokens testbar sind.
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => { mem.clear(); },
});

import {
  getLlmContextTokens,
  setLlmContextTokens,
  computeVbCharCap,
  getVbCharCap,
  DEFAULT_LLM_CONTEXT_TOKENS,
  MIN_LLM_CONTEXT_TOKENS,
  MAX_LLM_CONTEXT_TOKENS,
} from '../llm-context';

const KEY = 'teamflow_llm_context_tokens';

describe('computeVbCharCap', () => {
  it('leitet aus dem Kontextfenster (Tokens) den Zeichen-Cap ab (Reserve + Quote)', () => {
    // (70000 − 4096) × 3 = 197.712
    expect(computeVbCharCap(70_000)).toBe(197_712);
    // (32768 − 4096) × 3 = 86.016
    expect(computeVbCharCap(32_768)).toBe(86_016);
  });

  it('greift bei winziger Kontextgröße auf die Untergrenze zurück', () => {
    expect(computeVbCharCap(2_048)).toBe(4_000); // (2048−4096)×3 < 0 → Floor 4000
  });

  it('wächst monoton mit der Kontextgröße', () => {
    expect(computeVbCharCap(60_000)).toBeLessThan(computeVbCharCap(70_000));
  });
});

describe('getLlmContextTokens / setLlmContextTokens', () => {
  beforeEach(() => {
    mem.clear();
  });

  it('Default, wenn ungesetzt', () => {
    expect(getLlmContextTokens()).toBe(DEFAULT_LLM_CONTEXT_TOKENS);
  });

  it('liest einen gesetzten Wert zurück', () => {
    setLlmContextTokens(70_000);
    expect(getLlmContextTokens()).toBe(70_000);
    expect(mem.get(KEY)).toBe('70000');
  });

  it('clamped auf MIN/MAX', () => {
    setLlmContextTokens(MAX_LLM_CONTEXT_TOKENS + 5_000);
    expect(getLlmContextTokens()).toBe(MAX_LLM_CONTEXT_TOKENS);
    setLlmContextTokens(100);
    expect(getLlmContextTokens()).toBe(MIN_LLM_CONTEXT_TOKENS);
  });

  it('fällt bei kaputtem Wert auf den Default zurück', () => {
    mem.set(KEY, 'keine-zahl');
    expect(getLlmContextTokens()).toBe(DEFAULT_LLM_CONTEXT_TOKENS);
  });

  it('getVbCharCap nutzt die gespeicherte Einstellung', () => {
    setLlmContextTokens(70_000);
    expect(getVbCharCap()).toBe(computeVbCharCap(70_000));
  });
});
