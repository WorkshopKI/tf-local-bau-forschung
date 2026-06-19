/**
 * Reine Retry-Politik des beschränkten Auto-Retry. Bewusst getrennt von `runner.ts`
 * (dessen State-Machine explizit KEINEN Auto-Retry kennt): hier nur die
 * deterministische Abbildung Check-Konstellation → Modifier. KEINE LLM-Entscheidung,
 * kein Loop — der Loop (mit harter Decke N) lebt im Hook.
 *
 * Quelle des Richtungssignals ist `CheckResult.richtung` (von der Check-Engine
 * gesetzt) — kein Parsen von Detail-Strings.
 */
import type { CheckResult, SkillModifierKey } from '@/core/services/skills';

/**
 * Wählt den Modifier für den nächsten Auto-Retry-Versuch:
 *  - keine `fehler` ⇒ `null` (kein Retry; reine `ok`/`hinweis`).
 *  - ein `fehler` OHNE Richtung (verbotenes Muster, Pflicht-Anfang, Aufzählung …)
 *    oder widersprüchliche Richtungen (zu lang UND zu kurz) ⇒ `'neu'` (volle Neu-Generierung).
 *  - alle `fehler` `'zu_lang'` ⇒ `'kuerzer'`; alle `'zu_kurz'` ⇒ `'laenger'`.
 */
export function chooseRetryModifier(checks: CheckResult[]): SkillModifierKey | null {
  const fehler = checks.filter(c => c.level === 'fehler');
  if (fehler.length === 0) return null;
  if (fehler.some(c => !c.richtung)) return 'neu';
  const richtungen = new Set(fehler.map(c => c.richtung));
  if (richtungen.size > 1) return 'neu';
  return richtungen.has('zu_lang') ? 'kuerzer' : 'laenger';
}
