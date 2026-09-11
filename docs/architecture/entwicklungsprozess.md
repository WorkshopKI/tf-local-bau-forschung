# Entwicklungsprozess — der AI-native SDLC in diesem Repo

Ist-Zustand seit v6.38 (2026-09-09), verschlankt mit v6.58. Vorlage ist Anthropics [AI-Native SDLC Playbook](https://claude.com/blog/the-ai-native-sdlc-playbook): sechs Stufen, jede hinterlässt ein versioniertes Artefakt, und Policy ist Code (CLAUDE.md, Skills, Hooks, Review-Policy, Evals der Agent-Konfiguration). Dazu das Interview-Format aus [mattpocock/skills](https://github.com/mattpocock/skills) (`grill-with-docs` = `grilling` + `domain-modeling`), hier als eigener Skill `grillen`. Entstehung: [Spec](../superpowers/specs/2026-09-09-ai-native-sdlc-design.md) und [Plan](../superpowers/plans/2026-09-09-ai-native-sdlc.md); Verschlankung: [Spec](../superpowers/specs/2026-09-11-turnaround.md).

## 1. Stufen → Artefakte → Werkzeuge

| Stufe (Playbook) | Artefakt hier | Werkzeug |
|---|---|---|
| **Plan** (`intent.md`) | `## 0. Anlass` als Pflicht-Abschnitt jeder Spec, in den Worten des Auslösers (Feedback-Item, Beobachtung, Zitat) | Skill `grillen` (Runde 0 = Befund), Guard `agent-konfiguration` prüft die Überschrift |
| **Design** (`spec.md`) | `docs/superpowers/specs/YYYY-MM-DD-<slug>.md` ab Schwelle — Spec und freigegebener Plan in **einer** Datei | Brainstorming mit `grillen` als Frage-Schritt; Schablone in [docs/superpowers/README.md](../superpowers/README.md); Begriffe aus [CONTEXT.md](../../CONTEXT.md) |
| **Build** (Code, CLAUDE.md, Skills, Hooks, Agent) | der Plan-Modus-Plan — ab Schwelle als `## 4. Schritte` der Spec, sonst außerhalb des Repos | Plan-Modus ab Schwelle, von Claude selbst aufgerufen; [CLAUDE.md](../../CLAUDE.md) (Entscheidungsbaum, Pitfalls); neun Skills unter `.claude/skills/`; Agent `doku-nachzug` unter `.claude/agents/`; Hook + Deny-Regeln in [.claude/settings.json](../../.claude/settings.json) |
| **Test** (Feedback-Loop, Evals) | grüne Gate-Kette, Abnahme in `dev:local` | `check:docs` (8 s) → gezielte Tests → `check` (~50 s; `check:quick` = Alias); statischer Guard [agent-konfiguration.test.ts](../../src/__tests__/agent-konfiguration.test.ts) statt dynamischer Evals |
| **Deploy** (Review, Gates, CI/CD) | Commit auf `master` nach grünem Gate; `build:devpl` als Bundle-Nachweis | [REVIEW.md](../../REVIEW.md) für `/code-review`; `Plan-Queue.bat` fährt headless mit hartem Gate |
| **Maintain** (Monitoring, Loop) | Control-Band = [health-baseline.test.ts](../../src/__tests__/health-baseline.test.ts); Intake = Feedback-Board der App | Feedback-Item → `## 0. Anlass` → Stufe Plan |

**Schwelle** für eine Spec im Repo (und für den Plan-Modus): neues Plugin, Flag, IDB-Store, Sidecar, Skill, Hook oder Agent. Die Zahl geänderter Dateien zählt nicht — sie traf fast jedes Feature. Darunter startet die Sitzung im normalen Modus; ein Bugfix mit klarer Reproduktion geht direkt.

## 2. Die Bausteine

### Skills (`.claude/skills/`)

- **`grillen`** — das Interview vor dem Bauen: Runde 0 liefert den Befund (Entscheidungsbaum, die vier Fragen *gibt es das schon / ist das die Antwort / halb da und kaputt / gibt es das Hindernis*), dann Frontier-Runden mit nummerierten Fragen und je einer Empfehlung, Pflicht-Zweige dieses Repos (vier Sichtbarkeits-Achsen, Persistenz, Ebene, Status-Domäne, Variante, Beleg, Abnahme), Glossar-Abgleich inline. Modell-aufrufbar, damit das Brainstorming ihn per Skill-Tool erreicht.
- **Acht Zeiger-Skills** (`plugin-anlegen`, `feature-flag-anlegen`, `csv-feld-anlegen`, `idb-store-anlegen`, `einstellung-anlegen`, `sidecar-anlegen`, `view-anlegen`, `filter-facet-anlegen`) — je drei Zeilen: Cheatsheet lesen, jeden Touch-Point abarbeiten und fehlende nachtragen, Gate. Das Cheatsheet unter [docs/agents/](../agents/README.md) bleibt die einzige Quelle; der Skill sorgt nur dafür, dass es geöffnet wird. Ein Zeiger-Skill, den `/skill-doctor` nach Wochen nie feuern sah, wird gestrichen (Kontext-Last).
- **`feedback-kontext-pflege`** — der ältere Skill für die Bildschirmseiten-Docs, gleiche Bauform.

### Agent (`.claude/agents/`)

- **`doku-nachzug`** ([doku-nachzug.md](../../.claude/agents/doku-nachzug.md)) — schreibt nach grünem `check` aus Diff und Anlass den Doku-Nachzug (Changelog-Skeleton, `changelog-user.md`, Kontext-Doc, `CONTEXT.md`, Themen-Doc, Entscheidungsbaum-Zeile), nie Code, nie Commits. Läuft im Hintergrund, parallel zu `build:devpl` und der Abnahme; der Hauptlauf prüft den Diff und committet. Modell wie der Hauptlauf, Effort `high` — Doku braucht weniger Denkzeit als Code. Experiment: bleibt, wenn `npm run turnaround` die Wirkung zeigt.

### Hook und Deny-Regeln ([.claude/settings.json](../../.claude/settings.json))

- `PreToolUse` auf `Bash|PowerShell` → [scripts/hooks/bash-guard.mjs](../../scripts/hooks/bash-guard.mjs): blockt Heredocs/Here-Strings, `git add` ohne Pathspec (`-A`, `--all`, `.`, `-u`) und verwerfende Git-Befehle (force-push ohne `--force-with-lease`, `reset --hard`, `checkout -- .`, `restore .`, `clean -f`, `stash drop|clear`) mit Exit 2 und Grund. Fail-open bei Parse-Fehlern, kein Bypass. Die Regeln sind pure Funktion (`pruefeBefehl`) und im Guard getestet; die Hülle liest stdin. Der Hook greift ohne Neustart, sobald die Datei gespeichert ist.
- `permissions.deny` für Edit/Write auf `_archive/**`, `_reference/**`, `src/generated/**`, `package-lock.json` und die 2-MB-Eval-Fixture. Nicht gesperrt: `docs/_archiv/` (Doku-Konvention 8 verschiebt dorthin), `CHANGELOG.md` (das Skeleton wird ausgefüllt), Lesezugriffe.

### Review-Policy ([REVIEW.md](../../REVIEW.md))

Vier Pässe — Constraints & Pitfalls, Spec-Treue gegen `## 0. Anlass`, Beleg, Doku-Nachzug — mit Definition von „Wichtig", Nit-Deckel 5 und Ausnahmen für Generiertes. `/code-review` liest die Datei direkt.

### Glossar ([CONTEXT.md](../../CONTEXT.md))

Nur Begriffe, mit *nicht sagen* und Quelle; geflaggte Mehrdeutigkeiten (Kürzel, Skill, Phase, Ebene, Snapshot, Gate, Rolle, Meilenstein). Keine ADRs: Gründe bleiben als Warum-Absatz im Themen-Doc (Doku-Konvention 2).

### Guard der Agent-Konfiguration ([agent-konfiguration.test.ts](../../src/__tests__/agent-konfiguration.test.ts))

Skill-Frontmatter (Name = Ordner, Beschreibung ≤ 1024 Zeichen), Links in Skills, Agent-Frontmatter (Name = Dateiname, Beschreibung), `settings.json` parsebar mit existierenden Hook-Skripten, die Regelklassen von `pruefeBefehl()`, `## 0. Anlass` in jeder Spec. Dazu prüft `doc-links` alle `SKILL.md`, `REVIEW.md`, `CONTEXT.md` und dieses Doc. Läuft in `check:docs`.

## 3. Bewusst nicht übernommen

| Playbook-Element | Warum nicht |
|---|---|
| PR-Review-Loop, CI/CD, `@claude`-Kommentare | kein PR-Fluss; Einzelentwickler committet auf `master`; das unabhängige Gate ist `Plan-Queue.bat` |
| Claude Security, Claude Tag | Enterprise-Funktionen bzw. Slack/Teams; hier ohne Gegenstück |
| Managed Settings | Einzelentwickler — `.claude/settings.json` ist die Team-Ebene |
| Verifier-Subagent | die Abnahme bleibt im Hauptlauf (CLAUDE.md § Abnahme); ein `dev:local`-Server |
| Dynamische Evals (`claude -p` gegen Standardaufgaben) | Token-Kosten ohne OpenRouter, `claude plugin eval` im Early Access; der statische Guard fängt, was ohne Modell prüfbar ist |
| Produktions-Monitoring, Control Bands auf Betriebsmetriken | `file://`-App ohne Telemetrie; der Intake ist das Feedback-Board |

Kandidaten für später: Commit-Gate-Hook (Marker eines frischen `npm run check`), Minimal-CI bei Push, dynamische Evals, ein Skill, der ein Feedback-Item in einen Anlass überführt.

## 4. Messgrößen, die nichts kosten

- **Durchlaufzeit je Commit**: `npm run turnaround` ([turnaround-metrik.mjs](../../scripts/turnaround-metrik.mjs)) wertet die Claude-Code-Sitzungsprotokolle aus — Claude-aktiv (Modell + Tools), Nutzer-Warten, Gate-Läufe und rote Läufe, Output-Tokens und Geschriebenes nach Kategorie, zwei Perioden nebeneinander. Stand 2026-09-11 (06.–11.09., 40 Commits): **19,5 min Claude-aktiv je Commit, davon 14,1 min Modellzeit**; Gates 2,3 min und 1,3 rote Läufe je Commit; Nutzer-Warten 4,7 min. Der Hebel sitzt in der Modellzeit, nicht in den Guards: im August kosteten die Gates mehr (3,0–3,2 min, 1,6–1,9 rote Läufe je Commit). Die Kontextgröße bremst kaum (kurze Antworten 4,0 s bei 150k gegen 4,6 s bei über 450k Tokens).
- **Effort bleibt `xhigh`.** Seit September entstehen je Commit 81k Output-Tokens statt 54–64k, bei weniger Geschriebenem — das Mehr ist Denken. Wie viele Minuten das kostet, trennen die Protokolle nicht sauber (die Modellzeit je Token schwankt zwischen den Perioden). `high` brachte früher Nachfixe, und ein Nachfix kostet einen ganzen Commit (~20 min). Der Tempo-Hebel ohne weniger Denken wäre `/fast` (gleiches Modell, schnellere Ausgabe, Aufpreis) — bewusst nicht gewählt.
- **First-Pass-Quote** der Plan-Queue: Anteil `OK`-Zeilen in `_plans/done/verlauf.log` je Monat.
- **Skill-Nutzung**: `/skill-doctor` einmal im Monat; Skills ohne Aufruf streichen, Skills mit vielen Aufrufen auf Sprawl prüfen.
- **Hook-Treffer**: geblockte Kommandos je Monat (Grund erscheint im Chat); sinkt die Zahl auf null, hat die Regel gewirkt — sie bleibt trotzdem.

## 5. Erweitern

- **Neue Hook-Regel**: erst der Testfall in `agent-konfiguration.test.ts` (rot), dann die Regel in `REGELN` von `bash-guard.mjs` (grün). Regeln, die eine Freigabe im Chat brauchen, gehören nicht in den Hook — der kennt keine Ausnahme.
- **Neuer Zeiger-Skill**: nur nach einem belegten Fehlgriff (Touch-Point übersehen). Bauform kopieren, Beschreibung als Trigger („Use when …"), kein Prozess in der Beschreibung.
- **Neuer Agent**: nur für Arbeit, die parallel zum Hauptlauf auf **disjunkten** Dateien läuft; Gate, Abnahme und Commit bleiben im Hauptlauf. Frontmatter mit `name` = Dateiname (Guard).
- **Neuer Begriff**: in derselben Grill-Runde nach `CONTEXT.md`, mit Quelle.
