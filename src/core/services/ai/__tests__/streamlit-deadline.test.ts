/**
 * Aktivitätsbasierte Antwort-Deadlines der Streamlit-Bridge (v2.203).
 *
 * Regression: der alte, STARRE 200-s-Timeout kappte lange Läufe unter
 * Server-Last (Antwort 1–2 min+, Queue vor dem ersten Token), obwohl das
 * Bookmarklet lebte und weiterarbeitete. Neu: `tf-stream`-Snapshots und
 * `tf-progress`-Heartbeats schieben ein Idle-Timeout (200 s); nur echte
 * Funkstille (Tab tot) lässt die Anfrage scheitern. Absoluter Backstop 660 s.
 *
 * Stub-Muster wie streamlit-ping.test.ts: frisches `window` mit Spy auf
 * `addEventListener`; der gecapturte message-Listener wird mit synthetischen
 * Events (korrekte Origin) gefüttert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let addListenerSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  addListenerSpy = vi.fn();
  vi.stubGlobal('window', { addEventListener: addListenerSpy, open: vi.fn(() => null) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

import { StreamlitBridgeTransport } from '../transports/streamlit';
import { useBridgeStatus } from '../bridge-status';

const ORIGIN = 'https://gpt.vdivde-it.de';

interface Harness {
  transport: StreamlitBridgeTransport;
  /** Synthetisches Inbound-Event an den gecapturten message-Listener. */
  emit: (data: Record<string, unknown>) => void;
  /** Gecapturtes Bridge-Fenster (Bookmarklet-Tab-Stub). */
  tab: { closed: boolean; postMessage: ReturnType<typeof vi.fn> };
  /** id der letzten gesendeten tf-request. */
  lastRequestId: () => string;
}

function makeHarness(): Harness {
  const transport = new StreamlitBridgeTransport();
  const call = addListenerSpy.mock.calls.find(c => c[0] === 'message');
  if (!call) throw new Error('message-Listener nicht registriert');
  const listener = call[1] as (event: unknown) => void;
  const tab = { closed: false, postMessage: vi.fn() };
  const emit = (data: Record<string, unknown>): void => {
    listener({ origin: ORIGIN, source: tab, data });
  };
  // Fenster-Handle capturen (wie das echte tf-bridge-ready-Announce).
  emit({ type: 'tf-bridge-ready' });
  const lastRequestId = (): string => {
    const req = [...tab.postMessage.mock.calls].reverse()
      .find(c => (c[0] as { type?: string }).type === 'tf-request');
    if (!req) throw new Error('kein tf-request gesendet');
    return (req[0] as { id: string }).id;
  };
  return { transport, emit, tab, lastRequestId };
}

describe('StreamlitBridgeTransport — aktivitätsbasierte Antwort-Deadline', () => {
  it('submitMessage überlebt > 200 s, solange tf-progress/tf-stream Aktivität melden, und resolved auf tf-response', async () => {
    const h = makeHarness();
    const promise = h.transport.submitMessage('Lange Frage');
    await vi.advanceTimersByTimeAsync(0); // ensureConnection + postMessage
    const id = h.lastRequestId();

    // 3 × 190 s, dazwischen Heartbeats → 570 s gesamt, nie 200 s idle
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(190_000);
      h.emit({ type: 'tf-progress', id });
    }
    h.emit({ type: 'tf-stream', id, content: 'Teil…' });
    h.emit({ type: 'tf-response', id, result: 'Die vollständige Antwort' });
    await expect(promise).resolves.toBe('Die vollständige Antwort');
  });

  it('ohne jede Aktivität → reject "Response timeout" nach 200 s + Status disconnected', async () => {
    const h = makeHarness();
    const caught = h.transport.submitMessage('Frage').catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(200_000);
    const err = await caught;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Response timeout');
    expect(useBridgeStatus.getState().status).toBe('disconnected');
  });

  it('Hard-Cap (660 s) greift trotz kontinuierlicher Heartbeats', async () => {
    const h = makeHarness();
    const caught = h.transport.submitMessage('Frage').catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(0);
    const id = h.lastRequestId();
    for (let i = 0; i < 7; i++) {
      await vi.advanceTimersByTimeAsync(100_000);
      h.emit({ type: 'tf-progress', id });
    }
    // 700 s vergangen → der 660-s-Hard-Timer hat gefeuert
    const err = await caught;
    expect((err as Error).message).toBe('Response timeout');
  });

  it('streamConversation resolved bei Idle-Ablauf mit dem Partial (kein throw)', async () => {
    const h = makeHarness();
    const onDelta = vi.fn();
    const promise = h.transport.streamConversation(
      [{ role: 'user', content: 'Frage' }],
      { onDelta },
    );
    await vi.advanceTimersByTimeAsync(0);
    const id = h.lastRequestId();
    h.emit({ type: 'tf-stream', id, content: 'Teil 1' });
    expect(onDelta).toHaveBeenCalledWith('Teil 1');
    // danach Funkstille → Idle-Expiry liefert den bisherigen Stand
    await vi.advanceTimersByTimeAsync(200_000);
    await expect(promise).resolves.toEqual({ content: 'Teil 1', aborted: false });
  });

  it('tf-stream-Aktivität allein hält auch Single-Shot-Anfragen am Leben (pending.touch)', async () => {
    const h = makeHarness();
    const promise = h.transport.submitMessage('Frage');
    await vi.advanceTimersByTimeAsync(0);
    const id = h.lastRequestId();
    for (let i = 0; i < 2; i++) {
      await vi.advanceTimersByTimeAsync(150_000);
      h.emit({ type: 'tf-stream', id, content: `Snapshot ${i}` });
    }
    h.emit({ type: 'tf-response', id, result: 'Fertig' });
    await expect(promise).resolves.toBe('Fertig');
  });
});

describe('StreamlitBridgeTransport — Abschluss-Marker (erwarteAbschluss)', () => {
  /** Letzte gesendete tf-request-Payload (roh). */
  function lastRequest(h: Harness): Record<string, unknown> {
    const req = [...h.tab.postMessage.mock.calls].reverse()
      .find(c => (c[0] as { type?: string }).type === 'tf-request');
    if (!req) throw new Error('kein tf-request gesendet');
    return req[0] as Record<string, unknown>;
  }

  it('reicht erwarteAbschluss als `erwarte` in die tf-request weiter', async () => {
    const h = makeHarness();
    h.transport.submitMessage('Frage', undefined, { erwarteAbschluss: 'Finaler Text' }).catch(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(lastRequest(h).erwarte).toBe('Finaler Text');
  });

  it('ohne Option trägt die tf-request kein `erwarte`-Feld', async () => {
    const h = makeHarness();
    h.transport.submitMessage('Frage').catch(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect('erwarte' in lastRequest(h)).toBe(false);
  });
});
