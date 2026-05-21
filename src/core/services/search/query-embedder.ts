import { embeddingService } from './embedding-service';
import type { EmbeddingModelConfig } from './model-registry';

/**
 * LRU-Cache fuer Query-Embeddings. Eine 768d-Embedding kostet ~50–200 ms im
 * Main-Thread; durch das Cachen sparen wir das bei jeder Wiederholung
 * (Backspace + Re-Type, identische Query in zwei Sessions, etc.).
 *
 * Konfiguration: max. 32 Eintraege, FIFO (oldest evicted). Key kombiniert
 * Query-Text + Modell-ID + Mode — wenn der Kurator das Modell wechselt
 * (siehe ActionCardModels.tsx), liefern alte Cache-Eintraege ggf. falsche
 * Dimensionen; deshalb invalidieren wir den Cache zusaetzlich
 * via `clearQueryEmbeddingCache()` (wird beim Modell-Wechsel aufgerufen).
 */
const MAX_CACHE_ENTRIES = 32;
const cache = new Map<string, number[]>();

function cacheKey(text: string, configId: string, mode: 'query' | 'document'): string {
  return `${configId}${mode}${text}`;
}

/** Cache-aware Query-Embedding. Bei Treffer in <1 ms zurueck, sonst delegiert
 *  an `embeddingService.embedSingle()` und merkt sich das Ergebnis. */
export async function embedQueryCached(
  text: string,
  config: EmbeddingModelConfig,
  mode: 'query' | 'document' = 'query',
): Promise<number[]> {
  const key = cacheKey(text, config.id, mode);
  const hit = cache.get(key);
  if (hit) {
    // FIFO-Refresh: hit nach hinten verschieben, damit es bei naechster
    // Eviction nicht zuerst geloescht wird (LRU-naehe).
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const vec = await embeddingService.embedSingle(text, config, mode);
  cache.set(key, vec);
  if (cache.size > MAX_CACHE_ENTRIES) {
    // Aelteste Entries entfernen (Map iteriert Insertion-Order).
    const overflow = cache.size - MAX_CACHE_ENTRIES;
    let i = 0;
    for (const k of cache.keys()) {
      if (i++ >= overflow) break;
      cache.delete(k);
    }
  }
  return vec;
}

/** Cache invalidieren — z.B. nach Modell-Wechsel oder Test-Reset. */
export function clearQueryEmbeddingCache(): void {
  cache.clear();
}

export class QueryEmbedder {
  private modelConfig: EmbeddingModelConfig | null = null;

  async init(modelConfig: EmbeddingModelConfig, preferGPU = false): Promise<void> {
    this.modelConfig = modelConfig;
    await embeddingService.init(modelConfig, preferGPU);
  }

  isReady(): boolean {
    return embeddingService.isReady();
  }

  isLoading(): boolean {
    return embeddingService.isLoading();
  }

  async embed(query: string): Promise<number[]> {
    if (!this.modelConfig) throw new Error('Not initialized');
    return embedQueryCached(query, this.modelConfig, 'query');
  }

  destroy(): void {
    // Singleton wird nicht zerstoert — andere Consumer koennten ihn noch nutzen
  }
}
