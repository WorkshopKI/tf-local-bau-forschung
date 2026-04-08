# Claude Code Prompt: Embedding-Modell konfigurierbar machen

## Ziel

Dropdown im Admin-Panel zum Wechseln des Embedding-Modells. Zwei Modelle:
1. **Xenova/all-MiniLM-L6-v2** (aktuell, 22M, 384d) — Baseline
2. **onnx-community/embeddinggemma-300m-ONNX** (308M, 768d) — Upgrade-Option

Nach Modellwechsel: automatisch Index invalidieren, Nutzer zur Neu-Indexierung auffordern. Eval-Ergebnisse speichern den Modellnamen für Vergleiche.

## Architektur-Überblick

```
model-registry.ts          ← NEU: Modell-Definitionen + aktives Modell aus IDB
embedding-service.ts       ← REFACTOR: Modellwechsel-fähig, Prefix-Support
batch-indexer.ts            ← ANPASSEN: Document-Prefix übergeben
query-embedder.ts           ← ANPASSEN: Query-Prefix übergeben
IndexManager.tsx            ← ANPASSEN: Dropdown in Modell-Section
eval-runner.ts              ← ANPASSEN: Modellname dynamisch lesen
```

## Constraints

- Alle Dateien MÜSSEN unter 300 Zeilen bleiben
- Nur CSS custom properties für Styling, kein inline `style={{}}` außer für dynamische Werte
- Kein `localStorage` — nur IndexedDB via `storage.idb`
- TypeScript strict mode, explizite Return-Types auf exportierten Funktionen
- File-Imports: `@/core/services/search/...`

---

## Phase 1: Model Registry (`src/core/services/search/model-registry.ts`)

Erstelle eine neue Datei mit Modell-Definitionen und einer Funktion zum Laden/Speichern des aktiven Modells.

```typescript
// src/core/services/search/model-registry.ts

export interface EmbeddingModelConfig {
  id: string;                       // Eindeutige ID für IDB-Speicherung
  name: string;                     // HuggingFace Modell-Name
  label: string;                    // Anzeigename im UI
  dimensions: number;               // Output-Dimensionen
  sizeLabel: string;                // z.B. "22M" oder "308M"
  downloadSize: string;             // z.B. "~80MB" oder "~200MB"
  strategy: 'pipeline' | 'automodel';  // Welche Transformers.js API
  dtype?: 'fp32' | 'q8' | 'q4';    // Quantisierung (nur automodel)
  pooling: 'mean' | 'cls';
  normalize: boolean;
  queryPrefix: string;              // Leerstring wenn kein Prefix
  documentPrefix: string;           // Leerstring wenn kein Prefix
  description: string;              // Kurzbeschreibung
  matryoshka?: number[];            // Optional: verfügbare Matryoshka-Dimensionen
}

export const EMBEDDING_MODELS: EmbeddingModelConfig[] = [
  {
    id: 'minilm-l6-v2',
    name: 'Xenova/all-MiniLM-L6-v2',
    label: 'MiniLM L6 v2',
    dimensions: 384,
    sizeLabel: '22M',
    downloadSize: '~80 MB',
    strategy: 'pipeline',
    pooling: 'mean',
    normalize: true,
    queryPrefix: '',
    documentPrefix: '',
    description: 'Schnell, englisch-optimiert. Gute Baseline.',
  },
  {
    id: 'embeddinggemma-300m',
    name: 'onnx-community/embeddinggemma-300m-ONNX',
    label: 'EmbeddingGemma 300M',
    dimensions: 768,
    sizeLabel: '308M',
    downloadSize: '~200 MB (q8)',
    strategy: 'automodel',
    dtype: 'q8',
    pooling: 'mean',
    normalize: true,
    queryPrefix: 'task: search result | query: ',
    documentPrefix: 'title: none | text: ',
    description: 'Google, multilingual, 100+ Sprachen. Beste Qualität.',
    matryoshka: [768, 512, 384, 256, 128],
  },
];

export const DEFAULT_MODEL_ID = 'minilm-l6-v2';

// IDB Key für das aktive Modell
const IDB_MODEL_KEY = 'embedding-model-id';

export function getModelById(id: string): EmbeddingModelConfig {
  return EMBEDDING_MODELS.find(m => m.id === id) ?? EMBEDDING_MODELS[0]!;
}

export async function getActiveModelId(
  idb: { get: <T>(key: string) => Promise<T | null> },
): Promise<string> {
  const stored = await idb.get<string>(IDB_MODEL_KEY);
  // Validiere dass das gespeicherte Modell noch existiert
  if (stored && EMBEDDING_MODELS.some(m => m.id === stored)) return stored;
  return DEFAULT_MODEL_ID;
}

export async function setActiveModelId(
  idb: { set: (key: string, value: unknown) => Promise<void> },
  modelId: string,
): Promise<void> {
  await idb.set(IDB_MODEL_KEY, modelId);
}
```

