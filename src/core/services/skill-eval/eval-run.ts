/**
 * Orchestriert EINEN Eval-Lauf: ein Fixture × ein Abschnitt × ein (injizierter)
 * Transport. Reine Wiederverwendung des Produktions-Pfads — `buildStammdaten`
 * (gleiche Stammdaten-Form wie im Kurzfassungs-Skill), `runSkill` (Prompt-Bau +
 * Transport), `runRegelChecks` (deterministische Qualitäts-Checks). KEIN
 * Reimplementieren → kein Drift zur Produktion.
 *
 * Fehler im Transport (Netz, HTTP-Status) werden GEFANGEN und landen in
 * `EvalRunResult.fehler` — der Batch-Lauf darf an einem einzelnen Fehler nicht
 * sterben (Muster wie gutachten-batch/runner.ts).
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { runSkill, runRegelChecks, type SkillRunInput, type SkillRegistryFile } from '@/core/services/skills';
import { buildStammdaten } from '@/plugins/antraege/gutachten/skill-context';
import { stepDef } from '@/plugins/antraege/gutachten/workflow-definition';
import type { StepId } from '@/plugins/antraege/gutachten/types';
import { resolveSkill } from './registry-load';
import type { EvalKontext, EvalRunResult, Fixture } from './types';

/** Millisekunden seit `start`, gerundet. */
function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}

/** Optionen für `runOneSection` — Kontext-Variante + (im `relevant`-Modus) der VB-Auszug. */
export interface RunSectionOpts {
  /** A/B-Kontext-Variante (default `'voll'`). Nur als Tag im Ergebnis. */
  kontext?: EvalKontext;
  /** Ersetzt `fixture.vbMarkdown` im Prompt (im `relevant`-Modus der Relevanz-Auszug). */
  vbMarkdown?: string;
}

/**
 * Führt einen Abschnitt eines Fixtures durch den Skill und prüft die Ausgabe.
 * Wirft NICHT — jeder Fehlerpfad liefert ein `EvalRunResult` mit `fehler`.
 * `opts.vbMarkdown` ersetzt den VB im Prompt (Relevanz-Auszug); `opts.kontext`
 * taggt die Zeile (A/B-Achse).
 */
export async function runOneSection(
  transport: AITransport,
  fixture: Fixture,
  abschnitt: StepId,
  registry: SkillRegistryFile,
  modellId: string,
  opts: RunSectionOpts = {},
): Promise<EvalRunResult> {
  const start = performance.now();
  const skillId = stepDef(abschnitt).skillId;
  const kontext: EvalKontext = opts.kontext ?? 'voll';
  const base = { vbFile: fixture.vbFile, modellId, abschnitt, skillId, kontext } as const;

  const resolved = resolveSkill(registry, skillId);
  if (!resolved) {
    return {
      ...base,
      raw: '',
      parsed: null,
      checks: [],
      fehler: `Skill '${skillId}' nicht in der Registry`,
      dauerMs: elapsed(start),
    };
  }

  try {
    const input: SkillRunInput = {
      stammdaten: buildStammdaten(fixture.context),
      vbMarkdown: opts.vbMarkdown ?? fixture.vbMarkdown,
      // Reasoning-Modelle (gpt-oss = default medium) brauchen den +8192-Headroom in run-skill,
      // sonst frisst das Reasoning das gemeinsame max_tokens-Budget und der Antworttext
      // wird mitten im Satz abgeschnitten. Der Wert wird vom NodeOpenAITransport ignoriert
      // (nur maxTokens zaehlt); er triggert hier ausschliesslich den Headroom.
      thinkingBudget: 'medium',
    };
    const result = await runSkill(transport, resolved.skill, resolved.regeln, input);
    const checks = runRegelChecks(result.parsed.finalerText, resolved.regeln);
    return {
      ...base,
      raw: result.raw,
      parsed: result.parsed,
      checks,
      dauerMs: elapsed(start),
    };
  } catch (err) {
    return {
      ...base,
      raw: '',
      parsed: null,
      checks: [],
      fehler: err instanceof Error ? err.message : String(err),
      dauerMs: elapsed(start),
    };
  }
}
