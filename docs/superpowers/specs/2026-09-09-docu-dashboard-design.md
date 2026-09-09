# Doku-Dashboard für Einsteiger und Entwickler

Stand: 2026-09-09 · Ausgangspunkt: Nutzerbitte vom 2026-09-09, eine animierte, monatlich aktualisierte Dokumentation der App als eine HTML-Datei.

## 0. Anlass

In den Worten des Auslösers: *„wir wollen ein Docu Dashboard für die App für developer und für Anfänger erstellen. Repo ist aktuell bitte neu clonen. Mit Abbildungen, Infographiken, dynamischen Animationen die Ausführung des Codes zeigen mit klassischen use cases (login user, Anträge, Aktualisierung Datenbestand, suche mit KI, Antragszuweisungen etc.), wenn neues Feature oder änderung dann soll skill (vorher von Claude code erstellen lassen) 1x pro Monat das Docu Dashboard updaten. Als Downloadbares HTML updaten 1x pro Woche/Monat vorher gut repo neu clonen“* — Rückfrage beantwortet: monatlich, Änderungen auf einem Branch `docs/docu-dashboard`, Merge durch den Nutzer.

## 1. Warum

Die Architektur-Docs (52 Dateien unter `docs/architecture/`, `CLAUDE.md` mit 61 KB) sind für Agenten und erfahrene Entwickler geschrieben. Es fehlt eine Einstiegsebene, die ohne Vorwissen erklärt, was beim Doppelklick auf die HTML-Datei, beim Nacht-Import, bei der Suche, der Zuweisung oder der Gutachten-Generierung tatsächlich passiert — und die Entwicklern dieselben Abläufe mit Dateien und Funktionen zeigt. Weil sich das Repo schnell bewegt (304 Commits in 30 Tagen), ist eine handgepflegte Doku nach Wochen falsch; sie braucht einen wiederholbaren Lauf, der Kennzahlen misst und die kuratierten Teile gegen den Code prüft.

## 2. Befunde aus dem Bestand

Explore-Läufe am 2026-09-09 über `src/`, `docs/architecture/`, `CONTEXT.md`, `.claude/`, `scripts/` (Datenstand v6.44.0, Commit `edff2c72`):

| Baustein | Befund | Fundstelle |
|---|---|---|
| Start-Kette | kein `decideAppGate` mehr; Reihenfolge Onboarding → AppPasswordGate → Welcome/Startup → MaLoginGate; Session-Keys `tf-app-gate`, `tf-ma-kuerzel` (sessionStorage), `admin-session-meta` (IDB, 12 h) | `src/core/App.tsx:127-152`, `useAppGateSession.ts`, `useMAIdentity.ts` |
| Antrag-Typ | liegt in `src/core/services/csv/types.ts` (CLAUDE.md nennt `src/core/types/csv/types.ts` — existiert nicht); ~461 Felder je Record; `Teilantragsindex` existiert nicht als Feld, Gruppierung nur über `verbund_id` | `types.ts:206`, `csv-import.md:293` |
| Import | 7 benannte Schritte + 3 Abbruch-Schranken; `LIST_VIEW_PROJECTION_VERSION = 9` (Doc sagt 5) | `importer.ts`, `importer-schritte.ts`, `list-view-migration.ts:51` |
| Suche | zwei Vektorspeicher (Orama-Chunks vs. ein Vektor je Vorhaben); Re-Ranker wirkt nur auf dem RAG-Pfad, nicht auf der Suchseite | `useUnifiedSearch.ts`, `useSearch.ts`, `re-ranker.ts` |
| Auslastung | 5 Tabs, nicht 3 (Doc veraltet); XLSX-Export ist nicht dateiverschlüsselt — geschützt sind App-Start und Modul | `AuslastungView.tsx:50`, `export-service.ts` |
| KI-Bridge | Flag `streamlitBridge` und Varianten `kurator`/`as` gibt es im Code nicht mehr (ki-bridge.md veraltet) | `runtime-config.ts:77`, `feature-flags.ts` |
| Kennzahlen | 2 878 TS-Dateien, 327 780 LOC Produktion, 120 698 LOC Tests, 20 Plugins, 21 Stores (v11), 31 Flags, 55 Pitfalls, 9 Guard-Dateien, 10 Skills | `scripts/docu-dashboard/build.mjs` (misst reproduzierbar) |

Die Doc-Abweichungen sind im Dashboard nach dem Code dargestellt; sie sind hier nur festgehalten, nicht in den Docs korrigiert (eigener Anlass).

## 3. Entwurf

### 3.1 Zwei Quellen, ein Bau

- **Gemessen** (`scripts/docu-dashboard/build.mjs`, reine Node-Stdlib): Version, git (Commits, letzter Commit, Typen), Dateien/LOC je Ordner, IDB-Version + Stores, Flags, Plugins, Pitfalls, Guards, Skills, Docs, Changelog-Kopf. Prüft alle `dev.file`-Verweise aus `data.json` gegen das Repo und meldet Lücken.
- **Kuratiert** (`docs/docu-dashboard/data.json`): sieben Abläufe (App-Start, Datenbestand, Anträge, Suche, Zuweisung, Gutachten, Feedback) mit je 8–16 Schritten, jeder Schritt mit `beginner`-Text, `dev` (Datei/Aufruf/Effekt) und Protokollzeile; dazu Datenmodell, Status-Achse, Plugins, Varianten, Sichtbarkeit, KI, Dev-Setup, Glossar (aus `CONTEXT.md`).
- **Vorlage** (`template.html`): Design-System nach `DESIGN_GUIDE.md`/`theme.ts` (Schiefer als Primärfarbe, Geist/Geist Mono, `data-theme`-Umschalter), Flow-Player (SVG-Sequenzdiagramm, Abspielen/Schritt/Zurück, Paket-Animation, Ausführungsprotokoll), Modus-Umschalter Einsteiger/Entwickler (`.dev-only`), handgezeichnete Architektur- und Datenmodell-SVGs, alle Farben als Tokens für hell/dunkel.

### 3.2 Ergebnis

`docs/docu-dashboard/dashboard.html` — eine Datei (~160 KB), unter `file://` lauffähig, ohne Abhängigkeiten außer Google Fonts mit Fallback. `--artifact` schreibt zusätzlich eine Fassung ohne Dokumenthülle für Hoster mit eigenem Skelett. `last-build.json` hält Commit, Version, Kennzahlen und Flow-Längen des letzten Laufs.

### 3.3 Pflege

Claude-Code-Skill `docu-dashboard` (`.claude/skills/docu-dashboard/SKILL.md`): frischer Stand → bauen → `git log`/Changelog/`git diff --stat` seit `last-build.json` → `data.json` nachziehen → bauen → `check:docs` → ansehen → Branch `docs/docu-dashboard-YYYY-MM` → ausliefern. Regeln: Code schlägt Doku, jede Angabe belegt, Einsteiger-Text ohne Jargon, monatlich.

### 3.4 Fehlerfälle

Fehlende Datei in `data.json` → Meldung im Bau, kein Abbruch (der Skill zieht nach). Kein git → Kennzahlen `0`/leer, Bau läuft. Changelog-Kopf nicht parsebar → leere Liste mit Hinweis auf der Seite.

## 4. Verifikation

`npm run docs:dashboard` ohne fehlende Verweise; `npm run check:docs` grün (Skill-Frontmatter, Doc-Links, Spec-Anlass); Rendering mit Chromium unter `file://` in 1360 px hell/dunkel, Einsteiger/Entwickler, Flow-Abspielen ohne Konsolenfehler, keine horizontale Seitenscrollung.
