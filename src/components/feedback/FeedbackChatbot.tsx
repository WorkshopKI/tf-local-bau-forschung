// Feedback-Chatbot: Multi-Turn LLM-Dialog via DirectLLMTransport.submitConversation().
// Bei aktivem Streamlit-Transport: freundliche Meldung + Navigations-Button.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Settings } from 'lucide-react';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useStorage } from '@/core/hooks/useStorage';
import { useNavigation } from '@/core/hooks/useNavigation';
import {
  buildFeedbackSystemPrompt,
  loadFeedbackConfig,
  loadSystemPrompt,
  parseBotResponse,
  parseFeedbackSummary,
  renderSimpleMarkdown,
  updateFeedback,
} from '@/core/services/feedback';
import type { ChatMsg, FeedbackContext, LLMClassification } from '@/core/types/feedback';
import { FeedbackConfirmCard } from './FeedbackConfirmCard';

interface Props {
  feedbackId: string;
  initialText: string;
  context: FeedbackContext;
  onClose: () => void;
}

export function FeedbackChatbot({ feedbackId, initialText, context, onClose }: Props): React.ReactElement {
  const bridge = useAIBridge();
  const storage = useStorage();
  const { navigate } = useNavigation();
  const transport = bridge.getActiveTransport();
  const supportsConversation = typeof transport.submitConversation === 'function';

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [classification, setClassification] = useState<LLMClassification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const sendToLLM = useCallback(async (msgs: ChatMsg[]) => {
    if (!supportsConversation) return;
    setThinking(true);
    setError(null);
    try {
      // strip UI-only options before sending
      const apiMsgs = msgs.map(({ options: _options, ...rest }) => rest);
      const raw = await transport.submitConversation!(apiMsgs, { thinkingBudget: 'low' });
      const { text, options } = parseBotResponse(raw);
      const assistantMsg: ChatMsg = { role: 'assistant', content: text, options };
      setMessages(prev => [...prev, assistantMsg]);
      const summary = parseFeedbackSummary(raw);
      if (summary) setClassification(summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setThinking(false);
    }
  }, [supportsConversation, transport]);

  // Initialer Auto-Send: Lade System-Prompt + sende erste User-Message
  useEffect(() => {
    if (initRef.current || !supportsConversation) return;
    initRef.current = true;
    (async () => {
      const config = await loadFeedbackConfig(storage);
      const template = await loadSystemPrompt(storage);
      const systemPrompt = buildFeedbackSystemPrompt(template, context);
      const startMsgs: ChatMsg[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: initialText },
      ];
      setMessages(startMsgs);
      void sendToLLM(startMsgs);
      // Hinweis: max_chatbot_turns aus config wird hier nicht enforced —
      // der LLM bekommt die Anweisung im System-Prompt selbst (max 2-3 Rückfragen).
      void config;
    })();
  }, [storage, context, initialText, sendToLLM, supportsConversation]);

  const handleUserSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setInput('');
    const newMsgs = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(newMsgs);
    await sendToLLM(newMsgs);
  }, [messages, thinking, sendToLLM]);

  const handleConfirm = useCallback(async () => {
    if (!classification) return;
    await updateFeedback(storage, feedbackId, {
      user_confirmed: true,
      llm_summary: classification.summary,
      llm_classification: classification,
    });
    onClose();
  }, [classification, feedbackId, storage, onClose]);

  const handleReject = useCallback(() => {
    setClassification(null);
    setMessages(prev => [...prev, {
      role: 'user',
      content: 'Das passt nicht ganz. Bitte korrigiere die Zusammenfassung.',
    }]);
    void sendToLLM([...messages, { role: 'user', content: 'Das passt nicht ganz. Bitte korrigiere die Zusammenfassung.' }]);
  }, [messages, sendToLLM]);

  // Fallback: Provider unterstützt keine Multi-Turn (z.B. Streamlit)
  if (!supportsConversation) {
    return (
      <div className="p-4 space-y-3 text-center">
        <p className="text-[13px] text-[var(--tf-text)]">
          Der Chatbot benötigt einen OpenRouter- oder lokalen LLM-Provider.
        </p>
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Aktuell ist <span className="font-medium">{transport.name}</span> aktiv.
        </p>
        <button
          type="button"
          onClick={() => { onClose(); navigate('einstellungen'); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--tf-radius)] text-[12.5px] bg-[var(--tf-primary)] text-white hover:opacity-90 cursor-pointer"
        >
          <Settings size={14} /> KI-Provider konfigurieren
        </button>
      </div>
    );
  }

  const visibleMessages = messages.filter(m => m.role !== 'system');

  return (
    <div className="flex flex-col h-[420px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {visibleMessages.map((msg, idx) => {
          const isLast = idx === visibleMessages.length - 1;
          const isAssistant = msg.role === 'assistant';
          return (
            <div key={idx} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] ${isAssistant ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] rounded-[14px] rounded-bl-sm' : 'bg-[var(--tf-primary)] text-white rounded-[14px] rounded-br-sm'} px-3 py-2 text-[12.5px] leading-snug whitespace-pre-wrap`}>
                {renderSimpleMarkdown(msg.content)}
                {isAssistant && msg.options && msg.options.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.options.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        disabled={!isLast || thinking}
                        onClick={() => isLast && handleUserSend(opt)}
                        className={`rounded-full px-2.5 py-1 text-[11px] cursor-pointer transition-colors bg-[var(--tf-bg)] text-[var(--tf-text)] ${
                          isLast && !thinking
                            ? 'hover:bg-[var(--tf-primary-light)]'
                            : 'opacity-50 cursor-default'
                        }`}
                        style={{ border: '0.5px solid var(--tf-border)' }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {thinking && (
          <div className="flex justify-start">
            <div className="bg-[var(--tf-bg-secondary)] rounded-[14px] rounded-bl-sm px-3 py-2.5">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-[var(--tf-text-tertiary)] rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-[var(--tf-text-tertiary)] rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-1.5 h-1.5 bg-[var(--tf-text-tertiary)] rounded-full animate-bounce [animation-delay:0.2s]" />
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-[var(--tf-radius)] p-2 bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)] text-[12px]" style={{ border: '0.5px solid var(--tf-danger-border)' }}>
            LLM-Fehler: {error}
          </div>
        )}
        {classification && (
          <FeedbackConfirmCard
            classification={classification}
            onConfirm={handleConfirm}
            onReject={handleReject}
          />
        )}
      </div>
      <div className="p-2 flex gap-2" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleUserSend(input);
            }
          }}
          placeholder={thinking ? 'Bot antwortet…' : 'Antworten…'}
          disabled={thinking || !!classification}
          rows={1}
          className="flex-1 px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        />
        <button
          type="button"
          onClick={() => void handleUserSend(input)}
          disabled={!input.trim() || thinking || !!classification}
          className="p-2 rounded-[var(--tf-radius)] bg-[var(--tf-primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Senden"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
