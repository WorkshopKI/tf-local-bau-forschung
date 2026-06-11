import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ChatMessage } from '../types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';

export interface ActivePanel { mid: string; n: number; }

interface MessageListProps {
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  activePanel: ActivePanel | null;
  onCite: (mid: string, n: number) => void;
  onRetry: () => void;
  onRegenerate: () => void;
  onFeedback: (mid: string, fb: 'up' | 'down') => void;
}

/** Thread-Spalte: scrollbarer Verlauf mit User-/Assistant-Nachrichten. */
export function MessageList({
  messages, busy, error, activePanel, onCite, onRetry, onRegenerate, onFeedback,
}: MessageListProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  return (
    <div ref={scrollRef} className="convo-scroll scroll">
      <div className="thread">
        {messages.map((m, i) => (
          m.role === 'user'
            ? <UserMessage key={m.id} m={m} />
            : (
              <AssistantMessage
                key={m.id}
                m={m}
                isLast={i === messages.length - 1}
                busy={busy}
                activeN={activePanel && activePanel.mid === m.id ? activePanel.n : null}
                onCite={n => onCite(m.id, n)}
                onRegenerate={onRegenerate}
                onFeedback={fb => onFeedback(m.id, fb)}
              />
            )
        ))}
        {error && (
          <div className="chat-error">
            {error}
            <button onClick={() => onRetry()}><RefreshCw size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Erneut versuchen</button>
          </div>
        )}
        <div className="thread-end" />
      </div>
    </div>
  );
}
