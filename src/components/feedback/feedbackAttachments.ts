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
  /** Bild-MIME bei Screenshots; beliebiger Datei-MIME bei `kind:'file'`. */
  mime: string;
  bytes: number;
  /** Default `'image'` (Screenshot). `'file'` = beigefügtes Dokument (v2.199.1). */
  kind?: 'image' | 'file';
  /** Original-Dateiname (nur bei `kind:'file'`). */
  name?: string;
}

/** Max. Breite skalierter Screenshots — hält die Outboxen klein. */
export const MAX_ATTACHMENT_WIDTH = 1600;

// ── Datei-Anhänge (v2.199.1) ────────────────────────────────────────────────
// Beigefügte Dokumente neben den Screenshots. Die Bytes laufen durch dieselbe
// Storage-/Outbox-/Merge-Pipeline wie Screenshots (mime-agnostisch); nur die
// Erfassung (kein Skalieren) + Anzeige (Download-Chip statt Thumbnail) sind neu.

/** Max. Größe pro beigefügter Datei (10 MB) — hält den Daten-Share/Outbox schlank. */
export const FEEDBACK_MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface FeedbackFileType {
  ext: string;
  mimes: string[];
  label: string;
  /** lucide-Icon-Name für die Anzeige. */
  icon: string;
}

/** Whitelist erlaubter Datei-Typen (Büro-/Text-Formate). Kuratiert — kein exe/js/… */
export const FEEDBACK_FILE_TYPES: readonly FeedbackFileType[] = [
  { ext: 'pdf', mimes: ['application/pdf'], label: 'PDF', icon: 'FileText' },
  { ext: 'docx', mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], label: 'Word', icon: 'FileText' },
  { ext: 'xlsx', mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], label: 'Excel', icon: 'FileSpreadsheet' },
  { ext: 'pptx', mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], label: 'PowerPoint', icon: 'Presentation' },
  { ext: 'csv', mimes: ['text/csv'], label: 'CSV', icon: 'FileSpreadsheet' },
  { ext: 'txt', mimes: ['text/plain'], label: 'Text', icon: 'FileText' },
  { ext: 'md', mimes: ['text/markdown'], label: 'Markdown', icon: 'FileText' },
] as const;

/** Für das `accept`-Attribut des File-Inputs. */
export const FEEDBACK_FILE_ACCEPT = FEEDBACK_FILE_TYPES.map(t => `.${t.ext}`).join(',');

/** Kleingeschriebene Dateiendung (ohne Punkt) aus einem Dateinamen. */
export function extFromFileName(name: string | undefined): string {
  const m = /\.([a-z0-9]+)$/i.exec((name ?? '').trim());
  return m ? m[1]!.toLowerCase() : '';
}

/** Whitelist-Eintrag zu einem Dateinamen (per Endung), oder null wenn nicht erlaubt. */
export function feedbackFileTypeForName(name: string): FeedbackFileType | null {
  const ext = extFromFileName(name);
  return FEEDBACK_FILE_TYPES.find(t => t.ext === ext) ?? null;
}

export type FileValidationResult =
  | { ok: true; type: FeedbackFileType }
  | { ok: false; reason: 'type' | 'size' | 'empty' };

/** Reine Validierung (Typ-Whitelist + Größe) — node-testbar. */
export function validateFeedbackFile(file: { name: string; size: number }): FileValidationResult {
  const type = feedbackFileTypeForName(file.name);
  if (!type) return { ok: false, reason: 'type' };
  if (file.size <= 0) return { ok: false, reason: 'empty' };
  if (file.size > FEEDBACK_MAX_FILE_BYTES) return { ok: false, reason: 'size' };
  return { ok: true, type };
}

/** Baut aus einer validierten Datei einen `PendingAttachment` (kein Skalieren). */
export function fileToPendingAttachment(file: File): PendingAttachment {
  const type = feedbackFileTypeForName(file.name);
  return {
    id: makeAttachmentId(),
    blob: file,
    caption: '',
    width: 0,
    height: 0,
    mime: file.type || type?.mimes[0] || 'application/octet-stream',
    bytes: file.size,
    kind: 'file',
    name: file.name,
  };
}

/** Menschenlesbare Dateigröße (z.B. „1,4 MB"). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
}

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
