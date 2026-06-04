# Feedback-System

Integriertes User-Feedback + Admin-Dashboard + öffentliches Board mit Sponsoring (Phase 1+2+3 komplett).

## User-Komponenten (`src/components/feedback/`)

- `FeedbackButton.tsx` — globaler FAB (z-index 40, bottom-right). Wird in `Shell.tsx` gerendert (innerhalb NavigationContext) und ist während aktiver Tour ausgeblendet.
- `FeedbackPanel.tsx` — 2-Step-Flow (Input → Bestätigung) + optional Chatbot. Panel öffnet direkt im Textfeld ("Was möchtest du uns mitteilen?"), keine Kategorie-Auswahl mehr. Unter dem Textarea drei Quick-Tag-Chips (aus `QUICK_TAGS` in `constants.ts`) die beim Klick einen Starter-Text vorfüllen und Cursor ans Ende setzen. Tags verschwinden nach Klick oder beim ersten Tippen. Bereich-Dropdown bleibt optional. Sterne-Rating entfernt. Bestätigungs-Step-Button heißt jetzt "Details ergänzen" (öffnet Chatbot mit Originaltext).
- `FeedbackChatbot.tsx` — Multi-Turn-LLM-Dialog via `transport.submitConversation()`. Bei Streamlit-Transport: freundliche Meldung + Navigation zu Einstellungen. Überschreibt Auto-Klassifikation mit dialogbasierter Klassifikation + `user_confirmed: true`.
- `FeedbackConfirmCard.tsx` — Yes/No auf LLM-generierte JSON-Summary.
- `FaqSuggestions.tsx` — Inline FAQ-Vorschläge **immer** (debounced 500ms, Wort-Overlap ≥2, Stoppwörter ignoriert). Erscheint direkt nach dem Textarea (zwischen Textfeld und Quick-Tags).
- `MyFeedbackList.tsx` — eigener Verlauf (gefiltert nach `user_id == profile.name`). Zeigt "Unklassifiziert" für Tickets ohne `category` (LLM-Call fehlgeschlagen oder noch nicht fertig).
- `constants.ts` — `TEAMFLOW_AREAS`, Category/Status-Labels + Tailwind-Color-Maps, **`QUICK_TAGS`** (3 Chip-Vorlagen), **`LLM_CATEGORY_MAP`** (bug→problem, feature→idea, ux→idea, praise→praise, question→question).

## Auto-Klassifikation (fire-and-forget)

Nach Absenden im FeedbackPanel startet `autoClassifyFeedback(transport, text, context, area?)` einen Single-Turn-LLM-Call (`transport.submitMessage` mit kurzem `CLASSIFICATION_PROMPT`, `thinkingBudget: 'low'`). Bei Erfolg: `updateFeedback` setzt `llm_classification`, `llm_summary`, `category` (via `LLM_CATEGORY_MAP`). Bei Fehler/Streamlit: Ticket bleibt ohne Kategorie (Badge "Unklassifiziert"), kein Error-Toast. UI wartet nicht auf den Call — Bestätigungs-Step erscheint sofort.

## Service-Layer (`src/core/services/feedback/`)

