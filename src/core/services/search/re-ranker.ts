/**
 * Optional Cross-Encoder Re-Ranker als Stage 2 nach Orama Hybrid-Suche.
 * Unterstuetzt ms-marco-MiniLM (EN) und BGE-Reranker-v2-m3 (multilingual).
 */

import type { OramaSearchResult } from './orama-store';
import { pipelineLog } from './pipeline-logger';

export interface ReRankerModelConfig {
  id: string;
  label: string;
  model: string;
  description: string;
  sizeHint: string;
}

export const RERANKER_MODELS: ReRankerModelConfig[] = [
  {
    id: 'bge-reranker-v2-m3',
    label: 'BGE-Reranker-v2-m3 (Multilingual)',
    model: 'mogolloni/bge-reranker-v2-m3-onnx',
    description: 'Multilingual (100+ Sprachen). Groesser, bessere Relevanz fuer Deutsch.',
    sizeHint: '~550 MB',
  },
  {
    id: 'ms-marco-minilm',
    label: 'ms-marco-MiniLM (Englisch)',
    model: 'Xenova/ms-marco-MiniLM-L-6-v2',
    description: 'Schnell (~500ms), nur Englisch.',
    sizeHint: '~80 MB',
  },
];

export const DEFAULT_RERANKER_ID = 'bge-reranker-v2-m3';

interface ReRankerState {
  tokenizer: any | null;
  model: any | null;
  ready: boolean;
  loading: boolean;
  error: string | null;
  currentModelId: string | null;
}

const state: ReRankerState = {
  tokenizer: null,
  model: null,
  ready: false,
  loading: false,
  error: null,
  currentModelId: null,
};

export interface ReRankerProgress {
  phase: 'loading' | 'reranking' | 'done';
  current?: number;
  total?: number;
}

export function getReRankerModelById(id: string): ReRankerModelConfig {
  return RERANKER_MODELS.find(m => m.id === id) ?? RERANKER_MODELS[0]!;
}

export async function initReRanker(
  modelId?: string,
  onProgress?: (p: ReRankerProgress) => void,
): Promise<boolean> {
  const targetId = modelId ?? DEFAULT_RERANKER_ID;
  const config = getReRankerModelById(targetId);

  console.log('[TeamFlow][ReRanker] initReRanker aufgerufen:', { targetId, model: config.model });

  // Bereits geladen mit gleichem Modell
  if (state.ready && state.currentModelId === targetId) {
    console.log('[TeamFlow][ReRanker] Bereits geladen:', targetId);
    return true;
  }
  if (state.loading) {
    console.log('[TeamFlow][ReRanker] Laden laeuft bereits, uebersprungen');
    return false;
  }

  // Anderes Modell geladen → entladen
  if (state.ready && state.currentModelId !== targetId) {
    console.log('[TeamFlow][ReRanker] Modellwechsel:', state.currentModelId, '→', targetId);
    disposeReRanker();
  }

  state.loading = true;
  onProgress?.({ phase: 'loading' });

  try {
    const { AutoTokenizer, AutoModelForSequenceClassification } = await import('@huggingface/transformers');

    console.log('[TeamFlow][ReRanker] Modell wird geladen:', config.model);
    pipelineLog.info('Re-Ranker', `Lade ${config.label} (${config.sizeHint})...`);

    state.tokenizer = await AutoTokenizer.from_pretrained(config.model);
    console.log('[TeamFlow][ReRanker] Tokenizer geladen. Typ:', typeof state.tokenizer);

    state.model = await AutoModelForSequenceClassification.from_pretrained(
      config.model,
      { dtype: 'q8' } as any,
    );
    console.log('[TeamFlow][ReRanker] Modell geladen. Typ:', typeof state.model);

    state.ready = true;
    state.loading = false;
    state.currentModelId = targetId;
    pipelineLog.info('Re-Ranker', `${config.label} bereit`);
    onProgress?.({ phase: 'done' });
    return true;
  } catch (err) {
    state.error = String(err);
    state.loading = false;
    console.error('[TeamFlow][ReRanker] Laden fehlgeschlagen:', err);
    pipelineLog.warn('Re-Ranker', `Laden fehlgeschlagen: ${err}`);
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
    console.log('[TeamFlow][ReRanker] UEBERSPRUNGEN — Grund:', !state.ready ? 'nicht bereit' : !state.tokenizer ? 'kein Tokenizer' : 'kein Modell');
    return results.slice(0, topK);
  }

  console.log('[TeamFlow][ReRanker] === RE-RANKING START ===');
  console.log('[TeamFlow][ReRanker] Modell:', state.currentModelId);
  console.log('[TeamFlow][ReRanker] Query:', query);
  console.log('[TeamFlow][ReRanker] Anzahl Passages:', results.length, '→ maxCandidates:', maxCandidates, ', topK:', topK);

  const originalOrder = results.slice(0, 5).map(r => r.source);
  console.log('[TeamFlow][ReRanker] Top-3 VOR Re-Ranking:');
  results.slice(0, 3).forEach((p, i) => {
    console.log(`  ${i + 1}. Score: ${p.score?.toFixed(4)} | ${p.source} | ${p.text?.substring(0, 80)}...`);
  });

  const candidates = results.slice(0, maxCandidates);
  const scored: Array<{ result: OramaSearchResult; rerankerScore: number }> = [];
  const t0 = performance.now();

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

      if (i < 3) {
        console.log(`[TeamFlow][ReRanker] Passage ${i + 1}: logits.data =`, Array.from(output.logits?.data ?? []).map((v: any) => Number(v).toFixed(4)), `→ score: ${Number(score).toFixed(4)}`);
      }
    } catch (err) {
      console.error(`[TeamFlow][ReRanker] Fehler bei Passage ${i + 1}:`, err);
      scored.push({ result: candidate, rerankerScore: candidate.score });
    }

    if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }

  scored.sort((a, b) => b.rerankerScore - a.rerankerScore);
  onProgress?.({ phase: 'done' });

  const elapsed = Math.round(performance.now() - t0);
  const newOrder = scored.slice(0, 5).map(s => s.result.source);
  const orderChanged = JSON.stringify(originalOrder) !== JSON.stringify(newOrder);

  console.log(`[TeamFlow][ReRanker] Re-Ranking dauerte: ${elapsed}ms`);
  console.log('[TeamFlow][ReRanker] Top-5 NACH Re-Ranking:');
  scored.slice(0, 5).forEach((s, i) => {
    console.log(`  ${i + 1}. ReRank-Score: ${Number(s.rerankerScore).toFixed(4)} | Original-Score: ${s.result.score?.toFixed(4)} | ${s.result.source} | ${s.result.text?.substring(0, 80)}...`);
  });
  console.log('[TeamFlow][ReRanker] Reihenfolge geaendert?', orderChanged);
  console.log('[TeamFlow][ReRanker] === RE-RANKING ENDE ===');

  return scored.slice(0, topK).map(s => ({
    ...s.result,
    score: s.rerankerScore,
    method: 'hybrid' as const,
  }));
}

export function isReRankerReady(): boolean {
  return state.ready;
}

export function getActiveReRankerModelId(): string | null {
  return state.currentModelId;
}

export function disposeReRanker(): void {
  if (state.model?.dispose) state.model.dispose();
  state.tokenizer = null;
  state.model = null;
  state.ready = false;
  state.currentModelId = null;
}
