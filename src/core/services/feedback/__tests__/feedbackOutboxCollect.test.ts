/**
 * Tests fuer feedbackOutboxCollect.ts (v2.22 Auto-Einsammeln, v2.42 Auto-Loeschen).
 *
 * Mockt die FS-/Shared-IO-Abhaengigkeiten und prueft die Orchestrierung:
 *  - offene neue Eintraege werden importiert (Outbox-id als FeedbackItem-id),
 *  - bereits in Shared vorhandene id wird NICHT dupliziert,
 *  - nicht-pending Eintraege werden uebersprungen,
 *  - category/structured/attachments werden durchgereicht,
 *  - nach bestaetigtem Shared-Write wird am Ursprung GELOESCHT (Bytes-zuerst),
 *  - schlaegt der Shared-Write fehl, wird NICHT geloescht (approved-Fallback).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/core/services/personal-storage', () => ({
  listOutboxItems: vi.fn(),
  writeOutboxStatus: vi.fn(async () => undefined),
  deleteOutboxItem: vi.fn(async () => undefined),
}));
vi.mock('@/core/services/infrastructure/atomic-write', async (importActual) => {
  const actual = await importActual<typeof import('@/core/services/infrastructure/atomic-write')>();
  return { ...actual, readBinary: vi.fn(async () => new Uint8Array([1, 2, 3])) };
});
vi.mock('../feedbackSharedFile', async (importActual) => {
  const actual = await importActual<typeof import('../feedbackSharedFile')>();
  return {
    ...actual,
    readSharedFile: vi.fn(),
    writeSharedFile: vi.fn(async () => true),
    writeSharedAttachment: vi.fn(async () => true),
  };
});
// Nur emitFeedbackUpdated wird gemockt (DOM-Event); normalizeLegacyFields bleibt
// echt — der Import heilt damit auch die entfallene Kategorie 'ux' (v2.289).
vi.mock('../feedbackStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../feedbackStorage')>()),
  emitFeedbackUpdated: vi.fn(),
}));

import { autoCollectFeedbackOutboxes } from '../feedbackOutboxCollect';
import { listOutboxItems, writeOutboxStatus, deleteOutboxItem } from '@/core/services/personal-storage';
import { readSharedFile, writeSharedFile, writeSharedAttachment } from '../feedbackSharedFile';
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(writeSharedFile).mockResolvedValue(true);
    vi.mocked(writeSharedAttachment).mockResolvedValue(true);
  });

  it('importiert neue Eintraege, dedupt vorhandene, ueberspringt nicht-pending, loescht am Ursprung', async () => {
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

    // Auto-Loeschen: nach bestaetigtem Shared-Write werden BEIDE offenen (A,B)
    // am Ursprung geloescht — NICHT nur 'approved' markiert.
    expect(deleteOutboxItem).toHaveBeenCalledTimes(2);
    expect(writeOutboxStatus).not.toHaveBeenCalled();
  });

  // Alt-Clients koennen weiterhin die entfallene Kategorie 'ux' liefern — der
  // Import heilt sie auf 'idea' (normalizeLegacyFields, v2.289).
  it('reicht category + structured + attachments durch (ux wird migriert) und kopiert Bytes vor dem Loeschen', async () => {
    vi.mocked(readSharedFile).mockResolvedValue(null);
    vi.mocked(listOutboxItems).mockResolvedValue([
      {
        id: 'X', kuerzel: 'AAA', submitted_at: '2026-06-01T10:00:00.000Z',
        text: 'Was ist passiert?\nAbsturz', status: 'pending',
        category: 'ux', structured: { pain: 'umständlich' },
        attachments: [{ id: 'a1', filename: 'X-a1.png', mime: 'image/png', width: 800, height: 600, bytes: 99 }],
      },
    ] as never);

    await autoCollectFeedbackOutboxes(storage, rootWithOneUser(), 'KUR');

    const written = vi.mocked(writeSharedFile).mock.calls[0]![1];
    const x = written.find(i => i.id === 'X')!;
    expect(x.category).toBe('idea');
    expect(x.structured).toEqual({ goal: 'umständlich' });
    expect(x.attachments).toEqual([{ id: 'a1', filename: 'X-a1.png', mime: 'image/png', width: 800, height: 600, bytes: 99 }]);

    // Bytes ins Shared kopiert + danach am Ursprung geloescht.
    expect(writeSharedAttachment).toHaveBeenCalledWith(storage, 'X-a1.png', expect.anything());
    expect(deleteOutboxItem).toHaveBeenCalledTimes(1);
    expect(writeOutboxStatus).not.toHaveBeenCalled();
  });

  it('reicht die KI-Verbesserung durch (original_text + llm_summary + llm_classification)', async () => {
    vi.mocked(readSharedFile).mockResolvedValue(null);
    vi.mocked(listOutboxItems).mockResolvedValue([
      {
        id: 'V', kuerzel: 'AAA', submitted_at: '2026-07-09T10:00:00.000Z',
        text: 'Die Suche sollte Tippfehler tolerieren.', status: 'pending',
        original_text: 'suche kaputt bei vertipper',
        llm_summary: 'Fuzzy-Suche gewünscht',
        llm_classification: { category: 'feature', summary: 'Fuzzy-Suche gewünscht', anforderung: 'Ist: exakt. Soll: fuzzy.', verbessert: true },
      },
    ] as never);

    await autoCollectFeedbackOutboxes(storage, rootWithOneUser(), 'KUR');

    const written = vi.mocked(writeSharedFile).mock.calls[0]![1];
    const v = written.find(i => i.id === 'V')!;
    expect(v.text).toBe('Die Suche sollte Tippfehler tolerieren.');
    expect(v.original_text).toBe('suche kaputt bei vertipper');
    expect(v.llm_summary).toBe('Fuzzy-Suche gewünscht');
    expect(v.llm_classification?.anforderung).toBe('Ist: exakt. Soll: fuzzy.');
  });

  it('loescht NICHT, wenn der Shared-Write fehlschlaegt (approved-Fallback)', async () => {
    vi.mocked(readSharedFile).mockResolvedValue(null);
    vi.mocked(writeSharedFile).mockResolvedValue(false);
    vi.mocked(listOutboxItems).mockResolvedValue([ob('A', 'pending')] as never);

    await autoCollectFeedbackOutboxes(storage, rootWithOneUser(), 'KUR');

    expect(deleteOutboxItem).not.toHaveBeenCalled();
    expect(writeOutboxStatus).toHaveBeenCalledTimes(1);
    const status = vi.mocked(writeOutboxStatus).mock.calls[0]![1];
    expect(status.status).toBe('approved');
    expect(status.reviewer_kuerzel).toBe('KUR');
  });

  it('ohne offene Eintraege: kein Shared-Write, kein Loeschen', async () => {
    vi.mocked(readSharedFile).mockResolvedValue(null);
    vi.mocked(listOutboxItems).mockResolvedValue([ob('C', 'approved')] as never);

    const res = await autoCollectFeedbackOutboxes(storage, rootWithOneUser(), 'KUR');

    expect(res).toEqual({ scanned: 0, imported: 0 });
    expect(writeSharedFile).not.toHaveBeenCalled();
    expect(writeOutboxStatus).not.toHaveBeenCalled();
    expect(deleteOutboxItem).not.toHaveBeenCalled();
  });
});
