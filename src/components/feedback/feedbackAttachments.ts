// Screenshot-Anhänge: Erfassungs-/Skalierungs-Helfer + In-Memory-Typ (v2.42).
//
// `PendingAttachment` hält den noch nicht persistierten Blob (Clipboard-Paste /
// Upload, ggf. annotiert). Die serialisierbare Referenz ist `FeedbackAttachment`
// (src/core/types/feedback.ts) — der Blob wird daraus NICHT abgeleitet, sondern
// getrennt durch die Submit-Kette gereicht.
//
// Reine Funktionen (computeScaledSize) sind node-testbar; die Canvas-basierten
// Funktionen laufen nur im Browser (file:// ist ein Secure Context, Canvas ok).

export type AttachmentMime = 'image/png' | 'image/jpeg';

export interface PendingAttachment {
  id: string;
  blob: Blob;
  caption: string;
  width: number;
  height: number;
  mime: AttachmentMime;
  bytes: number;
}

/** Max. Breite skalierter Screenshots — hält die Outboxen klein. */
export const MAX_ATTACHMENT_WIDTH = 1600;

/**
 * Pure Dimensions-Mathematik: skaliert auf `maxW` Breite runter (Seitenverhältnis
 * bleibt), lässt ≤ maxW unverändert. Höhe wird gerundet.
 */
export function computeScaledSize(
  width: number,
  height: number,
  maxW: number = MAX_ATTACHMENT_WIDTH,
): { width: number; height: number } {
  if (width <= maxW) return { width, height };
  const ratio = maxW / width;
  return { width: maxW, height: Math.round(height * ratio) };
}

/** Kurze, kollisionsarme Attachment-id (Secure Context unter file:// → crypto). */
export function makeAttachmentId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** Dateiendung passend zum MIME-Typ. */
export function extForMime(mime: AttachmentMime): 'png' | 'jpg' {
  return mime === 'image/png' ? 'png' : 'jpg';
}

/** Promisified `canvas.toBlob`. */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: AttachmentMime,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('canvas.toBlob lieferte null'))),
      type,
      quality,
    );
  });
}

/**
 * Skaliert ein Bild-Blob/-File auf ≤ MAX_ATTACHMENT_WIDTH und kodiert es als
 * JPEG q0.85 (reiner Screenshot ohne Annotation). Liefert den fertigen
 * PendingAttachment-Rumpf (ohne caption).
 */
export async function scaleImageToAttachment(file: Blob): Promise<Omit<PendingAttachment, 'caption'>> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = computeScaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D-Context nicht verfügbar');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
    return { id: makeAttachmentId(), blob, width, height, mime: 'image/jpeg', bytes: blob.size };
  } finally {
    bitmap.close();
  }
}
