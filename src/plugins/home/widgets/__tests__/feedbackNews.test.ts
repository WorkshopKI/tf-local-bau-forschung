/**
 * Tests für den Feedback-Neuigkeiten-Selektor (Phase 1 v1.1): die vier
 * Ereignisarten (Antwort/Status/Neu-vom-Team/Stimmen), Anker-Verschiebung
 * (schnappschuss), Nachtragen neuer Beteiligungen (ergaenzeUnbekannte),
 * Kappung, Leerzustand, mit + ohne Identität (meId).
 * Die djb2-Wiederverwendung (kein Duplikat) sichert der Convention-Guard
 * `djb2-single-source`.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { signatureOf } from '@/components/feedback/useUnreadReplies';
import {
  berechneFeedbackNews,
  ergaenzeUnbekannte,
  istBeteiligt,
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
  statusStand: {},
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

describe('berechneFeedbackNews — Statuswechsel (v2.364)', () => {
  it('eigenes Ticket: bekannter Vorwert + Abweichung feuert', () => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, statusStand: { A: 'neu' } };
    const news = berechneFeedbackNews(
      [fb({ id: 'A', category: 'problem', kurator_status: 'in_bearbeitung' })],
      ME, anker, 3, NOW,
    );
    expect(news.map(n => n.art)).toEqual(['status']);
    expect(news[0]!.text).toBe('Dein Problem „Ticket A" ist jetzt In Bearbeitung');
    expect(news[0]!.meta).toBe('vorher Neu');
    expect(news[0]!.badgeLabel).toBe('Status');
  });

  it('UNBEKANNTER Vorwert feuert nicht (kein Schwall bei Alt-Ankern)', () => {
    const news = berechneFeedbackNews(
      [fb({ id: 'A', kurator_status: 'umgesetzt' })],
      ME, LEER_ANKER, 3, NOW,
    );
    expect(news).toEqual([]);
  });

  it('gleicher Status feuert nicht', () => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, statusStand: { A: 'geplant' } };
    const news = berechneFeedbackNews([fb({ id: 'A', kurator_status: 'geplant' })], ME, anker, 3, NOW);
    expect(news).toEqual([]);
  });

  it.each([
    ['Stimme', { votes: [{ user_id: ME, created_at: '' }] }],
    ['Kommentar', { comments: [{ id: 'c1', user_id: ME, text: 'x', created_at: '' }] }],
    ['Sponsoring', { sponsors: [{ user_id: ME, user_display_name: ME, type: 'points' as const, amount: 2, created_at: '' }] }],
  ])('fremdes Ticket mit eigener Beteiligung (%s) feuert', (_name, beteiligung) => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, statusStand: { F: 'neu' } };
    const news = berechneFeedbackNews(
      [fb({ id: 'F', user_id: 'AND', user_display_name: 'Andrea', kurator_status: 'umgesetzt', ...beteiligung })],
      ME, anker, 3, NOW,
    );
    expect(news.map(n => n.art)).toEqual(['status']);
    expect(news[0]!.text).toBe('„Ticket F" ist jetzt Umgesetzt');
    expect(news[0]!.meta).toBe('von Andrea · vorher Neu');
  });

  it('fremdes Ticket OHNE Beteiligung feuert keinen Statuswechsel', () => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, statusStand: { F: 'neu' } };
    const news = berechneFeedbackNews(
      [fb({ id: 'F', user_id: 'AND', created_at: '2025-01-01T00:00:00.000Z', kurator_status: 'umgesetzt' })],
      ME, anker, 3, NOW,
    );
    expect(news).toEqual([]);
  });

  it('Antwortzeile verdrängt die Statuszeile (eine Zeile je Ticket)', () => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, statusStand: { A: 'neu' } };
    const news = berechneFeedbackNews(
      [fb({ id: 'A', kurator_status: 'umgesetzt', kurator_response: 'Erledigt!' })],
      ME, anker, 3, NOW,
    );
    expect(news.map(n => n.art)).toEqual(['antwort']);
  });

  it('beteiligtes fremdes Ticket erscheint nicht doppelt als „Neu vom Team"', () => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, statusStand: { F: 'neu' } };
    const news = berechneFeedbackNews(
      // nach dem Anker angelegt → wäre ohne Beteiligungs-Guard auch 'neu-team'
      [fb({
        id: 'F', user_id: 'AND', created_at: '2026-05-01T00:00:00.000Z',
        kurator_status: 'geplant', votes: [{ user_id: ME, created_at: '' }],
      })],
      ME, anker, 3, NOW,
    );
    expect(news.map(n => n.art)).toEqual(['status']);
  });

  it('Lob bleibt außen vor (kein Workflow)', () => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, statusStand: { L: 'neu' } };
    const news = berechneFeedbackNews(
      [fb({ id: 'L', category: 'praise', kurator_status: 'umgesetzt' })],
      ME, anker, 3, NOW,
    );
    expect(news).toEqual([]);
  });
});

describe('istBeteiligt', () => {
  it('erkennt eigenes Ticket, eigene Stimme, eigenen Kommentar, eigenes Sponsoring', () => {
    expect(istBeteiligt(fb({ id: 'A' }), ME)).toBe(true);
    expect(istBeteiligt(fb({ id: 'B', user_id: 'AND', votes: [{ user_id: ME, created_at: '' }] }), ME)).toBe(true);
    expect(istBeteiligt(fb({ id: 'C', user_id: 'AND', comments: [{ id: 'c', user_id: ME, text: 'x', created_at: '' }] }), ME)).toBe(true);
    expect(istBeteiligt(fb({ id: 'D', user_id: 'AND' }), ME)).toBe(false);
  });

  it('ohne meId nie beteiligt', () => {
    expect(istBeteiligt(fb({ id: 'A' }), undefined)).toBe(false);
  });
});

describe('ergaenzeUnbekannte', () => {
  it('trägt neue Beteiligungen mit dem AKTUELLEN Status nach (nichts rückwirkend neu)', () => {
    const items = [
      fb({ id: 'A', kurator_status: 'geplant' }),                                        // eigenes, unbekannt
      fb({ id: 'F', user_id: 'AND', kurator_status: 'umgesetzt', votes: [{ user_id: ME, created_at: '' }] }),
      fb({ id: 'X', user_id: 'AND', kurator_status: 'neu' }),                            // nicht beteiligt
    ];
    const next = ergaenzeUnbekannte(LEER_ANKER, items, ME);
    expect(next?.statusStand).toEqual({ A: 'geplant', F: 'umgesetzt' });
    expect(next?.anker).toBe(LEER_ANKER.anker); // „gelesen bis" bleibt stehen
    // Der nachgetragene Stand macht das Ticket still — erst der NÄCHSTE Wechsel meldet.
    expect(berechneFeedbackNews(items, ME, next!, 3, NOW).some(n => n.art === 'status')).toBe(false);
  });

  it('bestehende Stände bleiben unangetastet', () => {
    const anker: FeedbackNewsAnker = { ...LEER_ANKER, statusStand: { A: 'neu' } };
    const next = ergaenzeUnbekannte(anker, [fb({ id: 'A', kurator_status: 'umgesetzt' })], ME);
    expect(next).toBeNull(); // A ist bekannt → nichts nachzutragen
  });

  it('idempotent + null ohne Identität', () => {
    const items = [fb({ id: 'A', kurator_status: 'neu' })];
    const eins = ergaenzeUnbekannte(LEER_ANKER, items, ME);
    expect(ergaenzeUnbekannte(eins!, items, ME)).toBeNull();
    expect(ergaenzeUnbekannte(LEER_ANKER, items, undefined)).toBeNull();
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

  it('Status-Stand deckt alle BETEILIGTEN Tickets ab, nicht nur die eigenen', () => {
    const anker = schnappschuss([
      fb({ id: 'A', kurator_status: 'umgesetzt' }),
      fb({ id: 'MIT', user_id: 'AND', kurator_status: 'geplant', comments: [{ id: 'c', user_id: ME, text: 'x', created_at: '' }] }),
      fb({ id: 'FREMD', user_id: 'AND', kurator_status: 'neu' }),
    ], ME, '2026-07-13T00:00:00.000Z');
    expect(anker.statusStand).toEqual({ A: 'umgesetzt', MIT: 'geplant' });
    // Stimmen/Antwort bleiben bewusst auf eigene Tickets beschränkt.
    expect(anker.stimmenStand).toEqual({ A: 0 });
  });

  it('ohne meId: keine Stände (nichts als „eigen")', () => {
    const anker = schnappschuss([fb({ id: 'A', kurator_status: 'neu', votes: [{ user_id: 'x', created_at: '' }] })], undefined, 'x');
    expect(anker.stimmenStand).toEqual({});
    expect(anker.antwortStand).toEqual({});
    expect(anker.statusStand).toEqual({});
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
