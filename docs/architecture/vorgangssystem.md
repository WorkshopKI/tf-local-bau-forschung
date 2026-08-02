# Vorgangssystem — Status, To-do, Wächter, Cockpit (ZAH-App)

Stand: 01.08.2026 · **P0–P5 umgesetzt** (v2.374 – v2.379), P6 offen ·
Flag `vorgangssystem` (dev + pl) · Modul `src/core/status/`

## 0. Umsetzungsstand

| Phase | Was | Version |
|---|---|---|
| P0 | Status-Codes, ZAH-Phasen, Trigger-Parser, zwei XLSX-Importe, Diagnose-Report | v2.374.0 |
| P1 | Status-Erklärung (Herleitungs-Popover) | v2.375.0 |
| P2 | Kürzel-Glossar, Relevanz-Häkchen, Nächster-Schritt-Navigator | v2.376.0 |
| P3 | To-do-Kaskade (AB-Regelsatz) + Vorgangs-Board | v2.377.0 |
| P4 | Stillstands-Wächter, Zieltage, Home-Widget „Hängt fest" | v2.378.0 |
| P5 | Fristen-Cockpit (Bearbeiter + PL), wirksamer Eingang, XLSX-Export | v2.379.0 |
| P6 | Rückbau der alten Ableitung | offen → [vorgangssystem-p6-inventar.md](vorgangssystem-p6-inventar.md) |
| — | Trigger je Richtlinie (Nacharbeit am ersten echten Import) | v2.380.0 → [Abschnitt 3a](#3a-trigger-gelten-je-richtlinie) |

**Abweichungen von der ursprünglichen Planung**, jeweils mit Grund:

- Die **Trigger-Tabelle** liegt in einer eigenen Sidecar
  (`_intern/status-trigger.json`) statt in der Katalog-Fassung — gemessen: 356,5 KB
  je Fassung, bei zehn Fassungen 6,8 statt 2,4 MB, und jedes Speichern schreibt
  die ganze Datei über SMB. **Eine** Mechanik (`sidecar-datei.ts`), zwei Dateien.
- Die **Cockpit-Sichten** sitzen im Vorgangs-Board, nicht im Meilenstein-Plugin:
  sie brauchen Status, ZAH-Phase, To-do, Wächter und Restfrist, und das entsteht
  dort in EINEM Durchlauf über 14 221 Anträge.
- Die **Reihenfolge der To-do-Regeln** ändert man über Pfeile, nicht per Ziehen —
  die Position ist das Ergebnis, also muss sie präzise setzbar sein.
- **Kein Kürzel-Laufzeit-Import**: die 505 Codes kommen weiter über
  `npm run gen:status-codes` in den Build. Dafür meldet der Kürzel-Tab Drift
  („n Kürzel im Export ohne Katalog-Eintrag").

## 1. Leitidee

Die ZAH-App ist **Companion, nicht zweite Workflow-Engine**. Das Legacy-System (Foyer) führt die Wahrheit: Bearbeiter setzen Vorgangskürzel, Trigger ändern Status und versenden Mails. Die App liest den nächtlichen CSV-Export und leistet das, was dem Legacy fehlt:

1. **Erklären** — warum hat ein Antrag diesen Status, was ist zuletzt passiert (Info-Icon)
2. **Navigieren** — welches Kürzel ist als Nächstes zu setzen, von wem, was löst es aus
3. **Warnen** — welcher Antrag hängt fest, weil ein Kürzel vergessen wurde (Stillstands-Wächter)
4. **Steuern** — Fristen-Cockpit für Bearbeiter und PL, ersetzt die Hand-XLSX-Listen

**Die App leitet keinen Status ab.** `STATUS_TV` / `STATUS_VB` aus dem CSV werden angezeigt, wie sie sind — sie sind das Ergebnis der Legacy-Trigger, Stand letzte Nacht. Damit entfällt die gesamte bisherige Ableitungslogik (Ränge, Prioritäten, Ordner-Ränge) und mit ihr die Rechner-Divergenz: Unterschiede zwischen zwei Rechnern können nur noch Datenstand-Unterschiede sein, und der Datenstand wird überall sichtbar mitgeführt.

## 2. Zentrale Erkenntnis zum Datenmodell

**Die Vorgangskarte ist bereits im CSV** — flachgeklopft als Spalten:

- `D_<KÜRZEL>` = Datum, an dem das Kürzel gesetzt wurde (z. B. `D_AAE` Antragseingang, `D_ARF` Entwurf RNE fertig)
- `T_<KÜRZEL>` = optionaler Begleitwert (z. B. `T_AAI` Foyer-Identcode, `T_XAT` Anzahl erw. TV)

Die 512 Felder im bestehenden Felder-Tab **sind** diese Kürzel-Spalten; der Ordnerbaum ist ihre fachliche Gliederung, die Label-XLS liefert die Bezeichnungen. Es braucht keinen neuen Export — nur eine neue Interpretation der vorhandenen Felder.

**Bekannte Grenzen (ehrlich ausweisen, nicht verstecken):**

- Ein Datum pro Kürzel-Spalte → bei mehrfach gesetzten Kürzeln ist nur das letzte (bzw. das exportierte) Datum sichtbar. Der rekonstruierte Verlauf ist eine Näherung, keine vollständige Historie. Wiederholungen mit eigener Spalte (z. B. `D_AAE2`) werden normal mitgenommen.
- Ein-Tages-Verzug durch den Nacht-Export. Bei 90-Tage-Fristen ist Tagesgranularität ausreichend; der Importzeitpunkt wird überall angezeigt.
- Status liegt nur als Text vor → Join über den importierten Status-Katalog (Text ↔ Code), NFC-normalisiert. Danach rechnet die App intern mit Codes; Textvarianten betreffen nur noch Labels.

## 3. Referenzdaten: drei Importe statt Kuratier-Aufwand

Alle drei kommen als XLSX-Import aus dem Legacy (Kurator-Aktion, manuell alle paar Monate), liegen versioniert auf dem Share (`_intern/`, `atomicWrite`, Version + Hash), und zeigen beim Re-Import einen Diff („3 neue Kürzel, 1 geänderter Trigger, 2 entfallen").

| Referenz | Inhalt | Umfang | Rolle in der App |
|---|---|---|---|
| **Status-Katalog** | Code ↔ Text (11 Skizze … 99 Schlussvermerk), Marker-Kennzeichnung | ~30 | Text→Code-Join, Anzeige, Sortier-Default |
| **Kürzel-Katalog** | Kürzel ↔ Beschreibung ↔ „wird gesetzt von" (AB/FB/QS/PA/Juristen/neutral) | mehrere hundert | Glossar, Navigator, Wächter-Rollen |
| **Trigger-Tabelle** | Kürzel → Folge → Prozedur → Parameter (geparst) | mehrere hundert Zeilen | Erklärung + Navigator |

**Trigger-Parser:** vier Prozedurtypen (`TRG_TVs_Status_TV_VB`, `TRG.VorgEintragNeu`, `TRG.VorgEintragMail`, `TRG.Status.TV.VB`), Pipe-getrennte Parameter, Semantik ist im Legacy dokumentiert. Nicht parsebare Zeilen werden als „nicht interpretiert" gekennzeichnet und roh angezeigt — niemals stillschweigend verworfen (Heuristiken sind ehrlich). Der Parser erzeugt pro Trigger eine **deutsche Satzform**:

> **AAE / Folge 1:** Wenn Verbund-Status vor 59 (bewilligt), das TV kein ABB hat und kein TV des Verbunds ein YIRR → setze TV- und VB-Status auf 31 (beantragt).

Mail-Empfänger-Platzhalter (#BA1, #FB1, #TB1, #TV1 …) werden zunächst **unaufgelöst mit Legende** angezeigt („#TB1 = Bearbeiter des TV"); die Auflösung auf CSV-Spalten (vermutlich BIB-/TIB-Familien, s. Abschnitt 5a) ist spätere Verfeinerung, kein Blocker.

Dazu eine Mini-Referenz **Fördervariante** (`VB_PHASE`): 1 = NW 1 · 2 = NW 2 · 3 = FuE · 4 = DL · 5 = DS · 9 = Irrläufer (decodiert aus der Dashboard-Formel der ABs). Damit verschwinden die `VB_PHASE`-Werte endgültig aus jeder Status-Betrachtung — es ist der **Antragstyp**, derselbe, den das Auslastungs-Modul als DL/DS/NW/FuE-Kontingente kennt, und ein Filter-Facet im Cockpit.

### 3a. Trigger gelten je Richtlinie

Der erste echte Import (v2.380) hat drei Annahmen aus P0 widerlegt, die auf einem
Screenshot beruhten. Alle drei sind korrigiert; die Regeln stehen hier, weil man
sie ohne Hinweis wieder falsch macht.

**Das Programm ist Teil des Schlüssels.** Die Zuarbeit führt ~2450 Zeilen über
neun Richtlinien (76, 77, 78, 79, 131, 136–139), oft dieselbe (Kürzel, Folge) mit
verschiedener Wirkung. Der alte Schlüssel (Kürzel, Folge) ließ davon **362**
übrig — der Rest fiel als „Dublette, erster Eintrag gilt" weg, und danach bekam
jeder Antrag die Trigger der Richtlinie 76. Nichts daran war sichtbar. Jetzt gilt:

- Schlüssel = `(Programm, Kürzel, Folge)`; keine programmübergreifende Deduplizierung.
- Fehlt die Spalte „Richtlinie/Programm", **bricht der Import ab** statt teilweise
  zu laden — ein programmloser Bestand ließe sich keinem Antrag zuordnen.
- Die Auswahl je Antrag läuft über `FM_NUMMER` (kanonisch `unterprogramm_id`);
  Programm-Nummer und Richtlinien-Nummer sind derselbe Nummernraum.
- **Kein Ersatz-Programm.** Drei unterscheidbare Zustände, nie ein vierter stiller:
  Tabelle nicht importiert · Programm des Antrags unbekannt · Programm ohne Trigger.
- Zeilen aus einem Import vor v2.380 tragen kein Programm, greifen an keinem
  Antrag und werden in der Referenzdaten-Sektion gezählt („bitte neu einlesen").

**Argumente stehen an acht festen Positionen, von vorn gezählt** (0 Status-Vergleich ·
1 ohne-TV · 2 ohne-Verbund · 3–5 weitere · 6 TV-Status · 7 VB-Status). Fehlende
Schluss-Pipes heißen „Argument fehlt": `<59|ABB|||||40` (sieben Argumente) setzt
den **TV**-Status auf 40 und lässt den VB unverändert. Bis v2.379 las der Parser
von beiden Enden — das drehte genau diesen Fall um. Alle 14 Fixture-Zeilen der
Seed-Doku liefern unter beiden Lesarten denselben Satz.

**Kommas trennen UND-Listen** (Legacy-Doku, Blatt „Erklärung Prozedur"): in den
Argumenten 2–6 steht `ABB,AB,AK4` für „hat kein ABB und kein AB und kein AK4".
Jedes Kürzel ist im Navigator eine eigene Bedingung mit eigenem Urteil — ein
unbekanntes macht nur seinen Teil unprüfbar, nicht die ganze Zeile. Nach dem
Splitten bleiben als unbekannte Kürzel voraussichtlich nur **ID, TTV1, TTV2,
TVB1** übrig (Verifikationsfrage V6).

**Blätter werden namentlich gewählt** — „Trigger-Prozeduren" und „Erklärung
Parameter"; passt der Name nicht, wird die ganze Mappe nach passenden
Überschriften durchsucht, und erst dann gibt der Import auf (mit Blatt- und
Spaltenliste in der Meldung). „Erklärung Parameter" führt drei Zeilenarten:
Statuscodes, Bearbeiter-Kürzel und `!.055.…`-Textbausteine. Die Bearbeiter-Zeilen
werden gegen `MAIL_ROLLE` (`rollen.ts`) **geprüft**, nicht gespeichert — die
Zuordnung Kürzel → Rolle steht genau einmal im Code (Pitfall #43). Die
Textbaustein-Legende landet als `MappingVersion.textbausteine` in der Fassung und
wird zur **Anzeigezeit** aufgelöst, damit eine später importierte Legende nicht
die ganze Trigger-Tabelle neu parsen lassen muss.

**Gemessen am Bestand (14 221 Anträge, August 2026):** jeder Antrag trägt eine
`FM_NUMMER` — der Fall „Programm unbekannt" kommt im echten Bestand nicht vor.
Die Nummern verteilen sich auf **16** Programme, die Trigger-Zuarbeit deckt neun
davon ab. Auf die abgedeckten entfallen 7269 Anträge, auf die übrigen sieben
(47, 36, 46, 34, 48, 35, 37) **6952**. Für diese knappe Hälfte des Bestands sagt
die App künftig „für Programm N keine Trigger importiert" — vorher bekam sie
stillschweigend die Trigger der Richtlinie 76. Der Import-Diff listet die
Programme mit Antragszahl auf, damit die Lücke eine Entscheidung wird und kein
Zufall bleibt.

## 4. App-eigene Pflege: bewusst nur vier kleine Listen

Konfigurierbar durch PL und Kurator, gespeichert auf dem Share (versioniert, mit Änderungs-Audit). Alles andere ist Import.

1. **Relevanz-Häkchen pro Kürzel** — markiert die ~50–70 für die Antragsbearbeitung relevanten Kürzel. Filtert Navigator, Wächter und Glossar-Default. Nichts wird gelöscht; das historische Rauschen bleibt abrufbar, stört aber nicht mehr.
2. **Zieltage pro Status** — eine Zahl pro Status-Code (z. B. „35 NF gestellt: max. 21 Tage"). Grundlage des Wächters. Status ohne Zieltage werden als „kein Ziel definiert" angezeigt, nicht verschluckt.
3. **ZAH-Phase pro Status** — siehe Abschnitt 5.
4. **To-do-Regeln** — eine Entscheidungstabelle im Trigger-Satz-Stil: eine Zeile pro To-do, lesbar als deutscher Satz. *„WENN Status 71 (RNE versandt) und D_ARQ leer → To-do «RNE ergänzen», zuständig AB."* Genau das rechnen die ABs heute per WENN-Formeln in ihrem XLSX-Dashboard — die App hebt diese Regeln aus der privaten Mappe in eine geteilte, versionierte Tabelle (Seed: Transkription der XLSX-Formeln, siehe 6.5).

Kein Regel-Editor, keine Prioritäten, keine Kategorie-Kuration, keine Unkuratiert-Queue mit hunderten Einträgen. Neue Statuswerte/Kürzel kommen über den Katalog-Re-Import; taucht im CSV ein Wert auf, der im Katalog fehlt, ist das genau **ein** Warnhinweis („im Export gesehen, nicht im Katalog — Katalog aktualisieren?").

## 5. ZAH-Phasen: die Lesebrille der App

Die bisherigen Spine-Phasen (Eingang → Vollständigkeit → Fachprüfung → Bewilligung → Schluss) sind eine App-Erfindung — das Legacy kennt keine Phasen (`VB_PHASE` ist die Fördervariante, ein anderes Konzept). Das ist legitim, wird aber ehrlich gemacht:

- **Umbenennung in „ZAH-Phase"** überall (UI, Code, Docs), um die Kollision mit `VB_PHASE` dauerhaft zu beenden.
- **Explizite Zuordnungstabelle** Status-Code → ZAH-Phase (~30 Zeilen, PL-editierbar, sinnvoll vorbelegt). Kein Ableiten aus Code-Bereichen — die Codes sind nur grob geordnet (32 ablehnungsreif liegt vor 34 bearbeitungsreif).
- **Marker-Status ohne Phase**: 88 Sonderstatus, 93 assoziierter Partner, 94 internationaler Partner u. ä. bekommen bewusst keine Phase und laufen als Kennzeichen neben dem Verfahren.
- **Nur Anzeige-Funktion**: Gruppierung im Cockpit, Filter-Sidebar, Sortierung. Die ZAH-Phase leitet nichts ab und triggert nichts.

**Grundsatz: Phase ≠ Rolle.** Neben der fachlichen Prüfung (FB) läuft die administrative Prüfung (AB) — und zwar **parallel, nicht nacheinander**. Das zeigt schon der Kürzel-Katalog mit seinen durchgängigen Paaren: AKTK/AKTT (Aktennotiz kaufm./fachl.), AK4/AT4 (Gutachten kaufm./techn.), ARK/ART (RNE adm./techn.), ABLK/ABLT, ÄK/ÄT, LK/LT, MVK/MVT, SK/ST — bis in die Begleitphase (95 VN techn. geprüft / 97 VN geprüft). Eine Phase „Administrative Prüfung" neben einer Phase „Fachprüfung" wäre deshalb falsch modelliert: ein TV wäre ständig in beiden gleichzeitig. Stattdessen: die Phase sagt, **wo im Verfahren** der Antrag steht; die Rolle sagt, **wer gerade dran ist** (Abschnitt 5a). Die bisherige Phase „Fachprüfung" wird in **„Prüfung"** umbenannt, weil sie beide Stränge umfasst.

Vorschlag Phasen-Schnitt (Seed, diskutierbar):

| ZAH-Phase | Status-Codes |
|---|---|
| Eingang | 11 Skizze, 31 beantragt |
| Vollständigkeit | 33 unvollständig, 34 bearbeitungsreif, 35 NF gestellt, 36 NL eingegangen, 37 keine weiteren NF |
| Prüfung (fachlich + administrativ) | 38 techn geprüft, 39 kaufm geprüft, 40 Gutachten fertig |
| Entscheidung | 32 ablehnungsreif, 50 Bewilligungsentwurf, 51 bewilligungsreif, 70 Ablehnung versandt, 71 RNE versandt, 72 Stellungnahme RNE, 75 Widerspruch zur Ablehnung |
| Begleitung | 59 bewilligt, 89 Anhörung Widerruf, 92 Widerruf, 95 VN techn. geprüft, 97 VN geprüft |
| Abgeschlossen | 73 abgelehnt/zurückgezogen, 90 abgebrochen, 91 beendet, 99 Schlussvermerk |
| Marker (ohne Phase) | 29 Irrläufer, 88 Sonderstatus, 93 assoziierter Partner, 94 internationaler Partner |

Änderungswünsche der Kollegen sind eingeplant: die Zuordnung ist eine editierbare Tabelle im Status-Katalog-Modul (PL/Kurator), jede Änderung erzeugt eine neue Katalog-Version mit Diff — umhängen eines Status ist eine Zeilen-Änderung, kein Code-Deployment.

## 5a. Rollen: die zweite Dimension

Die Rollen existieren in der App bereits als Profil-Feld („Meine Rolle": AB — administrative Bearbeitung, FB — fachliche Bearbeitung, QS, PA, Juristen). Die AB-Kolleginnen und -Kollegen sind die nächste Nutzergruppe — die Rollen-Dimension wird deshalb von Anfang an mitgebaut, nicht nachgerüstet:

- **Quelle** ist die Spalte „wird gesetzt von" im Kürzel-Katalog. Werte wie `AB/FB`, `AB/QS/Juristen` werden als Rollen-Menge geparst; `neutral` = jede Rolle. Größenordnung: AB kann ~153 der ~505 Kürzel setzen, FB ~130 — ohne Rollen-Filter wäre der Navigator für beide Gruppen halb irrelevant.
- **Zuständigkeits-Spalten:** Die Rollen haben feste Spalten im Export — FB-Zuständigkeit steht in TIB (Begleitung: ZTP), AB-Zuständigkeit in BIB (bzw. BFM/PFM). So weist es die Legacy-Parametertabelle aus („BIB/BFM/PFM = AB-Bearbeiter, TIB/ZTP = FB-Bearbeiter"), und so filtert das AB-Dashboard über `BIB_K`. „Meine Anträge" funktioniert damit für beide Rollen mit vorhandenen Spalten: FB über TIB/ZTP (heute schon), AB über BIB/BFM/PFM (`useMeinKuerzel` + Rolle, neu anzuschließen).
- **Navigator und Glossar** filtern per Default auf „Meine Rolle" (umschaltbar auf alle). Ein FB sieht seine nächsten Schritte, ein AB seine.
- **Wächter** benennt die hängende Rolle über die Soll-Rolle des fehlenden Kürzels: „hängt bei AB" / „hängt bei QS". Da der Export keine Setzer-Info enthält (geklärt), ist die Soll-Rolle die Arbeitsgrundlage — das reicht für die Frage „wessen Schreibtisch".
- **Kürzel-Paare als Strang-Anzeige**: Wo Paare existieren (AK4/AT4 etc.), kann die App den Prüfungs-Fortschritt je Strang zeigen: „fachlich fertig (AT4, 12.07.) · administrativ offen (AK4)". Das ist die präziseste Form von Wächter Stufe 2 — ohne jede Ketten-Pflege, rein aus Katalog-Paaren und `D_`-Spalten.
- **Relevanz-Häkchen** (Abschnitt 4) bleiben eine Liste, sind aber nach Rolle filterbar; ob es getrennte Relevanz-Defaults je Rolle braucht, entscheidet sich beim AB-Onboarding.

## 6. Die vier Funktionen

### 6.1 Status-Erklärung (graues Info-Icon)

An jeder Status-Anzeige (Förderanträge-Liste, Detail, Home, Verbund). Popover, vollständig aus Daten gerendert, kein handgepflegter Text:

> **35 · NF gestellt** — seit 14.06.2026 (47 Tage) · ZAH-Phase Vollständigkeit
> Letzter Vorgang: **ABB** „Nachforderung erstellt" (14.06.2026, Rolle AB)
> Dieser Trigger löste aus: Mail an ZIM-QS · Statuswechsel auf 35
> Davor: 34 bearbeitungsreif (02.06.), 31 beantragt (18.05.)
> Datenstand: Import 31.07.2026 · Kataloge v3
> [Herleitung kopieren]

Verlauf = relevante `D_`-Spalten chronologisch (als Näherung gekennzeichnet, s. 2). „Herleitung kopieren" für Support-Fälle.

### 6.2 Nächster-Schritt-Navigator + Kürzel-Glossar

Aus aktuellem Status + Trigger-Vorbedingungen (`<x`/`>x`, ABB-/YIRR-Bedingungen gegen die `D_`-Spalten geprüft) berechnet die App die **kandidierenden nächsten Kürzel** — gefiltert auf Relevanz-Häkchen, mit Rolle („wird gesetzt von") und Wirkung (Statuswechsel, Mail an wen):

> Nächster erwarteter Schritt: **ABLW** setzen (im Foyer) — Rolle AB · prüft NF-Rücklauf · setzt Status 37 · Mail an TIB

Default-Filter „Meine Rolle" (aus dem Profil, Abschnitt 5a), umschaltbar auf alle Rollen. Die App setzt nichts selbst; sie sagt präzise, was im Legacy zu tun ist. Dazu das **Kürzel-Glossar** als durchsuchbare Seite (Kürzel, Beschreibung, Rolle, Trigger-Wirkung in Satzform, Relevanz-Häkchen, Rollen-Filter) — beantwortet das „viele kennen die Kürzel nicht"-Problem am Ort des Bedarfs.

### 6.3 Stillstands-Wächter

Zwei Stufen, beide ohne Ketten-Pflege:

- **Stufe 1 (generisch):** letzte Aktivität = jüngstes Datum über alle relevanten `D_`-Spalten des Antrags. `heute − letzteAktivität > Zieltage(Status)` → „hängt fest". Robust, sofort umsetzbar.
- **Stufe 2 (gezielt):** wo der Navigator einen erwarteten nächsten Schritt kennt oder ein Kürzel-Paar halb offen ist, wird die hängende **Rolle** benannt: „D_ARF gesetzt (Entwurf RNE fertig, AB, vor 12 Tagen) — D_ARQ (QS) fehlt → hängt bei QS." · „AT4 gesetzt (fachlich fertig), AK4 fehlt → hängt bei AB."

Ausgabe: Home-Widget „Hängt fest" pro Bearbeiter (`useMeinKuerzel` + Meine Rolle), PL-Gesamtliste mit Grund, Tagen und hängender Rolle. Immer mit Begründung und immer ehrlich („kein Zieltage-Wert für Status 88 definiert").

### 6.4 Fristen-Cockpit

Ersetzt die individuellen XLSX-Listen. Alles aus vorhandenen Daten:

- **Bearbeiter:** meine Anträge nach Restfrist (90-Tage-Countdown ab **wirksamem Eingang** = spätestes von `D_AAE` und `D_XTE` „alle Anträge da" — so rechnet es das AB-Dashboard heute; Begleitphase nach VN-Logik), Ampel, Hängt-fest-Marker.
- **PL:** Verteilung über ZAH-Phasen, **Verweildauer je Status** (Engpass-Analyse), Fristrisiko-Liste, Wochentrend, Bearbeiter-Last — und **Stau je Rolle** („12 Anträge warten auf AB, 5 auf QS"), sobald Stufe-2-Wächter-Daten vorliegen.
- **XLSX-Export** der Sichten — generiert, für alle, die ihre Liste behalten wollen.

### 6.5 Persönliches To-do-Board — ersetzt das AB-XLSX-Dashboard

Das selbstgebaute AB-Dashboard („AB Anträge") ist der Beleg, dass 6.2–6.4 gebraucht werden — es ist Navigator + Cockpit, per Hand in Excel: Slicer für Jahr/Status/Erstentscheidung/ZuwB/Schlussvermerk, AB-Personenfilter über `BIB_K`, eine handverlesene Auswahl relevanter `D_`-Spalten und eine per WENN-Formeln berechnete **To-do-Spalte** mit ~24 Werten („RNE ergänzen", „in QS", „NL prüfen", „Widerspruch gg Abl bearbeiten" …). Die App baut dasselbe als Board — geteilt statt privat:

- **To-do pro Antrag** aus den To-do-Regeln (Abschnitt 4, Nr. 4), gruppierbar nach To-do-Wert.
- **Rollen-Sicht statt zwei Dashboards:** jede Regel trägt die zuständige Rolle. Für den AB ist „RNE ergänzen" eine Aufgabe; für den FB erscheint derselbe Antrag als „wartet auf AB". Die Warte-To-dos des Dashboards („in QS", „Abl abwarten") sind kein Sonderfall, sondern die Fremdrollen-Ansicht derselben Regeln. Die FB-Frage ist damit beantwortet: gleiches Board, FB-Regelsatz — kein zweites System.
- **Filter** wie im XLSX: Jahr, Fördervariante, Status, ZAH-Phase, „meine" (Rolle + Kürzel), plus Hängt-fest-Marker aus 6.3.
- **Seed statt Neuerfindung:** die WENN-Formeln der Mappe werden transkribiert und bilden den ersten To-do-Regelsatz (AB); die im Dashboard gewählten `D_`-Spalten sind der Relevanz-Seed für die Rolle AB. Der FB-Regelsatz entsteht danach mit den FB-Kollegen nach demselben Muster.
- **Ehrlichkeit wie überall:** Anträge, auf die keine Regel passt, erscheinen als „kein To-do ermittelt" — nicht gar nicht.

## 7. Umbau des bestehenden Status-Katalog-Moduls

Das Modul bleibt und wird vom Kuratier-Werkzeug zum **Spiegel + Pflege der drei kleinen Listen**:

| Heute | Wird zu |
|---|---|
| Katalog-Tab (74 Einträge, Kategorie/Spine-Phase/Rang/Prominenz/terminal je Eintrag) | Importierter Status-Katalog: Code, Text, ZAH-Phase (editierbar), Zieltage (editierbar), Marker-Flag. Vorkommen/zuletzt-gesehen bleiben als Drift-Anzeige. Rang/Prominenz/terminal entfallen |
| Felder-Tab (512 Felder, Ordner-Ränge) | Kürzel-Verzeichnis: `D_`/`T_`-Spalten ↔ Kürzel-Katalog verknüpft, Rollen-Filter (AB/FB/QS/PA/Jur existieren schon als Chips), **Relevanz-Häkchen**. Ordner bleiben als Gliederung, **Ordner-Ränge entfallen ersatzlos** |
| Regeln-Tab (5 handgeschriebene Regeln, Prioritäten) | Zwei Bereiche: **Trigger-Viewer** (read-only, importierte Trigger in Satzform, filterbar nach Kürzel/Status/Rolle) + **To-do-Regeln** (editierbare Entscheidungstabelle, Abschnitt 4 Nr. 4). Die 5 Alt-Regeln haben exakt diese Form (WENN Status … DANN Schritt) und gehen im To-do-Regelsatz auf — Prioritäten entfallen |
| Unkuratiert-Queue | Ein Warnbanner: „N Werte im Export, die nicht im Katalog sind" |
| Konflikte-Chip (46) | Entfällt mit der Ableitung; verbleibende echte Konflikte = Katalog-Drift-Warnungen |

Aus `status-canonical.ts` bleibt die Kategorie-Helper-API (`isOpenStatus` etc.) als **Fassade** erhalten — intern gespeist aus Code + ZAH-Phasen-Tabelle statt aus der eingebauten Doppel-Domain-Map. Bauantrag-Domain (dev/demo-only) bleibt unberührt auf der alten Map.

## 8. Was die Umsetzung an den Daten gelernt hat

Zahlen aus dem Bestand (7 534 Verbünde / 14 221 Anträge, Import 27.07.2026). Sie
gehören ins Konzept, weil sie Entscheidungen tragen:

- **Alle 25 im Bestand vorkommenden Statuswerte lösen auf einen Code auf.** Der
  Join trägt; drei Export-Schreibweisen weichen von der Parametertabelle ab
  („Ablehnung", „Rücknahmeempfehlung", „VN techn. geprüft") und sind als
  Varianten gepflegt.
- **Vier Kürzel wurden doppelt geführt** — `AAE`, `ABB`, `AZ1`, `VBE` hängen an
  kanonischen Feldern und dürfen kein zweites `D_`-Feld haben. Solange sie es
  hatten, galt `ABB` überall als „nie gesetzt", und fast jede Trigger-Bedingung
  lautet „TV hat kein ABB".
- **Der Altbestand ist kein Rückstand.** Von 9 141 bewilligten Anträgen tragen
  nur 2 529 ein Datum in `D_AZBE`; über alle Jahrgänge meldete allein „ZuwB
  erstellen" 6 607 Aufgaben. Das Board zeigt deshalb die letzten drei Jahrgänge
  und sagt, was das ausblendet.
- **Eine Antragsfrist läuft nur in der Antragsphase.** Ohne dieses Kriterium
  führte die Fristenliste 2 850 abgeschlossene Vorgänge mit „853 T über" an.
- **Zieltage sind die Grundlage des Wächters, und sie fehlen.** Mit 7 von 74
  gepflegten Statuswerten sind 1 921 Vorgänge „nicht bewertbar" — sichtbar
  ausgewiesen, nicht als unauffällig gezählt.
- **Der Phasen-Vergleich zeigt 490 Abweichungen in 12 Mustern**, alle auf zwei
  Ursachen zurückführbar: die alte Ableitung lief dem amtlichen Status voraus.
  Details und Abnahme-Kriterium: [vorgangssystem-p6-inventar.md](vorgangssystem-p6-inventar.md).

## 9. Entschieden / offen

**Entschieden:**

- Der Export trägt keine Setzer-Info → der Wächter arbeitet mit der **Soll-Rolle** aus dem Kürzel-Katalog („wessen Schreibtisch"), nicht mit Personen.
- Rollen-Dimension (Abschnitt 5a) wird von Anfang an mitgebaut; AB ist die nächste Onboarding-Gruppe.
- Rollen ↔ Export-Spalten: **AB = BIB/BFM/PFM, FB = TIB/ZTP** (Legacy-Parametertabelle; das AB-Dashboard filtert über `BIB_K`).
- `VB_PHASE` = **Fördervariante** (1 NW 1 · 2 NW 2 · 3 FuE · 4 DL · 5 DS · 9 Irrläufer) — Decode-Referenz statt Status-Kuration; identisch mit dem Antragstyp des Auslastungs-Moduls.
- **To-do-Regeln** als vierte Pflegeliste; Seed durch Transkription des AB-XLSX, FB-Regelsatz danach nach gleichem Muster (6.5).
- ZAH-Phasen-Zuordnung ist PL-editierbar mit Versionierung — spätere Änderungswünsche der Kollegen sind Zeilen-Änderungen, kein Deployment.

**Offen:**

1. **Mehrfach-Kürzel:** Prüfen am echten Export, ob `D_`-Spalten bei Wiederholung das erste oder letzte Datum tragen.
2. **Mail-Platzhalter** (#BA1/#FB1/#TB1 …): vermutlich BIB-/TIB-Familien — am Legacy verifizieren, dann im Navigator auflösen.
3. **Phasen-Schnitt** aus Abschnitt 5 fachlich abnehmen (insb. 32 ablehnungsreif unter „Entscheidung", der 70er-Block, 59 bewilligt als Beginn von „Begleitung", 29 Irrläufer als Marker).
4. **Zieltage-Startwerte:** aus der PL-Erfahrung oder initial aus der Ist-Verteilung (Median-Verweildauer je Status) vorschlagen lassen?
5. **Kürzel-Paare:** Erkennung der adm./fachl.-Paare (AK4/AT4 …) — als Konvention aus dem Katalog ableitbar oder als kleine Paar-Liste pflegen? Beim AB-Onboarding klären, ob Relevanz-Defaults je Rolle getrennt sein sollen.
6. ~~AB-Dashboard-Mappe beschaffen~~ **Erledigt:** To-do-Logik transkribiert → `todo-regeln-ab-seed.md` (25 Regeln + 2 Sperren, inkl. bereinigter Mappen-Fehler). Der übermittelte Spaltenkopf deckt alle Regel-Eingaben ab. Verbleibend: Verifikationsfragen V1–V4 aus der Seed-Datei mit AB-Kollegen klären; Spaltenauswahl der Mappe als Relevanz-Seed AB übernehmen.
