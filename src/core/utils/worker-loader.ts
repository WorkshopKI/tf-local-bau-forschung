import InlineEmbeddingWorker from '../../workers/embedding.worker?worker&inline';

/**
 * Loads the embedding worker.
 * 1. Try external file (embedding-worker.js next to index.html) — deploy mode
 * 2. Fall back to inline worker (bundled in single-file build)
 */
export async function loadEmbeddingWorker(): Promise<Worker> {
  // Try external file first (smaller memory footprint, swappable models)
  try {
    const res = await fetch('./embedding-worker.js');
    if (res.ok) {
      const text = await res.text();
      const blob = new Blob([text], { type: 'application/javascript' });
      return new Worker(URL.createObjectURL(blob));
    }
  } catch {
    // External file not available — fall back to inline
  }

  // Fall back to inline worker (always available in single-file build)
  return new InlineEmbeddingWorker();
}
