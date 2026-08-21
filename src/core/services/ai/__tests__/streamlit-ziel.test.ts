/**
 * Rollen-Durchreichung der Bridge zur internen KI (v2.274, umgebaut v6.0).
 *
 * Regression, die den Test ausgelöst hat: Der Umschalter war im Chat
 * **wirkungslos**. Der Chat bevorzugt `streamConversation` per Feature-Detection,
 * der Bridge-Transport bietet sie an — und genau diese Methode postete
 * `{ type:'tf-request', id, message }` ohne Zielangabe. Der Lauf traf also immer
 * das, was zuletzt jemand eingestellt hatte.
 *
 * Seit v6 reist nicht mehr die Rolle über die Naht, sondern der **Optionstext**
 * des Modells: das Bookmarklet kennt keine Rollen. Die Übersetzung Rolle →
 * Modelltext braucht die Auswahlliste der Seite, und die meldet das Bookmarklet
 * selbst — deshalb setzt der Harness sie über `tf-bridge-ready`, genau wie im
 * Betrieb.
 *
 * Getestet wird die **Naht**: was landet im postMessage? Die Auswahl selbst ist
 * Bookmarklet-Sache und hier nicht beobachtbar.
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
import { useBridgeModelle } from '../bridge-modelle';

const ORIGIN = 'https://gpt.vdivde-it.de';

/** Die Auswahlliste der internen KI, so wie das Bookmarklet sie meldet. */
const MODELLE = [
  { text: 'gpt-oss-120b', value: 'gpt-oss-120b-F16.gguf', aktiv: true },
  { text: 'Qwen3.6-35B', value: 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf' },
  { text: 'Qwen3-VL-30B (multimodal)', value: 'Qwen3-VL-30B-Instruct-UD-Q4_K_XL.gguf' },
];

interface TfRequest {
  type: string;
  id: string;
  message: string;
  modell?: string;
}

function makeHarness(modelle: typeof MODELLE | null = MODELLE): {
  transport: StreamlitBridgeTransport;
  tab: { closed: boolean; postMessage: ReturnType<typeof vi.fn> };
  letzterRequest: () => TfRequest;
} {
  useBridgeModelle.setState({ angeboten: [], fenster: {} });
  const transport = new StreamlitBridgeTransport();
  const call = addListenerSpy.mock.calls.find(c => c[0] === 'message');
  if (!call) throw new Error('message-Listener nicht registriert');
  const listener = call[1] as (event: unknown) => void;
  const tab = { closed: false, postMessage: vi.fn() };
  listener({ origin: ORIGIN, source: tab, data: { type: 'tf-bridge-ready', ...(modelle ? { modelle } : {}) } });
  const letzterRequest = (): TfRequest => {
    const req = [...tab.postMessage.mock.calls].reverse()
      .find(c => (c[0] as { type?: string }).type === 'tf-request');
    if (!req) throw new Error('kein tf-request gesendet');
    return req[0] as TfRequest;
  };
  return { transport, tab, letzterRequest };
}

describe('streamConversation reicht die Modellwahl durch', () => {
  it('löst die Rolle in den Optionstext der Seite auf', async () => {
    const h = makeHarness();
    void h.transport.streamConversation(
      [{ role: 'user', content: 'Frage' }],
      { onDelta: vi.fn() },
      { ziel: 'stark' },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(h.letzterRequest().modell).toBe('Qwen3.6-35B');
  });

  it('lässt das Feld WEG, wenn keine Rolle gesetzt ist', async () => {
    const h = makeHarness();
    void h.transport.streamConversation(
      [{ role: 'user', content: 'Frage' }],
      { onDelta: vi.fn() },
      {},
    );
    await vi.advanceTimersByTimeAsync(0);
    // Nicht `undefined` mitsenden: ohne das Feld fasst das Bookmarklet die
    // Auswahl gar nicht an.
    expect('modell' in h.letzterRequest()).toBe(false);
  });

  it('sendet auch ohne options-Objekt kein Modell', async () => {
    const h = makeHarness();
    void h.transport.streamConversation([{ role: 'user', content: 'Frage' }], { onDelta: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    expect('modell' in h.letzterRequest()).toBe(false);
  });

  it('submitMessage verhält sich unverändert (Gegenprobe)', async () => {
    const h = makeHarness();
    void h.transport.submitMessage('Frage', undefined, { ziel: 'standard' });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.letzterRequest().modell).toBe('gpt-oss-120b');
  });

  it('ohne gemeldete Liste bleibt das Feld leer — statt einen Namen zu raten', async () => {
    // Der Zustand „Bookmarklet hat sich noch nie gemeldet". Einen Modellnamen zu
    // erfinden wäre hier die schlechtere Antwort: das Bookmarklet würde ihn nicht
    // finden und den Lauf abbrechen, obwohl die Seite arbeitsfähig ist.
    const h = makeHarness(null);
    void h.transport.submitMessage('Frage', undefined, { ziel: 'stark' });
    await vi.advanceTimersByTimeAsync(0);
    expect('modell' in h.letzterRequest()).toBe(false);
  });

  it('das multimodale Modell wird nie gewählt, auch nicht für die starke Rolle', async () => {
    // Gegenprobe zur Katalog-Sperre an der NAHT: es steht in der Liste, hat aber
    // nur 62k — eine Eskalation dorthin liefe genau in das Fenster, dem sie
    // entkommen soll.
    const h = makeHarness();
    void h.transport.submitMessage('Frage', undefined, { ziel: 'stark' });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.letzterRequest().modell).not.toContain('VL');
  });
});
