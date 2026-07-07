/**
 * Tests fuer mergeVotesIntoItems (v2.199): Union eingesammelter Vote-Dateien in
 * die zentrale feedback.json — mit Retraktion + Schutz fremder Stimmen.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem, FeedbackVote } from '@/core/types/feedback';
import type { VoteFile } from '../feedbackVoteOutbox';
import { mergeVotesIntoItems } from '../mergeFeedbackVotes';

function item(id: string, votes?: FeedbackVote[]): FeedbackItem {
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
    ...(votes ? { votes } : {}),
  };
}
function voteFile(kuerzel: string, ticketIds: string[]): VoteFile {
  return { version: 1, kuerzel, ticketIds, updatedAt: '2026-07-07T11:00:00Z' };
}

describe('mergeVotesIntoItems', () => {
  it('fuegt eine neue Stimme hinzu', () => {
    const res = mergeVotesIntoItems([item('A')], [voteFile('TH', ['A'])]);
    expect(res.neu).toBe(1);
    expect(res.entfernt).toBe(0);
    expect(res.items[0]?.votes?.map(v => v.user_id)).toEqual(['TH']);
  });

  it('entfernt eine zurueckgezogene Stimme (Retraktion via Abwesenheit)', () => {
    const withVote = item('A', [{ user_id: 'TH', created_at: 't' }]);
    const res = mergeVotesIntoItems([withVote], [voteFile('TH', [])]);
    expect(res.entfernt).toBe(1);
    expect(res.items[0]?.votes).toEqual([]);
  });

  it('laesst fremde Stimmen unberuehrt', () => {
    const withBoth = item('A', [
      { user_id: 'ANNA', created_at: 't' },
      { user_id: 'TH', created_at: 't' },
    ]);
    // Nur THs Datei im Batch → ANNA bleibt, TH bleibt (weiterhin gewuenscht).
    const res = mergeVotesIntoItems([withBoth], [voteFile('TH', ['A'])]);
    expect(res.items[0]?.votes?.map(v => v.user_id).sort()).toEqual(['ANNA', 'TH']);
    expect(res.neu + res.entfernt).toBe(0);
  });

  it('laesst User OHNE Datei im Batch komplett unberuehrt', () => {
    const withAnna = item('A', [{ user_id: 'ANNA', created_at: 't' }]);
    const res = mergeVotesIntoItems([withAnna], [voteFile('TH', ['A'])]);
    // ANNA nicht im Batch → ihre Stimme bleibt; TH kommt hinzu.
    expect(res.items[0]?.votes?.map(v => v.user_id).sort()).toEqual(['ANNA', 'TH']);
    expect(res.neu).toBe(1);
  });

  it('gibt unveraenderte Items als gleiche Referenz zurueck (kein Churn)', () => {
    const a = item('A');
    const res = mergeVotesIntoItems([a], [voteFile('TH', ['B'])]); // betrifft nur B
    expect(res.items[0]).toBe(a);
  });
});
