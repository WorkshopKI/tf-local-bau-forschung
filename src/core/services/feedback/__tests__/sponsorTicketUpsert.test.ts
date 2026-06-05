/**
 * Tests fuer das Stepper-Upsert + Persistenz von sponsorTicket/unsponsorTicket
 * (v2.32). Schreibbare Rolle (writeSharedFile → true), daher kein Outbox-Pfad.
 *
 * Stateful Mocks fuer Local-/Shared-IO simulieren Persistenz ueber mehrere
 * Aufrufe; budgetService wird gespyt, um die Budget-Deltas zu pruefen.
 * mergeItems bleibt REAL (importActual) → korrekter Union-Merge des Targets.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';

const budgetCalls = vi.hoisted(() => ({
  spend: [] as Array<[string, number]>,
  refund: [] as Array<[string, number]>,
}));
const state = vi.hoisted(() => ({ local: [] as FeedbackItem[], shared: [] as FeedbackItem[] }));

vi.mock('../budgetService', () => ({
  spendPoints: vi.fn((u: string, amt: number) => { budgetCalls.spend.push([u, amt]); return true; }),
  refundPoints: vi.fn((u: string, amt: number) => { budgetCalls.refund.push([u, amt]); }),
}));
vi.mock('../feedbackStorage', () => ({
  loadLocalItems: vi.fn(() => state.local),
  saveLocalItems: vi.fn((items: FeedbackItem[]) => { state.local = items; }),
  emitFeedbackUpdated: vi.fn(),
}));
vi.mock('../feedbackSharedFile', async (importActual) => {
  const actual = await importActual<typeof import('../feedbackSharedFile')>();
  return {
    ...actual,
    readSharedFile: vi.fn(async () => ({ version: 1 as const, updated_at: '', items: state.shared })),
    writeSharedFile: vi.fn(async (_s: unknown, items: FeedbackItem[]) => { state.shared = items; return true; }),
  };
});

import { sponsorTicket, unsponsorTicket } from '../feedbackSponsoring';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';
import { makeFeedback } from './fixtures';
import type { StorageService } from '@/core/services/storage';

const storage = { idb: {} } as unknown as StorageService;
const config = { ...DEFAULT_FEEDBACK_CONFIG };

function pointsOf(items: FeedbackItem[], id: string, userId: string): number | undefined {
  return items.find(i => i.id === id)?.sponsors?.find(s => s.user_id === userId && s.type === 'points')?.amount;
}

describe('sponsorTicket points stepper (upsert + budget)', () => {
  beforeEach(() => {
    budgetCalls.spend.length = 0;
    budgetCalls.refund.length = 0;
    state.local = [];
    state.shared = [makeFeedback({ id: 't', category: 'idea', effort_estimate: 'S', kurator_status: 'neu' })];
  });

  it('erster Klick legt Eintrag an + gibt 1 Punkt aus', async () => {
    const res = await sponsorTicket(storage, 't', sponsor('ME', 1), config);
    expect(res.ok).toBe(true);
    expect(budgetCalls.spend).toEqual([['ME', 1]]);
    expect(pointsOf(state.shared, 't', 'ME')).toBe(1);
  });

  it('hochzählen gibt nur die Differenz aus, kein Duplikat-Eintrag', async () => {
    await sponsorTicket(storage, 't', sponsor('ME', 1), config);
    await sponsorTicket(storage, 't', sponsor('ME', 3), config); // 1 → 3
    expect(budgetCalls.spend).toEqual([['ME', 1], ['ME', 2]]);
    const entries = state.shared[0]?.sponsors?.filter(s => s.user_id === 'ME' && s.type === 'points') ?? [];
    expect(entries).toHaveLength(1);
    expect(entries[0]?.amount).toBe(3);
  });

  it('runterzählen erstattet die Differenz zurück', async () => {
    await sponsorTicket(storage, 't', sponsor('ME', 3), config);
    await sponsorTicket(storage, 't', sponsor('ME', 2), config); // 3 → 2
    expect(budgetCalls.refund).toEqual([['ME', 1]]);
    expect(pointsOf(state.shared, 't', 'ME')).toBe(2);
  });

  it('unsponsor erstattet den vollen Betrag + entfernt den Eintrag', async () => {
    await sponsorTicket(storage, 't', sponsor('ME', 2), config);
    await unsponsorTicket(storage, 't', 'ME', 'points', config);
    expect(budgetCalls.refund).toEqual([['ME', 2]]);
    expect(state.shared[0]?.sponsors?.some(s => s.user_id === 'ME')).toBe(false);
  });

  it('fremde Stimme bleibt beim Upsert des eigenen Eintrags erhalten', async () => {
    state.shared[0]!.sponsors = [
      { user_id: 'OTHER', user_display_name: 'OTHER', type: 'points', amount: 4, created_at: '2026-01-01T00:00:00Z' },
    ];
    await sponsorTicket(storage, 't', sponsor('ME', 2), config);
    expect(pointsOf(state.shared, 't', 'OTHER')).toBe(4);
    expect(pointsOf(state.shared, 't', 'ME')).toBe(2);
    // Lokal nur die EIGENE Stimme (Anti-Stale-Regel).
    expect(state.local[0]?.sponsors?.every(s => s.user_id === 'ME')).toBe(true);
  });
});

function sponsor(userId: string, amount: number) {
  return {
    user_id: userId,
    user_display_name: userId,
    type: 'points' as const,
    amount,
    created_at: '2026-06-05T10:00:00Z',
  };
}
