/**
 * I/O-Shell der Skill-Eval-Harness. Node-Kontext (nicht `file://`) — daher
 * BEWUSST aus `tsconfig.app.json` ausgeschlossen (würde sonst `tsc -b` ohne
 * `@types/node` brechen). Lauf über `vite-node` (siehe package.json `eval:skills`),
 * weil der Import-Graph (`runSkill` → `runtime-config`) die Vite-`define`-Vars
 * (`__TEAMFLOW_*__`) braucht — `vite-node` liefert sie, ein nackter Node/tsx-Lauf
 * nicht. Die testbare Logik liegt in orchestration.ts / eval-run.ts / ….
 *
 * Verantwortlich für: Flag-Parsing, Datei-IO (JSONL-Append + Resume), Transport-
 * Bau (echt oder Stub im Dry-Run), Concurrency-Pool, Judge, Report-Schreiben.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { STEP_ORDER, type StepId } from '@/plugins/antraege/gutachten/types';
import { runOneSection } from './eval-run';
import { runJudge } from './judge';
import { resolveRegistry, getWorkflowSections, resolveSkill, type SectionDef } from './registry-load';
import {
  findeUmfangKonflikte, findeVorgabenWidersprueche, clampMaxRetries,
  type SkillRegistryFile,
} from '@/core/services/skills';
import { aggregate } from './aggregate';
import { toJson, toCsv, toHtml } from './report';
import { NodeOpenAITransport } from './node-transport';
import {
  buildCombos,
  pendingCombos,
  comboKey,
  keyOfCombo,
  serializeJsonl,
  parseJsonl,
  dedupeLastByKey,
  type Combo,
} from './orchestration';
import type { EvalKontext, EvalModelConfig, EvalRunResult, JudgeResult, Fixture } from './types';
import { SEED_RELEVANZ_MAP_SKILL } from '@/core/services/skills';
import {
  computeRelevanzMap, assembleVbRelevant, vbBrauchtRelevanzMap,
  type RelevanzMapResult, type RelevanzAbschnitt,
} from '@/plugins/antraege/gutachten/relevanz-map';

/** Großzügiges VB-Budget für den Relevanz-Auszug im Eval (Node-seitig, ohne getVbCharCap). */
const EVAL_VB_BUDGET = 200_000;

type KontextArg = 'voll' | 'relevant' | 'both';

interface Args {
  fixtures: string | null;
  registry: string | null;
  models: string | null;
  judge: string | null;
  out: string;
  sections: StepId[] | null;
  limit: number | null;
  concurrency: number;
  noJudge: boolean;
  dryRun: boolean;
  kontext: KontextArg;
  /** VB-Kürzung im Judge-Prompt; `null` = `JUDGE_VB_CAP_DEFAULT` (ganze VB). */
  judgeVbCap: number | null;
  /** Bildet den beschraenkten Auto-Retry der App nach (Decke aus der Workflow-Definition). */
  autoRetry: boolean;
}

const DEFAULTS: Args = {
  fixtures: null, registry: null, models: null, judge: null,
  out: './skill-eval-out', sections: null, limit: null,
  concurrency: 1, noJudge: false, dryRun: false, kontext: 'voll',
  judgeVbCap: null,
  // Default AN, weil die App es tut: jeder ZIM-EP-Schritt trägt `autoRetry: true`.
  // Ein Lauf ohne Nachkorrektur misst den ersten Wurf, den so niemand zu sehen bekommt.
  autoRetry: true,
};

