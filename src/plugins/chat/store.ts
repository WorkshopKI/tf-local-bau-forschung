/**
 * Chat-Store: Konversations-Liste (Metas) + aktive Messages, persistiert in IndexedDB.
 *
 * Persistenz-Pattern wie dokumente/store.ts: Metas im State, Voll-Record je
 * Konversation unter `chat:conv:{id}`; Settings unter `chat:settings`.
 *
 * Persist-Disziplin (CLAUDE.md Pitfall #16/#20): persistActive wird NUR
 * (1) nach dem User-Message-Append und (2) nach Stream-Finalize/Abort/Error
 * gerufen — nie pro Token. Der Coalescing-Lock unten fängt überlappende
 * Aufrufe ab und schreibt am Ende den letzten Stand.
 */
import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';
import { uuid } from '@/core/services/id-generator';
import { DEFAULT_SYSTEM_PROMPT } from './conversation-context';
import type { ChatMessage, ChatSettings, ConversationFull, ConversationMeta } from './types';

const CONV_PREFIX = 'chat:conv:';
const SETTINGS_KEY = 'chat:settings';

export function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'Neue Unterhaltung';
  const collapsed = firstUser.content.replace(/\s+/g, ' ').trim();
  return collapsed ? collapsed.slice(0, 60) : 'Neue Unterhaltung';
}

interface ChatState {
  /** Sortiert nach updatedAt absteigend. */
  conversations: ConversationMeta[];
  activeId: string | null;
  /** Volle Messages NUR der aktiven Konversation. */
  activeMessages: ChatMessage[];
  systemPrompt: string;
  loaded: boolean;

  loadAll: (storage: StorageService) => Promise<void>;
  /** In-Memory; IDB-Record + Listen-Eintrag entstehen mit dem ersten persistActive. */
  newConversation: () => void;
  select: (id: string, storage: StorageService) => Promise<void>;
  deleteConversation: (id: string, storage: StorageService) => Promise<void>;
  appendMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  /** Z.B. Regenerieren: letzte Assistant-Message entfernen. */
  removeMessage: (id: string) => void;
  persistActive: (storage: StorageService) => Promise<void>;
  setSystemPrompt: (prompt: string, storage: StorageService) => Promise<void>;
}

// Coalescing-Lock: überlappender persist wird nicht verworfen (wie der harte
// `if (saving) return`-Lock anderer Stores), sondern als Re-Run vorgemerkt —
// der letzte State gewinnt.
let saving = false;
let rerunQueued = false;

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeId: null,
  activeMessages: [],
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  loaded: false,

  loadAll: async (storage) => {
    const keys = await storage.idb.keys(CONV_PREFIX);
    const metas: ConversationMeta[] = [];
    for (const key of keys) {
      const rec = await storage.idb.get<ConversationFull>(key);
      if (!rec) continue;
      metas.push({
        id: rec.id, title: rec.title, createdAt: rec.createdAt,
        updatedAt: rec.updatedAt, messageCount: rec.messageCount,
      });
    }
    metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const settings = await storage.idb.get<ChatSettings>(SETTINGS_KEY);
    set({
      conversations: metas,
      systemPrompt: settings?.systemPrompt?.trim() ? settings.systemPrompt : DEFAULT_SYSTEM_PROMPT,
      loaded: true,
    });
  },

  newConversation: () => {
    set({ activeId: uuid(), activeMessages: [] });
  },

  select: async (id, storage) => {
    const rec = await storage.idb.get<ConversationFull>(`${CONV_PREFIX}${id}`);
    if (!rec) return;
    set({ activeId: id, activeMessages: rec.messages });
  },

  deleteConversation: async (id, storage) => {
    await storage.idb.delete(`${CONV_PREFIX}${id}`);
    const isActive = get().activeId === id;
    set({
      conversations: get().conversations.filter(c => c.id !== id),
      ...(isActive ? { activeId: null, activeMessages: [] } : {}),
    });
  },

  appendMessage: (msg) => {
    set({ activeMessages: [...get().activeMessages, msg] });
  },

  updateMessage: (id, patch) => {
    set({ activeMessages: get().activeMessages.map(m => (m.id === id ? { ...m, ...patch } : m)) });
  },

  removeMessage: (id) => {
    set({ activeMessages: get().activeMessages.filter(m => m.id !== id) });
  },

  persistActive: async (storage) => {
    if (saving) { rerunQueued = true; return; }
    saving = true;
    try {
      const { activeId, activeMessages, conversations } = get();
      if (!activeId || activeMessages.length === 0) return;
      const existing = conversations.find(c => c.id === activeId);
      const now = new Date().toISOString();
      const meta: ConversationMeta = {
        id: activeId,
        title: deriveTitle(activeMessages),
        createdAt: existing?.createdAt ?? activeMessages[0]?.createdAt ?? now,
        updatedAt: now,
        messageCount: activeMessages.length,
      };
      const record: ConversationFull = { ...meta, messages: activeMessages };
      await storage.idb.set(`${CONV_PREFIX}${activeId}`, record);
      const rest = conversations.filter(c => c.id !== activeId);
      set({ conversations: [meta, ...rest] });
    } finally {
      saving = false;
      if (rerunQueued) {
        rerunQueued = false;
        await get().persistActive(storage);
      }
    }
  },

  setSystemPrompt: async (prompt, storage) => {
    set({ systemPrompt: prompt });
    await storage.idb.set(SETTINGS_KEY, { systemPrompt: prompt } satisfies ChatSettings);
  },
}));
