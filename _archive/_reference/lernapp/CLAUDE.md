# CLAUDE.md

## Project Overview

KI-Praxis — KI-Arbeitskompetenz-Plattform für Wissensarbeiter und Organisationen mit Compliance-Anforderungen. Sidebar-basiertes Multi-Page Layout mit Abteilungskontext und Zwei-Stufen KI-Routing.

**Kernfeatures:**
- 5 Haupt-Seiten: Dashboard, Prompt Library, Prompt-Labor (Playground), Onboarding, Einstellungen
- Abteilungskontext (OrgContext): Privatgebrauch, Gesamte Organisation, oder 5 Abteilungen (Legal, Öffentlichkeitsarbeit, HR, IT, Bauverfahren)
- Zwei-Stufen KI-Routing: Interne KI vs. Externe Business-API mit Vertraulichkeitsklassifikation (open/internal/confidential)
- 126+ Prompts (76 generische + 50 abteilungsspezifische) mit `targetDepartment` + `confidentiality` Feldern
- Sidebar-Layout via AppShell für alle Seiten außer Login

## Tech Stack

- **Framework:** React 18 + TypeScript 5
- **Build:** Vite 5 (SWC plugin, dev server on port 8080)
- **Styling:** Tailwind CSS 3 with CSS variables design system in `src/index.css`
- **Components:** shadcn-ui (Radix UI primitives) in `src/components/ui/`
- **Routing:** React Router DOM 6 — Sidebar-Layout via AppShell. Routes: `/` (Dashboard), `/library`, `/playground`, `/onboarding`, `/settings`, `/login`, `/admin/teilnehmer`. Legacy redirects: `/workspace` → `/library`, `/analytics` → `/`, `/profil` → `/settings`
- **State:** React Context (`AuthContext`, `SyncContext`, `OrgContext`), local `useState`, React Query
- **Backend:** Supabase (Postgres + Auth + Edge Functions)
- **LLM:** OpenRouter / Lovable AI Gateway via `llm-proxy` edge function (streaming SSE)
- **Icons:** lucide-react
- **Forms:** React Hook Form + Zod (installiert, aktuell nicht aktiv genutzt)
- **Notifications:** Sonner (toast)
- **Dark mode:** next-themes (class-based toggling)
- **Package Manager:** npm (bun.lockb also present)

## Commands

```bash
npm run dev        # Start dev server (port 8080)
npm run build      # Production build (TypeScript check + Vite)
npm run build:dev  # Development mode build
npm run lint       # ESLint (flat config)
npm run preview    # Preview production build
```

## Project Structure

