# Suche: Trefferstellen, Relevanz, Faltung

Wie ein Suchtreffer zu seiner Bewertung kommt — und warum die Suche vorher
keine hatte. Gilt für die Suchseite (`src/plugins/suche/`) und die Stufen
dahinter (`src/core/hooks/useUnifiedSearch.ts`).

## 1 Der Ausgangspunkt: ein Score ohne Varianz

Bis v4.5 setzte die Wortlaut-Stufe ihren Score fest auf `1.0`. Da die
Ähnlichkeitssuche opt-in ist und jede Sitzung auf AUS startet und der
Dokumentenindex auf vielen Rechnern leer ist, war der Normalfall: **alle Treffer
hatten exakt denselben Score**. Die Spalte zeigte eine Reihe „1.00", und die
Standard-Sortierung „nach Score" lieferte in Wahrheit die Reihenfolge des
IDB-Cursors.

Das ist die Wurzel von drei Symptomen, die wie Designfragen aussahen: keine
Sortierung, keine Relevanzangabe, keine Erklärung, warum ein Treffer kam.

## 2 Trefferstellen — der Beleg

Der Antrags-Korpus hält die suchbaren Felder ohnehin getrennt
([search-corpus.ts](../../src/plugins/antraege/services/search-corpus.ts)):
Titel (VB + TV), Kurzbeschreibung, Deskriptoren, Akronym, Aktenzeichen,
Organisation, Standort. Die Feld-Zuordnung war also nie eine Rechnung, sondern
nur eine Information, die niemand mitgeführt hat.

`substringMatches` arbeitet deshalb in **zwei Durchgängen**
([antraege-search-service.ts](../../src/plugins/antraege/services/antraege-search-service.ts)):

| Durchgang | Was | Kosten |
|---|---|---|
| 1 — Match | Oder-Kette über alle Felder, bricht beim ersten Treffer ab | unverändert ~10–30 ms über 14 000 Einträge |
| 2 — `feldZuordnung` | prüft alle Felder, NUR für bestätigte Treffer | vernachlässigbar (Treffermenge ≪ Bestand) |

Der Kurzschluss im ersten Durchgang ist der Grund für die Laufzeit; ihn
aufzugeben, um nebenbei Felder zu sammeln, hätte die Suche spürbar verlangsamt.

## 3 Relevanz — das Urteil

`berechneRelevanz(felder, abdeckung)` in
[trefferstelle.ts](../../src/core/services/search/trefferstelle.ts):

```
relevanz = abdeckung × (0,75 × stärke + 0,25 × breite)
stärke   = höchstes Feldgewicht / 3
breite   = min(1, (Anzahl Felder − 1) / 2)
```

**Feldgewichte** (nur ihr Verhältnis zählt): Titel · Akronym · Aktenzeichen 3 —
Kurzbeschreibung · Dokument 2 — Deskriptoren · Ähnlichkeit 1,5 — Organisation ·
Standort 1.

Die Staffelung sagt, wie stark eine Fundstelle für das THEMA spricht: im Titel
steht, worum es geht; in der Einrichtung steht, wer es macht. „HPC Standards
GmbH" ist kein fachlicher Standards-Treffer.

**`abdeckung`** ist der Anteil der Suchwörter mit Fundstelle — bei UND immer 1,
bei ODER der Unterschied zwischen „ein Wort von dreien" und „alle drei".

**Drei Stufen** (`relevanzStufe`): hoch ab 0,66 · mittel ab 0,40 · sonst gering.

**Wortlaut schlägt Bedeutung.** Ein reiner Ähnlichkeitstreffer wird über
`relevanzAusAehnlichkeit` gedeckelt (Faktor 0,5) und kann die Stufe „hoch" nicht
erreichen. Sonst verdrängte ein Modellurteil die belegbaren Treffer.

**Eine Zahl, nicht zwei.** `score` TRÄGT die Relevanz — es gibt keine zweite
Sortiergröße daneben. `relevanzStufe` ist vorberechnet, damit Liste und Tabelle
dieselbe Stufe zeigen und die Schwellen nur an einer Stelle stehen.

Am Bestand gemessen (14 225 Anträge): „additive Fertigung" → 570 Treffer, davon
158 hoch / 9 mittel / 403 gering, 5 verschiedene Werte. „Standards" → 14 Treffer,
davon 6 allein über den Firmennamen, alle „gering".

## 4 Faltung der Dokumenttreffer

Ein Dokumenttreffer, dessen Antrag bekannt ist (Phase-2-Manifest,
`filenameToAkz`), wird zur **Textstelle** dieses Antrags statt zu einer zweiten
Zeile. Er trägt das Feld `dokument` bei und hebt damit die Relevanz seines
Antrags. Dokumente **ohne** zugeordneten Antrag bleiben eigenständige Treffer.

Zwei Folgen:

- Die **Quellenangabe ist Dateiname bzw. Abschnitt, keine Seitenzahl** — der
  Orama-Index führt je Abschnitt nur `id/text/title/source/tags/type`.
- Der frühere zweite Orama-Lauf (`searchAntraegeDms` in der übergreifenden
  Suche) ist entfallen: er fragte denselben Index ein zweites Mal für dieselbe
  Zuordnung — 150–300 ms für ein Ergebnis, das schon vorlag.

## 5 Ähnliche Begriffe = Wortstämme

Eine Synonymquelle hat die App nicht (das Glossar führt 41 Abkürzungen ohne
Synonymfeld), und das Embedding-Modell kann Nachbarschaft messen, aber keine
Begriffe BENENNEN — ohne benennbare Begriffe gibt es nichts abzuwählen.

[wortstamm.ts](../../src/core/services/search/wortstamm.ts) löst Endungen ab
(`ungen|ung|en|er|es|em|e|s|n`, Reststamm ≥ 4 Zeichen). Die Chips der
Deutungszeile zeigen die Wörter, die im Bestand **tatsächlich gefunden** wurden.

**Der Deckel ist keine Kosmetik.** Sobald eine Variante abgewählt ist, sucht die
Stufe mit ausdrücklichen Nadeln (Wort + verbliebene Varianten) statt mit dem
Stamm — was nie eingesammelt wurde, fehlt dann. Mit Sammel-Deckel 8 fiel „Normen"
beim Abwählen EINER Variante von 28 auf 15 Treffer. Deshalb: **einsammeln 64,
anzeigen 8**; die nicht gezeigten bleiben aktiv.

## 6 Was NICHT gemacht wurde

- **Deutscher Orama-Tokenizer.** Orama läuft auf `english`; `ä ö ü ß` sind dort
  Trennzeichen, „Fördergeber" wird zu `f` + `rdergeber`. Der Fix ist eine Zeile
  (`components: { tokenizer: { language: 'german' } }`), entwertet aber den
  persistierten Index team-weit und verlangt einen Kurator-Vollindexlauf. Die
  Antragsstufe ist nicht betroffen — sie vergleicht rohe Zeichenketten.
- **Feldsuche-Syntax** (`fkz:16KN*`, `jahr:2024`) — existiert nicht und steht
  deshalb auch nicht in der Hilfe.
- **Monitoring gespeicherter Suchen** — es gibt keinen Benachrichtigungsweg.
  „+2 seit zuletzt" ist die Differenz zum letzten Ausführen, nicht „2 neue
  Anträge", und die Beschriftung sagt genau das.
