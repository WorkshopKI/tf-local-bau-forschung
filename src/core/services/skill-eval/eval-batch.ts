/**
 * Browser-Orchestrierung der Skill-Eval-GUI (dev-only). Spiegelt die Schleife der
 * Node-CLI ([cli.ts]) OHNE deren I/O (`process.env`, `NodeOpenAITransport`,
 * JSONL-Dateien): pro fiktivem Fixture EIN Abschnitt durch den Skill, optional
 * bewertet durch den externen Judge, am Ende `aggregate` zur Matrix.
 *
 * REINE WIEDERVERWENDUNG — `runOneSection` / `runJudge` / `aggregate` /
 * `resolveSkill` unverändert. So bleiben In-App-Zahlen byte-vergleichbar mit der
 * CLI (gleicher Prompt, gleiche 1–5-Skala, gleiches Aggregat).
 *
 * DSGVO-Hardlock: Fixtures kommen NUR aus `loadEvalFixtures()` (gebrandet); der
 * Provenienz-Guard `isFromEvalBundle` läuft VOR dem ersten Judge-Call. Kein
 * Codepfad bezieht hier reale Anträge (`listAllAntraegeListView`,
 * `findVorhabensbeschreibung`, `doc:*`).
 *
 * Generierung läuft SEQUENZIELL: der interne Streamlit-Bridge-Transport spricht
 * EIN Fenster per postMessage an — parallele Submits würden sich verschränken.
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import type { SkillRegistryFile } from '@/core/services/skills';
import type { StepId } from '@/plugins/antraege/gutachten/types';
import { isOpenRouterEnabled } from '@/config/feature-flags';
import { runOneSection } from './eval-run';
import { runJudge } from './judge';
import { resolveSkill } from './registry-load';
import { aggregate, type EvalMatrix } from './aggregate';
import type { EvalRunResult, JudgeResult } from './types';
import { loadEvalFixtures, isFromEvalBundle } from './fixtures/bundle';

/** Obergrenze der VB-Anzahl (Slider) — synchron zu `bundle.MAX_FIXTURES`. */
export const EVAL_MAX_ANZAHL = 25;

/** Dev-eval-eigene Judge-Config (eigener IDB-Key `dev-eval-judge`, NICHT der
 *  aktive `ai-provider`). Beim Streamlit-Gen-Provider hätte `ai-provider` keinen
 *  OpenRouter-Key — darum strikt getrennt. */
export interface EvalJudgeConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

/** IDB-kv-Key der geteilten Dev-Eval-OpenRouter-Config. Genutzt vom Skill-Eval-Judge
 *  UND vom OpenRouter-Generierungs-Modus der Aufbereitung-Eval (ein Key, eine Config —
 *  bewusst KEIN Rename, Bestandsdaten unter diesem Schlüssel). */
export const JUDGE_IDB_KEY = 'dev-eval-judge';

export const JUDGE_DEFAULTS: EvalJudgeConfig = {
  endpoint: 'https://openrouter.ai/api/v1',
  model: 'anthropic/claude-sonnet-4.6',
  apiKey: '',
};

export interface RunEvalBatchArgs {
  /** Zu evaluierender Abschnitt A–G. */
  abschnitt: StepId;
  /** Anzahl Fixtures (1–25, wird auf den realen Bestand geklemmt). */
  anzahl: number;
  /** Geladene (gelesene) Skill-Registry — die GUI ändert sie nicht. */
  registry: SkillRegistryFile;
  /** Generierungs-Transport (intern, aus `bridge.getActiveTransport()`). */
  genTransport: AITransport;
  /** Judge-Config oder `null` → Judge-aus-Pfad (nur Generierung + Checks). */
  judge: EvalJudgeConfig | null;
  /** Fortschritt je fertigem Fixture. */
  onProgress?: (done: number, total: number) => void;
  /** Kooperativer Abbruch (zwischen Fixtures geprüft). */
  signal?: AbortSignal;
}