```
src/
├── components/
│   ├── ui/                         # shadcn-ui Primitives (48 Komponenten)
│   ├── playground/                 # Playground Sub-Komponenten
│   │   ├── ACTABuilder.tsx         # ACTA-Methode Builder
│   │   ├── ACTATemplates.ts        # ACTA-Vorlagen
│   │   ├── AgentKnobs.tsx          # Agent-Konfiguration
│   │   ├── ChatInput.tsx           # Chat-Eingabefeld mit animiertem Stop-Button
│   │   ├── ChatMessage.tsx         # Einzelne Chat-Nachricht (PROSE_CLASSES Konstante)
│   │   ├── ComparisonColumn.tsx   # Einzelne Spalte im Modell-Vergleich
│   │   ├── ModelSelect.tsx        # Wiederverwendbarer Modell-Selector (alle Gruppen)
│   │   ├── ChatPlayground.tsx      # Haupt-Chat-Bereich mit Lade-Indikator
│   │   ├── ComparisonView.tsx      # Modell-Vergleich
│   │   ├── ConversationHistory.tsx # Gesprächsverlauf
│   │   ├── IterationNudge.tsx      # Verbesserungsvorschläge nach erster KI-Antwort
│   │   ├── JudgePanel.tsx          # Judge-Bewertung durch Referenz-KI
│   │   ├── PlaygroundContent.tsx   # Gemeinsamer Tab-Content (Desktop/Mobile)
│   │   ├── PlaygroundHeader.tsx    # Playground Top-Bar
│   │   ├── PromptEvaluation.tsx    # Prompt-Bewertung
│   │   ├── SystemPromptEditor.tsx  # System-Prompt Editor
│   │   ├── TechniquePanel.tsx      # Technik-Auswahl
│   │   ├── TechniqueTemplates.ts   # Technik-Vorlagen
│   │   └── ThinkingBlock.tsx       # Aufklappbarer Denkprozess-Block
│   ├── admin/                      # Admin Sub-Komponenten
│   │   └── UsageOverview.tsx       # API-Verbrauch pro Teilnehmer (Kosten, Tokens, Budget-Mgmt)
│   ├── settings/                   # Settings Sub-Komponenten
│   │   ├── AIRoutingSettings.tsx   # KI-Konfiguration Tab
│   │   ├── AppearanceSettings.tsx  # Darstellung Tab
│   │   ├── ComplianceSettingsTab.tsx # Compliance Tab
│   │   ├── GeneralSettings.tsx     # Allgemein Tab
│   │   └── RolesSettings.tsx       # Rollen & Rechte Tab
│   ├── ACTAIntroduction.tsx        # Kombiniertes Intro: Vorher/Nachher + ACTA + Quick Challenge
│   ├── ACTAQuickChallenge.tsx      # Schnell-Challenge für ACTA-Methode
│   ├── ACTASection.tsx             # ACTA-Methode Erklärung
│   ├── AdvancedPromptingSection.tsx # Fortgeschrittene Techniken
│   ├── AppShell.tsx                # Sidebar-Layout mit Navigation (4 Nav-Items)
│   ├── BudgetDialog.tsx            # LLM Budget Info
│   ├── ConfidentialityBadge.tsx    # 🟢🟡🔴 Vertraulichkeits-Badges
│   ├── CreditsDialog.tsx           # Credits/Impressum Dialog
│   ├── DailyChallenge.tsx          # Tagesaufgabe auf dem Dashboard
│   ├── DataPrivacyIntro.tsx        # Datenschutz-Bonus-Modul (3 Stufen + Redaction-Drills)
│   ├── DecompositionAssistant.tsx  # Aufgaben-Zerlegung Assistent
│   ├── ExerciseCard.tsx            # Übungskarte mit LLM-Bewertung
│   ├── FlawExercise.tsx            # "Fehler finden" Übungstyp mit Checkboxen
│   ├── Footer.tsx                  # Footer
│   ├── GuestBanner.tsx             # Banner für Gast-Registrierung
│   ├── Logo.tsx                    # Typografisches Logo mit sidebar-Variant
│   ├── MySkills.tsx                # Persönliche Skill-Sammlung (speichern, bearbeiten, exportieren)
│   ├── PendingReviews.tsx          # Review-Workflow (Mock)
│   ├── PracticeArea.tsx            # Übungs-Grid Container
│   ├── PracticeAreaCompact.tsx     # Kompakte Version der Übungen für Onboarding
│   ├── PromptDetail.tsx            # Prompt-Detail-Modal
│   ├── PromptLibrary.tsx           # Prompt-Bibliothek mit Abteilungs-Tabs
│   ├── RedactionExercise.tsx       # Datenschutz-Übung: Sensible Daten erkennen
│   ├── StatCard.tsx                # Wiederverwendbare Statistik-Karte
│   ├── TeamMembers.tsx             # Team-Mitglieder (Mock)
│   ├── ThemePresetPicker.tsx       # Theme-Presets Auswahl
│   ├── ThemeProvider.tsx           # Theme Provider
│   ├── ThemeToggle.tsx             # Dark/Light Toggle
│   ├── UserMenu.tsx                # Dropdown mit Profil/Admin/Logout
│   └── themePresets.ts             # Theme-Preset Definitionen
├── contexts/
│   ├── AuthContext.tsx              # Auth State, OTP Login, Guest Login, Session
│   ├── SyncContext.tsx              # Progress Sync (localStorage ↔ Supabase)
│   └── OrgContext.tsx               # Abteilungs-/Organisationskontext
├── data/
│   ├── prompts.ts                  # 126+ Prompts mit targetDepartment + confidentiality
│   ├── exercises.ts                # 8 Übungen mit departmentVariants
│   ├── dailyChallenges.ts          # 25 Tagesaufgaben (prompt-improve, workflow, spot-the-flaw)
│   ├── flawChallenges.ts           # 10 "Fehler finden" Challenges mit eingebauten Fehlern
│   ├── redactionDrills.ts          # 10 Datenschutz-Übungen (sensible Daten erkennen)
│   ├── orgUseCases.ts              # 25 Use Cases mit Abteilungszuordnung
│   ├── learningPath.ts             # 2 Pflicht + 5 Bonus Onboarding-Module
│   ├── models.ts                   # Modelle + AIRoutingConfig (Standard/Premium/OpenSource)
│   ├── actaExamples.ts             # ACTA-Beispiele pro Abteilung
│   └── decompositionExamples.ts    # Dekompositions-Beispiele
├── hooks/
│   ├── useAuth.ts                  # Auth Hook re-export
│   ├── useChat.ts                  # Chat-State + Streaming + Thinking
│   ├── useConversations.ts         # Conversation-Management (localStorage)
│   ├── useCustomModels.ts          # Custom OpenRouter Modelle
│   ├── useDailyChallenge.ts        # Tagesaufgabe: Auswahl, History, Streak
│   ├── useExerciseEvaluation.ts    # LLM-basierte Prompt-Bewertung
│   ├── useExerciseProgress.ts      # Übungs-Fortschritt
│   ├── useMySkills.ts              # CRUD für persönliche Skills (localStorage)
│   ├── use-mobile.tsx              # Mobile Breakpoint Detection
│   └── use-toast.ts                # Toast Hook
├── integrations/supabase/
│   ├── client.ts                   # Supabase Client Init
│   └── types.ts                    # Generierte DB Types
├── services/
│   ├── llmService.ts               # streamChat() SSE Client + onThinking, saveUserKey()
│   ├── constraintService.ts        # CRUD für Qualitätsregeln (Constraint Library)
│   └── kiContextService.ts         # CRUD für persönlichen KI-Kontext (Arbeitsregeln)
├── lib/
│   ├── constants.ts                # LS_KEYS, ROUTES, BADGE_COLORS, PRIORITY_COLORS, RISK_COLORS, SEVERITY_COLORS, LEVEL_BADGE_COLORS, DEFAULT_MODEL
│   ├── utils.ts                    # cn() Tailwind Class Merger
│   ├── promptUtils.ts              # extractVariables(), matchesCategory() — zentralisiert
│   ├── contextBuilder.ts           # Baut System-Prompt-Prefix aus KI-Kontext + Constraints
│   ├── exportSkill.ts              # Markdown + Agent Skill (ZIP) Export
│   └── storage.ts                  # Zentraler localStorage-Zugriff (Key-Registry im Header)
├── pages/
│   ├── Dashboard.tsx               # Übersicht + DailyChallenge + Analytics (Collapsible)
│   ├── Library.tsx                 # Tabs: Prompts | Use Cases | Meine Skills | Team | Reviews
│   ├── Playground.tsx              # Chat mit Zwei-Stufen KI-Auswahl (in AppShell, Sidebar collapsed)
│   ├── Onboarding.tsx              # Lernpfad: 2 Pflicht + 5 Bonus Module
│   ├── Settings.tsx                # Tabs: Mein Konto | Allgemein | Rollen | Compliance | KI-Konfiguration | Darstellung
│   ├── Profile.tsx                 # Exportiert ProfileContent (eingebettet in Settings)
│   ├── Login.tsx                   # Email OTP + Guest Code Login
│   ├── AdminParticipants.tsx       # Admin: Kurs-/Teilnehmerverwaltung + API-Verbrauch Tab
│   └── NotFound.tsx                # 404 Seite
├── App.tsx                         # Root: Router + Providers + PlatformLayout
├── main.tsx                        # Entry Point mit ThemeProvider
└── index.css                       # Globale Styles & CSS Variable Design System

supabase/
├── config.toml                     # Supabase Projekt-Konfiguration
├── migrations/                     # SQL Migrations (Schema, RLS, Triggers)
└── functions/                      # Deno Edge Functions
    ├── check-enrollment/           # Validiert Kurscode + Email-Whitelist
    ├── evaluate-prompt/            # LLM-basierte Übungsbewertung (Tool Use)
    ├── guest-login/                # Erstellt Guest Auth User
    ├── llm-proxy/                  # Streaming LLM Proxy (Budget + Key Management)
    ├── save-user-key/              # Verschlüsselt Custom OpenRouter API Keys
    └── auth-email-hook/            # Custom Email-Templates für Supabase Auth
```

