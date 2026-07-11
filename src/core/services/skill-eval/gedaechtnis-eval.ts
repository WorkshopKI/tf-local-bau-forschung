/**
 * Eval-CLI für die Gedächtnis-Konsolidierung (Assistent Phase 2, Phase D).
 *
 * Ersetzt das manuelle Zwischentesten: läuft jede FIKTIVE Fixture durch die reine
 * Konsolidierungs-Pipeline und prüft (a) deterministische Assertions (Schema,
 * Grenzen, Duplikate, Guard, Szenario-Erwartungen) — das harte Gate — und (b)
 * optional einen LLM-Judge (Faktentreue/Nützlichkeit; extern zulässig, da
 * Fixtures fiktiv). n=3 pro Fixture (Varianz-Disziplin).
 *
 * DSGVO: Fixtures sind FIKTIV. Der Generierungs-Transport ist ein INTERNER
 * OpenAI-kompatibler Endpoint (kein OpenRouter für dokument-tragende Läufe —
 * gespiegelter Prod-Pfad); der Judge darf extern sein.
 *
 * Aufruf (vite-node, wegen der `__TEAMFLOW_*__`-defines):
 *   npm run eval:gedaechtnis -- --dry-run                 # Harness-Selbsttest (kein LLM)
 *   npm run eval:gedaechtnis -- --models eval/gedaechtnis-gen.json --judge eval/gedaechtnis-judge.json --n 3
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { NodeOpenAITransport } from './node-transport';
import { GEDAECHTNIS_FIXTURES } from './gedaechtnis-fixtures';
import { frischeIdFabrik, laufeFixture } from './gedaechtnis-eval-lib';
import { pruefeAssertions } from './gedaechtnis-assertions';
import type { GedaechtnisFixture } from './gedaechtnis-assertions';
import type { GedaechtnisEintrag } from '@/core/services/assistent/gedaechtnis/types';

interface ModelConfig { id?: string; baseUrl: string; model: string; apiKeyEnv?: string }
interface JudgeScore { faktentreue: number; nuetzlichkeit: number; begruendung?: string; fehler?: boolean }

/* eslint-disable no-console */

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i++; } else { out[key] = true; }
  }
  return out;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function generierungsTransport(cfg: ModelConfig): AITransport {
  if (/openrouter/i.test(cfg.baseUrl)) {
    throw new Error('DSGVO: Generierung über OpenRouter verboten — interner Endpoint erforderlich (Prod-Pfad-Spiegel).');
  }
  const apiKey = cfg.apiKeyEnv ? process.env[cfg.apiKeyEnv] : undefined;
  return new NodeOpenAITransport({ baseUrl: cfg.baseUrl, model: cfg.model, apiKey, name: cfg.id ?? cfg.model });
}

function judgeTransport(cfg: ModelConfig): AITransport {
  const apiKey = cfg.apiKeyEnv ? process.env[cfg.apiKeyEnv] : undefined;
  return new NodeOpenAITransport({ baseUrl: cfg.baseUrl, model: cfg.model, apiKey, name: cfg.id ?? cfg.model, temperature: 0 });
}

function ereignisText(fx: GedaechtnisFixture): string {
  const zeilen: string[] = [];
  fx.zyklen.forEach((z, i) => {
    if (fx.zyklen.length > 1) zeilen.push(`-- Zyklus ${i + 1} --`);
    for (const e of z.ereignisse) {
      const d = e.detail ? ' ' + Object.entries(e.detail).map(([k, v]) => `${k}=${String(v)}`).join(', ') : '';
      const ent = e.entitaet ? ` [${e.entitaet.art} ${e.entitaet.id}]` : '';
      zeilen.push(`${e.typ}${ent}${d}`);
    }
  });
  return zeilen.join('\n');
}

function buildJudgePrompt(fx: GedaechtnisFixture, active: GedaechtnisEintrag[]): string {
  const eintraege = active.length > 0
    ? active.map(e => `- (${e.block}) ${e.text}`).join('\n')
    : '(keine Einträge)';
  return [
    'Du bewertest das Ergebnis einer Gedächtnis-Konsolidierung. Gegeben sind die beobachteten',
    'Ereignisse eines Nutzers und die daraus abgeleiteten Gedächtnis-Einträge.',
    '',
    'Ereignisse:',
    ereignisText(fx),
    '',
    'Abgeleitete Einträge:',
    eintraege,
    '',
    'Bewerte auf einer Skala von 1 (schlecht) bis 5 (sehr gut):',
    '- faktentreue: Sind ALLE Einträge durch die Ereignisse gedeckt (nichts erfunden/widersprüchlich)?',
    '- nuetzlichkeit: Sind die Einträge knapp, relevant und nicht redundant?',
    '',
    'Antworte AUSSCHLIESSLICH als JSON: {"faktentreue": <1-5>, "nuetzlichkeit": <1-5>, "begruendung": "<kurz>"}',
  ].join('\n');
}

