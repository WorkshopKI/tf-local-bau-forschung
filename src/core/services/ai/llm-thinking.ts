/**
 * Thinking-/Reasoning-Schalter als Nutzer-Einstellung (per-Maschine).
 *
 * Der Bearbeiter entscheidet in den Einstellungen (KI-Assistent), ob das LLM bei
 * der Skill-Generierung „nachdenken" (Reasoning) soll. An → der Skill-Runner
 * fährt den Streaming-Pfad und erfasst den Denkprozess (siehe run-skill.ts);
 * der Text wird pro Fassung in einem aufklappbaren „Denkprozess" angezeigt.
 *
 * Persistenz: `localStorage` — per-Maschine (das LLM läuft lokal/maschinen-
 * spezifisch), synchron lesbar (fließt ohne Async-State direkt in `runSkill`)
 * und ein simpler Flag. Gleiches Muster wie [llm-context.ts].
 */

const LLM_THINKING_ENABLED_KEY = 'teamflow_llm_thinking_enabled';

/** Reasoning-Budget, wenn Thinking aktiviert ist. */
export type ThinkingBudget = 'none' | 'low' | 'medium' | 'high';
const THINKING_ON_BUDGET: ThinkingBudget = 'medium';

/** Gespeicherter Thinking-Schalter (Default: aus). */
export function getLlmThinkingEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(LLM_THINKING_ENABLED_KEY) === '1';
}

/** Thinking-Schalter persistieren. */
export function setLlmThinkingEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LLM_THINKING_ENABLED_KEY, enabled ? '1' : '0');
}

/** Abgeleitetes Reasoning-Budget aus dem Schalter (eine Quelle für die Ableitung). */
export function getLlmThinkingBudget(): ThinkingBudget {
  return getLlmThinkingEnabled() ? THINKING_ON_BUDGET : 'none';
}
