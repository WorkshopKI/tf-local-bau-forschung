import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StorageService } from '@/core/services/storage';
import { appendToFile, readText } from '@/core/services/infrastructure/atomic-write';
import { memRoot } from '@/core/services/infrastructure/__tests__/mem-fs';
import * as smb from '@/core/services/infrastructure/smb-handle';
import { exportFeedback, partitionEvents } from '../export';
import { personalSignalPath, PERSONAL_EXPORT_PATH } from '../layout';
import type { FeedbackEvent, UsageEvent } from '../types';

vi.mock('@/core/services/infrastructure/smb-handle', () => ({
  getDatenShareHandle: vi.fn(),
  getPersoenlichHandle: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('partitionEvents', () => {
  it('trennt Feedback von Usage', () => {
    const fb: FeedbackEvent = { skillId: 's', skillVersion: 1, rating: 'up', ts: 't', userId: 'U' };
    const us: UsageEvent = { skillId: 's', skillVersion: 1, event: 'lauf', ts: 't', userId: 'U' };
    const { feedback, usage } = partitionEvents([fb, us, fb]);
    expect(feedback).toHaveLength(2);
    expect(usage).toHaveLength(1);
  });
});

describe('exportFeedback — Bündel aus persönlicher Ablage', () => {
  it('sammelt eigene Events, schreibt das Bündel, liefert es zurück', async () => {
    const pers = memRoot();
    await appendToFile(pers, personalSignalPath('feedback', 'AB'), JSON.stringify({ skillId: 's', skillVersion: 1, rating: 'down', ts: 't1', userId: 'AB', notiz: 'zu lang' }));
    await appendToFile(pers, personalSignalPath('usage', 'AB'), JSON.stringify({ skillId: 's', skillVersion: 1, event: 'lauf', ts: 't2', userId: 'AB' }));
    vi.mocked(smb.getPersoenlichHandle).mockResolvedValue(pers);
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(null);

    const bundle = await exportFeedback({ idb: {} } as StorageService, '2026-06-19T00:00:00Z');
    expect(bundle.version).toBe(1);
    expect(bundle.exportiert_am).toBe('2026-06-19T00:00:00Z');
    expect(bundle.feedback).toHaveLength(1);
    expect(bundle.usage).toHaveLength(1);

    // Datei wurde geschrieben + ist wieder lesbar.
    const written = JSON.parse((await readText(pers, PERSONAL_EXPORT_PATH))!);
    expect(written.feedback[0].notiz).toBe('zu lang');
  });

  it('ohne Persoenlich-Handle: leeres Bündel, kein Crash', async () => {
    vi.mocked(smb.getPersoenlichHandle).mockResolvedValue(null);
    const bundle = await exportFeedback({ idb: {} } as StorageService, 'TS');
    expect(bundle).toEqual({ version: 1, exportiert_am: 'TS', feedback: [], usage: [] });
  });
});
