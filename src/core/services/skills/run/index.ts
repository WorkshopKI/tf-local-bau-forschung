/** Skill-Runtime-Service (run/) — Submodul-Barrel.
 *  Ausführung + Parsing. Check-Typen/`splitSentences`/`SkillModifierKey` leben
 *  eindeutig unter `../registry` und werden vom Dach-Barrel re-exportiert. */
export type { ParsedSkillOutput, QuellenBeleg } from './types';
export { parseSkillOutput } from './parse';
export { runSkill, capVbMarkdown, VB_CHAR_CAP, DEFAULT_MAX_TOKENS, THINKING_OUTPUT_HEADROOM, VB_KUERZEN_HINWEIS, vbUeberschreitetCap, composeSkillPrompt, renderSkillPrompt, buildTweakBlock, buildAnweisungBlock } from './run-skill';
export type { SkillRunInput, SkillRunResult, SkillTweakPromptInput, RenderedSkillPrompt } from './run-skill';
