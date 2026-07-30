/**
 * Tests der reinen Board-Filter-/Sortier-Logik (v2.364, herausgezogen aus
 * FeedbackBoardPage). Deckt die Kombination Scope × Kategorie × Status × Suche
 * sowie alle fünf Ordnungen ab — der Gleichstand fällt immer auf „neueste zuerst".
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';
import { filterAndSortBoard, matchesBoardFilter, type BoardFilterState } from '../boardFilter';

const CONFIG: FeedbackConfig = DEFAULT_FEEDBACK_CONFIG;
const ME = 'THU';

function fb(id: string, over: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id,
    created_at: '2026-07-01T10:00:00Z',
    user_id: ME,
    text: `Text ${id}`,
    category: 'idea',
    kurator_status: 'neu',
    context: {
      route: 'r', page: 'Förderanträge', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-01T10:00:00Z',
    },
    ...over,
  };
}

const BASIS: BoardFilterState = {
  scope: 'alle', meId: ME, kategorie: '', status: 'alle', query: '', sort: 'neu',
};

describe('matchesBoardFilter', () => {
  it('Scope „mir" behält nur eigene, „team" nur fremde Tickets', () => {
    const eigen = fb('A');
    const fremd = fb('B', { user_id: 'AND' });
    expect(matchesBoardFilter(eigen, { ...BASIS, scope: 'mir' })).toBe(true);
    expect(matchesBoardFilter(fremd, { ...BASIS, scope: 'mir' })).toBe(false);
    expect(matchesBoardFilter(eigen, { ...BASIS, scope: 'team' })).toBe(false);
    expect(matchesBoardFilter(fremd, { ...BASIS, scope: 'team' })).toBe(true);
  });

  it('ohne Identität liefert „mir" nichts und „team" alles', () => {
    const ohneId: BoardFilterState = { ...BASIS, meId: undefined };
    expect(matchesBoardFilter(fb('A'), { ...ohneId, scope: 'mir' })).toBe(false);
    expect(matchesBoardFilter(fb('A'), { ...ohneId, scope: 'team' })).toBe(true);
  });

  it('Kategorie- und Status-Filter greifen einzeln', () => {
    expect(matchesBoardFilter(fb('A', { category: 'problem' }), { ...BASIS, kategorie: 'problem' })).toBe(true);
    expect(matchesBoardFilter(fb('A', { category: 'idea' }), { ...BASIS, kategorie: 'problem' })).toBe(false);
    expect(matchesBoardFilter(fb('A', { kurator_status: 'geplant' }), { ...BASIS, status: 'geplant' })).toBe(true);
    expect(matchesBoardFilter(fb('A', { kurator_status: 'neu' }), { ...BASIS, status: 'geplant' })).toBe(false);
  });

  it('Status „lob" ist ein Kategorie-Filter, kein Statuswert', () => {
    expect(matchesBoardFilter(fb('A', { category: 'praise' }), { ...BASIS, status: 'lob' })).toBe(true);
    expect(matchesBoardFilter(fb('A', { category: 'idea' }), { ...BASIS, status: 'lob' })).toBe(false);
  });

  it('Suche greift auf Titel, Text und Seite — und ignoriert Groß/Kleinschreibung', () => {
    const t = fb('A', { title: 'Zwischenablage kopieren', text: 'FKZ per Klick' });
    expect(matchesBoardFilter(t, { ...BASIS, query: 'zwischenablage' })).toBe(true);
    expect(matchesBoardFilter(t, { ...BASIS, query: 'FKZ' })).toBe(true);
    expect(matchesBoardFilter(t, { ...BASIS, query: 'förderanträge' })).toBe(true); // context.page
    expect(matchesBoardFilter(t, { ...BASIS, query: 'gibtesnicht' })).toBe(false);
  });

  it('leere Suche (nur Leerzeichen) filtert nicht', () => {
    expect(matchesBoardFilter(fb('A'), { ...BASIS, query: '   ' })).toBe(true);
  });
});

describe('filterAndSortBoard — Ordnungen', () => {
  const alt = fb('ALT', { created_at: '2026-06-01T10:00:00Z' });
  const neu = fb('NEU', { created_at: '2026-07-20T10:00:00Z' });

  it('„neu": neueste zuerst', () => {
    expect(filterAndSortBoard([alt, neu], BASIS, CONFIG).map(t => t.id)).toEqual(['NEU', 'ALT']);
  });

  it('„kmt": meiste Kommentare zuerst, Gleichstand → neueste', () => {
    const viel = fb('VIEL', {
      created_at: '2026-06-01T10:00:00Z',
      comments: [
        { id: 'c1', user_id: 'a', text: 'x', created_at: '' },
        { id: 'c2', user_id: 'b', text: 'y', created_at: '' },
      ],
    });
    expect(filterAndSortBoard([neu, viel], { ...BASIS, sort: 'kmt' }, CONFIG).map(t => t.id))
      .toEqual(['VIEL', 'NEU']);
  });

  it('„pkt": mehr Sponsoring-Punkte zuerst', () => {
    const gesponsert = fb('SPON', {
      created_at: '2026-06-01T10:00:00Z', effort_estimate: 'S',
      sponsors: [{ user_id: 'a', user_display_name: 'A', type: 'points', amount: 4, created_at: '' }],
      sponsor_points_total: 4,
    });
    expect(filterAndSortBoard([neu, gesponsert], { ...BASIS, sort: 'pkt' }, CONFIG).map(t => t.id))
      .toEqual(['SPON', 'NEU']);
  });

  it('„sup": mehr Sponsoren zuerst', () => {
    const zwei = fb('ZWEI', {
      created_at: '2026-06-01T10:00:00Z', effort_estimate: 'S',
      sponsors: [
        { user_id: 'a', user_display_name: 'A', type: 'points', amount: 1, created_at: '' },
        { user_id: 'b', user_display_name: 'B', type: 'points', amount: 1, created_at: '' },
      ],
    });
    expect(filterAndSortBoard([neu, zwei], { ...BASIS, sort: 'sup' }, CONFIG).map(t => t.id))
      .toEqual(['ZWEI', 'NEU']);
  });

  it('„naht": kurz vors Ziel zuerst, ERREICHTE Ziele sinken nach unten', () => {
    // Schwelle S = 5 Punkte (DEFAULT_SPONSORING_THRESHOLDS).
    const knapp = fb('KNAPP', {
      effort_estimate: 'S',
      sponsors: [{ user_id: 'a', user_display_name: 'A', type: 'points', amount: 4, created_at: '' }],
    });
    const erreicht = fb('ERREICHT', {
      effort_estimate: 'S',
      sponsors: [{ user_id: 'b', user_display_name: 'B', type: 'points', amount: 9, created_at: '' }],
    });
    expect(filterAndSortBoard([erreicht, knapp], { ...BASIS, sort: 'naht' }, CONFIG).map(t => t.id))
      .toEqual(['KNAPP', 'ERREICHT']);
  });

  it('lässt die Eingabeliste unangetastet', () => {
    const eingabe = [alt, neu];
    filterAndSortBoard(eingabe, BASIS, CONFIG);
    expect(eingabe.map(t => t.id)).toEqual(['ALT', 'NEU']);
  });
});
