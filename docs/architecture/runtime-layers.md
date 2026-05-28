# Runtime-Layers: Storage, Search, Theming, Onboarding

*Last reviewed: 2026-05-28 (v2.2.0)*

Übersicht über die Cross-Cutting-Layers, die alle Plugins nutzen.

## Storage Dual-Layer

- **IndexedDB**: Fast cache, embedding vectors, ONNX model cache, UI state, FS handle persistence
- **File System Access API**: Permanent storage on shared file server — vorgaenge, artifacts, index, config

Pfad-Map des SMB-Daten-Shares: [data-layout.md](data-layout.md).

## Search Stack

- **Orama**: Hybrid search engine (BM25 fulltext + vector similarity in one DB)
- **Embeddings**: EmbeddingGemma 300M via Transformers.js v4, runs in Main Thread (no Worker under `file://`)
- **Backend**: WebGPU (preferred) or WASM fallback, auto-detected at init
- **Metadata-Extraktion**: LLM-basiert via OpenRouter API oder lokales llama.cpp (Nemotron)
- **Re-Ranker**: Cross-Encoder (aktiv, steuerbar per Pipeline-Config in [src/core/hooks/useSearch.ts](../../src/core/hooks/useSearch.ts))

Modell-Wechsel ist team-weiter Bruch — siehe CLAUDE.md Pitfall #19 + [add-embedding-model.md](../agents/add-embedding-model.md).

## Theming

All colors via CSS custom properties. Primary color is HSL-based — only `--tf-primary-h` (hue) changes.
Dark mode via `[data-theme="dark"]` attribute on `<html>`. See [DESIGN_GUIDE.md](../../DESIGN_GUIDE.md) for full specification.

## Onboarding-Tour

Geführte 5-Schritt-Tour für Erstnutzer (`src/core/components/tour/`, `src/core/hooks/useTour.ts`):

- Auto-Start 800ms nach Home-Seitenladen (nur wenn Daten vorhanden und Tour noch nicht abgeschlossen)
- Manueller Trigger über Sidebar-Button "Neu hier? So geht's" (unten vor SyncStatusIndicator)
- Ziele werden via `data-tour="..."` Attribut auf bestehende Elemente markiert
- Cross-Page: TourStep unterstützt `navigateTo: 'plugin-id'` für Auto-Navigation zur Zielseite
- Persistenz: `localStorage["teamflow_tour_completed"]` — funktioniert unter `file://`
- TourOverlay nutzt CSS `clip-path` für Spotlight + z-index 102 für Target-Elevation

## Plugin-Initialisierung (`onInit`)

Plugins können optional einen `onInit?: (services: PluginInitServices) => Promise<void>` exportieren (seit v2.13 aktiv). Der Hook wird **non-blocking** nach `storage.init()` aus [src/core/App.tsx](../../src/core/App.tsx) parallel zu anderen Plugin-Inits aufgerufen (`void Promise.allSettled(...)`, fehlertolerant) und ist der richtige Ort für IDB-Schema-Migrationen, Service-Bootstrap, Default-Seeds und Pre-Cache von Sidecar-Dateien.

Wer Daten erst beim ersten Render des Plugin-Bildschirms braucht, gehört NICHT in `onInit` (lädt sonst unnötig beim App-Start). Konkretes Pattern für Re-Mount-Latenz-Optimierung mit Aggregate-im-Store + sofortigem UI-Feedback + onInit-Pre-Cache: [docs/agents/optimize-remount-latency.md](../agents/optimize-remount-latency.md).
