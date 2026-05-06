# Search-Eval-Suite

Browser-Runtime-Eval für die Hybrid-Search-Pipeline (Orama BM25 + Vector + optional Re-Ranker).

## Wichtig: kein CLI-Lauf

Diese Suite ist **nicht** Vitest-fähig. Sie braucht:

- WebGPU-/WASM-Backend (Transformers.js init im Main Thread)
- Geladenes Embedding-Modell (~300 MB, aus `models/`-Verzeichnis auf dem Daten-Share)
- Orama-Index (in IndexedDB, vorher per Bulk-Index angelegt)
- Optional: Cross-Encoder Re-Ranker

`npm run test:eval` würde im Node-Prozess sofort beim ersten `import()` fehlschlagen.

## Wo läuft sie?

In der App selbst, im Kurator-Plugin **Suchindex** → Tab „Eval":

- Plugin-ID: `kurator` (Sidebar → Kuration → Suchindex)
- UI-Komponente: [`src/plugins/kurator/eval/EvalSection.tsx`](../../../../plugins/kurator/eval/EvalSection.tsx)
- Voraussetzung: Index wurde vorher gebaut (Plugin → „Index aktualisieren")

## Module

| Datei | Inhalt |
|-------|--------|
| `eval-types.ts` | `EvalTestCase`, `TestCaseResult`, `EvalReport`, `EvalProgress`, `EvalSummary` |
| `test-cases.ts` | Hardcoded Test-Queries mit erwarteten Top-N-Treffern |
| `eval-suites.ts` | Test-Case-Gruppen (`EVAL_SUITES`) + `getSuiteById` |
| `eval-runner.ts` | `EvalRunner.run(testCases)` — orchestriert Embedding → hybridSearch → optional Re-Rank → Score-Berechnung |
| `eval-export.ts` | JSON-Export der Reports für Vergleich zwischen Pipeline-Konfigurationen |

## Neue Test-Cases hinzufügen

1. Eintrag in `EVAL_TEST_CASES` (`test-cases.ts`) ergänzen
2. Bei Bedarf eine neue Suite in `EVAL_SUITES` (`eval-suites.ts`) anlegen, die den Case einschließt
3. App neu bauen (`npm run build:dev`), in Kurator/Suchindex/Eval die Suite auswählen + ausführen

## Abgrenzung zu Phase-2-Eval

`src/phase2/__tests__/triage.eval.ts` ist **Vitest-fähig** (kein WebGPU/Modelle nötig) — wird über `npm run test:phase2` ausgeführt. Schwelle: ≥ 9/11 korrekt klassifiziert.
