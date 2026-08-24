/**
 * Reine Retry-Politik des beschränkten Auto-Retry. Bewusst getrennt von `runner.ts`
 * (dessen State-Machine explizit KEINEN Auto-Retry kennt): hier nur die
 * deterministische Abbildung Check-Konstellation → Modifier. KEINE LLM-Entscheidung,
 * kein Loop — der Loop (mit harter Decke N) lebt im Hook.
 *
 * Quelle des Richtungssignals ist `CheckResult.richtung` (von der Check-Engine
 * gesetzt) — kein Parsen von Detail-Strings.
 */
import { regelKorrekturAnweisung } from '@/core/services/skills';
import type { CheckResult, QualitaetsRegel, SkillModifierKey } from '@/core/services/skills';

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

/**
 * Der ZIELWERT zum gewählten Modifier — „Erweitere auf mindestens 400 Wörter
 * (aktuell 321)" statt bloß „länger".
 *
 * Der Modifier trägt nur die Richtung. Gemessen (Haiku, Abschnitt C, 08/2026) schoss
 * die blinde Korrektur über: 270 → 363 Wörter bei einem Band von 300–350, also von
 * einer Verletzung in die andere. Die Zahl, die dem Modell fehlte, steht deterministisch
 * in der Regel — `regelKorrekturAnweisung` leitet sie seit Journey-Paket 3 ab und war
 * bisher nur am manuellen Korrektur-Knopf verdrahtet.
 *
 * Genommen wird der erste `fehler`-Check, dessen abgeleitete Korrektur denselben
 * Modifier verlangt wie der Lauf. Das ist die Bedingung, die zählt: bei gegenläufigen
 * Fehlern fällt `chooseRetryModifier` auf `neu`, und dann passt keine der beiden
 * Zahlen — die Funktion liefert `null`, der Lauf bleibt wie bisher.
 */
export function retryKorrekturAnweisung(
  checks: CheckResult[],
  regeln: QualitaetsRegel[],
  modifier: SkillModifierKey,
): { anweisung: string; regelId?: string } | null {
  for (const c of checks) {
    if (c.level !== 'fehler') continue;
    const regel = regeln.find(r => r.id === c.regelId);
    if (!regel) continue;
    const k = regelKorrekturAnweisung(c, regel);
    if (!k || k.modifier !== modifier) continue;
    return { anweisung: k.anweisung, ...(c.regelId ? { regelId: c.regelId } : {}) };
  }
  return null;
}