---

## Phase 2: EmbeddingService Refactor (`src/core/services/search/embedding-service.ts`)

Refactoriere den bestehenden `EmbeddingService` so, dass er:
1. Ein `EmbeddingModelConfig` akzeptiert
2. Zwei Strategien unterstützt: `pipeline` (MiniLM) und `automodel` (EmbeddingGemma)
3. `destroy()` + `init()` mit neuem Modell möglich ist (Modellwechsel)
4. Prefixes für Query vs. Document-Embedding verarbeitet

**WICHTIG:** Die Datei muss unter 300 Zeilen bleiben. Trenne ggf. die `automodel`-Strategie in eine eigene Datei.

### Haupt-Service: `embedding-service.ts`

```typescript
// src/core/services/search/embedding-service.ts

import { pipeline, AutoModel, AutoTokenizer, matmul,
  type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { EmbeddingModelConfig } from './model-registry';
import { getModelById, DEFAULT_MODEL_ID } from './model-registry';

export type { EmbeddingModelConfig } from './model-registry';
export { EMBEDDING_MODELS, getModelById, getActiveModelId, setActiveModelId } from './model-registry';

export interface EmbeddingProgress {
  phase: 'loading' | 'ready' | 'embedding';
  modelProgress?: { status: string; loaded?: number; total?: number };
  current?: number;
  total?: number;
}

type ProgressCallback = (progress: EmbeddingProgress) => void;

export class EmbeddingService {
  private pipelineExtractor: FeatureExtractionPipeline | null = null;
  private autoModel: unknown = null;    // AutoModel instance
  private autoTokenizer: unknown = null; // AutoTokenizer instance
  private loading = false;
  private currentModelId: string | null = null;

  getModelId(): string | null {
    return this.currentModelId;
  }

  async init(
    modelConfig: EmbeddingModelConfig,
    preferGPU = false,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    // Wenn das gleiche Modell schon geladen ist, nichts tun
    if (this.currentModelId === modelConfig.id && (this.pipelineExtractor || this.autoModel)) return;
    if (this.loading) return;

    // Altes Modell aufräumen falls anderes Modell geladen war
    if (this.currentModelId && this.currentModelId !== modelConfig.id) {
      this.destroy();
    }

    this.loading = true;
    try {
      onProgress?.({ phase: 'loading' });
      const device = preferGPU ? 'webgpu' : 'wasm';
      const progressCb = (p: Record<string, unknown>) => {
        onProgress?.({
          phase: 'loading',
          modelProgress: {
            status: p.status as string,
            loaded: p.loaded as number | undefined,
            total: p.total as number | undefined,
          },
        });
      };

      if (modelConfig.strategy === 'pipeline') {
        this.pipelineExtractor = await (pipeline as Function)(
          'feature-extraction',
          modelConfig.name,
          { device, progress_callback: progressCb },
        ) as FeatureExtractionPipeline;
      } else {
        // automodel strategy (EmbeddingGemma etc.)
        this.autoTokenizer = await AutoTokenizer.from_pretrained(modelConfig.name, {
          progress_callback: progressCb,
        });
        this.autoModel = await AutoModel.from_pretrained(modelConfig.name, {
          dtype: modelConfig.dtype ?? 'q8',
          device,
          progress_callback: progressCb,
        });
      }

      this.currentModelId = modelConfig.id;
      onProgress?.({ phase: 'ready' });
    } catch (err) {
      this.loading = false;
      throw err;
    }
    this.loading = false;
  }

  isReady(): boolean {
    return this.pipelineExtractor !== null || this.autoModel !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Embed mit automatischem Prefix basierend auf mode.
   * mode='query' → queryPrefix, mode='document' → documentPrefix
   */
  async embedSingle(text: string, config: EmbeddingModelConfig, mode: 'query' | 'document' = 'query'): Promise<number[]> {
    const prefix = mode === 'query' ? config.queryPrefix : config.documentPrefix;
    const input = prefix + text;

    if (this.pipelineExtractor) {
      const output = await this.pipelineExtractor(input, { pooling: 'mean', normalize: true });
      return Array.from(output.data as Float32Array);
    }

    if (this.autoModel && this.autoTokenizer) {
      return this.embedWithAutoModel(input, config);
    }

    throw new Error('Model not initialized');
  }

  async embedBatch(
    texts: string[],
    config: EmbeddingModelConfig,
    mode: 'query' | 'document' = 'document',
    onProgress?: (current: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<number[][]> {
    const prefix = mode === 'query' ? config.queryPrefix : config.documentPrefix;
    const vectors: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const input = prefix + texts[i]!;

      if (this.pipelineExtractor) {
        const output = await this.pipelineExtractor(input, { pooling: 'mean', normalize: true });
        vectors.push(Array.from(output.data as Float32Array));
      } else if (this.autoModel && this.autoTokenizer) {
        vectors.push(await this.embedWithAutoModel(input, config));
      } else {
        throw new Error('Model not initialized');
      }

      // Micro-Batching: Event-Loop freigeben damit UI rendern kann
      await new Promise(r => setTimeout(r, 0));
      onProgress?.(i + 1, texts.length);
    }
    return vectors;
  }

  /**
   * AutoModel-basiertes Embedding (für EmbeddingGemma).
   * Nutzt AutoTokenizer + AutoModel + Mean-Pooling + Normalize.
   */
  private async embedWithAutoModel(text: string, config: EmbeddingModelConfig): Promise<number[]> {
    const tokenizer = this.autoTokenizer as { (texts: string[], opts?: Record<string, boolean>): Record<string, unknown> };
    const model = this.autoModel as { (inputs: Record<string, unknown>): Promise<Record<string, { dims: number[]; data: Float32Array; tolist: () => number[][] }>> };

    const inputs = tokenizer([text], { padding: true });
    const outputs = await model(inputs);

    // EmbeddingGemma hat einen 'last_hidden_state' Output
    // Mean pooling über Token-Dimensionen, dann normalisieren
    const lastHidden = outputs.last_hidden_state;
    if (!lastHidden) throw new Error('Model output missing last_hidden_state');

    // Verwende matmul oder manuelles Mean-Pooling
    // Für Einzeltext: nehme den Mittelwert über alle Tokens
    const dims = lastHidden.dims; // [batch, seq_len, hidden_dim]
    const data = lastHidden.data as Float32Array;
    const seqLen = dims[1]!;
    const hiddenDim = dims[2]!;

    // Mean pooling
    const embedding = new Float32Array(hiddenDim);
    for (let t = 0; t < seqLen; t++) {
      for (let d = 0; d < hiddenDim; d++) {
        embedding[d]! += data[t * hiddenDim + d]!;
      }
    }
    for (let d = 0; d < hiddenDim; d++) {
      embedding[d]! /= seqLen;
    }

    // L2 Normalize
    if (config.normalize) {
      let norm = 0;
      for (let d = 0; d < hiddenDim; d++) norm += embedding[d]! * embedding[d]!;
      norm = Math.sqrt(norm);
      if (norm > 0) for (let d = 0; d < hiddenDim; d++) embedding[d]! /= norm;
    }

    // Truncate falls Matryoshka gewünscht (default: volle Dimensionen)
    return Array.from(embedding.slice(0, config.dimensions));
  }

  destroy(): void {
    this.pipelineExtractor = null;
    this.autoModel = null;
    this.autoTokenizer = null;
    this.currentModelId = null;
    this.loading = false;
  }
}

// Singleton — wird zwischen BatchIndexer und QueryEmbedder geteilt
export const embeddingService = new EmbeddingService();
```

