import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore, deriveTitle } from '../store';
import { DEFAULT_SYSTEM_PROMPT } from '../conversation-context';
import type { ChatMessage, ConversationFull } from '../types';
import type { StorageService } from '@/core/services/storage';

function makeFakeStorage(opts: { setDelayMs?: number } = {}): { storage: StorageService; data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const idb = {
    get: async <T,>(k: string): Promise<T | null> => (data.get(k) as T | undefined) ?? null,
    set: async (k: string, v: unknown): Promise<void> => {
      if (opts.setDelayMs) await new Promise(r => setTimeout(r, opts.setDelayMs));
      data.set(k, JSON.parse(JSON.stringify(v)));
    },
    delete: async (k: string): Promise<void> => { data.delete(k); },
    keys: async (prefix: string): Promise<string[]> => [...data.keys()].filter(k => k.startsWith(prefix)),
  };
  return { storage: { idb } as unknown as StorageService, data };
}

let n = 0;
function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  n += 1;
  return { id: `m-${n}`, role, content, createdAt: new Date(2026, 5, 10, 12, 0, n).toISOString() };
}

beforeEach(() => {
  useChatStore.setState({
    conversations: [],
    activeId: null,
    activeMessages: [],
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    loaded: false,
  });
});

describe('deriveTitle', () => {
  it('erste User-Message, Whitespace kollabiert, max 60 Zeichen', () => {
    const t = deriveTitle([msg('user', '  Wie   geht\n es? ' + 'x'.repeat(100))]);
    expect(t.startsWith('Wie geht es?')).toBe(true);
    expect(t.length).toBe(60);
  });

  it('ohne User-Message → Fallback', () => {
    expect(deriveTitle([])).toBe('Neue Unterhaltung');
  });
});

describe('useChatStore', () => {
  it('newConversation setzt leeren aktiven Chat, erscheint erst nach persist in der Liste', async () => {
    const { storage, data } = makeFakeStorage();
    useChatStore.getState().newConversation();
    const id = useChatStore.getState().activeId;
    expect(id).toBeTruthy();
    expect(useChatStore.getState().conversations).toHaveLength(0);

    useChatStore.getState().appendMessage(msg('user', 'Hallo Welt'));
    await useChatStore.getState().persistActive(storage);

    expect(useChatStore.getState().conversations).toHaveLength(1);
    expect(useChatStore.getState().conversations[0]?.title).toBe('Hallo Welt');
    const rec = data.get(`chat:conv:${id}`) as ConversationFull;
    expect(rec.messages).toHaveLength(1);
    expect(rec.messageCount).toBe(1);
  });

  it('persistActive ohne Messages schreibt nichts', async () => {
    const { storage, data } = makeFakeStorage();
    useChatStore.getState().newConversation();
    await useChatStore.getState().persistActive(storage);
    expect(data.size).toBe(0);
  });

  it('loadAll lädt Metas (ohne Messages im State) sortiert nach updatedAt desc + Settings', async () => {
    const { storage, data } = makeFakeStorage();
    data.set('chat:conv:alt', {
      id: 'alt', title: 'Alt', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      messageCount: 2, messages: [msg('user', 'a'), msg('assistant', 'b')],
    });
    data.set('chat:conv:neu', {
      id: 'neu', title: 'Neu', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
      messageCount: 1, messages: [msg('user', 'c')],
    });
    data.set('chat:settings', { systemPrompt: 'Eigener Prompt' });

    await useChatStore.getState().loadAll(storage);
    const s = useChatStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.conversations.map(c => c.id)).toEqual(['neu', 'alt']);
    expect(s.systemPrompt).toBe('Eigener Prompt');
    expect(s.activeMessages).toHaveLength(0);
  });

  it('select lädt die vollen Messages der Konversation', async () => {
    const { storage, data } = makeFakeStorage();
    data.set('chat:conv:c1', {
      id: 'c1', title: 'T', createdAt: 'x', updatedAt: 'x', messageCount: 1,
      messages: [msg('user', 'Inhalt c1')],
    });
    await useChatStore.getState().select('c1', storage);
    expect(useChatStore.getState().activeId).toBe('c1');
    expect(useChatStore.getState().activeMessages[0]?.content).toBe('Inhalt c1');
  });

  it('deleteConversation entfernt Record + Meta und leert den aktiven Chat', async () => {
    const { storage, data } = makeFakeStorage();
    useChatStore.getState().newConversation();
    const id = useChatStore.getState().activeId!;
    useChatStore.getState().appendMessage(msg('user', 'weg damit'));
    await useChatStore.getState().persistActive(storage);

    await useChatStore.getState().deleteConversation(id, storage);
    expect(data.has(`chat:conv:${id}`)).toBe(false);
    expect(useChatStore.getState().conversations).toHaveLength(0);
    expect(useChatStore.getState().activeId).toBeNull();
  });

  it('updateMessage patcht eine Message in-memory', () => {
    useChatStore.getState().newConversation();
    const m = msg('assistant', 'anfang');
    useChatStore.getState().appendMessage(m);
    useChatStore.getState().updateMessage(m.id, { content: 'anfang fertig' });
    expect(useChatStore.getState().activeMessages[0]?.content).toBe('anfang fertig');
  });

  it('setSystemPrompt persistiert in chat:settings', async () => {
    const { storage, data } = makeFakeStorage();
    await useChatStore.getState().setSystemPrompt('Neu!', storage);
    expect(useChatStore.getState().systemPrompt).toBe('Neu!');
    expect(data.get('chat:settings')).toEqual({ systemPrompt: 'Neu!' });
  });

  it('persistActive coalesced parallele Aufrufe — finaler IDB-Stand = letzter State', async () => {
    const { storage, data } = makeFakeStorage({ setDelayMs: 20 });
    useChatStore.getState().newConversation();
    const id = useChatStore.getState().activeId!;
    useChatStore.getState().appendMessage(msg('user', 'erste'));
    const p1 = useChatStore.getState().persistActive(storage);
    useChatStore.getState().appendMessage(msg('assistant', 'zweite'));
    const p2 = useChatStore.getState().persistActive(storage);
    await Promise.all([p1, p2]);
    // Re-Run nach Lock abwarten
    await new Promise(r => setTimeout(r, 80));
    const rec = data.get(`chat:conv:${id}`) as ConversationFull;
    expect(rec.messages).toHaveLength(2);
  });
});
