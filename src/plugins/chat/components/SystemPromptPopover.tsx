import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { X } from 'lucide-react';
import { sanitizeHtml } from '@/ui/MarkdownRenderer';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useStorage } from '@/core/hooks/useStorage';
import { useChatStore } from '../store';
import { DEFAULT_SYSTEM_PROMPT } from '../conversation-context';

interface SystemPromptPopoverProps {
  open: boolean;
  onClose: () => void;
}

const MIN_W = 320, MIN_H = 120, EDGE = 12;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Editierbarer System-Prompt (gilt für alle Konversationen, persistiert in
 * chat:settings). Controlled — geöffnet aus dem „+"-Menü des Composers.
 * Schließbar ohne Speichern (X / Escape / Außenklick), Edit↔Vorschau-Umschalter
 * (Markdown gerendert), per Kanten-Handles (oben = Höhe, rechts = Breite) bis
 * zur Bildschirmgröße vergrößerbar.
 */
export function SystemPromptPopover({ open, onClose }: SystemPromptPopoverProps): React.ReactElement | null {
  const storage = useStorage();
  const systemPrompt = useChatStore(s => s.systemPrompt);
  const [draft, setDraft] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [size, setSize] = useState({ w: 440, h: 180 });
  const popRef = useRef<HTMLDivElement>(null);
  const value = draft ?? systemPrompt;

  const save = useAsyncAction(async () => {
    await useChatStore.getState().setSystemPrompt(value.trim() || DEFAULT_SYSTEM_PROMPT, storage);
    setDraft(null);
    onClose();
  });

  // Escape schließt ohne Speichern
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const previewHtml = useMemo(
    () => (mode === 'preview' ? sanitizeHtml(marked.parse(value, { async: false }) as string) : ''),
    [mode, value],
  );

  // Edge-Resize: rechte Kante = Breite (nach rechts), obere Kante = Höhe (nach
  // oben, da das Popover bottom-anchored ist). Total-Delta von start → kein Drift.
  // Obergrenze = Bildschirm (Popover bleibt sichtbar), keine künstliche Kappung.
  const startResize = (axis: 'w' | 'h') => (e: React.PointerEvent): void => {
    e.preventDefault();
    const rect = popRef.current?.getBoundingClientRect();
    const maxW = rect ? Math.max(MIN_W, window.innerWidth - rect.left - EDGE) : window.innerWidth;
    const maxH = rect ? Math.max(MIN_H, rect.bottom - EDGE) : window.innerHeight;
    const start = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    const move = (ev: PointerEvent): void => setSize(s => ({
      w: axis === 'w' ? clamp(start.w + (ev.clientX - start.x), MIN_W, maxW) : s.w,
      h: axis === 'h' ? clamp(start.h - (ev.clientY - start.y), MIN_H, maxH) : s.h,
    }));
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (!open) return null;

  return (
    <div ref={popRef} className="pop sysprompt-pop" style={{ bottom: 46, left: 0, width: size.w }} onMouseDown={e => e.stopPropagation()}>
      {/* Edge-Drag-Handles: obere Kante (Höhe) + rechte Kante (Breite) */}
      <div className="sp-resize sp-resize-t" title="Höhe ändern (oben ziehen)" onPointerDown={startResize('h')} />
      <div className="sp-resize sp-resize-r" title="Breite ändern (rechts ziehen)" onPointerDown={startResize('w')} />
      <div className="sp-head">
        <span className="sp-title">System-Prompt</span>
        <div className="sp-tabs">
          <button className={`sp-tab${mode === 'edit' ? ' on' : ''}`} onClick={() => setMode('edit')}>Bearbeiten</button>
          <button className={`sp-tab${mode === 'preview' ? ' on' : ''}`} onClick={() => setMode('preview')}>Vorschau</button>
        </div>
        <button className="sp-x" title="Schließen (ohne Speichern)" onClick={onClose}><X size={15} /></button>
      </div>

      {mode === 'edit' ? (
        <textarea
          className="sp-edit"
          value={value}
          onChange={e => setDraft(e.target.value)}
          style={{ height: size.h }}
        />
      ) : (
        <div className="ans sp-preview" style={{ height: size.h }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
      )}

      <div className="sp-foot">
        <button className="lnk-sec" onClick={() => { setDraft(DEFAULT_SYSTEM_PROMPT); setMode('edit'); }}>
          Standard wiederherstellen
        </button>
        <button className="tool-pill on" onClick={() => save.run()} style={{ height: 28 }}>
          {save.busy ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
      {save.error && <div style={{ padding: '0 8px 6px', color: 'var(--tf-danger-text)', fontSize: 11 }}>{save.error}</div>}
    </div>
  );
}
