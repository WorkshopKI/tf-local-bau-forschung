# Fachabstimmung Vorgangssystem (ZAH-App)

Stand: 03.08.2026 · Datenbasis: CSV-Import 02.08.2026, Katalog v7, Trigger v1 (2 447 Zeilen, 9 Programme) · App v2.385.1

**So funktioniert diese Abstimmung:** Teil A sind fünf Entscheidungen, die das Verhalten der App bestimmen — bitte je Frage eine Option ankreuzen. Teil B sind Verifikationsfragen ans Fachsystem/an die Kollegen — bitte Antwort eintragen. Teil C ist zur Kenntnis (bereits umgesetzt). Jede Entscheidung aus Teil A ist später als Katalog-Zeile änderbar, ohne neue App-Version — es geht um den Startzustand, nicht um Beton.

---

## Teil A — Entscheidungen

### A1 · ZAH-Phase von „beantragt" (Code 31) — betrifft 260 Vorgänge

Der Status „beantragt" liegt heute in Phase **Eingang**. Bei 260 Vorgängen hat die Bearbeitung faktisch begonnen (Vollständigkeitsprüfung läuft), ohne dass im Fachsystem ein weiterführendes Kürzel gesetzt wurde — die alte App-Ableitung hat diese Vorgänge deshalb eigenmächtig als „Vollständigkeit" angezeigt. Die neue Logik zeigt den amtlichen Status; die begonnene Arbeit ist stattdessen über To-do und Stillstands-Wächter sichtbar.

- [ ] **Option 1 (Empfehlung):** 31 bleibt **Eingang**. Der amtliche Status ist die Wahrheit; dass ein Kürzel fehlt, zeigt der Wächter — genau dafür ist er da.
- [ ] **Option 2:** 31 wird **Vollständigkeit** zugeordnet. Die 260 rutschen eine Phase weiter, der Wächter-Hinweis „Kürzel vergessen" verliert an Sichtbarkeit.

### A2 · Zieltage je Status — betrifft 1 921 Vorgänge „nicht bewertbar"

