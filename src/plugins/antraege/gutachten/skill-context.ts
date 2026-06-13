/**
 * Geteilte Skill-/Stammdaten-Helfer des Gutachten-Workflows. EINE Quelle für
 * Einzellauf (useGutachtenWorkflow) UND Batch (useBatchJob) → kein zweiter
 * Prompt-/Generierungs-Pfad. Reine Funktionen.
 */
import {
  getSkillById, resolveRegeln, SEED_REGISTRY,
  type QualitaetsRegel, type SkillRecord, type SkillRegistryFile,
} from '@/core/services/skills';
import type { KurzfassungContext } from '../kurzfassung/types';
import { ZIM_EP_WORKFLOW } from './workflow-definition';
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

/** Skill + Regeln je Schritt aus der geladenen Registry (Fallback: Seed). */
export function buildSkillMap(file: SkillRegistryFile): Map<StepId, SkillCtx> {
  const map = new Map<StepId, SkillCtx>();
  for (const def of ZIM_EP_WORKFLOW) {
    const found = getSkillById(file, def.skillId);
    if (found) { map.set(def.id, { skill: found, regeln: resolveRegeln(file, found) }); continue; }
    const seed = getSkillById(SEED_REGISTRY, def.skillId);
    if (seed) map.set(def.id, { skill: seed, regeln: resolveRegeln(SEED_REGISTRY, seed) });
  }
  return map;
}