**HINWEIS:** Falls die Datei über 300 Zeilen geht, extrahiere `embedWithAutoModel` in eine separate Datei `automodel-embedder.ts`. Achte auf die Typisierung — `AutoModel` und `AutoTokenizer` von `@huggingface/transformers` sind generisch. Verwende `unknown` + Cast wo nötig, keine `any`.

**WICHTIG zur `automodel`-Strategie:** Die HuggingFace-Doku zeigt dieses Pattern für EmbeddingGemma mit Transformers.js:
```javascript
import { AutoModel, AutoTokenizer, matmul } from "@huggingface/transformers";
const tokenizer = await AutoTokenizer.from_pretrained(model_id);
const model = await AutoModel.from_pretrained(model_id, { dtype: "q8" });
const inputs = await tokenizer([text], { padding: true });
const { last_hidden_state } = await model(inputs);
// Mean pooling + normalize
```

Falls `AutoModel` / `AutoTokenizer` nicht aus `@huggingface/transformers` exportiert werden (je nach Version), prüfe den tatsächlichen Export. In Transformers.js v3.x heißen die Exporte möglicherweise `AutoModel` und `AutoTokenizer` direkt. Teste den Import bevor du weiter baust.

---

## Phase 3: BatchIndexer anpassen (`src/core/services/search/batch-indexer.ts`)

