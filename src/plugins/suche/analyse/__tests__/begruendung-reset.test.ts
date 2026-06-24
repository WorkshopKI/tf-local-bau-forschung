import { describe, it, expect } from 'vitest';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { stageBegruendung } from '../stages/begruendung';

function mkResults(n: number): UnifiedSearchResult[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    type: 'antrag' as const,
    score: 1 - i / 100,
    method: 'hybrid' as const,
    title: `Titel ${i}`,
    snippet: `Kurzbeschreibung ${i}`,
    fkz: `r${i}`,
  }));
}

/** Fake-Transport: protokolliert die Aufruf-Reihenfolge (reset/submit) und
 *  liefert ein Marker-Format zurück, das die ids aus dem Prompt echot. */
function fakeTransport(calls: string[], responsePad = ''): AITransport {
  return {
    name: 'Streamlit',
    displayName: 'Interne KI',
    ping: async () => true,
    resetChat: async () => { calls.push('reset'); return true; },
    submitMessage: async (message: string) => {
      calls.push('submit');
      const ids = [...message.matchAll(/id:\s*(r\d+)/g)].map(m => m[1]!);
      return ids.map(id => `@@@ ${id}\nBegründung für ${id}.`).join('\n') + responsePad;
    },
  } as unknown as AITransport;
}

describe('stageBegruendung – Chat-Reset', () => {
  it('resettet den Chat EINMAL vor dem ersten Batch (kleiner Lauf)', async () => {
    const calls: string[] = [];
    const res = await stageBegruendung({
      transport: fakeTransport(calls),
      query: 'q',
      instruction: 'inst',
      results: mkResults(5),
      signal: new AbortController().signal,
      onBatchProgress: () => {},
    });
    expect(calls[0]).toBe('reset');            // Reset zuerst …
    expect(calls).toEqual(['reset', 'submit']); // … dann genau ein Batch
    expect(Object.keys(res.begruendungById)).toHaveLength(5);
  });

  it('resettet adaptiv zusätzlich, wenn der akkumulierte Kontext die Schwelle übersteigt', async () => {
    const calls: string[] = [];
    // ~31K Token Antwort → contextTokens nach Batch 1 ≥ 30K → Reset vor Batch 2.
    const bigPad = '\n' + 'x'.repeat(110_000);
    const res = await stageBegruendung({
      transport: fakeTransport(calls, bigPad),
      query: 'q',
      instruction: 'inst',
      results: mkResults(40), // 40 / 20 = 2 Batches
      signal: new AbortController().signal,
      onBatchProgress: () => {},
    });
    expect(res.totalBatches).toBe(2);
    expect(calls.filter(c => c === 'reset')).toHaveLength(2); // Start + Schwelle
  });

  it('ohne resetChat-Unterstützung (z.B. DirectLLM) läuft es trotzdem durch', async () => {
    const calls: string[] = [];
    const t = fakeTransport(calls);
    delete (t as { resetChat?: unknown }).resetChat; // Transport ohne Reset
    const res = await stageBegruendung({
      transport: t,
      query: 'q',
      instruction: 'inst',
      results: mkResults(3),
      signal: new AbortController().signal,
      onBatchProgress: () => {},
    });
    expect(calls).toEqual(['submit']); // kein Reset, aber Lauf ok
    expect(Object.keys(res.begruendungById)).toHaveLength(3);
  });
});
