/**
 * Optional Cross-Encoder Re-Ranker als Stage 2 nach Orama Hybrid-Suche.
 * Nutzt ms-marco-MiniLM-L-6-v2 (quantisiert, ~40MB) via Transformers.js.
 */

import type { OramaSearchResult } from './orama-store';

const RERANKER_MODEL = 'cross-encoder/ms-marco-MiniLM-L-6-v2';

interface ReRankerState {
  tokenizer: any | null;
  model: any | null;
  ready: boolean;
  loading: boolean;
  error: string | null;
}

const state: ReRankerState = {
  tokenizer: null,
  model: null,
  ready: false,
  loading: false,
  error: null,
};

export interface ReRankerProgress {
  phase: 'loading' | 'reranking' | 'done';
  current?: number;
  total?: number;
}

export async function initReRanker(
  onProgress?: (p: ReRankerProgress) => void,
): Promise<boolean> {
  if (state.ready) return true;
  if (state.loading) return false;

  state.loading = true;
  onProgress?.({ phase: 'loading' });

  try {
    const { AutoTokenizer, AutoModelForSequenceClassification } = await import('@huggingface/transformers');

    state.tokenizer = await AutoTokenizer.from_pretrained(RERANKER_MODEL);
    state.model = await AutoModelForSequenceClassification.from_pretrained(
      RERANKER_MODEL,
      { dtype: 'q8' } as any,
    );

    state.ready = true;
    state.loading = false;
    onProgress?.({ phase: 'done' });
    return true;
  } catch (err) {
    state.error = String(err);
    state.loading = false;
    console.warn('Re-Ranker konnte nicht geladen werden:', err);
    return false;
  }
}

export async function rerank(
  query: string,
  results: OramaSearchResult[],
  maxCandidates = 15,
  topK = 5,
  onProgress?: (p: ReRankerProgress) => void,
): Promise<OramaSearchResult[]> {
  if (!state.ready || !state.tokenizer || !state.model) {
    return results.slice(0, topK);
  }

  const candidates = results.slice(0, maxCandidates);
  const scored: Array<{ result: OramaSearchResult; rerankerScore: number }> = [];

  for (let i = 0; i < candidates.length; i++) {
    onProgress?.({ phase: 'reranking', current: i + 1, total: candidates.length });

    const candidate = candidates[i]!;
    try {
      const inputs = await state.tokenizer(query, candidate.text, {
        padding: true,
        truncation: true,
        max_length: 512,
      });
      const output = await state.model(inputs);
      const score = output.logits?.data?.[0] ?? 0;
      scored.push({ result: candidate, rerankerScore: score });
    } catch {
      scored.push({ result: candidate, rerankerScore: candidate.score });
    }

    if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }

  scored.sort((a, b) => b.rerankerScore - a.rerankerScore);
  onProgress?.({ phase: 'done' });

  return scored.slice(0, topK).map(s => ({
    ...s.result,
    score: s.rerankerScore,
    method: 'hybrid' as const,
  }));
}

export function isReRankerReady(): boolean {
  return state.ready;
}

export function disposeReRanker(): void {
  if (state.model?.dispose) state.model.dispose();
  state.tokenizer = null;
  state.model = null;
  state.ready = false;
}