### Gelöschte Dateien (Dead Code — NICHT wieder erstellen)
- `src/data/prompts.generated.ts` — Generierte Prompt-Daten, ersetzt durch `prompts.ts`
- `src/components/AnalyticsSection.tsx` — Unbenutztes Dashboard-Widget
- `src/components/playground/PlaygroundSidebar.tsx` — Unbenutzte Playground-Sidebar
- `src/components/ResourcesSection.tsx` — Unbenutzte Ressourcen-Sektion
- `src/components/PromptExamples.tsx` — Unbenutzte Prompt-Beispiele
- `src/components/OrganizationUseCases.tsx` — Unbenutzte Use-Cases-Komponente
- `src/components/LevelCard.tsx` — Unbenutzte Level-Karte
- `src/components/SyncStatusIcon.tsx` — Unbenutzter Sync-Indikator
- `src/components/feedback/ScreenRefMode.tsx` — War kaputt, ersetzt durch `ScreenRefPicker.tsx`

### Große Dateien (Kandidaten für zukünftiges Splitting)
- `src/components/playground/ACTABuilder.tsx` (1.346 Zeilen) — Enthält 5+ Sub-Komponenten
- `src/data/prompts.ts` (3.204 Zeilen) — Statische Prompt-Daten, könnte lazy-loaded werden

