// Datei-Anhänge im Feedback-Panel (v2.199.1): beigefügte Dokumente neben den
// Screenshots (pdf/docx/xlsx/pptx/csv/txt/md, ≤ 10 MB). Upload + Drag&Drop,
// Whitelist-/Größen-Validierung, Liste mit Typ-Icon + Name + Größe + Entfernen.
// Controlled: der Parent (FeedbackInputStep) hält die Datei-Liste.

import { useRef, useState } from 'react';
import { FilePlus, X } from 'lucide-react';
import {
  FEEDBACK_FILE_ACCEPT,
  fileToPendingAttachment,
  formatFileSize,
  validateFeedbackFile,
  type PendingAttachment,
} from './feedbackAttachments';
import { FileTypeIcon } from './FileTypeIcon';

interface Props {
  files: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
}

export function FeedbackFileInput({ files, onChange }: Props): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (list: File[]): void => {
    const accepted: PendingAttachment[] = [];
    const errors: string[] = [];
    for (const f of list) {
      const res = validateFeedbackFile(f);
      if (res.ok) accepted.push(fileToPendingAttachment(f));
      else if (res.reason === 'type') errors.push(`„${f.name}" — Typ nicht erlaubt`);
      else if (res.reason === 'size') errors.push(`„${f.name}" — größer als 10 MB`);
      else errors.push(`„${f.name}" — leer`);
    }
    setError(errors.join(' · '));
    if (accepted.length) onChange([...files, ...accepted]);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };
  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };
  const remove = (id: string): void => onChange(files.filter(f => f.id !== id));

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] text-[var(--tf-text-tertiary)]">Dateien anhängen (optional)</label>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-[var(--tf-radius)] text-[12px] cursor-pointer transition-colors ${
          dragOver ? 'text-[var(--tf-primary)] bg-[var(--tf-primary-light)]/30' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
        }`}
        style={{ border: '1px dashed var(--tf-border-hover)' }}
      >
        <FilePlus size={13} /> Datei hier ablegen oder auswählen
      </button>
      <input ref={inputRef} type="file" accept={FEEDBACK_FILE_ACCEPT} multiple onChange={handleInput} className="hidden" />
      <p className="text-[10px] text-[var(--tf-text-tertiary)]">PDF, Word, Excel, PowerPoint, CSV, TXT, MD — max. 10 MB pro Datei.</p>

      {error && <p className="text-[11px] text-[var(--tf-danger-text)]">{error}</p>}

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)]">
              <FileTypeIcon name={f.name ?? ''} size={15} className="text-[var(--tf-text-secondary)] shrink-0" />
              <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text)]" title={f.name}>{f.name}</span>
              <span className="shrink-0 text-[10.5px] text-[var(--tf-text-tertiary)] tabular-nums">{formatFileSize(f.bytes)}</span>
              <button
                type="button"
                onClick={() => remove(f.id)}
                className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
                aria-label={`„${f.name}" entfernen`}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
