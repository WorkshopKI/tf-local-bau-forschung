/**
 * Browser-Orchestrierung der Skill-Eval-GUI (dev-only). Spiegelt die Schleife der
 * Node-CLI ([cli.ts]) OHNE deren I/O (`process.env`, `NodeOpenAITransport`,
 * JSONL-Dateien): pro fiktivem Fixture EIN Abschnitt durch den Skill — je nach
 * Kontext-Achse (`voll` / `relevant` / `both`), optional bewertet durch den
 * (injizierten) Judge, am Ende `aggregate` zur Matrix.
 *
 * REINE WIEDERVERWENDUNG — `runOneSection` / `runJudge` / `aggregate` /
 * `resolveSkill` sowie die Relevanz-Map-Helfer (`computeRelevanzMap` /
 * `assembleVbRelevant`) bleiben unverändert. So bleiben In-App-Zahlen
 * byte-vergleichbar mit der CLI (gleicher Prompt, gleiche 1–5-Skala, gleiches
 * Aggregat, gleiche Relevanz-Auszüge).
 *
 * DSGVO-Hardlock: Fixtures kommen NUR aus `loadEvalFixtures()` (gebrandet); der
 * Provenienz-Guard `isFromEvalBundle` läuft VOR dem ersten Lauf. Kein Codepfad
 * bezieht hier reale Anträge. Generator = interner Bridge-Standard (gpt-oss);
 * Judge-Transport wird injiziert (intern-agentisch/Qwen ODER — nur dev, hinter
 * `isOpenRouterEnabled()` — OpenRouter). Der interne Judge-Adapter
 * (`makeAgentischerJudgeTransport`) hält die Engine unangetastet.
 *
 * Generierung + Map + Judge laufen SEQUENZIELL: der interne Streamlit-Bridge-
 * Transport spricht EIN Fenster per postMessage an — parallele Submits würden
 * sich verschränken.
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { SEED_RELEVANZ_MAP_SKILL, type SkillRegistryFile } from '@/core/services/skills';
import { STEP_ORDER, type StepId } from '@/plugins/antraege/gutachten/types';
import { stepDef } from '@/plugins/antraege/gutachten/workflow-definition';
import { starteFrischenChat } from '@/core/services/ai/chat-reset';
import { extractThinking } from '@/core/services/ai/thinking-parser';
import {
  computeRelevanzMap,
  assembleVbRelevant,
  vbBrauchtRelevanzMap,
  RELEVANZ_MAP_MIN_CHARS,
  type RelevanzAbschnitt,
  type RelevanzMapResult,
} from '@/plugins/antraege/gutachten/relevanz-map';
import { runOneSection } from './eval-run';
import { runJudge } from './judge';
import { resolveSkill } from './registry-load';
import { aggregate, type EvalMatrix } from './aggregate';
import type { EvalKontext, EvalRunResult, Fixture, JudgeResult } from './types';
import { loadEvalFixtures, isFromEvalBundle } from './fixtures/bundle';

/** Obergrenze der VB-Anzahl (Slider) — synchron zu `bundle.MAX_FIXTURES`. */
export const EVAL_MAX_ANZAHL = 25;

/** Zeichen-Budget für den zusammengesetzten Relevanz-Auszug (mirror `cli.ts` EVAL_VB_BUDGET). */
export const EVAL_VB_BUDGET = 200_000;

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

/** A/B-Kontext-Achse des Batch: `voll` (Bestand), `relevant` (nur Relevanz-Map-
 *  Sektionen) oder `both` (beide Arme nebeneinander). */
export type EvalBatchKontext = 'voll' | 'relevant' | 'both';

/**
 * Map-Transparenz je Fixture im `relevant`-Arm (Ehrlichkeits-Pflicht): wurde die
 * Relevanz-Map wirklich angewandt oder machte der Schwellen-Check / ein leerer
 * Auszug sie zum No-op (Volltext) — plus die Kontextgröße voll vs. relevant.
 */
export interface RelevanzInfo {
  vbFile: string;
  /** Zeichen des vollen VB. */
  vollChars: number;
  /** Zeichen des tatsächlich verwendeten Kontexts (Auszug oder — bei Fallback — voll). */
  relevantChars: number;
  /** True nur, wenn die Map einen nicht-leeren Auszug lieferte (kein Fallback). */
  mapAngewandt: boolean;
  /** Kurzbegründung: `angewandt` / `unter Schwelle` / `Map leer → Volltext`. */
  grund: string;
}

