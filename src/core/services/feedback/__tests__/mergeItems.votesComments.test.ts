/**
 * Tests fuer die mergeItems-Precedence der Redesign-Felder (v2.199):
 * votes (Union-by-user, Anti-Stale), comments (Union-by-id, append-only),
 * title (user-lokal-wins).
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';
import { mergeItems } from '../feedbackSharedFile';

function base(id: string, over: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id,
    created_at: '2026-07-07T10:00:00Z',
    user_id: 'TH',
    text: 'lokal',
    context: {
      route: 'x', page: 'p', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-07T10:00:00Z',
    },
    kurator_status: 'neu',
    ...over,
  };
}

describe('mergeItems — votes/comments/title', () => {
  it('unioned eigene lokale Stimme mit fremden shared-Stimmen', () => {
    const local = base('A', { votes: [{ user_id: 'TH', created_at: 't' }] });
    const shared = base('A', { votes: [{ user_id: 'ANNA', created_at: 't' }] });
    const merged = mergeItems([local], [shared]);
    expect(merged[0]?.votes?.map(v => v.user_id).sort()).toEqual(['ANNA', 'TH']);
  });

  it('behaelt shared-Stimmen wenn das lokale Item keine eigene traegt (Anti-Stale)', () => {
    const local = base('A'); // keine votes lokal
    const shared = base('A', { votes: [{ user_id: 'ANNA', created_at: 't' }] });
    const merged = mergeItems([local], [shared]);
    expect(merged[0]?.votes?.map(v => v.user_id)).toEqual(['ANNA']);
  });

  it('unioned Kommentare by id (append-only, nie verlieren)', () => {
    const local = base('A', { comments: [{ id: 'c2', user_id: 'TH', text: 'neu', created_at: '2026-07-07T12:00:00Z' }] });
    const shared = base('A', { comments: [{ id: 'c1', user_id: 'ANNA', text: 'alt', created_at: '2026-07-07T09:00:00Z' }] });
    const merged = mergeItems([local], [shared]);
    expect(merged[0]?.comments?.map(c => c.id)).toEqual(['c1', 'c2']);
  });

  it('title: lokaler Wert gewinnt, faellt sonst auf shared zurueck', () => {
    const localWithTitle = base('A', { title: 'Mein Titel' });
    const sharedWithTitle = base('A', { title: 'Alt-Titel', kurator_status: 'geplant' });
    expect(mergeItems([localWithTitle], [sharedWithTitle])[0]?.title).toBe('Mein Titel');
    // Kein lokaler Titel → shared-Titel bleibt.
    expect(mergeItems([base('A')], [sharedWithTitle])[0]?.title).toBe('Alt-Titel');
  });

  it('Kurator-Felder bleiben shared-wins trotz neuer User-Felder', () => {
    const local = base('A', { votes: [{ user_id: 'TH', created_at: 't' }] });
    const shared = base('A', { kurator_status: 'umgesetzt', kurator_response: 'danke' });
    const merged = mergeItems([local], [shared]);
    expect(merged[0]?.kurator_status).toBe('umgesetzt');
    expect(merged[0]?.kurator_response).toBe('danke');
    expect(merged[0]?.votes?.[0]?.user_id).toBe('TH');
  });
});
