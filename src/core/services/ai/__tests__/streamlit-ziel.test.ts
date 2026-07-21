/**
 * `ziel`-Durchreichung der Streamlit-Bridge (v2.274).
 *
 * Regression: Der Umschalter „Standard/Agentisch" war im Chat **wirkungslos**.
 * Der Chat bevorzugt `streamConversation` per Feature-Detection, der
 * Bridge-Transport bietet sie an — und genau diese Methode postete
 * `{ type:'tf-request', id, message }` OHNE `ziel`. Das Bookmarklet wechselte
 * den Tab also nie; der Chat lief immer auf dem gerade offenen Tab, egal was
 * der Nutzer gewählt hatte. Der Zweig, der `aktivesZielFuerLauf()` durchreichte,
 * war für die Bridge unerreichbarer toter Code.
 *
 * Getestet wird die **Naht**: was landet im postMessage? Der Tab-Wechsel selbst
 * ist Bookmarklet-Sache und hier nicht beobachtbar.
 *
 * Stub-Muster wie streamlit-deadline.test.ts.
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

const ORIGIN = 'https://gpt.vdivde-it.de';

interface TfRequest {
  type: string;
  id: string;
  message: string;
  ziel?: string;
}

function makeHarness(): {
  transport: StreamlitBridgeTransport;
  tab: { closed: boolean; postMessage: ReturnType<typeof vi.fn> };
  letzterRequest: () => TfRequest;
} {
  const transport = new StreamlitBridgeTransport();
  const call = addListenerSpy.mock.calls.find(c => c[0] === 'message');
  if (!call) throw new Error('message-Listener nicht registriert');
  const listener = call[1] as (event: unknown) => void;
  const tab = { closed: false, postMessage: vi.fn() };
  listener({ origin: ORIGIN, source: tab, data: { type: 'tf-bridge-ready' } });
  const letzterRequest = (): TfRequest => {
    const req = [...tab.postMessage.mock.calls].reverse()
      .find(c => (c[0] as { type?: string }).type === 'tf-request');
    if (!req) throw new Error('kein tf-request gesendet');
    return req[0] as TfRequest;
  };
  return { transport, tab, letzterRequest };
}

describe('streamConversation reicht das ziel durch', () => {
  it('sendet ziel, wenn es gesetzt ist', async () => {
    const h = makeHarness();
    void h.transport.streamConversation(
      [{ role: 'user', content: 'Frage' }],
      { onDelta: vi.fn() },
      { ziel: 'agentisch' },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(h.letzterRequest().ziel).toBe('agentisch');
  });

  it('lässt das Feld WEG, wenn kein ziel gesetzt ist', async () => {
    const h = makeHarness();
    void h.transport.streamConversation(
      [{ role: 'user', content: 'Frage' }],
      { onDelta: vi.fn() },
      {},
    );
    await vi.advanceTimersByTimeAsync(0);
    // Nicht `undefined` mitsenden: ohne das Feld bleibt das Bookmarklet im
    // aktiven Tab — Verhalten byte-identisch zu vor v2.274.
    expect('ziel' in h.letzterRequest()).toBe(false);
  });

  it('sendet auch ohne options-Objekt kein ziel', async () => {
    const h = makeHarness();
    void h.transport.streamConversation([{ role: 'user', content: 'Frage' }], { onDelta: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    expect('ziel' in h.letzterRequest()).toBe(false);
  });

  it('submitMessage verhält sich unverändert (Gegenprobe)', async () => {
    const h = makeHarness();
    void h.transport.submitMessage('Frage', undefined, { ziel: 'standard' });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.letzterRequest().ziel).toBe('standard');
  });
});
