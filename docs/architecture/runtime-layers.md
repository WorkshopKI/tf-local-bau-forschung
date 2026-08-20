# Runtime-Layers: Storage, Search, Theming, Onboarding

*Last reviewed: 2026-05-28 (v2.2.0)*

Übersicht über die Cross-Cutting-Layers, die alle Plugins nutzen.

## Storage Dual-Layer

- **IndexedDB**: Fast cache, embedding vectors, ONNX model cache, UI state, FS handle persistence
- **File System Access API**: Permanent storage on shared file server — vorgaenge, artifacts, index, config

Pfad-Map des SMB-Daten-Shares: [data-layout.md](data-layout.md).

## Search Stack

- **Orama**: Hybrid search engine (BM25 fulltext + vector similarity in one DB).
  Worttrennung **deutsch** über die Konstante `INDEX_SPRACHE` — Begründung, Messung
  und der Umgang mit Alt-Indizes stehen in
  [suche-relevanz.md §6](suche-relevanz.md#6-worttrennung-des-dokumenten-index).
- **Embeddings**: EmbeddingGemma 300M via Transformers.js v4, runs in Main Thread (no Worker under `file://`).
  **Geladen wird erst bei Bedarf** (seit v4.113): der app-weit gemountete
  `useSearchProvider` rief `embeddingService.init` bis dahin bei JEDEM Start, obwohl
  das Opt-in der Suchseite aus ist und am Schalter „(lädt 200 MB)" steht. Jetzt lädt,
  wer es braucht — `ensureVectorModel` (RAG-Suche), `ensureEmbeddingReady`
  (Suchseite), `BatchIndexer.init` (Indexlauf). `init` ist idempotent und hält seinen
  **laufenden** Ladelauf fest: parallele Aufrufer warten darauf, statt sofort
  zurückzukehren und ein nicht geladenes Modell als geladen zu behandeln
  ([suche-relevanz.md §8.6](suche-relevanz.md)). Wer die Bereitschaft anzeigt,
  abonniert `embeddingService.subscribe` — der Ladelauf startet oft woanders.
- **Backend**: WebGPU (preferred) or WASM fallback, auto-detected at init
- **Metadata-Extraktion**: LLM-basiert via OpenRouter API oder lokales llama.cpp (Nemotron)
- **Re-Ranker**: Cross-Encoder (aktiv, steuerbar per Pipeline-Config in [src/core/hooks/useSearch.ts](../../src/core/hooks/useSearch.ts))

Modell-Wechsel ist team-weiter Bruch — siehe CLAUDE.md Pitfall #19 + [add-embedding-model.md](../agents/add-embedding-model.md).

### Der Vektorindex der Suche

Die Stufe „auch ähnliche Themen" liest **keinen** eigenen Index, sondern den Embedding-Korpus
(`auslastung-emb:<aktenzeichen>` in der IDB, ein Vektor je Vorhaben). Der Name ist historisch —
gebaut wurde er zuerst fürs Auslastungs-Matching; getragen wird von ihm seit je auch die Suche.

- **Gepflegt** wird er in Kuration → „Suche & Index" (Bau, Abgleich, Spiegelung auf
  `_intern/auslastung-embedding-corpus.*`). Ein Rechner baut für das ganze Team, alle anderen holen
  in ~10 s.
- **Abgeglichen** wird beim Start durch [useEmbeddingKorpusAbgleich](../../src/core/hooks/useEmbeddingKorpusAbgleich.ts);
  die Entscheidung selbst steht rein in [abgleich.ts](../../src/core/services/embedding-corpus/abgleich.ts)
  und vergleicht die **Signatur** (Modell, Dimension, Präfix, Text-Fassung), nicht die Anzahl. Ein
  Korpus aus einer älteren Textfassung wird **ersetzt**, nie ergänzt — ein Kosinus-Vergleich über
  zwei Vektorräume liefert Zahlen, die nach Ähnlichkeit aussehen.
- **Geladen wird bei Bedarf**: wo das Auslastungs-Modul offen ist, beim Start im Leerlauf; sonst,
  sobald jemand die Ähnlichkeitssuche einschaltet. Ein ~40-MB-Download über SMB bei jedem Kaltstart
  für jeden, der die Stufe nie benutzt, wäre die Gegenrichtung zur Bedarfs-Ladung des Modells.
- **Aktuell gehalten** wird er über einen Text-Hash je Vorhaben
  ([texthashes.ts](../../src/core/services/embedding-corpus/texthashes.ts)): „inkrementell" heißt
  **fehlt ODER Text hat sich geändert**, nicht mehr nur „fehlt". Ohne das blieb ein Vorhaben, das
  seinen Vektor bekam, bevor seine Kurzbeschreibung im Wochen-Export stand, für immer auf dem alten
  Vektor sitzen — am echten Bestand betrifft das **9 259 von 14 221** Vorhaben (Median 861 Zeichen
  Inhalt). Ein Rechner kann das Nachziehen automatisieren (opt-in, gerätelokal, siehe
  [korpus-nachlauf.ts](../../src/plugins/auslastung/services/matching/korpus-nachlauf.ts)).

### ORT-WASM-Bereitstellung (Inline-gzip + `wasmBinary`)