### shadcn/ui Komponenten
Einige shadcn/ui-Komponenten in `src/components/ui/` werden aktuell nicht verwendet, bleiben aber für zukünftige Nutzung erhalten. Bei Bedarf mit `npx shadcn-ui@latest add <name>` neu generieren.

## Architecture

### Layout
- **AppShell** (Sidebar + Content) für alle Seiten außer Login
- **PlatformLayout** wrapper in `App.tsx`: `<AppShell>` + `<GuestBanner>` + children
- **Sidebar:** `collapsible="icon"` auf allen Seiten. 4 Kern-Seiten: Dashboard, Onboarding, Prompt Sammlung, Prompt Werkstatt. Einstellungen, Team, Reviews, Credits, Teilnehmer sind über das UserMenu (Avatar links unten) erreichbar. Routen bleiben alle bestehen: /, /onboarding, /library, /playground, /settings, /team, /reviews, /admin/teilnehmer.
- **Playground:** In AppShell integriert, Sidebar startet collapsed (`defaultOpen={false}`). Eigener sticky Header (`PlaygroundHeader`) mit `SidebarTrigger`. AppShell-Header wird auf `/playground` ausgeblendet. `playground-root` nutzt `h-full` statt `h-screen`.

### Provider Hierarchy
`QueryClientProvider` → `TooltipProvider` → `BrowserRouter` → `AuthProvider` → `SyncProvider` → `OrgProvider` → Routes

### Abteilungskontext (OrgContext)
- 7 Scopes: `privat`, `organisation`, `legal`, `oeffentlichkeitsarbeit`, `hr`, `it`, `bauverfahren`
- Bestimmt welche Prompts, Beispiele, Use Cases angezeigt werden
- Gespeichert in `localStorage` (`org_scope` key)
- `isDepartment` / `isOrg` computed flags

### KI-Routing (Zwei-Stufen)
- Jeder Prompt hat `confidentiality: "open" | "internal" | "confidential"`
- Playground wählt KI-Stufe (Intern/Extern) automatisch vor
- Vertrauliche Prompts blockieren externe API
- `AIRoutingConfig` in `src/data/models.ts` steuert Routing-Regeln
- Modelle: Standard (Gemini 3 Flash, Sonnet 4.6, GPT-5.4), Premium (Opus 4.6, Gemini 3.1 Pro), Open Source (7 Modelle), Custom

### Prompt Library
- 126+ Prompts in `src/data/prompts.ts`, gefiltert nach Abteilung
- Dynamischer Abteilungs-Tab wenn Abteilung gewählt
- 6 Level: `alltag`, `beruf`, `websuche`, `research`, `blueprint`, `organisation`
- Felder: `category`, `title`, `prompt`, `level`, `type`, `constraints`, `targetDepartment`, `confidentiality`, `riskLevel`, `official`
- `extractVariables()` und `matchesCategory()` zentralisiert in `src/lib/promptUtils.ts`

### Meine Skills
- User speichert Prompts als persönliche Skills (localStorage `my_saved_skills`)
- Bearbeiten: Titel, Prompt-Text, Variablen, Notizen, Ziel-Modell
- Export: Markdown (Wiki/Confluence) + Agent Skill ZIP (agentskills.io Format, via JSZip)
- Erreichbar über Library Tab "Meine Skills"

