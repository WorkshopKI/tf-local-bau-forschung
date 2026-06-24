/**
 * KI-Analyse (neue Single-Stage-Variante): annotiert die ÜBERGEBENEN
 * Suchtreffer mit einer per-Treffer-Begründung, statt ein eigenes Retrieval zu
 * fahren oder die Tabelle zu überschreiben.
 *
 * Datenfluss: `UnifiedSearchResult[]` (genau die Treffer, die der User sieht)
 * → Char-/Anzahl-Budget-Batches → LLM (JSON-Array `[{id, begruendung}]`) →
 * `Record<id, begruendung>`. Das Overlay legt SuchSeite per `r.id` über die
 * bestehenden Treffer (kein neuer Result-Satz, keine dynamischen Spalten).
 *
 * Bewusst KEIN React-Code — wird aus Plain-Funktionen (Hook/Pipeline) gerufen.
 * Prompt-Bausteine (`DEFAULT_BEGRUENDUNG_INSTRUCTION`, `assembleBegruendungPrompt`,
 * `buildPreviewPrompt`) sind exportiert, damit der Prompt-Dialog dieselbe
 * Assemblierung für die Vorschau nutzt (eine Quelle der Wahrheit).
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { callLLM, LLMAbortError } from '../llm-client';
import { parseLLMJson } from '../json-utils';
import defaultInstructionRaw from '../prompts/begruendung.md?raw';

/** Editierbarer Default-Anweisungstext (der User kann ihn im Dialog ändern).
 *  Der JSON-Vertrag + die Trefferliste werden separat fest umrahmt
 *  (`assembleBegruendungPrompt`), damit Edits das Parsing nicht brechen. */
export const DEFAULT_BEGRUENDUNG_INSTRUCTION = defaultInstructionRaw.trim();

const TARGET_BATCH_CHARS = 120_000; // Input-Budget pro Batch (~34K Tokens)
const MAX_ITEMS_PER_BATCH = 20;     // Output-Budget: hält die JSON-Antwort klein
const MAX_SNIPPET_CHARS = 600;      // pro Treffer harte Obergrenze
const CHARS_PER_TOKEN = 3.5;
const MAX_TOKENS = 8_000;           // Output-Headroom inkl. evtl. Reasoning

export interface BegruendungResult {
  begruendungById: Record<string, string>;
  failedBatches: number;
  totalBatches: number;
  tokensUsedEstimate: number;
}

/** Baut den Treffer-Block (eine kompakte Beschreibung pro Zeile). Die `id`
 *  ist exakt `UnifiedSearchResult.id` — sie ist der Schlüssel, den das LLM
 *  zurückgeben muss. */
export function buildResultBlock(results: ReadonlyArray<UnifiedSearchResult>): string {
  return results.map(r => buildOneBlock(r)).join('\n\n');
}

function buildOneBlock(r: UnifiedSearchResult): string {
  const typ = r.type === 'antrag' ? 'Förderantrag' : 'Dokument';
  const snippet = (r.snippet ?? '').slice(0, MAX_SNIPPET_CHARS);
  const lines = [
    `--- id: ${r.id}`,
    `Typ: ${typ}`,
    r.title && `Titel: ${r.title}`,
    r.type === 'antrag' && r.fkz && `FKZ: ${r.fkz}`,
    r.type === 'antrag' && r.programm && `Programm: ${r.programm}`,
    r.type === 'antrag' && r.antragsteller && `Antragsteller: ${r.antragsteller}`,
    r.type === 'antrag' && r.status && `Status: ${r.status}`,
    r.type === 'dokument' && r.dokumentTyp && `Dokumenttyp: ${r.dokumentTyp}`,
    snippet && `Inhalt: ${snippet}`,
  ].filter(Boolean);
  return lines.join('\n');
}

/** Assembliert den vollständigen Prompt: feste Frage-Einbettung + editierbare
 *  Anweisung + fester JSON-Vertrag + Treffer-Block. Der JSON-Vertrag steht
 *  IMMER drin, egal was der User in der Anweisung ändert. */
