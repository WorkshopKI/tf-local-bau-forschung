import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildPromptHinweis,
  effektiveKategorie,
  KATEGORIE_LABEL,
  type QualitaetsRegel,
  type Schweregrad,
} from '@/core/services/skills';
import { useReportGuardState, type EditorGuardState } from './editorGuard';
import { MusterErkennungEditor } from './MusterErkennungEditor';
import { typLabel, TYP_LABEL, ADD_TYPEN, wechsleRegelTyp } from './regelShared';

/** Bekannte Kategorie-Keys für den Setzer (ohne „sonstige" — das ist der Auffang-Default). */
const KATEGORIE_KEYS = Object.keys(KATEGORIE_LABEL).filter(k => k !== 'sonstige');

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
  /** Persistiert den Entwurf OHNE zu schließen (für die Leave-Guard-Nachfrage). Wirft bei Fehler. */
  onPersist: (regel: QualitaetsRegel) => Promise<void>;
  /** Meldet `{ dirty, save }` an den Leave-Guard der Skill-Verwaltung. */
  onGuardStateChange?: (state: EditorGuardState | null) => void;
}

/** Editor einer Regel: Parameterfelder je Typ + Live-Vorschau des Hinweises.
 *  Wird als Vollbild-Ansicht der Skill-Verwaltung gerendert (Zurück-Button +
 *  Container liefert die Page). */
