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
| — | **Antwortrunde 1 eingefaltet** — Kuration neben Generat, zwei Frageklassen entschieden, 70 → 1 offene Frage | v3.29.0 → [Abschnitt 15](#15-antwortrunde-1-v329--v331) |
| — | **Haltedatum aus dem Verlauf** — dritte Quelle, 1 638 Vorhaben erstmals datiert | v3.30.0 → [15.4](#154-das-haltedatum-kommt-aus-dem-verlauf-v330) |
| — | **FristenBand** — Achse plus Herleitung, ersetzt die Liste aus Phase 2 | v3.31.0 → [15.7](#157-das-fristenband-v331) |

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

**Ein Evaluator, aber jeder Aufrufer schneidet seine Eingaben selbst.** `pruefeStillstand` ist rein — zwei Ansichten können ihm trotzdem Verschiedenes vorlegen und dann gegenteilig antworten. Welche Quelle die „letzte belegte Änderung" ist und warum der Nullpunkt es nicht sein darf: [§12.2](#122-der-nullpunkt).

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

- **`Prominenz` bleibt.** Sie steuert die Punktgröße in der Chronik und den
  `ignoriert`-Filter — Anzeige, keine Ableitung. Sie mitzureißen hätte
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
| **Globale Suche** | **nein** | Evidenz. Treffer außerhalb tragen „· außerhalb des Anzeigebereichs" und lassen sich öffnen. Sie hat seit v4.91 eine EIGENE Richtlinien-Auswahl (§10.3) — anderer Speicher, anderer Grundzustand |
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

Die **Auswahl** ist dagegen persönlich und gerätelokal — sie geht niemanden sonst
etwas an. Vier Stufen, drei davon **listenlos und abgeleitet**:

| Stufe | Programme | Kurzwahl im Panel |
|---|---|---|
| `standard` | die gepflegte Liste, sonst `slice(-3)` | „Standard-Bereich" |
| `aktuell` | `slice(-1)` der Generationen (heute 136–139) | „Aktuelle Richtlinie" |
| `alle` | kein Filter | „Alle Richtlinien" |
| `auswahl` | die gespeicherte Liste | entsteht durch ein Häkchen |

`aktuell` verengt auf die **jüngste** Generation, für den häufigen Fall „nur das
laufende Jahrgangsgeschäft" — als eigene Stufe und nicht als vorgesetzte
Häkchen-Liste, weil eine gespeicherte Liste beim nächsten Richtlinien-Wechsel
still auf die alten Programme zeigte und der Chip sie „eigene Auswahl" nennen
müsste. Sie greift bewusst die **Code-Liste** ab, nicht die Katalog-Fassung:
welche Programme zum Arbeitsvorrat zählen, kuriert das Team; welche Richtlinie
die jüngste ist, ist eine Tatsache der Förderlandschaft. Grundzustand kann sie
nicht sein — eine Verengung, nach der niemand gefragt hat, ist kein Startwert.

Definition = Team-Kuration,
Auswahl = Person; getrennte Lebensdauern, getrennte Speicher. Ein Wechsel des
Standard-Bereichs bumpt den localStorage-Key deshalb **nicht**: `standard`
speichert bewusst keine Liste und greift den neuen Bereich von selbst ab, und wer
eine eigene Auswahl gesetzt hat, behält sie. Damit sie nicht still veraltet, sagt
das Panel, wovon sie abweicht („Ihre Auswahl weicht vom Standard-Bereich ab
(12 Programme, Richtlinien 2015 + 2020 + 2025)") — ein Klick auf
„Standard-Bereich" ist der Rückweg.

**Das Panel zeigt seine Liste vollständig.** Die drei Kurzwahlen stehen in einer
Zeile, die Programme in zwei Spalten mit den Generationen als Zellen — 620 px
breit, damit der längste Programmname nicht gekürzt wird, und ungescrollt,
solange der Platz reicht. Untereinander brauchte die volle Liste (16 Programme,
4 Überschriften) 440 px und lag damit unter jeder Popover-Kante; wer nachsieht,
ob eine Generation noch da ist, darf sie nicht suchen müssen. Der Deckel ist
kein fester Wert, sondern die von Radix gemessene Resthöhe
(`--radix-popover-content-available-height`): erst wenn die wirklich nicht
reicht, scrollt die Liste. An der Suche geht das Panel zusätzlich **unter dem
Ergebniskopf** auf — beim Öffnen einmal gemessen, nicht fest verdrahtet — damit
„94 Treffer in 2.537 von 14.225 Anträgen" sichtbar bleibt, während man umschaltet.

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

### 10.3 Die Suche wählt ihre Richtlinien selbst

Die Suche folgt dem Bereich nicht — sie hat seit v4.91 einen **eigenen**
Richtlinien-Chip über der Trefferliste
([richtlinienWahl.ts](../../src/plugins/suche/richtlinienWahl.ts)). Der Anlass
war praktisch: wer die Trefferliste liest, will die stillgelegten Altprogramme
loswerden, ohne sie damit auch aus der Suche zu verlieren, wenn er sie einmal
braucht.

**Drei Unterschiede, und alle drei sind Absicht:**

| | Betrachtungsbereich | Richtlinien der Suche |
|---|---|---|
| schneidet | Arbeitsvorrat (Listen, Zähler, Fristen, Auslastung) | die Trefferliste |
| Grundzustand | Standard-Bereich (letzte 3 Richtlinien) | **alle** — die Suche nimmt nichts stillschweigend weg |
| Speicher | `teamflow_betrachtungsbereich_v1` | `teamflow_suche_richtlinien_v1` |

Ein gemeinsamer Speicher könnte nicht zwei Grundzustände haben, und ein
Bereichswechsel auf den Förderanträgen würde die Suche mitverstellen, ohne dass
jemand danach gefragt hätte. **Geteilt werden Mechanik und Bedienung**
([bereichsStore](../../src/core/hooks/bereichsStore.ts), `BereichAuswahlChip`,
`BereichPanel`), nicht der Zustand; der Chip-Präfix trennt die beiden im Wortlaut
(„Anzeige: …" gegen „Treffer: …"), damit „Treffer: alle Richtlinien" nicht neben
der Zeilenmarke „außerhalb des Anzeigebereichs" steht und ihr zu widersprechen
scheint.

Das Prinzip aus Pitfall #46 gilt unverändert, nur an einem zweiten Ort: der
Filter sitzt im **Konsumenten** (`SuchSeite`), nie im Suchkorpus — der
Konventionstest führt `useSuchRichtlinien` deshalb in derselben Verbotsliste wie
`useBereich`. Und **keine heruntergezählte Zahl ohne Anzeige**: der Chip steht
auch ohne Anfrage, weil schon die Zahlen des Startzustands („Additive Fertigung ·
531 Treffer") auf die Auswahl heruntergezählt sind. Gemessen an „laser": 485
Treffer bei „alle", 429 im Standard-Bereich, und der Chip beziffert die Differenz
mit „· 56 ausgeblendet". Die Umkehrung gilt seit v4.102 genauso: bei einer
getippten, noch nicht gestellten Frage steht keine Zahl auf dem Blatt — dort
entfällt der Chip, statt eine Auswahl zu erklären, die noch nichts gefiltert hat.

**Ohne Programm-Nummer bleibt ein Treffer stehen.** Ein Dokument ohne
verknüpften Antrag trägt keine Richtlinie; es wegzuwerfen hieße, eine
Zugehörigkeit zu behaupten, die niemand kennt — dieselbe Regel, nach der die
Marke „außerhalb des Anzeigebereichs" nur an Treffern MIT Code hängt.

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

**Die Anzeige mischt zwei Nummernkreise — die Bedienung darf es nicht** (v4.121).
Ein Regelsatz-Reiter zeigt die eigenen Regeln UND die vorgangsweit greifenden
Sperren, aber `reihenfolge` ist je Satz vergeben: `verschiebeTodoRegel`
nummeriert nur innerhalb des eigenen. Nach `reihenfolge` allein sortiert landete
eine neue FB-Regel (die erste ihres Satzes, also 10) mitten zwischen den
AB-Sperren 10…40, und Nummer, „Position 5 von 27" und die Pfeile rechneten mit
dem Index der ANGEZEIGTEN Liste — beide Pfeile aktiv, ein Klick ohne Wirkung.
`sichtbareRegeln` stellt fremde Sperren deshalb **vorn** hin (dort laufen sie
auch: der Sperr-Pass ist ein Vollscan vor dem Treffer-Pass), und
`kaskadenPositionen` gibt nur den eigenen Regeln eine Stelle; eine fremde Sperre
trägt keine. Die Zahl am Reiter zählt, was er zeigt.

### 11.2 Abgeleitete Platzhalter — der Weg ohne Umschaltpunkt

Liefert der Regelsatz einer Rolle keinen Treffer, hat aber die für eine andere
Rolle greifende Regel ein `wartetAuf` auf sie, entsteht ein **abgeleitetes**
Ergebnis: derselbe To-do-Text, `quelle: 'abgeleitet'`, Herkunft in
`abgeleitetAus`. Im Board trägt es den Marker „abgeleitet" — dasselbe Wort wie
`quelle`, der Tooltip und die Rollen-Bilanz (bis v4.46.1 stand am Eintrag
„geliehen", während die Bilanz daneben „davon N abgeleitet" zählte).

Drei Regeln halten es ehrlich: ein echter Treffer schlägt den Platzhalter immer;
er läuft durch den Sperr-Filter der eigenen Rolle (sonst würde ein für sie
geschlossener Fall wiederbelebt); und er trägt `regelId: null`, weil die Rolle
eben keine eigene Regel hat.

Damit ersetzt **jede geschriebene FB-Regel genau einen Platzhalter** — schrittweise,
ohne Stichtag, an dem etwas „umgestellt" wird.

**Zwei Leihwege seit v4.132.** `wartetAuf` war nicht der einzige Fall: eine Regel
kann eine Rolle auch ausdrücklich als **zuständig** nennen. Drei tun das (R7
„Stellungnahme RNE prüfen", R12 „Widerspruch gg Abl bearbeiten", R22 „NL prüfen"
— alle mit `fb` im `zustaendig`), und keine davon kam in der FB-Sicht an:
`trefferLauf` überspringt jede Regel eines fremden Regelsatzes, und der
Platzhalter fragte nur `wartetAuf`. Der FB bekam ein **leeres** Board, obwohl der
AB-Regelsatz ihn namentlich nennt. Die drei Bedingungen treffen auf 40 / 24 / 176
offene Vorgänge (Bestand vom 20.08.2026).

Deshalb leiht `ermittleTodosAlleRollen` jetzt auf zwei Wegen, in dieser
Reihenfolge: **zuständig vor wartetAuf** — „du bist mit dran" ist die stärkere
Aussage als „auf dich wird gewartet". Beide heißen an der Anzeige „abgeleitet"
(ein Wort, keine zweite Zählung); welcher Weg es war, steht in `abgeleitetArt`
und im Tooltip. Die AB-Sicht ist unverändert: gefüllt wird nur, wo eine Rolle
sonst nichts hätte.

**Wo auch kein Leihweg greift, liest die ANZEIGE den AB-Satz (v4.136).** Beide
Wege setzen voraus, dass eine fremde Regel die eigene Rolle **nennt**. Die
Mehrzahl tut das nicht: R19 („in QS") wartet auf die QS, R21 („GA schreiben")
ist die AB zuständig. Für den FB blieb die Engine dort stumm — richtig, denn er
hat nichts zu tun —, und die Anzeige fiel auf die Status-Formel zurück und
verlangte eine Handlung, die es nicht gab. Die Engine bleibt deshalb, wie sie
ist; die Faltung `baueAufgabe` liest den AB-Satz und markiert das über
`Aufgabe.gelesenAls` ([status-achsen.md](status-achsen.md#schweigt-der-eigene-satz-wird-der-ab-satz-gelesen-v4136)).
Der Unterschied ist wichtig: ein **Platzhalter** ist eine geliehene Aufgabe für
mich, eine **fremde Aufgabe** ist eine Auskunft über jemand anderen. Sie zählt
in keiner Rollen-Bilanz mit.

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

## 11b. Wirkungslose Regeln haben einen Namen (v4.95)

Der Messlauf „Wirkung am Bestand" stand seit v2.396 hinter einem Knopf und
lieferte je Regel zwei Zahlen. Was er **nicht** lieferte, war das Urteil: eine
Regel mit „trifft 21 · gewinnt 0" las sich wie jede andere Teilverdeckung, war
aber etwas anderes — sie steht in der Kaskade, ohne je etwas zu bestimmen.

Die Bilanzzeile am Kopf der Liste nennt diese Regeln jetzt **namentlich**
([todoRegelnAnsicht.ts](../../src/plugins/status-cockpit/todoRegelnAnsicht.ts),
`wirkungsloseRegeln` / `wirkungsBilanzText`). Drei Gründe, drei verschiedene
Fehler:

| Grund | Was daran falsch ist |
|---|---|
| `trifft nie` | Die Bedingung beschreibt etwas anderes als gemeint — oder der Fall ist ausgestorben. |
| `immer verdeckt` | Die Bedingung stimmt, die **Kaskaden-Position** ist falsch. |
| `greift nie` | Dasselbe für eine Sperre; dort ist `greift` die Aussage, nicht `gewinnt`. |

**Stillgelegte Regeln bleiben draußen** — sie tun erwartungsgemäß nichts;
mitgezählt wäre die Bilanz eine Anzeige des eigenen `aktiv`-Hakens. Dieselbe
Regel wie bei den Datumsfeldern je Verfahrensschritt (v4.92): gezählt wird nur,
was tatsächlich ausgewertet wird.

**Der Befund vom 18.08.2026** (12.359 Vorgänge, Richtlinien 2015 + 2020 + 2025,
Regelsatz AB): zwei der 30 Regeln bleiben ohne Wirkung — `R10`
(Nachlieferungstermin verstrichen) trifft auf keinen Vorgang zu, `R23b`
(PreCheck Verbund offen) trifft auf 21 und gewinnt bei keinem. Beide gehören auf
die Tagesordnung des Fachtermins, nicht in den nächsten Messlauf.

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

**Der Nullpunkt ist keine Änderungsmeldung** (v3.43.2). Das Journal liefert zwei
Daten, die beide `string | null` heißen und beide nach „Journal" klingen:

| | Aussage | Reichweite |
|---|---|---|
| `journalAb` | „ab hier sprechen wir überhaupt" | EINE Zahl für den ganzen Bestand |
| `letzteAenderung` | „hier hat sich zuletzt belegt etwas bewegt" | je Antrag, `null` = nichts belegt |

Nur die zweite beantwortet die Frage des Stillstands-Wächters. Von v3.31 bis
v3.43.1 bekam er im Ausklappbereich die erste: damit galt jede Zeile als seit dem
Baseline-Tag aktiv, `belegt` sprang auf `true`, und aus einer Näherung wurde
scheinbar eine Messung. Am Bestand gemessen meldeten **1 056 von 1 057** hängenden
Vorgängen „läuft" — der Wächter war dort praktisch abgeschaltet, während das
Board dieselbe reine Funktion mit der richtigen Quelle fütterte und weiter „hängt
fest" sagte. Zwei Ansichten, ein Evaluator, gegenteilige Aussage; aufgefallen ist
es an genau einem Antrag, dem man beides nebeneinander ansah.

Zwei Lehren, beide über den Einzelfall hinaus:

1. **Gleicher Typ ist keine gleiche Bedeutung.** `string | null` gegen
   `string | null` prüft kein Compiler. Wo zwei Werte dieselbe Form und
   verwandte Namen tragen, hält sie nur ein Guard auseinander —
   `kein-nullpunkt-als-letzte-aenderung`.
2. **Eine Chronik gehört einem Teilvorhaben.** `useZeilenVerlauf` gibt ihre
   letzte Änderung nur heraus, wenn die Zeile genau dieses eine TV trägt; bei
   einem Mehr-TV-Verbund wäre sie die Beobachtung eines Nachbarn. Dieselbe
   Grenze, an der schon die Verlaufsableitung haltmacht (`journalGenutzt`).
   Sonst `null` — und die Näherung sagt ehrlich „seit mindestens".

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

Bearbeiter-Kürzel werden **nicht** journalisiert, und **keine Zeile einer
Journal-Ansicht nennt einen Handelnden**. Mit Personenbezug plus Datumsverlauf
entstünde ein Aktivitätsprotokoll — Leistungs- und Verhaltenskontrolle,
mitbestimmungspflichtig. `JOURNAL_AUSGESCHLOSSEN` nennt die Spalten ausdrücklich
(obwohl die `D_`-Regel sie ohnehin nicht erfasst), damit die Entscheidung
nachlesbar bleibt; ein Konventionstest hält sie.

**Der app-weite Bearbeiter-Ausschnitt ist davon nicht betroffen** (v4.134). Das
Nachtlauf-Widget wählt über `useBearbeiterSicht` aus, an WELCHEN Vorgängen es
Änderungen zeigt — dieselbe Sicht wie „Meine Anträge", das Kanban und die Liste,
umschaltbar über den Chip im Seitenkopf und in der Kopfzeile der Karte benannt.
Das ist eine Aussage über **Anträge**, keine über Personen: die gezeigten
Änderungen können von AB, QS oder Juristen stammen, und das Journal weiß ohnehin
nicht, wer sie gemacht hat. Ohne den Ausschnitt standen dort 400 Zeilen, von denen
7 den Leser angingen (gemessen 20.08.2026) — eine Ansicht, die niemand liest, ist
keine Datensparsamkeit. Verboten bleibt, was die Regel meint: eine Gruppierung
nach Kürzel und jede Zeile, die einen Handelnden benennt.

Seit v6.1 lässt sich der Ausschnitt der Karte **widget-lokal** auf „immer meine"
bzw. „immer alle" stellen. Das braucht das eigene Kürzel — es kommt über
`useBearbeiterSicht().eigenerModus`, **nie** über `useMeinKuerzel` im Widget: die
Reißleine oben scannt `NachtlaufWidget.tsx` und `nachtlaufGruppen.ts` namentlich
darauf. Die Einstellung übersteuert nur den Chip; ein Ausschnitt aus einer Frage
und eine per Anmeldung festgezurrte Identität bleiben stärker, und die Kopfzeile
beschriftet immer den **effektiven** Modus.

### 12.6a Ein Lauf oder ein Zeitfenster (v6.1)

Für die Frage „was ist über Nacht passiert" gibt es zwei Leser, und sie
unterscheiden sich in genau einem Punkt:

- `letzterNachtLauf` zeigt **den letzten Lauf** und fällt bis zu zwei
  Monatsdateien zurück, wenn der jüngste Export nichts brachte. Das ist kein
  Randfall: von neun verarbeiteten Stempeln trugen vier keinen einzigen Eintrag
  (gemessen 20.08.2026). Welcher Lauf gezeigt wird, sagt die Karte dazu.
- `nachtLaeufeSeit(idb, tage, heute)` zeigt **ein Zeitfenster** über mehrere
  Exporte und fällt **nicht** zurück. Ein Fenster macht eine Zusage über einen
  Zeitraum; heimlich davor zu greifen bräche sie. Ein leeres Fenster ist hier ein
  gültiges Ergebnis, das benannt wird. `tage` zählt einschließlich heute, das
  Fenster wird auf den Nullpunkt geklemmt ([§12.2](#122-der-nullpunkt)).

Beide liefern `null`, wenn (noch) kein Journal geführt wird — eine andere Aussage
als „nichts gefunden" ([§12.3](#123-fünf-aussagen-nicht-eine)).

### 12.6b Vom Spaltennamen zum Klartext (v6.2)

Das Journal führt die **rohe** Exportspalte (`D_AB`, `STATUS_VB`). Wer daraus
eine Bezeichnung macht, geht über
[journalSpalten.ts](../../src/plugins/antraege/status/journalSpalten.ts) — vier
Wege in dieser Reihenfolge (kanonische Status-Spalte, `feldId`, Kürzel-`code`,
app-weiter Spalten-Alias), dann `kuerzelAuskunft(code, form)` mit
`ueberlagereKuration` darüber. Zwei Gründe, beide gemessen: drei von 260
journalfähigen Spalten sind kanonisch angebunden und haben deshalb **bewusst**
keinen eigenen Katalog-Eintrag; und 58 von 509 Codes bedeuten je Projektform
etwas anderes. Detail + Zahlen: [home-widgets.md](home-widgets.md).

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

### 12.9 Die Historie am Verbund (v4.13)

Die vierte Journal-Ansicht — und die einzige, die mehrere Anträge auf einmal
zeigt: die Sektion **„Historie"** auf der Antrags-Detailseite faltet die Chroniken
aller Teilvorhaben eines Verbundes
([VerbundHistorie.tsx](../../src/plugins/antraege/VerbundHistorie.tsx)).

Sie las bis v4.12 den IDB-Store `verbund_historie` und konnte deshalb **nie etwas
zeigen**: der Store wird nur befüllt, wenn im CSV-Mapping eine auf
`verbund_titel`/`verbund_status` gemappte Spalte `trackHistory: true` trägt — der
Wizard setzt `false`, das Auto-Adopt neuer Spalten ebenfalls, und die einzigen
`true`-Fälle liegen in Dev-Fixtures auf *Antrags*-Feldern, die den Verbund-Zweig
des Mergers gar nicht erreichen. Auf jedem Antrag stand also „Noch keine
Verbund-Änderungen erfasst", während der Nachtlauf seit Wochen mitschrieb. Der
Store und der Merger bleiben unangetastet; geändert hat sich nur, woher die
Sektion liest.

- **Ein Lesevorgang je Verbund, nicht je Teilvorhaben.** `chronikFuerAntraege`
  ([lesen.ts](../../src/core/status/journal/lesen.ts)) liest Stand und
  Monatsdateien **einmal** und verteilt die Einträge auf die angefragten Anträge.
  `chronikFuerAntrag` je TV läse `stand.json` (mehrere MB, **nicht** gecacht —
  nur die Monate sind es) bei einem Achter-Verbund achtmal. Dieselbe Überlegung
  wie bei `letzteAenderungJeAntrag`.
- **Der Nullpunkt steht dabei**, wie in jeder Journal-Anzeige ([§12.2](#122-der-nullpunkt)).
- **„Nicht geführt" und „nichts geändert" bleiben getrennt** — der Verbund kann
  außerhalb des Bereichs liegen, für den mitgeschrieben wird ([§12.4](#124-der-bereich-gilt-hier-auch-für-evidenz)).
- **Keine Kontext-Vorschau im Sektionskopf.** Sie käme vom Share, der Body ist
  eingeklappt aber nicht gemountet — die Zeile bliebe leer, bis jemand aufklappt,
  und läse sich wie ein Fehler.
- Wortlaut und Zahlenform teilt sie mit dem Verlauf am Teilvorhaben
  ([journalTexte.ts](../../src/plugins/antraege/status/journalTexte.ts)): zwei
  Ansichten desselben Journals, die dieselbe Änderung verschieden benennen, lesen
  sich wie zwei Sachverhalte. Beide Dateien stehen in der `ANSICHTEN`-Liste des
  Guards aus [§12.6](#126-keine-personen-achse).

### 12.10 Die Chronik liest mit (v4.58)

Die **fünfte** Journal-Ansicht — und die einzige, die das Journal nicht als
Änderungsliste zeigt, sondern **zurück auf die Zeitachse** legt: die Chronik nach
Datum stellt jeden Termin, den ein früherer Export trug und der heutige nicht
mehr, durchgestrichen an seinen alten Tag
([chronik-zurueckgenommen.ts](../../src/core/status/chronik-zurueckgenommen.ts)).

Das war die letzte Stelle, an der `geleert` — laut [§12.3](#123-fünf-aussagen-nicht-eine)
„die interessanteste" Aussage — praktisch unsichtbar blieb. Die Historie-Sektion
zeigte sie, aber als `D_ART` in einer alphabetischen Feldliste; wer den Verlauf
las, sah eine Lücke und keinen Hinweis darauf, dass dort einmal etwas stand.

- **`geleert` und `geaendert` sind dieselbe Klasse.** Beide bedeuten „dieses
  Datum zeigt der Export nicht mehr". Am Bestand ist die zweite die häufigere.
- **Der Status bleibt außen vor.** `STATUS_TV`/`STATUS_VB` stehen im Journal,
  sind aber keine Termine — sie fallen über `typ !== 'datum'` von selbst heraus
  (Pitfall #44).
- **Gefaltet wie ein Termin.** Das Journal wird je Antrag geführt, die Chronik
  zeigt je Feld × Tag; ein Verbund-Code stünde sonst so oft da, wie der Verbund
  Teilvorhaben hat.
- **Ein Ladepfad für die ganze Seite** ([useJournalChroniken.ts](../../src/plugins/antraege/status/useJournalChroniken.ts)):
  `stand.json` ist bewusst nicht gecacht und wiegt über 5 MB; drei Effekte auf
  einer Detailseite wären drei Vollzugriffe über SMB. Entwertet wird über
  `lastLoadedAt` des Antrags-Stores — derselbe Datenstand, an dem schon
  `useVerbundDetailData` hängt.
- **Der Ausklapp lädt jetzt auch auf Verbund-Zeilen.** Bis v4.57 rief
  `useZeilenVerlauf` bei `aktenzeichen === null` gar nichts ab. Die Ein-TV-Regel
  für `journalAenderung` bleibt davon unberührt — sie entscheidet, was
  weitergereicht wird, nicht, was geladen wird ([§12.2](#122-der-nullpunkt)).
- **Gelesen wird bis zum Stichtag, nicht bis zum Bezugszeitpunkt.** Vorher ging
  das Haltedatum als `heuteIso` in `chronikFuerAntrag`; ein Altfall mit
  Haltedatum 2018 lud damit keine einzige Monatsdatei. Das war eine Verwechslung
  von Achsenende und Uhr, kein Entwurf.

Der Wortlaut des Nullpunkts liegt seit v4.58 als `nullpunktText` in
`journalTexte.ts` und gilt für Chronik **und** Historie-Sektion — drei
unterschiedene Fassungen (kein Journal · nicht geführt · belegt ab), keine stille
Leere.

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

Knopf „Am Bestand messen" im Reiter *Kürzel* der Vorgangs-Regeln
([BestandslaufBlock.tsx](../../src/plugins/status-cockpit/BestandslaufBlock.tsx));
die Zahlen unten stehen dort unter „Zahlen im Detail"
([VerlaufBefundeBlock.tsx](../../src/plugins/status-cockpit/VerlaufBefundeBlock.tsx)),
darüber der Befund in Sätzen
([bestandslaufBefund.ts](../../src/plugins/status-cockpit/bestandslaufBefund.ts)).
Gemessen über **12 356 Teilvorhaben in 6 614 Vorhaben** (Richtlinien 2015 + 2020
+ 2025, 12 Programme), Laufzeit 6,2–7,8 s.

Die Spalte „Zuarbeit" ist der Stand v3.19–v3.22 (41 Regeln, Schlüssel Kürzel ×
Projektform), die Spalte „C16" der heutige (v3.23, Trigger-Tabelle je Richtlinie
mit ausgewerteten Bedingungen — 14.7). Der Quellenwechsel ist die einzige
Änderung dazwischen; die Codepfade darunter sind dieselben.

| | Zuarbeit (v3.22) | **C16 (v3.23)** |
|---|---:|---:|
| Teilvorhaben mit Verlauf | 10 640 (86,1 %) | 7 229 (58,5 %) |
| ohne erklärten Statuswechsel | 1 652 | 5 063 |
| ohne Bearbeitungsstand (Irrläufer) | 64 | 64 |
| **Verbünde mit abgeleitetem Statuswechsel** | 1 388 (21,0 %) | **4 163 (62,9 %)** |
| Verbünde mit Terminen auf der Bahn (Obermenge) | 6 015 | 6 240 |
| gesetzte Termine | 490 153 | 500 984 |
| davon mit belegtem Statuswechsel | 29 602 (6,0 %) | **72 345 (14,4 %)** |
| … davon Bedingung erfüllt / nicht prüfbar | — | 35 053 / 37 292 |
| Segmente · davon Dauer unsicher | 45 616 · 31 135 (68,3 %) | **75 682 · 17 678 (23,4 %)** |
| Abschnitte mit **zwei** Grenzen (messbar) | 16 200 (35,5 %) | **62 396 (82,4 %)** |
| mehrdeutig (gleichtägig) | 1 150 | 5 809 |
| umbenannte Kürzel im Bestand | 1 277 | 1 277 (`MVA→ÄA` 989, `LBN→LBNx` 288) |
| längste Spur | 87 Übergänge, 4 Segmente | 87 Übergänge, **16** Segmente |

**Die TV-Zahl fällt und ist trotzdem die bessere.** 86,1 % kamen zustande, weil
die Zuarbeit für fast jedes TV-Kürzel *irgendeinen* Zielstatus führte — auch
ohne Bedingungsprüfung. C16 prüft, und 3 193 Übergänge (4,2 % der geprüften)
scheitern an einer Vorbedingung, die zum Zeitpunkt des Kürzels nachweislich
nicht trug. Was übrigbleibt, ist belegt statt behauptet.

**Für Phase 3 ist die vorletzte Zeile die wichtige.** v3.20 schloss: „die
dauerskalierte Bahn bleibt die Grundform — sie misst kein Rauschen, sie hat für
zwei Drittel der Abschnitte nur keine Achse." Jetzt haben **82,4 %** eine.

**Warum die Dauer unsicher ist.** Die vier Auslöser sind disjunkt und summieren
sich exakt auf `segmenteUnsicher`; ein Test hält das fest. Die Aufteilung stammt
aus v3.20 und gilt unverändert — nur die Grundgesamtheit ist geschrumpft:

| Auslöser | v3.22 (von 31 135) | **v3.23 (von 17 678)** |
|---|---:|---:|
| Anfang unbekannt (kein belegter Wechsel bzw. nachgeschobener Status) | 18 130 (58,2 %) | 10 383 (58,7 %) |
| Ende offen (Abweichungsfall) | 11 286 (36,2 %) | 2 903 (16,4 %) |
| Datum unlesbar | 0 | 0 |
| **gemessen ≤ 1 Tag** | 1 719 (5,5 %) | **4 392 (24,8 %)** |

**Nur der letzte Fall misst Verweildauer.** Eine offene Grenze heißt „wir wissen
nicht, wann es anfing" — das ist keine kurze Dauer. Gemessene Ein-Tages-
Abschnitte sind auch jetzt nur **5,8 %** aller 75 682 Abschnitte; ihre Zahl
steigt, weil die Kette länger wurde, ihr Anteil bleibt klein.

Die 62 396 Abschnitte mit zwei Grenzen (82,4 %) tragen eine Verteilung mit
echter Spreizung: **Median 26 T**, p25 7 T, p75 86 T, p90 421 T; **45,9 % länger
als 30 Tage**. Keine negative Dauer im Bestand. Termine verteilen sich auf
**1,77 je Tag und Vorhaben** (465 551 gesetzte Felder auf 263 761 verschiedene
Tage) — die Tagesgranularität ist also nicht bloß Vorsicht, sondern nötig.

⇒ **Für Phase 3**: die dauerskalierte Statusbahn ist die Grundform, und sie hat
jetzt für vier Fünftel der Abschnitte eine Achse. Die übrigen brauchen eine
eigene Darstellung (angeschnittene Kante „vor dem ersten Beleg" bzw. „läuft
weiter"), keine Ersatzbreite.

Drei Aussagen daraus:

- **`kein_kuerzel` bleibt der Normalfall** — 85,6 % der Termine (vorher 94 %).
  Ein Band zeigt überwiegend Termine ohne bekannten Statuswechsel; es trägt,
  aber schmal.
- **Die Verbundspur war die schwache Stelle und ist es nicht mehr**: 21,0 % →
  62,9 %. Der Grund war nie der Code, sondern die Quelle — von den 41
  Zuarbeit-Regeln berührten fünf den Verbund, jede für **genau eine**
  Projektform.
- **Die Projektform ist nicht mehr der Hebel.** Sie war es, solange die Regel an
  ihr hing. C16 schlüsselt nach Richtlinie; FuE springt damit von 0 auf 2 320
  Verbünde, DS von 0 auf 851. Was an der Projektform hängen bleibt, ist die
  **Bezeichnung** — und dort ist die Lücke offen (14.7).

### 14.4 Offene Punkte für die Fachabstimmung

Mit dem Quellenwechsel (14.7) und der Fachabstimmung im August 2026 sind die
Punkte **1 bis 5 erledigt**; offen bleibt allein Punkt 6 (DS). Sie bleiben
stehen, weil Code, Commits und ältere Notizen sie nummeriert referenzieren.

**Quellenbewertung, einmal festgehalten.** C16 ist ein Export aus dem laufenden
Fachsystem und damit dessen tatsächliche Konfiguration — eine Beobachtung des
Systems, nicht über das System. Jannes Zuarbeit ist die private Ableitung einer
AB für ein Excel-Dashboard: erklärtermaßen unvollständig und nur für NW, weil
diese Person NW bearbeitet hat. Als **Regelquelle** entfällt sie ganz (nicht
nachrangig, sondern weg); wo sie über C16 hinausgeht, ist sie unbelegt. Für
**Bezeichnungen, Rollen, Kategorien, Scope und Glossargliederung** bleibt sie
unverändert gültig — dort hat sie keine Konkurrenz und wird nicht angefasst.
Damit ist auch die Deckungstabelle aus 14.3 vollständig erklärt: dass alle
abgeleiteten Verbund-Statuswechsel aus NW kamen, war kein Systemfehler. **Die
FuE-Lücke war keine.**

1. ~~`XPC+`/`XPC?`/`XPC-`: TV- oder Verbund-Wirkung?~~ — **erledigt, kein
   Klärfall.** Die Ebene entscheidet das X-Präfix: X heißt Verbundebene, und das
   Fachsystem verbietet die Mischung in beide Richtungen. Die Bedingung
   entscheidet C16, das `XPC+` als Verbundstatus ohne TV-Bezug führt; die
   Aggregationsbedingung (*„wenn alle TV PC+ haben"*) stammt aus dem
   Excel-Dashboard einer einzelnen Bearbeiterin und ist unbelegt. Damit ist der
   letzte Widerspruch zwischen den Quellen aufgelöst, und
   `klaerfaelleAusQuellen` (14.7) behält **keinen** offenen Fall übrig.
2. ~~Zwei Zielstatus lösen nicht auf~~ — **erledigt, und zwar doppelt belegt**.
   C16 führt Zahlen statt Wortlaute: `AB` → 51 *bewilligungsreif* (der Tippfehler
   „bewilligungseif" ist damit gelesen), `XHSP` → 50 *Bewilligungsentwurf
   VDI/VDE-IT*. Beide Auflösungen sind inzwischen **fachlich bestätigt** und
   decken sich mit dem Export — zwei voneinander unabhängige Quellen sagen
   dasselbe. Das ist mehr als ein geschlossener Punkt: es ist der bislang
   einzige direkte Beleg für die **Güte des C16-Exports**, der sonst nur deshalb
   als Regelquelle gilt, weil er aus dem laufenden Fachsystem stammt. Im Bestand
   bleiben **16** Übergänge mit einem Zielcode, den der Statuskatalog nicht
   beschriftet — die stehen als Zahl da, nicht als Loch.

   Dass der Katalog die bestätigten Wortlaute auch **führt**, ist seit v3.24
   keine Annahme mehr: die Herkunft `bezeichnung-weicht-ab` der Klärfragen-
   Erhebung hält `FACHLICH_BESTAETIGT` gegen `StatusCodeEintrag.text` **und**
   gegen die geladene Fassung. Verglichen wird nur der amtliche Text, nie `kurz`
   (Pitfall #43). Heute: null Abweichungen — 50 und 51 stehen wortgleich.
3. ~~DL und EP haben gar keine Verbund-Regel~~ — **erledigt**. DL: 305 von 514
   Verbünden mit abgeleitetem VB-Statuswechsel. EP hat keine `vb_phase`-
   Zuordnung und wird aus den Daten nie als Projektform erreicht; das betrifft
   nur die Bezeichnung, nicht die Regel.

   **Einelementige Verbünde sind Modell, kein Fehler.** DL und EP sind im
   Fachsystem einzelunternehmerisch; die App modelliert sie **bewusst** als
   Verbünde mit einem Teilvorhaben, damit sie gleich gerendert werden — und auch
   das Fachsystem führt für beide eine Verbundansicht. Deshalb **kein
   Invariant-Guard** dagegen: er würde eine Absicht als Datenfehler melden.
4. ~~12 der 41 Regeln lassen die Ebene offen~~ — **entfällt**. C16 nennt TV- und
   Verbund-Status an festen Positionen; welches Feld gefüllt ist, **ist** die
   Wirkungsebene. `scope: null` und `VerlaufsUebergang.scopeUnbestimmt` gibt es
   nicht mehr.
5. **Die Marker-Werte kommen im Antragsbestand nicht vor.** `Sonderstatus`,
   `assoziierter Partner` und `internationaler Partner` stehen ausschließlich auf
   Roh-Exportzeilen **ohne** Förderkennzeichen (24 701 von 28 914 in
   `9052-prjbsp`) — sie sind keine Anträge. Der Spurzustand
   `kein_bearbeitungsstand` bleibt im Modell, greift heute aber nur bei
   *Irrläufer* (64 Fälle).
6. **Der Kürzelkatalog kennt DS nicht** — 0 von 143 im Bestand vorkommenden
   Codes haben einen DS-Eintrag. Die App zeigt dort eine geliehene Bezeichnung;
   bei 53 Codes widersprechen die Formen einander. Braucht eine Quelle, die es
   noch nicht gibt (14.7).

   **Warum die Lücke existiert, ist geklärt** — nur nicht, wer sie schließt:
   Durchführbarkeitsstudien kamen mit der **Richtlinie 2020** hinzu, die Zuarbeit
   ist älter und kennt die Projektform schlicht nicht. Die fehlenden
   Katalogeinträge sind daraus vollständig erklärt; es ist keine Auslassung,
   sondern ein Altersunterschied. Der **einzige verbliebene offene Punkt**, und
   er steht als Klärfrage im Export (Herkunft `ds-ohne-quelle`, 14.8).

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

**Nachtrag v3.23**: die fachliche Klärung hat Punkt 3 überholt, bevor er
gebaut wurde. Zwei Quellen mit Herkunftskennzeichen braucht es nicht — die
Zuarbeit ist gar keine gleichrangige Quelle, sondern die Notiz einer einzelnen
Bearbeiterin. Punkt 1 und 2 sind umgesetzt (14.7).

### 14.6 Wo der Verlauf ankommt (v3.21)

Ein Bereich, der unter einer Tabellenzeile aufgeht
([ausklapp/](../../src/plugins/antraege/ausklapp/)) — der erste Renderer der
Spuren. **Nur in der Tabellen-Ansicht**; Karten und Liste haben keine Zellen,
und eine zweite Bedienlogik für dieselbe Sache wäre keine.

**Die Zeile hat keine einheitliche Klickbedeutung mehr.** FKZ und Akronym
navigieren, Status- und Frist-Zelle klappen auf, alles andere tut nichts. Zwei
Navigationsziele statt einem: die Akronym-Spalte lässt sich ausblenden, die
FKZ-Spalte nicht (`locked`) — mit nur einem Ziel ließe sich die Tabelle über den
Spalten-Picker versehentlich in einen Zustand ohne Ausweg bringen. Die Zonen
sind `role="button"`/`role="link"` mit eigener Tastaturbehandlung, keine
`<button>`: die Status-Zelle enthält bereits das Info-Icon als Button, und
verschachtelte Buttons sind ungültig.

**Der Bereich rechnet nichts nach.** Der Verlaufs-Reiter zeigt `baueVerlauf`,
der Frist-Reiter ruft dieselbe `berechneFrist` wie die Zelle — nur mit der
tieferen Eingabe, die die schlanke Listen-Projektion nicht hat (`D_XTE` aus dem
Schema, Haltedatum über `ermittleHaltedatum`). Genau darauf verweist der
Modulkopf von [fristAnzeige.ts](../../src/plugins/antraege/fristAnzeige.ts) seit
v3.6; `ermittleHaltedatum` bekommt hier seinen ersten Produktions-Aufrufer.

Drei Regeln, die den Rest tragen:

- **Es gibt einen Einstieg, nicht zwei.**
  [verlauf/fuer-vorgang.ts](../../src/core/status/verlauf/fuer-vorgang.ts) nimmt
  den Bezug und gibt Spuren zurück; wie die Regeln indiziert werden, sehen die
  Aufrufer nicht. Bis v3.22 hielt die Fassade die Regeln der Zuarbeit selbst
  (und ersparte damit eine zweite Guard-Ausnahme) — seit dem Quellenwechsel
  reicht der Aufrufer die geladene C16-Tabelle herein.
- **Das Journal hängt am Antrag, die Spuren am Verbund.** `chronikFuerAntrag`
  wird nur bei einem Ein-TV-Vorhaben in die Ableitung gegeben — die Chronik eines
  Teilvorhabens auf die Spuren seiner Nachbarn anzuwenden hieße, Beobachtungen zu
  behaupten. Der Nullpunkt steht trotzdem immer da (12.2).
- **Höchstens eine Zeile offen, nichts persistiert.** Der Bereich schließt bei
  jedem Wechsel von Sortierung, Spaltenfilter, Gruppierung, Körnung, Sicht und
  Betrachtungsbereich: er hängt am Zeilenschlüssel, nicht an einer
  Bildschirmposition, und stünde sonst unter einem fremden Vorgang.

Die „Verlaufs-Näherung (max. 5)" ist aus dem Herleitungs-Popover verschwunden —
fünf von durchschnittlich 33 Terminen waren ein Ausschnitt ohne Auswahlregel. An
ihrer Stelle steht „Ganzen Verlauf zeigen", das denselben Bereich öffnet. Die
Engine rechnet den Verlauf weiter; der kopierte Text ist ein Protokoll und
behält ihn.

### 14.7 C16 wird alleinige Regelquelle (v3.23)

Fünf fachlich geklärte Punkte haben die Bewertung der Quellen gedreht:

1. **Die 41 Regeln der Zuarbeit sind kein Regelwerk.** Eine einzelne Bearbeiterin
   hat sie für ihr eigenes Excel-Dashboard aufgestellt; sie sind erklärtermaßen
   unvollständig und decken NW, weil diese Person NW bearbeitet hat. Für
   Fachbearbeiter existiert nichts Vergleichbares.
2. **C16 ist der Export aus dem laufenden Fachsystem** — die tatsächliche
   Konfiguration, keine Beobachtung.
3. **DS kam mit der Richtlinie 2020.** Die Zuarbeit kennt die Projektform nicht.
4. **EP und DL sind bewusst einelementige Verbünde**, damit sie in der App gleich
   gerendert werden; auch das Fachsystem führt für beide eine Verbundansicht.
   Kein Invariant-Guard dagegen.
5. **Alle 287 statussetzenden C16-Zeilen sind bedingt.** Für ein Fachsystem
   erwartbar — die Bedingungsauswertung ist der Kern der Regelbasis, nicht ihre
   Verfeinerung.

Damit erklärt sich die Deckungstabelle aus 14.5 vollständig: dass alle
abgeleiteten Verbund-Statuswechsel aus NW kamen, war kein Systemmangel. **Die
FuE-Lücke war keine.**

#### Die DS-Lücke — gemessen, bevor etwas umgestellt wurde

Der Kürzelkatalog hat den Schlüssel Kürzel × Projektform und führt vier Formen
(`NW` 437, `FuE` 450, `DL` 267, `EP` 196 von 608 Einträgen). **DS: null.** Die
Erwartung war zu falsifizieren und ließ sich nicht falsifizieren.

Im Bestand (851 DS-Verbünde, 143 verschiedene Kürzel, 24 430 Vorkommen):

| | Codes | Vorkommen |
|---|---:|---:|
| im Katalog geführt | 140 / 143 | — |
| davon **mit eigenem DS-Eintrag** | **0** | — |
| geliehen, alle Formen einig (harmlos) | 87 | 17 987 (73,6 %) |
| **geliehen und strittig** | **53** | **6 436 (26,3 %)** |
| gar nicht im Katalog | 3 | 7 |

**Was die App heute zeigt**, ist kein leerer Klartext und kein Rohkürzel, sondern
ein **Fallback auf eine fremde Projektform**: `kuerzelAuskunft` nimmt ohne
passende Form die erste geführte ([kuerzel-katalog.ts](../../src/core/status/kuerzel-katalog.ts),
Stufe 3). Bei 87 Codes ist das folgenlos, bei 53 nicht — dort widersprechen die
Formen einander, und `eindeutig: false` ist die einzige Warnung.

Die 53 zerfallen weiter, und das relativiert die Zahl: **28 streiten schon
zwischen NW und FuE** (2 137 Vorkommen) — das ist keine DS-Frage, sondern eine
allgemeine; 9 weichen nur in DL ab (3 369); 16 sonstige (930). Meist sind es
Wortlaut-Varianten (`AK4`: *„kaufmännisch erledigt"* gegen *„kaufmännisch
fertig"*), gelegentlich echte Bedeutungsunterschiede (`DMB`: *„Anzahl der
de-minimis-Bescheinigungen"* gegen *„Bescheinigung an ZE versandt"*). Der
kuratierte `strittig`-Marker deckt davon **1 von 53** — das Problem ist bisher
nicht markiert.

**Nur DS ist strukturell betroffen**: FuE hat für 185 von 198 Codes eine eigene
Form und **null** strittige Anleihen, NW 188 von 197 und ebenfalls null. DL hat
116 von 136 und sechs Anleihen (die `VOB*`-Familie). *Irrläufer* stehen wie DS da.

⇒ **Klärfall für Phase 2b.** Die Auflösung braucht eine Quelle, die es nicht gibt
— ein DS-Kürzelblatt oder die Bestätigung, dass DS die FuE-Bedeutungen erbt.

#### Was der Wechsel kostet — fast nichts

Der Klärfall-Abgleich ([klaerfaelle.ts](../../src/core/status/verlauf/klaerfaelle.ts))
stellt alle 41 Zuarbeit-Regeln mit Zielstatus gegen die 2 447 C16-Zeilen (über
**alle** Richtlinien, weil die Schlüssel sich nicht decken). Übrig bleiben
**drei**: `XPC+`, `XPC-`, `XPC?` für FuE. Alle drei sind derselbe Fall — die
Zuarbeit behauptet TV-Wirkung, C16 führt einen Verbund-Status. Das ist 14.4
Punkt 1 und der **einzige** verbliebene Widerspruch.

Erhalten statt gelöscht: die Regeln tragen jetzt `quelle: 'zuarbeit'` neben dem
unveränderten `aktiv: false`. Der Guard `trigger-regeln-nur-im-verlauf` bleibt
scharf und läuft ins Leere — genau richtig.

**Richtlinie 2015 verliert ihre einzige Regelquelle.** C16 führt neun Programme
(76–79, 131, 136–139), nicht 46/47/48. Das eine Paar, das nur die Zuarbeit kannte
(`ABB`/NW in Programm 46, 552 Verbünde), fällt damit weg. Die Spur sagt das
ausdrücklich: *„Die Trigger-Tabelle führt für diese Richtlinie keine Regeln"* —
nicht „kein Übergang erklärt diesen Status". Eine Aussage über die Datenlage
gehört nicht als Aussage über den Vorgang gelesen.

#### Bedingungen: ein Auswerter, zwei Blickrichtungen

Den Auswerter gab es schon. Der Nächster-Schritt-Navigator prüft C16-
Vorbedingungen seit v2.386 dreiwertig (`erfuellt`/`verletzt`/`unpruefbar`); für
Phase 2a ist er nach [trigger-bedingung.ts](../../src/core/status/trigger-bedingung.ts)
herausgehoben worden. Ein zweiter wäre der Fehler, den Pitfall #41 für die
`Bedingung`-Bäume schon einmal benennt. Beweis, dass es derselbe ist: die
bestehende `navigator.test.ts` blieb **ohne Änderung** grün.

Verschieden ist nur, womit man ihn füttert:

| | Navigator (vorwärts) | Verlauf (rückwärts) |
|---|---|---|
| Frage | „welches Kürzel dürfte **jetzt** gesetzt werden?" | „hat die Regel gegriffen, **als** es gesetzt wurde?" |
| gesetzte Kürzel | heutiger Stand | Stand **am Tag** des Übergangs |
| Status | aktueller Wert | laufender Status des Vorwärtslaufs |

**Der Vorwärtslauf** ([uebergaenge.ts](../../src/core/status/verlauf/uebergaenge.ts))
geht die Chronik chronologisch durch und führt beides mit. Der Status startet
`null` — vor dem ersten Beleg weiß niemand, worauf der Vorgang stand — und
übernimmt danach, was die letzte greifende Regel gesetzt hat. Am Kettenanfang ist
die Status-Bedingung deshalb `unpruefbar`, **nie erfunden**.

Beide Richtungen sind nötig, und das ist keine Feinheit: gegen den heutigen Stand
geprüft verletzte jeder bewilligte Vorgang rückwirkend seine eigene Eingangsregel
(`AAE` fordert „kein ABB", und ABB steht am Ende jedes bewilligten Vorgangs).

**Was nicht auswertbar ist, bekommt ein eigenes Urteil.** Ein Übergang mit
unprüfbarer Bedingung setzt seinen Status trotzdem — der Termin steht in den
Daten, das Kürzel WURDE gesetzt —, aber mit `konfidenz: 'trigger_bedingt'` statt
`trigger_bestaetigt`. Ihm den Wechsel abzusprechen wäre eine Behauptung über die
Vergangenheit; ihn als bestätigt zu führen die andere.

Am Bestand (75 538 geprüfte Übergänge):

| Urteil | | |
|---|---:|---:|
| erfüllt | 35 053 | 46,4 % |
| **verletzt** (setzt keinen Status) | **3 193** | **4,2 %** |
| nicht prüfbar | 37 292 | 49,4 % |

#### Deckung: die Obergrenze war fast die Deckung

| Projektform | Verbünde | Obergrenze (14.5) | **gemessen** |
|---|---:|---:|---:|
| FuE | 3 841 | 2 320 | **2 320** |
| NW | 1 374 | 687 | **687** |
| DS | 851 | 851 | **851** |
| DL | 514 | 305 | **305** |
| Irrläufer | 34 | 20 | **0** |
| **gesamt** | **6 614** | **4 183 (63,2 %)** | **4 163 (62,9 %)** |

**Die Differenz ist 20 Verbünde, und sie liegt vollständig bei den Irrläufern** —
deren Statuswert ist ein Marker ohne Bearbeitungsstand, sie bekommen also keine
Bahn (14.4 Punkt 5). Die Obergrenze hat sie mitgezählt, weil sie nur fragte, ob
es eine Zeile gäbe. **Bedingungen kosten Deckung: null.**

Was sie kosten, ist Sicherheit, und das ist der ehrlichere Preis: 981 der 4 163
Verbünde (23,6 %) tragen auf ihrer Verbundbahn **keinen einzigen** bestätigten
Übergang, nur bedingte — DS 375, FuE 567, NW 35, DL 4.

#### Setzebene und Wirkungsebene

Zwei Felder, nie eines:

- **Setzebene** = das X-Präfix. `ebeneVonCode` friert es beim Katalogbau in
  `StatusFeldEintrag.ebene` ein; zur Laufzeit liest niemand mehr das Präfix.
- **Wirkungsebene** = welches von `statusTv`/`statusVb` die C16-Zeile füllt.
  `ABB` trägt kein X, wird am Teilvorhaben gesetzt und kippt trotzdem den
  Verbund.

Die Invariante `X ⟺ ebene: 'verbund'` kann deshalb nur durch **Kuration**
brechen. Gemessen: **0 Konflikte** über alle 505 Code-Felder der laufenden
Fassung 19. Der Guard ist ein Regressionsgatter, kein Fundbüro — und er ist
zweigeteilt: der Seed (unsere Daten) bricht den Build über den Convention-Test
`status-ebene-folgt-x-praefix`, eine kuratierte Fassung meldet sich zur Laufzeit
laut ([snapshot.ts](../../src/core/status/snapshot.ts)). Ein Wurf beim Aktivieren
nähme dem Team die ganze App statt ihm den Datenfehler zu zeigen — dieselbe
Abwägung, die [programmNummer.ts](../../src/plugins/antraege/status/programmNummer.ts)
schon einmal getroffen hat.

#### Nicht geschrieben

Auf den Share ging nichts. Die Regelbasis IST C16, und C16 wird ausschließlich
gelesen ([trigger-share.ts](../../src/core/status/trigger-share.ts)); geschrieben
wird sie nur vom XLSX-Import im Cockpit. Der STOPP vor einem Regelbasis-Write
hatte damit keinen Anlass.

### 14.8 Klärfragen als Arbeitsmappe (v3.26)

Die Befunde aus 14.7 waren **Handmessungen ohne Code-Heimat**: 851 DS-Verbünde,
53 strittige Codes, 6 436 Vorkommen — einmal in einer Konsolensitzung gezählt,
in diese Datei geschrieben, danach unreproduzierbar und mit jedem Nacht-Export
veraltend. Seit v3.26 leitet die App sie bei jedem Lauf neu ab
([klaerfragen/](../../src/core/status/klaerfragen/)) und gibt sie als
Arbeitsmappe heraus.

**Das ist NICHT das Modul „Zu klären"** ([klaerung.md](klaerung.md), Pitfall #49).
Dort ein Fragebogen: feste Punkte, das Team antwortet in der App, die Antworten
liegen je Autor auf dem Share. Hier eine Ableitung: der Code rechnet aus, was
offen ist, und gibt es als Datei heraus — kein Rückweg, keine Zustandsverwaltung,
kein Schreibpfad. Die Antworten kommen zunächst außerhalb der App zurück.

#### Neun Herkünfte, sechs davon besetzt

Gemessen am 07.08.2026 (Bestand vom 05.08., 14 222 Vorgänge, ganzer Bestand ohne
Betrachtungsbereich, Durchlauf ~6 s): **70 Klärfragen**.

| Herkunft | Fälle | Adressat |
|---|---:|---|
| Bedeutung widersprüchlich (NW/FuE) | 29 | Fachbereich (Kürzelkatalog) |
| Bedeutung geliehen (DS) | 25 | Fachbereich (Kürzelkatalog) |
| Amtlicher Text kleingeschrieben | 12 | Fachbereich (Parametertabelle) |
| Statuswert fehlt in der Fassung | 2 | Kuration (PL) |
| Marker „strittig" | 1 | Fachbereich (Kürzelkatalog) |
| DS ohne Kürzel-Quelle | 1 | Fachbereich / Leitung |
| Statuswert ohne amtlichen Code · Kurzlabel fehlt · Bezeichnung weicht ab | 0 | — |

**Stand 19.08.2026 (Fassung 25, 14 225 Vorgänge, Durchlauf ~4 s): noch EINE
Frage** — `ds-ohne-quelle`. Die Tabelle darüber ist damit der Ausgangsstand, nicht
der heutige: die beiden Bedeutungs-Herkünfte gehen leer aus, seit jedes uneinige
Kürzel eine FuE-Form führt, aus der die Sammelregel für DS schöpft; die
kleingeschriebenen Texte und der `strittig`-Marker sind als **Frageklasse**
entschieden ([typen.ts](../../src/core/status/klaerfragen/typen.ts),
`STILLGELEGTE_HERKUENFTE`); und die beiden fehlenden Statuswerte führt die
Fassung inzwischen. Übrig bleibt die eine Frage, für die es keine Quelle gibt.

**Was der Lauf NICHT fragt, steht dabei** (v4.121) — und zwar in Fragen
gerechnet, nicht in ihren Anlässen. Bis dahin meldete die Kopfzeile „243 ruhende
Kürzel ausgelassen" über einer Liste mit einer einzigen Frage; unterdrückt war
keine. `klaerfragenAuslassungen` misst die Differenz zweier Läufe (mit und ohne
Ruhe-Filter) und den Rückstand hinter der Kurzlabel-Spitze; beides steht auch im
Kopf der Datei, weil die ohne den Bildschirm gelesen wird.

**Eine Id, eine Zeile.** Die Frage-Id ist normalisiert, die Schleife über
`rohStatus` war es nicht: zwei Schreibweisen desselben Wertes erzeugten zwei
Zeilen mit **derselben ID** — und über die werden die Antworten zurückgeordnet.
`buendleRohwerte` fasst sie vorher zusammen und addiert ihr Gewicht; die
häufigste Schreibweise vertritt den Wert in der Spalte „Betrifft".

**Gefragt wird nur, wo eine Antwort etwas ändert.** Ein Kürzel, dessen Bedeutung
zwischen NW und FuE auseinandergeht, ist unschön — aber solange beide Formen
einen eigenen Eintrag haben, zeigt die App jedem Vorgang die richtige. Falsch
wird die Anzeige erst, wo **geliehen** wird, und das ist im Bestand DS. Aus
demselben Grund entfallen Codes ohne Vorkommen: 93/94 („assoziierter/
internationaler Partner") stehen laut 14.4 Punkt 5 nur auf Roh-Exportzeilen ohne
Förderkennzeichen, und 14 kleingeschriebene Katalogtexte werden dadurch zu 12.

**Drei Nullen sind Ergebnisse, keine Lücken.** *Kurzlabel fehlt* ist leer, weil
die Kuration aus v3.16 abgeschlossen ist — die unabhängige Bilanz des
Statuswerte-Reiters sagt „alle 26 Statuscodes tragen eine Kurzform".
*Bezeichnung weicht ab* ist leer, weil Katalog und Fassung die bestätigten
Wortlaute 50/51 wortgleich führen (14.4 Punkt 2). *Ohne amtlichen Code* ist leer,
weil der einzige Kandidat eine Stufe früher greift:

#### Die drei Wert-Herkünfte sind geordnet, nicht nebeneinander

Vom Grundsätzlichen zum Kosmetischen — kennt die Fassung den Wert überhaupt →
lässt er sich einem Code zuordnen → trägt er eine Kurzform. **Der erste Treffer
gewinnt.** Sonst läge derselbe Rohwert in mehreren Töpfen und würde in einer nach
Vorkommen sortierten Liste mehrfach gewogen.

Der Realfall ist `VN gegrüft` (5 Vorgänge, Tippfehler zu `VN geprüft`): erwartet
worden war er als „Wert ohne Code" — er landet aber eine Stufe höher, weil die
Fassung ihn gar nicht führt. Damit die Frage dort ihren Tippfehler-Hinweis nicht
verliert, schlägt auch diese Herkunft die nächstliegenden bekannten Wortlaute
vor. Die Ähnlichkeit **sortiert nur die Auswahlliste**; eingestuft wird nichts —
das bleibt die Antwortspalte. Der zweite Fall ist
`Stellungnahme zur Rücknahmeempfehlung` (16 Vorgänge).

#### Warum die Datei einen Nachschritt braucht

Von dem, was eine herumgereichte Datei braucht, schreibt der gebündelte
XLSX-Writer (SheetJS Community) nur Autofilter, Spaltenbreiten und mehrere
Blätter. Fixierte Kopfzeile, Zeilenumbruch, Zellfüllung, entsperrte Zellen und
Datenvalidierung kann er nicht — `dataValidations` ist dort ein leerer
Kommentar, `sheetView` wird ohne `<pane>` geschrieben, die Stiltabelle ist auf
einen Eintrag festverdrahtet. Ohne entsperrte Zellen wäre Blattschutz sogar
schädlich: er sperrte die Antwortspalte mit.

[arbeitsmappe-veredelung.ts](../../src/core/status/export/arbeitsmappe-veredelung.ts)
öffnet deshalb das erzeugte ZIP (`jszip` liegt ohnehin im Bündel — eine zweite
Bibliothek wäre der teurere Weg zum selben Ergebnis), ersetzt `xl/styles.xml` und
ergänzt das Blatt-XML. Zwei Feinheiten, die man einmal falsch macht:
`sheetProtection` verbietet Sortieren und Filtern per **Vorgabe**, beides muss
ausdrücklich freigegeben werden — sonst ist der Autofilter darüber tot; und
`<dataValidations>` hat im Schema eine feste Position, hinter dem falschen
Nachbarn öffnet Excel die Datei nicht mehr.

**Die Formatannahme wird geprüft, nicht gehofft.** Passt die erzeugte
Stiltabelle nicht auf die erwartete Gestalt, bricht der Export mit einem Satz ab.
Eine Formatierung, die still ausfällt, merkt niemand — außer daran, dass der
Kontext abgeschnitten ist und geraten wird. Der Test packt das Archiv wieder aus
und liest das XML; der letzte Beweis bleibt ein Doppelklick in Excel.

### 14.9 Das VerlaufsBand (v3.27)

Seit 14.3 liegt die Bahn als Daten vor — je Spur lückenlose Segmente mit Dauer,
82,4 % davon zweiseitig verankert. Gezeichnet wurde sie nicht; der Reiter zeigte
eine Aufzählung, ausdrücklich als Sicherheitsnetz, solange die Bauform offen war.
Seit v3.27 zeichnet [VerlaufsBand](../../src/plugins/antraege/verlauf-band/VerlaufsBand.tsx)
sie, und die Liste ist eine Stufe tiefer gerückt: ein Klick auf eine Bahn klappt
genau diese Spur im Klartext auf. **Sie wurde nicht ersetzt, sondern geteilt** —
eine Grafik kann Zahlen unterschlagen, ein Listeneintrag nicht.

#### Eine gewarpte Achse, die für alle Spuren gilt

Die Bahn will zwei Dinge gleichzeitig, die einander widersprechen: Segmentbreite
= Verweildauer (sonst ist sie ein Ablaufdiagramm) und eine gemeinsame Achse über
Verbund und alle Teilvorhaben (sonst lässt sich nichts vergleichen). Ein Wechsel
am Folgetag wäre 0,2 px breit, ein Abschnitt über sieben Jahre frisst den Rest.

[bandGeometrie.ts](../../src/plugins/antraege/verlauf-band/bandGeometrie.ts) löst
das über **eine Kantenliste aus den Segmentgrenzen sämtlicher Spuren**. Jedes
Intervall dazwischen bekommt seine Breite proportional zur Dauer, aber mindestens
24 px; der Überschuss wird den breiten Intervallen **anteilig an ihrem Überhang**
abgezogen, nicht an ihrer Gesamtbreite — sonst rutschten knapp über dem
Mindestmaß liegende in der nächsten Runde darunter. Weil dieselbe Kantenliste
jede Spur abbildet, sitzt derselbe Tag überall an derselben x-Position. Das ist
die eine Zusage, die den Vergleich trägt, und sie steht als Test.

**Die Stauchung wird markiert.** Eine nicht-lineare Achse, die so tut als wäre
sie linear, lügt über Verhältnisse: stark gestauchte Intervalle tragen ein
Bruchzeichen. Die Schwelle liegt bei einem Achtel der proportionalen Breite —
darüber ist die Verzerrung mild und eine Marke wäre Rauschen. Die Bahn darf über
ihren Container hinauswachsen und scrollt dann in ihrem **eigenen** Behälter;
lieber scrollen als Abschnitte unter die Klickgrenze drücken.

**Der Boden wächst mit der Bahn** (`bodenFuer`, v3.38). Bis v3.37 waren es feste
24 px — eine Zahl aus der Zeit, als die Bahn 620 px breit war. Sie klebte auch
bei 1000 px, und im Bestand war zu sehen, was das heißt: sechs Abschnitte
drängten sich auf ~130 px, während ein einziger ~700 bekam. Jedes Intervall
bekommt jetzt einen **Anteil** der verfügbaren Breite, gedeckelt nach beiden
Seiten (24 … 56 px): bei sechs Grenzen auf 1000 px sind es 56, bei
sechsundzwanzig fällt er auf 24 zurück. Gemessen am selben Verbund trug danach
**kein** Abschnitt mehr nur seine Legendennummer — und die Legende hörte von
selbst auf zu nummerieren.

**Ein Boden ist kein Deckel.** Er hebt nur an, was proportional darunter läge;
ein kurzer Abschnitt neben einem langen behält seinen Anteil. Genau das rettet
die Aussage „Breite = Dauer" — und es ist der Grund, warum der Boden auch
gedeckelt ist: höher gesetzt nähme er den langen Intervallen so viel, dass die
Achse nur noch aus Bruchzeichen bestünde. Wo er bei 24 landet, macht Breite die
kürzesten Abschnitte weiterhin nicht beschriftbar; dafür gibt es die zweite Etage
weiter unten.

#### Der Ausklappbereich nimmt die sichtbare Tabellenbreite (v3.32)

Bis v3.31 war die Bahn auf 620 px festgenagelt, in einem Bereich von ~772 px,
während die Tabelle ~1300 px zeigte. Drei Deckel lagen übereinander, und der
unterste war der `max-content`-Kasten der `colSpan`-Zelle: darin ist `w-full`
ein Zirkelbezug, die Breite kam also vom Inhalt, nicht vom Platz.

Jetzt misst [SortableTable](../../src/components/data-table/SortableTable.tsx)
den Scrollport ohnehin (für die Überschuss-Verteilung) und reicht die Zahl an
[TableBody](../../src/components/data-table/TableBody.tsx) durch; der klebende
Wrapper bekommt **`width: min(100%, port)`**. `100 %` löst gegen die
`colSpan`-Zelle auf — unter `table-layout: fixed` steht deren Breite vor dem
Inhalt fest, es gibt keinen Zirkelschluss — und `min()` deckelt auf das, was man
wirklich sieht. Ist die Tabelle **gepinnt schmaler** als der Port, gewinnt
`100 %`: dort gibt es nichts zu scrollen. Ohne Messung bleibt `max-content`, also
das Verhalten bis v3.31.

Der Deckel gegen unlesbar lange Zeilen ist damit **umgezogen**: er sitzt jetzt am
Vorgangsverlauf-Reiter ([AusklappInhalt](../../src/plugins/antraege/ausklapp/AusklappInhalt.tsx)),
wo Fließtext steht, nicht mehr am ganzen Bereich. Die Bahn ist eine Grafik und
will jeden Pixel; ein Absatz über 1200 px will das Gegenteil.

Die Bahn selbst misst ihren eigenen Behälter
([useElementBreite](../../src/core/hooks/useElementBreite.ts), eine
Implementierung für die App statt bisher zwei privater Kopien). Gemessen wird
**synchron vor** dem `ResizeObserver` — sonst blitzt ein Rahmen lang das feste
Maß auf, und in einer nicht gezeichneten Umgebung (verborgenes Pane) käme nie
etwas an. Eine 0-Breite bleibt `null` und fällt auf den Prop zurück, statt die
Zeichnung zu zerquetschen.

#### Konfidenz sitzt an den Kanten

Vier Stufen, vier Aussagen, kein stiller Fallback:

| Stufe | Kante | heißt |
|---|---|---|
| `trigger_bestaetigt` | durchgezogen, 2 px | Regel greift, Vorbedingung am Tag des Kürzels erfüllt |
| `trigger_bedingt` | gestrichelt, 2 px | Regel greift, Vorbedingung nicht prüfbar oder verletzt |
| `zeitliche_naehe` | gepunktet, 2 px | Kürzel passt zeitlich, keine Regel deckt es |
| `kein_kuerzel` | Haarstrich, halbdurchsichtig | kein bekannter Statuswechsel |

**Nie am Statusfeld.** Der Status ist beobachtete Tatsache — er steht so im
Export. Unsicher ist die Zuschreibung: ob ein Kürzel den Wechsel ausgelöst hat.
Ein Segment einzufärben, weil sein Übergang unsicher ist, verwechselte beides.
Die Stufe `trigger_bedingt` ist dabei kein Randfall: 981 Verbünde (23,6 %) tragen
ausschließlich bedingte Übergänge.

**Ein Tag, eine Kante** ([bandKanten.ts](../../src/plugins/antraege/verlauf-band/bandKanten.ts),
v3.37). Bis v3.36 zeichnete die Bahn je *Übergang* einen Strich. Weil mehrere
Kürzel auf denselben Tag fallen, lagen sie exakt übereinander — gemessen an
einem Verbund **51 Striche auf 26 Tagen**, an einer Grenze bis zu drei. Sichtbar
war der zuletzt gezeichnete. Der Stil kommt jetzt vom **best belegten** Übergang
des Tages: belegt ein Kürzel den Wechsel, ist die Grenze erklärt, auch wenn
daneben ein unerklärtes steht. Verschwiegen wird nichts — der Tooltip zählt jedes
Kürzel des Tages einzeln auf, die Klartext-Liste ohnehin.

**Der Strich trägt den satten Akzent des Abschnitts, der hier beginnt** (v3.38).
Damit ist er zweierlei in einem Element: Träger der Konfidenz *und* sichtbare
Segmentgrenze. Beides braucht er, seit die Flächen getönt sind — ihr
Farbunterschied allein trennt zu schwach. Zwei verworfene Vorgänger stehen hier,
damit sie nicht wiederkommen: eine **Schrift**farbe trug nur im hellen Modus (im
dunklen sind Balken UND Schrift hell, gemessen #cccac4 auf rgb(142,168,204) ≈
1,3:1); die **Hintergrund**farbe (v3.36–v3.37) war der richtige Schnitt durch
eine *satte* Fläche, auf einer getönten aber Hintergrund auf Fast-Hintergrund.
Am Bestand gemessen: je Bahn genau so viele Streifen wie Segmentgrenzen, keine
zwei auf derselben Koordinate.

`kein_kuerzel` trug bis v3.36 statt eines Strichs ein **Handsymbol**: 9 px,
Tertiärfarbe, auf einem gesättigten Balken, und es deckte den Strich zu, der an
derselben Stelle schon stand. Rückgefragt wurde nach dem „mini Pfeil" — niemand
konnte es lesen. Mit 92,7 % ist die Stufe ohnehin der Normalfall; ein
Sondersymbol für den Normalfall stellt die Rampe auf den Kopf.

#### Zwei leere Zustände, zwei Sätze

Eine Bahn ohne Verlauf schweigt nie. `regelLage` (neu an `VerlaufsSpur`) trennt
die beiden Fälle, die vorher nur als Fließtext in `begruendung` unterscheidbar
waren:

- **„für diese Richtlinie keine Regeln"** — Richtlinie 2015 (Programme 46–48),
  die C16 nicht führt; 552 NW-Verbünde. Die Bahn zeigt trotzdem das
  Statussegment, über die volle Breite mit **zwei angeschnittenen Kanten**:
  Status bekannt, Zeitraum nicht.
- **„kein Bearbeitungsstand"** — Irrläufer (64 Fälle). Gar kein Segment, weil der
  Statuswert kein Bearbeitungsstand ist.

Ein Segment ohne datierte Grenzen fiel dabei zunächst auf einen 1-px-Strich
zusammen (die Achse hatte keine Ausdehnung). Ein Strich ist die schlechteste
aller Aussagen — die Achse bekommt jetzt einen synthetischen Tag Ausdehnung, und
das Segment spannt sichtbar über die volle Breite.

#### Die Kürzel stehen über der Bahn (v3.38, Widerruf)

Bis v3.37 galt „keine Codes in der Bahn": `AK4` sei eine Vokabel, die nur die
Hälfte des Teams kenne. Dagegen steht, dass das Kürzel der **Griff zum Gespräch
mit C16** ist — wer nachfragt, nennt es. Die Etage über dem Balken stand ohnehin
leer, die Statusnamen bleiben unverändert dort, wo sie waren
(`statusLabel`/`statusKurzLabel`, Pitfall #50), und die Legende führt weiter die
vollen Bezeichner.

Gesetzt wird **gemessen**, mittig über der Kante, von links nach rechts:
**was kollidiert, entfällt** — ein gekürztes Kürzel wäre ein *anderes* Kürzel,
und eine Reihe überlappender Codes wäre schlechter als keiner. Fällt ein Tag mit
mehreren zusammen, steht das best belegte da und dahinter `+n`; alle nennt der
Tooltip der Kante. Am Bestand zeigen sich so acht von zehn möglichen, bei
schmalem Behälter sechs.

#### Vier Stufen, gemessen (v3.32)

Was an einem Abschnitt steht, entscheidet
[bandBeschriftung.ts](../../src/plugins/antraege/verlauf-band/bandBeschriftung.ts)
— rein und node-testbar, **Schwester** der Geometrie, nicht Teil von ihr: die
Geometrie ist im ersten Rahmen fertig, das Textmaß liegt frühestens vor, wenn die
Webschriften stehen. Zwei Fragen, zwei Rechnungen; die Geometrie wird dabei nicht
angefasst, und das steht als Test.

| Stufe | wann | wo |
|---|---|---|
| voller Bezeichner | er passt in den Balken | im Balken |
| Kurzform | nur sie passt | im Balken |
| voller Bezeichner, sonst Kurzform | keins passt hinein | **unter** dem Balken |
| Legendennummer | auch darunter kein Platz | im Balken |

**In derselben Etage stehen Dauer und Warnung** (v3.38). Passt der Name in den
Balken, ist die Etage darunter frei und nimmt die Dauer; passt er nicht, hängt
sie an ihn an („beantragt · 29 T"). Am Achsenende steht die Endmarke „hängt
fest", wenn der Stillstands-Wächter für **diese Zeile** anschlägt.

Vergeben wird in **drei Durchgängen, und die Reihenfolge ist die Rangfolge**:
erst die Warnung (der Grund, warum jemand hinsieht), dann die Namen (die
Auskunft, die er sucht), zuletzt die Dauern (die Zugabe). Andersherum verdrängte
Beiwerk das Wesentliche — eine Dauer bei x = 0 nähme einem Namen bei x = 40 den
Platz. Ein Test hält genau das fest.

**Eine unsichere Dauer trägt keine Zahl.** `dauerUnsicher` fasst vier Lagen
zusammen (Abschnitt 14.4), darunter die offene Grenze; ein „1 T" darunter wäre
eine Behauptung über etwas, das niemand kennt. Der Tooltip sagt dort weiter
„(unsicher)".

**Gemessen, nicht geraten.** Bis v3.31 entschied eine geratene Konstante
(46 px gegen `text-[10px]`). Jetzt liefert
[textMessung.ts](../../src/components/data-table/messung/textMessung.ts) die
Breite — dieselbe Canvas-Messung wie für die Spaltenbreiten, samt ihres
Generationszählers gegen die Webfont-Falle (wer vor `document.fonts.ready` misst,
bekommt die Metrik der Ersatzschrift und bleibt dabei). Fällt die Messung aus,
gilt Stufe 2 mit der alten Schwelle — **nie unter den Stand von v3.31**.

**Die zweite Etage ist der Kern.** Wo der Boden der Achse auf seinem Mindestmaß
liegt, macht Breite allein kurze Abschnitte nie beschriftbar. Unter dem Balken darf ihr Name
unter den Balken der *Nachbarn* hinweglaufen, ohne etwas zu verdecken — die
liegen eine Etage höher. Nur Unter-Beschriftungen konkurrieren miteinander, und
die prüft der Algorithmus von links nach rechts. Nur das **letzte** Segment (der
aktuelle Stand) rückt nach innen, wenn es sonst rechts hinausliefe — dann wandert
der Anker mit auf die andere Seite. Gegen eine bloße Kollision hilft das nicht:
Ausweichen führte das Label weit weg von seinem eigenen Abschnitt.

**Die Zuordnung ist dabei das eigentliche Risiko** — und der erste Entwurf ist
daran gescheitert: ein Name, der links an seinem schmalen Abschnitt beginnt und
weit nach rechts reicht, liegt unter FREMDEN Balken, und das Auge paart ihn mit
dem, was direkt darüber steht („warum steht unter *NF gestellt* der Text *keine
weiteren NF*?"). Ein 1-px-Strich in Rahmenfarbe, zwei Pixel unter dem Balken
schwebend, band an nichts. Er sitzt jetzt **bündig an der Unterkante** und trägt
**die Farbe seines Balkens**: so liest er sich als dessen Fortsetzung nach unten
statt als Linie irgendwo im Feld.

**Die Legende nummeriert nur bei Bedarf.** Bis v3.31 war es eine feste Schwelle
(ab sechs Einträgen), auch wenn jeder Balken seinen Namen trug — dann waren die
Ziffern Rauschen. Eine Nummer ist eine Brücke; ohne Abschnitt, der sie braucht,
führt sie nirgendwohin.

„Verlauf kopieren" ([bandText.ts](../../src/plugins/antraege/verlauf-band/bandText.ts))
gibt dagegen **Labels UND Codes** heraus, dazu Bestandsstand, Katalogfassung und
den Hinweis, dass die Bahn rekonstruiert ist. Dieser Text geht an die Fachseite,
und dort ist der Code das einzige, worüber sich eindeutig reden lässt. Ein
abgeleiteter Verlauf, den jemand als Beobachtung weitergibt, wird zur Behauptung.

#### Lesbarkeit statt Sparsamkeit (v3.37)

Die Bahn hatte nach v3.32 Platz, gab ihn aber nicht weiter. Fünf Nachzüge, alle
aus dem Gebrauch heraus:

- **Balken 20 statt 16 px, Beschriftung 11 statt 10.** Das Messprofil
  `bandLabel` zieht mit — eine gerenderte Größe, die die Messung nicht kennt,
  ist eine falsche Messung. Es gilt für **beide** Etagen; zwei Größen bräuchten
  zwei Profile, und die Beschriftungsschicht misst mit einem.
- **Die Spur-Beschriftung misst sich selbst** (Profil `bandSpur`, zwischen 128
  und 260 px statt fester 128). `16KN073848 (diese Zeile)` brauchte 137 px, und
  abgeschnitten wurde ausgerechnet der Zusatz, der die eigene Zeile benennt.
  **Der Zusatz bleibt**: im Ausklappbereich ist er das Einzige, was sagt, welche
  der Bahnen die geklickte Zeile ist. Auf der Verbund-Detailseite gibt es ihn
  nicht — dort ist keine Zeile geklickt, und die Beschriftung fällt von selbst
  auf ihr Mindestmaß zurück.
- **Die Legende steht direkt unter der Bahn**, gerahmt, mit der Farbmarke ihres
  Abschnitts; wo nummeriert wird, steht die Nummer **in** der Marke — genau das
  Bild, das im Balken steht. Vorher lag die Herkunftszeile dazwischen, und wer
  eine Nummer nachschlug, sprang über einen Satz hinweg, der nichts mit ihr zu
  tun hat.
- **Eine Fußzeile statt zweier**
  ([herkunftsText.ts](../../src/plugins/antraege/verlauf-band/herkunftsText.ts)):
  „Rekonstruiert aus den Datumsspalten · belegt ab …", die Begründung hinter dem
  Info-Zeichen. Vorher standen zwei Sätze über dieselben Datumsspalten
  untereinander, in zwei Formulierungen — beim zweiten Lesen überspringt man
  beide. Der `D_`-Vorbehalt geht dabei nicht verloren, er wandert nur; ein Test
  hält fest, dass er in **jeder** Journal-Lage hinter dem Zeichen steht
  (Abschnitt 12.2 verlangt ihn unter jeder Verlaufs-Anzeige). Weil der Fuß jetzt
  im Band selbst sitzt, kann ein neuer Aufrufer ihn auch nicht mehr vergessen.
- **Die Tooltips der Bahn tragen echte Zeilen.** Der Kasten des `Tooltip` steht
  auf `white-space: normal` — ein `\n` im `text`-Prop fällt zu einem Leerzeichen
  zusammen. Die Bahn nutzt deshalb `content` mit je einem Element pro Zeile.

#### Getönte Flächen — der Kontrast war messbar zu klein (v3.38)

Die Balken trugen den **satten** `--tf-kanban-*`-Akzent mit weißer Schrift.
Gerechnet über alle neun Kategorien:

| | hell | dunkel |
|---|---|---|
| Kontrast weiß gegen Füllung | 3,02 – 5,06 | 2,14 – 2,92 |
| unter 4,5 (AA, 11 px = kleine Schrift) | **6 von 9** | **9 von 9** |

Die Tokens sind Lane-Akzente für kleine Farbchips im Kanban-Kopf, nie für
Textuntergrund gedacht; im dunklen Modus sind es Pastelltöne (Helligkeit
58–70 %), und dort fiel **jede** Beschriftung durch. `segmentFuellung()` tönt den
Akzent jetzt zu 30 % auf `--tf-bg`, geschrieben wird in `--tf-text`. Am
gerenderten Element nachgemessen: **12,98 – 14,32:1 hell**, **4,99 – 5,18:1
dunkel**. Der Guard `band-fuellung-kontrast` rechnet das an den echten Werten aus
`theme.css` nach — mit einem zweiten Testfall, der festhält, dass er den alten
Entwurf verworfen hätte.

Der Preis ist real und gemessen: getönt rücken die Kategorien zusammen (`offen`
und `in Prüfung` liegen satt 37 RGB-Einheiten auseinander, getönt 11). Deshalb
überlebt der satte Ton am **Grenzstreifen** (siehe oben) und an der Farbmarke der
Legende — beides klein genug, dass Sättigung dort trägt.

Dazu vier Nachzüge am Bild: der Balken wird nur **außen** gerundet (innen
gerundete Segmente lasen sich als Kachelreihe statt als eine Zeitleiste), die
Jahreszahlen bekommen eine **Haarlinie** unter den Bahnen (sie schwebten über dem
Nichts; die Linie sitzt pixelgenau unter ihrer Beschriftung und fängt keine
Klicks), der **letzte Abschnitt** trägt `font-medium` plus einen Abschlussstreifen
am Achsenende („bis hier gemessen" — er entfällt bei offenem Ende, dort behauptete
er eine Grenze), und **ein Rahmen** fasst Achse, Bahnen, Legende und Fuß zusammen;
der eigene Rahmen der Legende wird dafür zur Trennlinie.

#### Der Bezugszeitpunkt — richtig verdrahtet, heute folgenlos

`baueVerlauf` verlangt seit v3.17 ausdrücklich `FristErgebnis.bezugsZeitpunkt`
(„bei entschiedenen Vorgängen das Entscheidungsdatum aus Phase 0, nicht heute");
alle drei Aufrufer reichten stattdessen den nackten Tagesstichtag durch. Als
Liste fiel das kaum auf, als Bahn verschluckt ein Schlusssegment über acht Jahre
die ganze Achse. [frist-bezug.ts](../../src/core/status/frist-bezug.ts) hält die
Rechnung jetzt an **einer** Stelle; Bahn, Liste und Bestandslauf lesen denselben
Ausdruck.

**Gemessen ändert das heute nichts** — die Erhebung liefert bit-identische
Zahlen. Der Grund steht in der Anzeige: „Haltedatum unbekannt — weder Journal
noch passendes Datumsfeld — nicht geraten". Das Import-Diff-Journal ist erst Tage
alt, und kein Datumsfeld hängt an der Phase eines Endstatus; also fällt der
Bezugszeitpunkt überall auf den Stichtag zurück. Die Verdrahtung greift, sobald
das Journal Statuswechsel belegt — dann stimmt die Achse ohne weiteres Zutun.

**`frist-bezug` steht bewusst NICHT im Barrel** `@/core/status`. Dort exportiert
zog es die Frist-Engine aus `core/services/csv` in jeden Barrel-Import und
verschob die Modul-Auswertung vor `idb.open()` — 20 `IDBStore not opened` beim
Seitenstart. Aufrufer importieren das Modul direkt, wie `vorkommen.ts` es für
seine Nachbarn ohnehin verlangt.

> **Nachtrag v3.30**: der Absatz oben beschreibt den Stand von v3.28 — „heute
> folgenlos, weil kein Haltedatum belegt ist". Genau diese Lücke schließt
> [§15.4](#154-das-haltedatum-kommt-aus-dem-verlauf-v330): die Verlaufsableitung
> ist selbst die dritte Quelle geworden, und 1 638 Vorhaben haben seitdem einen
> Bezugszeitpunkt vor dem Stichtag.

---

## 15. Antwortrunde 1 (v3.29 – v3.31)

Die erste Klärrunde ging als Arbeitsmappe hinaus ([§14.8](#148-klärfragen-als-arbeitsmappe-v326))
und kam beantwortet zurück: **70 Fragen, 69 beantwortet**, ausgefüllt vom
Fachbereich (Spalte „Name": AnMa, 07.08.2026). Dieser Abschnitt hält fest, was
daraus wurde und was offen blieb — mit Zahlen und Belegen, damit ein
Wiedereinstieg ohne Chatverlauf auskommt.

### 15.1 Gemessen statt übernommen

Die Zahlen der Vorlage stimmten nicht ganz. Gemessen an der zurückgekommenen
Mappe:

| Herkunft | Vorlage sagte | gemessen |
|---|---|---|
| `bedeutung-nw-fue` | 30 | **29** — davon 23 „ein Wortlaut gewählt", 6 „beide gelten" |
| `bedeutung-ds-anleihe` | 23 | **25** — davon **17** wortgleich mit FuE, 8 abweichend |
| `amtlicher-text-klein` | 14 | **12** |
| `strittig-marker` | unbeantwortet | **unbeantwortet** (Antwortspalte leer) |
| `wert-nicht-in-fassung` | 2 | 2 |

Nach der Übernahme bleibt am Bestand vom 05.08.2026 (14 222 Vorgänge) **eine**
Klärfrage übrig: `ds-ohne-quelle`. Für Durchführbarkeitsstudien gibt es weiterhin
keine Kürzel-Quelle; die Antwort darauf war eine Regel, kein Katalog.

### 15.2 Wo die Antworten leben

In [kuerzel-kuration.ts](../../src/core/status/kuerzel-kuration.ts), **neben**
dem Generat, nicht darin: `kuerzel-katalog.data.ts` entsteht aus
`npm run gen:kuerzel-katalog` und wird von der nächsten Zuarbeit überschrieben.
Dasselbe Muster wie `seed-codes.ts` neben `seed-codes.data.ts` (Pitfall #43).

Vier Listen, weil sie vier verschiedene Dinge sagen — 23 Vereinheitlichungen,
6 bestätigte Divergenzen, 8 DS-Wortlaute, 5 Quellkorrekturen. Jeder Eintrag
trägt einen Beleg mit Runde, Name, Datum und der **Frage-Id**; zwei Drift-Gatter
im Test halten die Kuration regenerationsfest (jeder übernommene Wortlaut und
jede Korrektur muss wortgleich in der Zuarbeit stehen, sonst greift sie ins
Leere).

**Kein Reimport der Mappe.** Die Antworten sind eine Release-Entscheidung, kein
Laufzeit-Zustand — dieselbe Trennlinie wie in [klaerung.md](klaerung.md)
(Pitfall #49: kein Rückschreiben in Seed oder Fassung).

### 15.3 Die Sammelregel ist kein Alias

Die Antwort auf `ds-ohne-quelle` lautet: „Die Kürzel für DS sind die gleichen wie
für FuE. Keine eigene Quelle nötig." Umgesetzt ist das als **Auflösungs­reihenfolge**
in `kuerzelAuskunft`, nicht als 130 kopierte Einträge:

1. vereinheitlicht (ein Wortlaut für alle Formen) →
2. die Form selbst, wo der Katalog sie führt →
3. **DS mit eigener Antwort** (`ds-kuratiert`) →
4. DS ohne eigene Antwort: FuE (`ds-aus-fue`, als abgeleitet gekennzeichnet) →
5. geliehen (erstgeführte Form, `eindeutig: false`).

Ein pauschaler Alias als Dateneintrag würde Stufe 3 überschreiben, sobald ihn
jemand scharf schaltet; als Reihenfolge kann er das strukturell nicht.
`formen.DS` entsteht nie, `projektformLage(5)` bleibt `zuarbeit-aelter`.

**Gemessen ändert die Sammelregel keine einzige Anzeige**: bei allen 17
übereinstimmenden Fällen ist die erstgeführte Form NW, und NW deckt sich dort
mit FuE. Sie ist bestätigend, nicht korrigierend — das ganze Gewicht der Frage
liegt bei den acht Abweichungen.

### 15.4 Das Haltedatum kommt aus dem Verlauf (v3.30)

Die Fristen-Stoppuhr wusste seit v3.11, **dass** ein Vorgang steht, nicht seit
wann. Beide Quellen schweigen bei genau den Fällen, um die es geht: das Journal
reicht nur bis zu seinem Nullpunkt zurück, und an der Phase eines Endstatus
hängt kein Datumsfeld. Die Verlaufsableitung kennt den Übergang samt Datum und
ist jetzt Stufe 3 der Kaskade.

**Kein Zyklus, kein Wegwerf-Verlauf.** `baueUebergaenge` nimmt den
Bezugszeitpunkt gar nicht entgegen — nur `baueSegmente` tut das. Ein erster Lauf
mit dem Stichtag liefert deshalb dieselben Kanten wie der endgültige; der zweite
entfällt, wo kein Haltedatum herauskam. Ein Test in `verlauf.test.ts` hält die
Kanten-Invarianz fest; ohne sie wäre die Auflösung ein Zirkelschluss.

Bestandslauf (6 615 Vorhaben, Richtlinien 2015 + 2020 + 2025, 17,5 s), Spalte
v3.30 zum Vergleich:

| | v3.30 | **heute (v4.52)** |
|---|---:|---:|
| Zustandsmatrix | diagonal | **diagonal** |
| erstmals ein Haltedatum | 1 638 | **0** |
| umdatiert | 0 | **0** |
| Achse endet woanders | 1 638 | **0** |
| aus einem Datumsfeld (Stufe 2) | — | **5 585** |
| ohne Haltedatum-Quelle | 3 985 | **1 030** |
| … davon **angehalten** (die offenen Fälle) | — | **42** |

Die Diagonale ist eine **Zusage**, keine Statistik: `berechneFrist` liest das
Haltedatum erst im `angehalten`-Zweig, nachdem der Zustand feststeht. Ein
Unit-Test in `frist-ergebnis.test.ts` hält dieselbe Invarianz fest; der
Bestandslauf bestätigt sie nur.

**Stufe 3 greift heute nirgends** — nicht, weil sie kaputt wäre, sondern weil
Stufe 2 vorher antwortet: die kuratierten ZAH-Phasen sind seit v3.30 gewachsen,
und `ausDatumsfeld` deckt jetzt 5 585 Vorhaben. Die Zusage darüber ist damit
zwar wahr, aber leer — genau das meldet der Befund im Kürzel-Reiter als
Auffälligkeit, statt es in drei Nullzeilen zu verstecken.

Von den 1 030 ohne Quelle sind **988 gar keine offenen Fälle**: 616 laufen (eine
laufende Uhr braucht kein Haltedatum), 372 sind nicht berechenbar. Offen sind die
**42 angehaltenen** — dort erklärt die Ableitung den importierten Status nicht,
und ein Datum von einer fremden Kante wäre eine Aussage über einen anderen Status
(Pitfall #44). Die Anzeige zählt deshalb `angehaltenOhneDatum` und nicht „Quelle
unbekannt": 1 030 behauptete eine Lücke, die es nicht gibt.

### 15.5 Was offen bleibt

**DS-Grundregel** — die Sammelantwort „DS = FuE" steht gegen acht abweichende
Einzelantworten. Sechs folgen DL, zwei EP:

| Kürzel | FuE-Fassung | gewählte Antwort | entspricht |
|---|---|---|---|
| `AB` | bewilligungsreif/Akte an Euronorm | Bewilligungsempfehlung durch Haushaltsbeauftrage/Titelverantwortliche | DL |
| `ALSB` | BB ohne Nachforderungen | BB ohne (weitere) Nachforderungen | DL |
| `ALS` | TB ohne Nachforderungen | TB ohne (weitere) Nachforderungen | DL |
| `ABE` | Empfangsbestätigung im IT | Eingang Empfangsbestätigung | DL |
| `GN` | Nachforderung/okay | Nachforderung/Rückfragen zur ZA | DL |
| `LZ` | Laufzeitänderung an ZE | Änderungsbescheid Laufzeit an ZE | DL |
| `ARR` | Termin Rücknahmeempfehlung | Termin Rücknahmeempfehlung rechtskräftig | EP |
| `WRZ` | Widerruf an ZE (Art) | Widerrufsbescheid an ZE | EP |

Beides sind Einzelvorhabenformen, und eine Durchführbarkeitsstudie ist ebenfalls
ein Einzelvorhaben — **benannte Option**: DS steht strukturell näher an DL als an
FuE. Zu klären ist die Grundregel, nicht die acht Einträge: gilt „DS = FuE mit
acht Ausnahmen", oder wäre „DS = DL" die bessere Grundregel? Alle acht tragen
`bestaetigung_offen` und wirken bis dahin.

**Zwei Vereinheitlichungen mit Bedeutungsumkehr** — ebenfalls
`bestaetigung_offen`, aus einem anderen Grund: hier benennt der verworfene
Wortlaut eine **andere Handlung**, nicht dieselbe anders geschrieben.

- `ÄZX` → „Bewilligung ohne Bescheid" (NW und DL sagen das). Verworfen: FuE
  „Ablehnung des Änderungsantrags an ZE", EP „Aktennotiz zur Ablehnung des
  Änderungsantrages an EN". Zwei Formen sagen *Bewilligung*, zwei *Ablehnung*.
- `ÄZ` → „Änderungsbescheid an ZE". Überschreibt das EP-Muster „Aktennotiz … an
  EuroNorm", das EP auch bei `LZ` und `ÄZX` führt.

**K/T-Konvention** — geprüft, kein weiterer Verdacht. 19 Kürzelpaare
unterscheiden sich nur im Schluss-`K`/`T`; genau **eines** war verdreht
(`XVK`/`XVT` in der Spalte NW, wo FuE dasselbe Paar richtig herum führt). Das
ist korrigiert und als Quellkorrektur ausgewiesen. Die Prüfung läuft ab jetzt
als Klärfragen-Herkunft `kt-konvention` mit — heute leer, mit Positivkontrolle
im Test; ein künftiger Fall muss nicht wieder von Hand gefunden werden.

**`VN gegrüft`** — 5 Vorgänge / 4 Verbünde. Die Korrektur gehört ins
**Fachsystem**; die App normalisiert nur beim Lesen
([schreibfehler.ts](../../src/core/status/schreibfehler.ts)) und zeigt den
Rohwert daneben („im Quellsystem: „VN gegrüft""). Der Klärfragen-Reiter führt die
bekannten Fälle mit ihrem gemessenen Gewicht als Hinweis für die Fachseite.

**3 193 gescheiterte Vorbedingungen** — unverändert zurückgestellt
([§14.5](#145-zweite-regelquelle-was-c16-zusätzlich-erklärt)). Hypothese: es
könnte historisch korrektes Verhalten unter einer **früheren Regelfassung** sein
— C16 führt nur den aktuellen Stand, und ein 2018 gesetztes Kürzel wird gegen die
Regel von heute geprüft. Ein späterer Prüfschritt wäre, ob sich die Verstöße in
bestimmten Richtlinien, Programmen oder Jahren häufen; häufen sie sich, ist es
eine Regeländerung, verteilen sie sich gleichmäßig, ein Datenproblem.

**Kürzel ohne Rollenangabe** — zurückgestellt. Leere Rollen heißen „jeder darf
setzen", nie „niemand" (Pitfall #43); die Frage ist, wo das Absicht ist.

**Reimport und zweite Klärrunde** — zurückgestellt. Fürs Hinweisblatt der
nächsten Mappe gehört ein Satz, der diesmal gefehlt hat: **bei einer Sammelregel
bleiben die Einzelzeilen leer.** Genau dieser Konflikt hat den Widerspruch aus
§15.5 erzeugt — die Sammelfrage und 23 Einzelfragen wurden beide beantwortet,
und acht Antworten widersprachen einander.

### 15.6 Was erledigt ist

- **12 amtliche Kleinschreibungen** bestätigt. Damit ist nicht eine Liste
  abgearbeitet, sondern die **Frageklasse** beantwortet: der amtliche Text ist
  Fremddatum und wird nie korrigiert, auch nicht bei künftigen Fällen, die
  falsch aussehen (CLAUDE.md, Pitfall #43). Die Herkunft `amtlicher-text-klein`
  ist entfallen, ihr Id-Präfix bleibt vergeben.
- **29 NW/FuE-Widersprüche** entschieden, davon 6 als „beide gelten — je
  Projektform verschieden". Die sechs bestätigen den Schlüssel Kürzel ×
  Projektform: der Unterschied war nie ein Fehler.
- **Der `strittig`-Marker** blieb unbeantwortet und wurde als **Vorgabe**
  entschieden — auf die Option „Bedeutungsunterschiede brauchen ein eigenes
  Kennzeichen". Seitdem steht `bedeutungsdivergenz` neben `strittig`: zwei
  Marker, zwei Aussagen. Der eine misst ein Patt bei Schreibvarianten desselben
  Textes (vom Generator gesetzt), der andere einen inhaltlichen Widerspruch.
  `YW` („Wichtig" / „Wichtig:") trägt beide — der beste Beleg, warum sie nicht
  verschmelzen dürfen. Die Frage wird nicht mehr gestellt; sie zu stellen,
  nachdem ihre Antwort implementiert ist, wäre Theater.
- **Ein Fehler in der Ableitung**, gefunden beim Übernehmen: `useKlaerfragen`
  prüfte „führt die Fassung diesen Wert?" nur gegen `wert`, nicht gegen
  `varianten` und die amtlichen Schreibweisen — anders als `snapshot.ts`, das
  genau dafür `mitAmtlichenSchreibweisen` hat. Code 72 („Stellungnahme zur
  Rücknahmeempfehlung") galt deshalb als fehlend, obwohl die App ihn längst
  auflöst. Die naheliegende Cockpit-Übernahme hätte eine **zweite Zeile
  desselben Codes** angelegt, ohne `code` und mit `kategorie: 'sonstige'` — die
  kuratierbare Doppelzeile, vor der `status-canonical.ts` warnt.

### 15.7 Das FristenBand (v3.31)

Die Frist stand als Liste da und ihre Zahl als Behauptung. Das Band zeigt die
Lage — Achse von der Basis über den Bezugszeitpunkt zum Ziel — und nennt
darunter jede Zahl: welches Eingangsdatum gewonnen hat (`D_AAE` vs. `D_XTE`),
woher das Haltedatum kam und wie belastbar es ist, welche Zieltage der Schritt
hat, warum der Punkt in der Frist-Spalte diese Farbe trägt.

**Band UND Liste in einem Bauteil.** Der Verlaufs-Reiter hält fest: „Eine Grafik
kann Zahlen unterschlagen; ein Listeneintrag nicht." Deshalb ersetzt das Band
die Liste aus Phase 2, statt sich danebenzustellen.

**Keine zweite Rechnung, keine zweite Schwelle**: die Frist kommt aus
`useZeilenVerlauf`, der Stillstand aus `pruefeStillstand`, die Zieltage aus dem
Katalog, die Ampelstufen aus derselben Tabelle, aus der `fristAmpelFromDays`
liest. Ein neuer Guard `frist-eine-rechnung` hält fest, dass
`fristFuerVorkommen` nur in den drei Rechnern steht.

Die Abnahme hat dabei einen Fehler gefunden, den kein Test gesehen hätte: im
Ausklappbereich rechnete die Frist mit dem Status **der Zeile**, Wächter und
Zieltage aber mit dem **Verbund**-Status. Bei `16DS262011` stand „9 T
angehalten" (Teilvorhaben, terminal) neben „Zieltage 14 T" (Verbund, beantragt)
— ein Band über zwei verschiedene Vorgänge. Verbund- und TV-Status gehen im
Bestand regelmäßig auseinander (Pitfall #44); `ZeilenVerlauf` gibt die Vorkommen
der Zeile jetzt mit heraus, damit beides aus derselben Menge kommt.

## 16. Der aufgeklappte Bereich nach dem Entwurf (v3.40)

Grundlage ist der Handoff `_design/handoff/status-fristen-detail-ansicht/`. Er
ordnet den Bereich nach drei Fragen: *Wie weit über der Frist? · Woran hängt es? ·
Was ist zu tun?* — und legt den Nachweis darunter.

### 16.1 Aufbau

1. **Kopfkarte** ([KopfKarte](../../src/plugins/antraege/ausklapp/kopfkarte/KopfKarte.tsx)) —
   Urteil zur Frist samt Herleitung, drei Fakten (Bewegung · Meilensteine ·
   Liegt bei), darunter die **Aufgabe** aus der To-do-Kaskade samt Aktionen und
   **ein** Blocker mit den Stufen, die deshalb mitwarten.
2. **Zwei Reiter** (`SegmentedToggle`): **Vorgangsverlauf** (Chronik, terminlose
   Einträge, Fristrechnung — Voreinstellung, siehe 16.9) und **Zeitverlauf**
   (die Bahn).
3. Im Zeitverlauf: **Ebenen-Pillen**, das Band, die **Meilenstein-Ebene** auf
   derselben Achse und darunter die **Gliederung** (standardmäßig zu).

Die Karte steht **über** beiden Reitern, nicht in einem: sie beantwortet die
Frage, wegen der jemand aufklappt; der Reiter darunter beantwortet nur, warum
die Antwort stimmt.

### 16.2 Ein Blocker, keine Liste

Eine Aufzählung aller gerissenen Meilensteine beantwortet nicht, wo man ansetzt.
[findeBlocker](../../src/plugins/antraege/ausklapp/kopfkarte/blocker.ts) nimmt
die **früheste gerissene Blatt-Stufe** — Blatt in genau der Definition der Engine
(`bewertung.ts`: ein Sammel-Knoten aggregiert seine Kinder und zählt nicht
doppelt). Eine zweite Blattregel liefe beim ersten typgefilterten Plan
auseinander.

**„Blockiert" ist eine Annahme, keine Tatsache.** Der Plan kennt `elternId` und
Soll-Wochen, aber **keine** Vorgänger-Relation. Genannt werden deshalb nur die
gerissenen Sammel-Knoten über dem Blocker (Roll-up-Regel der Engine) und die
übrigen gerissenen Stufen. Wer eine echte Reihenfolge braucht, pflegt sie im
Plan.

Der Befund trägt **immer** einen Satz — auch bei einem Treffer, und für jeden der
sechs Gründe, keinen zu finden. Eine Karte, die hier schweigt, liest sich als
„alles in Ordnung" (Pitfall #44).

### 16.3 Die Zuständigkeit hängt am Vorgang, nicht am Meilenstein

Der Meilenstein-Plan kennt kein Rollenfeld. „Liegt bei" kommt aus dem
Stillstands-Wächter, und der liest **zwei** Quellen in dieser Reihenfolge
(`pruefeStillstand`, Stufe 2):

1. das halb offene **Kürzel-Paar** (`AK4` gesetzt, `AT4` fehlt) — es nennt die
   Rolle des fehlenden Gegenstücks und trägt als einzige Quelle eine Liegezeit;
2. das `wartetAuf` der treffenden **To-do-Regel**, ersatzweise ihr erstes
   `zustaendig` (seit v3.41, siehe 16.8).

Die **Liegezeit** kommt ausschließlich aus dem Paar. Als Ersatz bliebe die Zeit
seit der letzten Aktivität, und die steht schon als „Bewegung" daneben; dieselbe
Zahl unter zwei Überschriften läse sich als zwei Messungen.

Ohne Quelle wird nichts geraten — und der Grund, der dasteht, ist der zutreffende:
*keine Regeln in der Fassung*, *uneinige Teilvorhaben* und *nichts Belegbares*
sind drei verschiedene Lagen ([liegtBei](../../src/plugins/antraege/ausklapp/kopfkarte/liegtBei.ts)).

**Gemessen am Bestand (14 222 Vorgänge, August 2026):** allein aus dem Paar waren
5 034 Adressen ableitbar (35,4 %), mit der Kaskade 7 818 (55,0 %) — 2 784
zusätzlich, davon fast alle `fb`. Das Paar liefert praktisch nur `ab`.

### 16.4 Eine Achse, mehrere Schichten

Die Meilenstein-Ebene bekommt die x-Skala vom Band gereicht
(`ZeitAchse`/`xFuerTag` in [bandGeometrie](../../src/plugins/antraege/verlauf-band/bandGeometrie.ts)).
Eine eigene Abbildung setzte den 17.09. neben den Balken, der dort endet — die
Achse ist stückweise gestaucht.

Sie ist eine **eigene Schicht** (`zusatzBahn`), kein Eingriff in `Bahn`: das
Koordinatensystem der Balken, Kanten und Unter-Label ist in v3.37/v3.38 sortiert
worden und bleibt unangetastet.

Was nicht ins Achsenfenster passt, wird **gezählt** statt geklemmt; endet die
Achse vor dem Stichtag (angehaltene Uhr), sagt das ein Satz unter der Ebene.

Die rechte Reserve für „1.4.3 · 327 T" wird **gemessen**, nicht geschätzt: die
60 px des Entwurfs reichen für „3 · 299 T", nicht für die dreistellige Nummer in
Mono. Gemessen wird vor der Geometrie — die Reserve geht in die Bahnbreite ein,
die Bahnbreite in die Achse (Profil `bandVerzug`).

**Drei Pillen, nicht vier** (v3.41, [ebenen.ts](../../src/plugins/antraege/ausklapp/zeitverlauf/ebenen.ts)):
*Verbund* (an) · *Kürzel* (an) · *Meilensteine* (aus). „Phasen" ist keine Ebene —
die Bahnen der Teilvorhaben **sind** der Zeitverlauf, und eine Pille, die den
Inhalt einer Ansicht wegnimmt, ist ein Ausschalter. Die Meilenstein-Ebene startet
zu, weil sie eine **zweite Datenquelle** auf dieselbe Achse bringt (den Plan, nicht
den Export) und rechts Platz für ihre Verzugslabels fordert.

### 16.5 Aktionen: nur echte Züge

Der Entwurf zeigt „QS anstoßen", „Zuständigkeit ändern" und „Verzug begründen"
und nennt sie selbst Annahmen. Keine davon existiert in der App. An ihrer Stelle
stehen die drei Züge, die es wirklich gibt: **Risiko melden** (das bestehende
Formular, mit dem Blocker vorgewählt; schreibt in den persönlichen Ordner),
**Auf der Detailseite öffnen** (`?ziel=meilensteine`) und **Verlauf kopieren**.
Drei Knöpfe, die nichts tun, wären schlimmer als keine.

### 16.6 Zwei Korrekturen am Handoff

- **„Bearbeitungsfrist 90 T aus dem Statuskatalog"** stimmt nicht: die 90 sind
  `ANTRAG_SLA_DAYS` (Regelfrist für alle Anträge), aus dem Katalog kommen die
  *Zieltage des Schritts*. Beide Zeilen stehen mit ihrer eigenen Herkunft da; die
  Zahl wird als Differenz Basis→Ziel abgeleitet, nie verdrahtet.
- **„liegt bei QS"** am Blocker ist eine Aussage über den Vorgang, nicht über die
  Stufe — sie steht deshalb als eigenes Faktum (16.3).

### 16.7 Was die Abnahme gefunden hat

- **Zwei Uhren.** `useVerbundMeilensteine` bewertete gegen `new Date()`, die
  Fristkette gegen den gestempelten Stichtag: „272 Tage über der Frist" neben
  „327 T offen" aus zwei Gegenwarten. Der Stichtag geht jetzt mit hinein.
- **Zwei Ableitungen für dieselbe Frage.** „Ziel **war** 11.11.2025" verglich
  Zieldatum und Stichtag, das Urteil daneben las `tageRest`. Beide lesen jetzt
  dasselbe Signal — gefunden hat es der Test, nicht der Bildschirm.
- **Das Verzugslabel lief aus dem Container** (9 px), weil die Reserve pauschal
  war (16.4).
- **Zwei Zählweisen nebeneinander**: „3 gerissen von 8" (relevante Blätter) in
  der Karte und „6 Stufen · 3 gerissen" in der Gliederung. Beide Zahlen kommen
  aus **einer** Funktion; die Überschrift zählt, was darunter steht — auch die
  nicht relevanten Stufen, sonst nennte sie weniger, als das Auge sieht.

### 16.8 Die To-do-Kaskade im Ausklapp (v3.41)

Bis v3.40 beantwortete die Karte „was ist zu tun?" nur mit Knöpfen; die Antwort
selbst stand seit v2.390 in der Engine und war im Vorgangs-Board zu sehen, nicht
am Antrag. Sie wird jetzt **gelesen**, nicht neu gerechnet — dieselbe Kaskade,
derselbe Bedingungs-Evaluator, dieselben Sperren (Pitfall #47).

**Die Einheit ist das Teilvorhaben.** Die Regeln lesen überwiegend TV-Spalten;
alle Teilvorhaben eines Verbunds in einen Topf geworfen bekäme ein fertiges TV
das To-do seines Nachbarn. [useZeilenTodo](../../src/plugins/antraege/ausklapp/useZeilenTodo.ts)
wertet deshalb je Teilvorhaben aus (`StatusVerlauf.jeTeilvorhaben` — Verbund-Felder
plus die eigenen, dieselbe Menge, die `jederVorgang` dem Board gibt) und
[baueAufgabe](../../src/plugins/antraege/ausklapp/kopfkarte/aufgabe.ts) faltet
danach: die häufigste Aufgabe groß, abweichende **mit Aktenzeichen** darunter.
Eine Faltung, die ihre Minderheit verschweigt, wäre eine Behauptung über den
ganzen Verbund. *(Bestand: 3 450 der 7 534 Verbünde führen mehr als ein TV, in 41
davon tragen sie verschiedene Aufgaben.)*

**Zwei Regelsätze, zwei Fragen.** Angezeigt wird der Satz der eigenen Rolle
(`leseStatusRolle(profile.status_rolle)`, `'alle'` ⇒ AB — dieselbe Auflösung wie
`sichtVon` im Board). Die **Adresse** für „Liegt bei" kommt dagegen immer aus dem
**AB-Satz**: das Urteil des Wächters hängt gar nicht am To-do, und es soll sich
nicht verschieben, nur weil jemand seine Anzeige umschaltet.

`adresseFuerWaechter` liefert **keine** Adresse, wenn die Teilvorhaben auf
verschiedene Rollen warten — die Zeile hat dann keine, und das ist ein eigenes
Urteil, kein Schweigen (8 Fälle im Bestand). Kein Regeltreffer ist ebenso ein
Ergebnis: eine greifende Sperre (`S0`) heißt „keine Aufgabe mehr", nicht „keine
Aufgabe gefunden".

**Kein Widerspruch zur Tabellenzeile.** Deren „→ …" ist `naechsterSchritt(status,
precheck)` — ein Hinweis, der allein am Status hängt. Die Aufgabe kommt aus der
Kaskade, die Datumsspalten liest. Die Überschrift nennt den Regelsatz, ihr
Tooltip den Unterschied.

Ohne das Vorgangssystem läuft die Kaskade nicht: dann fehlt die Aufgaben-Zeile,
der Blocker rückt an ihre Stelle (die Aktionen sollen nicht allein stehen), und
„Liegt bei" nennt den Flag als fehlende Quelle.

### 16.9 Der Vorgangsverlauf trägt jetzt einen Verlauf (v3.44)

Der Reiter hieß wie das C16-Fenster und zeigte etwas anderes: die
**Fristrechnung**. Darin stehen genau zwei Feldkürzel — `D_AAE` und `D_XTE`, die
beiden Kandidaten für das maßgebliche Datum. Wer ihn wegen seines Namens öffnete,
fand keinen Verlauf. Jetzt drei Blöcke
([VorgangsverlaufReiter](../../src/plugins/antraege/ausklapp/vorgangsverlauf/VorgangsverlaufReiter.tsx)):

1. **Chronik** — dieselbe [StatusChronik](../../src/plugins/antraege/status/StatusChronik.tsx)
   wie auf der Detailseite, **wiederverwendet, nicht nachgebaut**: zwei Renderer
   über denselben Daten wären zwei Wahrheiten, und die Zeile soll zeigen, was der
   Nutzer dort kennt.
2. **Ohne Termin im Export** ([ohneDatum.ts](../../src/plugins/antraege/ausklapp/vorgangsverlauf/ohneDatum.ts)) —
   standardmäßig zu, Anzahl in der Überschrift.
3. **Fristrechnung** — unverändert, nur mit Überschrift; ebenfalls zu.

**Drei Sichten, drei Fragen** — sie zeigen absichtlich verschieden viel:

| Sicht | zeigt | für 16EP260076 |
|---|---|---|
| Chronik (Vorgangsverlauf) | **alle** datierten Einträge | 15 |
| Kürzel über der Bahn (Zeitverlauf) | nur die an **Statusgrenzen**; gleichtägige gebündelt als `+n` | 3 Marken |
| Klick auf die Bahn → `SpurListe` | alle Übergänge **dieser Bahn** | TV 15 · Verbund 4 |

Chronik und TV-Spur stimmen überein — beide hängen an `baueChronik`. Die
Verbundbahn zeigt weniger, weil sie eine andere Bahn ist, nicht eine andere
Summe: die vier `X`-Codes des Verbunds sind eine Teilmenge derselben 15.
[bandKanten.ts](../../src/plugins/antraege/verlauf-band/bandKanten.ts) wirft jeden
Übergang weg, an dessen Tag kein Abschnitt beginnt — auf der Achse hat er keine
Stelle. Das ist die richtige Auskunft, kein Mangel.

**`D_` ist das Datum, `T_` der Text — und daran hängen zwei verschiedene Fälle**
([seed-codes.ts](../../src/core/status/seed-codes.ts):
`typ: spalte.startsWith('T_') ? 'text' : 'datum'`):

- `spalte: 'T_ABK'` — die **eigene** Spalte des Codes ist eine Textspalte, im
  Export gibt es zu ihm nie einen Termin ⇒ Block „Ohne Termin".
- `text: 'T_AAI'` — eine **Begleitnotiz** zum Datumsfeld `D_AAI`. Sie ist kein
  eigenes Vorkommen, sondern `FeldVorkommen.text`, und steht als zweite Zeile
  unter dem datierten Eintrag.

Wer die beiden verwechselt, schreibt dasselbe Ereignis zweimal hin — einmal mit
Termin, einmal ohne. Ein Test hält den Fall fest.

**Die Grenze liegt im Export, nicht in der Oberfläche.** Gegen das C16-Fenster
desselben Vorgangs gemessen: von 25 Zeilen haben 15 eine `D_`-Spalte, 6 nur eine
`T_`-Spalte (`XAT`, `XAT+`, `ABK`, `AMA`, `AVU`, `AVB` — in C16 datiert), und 4
gar keine (`AA` und `XARF` kennt der Katalog, die Spalte fehlt; `ID` steht
zweimal im Protokoll, und eine Breittabellen-Spalte trägt nur einen Termin). Die
App erfindet dafür nichts; der Zähler „N Termine aus den Datumsfeldern" benennt,
worüber die Liste spricht.

**Die Länge fangen die Blöcke ab, nicht ein Scrollbereich in der Chronik**
(v3.44.1). Gemessen über 12 357 ANB-Zeilen: Median **22** Termine je Vorgang,
p90 = 31, max 47 — bei ~29 px je Zeile also 640 px im Regelfall. Der erste
Versuch deckelte die Chronik-Liste auf 320 px; das war die falsche Stelle. Der
Reiter wird **wegen** des Verlaufs geöffnet, und ein Kasten, der zehn von 22
Terminen zeigt, liest sich als der ganze Verlauf. Die Chronik steht deshalb
offen und ungekürzt; **zugeklappt anfangen die beiden Blöcke darunter** — „Ohne
Termin im Export" (mit der Anzahl in der Überschrift) und die Fristrechnung. Das
sind Nachschlagen und Nachrechnen, nicht das, weswegen jemand aufklappt.

Weder die beiden Klapp-Zustände noch der Schalter „Nebensächliches" werden
persistiert: alle drei hängen an einem lokalen `useState`, **nicht** an
`useTimelinePrefs`. Der aufgeklappte Bereich merkt sich nichts, und das
Aufklappen einer Tabellenzeile darf die Voreinstellung der Detailseite nicht
umschreiben.

### 16.10 Die Chronik in zwei Spalten (v3.45)

Der Verlauf soll **auf einen Blick** dastehen, nicht auf zwei Bildschirmen. Die
Verteilung über 13 090 Vorgänge: Median **22 Termine in 6 Monaten**, p90 32 in 9,
max 50 in 15 — rund 3,7 Termine je Monat. Daraus folgen drei Entscheidungen in
[StatusChronik.tsx](../../src/plugins/antraege/status/StatusChronik.tsx), die für
**beide** Verwendungen gelten (Detailseite und Ausklapp — eine Ansicht, eine
Dichte):

1. **Der Monat steht links in einer eigenen Spalte**, nicht in einer eigenen
   Zeile. Sechs Überschriften kosteten ~190 px für sechs Wörter. Die senkrechte
   Achse läuft **durch** alle Monate, weil der Blockabstand innerhalb der `<ol>`
   entsteht und nicht zwischen den Blöcken.
2. **Ein Termin ist eine Zeile.** Der Begleittext (`T_`-Notiz) steht hinter der
   Bezeichnung statt darunter, gekürzt; der volle Wortlaut samt Ordnerpfad hängt
   im `title`. Ohne senkrechtes Padding — bei 28 Terminen sind 3 px je Zeile ein
   ganzer Eintrag.
3. **Die Zeilenhöhe steht in px, nicht als Faktor.** `leading-[1.5]` rechnet
   gegen die geerbte Schriftgröße, und die ist im Ausklapp eine andere als auf
   der Detailseite — gemessen 20 px hier, 24 px dort. Dieselbe Ansicht darf nicht
   je nach Umgebung eine andere Dichte haben.

Gemessen: `16EP250140` (28 Termine, 8 Monate) 1 003 → **659 px**, ein Median-Fall
(`16EP250019`, 21 Termine, 6 Monate) **460 px**.

Zwei Zugaben, die aus derselben Frage folgen. Der Zähler nennt die **Spanne**
(„28 Termine aus den Datumsfeldern · Aug. 2025 – Juli 2026"), und ab **zwei**
übersprungenen Monaten steht unter dem Monatsnamen leise „N Monate ohne Termin"
(`monateDazwischen` in [chronik.ts](../../src/core/status/chronik.ts)) — Stillstand
sieht man sonst nur, wenn man die Überschriften voneinander abzieht.

**Der Schalter „Nebensächliches" erscheint nur, wenn er etwas bewirkt.** Er war
in der Chronik wirkungslos, und zwar überall: als `nebensaechlich` kuratiert sind
15 Codes, alle aus den Ordnern *Kommunikation* (`KANAL` in
[seed-codes.ts](../../src/core/status/seed-codes.ts)) — und **keine** dieser
Spalten existiert in einem der Import-CSVs, nicht leer, sondern nicht vorhanden.
`teileChronik` trennt deshalb die fertige Chronik in „steht immer da" und „nur
auf Wunsch", der Chip hängt an der zweiten Menge und trägt ihre Anzahl. Ein
Gatter im Test hält fest, dass die Teilung dasselbe liefert wie das Filtern beim
Bauen. Liefert der Export die Kanalspalten eines Tages, kommt der Schalter von
selbst zurück.

### 16.11 Wer gesetzt hat — und was fehlt (v3.48)

Die Chronik sagte, **was wann** passiert ist, aber nicht **wer** es war. Für ein
Team, das sich AB und FB teilt, ist das die halbe Auskunft: ein FB sieht 28
Termine und weiß nicht, welche seine sind, welche der AB gesetzt hat und wo eine
Seite offen steht.

Beides war schon da, nur nicht sichtbar:

- **Die Rolle hängt am Feld** (`StatusFeldEintrag.rollen`), und `ChronikEintrag`
  trägt den vollen Eintrag — `rollenVonFeld(e.feld)` kostet keinen Lookup und
  keine `MappingVersion`. Von 505 Codes tragen 362 mindestens eine Rolle; die
  143 neutralen bleiben unbeschriftet, weil „alle" an jeder dritten Zeile
  Rauschen ohne Information wäre (Pitfall #43).
- **Die Lücke rechnet der Wächter** (`findeOffenePaare`, neun adm/fachl-Paare).
  Sie speiste bisher nur die Stillstands-Erklärung und die FB-Erhebung.

Drei Entscheidungen, die den Umbau tragen:

**Hervorheben statt filtern.** Die eigene Rolle kommt still aus dem Profil
(`status_rolle`); die eigenen Zeilen tragen eine 2-px-Kante auf der Achse und
ihr Kürzel in `--tf-primary` — dasselbe Idiom, mit dem das Feedback-Board „meins"
markiert (`.fb-karte.meins`). Ein *Filter* wäre falsch: der Nutzer will
ausdrücklich auch sehen, was der Partner gesetzt hat. Steht das Profil auf
„alle", entfällt die Hervorhebung; die Zuordnung bleibt. Neutrale Zeilen gelten
NICHT als eigene — markiert trüge fast jede dritte Zeile die Kante.

**Die Lücke steht, wo das Auge ist.** Eine Fehlzeile hängt unter dem Termin, der
die andere Seite gesetzt hat: hohler Ring, kein Datum, „fehlt seit N T", Rolle
und Aktenzeichen. Sie zählt **nicht** als Termin — die Kopfzeile verspricht
„Termine aus den Datumsfeldern" —, sondern wird daneben gezählt, damit eine
Lücke tief in der Liste nicht übersehen wird. Findet sich ihr Anker nicht (sein
Feld kann `ignoriert` sein), landet sie am Ende ihres Monats statt zu
verschwinden.

**Gerechnet wird je Teilvorhaben** (`offenePaareJeTeilvorhaben`). Über die
zusammengeworfenen Vorkommen eines Verbunds gilt ein Kürzel als gesetzt, sobald
irgendein TV es trägt: hat TV-A `AK4` und TV-B `AT4`, meldet die Suche
**nichts**, obwohl jedes für sich eine offene Seite hat. Dieselbe Grenze, an der
schon `OffeneAufgaben` und die FB-Erhebung haltmachen.

Abgegrenzt bleibt die Aussage: Chronik = was war und welches Gegenstück fehlt;
Kopfkarte und „Offene Aufgaben" = was zu tun ist. Die To-do-Engine ein drittes
Mal zu rendern wäre eine zweite Wahrheit gewesen.

Gemessen am Bestand (dev:local, 29 Termine): Zeilenhöhe unverändert 20 px, kein
Scrollbereich. Die Rollenspalte trug anfangs Text (`AB/FB/QS`, mit Auslassungs-
punkt gekürzt) auf 38 px; seit v4.48 stehen dort **getönte Marken** in derselben
Farbe wie die Filterleiste, auf drei Marken bemessen — Maße und der „+n"-Fall
in [chronik-und-zeitstrahl.md](../status-system/chronik-und-zeitstrahl.md).

### 16.12 Was mit v3.48 wegfiel

- **Der Reiter „Zeitstrahl"** auf der Verbund-Detailseite zeigte das
  gerätelokale Ereignis-Protokoll und blieb leer, solange eine Installation
  nichts mitgeschrieben hatte. Er wurde nicht benutzt. Sein **Name** ging auf das
  Verlaufs-Band über (bis dahin „Band"), das dieselben Termine als Bahn zeichnet;
  der gespeicherte **Wert** bleibt `band`, damit keine vorhandene Wahl migriert
  werden muss. `normalisiere` lässt ein gespeichertes `zeitstrahl` auf die
  Chronik zurückfallen — sonst bliebe ein Zustand ohne Render-Zweig.
- **Das Fristen-Band der Detailseite** stand vor dem Aufklapp-Rumpf und war damit
  die einzige Fläche, die man nicht zuklappen konnte. Dieselben Zahlen stehen in
  der Frist-Spalte, in der Kopfkarte des Ausklapps und im Block „Wie die
  Bearbeitungsfrist zustande kommt".
- Mit beiden fielen `StatusTimeline`, `baueLanes`/`clustere`,
  `aufzeichnungsGrenze` und das ganze `fristen-band/`-Verzeichnis; die
  Ereignis-Events lädt `useStatusVerlauf` nicht mehr. `eventProminenz` bleibt —
  das Home-Widget liest es.

## 17. Was der Bestandslauf kostet (v4.103)

Beide Bestands-Seiten — [Vorgangs-Board](../../src/plugins/vorgangs-board/) und
Vorgangs-Regeln — rechneten bei **jedem** Menü-Aufruf den ganzen Bestand neu.
Gemessen am echten Stand (14 225 Anträge, 12 359 im Bereich, 7 535 Verbünde):
7,8–18,2 s bzw. 10,8–12,4 s, **auch beim Wiederbesuch**. Der Router hält keine
Seite am Leben, also startete jede Rückkehr bei null.

### Die drei Hebel, nach gemessenem Gewinn

1. **Ergebnis über den Seitenwechsel halten** ([useBestandsAufgaben.ts](../../src/core/hooks/useBestandsAufgaben.ts),
   [cockpitCache.ts](../../src/plugins/status-cockpit/cockpitCache.ts)). Der mit
   Abstand größte Hebel: Wiederbesuch < 1 s bzw. 126 ms. Schlüssel = Fassung
   (Nummer **und** Zeitstempel) + Betrachtungsbereich + Bestands-Generation +
   Stichtag-Tag; TTL 5 min als Obergrenze der Schalheit.
   **Scharf gestellt wird nach GELESENEN Sätzen, nicht nach Ergebniszeilen** —
   „0 Zeilen" heißt entweder Cold Start (darf nicht festgeschrieben werden) oder
   „der Bereich schließt alles aus" (eine echte Antwort). Nach `zeilen.length`
   wären beide ununterscheidbar.
2. **Fassungs-Indizes einmal je Fassung** ([version-index.ts](../../src/core/status/version-index.ts)):
   Wächter 2 459 → 602 ms. `felderNachCode` wurde je Antrag mit ~550
   `normalize('NFC')`-Aufrufen neu gebaut.
   **`ersterWertNachCode` und `zieltageNachCode` sind zwei Maps, nicht eine** —
   `zieltageFuer` überspringt Einträge ohne numerische Zieltage, das Board nimmt
   den ersten Treffer und lässt danach den Seed-Rückfall greifen. Eine
   gemeinsame Map wäre still falsch.
3. **Kompilierter Vorkommen-Plan + Kaskaden-Index** ([feld-aufloesung.ts](../../src/core/status/feld-aufloesung.ts),
   [todo-engine.ts](../../src/core/status/todo-engine.ts)): sammeln 1 547 → 1 036 ms,
   todo 253 → 163 ms.

### Zwei Richtlinien statt drei (v6.56)

Der Lauf rechnet nur noch die aktuelle und die vorige Generation im Bereich
(`bestandslaufMenge`); die dritte wird gelesen, aber nicht gerechnet, und ihre
Zeilen sagen das (`ausserhalbLauf`, [status-achsen.md](status-achsen.md)).
Gepaart gemessen am 10.09.2026 in `dev:local` auf denselben Daten (Standard-
Bereich, 12 Programme), abwechselnd alt und neu:

| | gerechnet | nicht gerechnet | gesamt | idb | todo | wächter |
|---|---:|---:|---:|---:|---:|---:|
| drei Generationen | 12 359 | — | 4 747 / 4 490 ms | 2 806 / 2 781 | 139 / 121 | 546 / 549 |
| zwei Generationen | 7 273 | 5 086 | 3 923 / 3 926 ms | 2 651 / 2 662 | 69 / 73 | 320 / 314 |

Rund 0,7 s (15 %). Mehr gibt der Schnitt nicht her: das Lesen (`idb`) bleibt, weil
alle Richtlinien in derselben Import-Quelle liegen und sich erst am Datensatz
unterscheiden lassen. Der Gewinn ist vor allem einer der Aussage — die Kaskade
spricht nicht mehr über Vorgänge, für die es keine Trigger gibt.

### Zwei Messfallen, beide selbst hineingelaufen

- **Gechunktes Lesen ist hier LANGSAMER.** `forEachAntragChunkByProgramm` sieht
  passend aus (beschränkter Speicher-Ausschlag) und kostete gemessen **~7 s
  mehr**: 28 einzelne Transaktionen statt einer. Die Zeit lag zudem *zwischen*
  den Chunk-Callbacks und fiel damit aus jeder Chunk-Messung heraus — sichtbar
  nur als Lücke zwischen `bestand` und der Summe seiner Teile. Verworfen; der
  Grund steht in [vorgangs-quelle.ts](../../src/core/status/vorgangs-quelle.ts),
  damit es niemand erneut „verbessert".
- **`trigger 11 098 ms` war Wartezeit, keine Arbeit.** `ladeTrigger` und
  `ladeBestand` liegen im selben `Promise.all` auf einem Thread; der
  Bestandslauf blockiert ihn synchron. Mit gecachtem Bestand steht dort
  `trigger 124`. Wer die erste Zahl für Trigger-Kosten hält, optimiert die
  falsche Stelle.

### Die Seiten sagen, dass sie cachen

`BestandsFrische` ([Komponente](../../src/components/ui/BestandsFrische.tsx))
zeigt Umfang, Alter und „neu berechnen". Ein Cache, der sein Alter verschweigt,
lässt eine Momentaufnahme wie eine Messung aussehen — dieselbe Unehrlichkeit,
gegen die `trigger-share.ts` beim stillen Rückfall argumentiert.

**Bewusst NICHT gemacht:** `listeVersionen` beim Mount durch ein `count()`
ersetzen. Gemessen 17–39 ms für 25 Fassungen — Aufwand ohne Gegenwert.

### Nachtrag v6.47: der Zeitpunkt war der Hebel, nicht die Rechnung (September 2026)

Ein Performance-Audit über die ganze App suchte den Rest der Kaltpfad-Sekunden.
Die Rechnung war es nicht mehr — **gemessen in `dev:local` am echten Bestand**
(14 225 Anträge, 12 359 Vorgänge im Bereich, 7 535 Verbünde):

```
[bestands-lauf] gesamt 5531 ms | katalog 0 | journal 75 | bestand 5455
                (idb 3125 · sammeln 938 · todo 189 · wächter 597)
```

**`idb 3125 ms` sind 57 % des Laufs** — Deserialisierung der vollen Records. Die
drei Hebel oben haben die Rechnung auf ~1,7 s gedrückt; wer hier weiter
optimiert, holt Promille. Der Rest ist I/O.

Zwei andere Dinge kosteten mehr:

1. **Der Lauf startete gegen den Start.** Die Leerlauf-Leser (Startseite,
   Tagesbrief, Widgets, Anträge-Tabelle) stießen ihn per `scheduleIdle` in
   dasselbe Fenster wie `runDataUpdate`. Er belegte denselben Thread und dieselbe
   SMB-Leitung, auf die der Start wartet — und `runDataUpdate` zählte danach die
   Bestands-Generation hoch und entwertete sein Ergebnis. Am ersten Start des
   Tages fiel der ganze Durchgang **zweimal** an. Jetzt warten die
   Leerlauf-Leser auf `phase === 'done'` (Vorbild: `auslastung/index.tsx`), mit
   einem Zeit-Rückfall gegen eine hängende Startphase — `getDatenShareHandle`
   liegt in App.tsx außerhalb jedes `try`.
2. **Die Leser folgten der Generation nicht.** Sie steht im Schlüssel, wurde aber
   nur beim Rendern einmal abgelesen. Nach einem Import legte der Lauf sein
   Ergebnis unter der neuen Generation ab, während der gemountete Leser weiter
   die alte trug — die beiden fanden sich nie wieder, die Startseite zeigte bis
   Sitzungsende die To-dos von VOR dem Import und `laeuftNoch` blieb wahr. Das
   war kein Tempo-, sondern ein Wahrheitsproblem
   ([subscribeBestandGeneration](../../src/core/services/bestand-generation.ts)).

Dazu zwei kleine Schnitte: der **Vorkommen-Plan** wird jetzt über (Feldliste,
Auflösung) memoisiert — das Cockpit kompilierte ihn je Verbund neu, während der
Board-Pfad ihn längst heraushob; und `wirkungZeilen` liest aus einem
Kürzel-Index statt je Feld-Zeile die ganze Trigger-Tabelle zu filtern.

**Die Vorgangs-Regeln-Seite bleibt der offene Posten.** Kalt gemessen:

```
[status-cockpit] gesamt 15564 ms | fassung 79 | versionen 27 (25) | bestand 11915 (7535 Verbünde)
[tf-perf] cockpit ladeBestand: 7535 Verbünde, 3 Schemas in 11238ms (io 5073ms)
```

Sie fährt einen **zweiten, eigenen Voll-Durchgang** neben `laufeBestand` — mit
eigenem `getAll` über dieselben Records. Der Plan-Memo holt davon 1–3 %; der
Hebel wäre ein gemeinsamer Roh-Halter für beide Durchgänge oder eine schmale
Projektion. Beides ist mehr als ein Quick Win und braucht eine eigene Spec.
(`trigger 15485` in derselben Zeile ist weiterhin **Wartezeit**, keine Arbeit —
siehe die zweite Messfalle oben.)

### Nachtrag v6.48: ein Durchgang, viele Mitfahrer — und eine Richtigstellung

Der offene Posten von oben ist bearbeitet
([Spec](../superpowers/specs/2026-09-10-geteilter-bestands-durchgang-design.md)).
Beim Nachmessen fielen zwei Zahlen des Nachtrags v6.47 um.

**Richtigstellung 1: die „~12–15 s" der Regeln-Seite gab es so nie.** Sie sind
der **Dev-StrictMode** — `ladeAlles` läuft beim Mount zweimal, beide Läufe
treffen den noch leeren Cache. Ein sauberer Einzellauf über „neu berechnen"
(Klick-Handler, kein Zwilling) kostet **6,4–6,9 s**: 3,3 s Lesen, 3,4 s Rechnen.
Produktiv gibt es den Zwilling nicht.

**Richtigstellung 2: „ein zweiter Durchgang neben `laufeBestand`" war zu eng
gefasst.** Es sind **dreizehn** Leser derselben drei Stores — zwölf über
`jederVorgang`, plus `ladeBestand`, das den Lesecode duplizierte. Und ein
Lesevorgang kostet **immer** ~2,2–3,3 s: vier Runden `getAll` hintereinander im
Leerlauf ergaben 3 035 · 3 181 · 3 089 · 3 211 ms. **IndexedDB cacht die
Deserialisierung nicht.**

Gleichzeitigkeit macht es schlimmer statt besser — zwei identische Durchgänge
nebeneinander kosteten je das 1,6-fache (`io` 3 105 → 4 975 ms, gesamt 6 447 →
10 268 ms), also mehr als nacheinander.

**Was gebaut wurde**: [roh-halter.ts](../../src/core/status/roh-halter.ts) hält
die Roh-Arrays eines Programms für die Dauer der Durchgänge, die sie brauchen —
Nutzerzähler statt TTL. Wer startet, während schon einer läuft, fährt mit.
`jederVorgang` und `ladeBestand` fahren beide darauf; im Log steht seither
`gelesen` bzw. `1× mitgefahren`, und beide zeigen **denselben** `io`-Wert, weil
sie auf dieselbe Promise warten.

**Warum kein Cache**: die Roh-Records sind **284 MB** (375 Felder je Antrag, 167
gesetzt); allein die gesetzten Werte 142 MB. Ein Halter, der den Lauf überlebt,
hielte den Bestand für die Sitzung fest — genau das, was `jederVorgang` mit
seinem Callback vermeidet. Beide Wege aus dem v6.47-Nachtrag („Roh-Halter",
„schmale Projektion") scheitern als *sitzungslanger* Halter an dieser Zahl; nur
der laufzeit-begrenzte ist gratis.

**Der Schnitt liegt UNTER `jederVorgang`, nicht darin.** `ladeBestand` darauf zu
heben hätte die Ausgabe verändert: `sammleVorkommenGeplant` gibt bei
`art: 'verbund-aus-tv'` **einen** Eintrag je Verbund aus — den ersten TV mit
Wert. `jederVorgang` ruft es je Antrag mit `[einem]` auf, `ladeBestand` je
Verbund mit allen. Bei zwei TVs mit verschiedenen Werten in derselben `X`-Spalte
liefe das auseinander (Pitfall #44/#45).

**Eine Messfalle mehr, fürs Protokoll:** die erste Fassung des Halters nahm ein
`besuche`-Callback. Damit wanderte der Rumpf der Programm-Schleife in eine
Closure, seine Zähler lagen im Heap-Kontext statt in Stack-Slots — und der Lauf
wurde bei **byte-identischem Rumpf um ~400 ms langsamer** (3 413 → 3 800 ms
Rechenzeit). Mit `for await (… of …)` über einen Async-Generator bleibt der
Rumpf im Scope seines Aufrufers; die Rechenzeit ist danach auf 1 ms identisch
(3 413 vs. 3 414 ms, je drei Proben).

**Und eine Warnung an die nächste Messung:** der Boden dieser Maschine schwankt
über eine Sitzung um **±33 %** (2 207 · 3 129 · 3 293 ms für dieselben vier
`getAll`-Runden) — teils *innerhalb* eines Fensters von einer Minute. Vergleiche
zwischen zwei Ständen sind nur **gepaart** belastbar: Boden messen, Läufe
messen, Boden messen, dann den Stand wechseln. Zeitversetzte Vorher/Nachher-
Zahlen sagen hier nichts.
