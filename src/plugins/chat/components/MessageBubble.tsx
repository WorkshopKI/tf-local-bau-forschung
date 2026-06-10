import { memo } from 'react';
import { FileText } from 'lucide-react';
import { MarkdownRenderer } from '@/ui';
import type { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

/** Eine Chat-Nachricht. React.memo: beim Streaming re-rendert nur die wachsende Bubble. */
export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps): React.ReactElement {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-3 rounded-[var(--tf-radius-lg)] text-[13.5px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]">
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.attachments.map(att => (
                <span
                  key={att.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-[var(--tf-info-bg)] text-[var(--tf-info-text)] rounded-full"
                  title={att.truncated ? `Gekürzt auf ${att.charCount.toLocaleString('de-DE')} von ${att.originalCharCount.toLocaleString('de-DE')} Zeichen` : undefined}
                >
                  <FileText size={10} />
                  {att.filename}
                  {att.truncated ? ' (gekürzt)' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="text-[13.5px] text-[var(--tf-text)]">
      <MarkdownRenderer content={message.content} />
      {message.ragSources && message.ragSources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {message.ragSources.map((src, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)] rounded-full">
              {src}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
