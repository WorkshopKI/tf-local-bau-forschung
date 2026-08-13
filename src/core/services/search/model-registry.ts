export interface EmbeddingModelConfig {
  id: string;
  name: string;
  label: string;
  dimensions: number;
  mrlDimensions?: number;
  sizeLabel: string;
  downloadSize: string;
  strategy: 'pipeline' | 'automodel';
  dtype?: 'fp32' | 'fp16' | 'q8' | 'q4';
  pooling: 'mean' | 'cls' | 'last-token';
  normalize: boolean;
  queryPrefix: string;
  documentPrefix: string;
  description: string;
  matryoshka?: number[];
  useMRL?: boolean;
}

/**
 * Die auswählbaren Embedding-Modelle — bewusst **genau eines**.
 *
 * Das aktive Modell prägt den Suchindex, den team-weiten Auslastungs-Korpus auf
 * dem Share und die Kategorie-Centroids; ein Wechsel entwertet alle drei
 * gleichzeitig (Pitfall #19). Eine Auswahlliste stellt diese Entscheidung
 * jedem Kurator jederzeit zur Verfügung, obwohl sie längst gefallen ist —
 * darum steht hier nur noch das Modell, mit dem der Bestand gebaut ist.
 *
 * Die Erprobungs-Kandidaten (MiniLM 384d, Harrier 270M/0.6B) sind mit v4.14.0
 * entfallen; ihre Configs stehen in der Git-Historie. Ein Modell wieder
 * aufzunehmen ist ein Eintrag hier — das UI zieht nach
 * ([add-embedding-model.md](../../../../docs/agents/add-embedding-model.md)).
 */
export const EMBEDDING_MODELS: EmbeddingModelConfig[] = [
  {
    id: 'embeddinggemma-300m',
    name: 'onnx-community/embeddinggemma-300m-ONNX',
    label: 'EmbeddingGemma 300M (q8)',
    dimensions: 768,
    sizeLabel: '308M',
    downloadSize: '~200 MB (q8)',
    strategy: 'automodel',
    dtype: 'q8',
    pooling: 'mean',
    normalize: true,
    // Original (englisch): queryPrefix: 'task: search result | query: ',
    queryPrefix: 'task: Suchergebnis aus deutschen Verwaltungsdokumenten | query: ',
    documentPrefix: 'title: none | text: ',
    description: 'Google, multilingual, 100+ Sprachen. Beste Balance aus Qualitaet und Geschwindigkeit.',
    matryoshka: [768, 512, 384, 256, 128],
  },
];

export const DEFAULT_MODEL_ID = 'embeddinggemma-300m';

const IDB_MODEL_KEY = 'embedding-model-id';

export function getModelById(id: string): EmbeddingModelConfig {
  return EMBEDDING_MODELS.find(m => m.id === id) ?? EMBEDDING_MODELS[0]!;
}

/**
 * Das aktive Modell. Ein persistierter Wert, den diese Fassung nicht mehr führt
 * (etwa ein Erprobungs-Modell aus einer älteren Version), fällt still auf
 * `DEFAULT_MODEL_ID` zurück — das ist zugleich die Migration: der Indexer
 * bemerkt den Modellwechsel gegen `index-model-id` und baut neu auf.
 */
export async function getActiveModelId(
  idb: { get: <T>(key: string) => Promise<T | null> },
): Promise<string> {
  const stored = await idb.get<string>(IDB_MODEL_KEY);
  if (stored && EMBEDDING_MODELS.some(m => m.id === stored)) return stored;
  return DEFAULT_MODEL_ID;
}

export async function setActiveModelId(
  idb: { set: (key: string, value: unknown) => Promise<void> },
  modelId: string,
): Promise<void> {
  await idb.set(IDB_MODEL_KEY, modelId);
}
