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

import type { BridgeZiel } from './transports/streamlit';

const LLM_CONTEXT_TOKENS_KEY = 'teamflow_llm_context_tokens';
const LLM_CONTEXT_DETECTED_KEY = 'teamflow_llm_context_detected';

/** Default-Voreinstellung, falls weder manuell gesetzt noch vom Server erkannt
 *  (entspricht der internen llama.cpp-Qwen-Konfiguration, `kontext_groesse` 81920). */
export const DEFAULT_LLM_CONTEXT_TOKENS = 81_920;

/**
 * Kontextfenster der beiden Streamlit-Tabs — **fest verdrahtet, weil nicht
 * erkennbar**: „Standard" (gpt-oss) und „Agentisch" (Qwen) laufen serverseitig in
 * einer fremden App, die kein `/props` anbietet. Die Auto-Erkennung greift nur
 * beim lokalen llama.cpp; über die Bridge galt bisher ersatzweise der
 * llama.cpp-Default (81.920) — für den agentischen Tab viel zu klein, für den
 * Standard-Tab zu gross.
 *
 * Ändern sich die Tabs serverseitig, sind diese beiden Zahlen die einzige Stelle
 * für die Rechnung — die Anzeigetexte „(Qwen, 260k)" in den Eval-Panels
 * (`eval-panel/report.ts`, `AufbereitungEvalPanel.tsx`, `GedaechtnisEvalPanel.tsx`)
 * sind Prosa und müssen dann mitgezogen werden.
 */
export const BRIDGE_STANDARD_CONTEXT_TOKENS = 62_000;
export const BRIDGE_AGENTISCH_CONTEXT_TOKENS = 260_000;
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

/**
 * Wo der Lauf hingeht — entscheidet, welches Kontextfenster gilt.
 *
 * Über die Bridge ist der Wert **pro Tab fest**, weil serverseitig und nicht
 * abfragbar; lokal (llama.cpp/Cloud) gilt weiter manuell > erkannt > Default.
 * Ohne Angabe bleibt es beim bisherigen lokalen Verhalten — bestehende Aufrufer
 * ändern sich dadurch nicht.
 */
export interface KontextZiel {
  /** true = Streamlit-Bridge ist der aktive Provider. */
  bridge?: boolean;
  /** Gewählter Bridge-Tab; `undefined` zählt wie `'standard'`. */
  ziel?: BridgeZiel;
}

/**
 * Wirksame LLM-Kontextlänge (Tokens).
 *
 * Präzedenz: **manuell** > bridge-spezifisch > erkannt > Default. Die manuelle
 * Übersteuerung gewinnt auch über die Bridge-Werte — wer sie gesetzt hat, weiss,
 * was er tut, und soll sie nicht stillschweigend überschrieben bekommen.
 */
export function getLlmContextTokens(ziel?: KontextZiel): number {
  const manuell = readClampedTokens(LLM_CONTEXT_TOKENS_KEY);
  if (manuell !== null) return manuell;
  if (ziel?.bridge === true) {
    return ziel.ziel === 'agentisch'
      ? BRIDGE_AGENTISCH_CONTEXT_TOKENS
      : BRIDGE_STANDARD_CONTEXT_TOKENS;
  }
  return readClampedTokens(LLM_CONTEXT_DETECTED_KEY) ?? DEFAULT_LLM_CONTEXT_TOKENS;
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

/**
 * Aktueller VB-Zeichen-Cap. Ohne `ziel` gilt das lokale Kontextfenster
 * (manuell > erkannt > Default) — genau wie bisher.
 */
export function getVbCharCap(ziel?: KontextZiel): number {
  return computeVbCharCap(getLlmContextTokens(ziel));
}
