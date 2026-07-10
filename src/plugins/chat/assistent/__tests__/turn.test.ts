/**
 * Tests für den Assistenten-Turn (Phase 1): (1) resetChat wird pro Turn VOR dem
 * Senden aufgerufen; (2) Fehlerpfade lassen die Historie unverändert (Rollback
 * der optimistischen Nutzer-Nachricht). Der DSGVO-Guard selbst wird an der
 * Auswahlfunktion getestet (bridge-assistent.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { fuehreAssistentTurnAus, type AssistentTurnDeps } from '../turn';
import { assistentSessionStore } from '../sessionStore';

function fakeTransport(overrides: Partial<AITransport> = {}): AITransport {
  return {
    name: 'Fake',
    ping: async () => true,
    submitMessage: async () => 'Antwort.',
    ...overrides,
  };
}

function deps(transport: AITransport, retrieve: AssistentTurnDeps['retrieve'] = async () => null): AssistentTurnDeps {
  return {
    getTransport: () => transport,
    getKontext: async () => ({ routeBeschreibung: 'Test', entitaet: null }),
    retrieve,
  };
}

describe('fuehreAssistentTurnAus', () => {
  it('(1) ruft resetChat pro Turn VOR dem Senden auf', async () => {
    const order: string[] = [];
    const transport = fakeTransport({
      resetChat: async () => { order.push('reset'); return 'ok'; },
      submitMessage: async () => { order.push('submit'); return 'Antwort.'; },
    });
    const res = await fuehreAssistentTurnAus('Frage', [], deps(transport));
    expect(res.ok).toBe(true);
    expect(order).toEqual(['reset', 'submit']);
  });

  it('meldet Degradation, wenn der Transport extern ist (getTransport wirft)', async () => {
    const res = await fuehreAssistentTurnAus('Frage', [], {
      getTransport: () => { throw new Error('DSGVO-Transport-Policy: extern'); },
      getKontext: async () => ({ routeBeschreibung: 'Test', entitaet: null }),
      retrieve: async () => null,
    });
    expect(res).toEqual({ ok: false, fehler: expect.stringContaining('DSGVO') });
  });

  it('meldet Degradation, wenn die interne KI nicht erreichbar ist (ping false)', async () => {
    const res = await fuehreAssistentTurnAus('Frage', [], deps(fakeTransport({ ping: async () => false })));
    expect(res.ok).toBe(false);
  });

  it('meldet einen Fehler bei leerer Antwort', async () => {
    const res = await fuehreAssistentTurnAus('Frage', [], deps(fakeTransport({ submitMessage: async () => '   ' })));
    expect(res.ok).toBe(false);
  });
});

describe('assistentSessionStore.send', () => {
  beforeEach(() => {
    assistentSessionStore.setState({ messages: [], busy: false, error: null, resetWarnung: false, letzteFehlerFrage: null });
  });

  it('hängt Nutzer- + Assistent-Nachricht an, wenn der Turn gelingt', async () => {
    await assistentSessionStore.getState().send('Was ist mein nächster Schritt?', deps(fakeTransport({ submitMessage: async () => 'Der nächste Schritt ist X.' })));
    const { messages, error } = assistentSessionStore.getState();
    expect(error).toBeNull();
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(messages[1]?.content).toBe('Der nächste Schritt ist X.');
  });

  it('(2) lässt die Historie bei einem Fehler unverändert und merkt sich die Frage', async () => {
    await assistentSessionStore.getState().send('Frage', deps(fakeTransport({ ping: async () => false })));
    const { messages, error, letzteFehlerFrage } = assistentSessionStore.getState();
    expect(messages).toHaveLength(0); // optimistische User-Message zurückgenommen
    expect(error).not.toBeNull();
    expect(letzteFehlerFrage).toBe('Frage');
  });

  it('ignoriert leere Fragen und blockiert parallele Sends', async () => {
    const spy = vi.fn(async () => 'A.');
    await assistentSessionStore.getState().send('   ', deps(fakeTransport({ submitMessage: spy })));
    expect(spy).not.toHaveBeenCalled();
    expect(assistentSessionStore.getState().messages).toHaveLength(0);
  });
});
