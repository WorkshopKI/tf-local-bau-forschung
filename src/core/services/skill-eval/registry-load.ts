/**
 * Lädt die Skill-Registry für die Eval und liefert die Abschnitts-Liste.
 *
 * Reine Logik — KEIN File-I/O: das Lesen einer kuratierten `registry.json`
 * passiert in der CLI-Shell (Node), hier wird nur der bereits geparste Inhalt
 * normalisiert ODER auf das eingebaute `SEED_REGISTRY` zurückgefallen. So bleibt
 * der Modul-Graph Node-/Test-tauglich (kein `smb-handle`-Lesepfad).
 */
import {
  normalizeRegistryFile,
  SEED_REGISTRY,
  getSkillById,
  resolveRegeln,
  type SkillRegistryFile,
  type SkillRecord,
  type QualitaetsRegel,
} from '@/core/services/skills';
import { ZIM_EP_WORKFLOW } from '@/plugins/antraege/gutachten/workflow-definition';
import type { StepId } from '@/plugins/antraege/gutachten/types';

/** Ein evaluierbarer Abschnitt: Step-ID + zugehöriger Skill + Label. */
export interface SectionDef {
  abschnitt: StepId;
  skillId: string;
  label: string;
}

/**
 * Alle Abschnitte des ZIM-EP-Workflows (A–G). KN existiert (noch) nicht als
 * Workflow → die Harness fährt EP-Abschnitte; KN-Fixtures werden in der CLI
 * mit Hinweis übersprungen.
 */
export function getWorkflowSections(): SectionDef[] {
  return ZIM_EP_WORKFLOW.map(s => ({ abschnitt: s.id, skillId: s.skillId, label: s.label }));
}

/**
 * Normalisiert den geparsten Inhalt einer `registry.json` zu einer
 * `SkillRegistryFile`. `null`/ungültig → eingebautes `SEED_REGISTRY`.
 */
export function resolveRegistry(raw: unknown | null): SkillRegistryFile {
  if (raw == null) return SEED_REGISTRY;
  return normalizeRegistryFile(raw) ?? SEED_REGISTRY;
}

/** Aufgelöster Skill samt seiner aktiven/inaktiven Regeln. */
export interface ResolvedSkill {
  skill: SkillRecord;
  regeln: QualitaetsRegel[];
}

/** Skill + Regeln zu einer Skill-ID (oder `null`, wenn nicht in der Registry). */
export function resolveSkill(registry: SkillRegistryFile, skillId: string): ResolvedSkill | null {
  const skill = getSkillById(registry, skillId);
  if (!skill) return null;
  return { skill, regeln: resolveRegeln(registry, skill) };
}
