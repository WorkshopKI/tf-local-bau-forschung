import type { ChatAttachment } from '../types';

/** Zeichen-Limit pro Attachment (~8k Tokens) — bounded auch die chat:conv-Record-Größe. */
export const MAX_ATTACHMENT_CHARS = 30_000;
/** Zeichen-Limit für alle Attachments einer Message zusammen. */
export const MAX_TOTAL_ATTACHMENT_CHARS = 60_000;

/** Markdown auf MAX_ATTACHMENT_CHARS kürzen, mit Hinweis am Ende. */
export function truncateAttachmentMarkdown(markdown: string): { markdown: string; truncated: boolean } {
  if (markdown.length <= MAX_ATTACHMENT_CHARS) return { markdown, truncated: false };
  const cut = markdown.slice(0, MAX_ATTACHMENT_CHARS);
  return {
    markdown: `${cut}\n\n[Gekürzt: Original hat ${markdown.length} Zeichen, die ersten ${MAX_ATTACHMENT_CHARS.toLocaleString('de-DE')} wurden übernommen.]`,
    truncated: true,
  };
}

/** Attachment-Blöcke für den API-Payload (nicht für die Anzeige). */
export function buildAttachmentContext(attachments: ChatAttachment[]): string {
  if (attachments.length === 0) return '';
  return attachments
    .map((a, i) => {
      const nr = i + 1;
      return `--- Angehängtes Dokument ${nr}: ${a.filename} ---\n${a.markdown}\n--- Ende Dokument ${nr} ---`;
    })
    .join('\n\n');
}
