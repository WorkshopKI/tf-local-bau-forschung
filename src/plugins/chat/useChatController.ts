/**
 * Orchestriert Senden/Stoppen/Wiederholen im Chat: Kontext sammeln (Verzeichnisse
 * + RAG), API-Messages bauen, Transport-Fallback-Ladder fahren, Ergebnis in den
 * Store schreiben und persistieren.
 *
 * Fallback-Ladder:
 *   1. transport.streamConversation  → Streaming-Multi-Turn (DirectLLM)
 *   2. transport.submitConversation  → Multi-Turn ohne Streaming
 *   3. transport.submitMessage       → Single-Turn (StreamlitBridge, Verhalten wie früher)
 *
 * Streaming-Render-Disziplin: Deltas werden gepuffert und nur alle
 * STREAM_FLUSH_MS in den Store geflusht — marked-Re-Parse pro Token würde bei
 * lokalen Token-Raten (50+ tok/s) die UI blockieren. Persistiert wird NIE pro
 * Token, nur nach User-Append + Finalize/Abort/Error (Pitfall #16/#20).
 */
import { useCallback, useRef, useState } from 'react';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { buildRAGContextString, searchResultsToRAGChunks } from '@/core/services/ai/rag-context';
import { extractThinking } from '@/core/services/ai/thinking-parser';
import { computeStats } from '@/core/services/ai/generation-stats';
import { uuid } from '@/core/services/id-generator';
import type { DirectoryEntry } from '@/core/types/config';
import type { AITransport, ConversationMessage } from '@/core/services/ai/transports/streamlit';
import { useChatStore } from './store';
import { buildApiMessages } from './conversation-context';
import type { ChatAttachment, ChatMessage } from './types';

/** Chat braucht Luft für lange Antworten — bewusst über dem Transport-Default (1500). */
export const CHAT_MAX_TOKENS = 4096;
/** Delta-Flush-Intervall: Kompromiss aus Live-Gefühl und marked-Re-Parse-Kosten. */
const STREAM_FLUSH_MS = 80;

export interface ChatController {
  /** Sendet eine User-Message (inkl. optionaler Attachments) und generiert die Antwort. */
  send: (text: string, attachments?: ChatAttachment[]) => Promise<void>;
  /** Wiederholt die Generierung auf Basis des bestehenden Verlaufs (Error-Retry). */
  retry: () => Promise<void>;
  /** Entfernt die letzte Assistant-Antwort und generiert neu. */
  regenerate: () => Promise<void>;
  /** Bricht die laufende Generierung ab (Partial bleibt erhalten). */
  stop: () => void;
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

  const abortRef = useRef<AbortController | null>(null);

  /** Streaming-Pfad: Platzhalter-Message anlegen, Deltas gedrosselt flushen,
   *  am Ende autoritatives Result + Stats setzen. */
  const runStreaming = useCallback(async (
    transport: AITransport,
    apiMessages: ConversationMessage[],
    ragSources: string[],
    signal: AbortSignal,
  ): Promise<void> => {
    const assistantId = uuid();
    useChatStore.getState().appendMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      ...(ragSources.length > 0 ? { ragSources } : {}),
    });

    let pendingContent = '';
    let pendingThinking = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = (): void => {
      if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
      if (!pendingContent && !pendingThinking) return;
      const cur = useChatStore.getState().activeMessages.find(m => m.id === assistantId);
      if (!cur) { pendingContent = ''; pendingThinking = ''; return; }
      useChatStore.getState().updateMessage(assistantId, {
        ...(pendingContent ? { content: cur.content + pendingContent } : {}),
        ...(pendingThinking ? { thinking: (cur.thinking ?? '') + pendingThinking } : {}),
      });
      pendingContent = '';
      pendingThinking = '';
    };
    const schedule = (): void => {
      if (flushTimer === null) flushTimer = setTimeout(flush, STREAM_FLUSH_MS);
    };

    try {
      // Thinking-Toggle: aus → 'none' (DirectLLM übersetzt das für llama.cpp in
      // chat_template_kwargs.enable_thinking=false); an → Server-Default (auto).
      const thinkingBudget = useChatStore.getState().thinkingEnabled ? undefined : 'none' as const;
      const result = await transport.streamConversation!(apiMessages, {
        onDelta: t => { pendingContent += t; schedule(); },
        onReasoningDelta: t => { pendingThinking += t; schedule(); },
      }, { maxTokens: CHAT_MAX_TOKENS, signal, ...(thinkingBudget ? { thinkingBudget } : {}) });

      flush();
      if (result.aborted && !result.content && !result.reasoning) {
        // Stop noch vor dem ersten Token: leere Hülle entfernen
        useChatStore.getState().removeMessage(assistantId);
      } else {
        useChatStore.getState().updateMessage(assistantId, {
          content: result.content,
          ...(result.reasoning ? { thinking: result.reasoning } : {}),
          ...(result.stats ? { stats: result.stats } : {}),
          ...(result.aborted ? { aborted: true } : {}),
        });
      }
    } catch (err) {
      // Mid-Stream-Fehler: Partial behalten + markieren, leere Hülle entfernen
      flush();
      const cur = useChatStore.getState().activeMessages.find(m => m.id === assistantId);
      if (cur && !cur.content && !cur.thinking) {
        useChatStore.getState().removeMessage(assistantId);
      } else if (cur) {
        useChatStore.getState().updateMessage(assistantId, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await useChatStore.getState().persistActive(storage);
      throw err; // Banner via useAsyncAction
    }
    await useChatStore.getState().persistActive(storage);
  }, [storage]);

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
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      if (typeof transport.streamConversation === 'function') {
        await runStreaming(transport, apiMessages, ragSources, abort.signal);
        return;
      }

      const tStart = performance.now();
      let raw: string;
      if (typeof transport.submitConversation === 'function') {
        try {
          raw = await transport.submitConversation(apiMessages, {
            maxTokens: CHAT_MAX_TOKENS,
            signal: abort.signal,
            ...(useChatStore.getState().thinkingEnabled ? {} : { thinkingBudget: 'none' as const }),
          });
        } catch (err) {
          if (abort.signal.aborted) return; // Stop ohne Streaming: nichts zu behalten
          throw err;
        }
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
    } finally {
      abortRef.current = null;
    }
  }, [bridge, loadContextFromDirs, ragSearch, runStreaming, storage, useRAG, vectorReady]);

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

  const regenerateAction = useAsyncAction(
    useCallback(async (): Promise<void> => {
      const msgs = useChatStore.getState().activeMessages;
      const last = msgs[msgs.length - 1];
      if (!last || last.role !== 'assistant') return;
      useChatStore.getState().removeMessage(last.id);
      await generateAssistant();
    }, [generateAssistant]),
  );

  const stop = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  return {
    send: sendAction.run,
    retry: retryAction.run,
    regenerate: regenerateAction.run,
    stop,
    busy: sendAction.busy || retryAction.busy || regenerateAction.busy,
    error: sendAction.error ?? retryAction.error ?? regenerateAction.error,
    clearError: () => { sendAction.clearError(); retryAction.clearError(); regenerateAction.clearError(); },
    selectedDirs,
    toggleDir,
    useRAG,
    setUseRAG,
    vectorReady,
    providerName: bridge.getActiveProviderName(),
  };
}
