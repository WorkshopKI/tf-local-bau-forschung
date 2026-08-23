/**
 * Embed-Wrapper — duenne Schicht ueber dem `embeddingService`-Singleton
 * aus dem Such-Stack. Stellt eine ergonomische API fuer alle Konsumenten
 * (Auslastungs-Matching, Antraege-Hybrid-Suche) bereit.
 *
 * Wichtig: KEIN zweites Modell laden. Wenn `embeddingService` noch nicht
 * initialisiert ist (z.B. weil das Such-Plugin noch nie geoeffnet wurde),
 * wird es lazy mit dem aktiv konfigurierten Modell aus der Model-Registry
 * geladen.
 *
 * Public API:
 *  - `ensureEmbeddingReady(idb, onProgress?)` — laedt das Modell falls noetig
 *  - `embedText(text, mode)` — single embedding, L2-normalisiert
 *  - `cosineSimilarity(a, b)` — beide normalisiert -> Dot-Product
 *  - `meanCentroid(vectors)` — Mittelwert + L2-Normalisierung
 *  - `getCurrentEmbeddingConfig()` — aktiv geladenes Modell (Debugging)
 */
import {
  embeddingService,
  type EmbeddingProgress,
} from '@/core/services/search/embedding-service';
import {
  getActiveModelId,
  getModelById,
  type EmbeddingModelConfig,
} from '@/core/services/search/model-registry';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { ladeGeraetPraeferenz, type EmbeddingGeraet } from './geraet';

let currentConfig: EmbeddingModelConfig | null = null;
let initPromise: Promise<EmbeddingModelConfig> | null = null;

/** Steht eine brauchbare Grafikkarte bereit? */
async function grafikkarteVerfuegbar(): Promise<boolean> {
  if (!('gpu' in navigator)) return false;
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (!gpu) return false;
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

/**
 * Stellt sicher dass der embeddingService initialisiert ist. Wenn er
 * bereits ready ist, gibt die aktive Config zurueck. Sonst laedt das
 * Modell (idempotent via `embeddingService.init`).
 *
 * GPU/WASM-Auswahl: WebGPU wenn verfuegbar, sonst WASM — **es sei denn**,
 * dieser Rechner hat sich seine Grafikkarte schon einmal zerlegt
 * ([geraet.ts](./geraet.ts)). Dann rechnet der Hauptprozessor, bis der Nutzer
 * es wieder mit der Grafikkarte versuchen will. Die Festlegung gilt fuer den
 * ganzen Such-Stack, nicht nur fuer den Korpus-Bau: ein Rechner hat EIN
 * Rechenwerk, und zwei Meinungen darueber waeren eine Fehlerquelle mehr.
 */
export async function ensureEmbeddingReady(
  idb: IDBStore,
  onProgress?: (p: EmbeddingProgress) => void,
): Promise<EmbeddingModelConfig> {
  if (currentConfig && embeddingService.isReady()) {
    // Bereit — aber auf dem richtigen Rechenwerk? Die Festlegung kann nach dem
    // Laden entstanden sein (ein Bau, der mitten drin gewechselt hat, oder eine
    // fruehere Sitzung). Nur diese eine Richtung erzwingt einen Neuladelauf;
    // „lieber Grafikkarte" wird nie erzwungen.
    const p = await ladeGeraetPraeferenz(idb);
    if (p?.geraet === 'wasm' && embeddingService.getDevice() === 'webgpu') {
      return ladeEmbeddingNeu(idb, 'wasm', onProgress);
    }
    return currentConfig;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const modelId = await getActiveModelId(idb);
    const config = getModelById(modelId);
    const praeferenz = await ladeGeraetPraeferenz(idb);
    const preferGPU = praeferenz?.geraet === 'wasm' ? false : await grafikkarteVerfuegbar();
    await embeddingService.init(config, preferGPU, onProgress);
    currentConfig = config;
    return config;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

/**
 * Laedt das Modell auf dem genannten Rechenwerk NEU — der Kern der Erholung
 * nach einem Geraeteverlust.
 *
 * `destroy()` zuerst, sonst haelt `init` das bereits geladene Modell fuer
 * ausreichend und kehrt sofort zurueck. Der verlorene WebGPU-Kontext bleibt
 * dabei liegen; einen neuen bekommt erst die naechste Session.
 */
export async function ladeEmbeddingNeu(
  idb: IDBStore,
  geraet: EmbeddingGeraet,
  onProgress?: (p: EmbeddingProgress) => void,
): Promise<EmbeddingModelConfig> {
  const modelId = await getActiveModelId(idb);
  const config = getModelById(modelId);
  embeddingService.destroy();
  currentConfig = null;
  await embeddingService.init(config, geraet === 'webgpu', onProgress);
  currentConfig = config;
  return config;
}

/** Worauf gerade gerechnet wird — `null`, solange kein Modell geladen ist. */
export function aktivesEmbeddingGeraet(): EmbeddingGeraet | null {
  return embeddingService.getDevice();
}

/** Embed-Single mit dem aktiven Modell. `ensureEmbeddingReady` MUSS vorher gelaufen sein. */
export async function embedText(
  text: string,
  mode: 'query' | 'document' = 'query',
): Promise<number[]> {
  if (!currentConfig) {
    throw new Error('embedding-corpus/wrapper: ensureEmbeddingReady() muss vor embedText() laufen');
  }
  return embeddingService.embedSingle(text, currentConfig, mode);
}

/**
 * Cosine-Similarity zwischen zwei Embedding-Vektoren.
 * Annahme: beide L2-normalisiert (was embeddingService standardmaessig macht).
 * -> Dot-Product reicht.
 */
export function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] as number) * (b[i] as number);
  }
  return dot;
}

/** Mittelwert-Centroid einer Liste von Embeddings + L2-Normalisierung. */
export function meanCentroid(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const dim = vectors[0]!.length;
  const sum = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i]! += v[i]!;
  }
  for (let i = 0; i < dim; i++) sum[i]! /= vectors.length;
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += sum[i]! * sum[i]!;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) sum[i]! /= norm;
  }
  return sum;
}

/** Liefert das aktuell geladene Modell — Dimensions-Check, Debugging. */
export function getCurrentEmbeddingConfig(): EmbeddingModelConfig | null {
  return currentConfig;
}
