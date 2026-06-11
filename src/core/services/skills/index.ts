/** Skill-Runtime-Service — Barrel-Export. */
export type { ParsedSkillOutput } from './types';
export { parseSkillOutput } from './parse';
export { runSkill, capVbMarkdown, VB_CHAR_CAP, composeSkillPrompt, buildTweakBlock } from './run-skill';
export type { SkillRunInput, SkillRunResult, SkillTweakPromptInput } from './run-skill';

// Pfad-Kompat für bestehende Consumer (ReviewCard, CheckList, kurzfassung/types):
// CheckResult/CheckLevel/splitSentences + SkillModifierKey kommen seit der
// Registry-Migration aus `@/core/services/skill-registry`.
export { splitSentences } from '@/core/services/skill-registry';
export type { CheckResult, CheckLevel, SkillModifierKey } from '@/core/services/skill-registry';
