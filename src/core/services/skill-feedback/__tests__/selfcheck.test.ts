/**
 * Selbst-Verifikation (Phase 5): End-to-End über Mock-Storage. Event schreiben →
 * aggregieren → Reifegrad vorschlagen; verbotenes Feld wird gestrippt; der
 * Degradations-Fallback greift bei nicht-schreibbarem gemeinsamem Verzeichnis.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { readText } from '@/core/services/infrastructure/atomic-write';
import { memRoot } from '@/core/services/infrastructure/__tests__/mem-fs';
import * as smb from '@/core/services/infrastructure/smb-handle';
import { appendFeedback, appendUsage } from '../write';
import { readAggregate } from '../read';
import { suggestReifegrad } from '../maturity';
import { sharedSignalPath } from '../layout';

vi.mock('@/core/services/infrastructure/smb-handle', () => ({
  getDatenShareHandle: vi.fn(),
  getPersoenlichHandle: vi.fn(),
  queryPermission: vi.fn(),
}));

function fakeStorage(): { storage: StorageService; kv: Map<string, unknown> } {
  const kv = new Map<string, unknown>();
  const idb = {
    get: async <T>(key: string): Promise<T | null> => (kv.has(key) ? (kv.get(key) as T) : null),
    set: async (key: string, value: unknown): Promise<void> => { kv.set(key, value); },
    delete: async (key: string): Promise<void> => { kv.delete(key); },
  } as unknown as IDBStore;
  return { storage: { idb } as StorageService, kv };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('skill-feedback — Selbst-Verifikation', () => {
  it('Write → Aggregat → Reifegrad-Vorschlag, ohne Antragsbezug', async () => {
    const share = memRoot();
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(share);
    vi.mocked(smb.queryPermission).mockResolvedValue('granted');
    const { storage } = fakeStorage();

    // 8 Läufe + 4 positive Feedbacks (mit verbotenem Antragsfeld im Feedback).
    for (let i = 0; i < 8; i++) {
      await appendUsage(storage, { skillId: 'kurzfassung', skillVersion: 1, event: 'lauf', ts: `t${i}`, userId: 'AB' });
    }
    for (let i = 0; i < 4; i++) {
      await appendFeedback(storage, {
        skillId: 'kurzfassung', skillVersion: 1, rating: 'up', ts: `f${i}`, userId: 'AB',
        notiz: 'klar', fkz: '16KN012345', vbInhalt: 'geheim',
      });
    }

    // Antragsbezug ist nirgends in den Dateien gelandet.
    const fbFile = (await readText(share, sharedSignalPath('feedback', 'AB')))!;
    expect(fbFile).not.toContain('16KN012345');
    expect(fbFile).not.toContain('geheim');

    const agg = await readAggregate(storage);
    const e = agg.get('kurzfassung')!;
    expect(e.nutzung).toBe(8);
    expect(e.up).toBe(4);
    expect(e.kommentare).toHaveLength(4);

    // 8 Läufe → mind. „erprobt" vorgeschlagen (von „entwurf").
    expect(suggestReifegrad(e, 'entwurf')).toBe('erprobt');
  });

  it('Degradation: read-only Share → Fallback auf persönliche Ablage', async () => {
    const share = memRoot();
    const pers = memRoot();
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(share);
    vi.mocked(smb.queryPermission).mockResolvedValue('denied');
    vi.mocked(smb.getPersoenlichHandle).mockResolvedValue(pers);
    const { storage } = fakeStorage();

    const res = await appendUsage(storage, { skillId: 's', skillVersion: 1, event: 'lauf', ts: 't', userId: 'CD' });
    expect(res.ziel).toBe('personal');

    // Aggregat berücksichtigt die persönliche Ablage.
    const agg = await readAggregate(storage);
    expect(agg.get('s')!.nutzung).toBe(1);
  });
});
