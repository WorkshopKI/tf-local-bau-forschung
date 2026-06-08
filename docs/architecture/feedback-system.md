# Feedback-System

Integriertes User-Feedback + Admin-Dashboard + öffentliches Board mit Sponsoring (Phase 1+2+3 komplett).

## User-Komponenten (`src/components/feedback/`)

- `FeedbackButton.tsx` — globaler FAB (z-index 40, bottom-right). Wird in `Shell.tsx` gerendert (innerhalb NavigationContext) und ist während aktiver Tour ausgeblendet.
- `FeedbackPanel.tsx` — 2-Step-Flow (Input → Bestätigung) + optional Chatbot. Der Eingabe-Schritt ist seit v2.41 in `FeedbackInputStep.tsx` ausgelagert (300-Zeilen-Regel). Bereich-Dropdown bleibt optional. Bestätigungs-Step-Button heißt "Details ergänzen" (öffnet Chatbot mit dem zusammengesetzten Text). `handleSubmit` bekommt vom InputStep ein `FeedbackSubmitPayload { category, structured?, text, llmHint? }` und setzt die Kategorie **deterministisch** aus der Typ-Wahl.
- `FeedbackInputStep.tsx` (v2.41) — **typ-abhängiges Mini-Formular** statt einer leeren Textarea. Schritt 1: Typ-Wahl als Chip-Reihe (Bug/Feature/UX prominent, Frage/Lob dezenter, Icons via lucide). Schritt 2: die 2–3 typspezifischen Felder des gewählten Typs (`multiline`→textarea rows=3, sonst input) + „Typ ändern" + Bereich-Dropdown + App-Kontext-Block + `FaqSuggestions`. Genau **ein** Pflichtfeld pro Typ; Absenden disabled bis befüllt. Beim Submit baut `composeFeedbackText` den lesbaren Fließtext (`item.text`), die Feldwerte gehen als `structured` mit. Quelle ist `FEEDBACK_TYPES` in `constants.ts` — deterministisch, **kein LLM nötig** (wichtig, weil in prod fast nie ein LLM läuft).
- `FeedbackChatbot.tsx` — Multi-Turn-LLM-Dialog via `transport.submitConversation()`. Bei Streamlit-Transport: freundliche Meldung + Navigation zu Einstellungen. Überschreibt Auto-Klassifikation mit dialogbasierter Klassifikation + `user_confirmed: true`. (Unverändert — optionaler Schärfen-Schritt, zweitrangig seit dem Typ-Formular.)
- `FeedbackConfirmCard.tsx` — Yes/No auf LLM-generierte JSON-Summary.
- `FaqSuggestions.tsx` — Inline FAQ-Vorschläge **immer** (debounced 500ms, Wort-Overlap ≥2, Stoppwörter ignoriert). Im InputStep mit dem zusammengesetzten Feldtext als Input.
- `MyFeedbackList.tsx` — eigener Verlauf (gefiltert nach `user_id == profile.name`). Zeigt "Unklassifiziert" für Tickets ohne `category` (Alt-Tickets / LLM-Call fehlgeschlagen).
- `constants.ts` — `TEAMFLOW_AREAS`, Category/Status-Labels + Tailwind-Color-Maps (inkl. `ux` → `--tf-accent-*`, violett), **`FEEDBACK_TYPES`** (Typ-Schema + Feldsätze) + `composeFeedbackText`, **`LLM_CATEGORY_MAP`** (bug→problem, feature→idea, **ux→ux**, praise→praise, question→question), **`QUICK_TAGS`** (`@deprecated` seit v2.41, durch `FEEDBACK_TYPES` ersetzt).

## Typ-Formular + `structured` (v2.41, deterministisch)

