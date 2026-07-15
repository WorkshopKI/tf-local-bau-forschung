/**
 * Geteilte Workflow-Mutations-Aktionen (Schritte + Workflow-Management) für die
 * Skill-Verwaltung UND den dev-Inline-Editor in der Gutachten-Werkstatt. Reine
 * Fabrik ohne React-Hooks — Persistenz + UI-Nachaktionen werden injiziert, damit
 * beide Aufrufer denselben Zweig nutzen (kein paralleler Pfad).
 *
 * Zwei Persist-Wege bewusst getrennt (wie in der Page):
 *  - `persist` roh + awaitbar (wirft) → `saveStep` (Leave-Guard-Pfad des WorkflowEditor).
 *  - `run` fire-and-forget mit Busy/Error-Tracking (`useAsyncAction.run`) → alles andere.
 */
import {
  blankWorkflow, getWorkflowById, getWorkflowDef, upsertStep, upsertWorkflowDef, withWorkflowSteps,
} from './workflowShared';
import type {
  ArtefaktTyp, SkillRegistryFile, WorkflowDef, WorkflowEbene, WorkflowStep,
} from '@/core/services/skills';

export interface WorkflowMutationDeps {
  file: SkillRegistryFile;
  selectedWorkflowId: string;
  /** Roher, awaitbarer Persist (wirft bei Fehler) — für den Leave-Guard-Pfad (`saveStep`). */
  persist: (next: SkillRegistryFile) => Promise<void>;
  /** Fire-and-forget-Persist mit Busy/Error-Tracking (`useAsyncAction.run`). */
  run: (next: SkillRegistryFile) => Promise<void>;
  onWorkflowCreated?: (id: string) => void;
  onWorkflowDeleted?: () => void;
  onStepDeleted?: () => void;
}

export interface WorkflowMutations {
  saveStep: (step: WorkflowStep) => Promise<void>;
  changeSteps: (steps: WorkflowStep[]) => void;
  deleteStep: (step: WorkflowStep) => void;
  createWorkflow: (name: string, artefaktTyp: ArtefaktTyp, ebene: WorkflowEbene) => void;
  saveWorkflowMeta: (def: WorkflowDef) => void;
  toggleWorkflowAktiv: (def: WorkflowDef) => void;
  toggleWorkflowFreigabe: (def: WorkflowDef) => void;
  deleteWorkflow: (def: WorkflowDef) => void;
}

export function buildWorkflowMutations(deps: WorkflowMutationDeps): WorkflowMutations {
  const { file, selectedWorkflowId, persist, run, onWorkflowCreated, onWorkflowDeleted, onStepDeleted } = deps;
  const selectedWorkflowDef = (): WorkflowDef => getWorkflowById(file, selectedWorkflowId) ?? getWorkflowDef(file);

  return {
    saveStep: async (step) => {
      const steps = upsertStep(selectedWorkflowDef().steps, step);
      await persist(withWorkflowSteps(file, selectedWorkflowId, steps));
    },
    changeSteps: (steps) => {
      void run(withWorkflowSteps(file, selectedWorkflowId, steps));
    },
    deleteStep: (step) => {
      void run(withWorkflowSteps(file, selectedWorkflowId, selectedWorkflowDef().steps.filter(s => s.id !== step.id)))
        .then(() => onStepDeleted?.());
    },
    createWorkflow: (name, artefaktTyp, ebene) => {
      const w = blankWorkflow({ name: name.trim() || 'Neuer Workflow', artefaktTyp, ebene });
      void run(upsertWorkflowDef(file, w)).then(() => onWorkflowCreated?.(w.id));
    },
    saveWorkflowMeta: (def) => {
      void run(upsertWorkflowDef(file, { ...def, version: def.version + 1 }));
    },
    toggleWorkflowAktiv: (def) => {
      void run(upsertWorkflowDef(file, { ...def, aktiv: def.aktiv === false, version: def.version + 1 }));
    },
    toggleWorkflowFreigabe: (def) => {
      if (def.freigabe !== 'entwurf'
        && !window.confirm(`„${def.name}" auf Entwurf zurückstellen? Der Workflow verschwindet dann in pl/prod/as — nur dev sieht Entwürfe.`)) return;
      const freigabe = def.freigabe === 'entwurf' ? 'freigegeben' : 'entwurf';
      void run(upsertWorkflowDef(file, { ...def, freigabe, version: def.version + 1 }));
    },
    deleteWorkflow: (def) => {
      if (!window.confirm(`Workflow „${def.name}" wirklich löschen? (eigener Workflow, kein Seed)`)) return;
      const others = (file.workflows ?? []).filter(w => w.id !== def.id);
      void run({ ...file, workflows: others }).then(() => onWorkflowDeleted?.());
    },
  };
}
