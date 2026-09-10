---
name: docu-dashboard
description: Use when das Doku-Dashboard (docs/docu-dashboard/dashboard.html — animierte Abläufe, Infografiken, Glossar für Einsteiger und Entwickler) aktualisiert werden soll — planmäßig einmal im Monat, nach einem neuen Feature oder einer Änderung an Login, CSV-Import, Suche, Auslastung, Gutachten oder Feedback, oder wenn der Nutzer „Doku-Dashboard“, „Docu Dashboard“ oder „Doku aktualisieren“ sagt. Klont/zieht den frischen Stand, misst Kennzahlen, sichtet Änderungen seit dem letzten Bau, pflegt data.json und baut das HTML neu.
---

# Doku-Dashboard aktualisieren

Das Dashboard ist **eine** HTML-Datei, die aus zwei Quellen gebaut wird: gemessene Kennzahlen (Version, Commits, LOC, Stores, Flags, Plugins, Changelog-Kopf — misst das Skript selbst) und kuratierte Inhalte (Abläufe, Texte, Glossar — liegen in [data.json](../../../docs/docu-dashboard/data.json)). Der Lauf hier hält die kuratierten Inhalte mit dem Code in Deckung. Aufbau und Dateien: [docs/docu-dashboard/README.md](../../../docs/docu-dashboard/README.md).

## Ablauf

1. **Frischer Stand.** Auf `master` arbeiten und `git pull --ff-only` fahren (in einem Automatisierungslauf: das Repo frisch klonen). Nie mit lokalen Änderungen starten — der Bash-Guard blockt ohnehin `reset --hard`/`checkout -- .`.
2. **Bauen und messen.** `npm run docs:dashboard` (= [scripts/docu-dashboard/build.mjs](../../../scripts/docu-dashboard/build.mjs)). Das Skript schreibt `dashboard.html` und `last-build.json` und meldet **Dateiverweise aus data.json, die es im Repo nicht mehr gibt** — diese Liste ist der Einstieg für Schritt 4.
3. **Was hat sich seit dem letzten Bau geändert?** `last-build.json` nennt `commit` und `curatedFor` des letzten Laufs. Lesen:
   - `git log <commit>..HEAD --format=%s` — nur die Betreffzeilen; `feat(…)`/`refactor(…)` sind die Kandidaten, `fix`/`docs`/`chore` selten.
   - Die Changelog-Blöcke ab `curatedFor` in [CHANGELOG.md](../../../CHANGELOG.md) (nur `grep -n "^### v"` und die betroffenen Blöcke lesen, nie die Datei am Stück).
   - `git diff --stat <commit>..HEAD -- src/core/App.tsx src/core/services/csv src/core/services/search src/plugins/auslastung src/core/services/skills src/plugins/antraege/kurzfassung src/core/services/feedback src/plugins.config.ts src/core/services/storage/idb-store.ts scripts/config-schema.mjs CONTEXT.md .claude/skills` — die Pfade, an denen die sieben Abläufe, die Plugin-Karte, die Stores, die Flags, das Glossar und die Skill-Liste hängen.
4. **data.json nachziehen** — nur was sich belegt geändert hat, in derselben Tiefe wie der Bestand:
   - **Abläufe** (`flows[].steps[]`): jeder Schritt trägt `label`, `beginner` (Alltagssprache, 1–3 Sätze), `dev.file`, `dev.fn`, `dev.effect`, `log` (eine Protokollzeile `Datei → Funktion`). Umbenannte oder verschobene Dateien korrigieren, neue Zwischenschritte einfügen, entfallene streichen; `lane` ist der Index in `lanes[]`, `from` (Zahl oder Liste) nur für Verzweigungen, `edge` beschriftet die eingehende Kante. Ein neuer klassischer Use Case bekommt einen eigenen Flow (Spalten = Beteiligte, 8–16 Schritte) — Vorbild ist der jeweils nächstliegende bestehende.
   - **Plugins** (`plugins[]`): Manifest-Felder aus `src/plugins.config.ts` und dem `index.ts(x)` des Plugins — `id`, `name`, `category`, `order`, `route`, `flag`, `lock`, ein Satz `desc`.
   - **Stores**, **Flags** (`flagsProdOff`/`flagsPlOff`), **Varianten**, **Skills** (`devSetup.skills`), **Guards** (`devSetup.guards` mit `it()`-Zahl aus `grep -c "^\s*it("`), **Glossar** (neue Begriffe aus [CONTEXT.md](../../../CONTEXT.md), Definition in einem Satz, keine Implementierung).
   - `meta.curatedFor` auf die aktuelle Version, `meta.curatedAt` auf heute setzen.
   Nicht anfassen: die Kennzahlen (misst das Skript), die Architektur-SVGs in `template.html` (nur bei echter Strukturänderung — dann mit derselben Gitter-Disziplin wie bestehende Kästen).
5. **Neu bauen** (`npm run docs:dashboard`) — die Meldung muss ohne fehlende Dateiverweise enden. Dann `npm run check:docs` (die Guards prüfen u. a. Skill-Frontmatter und Doc-Links).
6. **Ansehen.** `docs/docu-dashboard/dashboard.html` im Browser öffnen (unter `file://` lauffähig, keine Abhängigkeiten): jeden geänderten Ablauf einmal abspielen, Einsteiger- und Entwickler-Modus, hell und dunkel. Konsole ohne Fehler.
7. **Committen.** Auf einem Branch `docs/docu-dashboard-YYYY-MM` (Nutzer merged selbst): `docs(docu-dashboard): Stand vX.Y.Z — <was sich geändert hat>` mit `dashboard.html`, `data.json`, `last-build.json` (und `template.html`, falls angefasst). Kein Versions-Bump — Doku, kein App-Verhalten.
8. **Ausliefern.** Die frische `dashboard.html` ist das Ergebnis: als Download an den Nutzer und, wo eine geteilte Seite existiert, dort neu veröffentlichen. Im Bericht: Version davor → danach, welche Abläufe angefasst wurden, offene Punkte (z. B. ein Feature, das noch keinen Ablauf hat).

## Regeln

- **Code schlägt Doku.** Steht in einem Architektur-Doc etwas anderes als im Code, gilt der Code — und der Befund wird im Bericht genannt, nicht still übernommen.
- **Alle Angaben belegt.** Jede Datei und Funktion in `dev.*` existiert im Repo; Zahlen tragen ihre Quelle (Kommentar, Doc, Messung). Nichts aus dem Gedächtnis ergänzen.
- **Einsteiger-Text ohne Jargon**: keine Dateinamen, keine Funktionsnamen, keine Abkürzungen ohne Auflösung; der Entwickler-Block trägt die Technik.
- **Monatsrhythmus, nicht mehr:** ohne belegte Änderung an den Abläufen ändert der Lauf nur Kennzahlen, Changelog und Stempel — das ist ein gültiges Ergebnis.
