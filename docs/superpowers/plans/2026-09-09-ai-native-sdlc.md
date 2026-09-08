# AI-native SDLC für TeamFlow Local — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHER SUB-SKILL: `superpowers:executing-plans` (Schritte mit Checkboxen). Gate/Abnahme/Commit bleiben im Hauptlauf.

**Grundlage:** [docs/superpowers/specs/2026-09-09-ai-native-sdlc-design.md](../specs/2026-09-09-ai-native-sdlc-design.md) · Umgesetzt am 2026-09-09 (v6.38); die Dateinamen der Artefakte tragen das Umsetzungsdatum, nicht das der Entscheidung.

## Kontext

Anthropics [AI-Native SDLC Playbook](https://claude.com/blog/the-ai-native-sdlc-playbook) (Sept. 2026) beschreibt sechs Stufen (Plan → Design → Build → Test → Deploy → Maintain), die je ein versioniertes Artefakt hinterlassen (`intent.md` → `spec.md` → `plan.md` → Diff+Tests → Review → Incident) und Policy als Code führen: CLAUDE.md, Skills (`.claude/skills/*/SKILL.md`), deterministische Hooks, Subagenten (`.claude/agents/`), Review-Policy (`REVIEW.md`), Evals der Agent-Konfiguration. Matt **Pocock**s `grill-with-docs` (Repo `mattpocock/skills`) ist ein 1-Zeilen-Router über zwei Skills: `grilling` (Frontier-Runden: alle jetzt beantwortbaren Fragen auf einmal, nummeriert, mit empfohlener Antwort; Fakten holt der Agent selbst; Ende = Frontier leer) und `domain-modeling` (Glossar `CONTEXT.md` inline pflegen, ADRs nur nach Drei-Kriterien-Test).

**Befund im Repo** (Inventar 2026-09-08): Vieles lebt hier schon, teils weiter als im Playbook — CLAUDE.md mit Entscheidungsbaum und Byte-Deckel (59,2 KB von 67,3 KB), Plan-Modus als globaler Default, Spec→Plan-Kette unter `docs/superpowers/` (5× genutzt), drei Gate-Kommandos mit gemessenen Zeiten, Selbst-Abnahme-Regel, `health-baseline` als Control-Band, `Plan-Queue.bat` als headless Loop mit hartem Gate. **Es fehlen**: Skills (1 statt der 23 Cheatsheets, die nicht auto-laden — Ursache des Router-Touch-Point-Fehlers v1.15), Hooks (0; die Regeln „keine Heredocs", „nie `git add -A`" kosten heute Selbstkorrektur-Turns), ein Entwickler-Glossar, eine Review-Policy, ein Anlass-Artefakt, ein Guard über die Agent-Konfiguration.

**Entscheidungen des Nutzers** (Frontier-Runde 2026-09-08): eigener deutscher Grill-Skill statt Plugin · Glossar ja, ADRs nein · leichte Artefakt-Kette (Anlass als Pflicht-Abschnitt der Spec, Spec+Plan ins Repo ab Schwelle) · die riskantesten 8 Cheatsheets als Zeiger-Skills.

**Bewusst nicht übernommen** (steht so im Prozess-Doc): PR-Review-Loop/CI/CD (kein PR-Fluss, Commit auf master, Gate lokal + Plan-Queue), Claude Security/Claude Tag (Enterprise/Slack), Managed Settings (Einzelentwickler), Verifier-Subagent (Abnahme bleibt laut CLAUDE.md im Hauptlauf, ein `dev:local`-Server), dynamische `claude -p`-Evals (Token-Kosten, kein OpenRouter; statischer Guard stattdessen, `claude plugin eval` ist Early Access), Produktions-Monitoring (`file://`, keine Telemetrie — Intake ist das Feedback-Board).

## Global Constraints

- **CLAUDE.md-Deckel** 67 300 Byte, aktuell 59 248 — Zuwachs hier ≤ 1,5 KB, Detail wandert ins Prozess-Doc.
- **Doku-Konvention 2**: Detail genau einmal — Cheatsheets bleiben die Quelle, Skills sind Zeiger.
- **Shell (Windows)**: keine Heredocs; Dateien nur per Write/Edit; Commit-Message per `.git/COMMIT_MSG.tmp`.
- **Parallele Sessions**: nur eigene Dateien stagen (Pathspec), `git status --short` vor `git add`.
- **Gate**: `npm run check:docs` nach jedem Doc/Guard, `check:quick` nach Skript-Änderung, `npm run check` vor Commit; danach `npm run build:devpl` im Hintergrund (stehende Regel, hier reiner Bundle-Nachweis — kein `src/`-Laufzeitcode betroffen).
- **Neuer Guard einmal ROT sehen**, bevor er als grün gilt.
- Hooks/Permissions aus `.claude/settings.json` laden beim **Session-Start** — Live-Abnahme des Hooks und der Deny-Regeln erst in der nächsten Session; in dieser Session nur der Unit-Test.

---

## Dateien im Überblick

| Datei | Rolle |
|---|---|
| `.claude/settings.json` (**neu**, versioniert) | `permissions.deny` für eingefrorene Pfade + `PreToolUse`-Hook auf `Bash\|PowerShell` |
| `scripts/hooks/bash-guard.mjs` (**neu**) | Deterministischer Wächter: Heredocs/Here-Strings, `git add -A/./-u`, verwerfende Git-Befehle → Exit 2 + Grund auf stderr; pure Funktion `pruefeBefehl()` exportiert |
| `src/__tests__/agent-konfiguration.test.ts` (**neu**) | Guard: Skill-Frontmatter, Hook-Skripte existieren, `settings.json` parsebar, `bash-guard`-Regeln (Import wie in `version-bump.test.ts`) |
| `src/__tests__/doc-links.test.ts` | `DOC_FILES` um `REVIEW.md`, `CONTEXT.md`, `docs/superpowers/README.md`, `docs/architecture/entwicklungsprozess.md` und alle `.claude/skills/*/SKILL.md` erweitern |
| `.claude/skills/grillen/SKILL.md` (**neu**) | Der Interview-Skill (modell-aufrufbar, deutsch) |
| `.claude/skills/{plugin,feature-flag,csv-feld,idb-store,einstellung,sidecar,view,filter-facet}-anlegen/SKILL.md` (**neu**, 8×) | Zeiger-Skills nach dem Muster von `feedback-kontext-pflege` |
| `CONTEXT.md` (**neu**, Root) | Entwickler-Glossar, nur Begriffe |
| `REVIEW.md` (**neu**, Root) | Review-Policy für `/code-review` (liest die Datei laut Doku direkt) |
| `docs/superpowers/README.md` (**neu**) | Spec-/Plan-Schablone, Abschnitt `## 0. Anlass`, Schwelle, Archivregel |
| `docs/superpowers/specs/2026-08-04-begleitphase-eigene-sicht-design.md` | Nachrüsten `## 0. Anlass` (Text steht schon in der Kopfzeile) |
| `docs/superpowers/specs/2026-09-09-ai-native-sdlc-design.md` + `plans/2026-09-09-ai-native-sdlc.md` (**neu**) | Spec + dieser Plan als erste Artefakte der leichten Kette |
| `docs/architecture/entwicklungsprozess.md` (**neu**) | Ist-Zustand: Playbook-Stufen → unsere Bausteine; was bewusst nicht übernommen wird; Messgrößen |
| `CLAUDE.md` | 4 Zeilen im Entscheidungsbaum, 2 Sätze in „Planung: schlank halten" |
| `docs/agents/README.md` | Spalte „Skill" für die 8 Cheatsheets mit Zeiger-Skill |
| `CHANGELOG.md`, `package.json` | `npm run version:bump -- minor "…"` (kein `--user`: nicht nutzersichtbar) |

---

## Entwurf je Baustein

### A · Versionierte Konfiguration (Stufe 3/5: Hooks als Leitplanken)

`.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "Edit(_archive/**)", "Write(_archive/**)",
      "Edit(_reference/**)", "Write(_reference/**)",
      "Edit(src/generated/**)", "Write(src/generated/**)",
      "Edit(package-lock.json)", "Write(package-lock.json)",
      "Edit(src/core/services/skill-eval/fixtures/eval-fixtures.data.json)",
      "Write(src/core/services/skill-eval/fixtures/eval-fixtures.data.json)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash|PowerShell",
        "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/scripts/hooks/bash-guard.mjs\"", "timeout": 10 } ] }
    ]
  }
}
```

Nicht gesperrt (bewusst): `docs/_archiv/` (Doku-Konvention 8 verschiebt dorthin), `CHANGELOG.md` (Skeleton wird ausgefüllt), Read-Zugriffe (Anweisung reicht, kein Sicherheitsfall).

`scripts/hooks/bash-guard.mjs` — liest stdin-JSON (`tool_input.command`), Regeln als Liste `{ muster: RegExp, grund: string }`:

1. Heredoc/Here-String: `<<-?\s*['"]?[A-Za-z_]`, `<<<\s`, PowerShell `@"` / `@'` am Zeilenende → „Shell-Konvention 1: Inhalt per Write-Tool erzeugen, dann die Datei verwenden."
2. `git add` mit `-A`, `--all`, `.`, `-u`, `--update` → „Nur eigene Dateien per Pathspec stagen (parallele Sessions)."
3. Verwerfend: `git push … --force`/`-f` (nicht `--force-with-lease`), `git reset --hard`, `git checkout -- .`, `git restore .`, `git clean -f…`, `git stash drop|clear` → „Verwerfende Git-Operation: der Nutzer führt sie selbst im Terminal aus."

Trifft eine Regel: Grund auf stderr, `process.exit(2)`. Sonst Exit 0. Parse-Fehler → Exit 0 mit Hinweis (fail-open: ein kaputter Hook darf die Session nicht lahmlegen). Kein Bypass-Marker — Determinismus ist der Zweck. Kommando ohne `.sh` im Namen, damit die Windows-Autoerkennung nichts voranstellt (Lehre aus superpowers' `run-hook.cmd`).

### B · Skill `grillen` (Stufe 1/2: Alignment vor dem Bauen)

`.claude/skills/grillen/SKILL.md`, Frontmatter: `name: grillen`, `description` modell-seitig (deutsch): greift, wenn ein Vorhaben/Plan/Entwurf geschärft werden soll, bevor gebaut wird; Trigger „grill mich", „Rückfragen", „Plan prüfen", und als Frage-Schritt des Brainstormings. **Kein** `disable-model-invocation` (Brainstorming muss ihn per Skill-Tool erreichen).

Körper (≤ 80 Zeilen, nach `writing-for-agents`: Schritte vorn, Referenz hinten, positiv formuliert):

1. **Runde 0 — Fakten, nicht Fragen.** Entscheidungsbaum in CLAUDE.md lesen; die vier Bitte≠Bedarf-Fragen (gibt es das schon? ist das Gewünschte die Antwort? halb da und kaputt? gibt es das Hindernis?) per Grep/Explore-Agent beantworten und als **Befund** vor Q1 zeigen. Fakten werden nie beim Nutzer erfragt; eine laufende Suche blockiert nur die Fragen, die von ihr abhängen.
2. **Frontier-Runden.** Entscheidungsbaum aufspannen; alle jetzt beantwortbaren Fragen in **einer** Runde, Format `❓ Q1 – Titel: Frage` / `➡️ Empfehlung`; abhängige Fragen in die nächste Runde; nach jeder Antwort Frontier neu berechnen.
3. **Pflicht-Zweige dieses Repos** (nur wenn berührt): vier Sichtbarkeits-Achsen (Flag · Freischaltung · Beta/Experten · `kuratorOnly`), Persistenz-Ort und Schreibprofil (kv/IDB/Sidecar/Snapshot), Ebene (Verbund/TV), Status-Domäne (Kategorie-Helfer, nie Rohstatus), Variante/Build, Belegpflicht (jede Zahl: Einheit, Quelle, am echten Bestand gemessen), Abnahme-Weg (`dev:local` oder `file://`-Handtest).
4. **Glossar-Abgleich.** Begriffe gegen `CONTEXT.md` halten; Widerspruch sofort benennen; aufgelösten Begriff **inline** eintragen. Bei schwer umkehrbaren Entscheidungen fragen, ob ein Warum-Absatz im Themen-Doc fehlt (kein ADR-Ordner).
5. **Ende.** Frontier leer → Zusammenfassung „gemeinsames Verständnis" → zurück in den Rahmen (Ansätze → Design → Spec mit `## 0. Anlass`). Kein Bauen aus diesem Skill heraus.

### C · Acht Zeiger-Skills (Stufe 3: Skills als verteilte Policy)

Muster = `.claude/skills/feedback-kontext-pflege/SKILL.md` (einziger bestehender Repo-Skill): Frontmatter mit Trigger-Beschreibung (aus dem ersten Absatz des Cheatsheets), Körper drei Schritte: (1) Cheatsheet lesen, (2) **jeden** Touch-Point abarbeiten — fehlt einer, Cheatsheet ergänzen statt nur Code, (3) `npm run check:quick`, Build laut `which-build-to-run.md`.

| Skill | Cheatsheet | Trigger (Kurzform) |
|---|---|---|
| `plugin-anlegen` | add-plugin.md | neues Plugin / Sidebar-Eintrag / Route |
| `feature-flag-anlegen` | add-feature-flag.md | neuer Build-Flag, Feature ab-/anschaltbar |
| `csv-feld-anlegen` | add-csv-field.md | neues kanonisches Antrag-Feld |
| `idb-store-anlegen` | add-idb-store.md | neuer IndexedDB-Store / Version-Bump |
| `einstellung-anlegen` | add-settings-section.md | neue Einstellung / Panel in Einstellungen oder Datenpflege |
| `sidecar-anlegen` | add-sidecar-persistence.md | Datei auf dem Daten-Share spiegeln |
| `view-anlegen` | add-view.md | neue Sicht/Pill der Antrags-Liste |
| `filter-facet-anlegen` | add-filter-facet.md | neue System-Facet der Filter-Sidebar |

### D · Glossar `CONTEXT.md` (Stufe 2: geteilte Sprache)

Nur Begriffe, keine Implementierung; Format je Eintrag: **Begriff** — Bedeutung in einem Satz · *nicht sagen:* … · Quelle (Themen-Doc). Seed (~20 Einträge, Definitionen aus den verlinkten Docs geerntet, nicht erfunden): Verbund / Teilvorhaben (TV) / Antrag / Aktenzeichen / Programm · Richtlinie / Fachsystem C16 / Statuskürzel (`D_`/`T_`/`X`) **vs.** Bearbeiter-Kürzel (`tib_kuerz`) — geflaggte Mehrdeutigkeit / Rohstatus → Code → ZAH-Phase → Kategorie / Betrachtungsbereich vs. Arbeitsvorrat / Schnitt · Fassung · Entwurf / Sidecar · Daten-Share / Variante (dev/pl/prod) / Flag · Freischaltung · Beta/Experten · kuratorOnly (vier Achsen) / Kurator · PL / Snapshot vs. List-View / **App-Skill** (Prompt-Vorlage der Anwendung) vs. **Claude-Code-Skill** — geflaggte Mehrdeutigkeit / Artefakt (GA/NF/ABL/RNE) / Regelsatz / Journal / Klärung / Gate · Abnahme · Guard · Pitfall. Quellen: `status-achsen.md`, `vorgangssystem.md` §10, `modul-freischaltung.md`, `sichtbarkeitsstufen.md`, `data-layout.md`, `build-varianten.md`, `csv-import.md`, `artefakt-engine.md`, `KATALOG-CODES.md`.

### E · `REVIEW.md` (Stufe 5: Review-Policy)

Vier Pässe, je „Wichtig" definiert: (1) **Constraints & Pitfalls** — `file://`, Status-Domänen, `atomicWrite`, Flag+Freischaltung, vier Sichtbarkeits-Achsen; (2) **Spec-Treue** — erfüllt der Diff den `## 0. Anlass`? Scope-Creep?; (3) **Beleg** — Abnahme in `dev:local` nachgewiesen, Zahl im UI mit Einheit/Quelle, neuer Guard einmal rot; (4) **Doku-Nachzug** — Changelog-Skeleton gefüllt, Screen-Context, Entscheidungsbaum-Zeile, Cheatsheet-Touch-Points, Glossar bei neuem Begriff. Nit-Deckel 5. Ausgenommen: `src/generated/**`, `docs/architecture/code-map.md`, `package-lock.json`, `dist*/**`, `eval-out/**`, Format von `CHANGELOG.md` (Skript).

### F · Leichte Artefakt-Kette (Stufe 1–3)

`docs/superpowers/README.md`: Spec-Schablone mit **`## 0. Anlass`** (in den Worten des Auslösers: Feedback-Item-ID, Beobachtung, Zitat; 3–6 Zeilen) · `## 1. Warum` · `## 2. Befunde` (gemessen, mit Datum/Datenstand) · `## 3. Entwurf` · `## 4. Verifikation`; Plan-Schablone wie das bestehende Exemplar (Ziel/Architektur/Grundlage/Global Constraints/Dateien/Tasks). **Schwelle** für Spec+Plan im Repo: neues Plugin, Flag, Store, Sidecar, Skill/Hook — oder > 5 Dateien; darunter bleibt der Plan-Modus-Plan außerhalb. Archiv nach Doku-Konvention 8. Guard in H: jede Datei unter `docs/superpowers/specs/` trägt `## 0. Anlass` (das eine lebende Exemplar wird nachgerüstet).

### G · Prozess-Doc + Zeiger

`docs/architecture/entwicklungsprozess.md` (Ist-Zustand, ~100 Zeilen): Tabelle Playbook-Stufe → Artefakt hier → Werkzeug; Abschnitt „bewusst nicht übernommen" (Liste aus Kontext oben mit Grund); Messgrößen, die nichts kosten: First-Pass-Quote der Plan-Queue (`_plans/done/verlauf.log`), `/skill-doctor` monatlich (nie aufgerufene Skills streichen), Zahl neuer Bitte≠Bedarf-Fälle je Monat (soll sinken). CLAUDE.md: vier Zeilen im Entscheidungsbaum („Vorhaben schärfen → `/grillen`", „Begriff nachschlagen → CONTEXT.md", „Review-Pässe → REVIEW.md", „Entwicklungsprozess/Artefakt-Kette → entwicklungsprozess.md"), in „Planung: schlank halten" zwei Sätze (Frage-Schritt = `grillen`; Schwelle aus F). `docs/agents/README.md`: Spalte „Skill" bei den acht Zeilen.

### H · Guard `agent-konfiguration.test.ts` (Stufe 4: Evals der Konfiguration, statisch)

`describe('agent-konfiguration')`: (a) jede `.claude/skills/*/SKILL.md` hat Frontmatter mit `name` == Ordnername und nicht-leerer `description` ≤ 1024 Zeichen; (b) jeder Zeiger-Skill verlinkt ein existierendes `docs/agents/*.md` (Link-Extraktion via `extractHrefs` aus `doc-links.test.ts` — Helfer nach `conventions-lib.ts` heben, statt zu kopieren); (c) `.claude/settings.json` parsebar, jedes Hook-Kommando referenziert eine existierende Datei unter `scripts/hooks/`; (d) `pruefeBefehl()` blockt die drei Regelklassen und lässt `git status`, `git add src/x.ts`, `npm run check`, `git push --force-with-lease` durch; (e) jede Spec unter `docs/superpowers/specs/` trägt `## 0. Anlass`. Läuft in `check:docs` (liegt unter `src/__tests__/`).

---

## Schritte

- [ ] **1 · Spec schreiben** — `docs/superpowers/specs/2026-09-09-ai-native-sdlc-design.md` aus Kontext/Befund/Entwurf dieses Plans, mit `## 0. Anlass` (Nutzerbitte vom 2026-09-08, Playbook-Link, Pocock-Repo). Diesen Plan nach `docs/superpowers/plans/2026-09-09-ai-native-sdlc.md` kopieren (Grundlage-Link auf die Spec).
- [ ] **2 · Hook-Skript** `scripts/hooks/bash-guard.mjs` (pure `pruefeBefehl` + stdin-Main) → `.claude/settings.json` wie in A → Unit-Test in H (d) zuerst rot (Regelklasse fehlt), dann grün → `npm run check:quick`.
- [ ] **3 · Guard** `src/__tests__/agent-konfiguration.test.ts` (a–e) + `DOC_FILES`-Erweiterung in `doc-links.test.ts` (SKILL.md-Dateien per Glob) → einmal **rot sehen** (z. B. `name` eines Skills verstellen, Spec ohne Anlass) → zurück → `npm run check:docs`.
- [ ] **4 · Skill `grillen`** nach B; Selbstprüfung gegen `writing-for-agents` (kein Sprawl, Schritte vorn, keine Verbote ohne positives Ziel).
- [ ] **5 · Acht Zeiger-Skills** nach C (Trigger aus dem ersten Absatz des jeweiligen Cheatsheets; Body identisch bis auf Pfad).
- [ ] **6 · `CONTEXT.md`** nach D — Definitionen aus den genannten Docs ernten (Explore-Agent liefert Rohfassung mit Fundstellen; Hauptlauf prüft jeden Satz gegen die Quelle), beide Mehrdeutigkeiten als „geflaggt" führen.
- [ ] **7 · `REVIEW.md`** nach E · **`docs/superpowers/README.md`** nach F · `## 0. Anlass` in die Spec vom 2026-08-04 nachrüsten (Text aus deren Kopfzeile).
- [ ] **8 · Prozess-Doc + Zeiger** nach G; danach `wc -c CLAUDE.md` < 67 300 prüfen → `npm run check:docs`.
- [ ] **9 · Gate + Version** — `npm run check` grün → `npm run version:bump -- minor "AI-native SDLC: Grill-Skill, Zeiger-Skills, Hooks, Glossar, Review-Policy"` → Changelog-Skeleton füllen (≤ 3 Zeilen Motivation, ≤ 5 Bullets mit Datei-Links) → `npm run build:devpl` im Hintergrund, Exit-Code prüfen.
- [ ] **10 · Commit** — `git status --short`, nur eigene Pfade stagen (die 17 fremden Änderungen aus `csv-sources-kuration/*` und `CHANGELOG.md`-Kopf gehören einer parallelen Session — **nicht** mit-committen; Changelog-Skeleton daher als eigene, klar begrenzte Edit-Region), Message per `.git/COMMIT_MSG.tmp`, `git push`.
- [ ] **11 · Übergabe-Notiz** an den Nutzer: Hook + Deny-Regeln greifen ab der **nächsten** Session; dort `git add -A` per Bash-Tool versuchen (erwartet: Block mit Grund) und ein Edit auf `src/generated/ort-wasm-gz.ts` (erwartet: Ablehnung); `/grillen` auf ein kleines Vorhaben testen.

## Verifikation

1. `npm run check:docs` (≈ 6 s) grün, **nachdem** `agent-konfiguration` und `doc-links` je einmal rot waren (Screenshot/Log der roten Zeile im Changelog-Kommentar nicht nötig, aber im Chat berichten).
2. Hook-Unit im Bash-Tool (kein Heredoc!): `echo '{"tool_name":"Bash","tool_input":{"command":"git add -A"}}' | node scripts/hooks/bash-guard.mjs; echo "EXIT: $?"` → `EXIT: 2` + deutscher Grund; dasselbe mit `git status` → `EXIT: 0`; mit `cat <<EOF` → 2; mit `git push --force-with-lease` → 0.
3. `npm run check` grün; `npm run build:devpl` Exit 0 (Hintergrund).
4. `wc -c CLAUDE.md` < 67 300.
5. Nächste Session (Nutzer oder Folge-Session): Live-Block des Hooks, Deny auf `src/generated/**`, `/grillen`-Format sichtbar (Runde 0 Befund → nummerierte Frontier mit ➡️-Empfehlungen). Nach ~4 Wochen `/skill-doctor`: Zeiger-Skills, die nie feuerten, werden gestrichen (Kontext-Last).

## Nicht in diesem Schnitt (Kandidaten für später)

- **Commit-Gate-Hook** (`git commit` nur mit frischem `npm run check`-Marker) — erst, wenn die Plan-Queue-Statistik zeigt, dass Commits ohne Gate vorkommen.
- **Minimal-CI** (`npm run check` bei Push auf GitHub) — Stufe 5 in klein; braucht Entscheidung, ob `eval-out/` mit echten Texten im Remote liegen darf.
- **Dynamische Evals** (`claude -p` gegen 5 Standardaufgaben, Grader `tool_used`/`file_exists`) — wenn `claude plugin eval` allgemein verfügbar ist oder Token-Budget da ist.
- **Intent aus dem Feedback-Board** — Skill, der ein Feedback-Item in einen `## 0. Anlass` überführt; setzt lesbaren Zugriff auf die Feedback-Sidecars von der Dev-Maschine voraus (nicht geprüft).
