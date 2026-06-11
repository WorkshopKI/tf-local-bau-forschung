import { useState } from 'react';
import { FileText } from 'lucide-react';
import { CopyButton } from './CopyButton';
import type { ChatMessage } from '../types';

/** Lange Eingaben werden eingeklappt (Klammer: > ~360 Zeichen oder > 6 Zeilen). */
function isLongContent(text: string): boolean {
  return text.length > 360 || text.split('\n').length > 6;
}

/** Rechtsbündige User-Nachricht: Bubble (lange Texte einklappbar), Anhang-Pills, Hover-Kopieren. */
export function UserMessage({ m }: { m: ChatMessage }): React.ReactElement {
  const long = isLongContent(m.content);
  const [expanded, setExpanded] = useState(false);
  const clamped = long && !expanded;

  return (
    <div className="msg user">
      <div className={`bubble${clamped ? ' clamped' : ''}`}>{m.content}</div>
      {long && (
        <button className="msg-more" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
        </button>
      )}
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
