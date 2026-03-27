import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, RefreshCw, MessageSquare } from 'lucide-react';
import { Button, Badge, MarkdownRenderer } from '@/ui';
import { useAIBridge } from '@/core/hooks/useAIBridge';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ChatView(): React.ReactElement {
  const bridge = useAIBridge();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, loading]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await bridge.getActiveTransport().submitMessage(msg);
      const aiMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: response };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [input, loading, bridge]);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const providerName = bridge.getActiveProviderName();

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={48} className="text-[var(--tf-text-secondary)] mb-4" />
            <p className="text-lg text-[var(--tf-text-secondary)]">Wie kann ich helfen?</p>
            <Badge variant="info" >via {providerName}</Badge>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-[var(--tf-radius)] text-sm ${
                msg.role === 'user'
                  ? 'bg-[var(--tf-primary-light)] text-[var(--tf-text)]'
                  : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]'
              }`}>
                {msg.role === 'assistant' ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[var(--tf-bg-secondary)] px-4 py-3 rounded-[var(--tf-radius)]">
                <span className="inline-flex gap-1">
                  <span className="w-2 h-2 bg-[var(--tf-text-secondary)] rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-[var(--tf-text-secondary)] rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-2 h-2 bg-[var(--tf-text-secondary)] rounded-full animate-bounce [animation-delay:0.2s]" />
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-[var(--tf-radius)] text-sm">
                <p className="text-red-600 mb-2">{error}</p>
                <Button variant="secondary" icon={RefreshCw} size="sm"
                  onClick={() => { const last = messages.filter(m => m.role === 'user').pop(); if (last) sendMessage(last.content); }}>
                  Erneut versuchen
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--tf-border)] p-4 bg-[var(--tf-bg)]">
        <div className="max-w-3xl mx-auto flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht eingeben..."
            rows={1}
            className="flex-1 px-4 py-3 text-sm bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)] resize-none"
          />
          <Button icon={Send} disabled={!input.trim() || loading} onClick={() => sendMessage()}>
            Senden
          </Button>
        </div>
        <div className="max-w-3xl mx-auto mt-2">
          <Badge variant="default">via {providerName}</Badge>
        </div>
      </div>
    </div>
  );
}