function parseArgs(argv: string[]): Args {
  const a: Args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case '--fixtures': a.fixtures = argv[++i] ?? null; break;
      case '--registry': a.registry = argv[++i] ?? null; break;
      case '--models': a.models = argv[++i] ?? null; break;
      case '--judge': a.judge = argv[++i] ?? null; break;
      case '--out': a.out = argv[++i] ?? DEFAULTS.out; break;
      case '--sections': {
        const raw = (argv[++i] ?? '').split(',').map(s => s.trim()).filter(Boolean);
        const valid = raw.filter((s): s is StepId => (STEP_ORDER as readonly string[]).includes(s));
        a.sections = valid.length > 0 ? valid : null;
        break;
      }
      case '--limit': a.limit = Number.parseInt(argv[++i] ?? '', 10) || null; break;
      case '--concurrency': a.concurrency = Math.max(1, Number.parseInt(argv[++i] ?? '1', 10) || 1); break;
      // Senkt den Judge-Kontext für billige Durchläufe. Der Default zeigt die GANZE VB —
      // ein knapper Auszug deckelt `fachliche_korrektheit` nach oben (siehe judge.ts).
      case '--judge-vb-cap': a.judgeVbCap = Math.max(1000, Number.parseInt(argv[++i] ?? '', 10) || 0) || null; break;
      case '--no-judge': a.noJudge = true; break;
      // Schaltet die Nachkorrektur ab — für den Vergleich mit Alt-Läufen, die noch
      // ohne sie entstanden sind, und um den ersten Wurf isoliert zu sehen.
      case '--no-auto-retry': a.autoRetry = false; break;
      case '--dry-run': a.dryRun = true; break;
      case '--kontext': {
        const v = (argv[++i] ?? '').trim();
        if (v !== 'voll' && v !== 'relevant' && v !== 'both') throw new Error(`--kontext erwartet voll|relevant|both, nicht „${v}"`);
        a.kontext = v;
        break;
      }
      default: throw new Error(`Unbekanntes Flag: ${flag}`);
    }
  }
  return a;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/* ----------------------------- Transport-Bau ----------------------------- */

function stubReply(modellId: string): string {
  return [
    '### Quellenanalyse', '(Dry-Run — keine echte Generierung)', '',
    '### Entwurf', '(Dry-Run)', '',
    '### Finaler Text',
    `Dry-Run-Ausgabe von ${modellId}. Synthetischer Abschnittstext zur Selbst-Verifikation der Harness.`,
  ].join('\n');
}

function makeTransport(m: EvalModelConfig, dryRun: boolean): AITransport {
  if (dryRun) {
    const reply = stubReply(m.id);
    return {
      name: `stub:${m.id}`,
      ping: async () => true,
      submitMessage: async () => reply,
      submitConversation: async () => reply,
    };
  }
  const apiKey = m.apiKeyEnv ? process.env[m.apiKeyEnv] : undefined;
  return new NodeOpenAITransport({ baseUrl: m.baseUrl, model: m.model, apiKey, name: m.id });
}

function makeJudgeTransport(j: EvalModelConfig | null, dryRun: boolean): AITransport | null {
  if (!j) return null;
  if (dryRun) {
    const reply = JSON.stringify({
      fachliche_korrektheit: 4, vollstaendigkeit: 4, sprachqualitaet: 4, regeltreue: 4,
      begruendung: 'Dry-Run-Judge.', prompt_verbesserung: 'Dry-Run: z.B. mehr Marktbezug fordern.',
    });
    return { name: 'stub:judge', ping: async () => true, submitMessage: async () => reply };
  }
  const apiKey = j.apiKeyEnv ? process.env[j.apiKeyEnv] : undefined;
  return new NodeOpenAITransport({ baseUrl: j.baseUrl, model: j.model, apiKey, name: j.id });
}

/* ----------------------------- Concurrency ------------------------------- */

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  const lanes = Math.max(1, Math.min(concurrency, items.length || 1));
  const lane = async (): Promise<void> => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx]!, idx);
    }
  };
  await Promise.all(Array.from({ length: lanes }, () => lane()));
}

/* -------------------------------- main ----------------------------------- */

