import { useState } from 'react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { GateExpr, SkillRegistryFile, WorkflowStep } from '@/core/services/skills';
import { getWorkflowDef } from './workflowShared';

const GATE_LABEL: Record<GateExpr, string> = {
  immer: 'Immer anwendbar',
  hat_teilvorhaben: 'Nur wenn Teilvorhaben vorhanden',
};
const GATE_OPTIONS: GateExpr[] = ['immer', 'hat_teilvorhaben'];

interface WorkflowEditorProps {
  file: SkillRegistryFile;
  step: WorkflowStep;
  isNew: boolean;
  canEdit: boolean;
  /** Persistiert den (ge-upserteten) Schritt; der Aufrufer bumpt die Def-Version. */
  onSave: (step: WorkflowStep) => Promise<void>;
  onDelete?: () => void;
  onBack: () => void;
}

export function WorkflowEditor({ file, step, isNew, canEdit, onSave, onDelete, onBack }: WorkflowEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<WorkflowStep>(step);
  const nextVersion = getWorkflowDef(file).version + 1;
  const ro = !canEdit;
  const inputCls = 'w-full rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] disabled:opacity-70 px-[11px] py-2 text-[13px] text-[var(--tf-text)]';

  const save = useAsyncAction(async () => { await onSave(draft); }, { onSuccess: onBack });

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

        <Field label="Skill (erzeugt diesen Schritt)">
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