Der Eingabe-Flow ist **LLM-unabhängig**: der User wählt einen Typ (Bug/Feature/UX/Frage/Lob) und füllt 2–3 typspezifische Felder. Die Kategorie steht damit ohne LLM fest, die Feldwerte landen als `FeedbackItem.structured` (`Record<string,string>`, optional — Alt-Tickets + Ein-Feld-Typen Lob/Frage haben es nicht). `structured` ist die primäre Quelle für `generateClaudeCodePrompt` (Repro-Schritte beim Bug, Ziel+Begründung beim Feature). `item.text` bleibt parallel ein lesbarer Fließtext (Board/Liste/Suche rendern darauf).

## Auto-Klassifikation (fire-and-forget, nur noch Verfeinerung)

Nach Absenden startet `autoClassifyFeedback(transport, text, context, area?, hint?)` weiterhin einen Single-Turn-LLM-Call. **Seit v2.41 überschreibt der `.then()`-Block die `category` NICHT mehr** (die ist deterministisch aus der Typ-Wahl gesetzt) — er setzt nur noch `llm_classification` + `llm_summary`. Bei Fehler/Streamlit passiert schlicht nichts; die per Typ gewählte Kategorie bleibt. UI wartet nicht auf den Call.

## Service-Layer (`src/core/services/feedback/`)

- `feedbackService.ts` — CRUD: localStorage primär (`teamflow_feedback_items`) + Shared-File-Sync (`_intern/feedback/feedback.json` im Datenverzeichnis, v1.9). Merge-by-id (User-Felder lokal, Kurator-Felder `kurator_status`/`kurator_priority`/`kurator_notes` shared-wins; `normalizeLegacyFields` mappt alte `admin_*`-Einträge beim Laden). FAQ-Helpers (`matchFaqEntries`, `createStandaloneFaq`, `bumpFaqAskCount`). `updateFeedback` Pick-Whitelist enthält `category` (damit Auto-Klassifikation das Feld nachträglich setzen kann).
- `feedbackLlm.ts` — `loadSystemPrompt(storage)` liest `_intern/feedback/system-prompt.md` (Fallback `DEFAULT_SYSTEM_PROMPT`). `buildFeedbackSystemPrompt(template, context)` ersetzt `{{PAGE}}`/`{{ROUTE}}`/`{{DEVICE}}`/`{{VIEWPORT}}`/`{{LAST_ACTION}}`/`{{SESSION_MINUTES}}`/`{{ERRORS}}`. 3 Parser portiert verbatim aus Referenz: `parseFeedbackSummary`, `parseBotResponse`, `renderSimpleMarkdown`. `initSystemPromptFile(storage)` schreibt Default-Template ins Datenverzeichnis (Button im Kurator-Config-Panel). **`autoClassifyFeedback(transport, text, context, area?)`** + **`CLASSIFICATION_PROMPT`** (kurzer JSON-only-Prompt für stille Hintergrund-Klassifikation).
- `feedbackContext.ts` — `captureFeedbackContext(activeId, activeName)` + Ring-Buffer für `window.onerror`/`unhandledrejection` (max 5).
- `promptGenerator.ts` — `generateClaudeCodePrompt(ticket)` mit TeamFlow-Constraints-Block. **Bevorzugt `ticket.structured`** (v2.41): rendert typspezifische `###`-Abschnitte — Bug: Schritte zur Reproduktion / Tatsächliches / Erwartetes Verhalten; Feature: Ziel / Begründung / Lösungsidee; UX: Aktuelles Problem / Gewünschte Verbesserung (nur nicht-leere Felder). Eine vorhandene `llm_classification.summary` wird als Einleitung vorangestellt, ersetzt die Felder aber nicht. Ohne `structured` (Alt-Tickets, Lob/Frage) → Fallback auf summary/details/Rohtext.
- `feedbackSponsoring.ts` — **`isSponsorableCategory(category)`** = `idea || ux` ist die Single Source of Truth, welche Kategorien sponsorbar sind (statt verstreuter `=== 'idea'`-Vergleiche). `isSponsoringOpen` und alle Board-/Kurator-Stellen routen darüber.

