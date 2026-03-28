/**
 * Loads the embedding worker.
 * - Deploy mode (VITE_EMBED_MODE=external): fetch embedding-worker.js
 * - Single mode (VITE_EMBED_MODE=inline): use ?worker&inline import
 */
export async function loadEmbeddingWorker(): Promise<Worker> {
  const mode = import.meta.env.VITE_EMBED_MODE as string | undefined;

  if (mode === 'inline') {
    // Single-file build: worker is inlined
    const mod = await import('../../workers/embedding.worker?worker&inline');
    const WorkerClass = mod.default as { new (): Worker };
    return new WorkerClass();
  }

  // Deploy/dev mode: load from external file
  try {
    const res = await fetch('./embedding-worker.js');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const blob = new Blob([text], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  } catch {
    throw new Error(
      'embedding-worker.js nicht gefunden. Bitte die Datei neben index.html im gleichen Verzeichnis ablegen.',
    );
  }
}
