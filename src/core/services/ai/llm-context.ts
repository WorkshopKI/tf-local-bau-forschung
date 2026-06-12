/**
 * LLM-Kontextlänge (Tokens) als Nutzer-Einstellung → abgeleiteter VB-Zeichen-Cap.
 *
 * Der Bearbeiter meldet in den Einstellungen (KI-Assistent), wie viele Tokens
 * das genutzte LLM verarbeiten kann. Daraus wird der Schwellwert berechnet, ab
 * dem die Vorhabensbeschreibung vor dem Senden gekürzt wird (`capVbMarkdown` in
 * [run-skill.ts]) — kein hartkodierter Wert mehr, der bei LLM-Wechsel im Code
 * nachgezogen werden müsste.
 *
 * Persistenz: `localStorage` — die Einstellung ist **per-Maschine** (das LLM
 * läuft lokal/maschinen-spezifisch), synchron lesbar (fließt ohne Async-State
 * direkt in `runSkill` + die proaktiven UI-Checks) und ein simpler Skalar.
 */

const LLM_CONTEXT_TOKENS_KEY = 'teamflow_llm_context_tokens';

/** Default-Voreinstellung, falls ungesetzt (typische lokale Server-Konfiguration). */
export const DEFAULT_LLM_CONTEXT_TOKENS = 62_000;
export const MIN_LLM_CONTEXT_TOKENS = 2_048;
export const MAX_LLM_CONTEXT_TOKENS = 1_000_000;

/** Token-Reserve: Output (`maxTokens`) + Prompt-/Vorgaben-Overhead + (Workflow-)Vorabschnitte + Marge. */
const RESERVE_TOKENS = 4_096;
/** Konservative Zeichen/Token-Quote (dt. Markdown, lokale Tokenizer) — lieber unterfüllen als Context-Shift. */
const CHARS_PER_TOKEN = 3;
/** Untergrenze des abgeleiteten Caps, falls jemand eine winzige Kontextgröße einträgt. */
const MIN_VB_CHAR_CAP = 4_000;

/** Gespeicherte LLM-Kontextlänge (Tokens) — validiert/geclamped, sonst Default. */
export function getLlmContextTokens(): number {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LLM_CONTEXT_TOKENS_KEY) : null;
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_LLM_CONTEXT_TOKENS;
  return Math.min(Math.max(n, MIN_LLM_CONTEXT_TOKENS), MAX_LLM_CONTEXT_TOKENS);
}

/** LLM-Kontextlänge (Tokens) persistieren. */
export function setLlmContextTokens(tokens: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LLM_CONTEXT_TOKENS_KEY, String(tokens));
}

/** Aus dem Kontextfenster (Tokens) den sicheren VB-Zeichen-Cap ableiten. */
export function computeVbCharCap(contextTokens: number): number {
  return Math.max(MIN_VB_CHAR_CAP, (contextTokens - RESERVE_TOKENS) * CHARS_PER_TOKEN);
}

/** Aktueller VB-Zeichen-Cap aus der gespeicherten Kontextlänge-Einstellung. */
export function getVbCharCap(): number {
  return computeVbCharCap(getLlmContextTokens());
}
