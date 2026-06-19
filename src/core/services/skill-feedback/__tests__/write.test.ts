import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StorageService } from '@/core/services/storage';
import { readText } from '@/core/services/infrastructure/atomic-write';
import { memRoot } from '@/core/services/infrastructure/__tests__/mem-fs';
import * as smb from '@/core/services/infrastructure/smb-handle';
import { appendFeedback, appendUsage } from '../write';
import { personalSignalPath, sharedSignalPath } from '../layout';

vi.mock('@/core/services/infrastructure/smb-handle', () => ({
  getDatenShareHandle: vi.fn(),
  getPersoenlichHandle: vi.fn(),
  queryPermission: vi.fn(),
}));

// idb nur als Träger der mockfreien delete()-Invalidierung; Handle-Auflösung ist gemockt.
const storage = { idb: { delete: vi.fn(async () => undefined) } } as unknown as StorageService;

const FEEDBACK = {
  skillId: 'kurzfassung', skillVersion: 1, rating: 'up' as const, ts: 't1', userId: 'AB',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('appendFeedback / appendUsage — Schreibziel + Guard + JSONL', () => {
  it('granted → schreibt eine gesäuberte JSONL-Zeile in den Share', async () => {
    const share = memRoot();
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(share);
    vi.mocked(smb.queryPermission).mockResolvedValue('granted');

    const res = await appendFeedback(storage, { ...FEEDBACK, notiz: 'gut', fkz: '16KN012345' });
    expect(res.ziel).toBe('share');

    const txt = await readText(share, sharedSignalPath('feedback', 'AB'));
    expect(txt).toBe('{"skillId":"kurzfassung","skillVersion":1,"rating":"up","ts":"t1","userId":"AB","notiz":"gut"}\n');
    expect(txt).not.toContain('fkz'); // Antragsbezug strukturell entfernt
  });

  it('hängt mehrere Events als getrennte Zeilen an (eine Datei pro Nutzer)', async () => {
    const share = memRoot();
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(share);
    vi.mocked(smb.queryPermission).mockResolvedValue('granted');

    await appendUsage(storage, { skillId: 's', skillVersion: 1, event: 'lauf', ts: 't1', userId: 'AB' });
    await appendUsage(storage, { skillId: 's', skillVersion: 2, event: 'lauf', ts: 't2', userId: 'AB' });

    const txt = (await readText(share, sharedSignalPath('usage', 'AB')))!;
    const lines = txt.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).ts).toBe('t1');
    expect(JSON.parse(lines[1]!).skillVersion).toBe(2);
  });

  it('denied → Fallback auf persönliche Ablage, Share unberührt', async () => {
    const share = memRoot();
    const pers = memRoot();
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(share);
    vi.mocked(smb.queryPermission).mockResolvedValue('denied');
    vi.mocked(smb.getPersoenlichHandle).mockResolvedValue(pers);

    const res = await appendUsage(storage, { skillId: 's', skillVersion: 1, event: 'lauf', ts: 't', userId: 'CD' });
    expect(res.ziel).toBe('personal');
    expect(await readText(pers, personalSignalPath('usage', 'CD'))).toContain('"event":"lauf"');
    expect(await readText(share, sharedSignalPath('usage', 'CD'))).toBeNull();
  });

  it('queryPermission wirft → Fallback auf persönliche Ablage (kein Throw)', async () => {
    const share = memRoot();
    const pers = memRoot();
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(share);
    vi.mocked(smb.queryPermission).mockRejectedValue(new Error('boom'));
    vi.mocked(smb.getPersoenlichHandle).mockResolvedValue(pers);

    const res = await appendFeedback(storage, FEEDBACK);
    expect(res.ziel).toBe('personal');
    expect(await readText(pers, personalSignalPath('feedback', 'AB'))).toContain('"rating":"up"');
  });

  it('kein Handle → ziel none (kein Crash)', async () => {
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(null);
    vi.mocked(smb.getPersoenlichHandle).mockResolvedValue(null);
    const res = await appendFeedback(storage, FEEDBACK);
    expect(res.ziel).toBe('none');
  });

  it('ungültiges Event → ziel none, kein Handle-Zugriff', async () => {
    const res = await appendFeedback(storage, { skillId: 's' });
    expect(res.ziel).toBe('none');
    expect(smb.getDatenShareHandle).not.toHaveBeenCalled();
  });

  it('erfolgreicher Write invalidiert den Aggregat-Cache', async () => {
    const share = memRoot();
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(share);
    vi.mocked(smb.queryPermission).mockResolvedValue('granted');
    await appendFeedback(storage, FEEDBACK);
    expect(storage.idb.delete).toHaveBeenCalledWith('skill-feedback:aggregate-cache');
  });
});