export function assembleBegruendungPrompt(query: string, instruction: string, block: string): string {
  return [
    `# Anfrage des Nutzers`,
    `«${query.trim()}»`,
    ``,
    `# Anweisung`,
    instruction.trim(),
    ``,
    `# Ausgabeformat (verbindlich)`,
    `Antworte AUSSCHLIESSLICH mit einem JSON-Array — ein Objekt pro Treffer, keine Markdown-Fences, kein Fließtext drumherum:`,
    `[{ "id": "<exakt die id des Treffers>", "begruendung": "<2–3 Sätze>" }]`,
    `Gib für jeden der unten gelisteten Treffer genau ein Objekt zurück und verwende die id unverändert.`,
    ``,
    `# Treffer`,
    block,
  ].join('\n');
}

/** Vorschau-Prompt für den Dialog: nutzt dieselbe Assemblierung wie der echte
 *  Lauf (über alle ausgewählten Treffer; zur Laufzeit ggf. in Batches geteilt). */
export function buildPreviewPrompt(
  query: string,
  instruction: string,
  results: ReadonlyArray<UnifiedSearchResult>,
): string {
  return assembleBegruendungPrompt(query, instruction, buildResultBlock(results));
}

function makeBatches(results: ReadonlyArray<UnifiedSearchResult>): UnifiedSearchResult[][] {
  const batches: UnifiedSearchResult[][] = [];
  let current: UnifiedSearchResult[] = [];
  let currentChars = 0;
  for (const r of results) {
    const len = buildOneBlock(r).length + 2;
    if (current.length > 0 && (current.length >= MAX_ITEMS_PER_BATCH || currentChars + len > TARGET_BATCH_CHARS)) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(r);
    currentChars += len;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function parseBegruendungResponse(raw: string): Record<string, string> | null {
  const parsed = parseLLMJson<unknown>(raw);
  if (!Array.isArray(parsed)) return null;
  const out: Record<string, string> = {};
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : null;
    const begruendung = typeof rec.begruendung === 'string' ? rec.begruendung.trim() : '';
    if (id && begruendung) out[id] = begruendung;
  }
  return out;
}

export async function stageBegruendung(opts: {
  transport: AITransport;
  query: string;
  instruction: string;
  results: ReadonlyArray<UnifiedSearchResult>;
  signal: AbortSignal;
  onBatchProgress: (current: number, total: number) => void;
  /** Wird nach jedem erfolgreichen Batch mit der bisher gesammelten Map gerufen
   *  (progressives Füllen der Begründung-Spalte). */
  onPartial?: (begruendungById: Record<string, string>) => void;
}): Promise<BegruendungResult> {
  const { transport, query, instruction, results, signal, onBatchProgress, onPartial } = opts;

  const batches = makeBatches(results);
  const begruendungById: Record<string, string> = {};
  let failedBatches = 0;
  let tokensUsedEstimate = 0;

  for (let i = 0; i < batches.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    onBatchProgress(i + 1, batches.length);
    const batch = batches[i]!;
    const prompt = assembleBegruendungPrompt(query, instruction, buildResultBlock(batch));
    tokensUsedEstimate += prompt.length / CHARS_PER_TOKEN;

    let parsed: Record<string, string> | null = null;
    let raw: string | null = null;
    try {
      raw = await callLLM(transport, prompt, query, { signal, jsonMode: true, maxTokens: MAX_TOKENS, timeoutMs: 120_000 });
      parsed = parseBegruendungResponse(raw);
    } catch (err) {
      if (err instanceof LLMAbortError) throw err;
      console.warn(`[stage-begruendung] Batch ${i + 1} Call gescheitert:`, err);
    }
    if (!parsed) {
      // 1× Retry mit explizitem Format-Hinweis.
      try {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const retryUser = `${query}\n\nAchtung: liefere NUR ein JSON-Array [{ "id", "begruendung" }], keine Markdown-Fences, kein Erklärungstext.`;
        raw = await callLLM(transport, prompt, retryUser, { signal, jsonMode: true, maxTokens: MAX_TOKENS, timeoutMs: 120_000 });
        parsed = parseBegruendungResponse(raw);
      } catch (err) {
        if (err instanceof LLMAbortError) throw err;
        console.warn(`[stage-begruendung] Batch ${i + 1} Retry gescheitert:`, err);
      }
    }
    if (parsed) {
      Object.assign(begruendungById, parsed);
      if (raw) tokensUsedEstimate += raw.length / CHARS_PER_TOKEN;
      onPartial?.({ ...begruendungById });
    } else {
      failedBatches++;
    }
  }

  return {
    begruendungById,
    failedBatches,
    totalBatches: batches.length,
    tokensUsedEstimate: Math.round(tokensUsedEstimate),
  };
}
