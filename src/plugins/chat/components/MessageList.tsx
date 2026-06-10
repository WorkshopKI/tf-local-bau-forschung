import { useEffect, useRef } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { Badge, Button } from '@/ui';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  onRetry: () => void;
  providerName: string;
}

export function MessageList({ messages, busy, error, onRetry, providerName }: MessageListProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, busy]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
      {messages.length === 0 && !busy && (
        <div className="flex flex-col items-center justify-center h-full text-center gap-2">
          <MessageSquare size={40} className="text-[var(--tf-text-tertiary)] mb-2" />
          <p className="text-[var(--tf-text-secondary)]">Wie kann ich helfen?</p>
          <Badge variant="default">via {providerName}</Badge>
        </div>
      )}
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {busy && (
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
              <Button variant="ghost" icon={RefreshCw} size="sm" onClick={() => onRetry()}>
                Erneut versuchen
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
