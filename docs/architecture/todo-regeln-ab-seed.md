# To-do-Regeln — AB-Seed (Transkription des XLSX-Dashboards)

Stand: 03.08.2026 (Fachabstimmung eingearbeitet) · Quelle: WENN-Formeln der Mappe „AB Anträge" · Ergänzt docs/architecture/vorgangssystem.md, Abschnitt 4 Nr. 4 + 6.5

## Auswertungsmodell

**Geordnete Liste, erste zutreffende Regel gewinnt** — exakt die Semantik der verschachtelten WENNs. In der App: Zeilenreihenfolge = Auswertungsreihenfolge (per Drag änderbar), keine Prioritätszahlen. Trifft keine Regel → **„kein To-do ermittelt"** (sichtbar, nicht leer).

**Bedingungs-Vokabular** (vollständig für alle 25 Regeln): Feld gefüllt / leer · Datum A nach Datum B · Tage seit Feld > N · heute > Termin-Feld · `STATUS_TV` = Wert · Fördervariante ∈ {…}.

**Globale Sperren** (vor allen Regeln geprüft):

| ID | Bedingung | Wirkung |
|---|---|---|
| S0 | `D_VV` gefüllt (Schlussvermerk) | **kein To-do mehr** — Verfahren abgeschlossen |
| S0b | `D_AZBE` gefüllt (Zuwendungsbescheid erstellt) | **kein To-do mehr, außer R3** — Vorgang in Begleitung |
| S1 | `D_AAR` gefüllt (Antrag vom ASt zurückgezogen) | unterdrückt PreCheck-, NF- und NL-To-dos (löst stattdessen R5 aus) |
| S2 | eines von `D_ARK`, `D_ART`, `D_ABLK`, `D_ABLT` gefüllt (RNE/ABL begonnen) | unterdrückt PreCheck-, NF- und NL-To-dos |

S0/S0b rekonstruieren die **fixierten Slicer** der Mappe („Bitte untere Auswahl nicht ändern"). Sie schneiden ganze Vorgänge weg, nicht einzelne Stränge — im Code deshalb `sperrt: ['*']` statt einer Id-Liste, damit eine später ergänzte Regel nicht still an ihnen vorbeiläuft. S0b nimmt R3 („ZuwB erstellen") ausdrücklich aus; die beiden Bedingungen sind zwar disjunkt (R3 verlangt `D_AZBE` leer), aber die Ausnahme macht lesbar, warum R3 überlebt.

**Verworfen: S3** (`D_AZ1_1` gefüllt → Vor-Entscheidungs-Stränge unterdrücken). Der Slicer-Screenshot der AB-Mappe zeigt `D_AZ1_1` auf **„Alle"** — die Spalte filterte nicht. Fixiert waren nur `D_AZBE = Leer` und `D_VV = Leer`. Der ursprüngliche Vorschlag beruhte auf einer Fehllesart des Screenshots (Fachabstimmung A3).

## Regelsatz (Reihenfolge = Kaskade der Mappe)

„zuständig" = wer handelt; „wartet auf" = Fremdrollen-Ansicht derselben Regel (Konzept 6.5).

### 1 · PreCheck negativ

| Nr | WENN | DANN To-do | zuständig / wartet auf |
|---|---|---|---|
| R1 | `D_PC-` gefüllt und `D_PC+` leer (TV-PreCheck negativ), Sperren S1/S2 greifen nicht | **Abl/RNE erstellen** | AB |
| R2 | `D_XPC-` gefüllt und `D_XPC+` leer (Verbund-PreCheck negativ), S1/S2 greifen nicht | **Abl/RNE von FB abwarten** | wartet auf FB |

### 2 · Zuwendungsbescheid

| Nr | WENN | DANN To-do | zuständig |
|---|---|---|---|
| R3 | `D_ABB` gefüllt (bewilligt) und `D_AZBE` leer | **ZuwB erstellen** | AB |

### 3 · Schlussvermerk nach Rücknahme

| Nr | WENN | DANN To-do | zuständig / wartet auf |
|---|---|---|---|
| R4 | `D_AVK` gefüllt (SV vom AB signiert) und `D_VV` leer | **SV in QS** | wartet auf QS |
| R5 | `D_AAR` gefüllt, `D_AVK` leer, `D_VV` leer | **SV erstellen** | AB |

### 4 · Rücknahmeempfehlung (RNE)

