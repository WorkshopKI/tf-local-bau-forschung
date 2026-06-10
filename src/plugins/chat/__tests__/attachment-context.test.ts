import { describe, expect, it } from 'vitest';
import {
  buildAttachmentContext,
  truncateAttachmentMarkdown,
  validateChatFile,
  MAX_ATTACHMENT_CHARS,
} from '../attachments/attachment-context';
import type { ChatAttachment } from '../types';

function att(filename: string, markdown: string): ChatAttachment {
  return {
    id: filename, filename, format: 'md', markdown,
    charCount: markdown.length, originalCharCount: markdown.length, truncated: false,
  };
}

describe('buildAttachmentContext', () => {
  it('leeres Array → leerer String', () => {
    expect(buildAttachmentContext([])).toBe('');
  });

  it('ein Attachment → Block mit Dateiname und Ende-Marker', () => {
    const ctx = buildAttachmentContext([att('notiz.md', 'Hallo Inhalt')]);
    expect(ctx).toContain('Angehängtes Dokument 1: notiz.md');
    expect(ctx).toContain('Hallo Inhalt');
    expect(ctx).toContain('Ende Dokument 1');
  });

  it('mehrere Attachments werden durchnummeriert', () => {
    const ctx = buildAttachmentContext([att('a.md', 'A'), att('b.md', 'B')]);
    expect(ctx).toContain('Dokument 1: a.md');
    expect(ctx).toContain('Dokument 2: b.md');
  });
});

describe('validateChatFile', () => {
  it('akzeptiert pdf/docx/md/txt (case-insensitive)', () => {
    expect(validateChatFile('a.pdf')).toEqual({ ok: true, format: 'pdf' });
    expect(validateChatFile('B.DOCX')).toEqual({ ok: true, format: 'docx' });
    expect(validateChatFile('notiz.md')).toEqual({ ok: true, format: 'md' });
    expect(validateChatFile('log.txt')).toEqual({ ok: true, format: 'txt' });
  });

  it('.doc bekommt die Als-docx-speichern-Fehlermeldung', () => {
    const r = validateChatFile('alt.doc');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('.docx');
  });

  it('unbekannte Endung → generische Fehlermeldung mit erlaubten Formaten', () => {
    const r = validateChatFile('bild.png');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('PDF');
  });
});

describe('truncateAttachmentMarkdown', () => {
  it('unter dem Limit: unverändert, truncated=false', () => {
    const r = truncateAttachmentMarkdown('kurz');
    expect(r).toEqual({ markdown: 'kurz', truncated: false });
  });

  it('über dem Limit: gekürzt + Hinweis mit Original-Länge', () => {
    const long = 'y'.repeat(MAX_ATTACHMENT_CHARS + 500);
    const r = truncateAttachmentMarkdown(long);
    expect(r.truncated).toBe(true);
    expect(r.markdown.length).toBeLessThan(long.length);
    expect(r.markdown).toContain('Gekürzt');
    expect(r.markdown).toContain(String(MAX_ATTACHMENT_CHARS + 500));
  });
});
