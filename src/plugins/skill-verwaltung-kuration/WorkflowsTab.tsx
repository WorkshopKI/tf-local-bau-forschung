import { useState } from 'react';
import { ChevronUp, ChevronDown, GripVertical, Trash2 } from 'lucide-react';
import { computeStepNumbers, type SkillRegistryFile, type WorkflowStep } from '@/core/services/skills';
import { ListItem } from '@/components/ui/ListItem';
import { RowAction } from '@/components/ui/RowAction';
import { getWorkflowById, getWorkflowDef, reorderSteps } from './workflowShared';
import { WorkflowSwitcher } from './WorkflowSwitcher';

interface WorkflowsTabProps {
  file: SkillRegistryFile;
  canEdit: boolean;
  /** Aktuell gewählter Workflow (Default `zim-ep`, geklemmt vom Aufrufer). */
  selectedId: string;
  onSelectWorkflow: (id: string) => void;
  onEditStep: (step: WorkflowStep) => void;
  /** Persistiert eine neue Schritt-Reihenfolge/-Liste (Aufrufer bumpt die Version). */
  onChangeSteps: (steps: WorkflowStep[]) => void;
}

export function WorkflowsTab({ file, canEdit, selectedId, onSelectWorkflow, onEditStep, onChangeSteps }: WorkflowsTabProps): React.ReactElement {
  const def = getWorkflowById(file, selectedId) ?? getWorkflowDef(file);
  const steps = def.steps;
  const nummern = computeStepNumbers(steps);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= steps.length) return;
    onChangeSteps(reorderSteps(steps, from, to));
  };
  const remove = (step: WorkflowStep): void => {
    if (!window.confirm(`Schritt „${step.label}" wirklich entfernen?`)) return;
    onChangeSteps(steps.filter(s => s.id !== step.id));
  };

  return (
    <div className="flex flex-col gap-4">
      <WorkflowSwitcher file={file} selectedId={def.id} onSelect={onSelectWorkflow} />

      {steps.length === 0 ? (
        <p className="text-[13.5px] text-[var(--tf-text-secondary)] py-2">
          „{def.name}" hat noch keine Schritte. Lege den ersten an →
        </p>
      ) : (
      <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2 text-[12px] text-[var(--tf-text-tertiary)]">
        <span className="text-[13px] font-medium text-[var(--tf-text)]">{def.name}</span>
        <span>·</span>
        <span>v{def.version}</span>
        <span>·</span>
        <span>{steps.length} {steps.length === 1 ? 'Schritt' : 'Schritte'}</span>
        {canEdit && <span className="ml-2">— ziehen oder ▲▼ zum Umsortieren, Zeile zum Bearbeiten</span>}
      </div>

      <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] overflow-hidden">
        {steps.map((step, i) => {
          const skill = file.skills.find(s => s.id === step.skillId);
          const skillLabel = skill?.name ?? (step.skillId ? `⚠ ${step.skillId}` : 'kein Skill');
          const istSub = !!step.parentStepId;
          return (
            <div
              key={step.id}
              draggable={canEdit}
              onDragStart={() => setDragIdx(i)}
              onDragOver={canEdit ? (e => e.preventDefault()) : undefined}
              onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
              onDragEnd={() => setDragIdx(null)}
              className={dragIdx === i ? 'opacity-50' : undefined}
            >
              <ListItem
                layout="inline"
                last={i === steps.length - 1}
                onClick={() => onEditStep(step)}
                icon={(
                  <span className={`flex items-center gap-1.5 text-[var(--tf-text-tertiary)] ${istSub ? 'pl-4' : ''}`}>
                    {canEdit && <GripVertical size={14} className="cursor-grab" />}
                    <span className="font-mono text-[12px] w-6 text-right">{nummern.get(step.id) ?? i + 1}</span>
                  </span>
                )}
                iconBare
                title={(
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-[5px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{step.kurz || '—'}</span>
                    <span className="text-[var(--tf-text)]">{step.label}</span>
                    {step.rolle === 'llm_qs' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)] whitespace-nowrap">KI-QS</span>
                    )}
                  </span>
                )}
                subtitle={skillLabel}
                meta={(step.rolle !== 'llm_qs' && step.autoRetry) || (step.gateExpr && step.gateExpr !== 'immer') ? (
                  <span className="flex items-center gap-1.5">
                    {step.rolle !== 'llm_qs' && step.autoRetry && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)] whitespace-nowrap">Auto-Retry ×{step.maxRetries ?? 2}</span>
                    )}
                    {step.gateExpr && step.gateExpr !== 'immer' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)] whitespace-nowrap">Gate: Teilvorhaben</span>
                    )}
                  </span>
                ) : undefined}
                actions={canEdit ? (
                  <div className="flex items-center gap-0.5">
                    <RowAction title="Nach oben" onClick={() => move(i, i - 1)}><ChevronUp size={15} /></RowAction>
                    <RowAction title="Nach unten" onClick={() => move(i, i + 1)}><ChevronDown size={15} /></RowAction>
                    <RowAction title="Entfernen" danger onClick={() => remove(step)}><Trash2 size={14} /></RowAction>
                  </div>
                ) : undefined}
              />
            </div>
          );
        })}
      </div>
      </div>
      )}
    </div>
  );
}
