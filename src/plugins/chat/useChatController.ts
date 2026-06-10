/**
 * Orchestriert Senden/Wiederholen im Chat: Kontext sammeln (Verzeichnisse + RAG),
 * API-Messages bauen, Transport-Fallback-Ladder fahren, Ergebnis in den Store
 * schreiben und persistieren.
 *
 * Fallback-Ladder:
 *   1. transport.submitConversation  → Multi-Turn (DirectLLM)
 *   2. transport.submitMessage       → Single-Turn (StreamlitBridge, Verhalten wie früher)
 * (Streaming-Branch folgt in PR-3.)
 */
import { useCallback, useState } from 'react';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { buildRAGContextString, searchResultsToRAGChunks } from '@/core/services/ai/rag-context';
import { extractThinking } from '@/core/services/ai/thinking-parser';
import { computeStats } from '@/core/services/ai/generation-stats';
import { uuid } from '@/core/services/id-generator';
import type { DirectoryEntry } from '@/core/types/config';
import { useChatStore } from './store';
import { buildApiMessages } from './conversation-context';
import type { ChatAttachment, ChatMessage } from './types';

/** Chat braucht Luft für lange Antworten — bewusst über dem Transport-Default (1500). */
export const CHAT_MAX_TOKENS = 4096;

export interface ChatController {
  /** Sendet eine User-Message (inkl. optionaler Attachments) und generiert die Antwort. */
  send: (text: string, attachments?: ChatAttachment[]) => Promise<void>;
  /** Wiederholt die Generierung auf Basis des bestehenden Verlaufs (Error-Retry). */
  retry: () => Promise<void>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
  // Kontext-Auswahl (Verzeichnisse + RAG)
  selectedDirs: DirectoryEntry[];
  toggleDir: (dir: DirectoryEntry) => void;
  useRAG: boolean;
  setUseRAG: (b: boolean | ((prev: boolean) => boolean)) => void;
  vectorReady: boolean;
  providerName: string;
}

export function useChatController(): ChatController {
  const bridge = useAIBridge();
  const storage = useStorage();
  const { search: ragSearch, vectorReady } = useSearch();
  const [selectedDirs, setSelectedDirs] = useState<DirectoryEntry[]>([]);
  const [useRAG, setUseRAG] = useState(true);

  const toggleDir = useCallback((dir: DirectoryEntry): void => {
    setSelectedDirs(prev =>
      prev.find(d => d.id === dir.id) ? prev.filter(d => d.id !== dir.id) : [...prev, dir],
    );
  }, []);

  const loadContextFromDirs = useCallback(async (): Promise<string> => {
    if (selectedDirs.length === 0) return '';
    const parts: string[] = [];
    for (const dir of selectedDirs) {
      const store = storage.getDirectoryStore(dir.id);
      if (!store) continue;
      try {
        const files = await store.listFiles('.', '.md');
        for (const file of files.slice(0, 5)) {
          try {
            const content = await store.readFile(file);
            parts.push(`--- ${dir.label}/${file} ---\n${content.slice(0, 2000)}`);
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
    return parts.length > 0 ? `\n\nContext aus Verzeichnissen:\n${parts.join('\n\n')}` : '';
  }, [selectedDirs, storage]);

  /** Generiert die Assistant-Antwort für den AKTUELLEN Verlauf (letzte Message = User). */
  const generateAssistant = useCallback(async (): Promise<void> => {
    const { activeMessages, systemPrompt } = useChatStore.getState();
    const lastUser = [...activeMessages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;

    // Kontext nur für den aktuellen Turn (wird nicht historisch re-gesendet)
    let extraContext = await loadContextFromDirs();
    let ragSources: string[] = [];
    if (useRAG && vectorReady) {
      const results = await ragSearch(lastUser.content);
      if (results.length > 0) {
        const chunks = searchResultsToRAGChunks(results);
        extraContext += buildRAGContextString(chunks);
        ragSources = chunks.slice(0, 5).map(c => c.source);
      }
    }

    const apiMessages = buildApiMessages(activeMessages, systemPrompt, extraContext || undefined);
    const transport = bridge.getActiveTransport();
    const tStart = performance.now();

    let raw: string;
    if (typeof transport.submitConversation === 'function') {
      raw = await transport.submitConversation(apiMessages, { maxTokens: CHAT_MAX_TOKENS });
    } else {
      // StreamlitBridge: kann keine Konversation — Single-Turn wie früher
      const single = apiMessages.filter(m => m.role === 'user').pop();
      raw = await transport.submitMessage(single?.content ?? lastUser.content);
    }
    const { content, thinking } = extractThinking(raw);
    const stats = computeStats({ tStart, tFirstToken: null, tEnd: performance.now() });

    const assistantMsg: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
      ...(thinking ? { thinking } : {}),
      stats,
      ...(ragSources.length > 0 ? { ragSources } : {}),
    };
    useChatStore.getState().appendMessage(assistantMsg);
    await useChatStore.getState().persistActive(storage);
  }, [bridge, loadContextFromDirs, ragSearch, storage, useRAG, vectorReady]);

  const sendAction = useAsyncAction(
    useCallback(async (text: string, attachments?: ChatAttachment[]): Promise<void> => {
      const store = useChatStore.getState();
      if (!store.activeId) store.newConversation();
      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
        ...(attachments?.length ? { attachments } : {}),
      };
      useChatStore.getState().appendMessage(userMsg);
      // Persist VOR der Generierung: Crash mittendrin behält die Frage
      await useChatStore.getState().persistActive(storage);
      await generateAssistant();
    }, [generateAssistant, storage]),
  );

  const retryAction = useAsyncAction(generateAssistant);

  return {
    send: sendAction.run,
    retry: retryAction.run,
    busy: sendAction.busy || retryAction.busy,
    error: sendAction.error ?? retryAction.error,
    clearError: () => { sendAction.clearError(); retryAction.clearError(); },
    selectedDirs,
    toggleDir,
    useRAG,
    setUseRAG,
    vectorReady,
    providerName: bridge.getActiveProviderName(),
  };
}
