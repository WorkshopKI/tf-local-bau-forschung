// Screenshot-Erfassung im Feedback-Panel (v2.42): Clipboard-Paste (Win+Shift+S →
// Strg+V) + Datei-Upload-Fallback. Jedes Bild wird auf ≤1600px runterskaliert
// (scaleImageToAttachment), als Thumbnail mit „Annotieren"/„Entfernen" gezeigt.
// Controlled: der Parent (FeedbackInputStep) hält die attachments-Liste.

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Pencil, X } from 'lucide-react';
import { scaleImageToAttachment, type PendingAttachment } from './feedbackAttachments';
import { FeedbackAnnotator } from './FeedbackAnnotator';

interface Props {
  attachments: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
  autoFocus?: boolean;
}

export function FeedbackScreenshotInput({ attachments, onChange, autoFocus }: Props): React.ReactElement {
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [annotating, setAnnotating] = useState<PendingAttachment | null>(null);

  useEffect(() => { if (autoFocus) pasteRef.current?.focus(); }, [autoFocus]);

  const addFiles = async (files: Blob[]): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const added: PendingAttachment[] = [];
      for (const f of files) {
        const base = await scaleImageToAttachment(f);
        added.push({ ...base, caption: '' });
      }
      if (added.length) onChange([...attachments, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bild konnte nicht verarbeitet werden.');
    } finally {
      setBusy(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent): void => {
    const imgs = Array.from(e.clipboardData?.items ?? [])
      .filter(it => it.kind === 'file' && it.type.startsWith('image/'))
      .map(it => it.getAsFile())
      .filter((f): f is File => f != null);
    if (imgs.length) { e.preventDefault(); void addFiles(imgs); }
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) void addFiles(files);
    e.target.value = '';
  };

  const remove = (id: string): void => onChange(attachments.filter(a => a.id !== id));
  const replace = (updated: PendingAttachment): void => {
    onChange(attachments.map(a => (a.id === updated.id ? updated : a)));
    setAnnotating(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] text-[var(--tf-text-tertiary)]">Screenshots (optional)</label>

      <textarea
        ref={pasteRef}
        value=""
        onChange={() => { /* Paste-Ziel: getippter Text wird verworfen */ }}
        onPaste={handlePaste}
        rows={2}
        placeholder={busy ? 'Bild wird verarbeitet…' : 'Screenshot hier einfügen (Strg+V) — Win+Shift+S erstellt ihn'}
        className="w-full resize-none px-2.5 py-2 text-[11.5px] bg-transparent text-[var(--tf-text-tertiary)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)] cursor-text"
        style={{ border: '0.5px dashed var(--tf-border)' }}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-1.5 self-start px-2 py-1 rounded-full text-[11px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <ImagePlus size={12} /> Bild hochladen
      </button>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />

      {error && <p className="text-[11px] text-[var(--tf-danger-text)]">{error}</p>}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map(att => (
            <Thumbnail key={att.id} att={att} onAnnotate={() => setAnnotating(att)} onRemove={() => remove(att.id)} />
          ))}
        </div>
      )}

      {annotating && (
        <FeedbackAnnotator
          attachment={annotating}
          onCancel={() => setAnnotating(null)}
          onConfirm={replace}
        />
      )}
    </div>
  );
}

function Thumbnail({ att, onAnnotate, onRemove }: { att: PendingAttachment; onAnnotate: () => void; onRemove: () => void }): React.ReactElement {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(att.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [att.blob]);

  return (
    <div className="flex flex-col gap-1 w-[96px]">
      <div className="relative group">
        {url && <img src={url} alt={att.caption || 'Screenshot'} className="w-[96px] h-[64px] object-cover rounded-[var(--tf-radius)]" style={{ border: '0.5px solid var(--tf-border)' }} />}
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--tf-bg)] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] flex items-center justify-center cursor-pointer"
          style={{ border: '0.5px solid var(--tf-border)' }}
          aria-label="Entfernen"
        >
          <X size={10} />
        </button>
      </div>
      <button
        type="button"
        onClick={onAnnotate}
        className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <Pencil size={10} /> Annotieren
      </button>
      {att.caption && <p className="text-[9.5px] text-[var(--tf-text-tertiary)] truncate" title={att.caption}>{att.caption}</p>}
    </div>
  );
}
