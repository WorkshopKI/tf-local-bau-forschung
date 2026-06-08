// Zeichen-Logik für den Feedback-Annotator (v2.42). Vier Werkzeuge auf nativem
// <canvas> 2D — Pfeil, Rechteck, Text, Stift. Shapes werden in-memory gehalten
// und bei jeder Änderung neu gezeichnet; `burn()` rendert sie flach ins Bild.
// Keine externe Lib (file://-Constraint).

import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasToBlob, type AttachmentMime } from './feedbackAttachments';

export type AnnotationTool = 'arrow' | 'rect' | 'text' | 'pen';

type Point = { x: number; y: number };
export type Shape =
  | { type: 'arrow'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'pen'; points: Point[] }
  | { type: 'text'; x: number; y: number; text: string };

/** Kräftiger Annotations-Ton (bewusste Ausnahme von monochrome-first). */
const ANNOTATION_COLOR = '#e4572e';

function lineWidthFor(canvas: HTMLCanvasElement): number {
  return Math.max(3, Math.round(canvas.width / 400));
}
function fontSizeFor(canvas: HTMLCanvasElement): number {
  return Math.max(16, Math.round(canvas.width / 45));
}

function drawShape(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, s: Shape): void {
  const lw = lineWidthFor(canvas);
  ctx.strokeStyle = ANNOTATION_COLOR;
  ctx.fillStyle = ANNOTATION_COLOR;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (s.type === 'rect') {
    ctx.strokeRect(s.x, s.y, s.w, s.h);
  } else if (s.type === 'pen') {
    if (s.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
    for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
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
    ctx.font = `bold ${fontSizeFor(canvas)}px sans-serif`;
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
    if (tool === 'arrow') draftRef.current = { type: 'arrow', x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    else if (tool === 'rect') draftRef.current = { type: 'rect', x: p.x, y: p.y, w: 0, h: 0 };
    else draftRef.current = { type: 'pen', points: [p] };
    redraw();
  }, [bitmap, tool, toCanvasPoint, redraw]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawingRef.current || !draftRef.current) return;
    const p = toCanvasPoint(e);
    const d = draftRef.current;
    if (d.type === 'arrow') { d.x2 = p.x; d.y2 = p.y; }
    else if (d.type === 'rect') { d.w = p.x - d.x; d.h = p.y - d.y; }
    else if (d.type === 'pen') d.points.push(p);
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
      (d.type === 'rect' && Math.abs(d.w) < 4 && Math.abs(d.h) < 4) ||
      (d.type === 'pen' && d.points.length < 2);
    if (!tiny) setShapes(prev => [...prev, d]);
    else redraw();
  }, [redraw]);

  const commitText = useCallback(() => {
    setTextDraft(prev => {
      if (prev && prev.value.trim()) {
        setShapes(s => [...s, { type: 'text', x: prev.x, y: prev.y, text: prev.value.trim() }]);
      }
      return null;
    });
  }, []);

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
    tool, setTool, shapes, textDraft, setTextDraft,
    onPointerDown, onPointerMove, onPointerUp,
    commitText, undo, clear, burn, hasShapes: shapes.length > 0,
  };
}
