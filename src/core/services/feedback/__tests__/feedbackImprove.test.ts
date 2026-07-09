/**
 * Tests für den geführten Feedback-Verbesserer (v2.206).
 *
 * Prüft:
 *  - Transport-Bug-Regression: der System-Prompt wird IN die Message inlined
 *    (Streamlit-Bridge verwirft sonst den 2. submitMessage-Arg),
 *  - Prompts enthalten App-Overview + Screen-Doc + Bereichs-Liste + Rückfrage-Dimensionen,
 *  - askClarifyingQuestions: Intern-only-Gate, tolerante {fragen}-Parse, max 3, nie werfen,
 *  - improveFeedbackGuided: Intern-only-Gate, verbesserterText + Anforderung, Retry, Fallback.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../screenContext', () => ({
  getAppOverview: vi.fn(() => 'APP-OVERVIEW-MARKER'),
  getScreenContext: vi.fn((pluginId: string) => (pluginId === 'antraege' ? 'SCREEN-DOC-MARKER' : null)),
}));

import {
  buildClarifyPrompt,
  buildGuidedImprovePrompt,
  askClarifyingQuestions,
  improveFeedbackGuided,
  type FeedbackQA,
} from '../feedbackImprove';
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

function fakeTransport(name: string, submitMessage: AITransport['submitMessage']): AITransport {
  return { name, submitMessage } as unknown as AITransport;
}

describe('buildClarifyPrompt', () => {
  it('enthält Overview + Screen-Doc + Rückfrage-Dimensionen des Typs', () => {
    const { systemPrompt, userPrompt } = buildClarifyPrompt(
      { text: 'Etwas ist kaputt', category: 'problem' },
      CONTEXT,
      'antraege',
    );
    expect(systemPrompt).toContain('APP-OVERVIEW-MARKER');
    expect(systemPrompt).toContain('SCREEN-DOC-MARKER');
    // Dimensionen kommen aus FEEDBACK_TYPES (Typ 'problem' → "Was ist passiert?")
    expect(systemPrompt).toContain('Was ist passiert?');
    expect(userPrompt).toContain('Etwas ist kaputt');
  });

  it('fehlendes Screen-Doc → nur Overview, kein Crash', () => {
    const { systemPrompt } = buildClarifyPrompt({ text: 'Frage' }, CONTEXT, 'unbekanntes-plugin');
    expect(systemPrompt).toContain('APP-OVERVIEW-MARKER');
    expect(systemPrompt).not.toContain('SCREEN-DOC-MARKER');
    expect(getScreenContext).toHaveBeenCalledWith('unbekanntes-plugin');
  });
});

describe('buildGuidedImprovePrompt', () => {
  it('fordert verbesserterText + Bereichs-Liste, spielt Rückfrage-Antworten ein', () => {
    const answers: FeedbackQA[] = [{ frage: 'Wie oft?', antwort: 'Immer' }];
    const { systemPrompt, userPrompt } = buildGuidedImprovePrompt(
      { text: 'Suche hängt' },
      answers,
      CONTEXT,
      'antraege',
    );
    expect(systemPrompt).toContain('verbesserterText');
    expect(systemPrompt).toContain('APP-OVERVIEW-MARKER');
    expect(systemPrompt).toContain('dashboard'); // Bereichs-Liste
    expect(userPrompt).toContain('Suche hängt');
    expect(userPrompt).toContain('Wie oft?');
    expect(userPrompt).toContain('Immer');
  });
});

describe('askClarifyingQuestions', () => {
  it('Nicht-Streamlit → [] OHNE submitMessage-Call (DSGVO-Gate)', async () => {
    const submitMessage = vi.fn();
    const result = await askClarifyingQuestions(fakeTransport('OpenRouter', submitMessage), { text: 'x' }, CONTEXT, 'antraege');
    expect(result).toEqual([]);
    expect(submitMessage).not.toHaveBeenCalled();
  });

  it('inlined den System-Prompt IN die Message (Streamlit verwirft sonst den 2. Arg)', async () => {
    let message = '';
    const submitMessage = vi.fn(async (m: string) => { message = m; return '```json\n{"fragen":["Q1"]}\n```'; });
    await askClarifyingQuestions(fakeTransport('Streamlit', submitMessage), { text: 'Feedback' }, CONTEXT, 'antraege');
    expect(message).toContain('APP-OVERVIEW-MARKER'); // System-Prompt steht in der Message
    expect(message).toContain('Feedback');
  });

  it('parst {fragen} tolerant und begrenzt auf max. 3', async () => {
    const submitMessage = vi.fn(async () => 'Klar:\n```json\n{"fragen":["A","B","C","D"]}\n```');
    const result = await askClarifyingQuestions(fakeTransport('Streamlit', submitMessage), { text: 'x' }, CONTEXT, 'antraege');
    expect(result).toEqual(['A', 'B', 'C']);
  });

  it('leeres/kaputtes JSON → []', async () => {
    const submitMessage = vi.fn(async () => 'Keine Rückfragen nötig.');
    const result = await askClarifyingQuestions(fakeTransport('Streamlit', submitMessage), { text: 'x' }, CONTEXT, 'antraege');
    expect(result).toEqual([]);
  });

  it('submitMessage wirft → [] (nie werfen)', async () => {
    const submitMessage = vi.fn(async () => { throw new Error('Timeout'); });
    await expect(
      askClarifyingQuestions(fakeTransport('Streamlit', submitMessage), { text: 'x' }, CONTEXT, 'antraege'),
    ).resolves.toEqual([]);
  });
});

describe('improveFeedbackGuided', () => {
  it('Nicht-Streamlit → null OHNE Call', async () => {
    const submitMessage = vi.fn();
    const result = await improveFeedbackGuided(fakeTransport('OpenRouter', submitMessage), { text: 'x' }, [], CONTEXT, 'antraege');
    expect(result).toBeNull();
    expect(submitMessage).not.toHaveBeenCalled();
  });

  it('liefert verbesserterText + classification (verbessert:true)', async () => {
    const submitMessage = vi.fn(async () =>
      '```json\n{"verbesserterText":"Klarer Text","category":"feature","summary":"S","anforderung":"IST: X SOLL: Y","akzeptanzkriterien":["A","B"]}\n```',
    );
    const result = await improveFeedbackGuided(fakeTransport('Streamlit', submitMessage), { text: 'roh' }, [], CONTEXT, 'antraege');
    expect(submitMessage).toHaveBeenCalledTimes(1);
    expect(result?.verbesserterText).toBe('Klarer Text');
    expect(result?.classification.anforderung).toBe('IST: X SOLL: Y');
    expect(result?.classification.akzeptanzkriterien).toEqual(['A', 'B']);
    expect(result?.classification.verbessert).toBe(true);
  });

  it('fehlender verbesserterText → Fallback auf summary', async () => {
    const submitMessage = vi.fn(async () => '```json\n{"category":"bug","summary":"Nur Summary"}\n```');
    const result = await improveFeedbackGuided(fakeTransport('Streamlit', submitMessage), { text: 'roh' }, [], CONTEXT, 'antraege');
    expect(result?.verbesserterText).toBe('Nur Summary');
  });

  it('Parse-Fehlschlag → EIN Retry, dann Erfolg', async () => {
    let call = 0;
    const submitMessage = vi.fn(async () => {
      call++;
      return call === 1 ? 'Kein JSON.' : '```json\n{"verbesserterText":"VT","category":"ux","summary":"S"}\n```';
    });
    const result = await improveFeedbackGuided(fakeTransport('Streamlit', submitMessage), { text: 'roh' }, [], CONTEXT, 'antraege');
    expect(submitMessage).toHaveBeenCalledTimes(2);
    expect(result?.verbesserterText).toBe('VT');
  });

  it('zweimal kaputt → null; submitMessage wirft → null', async () => {
    const kaputt = vi.fn(async () => 'kein json');
    await expect(
      improveFeedbackGuided(fakeTransport('Streamlit', kaputt), { text: 'x' }, [], CONTEXT, 'antraege'),
    ).resolves.toBeNull();

    const wirft = vi.fn(async () => { throw new Error('Timeout'); });
    await expect(
      improveFeedbackGuided(fakeTransport('Streamlit', wirft), { text: 'x' }, [], CONTEXT, 'antraege'),
    ).resolves.toBeNull();
  });
});
