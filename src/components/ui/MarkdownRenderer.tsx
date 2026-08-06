import { useMemo } from 'react';
import { marked } from 'marked';

/**
 * Wie gross die Ueberschriften im Markdown gesetzt werden.
 *
 * - `standard`: der Text steht fuer sich (Dokumentvorschau, Lesemodus,
 *   Kontext-Panels) — `##` ist dort die groesste sichtbare Zeile.
 * - `unterTitel`: ueber dem Text steht bereits ein Titel, den der Leser als
 *   Ueberschrift liest (Dialog-Titelzeile der Seiten-Hilfe). Die Stufen ruecken
 *   eine Ebene tiefer, damit der Titel groesser bleibt als sein Inhalt.
 */
type UeberschriftenStufe = 'standard' | 'unterTitel';

const UEBERSCHRIFTEN: Record<UeberschriftenStufe, string> = {
  standard:
    '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mb-2',
  // 18 -> 16 -> 14 px unter einem 18px-Titel; h3 traegt bei gleicher Groesse wie
  // der Fliesstext das schwerere Gewicht, sonst waere es keine Ueberschrift mehr.
  unterTitel:
    '[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-2',
};

interface MarkdownRendererProps {
  content: string;
  /** Default `standard` — keine Aenderung an den bestehenden Einbaustellen. */
  ueberschriften?: UeberschriftenStufe;
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

export function MarkdownRenderer({
  content, ueberschriften = 'standard',
}: MarkdownRendererProps): React.ReactElement {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return sanitizeHtml(raw);
  }, [content]);

  return (
    <div
      // `[&_ul_ul]`: verschachtelte Aufzaehlungen (Unterpunkte je UI-Bereich in den
      // Kontext-Docs) erben sonst `list-disc` + `mb-3` von der ersten Ebene.
      className={`prose-tf text-sm text-[var(--tf-text)] [&_ul_ul]:list-[circle] [&_ul_ul]:mt-1 [&_ul_ul]:mb-0 ${UEBERSCHRIFTEN[ueberschriften]} [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_code]:bg-[var(--tf-bg-secondary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-[var(--tf-bg-secondary)] [&_pre]:p-4 [&_pre]:rounded-[var(--tf-radius-sm)] [&_pre]:overflow-x-auto [&_pre]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_th]:border [&_th]:border-[var(--tf-border)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:bg-[var(--tf-bg-secondary)] [&_td]:border [&_td]:border-[var(--tf-border)] [&_td]:px-3 [&_td]:py-2 [&_a]:text-[var(--tf-primary)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--tf-primary)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--tf-text-secondary)] [&_blockquote]:mb-3`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
