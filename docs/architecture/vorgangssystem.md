# Vorgangssystem — Status, To-do, Wächter, Cockpit (ZAH-App)

Stand: 03.08.2026 · **P0–P6 umgesetzt + Fachabstimmung eingearbeitet**
(v2.374 – v2.389) · Flag `vorgangssystem` (dev + pl) · Modul `src/core/status/`
· Entscheidungen: [fachabstimmung-2026-08.md](fachabstimmung-2026-08.md)

## 0. Umsetzungsstand

| Phase | Was | Version |
|---|---|---|
| P0 | Status-Codes, ZAH-Phasen, Trigger-Parser, zwei XLSX-Importe, Diagnose-Report | v2.374.0 |
| P1 | Status-Erklärung (Herleitungs-Popover) | v2.375.0 |
| P2 | Kürzel-Glossar, Relevanz-Häkchen, Nächster-Schritt-Navigator | v2.376.0 |
| P3 | To-do-Kaskade (AB-Regelsatz) + Vorgangs-Board | v2.377.0 |
| P4 | Stillstands-Wächter, Zieltage, Home-Widget „Hängt fest" | v2.378.0 |
| P5 | Fristen-Cockpit (Bearbeiter + PL), wirksamer Eingang, XLSX-Export | v2.379.0 |
| — | Trigger je Richtlinie (Nacharbeit am ersten echten Import) | v2.380.0 → [Abschnitt 3a](#3a-trigger-gelten-je-richtlinie) |
| P6 | **Rückbau der alten Ableitung** — Vorab-Fixes, Fassade aus Code+ZAH, Anzeige umgehängt, Ableitung entfernt | v2.382 – v2.385 → [Abschnitt 7](#7-umbau-des-bestehenden-status-katalog-moduls) |
| — | Technische Sammel-Nacharbeit (Zulässigkeits-Trigger, Doppelfeld-Guard, Regel-Editor-Validierung, FM_NUMMER-Invariante) | v2.386.0 |
| — | **Regelwerk aus der Fachabstimmung** — S0/S0b statt S3, `D_XKS`-Gate, PreCheck-Rollen | v2.387.0 → [fachabstimmung-2026-08.md](fachabstimmung-2026-08.md) |
| — | Zieltage-Sammelübernahme (A2) | v2.388.0 |
| — | **Betrachtungsbereich** — Arbeitsvorrat folgt dem Bereich, Evidenz nicht | v2.389.0 → [Abschnitt 10](#10-betrachtungsbereich-arbeitsvorrat-folgt-dem-bereich-evidenz-nicht) |

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

- Ein Datum pro Kürzel-Spalte → bei mehrfach gesetzten Kürzeln ist nur das letzte Datum sichtbar (V9 bestätigt). Der aus den Spalten rekonstruierte Verlauf ist eine Näherung, keine vollständige Historie. Wiederholungen mit eigener Spalte (z. B. `D_AAE2`) werden normal mitgenommen. **Seit v2.392 gilt das nur noch rückwärts:** ab dem Nullpunkt des Import-Diff-Journals (Abschnitt 12) ist der Verlauf belegt — auch für Setzungen, die der nächste Export überschrieben hat.
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
Parameter"; passt der Name nicht, wird die ganze Mappe durchsucht, und erst dann
gibt der Import auf (mit Blatt- und Spaltenliste in der Meldung).

**Gemessen am Bestand (14 221 Anträge, August 2026):** jeder Antrag trägt eine
`FM_NUMMER` — der Fall „Programm unbekannt" kommt im echten Bestand nicht vor.
Die Nummern verteilen sich auf **16** Programme, die Trigger-Zuarbeit deckt neun
davon ab. Auf die abgedeckten entfallen 7269 Anträge, auf die übrigen sieben
(47, 36, 46, 34, 48, 35, 37) **6952**. Für diese knappe Hälfte des Bestands sagt
die App künftig „für Programm N keine Trigger importiert" — vorher bekam sie
stillschweigend die Trigger der Richtlinie 76. Der Import-Diff listet die
Programme mit Antragszahl auf, damit die Lücke eine Entscheidung wird und kein
Zufall bleibt.

### 3b. „Erklärung Parameter" ist eine Legende, keine Tabelle

Das Blatt führt **keine Kopfzeile**: Spalte A der Wert, B die Erklärung, C die
Kategorie („Status" / „Bearbeiter" / leer); Zeile 1 („Inhalt Parameter" ·
„Erklärung") ist Beschriftung. Bis v2.380 verlangte der Import einen `Code`/`Text`-
Kopf und **brach an der echten Datei ab** — der Statuscode-Katalog kam nie aus der
amtlichen Quelle. Seit v2.381 liest `parameter-blatt.ts` beide Formate (Legende
und Kopfzeilen-Tabelle) und liefert dem Katalog-Import eine einheitliche,
klassifizierte Zeile; der Spaltenschnitt wird über die Kategorie-Spalte **gesucht**,
nicht auf A/B/C gesetzt.

- **Die Kategorie-Spalte entscheidet, nicht der Inhalt.** Nur Zeilen der Kategorie
  „Status" werden zu Codes. Bliebe „ganze Zahl = Statuscode" wie in der
  Kopfzeilen-Variante, stünden die Bezugsdatei-Nummern **210/211** als Codes im
  Katalog — dieselbe stille Klasse wie ein Schlüssel ohne alle Dimensionen
  (Bug-Klasse 14), eine Ebene tiefer.
- **Vier Zeilenarten, alle sichtbar.** Was nicht Statuscode wird, zählt die
  `ZeilenBilanz` und die Vorschau sagt es („4 Statuscodes übernommen ·
  übersprungen: 2 Textbausteine, 3 Bearbeiter, 2 Zuordnungen"). Übersprungen ist
  kein Fehler — aber auch kein Schweigen.
- **Bearbeiter- und Zuordnungs-Zeilen werden GEPRÜFT, nicht gespeichert.** Beide
  Zuordnungen stehen genau einmal im Code (`MAIL_ROLLE` in `rollen.ts`,
  `ebeneVonNummer` in `trigger-parser.ts`); ein zweites, importiertes Modell wäre
  die Doppel-Wahrheit, gegen die Pitfall #43 geschrieben ist. Ein unbekanntes
  Bearbeiter-Token ist eine Warnung; die 210/211-Zeilen stehen als Hinweis neben
  unserer bisher nur **erschlossenen** Lesart (VB/TV) und belegen oder widerlegen
  sie beim ersten echten Import.
- Die **Textbaustein-Legende** landet als `MappingVersion.textbausteine` in der
  Fassung und wird zur **Anzeigezeit** aufgelöst, damit eine später importierte
  Legende nicht die ganze Trigger-Tabelle neu parsen lassen muss.

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

## 7. Der Rückbau der alten Ableitung (P6, umgesetzt)

Bis v2.381 rechnete die App **neben** dem amtlichen Status eine eigene
Verfahrensposition aus: höchster Rang über das ganze `D_`-Feld-Ensemble gewinnt,
ein `terminal`-Flag schlägt den Rang. Gemessen am Bestand (7 534 Verbünde,
02.08.2026) sagten beide Lesarten bei **485** Vorgängen etwas anderes — und die
alte lief dem Fachsystem stets voraus. Genau das beendet das Companion-Prinzip.

**Was jetzt gilt:** eine Achse (ZAH-Phase am amtlichen Code), eine
Kategorie-Ableitung, keine Ränge.

| Vorher | Jetzt |
|---|---|
| `status-canonical.ts` mit handgeschriebener Rohtext→Kategorie-Tabelle | Fassade, intern gespeist aus **Rohtext → Code → ZAH-Phase → Kategorie** ([kategorie-ableitung.ts](../../src/core/status/kategorie-ableitung.ts)). Flag-unabhängig in der eingebauten Map; die zweite Handliste daneben ist mit v2.395 entfallen |
| Katalog-Tab mit Kategorie/Spine-Phase/Rang/Prominenz/terminal | Code, Text, Kategorie, Prominenz, **ZAH-Phase**, **Zieltage**, aktiv. Vorkommen + „zuletzt gesehen" bleiben als Drift-Anzeige |
| Kürzel-Tab mit Spine-Phase/Rang/terminal, Filter „nur mit Rang" | **ZAH-Phase je Datumsfeld** (24 gesetzt, Rest bewusst leer). Ordner bleiben als Gliederung, Ordner-Ränge ersatzlos entfallen |
| Regeln-Tab: 5 handgeschriebene Regeln mit Prioritäten **neben** der Kaskade | Nur die To-do-Kaskade. Die 5 Alt-Regeln gehen darin auf — Zuordnung im Kopf von [RegelnTab.tsx](../../src/plugins/status-cockpit/RegelnTab.tsx) |
| Simulations-Leiste (Phasenverteilung Aktiv→Entwurf, Konflikte, Wechsel-Diff) | Entfällt: sie schätzte die Wirkung von **Rang**-Änderungen ab |
| „Warum dieser Status?" + Konflikt-Badge | Herleitungs-Popover aus dem amtlichen Status; auseinanderlaufende Ebenen sind eine **Auskunft** („Verbund-Status: 31 · TV-Status: 72"), keine Warnung |
| 5-Stationen-Stepper aus Rängen | 6 ZAH-Phasen; Marker (29/88/93/94) stehen als Kennzeichen **neben** der Leiste |
| Filter-Sidebar mit eigener, dritter Phasen-Liste | ZAH-Phasen auf Code-Ebene, Schreibweisen kollabieren mit Summen-Zählung, Marker als eigene Gruppe |

### 7.1 Was der Rückbau an den Daten gefunden hat

- **Die Handtabelle kannte nur 21 der 30 amtlichen Codes** unter ihrem amtlichen
  Namen. Bei 70/71/95 ging es nur gut, weil der Export zufällig die abgekürzte
  Schreibweise liefert. Bei **Code 72** ging es schon vorher schief: 15
  Teilvorhaben und 1 Verbund lagen unter `sonstige` und in keiner Arbeitsliste.
- **Sechs Kategorie-Deltas**, drei davon im Ist wirksam: `unvollständig` (33)
  `sonstige`→`offen` (6 TV), `NL eingegangen` (36) `offen`→`nachforderung`
  (52 TV), Code 72 `sonstige`→`entscheidung` (16). Die Liste ist im Test
  abschließend ([kategorie-deltas.ts](../../src/core/status/__tests__/fixtures/kategorie-deltas.ts)).
- **Die Varianten-Auflösung fehlte an drei Stellen** (Snapshot, Phasen-Vergleich,
  Ableitung). Sie hat jetzt genau eine ([wert-index.ts](../../src/core/status/wert-index.ts)).
- **Ein persistierter Snapshot kann eine neue Ableitung überschreiben**: Fassung
  v7 trug die Kategorien ihres Seed-Standes weiter, während die eingebaute Map
  schon die neuen sagte — sichtbar als Widerspruch auf einer Seite (NF-Reiter 53,
  Filterzeile daneben 105). Der Snapshot leitet die Kategorie deshalb aus
  (kuratierter Phase + Code) ab. Nebeneffekt: eine PL-Umhängung wirkt jetzt ohne
  Deployment — die Zusage aus Abschnitt 5 trägt erst dadurch.

### 7.2 Was bleibt und warum

- **`Prominenz` bleibt.** Sie steuert die Punktgröße in Chronik und Zeitstrahl
  und den `ignoriert`-Filter — Anzeige, keine Ableitung. Sie mitzureißen hätte
  die Chronik plattgemacht, ohne etwas ableitungsfreier zu machen.
- **Die ZAH-Phase am Datumsfeld bleibt** — sie beantwortet „welches Datum gehört
  zum aktuellen Status?" (die „seit"-Angabe, die Chronik-Marke). Sie ordnet ein,
  sie leitet nichts ab.
- **Zwei dauerhafte Guards** statt des Phasen-Vergleichs:
  `kategorie-ableitung.test.ts` („ist die Ableitung richtig?", 30-Code-Wahrheits-
  tabelle von Hand) und `byte-identitaet.test.ts` („liefert sie über Snapshot und
  eingebaute Map dasselbe?", inklusive jeder Variante).

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
- **Der Phasen-Vergleich zeigte 485 Abweichungen in 12 Mustern** (Stand
  02.08.2026; 490 am 27.07.), alle auf zwei Ursachen zurückführbar: die alte
  Ableitung lief dem amtlichen Status voraus. Sie ist mit v2.385 entfallen —
  Details in [Abschnitt 7](#7-der-rückbau-der-alten-ableitung-p6-umgesetzt).

## 9. Entschieden / offen

**Entschieden:**

- Der Export trägt keine Setzer-Info → der Wächter arbeitet mit der **Soll-Rolle** aus dem Kürzel-Katalog („wessen Schreibtisch"), nicht mit Personen.
- Rollen-Dimension (Abschnitt 5a) wird von Anfang an mitgebaut; AB ist die nächste Onboarding-Gruppe.
- Rollen ↔ Export-Spalten: **AB = BIB/BFM/PFM, FB = TIB/ZTP** (Legacy-Parametertabelle; das AB-Dashboard filtert über `BIB_K`).
- `VB_PHASE` = **Fördervariante** (1 NW 1 · 2 NW 2 · 3 FuE · 4 DL · 5 DS · 9 Irrläufer) — Decode-Referenz statt Status-Kuration; identisch mit dem Antragstyp des Auslastungs-Moduls.
- **To-do-Regeln** als vierte Pflegeliste; Seed durch Transkription des AB-XLSX, FB-Regelsatz danach nach gleichem Muster (6.5).
- ZAH-Phasen-Zuordnung ist PL-editierbar mit Versionierung — spätere Änderungswünsche der Kollegen sind Zeilen-Änderungen, kein Deployment.

**Offen:**

1. ~~**Mehrfach-Kürzel:** Prüfen am echten Export, ob `D_`-Spalten bei Wiederholung das erste oder letzte Datum tragen.~~ **Erledigt (V9):** das **zuletzt** gesetzte Datum; frühere Setzungen sind überschrieben. Damit die Information nicht länger verloren geht, führt die App seit v2.392 ein Import-Diff-Journal (Abschnitt 12).
2. **Mail-Platzhalter** (#BA1/#FB1/#TB1 …): vermutlich BIB-/TIB-Familien — am Legacy verifizieren, dann im Navigator auflösen.
3. **Phasen-Schnitt** aus Abschnitt 5 fachlich abnehmen (insb. 32 ablehnungsreif unter „Entscheidung", der 70er-Block, 59 bewilligt als Beginn von „Begleitung", 29 Irrläufer als Marker).
4. **Zieltage-Startwerte:** aus der PL-Erfahrung oder initial aus der Ist-Verteilung (Median-Verweildauer je Status) vorschlagen lassen?
5. **Kürzel-Paare:** Erkennung der adm./fachl.-Paare (AK4/AT4 …) — als Konvention aus dem Katalog ableitbar oder als kleine Paar-Liste pflegen? Beim AB-Onboarding klären, ob Relevanz-Defaults je Rolle getrennt sein sollen.
6. ~~AB-Dashboard-Mappe beschaffen~~ **Erledigt:** To-do-Logik transkribiert → `todo-regeln-ab-seed.md` (25 Regeln + 2 Sperren, inkl. bereinigter Mappen-Fehler). Der übermittelte Spaltenkopf deckt alle Regel-Eingaben ab. Verbleibend: Verifikationsfragen V1–V4 aus der Seed-Datei mit AB-Kollegen klären; Spaltenauswahl der Mappe als Relevanz-Seed AB übernehmen.
7. **Trigger-Nachexport für 46/47/48** (Abstimmungspunkt A4, seit v2.397 wieder offen): die Generation 2015 gehört jetzt zum Arbeitsvorrat, die Trigger-Zuarbeit führt für sie nichts. Bis zu 5 086 Vorgänge sagen deshalb „für Programm N keine Trigger importiert" — korrekt, aber häufig. Fachfrage bleibt, ob das Fachsystem für diese Programme noch Trigger-Definitionen führt (V8).

## 10. Betrachtungsbereich: Arbeitsvorrat folgt dem Bereich, Evidenz nicht

Maßstab ist die **Richtlinien-Generation**: die aktuelle ZIM-Richtlinie und die
beiden davor. Gemessen am Bestand (14 221 Anträge) sind das die Generationen
**2015, 2020 und 2025** mit 12 Programmen und **12 355 Anträgen**; außerhalb
bleibt die Generation 2012 (Programme 34–37) mit **1 866 Anträgen**. Sie stand
bisher in jeder Grundmenge — in den Tab-Zählern, in der Kapazitätsrechnung, in
jeder Board-Berechnung. Sichtbar war das nirgends.

Der erste Anlauf (v2.389) schnitt den Bereich nach der **Trigger-Abdeckung** —
neun Programme, für die die Zuarbeit etwas führt — und nannte ihn trotzdem
„letzte 3 Richtlinien". Das waren zwei Generationen: 2015 fehlte (5 086 Anträge,
47 allein 4 190). Der Arbeitsvorrat nach Datenverfügbarkeit zu schneiden war der
Fehler; die Trigger-Lücke ist eine Aussage **am Vorgang** („für Programm N keine
Trigger importiert", Pitfall #44), keine Grenze des Arbeitsvorrats. Seit v2.397
ist die Generation die Datenstruktur ([betrachtungsbereich.ts](../../src/core/status/betrachtungsbereich.ts)):
`RICHTLINIEN_GENERATIONEN` aufsteigend, der Seed ist `slice(-3)` davon, und die
Chip-Beschriftung wird daraus **abgeleitet** statt danebengeschrieben. Ein
Richtlinien-Wechsel ist damit ein angehängter Listeneintrag — die älteste
Generation rollt von selbst heraus.

**Das Prinzip (Pitfall #46):** der Bereich ist ein **expliziter Parameter jedes
Konsumenten**, nie ein stiller Filter im Daten-Layer. Zöge ihn der Daten-Layer,
gäbe es keine Stelle mehr, an der man ihn abschalten könnte: die Suche fände nur
noch, was ohnehin sichtbar ist, und ein Deep-Link auf ein Altprogramm liefe ins
Leere. Ein Konventionstest hält das fest.

| | folgt dem Bereich | Begründung |
|---|---|---|
| Antragsliste, Tab-Zähler, Quickfilter | ja | Arbeitsvorrat |
| Vorgangs-Board, Fristen, Meilensteine | ja | Arbeitsvorrat |
| Home-Dashboard, Kanban, Eingangs-Ampel | ja | Arbeitsvorrat |
| Auslastung: offene Arbeit, Kapazität | ja | Arbeitsvorrat |
| **Auslastung: Kompetenz-Historie, AnonymMap** | **nein** | append-only, führt ehemalige Bearbeiter als Referenz (Pitfall #17/#18) — ein Bearbeiter, der nur in Altprogrammen gearbeitet hat, verlöre sonst sein Profil |
| **Globale Suche** | **nein** | Evidenz. Treffer außerhalb tragen „· außerhalb des Anzeigebereichs" und lassen sich öffnen |
| **Deep-Link / offener Datensatz** | **nein** | `/antraege/<akz>` erreicht jeden Antrag; der gerade geöffnete bleibt in der Liste sichtbar, sonst risse der Link ab |

### 10.1 Zwei Quellen, eine Reihenfolge

Wie bei der Kategorie-Fassade (Pitfall #45): der Seed steht **flag-unabhängig im
Code** ([betrachtungsbereich.ts](../../src/core/status/betrachtungsbereich.ts)),
eine geladene Katalog-Fassung überschreibt ihn. Damit gilt der Bereich auch in
prod/as, wo `initStatusKatalog` hinter `statusCockpit` nie läuft — dort eben mit
dem ausgelieferten Stand.

Der Preis ist benannt und **sichtbar gemacht**: weicht die gepflegte Liste vom
Seed ab, sagt das Auswahl-Panel „wirkt in den schlanken Varianten erst mit dem
nächsten Release". Zwei stille Wahrheiten wären das eigentliche Problem.

Die gepflegte Fassung bleibt eine **flache Code-Liste** (`{ programme: string[] }`),
keine Generationen-Struktur. Welche Programme die Richtlinie 2015 bilden, ist eine
Tatsache der Förderlandschaft und damit Code-Wissen; kuriert wird nur, *welche*
Programme zählen. Nebenbei ist die flache Form die ausdrucksstärkere: nur sie kann
eine **unvollständige** Generation überhaupt beschreiben — und genau darauf beruht,
dass der Chip in dem Fall keine Generationszahl behauptet.

Die **Auswahl** (Standard / Alle / eigene Liste) ist dagegen persönlich und
gerätelokal — sie geht niemanden sonst etwas an. Definition = Team-Kuration,
Auswahl = Person; getrennte Lebensdauern, getrennte Speicher. Ein Wechsel des
Standard-Bereichs bumpt den localStorage-Key deshalb **nicht**: `standard`
speichert bewusst keine Liste und greift den neuen Bereich von selbst ab, und wer
eine eigene Auswahl gesetzt hat, behält sie. Damit sie nicht still veraltet, sagt
das Panel, wovon sie abweicht („Ihre Auswahl weicht vom Standard-Bereich ab
(12 Programme, Richtlinien 2015 + 2020 + 2025)") — ein Klick auf
„Standard-Bereich" ist der Rückweg.

### 10.2 Was die Umstellung gemessen hat

Beide Zustände **unmittelbar hintereinander** an derselben Sitzung gemessen (der
alte Bereich über eine eigene Auswahl der neun Programme reproduziert, Zahlen
byte-identisch zur Messung vor der Änderung) — so trifft jede Drift auf der
Maschine beide Seiten gleich.

| | 9 Programme (2020 + 2025) | 12 Programme (ab 2015) |
|---|---|---|
| Chip | `letzte 3 Richtlinien (9 Programme) · 6.952 ausgeblendet` | `letzte 3 Richtlinien (12 Programme) · 1.866 ausgeblendet` |
| Antragsliste „Alle" | 5 542 | **7 468** |
| Offen · Diese Woche · Überfällig · NF · Bewilligt 2026 | 892 · 35 · 478 · 105 · 541 | **identisch** |
| Board: gerechnet · übersprungen | 7 269 · 6 952 | **12 355 · 1 866** |
| Board-Tabs (Vorbelegung letzte 3 Jahrgänge) | 477 · 347 · 3 057 · 664 · 3 881 | **identisch** |
| Meilensteine: ausgeblendete Verbünde | 57 | **38** |
| Auslastung: Arbeitsvorrat · Kompetenz-Basis | — | **12 355 · 14 221** |

Drei Aussagen daraus:

- **Die offene Arbeit bewegt sich nicht.** Offen, Überfällig, NF und Bewilligt
  bleiben auf die Zahl gleich; nur „Alle" wächst. Der Satz „der Altbestand ist
  abgeschlossen, nicht liegengeblieben" gilt also auch für die Generation 2015 —
  das war die Messung, die die Änderung hätte widerlegen können. Dasselbe am
  Board: bei der Vorbelegung „letzte 3 Jahrgänge" ändert sich **kein** Tab-Wert,
  weil die 2015er-Anträge alte Antragsjahre tragen.
- **Die Rechenzeit ist teurer, aber nicht messbar teurer.** Gerechnet werden
  12 355 statt 7 269 Vorgänge (+70 %). Gemessen wurden 7,4 s und 14,6 s gegen
  vorher 8,4 s und 16,9 s — die Spannen **überlappen vollständig**, weil zwei
  Dev-Server und ein ladendes Embedding-Modell auf derselben Maschine liefen.
  Der Mehraufwand ist real und aus der Vorgangszahl belegt; eine belastbare
  Zeit-Differenz braucht eine ruhige Maschine. Der Gewinn aus v2.389 (~6,5 s über
  14 221 → ~4,7 s über 7 269) wird damit größtenteils zurückgegeben.
- **Die Kompetenz-Basis der Auslastung bleibt bei 14 221** — der Vollbestand,
  unabhängig vom Bereich (Pitfall #17/#18). Der Readout im Zuweisungs-Cockpit
  nennt beide Datenbasen nebeneinander, damit das nachprüfbar bleibt statt
  behauptet.

## 11. Regelsätze je Rolle (v2.391)

Bis v2.390 kannte die To-do-Kaskade genau **eine** Spur, und die war durchgängig
AB: von 25 Regeln des Seeds tragen 13 `zustaendig: ['ab']`, alle anderen Rollen
kommen ausschließlich als `wartetAuf` vor. Der FB sah seine Arbeit damit nur als
Spiegelbild der AB-Sicht.

Jetzt trägt jede Regel einen **Regelsatz** (`TodoRegel.regelsatz`, fehlend ⇒
`'ab'`), und die Engine wertet je Rolle den ihren aus. Solange nur der AB-Satz
gefüllt ist, ist das Ergebnis bitgenau das von vorher — das ist die wichtigste
Zusicherung des Umbaus und steht als Regressionsgatter im Test.

### 11.1 Warum die Auswahl in der Engine liegt

`ermittleTodo` filtert selbst, statt eine vorgefilterte Liste zu bekommen. Grund:
der **Sperr-Pass läuft über alle aktiven Regeln**. Eine nach `regelsatz`
vorgefilterte Menge nähme ihm S0/S0b/S1/S2 — und ein im Foyer abgeschlossener
Vorgang stünde dem FB als offene Aufgabe im Board. Eine Sperre gehört keinem
Regelsatz; sie gilt vorgangsweit, solange sie über `giltFuer` nichts anderes sagt.

> **Zwei gegenläufige Leer-Konventionen im selben Typ.** Leeres `zustaendig`
> heißt „keine Rolle benannt", leeres `giltFuer` heißt „alle Rollen" (wie
> `StatusFeldEintrag.rollen`, Pitfall #43). Gelesen wird deshalb nur über
> `regelsatzVon` und `sperreGiltFuer` ([regelsatz.ts](../../src/core/status/regelsatz.ts)).

### 11.2 Abgeleitete Platzhalter — der Weg ohne Umschaltpunkt

Liefert der Regelsatz einer Rolle keinen Treffer, hat aber die für eine andere
Rolle greifende Regel ein `wartetAuf` auf sie, entsteht ein **geliehenes**
Ergebnis: derselbe To-do-Text, `quelle: 'abgeleitet'`, Herkunft in
`abgeleitetAus`. Im Board trägt es den Marker „geliehen".

Drei Regeln halten es ehrlich: ein echter Treffer schlägt den Platzhalter immer;
er läuft durch den Sperr-Filter der eigenen Rolle (sonst würde ein für sie
geschlossener Fall wiederbelebt); und er trägt `regelId: null`, weil die Rolle
eben keine eigene Regel hat.

Damit ersetzt **jede geschriebene FB-Regel genau einen Platzhalter** — schrittweise,
ohne Stichtag, an dem etwas „umgestellt" wird.

### 11.3 Rollout-Sperre

`_intern/status-katalog.json` ist für alle Build-Varianten gleichzeitig live. Eine
aktive FB-Regel würde von jeder Installation unter v2.391 in der AB-Kaskade
mitgewertet, weil deren Engine das Feld `regelsatz` nicht kennt. Deshalb: Regeln
in einem Satz ≠ AB entstehen **immer** `aktiv: false`, das Aktivieren verlangt
eine Bestätigung, und am Tab steht der Grund dauerhaft.

### 11.4 Was die Erhebung am Bestand gezeigt hat

Für die FB-Seite gibt es keine Mappe zum Transkribieren. Der Regeln-Tab erhebt
deshalb aus dem Bestand, was der Termin braucht — abgeleitete Platzhalter, blinde
Flecken, Kürzel-Landkarte — als XLSX plus Kurzfassung
([fb-erhebung.ts](../../src/core/status/fb-erhebung.ts)).

Gemessen am 03.08.2026 über 12 355 Vorgänge im Betrachtungsbereich:

| Situation | als Platzhalter sichtbar | Bedingung trifft |
|---|---:|---:|
| QS ← R19 Gutachten vollständig | 75 | 284 |
| FB ← R16 nur kaufm. Ablehnung erstellt | 10 | **222** |
| QS ← R14 alle Ablehnungen fertig | 55 | 61 |
| FB ← R2 PreCheck negativ (Verbund) | 53 | 59 |
| FB ← R20 kaufm. Gutachten fertig | 20 | 25 |

Drei Dinge, die daraus für den Termin folgen:

1. **Die sichtbare Zahl ist eine Untergrenze — und zwar pro Regel verschieden
   stark.** Ein Platzhalter entsteht nur, wo die fremde Regel ihre Kaskade
   *gewinnt*; eine eigene Regel stünde in ihrem Satz allein. Die Lücke reicht von
   +11 % (R2) bis auf das **22-fache** (R16). Genau deshalb steht seit v2.396
   `bedingungTrifft` als zweite Spalte daneben statt eines pauschalen Warnsatzes:
   der sagte nicht, *welche* Regel betroffen ist.
2. **Sperren gelten in beiden Zahlen.** `bedingungTrifft` wird aus
   `weitereTreffer` der ohnehin gerechneten Ergebnisse abgeleitet, und dort sind
   die Sperren bereits verrechnet — „Kaskade raus, Sperre bleibt". Achtung beim
   Erzeugen einer Regel aus einem Platzhalter: sie bekommt eine **neue Id** und
   steht damit nicht in `GESPERRTE_STRAENGE`, das seine Ziele namentlich nennt.
   Gemessen: dieselbe Bedingung trifft mit Id `r2` **59** Vorgänge, mit neuer Id
   **179**. Ob eine FB-Regel die Sperr-Zugehörigkeit ihrer Herkunftsregel erben
   soll, ist eine fachliche Frage des Termins (§9, offen).
3. **Die hohen Mediane sind der eigentliche Befund.** Von 5 820 einseitig offenen
   Paaren liegen **4 868 jenseits von 400 Tagen** Standzeit
   (`PAAR_ALTBESTAND_TAGE`) — das ist Altbestand, kein Rückstand. Der Split
   trennt das seit v2.396 und führt je Block auch den Median der letzten
   Aktivität mit: `SK→ST` hat 379 aktuelle Fälle mit Median 124 T (laufende
   Arbeit), `AT4→AK4` dagegen 814 alte mit 3 351 T Standzeit und 2 269 T ohne
   jede Bewegung (tote Akte). In einer Zahl gebündelt sähe beides gleich aus.

## 12. Import-Diff-Journal (v2.392)

### 12.1 Warum ein mitgeführter Stand

Der Nacht-Export **wird überschrieben**; alte Dateien stehen nicht zur Verfügung.
Das Journal kann deshalb nicht aus einer Dateireihe abgeleitet werden — es führt
`stand.json` mit: die Projektion des letzten Exports, gegen die der nächste
verglichen wird.

Ablage unter `_intern/vorgangssystem/journal/` (Stand + `journal-YYYY-MM.jsonl`,
append-only). **Nie in IndexedDB**: eine gerätelokale Historie erzeugte exakt die
Divergenz, die das Vorgangssystem beseitigt hat — zwei Rechner, zwei Verläufe,
keine Möglichkeit zu entscheiden, welcher stimmt.

### 12.2 Der Nullpunkt

`journalAb` ist der Tag des Baseline-Laufs. Davor gibt es nichts und wird es nie
etwas geben. **Der Nullpunkt steht deshalb an jeder Anzeige** — im Verlauf, im
Widget, im Popover. Ohne ihn wird eine unvollständige Chronik als vollständige
gelesen, und ausgerechnet bei einem Verlauf ist das der teuerste Irrtum.

Der Baseline-Lauf erzeugt **keine** Einträge. Täte er es, stünden beim ersten Mal
über hunderttausend Phantom-„gesetzt" in der Datei.

### 12.3 Fünf Aussagen, nicht eine

`gesetzt` · `geaendert` · `geleert` · `antrag-neu` (ein Eintrag je Antrag, nicht
je Feld) · `antrag-fehlt` (festhalten, nichts löschen — es kann ein Exportfehler
sein). `geleert` ist die interessanteste: dass jemand im Foyer eine Setzung
zurückgenommen hat, ist heute vollständig unsichtbar.

Liegt zwischen zwei Exporten mehr als ein Tag (Wochenende, Urlaub), tragen die
Einträge `unscharf` samt Zeitraum — die Änderung wird **als Spanne ausgewiesen,
nicht als Datum behauptet**.

### 12.4 Der Bereich gilt hier auch für Evidenz

Pitfall #46 sagt: Arbeitsvorrat folgt dem Betrachtungsbereich, Evidenz nicht. Das
Journal ist Evidenz und folgt ihm **trotzdem** — eine bewusste Abweichung. Die
Begründung war ursprünglich die Dateigröße; seit der Bereich die Generation 2015
mitführt (12 355 von 14 221 Anträgen, **87 %** des Bestands) trägt sie nicht mehr:
gespart werden noch ~13 %. Was bleibt, ist der eigentliche Grund — ein Journal
wird **am Vorgang** gelesen, und ein Vorgang außerhalb des Arbeitsvorrats hat
keinen Leser. Die Datei würde wachsen, ohne dass jemand hineinsähe. Drei Dinge
halten die Abweichung ehrlich:

- Der Bereich kommt aus der **Team-Kuration** (`bereichsProgramme` der aktiven
  Fassung), nie aus der persönlichen Auswahl — sonst entschiede die Einstellung
  eines Rechners über den Inhalt einer geteilten Datei. Konventionstest.
- `stand.bereich` wird mitgeführt. Ändert er sich, bekommen neu hinzugekommene
  Anträge eine **Baseline** statt tausender Phantom-`antrag-neu`.
- Ein Antrag außerhalb bekommt einen **benannten** Zustand („wird kein Journal
  geführt"), keine leere Liste.

### 12.5 Reihenfolge und Idempotenz

Der Stempel (SHA-256 über die Datei-**Bytes**, erste 12 Hex-Stellen) ist die
Idempotenz-Grundlage: unveränderter Export ⇒ gleiche Id ⇒ Ende, bevor etwas
beginnt. Vor dem Schreiben wird der Stand erneut gelesen (**optimistische
Sperre**); trägt er schon unseren Stempel, war ein anderes Gerät schneller.

Geschrieben wird **erst das JSONL, dann der Stand**. Bricht es dazwischen ab,
erzeugt der nächste Lauf denselben Diff erneut — lieber doppelt als verloren; das
Lesen dedupliziert über `(stempel, antragId, feld, art)`.

### 12.6 Keine Personen-Achse

Bearbeiter-Kürzel werden **nicht** journalisiert, und keine Journal-Ansicht ist
nach Bearbeiter gruppier- oder filterbar. Mit Personenbezug plus Datumsverlauf
entstünde ein Aktivitätsprotokoll — Leistungs- und Verhaltenskontrolle,
mitbestimmungspflichtig. `JOURNAL_AUSGESCHLOSSEN` nennt die Spalten ausdrücklich
(obwohl die `D_`-Regel sie ohnehin nicht erfasst), damit die Entscheidung
nachlesbar bleibt; ein Konventionstest hält sie.

### 12.7 Gemessen

| | |
|---|---|
| Export | 13,3 MB · 13 085 Zeilen |
| Anträge im Bereich | 7 269 |
| Journal-Spalten | 110 |
| gefüllte Feldwerte | 184 892 · 25,4 je Antrag |
| **`stand.json`** | **3,38 MB** — Sharding nach Antragsjahr ist damit nicht nötig |

Diese Zeilen sind am **9-Programm-Bereich** erhoben (vor v2.397). Mit 12 355 statt
7 269 Anträgen im Bereich wächst `stand.json` rechnerisch auf ~5,7 MB; die
Aussage „kein Sharding nötig" trägt das. Neu gemessen wird erst, wenn der nächste
Export-Lauf ohnehin durchläuft — eine Zahl, für die niemand wartet, ist keinen
Sonderlauf wert.

Die Wirkung am Wächter, mit drei journalisierten Anträgen: der Stau fällt von
**304 auf 303 bei AB**. `16DS261741` verliert sein „hängt 52 T", weil das Journal
eine Aktivität belegt, die der Export nicht mehr zeigt. Wo genähert wird, trägt
die Zahl weiterhin ein „≥".

### 12.8 Frische: ein ausgefallener Lauf muss auffallen (v2.396)

Ein Journal, das aufhört, sagt nichts — es hört einfach auf. Die Folge merkt man
erst später: der nächste Eintrag trägt eine `unscharf`-Spanne über den ganzen
unbemerkten Zeitraum, und der Nullpunkt ist verwässert, bevor es jemandem
auffällt. Deshalb steht die Frische in der Referenzdaten-Sektion des
Status-Katalogs — dort, wo auch Parametertabelle und Trigger-Tabelle ihren Stand
melden ([JournalFrische.tsx](../../src/plugins/status-cockpit/JournalFrische.tsx)).

- **In der Kopfzeile**, nicht nur im aufgeklappten Bereich: die Sektion ist per
  Default zu, und eine Warnung, die man erst aufklappen muss, ist keine.
- **Schwelle `JOURNAL_FRISCHE_WARNUNG_TAGE = 3`.** Ein Freitags-Export ist am
  Montag drei Tage alt; ein Wochenende ist kein Ausfall, ab vier Tagen ist es
  einer.
- **Die Warnung nennt die Folge, nicht den Zustand**: „was sich in dieser Zeit
  geändert hat, kann der nächste Lauf nur als Zeitraum erfassen, nicht als
  Datum".
- Ohne Schreibrecht bleibt die Anzeige, nur der Hinweis „ein Import auf diesem
  Gerät holt das nach" fällt weg — ein Versprechen, das dieses Gerät nicht
  einlösen kann, ist schlechter als keins.

**Geschrieben wird flag-unabhängig, angezeigt nicht.** `journalisiereImport`
hängt am Auto-Refresh und prüft `vorgangssystem` bewusst nicht: ein Export, den
niemand journalisiert hat, ist unwiederbringlich. Die Frische-Anzeige sitzt
dagegen hinter dem Flag (dev/pl). Wer den Nacht-Import aus der Kurator-Variante
fährt, schreibt das Journal also mit, sieht seine Frische aber nicht — bewusst in
Kauf genommen, solange das Vorgangssystem in Erprobung ist.

**Warum `dev:local` den Schritt nie auslöst:** die Variante seedet über
[fixture-loader.ts](../../src/core/services/seed/fixture-loader.ts), das
`importCsvSource(…, {})` **ohne** `onRows` aufruft. Nur der Auto-Refresh-Pfad
reicht den Journal-Schritt herein. Das ist Absicht — ein Fixture-Seed darf den
Team-Stand nicht anlegen —, heißt aber: der Live-Pfad ist nur aus einem echten
Nacht-Import heraus zu beobachten, nicht aus dem Dev-Server.
