/**
 * Tests für die Redesign-Präsentationshelfer (v2.199): Titel-Ableitung,
 * Kurz-Labels in den Q&A-Segmenten, Avatar-Initialen/-Farbe.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';
import { feedbackTitle, feedbackQaSegments } from '../feedbackUi';
import { avatarInitials, avatarColor } from '../FeedbackAvatar';

function ticket(partial: Partial<FeedbackItem>): FeedbackItem {
  return {
    id: 't1',
    created_at: '2026-07-07T10:00:00Z',
    user_id: 'TH',
    text: '',
    context: {
      route: 'x', page: 'p', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-07T10:00:00Z',
    },
    kurator_status: 'neu',
    ...partial,
  };
}

describe('feedbackTitle', () => {
  it('bevorzugt den expliziten Titel', () => {
    expect(feedbackTitle(ticket({ title: 'Mein Titel' }))).toBe('Mein Titel');
  });

  it('leitet aus der Hauptantwort je Kategorie ab', () => {
    expect(feedbackTitle(ticket({ category: 'problem', structured: { actual: 'Sortierung falsch' } })))
      .toBe('Sortierung falsch');
    expect(feedbackTitle(ticket({ category: 'idea', structured: { goal: 'Spalte sortieren' } })))
      .toBe('Spalte sortieren');
    expect(feedbackTitle(ticket({ category: 'praise', structured: { text: 'Seite gut' } })))
      .toBe('Seite gut');
  });

  it('kürzt lange Titel mit Ellipse', () => {
    const long = 'x'.repeat(200);
    const out = feedbackTitle(ticket({ title: long }), 20);
    expect(out.length).toBe(20);
    expect(out.endsWith('…')).toBe(true);
  });

  it('fällt auf llm_summary / erste Textzeile zurück', () => {
    expect(feedbackTitle(ticket({ llm_summary: 'Zusammenfassung' }))).toBe('Zusammenfassung');
    expect(feedbackTitle(ticket({ text: 'erste Zeile\nzweite' }))).toBe('erste Zeile');
  });
});

describe('feedbackQaSegments — shortFrage', () => {
  it('liefert das Kurz-Label je Feld', () => {
    const segs = feedbackQaSegments(ticket({
      category: 'problem',
      structured: { steps: 'a', actual: 'b' },
    }));
    expect(segs.map(s => s.shortFrage)).toEqual(['Gemacht', 'Passiert']);
    expect(segs.map(s => s.frage)).toEqual(['Was hast du gemacht?', 'Was ist passiert?']);
  });
});

describe('FeedbackAvatar helpers', () => {
  it('bildet Initialen (Du → DU, Vor-/Nachname → 2 Buchstaben)', () => {
    expect(avatarInitials('Du')).toBe('DU');
    expect(avatarInitials('Anna Merz')).toBe('AM');
    expect(avatarInitials('Jonas')).toBe('J');
    expect(avatarInitials('  ')).toBe('?');
  });

  it('ist deterministisch pro Name', () => {
    expect(avatarColor('Anna Merz')).toBe(avatarColor('Anna Merz'));
  });
});
