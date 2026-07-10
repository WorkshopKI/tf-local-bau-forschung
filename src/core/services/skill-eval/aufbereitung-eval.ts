/**
 * Mini-Eval für den Aspekt-Mapping-Baustein der Antrag-Aufbereitung (Paket 2).
 *
 * Bewusst schlank (an `skill-eval/cli.ts` angelehnt, aber ohne Judge/Matrix): lädt
 * fiktive Fixture-VBs, ruft den Aspekt-Baustein und misst Precision/Recall der
 * Sektion→Aspekt-Zuordnung gegen ein handkuratiertes Goldset. Kein hartes Gate in
 * Paket 2 (Feature ist dev-only) — die Zahl ist die dokumentierte Baseline, die
 * jede spätere Aktivierung jenseits dev voraussetzt.
 *
 * DSGVO: die Fixtures sind FIKTIV, der Lauf spiegelt aber den Prod-Pfad — der
 * Generierungs-Transport ist ein INTERNER OpenAI-kompatibler Endpoint (NIEMALS
 * OpenRouter für dokument-tragende Läufe). `--dry-run` nutzt einen Stub (Harness-
 * Selbsttest ohne Endpoint), `--dump` gibt nur die geparste Gliederung aus.
 *
 * Aufruf (vite-node, wegen der `__TEAMFLOW_*__`-defines):
 *   npm run eval:aufbereitung -- --dump --limit 3
 *   npm run eval:aufbereitung -- --dry-run
 *   npm run eval:aufbereitung -- --models eval/aufbereitung-models.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import { parseVbGliederung } from '@/plugins/antraege/aufbereitung/gliederung';
import {
  buildAspektePrompt, parseAspektMapping, sektionZuAspekte, PRUEF_ASPEKTE,
} from '@/plugins/antraege/aufbereitung/aspekte';
import { NodeOpenAITransport } from './node-transport';
import { metriken, fasseZusammen, type AspektMetrik, type Goldset } from './aspekte-metrik';

const DEFAULT_FIXTURES = 'src/core/services/skill-eval/fixtures/eval-fixtures.data.json';
const DEFAULT_GOLDSET = 'eval/eval-goldset-aspekte.json';

interface Fixture { vbFile: string; antragstyp: string; vbMarkdown: string }
interface ModelConfig { id?: string; baseUrl: string; model: string; apiKeyEnv?: string }

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

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

/** Stub-Transport für `--dry-run`: „LLM" gibt exakt die Goldset-Erwartung im Zeilenformat zurück. */
function stubTransport(gold: Record<string, string[]>): AITransport {
  const zeilen: string[] = [];
  const proAspekt: Record<string, string[]> = {};
  for (const [sid, aspekte] of Object.entries(gold)) for (const a of aspekte) (proAspekt[a] ??= []).push(sid);
  for (const a of PRUEF_ASPEKTE) if (proAspekt[a.id]) zeilen.push(`${a.id}: ${proAspekt[a.id]!.join(', ')}`);
  const antwort = zeilen.join('\n');
  return { submitConversation: async () => antwort } as unknown as AITransport;
}

function liveTransport(cfg: ModelConfig): AITransport {
  if (/openrouter/i.test(cfg.baseUrl)) {
    throw new Error('DSGVO: dokument-tragender Lauf über OpenRouter verboten — interner Endpoint erforderlich.');
  }
  const apiKey = cfg.apiKeyEnv ? process.env[cfg.apiKeyEnv] : undefined;
  return new NodeOpenAITransport({ baseUrl: cfg.baseUrl, model: cfg.model, apiKey, name: cfg.id ?? cfg.model });
}

function findeFixture(fixtures: Fixture[], vbFile: string): Fixture | undefined {
  return fixtures.find(f => f.vbFile === vbFile);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const fixturesPath = typeof args.fixtures === 'string' ? args.fixtures : DEFAULT_FIXTURES;
  const fixtures = readJson<Fixture[]>(fixturesPath);
  const limit = typeof args.limit === 'string' ? parseInt(args.limit, 10) : undefined;

  // --dump: geparste Gliederung der ersten N Fixtures (zum Goldset-Authoring).
  if (args.dump) {
    const n = limit ?? 3;
    for (const f of fixtures.slice(0, n)) {
      const g = parseVbGliederung(f.vbMarkdown);
      // eslint-disable-next-line no-console
      console.log(`\n=== ${f.vbFile} (${g.length} Sektionen) ===`);
      for (const s of g) {
        // eslint-disable-next-line no-console
        console.log(`  [${s.id}] E${s.ebene} ${s.nummer ? `(${s.nummer}) ` : ''}${s.titel.slice(0, 70)}`);
      }
    }
    return;
  }

  const goldsetPath = typeof args.goldset === 'string' ? args.goldset : DEFAULT_GOLDSET;
  const goldset = readJson<Goldset>(goldsetPath);
  const outDir = typeof args.out === 'string' ? args.out : './eval-out';
  const jsonlPfad = `${outDir}/aufbereitung-aspekte.jsonl`;
  if (!existsSync(dirname(jsonlPfad))) mkdirSync(dirname(jsonlPfad), { recursive: true });

  const modelCfg = typeof args.models === 'string' ? readJson<ModelConfig>(args.models) : null;

  const zeilen: string[] = [];
  const perFixture: AspektMetrik[] = [];

  for (const gf of goldset.fixtures.slice(0, limit)) {
    const fx = findeFixture(fixtures, gf.vbFile);
    if (!fx) {
      // eslint-disable-next-line no-console
      console.warn(`⚠ Fixture nicht gefunden: ${gf.vbFile} — übersprungen.`);
      continue;
    }
    const gliederung = parseVbGliederung(fx.vbMarkdown);
    const transport = args['dry-run'] ? stubTransport(gf.erwartung) : liveTransport(modelCfg!);
    const prompt = buildAspektePrompt(gliederung, fx.vbMarkdown);
    let raw = '';
    try {
      raw = transport.submitConversation
        ? await transport.submitConversation([{ role: 'user', content: prompt }], { maxTokens: 1024 })
        : await transport.submitMessage(prompt);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`✗ Lauf fehlgeschlagen (${gf.vbFile}): ${(e as Error).message}`);
      continue;
    }
    const mapping = parseAspektMapping(raw, gliederung.map(s => s.id));
    const pred = sektionZuAspekte(mapping);
    const m = metriken(gf.erwartung, pred);
    zeilen.push(JSON.stringify({ vbFile: gf.vbFile, ...m }));
    perFixture.push(m);
    // eslint-disable-next-line no-console
    console.log(`  ${gf.vbFile}: P=${m.precision.toFixed(2)} R=${m.recall.toFixed(2)} F1=${m.f1.toFixed(2)} (${m.treffer}/${m.goldPaare})`);
  }

  const zusammenfassung = fasseZusammen(perFixture);
  zeilen.push(JSON.stringify({ zusammenfassung }));
  writeFileSync(jsonlPfad, zeilen.join('\n') + '\n', 'utf8');
  // eslint-disable-next-line no-console
  console.log(`\n== Baseline (${args['dry-run'] ? 'DRY-RUN / Harness-Selbsttest' : 'LIVE intern'}) ==`);
  // eslint-disable-next-line no-console
  console.log(`  Fixtures: ${zusammenfassung.fixtures} · Makro P=${zusammenfassung.makroPrecision.toFixed(3)} R=${zusammenfassung.makroRecall.toFixed(3)} · Mikro F1=${zusammenfassung.mikroF1.toFixed(3)}`);
  // eslint-disable-next-line no-console
  console.log(`  → ${jsonlPfad}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
