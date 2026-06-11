import { memo, useState } from 'react';
import { ChevronRight, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { formatStats, statsSourceLabel } from '../format-stats';
import type { ChatMessage, ChatSource } from '../types';
import { CitationAnswer } from './CitationAnswer';
import { ThinkingBlock } from './ThinkingBlock';
import { CopyButton } from './CopyButton';

interface AssistantMessageProps {
  m: ChatMessage;
  isLast: boolean;
  busy: boolean;
  /** Aktive Quelle dieser Nachricht (Highlight) oder null. */
  activeN: number | null;
  onCite: (n: number) => void;
  onRegenerate: () => void;
  onFeedback: (fb: 'up' | 'down') => void;
}

function ContextBox({ sources, onCite }: { sources: ChatSource[]; onCite: (n: number) => void }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div className="ctxbox">
      <button className="ctxbox-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <ChevronRight size={14} className="chev" />
        Verwendeter Kontext <span className="cnt">{sources.length} Quellen</span>
      </button>
      {open && (
        <div className="ctxlist">
          {sources.map(s => (
            <div key={s.n} className="ctxitem" onClick={() => onCite(s.n)}>
              <span className="ctxn">{s.n}</span>
              <div>
                <div className="ctxt">{s.title}{s.antragFkz && <span className="ctxfkz">· {s.antragFkz}</span>}</div>
                {s.contextLine && <div className="ctxs">{s.contextLine}</div>}
              </div>
              <span className="ctxrel">{s.relevance} %</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const AssistantMessage = memo(function AssistantMessage({
  m, isLast, busy, activeN, onCite, onRegenerate, onFeedback,
}: AssistantMessageProps): React.ReactElement {
  const streaming = busy && isLast;

  if (streaming && !m.content && !m.thinking) {
    return (
      <div className="msg assistant">
        <span className="thinking"><RefreshCw size={14} className="spin" />Sucht im Archiv …</span>
      </div>
    );
  }

  const sources = m.sources ?? [];
  const statsLine = m.stats ? formatStats(m.stats) : '';

  return (
    <div className="msg assistant">
      {m.thinking && <ThinkingBlock thinking={m.thinking} autoOpen={!m.content} streaming={streaming && !m.content} />}
      <CitationAnswer content={m.content} activeN={activeN} streaming={streaming} onCite={onCite} />

      {m.aborted && <div style={{ marginTop: 6 }}><span className="assistant-badge">Abgebrochen</span></div>}
      {m.error && <div className="chat-error" style={{ marginTop: 8 }}>Generierung abgebrochen: {m.error}</div>}

      {sources.length > 0 && (
        <>
          <div className="srcchips">
            {sources.map(s => (
              <div key={s.n} className={`srcchip${activeN === s.n ? ' active' : ''}`} onClick={() => onCite(s.n)}>
                <span className="srcchip-num">{s.n}</span>
                <span className="srcchip-body">
                  <span className="srcchip-t">{s.title}</span>
                  <span className="srcchip-f">{s.antragFkz ?? s.sourcePath}</span>
                </span>
              </div>
            ))}
          </div>
          <ContextBox sources={sources} onCite={onCite} />
        </>
      )}

      {!streaming && (
        <div className="msg-actions">
          {m.content && <CopyButton text={m.content} />}
          {isLast && (
            <button className="act" title="Neu generieren" onClick={onRegenerate}><RefreshCw size={15} /></button>
          )}
          <button className={`act${m.feedback === 'up' ? ' on-up' : ''}`} title="Hilfreich" onClick={() => onFeedback('up')}>
            <ThumbsUp size={15} />
          </button>
          <button className={`act${m.feedback === 'down' ? ' on-down' : ''}`} title="Nicht hilfreich" onClick={() => onFeedback('down')}>
            <ThumbsDown size={15} />
          </button>
          {statsLine && m.stats && (
            <span className="msg-meta" title={statsSourceLabel(m.stats.source)}>{statsLine}</span>
          )}
        </div>
      )}
    </div>
  );
});
