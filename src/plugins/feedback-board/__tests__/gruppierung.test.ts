/**
 * Guard für die Swimlane-Gruppierung. Die interessante Regel ist die
 * Bänder-Reihenfolge: beim Aufwand zählt die fachliche Größenordnung, sonst die
 * Menge.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';
import { gruppiere } from '../gruppierung';

function fb(id: string, over: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id,
    created_at: '2026-07-01T10:00:00Z',
    user_id: 'THU',
    text: `Text ${id}`,
    category: 'idea',
    kurator_status: 'neu',
    context: {
      route: 'r', page: 'p', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-01T10:00:00Z',
    },
    ...over,
  };
}

describe('gruppiere', () => {
  it('liefert bei „keine" nichts — der Aufrufer rendert dann ungruppiert', () => {
    expect(gruppiere([fb('A')], 'keine')).toEqual([]);
  });

  it('gruppiert nach Bereich und beschriftet mit dem Klarnamen', () => {
    const g = gruppiere([
      fb('A', { bereich: 'suche' }),
      fb('B', { bereich: 'suche' }),
      fb('C', { bereich: 'antraege' }),
    ], 'bereich');
    expect(g.map(x => [x.key, x.label, x.tickets.length]))
      .toEqual([['suche', 'Suche', 2], ['antraege', 'Förderanträge', 1]]);
  });

  // Nach Häufigkeit sortiert stünde „L" womöglich vor „XS" — die Leiste
  // verlöre ihren Sinn als Größenachse.
  it('ordnet Aufwands-Bänder fachlich (XS → Epic), Ungeschätztes ans Ende', () => {
    const g = gruppiere([
      fb('A', { effort_estimate: 'L' }),
      fb('B', { effort_estimate: 'L' }),
      fb('C', { effort_estimate: 'XS' }),
      fb('D'),
    ], 'aufwand');
    expect(g.map(x => x.key)).toEqual(['XS', 'L', 'ungeschaetzt']);
  });

  it('sortiert sonst das größte Band nach oben', () => {
    const g = gruppiere([
      fb('A', { user_display_name: 'Anna' }),
      fb('B', { user_display_name: 'Bert' }),
      fb('C', { user_display_name: 'Bert' }),
    ], 'ersteller');
    expect(g.map(x => x.label)).toEqual(['Bert', 'Anna']);
  });

  it('fängt Tickets ohne Autor in einem eigenen Band statt sie zu verlieren', () => {
    const g = gruppiere([fb('A', { user_id: 'anonymous' })], 'ersteller');
    expect(g.map(x => [x.key, x.label])).toEqual([['ohne-autor', 'Ohne Angabe']]);
  });

  it('behält innerhalb eines Bandes die Eingabereihenfolge', () => {
    const g = gruppiere([
      fb('Z', { bereich: 'suche' }),
      fb('A', { bereich: 'suche' }),
    ], 'bereich');
    expect(g[0]?.tickets.map(t => t.id)).toEqual(['Z', 'A']);
  });
});
