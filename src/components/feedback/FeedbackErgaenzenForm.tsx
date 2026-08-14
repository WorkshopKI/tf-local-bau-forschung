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
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { updateOutboxFeedback } from '@/core/services/personal-storage';
import type { FeedbackItem } from '@/core/types/feedback';
import { FEEDBACK_TYPES, composeFeedbackText } from './constants';
import { FeedbackScreenshotInput } from './FeedbackScreenshotInput';
import { FeedbackFileInput } from './FeedbackFileInput';
import type { PendingAttachment } from './feedbackAttachments';

interface Props {
  ticket: FeedbackItem;
  onFertig: () => void;
  onChanged: () => void;
  /**
   * Ohne Daten-Share-Schreibrecht (prod-Endnutzer) schreibt `updateFeedback` nur
   * lokal — der Team-Stand bliebe der Roh-Text aus der Outbox. Ist das Ticket
   * dort noch nicht eingesammelt, wird es zusätzlich überschrieben, damit die
   * Bearbeitung des Autors wirklich beim Team ankommt (Muster aus
   * `FeedbackVerbessernFlow`, v2.207.1). Bei Schreibrecht `false`/weggelassen.
   */
  nurLokal?: boolean;
}

const inputClass =
  'w-full px-2.5 py-1.5 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackErgaenzenForm({ ticket, onFertig, onChanged, nurLokal }: Props): React.ReactElement {
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
    const titelWert = titel.trim() || undefined;
    await updateFeedback(storage, ticket.id, {
      title: titelWert,
      text,
      ...(strukturiert ? { structured: werte } : {}),
      updated_at: new Date().toISOString(),
    });
    // Ohne Schreibrecht liegt die einzige Fassung, die das Team je sieht, in der
    // persönlichen Outbox. Best-effort: `updateOutboxFeedback` wirft nie und ist
    // ein No-op, sobald der Kurator den Eintrag eingesammelt hat (Status ≠
    // 'pending') — ein Resurrect gelöschter Einträge ist damit ausgeschlossen.
    if (nurLokal) {
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      if (persHandle) {
        await updateOutboxFeedback(persHandle, ticket.id, {
          title: titelWert,
          text,
          ...(strukturiert ? { structured: werte } : {}),
        });
      }
    }
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
        // Bestands-Felder (`legacy`) stehen nur noch da, wenn dieses Ticket sie
        // gefüllt hat — sonst könnte der Autor seinen eigenen Alt-Text nicht mehr
        // korrigieren. Neue Tickets sehen sie gar nicht erst.
        typeDef.fields.filter(f => !f.legacy || (werte[f.key] ?? '').trim().length > 0).map(f => (
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
