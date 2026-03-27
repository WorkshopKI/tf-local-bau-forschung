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
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [input, loading, bridge]);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const providerName = bridge.getActiveProviderName();

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={40} className="text-[var(--tf-text-tertiary)] mb-4" />
            <p className="text-[var(--tf-text-secondary)]">Wie kann ich helfen?</p>
            <Badge variant="default" >via {providerName}</Badge>
          </div>
        )}
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-[var(--tf-radius-lg)] text-[13.5px] ${
                msg.role === 'user'
                  ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]'
                  : 'text-[var(--tf-text)]'
              }`}>
                {msg.role === 'assistant' ? <MarkdownRenderer content={msg.content} /> : <p className="whitespace-pre-wrap">{msg.content}</p>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[var(--tf-text-tertiary)] rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-[var(--tf-text-tertiary)] rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-1.5 h-1.5 bg-[var(--tf-text-tertiary)] rounded-full animate-bounce [animation-delay:0.2s]" />
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-start">
              <div className="bg-[var(--tf-danger-bg)] px-4 py-3 rounded-[var(--tf-radius-lg)] text-[13px]" style={{ border: '0.5px solid var(--tf-danger-border)' }}>
                <p className="text-[var(--tf-danger-text)] mb-2">{error}</p>
                <Button variant="ghost" icon={RefreshCw} size="sm"
                  onClick={() => { const last = messages.filter(m => m.role === 'user').pop(); if (last) sendMessage(last.content); }}>
                  Erneut versuchen
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="p-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <div className="max-w-2xl mx-auto flex gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Nachricht eingeben..." rows={1}
            className="flex-1 px-4 py-3 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
            style={{ border: '0.5px solid var(--tf-border)' }} />
          <Button icon={Send} disabled={!input.trim() || loading} onClick={() => sendMessage()} />
        </div>
        <div className="max-w-2xl mx-auto mt-2">
          <Badge variant="default">via {providerName}</Badge>
        </div>
      </div>
    </div>
  );
}
