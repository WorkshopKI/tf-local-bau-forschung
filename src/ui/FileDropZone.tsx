import { useRef, useState, useCallback } from 'react';
import { Upload } from 'lucide-react';

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  children?: React.ReactNode;
}

export function FileDropZone({ onFiles, accept, multiple = false, children }: FileDropZoneProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFiles(files);
      e.target.value = '';
    },
    [onFiles],
  );

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-2 p-8 border-dashed rounded-[var(--tf-radius-lg)] cursor-pointer transition-colors ${
        dragOver ? 'bg-[var(--tf-hover)]' : 'hover:bg-[var(--tf-hover)]'
      }`}
      style={{ border: `1.5px dashed ${dragOver ? 'var(--tf-border-hover)' : 'var(--tf-border)'}` }}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={handleChange} className="hidden" />
      {children ?? (
        <>
          <Upload size={20} className="text-[var(--tf-text-tertiary)]" />
          <p className="text-[13px] text-[var(--tf-text-secondary)]">Datei hierher ziehen oder klicken</p>
        </>
      )}
    </div>
  );
}
