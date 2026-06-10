/**
 * Staging für Chat-Anhänge (attach-to-next-message): Dateien werden sofort
 * beim Hinzufügen via DocConverter (PDF/DOCX/MD/TXT → Markdown) konvertiert
 * und gekürzt; beim Senden wandern die fertigen Attachments an die User-Message
 * und das Staging wird geleert.
 *
 * addFiles fängt alle Fehler PRO DATEI intern (Error-Pill) und rejected nie —
 * darf deshalb direkt aus onChange/onDrop aufgerufen werden.
 */
import { useCallback, useRef, useState } from 'react';
import { DocConverter } from '@/core/services/converter';
import { uuid } from '@/core/services/id-generator';
import type { ChatAttachment } from '../types';
import {
  MAX_TOTAL_ATTACHMENT_CHARS,
  truncateAttachmentMarkdown,
  validateChatFile,
} from './attachment-context';

export interface StagedAttachment {
  id: string;
  filename: string;
  status: 'converting' | 'ready' | 'error';
  attachment?: ChatAttachment;
  error?: string;
}

export interface UseAttachmentsResult {
  staged: StagedAttachment[];
  addFiles: (files: File[]) => Promise<void>;
  remove: (id: string) => void;
  clear: () => void;
  /** Fertig konvertierte Attachments für den Send. */
  readyAttachments: ChatAttachment[];
  /** true solange noch mindestens eine Konvertierung läuft. */
  converting: boolean;
}

export function useAttachments(): UseAttachmentsResult {
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const converterRef = useRef<DocConverter | null>(null);

  const addFiles = useCallback(async (files: File[]): Promise<void> => {
    for (const file of files) {
      const id = uuid();
      const validation = validateChatFile(file.name);
      if (!validation.ok) {
        setStaged(prev => [...prev, { id, filename: file.name, status: 'error', error: validation.error }]);
        continue;
      }
      setStaged(prev => [...prev, { id, filename: file.name, status: 'converting' }]);
      try {
        converterRef.current ??= new DocConverter();
        const converted = await converterRef.current.convert(file);
        const { markdown, truncated } = truncateAttachmentMarkdown(converted.markdown);
        setStaged(prev => {
          const totalOther = prev.reduce(
            (sum, s) => (s.status === 'ready' && s.id !== id ? sum + (s.attachment?.charCount ?? 0) : sum),
            0,
          );
          if (totalOther + markdown.length > MAX_TOTAL_ATTACHMENT_CHARS) {
            return prev.map(s => (s.id === id
              ? { ...s, status: 'error' as const, error: `Gesamtlimit von ${MAX_TOTAL_ATTACHMENT_CHARS.toLocaleString('de-DE')} Zeichen pro Nachricht erreicht — Datei entfernen oder einzeln senden.` }
              : s));
          }
          const attachment: ChatAttachment = {
            id,
            filename: file.name,
            format: validation.format,
            markdown,
            charCount: markdown.length,
            originalCharCount: converted.markdown.length,
            truncated,
            ...(converted.pages != null ? { pages: converted.pages } : {}),
          };
          return prev.map(s => (s.id === id ? { id, filename: file.name, status: 'ready' as const, attachment } : s));
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStaged(prev => prev.map(s => (s.id === id
          ? { ...s, status: 'error' as const, error: `Konvertierung fehlgeschlagen: ${message}` }
          : s)));
      }
    }
  }, []);

  const remove = useCallback((id: string): void => {
    setStaged(prev => prev.filter(s => s.id !== id));
  }, []);

  const clear = useCallback((): void => {
    setStaged([]);
  }, []);

  return {
    staged,
    addFiles,
    remove,
    clear,
    readyAttachments: staged.filter(s => s.status === 'ready' && s.attachment).map(s => s.attachment!),
    converting: staged.some(s => s.status === 'converting'),
  };
}
