# Prompt: Embedding auf Main Thread mit Micro-Batching

```
Lies CLAUDE.md.

Die Worker-basierte Embedding-Architektur verursacht Probleme unter file:// (Cross-origin
Worker-Redirects) und erhöht die Build-Komplexität (3 Modi, Blob-URLs, Worker-Loader).

Verlagere das Embedding auf den Main Thread. Die UI bleibt bedienbar durch Micro-Batching
(Event-Loop-Freigabe nach jedem Chunk). Admin-User kann in einem zweiten Tab weiterarbeiten
während die Indexierung läuft.

═══════════════════════════════════════════════════
TEIL 1: Neuer EmbeddingService (Main Thread)
═══════════════════════════════════════════════════

Erstelle src/core/services/search/embedding-service.ts:

import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export interface EmbeddingProgress {
  phase: 'loading' | 'ready' | 'embedding';
  modelProgress?: { status: string; loaded?: number; total?: number };
  current?: number;
  total?: number;
}

type ProgressCallback = (progress: EmbeddingProgress) => void;

export class EmbeddingService {
  private extractor: FeatureExtractionPipeline | null = null;
  private loading = false;

  async init(
    preferGPU = false,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    if (this.extractor || this.loading) return;
    this.loading = true;

    try {
      onProgress?.({ phase: 'loading' });

      const device = preferGPU ? 'webgpu' : 'wasm';
      this.extractor = await (pipeline as Function)(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          device: device as 'wasm' | 'webgpu',
          progress_callback: (p: Record<string, unknown>) => {
            onProgress?.({
              phase: 'loading',
              modelProgress: {
                status: p.status as string,
                loaded: p.loaded as number | undefined,
                total: p.total as number | undefined,
              },
            });
          },
        },
      ) as FeatureExtractionPipeline;

      onProgress?.({ phase: 'ready' });
    } catch (err) {
      this.loading = false;
      throw err;
    }

    this.loading = false;
  }

  isReady(): boolean {
    return this.extractor !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }

  async embedSingle(text: string): Promise<number[]> {
    if (!this.extractor) throw new Error('Model not initialized');
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  async embedBatch(
    texts: string[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<number[][]> {
    if (!this.extractor) throw new Error('Model not initialized');

    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      const output = await this.extractor(texts[i]!, { pooling: 'mean', normalize: true });
      vectors.push(Array.from(output.data as Float32Array));

      // Micro-Batching: Event-Loop freigeben damit UI rendern kann
      if (i % 1 === 0) {
        await new Promise(r => setTimeout(r, 0));
        onProgress?.(i + 1, texts.length);
      }
    }
    return vectors;
  }

  destroy(): void {
    this.extractor = null;
  }
}

// Singleton — wird zwischen BatchIndexer und QueryEmbedder geteilt
export const embeddingService = new EmbeddingService();

═══════════════════════════════════════════════════
TEIL 2: BatchIndexer umbauen — kein Worker mehr
═══════════════════════════════════════════════════

Datei: src/core/services/search/batch-indexer.ts

Ersetze die Worker-basierte Architektur durch direkten EmbeddingService-Aufruf.

Vorher:
  import { loadEmbeddingWorker } from '@/core/utils/worker-loader';
  ...
  this.worker = await loadEmbeddingWorker();
  this.worker.postMessage({ type: 'init', device });
  ...
  this.worker.postMessage({ type: 'embed-batch', texts });

Nachher:
  import { embeddingService } from './embedding-service';
  ...
  await embeddingService.init(preferGPU, (p) => {
    onStatus({
      phase: p.phase === 'loading' ? 'Modell laden' : 'Bereit',
      total: 0, processed: 0, currentDoc: '',
      skipped: 0,
      modelProgress: p.modelProgress,
    });
  });
  ...
  const vectors = await embeddingService.embedBatch(chunks, (current, total) => {
    onStatus({
      phase: 'Embedding',
      total: docs.length,
      processed,
      currentDoc: doc.filename,
      skipped,
      chunkProgress: { current, total },
    });
  });

IndexStatus Interface erweitern:
  export interface IndexStatus {
    phase: string;
    total: number;
    processed: number;
    currentDoc: string;
    skipped: number;
    modelProgress?: { status: string; loaded?: number; total?: number };
    chunkProgress?: { current: number; total: number };
  }

Die destroy() Methode braucht keinen Worker mehr zu terminieren.

═══════════════════════════════════════════════════
TEIL 3: QueryEmbedder umbauen — gleicher Service
═══════════════════════════════════════════════════

Datei: src/core/services/search/query-embedder.ts

Der QueryEmbedder nutzt den gleichen Singleton embeddingService.
Kein eigener Worker nötig — embedSingle() ist schnell genug (~100ms).

Vorher (falls Worker-basiert):
  // Worker postMessage etc.

Nachher:
  import { embeddingService } from './embedding-service';

  export class QueryEmbedder {
    async init(preferGPU = false): Promise<void> {
      await embeddingService.init(preferGPU);
    }

    isReady(): boolean {
      return embeddingService.isReady();
    }

    isLoading(): boolean {
      return embeddingService.isLoading();
    }

    async embed(query: string): Promise<number[]> {
      return embeddingService.embedSingle(query);
    }
  }

═══════════════════════════════════════════════════
TEIL 4: Worker-Loader + alten Worker-Code entfernen
═══════════════════════════════════════════════════

Lösche oder markiere als deprecated:
- src/core/utils/worker-loader.ts → LÖSCHEN
- src/workers/embedding.worker.ts → BEHALTEN aber nicht mehr importiert
  (kann für Deploy-Build oder spätere Worker-Option nützlich sein)

In vite.config.ts:
- Die VITE_EMBED_MODE Variable wird nicht mehr gebraucht → entferne die define-Zeile:
  VORHER:
    define: {
      'import.meta.env.VITE_EMBED_MODE': JSON.stringify(isDeploy ? 'external' : 'inline'),
    },
  NACHHER:
    // Keine define nötig — Embedding läuft im Main Thread

In vite.worker.config.ts:
- Kann bleiben für optionalen Deploy-Build, aber wird nicht mehr vom Default-Flow genutzt

═══════════════════════════════════════════════════
TEIL 5: Admin UI — Fortschrittsanzeige
═══════════════════════════════════════════════════

Datei: src/plugins/admin/IndexManager.tsx

Die UI MUSS dem User zeigen was passiert. Aktuell sieht der User nichts.
Erweitere die Anzeige während der Indexierung:

5a. Modell-Download Phase:
  - Zeige: "Modell laden... (Erstmalig ~80MB Download)"
  - Fortschrittsbalken basierend auf modelProgress.loaded / modelProgress.total
  - Badge: modelProgress.status (z.B. "initiate", "download", "done")

5b. Chunking + Embedding Phase:
  - Zeige: "Dokument 23/60 — Bauantragsformular_BA002.md"
  - Fortschrittsbalken: processed / total Dokumente
  - Darunter kleiner: "Chunk 5/8 dieses Dokuments"
  - Geschätzte Restzeit (optional, basierend auf Durchschnitt bisheriger Chunks)

5c. Fertig:
  - "✓ 387 Chunks aus 60 Dokumenten indexiert"
  - Dauer anzeigen: "Dauer: 2:34 Minuten"
  - Chunks-Zahl und Letztes-Update in den Status-Cards aktualisieren

5d. Fehler:
  - Roter Badge mit Fehlermeldung
  - [Erneut versuchen] Button

5e. Fortschrittsbalken Styling (gemäß Design Guide):
  - Dünn (4px Höhe), border-radius 2px
  - Track: var(--tf-bg-secondary)
  - Fill: var(--tf-text)
  - NICHT bunt — monochrom wie alles andere

5f. Buttons während Indexierung:
  - [Nur neue indexieren] und [Komplett neu] werden disabled
  - Stattdessen: [Abbrechen] Button (setzt ein abort-Flag)

═══════════════════════════════════════════════════
TEIL 6: Abbruch-Mechanismus
═══════════════════════════════════════════════════

In EmbeddingService.embedBatch():
  - Akzeptiere ein AbortSignal: embedBatch(texts, onProgress?, signal?)
  - Prüfe in der Loop: if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

In BatchIndexer.indexAll():
  - Akzeptiere AbortSignal, reiche es an embedBatch weiter
  - Bei Abort: Speichere was bisher indexiert wurde (partielle Ergebnisse sind OK)

In IndexManager.tsx:
  - const abortRef = useRef(new AbortController());
  - [Abbrechen] Button: abortRef.current.abort()
  - Zeigt: "Indexierung abgebrochen. X/60 Dokumente indexiert."
  - [Weiter indexieren] Button startet bei den fehlenden Dokumenten

═══════════════════════════════════════════════════
TEST
═══════════════════════════════════════════════════

1. npm run dev → Chrome öffnen → localhost:5173
2. Console: KEINE Errors (IDB Race Condition gefixt, kein Worker-Fehler)
3. Admin → Testdaten generieren (falls nötig) → 60 Dokumente
4. Admin → [Komplett neu]:
   a) "Modell laden..." erscheint mit Fortschrittsbalken
   b) Erstmaliger Download ~80MB sichtbar in der Fortschrittsanzeige
   c) "Dokument 1/60 — Bauantragsformular_BA001.md" erscheint
   d) Fortschrittsbalken bewegt sich
   e) UI reagiert (Tab-Wechsel möglich, Sidebar klickbar — evtl. langsam)
   f) Nach Abschluss: "✓ X Chunks aus 60 Dokumenten indexiert"
   g) Status-Cards zeigen Chunks > 0 und aktuelles Datum
5. Suche → "Brandschutz" → Ergebnisse erscheinen
6. [Abbrechen] Button testen:
   a) Indexierung starten
   b) Nach ~10 Dokumenten [Abbrechen]
   c) "Indexierung abgebrochen. 10/60 Dokumente indexiert."
   d) Chunks > 0 (partielle Ergebnisse gespeichert)
7. npm run build:single → dist-single/index.html per file:// öffnen
   a) KEIN Cross-origin Worker Error mehr in der Console
   b) Admin → Indexierung funktioniert auch unter file://
   c) DAS ist der eigentliche Test — file:// muss jetzt gehen!
8. Console: Keine Errors in beiden Modi (dev + file://)

Committe: "refactor: move embedding to main thread, add progress UI, fix file:// compatibility"
```