### Daily Challenge
- Tagesaufgabe auf Dashboard mit 3 Typen: `prompt-improve`, `workflow`, `spot-the-flaw`
- Deterministisch nach Datum (gleicher Tag = gleiche Aufgabe)
- Abteilungsfilter aktiv
- Streak-Tracking in localStorage

### Onboarding
- 2 Pflicht-Module: "Einführung & ACTA-Methode" + "Üben: Dein erster guter Prompt"
- 5 Bonus-Module: Prompting-Stufen, Zerlegung, Fortgeschrittene Techniken, Datenschutz, Checklisten
- Erfolgs-Meldung nach Pflicht-Abschluss
- Alte Modul-IDs werden auf neue gemappt (Abwärtskompatibilität)

### Prompt-Labor (Playground)
- Zwei-Stufen KI-Auswahl (Intern/Extern) mit Vertraulichkeits-Routing
- ThinkingBlock: Aufklappbarer Denkprozess (`reasoning_content` aus SSE-Stream)
- Lade-Indikator: Bouncing-Dots zwischen Senden und erstem Token
- IterationNudge: Vorschläge nach erster Antwort
- JudgePanel: Referenz-KI bewertet Output (Sidebar)
- Conversation-Management mit localStorage-Persistenz
- **PromptBrowser:** Kategorie-Dropdown + Vorlagen/Skills-Toggle (gleiche Filterlogik wie PromptLibrary via `matchesCategory()`)
- **Geteilte Komponenten:** `ModelSelect.tsx` (Modell-Dropdown), `ComparisonColumn.tsx` (Vergleichsspalte)
- **PROSE_CLASSES** Konstante in `ChatMessage.tsx` — Markdown-Styling nicht inline ändern!
- **Layout-Kette:** `h-full` (innerhalb SidebarInset) → `flex-1 overflow-hidden` → `flex-col-layout` → `scroll-container`. Kommentare mit ⚠️ markieren kritische CSS-Stellen.
- **CSS Utilities** in `src/index.css`: `scroll-container`, `flex-col-layout`, `flex-col-fill`, `truncate-safe` bündeln fehleranfällige Flex/Overflow-Kombinationen

### Settings
- 6 Tabs: Mein Konto | Allgemein | Rollen & Rechte | Compliance | KI-Konfiguration | Darstellung
- "Mein Konto" enthält Profil-Funktionalität (importiert `ProfileContent` aus `Profile.tsx`)
- `/profil` redirected auf `/settings`

### KI-Kontext & Qualitätsregeln (Feature: Qualitätsschicht)
Zwei zusammenhängende Features:
- **KI-Kontext** (`kiContextService.ts`): Persönliche Arbeitsregeln und Profildaten, die als System-Prompt-Prefix bei jeder LLM-Anfrage mitgesendet werden.
- **Constraint Library** (`constraintService.ts`): Qualitätsregeln, die der User aus Erfahrungen ableitet. Aktive Constraints fließen ebenfalls in den KI-Kontext.
- **Context Builder** (`contextBuilder.ts`): Assembliert den System-Prompt-Prefix aus beiden Quellen.
- localStorage Keys: `ps-ki-context`, `ps-constraints`
- Integration: `useChat.ts` nutzt `buildContextPrefix()` um den System-Prompt automatisch zu erweitern.

### Lernpfad (Onboarding-Redesign)
Die Onboarding-Seite zeigt einen 5-stufigen Lernpfad als vertikale Timeline:
1. Formulieren (bestehende Module: ACTA, Übungen, RAKETE + Bonus)
2. Bewerten (Prüfen-Funktion, Spot the Flaw)
3. Unterscheiden (Erkenne den Unterschied)
4. Artikulieren (Rejection-Workflow)
5. Systematisieren (KI-Kontext, Qualitätsregeln)

Fortschritt wird über `useLernpfadProgress` Hook berechnet.
Stufen-Daten in `src/data/learningPath.ts` (lernpfadStufen).
Sidebar-Label: "Onboarding". Route: /onboarding.

