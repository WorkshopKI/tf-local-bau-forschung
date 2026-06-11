import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Brain, Check, File as FileIcon, FileText, Folder, Loader2, Paperclip, Plus, Search, SlidersHorizontal, Sparkles, Square, X } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useStorage } from '@/core/hooks/useStorage';
import type { DirectoryEntry } from '@/core/types/config';
import type { ChatAttachment } from '../types';
import { useChatStore } from '../store';
import { useAttachments } from '../attachments/useAttachments';
import { SystemPromptPopover } from './SystemPromptPopover';

const ACCEPT_EXTENSIONS = '.pdf,.docx,.md,.txt';

export interface ComposerProps {
  onSend: (text: string, attachments?: ChatAttachment[]) => Promise<void>;
  onStop: () => void;
  busy: boolean;
  providerName: string;
  useRAG: boolean;
  setUseRAG: (fn: (prev: boolean) => boolean) => void;
  vectorReady: boolean;
  docDirs: DirectoryEntry[];
  selectedDirs: DirectoryEntry[];
  toggleDir: (dir: DirectoryEntry) => void;
  autoFocus?: boolean;
}

export function Composer({
  onSend, onStop, busy, providerName, useRAG, setUseRAG, vectorReady,
  docDirs, selectedDirs, toggleDir, autoFocus,
}: ComposerProps): React.ReactElement {
  const storage = useStorage();
  const thinkingEnabled = useChatStore(s => s.thinkingEnabled);
  const [input, setInput] = useState('');
  const [menu, setMenu] = useState(false);
  const [sysOpen, setSysOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const menuWrap = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachments = useAttachments();

  const toggleThinking = useAsyncAction(() =>
    useChatStore.getState().setThinkingEnabled(!thinkingEnabled, storage));

  // Auto-grow
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);
  useEffect(() => { if (autoFocus) taRef.current?.focus(); }, [autoFocus]);
  useEffect(() => {
    if (!menu && !sysOpen) return;
    const onDoc = (e: MouseEvent): void => {
      if (menuWrap.current && !menuWrap.current.contains(e.target as Node)) { setMenu(false); setSysOpen(false); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu, sysOpen]);

  const submit = (): void => {
    const text = input.trim();
    if (!text || busy || attachments.converting) return;
    const ready = attachments.readyAttachments;
    setInput('');
    attachments.clear();
    void onSend(text, ready.length > 0 ? ready : undefined);
  };
  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };
  const handleFiles = (list: FileList | null): void => {
    if (list && list.length > 0) void attachments.addFiles([...list]);
  };

  return (
    <div className="composer-inner">
      <div
        className={`composer${dragOver ? ' dragover' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <input ref={fileRef} type="file" accept={ACCEPT_EXTENSIONS} multiple className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />

        {(attachments.staged.length > 0 || selectedDirs.length > 0) && (
          <div className="composer-atts">
            {selectedDirs.map(dir => (
              <span key={dir.id} className="composer-att">
                <Folder size={11} />{dir.label}
                <span className="x" onClick={() => toggleDir(dir)}><X size={11} /></span>
              </span>
            ))}
            {attachments.staged.map(s => (
              <span key={s.id} className={`composer-att${s.status === 'error' ? ' err' : ''}`}
                title={s.status === 'error' ? s.error : s.attachment?.truncated ? 'Inhalt gekürzt' : undefined}>
                {s.status === 'converting' ? <Loader2 size={11} className="spin" /> : <FileText size={11} />}
                {s.filename}{s.attachment?.truncated ? ' (gekürzt)' : ''}
                <span className="x" onClick={() => attachments.remove(s.id)}><X size={11} /></span>
              </span>
            ))}
          </div>
        )}

        <textarea ref={taRef} rows={1} value={input} placeholder="Nachricht eingeben …"
          onChange={e => setInput(e.target.value)} onKeyDown={onKey} />

        <div className="composer-bar">
          <div ref={menuWrap} style={{ position: 'relative' }}>
            <button className="tool-btn" title="Hinzufügen" onClick={() => { setMenu(m => !m); setSysOpen(false); }}>
              <Plus size={19} />
            </button>
            {menu && (
              <div className="pop" style={{ bottom: 42, left: 0 }}>
                <div className="pop-label">Hinzufügen</div>
                <button className="pop-item" onClick={() => { fileRef.current?.click(); setMenu(false); }}>
                  <FileIcon size={16} />Dateien hinzufügen
                </button>
                <div className="pop-sep" />
                <div className="pop-label">Werkzeuge</div>
                <button className="pop-item" onClick={() => { setUseRAG(w => !w); setMenu(false); }}>
                  <Sparkles size={16} />Archiv-Suche{useRAG && <Check size={15} className="pop-check" />}
                </button>
                <button className="pop-item" onClick={() => { toggleThinking.run(); setMenu(false); }}>
                  <Brain size={16} />Denkprozess{thinkingEnabled && <Check size={15} className="pop-check" />}
                </button>
                <button className="pop-item" onClick={() => { setSysOpen(true); setMenu(false); }}>
                  <SlidersHorizontal size={16} />System-Prompt
                </button>
                {docDirs.length > 0 && (
                  <>
                    <div className="pop-sep" />
                    <div className="pop-label">Verzeichnis-Kontext</div>
                    {docDirs.map(dir => (
                      <button key={dir.id} className="pop-item" onClick={() => { toggleDir(dir); setMenu(false); }}>
                        <Folder size={16} />{dir.label}
                        {selectedDirs.some(d => d.id === dir.id) && <Check size={15} className="pop-check" />}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
            <SystemPromptPopover open={sysOpen} onClose={() => setSysOpen(false)} />
          </div>

          <button className="tool-btn" title="Datei anhängen" onClick={() => fileRef.current?.click()}>
            <Paperclip size={17} />
          </button>
          <button className={`tool-pill${useRAG && vectorReady ? ' on' : ''}`} onClick={() => setUseRAG(w => !w)}
            title={useRAG ? 'Archiv-Suche aktiv' : 'Archiv-Suche aus'}>
            <Search size={15} />Archiv-Suche
          </button>

          <div className="composer-spacer" />

          {busy ? (
            <button className="send-btn" title="Stopp" onClick={onStop}><Square size={15} fill="currentColor" /></button>
          ) : (
            <button className="send-btn" title="Senden" disabled={!input.trim() || attachments.converting} onClick={submit}>
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="composer-foot">
        <span className="foot-chip"><span className="foot-dot" />via {providerName}</span>
        <span>Antworten basieren auf dem Antrags-Archiv und können Fehler enthalten.</span>
      </div>
    </div>
  );
}
