// Kurator-Anzeige der beigefügten Screenshots eines Tickets (v2.42). Lädt die
// Bilddateien aus dem Shared-Attachment-Verzeichnis (readSharedAttachment) als
// Object-URLs; Klick = Lightbox. URLs werden beim Unmount sauber freigegeben.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { readSharedAttachment } from '@/core/services/feedback';
import type { FeedbackAttachment } from '@/core/types/feedback';

export function TicketScreenshots({ attachments }: { attachments: FeedbackAttachment[] }): React.ReactElement | null {
  const storage = useStorage();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<FeedbackAttachment | null>(null);

  useEffect(() => {
    let cancelled = false;
    const created: Record<string, string> = {};
    void (async () => {
      for (const att of attachments) {
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
  }, [attachments, storage]);

  if (attachments.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium mb-1">
        Screenshots ({attachments.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map(att => (
          <div key={att.id} className="flex flex-col gap-1 w-[120px]">
            {urls[att.id] ? (
              <img
                src={urls[att.id]}
                alt={att.caption || 'Screenshot'}
                onClick={() => setLightbox(att)}
                className="w-[120px] h-[78px] object-cover rounded-[var(--tf-radius)] cursor-zoom-in"
                style={{ border: '0.5px solid var(--tf-border)' }}
              />
            ) : (
              <div className="w-[120px] h-[78px] rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] flex items-center justify-center text-[10px] text-[var(--tf-text-tertiary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
                Lädt…
              </div>
            )}
            {att.caption && <p className="text-[10px] text-[var(--tf-text-secondary)] leading-snug" title={att.caption}>{att.caption}</p>}
          </div>
        ))}
      </div>

      {lightbox && urls[lightbox.id] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setLightbox(null)} role="dialog" aria-label="Screenshot-Vollansicht">
          <button type="button" onClick={() => setLightbox(null)} className="absolute top-4 right-4 p-1.5 rounded-full bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer" style={{ border: '0.5px solid var(--tf-border)' }} aria-label="Schließen">
            <X size={16} />
          </button>
          <div className="flex flex-col items-center gap-2 max-w-[92vw] max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <img src={urls[lightbox.id]} alt={lightbox.caption || 'Screenshot'} className="max-w-full max-h-[82vh] object-contain rounded-[var(--tf-radius)]" />
            {lightbox.caption && <p className="text-[12px] text-white/90">{lightbox.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
