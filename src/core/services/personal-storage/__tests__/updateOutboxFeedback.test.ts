/**
 * Tests für updateOutboxFeedback (v2.207.1).
 *
 * Read-only prod-Clients legen ihr Roh-Feedback in der pers. Outbox ab; der
 * geführte „verbessern"-Ablauf muss die verbesserte Fassung dort ÜBERSCHREIBEN,
 * sonst sammelt der Kurator den Roh-Text ein. Geprüft wird:
 *  - ein pending-Item wird rewritten (Outbox-Datei + meine-feedbacks.json), submitted_at/
 *    attachments/status bleiben erhalten,
 *  - ein bereits eingesammeltes (approved) Item wird NICHT angefasst (kein Resurrect),
 *  - eine unbekannte id ist ein No-Op,
 *  - IO-Fehler werden geschluckt (best-effort, kein Wurf).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted: die Mock-Fns müssen VOR der (gehoisteten) vi.mock-Factory existieren.
// Getypte Signaturen, damit `.mock.calls[n][1]`/`[2]` (Pfad/Inhalt) indexierbar sind.
const { atomicWrite, readText } = vi.hoisted(() => ({
  atomicWrite: vi.fn(async (_h: unknown, _path: string, _data: string | Blob) => undefined),
  readText: vi.fn(async (_h: unknown, _path: string): Promise<string | null> => '[]'),
}));
vi.mock('@/core/services/infrastructure', async (importActual) => {
  const actual = await importActual<typeof import('@/core/services/infrastructure')>();
  return { ...actual, atomicWrite, readText };
});

import { updateOutboxFeedback } from '../service';
import { PERSOENLICH_MEINE_FEEDBACKS_FILE } from '@/core/services/infrastructure/types';
import type { FeedbackOutboxItem } from '../types';

function ob(over: Partial<FeedbackOutboxItem> = {}): FeedbackOutboxItem {
  return {
    id: 'F1',
    kuerzel: 'AAA',
    submitted_at: '2026-07-09T10:00:00.000Z',
    text: 'roh',
    status: 'pending',
    ...over,
  };
}

/** Fake pers. Handle, dessen feedback/outbox die übergebenen Items als JSON-Dateien führt. */
function makePersHandle(items: FeedbackOutboxItem[]): FileSystemDirectoryHandle {
  const files = items.map(it => ({
    name: `${it.submitted_at.slice(0, 10)}-${it.id}.json`,
    json: JSON.stringify(it),
  }));
  const outbox = {
    kind: 'directory',
    values: async function* () { for (const f of files) yield { kind: 'file', name: f.name }; },
    getFileHandle: async (name: string) => {
      const f = files.find(x => x.name === name);
      if (!f) throw new Error('no file');
      return { getFile: async () => ({ text: async () => f.json }) };
    },
  };
  const feedback = {
    kind: 'directory',
    getDirectoryHandle: async (n: string) => { if (n === 'outbox') return outbox; throw new Error('no'); },
  };
  return {
    kind: 'directory',
    getDirectoryHandle: async (n: string) => { if (n === 'feedback') return feedback; throw new Error('no'); },
  } as unknown as FileSystemDirectoryHandle;
}

describe('updateOutboxFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    atomicWrite.mockResolvedValue(undefined);
    readText.mockResolvedValue('[]');
  });

  it('überschreibt ein pending-Item mit der verbesserten Fassung (submitted_at/attachments/status bleiben)', async () => {
    const original = ob({
      text: 'roh',
      attachments: [{ id: 'a1', filename: '2026-07-09-F1-a1.png', mime: 'image/png', width: 1, height: 1, bytes: 9 }],
    });
    readText.mockResolvedValue(JSON.stringify([original]));

    const res = await updateOutboxFeedback(makePersHandle([original]), 'F1', {
      text: 'verbessert',
      original_text: 'roh',
      llm_summary: 'kurz',
      llm_classification: {
        category: 'bug', summary: 'kurz', details: 'd', affectedArea: 'Suche',
        priority_suggestion: 3, verbessert: true,
      },
    });

    expect(res).toBe(true);
    // Zwei Writes: Outbox-Datei + meine-feedbacks.json.
    expect(atomicWrite).toHaveBeenCalledTimes(2);

    const outboxCall = atomicWrite.mock.calls.find(c => String(c[1]).includes('feedback/outbox/'))!;
    const written = JSON.parse(String(outboxCall[2])) as FeedbackOutboxItem;
    expect(written.text).toBe('verbessert');
    expect(written.original_text).toBe('roh');
    expect(written.llm_summary).toBe('kurz');
    expect(written.llm_classification?.category).toBe('bug');
    // Unverändert übernommen:
    expect(written.status).toBe('pending');
    expect(written.submitted_at).toBe('2026-07-09T10:00:00.000Z');
    expect(written.attachments).toHaveLength(1);

    // meine-feedbacks.json wird mitgezogen.
    const mineCall = atomicWrite.mock.calls.find(c => c[1] === PERSOENLICH_MEINE_FEEDBACKS_FILE)!;
    const mine = JSON.parse(String(mineCall[2])) as FeedbackOutboxItem[];
    expect(mine.find(m => m.id === 'F1')?.text).toBe('verbessert');
  });

  it('fasst ein bereits eingesammeltes (approved) Item NICHT an', async () => {
    const approved = ob({ status: 'approved' });
    const res = await updateOutboxFeedback(makePersHandle([approved]), 'F1', { text: 'verbessert' });
    expect(res).toBe(false);
    expect(atomicWrite).not.toHaveBeenCalled();
  });

  it('ist ein No-Op bei unbekannter id', async () => {
    const res = await updateOutboxFeedback(makePersHandle([ob()]), 'UNBEKANNT', { text: 'verbessert' });
    expect(res).toBe(false);
    expect(atomicWrite).not.toHaveBeenCalled();
  });

  it('schluckt IO-Fehler (best-effort, kein Wurf)', async () => {
    readText.mockResolvedValue(JSON.stringify([ob()]));
    atomicWrite.mockRejectedValue(new Error('share weg'));
    const res = await updateOutboxFeedback(makePersHandle([ob()]), 'F1', { text: 'verbessert' });
    expect(res).toBe(false);
  });
});