export interface EvalBatchResult {
  results: EvalRunResult[];
  judges: JudgeResult[];
  matrix: EvalMatrix;
  /** Lief der Judge in diesem Batch (Config vorhanden + OpenRouter aktiv)? */
  judgeAktiv: boolean;
  /** Modell-Spalte der Matrix (Anzeigename des Gen-Transports). */
  modellId: string;
}

/** Fehler bei nicht erreichbarer KI vor dem ersten Lauf (Panel zeigt klar an). */
export class GenTransportUnreachableError extends Error {
  constructor() {
    super('KI nicht erreichbar — Testlauf derzeit nicht möglich.');
    this.name = 'GenTransportUnreachableError';
  }
}

/**
 * Führt den Eval-Batch aus. Wirft nur bei (a) nicht erreichbarem Gen-Transport
 * (vor dem ersten Lauf) oder (b) Provenienz-Verletzung — ansonsten fängt jeder
 * Fixture-Lauf seinen Fehler selbst (kein Batch-Kill).
 */
export async function runEvalBatch(args: RunEvalBatchArgs): Promise<EvalBatchResult> {
  const { abschnitt, registry, genTransport, judge, onProgress, signal } = args;

  // 1) Fixtures NUR aus dem gebrandeten Bundle.
  const all = loadEvalFixtures();
  // 2) Provenienz-Guard VOR jedem Judge-Call — harte GUI-Grenze.
  if (!isFromEvalBundle(all)) {
    throw new Error('Provenienz-Guard: Fixtures stammen nicht aus dem Eval-Bundle.');
  }
  const anzahl = Math.max(1, Math.min(args.anzahl, all.length, EVAL_MAX_ANZAHL));
  const fixtures = all.slice(0, anzahl);

  // 3) Erreichbarkeit der internen KI vorab prüfen.
  if (!(await genTransport.ping())) {
    throw new GenTransportUnreachableError();
  }
  // 4) Stabile Modell-Spalte.
  const modellId = genTransport.displayName ?? genTransport.name;

  // 5) Judge-Transport aus der dev-eval-eigenen Config (extern, fiktive Fixtures
  //    → zulässig). Aus, wenn OpenRouter gesperrt ODER kein Key.
  const judgeAktiv = !!judge && isOpenRouterEnabled() && judge.apiKey.trim() !== '';
  const judgeTransport: AITransport | null = judgeAktiv && judge
    ? new DirectLLMTransport(judge.endpoint, judge.model, judge.apiKey)
    : null;

  const results: EvalRunResult[] = [];
  const judges: JudgeResult[] = [];

  // 6) SEQUENZIELL (Streamlit-Bridge = ein Fenster). Fehler je Fixture gefangen.
  for (let i = 0; i < fixtures.length; i++) {
    if (signal?.aborted) break;
    const fixture = fixtures[i]!;

    // runOneSection wirft nie — Fehler landen in res.fehler.
    const res = await runOneSection(genTransport, fixture, abschnitt, registry, modellId);
    results.push(res);

    // Judge nur bei erfolgreichem Lauf + aktivem Judge (wie cli.ts).
    if (judgeTransport && res.parsed && !res.fehler) {
      const resolved = resolveSkill(registry, res.skillId);
      const scores = await runJudge(judgeTransport, {
        vb: fixture.vbMarkdown,
        finalerText: res.parsed.finalerText,
        regeln: resolved?.regeln ?? [],
        skillBeschreibung: resolved?.skill.beschreibung ?? '',
      });
      // JudgeScores → JudgeResult: Identität des Laufs voranstellen (cli.ts:266).
      judges.push({ vbFile: fixture.vbFile, modellId, abschnitt, kontext: 'voll', ...scores });
    }

    onProgress?.(i + 1, fixtures.length);
  }

  return { results, judges, matrix: aggregate(results, judges), judgeAktiv, modellId };
}