async function runJudge(transport: AITransport, prompt: string): Promise<JudgeScore> {
  try {
    const raw = await transport.submitMessage(prompt, undefined, { responseFormat: { type: 'json_object' } });
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end < 0) return { faktentreue: 0, nuetzlichkeit: 0, fehler: true };
    const obj = JSON.parse(raw.slice(start, end + 1)) as JudgeScore;
    return {
      faktentreue: Number(obj.faktentreue) || 0,
      nuetzlichkeit: Number(obj.nuetzlichkeit) || 0,
      begruendung: obj.begruendung,
    };
  } catch {
    return { faktentreue: 0, nuetzlichkeit: 0, fehler: true };
  }
}

function mittel(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = !!args['dry-run'];
  const n = typeof args.n === 'string' ? Math.max(1, parseInt(args.n, 10)) : (dryRun ? 1 : 3);
  const limit = typeof args.limit === 'string' ? parseInt(args.limit, 10) : undefined;
  const outDir = typeof args.out === 'string' ? args.out : './eval-out';
  const jsonlPfad = `${outDir}/gedaechtnis-eval.jsonl`;
  if (!existsSync(dirname(jsonlPfad))) mkdirSync(dirname(jsonlPfad), { recursive: true });

  const fixtures = GEDAECHTNIS_FIXTURES.slice(0, limit);
  // DSGVO-Provenienz-Guard: nur FIKTIVE Fixtures dürfen in einen (ggf. externen) Judge.
  const unfiktiv = fixtures.filter(f => f.fiktiv !== true);
  if (unfiktiv.length > 0) {
    console.error(`✗ Nicht-fiktive Fixture(s): ${unfiktiv.map(f => f.id).join(', ')} — Abbruch.`);
    process.exit(2);
  }

  const genCfg = typeof args.models === 'string' ? readJson<ModelConfig>(args.models) : null;
  const judgeCfg = typeof args.judge === 'string' ? readJson<ModelConfig>(args.judge) : null;
  const gen = dryRun ? null : (genCfg ? generierungsTransport(genCfg) : null);
  if (!dryRun && !gen) {
    console.error('✗ Ohne --dry-run wird --models <config> für die Generierung benötigt.');
    process.exit(2);
  }
  const judge = judgeCfg ? judgeTransport(judgeCfg) : null;

  console.log(`\n== Gedächtnis-Eval (${dryRun ? 'DRY-RUN / Harness-Selbsttest' : 'LIVE'}) · ${fixtures.length} Fixtures · n=${n} ==\n`);

  const zeilen: string[] = [];
  let alleAssertionsOk = true;

  for (const fx of fixtures) {
    const detFehlerProLauf: string[][] = [];
    const judgeScores: JudgeScore[] = [];

    for (let run = 0; run < n; run++) {
      const lauf = await laufeFixture(fx, gen, frischeIdFabrik(`${fx.id}-${run}`));
      const assertions = pruefeAssertions(fx, lauf.active, lauf.ergebnisse);
      const fehler = assertions.filter(a => !a.ok).map(a => `${a.name}(${a.detail ?? ''})`);
      detFehlerProLauf.push(fehler);
      if (fehler.length > 0) alleAssertionsOk = false;

      let judgeScore: JudgeScore | undefined;
      if (judge && !dryRun) {
        judgeScore = await runJudge(judge, buildJudgePrompt(fx, lauf.active));
        judgeScores.push(judgeScore);
      }

      zeilen.push(JSON.stringify({
        fixture: fx.id, szenario: fx.szenario, run,
        aktive: lauf.active.length,
        assertionsOk: fehler.length === 0, assertionsFehler: fehler,
        judge: judgeScore,
      }));
    }

    const okLaeufe = detFehlerProLauf.filter(f => f.length === 0).length;
    const judgeInfo = judgeScores.length > 0
      ? ` · Judge F=${mittel(judgeScores.map(s => s.faktentreue)).toFixed(2)} N=${mittel(judgeScores.map(s => s.nuetzlichkeit)).toFixed(2)}`
      : '';
    const status = okLaeufe === n ? '✓' : '✗';
    console.log(`  ${status} ${fx.id.padEnd(18)} Assertions ${okLaeufe}/${n}${judgeInfo}`);
    if (okLaeufe < n) {
      const beispiel = detFehlerProLauf.find(f => f.length > 0);
      console.log(`      Verletzungen: ${beispiel?.join(', ')}`);
    }
  }

  writeFileSync(jsonlPfad, zeilen.join('\n') + '\n', 'utf8');
  console.log(`\n  → ${jsonlPfad}`);
  console.log(`\n== Gate: deterministische Assertions ${alleAssertionsOk ? 'BESTANDEN (100 %)' : 'FEHLGESCHLAGEN'} ==\n`);
  process.exit(alleAssertionsOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
