/**
 * Tests für feedbackQaSegments — die Frage-/Antwort-Zerlegung der Listen-Vorschau.
 * Reihenfolge der Quellen: llm_summary → structured+Labels → Text-Fallback.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';
import { composeFeedbackText, FEEDBACK_TYPES } from '../constants';
import { feedbackQaSegments } from '../feedbackUi';

function ticket(partial: Partial<FeedbackItem>): FeedbackItem {
  return {
    id: 't1',
    created_at: '2026-07-07T10:00:00Z',
    user_id: 'TH',
    text: '',
    context: {
      route: 'x', page: 'Förderanträge', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-07T10:00:00Z',
    },
    kurator_status: 'neu',
    ...partial,
  };
}

const bug = FEEDBACK_TYPES.find(t => t.category === 'problem')!;

describe('feedbackQaSegments', () => {
  it('zerlegt structured-Felder in Frage/Antwort-Paare in Feld-Reihenfolge', () => {
    const segs = feedbackQaSegments(ticket({
      category: 'problem',
      structured: { steps: 'test 1', actual: 'test 2' },
    }));
    expect(segs).toEqual([
      { frage: 'Was hast du gemacht?', antwort: 'test 1' },
      { frage: 'Was ist passiert?', antwort: 'test 2' },
    ]);
  });

  it('lässt leere structured-Felder weg', () => {
    const segs = feedbackQaSegments(ticket({
      category: 'problem',
      structured: { steps: '', actual: 'nur das', expected: '   ' },
    }));
    expect(segs).toEqual([{ frage: 'Was ist passiert?', antwort: 'nur das' }]);
  });

  it('rendert Ein-Feld-Typen (Lob) ohne Frage-Präfix', () => {
    const segs = feedbackQaSegments(ticket({
      category: 'praise',
      structured: { text: 'seite gut' },
    }));
    expect(segs).toEqual([{ antwort: 'seite gut' }]);
  });

  it('nutzt llm_summary als einzeiligen Antwort-Block (kein Q&A)', () => {
    const segs = feedbackQaSegments(ticket({
      category: 'problem',
      structured: { steps: 'a', actual: 'b' },
      llm_summary: 'Kurz zusammengefasst.',
    }));
    expect(segs).toEqual([{ antwort: 'Kurz zusammengefasst.' }]);
  });

  it('fällt für Alt-Tickets ohne structured auf den komponierten Text zurück', () => {
    const text = composeFeedbackText(bug, { steps: 'test 1', actual: 'test 2' });
    const segs = feedbackQaSegments(ticket({ category: 'problem', text }));
    expect(segs).toEqual([
      { frage: 'Was hast du gemacht?', antwort: 'test 1' },
      { frage: 'Was ist passiert?', antwort: 'test 2' },
    ]);
  });

  it('behält mehrzeilige Antworten aus structured ungeteilt', () => {
    const segs = feedbackQaSegments(ticket({
      category: 'problem',
      structured: { actual: 'Zeile 1\n\nZeile 2' },
    }));
    expect(segs).toEqual([{ frage: 'Was ist passiert?', antwort: 'Zeile 1\n\nZeile 2' }]);
  });

  it('liefert für leeres Feedback keine Segmente', () => {
    expect(feedbackQaSegments(ticket({ text: '' }))).toEqual([]);
  });
});
