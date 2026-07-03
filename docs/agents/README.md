# Agent-Cheatsheets

Kompakte Checklisten für häufige Erweiterungen, die jeweils mehrere synchronisierte Touch-Points haben. Ein Coding-Agent (Claude Code, Subagent) sollte vor einer solchen Erweiterung die zugehörige Datei lesen, statt die Codebase neu zu scannen.

| Aufgabe | Cheatsheet |
|---------|------------|
| Neues Plugin anlegen | [add-plugin.md](add-plugin.md) |
| Neues CSV-Standardfeld (`CanonicalField`) | [add-csv-field.md](add-csv-field.md) |
| Neuer CSV-FieldType (Wert-Koerzion) | [add-csv-field-type.md](add-csv-field-type.md) |
| Neuer Phase-2 doc_type | [add-doc-type.md](add-doc-type.md) |
| Neuer Feature-Flag | [add-feature-flag.md](add-feature-flag.md) |
| Neuer IndexedDB-Store | [add-idb-store.md](add-idb-store.md) |
| Neuer Tab im Auslastungs-Plugin | [add-auslastung-tab.md](add-auslastung-tab.md) |
| Neue View in `src/plugins/antraege/views.ts` | [add-view.md](add-view.md) |
| Neue Tabellen-Detail-Seite (Master-Detail-Split) | [add-table-detail-page.md](add-table-detail-page.md) |
| Neue Filter-Facet in der Filter-Sidebar | [add-filter-facet.md](add-filter-facet.md) |
| Neue Stage in der Phase-2-Triage-Pipeline | [add-phase2-stage.md](add-phase2-stage.md) |
| Neuer Feedback-Status (FeedbackStatus-Union) | [add-feedback-status.md](add-feedback-status.md) |
| Neue Feedback-Kategorie (FeedbackCategory-Union) | [add-feedback-category.md](add-feedback-category.md) |
| Neues Embedding-Modell registrieren | [add-embedding-model.md](add-embedding-model.md) |
| Sidecar-Datei auf SMB-Daten-Share spiegeln | [add-sidecar-persistence.md](add-sidecar-persistence.md) |
| Neues Build-Script / Prebuild-Hook anlegen | [add-build-script.md](add-build-script.md) |
| Async-UI-Aktion mit Error-Handling | [async-error-pattern.md](async-error-pattern.md) |
| Re-Mount-Latenz eines Plugins optimieren | [optimize-remount-latency.md](optimize-remount-latency.md) |
| App-Name / Untertitel / HTML-Filename ändern | [change-app-branding.md](change-app-branding.md) |
| `file://`-Pitfalls (kompakte Quick-Reference) | [file-protocol-pitfalls.md](file-protocol-pitfalls.md) |
| Welche(n) Build nach einem Patch bauen | [which-build-to-run.md](which-build-to-run.md) |
| Design-Export aus Claude Design Tool portieren | [port-design-export.md](port-design-export.md) |
| Bildschirmseiten-Kontext-Doc pflegen (Feedback-KI-Kontext) | [update-screen-context.md](update-screen-context.md) |

## Wann nicht aktualisieren

Die Cheatsheets sind **bewusst kurz** — keine Code-Beispiele, keine Erklärungen, nur Touch-Point-Listen. Wenn ein Pfad sich ändert oder ein neuer Touch-Point dazukommt, hier eintragen. Wenn nur Logik in einer bereits gelisteten Datei sich ändert, **nicht** anfassen.

## Eval-Suiten (Test-Coverage über Vitest hinaus)

Zwei separate Eval-Mechanismen — bei Änderungen an Triage/Search beide kennen:

| Suite | Wo | Wie ausführen |
|-------|-----|---------------|
| **Phase-2 Triage** | [`src/phase2/__tests__/triage.eval.ts`](../../src/phase2/__tests__/triage.eval.ts) | `npm run test:phase2` (CI-tauglich, Vitest) — Schwelle ≥ 9/11 |
| **Hybrid-Search** | [`src/core/services/search/eval/`](../../src/core/services/search/eval/) | Browser-Runtime via Kurator-Plugin „Suchindex" → Tab „Eval" — siehe [eval/README.md](../../src/core/services/search/eval/README.md) |

Die Search-Eval ist bewusst **nicht** im npm-Test-Lauf, weil sie WebGPU/WASM + geladenes ONNX-Modell + initialisierten Orama-Index braucht.

## Voraussetzungen für jeden Patch

Vor jedem nicht-trivialen Patch:

```bash
npm run check          # typecheck + test + build:dev in einem Aufruf
```

Oder einzeln:

```bash
npm run typecheck      # keine neuen Type-Fehler
npm run test           # alle Tests grün (= vitest run)
npm run build:dev      # Single-File-Build erfolgreich
```

Verifikation per Doppelklick auf die gebaute HTML unter `dist-single/` (z.B. `zah.html`, abhängig von `build.outputFilename` in der dev-Config) in Chrome/Edge — keine Console-Errors.

`build:prod`, `build:kurator` und `build:pl` **nicht** routinemäßig mit-bauen — nur bei strukturellen Änderungen an Variant-Configs. Siehe `CLAUDE.md` → Build-Varianten.
