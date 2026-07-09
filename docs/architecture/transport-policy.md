# DSGVO-Transport-Policy

Zentrale, **fail-safe** Erzwingung der Regel **„Dokumentinhalte nie an externe APIs"**.
Dokument-tragende KI-Läufe (Generierung **und** LLM-QS, Batch, Metadaten-Extraktion)
dürfen nur auf einem **internen** Transport landen — erzwungen **im Code**, nicht nur
über den Build-Flag.

## Warum (ehrliche Einordnung)

Ändert das **Prod-Verhalten nicht**: OpenRouter ist in Prod-Builds via
`isOpenRouterEnabled()` ohnehin aus. Der Wert ist **Defense-in-Depth** — eine zweite
Verteidigungslinie unterhalb des Build-Flags, falls der Flag kippt oder ein neuer
externer Transport dazukommt, plus ein Convention-Test gegen Regression. Sie schaltet
später einen In-App-Judge über **reale** Daten (intern-only) frei.

## Bausteine

- **`src/core/services/ai/transport-policy.ts`** — der reine Resolver:
  - `classifyProvider({type, endpoint})` → `'intern' | 'extern'`. `openrouter` (Typ
    **oder** Endpoint-Heuristik) ist extern; alles andere (Streamlit, lokales
    llama.cpp, internes Modell) intern.
  - `erlaubteTransportKlassen({enthaeltDokumentInhalte})` → dokument-tragend nur
    `['intern']`, sonst `['intern','extern']`.
  - `skillEnthaeltDokumentInhalte(skill)` — **Ableitung schlägt Flag**: referenziert
    `promptTemplate` einen Inhalts-Slot (`{{vbMarkdown}}`, `{{stammdaten}}`,
    **`{{zielText}}`**, `{{vorherigeAbschnitte}}`), ist der Skill intern-pflichtig —
    egal was der explizite `enthaeltDokumentInhalte`-Flag sagt. Ohne Inhalts-Slot
    greift der Flag; fehlt er, gilt der fail-safe Default `true`.
  - `templateReferenziertInhaltsSlot(promptTemplate)` — die Slot-Basis der Ableitung
    (für die Editor-UI: Override als inert kennzeichnen). **Achtung (Pitfall #35):** die
    Ableitung scannt den `promptTemplate`-**Text** literal nach `{{slot}}`, NICHT das
    deklarative `SkillRecord.slots`-Array. Ein dokument-tragender Skill, dessen Prompt
    erst zur Laufzeit ein Builder erzeugt (z.B. die Aufbereitungs-Bausteine
    `aufbereitung-aspekte`/`-steckbrief`), muss den `{{vbMarkdown}}`-Platzhalter trotzdem
    im gespeicherten Template tragen — der Record ist Policy-Subjekt.

- **`AIBridge`** (`src/core/services/ai/bridge.ts`) — führt die **aktive Klasse**:
  `switchProvider` setzt `activeKlasse = classifyProvider(config)`. Die **gegatete**
  Wahl `getTransportForSkillRun(skill)` prüft `erlaubteTransportKlassen(...)` gegen die
  aktive Klasse: erlaubt → aktiver Transport, sonst **wirft** sie einen klaren
  DSGVO-Fehler, statt Inhalt extern zu senden. `pingActive()` kapselt den reinen
  Verfügbarkeitscheck (trägt keinen Inhalt).

- **Aufrufstellen** (gegatet über `getTransportForSkillRun`):
  - Einzellauf: `useGutachtenWorkflow.runGeneration` + `runQs`.
  - Batch: `useBatchJob.erzeugeAbschnitt`.
  - `.ping()`-Verfügbarkeitschecks bleiben roh/`pingActive()` — sie tragen keinen Inhalt.
  - **Metadaten-Extraktion** (`metadata-extractor.ts`, sekundär): eigener
    `DirectLLMTransport`-Lebenszyklus (WebGPU/Browser-Backends). Statt Refactoring durch
    die Bridge prüft `initMetadataLLM` den Endpoint via `classifyProvider`; ist er
    extern, wird nicht initialisiert → `extractMetadata` fällt auf `FALLBACK_METADATA`
    zurück. Prod unverändert (OpenRouter aus → nie extern).

## Feedback-Verbesserung (eigenständige Aufrufstelle, v2.206)

Der geführte „verbessern"-Ablauf (`feedbackImprove.ts`: `askClarifyingQuestions` +
`improveFeedbackGuided`, orchestriert von `FeedbackVerbessernFlow`) ist eine
**eigenständige** Aufrufstelle für Nutzertext-Transport — aber **kein** Skill-Run
im Registry-Sinn, daher kein `getTransportForSkillRun`-Umweg. Das Gate sitzt direkt
im Code: beide Funktionen brechen bei `transport.name !== 'Streamlit'` sofort ab
(`[]`/`null`) — sie laufen **nur** über die interne Bridge, weil Feedback-Text in
Produktion Echt-Nutzertext ist (potenziell FKZ, Namen, interne Details). Bewusst
**umgekehrte Polarität** zu `autoClassifyFeedback` (das läuft NIE auf Streamlit) —
beide Pfade zusammen decken die volle Transport-Matrix ab. Detail:
[feedback-system.md](feedback-system.md).

## Erzwingung gegen Regression

- **Convention-Test `no-raw-active-transport`** (`src/__tests__/codebase-conventions.test.ts`,
  CLAUDE.md Pitfall #30): in der Gutachten-/Batch-Domäne
  (`plugins/antraege/gutachten/`, `plugins/antraege/gutachten-batch/`,
  `core/services/gutachten-batch/`) ist rohes `getActiveTransport()` verboten — außer
  die Zeile ruft `.ping()` auf (Verfügbarkeitscheck). Inhalts-Läufe über
  `getTransportForSkillRun(skill)`. Inline-Ausnahme: `// allow-raw-active-transport: <grund>`.

## Editor-Sichtbarkeit

`SkillEditor` zeigt die abgeleitete Klassifizierung als Badge
(„Dokumentinhalte → nur intern" / „inhaltsfrei → extern möglich") plus einen
Kurator-Override (`enthaeltDokumentInhalte`). Der Override ist **wirkungslos**, wenn ein
Inhalts-Slot intern erzwingt (Checkbox disabled + Hinweis) — die Ableitung schlägt den Flag.

## Ausnahme: Dev-Eval-Harness

`src/core/services/skill-eval/` ist **nicht** an diese Policy gebunden — er hat eine
eigene Fiktiv-Daten-Policy (keine echten Dokumentinhalte) und darf zu Eval-Zwecken
externe Modelle nutzen.
