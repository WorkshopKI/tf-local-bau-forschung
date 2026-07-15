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
 * Die innere Läufe-/Judge-Logik liegt seit der In-App-Panel-Erweiterung in den
 * node-freien Geschwister-Modulen `gedaechtnis-eval-runner.ts` (Orchestrierung +
 * JSONL-Zeilen-Shape) und `gedaechtnis-judge.ts` (Judge-Prompt + -Auswertung);
 * diese CLI ist nur noch der Node-Rahmen (Args, Transport-Fabriken, Console,
 * Datei-Schreiben, Exit-Codes).
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
import { laufeEineFixtureMitJudge } from './gedaechtnis-eval-runner';

interface ModelConfig { id?: string; baseUrl: string; model: string; apiKeyEnv?: string }

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
    const { zeilen: fxZeilen, aggregat } = await laufeEineFixtureMitJudge(fx, {
      n, transport: gen, judgeTransport: judge, dryRun,
    });
    for (const z of fxZeilen) zeilen.push(JSON.stringify(z));
    if (aggregat.okLaeufe < n) alleAssertionsOk = false;

    const judgeInfo = aggregat.judgeF != null
      ? ` · Judge F=${aggregat.judgeF.toFixed(2)} N=${(aggregat.judgeN ?? 0).toFixed(2)}`
      : '';
    const status = aggregat.okLaeufe === n ? '✓' : '✗';
    console.log(`  ${status} ${fx.id.padEnd(18)} Assertions ${aggregat.okLaeufe}/${n}${judgeInfo}`);
    if (aggregat.okLaeufe < n) {
      console.log(`      Verletzungen: ${aggregat.beispielVerletzung?.join(', ')}`);
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