Änderungen:
1. `init()` bekommt ein `EmbeddingModelConfig` statt hardcoded Modell
2. `indexAll()` übergibt `mode: 'document'` an `embedBatch`
3. Speichere den Modellnamen im Index-Manifest für Invalidierung

```diff
- import { embeddingService } from './embedding-service';
- import type { EmbeddingProgress } from './embedding-service';
+ import { embeddingService } from './embedding-service';
+ import type { EmbeddingProgress, EmbeddingModelConfig } from './embedding-service';

  export class BatchIndexer {
    private ready = false;
+   private modelConfig: EmbeddingModelConfig | null = null;

    async init(
+     modelConfig: EmbeddingModelConfig,
      preferGPU = false,
      onStatus?: (status: IndexStatus) => void,
    ): Promise<void> {
-     await embeddingService.init(preferGPU, (p: EmbeddingProgress) => {
+     this.modelConfig = modelConfig;
+     await embeddingService.init(modelConfig, preferGPU, (p: EmbeddingProgress) => {
        // ... progress callback bleibt gleich
      });
      this.ready = true;
    }

    async indexAll(...) {
+     if (!this.ready || !this.modelConfig) throw new Error('Not initialized');
      // ...
      // Bei embedBatch den mode 'document' übergeben:
-     const vectors = await embeddingService.embedBatch(chunks, ...);
+     const vectors = await embeddingService.embedBatch(chunks, this.modelConfig, 'document', ...);
      // ...
+     // Speichere Modell-ID im Manifest für Invalidierung
+     await storage.idb.set('index-model-id', this.modelConfig.id);
    }
  }
```

---

## Phase 4: QueryEmbedder anpassen (`src/core/services/search/query-embedder.ts`)

```diff
- import { embeddingService } from './embedding-service';
+ import { embeddingService } from './embedding-service';
+ import type { EmbeddingModelConfig } from './embedding-service';

  export class QueryEmbedder {
+   private modelConfig: EmbeddingModelConfig | null = null;

-   async init(preferGPU = false): Promise<void> {
-     await embeddingService.init(preferGPU);
+   async init(modelConfig: EmbeddingModelConfig, preferGPU = false): Promise<void> {
+     this.modelConfig = modelConfig;
+     await embeddingService.init(modelConfig, preferGPU);
    }

    // ... isReady(), isLoading() bleiben

-   async embed(query: string): Promise<number[]> {
-     return embeddingService.embedSingle(query);
+   async embed(query: string): Promise<number[]> {
+     if (!this.modelConfig) throw new Error('Not initialized');
+     return embeddingService.embedSingle(query, this.modelConfig, 'query');
    }
  }
```

