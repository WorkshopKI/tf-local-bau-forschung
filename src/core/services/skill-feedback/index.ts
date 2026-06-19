/**
 * Skill-Feedback-Substrat (S1) — Barrel-Export.
 *
 * File-first Schicht für soziale Skill-Signale (Nutzung, 👍/👎, Reifegrad-Vorschlag)
 * ohne Backend, kollisionsarm auf der SMB-Share. Import überall via
 * `@/core/services/skill-feedback`. Detail: ./README.md.
 */
export * from './types';
export * from './guard';
export * from './identity';
export * from './layout';
export * from './cache';
export * from './write';
