import { useState } from 'react';
import { ChevronUp, ChevronDown, GripVertical, Trash2 } from 'lucide-react';
import {
  computeStepNumbers,
  type ArtefaktTyp, type SkillRegistryFile, type WorkflowDef, type WorkflowEbene, type WorkflowStep,
} from '@/core/services/skills';
import { ListItem } from '@/components/ui/ListItem';
import { RowAction } from '@/components/ui/RowAction';
import { Button } from '@/components/ui/button';
import {
  ARTEFAKT_TYP_LABEL, EBENE_LABEL, getWorkflowById, getWorkflowDef, istSeedWorkflow, reorderSteps,
} from './workflowShared';
import { WorkflowSwitcher } from './WorkflowSwitcher';
import { WorkflowMetaEditor } from './WorkflowMetaEditor';

interface WorkflowsTabProps {
  file: SkillRegistryFile;
  canEdit: boolean;
  /** Aktuell gewählter Workflow (Default `zim-ep`, geklemmt vom Aufrufer). */
  selectedId: string;
  onSelectWorkflow: (id: string) => void;
  onEditStep: (step: WorkflowStep) => void;
  /** Persistiert eine neue Schritt-Reihenfolge/-Liste (Aufrufer bumpt die Version). */
  onChangeSteps: (steps: WorkflowStep[]) => void;
  // — Workflow-Management (Aufrufer persistiert + bumpt Version) —
  onCreateWorkflow: (name: string, artefaktTyp: ArtefaktTyp, ebene: WorkflowEbene) => void;
  onSaveWorkflowMeta: (def: WorkflowDef) => void;
  onToggleFreigabe: (def: WorkflowDef) => void;
  onToggleAktiv: (def: WorkflowDef) => void;
  onDeleteWorkflow: (def: WorkflowDef) => void;
  /** Exportiert den gewählten Workflow als portables .json-Bündel (read-only). */
  onExportWorkflow: (def: WorkflowDef) => void;
  /** Öffnet den Workflow-Bündel-Import (schreibt → nur mit `canEdit`). */
  onImportWorkflow: () => void;
}

/** Geteilte Pillen-Button-Optik der Kopfzeilen-Aktionen. */
const KOPF_BTN =
  'shrink-0 text-[12.5px] px-[13px] py-[7px] rounded-[99px] border-[0.5px] border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-hover)]';

const ARTEFAKT_OPTIONS = Object.keys(ARTEFAKT_TYP_LABEL) as ArtefaktTyp[];
const EBENE_OPTIONS = Object.keys(EBENE_LABEL) as WorkflowEbene[];

/** Inline-Picker für einen neuen Workflow (Name + Typ-/Ebenen-Pills). */
function CreateWorkflowForm({ onCreate, onCancel }: {
  onCreate: (name: string, artefaktTyp: ArtefaktTyp, ebene: WorkflowEbene) => void;
  onCancel: () => void;
}): React.ReactElement {
  const [name, setName] = useState('');
  const [artefaktTyp, setArtefaktTyp] = useState<ArtefaktTyp>('precheck');
  const [ebene, setEbene] = useState<WorkflowEbene>('verbund');

  const pill = (active: boolean): string =>
    `text-[12px] px-[11px] py-[5px] rounded-[99px] border-[0.5px] ${active ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)] border-transparent' : 'bg-transparent text-[var(--tf-text-secondary)] border-[var(--tf-border)]'}`;

  return (
    <div className="rounded-[10px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-3.5 flex flex-col gap-3">
      <input
        autoFocus
        value={name}
        placeholder="Name des Workflows"
        onChange={e => setName(e.target.value)}
        className="text-[13px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)]"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-[var(--tf-text-tertiary)] mr-1">Typ:</span>
        {ARTEFAKT_OPTIONS.map(t => (
          <button key={t} type="button" onClick={() => setArtefaktTyp(t)} className={pill(artefaktTyp === t)}>{ARTEFAKT_TYP_LABEL[t]}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-[var(--tf-text-tertiary)] mr-1">Ebene:</span>
        {EBENE_OPTIONS.map(e => (
          <button key={e} type="button" onClick={() => setEbene(e)} className={pill(ebene === e)}>{EBENE_LABEL[e]}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => onCreate(name, artefaktTyp, ebene)}
        >
          Anlegen (Entwurf)
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

export function WorkflowsTab({
  file, canEdit, selectedId, onSelectWorkflow, onEditStep, onChangeSteps,
  onCreateWorkflow, onSaveWorkflowMeta, onToggleFreigabe, onToggleAktiv, onDeleteWorkflow,
  onExportWorkflow, onImportWorkflow,
}: WorkflowsTabProps): React.ReactElement {
  const def = getWorkflowById(file, selectedId) ?? getWorkflowDef(file);
  const steps = def.steps;
  const nummern = computeStepNumbers(steps);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

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
      <div className="flex items-start justify-between gap-3">
        <WorkflowSwitcher file={file} selectedId={def.id} onSelect={onSelectWorkflow} />
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onExportWorkflow(def)} className={KOPF_BTN}>
            Exportieren
          </button>
          {canEdit && (
            <button type="button" onClick={onImportWorkflow} className={KOPF_BTN}>
              Importieren…
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => setCreating(c => !c)} className={KOPF_BTN}>
              + Neuer Workflow
            </button>
          )}
        </div>
      </div>

      {creating && canEdit && (
        <CreateWorkflowForm
          onCreate={(name, artefaktTyp, ebene) => { onCreateWorkflow(name, artefaktTyp, ebene); setCreating(false); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {canEdit && (
        <WorkflowMetaEditor
          key={def.id}
          def={def}
          canEdit={canEdit}
          isSeed={istSeedWorkflow(def.id)}
          onSaveMeta={onSaveWorkflowMeta}
          onToggleFreigabe={onToggleFreigabe}
          onToggleAktiv={onToggleAktiv}
          onDelete={onDeleteWorkflow}
        />
      )}

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
