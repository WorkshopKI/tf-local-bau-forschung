import { useMemo } from 'react';
import { marked } from 'marked';
import { sanitizeHtml } from '@/ui/MarkdownRenderer';
import { renderCitations } from '../services/citations';

interface CitationAnswerProps {
  content: string;
  /** Aktive Quelle dieser Nachricht (Highlight) oder null. */
  activeN: number | null;
  /** Blinkender Caret während des Streamings. */
  streaming: boolean;
  onCite: (n: number) => void;
}

/**
 * Rendert die Antwort als Markdown (marked + sanitize) und reichert sie um
 * klickbare [n]-Zitate an (Post-Pass, voller marked-Funktionsumfang bleibt).
 * Klicks werden per Event-Delegation auf .cite-Spans ausgewertet.
 */
export function CitationAnswer({ content, activeN, streaming, onCite }: CitationAnswerProps): React.ReactElement {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return renderCitations(sanitizeHtml(raw), activeN ?? undefined);
  }, [content, activeN]);

  const onClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const el = (e.target as HTMLElement).closest('.cite');
    if (!el) return;
    const n = Number.parseInt((el as HTMLElement).dataset.cite ?? '', 10);
    if (!Number.isNaN(n)) onCite(n);
  };

  return (
    <div
      className="ans"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: streaming ? `${html}<span class="caret"></span>` : html }}
    />
  );
}
