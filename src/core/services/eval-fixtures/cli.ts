/**
 * I/O-Shell des Eval-Fixture-Generators. Node-Kontext (nicht `file://`) — daher
 * BEWUSST aus `tsconfig.app.json` ausgeschlossen (würde sonst `tsc -b` ohne
 * `@types/node` brechen). Lauf über `npx tsx` (siehe package.json + README),
 * Node ≥18 (globales `fetch`).
 *
 * Verantwortlich für: Ordner-IO, Flag-Parsing, optionaler OpenRouter-Aufruf,
 * heuristischer Fallback. Die testbare Logik liegt in fixture-build.ts/extract.ts.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { applyAkronymDedup, assembleFixture, buildStammdatenCsv, type Fixture, type TypWahl } from './fixture-build';
import { extractHeuristisch, type ExtractedContent, type ExtractFn } from './extract';

interface Args {
  in: string | null;
  out: string;
  typ: TypWahl;
  model: string;
  dryRun: boolean;
}

const DEFAULTS: Args = {
  in: null,
  out: './eval-fixtures-out',
  typ: 'auto',
  model: 'anthropic/claude-3.5-sonnet',
  dryRun: false,
};

function parseArgs(argv: string[]): Args {
  const args: Args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--in': args.in = argv[++i] ?? null; break;
      case '--out': args.out = argv[++i] ?? DEFAULTS.out; break;
      case '--typ': {
        const v = argv[++i];
        if (v === 'auto' || v === 'ep' || v === 'kn') args.typ = v;
        else throw new Error(`--typ erwartet auto|ep|kn, bekam: ${v}`);
        break;
      }
      case '--model': args.model = argv[++i] ?? DEFAULTS.model; break;
      case '--dry-run': args.dryRun = true; break;
      default: throw new Error(`Unbekanntes Flag: ${a}`);
    }
  }
  return args;
}

const SYSTEM_PROMPT =
  'Du extrahierst Stammdaten aus deutschen Förderantrags-Vorhabensbeschreibungen (ZIM). ' +
  'Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Markdown, keine Backticks, keine Erklärung.';

function buildUserPrompt(vb: string): string {
  const gekuerzt = vb.length > 24000 ? vb.slice(0, 24000) : vb;
  return [
    'Extrahiere die Stammdaten als JSON in exakt dieser Form:',
    '{ "titel": "...", "akronym": "<vorhanden, sonst plausibel erfinden, max 12 Zeichen>",',
    '  "partner": [ { "name": "<Organisation>", "teilTitel": "<oder null>" } ] }',
    '',
    'Regeln: partner[0] = Konsortialführer; jede beteiligte Organisation genau einmal; ' +
      'nur tatsächlich Beteiligte (keine bloß erwähnten Dritten); bei einer Organisation genau ein Partner.',
    '',
    'Vorhabensbeschreibung:',
    gekuerzt,
  ].join('\n');
}

/** Tolerant: ```json-Fences strippen, defensiv parsen. Wirft bei unbrauchbarem JSON. */
function parseExtracted(raw: string): ExtractedContent {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence?.[1]) s = fence[1].trim();
  const obj = JSON.parse(s) as Record<string, unknown>;

  const partnerRaw = Array.isArray(obj.partner) ? obj.partner : [];
  const partner = partnerRaw
    .map(p => (p && typeof p === 'object' ? (p as Record<string, unknown>) : null))
    .filter((p): p is Record<string, unknown> => p !== null && typeof p.name === 'string' && p.name.trim() !== '')
    .map(p => ({ name: String(p.name).trim(), teilTitel: typeof p.teilTitel === 'string' ? p.teilTitel : null }));

  const akronym = typeof obj.akronym === 'string' ? obj.akronym.trim() : '';
  if (partner.length === 0 || akronym === '') {
    throw new Error('LLM-JSON unvollständig (akronym/partner fehlen)');
  }
  return { titel: typeof obj.titel === 'string' ? obj.titel : null, akronym, partner };
}

function makeOpenRouterExtractor(model: string, apiKey: string): ExtractFn {
  return async (vb: string): Promise<ExtractedContent> => {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://teamflow.local',
        'X-Title': 'TeamFlow Eval-Fixtures',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(vb) },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('OpenRouter: keine Text-Antwort');
    return parseExtracted(content);
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in) {
    console.error('Pflicht-Flag fehlt: --in <ordner>');
    console.error('Beispiel: npx tsx src/core/services/eval-fixtures/cli.ts --in ./vbs --dry-run');
    process.exit(1);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const useLlm = !args.dryRun && !!apiKey;
  const extract: ExtractFn = useLlm
    ? makeOpenRouterExtractor(args.model, apiKey!)
    : (vb, datei) => Promise.resolve(extractHeuristisch(vb, datei));

  console.log(`Modus: ${useLlm ? `LLM (${args.model})` : 'Heuristik (offline)'}  |  Typ: ${args.typ}`);

  const dateien = readdirSync(args.in)
    .filter(f => ['.md', '.txt'].includes(extname(f).toLowerCase()))
    .sort();
  if (dateien.length === 0) {
    console.error(`Keine .md/.txt-Dateien in ${args.in}`);
    process.exit(1);
  }

  const fixtures: Fixture[] = [];
  for (const datei of dateien) {
    const vb = readFileSync(join(args.in, datei), 'utf8');
    let extracted: ExtractedContent;
    try {
      extracted = await extract(vb, datei);
    } catch (err) {
      console.warn(`  ⚠ ${datei}: Extraktion fehlgeschlagen (${(err as Error).message}) → Heuristik`);
      extracted = extractHeuristisch(vb, datei);
    }
    fixtures.push(assembleFixture(datei, vb, extracted, args.typ));
  }

  const deduped = applyAkronymDedup(fixtures);

  mkdirSync(args.out, { recursive: true });
  writeFileSync(join(args.out, 'fixtures.json'), JSON.stringify(deduped, null, 2), 'utf8');
  writeFileSync(join(args.out, 'stammdaten.csv'), buildStammdatenCsv(deduped), 'utf8');

  const ep = deduped.filter(f => f.antragstyp === 'EP').length;
  const kn = deduped.length - ep;
  console.log(`Fertig: ${deduped.length} Fixtures (${ep}× EP, ${kn}× KN) → ${args.out}/`);
  console.log('  fixtures.json + stammdaten.csv geschrieben.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