/**
 * Retry-Decke eines Abschnitts — aus der WORKFLOW-Definition der Registry, nicht aus
 * einem eigenen Flag-Wert. Der Schritt entscheidet, ob und wie oft die App
 * nachkorrigiert (`autoRetry` / `maxRetries`); die Harness hat dazu keine eigene
 * Meinung, sonst misst sie einen Ablauf, den es nicht gibt. Kein Schritt gefunden ⇒ 0.
 */
function maxRetriesFuer(registry: SkillRegistryFile, abschnitt: StepId): number {
  for (const wf of registry.workflows ?? []) {
    const step = wf.steps.find(s => s.id === abschnitt);
    if (step) return step.autoRetry ? clampMaxRetries(step.maxRetries) : 0;
  }
  return 0;
}

/**
 * Hält die Prompts der zu messenden Abschnitte gegen die vorhandenen Kurator-Wächter —
 * VOR dem ersten Modell-Aufruf.
 *
 * Der Anlass: zwei Prompt-Defekte in Folge (A ohne Ausgabeformat-Block, B mit
 * Teil-Richtwerten, die sich gegen die eigene Regel summierten) kosteten je einen
 * vollständigen Messlauf, obwohl der Skill-Editor beide Male eine Warnung angezeigt
 * hätte. Die Warnung lebte nur dort, und dort sieht sie beim Messen niemand. 21 Läufe
 * gegen einen unerfüllbaren Prompt messen das Modell nicht, sondern den Prompt.
 *
 * Bewusst nur eine Meldung, kein Abbruch: ein Widerspruch kann der Gegenstand der
 * Messung sein.
 */
