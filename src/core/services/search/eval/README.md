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

In der App selbst, im Panel **Suche & Index** des Kuration-Hubs:

- Sidebar → Kuration → Datenpflege → „Suche & Index", eingeklappt unter „Selten gebrauchtes"
- UI-Komponente: [`src/plugins/kuration/suche-index/eval/EvalSection.tsx`](../../../../plugins/kuration/suche-index/eval/EvalSection.tsx)
- Voraussetzung: Index wurde vorher gebaut („Index aktualisieren")

## Module

| Datei | Inhalt |
|-------|--------|
| `eval-types.ts` | `EvalTestCase`, `TestCaseResult`, `EvalReport`, `EvalProgress`, `EvalSummary` |
| `test-cases.ts` | Hardcoded Test-Queries mit erwarteten Top-N-Treffern |
| `eval-suites.ts` | Test-Case-Gruppen (`EVAL_SUITES`) + `getSuiteById` |
| `eval-runner.ts` | `EvalRunner.run(testCases)` — orchestriert Embedding → hybridSearch → optional Re-Rank → Score-Berechnung |
| `eval-export.ts` | JSON-Export der Reports für Vergleich zwischen Pipeline-Konfigurationen |

## Suiten + Baseline

Vier Suiten über **24 Fälle**: `alle`, `antraege` (6), `hard` (8), `extreme` (10).

> ⚠️ **Die Baseline ist ungültig.** Bis v2.394 umfasste die Suite 40 Fälle, davon 16 mit Bauantrags-Korpus (`Brandschutz_*`, `Statik_*`, `Energienachweis_*`, `Denkmalschutz`, `Altlasten`, `Artenschutz`, `Schallschutz`, `Nachforderung_BA*`) — samt einer eigenen `bau`-Suite. Diese Fälle sind mit dem Bauantrag-Endausbau (v2.395) entfernt; die alte Messung **90 % Treffer / 36 von 40** ist damit nicht mehr vergleichbar.
>
> Eine neue Baseline muss **manuell in der App** gezogen werden (Kurator → Suchindex → Eval, WebGPU + geladenes Modell nötig). Das ist nicht automatisierbar und nicht Teil des Testlaufs.

Der Bauantrags-Korpus unter `public/test-korpus/bauforschung-v2/` bleibt indiziert — er dient den verbliebenen H-/X-Fällen weiter als Distraktor-Material.

## Neue Test-Cases hinzufügen

1. Eintrag in `EVAL_TEST_CASES` (`test-cases.ts`) ergänzen
2. Bei Bedarf eine neue Suite in `EVAL_SUITES` (`eval-suites.ts`) anlegen, die den Case einschließt
3. App neu bauen (`npm run build:dev`), in Kurator/Suchindex/Eval die Suite auswählen + ausführen

## Abgrenzung zu Phase-2-Eval

`src/phase2/__tests__/triage.eval.ts` ist **Vitest-fähig** (kein WebGPU/Modelle nötig) — wird über `npm run test:phase2` ausgeführt. Schwelle: ≥ 9/11 korrekt klassifiziert.
