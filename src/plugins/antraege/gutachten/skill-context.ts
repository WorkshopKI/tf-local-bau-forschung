/**
 * Geteilte Skill-/Stammdaten-Helfer des Gutachten-Workflows. EINE Quelle für
 * Einzellauf (useGutachtenWorkflow) UND Batch (useBatchJob) → kein zweiter
 * Prompt-/Generierungs-Pfad. Reine Funktionen.
 */
import {
  getSkillById, resolveRegeln, SEED_REGISTRY,
  type ArtefaktTyp, type QualitaetsRegel, type SkillRecord, type SkillRegistryFile,
} from '@/core/services/skills';
import { erlaubeWorkflowEntwuerfe } from '@/config/feature-flags';
import type { KurzfassungContext } from '../kurzfassung/types';
import { resolveWorkflowSteps } from './active-workflow';
import type { StepId } from './types';

export interface SkillCtx {
  skill: SkillRecord;
  regeln: QualitaetsRegel[];
}

export function buildStammdaten(ctx: KurzfassungContext): string {
  const nn = '[Im Antrag nicht genannt]';
  const lines = [
    `- Förderkennzeichen (Verbund): ${ctx.foerderkennzeichen}`,
    `- Akronym: ${ctx.akronym}`,
    `- Verbund-Titel: ${ctx.titel ?? nn}`,
    `- Konsortialführer: ${ctx.antragsteller ?? nn}`,
  ];
  if (ctx.teilvorhaben.length > 0) {
    lines.push(`- Teilvorhaben (${ctx.teilvorhaben.length}):`);
    for (const tv of ctx.teilvorhaben) {
      lines.push(`  - TV ${tv.nr} (${tv.aktenzeichen}, ${tv.antragsteller ?? nn}): ${tv.titel ?? nn}`);
    }
  }
  return lines.join('\n');
}

/**
 * Skill + Regeln je Schritt des aufgelösten Workflows aus der Registry (Fallback:
 * Seed). EINE Quelle mit `resolveWorkflowSteps` (kein zweiter Pfad). Ohne `opts`
 * = Default-GA per Tie-Break, byte-identisch (so bleibt z.B. `useBatchJob`
 * unberührt); `opts.workflowId` speist die dev-Test-Auswahl ein.
 */
export function buildSkillMap(
  file: SkillRegistryFile,
  opts?: { artefaktTyp?: ArtefaktTyp; workflowId?: string },
): Map<StepId, SkillCtx> {
  const map = new Map<StepId, SkillCtx>();
  const steps = resolveWorkflowSteps(file, opts?.artefaktTyp ?? 'ga', {
    erlaubeEntwuerfe: erlaubeWorkflowEntwuerfe(),
    workflowId: opts?.workflowId,
  });
  for (const step of steps) {
    const found = getSkillById(file, step.skillId);
    if (found) { map.set(step.id, { skill: found, regeln: resolveRegeln(file, found) }); continue; }
    const seed = getSkillById(SEED_REGISTRY, step.skillId);
    if (seed) map.set(step.id, { skill: seed, regeln: resolveRegeln(SEED_REGISTRY, seed) });
  }
  return map;
}
