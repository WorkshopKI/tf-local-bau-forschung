import { useState, useRef, useCallback } from "react";
import { streamChat } from "@/services/llmService";
import { buildContextPrefix } from "@/lib/contextBuilder";
import { trackAction } from "@/lib/actionTracker";
import { toast } from "sonner";
import type { Msg } from "@/types";

interface UseChatOptions {
  systemPrompt: string;
  selectedModel: string;
  thinkingEnabled: boolean;
  onBudgetExhausted: () => void;
}

interface UseChatReturn {
  messages: Msg[];
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  streamingContent: string;
  setStreamingContent: React.Dispatch<React.SetStateAction<string>>;
  thinkingContent: string;
  isStreaming: boolean;
  sendMessage: (content: string) => Promise<void>;
  handleStop: () => void;
  resetThinking: () => void;
}

export function useChat({ systemPrompt, selectedModel, thinkingEnabled, onBudgetExhausted }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [thinkingContent, setThinkingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const accRef = useRef("");
  const thinkingRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);

  const resetThinking = useCallback(() => {
    setThinkingContent("");
    thinkingRef.current = "";
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;
      trackAction("ki-nachricht-gesendet");

      const userMsg: Msg = { role: "user", content };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setStreamingContent("");
      setThinkingContent("");
      setIsStreaming(true);
      accRef.current = "";
      thinkingRef.current = "";

      const apiMessages: Msg[] = [];
      const contextPrefix = buildContextPrefix();
      const fullSystemPrompt = contextPrefix
        ? `${contextPrefix}\n---\n\n${systemPrompt}`.trim()
        : systemPrompt;
      if (fullSystemPrompt.trim()) {
        apiMessages.push({ role: "system", content: fullSystemPrompt });
      }
      apiMessages.push(...newMessages.slice(-20));

      abortRef.current = new AbortController();

      await streamChat({
        messages: apiMessages,
        model: selectedModel,
        reasoning: thinkingEnabled ? { effort: "high" } : undefined,
        signal: abortRef.current.signal,
        onDelta: (text) => {
          accRef.current += text;
          setStreamingContent(accRef.current);
        },
        onThinking: thinkingEnabled ? (text) => {
          thinkingRef.current += text;
          setThinkingContent(thinkingRef.current);
        } : undefined,
        onDone: () => {
          const finalContent = accRef.current;
          if (finalContent) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: finalContent },
            ]);
          }
          setStreamingContent("");
          setIsStreaming(false);
          abortRef.current = null;
        },
        onError: (error, status) => {
          trackAction("ki-fehler");
          setIsStreaming(false);
          setStreamingContent("");
          setThinkingContent("");
          abortRef.current = null;
          if (status === 402 || error === "budget_exhausted") {
            onBudgetExhausted();
          } else {
            toast.error(error);
          }
        },
      });
    },
    [messages, isStreaming, systemPrompt, selectedModel, thinkingEnabled, onBudgetExhausted]
  );

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  return {
    messages,
    setMessages,
    streamingContent,
    setStreamingContent,
    thinkingContent,
    isStreaming,
    sendMessage,
    handleStop,
    resetThinking,
  };
}
