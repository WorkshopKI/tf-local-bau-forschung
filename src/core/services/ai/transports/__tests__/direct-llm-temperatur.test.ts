/**
 * Der Request-Body — die Stelle, an der die Temperatur wirklich zählt.
 *
 * Bis v2.372 stand dort nur `model` / `messages` / `max_tokens`; alles Weitere
 * bestimmte der Server. Ein Test auf der Options-Ebene allein hätte das nicht
 * gefunden: die Option kann gesetzt sein und trotzdem nie im Body landen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DirectLLMTransport } from '../direct-llm';

/** Fängt den POST-Body des nächsten `fetch` ab und antwortet minimal gültig. */
function fangeBody(): () => Record<string, unknown> {
  let body: Record<string, unknown> = {};
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Text.' } }] }),
    } as Response;
  });
  return () => body;
}

function transport(): DirectLLMTransport {
  return new DirectLLMTransport('http://127.0.0.1:9090/v1', 'qwen');
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('DirectLLMTransport — Temperatur im Body', () => {
  it('schreibt sie, wenn sie gesetzt ist', async () => {
    const body = fangeBody();
    await transport().submitConversation([{ role: 'user', content: 'Hallo' }], { temperatur: 0.4 });
    expect(body().temperature).toBe(0.4);
  });

  it('lässt das Feld weg, wenn keine gesetzt ist — dann gilt die Server-Voreinstellung', async () => {
    const body = fangeBody();
    await transport().submitConversation([{ role: 'user', content: 'Hallo' }]);
    expect('temperature' in body()).toBe(false);
  });

  it('akzeptiert auch 0 (kein Falsy-Fehlgriff)', async () => {
    const body = fangeBody();
    await transport().submitConversation([{ role: 'user', content: 'Hallo' }], { temperatur: 0 });
    expect(body().temperature).toBe(0);
  });
});
