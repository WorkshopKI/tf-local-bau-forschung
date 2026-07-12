# Feedback-System

Integriertes User-Feedback + Admin-Dashboard + öffentliches Board mit Sponsoring (Phase 1+2+3 komplett).

## Redesign v2.199 — Votes · Kommentare · Titel · Karten-Board

Das öffentliche Board wurde neu gestaltet (Handoff `_design/handoff/feedback`): scannbare Karten (Typ-Icon + Titel + Kurz-Q&A + Status-Badge + Avatar), Scope-Tabs (Alle/Von mir/Vom Team), Typ-Filter-Chips, Suche, Sortierung (Neueste ↔ Meiste Votes), Kanban-Board-Ansicht + Detail-Drawer. Zwei **neue, additive, team-geteilte** Felder auf `FeedbackItem` (alle optional → alte Shared-Files bleiben lesbar):

- **`title?`** — optionaler, scannbarer Titel. Erfassungs-Formular hat ein optionales „Titel"-Feld (`FeedbackInputStep`); fehlt er (Bestands-Feedback), leitet `feedbackTitle(item)` ([feedbackUi.ts](../../src/components/feedback/feedbackUi.ts)) aus der Hauptantwort ab (Problem→„Was ist passiert?", Idee→„Was möchtest du tun können?", Lob→Text). Merge: user-lokal-wins (wie `text`).
- **`votes?: FeedbackVote[]`** — budgetfreies „Like" (eine Stimme je Nutzer, Toggle), **getrennt** vom budget-gebundenen Sponsoring (beide bleiben). Zahl = `votes.length`. Aktion `toggleVote` ([feedbackVoting.ts](../../src/core/services/feedback/feedbackVoting.ts)) spiegelt exakt das Sponsor-Vote-Muster: shared-Write self-gated, Anti-Stale (lokal nur eigene Stimme), Read-only-Prod → Outbox `ZAH/feedback/vote-wuensche.json` ([feedbackVoteOutbox.ts](../../src/core/services/feedback/feedbackVoteOutbox.ts)); Merge `unionMergeVotes` (by `user_id`) + Collector `autoCollectFeedbackVotes` (pure `mergeVotesIntoItems`, mit Retraktion).
- **`comments?: FeedbackComment[]`** — Kommentar-Thread (append-only, Union-by-`id`, nie verlieren), **distinkt** von `kurator_response` („Antwort vom Team"). Aktion `addComment` ([feedbackComments.ts](../../src/core/services/feedback/feedbackComments.ts)); Read-only-Prod → Outbox `ZAH/feedback/kommentar-outbox.json`; Merge `unionMergeComments` + Collector `autoCollectFeedbackComments` (pure `mergeCommentsIntoItems`).

Merge-Precedence in `mergeItems` ([feedbackSharedFile.ts](../../src/core/services/feedback/feedbackSharedFile.ts)): `title` lokal-wins, `votes` union-by-user (nur wenn lokal eigene Stimme = Anti-Stale), `comments` immer union-by-id. Beide Collectors sind an denselben Stellen verdrahtet wie `autoCollectSponsorVotes` (`useAutoCollectFeedback` + Inbox-Tab „Stimmen einsammeln"). `updateFeedback`-Whitelist um `title`/`votes`/`comments` erweitert.

Neue Präsentations-Bausteine (`src/components/feedback/`): `FeedbackCard` (Listen-Zeile), `FeedbackKanban` (Board nach `kurator_status`, Pitfall #21 — seit v2.225 farbige Lanes in fester Reihenfolge Neu · Abgelehnt · Geplant · In Bearbeitung · Umgesetzt, **ohne** Lob-Spalte; reine `buildBoardColumns` + Test), `FeedbackBoardDetail` (Detail-Panel), `FeedbackTypeChips` (Typ-Filter, aktiv = `--tf-primary`), `FeedbackVotePill`, `FeedbackCommentThread`, `FeedbackAvatar` (deterministische Farbe aus Name). Kurz-Q&A-Labels via `shortLabel` in `FEEDBACK_TYPES`. Die geteilte `FeedbackTicketRow` (Kurator-Liste) ist auf denselben Karten-Look gehoben (Votes/Kommentare read-only + „Abhaken"-Knopf); der Kurator-Detail zeigt Titel + Kommentar-Thread.

## User-Komponenten (`src/components/feedback/`)

- `FeedbackButton.tsx` — globaler FAB (z-index 40, bottom-right). Wird in `Shell.tsx` gerendert (innerhalb NavigationContext) und ist während aktiver Tour ausgeblendet.
- `FeedbackPanel.tsx` — Views `input | confirm | verbessern | my-feedback`. Der Eingabe-Schritt ist seit v2.41 in `FeedbackInputStep.tsx` ausgelagert (300-Zeilen-Regel). Bereich-Dropdown bleibt optional. `handleSubmit` bekommt vom InputStep ein `FeedbackSubmitPayload { category, structured?, text, llmHint?, verbessern? }` und setzt die Kategorie **deterministisch** aus der Typ-Wahl. Bei `verbessern` (v2.206) speichert es das Roh-Feedback sofort und wechselt in die View `verbessern` = `FeedbackVerbessernFlow` (geführter Ablauf, siehe „Feedback-Verbesserung" unten). Ohne `verbessern` → `ConfirmStep` („Danke!" + „Fertig") + fire-and-forget `autoClassifyFeedback`.
- `FeedbackInputStep.tsx` (v2.41, Zwei-Button-Submit v2.165) — **typ-abhängiges Mini-Formular** statt einer leeren Textarea. Schritt 1: Typ-Wahl als Chip-Reihe (Bug/Feature/UX prominent, Frage/Lob dezenter, Icons via lucide). Schritt 2: die 2–3 typspezifischen Felder des gewählten Typs (`multiline`→textarea rows=3, sonst input) + „Typ ändern" + `FeedbackScreenshotInput` + Bereich-Dropdown + App-Kontext-Block + `FaqSuggestions`. Genau **ein** Pflichtfeld pro Typ; Absenden disabled bis befüllt. Beim Submit baut `composeFeedbackText` den lesbaren Fließtext (`item.text`), die Feldwerte gehen als `structured` mit, die Screenshots als `attachments` (Blobs). Quelle ist `FEEDBACK_TYPES` in `constants.ts` — deterministisch, **kein LLM nötig** (wichtig, weil in prod fast nie ein LLM läuft). Ist die interne KI verbunden (`kiVerfuegbar`, aus `useBridgeStatus`), erscheinen zwei CTAs: **„Feedback speichern & verbessern"** (primary) + **„Feedback speichern"** (secondary); ohne KI nur Letzterer als primary.
- `FeedbackScreenshotInput.tsx` + `FeedbackAnnotator.tsx` + `useAnnotationCanvas.ts` (v2.42) — Screenshot-Anhänge: Clipboard-Paste + Datei-Upload, Runterskalierung auf ≤1600px (`feedbackAttachments.ts:scaleImageToAttachment`), Thumbnails mit „Annotieren"/„Entfernen". Der Annotator ist ein natives `<canvas>` 2D (Pfeil/Rechteck/Text/Stift, keine Lib) und **brennt** die Shapes flach ins Bild (PNG). Globaler Shortcut **Strg+Alt+S** (`FeedbackButton.tsx` via `keyboardService`) öffnet das Panel mit fokussierter Paste-Fläche. Details unten.
- `FeedbackVerbessernFlow.tsx` (v2.206) — der geführte „verbessern"-Ablauf (Rückfragen → Generieren → Bearbeiten/Speichern), siehe „Feedback-Verbesserung" unten. Ersetzt den früheren `FeedbackChatbot` + den fire-and-forget-Einschuss-Verbesserer.
- `FeedbackImproveEditor.tsx` (v2.206) — editierbare Ergebnis-Karte (klarer Text + Anforderung/Kriterien) für den letzten Schritt des geführten Ablaufs. Ersetzt die read-only `FeedbackImproveResult`.
- `FaqSuggestions.tsx` — Inline FAQ-Vorschläge **immer** (debounced 500ms, Wort-Overlap ≥2, Stoppwörter ignoriert). Im InputStep mit dem zusammengesetzten Feldtext als Input.
- `MyFeedbackList.tsx` — eigener Verlauf (gefiltert nach `user_id == profile.name`). Zeigt "Unklassifiziert" für Tickets ohne `category` (Alt-Tickets / LLM-Call fehlgeschlagen).
- `constants.ts` — `TEAMFLOW_AREAS`, Category/Status-Labels + Tailwind-Color-Maps (inkl. `ux` → `--tf-accent-*`, violett), **`FEEDBACK_TYPES`** (Typ-Schema + Feldsätze) + `composeFeedbackText`, **`LLM_CATEGORY_MAP`** (bug→problem, feature→idea, **ux→ux**, praise→praise, question→question), **`QUICK_TAGS`** (`@deprecated` seit v2.41, durch `FEEDBACK_TYPES` ersetzt).

## Typ-Formular + `structured` (v2.41, deterministisch)

Der Eingabe-Flow ist **LLM-unabhängig**: der User wählt einen Typ (Bug/Feature/UX/Frage/Lob) und füllt 2–3 typspezifische Felder. Die Kategorie steht damit ohne LLM fest, die Feldwerte landen als `FeedbackItem.structured` (`Record<string,string>`, optional — Alt-Tickets + Ein-Feld-Typen Lob/Frage haben es nicht). `structured` ist die primäre Quelle für `generateClaudeCodePrompt` (Repro-Schritte beim Bug, Ziel+Begründung beim Feature). `item.text` bleibt parallel ein lesbarer Fließtext (Board/Liste/Suche rendern darauf).

## Screenshot-Anhänge (v2.42)

User hängen annotierte Screenshots an — der Coding-Agent bekommt ein flaches Bild mit eingebrannter Markierung. **Erfassung:** Clipboard-Paste (Win+Shift+S → Strg+V) + Datei-Upload; jedes Bild wird auf ≤1600px JPEG q0.85 runterskaliert. **Annotation:** natives `<canvas>` 2D (Pfeil/Rechteck/Text/Stift), Shapes werden flach ins Bild gebrannt (PNG) — keine separate Shape-Persistenz, keine Render-Lib (`file://`-Constraint).

**Datenmodell:** `FeedbackItem.attachments?: FeedbackAttachment[]` (`{ id, filename, caption?, mime, width, height, bytes, kind?, name? }`) — **nur Referenz + Caption, kein base64** (sonst bläht es die gemergte `feedback.json`). **v2.199.1:** derselbe Anhang-Typ trägt jetzt auch **beigefügte Dateien** (`kind: 'file'` + Original-`name`, `mime` als `string`) — Dokumente/Tabellen/Präsentationen neben Screenshots (Whitelist pdf/docx/xlsx/pptx/csv/txt/md, ≤ 10 MB, `validateFeedbackFile`/`FEEDBACK_FILE_TYPES` in [feedbackAttachments.ts](../../src/components/feedback/feedbackAttachments.ts)). Erfassung `FeedbackFileInput`, Anzeige als Download-Chip `FeedbackFiles` (Screenshots rendert nur `kind!=='file'`). Storage/Outbox/Merge/Collect sind **mime-agnostisch** und unverändert; nur die Storage-Endung wird bei Dateien aus dem Namen abgeleitet. Die Bilddateien liegen separat:
- **Outbox** (read-only User): neben den Outbox-JSONs unter `ZAH/feedback/outbox/${ticketId}-${attId}.${ext}` (`personal-storage:writeFeedbackAttachment`, `submitFeedback`-Blobs-Param).
- **Shared** (Kurator/PL/dev): `_intern/feedback/attachments/` (`feedbackSharedFile:writeSharedAttachment`/`readSharedAttachment`, `FEEDBACK_ATTACHMENTS_DIR`).

`feedbackService.submitFeedback` bekommt einen 4. Param `attachments?: SubmitAttachment[]` (Blobs), leitet die `filename`s aus der finalen Ticket-id ab, schreibt die Blobs (Shared **oder** Outbox) und legt nur die Referenzen ins Ticket.

**Kurator-Einsammeln + Auto-Löschen:** `autoCollectFeedbackOutboxes` kopiert die Bild-Bytes aus der User-Outbox ins Shared-Verzeichnis (`copyAttachmentsToShared` via `readBinary`+`writeSharedAttachment`), schreibt `feedback.json`, und löscht **erst danach** das Original am Ursprung (JSON + Bilder, `personal-storage:deleteOutboxItem`). **Strikte Invariante:** nur bei bestätigtem Shared-Write löschen — sonst `approved`-Markierung (Re-Import-Schutz), Bytes am Ursprung bleiben. Anzeige in [TicketScreenshots.tsx](../../src/plugins/feedback/sections/TicketScreenshots.tsx) (Thumbnails + Lightbox aus dem Shared-Verzeichnis, `createObjectURL`/`revokeObjectURL` gepaart). `promptGenerator` listet die Screenshots als `### Beigefügte Screenshots` (Dateiname + Caption) mit Hinweis, die Bilder beim Einfügen manuell mit anzuhängen.

## Auto-Klassifikation (fire-and-forget, nur noch Verfeinerung)

Nach Absenden startet `autoClassifyFeedback(transport, text, context, area?, hint?)` weiterhin einen Single-Turn-LLM-Call — **nur beim einfachen "Feedback speichern"** (kein `verbessern`). **Seit v2.41 überschreibt der `.then()`-Block die `category` NICHT mehr** (die ist deterministisch aus der Typ-Wahl gesetzt) — er setzt nur noch `llm_classification` + `llm_summary`. Bei Fehler/Streamlit passiert schlicht nichts; die per Typ gewählte Kategorie bleibt. UI wartet nicht auf den Call. **Läuft NIE auf dem internen Streamlit-Transport** (`transport.name === 'Streamlit'` → sofort `null`) — in Produktion (wo die interne Bridge der einzige verfügbare Transport ist) also faktisch nie.

## Feedback-Verbesserung (geführter Ablauf, intern-only, v2.206)

Verschmilzt die früheren zwei KI-Funktionen (Einschuss-Verbesserer `improveFeedback` + Multi-Turn-`FeedbackChatbot`) zu EINEM geführten Ablauf über die interne KI, ausgelöst über den CTA „Feedback speichern & verbessern" (`FeedbackInputStep`, sichtbar nur wenn `useBridgeStatus === 'connected'`). Orchestriert von `FeedbackVerbessernFlow` (`src/components/feedback/`), Service in `feedbackImprove.ts`. Das Roh-Feedback wird beim CTA-Klick sofort gespeichert (nie verlieren), dann:

1. **Rückfragen** — `askClarifyingQuestions` liefert 0–3 gezielte deutsche Rückfragen (`buildClarifyPrompt`: `getAppOverview()` + `getScreenContext(pluginId)` + `buildKategorieAbgrenzung` + die Feld-Dimensionen des gewählten `FEEDBACK_TYPES`-Typs als „welche Fragen man stellen kann"). 0 Fragen → direkt zu Schritt 2; der Nutzer kann jede Frage überspringen.
2. **Generieren** — `improveFeedbackGuided` liefert `{ verbesserterText, classification }`: eine klare Feedback-Fassung PLUS Anforderung (Ist/Soll = `LLMClassification.anforderung` + Akzeptanzkriterien, max. 5) + `verbessert: true`.
3. **Bearbeiten** — `FeedbackImproveEditor`: der Nutzer editiert Text + Anforderung/Kriterien und speichert via `updateFeedback` → `item.text` = polierte Fassung, `item.original_text` = Roh-Feedback (bewahrt), `item.llm_classification` = Anforderung.

- **Intern-only (DSGVO)**: beide KI-Calls laufen NUR auf `transport.name === 'Streamlit'` (interne Bridge), jeder andere Transport → `[]`/`null`, kein OpenRouter-Fallback (auch nicht in dev). Feedback-Text ist Echt-Nutzertext. Siehe [transport-policy.md](transport-policy.md).
- **Single-turn über die Bridge**: die Streamlit-Bridge trägt keine Konversation (`submitConversation` fehlt) — jeder Schritt ist ein eigenständiger, kontext-vollständiger `submitMessage`-Call. **Der System-Prompt MUSS in die Message inlined werden** (`submitInline`), weil `StreamlitBridgeTransport.submitMessage` den 2. `systemPrompt`-Arg ignoriert — genau das war der Bug hinter „Verbesserung lief nicht, obwohl eine Antwort kam" (v2.206). Siehe [recurring-bug-classes.md](recurring-bug-classes.md).
- **Parse tolerant**: `extractJsonObject` (erstes `{` … letztes `}`, kein Verlass auf ```json-Fence) + `parseFragen`/`parseGuidedImprove`; bei Fehlschlag EIN Retry mit verschärfter Formatanweisung, dann `[]`/`null` (nie `throw`, `console.warn`, nie regressiv). `verbesserterText` fällt auf Zusammenfassung bzw. Roh-Text zurück.
- **Read-only prod-Enduser (Outbox-Parität, v2.207.1)**: dort landete das Roh-Feedback beim Absenden in der pers. Outbox (`submitFeedback` `writeToShared:false`), und `updateFeedback` ist share-self-gated → schreibt nur lokal. Damit der Kurator die **polierte** Fassung einsammelt, überschreibt `FeedbackVerbessernFlow` zusätzlich die noch offene Outbox-Datei via `updateOutboxFeedback(persHandle, id, …)` (`personal-storage/service.ts`) — **nur solange `status:'pending'`** (schon eingesammelt/gelöscht → No-Op, kein Resurrect), best-effort (wirft nie). Der Rewrite trägt `text`/`original_text`/`llm_summary`/`llm_classification`; `FeedbackOutboxItem` führt diese Felder, `toFeedbackItem` (`feedbackOutboxCollect.ts`) mappt sie beim Einsammeln ins `FeedbackItem`. Bei Share-Schreibrecht (Kurator/PL/dev) ist `outboxHandle` null — der direkte Shared-Write in `updateFeedback` greift.
- **`autoClassifyFeedback` bleibt unverändert** — läuft fire-and-forget nur beim einfachen „Feedback speichern", nie auf Streamlit.

### Bildschirmseiten-Kontext-Docs (`docs/feedback-kontext/`)

Substrat für den Prompt-Kontext oben: pro nutzer-sichtbarem Plugin ein kompaktes Markdown-Doc (Budget ≤ 2500 Zeichen, `_app.md` ≤ 4000) + globaler `_app.md`-Überblick, statisch gebundelt via `import.meta.glob(eager+raw)` in `screenContext.ts` (`getAppOverview`/`getScreenContext`/`KURATION_PLUGIN_IDS`). Pflege: [docs/agents/update-screen-context.md](../agents/update-screen-context.md), erzwungen durch den Convention-Guard `screen-context-coverage`.

## Service-Layer (`src/core/services/feedback/`)

- `feedbackService.ts` — CRUD: localStorage primär (`teamflow_feedback_items`) + Shared-File-Sync (`_intern/feedback/feedback.json` im Datenverzeichnis, v1.9). Merge-by-id (User-Felder lokal, Kurator-Felder `kurator_status`/`kurator_priority`/`kurator_notes` shared-wins; `normalizeLegacyFields` mappt alte `admin_*`-Einträge beim Laden). FAQ-Helpers (`matchFaqEntries`, `createStandaloneFaq`, `bumpFaqAskCount`). `updateFeedback` Pick-Whitelist enthält `category` (damit Auto-Klassifikation das Feld nachträglich setzen kann).
- `feedbackLlm.ts` — `loadSystemPrompt(storage)` liest `_intern/feedback/system-prompt.md` (Fallback `DEFAULT_SYSTEM_PROMPT`). `buildFeedbackSystemPrompt(template, context)` ersetzt `{{APP_OVERVIEW}}` (v2.165, via `getAppOverview()`) + `{{PAGE}}`/`{{ROUTE}}`/`{{DEVICE}}`/`{{VIEWPORT}}`/`{{LAST_ACTION}}`/`{{SESSION_MINUTES}}`/`{{ERRORS}}`. 3 Parser portiert verbatim aus Referenz: `parseFeedbackSummary` (erweitert um `anforderung`/`akzeptanzkriterien`), `parseBotResponse`, `renderSimpleMarkdown`. `initSystemPromptFile(storage)` schreibt Default-Template ins Datenverzeichnis (Button im Kurator-Config-Panel). **`autoClassifyFeedback(transport, text, context, area?)`** + **`buildClassificationPrompt`** (kurzer JSON-only-Prompt für stille Hintergrund-Klassifikation) + **`buildKategorieAbgrenzung()`** (geteilter Kategorie-Textbaustein, auch von `feedbackImprove.ts` genutzt).
- `feedbackImprove.ts` (v2.165) — `buildFeedbackImprovePrompt` + `improveFeedback`, siehe „Feedback-Verbesserung" unten.
- `screenContext.ts` (v2.165) — Runtime-Loader für `docs/feedback-kontext/`, siehe „Bildschirmseiten-Kontext-Docs" unten.
- `feedbackContext.ts` — `captureFeedbackContext(activeId, activeName)` + Ring-Buffer für `window.onerror`/`unhandledrejection` (max 5).
- `promptGenerator.ts` — `generateClaudeCodePrompt(ticket)` mit TeamFlow-Constraints-Block. **Bevorzugt `ticket.structured`** (v2.41): rendert typspezifische `###`-Abschnitte — Bug: Schritte zur Reproduktion / Tatsächliches / Erwartetes Verhalten; Feature: Ziel / Begründung / Lösungsidee; UX: Aktuelles Problem / Gewünschte Verbesserung (nur nicht-leere Felder). Eine vorhandene `llm_classification.summary` wird als Einleitung vorangestellt, ersetzt die Felder aber nicht. Ohne `structured` (Alt-Tickets, Lob/Frage) → Fallback auf summary/details/Rohtext.
- `feedbackSponsoring.ts` — **`isSponsorableCategory(category)`** = `idea || ux` ist die Single Source of Truth, welche Kategorien sponsorbar sind (statt verstreuter `=== 'idea'`-Vergleiche). `isSponsoringOpen` und alle Board-/Kurator-Stellen routen darüber.

## Kurator-Plugin (`src/plugins/feedback/`, `id: 'feedback-kuration'`, `kuratorOnly: true`)

- `FeedbackAdminPage.tsx` — 5 Tabs (Tickets / Inbox / FAQ / Sponsoring / Einstellungen) via `@/ui/Tabs`.
- `sections/FeedbackTicketList.tsx` — Filter (Status/Kategorie/Bereich) als `CollapsibleSeg`-Dropdowns mit Live-Zählern (identisch zum öffentlichen Board, v2.21.4), Karten-Liste links.
- `sections/FeedbackInboxTab.tsx` — sammelt die persönlichen Feedback-Outboxen der read-only-Enduser ein (User-Folders-Root → `<user>/ZAH/feedback/outbox/*.json`). **v2.22: Auto-Collect** — `useAutoCollectFeedback` ([hooks/useAutoCollectFeedback.ts](../../src/plugins/feedback/hooks/useAutoCollectFeedback.ts)) importiert beim Öffnen des Moduls alle offenen Outbox-Einträge **ohne Review** direkt in die zentrale `feedback.json` (Status „neu"; Service `autoCollectFeedbackOutboxes`, Outbox-id als FeedbackItem-id → idempotent). Der Inbox-Tab dient weiterhin dem einmaligen User-Wurzel-Connect (FSAPI-Geste) + manuellem Nachladen/Override. **v2.41:** `submitToOutbox` (in `feedbackService.ts`) reicht jetzt `category` + `structured` mit, und `toFeedbackItem` mappt sie ins `FeedbackItem` — vorher gingen beide im prod-Pfad verloren (alles landete als „Unklassifiziert", obwohl der User den Typ gewählt hatte). `FeedbackOutboxItem` (`personal-storage/types.ts`) hat dafür `category?` (bestand) + `structured?` (neu).
- `sections/FeedbackTicketDetail.tsx` — Status-Dropdown, Priority-Slider, **Aufwand-Dropdown (S/M/L/XL, für sponsorbare Kategorien = Ideen + UX)**, **Sponsoring-Fortschritt-Block mit "Schwelle erreicht"-Hinweis**, **Screenshot-Galerie** (`TicketScreenshots`, v2.42), Notizen, FAQ-Markierung + Antwort + Stichwörter, "Claude Code Prompt generieren" mit Copy + Download .md.
- `sections/FeedbackFaqTab.tsx` — Übersicht aller `is_faq===true` Items + manuell anlegen + bearbeiten + Markierung entfernen + löschen.
- `sections/FeedbackSponsoringOverview.tsx` — Phase 3: Features-Ranking nach Progress, konfigurierbare Schwellen (S/M/L/XL + Hours-Faktor + Budget/Quartal), Budget-Statistik.
- `sections/FeedbackConfigPanel.tsx` — Modell-Dropdown (Default `openai/gpt-oss-120b`), Max-Turns-Slider (2–12), System-Prompt-Pfad + Vorschau + "System-Prompt initialisieren"-Button (nur wenn Datei fehlt), Shared-File Status.

## Öffentliches Board (Phase 3, `src/plugins/feedback-board/`, `id: 'feedback-board'`, KEIN kuratorOnly)

- Sichtbar für alle User in Sidebar Tools-Gruppe (order: 75).
- `FeedbackBoardPage.tsx` (Redesign v2.199/v2.210, Lanes + Dichte v2.225 — Handoff `_design/handoff/feedback-kanban`) — `PageHeader` „Feedback" + Zähler (Probleme/Ideen) + `NotificationBell` + `BudgetBadge`; Toolbar mit Scope-Segmenten (`ScopeTabs variant="segmented"`, Alle/Von mir/Vom Team), Suche, `FeedbackSortSelect` (5 Ordnungen), Ansicht-Toggle (Liste/Board) + **Dichte-Umschalter** (Komfort/Kompakt, `dense`-Prop an Karten/Kanban); Typ-Filter-Chips (`FeedbackTypeChips`) + `FeedbackStatusSelect` (nur Liste); `MyProgressBar` (Scope „Von mir"); `MasterDetailLayout`-Split mit `FeedbackBoardDetail`. localStorage: Ansicht `tf-feedback-board-view-v2`, Sortierung `tf-feedback-board-sort-v3`, Dichte `tf-feedback-board-density-v1`.
- **Kanban (v2.225)**: farbige Status-Lanes (`STATUS_LANE_ACCENT`/`STATUS_COLUMN_ICONS` in `constants.ts`; Tönungen per `color-mix` mit `--tf-bg`/`--tf-text`/`--tf-border`, neue Akzent-Tokens `--tf-fb-lane-neu`/`--tf-fb-lane-abgelehnt` in theme.css Light+Dark). Lob erscheint nur in der Liste (keine Board-Spalte); leere Spalten = farbige 46px-Rails. Board-Karte „akzent": Typ-farbige Linkskante, Typ-Label + „Antwort"-Badge + Datum, optionales Thumbnail (`FeedbackScreenshots variant="board"`, Lightbox), Footer Avatar + Name + Metriken (Datei/Kommentare/Punkte) bzw. **interaktive Vote-Pill** (bewusste Handoff-Abweichung: Hybrid Votes+Sponsoring bleibt).
- Identität für Scope/Votes/Kommentare = `useMeinKuerzel() ?? profile.name`.
- Sponsoring bleibt zusätzlich zum Vote (im Detail-Panel eigener Abschnitt, nur sponsorbare Kategorien = Ideen + UX mit `effort_estimate`).

## Board-Komponenten (`src/components/feedback/`)

- `FeedbackBoardCard.tsx` — Einzelne Karte mit Status/Kategorie/Aufwand/Progress/Sponsor-Buttons/Sponsor-Liste.
- `SponsorButton.tsx` — Punkte-Dropdown (1/2/3/5) + Stunden-Dialog (hours + project_ref) + "Du sponsorst"-Badge mit Zurückziehen.
- `BudgetBadge.tsx` — `X/Y Punkte (Q2 2026)` mit Ampelfarbe (grün >5, gelb 2-5, rot 0-1).

## Sponsoring-Service (`src/core/services/feedback/`)

- `budgetService.ts` — `getCurrentQuarter()`, `loadUserBudget(userId)` (auto-Reset bei Quartalswechsel), `spendPoints`, `refundPoints`, `checkQuarterReset` (beim App-Start).
- `feedbackService.ts` erweitert: `sponsorTicket()` (Budget-Check + Doppel-Check + Merge-Write), `unsponsorTicket()` (Refund), `getSponsoringProgress(ticket, config)` (combined = points + hours × factor), `isSponsoringOpen(ticket)` (sponsorbare Kategorien = Ideen + UX, mit Aufwand + Status `neu`/`geplant`), `setEffortEstimate(storage, id, effort)`.

## Sponsoring-Logik

- Zwei Währungen pro Ticket: Punkte + Stunden (mit Projekt-Referenz).
- User kann je Ticket 1x Punkte + 1x Stunden sponsern (nicht mehrfach pro Typ).
- Combined = points + hours × `hours_to_points_factor` (Default 3).
- Schwellen (konfigurierbar via `FeedbackConfig.sponsoring_thresholds`): S=5, M=15, L=30, XL=50.
- Quartals-Reset: App-Start prüft via `checkQuarterReset`, bei Wechsel Toast "Neues Quartal — Punkte aufgefrischt" (App.tsx).
- **Keine Auto-Transition**: Schwelle erreicht → Admin bekommt Hinweis "Status manuell auf Geplant setzen?", entscheidet selbst.
- Sponsoring geschlossen sobald Status `in_bearbeitung`/`umgesetzt`/`abgelehnt`.

## Admin-Gating

- `UserProfile.is_admin?: boolean` (`src/core/types/config.ts`)
- `ShellLayout.tsx` filtert `enabledPlugins` → Plugins mit `kuratorOnly: true` nur sichtbar wenn `profile?.is_kurator === true` (Fallback auf Legacy-Feld `is_admin` / `adminOnly` beim Laden vor-v1.9-Profile).
- Aktivierung: Onboarding Step 0 (Checkbox) ODER Einstellungen → Profil-Tab → "Kurator-Funktionen aktivieren"
- Default: `false` (jeder Nutzer kann sich selbst zum Kurator machen — single-user trust model)

## LLM-Transport-Erweiterung (`src/core/services/ai/transports/`)

- Neue Methode `DirectLLMTransport.submitConversation(messages[], options?)` für Multi-Turn (vorher nur Single-Turn `submitMessage`).
- `AITransport`-Interface erweitert um optionale `submitConversation?(...)` für Feature-Detection.

## NavigationContext-Erweiterung (`src/core/hooks/useNavigation.ts`)

- `activeId: string` exposed → erlaubt FeedbackPanel, das aktive Plugin für Kontext-Erfassung zu ermitteln.

## Datenverzeichnis-Layout (v1.9)

- `_intern/feedback/feedback.json` — Shared-Tickets (`SharedFeedbackFile { version: 1, updated_at, items[] }`)
- `_intern/feedback/system-prompt.md` — Kurator-editierbarer Chatbot-Prompt (Fallback in `feedbackLlm.ts`)

## Bekannte Einschränkungen

- Streaming nicht implementiert (Buffer-Mode für Chatbot-Antworten)
- Sync-Konflikt: Last-writer-wins bei concurrent Schreibzugriff auf `feedback.json` (akzeptabel bei niedriger Frequenz)
- Budget (`teamflow_user_budget_v1_{userId}`) liegt in localStorage pro Gerät — User bekommt bei Browserwechsel neues 10-Punkte-Budget (Doppel-Sponsoring-Vektor theoretisch möglich, bei 5-15 User aber kein reales Problem)
- Budget-Statistik im Kurator-Tab nur dieser Browser (für team-weite Stats müsste Shared-Storage ergänzt werden — out of scope)
- `FeedbackItem.category` ist **optional** (`category?: FeedbackCategory`) — Tickets ohne LLM-Klassifikation (Streamlit-Transport, LLM-Fehler, ungültige Modell-Config) erscheinen als "Unklassifiziert". Kurator-Dashboard + MyFeedbackList + Board-Cards zeigen Fallback-Badge "Unklassifiziert" bei undefined.

---

## CLAUDE.md-Pitfalls (Detail)

### Pitfall #21 — Feedback-Status nicht als String-Literal vergleichen

`[test: no-direct-feedback-status-compare]` — Analog Pitfall #12 (Antrag-Status), aber für die Feedback-Domain. `if (item.kurator_status === 'geplant')` ist refactor-fragil (Tippfehler, IDE-Rename-Lücke, Status-Rename übersieht Stellen). Für **Vergleiche** die Konstante `FEEDBACK_STATUS` bzw. die Prädikate `istOffen` / `istUmgesetzt` / `istArchiviert` aus [src/core/services/feedback/feedback-status.ts](../../src/core/services/feedback/feedback-status.ts) nutzen (für **Rendering** weiterhin `STATUS_LABELS` / `STATUS_COLORS` aus [src/components/feedback/constants.ts](../../src/components/feedback/constants.ts)). Die beiden Status-Domänen (Vorgang vs. Feedback) sind bewusst getrennt (Pitfall #9): Feedback-Status hat eigene Werte (`neu`, `geplant`, `in_bearbeitung`, `umgesetzt`, `abgelehnt`, `archiviert`) und eigene Maps. Beim Hinzufügen eines neuen Status: Cheatsheet [docs/agents/add-feedback-status.md](../agents/add-feedback-status.md). **Maschinell erzwungen** durch den Convention-Test `no-direct-feedback-status-compare` in [codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts) (Inline-Ausnahme: `// allow-feedback-status-literal: <grund>`).
