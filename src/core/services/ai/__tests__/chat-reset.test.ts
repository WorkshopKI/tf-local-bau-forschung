import { describe, it, expect } from 'vitest';
import { starteFrischenChat, resetHatVerlaufsrisiko } from '../chat-reset';
import type { AITransport, ResetErgebnis } from '../transports/streamlit';

/** Minimaler Transport-Stub; `reset` optional, um „ohne resetChat" abzudecken. */
function transportMit(reset?: () => Promise<ResetErgebnis>): AITransport {
  return {
    name: 'Stub',
    ping: async () => true,
    submitMessage: async () => '',
    ...(reset ? { resetChat: reset } : {}),
  } as unknown as AITransport;
}

describe('starteFrischenChat', () => {
  it('reicht ok/nicht-gefunden/timeout vom Transport unverändert durch', async () => {
    expect(await starteFrischenChat(transportMit(async () => 'ok'))).toBe('ok');
    expect(await starteFrischenChat(transportMit(async () => 'nicht-gefunden'))).toBe('nicht-gefunden');
    expect(await starteFrischenChat(transportMit(async () => 'timeout'))).toBe('timeout');
  });

  it('ohne resetChat-Methode → nicht-unterstuetzt (stateless-API-Transport, keine Warnung)', async () => {
    expect(await starteFrischenChat(transportMit())).toBe('nicht-unterstuetzt');
  });

  it('Wurf im resetChat → timeout (wirft NIE)', async () => {
    const status = await starteFrischenChat(transportMit(async () => { throw new Error('kaputt'); }));
    expect(status).toBe('timeout');
  });
});

describe('resetHatVerlaufsrisiko', () => {
  it('nur nicht-gefunden/timeout sind ein Verlaufsrisiko (ok/nicht-unterstuetzt nicht)', () => {
    expect(resetHatVerlaufsrisiko('ok')).toBe(false);
    expect(resetHatVerlaufsrisiko('nicht-unterstuetzt')).toBe(false);
    expect(resetHatVerlaufsrisiko('nicht-gefunden')).toBe(true);
    expect(resetHatVerlaufsrisiko('timeout')).toBe(true);
  });
});