export interface RunEvalBatchArgs {
  /** Zu evaluierender Abschnitt A–G. */
  abschnitt: StepId;
  /** Anzahl Fixtures (1–25, wird auf den realen Bestand geklemmt). */
  anzahl: number;
  /** Geladene (gelesene) Skill-Registry — die GUI ändert sie nicht. */
  registry: SkillRegistryFile;
  /** Generierungs-Transport (intern, aus `bridge.getActiveTransport()`). */
  genTransport: AITransport;
  /** A/B-Kontext-Achse (Default `'voll'` → Bestandsverhalten byte-identisch). */
  kontext?: EvalBatchKontext;
  /** Dev-Eval-Override der Relevanz-Map-Schwelle (Default `RELEVANZ_MAP_MIN_CHARS`).
   *  NUR Eval — nie Produktion. Erlaubt, kleinere Fixtures echt durch die Map zu fahren. */
  mapSchwelle?: number;
  /** Injizierter Judge-Transport (intern-agentisch-Adapter ODER OpenRouter-DirectLLM);
   *  `null`/fehlt → Judge-aus-Pfad (nur Generierung + Checks). */
  judgeTransport?: AITransport | null;
  /** Anzeigename/ID des Judge-Modells (Report-/Ehrlichkeits-Tag; Qwen-Urteile sind
   *  nicht mit alten Sonnet-Judge-Läufen vergleichbar). */
  judgeModellId?: string | null;
  /** Fortschritt je fertigem (fixture × kontext)-Lauf. */
  onProgress?: (done: number, total: number) => void;
  /** Kooperativer Abbruch (zwischen Läufen geprüft). */
  signal?: AbortSignal;
}

export interface EvalBatchResult {
  results: EvalRunResult[];
  judges: JudgeResult[];
  matrix: EvalMatrix;
  /** Lief ein Judge in diesem Batch (Transport injiziert)? */
  judgeAktiv: boolean;
  /** Modell-Spalte der Matrix (Anzeigename des Gen-Transports). */
  modellId: string;
  /** Judge-Modell-Tag (`null` bei Judge aus). */
  judgeModellId: string | null;
  /** Map-Transparenz je Fixture (nur im `relevant`-Arm befüllt). */
  relevanzInfos: RelevanzInfo[];
}

/** Fehler bei nicht erreichbarer KI vor dem ersten Lauf (Panel zeigt klar an). */
export class GenTransportUnreachableError extends Error {
  constructor() {
    super('KI nicht erreichbar — Testlauf derzeit nicht möglich.');
    this.name = 'GenTransportUnreachableError';
  }
}

/**
 * Adapter: interner Bridge-Transport als **agentischer (Qwen) Judge**. Hält die
 * Engine (`runJudge` / `parseJudgeResult`) unangetastet — je Submit:
 *  1. frischer Chat (Pitfall #36, best-effort),
 *  2. `ziel: 'qwen35'` (Qwen3.6),
 *  3. Reasoning-Anteil (`<think>…`) vor der Rückgabe abgestreift — Qwen streamt
 *     Thinking inline; `extractThinking` ist idempotent, wenn keins da ist.
 * Der DSGVO-Schutz liegt beim Caller (`bridge.getTransportForAssistent()` wirft
 * bei externem Provider).
 */
export function makeAgentischerJudgeTransport(inner: AITransport): AITransport {
  return {
    name: inner.name,
    displayName: `${inner.displayName ?? inner.name} · qwen35`,
    ping: (opts) => inner.ping(opts),
    async submitMessage(message, systemPrompt, options) {
      await starteFrischenChat(inner, 'qwen35');
      const raw = await inner.submitMessage(message, systemPrompt, { ...options, ziel: 'qwen35' });
      return extractThinking(raw).content;
    },
  };
}

/**
 * Führt den Eval-Batch aus. Wirft nur bei (a) nicht erreichbarem Gen-Transport
 * (vor dem ersten Lauf) oder (b) Provenienz-Verletzung — ansonsten fängt jeder
 * Lauf seinen Fehler selbst (kein Batch-Kill; auch ein gescheiterter Map-Lauf
 * degradiert still zu Volltext).
 */
