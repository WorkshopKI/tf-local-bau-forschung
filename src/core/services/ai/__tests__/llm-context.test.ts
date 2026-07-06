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
  setDetectedLlmContextTokens,
  clearManualLlmContextTokens,
  getLlmContextSource,
  computeVbCharCap,
  getVbCharCap,
  DEFAULT_LLM_CONTEXT_TOKENS,
  MIN_LLM_CONTEXT_TOKENS,
  MAX_LLM_CONTEXT_TOKENS,
} from '../llm-context';

const KEY = 'teamflow_llm_context_tokens';
const DETECTED_KEY = 'teamflow_llm_context_detected';

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

describe('Default = interner llama.cpp-Wert (80k)', () => {
  it('DEFAULT_LLM_CONTEXT_TOKENS entspricht der Config kontext_groesse (81920)', () => {
    expect(DEFAULT_LLM_CONTEXT_TOKENS).toBe(81_920);
    // (81920 − 4096) × 3 = 233.472 → ~50k-Token-VBs passen ohne Kürzung
    expect(computeVbCharCap(81_920)).toBe(233_472);
  });
});

describe('Präzedenz manuell > erkannt > Default + Quelle', () => {
  beforeEach(() => { mem.clear(); });

  it('ohne alles: Default, Quelle "default"', () => {
    expect(getLlmContextTokens()).toBe(DEFAULT_LLM_CONTEXT_TOKENS);
    expect(getLlmContextSource()).toBe('default');
  });

  it('erkannt gewinnt über Default, solange kein manueller Wert', () => {
    setDetectedLlmContextTokens(40_000);
    expect(getLlmContextTokens()).toBe(40_000);
    expect(getLlmContextSource()).toBe('erkannt');
    expect(mem.get(DETECTED_KEY)).toBe('40000');
  });

  it('manuell übersteuert erkannt', () => {
    setDetectedLlmContextTokens(40_000);
    setLlmContextTokens(50_000);
    expect(getLlmContextTokens()).toBe(50_000);
    expect(getLlmContextSource()).toBe('manuell');
  });

  it('clearManual fällt auf den erkannten Wert zurück', () => {
    setDetectedLlmContextTokens(40_000);
    setLlmContextTokens(50_000);
    clearManualLlmContextTokens();
    expect(getLlmContextTokens()).toBe(40_000);
    expect(getLlmContextSource()).toBe('erkannt');
  });

  it('erkannter Wert wird ebenfalls geclamped', () => {
    setDetectedLlmContextTokens(MAX_LLM_CONTEXT_TOKENS + 10_000);
    expect(getLlmContextTokens()).toBe(MAX_LLM_CONTEXT_TOKENS);
  });
});
