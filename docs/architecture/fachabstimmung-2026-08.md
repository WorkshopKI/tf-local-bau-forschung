# Fachabstimmung Vorgangssystem — Ergebnis (03.08.2026)

Datenbasis der Vorlage: CSV-Import 02.08.2026, Katalog v7, Trigger v1 (2 447 Zeilen, 9 Programme), App v2.385.1 · Umgesetzt in v2.386–v2.389.

Jede Entscheidung hier ist als Katalog-Zeile änderbar — es ging um den Startzustand, nicht um Beton. Was die Umsetzung an den Daten zusätzlich gefunden hat, steht bei der jeweiligen Entscheidung.

## Teil A — Entscheidungen

### A1 · ZAH-Phase von „beantragt" (Code 31) — 260 Vorgänge

**Option 1: 31 bleibt Eingang.** Der amtliche Status ist die Wahrheit; dass ein weiterführendes Kürzel fehlt, zeigt der Stillstands-Wächter — genau dafür ist er da. Die alte App-Ableitung hatte diese Vorgänge eigenmächtig als „Vollständigkeit" geführt.

*Keine Code-Änderung nötig — der Seed lag bereits so.*

### A2 · Zieltage je Status — 1 921 Vorgänge „nicht bewertbar"

**Option 1: Median-Vorschläge für die Phasen Eingang bis Entscheidung übernehmen**, je Zeile sichtbar und einzeln korrigierbar.

Umgesetzt als Sammel-Aktion mit Vorschau (v2.388): Status, Ebene, Phase, Stichprobe, alt → neu. Werte mit weniger als **fünf** Beobachtungen werden **nicht** gesetzt, sondern namentlich gelistet — ein Median aus zwei ist eine Zufallszahl.

**Was die Messung ergab.** „nicht bewertbar" fiel von 1 937 auf **1 679**. Der verbleibende Rest ist erklärbar und kein Pflege-Rückstand: von 1 982 im Vollbestand tragen **1 769 den Status 59 „bewilligt"** und 206 weitere einen Begleitungs- oder Abschluss-Status. Innerhalb der Antragsphasen bleiben **7**. Der Wächter schweigt dort, weil die Antragsfrist in der Begleitung nichts mehr misst — nicht, weil jemand etwas vergessen hätte.

> **Neue Fachfrage:** Soll die Begleitungsphase eine **eigene** Zielvorgabe bekommen (VN-Logik statt 90-Tage-Uhr)?

Nebenbefund: die Stichprobe zählte anfangs nur den **Verbund**-Status. Werte wie „NF gestellt" stehen fast nur am Teilvorhaben und kamen so auf n = 2 — ausgerechnet die Status, für die eine Zielvorgabe am meisten trägt, fielen durch die Grenze. Seit die TV-Status mitzählen: n = 51, verwertbare Vorschläge 10 → 22.

### A3 · To-do-Sperren aus dem AB-Dashboard — korrigiert

**Option 1 mit Korrektur.** Der Slicer-Screenshot der Mappe zeigt fixiert **`D_AZBE = Leer`** und **`D_VV = Leer`**; **`D_AZ1_1` stand auf „Alle"** und filterte nicht. Der ursprünglich vorgeschlagene S3 beruhte auf einer Fehllesart und **wird nicht gebaut**.

| ID | Bedingung | Wirkung |
|---|---|---|
| **S0** | `D_VV` gefüllt (Schlussvermerk) | kein To-do mehr — Verfahren abgeschlossen |
| **S0b** | `D_AZBE` gefüllt (Zuwendungsbescheid) | kein To-do mehr, **außer R3** — Vorgang in Begleitung |

