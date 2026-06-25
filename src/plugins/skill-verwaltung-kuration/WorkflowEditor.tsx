import { useState } from 'react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  normalizeStepRolle, QS_BASIS_SKILL_ID, MAX_AUTO_RETRIES, DEFAULT_MAX_RETRIES,
  type GateExpr, type SkillRegistryFile, type WorkflowStep, type WorkflowStepRolle,
} from '@/core/services/skills';
import { getWorkflowById, getWorkflowDef } from './workflowShared';
import { useReportGuardState, type EditorGuardState } from './editorGuard';

const GATE_LABEL: Record<GateExpr, string> = {
  immer: 'Immer anwendbar',
  hat_teilvorhaben: 'Nur wenn Teilvorhaben vorhanden',
};
const GATE_OPTIONS: GateExpr[] = ['immer', 'hat_teilvorhaben'];

const ROLLE_LABEL: Record<WorkflowStepRolle, string> = {
  generierung: 'Generierung (erzeugt einen Abschnitt)',
  llm_qs: 'KI-Qualitäts-Check (bewertet beratend)',
};
const ROLLE_OPTIONS: WorkflowStepRolle[] = ['generierung', 'llm_qs'];

interface WorkflowEditorProps {
  file: SkillRegistryFile;
  /** Workflow, zu dem der Schritt gehört (für die Versions-Anzeige + Parent-Wahl). */
  workflowId: string;
  step: WorkflowStep;
  isNew: boolean;
  canEdit: boolean;
  /** Persistiert den (ge-upserteten) Schritt; der Aufrufer bumpt die Def-Version. */
  onSave: (step: WorkflowStep) => Promise<void>;
  onDelete?: () => void;
  /** Nutzer-initiiertes Verlassen (Zurück/Abbrechen) — läuft durch die Leave-Guard-Nachfrage. */
  onBack: () => void;
  /** Schließt nach erfolgreichem In-Editor-Persist (Speichern) — OHNE Guard, da bereits gespeichert. */
  onSaved: () => void;
  /** Meldet `{ dirty, save }` an den Leave-Guard der Skill-Verwaltung. */
  onGuardStateChange?: (state: EditorGuardState | null) => void;
}

