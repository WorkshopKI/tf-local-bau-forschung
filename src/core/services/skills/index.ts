/**
 * Skill-Service — Dach-Barrel über vier kohäsive Submodule:
 *  - run/           Ausführung + Parsing (Skill-Runner, Prompt-Komposition)
 *  - registry/      Check-Engine, Selektoren, Seed, Storage, Typen
 *  - tweaks/        User-Overrides (Skill-Tweaks v2)
 *  - textbausteine/ Kuratierter Baustein-Katalog (NF/RNE/ABL) — Fassungen + Freigabe
 *  - paket/         Kuratur-Paket: einen ganzen Stand auf einen anderen Share übertragen
 *
 * Eine Heimat pro Symbol: `splitSentences`, `CheckResult`/`CheckLevel` und
 * `SkillModifierKey` kommen ausschließlich aus `registry/` (kein Doppelpfad mehr).
 * Konsumenten importieren immer über dieses Dach (`@/core/services/skills`).
 */
export * from './run';
export * from './registry';
export * from './tweaks';
export * from './textbausteine';
export * from './paket';
