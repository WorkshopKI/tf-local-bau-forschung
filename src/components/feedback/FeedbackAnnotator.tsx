// Annotations-Modal (v2.42): natives <canvas> 2D, vier Werkzeuge, Shapes werden
// beim Bestätigen flach ins Bild gebrannt (PNG für scharfe Kanten/Text). Keine
// externe Render-Lib. Zeichen-Logik im Hook useAnnotationCanvas.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Check, Square, Type, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { PendingAttachment } from './feedbackAttachments';
import { useAnnotationCanvas, ANNOTATION_COLORS, type AnnotationTool, type AnnotationTextSize } from './useAnnotationCanvas';

interface Props {
  attachment: PendingAttachment;
  onCancel: () => void;
  onConfirm: (updated: PendingAttachment) => void;
}

const TOOLS: { id: AnnotationTool; icon: typeof ArrowUpRight; label: string }[] = [
  { id: 'arrow', icon: ArrowUpRight, label: 'Pfeil' },
  { id: 'rect', icon: Square, label: 'Rechteck' },
  { id: 'text', icon: Type, label: 'Text' },
];

const TEXT_SIZES: AnnotationTextSize[] = ['S', 'M', 'L'];

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

  // Portal an den Body: gerendert wird das Modal aus dem Feedback-Panel heraus,
  // und das trägt einen `backdrop-filter` — der macht es zum Bezugsrahmen für
  // `position: fixed`. Ohne Portal saß die „Vollfläche" in 420×624 px fest.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-label="Screenshot annotieren" // allow-raw-modal: Annotier-Canvas-Vollfläche, eigene Interaktionsmechanik
    >
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
                  active ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                }`}
                style={active ? undefined : { border: '0.5px solid var(--tf-border)' }}
              >
                <Icon size={13} /> {t.label}
              </button>
            );
          })}

          {/* Farbwahl (gilt für das nächste Shape jedes Werkzeugs) */}
          <span className="mx-0.5 h-4 w-px bg-[var(--tf-border)]" aria-hidden="true" />
          <div className="flex items-center gap-1" role="group" aria-label="Farbe">
            {ANNOTATION_COLORS.map(c => {
              const active = a.color === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => a.setColor(c.value)}
                  className="w-4 h-4 rounded-full cursor-pointer"
                  style={{
                    background: c.value,
                    outline: active ? '2px solid var(--tf-text)' : '0.5px solid var(--tf-border)',
                    outlineOffset: '1px',
                  }}
                  title={`Farbe ${c.label}`}
                  aria-label={`Farbe ${c.label}`}
                  aria-pressed={active}
                />
              );
            })}
          </div>

          {/* Textgröße — nur im Text-Modus relevant */}
          {a.tool === 'text' && (
            <div className="flex items-center gap-0.5" role="group" aria-label="Textgröße">
              {TEXT_SIZES.map(sz => {
                const active = a.textSize === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => a.setTextSize(sz)}
                    className={`w-5 h-5 rounded-full text-[10px] font-medium cursor-pointer transition-colors ${
                      active ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                    }`}
                    style={active ? undefined : { border: '0.5px solid var(--tf-border)' }}
                    title={`Textgröße ${sz}`}
                    aria-pressed={active}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
          )}

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
            <Button type="button" onClick={a.commitText} variant="primary" size="xs">Setzen</Button>
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
          <Button type="button" onClick={onCancel} variant="secondary">Abbrechen</Button>
          <Button type="button" onClick={() => confirm.run()} disabled={!bitmap} loading={confirm.busy} variant="primary" icon={Check}>Übernehmen</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
