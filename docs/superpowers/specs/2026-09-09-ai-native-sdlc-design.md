# AI-native SDLC für TeamFlow Local

Stand: 2026-09-09 · Ausgangspunkt: Nutzerbitte vom 2026-09-08, das neue Playbook von Anthropic und den Skill `grill-with-docs` in den Entwicklungszyklus zu übernehmen.

## 0. Anlass

In den Worten des Auslösers: *„bitte das neue SDLC playbook von anthropic lesen und vorschlagen wie wir es implementieren können und ebenso den skill grillme with docs ansehen und sagen wie wir es in unserem development cycle implementieren können. Brauchen wir eigene skills und kannst du diese erstellen?"*

Quellen: [The AI-Native SDLC Playbook](https://claude.com/blog/the-ai-native-sdlc-playbook) (Anthropic, Sept. 2026) und das Repo [mattpocock/skills](https://github.com/mattpocock/skills) (Matt Pocock; `grill-with-docs` = `grilling` + `domain-modeling`).

## 1. Warum

Das Playbook verlegt den Engpass vom Schreiben des Codes auf Planung, Review und Test und beantwortet das mit zwei Hebeln: **jede Stufe hinterlässt ein versioniertes Artefakt** (`intent.md` → `spec.md` → `plan.md` → Diff+Tests → Review → Incident) und **Policy wird Code** (CLAUDE.md, Skills, deterministische Hooks, Subagenten, `REVIEW.md`, Evals der Agent-Konfiguration). Der Grill-Skill greift das erste Glied: Missverständnis vor dem Bauen ist die häufigste Fehlerquelle; die Antwort ist ein Interview in **Frontier-Runden** (alle jetzt beantwortbaren Fragen auf einmal, nummeriert, jede mit empfohlener Antwort; Fakten holt der Agent selbst; Ende, wenn die Frontier leer ist), das nebenbei ein Glossar pflegt.

Für dieses Repo gilt beides schon in Teilen — die Lücken sind konkret: Regeln, die nur als Prosa existieren und regelmäßig gebrochen werden (Heredocs unter Windows, `git add -A` bei parallelen Sessions), Cheatsheets, die niemand automatisch öffnet, und ein Interview-Format, das im verpflichtenden Brainstorming eine Frage pro Nachricht stellt statt der ganzen Frontier.

## 2. Befunde aus dem Bestand

Inventar am 2026-09-08 (Explore-Lauf über `.claude/`, `docs/agents/`, `package.json`, `src/__tests__/`, `docs/superpowers/`, Git-Remote):

| Playbook-Element | Bestand | Lücke |
|---|---|---|
| `intent.md` | fehlt; Auslöser steht als Kopfzeile oder „Warum" in der Spec | kein Pflicht-Abschnitt |
| `spec.md` / `plan.md` | [docs/superpowers/](../README.md), 5× genutzt (2 lebend, 3 archiviert); 77 Plan-Modus-Pläne außerhalb des Repos | keine Schablone, keine Schwelle |
| CLAUDE.md | 59 248 Byte von 67 300 (Guard `doc-links`), Entscheidungsbaum mit ~70 Zeilen | — |
| Skills | genau eine ([feedback-kontext-pflege](../../../.claude/skills/feedback-kontext-pflege/SKILL.md)); 23 Cheatsheets unter [docs/agents/](../../agents/README.md) laden nicht automatisch | Router-Touch-Point-Fehler v1.15 entstand genau so |
| Hooks | keine (weder `.claude/settings.json` noch global) | Regeln kosten Selbstkorrektur-Turns |
| Subagenten | keine Definitionen; generische Nutzung, per Regel im Hauptlauf gehalten | bewusst |
| Feedback-Loop | `check:docs` 6 s · `check:quick` 26 s · `check` 33 s; Selbst-Abnahme in `dev:local` | — |
| Evals der Agent-Konfiguration | keine; App-Evals (`eval:skills`, Triage, Gedächtnis) messen die Anwendung | statischer Guard fehlt |
| `REVIEW.md` | fehlt; `/code-review` (Plugin) liest die Datei laut Doku direkt | — |
| CI / PR-Review | keine CI, kein PR-Fluss, Commit auf `master`; Remote existiert | nicht Ziel |
| Control-Band | [health-baseline.test.ts](../../../src/__tests__/health-baseline.test.ts) (Struktur), `Plan-Queue.bat` = headless Loop mit hartem Gate | Prozess-Metriken fehlen |
| Glossar | nur nutzerseitig ([docs/feedback-kontext/glossar.md](../../feedback-kontext/glossar.md)); Entwickler-Begriffe verstreut in 44 Themen-Docs | — |

## 3. Entwurf

Entscheidungen des Nutzers (Frontier-Runde 2026-09-08): eigener deutscher Grill-Skill statt Plugin · Glossar ja, ADRs nein · leichte Artefakt-Kette · die acht riskantesten Cheatsheets als Zeiger-Skills.

### 3.1 Versionierte Konfiguration

`.claude/settings.json` mit `permissions.deny` für eingefrorene Pfade (`_archive/`, `_reference/`, `src/generated/`, `package-lock.json`, die 2-MB-Eval-Fixture) und einem `PreToolUse`-Hook auf `Bash|PowerShell`: [scripts/hooks/bash-guard.mjs](../../../scripts/hooks/bash-guard.mjs) blockt Heredocs/Here-Strings, `git add` ohne Pathspec und verwerfende Git-Befehle mit Exit 2 und deutschem Grund. Fail-open bei Parse-Fehlern, kein Bypass-Marker. Nicht gesperrt: `docs/_archiv/` (Doku-Konvention 8 verschiebt dorthin), `CHANGELOG.md` (Skeleton wird ausgefüllt), Lesezugriffe.

### 3.2 Skill `grillen`

[.claude/skills/grillen/SKILL.md](../../../.claude/skills/grillen/SKILL.md), modell-aufrufbar, als Frage-Schritt des Brainstormings: Runde 0 = Fakten (Entscheidungsbaum, die vier Bitte≠Bedarf-Fragen per Grep/Explore, Befund vor Q1) → Frontier-Runden mit `❓ Qn` / `➡️ Empfehlung` → Pflicht-Zweige dieses Repos (vier Sichtbarkeits-Achsen, Persistenz-Ort, Ebene, Status-Domäne, Variante, Belegpflicht, Abnahme-Weg) → Glossar-Abgleich inline → Ende bei leerer Frontier, zurück in den Rahmen. Kein Bauen aus dem Skill heraus.

### 3.3 Acht Zeiger-Skills

Je ein dünner `SKILL.md` (Trigger-Beschreibung + drei Schritte: Cheatsheet lesen, jeden Touch-Point abarbeiten und fehlende nachtragen, Gate) für `add-plugin`, `add-feature-flag`, `add-csv-field`, `add-idb-store`, `add-settings-section`, `add-sidecar-persistence`, `add-view`, `add-filter-facet`. Die Cheatsheets bleiben die einzige Quelle.

### 3.4 Glossar und Review-Policy

[CONTEXT.md](../../../CONTEXT.md) im Root, nur Begriffe (Bedeutung in einem Satz, *nicht sagen*, Quelle), geerntet aus den Themen-Docs; zwei geflaggte Mehrdeutigkeiten (Statuskürzel vs. Bearbeiter-Kürzel; App-Skill vs. Claude-Code-Skill). Keine ADRs — Gründe bleiben als Warum-Absatz im Themen-Doc. [REVIEW.md](../../../REVIEW.md) mit vier Pässen (Constraints & Pitfalls · Spec-Treue · Beleg · Doku-Nachzug), Nit-Deckel 5, Ausnahmen für Generiertes.

### 3.5 Leichte Artefakt-Kette

[docs/superpowers/README.md](../README.md): Spec-Schablone mit `## 0. Anlass` als Pflicht-Abschnitt, Plan-Schablone, **Schwelle** (neues Plugin/Flag/Store/Sidecar/Skill/Hook oder mehr als fünf Dateien → Spec und Plan ins Repo; darunter bleibt der Plan-Modus-Plan außerhalb), Archivregel. Das lebende Exemplar vom 2026-08-04 wird nachgerüstet.

### 3.6 Guard über die Agent-Konfiguration

[src/__tests__/agent-konfiguration.test.ts](../../../src/__tests__/agent-konfiguration.test.ts) in `check:docs`: Skill-Frontmatter (Name = Ordner, Beschreibung vorhanden und ≤ 1024 Zeichen), Zeiger-Skills verlinken existierende Cheatsheets, `settings.json` parsebar und Hook-Skripte vorhanden, `pruefeBefehl()` blockt die drei Regelklassen und lässt Alltagsbefehle durch, jede Spec trägt `## 0. Anlass`. Der Link-Guard `doc-links` prüft zusätzlich alle `SKILL.md`, `REVIEW.md`, `CONTEXT.md` und die neuen Docs.

### 3.7 Prozess-Doc

[docs/architecture/entwicklungsprozess.md](../../architecture/entwicklungsprozess.md) als Ist-Zustand: Stufen → Artefakte → Werkzeuge hier; was bewusst **nicht** übernommen wird (PR-Review-Loop/CI, Claude Security, Claude Tag, Managed Settings, Verifier-Subagent, dynamische Evals, Produktions-Monitoring — je mit Grund); drei Messgrößen, die nichts kosten.

## 4. Verifikation

- `agent-konfiguration` und `doc-links` je einmal **rot** gesehen (fehlendes Hook-Skript, Spec ohne Anlass), dann grün; `npm run check:docs`, `npm run check`.
- Hook-Unit über stdin: `git add -A` → Exit 2, `git status` → Exit 0, `cat <<EOF` → 2, `git push --force-with-lease` → 0.
- `wc -c CLAUDE.md` < 67 300.
- Nächste Session: Live-Block des Hooks, Deny auf `src/generated/**`, `/grillen`-Format sichtbar. Nach ~4 Wochen `/skill-doctor`: Zeiger-Skills ohne Aufruf werden gestrichen.
