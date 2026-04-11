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
    id: 'bge-reranker-base',
    label: 'BGE-Reranker-Base (EN+ZH, ~266 MB)',
    model: 'onnx-community/bge-reranker-base-ONNX',
    description: 'Englisch+Chinesisch. Funktioniert, aber sehr langsam (~3 Min/Suche).',
    sizeHint: '~266 MB (q8)',
  },
  {
    id: 'bge-reranker-v2-m3',
    label: 'BGE-Reranker-v2-m3 (Multilingual, ~544 MB)',
    model: 'onnx-community/bge-reranker-v2-m3-ONNX',
    description: 'Multilingual, aber zu gross — kann den Browser-Tab zum Absturz bringen.',
    sizeHint: '~544 MB (q8)',
  },
  {
    id: 'ms-marco-minilm',
    label: 'ms-marco-MiniLM (EN, ~80 MB)',
    model: 'Xenova/ms-marco-MiniLM-L-6-v2',
    description: 'Schnell, aber nur Englisch. Kein Effekt auf deutsche Texte.',
    sizeHint: '~80 MB',
  },
];

export const DEFAULT_RERANKER_ID = 'bge-reranker-base';

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

  // Bereits geladen mit gleichem Modell
  if (state.ready && state.currentModelId === targetId) return true;
  if (state.loading) return false;

  // Anderes Modell geladen → entladen
  if (state.ready && state.currentModelId !== targetId) {
    disposeReRanker();
  }

  state.loading = true;
  onProgress?.({ phase: 'loading' });

  try {
    const { AutoTokenizer, AutoModelForSequenceClassification } = await import('@huggingface/transformers');

    pipelineLog.info('Re-Ranker', `Lade ${config.label} (${config.sizeHint})...`);

    state.tokenizer = await AutoTokenizer.from_pretrained(config.model);
    state.model = await AutoModelForSequenceClassification.from_pretrained(
      config.model,
      { dtype: 'q8' } as any,
    );

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
    return results.slice(0, topK);
  }

  if (!results.length) {
    return [];
  }

  const candidates = results.slice(0, maxCandidates);

  // Batch-Tokenisierung mit text_pair — das korrekte Format fuer Cross-Encoder
  const queries = candidates.map(() => query);
  const passages = candidates.map(c => c.text ?? '');

  let scored: Array<{ result: OramaSearchResult; rerankerScore: number }> = [];

  try {
    const inputs = await state.tokenizer(queries, {
      text_pair: passages,
      padding: true,
      truncation: true,
      max_length: 512,
    });

    const output = await state.model(inputs);
    const logits = output.logits?.data;

    if (logits) {
      for (let i = 0; i < candidates.length; i++) {
        const score = Number(logits[i] ?? 0);
        scored.push({ result: candidates[i]!, rerankerScore: score });
      }
    } else {
      console.error('[TeamFlow][ReRanker] Keine logits im Output:', Object.keys(output));
      return results.slice(0, topK);
    }
  } catch (err) {
    console.error('[TeamFlow][ReRanker] Batch-Reranking fehlgeschlagen:', err);
    // Fallback: Einzeln verarbeiten mit text_pair
    for (let i = 0; i < candidates.length; i++) {
      onProgress?.({ phase: 'reranking', current: i + 1, total: candidates.length });
      const candidate = candidates[i]!;
      try {
        const inputs = await state.tokenizer([query], {
          text_pair: [candidate.text ?? ''],
          padding: true,
          truncation: true,
          max_length: 512,
        });
        const output = await state.model(inputs);
        const score = Number(output.logits?.data?.[0] ?? 0);
        scored.push({ result: candidate, rerankerScore: score });
      } catch (innerErr) {
        console.error(`[TeamFlow][ReRanker] Fehler bei Passage ${i + 1}:`, innerErr);
        scored.push({ result: candidate, rerankerScore: candidate.score });
      }
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }
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