export async function runEvalBatch(args: RunEvalBatchArgs): Promise<EvalBatchResult> {
  const { abschnitt, registry, genTransport, judgeTransport, onProgress, signal } = args;
  const kontextArg: EvalBatchKontext = args.kontext ?? 'voll';
  const schwelle = args.mapSchwelle ?? RELEVANZ_MAP_MIN_CHARS;

  // 1) Fixtures NUR aus dem gebrandeten Bundle.
  const all = loadEvalFixtures();
  // 2) Provenienz-Guard VOR jedem Lauf — harte GUI-Grenze (auch der interne
  //    Judge-Adapter sendet Fixture-Inhalt).
  if (!isFromEvalBundle(all)) {
    throw new Error('Provenienz-Guard: Fixtures stammen nicht aus dem Eval-Bundle.');
  }
  const anzahl = Math.max(1, Math.min(args.anzahl, all.length, EVAL_MAX_ANZAHL));
  const fixtures = all.slice(0, anzahl);

  // 3) Erreichbarkeit der internen KI vorab prüfen — PASSIV (v4.19.0). In der
  //    Eval-GUI ist `genTransport` der Bridge-Transport; die Ping-Vorgabe
  //    `openIfNeeded: true` hätte hier einen KI-Tab ohne Bookmarklet geöffnet.
  //    Im CLI ist die Option wirkungslos (Node-Transport kennt kein Fenster).
  //    Das Verbinden bietet der GUI-Aufrufer an (`kiVerbindungGeprueft`).
  if (!(await genTransport.ping({ openIfNeeded: false }))) {
    throw new GenTransportUnreachableError();
  }
  // 4) Stabile Modell-Spalte + Kontext-Achse.
  const modellId = genTransport.displayName ?? genTransport.name;
  const kontexte: EvalKontext[] = kontextArg === 'both' ? ['voll', 'relevant'] : [kontextArg];

  // 5) Relevanz-Auszug (nur relevant-Arm): Map EINMAL pro Fixture über den internen
  //    Generator-Transport (gpt-oss; `runRelevanzMap` deckt den resetChat). Antragsweit
  //    über ALLE Gutachten-Abschnitte (wie Produktion), Auszug dann pro Abschnitt.
  const relevanzAbschnitte: RelevanzAbschnitt[] = STEP_ORDER.map(id => ({ id, label: stepDef(id).label }));
  const relevanzMemo = new Map<string, RelevanzMapResult>();
  const relevanzInfos: RelevanzInfo[] = [];

  const relevantVbFor = async (fixture: Fixture): Promise<string | undefined> => {
    const vollChars = fixture.vbMarkdown.length;
    if (!vbBrauchtRelevanzMap(fixture.vbMarkdown, schwelle)) {
      relevanzInfos.push({ vbFile: fixture.vbFile, vollChars, relevantChars: vollChars, mapAngewandt: false, grund: 'unter Schwelle' });
      return undefined;
    }
    let rm = relevanzMemo.get(fixture.vbFile);
    if (!rm) {
      rm = await computeRelevanzMap(genTransport, SEED_RELEVANZ_MAP_SKILL, fixture.vbMarkdown, relevanzAbschnitte);
      relevanzMemo.set(fixture.vbFile, rm);
    }
    const auszug = assembleVbRelevant(rm.map, rm.headings, fixture.vbMarkdown, abschnitt, EVAL_VB_BUDGET);
    if (auszug) {
      relevanzInfos.push({ vbFile: fixture.vbFile, vollChars, relevantChars: auszug.length, mapAngewandt: true, grund: 'angewandt' });
      return auszug;
    }
    relevanzInfos.push({ vbFile: fixture.vbFile, vollChars, relevantChars: vollChars, mapAngewandt: false, grund: 'Map leer → Volltext' });
    return undefined;
  };

  // 6) Kombinationen (fixture × kontext), sequenziell abgearbeitet.
  const combos: { fixture: Fixture; kontext: EvalKontext }[] = [];
  for (const fixture of fixtures) {
    for (const kontext of kontexte) combos.push({ fixture, kontext });
  }

  const results: EvalRunResult[] = [];
  const judges: JudgeResult[] = [];
  const total = combos.length;
  let done = 0;

  for (const { fixture, kontext } of combos) {
    if (signal?.aborted) break;

    // Im relevant-Arm den Auszug ermitteln (undefined = Volltext-Fallback).
    const vbMarkdown = kontext === 'relevant' ? await relevantVbFor(fixture) : undefined;

    // runOneSection wirft nie — Fehler landen in res.fehler.
    const res = await runOneSection(genTransport, fixture, abschnitt, registry, modellId, {
      kontext,
      ...(vbMarkdown ? { vbMarkdown } : {}),
    });
    results.push(res);

    // Judge nur bei erfolgreichem Lauf + aktivem Judge (wie cli.ts). Der Judge erdet
    // IMMER gegen den vollen VB (Quelle der Wahrheit), egal welcher Kontext generiert hat.
    if (judgeTransport && res.parsed && !res.fehler) {
      const resolved = resolveSkill(registry, res.skillId);
      const scores = await runJudge(judgeTransport, {
        vb: fixture.vbMarkdown,
        finalerText: res.parsed.finalerText,
        regeln: resolved?.regeln ?? [],
        skillBeschreibung: resolved?.skill.beschreibung ?? '',
      });
      // JudgeScores → JudgeResult: Identität des Laufs voranstellen, mit TATSÄCHLICHEM
      // Kontext (nicht mehr hart `'voll'`).
      judges.push({ vbFile: fixture.vbFile, modellId, abschnitt, kontext, ...scores });
    }

    onProgress?.(++done, total);
  }

  return {
    results,
    judges,
    matrix: aggregate(results, judges),
    judgeAktiv: !!judgeTransport,
    modellId,
    judgeModellId: judgeTransport ? (args.judgeModellId ?? null) : null,
    relevanzInfos,
  };
}