### Auth System (`AuthContext`)
- **Email OTP:** Kurscode + Email → `check-enrollment` validiert → Supabase sendet OTP → 8-stelliger Code
- **Guest Tokens:** Admin erstellt Tokens → User gibt Code ein → `guest-login` erstellt Auth User + Session
- **Guest Upgrade:** Gast-User können Email via OTP auf der Settings-Seite verknüpfen
- **Admin Role:** Geprüft via `user_roles` Tabelle (separiert von Profilen für Sicherheit)

### Progress Sync (`SyncContext`)
- **Offline-first:** Alle Fortschritte in `localStorage` (`user_progress_v2` key)
- **Cloud Sync:** Bei Login merged Local + Cloud State (Union für Übungen/Lektionen, Max für Quiz-Scores)
- **Tracked:** Exercise Results (Prompt + Score + Feedback), Completed Lessons, Quiz Scores, Challenge Cards
- **Sync Status:** `idle | syncing | synced | error | offline`

### LLM Integration
- **Evaluate Prompt:** `evaluate-prompt` Edge Function nutzt LLM Tool Calling für Scoring
- **Streaming Chat:** `llm-proxy` Edge Function proxied zu OpenRouter (SSE). Nutzt `OPENROUTER_API_KEY` für Provisioned-Zugang.
- **Usage Tracking:** `llm-proxy` loggt jeden Request in `api_usage_log` (Tokens, geschätzte Kosten). Admin-Dashboard (`UsageOverview`) zeigt aggregierte Statistiken pro Teilnehmer.
- **Key Sources:** Provisioned (OpenRouter via `OPENROUTER_API_KEY`, Budget/User) oder Custom OpenRouter Key (AES-256-GCM verschlüsselt)
- **Budget Management:** Admins können Budget pro User oder Bulk für alle Teilnehmer setzen (via `UsageOverview`)
- **Model Selection:** User wählt Modell auf Settings-Seite (Default: `google/gemini-3-flash-preview`)

### Feedback-System
- **Komponenten:** `src/components/feedback/` — FeedbackButton (FAB), FeedbackPanel (Wizard), FeedbackChatbot (LLM-Chat), FeedbackConfirmCard (Bestätigungskarte)
- **Services:** `feedbackService.ts` (CRUD, Dual-Mode mit FeedbackRow-Typ), `feedbackLlm.ts` (System-Prompts, alle Parser: `parseFeedbackSummary` + `parseBotResponse` + `renderSimpleMarkdown`, `ChatMsg` Interface)
- **Admin:** `FeedbackTicketList`, `FeedbackTicketDetail`, `FeedbackConfigPanel` in `src/components/admin/`
- **DB:** `feedback` + `feedback_config` Tabellen (Migration: `20260315120000_feedback_tables.sql`)
- **ScreenRefPicker:** `src/components/feedback/ScreenRefPicker.tsx` — Overlay-Picker der alle `data-feedback-ref` Elemente hervorhebt. Basiert auf TourOverlay-Mechanismus (z-index Elevation via `getBoundingClientRect`). Elemente werden per z-index 102 über das Overlay (z-index 100) gehoben, klickbare Rahmen auf z-index 105. Erreichbar über "Bereich markieren" Button im FeedbackPanel (DetailsStep). Ersetzt die alte kaputte ScreenRefMode. CSS-Klassen `.feedback-ref-mode`, `.feedback-ref-highlight`, `.feedback-ref-overlay` bleiben in `index.css` (Legacy).
- **Bekannte Einschränkung:** Supabase-Typen für `feedback`/`feedback_config` Tabellen noch nicht generiert — temporärer `FeedbackRow` Typ in `feedbackService.ts`. Supabase-Client-Calls nutzen weiterhin `as any` Cast auf `from()`.
- **Phase 2 UI (2026-03-16):** Chatbot visuell überarbeitet — Chat-Bubbles (User rechts primary, Bot links muted), Online-Indikator Header, animierter Typing-Indikator (●●●), einfaches Markdown-Rendering (**fett**→strong), Bestätigungskarte mit primary/5% Hintergrund + primary/30% Border, grüner Bestätigungs-Button, Container-Höhe 400–520px
- **Phase 3 UI (2026-03-16):** Admin-Dashboard visuell überarbeitet — Zwei-Spalten-Layout (Ticket-Liste links, Detail rechts) statt Tabelle+Sheet. Ticket-Liste als Karten mit Kategorie-Badge, ID, Datum, Summary, Kontext-Zeile. Ausgewähltes Ticket mit `border-l-primary + bg-primary/5`. Detail-Panel inline mit 2×2 Metadaten-Grid, Nutzer-Bestätigungsblock, Prompt-Ansicht mit Dark-Code-Block (`#1a1a2e`), Kopieren/Export-Buttons. Responsive: `grid-cols-1 lg:grid-cols-2`. Dezente Tab-Buttons statt große Tabs.

