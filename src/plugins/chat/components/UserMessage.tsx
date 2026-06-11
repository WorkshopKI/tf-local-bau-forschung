import { FileText } from 'lucide-react';
import { CopyButton } from './CopyButton';
import type { ChatMessage } from '../types';

/** Rechtsbündige User-Nachricht mit Anhang-Pills und Hover-Kopieren. */
export function UserMessage({ m }: { m: ChatMessage }): React.ReactElement {
  return (
    <div className="msg user">
      <div className="bubble">{m.content}</div>
      {m.attachments && m.attachments.length > 0 && (
        <div className="msg-atts">
          {m.attachments.map(a => (
            <span key={a.id} className="msg-att" title={a.truncated ? 'Inhalt gekürzt' : undefined}>
              <FileText size={11} />{a.filename}{a.truncated ? ' (gekürzt)' : ''}
            </span>
          ))}
        </div>
      )}
      <div className="msg-edit">
        <CopyButton text={m.content} size={14} />
      </div>
    </div>
  );
}
