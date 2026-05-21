/**
 * Stufe 3: Batch-Extraktion via LLM.
 *
 * Kandidaten (mit vollen `Antrag`-Records) werden in Token-Budget-gerechte
 * Batches gepackt und sequentiell ans LLM geschickt. Pro Batch erwarten wir
 * ein JSON-Array zurueck. Bei Parse-Fehler: 1× Retry mit explizitem Hinweis.
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { Antrag } from '@/core/services/csv/types';
import { buildDescriptorsText } from '@/plugins/antraege/services/descriptor-text';
import { callLLM, LLMAbortError } from '../llm-client';
import { parseLLMJson } from '../json-utils';
import { renderTemplate, PROMPT_TEMPLATES } from '../template';
import type { RetrievalCandidate } from './retrieval';

export interface ExtractionRow {
  aktenzeichen: string;
  fields: Record<string, string | number | null>;
}

export interface BatchExtractionResult {
  rows: ExtractionRow[];
  failedBatches: number;
  totalBatches: number;
  tokensUsedEstimate: number;
}

const TARGET_BATCH_CHARS = 140_000; // ~40K Tokens bei 3.5 chars/Token
const MAX_ABSTRACT_CHARS = 1000;    // pro Antrag, harte Obergrenze
const CHARS_PER_TOKEN = 3.5;

/** Liest ein Feld aus dem Antrag-Record. Falls das Feld custom ist (z.B.
 *  `projektbeschreibung_text` aus CSV), wird `[k: string]: unknown` benutzt. */
function readField(antrag: Antrag, candidates: string[]): string {
  const rec = antrag as unknown as Record<string, unknown>;
  for (const c of candidates) {
    const v = rec[c];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

function buildAntragBlock(antrag: Antrag): string {
  const fkz = antrag.aktenzeichen;
  const titel = antrag.titel ?? '';
  const verbund = readField(antrag, ['verbund_titel', 'vb_titel', 'vb titel']);
  const abstract = readField(antrag, [
    'projektbeschreibung_text', 'vb_inhalt', 'vorhaben_inhalt',
    'kurzbeschreibung', 'beschreibung', 'inhalt',
  ]).slice(0, MAX_ABSTRACT_CHARS);
  const deskriptoren = buildDescriptorsText(antrag);
  const antragsteller = antrag.antragsteller ?? '';
  const status = antrag.status ?? '';
  const datum = (antrag as unknown as { antragsdatum?: string }).antragsdatum ?? '';
  const programm = antrag.programm_id ?? '';
  const branche = antrag.branche ?? '';
  const lines = [
    `--- FKZ: ${fkz}`,
    titel && `Titel: ${titel}`,
    verbund && `Verbund: ${verbund}`,
    antragsteller && `Antragsteller: ${antragsteller}`,
    branche && `Branche: ${branche}`,
    programm && `Programm: ${programm}`,
    status && `Status: ${status}`,
    datum && `Antragsdatum: ${datum}`,
    deskriptoren && `Deskriptoren: ${deskriptoren}`,
    abstract && `Kurzbeschreibung: ${abstract}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function makeBatches(blocks: Array<{ akz: string; block: string }>): Array<Array<{ akz: string; block: string }>> {
  const batches: Array<Array<{ akz: string; block: string }>> = [];
  let current: Array<{ akz: string; block: string }> = [];
  let currentChars = 0;
  for (const entry of blocks) {
    const len = entry.block.length + 2;
    if (current.length > 0 && currentChars + len > TARGET_BATCH_CHARS) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(entry);
    currentChars += len;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function buildPrompt(originalQuery: string, gewuenschteSpalten: string[], block: string): { system: string; user: string } {
  const spaltenSchema = gewuenschteSpalten.map(s => `- \`${s}\``).join('\n');
  const system = renderTemplate(PROMPT_TEMPLATES.batchExtraction, {
    ORIGINAL_QUERY: originalQuery,
    GEWUENSCHTE_SPALTEN_SCHEMA: spaltenSchema,
    ANTRAEGE_BLOCK: block,
  });
  return { system, user: originalQuery };
}

function parseBatchResponse(raw: string): ExtractionRow[] | null {
  const parsed = parseLLMJson<unknown>(raw);
  if (!Array.isArray(parsed)) return null;
  const out: ExtractionRow[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const fkz = typeof rec.fkz === 'string' ? rec.fkz : typeof rec.aktenzeichen === 'string' ? rec.aktenzeichen : null;
    if (!fkz) continue;
    const fields: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'fkz' || k === 'aktenzeichen') continue;
      if (v === null) fields[k] = null;
      else if (typeof v === 'string' || typeof v === 'number') fields[k] = v;
      else fields[k] = JSON.stringify(v);
    }
    out.push({ aktenzeichen: fkz, fields });
  }
  return out;
}

export async function stageBatchExtraction(opts: {
  transport: AITransport;
  question: string;
  candidates: RetrievalCandidate[];
  fullAntraege: Map<string, Antrag>;
  gewuenschteSpalten: string[];
  signal: AbortSignal;
  onBatchProgress: (current: number, total: number) => void;
}): Promise<BatchExtractionResult> {
  const { transport, question, candidates, fullAntraege, gewuenschteSpalten, signal, onBatchProgress } = opts;

  // Antrags-Bloecke aufbauen — nur Kandidaten mit geladenem Full-Record.
  const blocks: Array<{ akz: string; block: string }> = [];
  for (const c of candidates) {
    const full = fullAntraege.get(c.aktenzeichen);
    if (!full) continue;
    blocks.push({ akz: c.aktenzeichen, block: buildAntragBlock(full) });
  }
  const batches = makeBatches(blocks);
  const rows: ExtractionRow[] = [];
  let failedBatches = 0;
  let tokensUsedEstimate = 0;

  for (let i = 0; i < batches.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    onBatchProgress(i + 1, batches.length);
    const batch = batches[i]!;
    const blockText = batch.map(b => b.block).join('\n\n');
    const { system, user } = buildPrompt(question, gewuenschteSpalten, blockText);
    tokensUsedEstimate += (system.length + user.length) / CHARS_PER_TOKEN;

    let raw: string | null = null;
    let parsed: ExtractionRow[] | null = null;
    try {
      raw = await callLLM(transport, system, user, { signal, jsonMode: true, maxTokens: 4000, timeoutMs: 120_000 });
      parsed = parseBatchResponse(raw);
    } catch (err) {
      if (err instanceof LLMAbortError) throw err;
      console.warn(`[stage-batch-extraction] Batch ${i + 1} Call gescheitert:`, err);
    }
    if (!parsed) {
      // 1× Retry
      try {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const retryUser = `${user}\n\nAchtung: liefere NUR ein JSON-Array, keine Markdown-Fences, kein Erklaerungstext.`;
        raw = await callLLM(transport, system, retryUser, { signal, jsonMode: true, maxTokens: 4000, timeoutMs: 120_000 });
        parsed = parseBatchResponse(raw);
      } catch (err) {
        if (err instanceof LLMAbortError) throw err;
        console.warn(`[stage-batch-extraction] Batch ${i + 1} Retry gescheitert:`, err);
      }
    }
    if (parsed) {
      rows.push(...parsed);
      if (raw) tokensUsedEstimate += raw.length / CHARS_PER_TOKEN;
    } else {
      failedBatches++;
    }
  }

  return { rows, failedBatches, totalBatches: batches.length, tokensUsedEstimate: Math.round(tokensUsedEstimate) };
}