### Database Schema (Supabase/Postgres)
- `courses` — Kurs-Definitionen (id als Text PK, enrollment_open, max_participants, default_key_budget)
- `enrollment_whitelist` — Email-Allowlist pro Kurs
- `user_profiles` — Display Name, Auth Method, course_id, preferred_model
- `user_roles` — Rollenbasierter Zugang (admin/user Enum)
- `guest_tokens` — Temporäre Gast-Zugangscodes mit Ablauf
- `user_progress` — Synchronisierter Fortschritt (Lessons, Quizzes, Challenges, Werkstatt)
- `user_projects` — User ML Projekt-Daten (Pipeline Config, Models, Evaluation)
- `user_api_keys` — Provisioned Budget + verschlüsselte Custom OpenRouter Keys. Admin RBAC: Admins können alle Keys lesen/schreiben.
- `api_usage_log` — Token-/Kosten-Tracking pro LLM-Request (user_id, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, request_type). Insert via Service Role aus `llm-proxy`. RLS: User sehen eigene Logs, Admins sehen alle.
- Alle Tabellen haben RLS aktiviert. Admin-Checks nutzen `has_role()` Security Definer Function.

## Design System

Farben als HSL CSS Variables in `src/index.css`:
- **Primary:** Terracotta/Orange (`--primary: 15 55% 52%`)
- **Background:** Warmes Beige (`--background: 48 33% 97%`)
- **Foreground:** Dunkles Braun (`--foreground: 48 20% 20%`)
- **Sidebar:** Dunkles warmes Braun (`--sidebar: 30 15% 18%`)
- **Sidebar Hover:** `bg-primary/8` (Tailwind-Klasse, dezente Aufhellung)
- **Sidebar Active:** `bg-primary/15 text-primary` (Tailwind-Klassen, klar sichtbar)

**Badges — IMMER aus `BADGE_COLORS` importieren (`src/lib/constants.ts`):**
```ts
import { BADGE_COLORS, PRIORITY_COLORS, RISK_COLORS, SEVERITY_COLORS } from "@/lib/constants";
// BADGE_COLORS.low     → 🟢 bg-primary/10 text-primary
// BADGE_COLORS.medium  → 🟡 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400
// BADGE_COLORS.high    → 🔴 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400
// BADGE_COLORS.neutral → bg-muted text-muted-foreground
// PRIORITY_COLORS      → { niedrig, mittel, hoch } → Badge-Farben
// RISK_COLORS          → { niedrig, mittel, hoch, kritisch } → Badge-Farben
// SEVERITY_COLORS      → { kritisch, mittel, hinweis } → Badge-Farben
```
NIEMALS die Tailwind-Strings manuell kopieren! Immer aus Constants importieren.

**Vertraulichkeits-Badges:** `ConfidentialityBadge.tsx` Komponente nutzen (nutzt intern `BADGE_COLORS`).

**Theme Presets:** muted-stone-contrast, muted-moss-light, silber

**Einheitliche Komponenten:**
- `StatCard` — Wiederverwendbar für alle Statistik-Karten
- Card-Stil: CSS-Klasse `card-section` verwenden (definiert in `src/index.css`)
- Seitentitel: CSS-Klasse `page-title` verwenden (definiert in `src/index.css`)
- Seiten-Layout: `<div className="space-y-6">` → Header → Content

## Wichtige Regeln für Claude Code

