// „Ergänzen" — der Autor schreibt sein eigenes, bereits abgesendetes Feedback
// fort (v2.364). Titel + die typspezifischen Antwortfelder bearbeiten, weitere
// Screenshots/Dateien nachreichen.
//
// Zweck: EIN Ticket pro Themenkomplex statt eines neuen Tickets für jede
// Präzisierung. Der Verlauf der Diskussion bleibt der Kommentar-Thread — hier
// wird der Ticket-KOPF aktuell gehalten.
//
// Felder + Reihenfolge kommen aus derselben Quelle wie das Erfassungs-Formular
// (`FEEDBACK_TYPES`), und `text` wird mit demselben `composeFeedbackText` neu
// zusammengesetzt — sonst driften Erfassung und Nachbearbeitung auseinander
// (Board/Liste/Suche rendern auf `text`).

import { useState } from 'react';
import { Check, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { appendAttachments, updateFeedback } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';
import { FEEDBACK_TYPES, composeFeedbackText } from './constants';
import { FeedbackScreenshotInput } from './FeedbackScreenshotInput';
import { FeedbackFileInput } from './FeedbackFileInput';
import type { PendingAttachment } from './feedbackAttachments';

interface Props {
  ticket: FeedbackItem;
  onFertig: () => void;
  onChanged: () => void;
}

const inputClass =
  'w-full px-2.5 py-1.5 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackErgaenzenForm({ ticket, onFertig, onChanged }: Props): React.ReactElement {
  const storage = useStorage();
  const typeDef = ticket.category ? FEEDBACK_TYPES.find(t => t.category === ticket.category) : undefined;
  // Alt-Tickets (und Tickets, deren Text die KI-Verbesserung ersetzt hat) haben
  // kein `structured` → dann ein einziges Freitext-Feld auf `text`, statt die
  // Feldwerte zu erraten.
  const strukturiert = !!typeDef && !!ticket.structured;

  const [titel, setTitel] = useState(ticket.title ?? '');
  const [werte, setWerte] = useState<Record<string, string>>(() => ({ ...(ticket.structured ?? {}) }));
  const [freitext, setFreitext] = useState(ticket.text);
  const [neueBilder, setNeueBilder] = useState<PendingAttachment[]>([]);
  const [neueDateien, setNeueDateien] = useState<PendingAttachment[]>([]);
  const [anhaengeOffen, setAnhaengeOffen] = useState(false);

  const pflichtLeer = strukturiert
    ? (typeDef?.fields ?? []).some(f => f.required && !(werte[f.key] ?? '').trim())
    : !freitext.trim();

  const speichern = useAsyncAction(async () => {
    const text = strukturiert && typeDef ? composeFeedbackText(typeDef, werte) : freitext.trim();
    await updateFeedback(storage, ticket.id, {
      title: titel.trim() || undefined,
      text,
      ...(strukturiert ? { structured: werte } : {}),
      updated_at: new Date().toISOString(),
    });
    // Anhänge separat: die Bytes müssen erst auf dem Share liegen, bevor die
    // Referenzen ins Ticket wandern (appendAttachments wirft, wenn das misslingt —
    // dann bleibt der Text-Edit erhalten und der Fehler ist sichtbar).
    const neue = [...neueBilder, ...neueDateien];
    if (neue.length > 0) {
      await appendAttachments(
        storage,
        ticket.id,
        ticket.attachments,
        neue.map(a => ({
          id: a.id, blob: a.blob, caption: a.caption, mime: a.mime,
          width: a.width, height: a.height, bytes: a.bytes,
          ...(a.kind ? { kind: a.kind } : {}), ...(a.name ? { name: a.name } : {}),
        })),
      );
      setNeueBilder([]);
      setNeueDateien([]);
    }
    onChanged();
    onFertig();
  });

  const anzahlNeu = neueBilder.length + neueDateien.length;

  return (
    <div className="space-y-3 p-3 rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg-secondary)]" style={inputStyle}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)]">
          Feedback ergänzen
        </p>
        <button
          type="button"
          onClick={onFertig}
          className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)]"
          aria-label="Bearbeiten abbrechen"
        >
          <X size={14} />
        </button>
      </div>

      <div>
        <label className="text-[10.5px] text-[var(--tf-text-tertiary)]">Titel</label>
        <Input
          value={titel}
          onChange={e => setTitel(e.target.value)}
          placeholder="Kurze Überschrift (optional)"
          className="h-8 text-[13px]"
        />
      </div>

      {strukturiert && typeDef ? (
        typeDef.fields.map(f => (
          <div key={f.key}>
            <label className="text-[10.5px] text-[var(--tf-text-tertiary)]">
              {f.label}{f.required ? ' *' : ''}
            </label>
            {f.multiline ? (
              <textarea
                value={werte[f.key] ?? ''}
                onChange={e => setWerte(w => ({ ...w, [f.key]: e.target.value }))}
                rows={3}
                className={inputClass}
                style={inputStyle}
              />
            ) : (
              <input
                value={werte[f.key] ?? ''}
                onChange={e => setWerte(w => ({ ...w, [f.key]: e.target.value }))}
                className={inputClass}
                style={inputStyle}
              />
            )}
          </div>
        ))
      ) : (
        <div>
          <label className="text-[10.5px] text-[var(--tf-text-tertiary)]">Dein Feedback *</label>
          <textarea value={freitext} onChange={e => setFreitext(e.target.value)} rows={6} className={inputClass} style={inputStyle} />
        </div>
      )}

      {/* Anhänge nachreichen — eingeklappt, damit das Formular schlank bleibt */}
      {!anhaengeOffen ? (
        <Button type="button" variant="secondary" size="sm" icon={ImagePlus} onClick={() => setAnhaengeOffen(true)}>
          Screenshot oder Datei nachreichen
        </Button>
      ) : (
        <div className="space-y-2.5">
          <FeedbackScreenshotInput attachments={neueBilder} onChange={setNeueBilder} />
          <FeedbackFileInput files={neueDateien} onChange={setNeueDateien} />
          {anzahlNeu > 0 && (
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              {anzahlNeu} neue{anzahlNeu === 1 ? 'r Anhang' : ' Anhänge'} — wird beim Speichern angefügt.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <Button
          type="button"
          variant="primary"
          icon={Check}
          loading={speichern.busy}
          disabled={pflichtLeer}
          onClick={() => speichern.run()}
        >
          {speichern.busy ? 'Speichern…' : 'Änderungen speichern'}
        </Button>
        <Button type="button" variant="secondary" onClick={onFertig}>Abbrechen</Button>
      </div>
      {pflichtLeer && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)]">Das mit * markierte Feld darf nicht leer sein.</p>
      )}
      {speichern.error && (
        <p className="text-[11px] text-[var(--tf-danger-text)]">Speichern fehlgeschlagen: {speichern.error}</p>
      )}
    </div>
  );
}
