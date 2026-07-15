/**
 * Export/Import einer ganzen Workflow-Definition als portables Bündel (Workflow +
 * ALLE von seinen Schritten referenzierten Skills + deren Regeln). Spiegel zu
 * `skill-bundle.ts`. Bewusst rein und OHNE Antragsdaten — ein Bündel enthält
 * ausschließlich kuratierte Registry-Inhalte, nie generierten Text / VB / FKZ.
 *
 * Warum die Skills mitreisen (nicht nur per ID referenziert): der Zweck des Exports
 * ist, getweakte Prompts mitzunehmen. Referenzierte Skills werden daher beim Import
 * bei ID-Kollision DUPLIZIERT (neue ID) + im Workflow umgemappt — würde man
 * stattdessen den vorhandenen Skill gleicher ID wiederverwenden, gingen genau die
 * exportierten Prompt-Änderungen verloren (der importierte Workflow bände an den
 * un-getweakten Ziel-Skill). Bestehende Skills werden nie überschrieben.
 */
import { resolveRegeln } from './selectors';
import { normalizeRegistryFile } from './storage';
import type { QualitaetsRegel, SkillRecord, SkillRegistryFile, WorkflowDef, WorkflowStep } from './types';

export const WORKFLOW_BUNDLE_KIND = 'teamflow-workflow-bundle';

export interface WorkflowBundleJson {
  kind: typeof WORKFLOW_BUNDLE_KIND;
  version: 1;
  /** Die Workflow-Definition inkl. Schritte. */
  workflow: WorkflowDef;
  /** Alle von den Schritten referenzierten Skills, OHNE Versions-Historie. */
  skills: SkillRecord[];
  /** Die den Skills zugeordneten Regeln (für die Merge-Übernahme). */
  regeln: QualitaetsRegel[];
}

export interface ImportWorkflowBundleResult {
  file: SkillRegistryFile;
  importedWorkflowId: string;
  /** True, wenn die Workflow-ID kollidierte und der Workflow dupliziert wurde. */
  konflikt: boolean;
  /** Regel-IDs, die neu in die Bibliothek kamen (vorhandene bleiben unberührt). */
  ergaenzteRegeln: string[];
  /** Original-IDs der Skills, die bei ID-Kollision dupliziert wurden. */
  duplizierteSkills: string[];
}

/**
 * Schnürt ein portables Bündel für genau einen Workflow. `null`, wenn die ID nicht
 * existiert. Sammelt je `step.skillId` den Skill (Historie gestrippt) + dessen
 * Regeln. Fehlende Skill-Referenzen werden übersprungen (defensiv).
 */
export function exportWorkflowBundle(file: SkillRegistryFile, workflowId: string): WorkflowBundleJson | null {
  const workflow = file.workflows?.find(w => w.id === workflowId);
  if (!workflow) return null;

  const skillIds = new Set(workflow.steps.map(s => s.skillId).filter(Boolean));
  const skills: SkillRecord[] = [];
  const regelIds = new Set<string>();
  for (const id of skillIds) {
    const skill = file.skills.find(s => s.id === id);
    if (!skill) continue;
    const { historie: _drop, ...skillOhneHistorie } = skill;
    skills.push(skillOhneHistorie);
    for (const r of resolveRegeln(file, skill)) regelIds.add(r.id);
  }
  const regeln = file.regeln.filter(r => regelIds.has(r.id));

  return { kind: WORKFLOW_BUNDLE_KIND, version: 1, workflow, skills, regeln };
}

/**
 * Validiert + normalisiert rohes JSON zu einem Bündel (über die robuste Registry-
 * Normalisierung — fehlende Felder defaulten, unbekannte bleiben, ungültige Werte
 * fallen weg). `null` bei falscher Struktur.
 */