export function WorkflowEditor({ file, workflowId, step, isNew, canEdit, onSave, onDelete, onBack, onSaved, onGuardStateChange }: WorkflowEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<WorkflowStep>(step);
  const def = getWorkflowById(file, workflowId) ?? getWorkflowDef(file);
  const nextVersion = def.version + 1;
  // Genau eine Ebene: gültige Parents sind Top-Level-Schritte (außer dem Schritt
  // selbst). Hat der Schritt eigene Unterschritte, kann er selbst kein Kind werden.
  const hatKinder = def.steps.some(s => s.parentStepId === draft.id);
  const parentOptions = def.steps.filter(s => s.id !== draft.id && !s.parentStepId);
  const ro = !canEdit;
  const inputCls = 'w-full rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] disabled:opacity-70 px-[11px] py-2 text-[13px] text-[var(--tf-text)]';

  const rolle: WorkflowStepRolle = draft.rolle ?? 'generierung';
  // QS-Ziele = Generierungs-Schritte (kein llm_qs, nicht der Schritt selbst).
  const zielOptionen = def.steps.filter(s => (s.rolle ?? 'generierung') !== 'llm_qs' && s.id !== draft.id);

  // Auf EINER Quelle normalisieren (Defaults/Klemmung, rollen-fremde Felder entfernen).
  // doSave = reiner Persist-Teil (ohne onBack) — wird vom In-Editor-Button (mit Schließen)
  // UND vom Leave-Guard (ohne Schließen) genutzt.
  const doSave = (): Promise<void> => onSave(normalizeStepRolle(draft));
  const save = useAsyncAction(doSave, { onSuccess: onSaved });

  const dirty = JSON.stringify(draft) !== JSON.stringify(step);
  useReportGuardState(onGuardStateChange, dirty, doSave);

  const skillBekannt = draft.skillId === '' || file.skills.some(s => s.id === draft.skillId);

  return (
    <div className="max-w-[760px]">
      <button onClick={onBack} className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4">← Skill-Verwaltung</button>
      <div className="flex items-baseline gap-2.5">
        <input
          value={draft.label}
          disabled={ro}
          onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
          className="text-[20px] font-medium text-[var(--tf-text)] bg-transparent outline-none border-b border-transparent focus:border-[var(--tf-border-hover)] disabled:opacity-100 flex-1"
        />
        <span className="text-[11px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{isNew ? 'neu' : 'Schritt'}</span>
      </div>

      <div className="mt-6 rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-[24px] flex flex-col gap-5">
        <Field label="Voller Name (Abschnittsüberschrift)">
          <input value={draft.label} disabled={ro} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} className={inputCls} />
        </Field>

        <Field label="Kurz-Label (Stepper-Pill)">
          <input
            value={draft.kurz}
            disabled={ro}
            onChange={e => setDraft(d => ({ ...d, kurz: e.target.value }))}
            className={`${inputCls} max-w-[160px]`}
          />
        </Field>

        <Field label={`Skill (${rolle === 'llm_qs' ? 'bewertet diesen Schritt' : 'erzeugt diesen Schritt'})`}>
          <select
            value={draft.skillId}
            disabled={ro}
            onChange={e => setDraft(d => ({ ...d, skillId: e.target.value }))}
            className={inputCls}
          >
            <option value="">— Skill wählen —</option>
            {file.skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {!skillBekannt && (
            <p className="text-[11.5px] text-[var(--tf-warning-text)] mt-1.5">
              Unbekannte Skill-ID „{draft.skillId}" — wird beibehalten, aber kann nicht generieren, bis ein gültiger Skill gewählt ist.
            </p>
          )}
        </Field>

        <Field label="Rolle des Schritts">
          <select
            value={rolle}
            disabled={ro}
            onChange={e => setDraft(d => {
              const r = e.target.value as WorkflowStepRolle;
              // Beim Wechsel auf QS einen leeren Skill auf den QS-Basis-Skill vorbelegen.
              return r === 'llm_qs'
                ? { ...d, rolle: r, skillId: d.skillId || QS_BASIS_SKILL_ID }
                : { ...d, rolle: r };
            })}
            className={`${inputCls} max-w-[420px]`}
          >
            {ROLLE_OPTIONS.map(r => <option key={r} value={r}>{ROLLE_LABEL[r]}</option>)}
          </select>
        </Field>

        {rolle === 'llm_qs' ? (
          <Field label="Bewerteter Abschnitt (Ziel)">
            <select
              value={draft.qsZielStepId ?? ''}
              disabled={ro}
              onChange={e => setDraft(d => ({ ...d, qsZielStepId: e.target.value || undefined }))}
              className={`${inputCls} max-w-[420px]`}
            >
              <option value="">— Abschnitt wählen —</option>
              {zielOptionen.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1.5">
              Die KI-QS bewertet den finalen Text dieses Generierungs-Schritts beratend — sie ändert ihn nicht.
            </p>
          </Field>
        ) : (
          <Field label="Automatischer Retry bei Fehl-Checks">
            <label className="flex items-center gap-2 text-[13px] text-[var(--tf-text)]">
              <input
                type="checkbox"
                checked={!!draft.autoRetry}
                disabled={ro}
                onChange={e => setDraft(d => ({ ...d, autoRetry: e.target.checked }))}
              />
              Nach einem Fehler-Check automatisch neu generieren (passender Modifier)
            </label>
            {draft.autoRetry && (
              <label className="flex items-center gap-2 mt-2.5 text-[12.5px] text-[var(--tf-text-secondary)]">
                Maximale Versuche
                <input
                  type="number"
                  min={0}
                  max={MAX_AUTO_RETRIES}
                  value={draft.maxRetries ?? DEFAULT_MAX_RETRIES}
                  disabled={ro}
                  onChange={e => setDraft(d => ({ ...d, maxRetries: Number(e.target.value) }))}
                  className={`${inputCls} max-w-[90px]`}
                />
                <span className="text-[var(--tf-text-tertiary)]">(0–{MAX_AUTO_RETRIES}; danach STOPP, Mensch prüft)</span>
              </label>
            )}
          </Field>
        )}

        <Field label="Anwendbarkeits-Gate">
          <select
            value={draft.gateExpr ?? 'immer'}
            disabled={ro}
            onChange={e => setDraft(d => ({ ...d, gateExpr: e.target.value as GateExpr }))}
            className={`${inputCls} max-w-[320px]`}
          >
            {GATE_OPTIONS.map(g => <option key={g} value={g}>{GATE_LABEL[g]}</option>)}
          </select>
        </Field>

        <Field label="Unterschritt von (optional — genau eine Ebene)">
          <select
            value={draft.parentStepId ?? ''}
            disabled={ro || hatKinder}
            onChange={e => setDraft(d => ({ ...d, parentStepId: e.target.value || undefined }))}
            className={`${inputCls} max-w-[360px]`}
          >
            <option value="">— eigenständiger Schritt (Top-Level) —</option>
            {parentOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {hatKinder && (
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1.5">
              Dieser Schritt hat eigene Unterschritte und kann daher nicht selbst zum Unterschritt werden (nur eine Ebene).
            </p>
          )}
        </Field>

        {save.error && (
          <div className="rounded p-2.5 text-[12px]" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {save.error}</div>
        )}

        <div className="pt-4 border-t-[0.5px] border-[var(--tf-border)] flex items-center gap-2.5">
          {canEdit && (
            <>
              <button onClick={() => { void save.run(); }} disabled={save.busy} className="text-[13px] px-4 py-2 rounded-[8px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-50">
                {save.busy ? 'Speichere…' : 'Speichern'}
              </button>
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">erzeugt Workflow-Version {nextVersion}</span>
            </>
          )}
          {!canEdit && <span className="text-[12px] text-[var(--tf-text-tertiary)]">Kurator-Modus nicht aktiv — nur lesbar.</span>}
          <span className="flex-1" />
          {canEdit && !isNew && onDelete && (
            <button onClick={onDelete} className="text-[13px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]">Löschen</button>
          )}
          <button onClick={onBack} className="text-[13px] px-4 py-2 rounded-[8px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-[var(--tf-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}
