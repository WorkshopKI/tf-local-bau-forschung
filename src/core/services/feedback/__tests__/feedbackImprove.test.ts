/**
 * Tests für den geführten Feedback-Verbesserer (v2.206, erweitert v2.291).
 *
 * Prüft:
 *  - Transport-Bug-Regression: der System-Prompt wird IN die Message inlined
 *    (Streamlit-Bridge verwirft sonst den 2. submitMessage-Arg),
 *  - Prompts enthalten App-Overview + Screen-Doc + Bereichs-Liste + Rückfrage-Dimensionen,
 *  - askClarifyingQuestions: Intern-only-Gate, tolerante {fragen}-Parse, max 3, nie werfen,
 *  - improveFeedbackGuided: Intern-only-Gate, verbesserterText + Anforderung, Retry, Fallback,
 *  - v2.291: JEDER Lauf resettet zuerst den Chat (Pitfall #36) und geht auf den
 *    gpt-oss (`ziel: 'standard'`); lückenlos ausgefülltes Formular spart den
 *    Rückfragen-Lauf; die Kategorie aus der Typ-Wahl schlägt den Modell-Vorschlag.
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
  brauchtRueckfragen,
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
  return { name, submitMessage, resetChat: vi.fn(async () => 'ok' as const) } as unknown as AITransport;
}

/** Ein „idea"-Feedback mit vollständig ausgefüllten nicht-optionalen Feldern. */
const IDEA_VOLLSTAENDIG = {
  text: 'Lektor-Feinschliff',
  category: 'idea' as const,
  structured: { goal: 'Text polieren', reason: 'GA schreiben' },
};

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

  it('trägt KEINE Kategorie-Abgrenzung mehr (Phase 1 klassifiziert nicht), aber den festen Typ', () => {
    const { systemPrompt } = buildClarifyPrompt({ text: 'x', category: 'idea' }, CONTEXT, 'antraege');
    expect(systemPrompt).not.toContain('KATEGORIEN:');
    expect(systemPrompt).toContain('FEEDBACK-TYP (steht fest');
    expect(systemPrompt).toContain('Antworte in EINEM Zug');
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

  it('gibt die Kategorie aus der Typ-Wahl VOR statt sie erfragen zu lassen', () => {
    const { systemPrompt } = buildGuidedImprovePrompt(IDEA_VOLLSTAENDIG, [], CONTEXT, 'antraege');
    expect(systemPrompt).not.toContain('KATEGORIEN:');
    expect(systemPrompt).toContain('"category": "feature"');
    expect(systemPrompt).toContain('steht aus der Typ-Wahl des Nutzers fest');
  });

  it('ohne Typ bleibt die freie Kategorie-Auswahl im Contract', () => {
    const { systemPrompt } = buildGuidedImprovePrompt({ text: 'x' }, [], CONTEXT, 'antraege');
    expect(systemPrompt).toContain('bug | feature | praise | question');
  });
});

describe('brauchtRueckfragen (deterministisches Gate vor Phase 1)', () => {
  it('alle nicht-optionalen Felder gefüllt → false (optionales „idea" darf leer bleiben)', () => {
    expect(brauchtRueckfragen(IDEA_VOLLSTAENDIG)).toBe(false);
  });

  it('Lücke in einem nicht-optionalen Feld → true', () => {
    expect(brauchtRueckfragen({ ...IDEA_VOLLSTAENDIG, structured: { goal: 'Nur das' } })).toBe(true);
  });

  it('Ein-Feld-Typen (Lob/Frage) → false', () => {
    expect(brauchtRueckfragen({ text: 'Toll!', category: 'praise', structured: { text: 'Toll!' } })).toBe(false);
    expect(brauchtRueckfragen({ text: 'Wie?', category: 'question', structured: { text: 'Wie?' } })).toBe(false);
  });

  it('ohne bekannten Typ → true (altes Verhalten)', () => {
    expect(brauchtRueckfragen({ text: 'x' })).toBe(true);
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

  it('resettet den Chat und zielt auf den gpt-oss (Pitfall #36 + gpt-oss-120b)', async () => {
    const submitMessage = vi.fn<AITransport['submitMessage']>(async () => '```json\n{"fragen":["Q"]}\n```');
    const transport = fakeTransport('Streamlit', submitMessage);
    await askClarifyingQuestions(transport, { text: 'x' }, CONTEXT, 'antraege');
    expect(transport.resetChat).toHaveBeenCalledWith('standard');
    expect(submitMessage.mock.calls[0]?.[2]).toMatchObject({ ziel: 'standard' });
  });

  it('lückenlos ausgefülltes Formular → [] OHNE LLM-Aufruf (spart den halben Ablauf)', async () => {
    const submitMessage = vi.fn();
    const transport = fakeTransport('Streamlit', submitMessage);
    const result = await askClarifyingQuestions(transport, IDEA_VOLLSTAENDIG, CONTEXT, 'antraege');
    expect(result).toEqual([]);
    expect(submitMessage).not.toHaveBeenCalled();
    expect(transport.resetChat).not.toHaveBeenCalled();
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

  it('jeder Lauf resettet den Chat und zielt auf Standard — auch der Retry', async () => {
    let call = 0;
    const submitMessage = vi.fn<AITransport['submitMessage']>(async () => {
      call++;
      return call === 1 ? 'Kein JSON.' : '```json\n{"verbesserterText":"VT","category":"bug","summary":"S"}\n```';
    });
    const transport = fakeTransport('Streamlit', submitMessage);
    await improveFeedbackGuided(transport, { text: 'roh' }, [], CONTEXT, 'antraege');
    expect(transport.resetChat).toHaveBeenCalledTimes(2);
    expect(transport.resetChat).toHaveBeenNthCalledWith(2, 'standard');
    expect(submitMessage.mock.calls[1]?.[2]).toMatchObject({ ziel: 'standard' });
  });

  it('die Kategorie aus der Typ-Wahl schlägt den Modell-Vorschlag', async () => {
    const submitMessage = vi.fn(async () => '```json\n{"verbesserterText":"VT","category":"bug","summary":"S"}\n```');
    const result = await improveFeedbackGuided(
      fakeTransport('Streamlit', submitMessage), IDEA_VOLLSTAENDIG, [], CONTEXT, 'antraege',
    );
    expect(result?.classification.category).toBe('feature');
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