- `feedbackService.ts` — CRUD: localStorage primär (`teamflow_feedback_items`) + Shared-File-Sync (`_intern/feedback/feedback.json` im Datenverzeichnis, v1.9). Merge-by-id (User-Felder lokal, Kurator-Felder `kurator_status`/`kurator_priority`/`kurator_notes` shared-wins; `normalizeLegacyFields` mappt alte `admin_*`-Einträge beim Laden). FAQ-Helpers (`matchFaqEntries`, `createStandaloneFaq`, `bumpFaqAskCount`). `updateFeedback` Pick-Whitelist enthält `category` (damit Auto-Klassifikation das Feld nachträglich setzen kann).
- `feedbackLlm.ts` — `loadSystemPrompt(storage)` liest `_intern/feedback/system-prompt.md` (Fallback `DEFAULT_SYSTEM_PROMPT`). `buildFeedbackSystemPrompt(template, context)` ersetzt `{{PAGE}}`/`{{ROUTE}}`/`{{DEVICE}}`/`{{VIEWPORT}}`/`{{LAST_ACTION}}`/`{{SESSION_MINUTES}}`/`{{ERRORS}}`. 3 Parser portiert verbatim aus Referenz: `parseFeedbackSummary`, `parseBotResponse`, `renderSimpleMarkdown`. `initSystemPromptFile(storage)` schreibt Default-Template ins Datenverzeichnis (Button im Kurator-Config-Panel). **`autoClassifyFeedback(transport, text, context, area?)`** + **`CLASSIFICATION_PROMPT`** (kurzer JSON-only-Prompt für stille Hintergrund-Klassifikation).
- `feedbackContext.ts` — `captureFeedbackContext(activeId, activeName)` + Ring-Buffer für `window.onerror`/`unhandledrejection` (max 5).
- `promptGenerator.ts` — `generateClaudeCodePrompt(ticket)` mit TeamFlow-Constraints-Block (file://, Single-File-Build, Tailwind v4, React 19, Zustand, lucide-react, Deutsche UI, CLAUDE.md primär).

## Kurator-Plugin (`src/plugins/feedback/`, `id: 'feedback-kuration'`, `kuratorOnly: true`)

- `FeedbackAdminPage.tsx` — 5 Tabs (Tickets / Inbox / FAQ / Sponsoring / Einstellungen) via `@/ui/Tabs`.
- `sections/FeedbackTicketList.tsx` — Filter (Status/Kategorie/Bereich) als `CollapsibleSeg`-Dropdowns mit Live-Zählern (identisch zum öffentlichen Board, v2.21.4), Karten-Liste links.
- `sections/FeedbackInboxTab.tsx` — sammelt die persönlichen Feedback-Outboxen der read-only-Enduser ein (User-Folders-Root → `<user>/ZAH/feedback/outbox/*.json`). **v2.22: Auto-Collect** — `useAutoCollectFeedback` ([hooks/useAutoCollectFeedback.ts](../../src/plugins/feedback/hooks/useAutoCollectFeedback.ts)) importiert beim Öffnen des Moduls alle offenen Outbox-Einträge **ohne Review** direkt in die zentrale `feedback.json` (Status „neu"; Service `autoCollectFeedbackOutboxes`, Outbox-id als FeedbackItem-id → idempotent). Der Inbox-Tab dient weiterhin dem einmaligen User-Wurzel-Connect (FSAPI-Geste) + manuellem Nachladen/Override.
- `sections/FeedbackTicketDetail.tsx` — Status-Dropdown, Priority-Slider, **Aufwand-Dropdown (S/M/L/XL, nur für Ideen)**, **Sponsoring-Fortschritt-Block mit "Schwelle erreicht"-Hinweis**, Notizen, FAQ-Markierung + Antwort + Stichwörter, "Claude Code Prompt generieren" mit Copy + Download .md.
- `sections/FeedbackFaqTab.tsx` — Übersicht aller `is_faq===true` Items + manuell anlegen + bearbeiten + Markierung entfernen + löschen.
- `sections/FeedbackSponsoringOverview.tsx` — Phase 3: Features-Ranking nach Progress, konfigurierbare Schwellen (S/M/L/XL + Hours-Faktor + Budget/Quartal), Budget-Statistik.
- `sections/FeedbackConfigPanel.tsx` — Modell-Dropdown (Default `openai/gpt-oss-120b`), Max-Turns-Slider (2–12), System-Prompt-Pfad + Vorschau + "System-Prompt initialisieren"-Button (nur wenn Datei fehlt), Shared-File Status.

## Öffentliches Board (Phase 3, `src/plugins/feedback-board/`, `id: 'feedback-board'`, KEIN kuratorOnly)

- Sichtbar für alle User in Sidebar Tools-Gruppe (order: 75).
- `FeedbackBoardPage.tsx` — Header mit BudgetBadge + Filter-Pills (Alle/Bugs/Features/Offen/Umgesetzt) + sortierte Card-Liste.
- Zeigt nur Bugs (problem) + Features (idea); Fragen/Lob/archivierte ausgefiltert.
- Sortierung: `in_bearbeitung` oben, dann Sponsoring-Progress desc (bei Features), dann `created_at` desc.
- Bugs ohne Sponsoring-Balken (werden immer gefixt).
- Features mit `effort_estimate` zeigen Balken + Sponsor-Buttons.

## Board-Komponenten (`src/components/feedback/`)

- `FeedbackBoardCard.tsx` — Einzelne Karte mit Status/Kategorie/Aufwand/Progress/Sponsor-Buttons/Sponsor-Liste.
- `SponsorButton.tsx` — Punkte-Dropdown (1/2/3/5) + Stunden-Dialog (hours + project_ref) + "Du sponsorst"-Badge mit Zurückziehen.
- `BudgetBadge.tsx` — `X/Y Punkte (Q2 2026)` mit Ampelfarbe (grün >5, gelb 2-5, rot 0-1).

## Sponsoring-Service (`src/core/services/feedback/`)

- `budgetService.ts` — `getCurrentQuarter()`, `loadUserBudget(userId)` (auto-Reset bei Quartalswechsel), `spendPoints`, `refundPoints`, `checkQuarterReset` (beim App-Start).
- `feedbackService.ts` erweitert: `sponsorTicket()` (Budget-Check + Doppel-Check + Merge-Write), `unsponsorTicket()` (Refund), `getSponsoringProgress(ticket, config)` (combined = points + hours × factor), `isSponsoringOpen(ticket)` (nur Ideen mit Aufwand + Status `neu`/`geplant`), `setEffortEstimate(storage, id, effort)`.

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
