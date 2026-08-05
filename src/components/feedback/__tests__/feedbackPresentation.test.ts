/**
 * Tests für die Redesign-Präsentationshelfer (v2.199): Titel-Ableitung,
 * Kurz-Labels in den Q&A-Segmenten, Avatar-Initialen/-Farbe.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';
import { berechneKommentarHoehe, clampKommentarHoehe, feedbackTitle, feedbackQaSegments } from '../feedbackUi';
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

  it('kürzt mit maxLen = Infinity nie (normalisiert nur Whitespace)', () => {
    const long = `${'Wort '.repeat(60)}Ende`;
    const out = feedbackTitle(ticket({ title: `  ${long}  ` }), Infinity);
    expect(out).toBe(long.trim());
    expect(out.endsWith('…')).toBe(false);
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

describe('clampKommentarHoehe', () => {
  it('liest nichts Gemerktes als undefined (Grundhöhe gilt)', () => {
    expect(clampKommentarHoehe(null, 56, 320)).toBeUndefined();
    expect(clampKommentarHoehe('', 56, 320)).toBeUndefined();
    expect(clampKommentarHoehe('abc', 56, 320)).toBeUndefined();
  });

  it('klemmt Alt-Einträge in die Grenzen', () => {
    expect(clampKommentarHoehe('20', 56, 320)).toBe(56);
    expect(clampKommentarHoehe('9999', 56, 320)).toBe(320);
    expect(clampKommentarHoehe('120', 56, 320)).toBe(120);
  });
});

describe('berechneKommentarHoehe', () => {
  it('hält das leere Feld auf Grundhöhe', () => {
    expect(berechneKommentarHoehe(20, 62, undefined, 320)).toBe(62);
  });

  it('wächst mit dem Inhalt', () => {
    expect(berechneKommentarHoehe(140, 62, undefined, 320)).toBe(140);
  });

  it('nimmt die gezogene Höhe als Mindesthöhe — nicht als feste Höhe', () => {
    // Gezogen auf 200, wenig Text → bleibt 200 (Ziehen überlebt das Tippen).
    expect(berechneKommentarHoehe(30, 62, 200, 320)).toBe(200);
    // Mehr Text als gezogen → Inhalt gewinnt (der Entwurf wird nicht abgeschnitten).
    expect(berechneKommentarHoehe(260, 62, 200, 320)).toBe(260);
  });

  it('deckelt bei max', () => {
    expect(berechneKommentarHoehe(900, 62, 400, 320)).toBe(320);
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
