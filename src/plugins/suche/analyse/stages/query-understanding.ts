/**
 * Stufe 1: natuerlichsprachliche Anfrage in strukturierte Filter + semantische
 * Queries + gewuenschte Ausgabe-Spalten zerlegen. Ein LLM-Call mit einem Retry.
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { Programm } from '@/core/services/csv/types';
import { callLLM } from '../llm-client';
import { parseLLMJson } from '../json-utils';
import { renderTemplate, PROMPT_TEMPLATES } from '../template';
import {
  formatAntragsSchema,
  getProgrammKatalog,
} from '../antrag-schema';

export interface QueryUnderstanding {
  strukturierteFilter: {
    zeitraum?: { von?: string; bis?: string };
    programme?: string[];
    status?: string[];
    branchen?: string[];
    foerdergeber?: string[];
  };
  semantischeQueries: string[];
  ausgabeFormat: {
    gewuenschteSpalten: string[];
    gruppierung?: string;
    sortierung?: { feld: string; richtung: 'asc' | 'desc' };
  };
}

const DEFAULT_SPALTEN = ['programm', 'foerdernehmer', 'titel', 'foerderzweck'];

function buildPrompt(question: string, programme: ReadonlyArray<Programm>): { system: string; user: string } {
  const system = renderTemplate(PROMPT_TEMPLATES.queryUnderstanding, {
    ANTRAGS_SCHEMA: formatAntragsSchema(),
    PROGRAMM_KATALOG: getProgrammKatalog(programme),
    ORIGINAL_QUERY: question,
  });
  return { system, user: question };
}

function normalize(raw: unknown, question: string): QueryUnderstanding {
  const r = raw as Partial<QueryUnderstanding> | null;
  const strukt = r?.strukturierteFilter ?? {};
  const semantische = Array.isArray(r?.semantischeQueries) && r!.semantischeQueries.length > 0
    ? r!.semantischeQueries.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [question];
  const spalten = Array.isArray(r?.ausgabeFormat?.gewuenschteSpalten) && r!.ausgabeFormat!.gewuenschteSpalten.length > 0
    ? r!.ausgabeFormat!.gewuenschteSpalten.filter((s): s is string => typeof s === 'string')
    : DEFAULT_SPALTEN;
  return {
    strukturierteFilter: strukt,
    semantischeQueries: semantische,
    ausgabeFormat: {
      gewuenschteSpalten: spalten,
      gruppierung: typeof r?.ausgabeFormat?.gruppierung === 'string' ? r.ausgabeFormat.gruppierung : undefined,
      sortierung: r?.ausgabeFormat?.sortierung,
    },
  };
}

export async function stageQueryUnderstanding(opts: {
  transport: AITransport;
  question: string;
  programme: ReadonlyArray<Programm>;
  signal: AbortSignal;
}): Promise<QueryUnderstanding> {
  const { transport, question, programme, signal } = opts;
  const { system, user } = buildPrompt(question, programme);

  // 1. Versuch
  let raw: string;
  try {
    raw = await callLLM(transport, system, user, { signal, jsonMode: true, maxTokens: 2000 });
  } catch (err) {
    if ((err as Error).name === 'LLMAbortError') throw err;
    console.warn('[stage-query-understanding] erster Call gescheitert:', err);
    return { strukturierteFilter: {}, semantischeQueries: [question], ausgabeFormat: { gewuenschteSpalten: DEFAULT_SPALTEN } };
  }
  let parsed = parseLLMJson<unknown>(raw);

  // 1× Retry mit explizitem Hinweis falls JSON kaputt
  if (!parsed) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const retryUser = `${user}\n\nAchtung: deine vorherige Antwort war kein gueltiges JSON. Antworte NUR mit dem JSON-Objekt, keine Markdown-Fences, kein Erklaerungstext.`;
      raw = await callLLM(transport, system, retryUser, { signal, jsonMode: true, maxTokens: 2000 });
      parsed = parseLLMJson<unknown>(raw);
    } catch (err) {
      if ((err as Error).name === 'LLMAbortError') throw err;
      console.warn('[stage-query-understanding] Retry gescheitert:', err);
    }
  }

  if (!parsed) {
    // Fallback: behalte die Original-Frage als einzige Query.
    return { strukturierteFilter: {}, semantischeQueries: [question], ausgabeFormat: { gewuenschteSpalten: DEFAULT_SPALTEN } };
  }
  return normalize(parsed, question);
}
