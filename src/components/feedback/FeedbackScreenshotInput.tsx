// Screenshot-Erfassung im Feedback-Panel (v2.42): Clipboard-Paste (Win+Shift+S →
// Strg+V) + Datei-Upload-Fallback. Jedes Bild wird auf ≤1600px runterskaliert
// (scaleImageToAttachment), als Thumbnail mit „Annotieren"/„Entfernen" gezeigt.
// Controlled: der Parent (FeedbackInputStep) hält die attachments-Liste.
//
// v4.36 — Aufnahme-Modus: „Bereich aufnehmen" klappt das Panel zusammen (das
// Formular verdeckte genau den Bildschirm, den man aufnehmen will) und fängt den
// anschließenden Strg+V global ab. Win+Shift+S selbst kann der Browser NICHT
// auslösen — es gibt keinen Zugriff auf OS-Tastenkürzel; der Nutzer drückt es.
// v4.39.1 — Reihenfolge nach dem Weg: erst aufnehmen (eigener Knopf), dann
// einfügen (die gestrichelte Fläche darunter).

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Camera, ImagePlus, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scaleImageToAttachment, type PendingAttachment } from './feedbackAttachments';
import { FeedbackAnnotator } from './FeedbackAnnotator';
import { FeedbackBildLightbox } from './FeedbackBildLightbox';

interface Props {
  attachments: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
  autoFocus?: boolean;
  /** true = das Panel ist zusammengeklappt und wartet auf den Strg+V des Nutzers. */
  aufnahme?: boolean;
  /** Aufnahme-Modus starten/beenden. Fehlt der Callback, gibt es den Knopf nicht
   *  (z.B. im „Ergänzen"-Formular, das nicht im wegklappbaren Panel steckt). */
  onAufnahme?: (aktiv: boolean) => void;
}

/** Imperativer Griff: erlaubt dem Parent, die Paste-Fläche gezielt zu fokussieren
 *  (z.B. aus dem Screenshot-Nudge „Screenshot hinzufügen"). */
export interface FeedbackScreenshotHandle {
  focus: () => void;
}

export const FeedbackScreenshotInput = forwardRef<FeedbackScreenshotHandle, Props>(
  function FeedbackScreenshotInput({ attachments, onChange, autoFocus, aufnahme, onAufnahme }, ref): React.ReactElement {
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [annotating, setAnnotating] = useState<PendingAttachment | null>(null);
  // Die Liste liegt beim Parent; der globale Paste-Fänger unten läuft in einem
  // Effekt und sähe sonst den Stand vom Registrieren.
  const aktuellRef = useRef(attachments);
  aktuellRef.current = attachments;

  useEffect(() => { if (autoFocus) pasteRef.current?.focus(); }, [autoFocus]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      pasteRef.current?.focus();
      pasteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  }), []);

  const addFiles = async (files: Blob[]): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const added: PendingAttachment[] = [];
      for (const f of files) {
        const base = await scaleImageToAttachment(f);
        added.push({ ...base, caption: '' });
      }
      if (added.length) onChange([...aktuellRef.current, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bild konnte nicht verarbeitet werden.');
    } finally {
      setBusy(false);
    }
  };

  const bilderAus = (data: DataTransfer | null): File[] =>
    Array.from(data?.items ?? [])
      .filter(it => it.kind === 'file' && it.type.startsWith('image/'))
      .map(it => it.getAsFile())
      .filter((f): f is File => f != null);

  const handlePaste = (e: React.ClipboardEvent): void => {
    const imgs = bilderAus(e.clipboardData);
    if (imgs.length) { e.preventDefault(); void addFiles(imgs); }
  };

  // Aufnahme-Modus: das Panel ist zusammengeklappt, also ist kein Feld fokussiert
  // — der Strg+V landet am Dokument. JEDER Paste beendet den Modus (auch einer
  // ohne Bild: die Aufnahme wurde dann abgebrochen, und das Panel wieder offen zu
  // sehen ist die ehrlichere Rückmeldung als eine stumme Warteleiste).
  useEffect(() => {
    if (!aufnahme || !onAufnahme) return;
    const onPaste = (e: ClipboardEvent): void => {
      const imgs = bilderAus(e.clipboardData);
      if (imgs.length) { e.preventDefault(); void addFiles(imgs); }
      onAufnahme(false);
    };
    window.addEventListener('paste', onPaste, true);
    return () => window.removeEventListener('paste', onPaste, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addFiles liest über aktuellRef
  }, [aufnahme, onAufnahme]);

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
    <div className="flex flex-col gap-1.5">
      {/* Der Aufnahme-Knopf steht VOR der Einfüge-Fläche: er ist der Anfang des
          Wegs (aufnehmen → einfügen), stand aber darunter und las sich dadurch
          wie eine Fußnote zu ihr. */}
      <div className="flex items-center gap-1.5">
        {onAufnahme && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={Camera}
            onClick={() => onAufnahme(true)}
            className="flex-1 bg-transparent"
          >
            {/* Mehrere Aufnahmen gingen immer (jede hängt an) — nur stand es
                nirgends. Ab dem ersten Bild sagt es der Knopf selbst. */}
            {attachments.length > 0 ? 'Weiteren Bereich aufnehmen' : 'Bereich aufnehmen (Win+Shift+S)'}
          </Button>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shrink-0 inline-flex items-center gap-1 px-1 py-0.5 text-[10.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] cursor-pointer"
        >
          <ImagePlus size={11} /> Bild hochladen
        </button>
      </div>

      <textarea
        ref={pasteRef}
        value=""
        onChange={() => { /* Paste-Ziel: getippter Text wird verworfen */ }}
        onPaste={handlePaste}
        rows={2}
        placeholder={busy ? 'Bild wird verarbeitet…' : '… oder Screenshot hier einfügen (Strg+V)'}
        className="w-full resize-none px-2.5 py-2 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-secondary)] focus:border-[var(--tf-primary)] cursor-text"
        style={{ border: '1px dashed var(--tf-border-hover)' }}
      />
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
});

function Thumbnail({ att, onAnnotate, onRemove }: { att: PendingAttachment; onAnnotate: () => void; onRemove: () => void }): React.ReactElement {
  const [url, setUrl] = useState('');
  // Klick aufs Miniaturbild zeigt es groß — wer annotiert hat, will vor dem
  // Absenden nachsehen, ob der Pfeil sitzt; 96×64 px beantworten das nicht.
  const [gross, setGross] = useState(false);
  useEffect(() => {
    const u = URL.createObjectURL(att.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [att.blob]);

  return (
    <div className="flex flex-col gap-1 w-[96px]">
      <div className="relative group">
        {url && (
          <img
            src={url}
            alt={att.caption || 'Screenshot'}
            onClick={() => setGross(true)}
            title="Groß ansehen"
            className="w-[96px] h-[64px] object-cover rounded-[var(--tf-radius)] cursor-zoom-in"
            style={{ border: '0.5px solid var(--tf-border)' }}
          />
        )}
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

      {gross && url && (
        <FeedbackBildLightbox src={url} caption={att.caption} onClose={() => setGross(false)} />
      )}
    </div>
  );
}
