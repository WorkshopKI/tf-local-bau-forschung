import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Regression: ein VERFÜGBARKEITS-Ping darf die Streamlit-Bridge NICHT öffnen.
// Bug: das Öffnen einer Verbund-Detailseite mit generierten Abschnitten poppte
// ungefragt den KI-Tab (window.open auf https://gpt.vdivde-it.de/) auf, weil die
// Mount-Probe `ping()` über `ensureConnection()` bedingungslos `window.open` rief.
// Fix: passiver Ping (`{ openIfNeeded: false }`) pingt nur ein bereits offenes
// Fenster und öffnet selbst keins.

// StreamlitBridgeTransport registriert im Konstruktor einen `window`-message-Listener
// und ruft beim aktiven Ping `window.open` — im node-Test-Env fehlt `window`. Pro Test
// ein frischer Stub mit Spy auf `open`.
let openSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  openSpy = vi.fn(() => null);
  vi.stubGlobal('window', { addEventListener: vi.fn(), open: openSpy });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

import { StreamlitBridgeTransport } from '../transports/streamlit';

describe('StreamlitBridgeTransport.ping — passiver vs. aktiver Check', () => {
  it('passiv (openIfNeeded: false) ohne offenes Fenster → false UND kein window.open', async () => {
    const transport = new StreamlitBridgeTransport();
    const ok = await transport.ping({ openIfNeeded: false });
    expect(ok).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('aktiv (Default) → öffnet das Bridge-Fenster (window.open)', async () => {
    vi.useFakeTimers();
    const transport = new StreamlitBridgeTransport();
    // Kein Pong → läuft in den 5-s-Timeout (→ false). Uns interessiert nur, DASS
    // window.open gerufen wurde (Default-Verhalten der Nutzer-Gesten bleibt erhalten).
    const pending = transport.ping();
    await vi.advanceTimersByTimeAsync(5001);
    expect(openSpy).toHaveBeenCalledWith('https://gpt.vdivde-it.de/', 'teamflow-streamlit');
    await expect(pending).resolves.toBe(false);
  });
});
