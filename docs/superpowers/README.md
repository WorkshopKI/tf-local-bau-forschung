# Spec und Plan — die leichte Artefakt-Kette

Zwei Ordner, zwei Artefakte: `specs/` hält fest, **was und warum** gebaut wird, `plans/` hält fest, **wie**. Beides entsteht im Brainstorming beziehungsweise im Plan-Modus und wird mit der Umsetzung committet. Der Prozess dahinter: [docs/architecture/entwicklungsprozess.md](../architecture/entwicklungsprozess.md).

## Wann Spec und Plan ins Repo gehören

Ab dieser **Schwelle** werden beide committet — sonst bleibt der Plan-Modus-Plan außerhalb des Repos:

- ein neues Plugin, ein neuer Feature-Flag, ein neuer IDB-Store, eine neue Sidecar-Datei, ein neuer Skill oder Hook, **oder**
- mehr als fünf geänderte Dateien.

Dateiname: `YYYY-MM-DD-<slug>-design.md` (Spec) und `YYYY-MM-DD-<slug>.md` (Plan). Der Plan verlinkt seine Spec unter **Grundlage**. Erledigte Paare wandern nach [docs/_archiv/superpowers/](../_archiv/README.md) (Doku-Konvention 8); sie behalten ihren Namen.

## Spec-Schablone

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
Bausteine, Datenfluss, Fehlerfälle, Tests — in Abschnitten je Baustein.

## 4. Verifikation
Wie die Änderung Ende-zu-Ende geprüft wird (Gate, Abnahme in dev:local, Handtest unter file://).
```

## Plan-Schablone

Kopfzeile mit dem Sub-Skill für die Umsetzung, dann: **Ziel** · **Architektur** · **Tech-Stack** · **Grundlage** (Link auf die Spec) · `## Global Constraints` (betroffene Pitfall-Nummern, innerer Loop und Phasen-Gate, Windows-Shell, parallele Sessions, Testprojekte) · `## Dateien im Überblick` (Tabelle Datei → Rolle) · Tasks mit Checkboxen `- [ ]`, je Task Dateien, Schnittstellen, Schritte und Verifikation. Vorbild: das jüngste Exemplar in `plans/`.
