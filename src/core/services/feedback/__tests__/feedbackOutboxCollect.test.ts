/**
 * Tests fuer feedbackOutboxCollect.ts (v2.22 — Auto-Einsammeln ohne Review).
 *
 * Mockt die FS-/Shared-IO-Abhaengigkeiten und prueft die Orchestrierung:
 *  - offene neue Eintraege werden importiert (Outbox-id als FeedbackItem-id),
 *  - bereits in Shared vorhandene id wird NICHT dupliziert,
 *  - nicht-pending Eintraege werden uebersprungen,
 *  - alle offenen Outbox-Eintraege werden auf 'approved' zurueckgeschrieben.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/core/services/personal-storage', () => ({
  listOutboxItems: vi.fn(),
  writeOutboxStatus: vi.fn(async () => undefined),
}));
vi.mock('../feedbackSharedFile', async (importActual) => {
  const actual = await importActual<typeof import('../feedbackSharedFile')>();
  return { ...actual, readSharedFile: vi.fn(), writeSharedFile: vi.fn(async () => true) };
});
vi.mock('../feedbackStorage', () => ({ emitFeedbackUpdated: vi.fn() }));

import { autoCollectFeedbackOutboxes } from '../feedbackOutboxCollect';
import { listOutboxItems, writeOutboxStatus } from '@/core/services/personal-storage';
import { readSharedFile, writeSharedFile } from '../feedbackSharedFile';
import type { StorageService } from '@/core/services/storage';
import type { FeedbackItem } from '@/core/types/feedback';

const storage = {} as unknown as StorageService;

function ob(id: string, status: 'pending' | 'approved' | 'rejected', text = id): unknown {
  return { id, kuerzel: 'AAA', submitted_at: '2026-06-0' + id.length + 'T10:00:00.000Z', text, status };
}

/** Root mit genau einem User-Ordner 'alice' → getDirectoryHandle('ZAH') ok. */
function rootWithOneUser(): FileSystemDirectoryHandle {
  const teamflow = { kind: 'directory' };
  const userDir = {
    kind: 'directory',
    getDirectoryHandle: async (n: string) => { if (n === 'ZAH') return teamflow; throw new Error('no'); },
  };
  return {
    kind: 'directory',
    values: async function* () { yield { kind: 'directory', name: 'alice' }; },
    getDirectoryHandle: async (n: string) => { if (n === 'alice') return userDir; throw new Error('no'); },
  } as unknown as FileSystemDirectoryHandle;
}

function sharedItem(id: string): FeedbackItem {
  return {
    id,
    created_at: '2026-05-01T00:00:00.000Z',
    user_id: 'AAA',
    text: id,
    context: { route: 'r', page: 'p', device: 'Desktop', viewport: '0x0', sessionDuration: 0, errors: [], timestamp: '' },
    kurator_status: 'neu',
  };
}

describe('autoCollectFeedbackOutboxes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('importiert offene neue Eintraege, dedupt vorhandene, ueberspringt nicht-pending', async () => {
    vi.mocked(readSharedFile).mockResolvedValue({ version: 1, updated_at: '', items: [sharedItem('B')] });
    vi.mocked(listOutboxItems).mockResolvedValue([
      ob('A', 'pending'), ob('B', 'pending'), ob('C', 'approved'),
    ] as never);

    const res = await autoCollectFeedbackOutboxes(storage, rootWithOneUser(), 'KUR');

    expect(res).toEqual({ scanned: 2, imported: 1 });

    // Shared-Write: einmal, mit A (neu) + B (bestehend) = 2 Items.
    expect(writeSharedFile).toHaveBeenCalledTimes(1);
    const written = vi.mocked(writeSharedFile).mock.calls[0]![1];
    expect(written.map(i => i.id).sort()).toEqual(['A', 'B']);
    const a = written.find(i => i.id === 'A')!;
    expect(a.kurator_status).toBe('neu');
    expect(a.text).toBe('A');

    // Outbox-Status: fuer beide offenen (A,B) auf 'approved', NICHT fuer C.
    expect(writeOutboxStatus).toHaveBeenCalledTimes(2);
    const statuses = vi.mocked(writeOutboxStatus).mock.calls.map(c => c[1]);
    expect(statuses.map(s => s.id).sort()).toEqual(['A', 'B']);
    expect(statuses.every(s => s.status === 'approved' && s.reviewer_kuerzel === 'KUR')).toBe(true);
  });

  it('reicht category + structured aus der Outbox ins FeedbackItem durch', async () => {
    vi.mocked(readSharedFile).mockResolvedValue(null);
    vi.mocked(listOutboxItems).mockResolvedValue([
      {
        id: 'X', kuerzel: 'AAA', submitted_at: '2026-06-01T10:00:00.000Z',
        text: 'Was ist passiert?\nAbsturz', status: 'pending',
        category: 'ux', structured: { pain: 'umständlich', better: 'Button' },
      },
    ] as never);

    await autoCollectFeedbackOutboxes(storage, rootWithOneUser(), 'KUR');

    const written = vi.mocked(writeSharedFile).mock.calls[0]![1];
    const x = written.find(i => i.id === 'X')!;
    expect(x.category).toBe('ux');
    expect(x.structured).toEqual({ pain: 'umständlich', better: 'Button' });
  });

  it('ohne offene Eintraege: kein Shared-Write', async () => {
    vi.mocked(readSharedFile).mockResolvedValue(null);
    vi.mocked(listOutboxItems).mockResolvedValue([ob('C', 'approved')] as never);

    const res = await autoCollectFeedbackOutboxes(storage, rootWithOneUser(), 'KUR');

    expect(res).toEqual({ scanned: 0, imported: 0 });
    expect(writeSharedFile).not.toHaveBeenCalled();
    expect(writeOutboxStatus).not.toHaveBeenCalled();
  });
});
