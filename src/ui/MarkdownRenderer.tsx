import { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

export function MarkdownRenderer({ content }: MarkdownRendererProps): React.ReactElement {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return sanitizeHtml(raw);
  }, [content]);

  return (
    <div
      className="prose-tf text-sm text-[var(--tf-text)] [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mb-2 [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_code]:bg-[var(--tf-bg-secondary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-[var(--tf-bg-secondary)] [&_pre]:p-4 [&_pre]:rounded-[var(--tf-radius-sm)] [&_pre]:overflow-x-auto [&_pre]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_th]:border [&_th]:border-[var(--tf-border)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:bg-[var(--tf-bg-secondary)] [&_td]:border [&_td]:border-[var(--tf-border)] [&_td]:px-3 [&_td]:py-2 [&_a]:text-[var(--tf-primary)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--tf-primary)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--tf-text-secondary)] [&_blockquote]:mb-3"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