---

## Phase 5: EvalRunner anpassen (`src/core/services/search/eval/eval-runner.ts`)

```diff
- import { EMBEDDING_MODEL } from '../embedding-service';
+ import { getModelById } from '../model-registry';

  export class EvalRunner {
-   constructor(private search: HybridSearch) {}
+   constructor(private search: HybridSearch, private modelId: string) {}

    async run(...): Promise<EvalReport> {
+     const model = getModelById(this.modelId);
      // ...
      return {
        timestamp: new Date().toISOString(),
-       model: EMBEDDING_MODEL,
+       model: model.name,
+       modelId: this.modelId,
+       modelLabel: model.label,
        // ...
      };
    }
  }
```

Erweitere `EvalReport` in `eval-types.ts` um `modelId` und `modelLabel`:

```diff
  export interface EvalReport {
    timestamp: string;
    model: string;        // HF Modellname (bleibt für Abwärtskompatibilität)
+   modelId?: string;     // Registry-ID
+   modelLabel?: string;  // Anzeigename
    totalChunks: number;
    // ...
  }
```

---

## Phase 6: Admin-UI — IndexManager.tsx anpassen

### 6a: Modell-Section umbauen

Die bestehende "Modell & Konfiguration"-Section wird zum interaktiven Modell-Selektor:

```typescript
// In IndexManager.tsx — ersetze die statische Modell-Section

// Neue Imports:
import { Select } from '@/ui';
import {
  EMBEDDING_MODELS, getModelById, getActiveModelId, setActiveModelId,
} from '@/core/services/search/model-registry';
import type { EmbeddingModelConfig } from '@/core/services/search/model-registry';

// Neue State-Variablen:
const [activeModelId, setActiveModelIdState] = useState<string>('minilm-l6-v2');
const [indexModelId, setIndexModelId] = useState<string | null>(null); // Modell des aktuellen Index

// In useEffect laden:
useEffect(() => {
  getActiveModelId(storage.idb).then(setActiveModelIdState);
  storage.idb.get<string>('index-model-id').then(v => setIndexModelId(v ?? null));
  // ... bestehende Loads
}, [storage]);

const activeModel = getModelById(activeModelId);
const indexOutdated = indexModelId !== null && indexModelId !== activeModelId;
```

### 6b: Modell-Section UI

Ersetze die bisherige statische "Modell & Konfiguration" CollapsibleSection:

```tsx
<CollapsibleSection label="Modell & Konfiguration" defaultOpen={false}
  subtitle={`${activeModel.label} · ${activeModel.dimensions} Dim.`}>
  <div className="space-y-4">
    {/* Modell-Auswahl */}
    <Select
      label="Embedding-Modell"
      options={EMBEDDING_MODELS.map(m => ({
        value: m.id,
        label: `${m.label} (${m.sizeLabel}, ${m.dimensions}d)`,
      }))}
      value={activeModelId}
      onChange={async (e) => {
        const newId = e.target.value;
        setActiveModelIdState(newId);
        await setActiveModelId(storage.idb, newId);
        // Prüfe ob Index mit anderem Modell gebaut wurde
        const currentIndexModel = await storage.idb.get<string>('index-model-id');
        if (currentIndexModel && currentIndexModel !== newId) {
          setIndexModelId(currentIndexModel);
        }
      }}
    />

    {/* Modell-Details */}
    <div className="space-y-2 text-[12px] text-[var(--tf-text-secondary)]">
      <Row label="Modell" value={activeModel.name} />
      <Row label="Dimensionen" value={String(activeModel.dimensions)} />
      <Row label="Download" value={activeModel.downloadSize} />
      <Row label="Backend" value={hasGPU ? 'WebGPU' : 'WASM'} />
      <Row label="Chunk-Groesse" value="200 Woerter, 50 Overlap" />
      {activeModel.queryPrefix && (
        <Row label="Query-Prefix" value={activeModel.queryPrefix} />
      )}
    </div>
    <p className="text-[11px] text-[var(--tf-text-tertiary)]">{activeModel.description}</p>

    {/* Warnung bei Modell-Mismatch */}
    {indexOutdated && (
      <div className="flex items-center gap-2 p-3 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)]">
        <AlertCircle size={14} className="text-[var(--tf-warning-text)]" />
        <div>
          <p className="text-[12px] text-[var(--tf-warning-text)]">
            Index wurde mit einem anderen Modell erstellt.
          </p>
          <p className="text-[11px] text-[var(--tf-warning-text)] opacity-80">
            Bitte den Index unter "Indexierung" komplett neu erstellen.
          </p>
        </div>
      </div>
    )}
  </div>
</CollapsibleSection>
```

