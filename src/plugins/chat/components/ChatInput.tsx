import { useRef, useState } from 'react';
import { FileText, FolderOpen, Loader2, Paperclip, Send, Sparkles, Square, X } from 'lucide-react';
import { Badge, Button } from '@/ui';
import type { DirectoryEntry } from '@/core/types/config';
import type { ChatAttachment } from '../types';
import { useAttachments } from '../attachments/useAttachments';

const ACCEPT_EXTENSIONS = '.pdf,.docx,.md,.txt';

interface ChatInputProps {
  onSend: (text: string, attachments?: ChatAttachment[]) => Promise<void>;
  /** Laufende Generierung abbrechen (sync, AbortController). */
  onStop: () => void;
  busy: boolean;
  docDirs: DirectoryEntry[];
  selectedDirs: DirectoryEntry[];
  toggleDir: (dir: DirectoryEntry) => void;
  useRAG: boolean;
  setUseRAG: (fn: (prev: boolean) => boolean) => void;
  vectorReady: boolean;
  providerName: string;
}

export function ChatInput({
  onSend, onStop, busy, docDirs, selectedDirs, toggleDir, useRAG, setUseRAG, vectorReady, providerName,
}: ChatInputProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [showDirPicker, setShowDirPicker] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachments = useAttachments();

  const submit = (): void => {
    const text = input.trim();
    if (!text || busy || attachments.converting) return;
    const ready = attachments.readyAttachments;
    setInput('');
    attachments.clear();
    void onSend(text, ready.length > 0 ? ready : undefined); // onSend = useAsyncAction.run → fängt Rejections selbst
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleFiles = (list: FileList | null): void => {
    if (!list || list.length === 0) return;
    void attachments.addFiles([...list]); // addFiles fängt Fehler pro Datei intern
  };

  return (
    <div
      className="p-4"
      style={{ borderTop: '0.5px solid var(--tf-border)' }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
    >
      <div className="max-w-4xl mx-auto">
        {selectedDirs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedDirs.map(dir => (
              <span key={dir.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-[var(--tf-info-bg)] text-[var(--tf-info-text)] rounded-full">
                {dir.label}
                <button onClick={() => toggleDir(dir)} className="cursor-pointer"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}

        {attachments.staged.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.staged.map(s => (
              <span
                key={s.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full ${
                  s.status === 'error'
                    ? 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]'
                    : 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]'
                }`}
                title={s.status === 'error' ? s.error : s.attachment?.truncated ? 'Inhalt wurde auf das Limit gekürzt' : undefined}
              >
                {s.status === 'converting'
                  ? <Loader2 size={10} className="animate-spin" />
                  : <FileText size={10} />}
                {s.filename}
                {s.status === 'error' ? ` — ${s.error}` : s.attachment?.truncated ? ' (gekürzt)' : ''}
                <button onClick={() => attachments.remove(s.id)} className="cursor-pointer"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_EXTENSIONS}
            multiple
            className="hidden"
            onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] rounded-[var(--tf-radius)] cursor-pointer"
            title="Datei anhängen (PDF, DOCX, MD, TXT)"
          >
            <Paperclip size={16} />
          </button>
          {docDirs.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowDirPicker(prev => !prev)}
                className="p-3 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] rounded-[var(--tf-radius)] cursor-pointer"
                title="Context hinzufuegen"
              >
                <FolderOpen size={16} />
              </button>
              {showDirPicker && (
                <div
                  className="absolute bottom-full left-0 mb-1 bg-[var(--tf-bg)] rounded-[var(--tf-radius)] py-1 min-w-[180px] z-10"
                  style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                >
                  <p className="px-3 py-1 text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">Context</p>
                  {docDirs.map(dir => (
                    <button
                      key={dir.id}
                      onClick={() => { toggleDir(dir); setShowDirPicker(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] cursor-pointer ${
                        selectedDirs.find(d => d.id === dir.id)
                          ? 'text-[var(--tf-primary)]'
                          : 'text-[var(--tf-text)] hover:bg-[var(--tf-hover)]'
                      }`}
                    >
                      {selectedDirs.find(d => d.id === dir.id) ? '✓ ' : ''}{dir.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setUseRAG(prev => !prev)}
            className={`p-3 rounded-[var(--tf-radius)] cursor-pointer ${
              useRAG && vectorReady ? 'text-[var(--tf-primary)]' : 'text-[var(--tf-text-tertiary)]'
            } hover:bg-[var(--tf-hover)]`}
            title={useRAG ? 'Archiv-Suche aktiv' : 'Archiv-Suche aus'}
          >
            <Sparkles size={16} />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={dragOver ? 'Datei hier ablegen…' : 'Nachricht eingeben...'}
            rows={1}
            className="flex-1 px-4 py-3 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
            style={{ border: `0.5px solid ${dragOver ? 'var(--tf-primary)' : 'var(--tf-border)'}` }}
          />
          {busy ? (
            <Button icon={Square} variant="secondary" onClick={onStop} title="Generierung stoppen" />
          ) : (
            <Button
              icon={Send}
              disabled={!input.trim() || attachments.converting}
              onClick={submit}
              title={attachments.converting ? 'Anhänge werden noch konvertiert…' : undefined}
            />
          )}
        </div>
        <div className="mt-2">
          <Badge variant="default">via {providerName}</Badge>
        </div>
      </div>
    </div>
  );
}
