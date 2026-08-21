/**
 * Tests fuer mergeCommentsIntoItems (v2.199): append-only Union eingesammelter
 * Kommentar-Dateien in die zentrale feedback.json (dedup by id, kein Verlust).
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackComment, FeedbackItem } from '@/core/types/feedback';
import type { CommentFile, OutboxComment } from '../feedbackCommentOutbox';
import { mergeCommentsIntoItems } from '../mergeFeedbackComments';

function item(id: string, comments?: FeedbackComment[]): FeedbackItem {
  return {
    id,
    created_at: '2026-07-07T10:00:00Z',
    user_id: 'x',
    text: '',
    context: {
      route: 'x', page: 'p', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-07T10:00:00Z',
    },
    kurator_status: 'neu',
    ...(comments ? { comments } : {}),
  };
}
function file(kuerzel: string, comments: OutboxComment[]): CommentFile {
  return { version: 1, kuerzel, comments, updatedAt: '2026-07-07T11:00:00Z' };
}

describe('mergeCommentsIntoItems', () => {
  it('ergaenzt einen neuen Kommentar', () => {
    const res = mergeCommentsIntoItems(
      [item('A')],
      [file('TH', [{ ticketId: 'A', id: 'c1', text: 'hallo', created_at: 't1' }])],
    );
    expect(res.neu).toBe(1);
    expect(res.items[0]?.comments?.map(c => c.id)).toEqual(['c1']);
    expect(res.items[0]?.comments?.[0]?.user_id).toBe('TH');
  });

  it('dedupt bereits vorhandene Kommentar-ids (kein Doppel-Import)', () => {
    const withC1 = item('A', [{ id: 'c1', user_id: 'TH', text: 'hallo', created_at: 't1' }]);
    const res = mergeCommentsIntoItems(
      [withC1],
      [file('TH', [{ ticketId: 'A', id: 'c1', text: 'hallo', created_at: 't1' }])],
    );
    expect(res.neu).toBe(0);
    expect(res.items[0]).toBe(withC1); // unveraendert = gleiche Referenz
  });

  it('unioned Kommentare aus mehreren Dateien und sortiert nach created_at', () => {
    const res = mergeCommentsIntoItems(
      [item('A', [{ id: 'c0', user_id: 'ANNA', text: 'erst', created_at: '2026-07-07T09:00:00Z' }])],
      [
        file('TH', [{ ticketId: 'A', id: 'c2', text: 'spaeter', created_at: '2026-07-07T12:00:00Z' }]),
        file('JF', [{ ticketId: 'A', id: 'c1', text: 'mitte', created_at: '2026-07-07T11:00:00Z' }]),
      ],
    );
    expect(res.neu).toBe(2);
    expect(res.items[0]?.comments?.map(c => c.id)).toEqual(['c0', 'c1', 'c2']);
  });

  // v5.2: bis dahin verlor der Outbox-Weg die Art — die Ergaenzung eines
  // read-only-Nutzers kam als gewoehnlicher Kommentar an.
  it('nimmt die Art aus der Outbox mit', () => {
    const res = mergeCommentsIntoItems(
      [item('A')],
      [file('TH', [{ ticketId: 'A', id: 'c1', text: 'noch was', created_at: 't1', kind: 'ergaenzung' }])],
    );
    expect(res.items[0]?.comments?.[0]?.kind).toBe('ergaenzung');
  });

  it('laesst Bestandsdaten ohne Art unveraendert (kein kind-Feld)', () => {
    const res = mergeCommentsIntoItems(
      [item('A')],
      [file('TH', [{ ticketId: 'A', id: 'c1', text: 'hallo', created_at: 't1' }])],
    );
    expect(res.items[0]?.comments?.[0]).not.toHaveProperty('kind');
  });

  it('faellt bei unbekannter Art still auf den gewoehnlichen Kommentar zurueck', () => {
    const res = mergeCommentsIntoItems(
      [item('A')],
      // Ein neuerer Client koennte eine Art schreiben, die dieser hier nicht
      // kennt — der Kommentar darf deshalb nicht verloren gehen.
      [file('TH', [{ ticketId: 'A', id: 'c1', text: 'hallo', created_at: 't1', kind: 'quatsch' as never }])],
    );
    expect(res.neu).toBe(1);
    expect(res.items[0]?.comments?.[0]).not.toHaveProperty('kind');
  });

  it('ueberspringt leere Kommentar-Texte', () => {
    const res = mergeCommentsIntoItems(
      [item('A')],
      [file('TH', [{ ticketId: 'A', id: 'c1', text: '   ', created_at: 't1' }])],
    );
    expect(res.neu).toBe(0);
    expect(res.items[0]?.comments).toBeUndefined();
  });
});