Der Stillstands-Wächter braucht je Status eine Zielvorgabe („in Status X max. N Tage"). Gepflegt sind 7 von 74 Statuswerten; 1 921 Vorgänge sind darum „nicht bewertbar". Die App kann je Status einen Vorschlag aus der Ist-Verteilung berechnen (Median-Verweildauer, mit Stichprobengröße).

- [ ] **Option 1 (Empfehlung):** Median-Vorschläge für alle Statuswerte der Phasen Eingang bis Entscheidung übernehmen (je Zeile sichtbar, einzeln korrigierbar). Start heute, Nachschärfen im Betrieb.
- [ ] **Option 2:** PL setzt eigene Werte nur für eine Kernliste (bitte Statuswerte benennen: ______________________).
- [ ] **Option 3:** vorerst keine weiteren Zieltage (Wächter bleibt für 1 921 Vorgänge stumm).

### A3 · To-do-Sperren aus dem AB-Dashboard — betrifft u. a. 1 766 × „in QS"

Die To-do-Regeln wurden aus den WENN-Formeln des AB-XLSX übernommen — aber die Mappe filterte zusätzlich über **fixierte Slicer** („Bitte untere Auswahl nicht ändern"): Jahr, Erstentscheidung (D_AZ1_1), ZuwB (D_AZBE), Schlussvermerk (D_VV). Ohne diese Populations-Filter melden einzelne Regeln zu breit (z. B. „in QS": 1 766 Treffer, weil die Regel keine Endschranke kennt). Vorgeschlagene Rekonstruktion als Sperren in der Regel-Kaskade:

- **S0:** Schlussvermerk (D_VV) gefüllt → kein To-do („Verfahren abgeschlossen")
- **S3:** Erstentscheidung (D_AZ1_1) gefüllt → Gutachten-/QS-/NL-/NF-Stränge unterdrückt (Vor-Entscheidungs-Arbeit)
- Jahrgangs-Filter bleibt wie gebaut (Vorbelegung letzte 3 Jahrgänge, umschaltbar)

- [ ] **Option 1 (Empfehlung):** S0 + S3 wie vorgeschlagen einführen.
- [ ] **Option 2:** andere Abgrenzung — **Frage an die AB-Kollegen (= V5):** Welche Slicer-Werte waren in der Mappe fixiert? Antwort: ______________________

### A4 · Programme ohne Trigger — betrifft 6 952 Anträge (Altbestand)

Die Trigger-Zuarbeit deckt die Programme 76–79, 131, 136–139 ab (7 269 Anträge). Für 47, 36, 46, 34, 48, 35, 37 (6 952 Anträge, überwiegend Altbestand; 47 allein 4 190) führt sie nichts — Navigator und Trigger-Erklärung sagen dort ehrlich „für Programm N keine Trigger importiert".

- [ ] **Option 1:** Zustand belassen — die Programme sind stillgelegt, die Meldung ist korrekt.
- [ ] **Option 2:** Nachexport der Trigger für folgende Programme anfordern: ______________________
- **Fachfrage (= V8):** Führt das Fachsystem für diese Programme noch aktive Trigger-Definitionen? Antwort: ______________________

### A5 · Führende Status-Ebene in Listen

Real-Fall SPOROWIPE: TV-Status steht auf 72 (Stellungnahme RNE), Verbund-Status hängt auf 31 (beantragt) — das Fachsystem hat den VB-Status nie nachgezogen. Die Listen zeigen den **TV-Status** als führende Ebene; das Herleitungs-Popover weist beide Ebenen getrennt aus.

- [ ] **Option 1 (Empfehlung):** TV-Status führt, so belassen.
- [ ] **Option 2:** andere Regel: ______________________

---

## Teil B — Verifikationen (ändern kein Verhalten, härten die Daten)

| Nr | Frage | Antwort |
|---|---|---|
| V1 | RNE-Strang: Die AB-Mappe unterdrückt RNE-To-dos, sobald die kaufm. QS (D_XKS) erfolgt ist. Absicht oder Altlast? | |
| V2 | PreCheck: Wer führt ihn durch — FB? (bestimmt die Rollen-Anzeige bei „PC offen") | |
| V4 | Spalten-Zuordnung: D_QS = „Gutachten-QS fertig", D_QS- = „QS zurück an AB/FB" — korrekt? | |
| V6 | Trigger referenzieren vier Kürzel, die der Katalog nicht kennt: **ID, TTV1, TTV2, TVB1** — was sind sie? | |
| V7 | Trigger AZBE/Folge 1 steht in Programm 79 und 139 jeweils **doppelt** in der Zuarbeit — welcher Eintrag gilt? (Zeilen 893 / 2315) | |
| V9 | Mehrfach gesetzte Kürzel: Trägt die D_-Spalte im Export das **erste oder letzte** Datum? (bestimmt die Beschriftung des Verlaufs) | |
| V10 | Zuarbeit-Tippfehler: Blatt „Erklärung Parameter", Code 72 heißt dort „Stellungnahme zur **Rüchnahme**empfehlung" — bitte in der Quelle korrigieren (App führt beide Schreibweisen, kein Handlungsdruck) | |

*(V3 — Spaltenabdeckung des Nachtexports — ist erledigt/bestätigt; V5 und V8 stehen in A3/A4.)*

---

## Teil C — Zur Kenntnis: bereits umgesetzte Korrekturen (App v2.385)

Die neue Status-Lesebrille (amtlicher Code + ZAH-Phase) ersetzt die alte App-interne Ableitung. Gesamtbilanz am Bestand: 7 001 Vorgänge unverändert, **485 korrigiert** in 12 dokumentierten Mustern, 48 nicht vergleichbar. Die drei spürbarsten Korrekturen:

1. **„unvollständig" (Code 33) zählt jetzt als offene Arbeit** — vorher in keiner Arbeitsliste. Betrifft 6 TV: 16EP260127, 16EP260181, 16EP260185, 16KN099224, 16KN121392, 16KN136192. Fünf davon zählen neu als Auslastungs-Altlast (Band Q-1, Bearbeiter PaK, ED, SaZ ×2, JoHe) → +5 TV × „Stunden pro TV" in der Kapazitätsrechnung.
2. **Code 72 (Stellungnahme RNE) liegt jetzt in Phase Entscheidung** — vorher unter „Sonstige", unsichtbar. Betrifft 15 TV, u. a. SPOROWIPE, HELIX, SAVE.
3. **„NL eingegangen" zählt zur Nachforderung** — betrifft 52 TV, ohne Auslastungs-Wirkung.

Außerdem: Kuratierungs-Änderungen (Phasen-Umhängungen, Zieltage) wirken ab sofort **ohne neue App-Version** auf allen Rechnern; die Gleichheit der Anzeige bei gleichem Datenstand ist per Zweirechner-Test belegt. Offene technische Restpunkte (Zulässigkeits-Trigger-Parsing, Kürzel-Doppelfeld-Guard, Diff-Schreibweise) laufen als Sammel-Nacharbeit und brauchen keine Abstimmung.

---

**Rückgabe an:** Thomas · Entscheidungen A1–A5 + Antworten V1–V10 genügen formlos (Mail oder ausgefülltes Dokument). Umsetzungsaufwand nach Rücklauf: A1/A5 = Katalog-Zeilen, A2 = ein Übernahme-Klick je Status, A3 = eine Regel-Nacharbeit, A4 = ggf. ein XLSX-Re-Import.
