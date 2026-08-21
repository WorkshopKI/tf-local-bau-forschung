/**
 * Der Denkprozess über die interne KI — die Naht, an der er bis v6.4 verloren ging.
 *
 * Befund aus dem Betrieb: an Gutachten-Abschnitten blieb der „Denkprozess"
 * dauerhaft leer. Nicht, weil das Modell keinen lieferte — die KI-Seite zeigt ihn
 * in ihrer eigenen Blase, und das Bookmarklet legt ihn JEDEM `tf-response` bei —,
 * sondern weil `submitMessage` auf einen String auflöst und der Single-Shot-Zweig
 * des `tf-response`-Handlers `data.reasoning` gar nicht erst auspackte. Der
 * Streaming-Zweig daneben tat es die ganze Zeit; nur nimmt ein Skill-Lauf ohne
 * Delta-Konsumenten diesen Zweig nicht.
 *
 * Ein Verlust ohne Fehlermeldung: `denkprozess` blieb schlicht `undefined`, und
 * das ist von „das Modell hat nichts geliefert" nicht zu unterscheiden. Deshalb
 * hier ein echter Verhaltenstest an der Naht statt einer Quelltext-Prüfung.
 *
 * Stub-Muster wie streamlit-ziel.test.ts.
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

interface Harness {
  transport: StreamlitBridgeTransport;
  /** Spielt eine Antwort der KI-Seite ein — genau die Nachricht, die das
   *  Bookmarklet nach dem `done`-Ereignis schickt. */
  antworte: (nutzlast: Record<string, unknown>) => void;
  letzteId: () => string;
}

function makeHarness(): Harness {
  useBridgeModelle.setState({ angeboten: [], fenster: {} });
  const transport = new StreamlitBridgeTransport();
  const call = addListenerSpy.mock.calls.find(c => c[0] === 'message');
  if (!call) throw new Error('message-Listener nicht registriert');
  const listener = call[1] as (event: unknown) => void;
  const tab = { closed: false, postMessage: vi.fn() };
  listener({ origin: ORIGIN, source: tab, data: { type: 'tf-bridge-ready' } });

  const letzteId = (): string => {
    const req = [...tab.postMessage.mock.calls].reverse()
      .find(c => (c[0] as { type?: string }).type === 'tf-request');
    if (!req) throw new Error('kein tf-request gesendet');
    return (req[0] as { id: string }).id;
  };
  return {
    transport,
    letzteId,
    antworte: (nutzlast) => listener({
      origin: ORIGIN, source: tab,
      data: { type: 'tf-response', id: letzteId(), ...nutzlast },
    }),
  };
}

describe('Bridge: Denkprozess im Single-Shot-Pfad', () => {
  it('reicht `reasoning` aus dem tf-response an onReasoning durch', async () => {
    const h = makeHarness();
    const gesehen: string[] = [];
    const p = h.transport.submitMessage('Frage', undefined, {
      onReasoning: (t) => gesehen.push(t),
    });
    await vi.advanceTimersByTimeAsync(0);
    h.antworte({ result: 'Der Text.', reasoning: 'Erst geprüft, dann formuliert.' });

    await expect(p).resolves.toBe('Der Text.');
    expect(gesehen, 'Denkprozess kam nicht an — genau der Verlust aus v6.4').toEqual([
      'Erst geprüft, dann formuliert.',
    ]);
  });

  it('meldet den Denkprozess VOR dem Auflösen', async () => {
    // Der Aufrufer (`run-skill`) schreibt in eine lokale Variable und liest sie
    // direkt nach dem `await`. Käme der Rückruf danach, wäre der Wert beim Bauen
    // des Ergebnis-Records noch nicht da — derselbe stille Verlust, nur später.
    const h = makeHarness();
    const folge: string[] = [];
    const p = h.transport.submitMessage('Frage', undefined, {
      onReasoning: () => folge.push('reasoning'),
    }).then(() => folge.push('resolve'));
    await vi.advanceTimersByTimeAsync(0);
    h.antworte({ result: 'Text', reasoning: 'gedacht' });
    await p;
    expect(folge).toEqual(['reasoning', 'resolve']);
  });

  it('ruft onReasoning NICHT auf, wenn die Seite nichts geliefert hat', async () => {
    // Sonst überschriebe ein leerer String ein „nichts geliefert" mit einem
    // leeren Denkprozess — die Anzeige könnte beides nicht mehr unterscheiden.
    const h = makeHarness();
    const gesehen = vi.fn();
    const p = h.transport.submitMessage('Frage', undefined, { onReasoning: gesehen });
    await vi.advanceTimersByTimeAsync(0);
    h.antworte({ result: 'Text', reasoning: '' });
    await p;
    expect(gesehen).not.toHaveBeenCalled();
  });

  it('läuft ohne den Rückruf unverändert durch (Gegenprobe)', async () => {
    const h = makeHarness();
    const p = h.transport.submitMessage('Frage');
    await vi.advanceTimersByTimeAsync(0);
    h.antworte({ result: 'Text', reasoning: 'gedacht' });
    await expect(p).resolves.toBe('Text');
  });
});
