# Wunschliste an den C16-Export

Der Nachtexport wird gerade neu gebaut (Stand 12.09.2026, Umstellung in ein bis
zwei Wochen). Solange daran gearbeitet wird, ist der Zeitpunkt, an dem sich
Lücken billig schließen lassen, die uns sonst ein weiteres Jahr begleiten.

Dieses Dokument ist die **Liste für das Gespräch mit dem Fachsystem** — nicht
unsere Architektur. Alles darin ist an KITED (Verbund ZKN125314, drei
Teilvorhaben) gemessen: die drei C16-Bildschirme des Vorgangs, gehalten gegen
`9097_AnB_AitisiGPT.csv` vom 11.09.2026 (12.359 Teilvorhaben, 164 Spalten).

## 1. Sechs Ereignisse kommen nie an

41 Codes stehen in den drei C16-Bildschirmen von KITED. 34 haben eine Spalte im
Export. Diese sechs nicht:

| Code | C16 sagt | warum uns das fehlt |
|---|---|---|
| `ID` | „Rollenzuordnung durch SEIFERTV: TIB = THü" | **Das wichtigste.** C16 protokolliert jede Zuweisung mit Datum *und* mit der Person, die sie vornahm. Bei KITED ging BIB am 19.01.2026 an ViK und am 07.08.2026 an SanD; der Export trägt nur den Endstand `BIB_KUERZ = SanD`. Sieben Monate Zuständigkeit sind für uns nie passiert. Auch der Meilenstein „Antrag zugewiesen" (Soll: Woche 2) hängt deshalb an `tib_kuerz`, einem Feld **ohne Datum** — er ist entweder immer oder nie erfüllt, aber nie zum richtigen Zeitpunkt. |
| `XARF` | alle erforderlichen Rücknahmeempfehlungen sind fertig | Das Verbund-Gegenstück zu `XALF`, das wir bekommen. Die RNE-Kette endet bei uns bei `ARZ`/`ARQ`, ohne den Verbund-Abschluss. |
| `YE` | erneuter Eingang per Mail: Stellungnahme des Ast zur RNE | Das Eingangs-Ereignis zu `ARW` (bei KITED beide am 05.08.2026). |
| `AA` | Antrag vom ASt unterschrieben | Das einzige Datum, das die drei Teilvorhaben von KITED unterscheidet (18./19./23.12.2025) — der Eingang ist bei allen der 23.12. |
| `ZA1` / `TVN` | Termin 1. ZA / Verwendungsnachweis | Für die Antragsphase entbehrlich, für die Begleitphase nicht. |

Fünf davon **kennt** unser Katalog bereits als Felder (`D_AA`, `D_XARF`, `D_YE`,
`D_ZA1`, `D_TVN`) und stuft sie korrekt als `nicht-im-export` ein. `ID` kennt er
gar nicht — es gibt im Kürzelkatalog keinen Eintrag dafür.

## 2. Zwei Spalten, die sich ein Feld teilen

Nicht C16s Schuld, aber an derselben Stelle zu lösen: Wenn die **Label-XLS**
einer Datums- und ihrer Textspalte dieselbe Bezeichnung gibt, landen beide bei
uns auf einem Feld, und die hintere überschreibt die vordere. Gemessen über drei
Schemas: **20 Fälle**. Der teuerste:

```
termin_fur_nachlieferung  ←  D_ANT (Datum 08.09.2026)  +  T_ANT (Text „Termin für Nachlieferung")
```

Der Text gewinnt. Beide Regeln, die den Nachlieferungstermin brauchen — R10
„Erinnerung an NF" und R27 —, trafen deshalb auf **keinen einzigen** von 2.537
gemessenen Vorgängen zu: `gefüllt` sagt ja (ein Text ist nicht leer), `liegt in
der Vergangenheit` sagt nein (ein Text ist kein Datum). Eine Regel, die nie
greift und nie meckert.

Ebenfalls betroffen: `nw_partner ← D_XRN+ + D_XRN-` (die Zusage und ihre
Verneinung in einem Feld) und `ausfuhrende_stelle ← PLZ_AFS + ORT_AFS +
BULAND_AFS` (drei Adressteile, übrig bleibt das Bundesland).

**Bitte an C16:** je Spalte eine eigene Bezeichnung in der Label-XLS. Wo das
nicht geht, lösen wir es im Remap-Dialog; seit v6.65 meldet die App die
Kollisionen beim Öffnen eines Schemas ([spalten-kollisionen.ts](../../src/core/services/csv/spalten-kollisionen.ts)).

## 3. Das Trennzeichen der Verlaufs-Spalten

Der neue Export soll je Feld **alle historischen Werte in einer Zelle** führen,
`/`-getrennt, dazu eine gleich gebaute Spalte mit den Bearbeiterkürzeln. Damit
lässt sich endlich beantworten, wer was gesetzt hat — und die Meilensteine
könnten Ereignisse statt Momentaufnahmen prüfen.

**Der Schrägstrich ist bei uns aber schon vergeben.** Die App fügt uneinheitliche
Werte mehrerer Teilvorhaben mit `„ / "` zu einer Anzeige zusammen
([verbundMerge.ts](../../src/plugins/antraege/alleFelder/verbundMerge.ts)). Trägt
künftig jede Zelle zusätzlich einen Verlauf, schachteln sich zwei Bedeutungen
ineinander:

```
„22.01.2026/05.08.2026 / 22.01.2026/06.08.2026"
 └── Verlauf TV 1 ──┘   └── Verlauf TV 2 ──┘
```

Ein Versuch am 12.09.2026, das Datums-Lesen tolerant zu machen, hat prompt
`„2025-08-29 / offen"` als Datum gelesen und das „offen" verschluckt — der Gate
hat es gefangen.

**Bitte an C16:** ein Trennzeichen, das in den Daten nicht vorkommt und das wir
nicht schon benutzen — `|` wäre sauber. Und eine Zusage zu zwei Details, an denen
sonst geraten wird:

1. **Reihenfolge:** ältester Wert zuerst oder neuester zuerst?
2. **Leere Positionen:** bleiben sie erhalten (`a||c`), damit Datums- und
   Kürzelspalte Position für Position zusammenpassen?

Noch besser als die breite Form wäre eine **zweite, lange Datei**: eine Zeile je
(Vorgang, Code, Datum, Wert, Kürzel). Dann hängt die Zuordnung Wert↔Datum↔Person
nicht an der Positionsgleichheit dreier Listen in drei Zellen — und genau diese
Klasse stiller Fehler ist der Grund, aus dem diese Liste entstanden ist.
