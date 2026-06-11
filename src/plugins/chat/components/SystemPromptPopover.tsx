import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { Maximize2, X } from 'lucide-react';
import { sanitizeHtml } from '@/ui/MarkdownRenderer';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useStorage } from '@/core/hooks/useStorage';
import { useChatStore } from '../store';
import { DEFAULT_SYSTEM_PROMPT } from '../conversation-context';

interface SystemPromptPopoverProps {
  open: boolean;
  onClose: () => void;
}

const MIN_W = 320, MAX_W = 760, MIN_H = 120, MAX_H = 560;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Editierbarer System-Prompt (gilt für alle Konversationen, persistiert in
 * chat:settings). Controlled — geöffnet aus dem „+"-Menü des Composers.
 * Schließbar ohne Speichern (X / Escape / Außenklick), Edit↔Vorschau-Umschalter
 * (Markdown gerendert), per Griff oben-rechts nach rechts/oben vergrößerbar.
 */
export function SystemPromptPopover({ open, onClose }: SystemPromptPopoverProps): React.ReactElement | null {
  const storage = useStorage();
  const systemPrompt = useChatStore(s => s.systemPrompt);
  const [draft, setDraft] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [size, setSize] = useState({ w: 440, h: 180 });
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

  // Resize-Griff oben-rechts: nach rechts = breiter, nach oben = höher
  const onGripDown = (e: React.PointerEvent): void => {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    const move = (ev: PointerEvent): void => setSize({
      w: clamp(start.w + (ev.clientX - start.x), MIN_W, MAX_W),
      h: clamp(start.h - (ev.clientY - start.y), MIN_H, MAX_H),
    });
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (!open) return null;

  return (
    <div className="pop sysprompt-pop" style={{ bottom: 46, left: 0, width: size.w }} onMouseDown={e => e.stopPropagation()}>
      <div className="sp-head">
        <span className="sp-title">System-Prompt</span>
        <div className="sp-tabs">
          <button className={`sp-tab${mode === 'edit' ? ' on' : ''}`} onClick={() => setMode('edit')}>Bearbeiten</button>
          <button className={`sp-tab${mode === 'preview' ? ' on' : ''}`} onClick={() => setMode('preview')}>Vorschau</button>
        </div>
        <button className="sp-grip" title="Größe ändern (nach rechts / oben ziehen)" onPointerDown={onGripDown}>
          <Maximize2 size={12} />
        </button>
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
