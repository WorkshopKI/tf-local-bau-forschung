/**
 * Tests für feedbackImprove.ts (v2.165 KI-Verbesserung).
 *
 * Prüft:
 *  - Prompt enthält App-Overview + Screen-Doc + Bereichs-Liste,
 *  - Nicht-Streamlit-Transport → null OHNE submitMessage-Call (DSGVO-Gate),
 *  - Parse-Retry-Pfad (erste Antwort kaputt, zweite valide),
 *  - erweiterte Felder (anforderung/akzeptanzkriterien/verbessert) werden geparst,
 *  - fehlendes Screen-Doc → Prompt nur mit Overview, kein Crash.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../screenContext', () => ({
  getAppOverview: vi.fn(() => 'APP-OVERVIEW-MARKER'),
  getScreenContext: vi.fn((pluginId: string) => (pluginId === 'antraege' ? 'SCREEN-DOC-MARKER' : null)),
}));

import { buildFeedbackImprovePrompt, improveFeedback } from '../feedbackImprove';
import { getScreenContext } from '../screenContext';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { FeedbackContext } from '@/core/types/feedback';

const CONTEXT: FeedbackContext = {
  route: 'antraege',
  page: 'Förderanträge',
  device: 'Desktop',
  viewport: '1920x1080',
  sessionDuration: 60,
  errors: [],
  timestamp: '2026-01-01T00:00:00Z',
};

function fakeTransport(name: string, submitMessage: (...args: unknown[]) => Promise<string>): AITransport {
  return { name, submitMessage } as unknown as AITransport;
}

describe('buildFeedbackImprovePrompt', () => {
  it('enthält App-Overview + Screen-Doc + Bereichs-Liste', () => {
    const { systemPrompt } = buildFeedbackImprovePrompt({ text: 'Etwas ist kaputt' }, CONTEXT, 'antraege');
    expect(systemPrompt).toContain('APP-OVERVIEW-MARKER');
    expect(systemPrompt).toContain('SCREEN-DOC-MARKER');
    expect(systemPrompt).toContain('antraege');
    expect(systemPrompt).toContain('dashboard');
  });

  it('fehlendes Screen-Doc → Prompt nur mit Overview, kein Crash', () => {
    const { systemPrompt } = buildFeedbackImprovePrompt({ text: 'Frage' }, CONTEXT, 'unbekanntes-plugin');
    expect(systemPrompt).toContain('APP-OVERVIEW-MARKER');
    expect(systemPrompt).not.toContain('SCREEN-DOC-MARKER');
    expect(getScreenContext).toHaveBeenCalledWith('unbekanntes-plugin');
  });
});

describe('improveFeedback — Transport-Gate', () => {
  it('läuft NUR auf Streamlit — jeder andere Transport liefert null ohne Call', async () => {
    const submitMessage = vi.fn();
    const transport = fakeTransport('DirectLLM', submitMessage);
    const result = await improveFeedback(transport, { text: 'Feedback' }, CONTEXT, 'antraege');
    expect(result).toBeNull();
    expect(submitMessage).not.toHaveBeenCalled();
  });

  it('läuft auf Streamlit', async () => {
    const submitMessage = vi.fn(async () => '```json\n{"category":"bug","summary":"S"}\n```');
    const transport = fakeTransport('Streamlit', submitMessage);
    const result = await improveFeedback(transport, { text: 'Feedback' }, CONTEXT, 'antraege');
    expect(submitMessage).toHaveBeenCalledTimes(1);
    expect(result?.verbessert).toBe(true);
  });
});

describe('improveFeedback — Parse + Retry', () => {
  it('Parse-Fehlschlag → EIN Retry mit verschärfter Formatanweisung, dann Erfolg', async () => {
    let call = 0;
    const submitMessage = vi.fn(async () => {
      call++;
      if (call === 1) return 'Ich kann das leider nicht als JSON liefern.';
      return '```json\n{"category":"feature","summary":"Zusammenfassung","anforderung":"IST: X SOLL: Y","akzeptanzkriterien":["A","B"]}\n```';
    });
    const transport = fakeTransport('Streamlit', submitMessage);
    const result = await improveFeedback(transport, { text: 'Ich wünsche mir X' }, CONTEXT, 'antraege');
    expect(submitMessage).toHaveBeenCalledTimes(2);
    expect(result).not.toBeNull();
    expect(result?.anforderung).toBe('IST: X SOLL: Y');
    expect(result?.akzeptanzkriterien).toEqual(['A', 'B']);
    expect(result?.verbessert).toBe(true);
  });

  it('Parse-Fehlschlag zweimal in Folge → null', async () => {
    const submitMessage = vi.fn(async () => 'Immer noch kein JSON.');
    const transport = fakeTransport('Streamlit', submitMessage);
    const result = await improveFeedback(transport, { text: 'Feedback' }, CONTEXT, 'antraege');
    expect(submitMessage).toHaveBeenCalledTimes(2);
    expect(result).toBeNull();
  });

  it('submitMessage wirft → null, kein Throw', async () => {
    const submitMessage = vi.fn(async () => { throw new Error('Timeout'); });
    const transport = fakeTransport('Streamlit', submitMessage);
    await expect(improveFeedback(transport, { text: 'Feedback' }, CONTEXT, 'antraege')).resolves.toBeNull();
  });
});
