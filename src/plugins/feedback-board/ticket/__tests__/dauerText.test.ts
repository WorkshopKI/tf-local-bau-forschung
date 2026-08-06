/**
 * Guard für die eine Aussage, auf die sich der Melder verlässt: „Was ist mit
 * meinem Ticket, und wie lange dauert es?"
 *
 * Der Entwickler setzt eine T-Shirt-Größe — hier entsteht daraus Zeit. Geht das
 * schief, liest der Ersteller eine falsche Zusage, ohne dass irgendwo ein Fehler
 * auftaucht.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { dauerAussage } from '../dauerText';

function fb(over: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: 'fb-1',
    created_at: '2026-07-01T10:00:00Z',
    user_id: 'THU',
    text: 'Text',
    category: 'idea',
    kurator_status: 'neu',
    context: {
      route: 'r', page: 'p', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-01T10:00:00Z',
    },
    ...over,
  };
}

describe('dauerAussage', () => {
  it('ohne Schätzung sagt es das, statt eine Dauer zu erfinden', () => {
    const a = dauerAussage(fb());
    expect(a.ton).toBe('neutral');
    expect(a.text).toContain('Noch nicht geschätzt');
    expect(a.betont).toBeUndefined();
  });

  it('übersetzt die Größe in Zeit und nennt die Einplanung', () => {
    expect(dauerAussage(fb({ kurator_status: 'geplant', effort_estimate: 'M' })).text)
      .toBe('Aufwand M · Umsetzung 8 h · ist eingeplant.');
    expect(dauerAussage(fb({ kurator_status: 'in_bearbeitung', effort_estimate: 'L' })).text)
      .toBe('Aufwand L · Umsetzung 2 Tage · wird gerade umgesetzt.');
    expect(dauerAussage(fb({ kurator_status: 'neu', effort_estimate: 'XS' })).text)
      .toBe('Aufwand XS · Umsetzung 2 h · ist noch nicht eingeplant.');
  });

  // Die Reihenfolge ist die eigentliche Aussage dieses Moduls: wer eine
  // Rückfrage offen hat, soll nicht zuerst lesen, wie lange die Umsetzung
  // dauern würde — er ist dran, nicht das Team.
  it('stellt „wartet auf dich" VOR die Dauer, auch wenn geschätzt ist', () => {
    const a = dauerAussage(fb({ kurator_status: 'rueckfrage', effort_estimate: 'M' }));
    expect(a.ton).toBe('wartet');
    expect(a.betont).toBe('Wartet auf dich.');
    expect(a.text).not.toContain('8 h');
  });

  it('meldet Endzustände als solche, nicht als Restlaufzeit', () => {
    const fertig = dauerAussage(fb({ kurator_status: 'umgesetzt', effort_estimate: 'XL' }));
    expect(fertig.ton).toBe('fertig');
    expect(fertig.betont).toBe('Umgesetzt.');

    const abgelehnt = dauerAussage(fb({ kurator_status: 'abgelehnt', effort_estimate: 'XL' }));
    expect(abgelehnt.ton).toBe('neutral');
    expect(abgelehnt.text).toContain('Wird nicht umgesetzt');
  });

  it('verweist bei Ablehnung nur dann auf die Begründung, wenn es eine gibt', () => {
    expect(dauerAussage(fb({ kurator_status: 'abgelehnt' })).text)
      .toBe('Wird nicht umgesetzt.');
    expect(dauerAussage(fb({ kurator_status: 'abgelehnt', kurator_response: 'Zu teuer.' })).text)
      .toContain('Antwort des Teams');
  });

  it('liefert für JEDEN Status eine Aussage — Schweigen wäre die schlechteste Antwort', () => {
    const alle: FeedbackStatus[] = [
      'neu', 'rueckfrage', 'geplant', 'in_bearbeitung', 'umgesetzt', 'abgelehnt', 'archiviert',
    ];
    for (const s of alle) {
      const a = dauerAussage(fb({ kurator_status: s, effort_estimate: 'M' }));
      expect(a.text.length, s).toBeGreaterThan(10);
    }
  });
});
