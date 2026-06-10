import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectLLMTransport } from '../transports/direct-llm';
import type { StreamResult } from '../transports/streamlit';

const encoder = new TextEncoder();

function sseResponse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(encoder.encode(ch));
      c.close();
    },
  });
  return new Response(stream, { status: 200 });
}

function chunkJson(delta: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  return `data: ${JSON.stringify({ choices: [{ delta }], ...extra })}\n\n`;
}

beforeEach(() => {
  // Node-Test-Env hat kein window — getHeaders() liest window.location.origin (OpenRouter-Referer)
  vi.stubGlobal('window', { location: { origin: 'https://teamflow.local' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DirectLLMTransport.streamConversation', () => {
  it('streamt Content-Deltas und liefert Gesamttext', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      chunkJson({ content: 'Hal' }),
      chunkJson({ content: 'lo' }),
      'data: [DONE]\n\n',
    ])));
    const t = new DirectLLMTransport('http://localhost:8081', 'test-model');
    const deltas: string[] = [];
    const result = await t.streamConversation!(
      [{ role: 'user', content: 'Hi' }],
      { onDelta: d => deltas.push(d) },
    );
    expect(deltas.join('')).toBe('Hallo');
    expect(result.content).toBe('Hallo');
    expect(result.aborted).toBe(false);
  });

  it('routet delta.reasoning_content (llama.cpp) in onReasoningDelta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      chunkJson({ reasoning_content: 'denke…' }),
      chunkJson({ content: 'Antwort' }),
      'data: [DONE]\n\n',
    ])));
    const t = new DirectLLMTransport('http://localhost:8081', 'test-model');
    const reasoning: string[] = [];
    const result = await t.streamConversation!(
      [{ role: 'user', content: 'Hi' }],
      { onDelta: () => {}, onReasoningDelta: r => reasoning.push(r) },
    );
    expect(reasoning.join('')).toBe('denke…');
    expect(result.reasoning).toBe('denke…');
    expect(result.content).toBe('Antwort');
  });

  it('trennt inline <think>-Tags im Content (Fallback)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      chunkJson({ content: '<think>über' }),
      chunkJson({ content: 'lege</think>Ergebnis' }),
      'data: [DONE]\n\n',
    ])));
    const t = new DirectLLMTransport('http://localhost:8081', 'test-model');
    const result = await t.streamConversation!(
      [{ role: 'user', content: 'Hi' }],
      { onDelta: () => {} },
    );
    expect(result.reasoning).toBe('überlege');
    expect(result.content).toBe('Ergebnis');
  });

  it('liest llama.cpp timings aus dem Final-Chunk', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      chunkJson({ content: 'x' }),
      chunkJson({}, { timings: { prompt_n: 10, prompt_ms: 100, predicted_n: 5, predicted_ms: 500, predicted_per_second: 10 } }),
      'data: [DONE]\n\n',
    ])));
    const t = new DirectLLMTransport('http://localhost:8081', 'test-model');
    const result = await t.streamConversation!(
      [{ role: 'user', content: 'Hi' }],
      { onDelta: () => {} },
    );
    expect(result.stats?.source).toBe('llamacpp-timings');
    expect(result.stats?.tokensPerSecond).toBe(10);
    expect(result.stats?.promptTokens).toBe(10);
  });

  it('verkraftet OpenRouter-Usage-Chunk mit leerem choices-Array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      ': OPENROUTER PROCESSING\n\n',
      chunkJson({ content: 'ok' }),
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 3 } })}\n\n`,
      'data: [DONE]\n\n',
    ])));
    const t = new DirectLLMTransport('https://openrouter.ai/api/v1', 'test-model');
    const result = await t.streamConversation!(
      [{ role: 'user', content: 'Hi' }],
      { onDelta: () => {} },
    );
    expect(result.content).toBe('ok');
    expect(result.stats?.source).toBe('usage-wallclock');
    expect(result.stats?.promptTokens).toBe(7);
  });

  it('sendet stream:true immer, stream_options nur bei OpenRouter', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return sseResponse(['data: [DONE]\n\n']);
    }));
    const local = new DirectLLMTransport('http://localhost:8081', 'm');
    await local.streamConversation!([{ role: 'user', content: 'a' }], { onDelta: () => {} });
    const or = new DirectLLMTransport('https://openrouter.ai/api/v1', 'm');
    await or.streamConversation!([{ role: 'user', content: 'a' }], { onDelta: () => {} });

    expect(bodies[0]?.stream).toBe(true);
    expect(bodies[0]?.stream_options).toBeUndefined();
    expect(bodies[1]?.stream).toBe(true);
    expect(bodies[1]?.stream_options).toEqual({ include_usage: true });
  });

  it('Abort: resolved mit aborted=true und Partial-Content statt zu werfen', async () => {
    const controller = new AbortController();
    let failStream: () => void = () => {};
    vi.stubGlobal('fetch', vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(encoder.encode(chunkJson({ content: 'halb' })));
          failStream = () => c.error(new Error('connection gone'));
        },
      });
      return new Response(stream, { status: 200 });
    }));
    const t = new DirectLLMTransport('http://localhost:8081', 'test-model');
    const result: StreamResult = await t.streamConversation!(
      [{ role: 'user', content: 'Hi' }],
      {
        onDelta: () => {
          controller.abort();
          failStream();
        },
      },
      { signal: controller.signal },
    );
    expect(result.aborted).toBe(true);
    expect(result.content).toBe('halb');
  });

  it('Mid-Stream-Fehler OHNE Abort wirft weiter', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(encoder.encode(chunkJson({ content: 'x' })));
          c.error(new Error('connection reset'));
        },
      });
      return new Response(stream, { status: 200 });
    }));
    const t = new DirectLLMTransport('http://localhost:8081', 'test-model');
    await expect(
      t.streamConversation!([{ role: 'user', content: 'Hi' }], { onDelta: () => {} }),
    ).rejects.toThrow('connection reset');
  });

  it('HTTP-Fehler wirft mit Status + Detail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'kaputt' }), { status: 500 }),
    ));
    const t = new DirectLLMTransport('http://localhost:8081', 'test-model');
    await expect(
      t.streamConversation!([{ role: 'user', content: 'Hi' }], { onDelta: () => {} }),
    ).rejects.toThrow(/500/);
  });

  it('kaputtes JSON in einem Payload killt den Stream nicht', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      'data: {kein json}\n\n',
      chunkJson({ content: 'weiter' }),
      'data: [DONE]\n\n',
    ])));
    const t = new DirectLLMTransport('http://localhost:8081', 'test-model');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await t.streamConversation!(
      [{ role: 'user', content: 'Hi' }],
      { onDelta: () => {} },
    );
    expect(result.content).toBe('weiter');
    warn.mockRestore();
  });
});
