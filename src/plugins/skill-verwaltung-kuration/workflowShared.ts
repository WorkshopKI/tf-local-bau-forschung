/**
 * Reine Helfer der Workflow-Kuration (Muster: `regelShared.ts`). Keine UI, kein
 * IO — nur Transformationen auf der `WorkflowDef`/`WorkflowStep`-Datenstruktur.
 * Persistenz läuft über `useSkillRegistry.persist` (self-gated).
 */
import {
  ZIM_EP_DEF, SEED_WORKFLOWS, computeStepNumbers,
  type ArtefaktTyp, type SkillRegistryFile, type WorkflowDef, type WorkflowEbene, type WorkflowStep,
} from '@/core/services/skills';

/** Menschenlesbare Labels der Artefakt-Typen (Switcher-Badge, Picker). */
export const ARTEFAKT_TYP_LABEL: Record<ArtefaktTyp, string> = {
  ga: 'Gutachten',
  nf: 'Nachforderung',
  abl: 'ABL',
  rne: 'RNE',
  precheck: 'PreCheck',
};

/** Menschenlesbare Labels der Ebenen. */
export const EBENE_LABEL: Record<WorkflowEbene, string> = {
  verbund: 'Verbund',
  tv: 'Teilvorhaben',
};

/** Default-WorkflowDef (GA/`zim-ep`); Fallback Seed `ZIM_EP_DEF`, wenn nicht in der Registry. */
export function getWorkflowDef(file: SkillRegistryFile): WorkflowDef {
  return file.workflows?.find(w => w.id === ZIM_EP_DEF.id) ?? ZIM_EP_DEF;
}

/** Findet eine WorkflowDef per id (oder `undefined`). */
export function getWorkflowById(file: SkillRegistryFile, id: string): WorkflowDef | undefined {
  return file.workflows?.find(w => w.id === id);
}

/** `true`, wenn `id` ein geseedeter Workflow ist (→ kein Hard-Delete, nur Deaktivieren — Remerge). */
export function istSeedWorkflow(id: string): boolean {
  return SEED_WORKFLOWS.some(w => w.id === id);
}

/**
 * Verschiebt einen Schritt von `from` nach `to` (stabil). No-Op (neue Referenz,
 * unveränderte Reihenfolge) bei gleichem Index oder Out-of-range. Lässt das
 * Original unangetastet.
 */
export function reorderSteps(steps: readonly WorkflowStep[], from: number, to: number): WorkflowStep[] {
  const n = steps.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return [...steps];
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** Upsert eines Schritts (nach `id`); neue Liste, Original unangetastet. */
export function upsertStep(steps: readonly WorkflowStep[], step: WorkflowStep): WorkflowStep[] {
  const i = steps.findIndex(s => s.id === step.id);
  if (i < 0) return [...steps, step];
  const next = [...steps];
  next[i] = step;
  return next;
}

/**
 * Upsert einer ganzen WorkflowDef (nach `id`) — VERSION-NEUTRAL (der Aufrufer
 * entscheidet, ob er die Version bumpt). Neue Registry-Datei, Original unangetastet.
 */
export function upsertWorkflowDef(file: SkillRegistryFile, def: WorkflowDef): SkillRegistryFile {
  const others = (file.workflows ?? []).filter(w => w.id !== def.id);
  return { ...file, workflows: [...others, def] };
}

/**
 * Schreibt eine neue Step-Liste in die Def `workflowId` zurück (Version-Bump, wie
 * bei Skills) und liefert die neue Registry-Datei. Existiert die Def noch nicht
 * (Alt-Datei / Default `zim-ep`), wird sie aus dem Default abgeleitet angelegt.
 */
export function withWorkflowSteps(file: SkillRegistryFile, workflowId: string, steps: WorkflowStep[]): SkillRegistryFile {
  // Anzeige-Nummern (5 / 5a) aus der Hierarchie ableiten + mitpersistieren.
  const nummern = computeStepNumbers(steps);
  const nummeriert = steps.map(s => ({ ...s, nr: nummern.get(s.id) ?? s.nr }));
  const current = getWorkflowById(file, workflowId) ?? getWorkflowDef(file);
  const updated: WorkflowDef = { ...current, version: current.version + 1, steps: nummeriert };
  return upsertWorkflowDef(file, updated);
}

/** Neuer leerer Schritt — der Kurator füllt Label/Kurz/Skill/Gate im Editor. */
export function blankStep(): WorkflowStep {
  return { id: crypto.randomUUID(), nr: '', kurz: '•', label: 'Neuer Schritt', skillId: '', gateExpr: 'immer' };
}

/** Neuer Workflow als Entwurf (nur dev sichtbar, bis er freigegeben wird). */
export function blankWorkflow({ name, artefaktTyp, ebene }: { name: string; artefaktTyp: ArtefaktTyp; ebene: WorkflowEbene }): WorkflowDef {
  return {
    id: crypto.randomUUID(),
    name,
    version: 1,
    steps: [],
    artefaktTyp,
    ebene,
    aktiv: true,
    freigabe: 'entwurf',
  };
}
