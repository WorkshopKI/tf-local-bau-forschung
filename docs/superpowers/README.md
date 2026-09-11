# Spec — die leichte Artefakt-Kette

Ein Ordner, ein Artefakt: `specs/` hält fest, **was, warum und wie** gebaut wird. Der freigegebene Plan-Modus-Plan wird selbst zur Spec — es entsteht kein zweites Dokument daneben. Die Spec wird mit der Umsetzung committet. Der Prozess dahinter: [docs/architecture/entwicklungsprozess.md](../architecture/entwicklungsprozess.md).

## Wann eine Spec ins Repo gehört

Ab dieser **Schwelle** — sonst bleibt der Plan-Modus-Plan außerhalb des Repos:

- ein neues Plugin, ein neuer Feature-Flag, ein neuer IDB-Store, eine neue Sidecar-Datei, ein neuer Skill, Hook oder Agent.

Die Zahl geänderter Dateien ist bewusst kein Kriterium: sie trifft fast jedes Feature und macht aus jedem Plan ein Repo-Dokument, ohne dass eine neue Achse entsteht.

Dateiname: `specs/YYYY-MM-DD-<slug>.md`. Ältere Paare (`…-design.md` in `specs/` plus Plan in `plans/`) bleiben, wie sie sind; `plans/` bekommt keine neuen Dateien. Erledigte Specs wandern nach [docs/_archiv/superpowers/](../_archiv/README.md) (Doku-Konvention 8); sie behalten ihren Namen.

## Schablone

```markdown
# <Titel>

Stand: <Datum> · Ausgangspunkt: <ein Satz>

## 0. Anlass
In den Worten des Auslösers (Feedback-Item-ID, Beobachtung, Zitat), 3–6 Zeilen. Pflicht — der Guard `agent-konfiguration` prüft die Überschrift.

## 1. Warum
Das Problem hinter dem Anlass; was die wörtliche Bitte nicht sagt.

## 2. Befunde aus dem Bestand
Gemessen, mit Datum, Datenstand und Fundstellen. Zahlen tragen Einheit und Quelle.

## 3. Entwurf
Bausteine, Datenfluss, Fehlerfälle, Tests — in Abschnitten je Baustein. Entscheidungen aus der Grill-Runde mit einem Satz Grund.

## 4. Schritte
Der freigegebene Plan-Modus-Plan, übernommen: je Schritt Dateien, Schnittstellen, Reihenfolge. Checkboxen `- [ ]` nur, wenn die Umsetzung über mehrere Sitzungen läuft.

## 5. Verifikation
Wie die Änderung Ende-zu-Ende geprüft wird (Gate, Abnahme in dev:local, Handtest unter file://).
```
