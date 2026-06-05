import { describe, expect, it } from 'vitest';
import { mergeItems, unionMergeSponsors } from '../feedbackSharedFile';
import { makeFeedback, makeSponsor } from './fixtures';

describe('mergeItems', () => {
  it('konkateniert disjunkte IDs', () => {
    const local = [makeFeedback({ id: 'a' }), makeFeedback({ id: 'b' })];
    const shared = [makeFeedback({ id: 'c' })];
    const merged = mergeItems(local, shared);
    expect(merged.map(i => i.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('User-Felder gewinnen lokal: text/context/stars/llm_*', () => {
    const localItem = makeFeedback({
      id: 'x',
      text: 'lokal aktualisierter Text',
      stars: 5,
      llm_summary: 'lokal',
    });
    const sharedItem = makeFeedback({
      id: 'x',
      text: 'shared (alt)',
      stars: 3,
      llm_summary: 'shared',
    });
    const merged = mergeItems([localItem], [sharedItem]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.text).toBe('lokal aktualisierter Text');
    expect(merged[0]?.stars).toBe(5);
    expect(merged[0]?.llm_summary).toBe('lokal');
  });

  it('Kurator-Felder gewinnen shared: kurator_status/notes/priority', () => {
    const localItem = makeFeedback({
      id: 'x',
      kurator_status: 'neu',
      kurator_priority: 1,
      kurator_notes: 'lokal-notizen',
    });
    const sharedItem = makeFeedback({
      id: 'x',
      kurator_status: 'umgesetzt',
      kurator_priority: 5,
      kurator_notes: 'kurator-notizen',
    });
    const merged = mergeItems([localItem], [sharedItem]);
    expect(merged[0]?.kurator_status).toBe('umgesetzt');
    expect(merged[0]?.kurator_priority).toBe(5);
    expect(merged[0]?.kurator_notes).toBe('kurator-notizen');
  });

  it('Sponsoring-Felder bleiben shared (Phase 3)', () => {
    const localItem = makeFeedback({
      id: 'x',
      sponsor_points_total: 0,
    });
    const sharedItem = makeFeedback({
      id: 'x',
      sponsor_points_total: 12,
      sponsor_hours_total: 4,
    });
    const merged = mergeItems([localItem], [sharedItem]);
    expect(merged[0]?.sponsor_points_total).toBe(12);
    expect(merged[0]?.sponsor_hours_total).toBe(4);
  });

  it('llm_classification: lokal-wins wenn lokal gesetzt, sonst shared', () => {
    const localItem = makeFeedback({
      id: 'x',
      llm_classification: undefined,
    });
    const sharedItem = makeFeedback({
      id: 'x',
      llm_classification: {
        category: 'feature',
        summary: 'shared',
        details: '...',
        affectedArea: 'antraege',
        priority_suggestion: 3,
      },
    });
    const merged = mergeItems([localItem], [sharedItem]);
    expect(merged[0]?.llm_classification?.summary).toBe('shared');
  });

  it('sortiert absteigend nach created_at', () => {
    const a = makeFeedback({ id: 'a', created_at: '2026-01-01T00:00:00Z' });
    const b = makeFeedback({ id: 'b', created_at: '2026-03-01T00:00:00Z' });
    const c = makeFeedback({ id: 'c', created_at: '2026-02-01T00:00:00Z' });
    const merged = mergeItems([a, c], [b]);
    expect(merged.map(i => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('leeres local + shared = shared', () => {
    const shared = [makeFeedback({ id: 'a' }), makeFeedback({ id: 'b' })];
    const merged = mergeItems([], shared);
    expect(merged).toHaveLength(2);
  });

  it('local + leeres shared = local', () => {
    const local = [makeFeedback({ id: 'a' }), makeFeedback({ id: 'b' })];
    const merged = mergeItems(local, []);
    expect(merged).toHaveLength(2);
  });

  // ── v2.32: Sponsors Union-Merge (eigene lokale Stimme überlebt Reload) ──────
  it('eigene lokale Stimme überlebt den Reload (Union)', () => {
    const localItem = makeFeedback({
      id: 'x',
      sponsors: [makeSponsor({ user_id: 'ME', amount: 1 })],
    });
    const sharedItem = makeFeedback({ id: 'x', sponsors: [] });
    const merged = mergeItems([localItem], [sharedItem]);
    expect(merged[0]?.sponsors?.find(s => s.user_id === 'ME')?.amount).toBe(1);
    expect(merged[0]?.sponsor_points_total).toBe(1);
  });

  it('fremde Stimme aus shared bleibt neben eigener lokaler erhalten', () => {
    const localItem = makeFeedback({
      id: 'x',
      sponsors: [makeSponsor({ user_id: 'ME', amount: 1 })],
    });
    const sharedItem = makeFeedback({
      id: 'x',
      sponsors: [makeSponsor({ user_id: 'OTHER', amount: 3 })],
    });
    const merged = mergeItems([localItem], [sharedItem]);
    const ids = (merged[0]?.sponsors ?? []).map(s => `${s.user_id}:${s.amount}`).sort();
    expect(ids).toEqual(['ME:1', 'OTHER:3']);
    expect(merged[0]?.sponsor_points_total).toBe(4);
  });

  it('lokaler eigener Eintrag gewinnt gegen veralteten shared-Eintrag gleichen Keys', () => {
    const localItem = makeFeedback({
      id: 'x',
      sponsors: [makeSponsor({ user_id: 'ME', amount: 2 })],
    });
    const sharedItem = makeFeedback({
      id: 'x',
      sponsors: [makeSponsor({ user_id: 'ME', amount: 1 }), makeSponsor({ user_id: 'OTHER', amount: 5 })],
    });
    const merged = mergeItems([localItem], [sharedItem]);
    expect(merged[0]?.sponsors?.find(s => s.user_id === 'ME')?.amount).toBe(2);
    expect(merged[0]?.sponsor_points_total).toBe(7);
  });

  it('lokal leeres sponsors-Array clobbert den Shared-Stand NICHT', () => {
    const localItem = makeFeedback({ id: 'x', sponsors: [] });
    const sharedItem = makeFeedback({
      id: 'x',
      sponsors: [makeSponsor({ user_id: 'OTHER', amount: 3 })],
      sponsor_points_total: 3,
    });
    const merged = mergeItems([localItem], [sharedItem]);
    expect(merged[0]?.sponsors?.find(s => s.user_id === 'OTHER')?.amount).toBe(3);
    expect(merged[0]?.sponsor_points_total).toBe(3);
  });
});

describe('unionMergeSponsors', () => {
  it('lokal überschreibt nur eigene Keys, fremde shared bleiben', () => {
    const shared = [makeSponsor({ user_id: 'OTHER', amount: 5 }), makeSponsor({ user_id: 'ME', amount: 1 })];
    const local = [makeSponsor({ user_id: 'ME', amount: 3 })];
    const merged = unionMergeSponsors(shared, local);
    expect(merged.find(s => s.user_id === 'ME')?.amount).toBe(3);
    expect(merged.find(s => s.user_id === 'OTHER')?.amount).toBe(5);
  });

  it('Punkte und Stunden desselben Users sind getrennte Keys', () => {
    const local = [
      makeSponsor({ user_id: 'ME', type: 'points', amount: 2 }),
      makeSponsor({ user_id: 'ME', type: 'hours', amount: 8, project_ref: 'BA-1' }),
    ];
    const merged = unionMergeSponsors([], local);
    expect(merged).toHaveLength(2);
  });

  it('undefined-Eingaben → leeres Array', () => {
    expect(unionMergeSponsors(undefined, undefined)).toEqual([]);
  });
});
