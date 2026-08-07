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
| — | Phasenvorschlag für Kürzel (Trigger-Tabelle + Auslieferung) | v2.408.0 → [Abschnitt 13](#13-phasenvorschlag-für-kürzel-v2408) |
| — | **Verlaufsableitung** — Statusabschnitte aus den `D_`-Spalten, reines Modul ohne UI | v3.17.0 → [Abschnitt 14](#14-verlaufsableitung-v317) |

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

Die ZAH-App ist **Companion, nicht zweite Workflow-Engine**. Das Fachsystem C16 führt die Wahrheit: Bearbeiter setzen Vorgangskürzel, Trigger ändern Status und versenden Mails. Die App liest den nächtlichen CSV-Export und leistet das, was C16 fehlt:

1. **Erklären** — warum hat ein Antrag diesen Status, was ist zuletzt passiert (Info-Icon)
2. **Navigieren** — welches Kürzel ist als Nächstes zu setzen, von wem, was löst es aus
3. **Warnen** — welcher Antrag hängt fest, weil ein Kürzel vergessen wurde (Stillstands-Wächter)
4. **Steuern** — Fristen-Cockpit für Bearbeiter und PL, ersetzt die Hand-XLSX-Listen

**Die App leitet keinen Status ab.** `STATUS_TV` / `STATUS_VB` aus dem CSV werden angezeigt, wie sie sind — sie sind das Ergebnis der Legacy-Trigger, Stand letzte Nacht. Damit entfällt die gesamte bisherige Ableitungslogik (Ränge, Prioritäten, Ordner-Ränge) und mit ihr die Rechner-Divergenz: Unterschiede zwischen zwei Rechnern können nur noch Datenstand-Unterschiede sein, und der Datenstand wird überall sichtbar mitgeführt.

## 2. Zentrale Erkenntnis zum Datenmodell

**Die Vorgangskarte ist bereits im CSV** — flachgeklopft als Spalten:

- `D_<KÜRZEL>` = Datum, an dem das Kürzel gesetzt wurde (z. B. `D_AAE` Antragseingang, `D_ARF` Entwurf RNE fertig)
- `T_<KÜRZEL>` = optionaler Begleitwert (z. B. `T_AAI` ZIM-Foyer-Identcode, `T_XAT` Anzahl erw. TV)

Die 512 Felder im bestehenden Felder-Tab **sind** diese Kürzel-Spalten; der Ordnerbaum ist ihre fachliche Gliederung, die Label-XLS liefert die Bezeichnungen. Es braucht keinen neuen Export — nur eine neue Interpretation der vorhandenen Felder.

**Bekannte Grenzen (ehrlich ausweisen, nicht verstecken):**

- Ein Datum pro Kürzel-Spalte → bei mehrfach gesetzten Kürzeln ist nur das letzte Datum sichtbar (V9 bestätigt). Der aus den Spalten rekonstruierte Verlauf ist eine Näherung, keine vollständige Historie. Wiederholungen mit eigener Spalte (z. B. `D_AAE2`) werden normal mitgenommen. **Seit v2.392 gilt das nur noch rückwärts:** ab dem Nullpunkt des Import-Diff-Journals (Abschnitt 12) ist der Verlauf belegt — auch für Setzungen, die der nächste Export überschrieben hat.
- Ein-Tages-Verzug durch den Nacht-Export. Bei 90-Tage-Fristen ist Tagesgranularität ausreichend; der Importzeitpunkt wird überall angezeigt.
- Status liegt nur als Text vor → Join über den importierten Status-Katalog (Text ↔ Code), NFC-normalisiert. Danach rechnet die App intern mit Codes; Textvarianten betreffen nur noch Labels.

## 3. Referenzdaten: drei Importe statt Kuratier-Aufwand

Alle drei kommen als XLSX-Import aus C16 (Kurator-Aktion, manuell alle paar Monate), liegen versioniert auf dem Share (`_intern/`, `atomicWrite`, Version + Hash), und zeigen beim Re-Import einen Diff („3 neue Kürzel, 1 geänderter Trigger, 2 entfallen").

| Referenz | Inhalt | Umfang | Rolle in der App |
|---|---|---|---|
| **Status-Katalog** | Code ↔ Text (11 Skizze … 99 Schlussvermerk), Marker-Kennzeichnung | ~30 | Text→Code-Join, Anzeige, Sortier-Default |
| **Kürzel-Katalog** | Kürzel ↔ Beschreibung ↔ „wird gesetzt von" (AB/FB/QS/PA/Juristen/neutral) | mehrere hundert | Glossar, Navigator, Wächter-Rollen |
| **Trigger-Tabelle** | Kürzel → Folge → Prozedur → Parameter (geparst) | mehrere hundert Zeilen | Erklärung + Navigator |

**Trigger-Parser:** vier Prozedurtypen (`TRG_TVs_Status_TV_VB`, `TRG.VorgEintragNeu`, `TRG.VorgEintragMail`, `TRG.Status.TV.VB`), Pipe-getrennte Parameter, Semantik ist in C16 dokumentiert. Nicht parsebare Zeilen werden als „nicht interpretiert" gekennzeichnet und roh angezeigt — niemals stillschweigend verworfen (Heuristiken sind ehrlich). Der Parser erzeugt pro Trigger eine **deutsche Satzform**:

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
unbekanntes macht nur seinen Teil unprüfbar, nicht die ganze Zeile.

**Vier Kürzel kennt der Katalog nicht — und das ist geklärt (V6).** Von 221
referenzierten Kürzeln fehlen genau vier: `ID` = **Rollenvergabe** (30 eigene
Zeilen in allen neun Richtlinien, sämtlich Mail-Trigger), `TTV1`/`TTV2`/`TVB1` =
**Testkürzel** (je 2 Zeilen, nur in 78 und 138 — eine davon adressiert eine
persönliche Mailadresse statt eines Rollen-Tokens). Sie stehen deshalb nicht im
Kürzel-Katalog, sondern in [sonderkuerzel.ts](../../src/core/status/sonderkuerzel.ts):
Testkürzel sind kein Arbeitsschritt und fallen aus der Kandidatenliste (gezählt
und in der Fußzeile benannt), `ID` behält seinen Platz und bekommt seine
Bedeutung, und der Import zieht alle vier von der Unbekannt-Warnung ab, damit
ein **fünftes** auffällt.

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

Die bisherigen Spine-Phasen (Eingang → Vollständigkeit → Fachprüfung → Bewilligung → Schluss) sind eine App-Erfindung — C16 kennt keine Phasen (`VB_PHASE` ist die Fördervariante, ein anderes Konzept). Das ist legitim, wird aber ehrlich gemacht:

- **Umbenennung in „ZAH-Phase"** überall (UI, Code, Docs), um die Kollision mit `VB_PHASE` dauerhaft zu beenden.
- **Explizite Zuordnungstabelle** Status-Code → ZAH-Phase (30 Zeilen im Seed, `zah-phasen.ts`). Kein Ableiten aus Code-Bereichen — die Codes sind nur grob geordnet (32 ablehnungsreif liegt vor 34 bearbeitungsreif).
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

Änderungswünsche der Kollegen laufen über die Seite **„Zu klären"** ([klaerung.md](klaerung.md)): dort prüfen und kommentieren AB/FB den Schnitt Zeile für Zeile, das Ergebnis wird exportiert und im Seed geändert. **Die App editiert den Schnitt nicht** — sie kann es auch nicht sinnvoll: `prod` lädt keine Katalog-Fassung, ein in `pl` geänderter Schnitt wäre eine zweite stille Wahrheit. Umhängen eines Status ist deshalb eine Seed-Zeile plus Release, nicht eine Kuration zur Laufzeit.

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

**Die Zeichen im Trigger-Satz sind erklärt** (v2.400). „Wenn VB-Status vor 59, TV hat kein ABB → setze TV-Status 31." ist ohne Vorwissen Geheimschrift; Kürzel, Statuscodes, Bezugsdatei-Nummern und Mail-Empfänger tragen deshalb ihre Bedeutung im Tooltip (`ABB` → „Bewilligung · wird gesetzt von QS", `59` → „bewilligt · ZAH-Phase Begleitung"). Drei Regeln:

1. **Der Satz entsteht als Segment-Liste** ([trigger-satz.ts](../../src/core/status/trigger-satz.ts)), der Text ist nur ihre Verkettung. Ein Muster über den fertigen Satz könnte es nicht: `Setze TV-Status (211) auf 74.` trägt Bezugsdatei-Nummer und Statuscode nebeneinander, der Textbaustein-Klartext bringt beliebige Prosa mitten hinein, und eine nicht interpretierte Zeile trägt ihren Rohparameter.
2. **Erklärt wird gegen die Fassung** ([trigger-erklaerung.ts](../../src/core/status/trigger-erklaerung.ts)) — kuratierte Werte schlagen den Auslieferungs-Schnitt, wie in `statusKurz`.
3. **Gepunktet unterstrichen ist genau, wozu es eine Erklärung gibt.** Ein gedeutetes, aber unbekanntes Kürzel sagt „steht nicht im Katalog"; eines aus den ungedeuteten Zusatz-Argumenten schweigt, weil dort nicht einmal feststeht, dass es ein Kürzel ist. Das Fehlen der Geste ist damit selbst eine Auskunft.

Dieselben Sätze und dieselbe Auszeichnung stehen unter „Nächste Schritte" (6.2) — beides über den einen Renderer [ErklaerterSatz.tsx](../../src/plugins/antraege/status/ErklaerterSatz.tsx).

### 6.2 Nächster-Schritt-Navigator + Kürzel-Glossar

Aus aktuellem Status + Trigger-Vorbedingungen (`<x`/`>x`, ABB-/YIRR-Bedingungen gegen die `D_`-Spalten geprüft) berechnet die App die **kandidierenden nächsten Kürzel** — gefiltert auf Relevanz-Häkchen, mit Rolle („wird gesetzt von") und Wirkung (Statuswechsel, Mail an wen):

> Nächster erwarteter Schritt: **ABLW** setzen (in C16) — Rolle AB · prüft NF-Rücklauf · setzt Status 37 · Mail an TIB

Default-Filter „Meine Rolle" (aus dem Profil, Abschnitt 5a), umschaltbar auf alle Rollen. Die App setzt nichts selbst; sie sagt präzise, was in C16 zu tun ist. Dazu das **Kürzel-Glossar** als durchsuchbare Seite (Kürzel, Beschreibung, Rolle, Trigger-Wirkung in Satzform, Relevanz-Häkchen, Rollen-Filter) — beantwortet das „viele kennen die Kürzel nicht"-Problem am Ort des Bedarfs.

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
- ZAH-Phasen-Zuordnung bleibt **Auslieferung** (`zah-phasen.ts`), nicht Kuration: `prod` lädt keine Katalog-Fassung, ein in `pl` geänderter Schnitt wäre eine zweite stille Wahrheit. Änderungswünsche laufen über die Seite „Zu klären" ([klaerung.md](klaerung.md)) → Export → Seed-Änderung → Release. *(Ursprünglich war „PL-editierbar mit Versionierung" geplant; ein Bedienelement dafür wurde nie gebaut, und die Absicht ist mit v2.407 ausdrücklich aufgegeben.)*

**Offen:**

1. ~~**Mehrfach-Kürzel:** Prüfen am echten Export, ob `D_`-Spalten bei Wiederholung das erste oder letzte Datum tragen.~~ **Erledigt (V9):** das **zuletzt** gesetzte Datum; frühere Setzungen sind überschrieben. Damit die Information nicht länger verloren geht, führt die App seit v2.392 ein Import-Diff-Journal (Abschnitt 12).
2. **Mail-Platzhalter** (#BA1/#FB1/#TB1 …): vermutlich BIB-/TIB-Familien — an C16 verifizieren, dann im Navigator auflösen.
3. **Phasen-Schnitt** aus Abschnitt 5 fachlich abnehmen (insb. 32 ablehnungsreif unter „Entscheidung", der 70er-Block, 59 bewilligt als Beginn von „Begleitung", 29 Irrläufer als Marker).
4. **Zieltage-Startwerte:** aus der PL-Erfahrung oder initial aus der Ist-Verteilung (Median-Verweildauer je Status) vorschlagen lassen?
5. **Kürzel-Paare:** Erkennung der adm./fachl.-Paare (AK4/AT4 …) — als Konvention aus dem Katalog ableitbar oder als kleine Paar-Liste pflegen? Beim AB-Onboarding klären, ob Relevanz-Defaults je Rolle getrennt sein sollen.
6. ~~AB-Dashboard-Mappe beschaffen~~ **Erledigt:** To-do-Logik transkribiert → `todo-regeln-ab-seed.md` (25 Regeln + 2 Sperren, inkl. bereinigter Mappen-Fehler). Der übermittelte Spaltenkopf deckt alle Regel-Eingaben ab. Verbleibend: Verifikationsfragen V1–V4 aus der Seed-Datei mit AB-Kollegen klären; Spaltenauswahl der Mappe als Relevanz-Seed AB übernehmen.
7. **Trigger-Nachexport für 46/47/48** (Abstimmungspunkt A4, seit v2.397 wieder offen): die Generation 2015 gehört jetzt zum Arbeitsvorrat, die Trigger-Zuarbeit führt für sie nichts. Bis zu 5 086 Vorgänge sagen deshalb „für Programm N keine Trigger importiert" — korrekt, aber häufig. Fachfrage bleibt, ob das Fachsystem für diese Programme noch Trigger-Definitionen führt (V8).
8. **Zieht `ergaenzeSeedFelder` die `zahPhaseId` nach?** Heute nicht: die Funktion ist rein additiv und rührt bestehende Felder nicht an, deshalb erreichten die 24 hand-kuratierten Feld-Phasen der Auslieferung keine Bestandsfassung — sie waren seit Anlage der Fassung tote Fracht. Das Band aus Abschnitt 13 holt es einmalig nach, aber die Lücke reißt bei jedem künftig hinzukommenden Seed-Feld wieder auf. Zu klären: soll das Nachziehen die Phase bei **neu hinzukommenden** Feldern mitführen (bestehende blieben unangetastet), oder bleibt es beim ausdrücklichen Vorschlag?

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
vorgefilterte Menge nähme ihm S0/S0b/S1/S2 — und ein in C16 abgeschlossener
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
   **179**. **Seit v2.412 ist das behoben** (§11a): die Sperren nennen Stränge,
   und eine aus einem Platzhalter erzeugte Regel erbt den `strang` ihrer
   Herkunftsregel — sie steht damit von Anfang an in derselben Kette.
3. **Die hohen Mediane sind der eigentliche Befund.** Von 5 820 einseitig offenen
   Paaren liegen **4 868 jenseits von 400 Tagen** Standzeit
   (`PAAR_ALTBESTAND_TAGE`) — das ist Altbestand, kein Rückstand. Der Split
   trennt das seit v2.396 und führt je Block auch den Median der letzten
   Aktivität mit: `SK→ST` hat 379 aktuelle Fälle mit Median 124 T (laufende
   Arbeit), `AT4→AK4` dagegen 814 alte mit 3 351 T Standzeit und 2 269 T ohne
   jede Bewegung (tote Akte). In einer Zahl gebündelt sähe beides gleich aus.

## 11a. Stränge statt Regel-Id-Listen (v2.412)

S1 und S2 zählten sieben Regel-Ids auf (`['r1','r2','r22','r23a','r23b','r24','r25']`).
Wer eine achte PreCheck-Regel anlegte, musste daran denken, **beide** Sperren zu
ändern — und wenn er es vergaß, fiel die neue Regel still durch jede Sperre und
feuerte auch am zurückgezogenen Antrag. Der Kopfkommentar der Engine sprach
längst von Strängen; nur das Datenmodell nicht.

**Das Modell.** `TodoRegel.strang` (Freitext mit Vorschlagsliste, kein Enum — die
Fachseite pflegt die Kaskade selbst, ein neuer Strang darf kein Release
brauchen). `sperrt` führt drei Formen nebeneinander, ausdrücklich mischbar:

| Eintrag | Bedeutung |
|---|---|
| `'*'` (`ALLE_STRAENGE`) | alle übrigen Regeln — auch später ergänzte |
| `'strang:rne'` | jede Regel mit `strang: 'rne'`, auch später ergänzte |
| `'r22'` | genau diese eine Regel |

`sperrtNicht` bleibt bei Ids: eine Ausnahme meint genau **eine** Aufgabe („ZuwB
erstellen" überlebt S0b), nie eine ganze Kette.

**Die Auswertung liegt in einer Funktion**, wie `regelsatzVon` und
`sperreGiltFuer`: `sperrEintragTrifft(eintrag, regel)` in
[regelsatz.ts](../../src/core/status/regelsatz.ts). `sperrLage` sammelt die
Einträge und löst sie erst gegen die jeweilige Regel auf — genau darin liegt der
Gewinn, denn eine Regel, die es beim Schreiben der Sperre noch nicht gab, gehört
dann automatisch dazu. `istGesperrt` nimmt deshalb die **Regel**, nicht ihre Id.

**Eine Regel ohne `strang` wird von keiner Strang-Sperre erfasst.** Das ist die
gewollte Lesart — und die Falle, vor der der Regel-Editor warnt, sobald im
gezeigten Regelsatz tatsächlich eine Strang-Sperre greift.

**Die Stränge des ausgelieferten Satzes**: `precheck` (R1, R2, R23a, R23b),
`nachforderung` (R22, R24, R25), `rne` (R6–R9), `ablehnung` (R11–R16),
`gutachten` (R17–R21), `zuwb` (R3), `schluss` (R4, R5). **R10**
(„Nachlieferungstermin verstrichen") bleibt **ohne** Strang: sie steht in keiner
Sperre und liegt zwischen Nachforderung und Erinnerung — geraten wird nicht.
Nur `precheck` und `nachforderung` werden gesperrt; die übrigen sind vergeben,
damit die nächste Sperre sicher ist.

**Rollout.** Bestandsfassungen auf dem Share behalten ihre Id-Listen und
verhalten sich unverändert — beide Formen wertet dieselbe Engine aus. Die
Strang-Form kommt über „Nachziehen"; die Drift-Bilanz weist s1/s2 dann als
geändert aus (`regelKern` führt `strang` seit v2.412 mit). Am echten Bestand
gemessen: nach dem Nachziehen ändert sich bei **0 von 12 355** Vorgängen das
To-do.

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
sein). `geleert` ist die interessanteste: dass jemand in C16 eine Setzung
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

## 13. Phasenvorschlag für Kürzel (v2.408)

Die ZAH-Phase am **Kürzel** beantwortet „welches Datum gehört zum aktuellen
Status?". Ohne sie liefert `bestimmeSeit` ([herleitung.ts](../../src/core/status/herleitung.ts))
immer `null` — es sucht in der Chronik ein Datumsfeld derselben Phase wie der
Status und findet keines. Gemessen am 04.08.2026 trug **kein einziges** der 508
Felder der Bestandsfassung eine Phase; die „seit"-Zeile der Status-Erklärung und
die Phasen-Marke der Chronik waren damit für den gesamten Bestand tot.

508 Zuordnungen von Hand sind keine Option. Zwei Quellen wissen es bereits, und
`feld-phase-vorschlag.ts` rechnet sie zu einem Vorschlag zusammen:

| Quelle | Aussage | Ausbeute |
|---|---|---|
| **Trigger-Tabelle** | Das Kürzel setzt Status X, X liegt in Phase P. Eine Regel des Fachsystems, keine Beobachtung — ein Beleg genügt. | 33 |
| **Auslieferung** | `seed-codes.ts` kuratiert 24 Feld-Phasen von Hand; sie erreichen keine Bestandsfassung, weil `ergaenzeSeedFelder` rein additiv ist (offener Punkt 8). | 13 |

**Was der Vorschlag NICHT tut**, und warum:

- **Keine Mehrheitsentscheidung.** Setzt ein Kürzel über die neun Richtlinien
  hinweg Status verschiedener Phasen, gibt es keinen Vorschlag; der Fall steht
  mit den konkurrierenden Phasen und den jeweiligen Richtlinien in der Vorschau.
  Am heutigen Stand tritt er **null**-mal auf — der Codepfad existiert trotzdem
  und ist getestet, sonst liefe er erstmals an dem Tag, an dem er gebraucht wird.
- **Trigger schlägt Auslieferung, aber nicht stillschweigend.** Widersprechen
  sich beide Quellen an einem Feld, fällt der Vorschlag aus **beiden** weg und
  die Abweichung wird benannt. Sonst kippte ein späterer Trigger-Import still
  eine handkuratierte Zuordnung. Heute decken sich 11 Felder in beiden Quellen —
  alle 11 ohne Konflikt.
- **TV vor VB, aber sichtbar.** Die Kürzel-Phase beschreibt den TV-Weg, also
  gewinnt `statusTv`. Weicht `statusVb` in der Phase ab, bleibt der Vorschlag und
  der Beleg sagt es ausdrücklich. Von 54 Zeilen mit beiden Zielstatus weicht
  heute keine ab.
- **Kein Vorschlag ist eine Antwort, kein Mangel** — und sie wird begründet:
  kein Trigger (293) · nur Mail-/Eintrags-Prozeduren (177) · nur Marker (2) ·
  Zielcode ohne Phase (0). Von 505 Kürzeln setzen nur **35** überhaupt einen
  Status; die übrigen erklären kein „seit wann" und brauchen keine Phase. Genau
  das sagt die Kopfzeile des Kürzel-Tabs, damit „46 von 508" nicht als 9 %
  Erledigungsgrad gelesen wird.

Ein **Beleg ist eine Regel, nicht eine Zeile**: dasselbe Kürzel trägt dieselbe
Wirkung in allen neun Richtlinien, teils zweimal je Richtlinie. Zeile für Zeile
aufgeführt wären das für `AAE` siebzehn identische Sätze; gefaltet ist es einer,
der seine Richtlinien nennt.

Übernommen wird **zeilenweise auswählbar** in den Entwurf (`setzeFeldPhasen`,
ein `setState`); festgeschrieben wird wie immer über die Speicherleiste. Danach
ist es eine normale Zuordnung ohne Herkunftsvermerk — editierbar wie jede andere.
Der Filterchip **„ohne Phase"** im Kürzel-Tab zeigt, was von Hand bleibt.

Endstand nach beiden Übernahmen: **46 von 508** Feldern mit Phase, verteilt über
alle sechs ZAH-Phasen (Eingang 3 · Vollständigkeit 10 · Prüfung 6 ·
Entscheidung 10 · Begleitung 8 · Abgeschlossen 9). Alle 46 sind Datumsfelder —
genau die Sorte, die `bestimmeSeit` auswertet.

## 14. Verlaufsableitung (v3.17)

Modul [src/core/status/verlauf/](../../src/core/status/verlauf/), rein und ohne
UI: `baueVerlauf(bezug, version, triggerRegeln, journal)` liefert je
Teilvorhaben eine **Spur** und eine für den Verbund — Statusabschnitte
(`VerlaufsSegment`), die Kürzel dazwischen (`VerlaufsUebergang`) und den
Zustand, wenn es keine Bahn gibt.

### 14.1 Warum abgeleitet und nicht beobachtet

Das Import-Diff-Journal (Abschnitt 12) beginnt am 05.08.2026; alle 12 356
Anträge des Bereichs hatten ihren letzten Statuswechsel davor. Eine Spur, die
nur beobachten kann, sagt bei jedem Vorgang „nicht beobachtet" und erklärt damit
nur ihre eigene Blindheit. Die App rekonstruiert deshalb aus den `D_`-Spalten
und den Statuswechsel-Regeln der Kürzel-Zuarbeit und führt an jeder Spur
`herkunft` mit; sobald das Journal trägt, steigt sie auf `beobachtet`.

**Pitfall #44 bleibt unberührt**: rekonstruiert wird die *Vergangenheit*. Das
letzte Segment jeder Spur trägt immer den **importierten** Wert. Zwei Guards
halten das — der Status-Pfad kennt das Modul nicht, und die (durchweg
`aktiv: false`) Regeln der Zuarbeit haben genau einen Konsumenten.

### 14.2 Die vier Spurzustände

`verlauf` · `kein_bearbeitungsstand` (Marker/Rolle im Verbund) ·
`kein_wert_im_csv` · `nicht_beobachtet` (Status da, kein Übergang erklärt ihn).
Jeder Zustand ≠ `verlauf` trägt eine Begründung im Klartext.

Weicht die Ableitung vom Export ab, ist das ein Befund mit **zwei Arten** —
und die Unterscheidung ist der Unterschied zwischen einer Warnung und Lärm:

| Art | Bedeutung | gemessen |
|---|---:|---:|
| `nicht_ableitbar` | keine Regel dieser Projektform setzt den Status; die Ableitung *konnte* ihn nicht erreichen | **11 134** |
| `widerspruch` | es gäbe eine Regel, sie ist an diesem Vorgang nur nicht belegt | **152** |

### 14.3 Was der Bestandslauf ergeben hat

Knopf im Reiter *Kürzel* der Vorgangs-Regeln
([VerlaufBefundeBlock.tsx](../../src/plugins/status-cockpit/VerlaufBefundeBlock.tsx)),
gemessen am 06.08.2026 über **12 356 Teilvorhaben in 6 614 Vorhaben**
(Richtlinien 2015 + 2020 + 2025, 12 Programme), Laufzeit 6,5–7,8 s:

| | |
|---|---:|
| Teilvorhaben mit Verlauf | **10 640 (86,1 %)** |
| ohne erklärten Statuswechsel | 1 652 |
| ohne Bearbeitungsstand (Irrläufer) | 64 |
| **Verbünde mit abgeleitetem Statuswechsel** | **1 388 (21,0 %)** |
| Verbünde mit Terminen auf der Bahn (Obermenge) | 6 015 |
| gesetzte Termine | 490 153 |
| davon mit belegtem Statuswechsel | 29 602 (**6,0 %**) |
| Segmente · davon Dauer unsicher | 45 616 · 31 135 (68,3 %) |
| mehrdeutig (gleichtägig) | 1 150 |
| umbenannte Kürzel im Bestand | 1 277 (`MVA→ÄA` 989, `LBN→LBNx` 288) |
| längste Spur | 87 Übergänge, 4 Segmente |

**Warum die Dauer unsicher ist** (Phase 2, v3.20 — bis dahin steckte alles in der
einen 68,3-%-Zahl). Die vier Auslöser sind disjunkt und summieren sich exakt auf
`segmenteUnsicher`; ein Test hält das fest:

| Auslöser | Abschnitte | Anteil an 31 135 |
|---|---:|---:|
| Anfang unbekannt (kein belegter Wechsel bzw. nachgeschobener Status) | 18 130 | 58,2 % |
| Ende offen (Abweichungsfall) | 11 286 | 36,2 % |
| Datum unlesbar | 0 | — |
| **gemessen ≤ 1 Tag** | **1 719** | **5,5 %** |

**Nur der letzte Fall misst Verweildauer.** 94,5 % der „Unsicherheit" sind eine
**offene Grenze** — „wir wissen nicht, wann es anfing" ist keine kurze Dauer.
Gemessene Ein-Tages-Abschnitte sind 3,8 % aller 45 616 Abschnitte.

Die 16 200 Abschnitte mit zwei Grenzen (35,5 %) tragen eine Verteilung mit
echter Spreizung: **Median 10 T**, p25 4 T, p75 37 T, p90 91 T; **28,9 % länger
als 30 Tage**. Keine negative Dauer im Bestand. Termine verteilen sich auf
**1,77 je Tag und Vorhaben** (465 551 gesetzte Felder auf 263 761 verschiedene
Tage) — die Tagesgranularität ist also nicht bloß Vorsicht, sondern nötig.

⇒ **Für Phase 3**: die dauerskalierte Statusbahn bleibt die Grundform. Sie misst
kein Rauschen — sie hat für zwei Drittel der Abschnitte nur keine Achse. Diese
brauchen eine eigene Darstellung (angeschnittene Kante „vor dem ersten Beleg"
bzw. „läuft weiter"), keine Ersatzbreite. Eine Doppelspur ohne Dauerskalierung
wäre eine Antwort auf ein Problem, das die Messung nicht bestätigt.

Drei Aussagen daraus:

- **`kein_kuerzel` ist der Normalfall, nicht die Ausnahme** (94 % der Termine).
  Ein Band zeigt überwiegend Termine ohne bekannten Statuswechsel; die Abschnitte
  entstehen aus median zwei Übergängen. Es trägt — schmal.
- **Die Verbundspur ist die schwache Stelle** (21 %). Grund ist nicht der Code,
  sondern die Datenlage: von 41 Regeln berühren fünf den Verbund, jede gilt für
  **genau eine** Projektform, und `XIZ`/`XVE` haben im Bestand keine gemappte
  Spalte. 3 241 Verbünde tragen ein VB-Kürzel, für dessen Projektform die
  Zuarbeit nichts führt (`ABB/FuE` 2 650, `AB/FuE` 2 319 …).
- **Die Projektform ist der Hebel.** 58 % der Verbünde sind FuE, und für FuE
  führt die Zuarbeit 11 Regeln — für NW (21 %) sind es 25. Eine
  Trigger-Nachlieferung für FuE hätte mehr Wirkung als jede Codeänderung.

**Zum Vergleich, nur gezählt und nicht abgeleitet**: die importierte
C16-Trigger-Tabelle würde 54 587 Termine (11,1 %) und **4 183 von 6 614
Verbünden (63,2 %)** erklären — das Dreifache der Zuarbeit. Abgeleitet wird
trotzdem aus einer Quelle; zwei Regelwerke in einer Spur wären die zweite
Wahrheit, gegen die Pitfall #45 geschrieben ist. Was der Vergleich im Detail
ergibt, steht in 14.5.

### 14.4 Offene Punkte für die Fachabstimmung

1. **`XPC+`/`XPC?` setzen den TV-Status, nicht den Verbundstatus** — so steht es
   in der Zuarbeit (`scope: tv`, *„Stw TV auf bearbeitungsreif, wenn alle TV PC+
   haben"*). Es sind Verbund-Kürzel mit Wirkung auf die Teilvorhaben. Die App
   folgt den Daten. **Die C16-Tabelle sagt das Gegenteil** (14.5): für `XPC+`
   führt sie einen **Verbund**-Status 34 und gar keinen TV-Status. Zu klären,
   welche Quelle recht hat.
2. **Zwei Zielstatus lösen nicht auf**: `AB/NW` → *„bewilligungseif"* (Tippfehler
   der Quelle) und `XHSP/FuE` → *„Bewilligungsentwurf"*. Zusammen 285 Verbünde,
   deren einziger VB-Übergang deshalb ohne Code bleibt. **C16 löst beide auf**
   (14.5): `AB` → 51 *bewilligungsreif* in allen neun geführten Programmen,
   `XHSP` → 50 *Bewilligungsentwurf VDI/VDE-IT*. Zu bestätigen, dann in die
   Zuarbeit nachziehen.
3. **DL und EP haben gar keine Verbund-Regel** — gemessen: DL 514 Verbünde,
   davon **0** mit abgeleitetem VB-Statuswechsel (14.5).
4. **12 der 41 Regeln lassen die Ebene offen** (`scope: null`) — 5 718 Termine
   tragen deshalb „Regel vorhanden, Ebene unbestimmt".
5. **Die Marker-Werte kommen im Antragsbestand nicht vor.** `Sonderstatus`,
   `assoziierter Partner` und `internationaler Partner` stehen ausschließlich auf
   Roh-Exportzeilen **ohne** Förderkennzeichen (24 701 von 28 914 in
   `9052-prjbsp`) — sie sind keine Anträge. Der Spurzustand
   `kein_bearbeitungsstand` bleibt im Modell, greift heute aber nur bei
   *Irrläufer* (64 Fälle).

### 14.5 Zweite Regelquelle: was C16 zusätzlich erklärt

Gemessen am 07.08.2026, derselbe Bereich wie 14.3 (6 614 Vorhaben, Richtlinien
2015 + 2020 + 2025, 12 Programme). Read-only, nichts aktiviert.

**Was die Tabelle ist.** `_intern/status-trigger.json`, Share-Sidecar ohne
Seed ([trigger-share.ts](../../src/core/status/trigger-share.ts)); Import per
XLSX-Blatt „Trigger-Prozeduren", Schlüssel Programm#Kürzel#Folge, Import-Zähler
statt Fassungs-Historie; `geparst` wird bei jedem Laden neu abgeleitet, nie aus
der Datei übernommen. Stand: **2 447 Zeilen, Fassung 1, neun Programme**
(76–79, 131, 136–139). Die Richtlinien-Generation 2015 (**46, 47, 48**) führt sie
**nicht** — das ist die eine Stelle, an der nur die Zuarbeit etwas weiß.

Prozeduren: `vorgEintragMail` 1 948 · `statusTvVb` 287 · `statusSetzen` 112
(82 auf TV-, 30 auf Verbund-Ebene) · `vorgEintragNeu` 93 · **7 nicht
interpretiert**.

#### Deckung je Projektform — die Zuarbeit deckt genau eine

| Projektform | Verbünde | Zuarbeit | C16 |
|---|---:|---:|---:|
| FuE | 3 841 (58,1 %) | **0** | 2 320 (60,4 %) |
| NW | 1 374 (20,8 %) | **1 103 (80,3 %)** | 687 (50,0 %) |
| DS (`zuarbeit-aelter`) | 851 | **0** | 851 (100 %) |
| DL | 514 | **0** | 305 (59,3 %) |
| Irrläufer | 34 | **0** | 20 |
| **gesamt** | **6 614** | **1 103 (16,7 %)** | **4 183 (63,2 %)** |

Die 1b-Vermutung war zu milde: FuE ist nicht schlecht abgedeckt, sondern **gar
nicht**. Jeder abgeleitete Verbund-Statuswechsel im Bestand kommt aus NW. (Die
21,0 % aus 14.3 sind dieselbe Menge plus 285 Verbünde, deren einziger
VB-Übergang einen **nicht auflösbaren** Zielstatus trägt: 1 103 + 285 = 1 388.)

#### Überlappung: null Widersprüche — und fast keine Überschneidung

Wo beide Quellen zum selben (Kürzel, Projektform, Programm) etwas sagen, sagen
sie **dasselbe**: zwei Paare, `ABB/NW` in Programm 76 (445 Verbünde) und 136
(106 Verbünde), beide → 59 *bewilligt*. **Kein einziger Widerspruch.**

- **Nur die Zuarbeit**: ein einziges Paar — `ABB/NW` in Programm **46**
  (552 Verbünde). Genau das Programm, das C16 nicht führt.
- **Nur C16**: 80 Paare über 20 Kürzel (`AAE`, `AB`, `ABB`, `XKS`, `XPC+`, `VV`,
  `VZK`, `XHSP`, `ABLW` …).

C16 beantwortet dabei drei offene Punkte aus 14.4 unmittelbar: `AB` → **51**
(*bewilligungsreif* — der Tippfehler „bewilligungseif" ist damit gelesen),
`XHSP` → **50** (*Bewilligungsentwurf VDI/VDE-IT*), und `XPC+` trägt einen
**Verbund**-Status 34 ohne jeden TV-Status.

#### Drei Genauigkeitsgrenzen der 63,2 % — zwei sind harmlos, eine nicht

1. **Untererfassung, ohne Wirkung**: der Vergleichs-Index nimmt nur
   `statusTvVb`; die 112 `statusSetzen`-Zeilen fehlen. Mit ihnen wächst der
   VB-Index von 82 auf 105 Schlüssel — die Verbund-Deckung bleibt bei **4 183**.
   Die Zeilen betreffen Kürzel, die ohnehin erfasst sind.
2. **Programm-Match ohne `normKey`**: gemessen **null** Fehlschläge. Die
   Programm-Ids sind reine Zahl-Zeichenketten; die Abweichung zur sonstigen
   Konvention ist real, aber am Bestand folgenlos.
3. **Übererfassung — und die ist groß**: **alle 287** `statusTvVb`-Zeilen tragen
   eine Bedingung (276 einen Status-Vergleich wie `<59`, 230 eine
   „ohne-TV-Kürzel"-Liste, 9 eine „ohne-Verbund-Kürzel"-Liste); **keine einzige**
   ist bedingungsfrei. Gezählt wurde bisher „es gäbe eine Zeile", nicht „sie
   trüge". **63,2 % ist damit eine Obergrenze, keine Deckung.**

#### Empfehlung

**Ja zu zwei Quellen mit Herkunftskennzeichen — aber erst nach der
Bedingungsauswertung, und nicht in Phase 2/3.** In dieser Reihenfolge:

1. **Die drei Kürzel-Klärungen in die Fachabstimmung** (14.4 Punkte 1 und 2).
   Sie kosten nichts und machen die *eine* Quelle besser: `AB` und `XHSP`
   bekämen einen Code, `XPC+` seine Ebene. Dafür braucht es keinen zweiten
   Ableitungspfad.
2. **Bedingungen auswerten, bevor C16 ableitet.** Ohne sie wäre C16 als Quelle
   ein Rückschritt: die Zuarbeit sagt „dieses Kürzel setzt diesen Status", C16
   sagt „unter diesen Umständen" — und die Umstände wegzulassen produziert
   Aussagen, die im Einzelfall falsch sind. Das ist teurer als es klingt (der
   Parser hat die Bedingungen bereits strukturiert, die Auswertung gegen einen
   Vorgang fehlt).
3. **Dann** beide Quellen mit `herkunft: 'zuarbeit' | 'c16'` an jedem Übergang
   führen und die Konfidenz daran hängen. Der Befund „null Widersprüche" trägt
   diese Bauart — die Quellen konkurrieren nicht, sie ergänzen sich fast
   disjunkt. Pitfall #45 verbietet eine zweite **Handtabelle** neben derselben
   Aussage, nicht zwei benannte Quellen mit ausgewiesener Herkunft.

Für Phase 2 und 3 bleibt es bei der Zuarbeit. Das Band zeigt, was eine Quelle
hergibt; die Deckung ist eine Datenfrage und keine Bauform-Frage.
