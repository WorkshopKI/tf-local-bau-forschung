/**
 * Stufe 5: Validation. Ein einzelner LLM-Call mit einer Stichprobe der
 * Ergebnisse + Statistik. Bei Fehler: silent fail (null returnen, Caller
 * zeigt keinen Banner).
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { callLLM, LLMAbortError } from '../llm-client';
import { parseLLMJson } from '../json-utils';
import { renderTemplate, PROMPT_TEMPLATES } from '../template';

export interface ValidationResult {
  vollstaendig: boolean;
  konfidenz: 'hoch' | 'mittel' | 'niedrig';
  warnungen: string[];
  zusammenfassung: string;
}

const SAMPLE_SIZE = 20;

function buildSample(results: UnifiedSearchResult[]): string {
  return results.slice(0, SAMPLE_SIZE).map(r => {
    const lines = [
      `FKZ: ${r.fkz ?? r.id}`,
      r.programm && `Programm: ${r.programm}`,
      r.antragsteller && `Antragsteller: ${r.antragsteller}`,
      r.status && `Status: ${r.status}`,
      r.title && `Titel: ${r.title}`,
      r.snippet && `Kurz: ${r.snippet}`,
    ].filter(Boolean);
    return lines.join('\n');
  }).join('\n---\n');
}

function buildProgrammeList(results: UnifiedSearchResult[]): string {
  const set = new Set<string>();
  for (const r of results) if (r.programm) set.add(r.programm);
  return set.size > 0 ? Array.from(set).join(', ') : '(keine)';
}

function buildZeitraum(results: UnifiedSearchResult[]): string {
  const dates = results.map(r => r.antragsdatum).filter((d): d is string => !!d).sort();
  if (dates.length === 0) return '(unbekannt)';
  return `${dates[0]} bis ${dates[dates.length - 1]}`;
}

export async function stageValidation(opts: {
  transport: AITransport;
  question: string;
  results: UnifiedSearchResult[];
  signal: AbortSignal;
}): Promise<ValidationResult | null> {
  const { transport, question, results, signal } = opts;
  if (results.length === 0) {
    return {
      vollstaendig: false,
      konfidenz: 'niedrig',
      warnungen: ['Keine Treffer fuer die Anfrage.'],
      zusammenfassung: 'Die Anfrage lieferte keine Antraege im aktuellen Datenbestand.',
    };
  }
  const system = renderTemplate(PROMPT_TEMPLATES.validation, {
    ORIGINAL_QUERY: question,
    RESULT_COUNT: String(results.length),
    PROGRAMME_LIST: buildProgrammeList(results),
    ZEITRAUM: buildZeitraum(results),
    MISSING_FIELDS_INFO: '',
    SAMPLE_RESULTS: buildSample(results),
  });

  try {
    const raw = await callLLM(transport, system, question, { signal, jsonMode: true, maxTokens: 1000, timeoutMs: 30_000 });
    const parsed = parseLLMJson<Partial<ValidationResult>>(raw);
    if (!parsed) return null;
    return {
      vollstaendig: typeof parsed.vollstaendig === 'boolean' ? parsed.vollstaendig : true,
      konfidenz: parsed.konfidenz === 'hoch' || parsed.konfidenz === 'mittel' || parsed.konfidenz === 'niedrig'
        ? parsed.konfidenz : 'mittel',
      warnungen: Array.isArray(parsed.warnungen)
        ? parsed.warnungen.filter((s: unknown): s is string => typeof s === 'string')
        : [],
      zusammenfassung: typeof parsed.zusammenfassung === 'string' ? parsed.zusammenfassung : `${results.length} Antraege gefunden.`,
    };
  } catch (err) {
    if (err instanceof LLMAbortError) throw err;
    console.warn('[stage-validation] silent fail:', err);
    return null;
  }
}
