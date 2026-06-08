// Annotations-Modal (v2.42): natives <canvas> 2D, vier Werkzeuge, Shapes werden
// beim Bestätigen flach ins Bild gebrannt (PNG für scharfe Kanten/Text). Keine
// externe Render-Lib. Zeichen-Logik im Hook useAnnotationCanvas.

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Pencil, Square, Type, Undo2, X } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { PendingAttachment } from './feedbackAttachments';
import { useAnnotationCanvas, type AnnotationTool } from './useAnnotationCanvas';

interface Props {
  attachment: PendingAttachment;
  onCancel: () => void;
  onConfirm: (updated: PendingAttachment) => void;
}

const TOOLS: { id: AnnotationTool; icon: typeof ArrowUpRight; label: string }[] = [
  { id: 'arrow', icon: ArrowUpRight, label: 'Pfeil' },
  { id: 'rect', icon: Square, label: 'Rechteck' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'pen', icon: Pencil, label: 'Stift' },
];

export function FeedbackAnnotator({ attachment, onCancel, onConfirm }: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [caption, setCaption] = useState(attachment.caption);
  const a = useAnnotationCanvas(canvasRef, bitmap);

  useEffect(() => {
    let cancelled = false;
    let bmp: ImageBitmap | null = null;
    void createImageBitmap(attachment.blob).then(b => {
      if (cancelled) { b.close(); return; }
      bmp = b;
      setBitmap(b);
    });
    return () => { cancelled = true; bmp?.close(); };
  }, [attachment.blob]);

  const confirm = useAsyncAction(async () => {
    const cap = caption.trim();
    if (!a.hasShapes) {
      // Keine Annotation → Original-Blob behalten, nur Caption aktualisieren.
      onConfirm({ ...attachment, caption: cap });
      return;
    }
    const blob = await a.burn('image/png');
    if (!blob) { onConfirm({ ...attachment, caption: cap }); return; }
    onConfirm({
      ...attachment,
      blob,
      mime: 'image/png',
      bytes: blob.size,
      width: bitmap?.width ?? attachment.width,
      height: bitmap?.height ?? attachment.height,
      caption: cap,
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-label="Screenshot annotieren">
      <div
        className="flex flex-col gap-2 rounded-[12px] bg-[var(--tf-bg)] p-3 shadow-2xl max-w-[92vw] max-h-[92vh]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {TOOLS.map(t => {
            const Icon = t.icon;
            const active = a.tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { a.setTextDraft(null); a.setTool(t.id); }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] cursor-pointer transition-colors ${
                  active ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                }`}
                style={active ? undefined : { border: '0.5px solid var(--tf-border)' }}
              >
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={a.undo}
            disabled={!a.hasShapes}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <Undo2 size={13} /> Rückgängig
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)]" aria-label="Abbrechen"><X size={15} /></button>
        </div>

        {/* Text-Eingabe (erscheint nach Klick im Text-Modus) */}
        {a.textDraft && (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={a.textDraft.value}
              onChange={e => a.setTextDraft(d => (d ? { ...d, value: e.target.value } : d))}
              onKeyDown={e => { if (e.key === 'Enter') a.commitText(); if (e.key === 'Escape') a.setTextDraft(null); }}
              placeholder="Text eingeben, Enter setzt ihn…"
              className="flex-1 px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
              style={{ border: '0.5px solid var(--tf-border)' }}
            />
            <button type="button" onClick={a.commitText} className="px-2 py-1 rounded-[var(--tf-radius)] text-[11.5px] bg-[var(--tf-primary)] text-white cursor-pointer">Setzen</button>
          </div>
        )}

        {/* Canvas */}
        <div className="overflow-auto flex items-center justify-center bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)]">
          {bitmap ? (
            <canvas
              ref={canvasRef}
              onPointerDown={a.onPointerDown}
              onPointerMove={a.onPointerMove}
              onPointerUp={a.onPointerUp}
              onPointerLeave={a.onPointerUp}
              className="cursor-crosshair"
              style={{ maxWidth: '100%', maxHeight: '62vh', touchAction: 'none' }}
            />
          ) : (
            <div className="py-16 text-[12px] text-[var(--tf-text-tertiary)]">Bild wird geladen…</div>
          )}
        </div>

        {/* Caption + Aktionen */}
        <input
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Bildunterschrift (optional)"
          className="w-full px-2.5 py-1.5 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={{ border: '0.5px solid var(--tf-border)' }}>Abbrechen</button>
          <button type="button" onClick={() => confirm.run()} disabled={confirm.busy || !bitmap} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--tf-radius)] text-[12px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 disabled:opacity-40 cursor-pointer">
            <Check size={14} /> {confirm.busy ? 'Übernehme…' : 'Übernehmen'}
          </button>
        </div>
      </div>
    </div>
  );
}
