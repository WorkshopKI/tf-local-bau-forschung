/**
 * LLM-Kontextlänge (Tokens) → abgeleiteter VB-Zeichen-Cap.
 *
 * Drei Quellen mit Präzedenz (höchste zuerst):
 *  1. **manuell** — der Bearbeiter trägt in den Einstellungen (KI-Assistent) einen
 *     Wert ein (`teamflow_llm_context_tokens`). Explizite Übersteuerung gewinnt.
 *  2. **erkannt** — automatisch vom lokalen llama.cpp-Server geprobt (`/props`,
 *     `teamflow_llm_context_detected`). Solange der Bearbeiter nichts eingetragen
 *     hat, gilt der echte Server-Wert (kein Nachpflegen im Code bei LLM-Wechsel).
 *  3. **Default** — `DEFAULT_LLM_CONTEXT_TOKENS`, wenn weder manuell noch erkannt.
 *
 * Daraus wird der Schwellwert berechnet, ab dem die Vorhabensbeschreibung vor dem
 * Senden gekürzt wird (`capVbMarkdown` in [run-skill.ts]).
 *
 * Persistenz: `localStorage` — die Einstellung ist **per-Maschine** (das LLM läuft
 * lokal/maschinen-spezifisch), synchron lesbar (fließt ohne Async-State direkt in
 * `runSkill` + die proaktiven UI-Checks) und ein simpler Skalar.
 */

const LLM_CONTEXT_TOKENS_KEY = 'teamflow_llm_context_tokens';
const LLM_CONTEXT_DETECTED_KEY = 'teamflow_llm_context_detected';

/** Default-Voreinstellung, falls weder manuell gesetzt noch vom Server erkannt
 *  (entspricht der internen llama.cpp-Qwen-Konfiguration, `kontext_groesse` 81920). */
export const DEFAULT_LLM_CONTEXT_TOKENS = 81_920;
export const MIN_LLM_CONTEXT_TOKENS = 2_048;
export const MAX_LLM_CONTEXT_TOKENS = 1_000_000;

/** Token-Reserve: Output (`maxTokens`) + Prompt-/Vorgaben-Overhead + (Workflow-)Vorabschnitte + Marge. */
const RESERVE_TOKENS = 4_096;
/** Konservative Zeichen/Token-Quote (dt. Markdown, lokale Tokenizer) — lieber unterfüllen als Context-Shift. */
const CHARS_PER_TOKEN = 3;
/** Untergrenze des abgeleiteten Caps, falls jemand eine winzige Kontextgröße einträgt. */
const MIN_VB_CHAR_CAP = 4_000;

/** Woraus der aktuell wirksame Kontextwert stammt (für die Einstellungs-Anzeige). */
export type LlmContextSource = 'manuell' | 'erkannt' | 'default';

/** Gespeicherten Token-Wert lesen, validieren + clampen; `null` wenn ungesetzt/ungültig. */
function readClampedTokens(key: string): number | null {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, MIN_LLM_CONTEXT_TOKENS), MAX_LLM_CONTEXT_TOKENS);
}

/** Wirksame LLM-Kontextlänge (Tokens): manuell > erkannt > Default. */
export function getLlmContextTokens(): number {
  return readClampedTokens(LLM_CONTEXT_TOKENS_KEY)
    ?? readClampedTokens(LLM_CONTEXT_DETECTED_KEY)
    ?? DEFAULT_LLM_CONTEXT_TOKENS;
}

/** Quelle des aktuell wirksamen Werts (manuell übersteuert erkannt übersteuert Default). */
export function getLlmContextSource(): LlmContextSource {
  if (readClampedTokens(LLM_CONTEXT_TOKENS_KEY) !== null) return 'manuell';
  if (readClampedTokens(LLM_CONTEXT_DETECTED_KEY) !== null) return 'erkannt';
  return 'default';
}

/** Manuelle LLM-Kontextlänge (Tokens) persistieren (übersteuert die Server-Erkennung). */
export function setLlmContextTokens(tokens: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LLM_CONTEXT_TOKENS_KEY, String(tokens));
}

/** Manuelle Übersteuerung löschen → zurück auf erkannt/Default (Automatik). */
export function clearManualLlmContextTokens(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LLM_CONTEXT_TOKENS_KEY);
}

/** Vom Server (llama.cpp `/props`) erkannten Kontextwert persistieren. */
export function setDetectedLlmContextTokens(tokens: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LLM_CONTEXT_DETECTED_KEY, String(tokens));
}

/** Aus dem Kontextfenster (Tokens) den sicheren VB-Zeichen-Cap ableiten. */
export function computeVbCharCap(contextTokens: number): number {
  return Math.max(MIN_VB_CHAR_CAP, (contextTokens - RESERVE_TOKENS) * CHARS_PER_TOKEN);
}

/** Aktueller VB-Zeichen-Cap aus der gespeicherten Kontextlänge-Einstellung. */
export function getVbCharCap(): number {
  return computeVbCharCap(getLlmContextTokens());
}
