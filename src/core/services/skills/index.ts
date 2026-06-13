/**
 * Skill-Service — Dach-Barrel über drei kohäsive Submodule:
 *  - run/      Ausführung + Parsing (Skill-Runner, Prompt-Komposition)
 *  - registry/ Check-Engine, Selektoren, Seed, Storage, Typen
 *  - tweaks/   User-Overrides (Skill-Tweaks v2)
 *
 * Eine Heimat pro Symbol: `splitSentences`, `CheckResult`/`CheckLevel` und
 * `SkillModifierKey` kommen ausschließlich aus `registry/` (kein Doppelpfad mehr).
 * Konsumenten importieren immer über dieses Dach (`@/core/services/skills`).
 */
export * from './run';
export * from './registry';
export * from './tweaks';