### 6c: runIndex anpassen

Die `runIndex` Funktion muss das aktive Modell aus der Registry laden:

```typescript
const runIndex = async (full: boolean): Promise<void> => {
  setRunning(true); setStatus(null); setError(null); setIndexResult(null); setAborted(false);
  abortRef.current = new AbortController();
  const startTime = Date.now();
  try {
    if (full) await storage.idb.delete('index-manifest');
    const indexer = new BatchIndexer();
    const model = getModelById(activeModelId);   // <-- NEU
    await indexer.init(model, hasGPU, setStatus); // <-- model übergeben
    const chunks = await indexer.indexAll(storage, setStatus, abortRef.current.signal);
    const elapsed = Date.now() - startTime;
    setChunkCount(chunks.length); setLastUpdate(new Date().toISOString());
    setIndexModelId(activeModelId);  // <-- Index-Modell tracken
    indexer.destroy();
    if (abortRef.current.signal.aborted) { setAborted(true); }
    else { setIndexResult({ chunks: chunks.length, docs: status?.total ?? 0, duration: formatDuration(elapsed) }); }
  } catch (err) {
    // ... Fehlerbehandlung bleibt
  } finally { setRunning(false); }
};
```

### 6d: EvalSection bekommt modelId

Übergib `activeModelId` als Prop an `EvalSection`:

```tsx
<EvalSection chunkCount={chunkCount} modelId={activeModelId} />
```

---

## Phase 7: EvalSection anpassen (`src/plugins/admin/eval/EvalSection.tsx`)

```diff
  interface EvalSectionProps {
    chunkCount: number;
+   modelId: string;
  }

- export function EvalSection({ chunkCount }: EvalSectionProps) {
+ export function EvalSection({ chunkCount, modelId }: EvalSectionProps) {

    const startEval = async (): Promise<void> => {
      // ... bestehender Setup-Code ...

+     const model = getModelById(modelId);
      const queryEmbedder = new QueryEmbedder();
-     await queryEmbedder.init();
+     await queryEmbedder.init(model);

      const hybridSearch = new HybridSearch(fulltext, vectorStore, queryEmbedder);
-     const runner = new EvalRunner(hybridSearch);
+     const runner = new EvalRunner(hybridSearch, modelId);
      const result = await runner.run(setProgress);
      // ...
    };
```

---

## Phase 8: EvalResultView — Modellvergleich anzeigen

In `EvalResultView.tsx` den Modellnamen prominent anzeigen und bei Vergleich hervorheben wenn sich das Modell geändert hat:

```tsx
// Am Anfang der EvalResultView-Komponente, nach den MetricCards:
{report.modelLabel && (
  <p className="text-[11px] text-[var(--tf-text-tertiary)]">
    Modell: {report.modelLabel}
    {previousReport && previousReport.modelId !== report.modelId && (
      <span> (vorher: {previousReport.modelLabel ?? previousReport.model})</span>
    )}
  </p>
)}
```

Im "Export & Verlauf" Abschnitt, erweitere `DeltaLine` um den Modellnamen:

```tsx
{previousReport && previousReport.modelId !== report.modelId && (
  <p className="text-[12px] text-[var(--tf-text)] font-medium">
    Modellwechsel: {previousReport.modelLabel ?? previousReport.model} → {report.modelLabel ?? report.model}
  </p>
)}
```

---

