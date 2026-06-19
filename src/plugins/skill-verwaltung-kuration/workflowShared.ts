/**
 * Reine Helfer der Workflow-Kuration (Muster: `regelShared.ts`). Keine UI, kein
 * IO — nur Transformationen auf der `WorkflowDef`/`WorkflowStep`-Datenstruktur.
 * Persistenz läuft über `useSkillRegistry.persist` (self-gated).
 */
import {
  ZIM_EP_DEF, type SkillRegistryFile, type WorkflowDef, type WorkflowStep,
} from '@/core/services/skills';

/** Die in v1 einzige kuratierbare WorkflowDef aus der Registry; Fallback Seed `ZIM_EP_DEF`. */
export function getWorkflowDef(file: SkillRegistryFile): WorkflowDef {
  return file.workflows?.find(w => w.id === ZIM_EP_DEF.id) ?? ZIM_EP_DEF;
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
 * Schreibt eine neue Step-Liste in die aktive Def zurück (Version-Bump, wie bei
 * Skills) und liefert die neue Registry-Datei. Existiert die Def noch nicht (Alt-
 * Datei), wird sie aus dem Seed abgeleitet angelegt.
 */
export function withWorkflowSteps(file: SkillRegistryFile, steps: WorkflowStep[]): SkillRegistryFile {
  const current = getWorkflowDef(file);
  const updated: WorkflowDef = { ...current, version: current.version + 1, steps };
  const others = (file.workflows ?? []).filter(w => w.id !== updated.id);
  return { ...file, workflows: [...others, updated] };
}

/** Neuer leerer Schritt — der Kurator füllt Label/Kurz/Skill/Gate im Editor. */
export function blankStep(): WorkflowStep {
  return { id: crypto.randomUUID(), nr: '', kurz: '•', label: 'Neuer Schritt', skillId: '', gateExpr: 'immer' };
}
