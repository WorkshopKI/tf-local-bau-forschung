// Anzeige beigefügter Screenshots eines Feedback-Tickets (v2.42, geteilt seit
// v2.46). Lädt die Bilddateien aus dem Shared-Attachment-Verzeichnis
// (readSharedAttachment, Read-Handle → auch für Nicht-Kuratoren auf dem Board)
// als Object-URLs; Klick aufs Thumbnail öffnet die Lightbox. URLs werden beim
// Unmount sauber freigegeben.
//
// Verwendung: Kurator-Ticket-Detail (voll, mit Überschrift) + öffentliches
// Feedback-Board Card/Liste (`compact` = kleinere Thumbnails ohne Überschrift).

import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { readSharedAttachment } from '@/core/services/feedback';
import type { FeedbackAttachment } from '@/core/types/feedback';
import { FeedbackBildLightbox } from './FeedbackBildLightbox';

interface Props {
  attachments: FeedbackAttachment[];
  /** Kompakte Variante (kleinere Thumbnails, keine Überschrift/Caption) für die
   *  Listen-Zelle. Default false = Kurator-Detail-Optik. */
  compact?: boolean;
  /** Größen-Variante (v2.225, überstimmt `compact`):
   *  'board'   = nur das ERSTE Bild, volle Breite × 56px (Kanban-Karte);
   *  'thumb44' = 44×44-Thumbnails (kompakte Listen-Spalte). */
  variant?: 'board' | 'thumb44';
}

export function FeedbackScreenshots({ attachments, compact = false, variant }: Props): React.ReactElement | null {
  const storage = useStorage();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<FeedbackAttachment | null>(null);

  // Nur Bilder (v2.199.1) — beigefügte Dateien rendert FeedbackFiles. Alt-Anhänge
  // ohne `kind` gelten als Bild.
  const allImages = attachments.filter(a => a.kind !== 'file');
  const images = variant === 'board' ? allImages.slice(0, 1) : allImages;

  useEffect(() => {
    let cancelled = false;
    const created: Record<string, string> = {};
    void (async () => {
      for (const att of images) {
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

  if (images.length === 0) return null;

  // Größen: 'board' = ein breites Karten-Thumbnail; 'thumb44' = quadratisch für
  // die kompakte Listen-Spalte; compact = kleine, gecroppte Thumbnails (Liste).
  // Default (Detail-Panel/Kurator-Detail): großes Vorschaubild, das auf die
  // Panel-Breite skaliert und das GANZE Bild zeigt (object-contain).
  const size: 'board' | 'thumb44' | 'compact' | 'detail' = variant ?? (compact ? 'compact' : 'detail');
  const wrapCls = { board: 'w-full', thumb44: '', compact: '', detail: 'w-full max-w-[440px]' }[size];
  const imgCls = {
    board: 'w-full h-14 object-cover object-left-top',
    thumb44: 'w-[44px] h-[44px] object-cover object-left-top',
    compact: 'w-[68px] h-[44px] object-cover',
    detail: 'w-full h-auto max-h-[360px] object-contain bg-[var(--tf-bg-secondary)]',
  }[size];
  const boxCls = {
    board: 'w-full h-14',
    thumb44: 'w-[44px] h-[44px]',
    compact: 'w-[68px] h-[44px]',
    detail: 'w-full h-[200px]',
  }[size];

  return (
    <div>
      {size === 'detail' && (
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium mb-1">
          Screenshots ({images.length})
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {images.map(att => (
          <div key={att.id} className={`flex flex-col gap-1 ${wrapCls}`}>
            {urls[att.id] ? (
              <img
                src={urls[att.id]}
                alt={att.caption || 'Screenshot'}
                onClick={() => setLightbox(att)}
                className={`${imgCls} rounded-[var(--tf-radius)] cursor-zoom-in`}
                style={{ border: '0.5px solid var(--tf-border)' }}
              />
            ) : (
              <div className={`${boxCls} rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] flex items-center justify-center text-[10px] text-[var(--tf-text-tertiary)]`} style={{ border: '0.5px solid var(--tf-border)' }}>
                Lädt…
              </div>
            )}
            {size === 'detail' && att.caption && <p className="text-[10px] text-[var(--tf-text-secondary)] leading-snug" title={att.caption}>{att.caption}</p>}
          </div>
        ))}
      </div>

      {lightbox && urls[lightbox.id] && (
        <FeedbackBildLightbox
          src={urls[lightbox.id]!}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
