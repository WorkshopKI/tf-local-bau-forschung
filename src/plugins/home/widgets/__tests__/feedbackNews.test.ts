/**
 * Tests für den Feedback-Neuigkeiten-Selektor (Phase 1 v1.1): die drei
 * Ereignisarten (Antwort/Neu-vom-Team/Stimmen), Anker-Verschiebung
 * (schnappschuss), Kappung, Leerzustand, mit + ohne Identität (meId).
 * Die djb2-Wiederverwendung (kein Duplikat) sichert der Convention-Guard
 * `djb2-single-source`.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { signatureOf } from '@/components/feedback/useUnreadReplies';
import {
  berechneFeedbackNews,
  schnappschuss,
  type FeedbackNewsAnker,
} from '../feedbackNews';

const NOW = Date.parse('2026-07-13T00:00:00.000Z');
const ME = 'THU';

function fb(partial: Partial<FeedbackItem> & { id: string }): FeedbackItem {
  return {
    created_at: '2026-06-01T00:00:00.000Z',
    user_id: ME,
    text: `Ticket ${partial.id}`,
    category: 'idea',
    kurator_status: 'neu' as FeedbackStatus,
    ...partial,
  } as FeedbackItem;
}

const LEER_ANKER: FeedbackNewsAnker = {
  anker: '2026-01-01T00:00:00.000Z',
  stimmenStand: {},
  antwortStand: {},
};

describe('berechneFeedbackNews — Ereignisarten', () => {
  it('Antwort: eigenes Ticket mit neuer Team-Antwort (Signatur ungleich Anker)', () => {
    const news = berechneFeedbackNews(
      [fb({ id: 'A', kurator_status: 'umgesetzt', category: 'problem', kurator_response: 'Erledigt!' })],
      ME, LEER_ANKER, 3, NOW,
    );
    expect(news.map(n => n.art)).toEqual(['antwort']);
    expect(news[0]!.text).toContain('wurde umgesetzt');
    expect(news[0]!.badgeLabel).toBe('Antwort');
  });

  it('Antwort verschwindet, sobald die Signatur im Anker steht', () => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, antwortStand: { A: signatureOf('Erledigt!') } };
    const news = berechneFeedbackNews(
      [fb({ id: 'A', kurator_status: 'umgesetzt', kurator_response: 'Erledigt!' })],
      ME, anker, 3, NOW,
    );
    expect(news).toEqual([]);
  });

  it('Neu vom Team: fremdes Ticket nach dem Anker, Lob ausgeschlossen', () => {
    const news = berechneFeedbackNews([
      fb({ id: 'T', user_id: 'AND', created_at: '2026-05-01T00:00:00.000Z', category: 'idea', votes: [{ user_id: 'x', created_at: '' }] }),
      fb({ id: 'ALT', user_id: 'AND', created_at: '2025-12-01T00:00:00.000Z' }), // vor Anker → raus
      fb({ id: 'LOB', user_id: 'AND', created_at: '2026-05-01T00:00:00.000Z', category: 'praise' }), // Lob → raus
    ], ME, LEER_ANKER, 3, NOW);
    expect(news.map(n => n.ticketId)).toEqual(['T']);
    expect(news[0]!.art).toBe('neu-team');
    expect(news[0]!.meta).toContain('1 Stimmen');
    expect(news[0]!.badgeLabel).toBe('Idee');
  });

  it('Stimmen: Zuwachs gegenüber dem gemerkten Stand', () => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, stimmenStand: { S: 1 } };
    const news = berechneFeedbackNews(
      [fb({ id: 'S', kurator_status: 'geplant', votes: [{ user_id: 'a', created_at: '' }, { user_id: 'b', created_at: '' }, { user_id: 'c', created_at: '' }] })],
      ME, anker, 3, NOW,
    );
    expect(news.map(n => n.art)).toEqual(['stimmen']);
    expect(news[0]!.text).toContain('+2 Stimmen');
    expect(news[0]!.meta).toBe('jetzt 3 · Status: Geplant');
  });

  it('kein Stimmen-Ereignis, wenn der Stand gleich bleibt', () => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, stimmenStand: { S: 2 } };
    const news = berechneFeedbackNews(
      [fb({ id: 'S', kurator_status: 'geplant', votes: [{ user_id: 'a', created_at: '' }, { user_id: 'b', created_at: '' }] })],
      ME, anker, 3, NOW,
    );
    expect(news).toEqual([]);
  });
});

describe('berechneFeedbackNews — Kappung, Sortierung, Leerzustand', () => {
  it('kappt auf maxEintraege, neueste zuerst', () => {
    const items = [
      fb({ id: 'N1', user_id: 'AND', created_at: '2026-03-01T00:00:00.000Z' }),
      fb({ id: 'N2', user_id: 'AND', created_at: '2026-05-01T00:00:00.000Z' }),
      fb({ id: 'N3', user_id: 'AND', created_at: '2026-04-01T00:00:00.000Z' }),
    ];
    const news = berechneFeedbackNews(items, ME, LEER_ANKER, 2, NOW);
    expect(news.map(n => n.ticketId)).toEqual(['N2', 'N3']); // neueste zuerst, gekappt
  });

  it('Leerzustand: keine Änderungen → []', () => {
    const anker = schnappschuss(
      [fb({ id: 'A', kurator_status: 'geplant', votes: [{ user_id: 'x', created_at: '' }] })],
      ME, '2026-07-01T00:00:00.000Z',
    );
    const news = berechneFeedbackNews(
      [fb({ id: 'A', kurator_status: 'geplant', votes: [{ user_id: 'x', created_at: '' }] })],
      ME, anker, 3, NOW,
    );
    expect(news).toEqual([]);
  });
});

describe('schnappschuss — Stände der eigenen Tickets', () => {
  it('erfasst Stimmen + Antwort-Signatur der eigenen Tickets', () => {
    const anker = schnappschuss([
      fb({ id: 'A', kurator_status: 'umgesetzt', votes: [{ user_id: 'x', created_at: '' }], kurator_response: 'Danke!' }),
      fb({ id: 'FREMD', user_id: 'AND', kurator_status: 'neu' }),
    ], ME, '2026-07-13T00:00:00.000Z');
    expect(anker.stimmenStand).toEqual({ A: 1 });
    expect(anker.antwortStand).toEqual({ A: signatureOf('Danke!') });
    expect(anker.anker).toBe('2026-07-13T00:00:00.000Z');
  });

  it('ohne meId: keine Stände (nichts als „eigen")', () => {
    const anker = schnappschuss([fb({ id: 'A', kurator_status: 'neu', votes: [{ user_id: 'x', created_at: '' }] })], undefined, 'x');
    expect(anker.stimmenStand).toEqual({});
    expect(anker.antwortStand).toEqual({});
  });
});

describe('berechneFeedbackNews — ohne Identität (kein meId)', () => {
  it('behandelt eigene Tickets NICHT als Antwort/Stimmen (kein eigen-Zweig)', () => {
    const news = berechneFeedbackNews(
      [fb({ id: 'A', kurator_status: 'umgesetzt', created_at: '2026-05-01T00:00:00.000Z', kurator_response: 'x', votes: [{ user_id: 'v', created_at: '' }] })],
      undefined, LEER_ANKER, 3, NOW,
    );
    // Ohne meId ist alles „vom Team" (kein Antwort/Stimmen-Ereignis)
    expect(news.every(n => n.art === 'neu-team')).toBe(true);
  });
});