| Nr | WENN | DANN To-do | zuständig / wartet auf |
|---|---|---|---|
| R6 | `D_ARZ` gefüllt (RNE an ASt), `D_ARW` leer, heute − `D_ARZ` > **31 Tage**, `D_AVK` leer | **SV erstellen** (Widerspruchsfrist abgelaufen) | AB |
| R7 | `D_ARZ` gefüllt und `D_ARW` gefüllt (Widerspruch AST), `D_AAR` leer | **Stellungnahme RNE prüfen** | AB/FB |
| R8 | `D_ARZ` gefüllt, `D_ARW` leer (≤ 31 Tage), `D_AAR` leer | **RNE abwarten** | wartet auf ASt |
| R9 | `D_ART` gefüllt (RNE techn. erstellt), `D_ARZ` leer, `D_AAR` leer | **RNE ergänzen** (kaufm. Teil) | AB |

*Gate `D_XKS` leer (kaufm. QS noch nicht erfolgt) an allen vier Regeln — **V1 beantwortet: Absicht**. Nach erfolgter kaufmännischer QS ist der RNE-Vorgang aus AB-Sicht durch; eine Erinnerung daran wäre Lärm. Seit v2.387 reguläre Bedingung, nicht mehr Vorbehalt.*

### 5 · Nachforderungs-Erinnerung

| Nr | WENN | DANN To-do | zuständig |
|---|---|---|---|
| R10 | `D_AN` gefüllt (NF an ASt), `D_ANT` gefüllt (Termin Nachlieferung), heute > `D_ANT`, `D_AL` leer | **Erinnerung an NF** | AB |

### 6 · Ablehnung

| Nr | WENN | DANN To-do | zuständig / wartet auf |
|---|---|---|---|
| R11 | `D_ABLZ` gefüllt (Abl an ASt), `D_ABLW` leer, heute − `D_ABLZ` > **31 Tage**, `D_AVK`/`D_AAR` leer | **SV erstellen** | AB |
| R12 | `D_ABLZ` gefüllt und `D_ABLW` gefüllt | **Widerspruch gg Abl bearbeiten** | AB/FB (+ Juristen) |
| R13 | `D_ABLZ` gefüllt, `D_ABLW` leer (≤ 31 Tage) | **Abl abwarten** | wartet auf ASt |
| R14 | `D_XABLF` gefüllt (alle Abl fertig AB/FB), `D_ABLZ` leer | **Abl in QS** | wartet auf QS |
| R15 | `D_ABLT` gefüllt (techn. erstellt), `D_XABLF` leer, `D_ABLZ` leer | **Abl ergänzen** (kaufm. Teil) | AB |
| R16 | `D_ABLK` gefüllt (nur kaufm. erstellt) | **Abl erstellt** | wartet auf FB |

*Unterdrückt, solange das Gutachten „in QS" ist (R19) — so die Mappe.*

### 7 · Gutachten-QS

| Nr | WENN | DANN To-do | zuständig |
|---|---|---|---|
| R17 | `D_QS` gefüllt (Gutachten-QS fertig) | **QS erfolgt** → Erstentscheidung vorbereiten | AB |
| R18 | `D_QS-` gefüllt (QS zurück an AB/FB), `D_QS` leer | **Rückfragen aus QS** | AB |

### 8 · Gutachten

| Nr | WENN | DANN To-do | zuständig / wartet auf |
|---|---|---|---|
| R19 | `D_AK4` und `D_AT4` gefüllt (beide GA-Teile fertig) | **in QS** | wartet auf QS |
| R20 | `T_XPC+` gefüllt, `D_AK4` gefüllt, `D_AT4` leer | **kaufm. fertig für QS** | wartet auf FB |
| R21 | `T_XPC+` gefüllt, `D_AK4` leer, (`D_AT4` gefüllt oder `D_ALSB` gefüllt) | **GA schreiben** | AB |

### 9 · Nachlieferung

| Nr | WENN | DANN To-do | zuständig |
|---|---|---|---|
| R22 | `D_AL` nach `D_AN` (Nachlieferung eingegangen), S2 greift nicht | **NL prüfen** | AB/FB |

### 10 · Nachforderung / PreCheck offen

| Nr | WENN | DANN To-do | zuständig / wartet auf |
|---|---|---|---|
| R23a | `STATUS_TV` = „beantragt", Fördervariante ∈ {FuE, DS}, `D_AN` leer, `D_PC±` beide leer | **PC offen** | wartet auf AB (TV-PreCheck) |
| R23b | wie R23a, aber `D_XPC±` beide leer | **PC offen** | wartet auf FB (Verbund-PreCheck) |
| R24 | `D_AN` leer, `D_ALSB` leer, `D_ALT` leer, `D_ALU` gefüllt (FB-NF-Teil da) | **NF ergänzen** (kaufm. Teil) | AB |
| R25 | `D_AN` leer, `D_ALSB` leer, `D_ALT` leer, `D_ALU` leer, `STATUS_TV` ≠ „beantragt" | **NF erstellen** | AB |