Beide sperren im Code `['*']` (alle übrigen Regeln) statt einer Id-Liste: eine später ergänzte Regel fiele sonst still durch die Sperre. S0b nimmt R3 („ZuwB erstellen") ausdrücklich aus — die Bedingungen sind zwar disjunkt, aber die Ausnahme macht lesbar, warum R3 überlebt.

**Gemessen** (v2.387): „in QS" **1 756 → 75** · Meine Aufgaben 1 117 → 477 · Wartet auf andere 2 244 → 347 · echte Regellücken 520 → **120** (dazu 2 937 abgeschlossene, seither eine eigene Gruppe: eine greifende Sperre ist ein Ergebnis, keine Lücke).

### A4 · Programme ohne Trigger — wieder offen (v2.397)

**Option 1: Zustand belassen** — die Programme sind stillgelegt, die Meldung ist korrekt (V8: keine aktiven Trigger). Die Meldung nennt jetzt das Klartext-Label statt der nackten Nummer.

**Der damals genannte Nebeneffekt ist zurückgenommen.** Er lautete: im Standard-Betrachtungsbereich (v2.389) verschwinde die Meldung von selbst, weil diese Programme nicht mehr im Arbeitsvorrat stünden. Seit v2.397 umfasst der Bereich die **drei jüngsten Richtlinien-Generationen** — 2015 gehört dazu. Damit stehen 46/47/48 (5 086 Anträge) wieder im Arbeitsvorrat, und die Trigger-Zuarbeit führt für sie nichts: die Meldung ist bis zu 5 086 Mal korrekt statt praktisch unsichtbar. Außerhalb bleibt nur die Generation 2012 (34–37, 1 866 Anträge).

**Damit ist Option 2 konkret adressierbar:** Nachexport der Trigger für **46, 47, 48** anfordern? Das ist eine Entscheidung der AB, kein Code-Fix — die App sagt derweil ehrlich, was sie nicht weiß.

### A5 · Führende Status-Ebene in Listen

**Option 1: TV-Status führt.** Das Herleitungs-Popover weist beide Ebenen getrennt aus („Verbund-Status: 31 · TV-Status: 72"). Real-Fall SPOROWIPE bleibt damit lesbar, ohne dass die App einen Status korrigiert.

*Keine Code-Änderung nötig — seit v2.382 so gebaut.*

## Teil B — Verifikationen

| Nr | Frage | Antwort | Umsetzung |
|---|---|---|---|
| V1 | `D_XKS`-Gate am RNE-Strang — Absicht oder Altlast? | **Absicht.** Nach erfolgter kaufm. QS ist der RNE-Vorgang aus AB-Sicht durch. | Reguläre Bedingung von R6–R9 (v2.387) |
| V2 | Wer führt den PreCheck durch? | **Zwei Teile, zwei Rollen**: TV (`D_PC±`) = AB, Verbund (`D_XPC±`) = FB | R23 in R23a/R23b geteilt (v2.387) |
| V3 | Spaltenabdeckung des Nachtexports | bestätigt | — |
| V4 | `D_QS` / `D_QS-` | **Bestätigt**: QS = Gutachten-QS fertig, QS- = zurück an AB/FB | Code-Kommentar an der Stelle |
| V6 | Kürzel **ID, TTV1, TTV2, TVB1** | **beantwortet (04.08.2026)**: `ID` = Rollenvergabe, die drei anderen = Testkürzel | `sonderkuerzel.ts` (v2.406): Testkürzel raus aus dem Navigator (gezählt), `ID` mit Bedeutung statt nackt, Import-Warnung um die vier bereinigt |
| V7 | Doppelte AZBE/Folge-1-Zeilen (79, 139) | „erster gilt + Warnung" bleibt — die Einträge sind identisch | Kommentar im Import |
| V9 | Erstes oder letztes Datum in der `D_`-Spalte? | **Das zuletzt gesetzte**; frühere Setzungen sind überschrieben | Beschriftung von Verlauf und Chronik — und seit v2.392 das **Import-Diff-Journal**: ab seinem Nullpunkt geht die überschriebene Setzung nicht mehr verloren ([vorgangssystem.md §12](vorgangssystem.md)) |
| V10 | Tippfehler „Rüchnahmeempfehlung" in der Zuarbeit | wird in der Quelle korrigiert | App führt beide Schreibweisen weiter |

*(V5 und V8 sind über A3 bzw. A4 beantwortet.)*

## Neu aufgeworfen

Aus der Umsetzung, noch offen:

1. **Sieben Trigger-Zeilen mit fehlender Pipe.** `VOBQ/Folge 1` trägt in den Programmen 76, 77, 78, 131, 136, 137, 138 den Parameter `PFM!.055.VorgInfo.01` — zwischen Empfänger und Textbaustein fehlt das Trennzeichen (`PFM|!.055.VorgInfo.01`). Es sind die **einzigen** verbliebenen „nicht interpretiert"-Zeilen (30 → 7 nach v2.386).
2. **Zielvorgabe für die Begleitungsphase** (siehe A2).

## Zur Kenntnis: was die Umsetzung sonst korrigiert hat

- **Die Trigger-Sidecar speicherte ihre eigene Deutung mit.** Eine Parser-Verbesserung wäre erst beim nächsten XLSX-Import angekommen; jetzt wird beim Laden neu abgeleitet.
- **Der Regel-Editor arbeitete auf einem anderen Vokabular als die Auswertung** — man konnte dort eine Regel bauen, die still nie zutrifft.
- **Ein gewachsener Regelsatz erreichte bestehende Fassungen nicht.** Die Vorgangs-Regeln zeigen die Drift jetzt und ziehen sie nach.
- **Betrachtungsbereich** (v2.389, korrigiert v2.397): der Arbeitsvorrat steht auf den letzten drei Richtlinien-**Generationen** (2015 + 2020 + 2025 = 12 Programme, 12 355 Anträge), die Suche bleibt am Vollbestand. v2.389 hatte nach Trigger-Abdeckung geschnitten und dabei 2015 ausgelassen. Von den sichtbaren Zahlen ändert sich **nur** „Alle" in der Antragsliste (9 316 → 5 542 → 7 468) — kein Arbeitsvorrat-Zähler, in keinem der beiden Schritte.