## Kurator-Plugin (`src/plugins/feedback/`, `id: 'feedback-kuration'`, `kuratorOnly: true`)

- `FeedbackAdminPage.tsx` — 5 Tabs (Tickets / Inbox / FAQ / Sponsoring / Einstellungen) via `@/ui/Tabs`.
- `sections/FeedbackTicketList.tsx` — Filter (Status/Kategorie/Bereich) als `CollapsibleSeg`-Dropdowns mit Live-Zählern (identisch zum öffentlichen Board, v2.21.4), Karten-Liste links.
- `sections/FeedbackInboxTab.tsx` — sammelt die persönlichen Feedback-Outboxen der read-only-Enduser ein (User-Folders-Root → `<user>/ZAH/feedback/outbox/*.json`). **v2.22: Auto-Collect** — `useAutoCollectFeedback` ([hooks/useAutoCollectFeedback.ts](../../src/plugins/feedback/hooks/useAutoCollectFeedback.ts)) importiert beim Öffnen des Moduls alle offenen Outbox-Einträge **ohne Review** direkt in die zentrale `feedback.json` (Status „neu"; Service `autoCollectFeedbackOutboxes`, Outbox-id als FeedbackItem-id → idempotent). Der Inbox-Tab dient weiterhin dem einmaligen User-Wurzel-Connect (FSAPI-Geste) + manuellem Nachladen/Override. **v2.41:** `submitToOutbox` (in `feedbackService.ts`) reicht jetzt `category` + `structured` mit, und `toFeedbackItem` mappt sie ins `FeedbackItem` — vorher gingen beide im prod-Pfad verloren (alles landete als „Unklassifiziert", obwohl der User den Typ gewählt hatte). `FeedbackOutboxItem` (`personal-storage/types.ts`) hat dafür `category?` (bestand) + `structured?` (neu).
- `sections/FeedbackTicketDetail.tsx` — Status-Dropdown, Priority-Slider, **Aufwand-Dropdown (S/M/L/XL, für sponsorbare Kategorien = Ideen + UX)**, **Sponsoring-Fortschritt-Block mit "Schwelle erreicht"-Hinweis**, Notizen, FAQ-Markierung + Antwort + Stichwörter, "Claude Code Prompt generieren" mit Copy + Download .md.
- `sections/FeedbackFaqTab.tsx` — Übersicht aller `is_faq===true` Items + manuell anlegen + bearbeiten + Markierung entfernen + löschen.
- `sections/FeedbackSponsoringOverview.tsx` — Phase 3: Features-Ranking nach Progress, konfigurierbare Schwellen (S/M/L/XL + Hours-Faktor + Budget/Quartal), Budget-Statistik.
- `sections/FeedbackConfigPanel.tsx` — Modell-Dropdown (Default `openai/gpt-oss-120b`), Max-Turns-Slider (2–12), System-Prompt-Pfad + Vorschau + "System-Prompt initialisieren"-Button (nur wenn Datei fehlt), Shared-File Status.

## Öffentliches Board (Phase 3, `src/plugins/feedback-board/`, `id: 'feedback-board'`, KEIN kuratorOnly)

- Sichtbar für alle User in Sidebar Tools-Gruppe (order: 75).
- `FeedbackBoardPage.tsx` — Header mit BudgetBadge + Kategorie-/Status-/Bereich-Filter-Chips (Kategorie inkl. **UX**) + sortierte Card-Liste.
- Sortierung: `in_bearbeitung` oben, dann Sponsoring-Progress desc (bei sponsorbaren = Ideen + UX), dann `created_at` desc. „Features"-Header-Zähler = `isSponsorableCategory` (Ideen + UX).
- Bugs ohne Sponsoring-Balken (werden immer gefixt).
- Sponsorbare Tickets (Ideen + UX) mit `effort_estimate` zeigen Balken + Sponsor-Buttons.

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