export function RegelEditor({ initial, busy, canEdit, onSave, onCancel, onDelete, onPersist, onGuardStateChange }: RegelEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<QualitaetsRegel>(initial);
  const [typAendern, setTypAendern] = useState(false);
  const ro = !canEdit;

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useReportGuardState(
    onGuardStateChange,
    dirty,
    () => onPersist({ ...draft, geaendert_am: new Date().toISOString() }),
  );

  const setParam = (key: string, value: unknown): void =>
    setDraft(d => ({ ...d, params: { ...d.params, [key]: value } }));
  const setParams = (patch: Record<string, unknown>): void =>
    setDraft(d => ({ ...d, params: { ...d.params, ...patch } }));
  const setNumParam = (key: string, raw: string): void => {
    const n = parseInt(raw, 10);
    setParam(key, Number.isFinite(n) ? n : undefined);
  };

  const preview = buildPromptHinweis(draft);

  return (
    <div className="rounded-[10px] bg-[var(--tf-bg-secondary)] p-[18px]">
      {/* Typ-Transparenz: read-only Chip + bewusster, reibungsbehafteter Wechsel. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] text-[var(--tf-text-secondary)]">
          <Lock size={12} className="text-[var(--tf-text-tertiary)]" aria-hidden />
          Typ · Check-Engine:
          <strong className="font-medium text-[var(--tf-text)]">{typLabel(draft)}</strong>
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setTypAendern(v => !v)}
            className="text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:underline underline-offset-2"
          >
            Typ ändern
          </button>
        )}
      </div>
      {canEdit && typAendern && (
        <div className="mb-4 rounded-[8px] border-[0.5px] border-[var(--tf-warning-border)] bg-[var(--tf-warning-soft)] p-3">
          <p className="text-[12px] text-[var(--tf-warning-text)] mb-2">
            Ein Typwechsel verwirft die typ-spezifischen Parameter.
          </p>
          <select
            value={draft.typ}
            onChange={e => {
              const neu = e.target.value;
              if (neu !== draft.typ) setDraft(d => wechsleRegelTyp(d, neu));
              setTypAendern(false);
            }}
            className="text-[13px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)]"
          >
            {!ADD_TYPEN.includes(draft.typ) && (
              <option value={draft.typ}>{typLabel(draft)} (aktuell)</option>
            )}
            {ADD_TYPEN.map(t => (
              <option key={t} value={t}>{TYP_LABEL[t]}</option>
            ))}
          </select>
        </div>
      )}

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
          <label className={FIELD_LABEL}>Art (Kategorie)</label>
          <input
            list="regel-kategorie-optionen"
            value={draft.kategorie ?? ''}
            disabled={ro}
            placeholder={`${KATEGORIE_LABEL[effektiveKategorie({ typ: draft.typ, pruefart: draft.pruefart })] ?? 'abgeleitet'} (abgeleitet)`}
            onChange={e => {
              const v = e.target.value.trim();
              setDraft(d => {
                const next = { ...d };
                if (v) next.kategorie = v;
                else delete next.kategorie;
                return next;
              });
            }}
            className="text-[13px] w-[180px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-70"
          />
          <datalist id="regel-kategorie-optionen">
            {KATEGORIE_KEYS.map(k => (
              <option key={k} value={k}>{KATEGORIE_LABEL[k]}</option>
            ))}
          </datalist>
        </div>

        <div>
          <label className={FIELD_LABEL}>Schweregrad</label>
          <div className="inline-flex gap-1.5">
            {(['fehler', 'hinweis'] as Schweregrad[]).map(s => (
              <button
                key={s}
                aria-pressed={draft.schweregrad === s}
                disabled={ro}
                onClick={() => setDraft(d => ({ ...d, schweregrad: s }))}
                className={`text-[11.5px] px-[11px] py-[5px] rounded-[99px] border-[0.5px] disabled:opacity-70 ${draft.schweregrad === s ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)] border-transparent' : 'bg-transparent text-[var(--tf-text-secondary)] border-[var(--tf-border)]'}`}
              >
                {s === 'fehler' ? 'Fehler' : 'Hinweis'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {draft.typ === 'verbotenes_muster' && (
        <MusterErkennungEditor params={draft.params} setParam={setParam} setParams={setParams} disabled={ro} />
      )}

      {/*
        Woher der Wert kommt — Anzeige-Text an der Prüfung, NICHT im Prompt. Eine
        Regel ohne Grund kann niemand fallen lassen: sie steht sonst gleichrangig
        neben jeder anderen, auch wenn die eine aus einem fremden Formular stammt
        und die andere aus einer Faustregel.
      */}
      <div className="mt-[18px]">
        <label className={FIELD_LABEL}>Grund (optional)</label>
        <input
          value={draft.herkunft ?? ''}
          disabled={ro}
          placeholder={'Woher stammt diese Vorgabe? z.B. Richtlinie 4.5.1 oder Fachabstimmung 08/2026'}
          onChange={e => {
            const v = e.target.value.trim();
            setDraft(d => {
              const next = { ...d };
              if (v) next.herkunft = v;
              else delete next.herkunft;
              return next;
            });
          }}
          className="w-full text-[13px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)] disabled:opacity-70"
        />
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1.5">
          Erscheint bei jedem Befund unter der Regel — im Prompt steht er nicht.
        </p>
      </div>

      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-[18px] mb-2">
        Generierter Prompt-Hinweis — aktualisiert sich aus den Parametern:
      </p>
      <div className="border-l-2 border-[var(--tf-border-hover)] bg-[var(--tf-bg)] rounded-r-[8px] px-3.5 py-3 font-mono text-[12.5px] leading-[1.5] text-[var(--tf-text-secondary)]">
        {preview ?? '(kein Hinweis — unbekannter Regel-Typ)'}
      </div>

      <div className="mt-[18px] flex gap-2">
        {canEdit && (
          <Button
            variant="primary"
            loading={busy}
            onClick={() => onSave({ ...draft, geaendert_am: new Date().toISOString() })}
          >
            Speichern
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel}>
          {canEdit ? 'Abbrechen' : 'Zurück'}
        </Button>
        {!canEdit && <span className="self-center text-[12px] text-[var(--tf-text-tertiary)]">Kurator-Modus nicht aktiv — nur lesbar.</span>}
        {canEdit && onDelete && (
          <>
            <span className="flex-1" />
            <Button variant="ghost" disabled={busy} onClick={onDelete} className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]">
              Löschen
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