*Fördervarianten-Ausnahme: DL, NW 1, NW 2 haben keinen PreCheck (`Spalte17`) — R23a/b gelten nur für FuE/DS.*

*V2 beantwortet: der PreCheck hat zwei Teile mit verschiedenen Rollen — TV-PreCheck (`D_PC±`) = betriebswirtschaftliche Vorprüfung des **AB**, Verbund-PreCheck (`D_XPC±`) = inhaltliche Vorprüfung des **FB**. Deshalb zwei Regeln statt einer: die Engine kennt keine gerechneten Rollen. Sind BEIDE Teile vermerkt und `D_AN` trotzdem leer, fällt der Antrag auf R24/R25 durch — „PC offen" wäre dort falsch.*

## Erkenntnisse aus der Transkription

1. **Fast statuslos:** einziges Status-Literal im ganzen Regelwerk ist „beantragt" (R23/R25). Die Engine läuft auf `D_`-Feldern — bestätigt das Vorgangskarten-zentrierte Konzept.
2. **Wirksamer Eingang** = spätestes von `D_AAE` (Antragseingang) und `D_XTE` („alle Anträge da"). So startet die Mappe alle Tage-Zählungen und damit faktisch die 90-Tage-Uhr → ins Fristen-Cockpit übernommen (Konzept 6.4).
3. **31-Tage-Widerspruchsfrist** als wiederkehrendes Muster (R6, R11) — Bedingungstyp „Tage seit Feld > N" ist damit Pflicht im Regelmodell.
4. **Export deckt alle Eingaben ab:** der übermittelte Spaltenkopf enthält sämtliche Regel-Eingaben inkl. `D_PC+`, `D_XPC±`, `D_XTEC`, `T_XPC+` — der offene Punkt „fehlen Spalten im Export?" ist damit erledigt (unter Vorbehalt V3).

## In der Transkription bereinigte Mappen-Fehler

- „Tage bis ABLT" rechnet im Original mit `D_ART` statt `D_ABLT` (Copy-Paste-Fehler) — hier korrigiert.
- Die Hilfsspalte „Empfehlung" priorisiert NF vor GA, die To-do-Spalte GA vor NF. Übernommen wurde die To-do-Reihenfolge (GA vor NF); mit den ABs bestätigen.

## Verifikationsfragen (an AB-Kollegen / an C16)

Stand nach der Fachabstimmung vom 03.08.2026. Detail: [fachabstimmung-2026-08.md](fachabstimmung-2026-08.md).

- **V1 — beantwortet (Absicht).** Das `D_XKS`-Gate am RNE-Strang ist gewollt: nach erfolgter kaufm. QS ist der Vorgang aus AB-Sicht durch. Seit v2.387 Bedingung von R6–R9.
- **V2 — beantwortet.** TV-PreCheck (`D_PC±`) = **AB**, Verbund-PreCheck (`D_XPC±`) = **FB**. R23 ist entsprechend in R23a/R23b geteilt.
- **V3 — erledigt.** Der übermittelte Spaltenkopf ist der nächtliche Export.
- **V4 — bestätigt.** `D_QS` = Gutachten-QS fertig, `D_QS-` = QS zurück an AB/FB (Kommentar an der Stelle in `seed-codes.ts`).
- **V5 — beantwortet über A3.** Die Endschranke ist kein Zusatz an R19, sondern die Populations-Sperre S0b: nach dem Zuwendungsbescheid gibt es kein To-do mehr.
- **V6 — beantwortet (04.08.2026).** `ID` = **Rollenvergabe**, `TTV1`/`TTV2`/`TVB1` = **Testkürzel**. Anders als hier bisher notiert stehen sie nicht in Bedingungs-Argumenten, sondern tragen **eigene Trigger-Zeilen** (`ID` 30 Zeilen in allen neun Richtlinien, die Testkürzel je 2 in 78 und 138; einzige Ausnahme: `TTV2` steht zusätzlich zweimal als ungedeutetes Zusatz-Argument). Umgesetzt in [sonderkuerzel.ts](../../src/core/status/sonderkuerzel.ts).
- **V7 — beantwortet.** Innerhalb eines Programms doppelte (Kürzel, Folge) bleiben „erster Eintrag gilt + Warnung"; die beobachteten Fälle (AZBE/Folge 1 in 79 und 139) sind identisch.
- **V9 — beantwortet.** Die `D_`-Spalten tragen je Kürzel das **zuletzt** gesetzte Datum; frühere Setzungen sind im Export überschrieben. Der Verlauf sagt das jetzt so.
- **V10 — zur Kenntnis.** Der Tippfehler „Rüchnahmeempfehlung" im Blatt „Erklärung Parameter" wird in der Quelle korrigiert; die App führt beide Schreibweisen weiter.

**Neu aus der Messung (v2.388), noch offen:** nach der Zieltage-Sammelübernahme bleiben **1982 Vorgänge „nicht bewertbar"** — davon **1769 im Status 59 „bewilligt"** (Begleitungsphase) und 206 in weiteren Begleitungs-/Abschluss-Status. Innerhalb der Antragsphasen sind es nur noch **7**. Der Wächter schweigt dort also nicht aus Nachlässigkeit, sondern weil die Antragsfrist in der Begleitung nichts mehr misst. Ob die Begleitung eine **eigene** Zielvorgabe bekommen soll (VN-Logik statt 90-Tage-Uhr), ist eine Fachfrage.

**Neu aus der Messung (v2.386), noch offen:** sieben Trigger-Zeilen `VOBQ/Folge 1` (Programme 76, 77, 78, 131, 136, 137, 138) tragen den Parameter `PFM!.055.VorgInfo.01` — zwischen Empfänger und Textbaustein **fehlt die Pipe** (`PFM|!.055.VorgInfo.01`). Sie sind die einzigen verbliebenen „nicht interpretiert"-Zeilen.

## Anhang: Trigger-Fixture-Zeilen für Parser-Tests

Transkribiert aus der Legacy-Trigger-Tabelle (Richtlinie 76).

> **Verifiziert am echten Import (v2.380).** Die Pipe-Anzahl stimmt: acht
> Argumente, von **vorn** gezählt. Fehlende Schluss-Pipes heißen „Argument fehlt",
> nicht „die letzten Werte rutschen nach vorn" — die frühere Lesart von beiden
> Enden her drehte `<59|ABB|||||40` (sieben Argumente) um. Die Tabelle unten ist
> unverändert gültig; ihre Zeilen liefern unter beiden Lesarten denselben Satz.
> Neu ist außerdem, dass jede Zeile zu **einer Richtlinie** gehört (hier 76) —
> siehe [vorgangssystem.md, Abschnitt 3a](vorgangssystem.md#3a-trigger-gelten-je-richtlinie).

| Kürzel | Folge | Prozedur | Parameter |
|---|---|---|---|
| AAE | 1 | TRG_TVs_Status_TV_VB | `<59\|ABB\|YIRR\|\|\|\|31\|31` |
| AAE | 2 | TRG_TVs_Status_TV_VB | `<99\|ABB\|\|\|\|\|31\|` |
| AAE | 3 | TRG.VorgEintragNeu | `XAAE\|210\|0` |
| AAR | 1 | TRG_TVs_Status_TV_VB | `<59\|ABB\|\|\|\|\|73\|73` |
| AAR | 2 | TRG.VorgEintragMail | `TIB\|!.055.VorgInfo.01\|BIB` |
| AAR | 3 | TRG.VorgEintragNeu | `AAA\|211\|0` |
| AAR | 4 | TRG.VorgEintragNeu | `AZ1\|211\|0` |
| ABA | 1 | TRG.Status.TV.VB | `211\|74` |
| ABA | 2 | TRG.VorgEintragMail | `PFM\|!.055.VorgInfo.01\|ZTP` |
| ABB | 3 | TRG.VorgEintragNeu | `AZ1\|211\|0` |
| ABB | 5 | TRG.VorgEintragMail | `ZIM-Assistenz@vdivde-it.de\|!.055.VorgInfo.01` |
| ABLF | 1 | TRG.VorgEintragMail | `ZIM-qs@vdivde-it.de\|!.055.VorgInfo.01` |
| ABLW | 1 | TRG_TVs_Status_TV_VB | `<59\|ABB\|\|\|\|\|75\|` |
| ABLWR | 1 | TRG.Status.TV.VB | `210\|73` |

Erwartete Parser-Ergebnisse (Beispiele): AAE/1 → „Wenn VB-Status vor 59, TV hat kein ABB, kein TV des Verbunds hat YIRR → setze TV-Status 31 und VB-Status 31." · ABA/1 → „Setze TV-Status (211) auf 74." · AAR/2 → „Mail an TIB, Textbaustein VorgInfo.01, CC BIB." · AAR/3 → „Vorgangseintrag AAA anlegen (TV-Ebene 211, +0 Tage)."
