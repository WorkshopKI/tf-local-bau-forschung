import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from '../store';
import { DEFAULT_SYSTEM_PROMPT } from '../conversation-context';
import type { ChatMessage, ConversationFull } from '../types';
import type { StorageService } from '@/core/services/storage';

function makeFakeStorage(): { storage: StorageService; data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const idb = {
    get: async <T,>(k: string): Promise<T | null> => (data.get(k) as T | undefined) ?? null,
    set: async (k: string, v: unknown): Promise<void> => { data.set(k, JSON.parse(JSON.stringify(v))); },
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

async function seedConversation(storage: StorageService): Promise<string> {
  useChatStore.getState().newConversation();
  const id = useChatStore.getState().activeId!;
  useChatStore.getState().appendMessage(msg('user', 'Frage'));
  useChatStore.getState().appendMessage(msg('assistant', 'Antwort'));
  await useChatStore.getState().persistActive(storage);
  return id;
}

beforeEach(() => {
  useChatStore.setState({
    conversations: [],
    activeId: null,
    activeMessages: [],
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    thinkingEnabled: true,
    loaded: false,
  });
});

describe('useChatStore — Reskin-Actions', () => {
  it('togglePin setzt/entfernt pinned in Meta + IDB', async () => {
    const { storage, data } = makeFakeStorage();
    const id = await seedConversation(storage);
    await useChatStore.getState().togglePin(id, storage);
    expect(useChatStore.getState().conversations.find(c => c.id === id)?.pinned).toBe(true);
    expect((data.get(`chat:conv:${id}`) as ConversationFull).pinned).toBe(true);
    await useChatStore.getState().togglePin(id, storage);
    expect(useChatStore.getState().conversations.find(c => c.id === id)?.pinned).toBe(false);
  });

  it('renameConversation ändert Titel in Meta + IDB und friert ihn ein', async () => {
    const { storage, data } = makeFakeStorage();
    const id = await seedConversation(storage);
    await useChatStore.getState().renameConversation(id, '  Mein Titel  ', storage);
    expect(useChatStore.getState().conversations.find(c => c.id === id)?.title).toBe('Mein Titel');
    expect((data.get(`chat:conv:${id}`) as ConversationFull).title).toBe('Mein Titel');
  });

  it('renameConversation ignoriert leeren Titel', async () => {
    const { storage } = makeFakeStorage();
    const id = await seedConversation(storage);
    const before = useChatStore.getState().conversations.find(c => c.id === id)?.title;
    await useChatStore.getState().renameConversation(id, '   ', storage);
    expect(useChatStore.getState().conversations.find(c => c.id === id)?.title).toBe(before);
  });

  it('setConversationFkz verknüpft + entfernt (undefined)', async () => {
    const { storage, data } = makeFakeStorage();
    const id = await seedConversation(storage);
    await useChatStore.getState().setConversationFkz(id, '16KN065210', storage);
    expect(useChatStore.getState().conversations.find(c => c.id === id)?.fkz).toBe('16KN065210');
    expect((data.get(`chat:conv:${id}`) as ConversationFull).fkz).toBe('16KN065210');
    await useChatStore.getState().setConversationFkz(id, undefined, storage);
    expect(useChatStore.getState().conversations.find(c => c.id === id)?.fkz).toBeUndefined();
    expect((data.get(`chat:conv:${id}`) as ConversationFull).fkz).toBeUndefined();
  });

  it('setMessageFeedback toggelt das Feedback der aktiven Message + persistiert', async () => {
    const { storage, data } = makeFakeStorage();
    const id = await seedConversation(storage);
    const aMsg = useChatStore.getState().activeMessages.find(m => m.role === 'assistant')!;
    await useChatStore.getState().setMessageFeedback(aMsg.id, 'up', storage);
    expect(useChatStore.getState().activeMessages.find(m => m.id === aMsg.id)?.feedback).toBe('up');
    expect((data.get(`chat:conv:${id}`) as ConversationFull).messages.find(m => m.id === aMsg.id)?.feedback).toBe('up');
    // erneut 'up' → toggelt aus
    await useChatStore.getState().setMessageFeedback(aMsg.id, 'up', storage);
    expect(useChatStore.getState().activeMessages.find(m => m.id === aMsg.id)?.feedback).toBeUndefined();
  });

  it('loadAll liest pinned + fkz aus den Records in die Metas', async () => {
    const { storage, data } = makeFakeStorage();
    data.set('chat:conv:x', {
      id: 'x', title: 'T', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
      messageCount: 1, pinned: true, fkz: '16KN065210', messages: [msg('user', 'a')],
    });
    await useChatStore.getState().loadAll(storage);
    const meta = useChatStore.getState().conversations.find(c => c.id === 'x');
    expect(meta?.pinned).toBe(true);
    expect(meta?.fkz).toBe('16KN065210');
  });
});
