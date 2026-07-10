import { beforeAll, describe, expect, it, vi } from 'vitest';

// OpenRouter ist in der Test-Config aus → `switchProvider({type:'openrouter'})` würde
// am Build-Gate scheitern. Für das extern-Gating den Flag freischalten.
vi.mock('@/config/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/feature-flags')>();
  return { ...actual, isOpenRouterEnabled: () => true };
});

// StreamlitBridgeTransport registriert im Konstruktor einen window-Listener.
beforeAll(() => {
  vi.stubGlobal('window', { addEventListener: () => {}, open: () => null });
});

import { AIBridge } from '../bridge';

const EXTERN_CONFIG = { type: 'openrouter' as const, endpoint: 'https://openrouter.ai/api/v1', model: 'x', apiKey: 'k' };

describe('AIBridge.getTransportForAssistent (DSGVO — Assistenten-Pfad)', () => {
  it('intern (streamlit, Default) → liefert Transport ohne Throw', () => {
    const bridge = new AIBridge();
    expect(bridge.getActiveKlasse()).toBe('intern');
    expect(() => bridge.getTransportForAssistent()).not.toThrow();
  });

  it('extern → wirft DSGVO-Fehler (strukturell kein externer Pfad)', () => {
    const bridge = new AIBridge();
    bridge.switchProvider(EXTERN_CONFIG);
    expect(bridge.getActiveKlasse()).toBe('extern');
    expect(() => bridge.getTransportForAssistent()).toThrow(/DSGVO-Transport-Policy/);
  });
});