export function parseWorkflowBundle(raw: unknown): WorkflowBundleJson | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (b.kind !== WORKFLOW_BUNDLE_KIND) return null;
  const probe = normalizeRegistryFile({
    version: 1,
    updated_at: '',
    skills: Array.isArray(b.skills) ? b.skills : [],
    regeln: Array.isArray(b.regeln) ? b.regeln : [],
    workflows: [b.workflow],
  });
  if (!probe || !probe.workflows || probe.workflows.length !== 1) return null;
  return { kind: WORKFLOW_BUNDLE_KIND, version: 1, workflow: probe.workflows[0]!, skills: probe.skills, regeln: probe.regeln };
}

/**
 * Fügt ein Bündel in eine Registry ein. Konfliktbehandlung:
 *  - Workflow-ID-Kollision → Workflow mit neuer ID + „(importiert)"-Suffix.
 *  - Schritt-IDs werden IMMER neu vergeben (verhindert `WorkflowRun.schritte`-Key-
 *    Kollisionen zwischen Workflows); `parentStepId`/`qsZielStepId` werden umgemappt.
 *  - je Bündel-Skill: ID frei → additiv einfügen; ID-Kollision → Duplikat mit neuer
 *    ID + „(importiert)", alle `step.skillId` alt→neu umgemappt (Ziel-Skill unberührt).
 *  - Regeln additiv (vorhandene IDs NICHT überschrieben).
 * Rein — `newId` wird injiziert.
 */
export function importWorkflowBundle(
  file: SkillRegistryFile,
  bundle: WorkflowBundleJson,
  opts: { newId: () => string },
): ImportWorkflowBundleResult {
  // 1. Skills: additiv; ID-Kollision → Duplikat mit neuer ID + Remap-Eintrag.
  const vorhandeneSkillIds = new Set(file.skills.map(s => s.id));
  const skillIdMap = new Map<string, string>(); // alt → neu (nur bei Kollision)
  const neueSkills: SkillRecord[] = [];
  const duplizierteSkills: string[] = [];
  for (const skill of bundle.skills) {
    if (vorhandeneSkillIds.has(skill.id) || skillIdMap.has(skill.id)) {
      const neueId = opts.newId();
      skillIdMap.set(skill.id, neueId);
      neueSkills.push({ ...skill, id: neueId, name: `${skill.name} (importiert)` });
      duplizierteSkills.push(skill.id);
    } else {
      vorhandeneSkillIds.add(skill.id);
      neueSkills.push(skill);
    }
  }

  // 2. Regeln: additiv (vorhandene IDs unberührt).
  const vorhandeneRegelIds = new Set(file.regeln.map(r => r.id));
  const neueRegeln = bundle.regeln.filter(r => !vorhandeneRegelIds.has(r.id));

  // 3. Schritte: IDs immer neu; parentStepId/qsZielStepId + skillId umgemappt.
  const stepIdMap = new Map<string, string>();
  for (const step of bundle.workflow.steps) stepIdMap.set(step.id, opts.newId());
  const neueSteps: WorkflowStep[] = bundle.workflow.steps.map(step => ({
    ...step,
    id: stepIdMap.get(step.id)!,
    parentStepId: step.parentStepId ? stepIdMap.get(step.parentStepId) : undefined,
    qsZielStepId: step.qsZielStepId ? stepIdMap.get(step.qsZielStepId) : undefined,
    skillId: skillIdMap.get(step.skillId) ?? step.skillId,
  }));

  // 4. Workflow: ID-Kollision → neue ID + „(importiert)".
  const konflikt = (file.workflows ?? []).some(w => w.id === bundle.workflow.id);
  const importedWorkflowId = konflikt ? opts.newId() : bundle.workflow.id;
  const importedWorkflow: WorkflowDef = {
    ...bundle.workflow,
    id: importedWorkflowId,
    name: konflikt ? `${bundle.workflow.name} (importiert)` : bundle.workflow.name,
    steps: neueSteps,
  };

  return {
    file: {
      ...file,
      skills: [...file.skills, ...neueSkills],
      regeln: [...file.regeln, ...neueRegeln],
      workflows: [...(file.workflows ?? []), importedWorkflow],
    },
    importedWorkflowId,
    konflikt,
    ergaenzteRegeln: neueRegeln.map(r => r.id),
    duplizierteSkills,
  };
}
