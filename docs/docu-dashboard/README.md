# Doku-Dashboard

Eine einzige HTML-Datei, die TeamFlow Local für zwei Leserkreise erklärt — Einsteiger (Alltagssprache) und Entwickler (Dateien, Funktionen, Effekte) — mit animierten Abläufen der typischen Aufgaben, Architektur-Grafiken, Datenmodell, Plugin-Karte, Build-Varianten, KI-Anbindung, Glossar und Changelog. Läuft unter `file://` ohne Abhängigkeiten (Schriften von Google Fonts, mit Fallback).

## Dateien

| Datei | Rolle | Wer schreibt |
|---|---|---|
| [dashboard.html](dashboard.html) | **das Ergebnis** — downloadbar, per Doppelklick lauffähig | `npm run docs:dashboard` |
| [data.json](data.json) | kuratierte Inhalte: Einleitung, acht Abläufe (`flows`), Datenmodell, Status-Achse, Zusammenspiel von Regeln, Fristen und Meilensteinen (`zusammenspiel`), Fehlersuche (`fehlersuche`), Plugins, Varianten, Sichtbarkeit, KI, Dev-Setup, Glossar | Skill [docu-dashboard](../../.claude/skills/docu-dashboard/SKILL.md) |
| [template.html](template.html) | Seite (CSS, Markup, Flow-Player, Architektur-SVGs, Uhren-Grafik „ein Vorgang, drei Uhren“, Symptom-Filter) mit den Platzhaltern `/*__TF_DOCU_DATA__*/`, `__TF_DOCU_VERSION__`, `__TF_DOCU_BUILT__`, `__TF_DOCU_COMMIT__` | nur bei Struktur-/Design-Änderung |
| [last-build.json](last-build.json) | Stand des letzten Baus (Commit, Version, Kennzahlen, Flow-Längen) — Ausgangspunkt für „was hat sich seither geändert?“ | `npm run docs:dashboard` |
| [../../scripts/docu-dashboard/build.mjs](../../scripts/docu-dashboard/build.mjs) | misst Kennzahlen im Repo, liest den Changelog-Kopf, prüft Dateiverweise, setzt alles in die Vorlage | — |

## Bauen

```bash
npm run docs:dashboard                     # → docs/docu-dashboard/dashboard.html + last-build.json
node scripts/docu-dashboard/build.mjs --artifact /pfad/ohne-huelle.html   # zusätzlich eine Fassung ohne <html>/<head>/<body> (für Hoster mit eigenem Skelett)
```

Gemessen werden: Version (`package.json`), Commits/letzter Commit/Commit-Typen (git), Dateien und LOC je Ordner unter `src/` (Produktion vs. Tests), IndexedDB-Version und Store-Anzahl (`idb-store.ts`), Feature-Flags (`scripts/config-schema.mjs`), Plugins (`src/plugins.config.ts`), Pitfalls (höchste Nummer in `CLAUDE.md` + `pitfalls.md`), Guard-Dateien, Skills, Architektur-Docs, Cheatsheets, die zwölf jüngsten Changelog-Blöcke.

Zwei Prüfungen halten die kuratierten Angaben ehrlich — beide melden, keine bricht den Bau ab:

- **Dateiverweise**: jede `file`-Angabe in `data.json` (Abläufe, Status-Kette, Zusammenspiel, Fehlersuche, Werkzeuge) muss im Repo existieren; `core/…`, `plugins/…`, `components/…`, `config/…` werden unter `src/` gesucht.
- **Aufrufe**: jeder Name vor einer Klammer in einer `fn`-Angabe (`pruefeStillstand(`) muss als Wort im Produktionscode unter `src/` oder `scripts/` vorkommen — Tests zählen nicht.

## Zusammenspiel und Fehlersuche (data.json → `zusammenspiel`, `fehlersuche`)

```jsonc
"zusammenspiel": {
  "beginner": "…",
  "mechanismen": [ { "id": "frist", "name": "Bearbeitungsfrist", "frage": "…", "antwort": "…",
                     "liest": ["…"], "pflege": "…", "giltAb": "…", "zeigt": ["…"],
                     "verwechslung": "…", "dev": { "file": "src/…", "fn": "berechneFrist(e)" } } ],
  "beruehrungen": [ { "titel": "…", "text": "…", "dev": "…", "beleg": "Doc § Abschnitt, Zahl mit Datum" } ],
  "grundmengen":  [ { "wo": "…", "menge": "…", "warum": "…" } ]
},
"fehlersuche": {
  "beginner": "…",
  "leiter":   [ { "schritt": "Sicht", "frage": "…", "pruefen": ["…"] } ],   // Reihenfolge = Prüfreihenfolge
  "bereiche": [ { "id": "fristen", "label": "Frist & Stillstand" } ],
  "symptome": [ { "id": "…", "bereich": "fristen", "keinFehler": true, "titel": "so, wie Nutzer es sagen",
                  "ursache": "…", "pruefen": ["Weg in der App"], "dev": { "file": "…", "fn": "…" },
                  "beleg": "Version, Doc-Abschnitt oder Messung" } ],
  "werkzeuge":    [ { "name": "…", "wo": "…", "hilft": "…", "file": "src/…" } ],
  "devWerkzeuge": [ { "name": "…", "was": "…" } ]
}
```

Die Uhren-Grafik im Abschnitt Zusammenspiel steht als SVG in `template.html`: ein erfundener Beispielvorgang, gerechnet nach den Regeln im Code (Anker = späteres von `D_AAE`/`D_XTE`, 90 Tage, Soll-Wochen und Namen aus dem Auslieferungs-Plan, `ueberTage` wie in `fristAnlaesse.ts`). Ändert sich eine dieser Regeln, wird die Grafik nachgezogen.

## Flow-Format (data.json → `flows[]`)

```jsonc
{
  "id": "login", "title": "App-Start & Anmeldung", "kicker": "…", "summary": "…",
  "lanes": ["Nutzer", "App-Shell (React)", "Core-Services", "IndexedDB", "Daten-Share (SMB)", "Browser-Sitzung"],
  "steps": [
    { "lane": 0, "label": "Doppelklick auf zah-pl.html",
      "beginner": "Alltagssprache, 1–3 Sätze, keine Dateinamen.",
      "dev": { "file": "index.html", "fn": "#tf-loader", "effect": "was der Schritt bewirkt, Zahlen mit Quelle" },
      "log": "index.html  →  #tf-loader sichtbar",
      "from": 3, "edge": "wenn Schreibrecht" }   // optional: Verzweigung (Index oder Liste) + Kantenbeschriftung
  ]
}
```

Der Flow-Player zeichnet daraus ein Sequenzdiagramm (Spalten = `lanes`, Zeilen = Schritte), spielt es ab, zeigt rechts den aktuellen Schritt (Einsteiger-Text, im Entwickler-Modus dazu Datei/Aufruf/Effekt) und schreibt je Schritt eine Protokollzeile.

## Pflege

Einmal im Monat — oder nach einem neuen Feature — läuft der Skill [docu-dashboard](../../.claude/skills/docu-dashboard/SKILL.md): frischer Stand, bauen, Änderungen seit `last-build.json` sichten, `data.json` nachziehen, neu bauen, ansehen, auf einem Branch committen, `dashboard.html` ausliefern.