- **KEINE off-theme Farben** (kein `blue-100`, `emerald-100`, `purple-100`, `cyan-100`). NUR Theme-Farben.
- **Alle Seiten** folgen dem Pattern: `<div className="space-y-6">` → Header → Content
- **Seitentitel** immer: `className="page-title"` (NICHT `text-2xl font-bold tracking-tight` manuell)
- **Card-Stil** immer: `className="card-section"` (NICHT `p-5 rounded-xl border border-border shadow-sm` manuell)
- **Badge-Farben:** `BADGE_COLORS` / `PRIORITY_COLORS` / `RISK_COLORS` aus `@/lib/constants` importieren, KEINE raw amber/red Strings
- **Keine neuen npm-Dependencies** ohne Absprache
- **Dark Mode** muss immer funktionieren
- **Content ist auf Deutsch** (UI Labels, Prompts, Übungen, Fehlermeldungen)
- **Compliance-Hinweise** in Prompt-Texten (z.B. `[JURIST:IN PRÜFEN]`, `KEINE ECHTEN NAMEN`)
- **Imports:** `@/*` Path Alias (maps to `src/*`)
- **Styling:** Tailwind Utility Classes only (keine separaten CSS-Dateien)
- **State:** Contexts für globalen State (`AuthContext`, `SyncContext`, `OrgContext`), `useState` für lokalen
- **Feedback:** Toast Notifications via Sonner (`toast.success()`, `toast.error()`)
- **Edge Functions:** Deno Runtime, `serve()` from std, Supabase Client, CORS Headers

## Environment Variables

Frontend (in `.env`, prefixed `VITE_`):
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key
- `VITE_SUPABASE_PROJECT_ID` — Project ID

Edge function secrets (set via Lovable, kein separates Supabase Dashboard):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — auto-provided
- `OPENROUTER_API_KEY` — OpenRouter API Key für Provisioned LLM-Zugang (ersetzt `LOVABLE_API_KEY`)
- `ENCRYPTION_KEY` — 256-bit hex key for AES-GCM encryption of custom API keys

## Linting & TypeScript

- ESLint flat config with TypeScript ESLint, react-hooks, and react-refresh plugins
- `@typescript-eslint/no-unused-vars` is disabled
- TypeScript strict mode is off; `noImplicitAny: false`
- Target: ES2020, JSX: react-jsx

## Regeln für Coding-Agenten

### Konstanten
- **localStorage Keys:** Immer `LS_KEYS.*` aus `src/lib/constants.ts` verwenden, NIE strings hardcoden
- **Route-Pfade:** Immer `ROUTES.*` aus `src/lib/constants.ts` verwenden
- **Badge-Farben:** `BADGE_COLORS.*` / `PRIORITY_COLORS` / `RISK_COLORS` / `SEVERITY_COLORS` aus constants importieren. `LEVEL_BADGE_COLORS` für Prompt-Level-Badges. `ConfidentialityBadge` Komponente für Vertraulichkeits-Anzeige. NIEMALS raw Tailwind-Badge-Strings (`bg-amber-50 text-amber-800 ...`) manuell schreiben!
- **Default-Modell:** `DEFAULT_MODEL` aus constants

### CSS-Utilities (in `src/index.css`, NICHT aufbrechen!)
- `scroll-container` — flex-1 + min-h-0 + overflow-y-auto
- `flex-col-layout` — flex + flex-col + h-full + min-h-0
- `flex-col-fill` — flex + flex-col + flex-1 + min-h-0
- `truncate-safe` — min-w-0 + truncate
- `card-section` — p-5 + rounded-xl + border + border-border + shadow-sm
- `playground-root` — h-full + flex-col + overflow-hidden + bg-background
- `page-title` — text-2xl + font-bold + tracking-tight

### Dateigrößen
- Neue Komponenten sollten unter 250 Zeilen bleiben
- Bei >250 Zeilen: Sub-Komponenten in gleichem Ordner extrahieren
- Seiten delegieren Logik an Hooks, UI an Sub-Komponenten

### Typen
- Alle geteilten Typen in `src/types/index.ts`
- Komponentenspezifische Props-Interfaces bleiben in der Komponentendatei

### Utility-Funktionen
- `extractVariables()`, `matchesCategory()` → `src/lib/promptUtils.ts`
- `cn()` → `src/lib/utils.ts`
- localStorage → `src/lib/storage.ts` (loadFromStorage, saveToStorage, etc.)
- Export-Funktionen → `src/lib/exportSkill.ts`

### Neue Seiten
- In `src/pages/` anlegen, default export
- In `App.tsx` als lazy import + Route hinzufügen
- In AppShell wrappen (außer Login/Playground)

### Neue Hooks
- In `src/hooks/` anlegen
- Rückgabewert als Interface dokumentieren
- localStorage-Keys aus `LS_KEYS` importieren

## Notes

- Lovable-managed project with `lovable-tagger` plugin active in dev
- `.env` contains only public Supabase anon key (safe to commit)
