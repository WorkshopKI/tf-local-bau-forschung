import type { ChatAttachment } from '../types';

/** Zeichen-Limit pro Attachment (~8k Tokens) — bounded auch die chat:conv-Record-Größe. */
export const MAX_ATTACHMENT_CHARS = 30_000;
/** Zeichen-Limit für alle Attachments einer Message zusammen. */
export const MAX_TOTAL_ATTACHMENT_CHARS = 60_000;

export type ChatFileValidation =
  | { ok: true; format: ChatAttachment['format'] }
  | { ok: false; error: string };

/** Erlaubte Chat-Anhänge prüfen. `.doc` MUSS hier abgefangen werden, BEVOR der
 *  DocConverter läuft — dessen else-Branch würde das Binärformat als Text
 *  dekodieren und Müll liefern. */
export function validateChatFile(filename: string): ChatFileValidation {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
  switch (ext) {
    case 'pdf': return { ok: true, format: 'pdf' };
    case 'docx': return { ok: true, format: 'docx' };
    case 'md': return { ok: true, format: 'md' };
    case 'txt': return { ok: true, format: 'txt' };
    case 'doc':
      return {
        ok: false,
        error: 'Altes Word-Format (.doc) wird nicht unterstützt. Bitte die Datei in Word als .docx speichern und erneut anhängen.',
      };
    default:
      return {
        ok: false,
        error: `Nicht unterstütztes Format${ext ? ` (.${ext})` : ''} — erlaubt sind PDF, DOCX, MD und TXT.`,
      };
  }
}

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