Die ONNX-Runtime-WASM (`ort-wasm-simd-threaded.asyncify.wasm`, ~21 MB) wird **nicht** mehr als `data:`-URL aus dem Bundle geladen, sondern zur Laufzeit direkt als `env.backends.onnx.wasm.wasmBinary` übergeben. Motiv: die WASM lag zweimal byte-identisch als base64-`data:`-URL im Single-File-Bundle (~2×30 MB) und wurde bei jedem Start komplett vom SMB-Share geladen.

- **Prebuild**: [scripts/generate-ort-wasm-module.mjs](../../scripts/generate-ort-wasm-module.mjs) gzippt die WASM (22,8 → 5,5 MB) nach `src/generated/ort-wasm-gz.ts` (gitignored, idempotent per Quell-Hash; verdrahtet an `generate:test-assets` + `predev`).
- **Laufzeit**: [ort-wasm-init.ts](../../src/core/services/search/ort-wasm-init.ts) `ensureOrtWasmBinary()` (idempotent) dekodiert base64 → `DecompressionStream('gzip')` → Magic-Byte-Check → setzt `wasmBinary` + `env.useWasmCache = false`. Aufruf VOR der ersten Pipeline/Session in `embedding-service`, `re-ranker`, `browser-llm` (der zentrale `env`-Import lebt in ort-wasm-init.ts).
- **Post-Build-Strip**: [scripts/strip-inline-wasm.mjs](../../scripts/strip-inline-wasm.mjs) leert die beiden verbliebenen inlined `data:application/wasm;base64,`-URLs im gebauten HTML (linearer Scan; Choke-Point in `build-with-config.mjs` vor dem Varianten-Copy; Guard bricht ab bei 0 oder > 4 Fundstellen).

**Wirkung**: Single-File-HTML ~73 → ~19 MB (−73 %), schnellerer App-Start über SMB. **Nie** `wasmPaths`/Asset-URLs reaktivieren (Pitfall #39) — der Strip leert die inlined `data:`-URLs.

## Theming

All colors via CSS custom properties. Primary color is HSL-based — only `--tf-primary-h` (hue) changes.
Dark mode via `[data-theme="dark"]` attribute on `<html>`. See [DESIGN_GUIDE.md](../../DESIGN_GUIDE.md) for full specification.

## Onboarding-Tour

Geführte Tour für Erstnutzer (`src/core/components/tour/`, `src/core/hooks/useTour.ts`) — Stand v2.359 vier Schritte (`ALL_STEPS` in `tourSteps.ts`, gefiltert nach Build-Features):

- Bewusst nur über **Rahmen**-Elemente (Dashboard, Sidebar, Suchfeld, Vorgangsliste), nicht über Seiten-Interna: eine Tour hält die Klick-Reihenfolge fest und veraltet sonst mit jedem Seitenumbau
- **Seitenspezifische** Touren gibt es nicht und sind vertagt, bis die Seiten stabil sind; wenn sie kommen, hängen sie als zweite Tiefe im Hilfe-Dialog der Seite (`SeitenHilfeButton`), nicht an einem eigenen Knopf. Der Dialog kündigt das im Tooltip des Tour-Knopfs an
- Auto-Start 800ms nach Home-Seitenladen (nur wenn Daten vorhanden und Tour noch nicht abgeschlossen)
- Manueller Trigger in der **Kopfzeile des Seiten-Hilfe-Dialogs** („Einführungs-Tour", `SeitenHilfeButton`, via `headerActions` des `Dialog`) — von jeder Seite aus, weil Schritt 1 `navigateTo: 'home'` trägt. Der Puls-Punkt „noch nicht durchlaufen" sitzt am Hilfe-Knopf der Startseite. Bis v2.359 hing beides am eigenen Sidebar-Fußzeilen-Knopf „Neu hier?" (entfallen mit v2.360), bis v2.368 in der Fußzeile des Dialogs — dort unterhalb einer Textwand am Bildschirmrand und darum übersehen
- Ziele werden via `data-tour="..."` Attribut auf bestehende Elemente markiert
- Cross-Page: TourStep unterstützt `navigateTo: 'plugin-id'` für Auto-Navigation zur Zielseite
- Persistenz: `localStorage["teamflow_tour_completed"]` — funktioniert unter `file://`
- TourOverlay nutzt CSS `clip-path` für Spotlight + z-index 102 für Target-Elevation

## Plugin-Initialisierung (`onInit`)

Plugins können optional einen `onInit?: (services: PluginInitServices) => Promise<void>` exportieren (seit v2.13 aktiv). Der Hook wird **non-blocking** nach `storage.init()` aus [src/core/App.tsx](../../src/core/App.tsx) parallel zu anderen Plugin-Inits aufgerufen (`void Promise.allSettled(...)`, fehlertolerant) und ist der richtige Ort für IDB-Schema-Migrationen, Service-Bootstrap, Default-Seeds und Pre-Cache von Sidecar-Dateien.

Wer Daten erst beim ersten Render des Plugin-Bildschirms braucht, gehört NICHT in `onInit` (lädt sonst unnötig beim App-Start). Konkretes Pattern für Re-Mount-Latenz-Optimierung mit Aggregate-im-Store + sofortigem UI-Feedback + onInit-Pre-Cache: [docs/agents/optimize-remount-latency.md](../agents/optimize-remount-latency.md).