function meldePromptWidersprueche(sections: SectionDef[], registry: SkillRegistryFile): void {
  const zeilen: string[] = [];
  for (const s of sections) {
    const resolved = resolveSkill(registry, s.skillId);
    if (!resolved) continue;
    const befunde = [
      ...findeUmfangKonflikte(resolved.skill.promptTemplate, resolved.regeln),
      ...findeVorgabenWidersprueche(resolved.regeln),
    ];
    for (const b of befunde) zeilen.push(`  ${s.abschnitt}: ${b}`);
  }
  if (zeilen.length === 0) return;
  console.log(`\n⚠ ${zeilen.length} Prompt-Widerspruch/-Widersprüche VOR dem Lauf — der Messwert `
    + 'beschreibt dann den Prompt, nicht das Modell:');
  for (const z of zeilen) console.log(z);
  console.log('');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.fixtures || !args.models) {
    console.error('Pflicht-Flags fehlen: --fixtures <fixtures.json> --models <models.json>');
    console.error('Beispiel: npm run eval:skills -- --fixtures ./out/fixtures.json --models ./models.json --dry-run');
    process.exit(1);
  }

  const allFixtures = readJson<Fixture[]>(args.fixtures);
  const fixtures = args.limit ? allFixtures.slice(0, args.limit) : allFixtures;
  const registry = resolveRegistry(args.registry ? readJson<unknown>(args.registry) : null);
  const models = readJson<EvalModelConfig[]>(args.models);
  const judgeConfig = !args.noJudge && args.judge ? readJson<EvalModelConfig>(args.judge) : null;

  const allSections = getWorkflowSections();
  const sections = args.sections ? allSections.filter(s => args.sections!.includes(s.abschnitt)) : allSections;

  const kontexte: EvalKontext[] = args.kontext === 'both' ? ['voll', 'relevant'] : [args.kontext];
  const { combos, skippedKN } = buildCombos(fixtures, models, sections, kontexte);
  if (skippedKN.length > 0) {
    console.warn(`⚠ ${skippedKN.length} KN-Fixture(s) übersprungen (kein KN-Workflow): ${skippedKN.map(f => f.vbFile).join(', ')}`);
  }

  mkdirSync(args.out, { recursive: true });
  const resultsPath = join(args.out, 'results.jsonl');
  const judgePath = join(args.out, 'judge.jsonl');

  // Resume: erledigte (erfolgreiche) Läufe überspringen (Kontext-Achse im Key).
  const existingResults = existsSync(resultsPath) ? parseJsonl<EvalRunResult>(readFileSync(resultsPath, 'utf8')) : [];
  const doneRunKeys = new Set(
    dedupeLastByKey(existingResults, r => comboKey(r.vbFile, r.modellId, r.abschnitt, r.kontext))
      .filter(r => !r.fehler)
      .map(r => comboKey(r.vbFile, r.modellId, r.abschnitt, r.kontext)),
  );
  const existingJudges = existsSync(judgePath) ? parseJsonl<JudgeResult>(readFileSync(judgePath, 'utf8')) : [];
  const doneJudgeKeys = new Set(
    dedupeLastByKey(existingJudges, j => comboKey(j.vbFile, j.modellId, j.abschnitt, j.kontext))
      .filter(j => !j.fehler)
      .map(j => comboKey(j.vbFile, j.modellId, j.abschnitt, j.kontext)),
  );

  const pending = pendingCombos(combos, doneRunKeys);
  console.log(`Modelle: ${models.map(m => m.id).join(', ')} | Abschnitte: ${sections.map(s => s.abschnitt).join('')} | Kontext: ${kontexte.join('+')}`);
  console.log(`Kombinationen: ${combos.length} gesamt, ${doneRunKeys.size} erledigt, ${pending.length} offen.`);
  console.log(`Modus: ${args.dryRun ? 'DRY-RUN (Stub-Transport)' : 'LIVE'} | Judge: ${judgeConfig ? (args.dryRun ? 'Stub' : judgeConfig.id) : 'aus'} | Concurrency: ${args.concurrency} | Auto-Retry: ${args.autoRetry ? 'wie die App' : 'AUS'}`);
  meldePromptWidersprueche(sections, registry);

  // Transports je Modell cachen.
  const transports = new Map<string, AITransport>();
  const transportFor = (m: EvalModelConfig): AITransport => {
    let t = transports.get(m.id);
    if (!t) { t = makeTransport(m, args.dryRun); transports.set(m.id, t); }
    return t;
  };
  const judgeTransport = makeJudgeTransport(judgeConfig, args.dryRun);

  // Erreichbarkeits-Check (nicht im Dry-Run): unerreichbarer Endpunkt → sauber
  // abbrechen mit Resume-Hinweis statt endlos zu retryen.
  if (!args.dryRun && pending.length > 0) {
    const usedModels = [...new Set(pending.map(c => c.modell.id))].map(id => models.find(m => m.id === id)!);
    for (const m of usedModels) {
      const reachable = await transportFor(m).ping().catch(() => false);
      if (!reachable) {
        console.error(`✗ Endpunkt für Modell '${m.id}' (${m.baseUrl}) nicht erreichbar. Abbruch.`);
        console.error('  Endpunkt starten und denselben Befehl erneut ausführen — erledigte Läufe werden übersprungen (Resume).');
        process.exit(2);
      }
    }
    if (judgeTransport && judgeConfig) {
      const ok = await judgeTransport.ping().catch(() => false);
      if (!ok) console.warn(`⚠ Judge-Endpunkt '${judgeConfig.id}' nicht erreichbar — Judge-Bewertungen werden als Fehler vermerkt.`);
    }
  }

  // Relevanz-Auszug (nur 'relevant'-Modus): Map EINMAL pro Fixture berechnen — fixe
  // Quelle = erstes Modell → der Auszug ist über alle Modelle identisch (fairer A/B).
  // Memoisiert pro vbFile. Leerer Auszug (Dry-Run-Stub / Parse-Fehler) → Volltext.
  const relevanzMemo = new Map<string, RelevanzMapResult>();
  const relevanzAbschnitte: RelevanzAbschnitt[] = sections.map(s => ({ id: s.abschnitt, label: s.label }));
  const relevantVbFor = async (fixture: Fixture, abschnitt: StepId): Promise<string> => {
    if (!vbBrauchtRelevanzMap(fixture.vbMarkdown)) return fixture.vbMarkdown;
    let rm = relevanzMemo.get(fixture.vbFile);
    if (!rm) {
      rm = await computeRelevanzMap(transportFor(models[0]!), SEED_RELEVANZ_MAP_SKILL, fixture.vbMarkdown, relevanzAbschnitte);
      relevanzMemo.set(fixture.vbFile, rm);
    }
    return assembleVbRelevant(rm.map, rm.headings, fixture.vbMarkdown, abschnitt, EVAL_VB_BUDGET) || fixture.vbMarkdown;
  };

  let done = 0;
  await runPool(pending, args.concurrency, async (combo: Combo) => {
    const { fixture, modell, abschnitt, kontext } = combo;
    const vbMarkdown = kontext === 'relevant' ? await relevantVbFor(fixture, abschnitt) : undefined;
    const res = await runOneSection(transportFor(modell), fixture, abschnitt, registry, modell.id, {
      kontext,
      ...(vbMarkdown ? { vbMarkdown } : {}),
      ...(args.autoRetry ? { maxRetries: maxRetriesFuer(registry, abschnitt) } : {}),
    });
    appendFileSync(resultsPath, serializeJsonl(res));
    done++;
    const nachlauf = res.retryModifier?.length ? ` nach ${res.retryModifier.join('+')}` : '';
    const status = res.fehler ? `FEHLER: ${res.fehler}` : `ok (${res.checks.filter(c => c.level === 'fehler').length} Check-Fehler${nachlauf})`;
    console.log(`[${done}/${pending.length}] ${keyOfCombo(combo)} → ${status}`);

    // Judge nur bei erfolgreichem Lauf + aktivem Judge + noch nicht bewertet.
    // Der Judge erdet IMMER gegen den vollen VB (Quelle der Wahrheit), egal welcher Kontext generiert hat.
    const key = comboKey(fixture.vbFile, modell.id, abschnitt, kontext);
    if (judgeTransport && res.parsed && !res.fehler && !doneJudgeKeys.has(key)) {
      const resolved = resolveSkill(registry, res.skillId);
      const scores = await runJudge(judgeTransport, {
        vb: fixture.vbMarkdown,
        finalerText: res.parsed.finalerText,
        regeln: resolved?.regeln ?? [],
        skillBeschreibung: resolved?.skill.beschreibung ?? '',
        vbCap: args.judgeVbCap ?? undefined,
      });
      const judgeResult: JudgeResult = { vbFile: fixture.vbFile, modellId: modell.id, abschnitt, kontext, ...scores };
      appendFileSync(judgePath, serializeJsonl(judgeResult));
    }
  });

  // Finale Aggregation + Report aus dem VOLLSTÄNDIGEN (deduplizierten) Stand.
  const finalResults = dedupeLastByKey(
    existsSync(resultsPath) ? parseJsonl<EvalRunResult>(readFileSync(resultsPath, 'utf8')) : [],
    r => comboKey(r.vbFile, r.modellId, r.abschnitt, r.kontext),
  );
  const finalJudges = dedupeLastByKey(
    existsSync(judgePath) ? parseJsonl<JudgeResult>(readFileSync(judgePath, 'utf8')) : [],
    j => comboKey(j.vbFile, j.modellId, j.abschnitt, j.kontext),
  );
  const matrix = aggregate(finalResults, finalJudges);

  writeFileSync(join(args.out, 'matrix.json'), toJson(matrix, finalResults, finalJudges), 'utf8');
  writeFileSync(join(args.out, 'matrix.csv'), toCsv(matrix), 'utf8');
  writeFileSync(join(args.out, 'report.html'), toHtml(matrix, finalResults), 'utf8');

  console.log(`Fertig: ${finalResults.length} Läufe, ${finalJudges.length} Judge-Bewertungen.`);
  console.log(`  → ${join(args.out, 'matrix.json')}, matrix.csv, report.html`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
