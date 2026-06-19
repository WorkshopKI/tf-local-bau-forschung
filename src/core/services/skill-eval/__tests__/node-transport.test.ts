import { describe, it, expect, vi, afterEach } from 'vitest';
import { NodeOpenAITransport } from '../node-transport';

/** Baut eine `fetch`-Antwort mit JSON-Body und Status. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Installiert ein gemocktes globales `fetch` und gibt den Spy zurück. */
function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('NodeOpenAITransport', () => {
  it('submitConversation: korrekter Body (model, messages, temperature) + extrahiert content', async () => {
    const spy = mockFetch(async () => jsonResponse({ choices: [{ message: { content: 'Hallo Welt' } }] }));
    const transport = new NodeOpenAITransport({ baseUrl: 'http://localhost:8081/v1', model: 'gpt-oss-120b' });

    const out = await transport.submitConversation([{ role: 'user', content: 'Hi' }], { maxTokens: 256 });

    expect(out).toBe('Hallo Welt');
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0]!;
    // baseUrl wird normalisiert (trailing /v1 gestrippt, dann selbst angehängt).
    expect(url).toBe('http://localhost:8081/v1/chat/completions');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe('gpt-oss-120b');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(256);
  });

  it('temperature ist konfigurierbar', async () => {
    const spy = mockFetch(async () => jsonResponse({ choices: [{ message: { content: 'x' } }] }));
    const transport = new NodeOpenAITransport({ baseUrl: 'http://x', model: 'm', temperature: 0.7 });
    await transport.submitConversation([{ role: 'user', content: 'a' }]);
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.temperature).toBe(0.7);
  });

  it('submitMessage: System-Prompt wird als system-Message vorangestellt', async () => {
    const spy = mockFetch(async () => jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    const transport = new NodeOpenAITransport({ baseUrl: 'http://x', model: 'm' });
    await transport.submitMessage('frage', 'du bist gutachter');
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.messages).toEqual([
      { role: 'system', content: 'du bist gutachter' },
      { role: 'user', content: 'frage' },
    ]);
  });

  it('apiKey + extraHeaders landen in den Headern', async () => {
    const spy = mockFetch(async () => jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    const transport = new NodeOpenAITransport({
      baseUrl: 'http://x',
      model: 'm',
      apiKey: 'sk-test',
      extraHeaders: { 'HTTP-Referer': 'https://teamflow.local' },
    });
    await transport.submitConversation([{ role: 'user', content: 'a' }]);
    const headers = spy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test');
    expect(headers['HTTP-Referer']).toBe('https://teamflow.local');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('responseFormat wird als response_format durchgereicht (Judge-Pfad)', async () => {
    const spy = mockFetch(async () => jsonResponse({ choices: [{ message: { content: '{}' } }] }));
    const transport = new NodeOpenAITransport({ baseUrl: 'http://x', model: 'm' });
    await transport.submitConversation([{ role: 'user', content: 'a' }], {
      responseFormat: { type: 'json_object' },
    });
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('non-2xx wirft mit aussagekräftiger Meldung (Status + Body-Detail)', async () => {
    mockFetch(async () => jsonResponse({ error: 'context length exceeded' }, 400));
    const transport = new NodeOpenAITransport({ baseUrl: 'http://x', model: 'kaputt' });
    await expect(transport.submitConversation([{ role: 'user', content: 'a' }])).rejects.toThrow(/400/);
    await expect(transport.submitConversation([{ role: 'user', content: 'a' }])).rejects.toThrow(/context length exceeded/);
  });

  it('ping: true bei ok-Status von /v1/models', async () => {
    const spy = mockFetch(async () => jsonResponse({ data: [{ id: 'm' }] }));
    const transport = new NodeOpenAITransport({ baseUrl: 'http://x/v1', model: 'm' });
    expect(await transport.ping()).toBe(true);
    expect(spy.mock.calls[0]![0]).toBe('http://x/v1/models');
  });

  it('ping: false bei Fehler-Status', async () => {
    mockFetch(async () => jsonResponse({}, 500));
    const transport = new NodeOpenAITransport({ baseUrl: 'http://x', model: 'm' });
    expect(await transport.ping()).toBe(false);
  });

  it('ping: false bei Netzwerkfehler (fetch wirft)', async () => {
    mockFetch(async () => { throw new Error('ECONNREFUSED'); });
    const transport = new NodeOpenAITransport({ baseUrl: 'http://x', model: 'm' });
    expect(await transport.ping()).toBe(false);
  });
});
