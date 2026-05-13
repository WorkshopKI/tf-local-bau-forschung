# Neue Phase-2-Triage-Stage

Wenn ein neuer Klassifikations-Schritt **nach** Stage 3 (Nemotron) eingefügt wird (z.B. Stage 4 als OCR-Fallback für gescannte PDFs, oder ein Cross-Antrag-Konsistenz-Check). Für neue `doc_type`-Werte → [add-doc-type.md](add-doc-type.md), nicht hier.

## Touch-Points (Pflicht)

1. **`src/phase2/types.ts`** — `TriageStage`-Union erweitern (z.B. `0 | 1 | 2 | 3 | 4`). Falls die neue Stage einen neuen `ClassifierSource`-Wert produziert (`'stage4'`): die Union dort ebenfalls erweitern.
2. **`src/phase2/triage/stage4-<name>.ts` (neu)** — Pattern an [stage3-nemotron.ts](../../src/phase2/triage/stage3-nemotron.ts) orientieren. Signatur: `export async function runStage4(ctx: TriageContext, blob: Blob, preloadedPdf: PdfExtractResult | null, partial: TriageResult): Promise<Partial<TriageResult>>`. Rückgabe ist ein Patch, der im Orchestrator gespreadet wird.
3. **`src/phase2/triage/triage.ts`** — Import ergänzen (oberhalb von Zeile 25), neuen Stage-Call NACH `runStage3()` einbauen. Pattern: nur ausführen wenn `triage.requires_review === true` oder Confidence noch nicht `high`. Ergebnis-Merge: `triage = { ...triage, ...stage4Result }`.
4. **`src/phase2/__tests__/triage.eval.test.ts`** — falls die neue Stage neue Klassifikations-Pfade einführt: mindestens ein Beispiel-Dokument zur Eval-Suite hinzufügen. Aktuelle Schwelle ≥ 9/11.
5. **`docs/phase-2/triage-beispiele/`** — repräsentatives Beispiel-Dokument für manuelle Tests committen.

## Classifier-Version (Pflicht bei Verhaltensänderung)

**`src/phase2/triage/triage.ts`** — `CLASSIFIER_VERSION` erhöhen (aktuell `2`). Beim nächsten Bulk-Scan werden alle Skip-List-Einträge mit alter Version automatisch verworfen und neu klassifiziert. Kommentar-Block über der Konstante mit Begründung erweitern (siehe `v1 → v2`-Eintrag).

## Stage-Konventionen

- **Lazy I/O**: Stage liest nur was sie braucht. Wenn der `PdfExtractResult` schon erzeugt ist (`preloadedPdf`), den weiter-reichen statt erneut zu parsen.
- **LLM-Calls**: Über `ctx.transport.submitMessage(...)` mit `enable_thinking: false` und JSON-only-Prompt. Schema-Validierung im Stage selbst (kein Throw — bei Parse-Fehler `triage_reason: 'stage4_parse_error'` setzen).
- **Skip-List-Schnellpfad**: Stage soll respekt-voll mit der Skip-Liste umgehen — wenn ein früherer Lauf den Eintrag schon als `irrelevant` markiert hat, wird die Pipeline ohne Stage-Aufruf abgebrochen. Eigene Skip-Schreiblogik nur wenn der neue Stage selbst irrelevant-Entscheidungen treffen kann.
- **Deterministik**: Bei gleichen Inputs gleiche Outputs. LLM-Calls mit `temperature: 0`.

## Manifest-Folgen

`ManifestEntry.triage_stage` und `ManifestEntry.classifier_version` werden automatisch aus `triage` durch den Orchestrator geschrieben — kein direkter Schreibzugriff auf `phase2_scan_manifest` aus der Stage selbst.

## Anti-Patterns

- Stage darf nicht in IDB oder File System schreiben — alle Persistierung läuft über den Orchestrator (`putManifestEntry` / `putSkipEntry` ganz am Ende).
- Keine direkte Modifikation von Stage 0-3 (DMS-Lookup, strukturell, Keywords, Nemotron) — Reihenfolge ist Vertragsteil der Triage-Semantik.
- Kein paralleler Stage-Aufruf — Stages sind sequentiell und mutieren ein gemeinsames `triage`-Objekt.

## Verifikation

- `npm run test:phase2` — Eval-Suite ≥ 9/11
- Dev-Plugin „Phase-2 Triage" → Datei wählen → JSON-Output zeigt `triage_stage: 4` (oder neuen Wert) bei zutreffenden Fällen
- Review-Queue UI (`Dokument-Review`-Plugin): Confidence-Badge passt
