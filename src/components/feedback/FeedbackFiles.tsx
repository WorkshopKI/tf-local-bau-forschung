// Anzeige beigefügter Dateien eines Feedbacks (v2.199.1) — Download-Chips.
// Lädt die Bytes aus dem Shared-Attachment-Verzeichnis (readSharedAttachment,
// Read-Handle → auch für Nicht-Kuratoren) als Object-URLs; Klick lädt herunter
// (`<a download>`, file://-tauglich). URLs werden beim Unmount freigegeben.
// Gegenstück zu FeedbackScreenshots (die nur noch Bilder rendert).

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { readSharedAttachment } from '@/core/services/feedback';
import type { FeedbackAttachment } from '@/core/types/feedback';
import { formatFileSize } from './feedbackAttachments';
import { FileTypeIcon } from './FileTypeIcon';

interface Props {
  attachments: FeedbackAttachment[];
}

export function FeedbackFiles({ attachments }: Props): React.ReactElement | null {
  const storage = useStorage();
  const files = attachments.filter(a => a.kind === 'file');
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const created: Record<string, string> = {};
    void (async () => {
      for (const att of files) {
        const bytes = await readSharedAttachment(storage, att.filename);
        if (cancelled) break;
        if (bytes) created[att.id] = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: att.mime }));
      }
      if (!cancelled) setUrls({ ...created });
    })();
    return () => {
      cancelled = true;
      Object.values(created).forEach(URL.revokeObjectURL);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments, storage]);

  if (files.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium mb-1">
        Dateien ({files.length})
      </p>
      <div className="flex flex-col gap-1.5">
        {files.map(att => {
          const name = att.name || att.filename;
          const url = urls[att.id];
          return (
            <a
              key={att.id}
              href={url ?? undefined}
              download={name}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] transition-colors ${url ? 'hover:bg-[var(--tf-hover)] cursor-pointer' : 'opacity-60 pointer-events-none'}`}
              title={url ? `„${name}" herunterladen` : 'Lädt…'}
            >
              <FileTypeIcon name={name} size={16} className="text-[var(--tf-text-secondary)] shrink-0" />
              <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text)]">{name}</span>
              <span className="shrink-0 text-[10.5px] text-[var(--tf-text-tertiary)] tabular-nums">{formatFileSize(att.bytes)}</span>
              <Download size={13} className="shrink-0 text-[var(--tf-text-tertiary)]" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
