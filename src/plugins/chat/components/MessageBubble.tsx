import { memo } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { Badge, MarkdownRenderer } from '@/ui';
import type { ChatMessage } from '../types';
import { formatStats, statsSourceLabel } from '../format-stats';
import { ThinkingBlock } from './ThinkingBlock';
import { CopyButton } from './CopyButton';

interface MessageBubbleProps {
  message: ChatMessage;
  /** Letzte Message im Verlauf — nur dort gibt es Regenerieren. */
  isLast: boolean;
  /** Generierung läuft (für die letzte Bubble: Aktionen ausblenden). */
  busy: boolean;
  onRegenerate: () => void;
}

/** Eine Chat-Nachricht. React.memo: beim Streaming re-rendert nur die wachsende Bubble. */
export const MessageBubble = memo(function MessageBubble({
  message, isLast, busy, onRegenerate,
}: MessageBubbleProps): React.ReactElement {
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

  const streaming = busy && isLast;
  const statsLine = message.stats ? formatStats(message.stats) : '';

  return (
    <div className="text-[13.5px] text-[var(--tf-text)]">
      {message.thinking && (
        <ThinkingBlock thinking={message.thinking} autoOpen={!message.content} />
      )}
      <MarkdownRenderer content={message.content} />
      {message.aborted && (
        <div className="mt-1.5">
          <Badge variant="default">Abgebrochen</Badge>
        </div>
      )}
      {message.error && (
        <p className="mt-1.5 text-[11.5px] text-[var(--tf-danger-text)]">
          Generierung abgebrochen: {message.error}
        </p>
      )}
      {message.ragSources && message.ragSources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {message.ragSources.map((src, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)] rounded-full">
              {src}
            </span>
          ))}
        </div>
      )}
      {!streaming && (
        <div className="mt-1.5 flex items-center gap-1">
          {message.content && <CopyButton text={message.content} />}
          {isLast && !busy && (
            <button
              onClick={onRegenerate}
              title="Antwort neu generieren"
              className="p-1.5 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] rounded-[var(--tf-radius)] cursor-pointer"
            >
              <RefreshCw size={13} />
            </button>
          )}
          {statsLine && message.stats && (
            <span
              className="ml-1 text-[11px] text-[var(--tf-text-tertiary)]"
              title={statsSourceLabel(message.stats.source)}
            >
              {statsLine}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
