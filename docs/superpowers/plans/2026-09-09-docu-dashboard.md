# Plan: Doku-Dashboard + Update-Skill

**Ziel:** Ein downloadbares HTML-Dashboard, das die App für Einsteiger und Entwickler mit animierten Abläufen erklärt, plus ein Skill, der es monatlich gegen den Code nachzieht.
**Architektur:** Kuratierte Inhalte (`data.json`) + gemessene Kennzahlen (`build.mjs`) → Vorlage (`template.html`) → `dashboard.html`; Pflege über Skill `docu-dashboard`.
**Tech-Stack:** Node-Stdlib-Skript, Vanilla-HTML/CSS/JS (kein Framework, keine Laufzeit-Abhängigkeit), Inline-SVG.
**Grundlage:** [2026-09-09-docu-dashboard-design.md](../specs/2026-09-09-docu-dashboard-design.md)

## Global Constraints

- Kein App-Code angefasst; Doku-Konventionen (Skill-Frontmatter, Doc-Links, Spec mit `## 0. Anlass`) gelten — Guard `agent-konfiguration`, `doc-links`.
- `CLAUDE.md` bleibt unter 67 300 Byte (Guard `doc-links`); eine Zeile im Entscheidungsbaum.
- Windows-Shell-Konventionen; keine Heredocs; `git add` mit Pathspec.
- Kein Versions-Bump (Doku ändert kein App-Verhalten).

## Dateien im Überblick

| Datei | Rolle |
|---|---|
| `docs/docu-dashboard/data.json` | kuratierte Inhalte |
| `docs/docu-dashboard/template.html` | Seite + Flow-Player + SVGs |
| `docs/docu-dashboard/dashboard.html` | Ergebnis (generiert, committet) |
| `docs/docu-dashboard/last-build.json` | Stand des letzten Baus (generiert) |
| `docs/docu-dashboard/README.md` | Aufbau, Bauen, Flow-Format |
| `scripts/docu-dashboard/build.mjs` | Messen + Bauen + Verweis-Prüfung |
| `.claude/skills/docu-dashboard/SKILL.md` | Pflege-Skill |
| `package.json` | Script `docs:dashboard` |
| `CLAUDE.md` | Zeile im Entscheidungsbaum |

## Tasks

- [x] **Bestand erheben** — sieben Explore-Läufe (Start/Login, Anträge/CSV, Suche/KI, Auslastung/Vorgangssystem, Gutachten/Artefakte, Architektur/Kennzahlen); Doc-Abweichungen in der Spec notiert. Verifikation: jede Datei/Funktion in `data.json` existiert (Prüfung im Bau).
- [x] **data.json** — 7 Flows (95 Schritte), Datenmodell, Status-Achse, 20 Plugins, 5 Varianten, 4 Achsen, KI, Dev-Setup, 29 Glossar-Begriffe. Verifikation: `node -e "require('./docs/docu-dashboard/data.json')"`.
- [x] **build.mjs** — Kennzahlen, Changelog-Kopf, Verweis-Prüfung, `--artifact`. Verifikation: Ausgabe „Dateiverweise: alle vorhanden“, Kennzahlen deckungsgleich mit `npm run qualitaet`-Baseline.
- [x] **template.html** — Tokens hell/dunkel, Modus-Umschalter, Flow-Player mit Sequenzdiagramm + Protokoll, Architektur-/Datenmodell-SVGs, Nav. Verifikation: Chromium-Screenshots 1360 px hell/dunkel, keine Konsolenfehler, `scrollWidth === innerWidth`.
- [x] **Skill + Doku** — `SKILL.md`, `README.md`, Spec, Plan, `package.json`, `CLAUDE.md`. Verifikation: `npm run check:docs`.
- [ ] **Erster Monatslauf** (Oktober 2026) — Skill ausführen, Branch `docs/docu-dashboard-2026-10`, Bericht mit Version davor/danach.
