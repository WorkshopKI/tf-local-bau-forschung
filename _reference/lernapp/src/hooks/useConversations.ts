import { useState, useEffect, useCallback } from "react";
import { loadArrayFromStorage, saveToStorage, removeFromStorage } from "@/lib/storage";
import { LS_KEYS, DEFAULT_MODEL } from "@/lib/constants";
import type { Msg, SavedConversation } from "@/types";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function generateTitle(messages: Msg[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "Neuer Chat";
  const text = firstUser.content.slice(0, 50);
  return text.length < firstUser.content.length ? text + "…" : text;
}

interface UseConversationsReturn {
  conversations: SavedConversation[];
  activeConversationId: string | null;
  selectConversation: (conv: SavedConversation) => { messages: Msg[]; systemPrompt: string; model: string };
  newConversation: () => void;
  deleteConversation: (id: string) => boolean;
  renameConversation: (id: string, title: string) => void;
  persistMessages: (messages: Msg[], systemPrompt: string, model: string, isStreaming: boolean) => void;
  clearActiveConversation: () => void;
  restoreActiveConversation: () => { messages: Msg[]; systemPrompt: string; model: string } | null;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<SavedConversation[]>(
    () => loadArrayFromStorage<SavedConversation>(LS_KEYS.CONVERSATIONS)
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    () => localStorage.getItem(LS_KEYS.ACTIVE_CONVERSATION)
  );

  // Persist active ID
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem(LS_KEYS.ACTIVE_CONVERSATION, activeConversationId);
    } else {
      removeFromStorage(LS_KEYS.ACTIVE_CONVERSATION);
    }
  }, [activeConversationId]);

  const restoreActiveConversation = useCallback((): { messages: Msg[]; systemPrompt: string; model: string } | null => {
    if (activeConversationId) {
      const conv = conversations.find((c) => c.id === activeConversationId);
      if (conv) {
        return { messages: conv.messages, systemPrompt: conv.systemPrompt, model: conv.model };
      }
    }
    // Migrate old single-history format
    try {
      const old = localStorage.getItem(LS_KEYS.LEGACY_HISTORY);
      if (old) {
        const parsed = JSON.parse(old);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated: SavedConversation = {
            id: generateId(),
            title: generateTitle(parsed),
            messages: parsed,
            systemPrompt: "",
            model: DEFAULT_MODEL,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const updated = [migrated, ...conversations];
          setConversations(updated);
          saveToStorage(LS_KEYS.CONVERSATIONS, updated);
          setActiveConversationId(migrated.id);
          removeFromStorage(LS_KEYS.LEGACY_HISTORY);
          return { messages: parsed, systemPrompt: "", model: DEFAULT_MODEL };
        }
      }
    } catch { /* ignore */ }
    return null;
  }, [activeConversationId, conversations]);

  const persistMessages = useCallback(
    (messages: Msg[], systemPrompt: string, model: string, isStreaming: boolean) => {
      if (messages.length === 0 || isStreaming) return;

      setConversations((prev) => {
        let updated: SavedConversation[];
        if (activeConversationId) {
          updated = prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, messages, systemPrompt, model, updatedAt: Date.now(), title: c.title === "Neuer Chat" ? generateTitle(messages) : c.title }
              : c
          );
        } else {
          const newConv: SavedConversation = {
            id: generateId(),
            title: generateTitle(messages),
            messages,
            systemPrompt,
            model,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          updated = [newConv, ...prev];
          setActiveConversationId(newConv.id);
          localStorage.setItem(LS_KEYS.ACTIVE_CONVERSATION, newConv.id);
        }
        saveToStorage(LS_KEYS.CONVERSATIONS, updated);
        return updated;
      });
    },
    [activeConversationId]
  );

  const selectConversation = useCallback((conv: SavedConversation) => {
    setActiveConversationId(conv.id);
    return { messages: conv.messages, systemPrompt: conv.systemPrompt, model: conv.model };
  }, []);

  const newConversation = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  const deleteConversation = useCallback((id: string): boolean => {
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveToStorage(LS_KEYS.CONVERSATIONS, updated);
      return updated;
    });
    const wasActive = activeConversationId === id;
    if (wasActive) setActiveConversationId(null);
    return wasActive;
  }, [activeConversationId]);

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, title } : c));
      saveToStorage(LS_KEYS.CONVERSATIONS, updated);
      return updated;
    });
  }, []);

  const clearActiveConversation = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  return {
    conversations,
    activeConversationId,
    selectConversation,
    newConversation,
    deleteConversation,
    renameConversation,
    persistMessages,
    clearActiveConversation,
    restoreActiveConversation,
  };
}
