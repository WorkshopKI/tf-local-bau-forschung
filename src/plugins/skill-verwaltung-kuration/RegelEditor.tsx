import { useState } from 'react';
import { buildPromptHinweis, type QualitaetsRegel, type Schweregrad } from '@/core/services/skills';

const NUM = 'font-mono text-[13px] w-[100px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-70';
const FIELD_LABEL = 'block text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-2';

function num(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  return typeof v === 'number' ? String(v) : '';
}

interface RegelEditorProps {
  initial: QualitaetsRegel;
  busy: boolean;
  /** Wenn `false`: alle Felder disabled, Speichern/Löschen ausgeblendet (nur Lesen). */
  canEdit: boolean;
  onSave: (regel: QualitaetsRegel) => void;
  onCancel: () => void;
  /** Wenn gesetzt (bestehende Regel), wird ein „Löschen" angeboten. */
  onDelete?: () => void;
}

/** Editor einer Regel: Parameterfelder je Typ + Live-Vorschau des Hinweises.
 *  Wird als Vollbild-Ansicht der Skill-Verwaltung gerendert (Zurück-Button +
 *  Container liefert die Page). */
export function RegelEditor({ initial, busy, canEdit, onSave, onCancel, onDelete }: RegelEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<QualitaetsRegel>(initial);
  const ro = !canEdit;

  const setParam = (key: string, value: unknown): void =>
    setDraft(d => ({ ...d, params: { ...d.params, [key]: value } }));
  const setNumParam = (key: string, raw: string): void => {
    const n = parseInt(raw, 10);
    setParam(key, Number.isFinite(n) ? n : undefined);
  };

  const preview = buildPromptHinweis(draft);

  return (
    <div className="rounded-[10px] bg-[var(--tf-bg-secondary)] p-[18px]">
      <div className="flex flex-wrap gap-x-10 gap-y-5 items-end">
        <div>
          <label className={FIELD_LABEL}>Name</label>
          <input
            value={draft.name}
            disabled={ro}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            className="text-[13px] w-[180px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-70"
          />
        </div>

        {draft.typ === 'zeichen_max' && (
          <div>
            <label className={FIELD_LABEL}>Maximalwert</label>
            <input className={NUM} disabled={ro} value={num(draft.params, 'max')} onChange={e => setNumParam('max', e.target.value)} />
          </div>
        )}
        {draft.typ === 'wortanzahl' && (
          <>
            <div><label className={FIELD_LABEL}>Min (optional)</label><input className={NUM} disabled={ro} value={num(draft.params, 'min')} onChange={e => setNumParam('min', e.target.value)} /></div>
            <div><label className={FIELD_LABEL}>Max (optional)</label><input className={NUM} disabled={ro} value={num(draft.params, 'max')} onChange={e => setNumParam('max', e.target.value)} /></div>
          </>
        )}
        {draft.typ === 'satzanzahl' && (
          <>
            <div><label className={FIELD_LABEL}>Min</label><input className={NUM} disabled={ro} value={num(draft.params, 'min')} onChange={e => setNumParam('min', e.target.value)} /></div>
            <div><label className={FIELD_LABEL}>Max</label><input className={NUM} disabled={ro} value={num(draft.params, 'max')} onChange={e => setNumParam('max', e.target.value)} /></div>
          </>
        )}
        {draft.typ === 'satzlaenge_max' && (
          <div><label className={FIELD_LABEL}>Max Wörter / Satz</label><input className={NUM} disabled={ro} value={num(draft.params, 'maxWoerter')} onChange={e => setNumParam('maxWoerter', e.target.value)} /></div>
        )}
        {draft.typ === 'absatz_min' && (
          <div><label className={FIELD_LABEL}>Min Absätze</label><input className={NUM} disabled={ro} value={num(draft.params, 'min')} onChange={e => setNumParam('min', e.target.value)} /></div>
        )}
        {draft.typ === 'pflicht_anfang' && (
          <div className="flex-1 min-w-[260px]">
            <label className={FIELD_LABEL}>Pflicht-Anfang (Text)</label>
            <input
              value={typeof draft.params.text === 'string' ? draft.params.text : ''}
              disabled={ro}
              onChange={e => setParam('text', e.target.value)}
              className="text-[13px] w-full px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-70"
            />
          </div>
        )}

        <div>
          <label className={FIELD_LABEL}>Schweregrad</label>
          <div className="inline-flex gap-1.5">
            {(['fehler', 'hinweis'] as Schweregrad[]).map(s => (
              <button
                key={s}
                aria-pressed={draft.schweregrad === s}
                disabled={ro}
                onClick={() => setDraft(d => ({ ...d, schweregrad: s }))}
                className={`text-[11.5px] px-[11px] py-[5px] rounded-[99px] border-[0.5px] disabled:opacity-70 ${draft.schweregrad === s ? 'bg-[var(--tf-text)] text-[var(--tf-bg)] border-transparent' : 'bg-transparent text-[var(--tf-text-secondary)] border-[var(--tf-border)]'}`}
              >
                {s === 'fehler' ? 'Fehler' : 'Hinweis'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {draft.typ === 'verbotenes_muster' && (
        <div className="mt-5">
          <label className={FIELD_LABEL}>Muster (ein Eintrag pro Zeile)</label>
          <textarea
            rows={3}
            disabled={ro}
            value={(Array.isArray(draft.params.muster) ? (draft.params.muster as string[]) : []).join('\n')}
            onChange={e => setParam('muster', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
            className="w-full font-mono text-[12.5px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-70"
          />
          <label className="mt-2 inline-flex items-center gap-2 text-[12.5px] text-[var(--tf-text-secondary)] cursor-pointer">
            <input type="checkbox" disabled={ro} checked={draft.params.istRegex === true} onChange={e => setParam('istRegex', e.target.checked)} />
            Muster sind reguläre Ausdrücke
          </label>
        </div>
      )}

      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-[18px] mb-2">
        Generierter Prompt-Hinweis — aktualisiert sich aus den Parametern:
      </p>
      <div className="border-l-2 border-[var(--tf-border-hover)] bg-[var(--tf-bg)] rounded-r-[8px] px-3.5 py-3 font-mono text-[12.5px] leading-[1.5] text-[var(--tf-text-secondary)]">
        {preview ?? '(kein Hinweis — unbekannter Regel-Typ)'}
      </div>

      <div className="mt-[18px] flex gap-2">
        {canEdit && (
          <button
            disabled={busy}
            onClick={() => onSave({ ...draft, geaendert_am: new Date().toISOString() })}
            className="text-[13px] px-4 py-2 rounded-[8px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-50"
          >
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        )}
        <button onClick={onCancel} className="text-[13px] px-4 py-2 rounded-[8px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
          {canEdit ? 'Abbrechen' : 'Zurück'}
        </button>
        {!canEdit && <span className="self-center text-[12px] text-[var(--tf-text-tertiary)]">Kurator-Modus nicht aktiv — nur lesbar.</span>}
        {canEdit && onDelete && (
          <>
            <span className="flex-1" />
            <button disabled={busy} onClick={onDelete} className="text-[13px] px-4 py-2 rounded-[8px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] disabled:opacity-50">
              Löschen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