## Phase 9: Alle Verbraucher von `EMBEDDING_MODEL` migrieren

Suche im gesamten Repo nach `EMBEDDING_MODEL` und ersetze:

1. **IndexManager.tsx** Zeile 7: Import entfernen, stattdessen `activeModel.name` und `activeModel.dimensions` verwenden
2. **eval-runner.ts** Zeile 4: Import entfernen, stattdessen Registry verwenden (s.o.)

Der Export `EMBEDDING_MODEL` in `embedding-service.ts` kann entfernt werden. Falls noch andere Dateien darauf verweisen, migriere sie analog.

---

## Phase 10: Index-Invalidierung bei Modellwechsel

Wenn der User das Modell wechselt, müssen bestehende Vektoren invalidiert werden (384d Vektoren sind mit 768d inkompatibel). Die Invalidierung passiert NICHT automatisch — der User soll bewusst "Komplett neu" klicken.

Die Warnung aus Phase 6b (`indexOutdated`) zeigt dem User den Handlungsbedarf.

Optional (aber empfohlen): Bei `runIndex(false)` (inkrementell) prüfen ob das Index-Modell zum aktiven Modell passt. Falls nicht, automatisch auf `full=true` umschalten:

```typescript
// In runIndex:
const currentIndexModel = await storage.idb.get<string>('index-model-id');
if (currentIndexModel && currentIndexModel !== activeModelId) {
  // Modell hat gewechselt → Manifest löschen = Full Reindex
  await storage.idb.delete('index-manifest');
}
```

---

## Zusammenfassung der zu erstellenden/geänderten Dateien

| Datei | Aktion | Zeilen (ca.) |
|---|---|---|
| `src/core/services/search/model-registry.ts` | NEU | ~80 |
| `src/core/services/search/embedding-service.ts` | REFACTOR | ~180 |
| `src/core/services/search/batch-indexer.ts` | ANPASSEN | ~130 |
| `src/core/services/search/query-embedder.ts` | ANPASSEN | ~30 |
| `src/core/services/search/eval/eval-runner.ts` | ANPASSEN | ~110 |
| `src/core/services/search/eval/eval-types.ts` | ANPASSEN | ~55 |
| `src/plugins/admin/IndexManager.tsx` | ANPASSEN | ~230 |
| `src/plugins/admin/eval/EvalSection.tsx` | ANPASSEN | ~120 |
| `src/plugins/admin/eval/EvalResultView.tsx` | ANPASSEN | ~255 |

## Testplan

1. `npm run build:single` — muss fehlerfrei bauen
2. App öffnen → Admin → "Modell & Konfiguration" → Dropdown zeigt beide Modelle
3. MiniLM auswählen → Testdaten generieren → Indexieren → Eval → 17/20 erwartet
4. EmbeddingGemma auswählen → Warnung "Index mit anderem Modell" erscheint
5. "Komplett neu" indexieren → 460 Chunks mit EmbeddingGemma
6. Eval starten → Ergebnis zeigt "EmbeddingGemma 300M", Delta zu MiniLM-Baseline
7. Modell zurück auf MiniLM → Warnung erscheint → Neu indexieren → Eval vergleicht

## Bekannte Risiken

- **EmbeddingGemma AutoModel-Import:** `AutoModel` und `AutoTokenizer` müssen aus `@huggingface/transformers` v3.8+ exportiert sein. Falls nicht vorhanden, prüfe ob `pipeline('feature-extraction', 'onnx-community/embeddinggemma-300m-ONNX', { dtype: 'q8' })` als Fallback funktioniert — dann ändere die Strategie auf `pipeline` und behalte nur die Prefix-Logik.
- **RAM:** EmbeddingGemma q8 braucht ~200MB. Auf schwachen Geräten könnte die Initialisierung fehlschlagen. Fange den Fehler ab und zeige eine hilfreiche Meldung ("Modell zu groß für dieses Gerät").
- **Indexierungszeit:** EmbeddingGemma ist ~10x langsamer als MiniLM. Die 460 Chunks könnten statt 15s eher 2-3 Minuten brauchen. Die Fortschrittsanzeige ist bereits vorhanden.
