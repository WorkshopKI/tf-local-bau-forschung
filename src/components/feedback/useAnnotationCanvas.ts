// Zeichen-Logik für den Feedback-Annotator (v2.42). Drei Werkzeuge auf nativem
// <canvas> 2D — Pfeil, Rechteck, Text (Stift entfernt v2.45). Shapes werden
// in-memory gehalten und bei jeder Änderung neu gezeichnet; `burn()` rendert sie
// flach ins Bild. Farbe + Textgröße sind pro Shape wählbar (v2.45). Keine
// externe Lib (file://-Constraint).

import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasToBlob, type AttachmentMime } from './feedbackAttachments';

export type AnnotationTool = 'arrow' | 'rect' | 'text';

/** Wählbare Textgrößen (relativ zur Bildbreite, damit die Annotation beim
 *  späteren Vollbild-Ansehen proportional zum Seiteninhalt skaliert). „M" ist
 *  bewusst nur etwas größer als der Fließtext der App — Default. */
export type AnnotationTextSize = 'S' | 'M' | 'L';
const TEXT_SIZE_DIVISOR: Record<AnnotationTextSize, number> = { S: 140, M: 105, L: 70 };

/** Farbpalette für Annotationen — erste = Default (kräftiger Orange-Ton, bewusste
 *  Ausnahme von monochrome-first). Mehrere Töne, damit der User verschiedene
 *  Arten von Kommentaren unterscheiden kann. */
export const ANNOTATION_COLORS: readonly { value: string; label: string }[] = [
  { value: '#e4572e', label: 'Orange' },
  { value: '#dc2626', label: 'Rot' },
  { value: '#2563eb', label: 'Blau' },
  { value: '#16a34a', label: 'Grün' },
  { value: '#111827', label: 'Schwarz' },
] as const;
const DEFAULT_COLOR = ANNOTATION_COLORS[0]!.value;

type Point = { x: number; y: number };
export type Shape =
  | { type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string }
  | { type: 'rect'; x: number; y: number; w: number; h: number; color: string }
  | { type: 'text'; x: number; y: number; text: string; color: string; size: AnnotationTextSize };

function lineWidthFor(canvas: HTMLCanvasElement): number {
  return Math.max(3, Math.round(canvas.width / 400));
}
function fontSizeFor(canvas: HTMLCanvasElement, size: AnnotationTextSize): number {
  return Math.max(12, Math.round(canvas.width / TEXT_SIZE_DIVISOR[size]));
}

function drawShape(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, s: Shape): void {
  const lw = lineWidthFor(canvas);
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (s.type === 'rect') {
    ctx.strokeRect(s.x, s.y, s.w, s.h);
  } else if (s.type === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    const head = lw * 4;
    ctx.beginPath();
    ctx.moveTo(s.x2, s.y2);
    ctx.lineTo(s.x2 - head * Math.cos(ang - Math.PI / 6), s.y2 - head * Math.sin(ang - Math.PI / 6));
    ctx.lineTo(s.x2 - head * Math.cos(ang + Math.PI / 6), s.y2 - head * Math.sin(ang + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.font = `bold ${fontSizeFor(canvas, s.size)}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(s.text, s.x, s.y);
  }
}

interface TextDraft { x: number; y: number; value: string }

export function useAnnotationCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  bitmap: ImageBitmap | null,
) {
  const [tool, setTool] = useState<AnnotationTool>('arrow');
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [textSize, setTextSize] = useState<AnnotationTextSize>('M');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const draftRef = useRef<Shape | null>(null);
  const drawingRef = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const s of shapes) drawShape(ctx, canvas, s);
    if (draftRef.current) drawShape(ctx, canvas, draftRef.current);
  }, [canvasRef, bitmap, shapes]);

  // Canvas-Buffer an die Bildgröße koppeln + (neu)zeichnen, sobald Bild/Shapes wechseln.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    redraw();
  }, [canvasRef, bitmap, redraw]);

  const toCanvasPoint = useCallback((e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }, [canvasRef]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!bitmap) return;
    const p = toCanvasPoint(e);
    if (tool === 'text') {
      setTextDraft({ x: p.x, y: p.y, value: '' });
      return;
    }
    drawingRef.current = true;
    if (tool === 'arrow') draftRef.current = { type: 'arrow', x1: p.x, y1: p.y, x2: p.x, y2: p.y, color };
    else draftRef.current = { type: 'rect', x: p.x, y: p.y, w: 0, h: 0, color };
    redraw();
  }, [bitmap, tool, color, toCanvasPoint, redraw]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawingRef.current || !draftRef.current) return;
    const p = toCanvasPoint(e);
    const d = draftRef.current;
    if (d.type === 'arrow') { d.x2 = p.x; d.y2 = p.y; }
    else if (d.type === 'rect') { d.w = p.x - d.x; d.h = p.y - d.y; }
    redraw();
  }, [toCanvasPoint, redraw]);

  const onPointerUp = useCallback(() => {
    if (!drawingRef.current || !draftRef.current) return;
    const d = draftRef.current;
    drawingRef.current = false;
    draftRef.current = null;
    // Mini-Klicks (kein echtes Ziehen) verwerfen.
    const tiny =
      (d.type === 'arrow' && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 4) ||
      (d.type === 'rect' && Math.abs(d.w) < 4 && Math.abs(d.h) < 4);
    if (!tiny) setShapes(prev => [...prev, d]);
    else redraw();
  }, [redraw]);

  // Der Entwurf wird GELESEN, nicht im Updater verrechnet (v4.129): `setShapes`
  // stand bis dahin im Updater von `setTextDraft`, und ein Updater muss rein
  // sein. React ruft ihn im StrictMode doppelt auf — der Text landete zweimal
  // im Bild, deckungsgleich übereinander.
  const commitText = useCallback(() => {
    const entwurf = textDraft;
    if (entwurf && entwurf.value.trim()) {
      setShapes(s => [
        ...s,
        { type: 'text', x: entwurf.x, y: entwurf.y, text: entwurf.value.trim(), color, size: textSize },
      ]);
    }
    setTextDraft(null);
  }, [textDraft, color, textSize]);

  const undo = useCallback(() => setShapes(prev => prev.slice(0, -1)), []);
  const clear = useCallback(() => setShapes([]), []);

  /** Rendert Bild + Shapes flach und liefert den fertigen Blob. */
  const burn = useCallback(async (mime: AttachmentMime, quality?: number): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return null;
    draftRef.current = null;
    redraw();
    return canvasToBlob(canvas, mime, quality);
  }, [canvasRef, bitmap, redraw]);

  return {
    tool, setTool, color, setColor, textSize, setTextSize,
    shapes, textDraft, setTextDraft,
    onPointerDown, onPointerMove, onPointerUp,
    commitText, undo, clear, burn, hasShapes: shapes.length > 0,
  };
}
