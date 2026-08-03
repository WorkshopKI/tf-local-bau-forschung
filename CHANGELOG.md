# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v2.388.0 — Zieltage-Sammelübernahme (August 2026)

MINOR — Der Stillstands-Wächter braucht je Status eine Zielvorgabe; gepflegt waren 7 von 74 Werten, weil jeder einzeln zu setzen war. Die Sammel-Übernahme macht daraus einen Schritt — mit Vorschau, und ohne zu raten, wo die Datengrundlage fehlt.

- „Vorschläge ansehen" im Katalog-Tab: Tabelle mit Status, Ebene, Phase, Stichprobe und alt → neu; Übernahme in **einem** `setState` ([ZieltageUebernahmeDialog.tsx](src/plugins/status-cockpit/ZieltageUebernahmeDialog.tsx), [zieltage-vorschlag.ts](src/core/status/zieltage-vorschlag.ts)).
- Nur die Phasen Eingang bis Entscheidung, nur ab 5 Beobachtungen — kleinere Stichproben werden benannt statt gesetzt.
- **Die Stichprobe zählte nur den Verbund-Status**: „NF gestellt" kam auf n = 2 und fiel durch die Grenze. Mit den TV-Status sind es n = 51 ([useStatusCockpit.ts](src/plugins/status-cockpit/useStatusCockpit.ts)).
- Gemessen am Bestand: „nicht bewertbar" 1937 → **1679**; von den verbleibenden 1982 (Vollbestand) sind 1769 der Status 59 „bewilligt", innerhalb der Antragsphasen bleiben **7**.

### v2.387.0 — Regelwerk aus der Fachabstimmung (August 2026)

MINOR — Die To-do-Kaskade kannte die fixierten Slicer der AB-Mappe nicht und meldete deshalb über den ganzen Altbestand („in QS": 1756). Mit den beiden Populations-Sperren steht die Arbeitsliste auf der Menge, die die ABs tatsächlich ansehen.

- **S0/S0b**: Schlussvermerk bzw. Zuwendungsbescheid beenden die Aufgabenliste eines Vorgangs; `sperrt: ['*']` erfasst auch später ergänzte Regeln, `sperrtNicht` nimmt „ZuwB erstellen" aus ([todo-regeln.seed.ts](src/core/status/todo-regeln.seed.ts), [todo-engine.ts](src/core/status/todo-engine.ts)).
- Gemessen am Bestand: „in QS" 1756 → **75**, „Meine Aufgaben" 1117 → 477, echte Regellücken 520 → **120**.
- **V1** (`D_XKS`-Gate am RNE-Strang) ist als Absicht bestätigt und jetzt Bedingung von R6–R9; **V2**: R23 ist nach Rollen in R23a (wartet auf AB) und R23b (wartet auf FB) geteilt.
- Das Board trennt „keine Regel traf" von „Verfahren abgeschlossen" — eine greifende Sperre ist ein Ergebnis, keine Lücke ([useVorgangsBoard.ts](src/plugins/vorgangs-board/useVorgangsBoard.ts)).
- Ein gewachsener Regelsatz erreicht bestehende Fassungen: der Status-Katalog zeigt die Drift und zieht sie nach (`zieheTodoRegelnNach`, [katalog-edit.ts](src/core/status/katalog-edit.ts)).

### v2.386.0 — Technische Sammel-Nacharbeit am Vorgangssystem (August 2026)

MINOR — Fünf Reste aus dem P6-Rückbau, die keine Fachabstimmung brauchten. Der größte war unsichtbar: die Trigger-Sidecar speicherte ihre eigene Deutung mit, sodass eine Parser-Verbesserung erst beim nächsten XLSX-Import gewirkt hätte.

- Zulässigkeits-Trigger (leere Zielstatus in `TRG_TVs_Status_TV_VB`) werden gedeutet statt verworfen — „nicht interpretiert" fällt am Bestand von 30 auf 7 ([trigger-parser.ts](src/core/status/trigger-parser.ts)).
- `geparst`/`satz` werden beim Laden neu abgeleitet statt aus der Datei übernommen — abgeleitete Werte werden nicht daneben persistiert (Pitfall #45, [trigger-share.ts](src/core/status/trigger-share.ts)).
- Der To-do-Regel-Editor arbeitet auf dem Katalog-Vokabular und meldet nicht referenzierbare Spalten sichtbar, statt eine stumme Regel zuzulassen ([todoFeldVorrat.ts](src/plugins/status-cockpit/todoFeldVorrat.ts), [bedingung.ts](src/core/status/bedingung.ts)).
- Neuer Konventionstest `kuerzel-genau-ein-speicherort` gegen die v2.376-Doppelfeld-Regression ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)).
- Import-Diffs zeigen die Original-Schreibweise (`76#AAE#1`), und ein Verbund mit uneinheitlicher `FM_NUMMER` wird gemeldet statt still geheilt ([programmNummer.ts](src/plugins/antraege/status/programmNummer.ts)).

### v2.385.1 — P6-Doku: Rückbau abgeschlossen (August 2026)

PATCH — Die Docs beschrieben noch die Ableitung, die es seit v2.385 nicht mehr gibt. Ist-Zustand nachgezogen, das Inventar als Protokoll geschlossen.

- [vorgangssystem.md](docs/architecture/vorgangssystem.md) Abschnitt 7 auf „umgesetzt": Vorher/Nachher-Tabelle, die vier Funde am Bestand, was bleibt und warum.
- [vorgangssystem-p6-inventar.md](docs/architecture/vorgangssystem-p6-inventar.md) auf erledigt — inkl. der vier Plan-Abweichungen (Prominenz bleibt, Code 73 bleibt `abgeschlossen`, `byte-identitaet` bleibt, Diagnose entfällt statt umgewidmet).
- **Pitfall #45** neu: Fassade aus Code+ZAH-Phase, Varianten über `indexNachSchreibweise`, Abgeleitetes nicht daneben persistieren ([CLAUDE.md](CLAUDE.md)).
- Kontext-Docs `status-cockpit` und `antraege` auf den Ist-Zustand ([docs/feedback-kontext/](docs/feedback-kontext/)); [status-system/README.md](docs/status-system/README.md) von drei auf zwei Schichten.
- Das CLAUDE.md-Diät-Ceiling steigt begründet auf 56 400 Bytes ([doc-links.test.ts](src/__tests__/doc-links.test.ts)).

### v2.385.0 — Rückbau der alten Statusableitung (August 2026)

MINOR — Die App rechnete aus dem ganzen `D_`-Feld-Ensemble eine eigene Verfahrensposition aus (höchster Rang gewinnt, `terminal` schlägt Rang) und lief dem amtlichen Status damit regelmäßig voraus. Sie tut es nicht mehr: das Fachsystem führt den Status, die App liest ihn (Pitfall #44).

- `ableitung.ts`, `spine-kategorie.ts`, `phasen-vergleich.ts` und die Diagnose-Sektion entfallen; mit ihnen `SpinePhase`, `rang`, `terminal` und die Ergebnistypen ([typen.ts](src/core/status/typen.ts)).
- Die Feld-Phase wandert von der Spine- auf die ZAH-Achse (24 Felder, je Feld begründet) — sie speist „seit wann gilt der Status" und die Chronik-Marke ([seed-codes.ts](src/core/status/seed-codes.ts), [herleitung.ts](src/core/status/herleitung.ts)).
- Katalog-Tab ohne Spine-Phase/Rang/terminal, Kürzel-Tab mit ZAH-Phase statt Rang, Simulations-Leiste entfällt ([KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx), [FelderTab.tsx](src/plugins/status-cockpit/FelderTab.tsx)).
- Die fünf alten „Nächste-Schritte-Regeln" entfallen; sie gehen im AB-To-do-Regelsatz auf — die Zuordnung steht im Kopf von [RegelnTab.tsx](src/plugins/status-cockpit/RegelnTab.tsx).
- Der Import prüft die To-do-Kaskade statt der Alt-Regeln und lässt dabei Begleit-Textspalten (`T_XPC+`) als Referenz zu ([export-import.ts](src/core/status/export-import.ts)).

### v2.384.0 — Anzeige auf ZAH-Phasen umgehängt (August 2026)

MINOR — Die Oberfläche zeigte drei verschiedene Antworten auf dieselbe Frage „wo steht dieser Antrag?": die abgeleitete Spine-Phase im Verbund-Kopf, eine handgeschriebene Phasen-Liste in der Filter-Sidebar und die ZAH-Phase im Popover. Ab hier ist es eine — die des Status-Katalogs.

- Der Verbund-Kopf zeigt die sechs ZAH-Phasen; Marker (Irrläufer, Sonderstatus) stehen als Kennzeichen **neben** der Leiste, und ein Status ohne Katalog-Treffer betont keine Station mehr ([statusZuStepperPosition.ts](src/plugins/antraege/statusZuStepperPosition.ts), [WorkflowStepper.tsx](src/plugins/antraege/WorkflowStepper.tsx)).
- Die Filter-Sidebar gruppiert nach ZAH-Phasen auf Code-Ebene: eine Zeile je Code, Schreibweisen kollabieren mit Summen-Zählung, Marker als eigene Gruppe ([statusGroups.ts](src/plugins/antraege/filter/statusGroups.ts), [StatusFilterFacet.tsx](src/plugins/antraege/filter/facets/StatusFilterFacet.tsx)).
- „Warum dieser Status?" und das Konflikt-Badge entfallen — beide erklärten eine Ableitung, die es nicht mehr gibt; die Frage beantwortet das Herleitungs-Popover ([StatusDetailSection.tsx](src/plugins/antraege/status/StatusDetailSection.tsx)).
- Home-Widget „Status & Verlauf" zeigt ZAH-Phase + To-do aus der Kaskade statt abgeleiteter Phase + Alt-Regel-Schritt ([StatusVerlaufWidget.tsx](src/plugins/home/widgets/StatusVerlaufWidget.tsx)).
- Das Artefakt-Gate hängt an der Phase statt an einer Stations-Nummer — die alte Station 3 deckte Prüfung UND Entscheidung ab ([useArtefaktLeiste.ts](src/plugins/antraege/artefakte/useArtefaktLeiste.ts)).

### v2.383.0 — Fassade aus Code-Join und ZAH-Phase (August 2026)

MINOR — Die Kategorie-Fassade hielt eine zweite, handgeschriebene Werteliste neben dem Code-Katalog. Sie kannte nur 21 der 30 amtlichen Statuscodes unter ihrem amtlichen Namen; bei Code 72 ging das schon schief — der Export schreibt „Stellungnahme zur Rücknahmeempfehlung" aus, die Tabelle kannte nur die Abkürzung, und 16 Vorgänge lagen deshalb unter `sonstige`.

- `getStatusCategory` wird intern aus Rohtext → Code → ZAH-Phase → Kategorie gespeist; flag-unabhängig in der eingebauten Map, nicht nur im Snapshot ([kategorie-ableitung.ts](src/core/status/kategorie-ableitung.ts), [status-canonical.ts](src/core/utils/status-canonical.ts)).
- Varianten-Auflösung an **einer** Stelle statt in dreien — Snapshot, Phasen-Vergleich und Ableitung schlagen über dieselbe Regel nach ([wert-index.ts](src/core/status/wert-index.ts)).
- Der Snapshot leitet die Kategorie aus Phase + Code ab, statt sie aus der Fassung zu übernehmen: eine ältere Fassung schleppte sonst ihre Kategorien mit, und eine PL-Umhängung wirkte nicht ([snapshot.ts](src/core/status/snapshot.ts)).
- Golden Test friert die zwölf Abweichungs-Muster ein; die Dev-Diagnose kopiert die Bilanz als Text, ohne Verbund-IDs ([phasen-vergleich-golden.test.ts](src/core/status/__tests__/phasen-vergleich-golden.test.ts), [DiagnoseSektion.tsx](src/plugins/status-cockpit/DiagnoseSektion.tsx)).
- Sechs dokumentierte Kategorie-Deltas, drei davon im Bestand wirksam: `unvollständig` (+6), `NL eingegangen` (52 → Nachforderung), Code 72 (+16) — Details in [phasen-vergleich-muster.ts](src/core/status/__tests__/fixtures/phasen-vergleich-muster.ts).

### v2.382.0 — Vorab-Fixes vor dem Ableitungs-Rückbau (August 2026)

MINOR — Drei kleine Korrekturen an genau den Flächen, die nach dem Rückbau der alten Statusableitung (P6) die einzigen sind: der Wächter zählte Termine als Bearbeitung, das Herleitungs-Popover sagte nicht, welchen Status es erklärt, und dieselbe Seite zeigte drei Datumsformate nebeneinander.

- Zukunftsdaten zählen nicht mehr als „letzte Aktivität" und werden als anstehender Termin gesondert ausgewiesen; eine zweite Liegezeit-Rechnung im Cockpit entfällt zugunsten von `letzteAktivitaetVon` ([waechter.ts](src/core/status/waechter.ts), [useStatusCockpit.ts](src/plugins/status-cockpit/useStatusCockpit.ts)).
- Das Herleitungs-Popover benennt die Ebene („Verbund-Status: 31 · beantragt") und stellt einen abweichenden Status der Gegenseite darunter, mit Stückzahl bei mehreren Teilvorhaben ([HerleitungPopover.tsx](src/plugins/antraege/status/HerleitungPopover.tsx), [useHerleitung.ts](src/plugins/antraege/status/useHerleitung.ts)).
- `statusKurz` als geteilter Kopf beider Ebenen; „Herleitung kopieren" trägt dieselbe Ebenen-Angabe wie der Bildschirm ([herleitung.ts](src/core/status/herleitung.ts)).
- Eine Datums-Anzeigekette (`formatDatumsWert`) ersetzt vier lokale Formatierer; das Alle-Felder-Panel formatiert feldnamens-unabhängig, auch uneinheitliche Verbund-Werte („29.08.2025 / 01.09.2025") ([dateParse.ts](src/core/services/csv/dateParse.ts), [buildDisplayRows.ts](src/plugins/antraege/alleFelder/buildDisplayRows.ts)).
- Der Meilenstein-Streifen schreibt Daten mit führender Null wie der Rest der Detailseite ([meilensteine/labels.ts](src/plugins/meilensteine/labels.ts)).

### v2.381.0 — Parametertabelle im Legenden-Format (August 2026)

MINOR — Der zweite Import derselben Mappe scheiterte an der echten Datei: „Erklärung Parameter" ist eine Legende ohne Kopfzeile (Wert · Erklärung · Kategorie), der Import verlangte einen `Code`/`Text`-Kopf und brach ab — der Statuscode-Katalog kam nie aus der amtlichen Quelle. Und hätte er gelesen, wären die Bezugsdatei-Nummern 210/211 als Statuscodes im Katalog gelandet.

- Beide Formate über einen Parser: Legende (Spaltenschnitt über die Kategorie-Spalte gesucht, Beschriftungszeile verworfen) und die bisherige Kopfzeilen-Tabelle ([parameter-blatt.ts](src/core/status/import/parameter-blatt.ts)).
- Im Legenden-Format entscheidet die Kategorie-Spalte, nicht der Inhalt — Codes nur aus „Status"-Zeilen, 210/211 bleiben draußen ([status-katalog-import.ts](src/core/status/import/status-katalog-import.ts)).
- Übersprungene Zeilen werden je Art gezählt und in der Vorschau benannt, als Auskunft statt als Warnung ([ReferenzdatenSektion.tsx](src/plugins/status-cockpit/ReferenzdatenSektion.tsx)).
- Bearbeiter-Kürzel und die Nummern 210/211 werden gegen `MAIL_ROLLE` bzw. `ebeneVonNummer` geprüft, nicht gespeichert — die Zuarbeit belegt damit eine bisher nur erschlossene Lesart ([trigger-parser.ts](src/core/status/trigger-parser.ts)).
- XLSX-Leser in IO (`leseMappe`) und reine Kopfsuche (`findeKopfInMappe`) getrennt; die Mappe wird einmal gelesen ([xlsx-tabelle.ts](src/core/status/import/xlsx-tabelle.ts)).

### v2.380.0 — Trigger-Import je Programm (August 2026)

MINOR — Der erste echte Import zeigte, dass die Trigger-Zuarbeit ~2450 Zeilen über neun Richtlinien führt, der Importer aber nur nach (Kürzel, Folge) schlüsselte: 362 Zeilen blieben übrig, der Rest fiel als „Dublette" weg — und jeder Antrag bekam danach die Trigger der ersten Richtlinie. Dieselbe Datei widerlegte drei weitere Screenshot-Annahmen aus P0.

- Programm ist Teil des Schlüssels und wird je Antrag über `FM_NUMMER` aufgelöst; fehlt die Spalte, bricht der Import ab statt teilweise zu laden ([trigger-import.ts](src/core/status/import/trigger-import.ts), [trigger-share.ts](src/core/status/trigger-share.ts)).
- Argumente von `TRG_TVs_Status_TV_VB` stehen an acht festen Positionen und werden von vorn gelesen; Komma-Listen sind UND-Listen ([trigger-parser.ts](src/core/status/trigger-parser.ts)) — kehrt die P0-Lesart „von beiden Enden" um, die auf einem Screenshot beruhte.
- Blätter werden namentlich gewählt („Trigger-Prozeduren", „Erklärung Parameter"), sonst die ganze Mappe durchsucht ([xlsx-tabelle.ts](src/core/status/import/xlsx-tabelle.ts)).
- „Erklärung Parameter" liefert zusätzlich die Textbaustein-Legende der Mail-Trigger und prüft die Bearbeiter-Kürzel gegen `MAIL_ROLLE` ([status-katalog-import.ts](src/core/status/import/status-katalog-import.ts)).
- **Migrationsnotiz:** die Trigger-XLSX muss einmal neu eingelesen werden — Zeilen ohne Programm greifen an keinem Antrag, die Referenzdaten-Sektion sagt es ([vorgangssystem.md](docs/architecture/vorgangssystem.md)).

### v2.379.1 — Vorgangssystem: P6-Inventar und Doku (August 2026)

PATCH — Abschluss des Vorgangssystem-Laufs P0–P5. P6 (Rückbau der alten Ableitung) bekommt sein Inventar mit gemessenen Zahlen statt einer Schätzung; Konzept und CLAUDE.md ziehen auf den Ist-Stand nach.

- P6-Inventar: 99 `SpinePhase`-Stellen in 20 Dateien, je Datei ein Vorschlag, Reihenfolge und Abnahme-Kriterium ([vorgangssystem-p6-inventar.md](docs/architecture/vorgangssystem-p6-inventar.md)).
- Abnahme-Kriterium präzisiert: nicht „null Abweichungen" (unerreichbar), sondern **null unerklärte** — die 490 zerfallen in 12 Muster mit zwei Ursachen.
- Konzept-Doc auf Ist-Zustand: Umsetzungsstand je Phase, vier begründete Abweichungen, sechs Messwerte aus dem Bestand ([vorgangssystem.md](docs/architecture/vorgangssystem.md)).
- Pitfall #44 + Decision-Tree-Zeile; CLAUDE.md-Ceiling mit Begründung angehoben ([doc-links.test.ts](src/__tests__/doc-links.test.ts)).

### v2.379.0 — Fristen-Cockpit mit wirksamem Eingang (August 2026)

MINOR — Bearbeiter und PL führen ihre Fristenlisten heute per Hand in Excel. Zwei zusätzliche Sichten im Vorgangs-Board ersetzen sie: Restfrist je Antrag ab wirksamem Eingang, und die Bestandsauswertung für die PL — beide als XLSX exportierbar.

- `wirksamerEingang` = spätestes von Antragseingang und „alle Anträge da"; bewusst additiv, `computeFristDatum` bleibt unangetastet ([frist.ts](src/core/services/csv/frist.ts)).
- Bearbeiter-Sicht: Restfrist mit Ampel (rot ≤ 14, gelb ≤ 30 Tage), Bezugsdatum in eigener Spalte, To-do und Wächter-Urteil daneben ([CockpitSichten.tsx](src/plugins/vorgangs-board/CockpitSichten.tsx)).
- PL-Sicht: Verteilung über die ZAH-Phasen, Liegezeit je Status mit Median, p90 und n, Fristrisiko-Liste, Stau je Rolle ([CockpitSichten.tsx](src/plugins/vorgangs-board/CockpitSichten.tsx)).
- XLSX-Export beider Sichten — genau die Zeilen, die auf dem Bildschirm stehen ([cockpit-export.ts](src/plugins/vorgangs-board/cockpit-export.ts)).
- Fix: die Antragsfrist läuft nur in der Antragsphase. Ohne dieses Kriterium führte die Liste 2 850 abgeschlossene Vorgänge mit „853 T über" an ([useVorgangsBoard.ts](src/plugins/vorgangs-board/useVorgangsBoard.ts)).

### v2.378.0 — Stillstands-Wächter mit Zieltagen und Rollen-Stau (August 2026)

MINOR — Ein vergessenes Kürzel fällt heute niemandem auf: der Vorgang steht einfach still. Der Wächter misst die Zeit seit der letzten Vorgangs-Aktivität gegen Zieltage je Status und benennt, wo möglich, auf wessen Schreibtisch es liegt.

- Wächter mit zwei Stufen: generische Liegezeit und, wo ein Kürzel-Paar halb offen ist, die hängende Rolle ([waechter.ts](src/core/status/waechter.ts)).
- „unbewertet" ist ein eigenes Urteil, nie „ok": ohne gepflegte Zieltage fehlt die Grundlage, und das steht dann auch da ([waechter.ts](src/core/status/waechter.ts)).
- Zieltage-Spalte im Katalog-Tab, je Zeile mit Vorschlag aus der Ist-Verteilung samt Stichprobengröße ([KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx)).
- Home-Widget „Hängt fest" (Opt-in): eigene Vorgänge nach Liegezeit, mit Grund und Rolle ([HaengtFestWidget.tsx](src/plugins/home/widgets/HaengtFestWidget.tsx)).
- Board: Filter „hängt fest" plus Stau je Rolle im Kopf — die unbewerteten stehen daneben, nie darin ([VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx)).

### v2.377.0 — To-do-Engine mit AB-Regelsatz und Vorgangs-Board (August 2026)

MINOR — Die AB-Kolleginnen rechnen ihr „was steht an?" heute als verschachtelte WENN-Formel in einer privaten XLSX-Mappe. Dieselbe Kaskade läuft jetzt als versionierte Team-Regelmenge, und ein Board zeigt das Ergebnis — mit der Regel und den gelesenen Feldwerten daneben, damit ein To-do nachvollziehbar bleibt statt behauptet.

- To-do-Engine: geordnete Kaskade, erste zutreffende Regel gewinnt, Sperren legen ganze Stränge still; kein Treffer ist ein sichtbares Ergebnis ([todo-engine.ts](src/core/status/todo-engine.ts)).
- AB-Regelsatz als Auslieferung: 25 Regeln + 2 Sperren aus der Mappe transkribiert, je Regel ein positives Fixture im Test ([todo-regeln.seed.ts](src/core/status/todo-regeln.seed.ts)).
- Neues Plugin „Vorgangs-Board" (erprobung, dev+pl): drei Sichten desselben Regelsatzes — eigene Aufgaben, Warten auf andere, kein To-do ([VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx)).
- Regel-Pflege im Status-Katalog: jede Regel als deutscher Satz, Reihenfolge über Pfeile, Bedingung über den geteilten Editor der Meilensteine ([TodoRegelnBereich.tsx](src/plugins/status-cockpit/TodoRegelnBereich.tsx)).
- Vorbelegung „letzte 3 Jahrgänge": über alle Jahre meldete allein „ZuwB erstellen" 6 607 Aufgaben — Altbestand, der die Spalte nie geführt hat ([useVorgangsBoard.ts](src/plugins/vorgangs-board/useVorgangsBoard.ts)).

### v2.376.0 — Kürzel-Glossar, Relevanz, Nächster-Schritt-Navigator (August 2026)

MINOR — „Viele kennen die Kürzel nicht" war der meistgenannte Einstiegshemmnis. Der Kürzel-Tab wird zum Glossar (Bezeichnung, Rolle, Trigger-Wirkung in Satzform), die Relevanz-Häkchen grenzen die 505 Kürzel auf die ~30 der Antragsbearbeitung ein, und am Verbund steht, welche davon unter dem aktuellen Status überhaupt greifen würden.

- „Nächste Schritte (im Foyer zu setzen)" am Verbund: Kandidaten aus den Trigger-Vorbedingungen, mit Wirkung, Rolle und Grund, wo eine Bedingung nicht prüfbar war ([NaechsteSchritte.tsx](src/plugins/antraege/status/NaechsteSchritte.tsx), [navigator.ts](src/core/status/navigator.ts)).
- Kürzel-Tab (vormals „Felder"): Relevanz-Häkchen, aufklappbare Trigger-Wirkung, Filter „nur relevante"/„nur mit CSV-Spalte"; Abgleich-Banner in eigene Datei ([FelderTab.tsx](src/plugins/status-cockpit/FelderTab.tsx), [FelderAbgleich.tsx](src/plugins/status-cockpit/FelderAbgleich.tsx)).
- Relevanz-Startvorschlag aus den 31 Spalten des AB-Dashboards — setzt nur Häkchen, nimmt nie welche weg ([seed-codes.ts](src/core/status/seed-codes.ts), [katalog-edit.ts](src/core/status/katalog-edit.ts)).
- Fix: „Nachziehen" legte vier Kürzel doppelt an (kanonisches Feld **und** eigene Spalte); das Kürzel galt dadurch überall als nie gesetzt — kritisch bei `ABB`, das fast jede Trigger-Bedingung prüft ([seed.ts](src/core/status/seed.ts), [katalog-edit.ts](src/core/status/katalog-edit.ts)).
- Fix: kanonisch gemappte Spalten (`D_AAE` → `antragsdatum`) waren unter ihrem Kürzel-Namen nicht auffindbar — der Tab meldete für zwei Kernspalten „nicht im Export" ([cockpit-berechnung.ts](src/core/status/cockpit-berechnung.ts)).

### v2.375.0 — Status-Erklärung mit Herleitungs-Popover (August 2026)

MINOR — „Warum steht der Antrag auf diesem Status, und was ist zuletzt passiert?" beantwortete bisher niemand — die Kürzel des Fachsystems kennen nicht alle. Ein graues Info-Icon an jeder Status-Anzeige rendert die Antwort vollständig aus Daten, ohne handgepflegten Text, der veralten könnte.

- Herleitungs-Popover an Liste und Verbund-Detail: Code + Text + ZAH-Phase, letzter Vorgang mit Rolle, Verlaufs-Näherung, Datenstand, „Herleitung kopieren" ([HerleitungPopover.tsx](src/plugins/antraege/status/HerleitungPopover.tsx)).
- Reiner Aufbau mit injiziertem Stichtag; „seit wann" bleibt LEER, wenn kein passendes Datum existiert, statt das jüngste beliebige zu nehmen ([herleitung.ts](src/core/status/herleitung.ts)).
- Inhalt lädt erst beim Öffnen — sonst ginge jede der 13 000 Listenzeilen beim Rendern auf die IndexedDB ([useHerleitung.ts](src/plugins/antraege/status/useHerleitung.ts)).
- Die Phase greift auf den Auslieferungs-Schnitt zurück, solange eine Bestandsfassung noch keine Codes trägt — sonst stünde dort wochenlang „keine Phase" ([herleitung.ts](src/core/status/herleitung.ts)).
- Guard: alle 25 im Bestand vorkommenden Statuswerte lösen auf einen Code auf; er sichert vor allem die Export-Varianten „Ablehnung"/„Rücknahmeempfehlung"/„VN techn. geprüft" ([status-codes.test.ts](src/core/status/__tests__/status-codes.test.ts)).

### v2.374.0 — Vorgangssystem-Fundament: Status-Codes, ZAH-Phasen, Trigger-Parser, Referenz-Importe (August 2026)

MINOR — Die App soll **Companion** des Fachsystems werden statt zweiter Workflow-Engine: `STATUS_TV`/`STATUS_VB` werden angezeigt wie importiert, alles Neue (Erklärung, Navigation, Warnung) steht daneben. Phase 0 legt das Fundament — Codes, Phasen, Trigger — additiv im bestehenden `src/core/status/`, ohne die alte Ableitung anzufassen.

- Status-Code-Katalog (11 Skizze … 99 Schlussvermerk) + NFC-Join Text→Code mit Varianten und ehrlichem „nicht im Katalog" ([status-codes.ts](src/core/status/status-codes.ts), [normalisierung.ts](src/core/status/normalisierung.ts)).
- ZAH-Phasen als eigene Achse neben der alten Spine-Phase; Marker (29/88/93/94) bewusst ohne Phase ([zah-phasen.ts](src/core/status/zah-phasen.ts)).
- Trigger-Parser für die vier Legacy-Prozeduren mit deutscher Satzform; Unlesbares bleibt als „nicht interpretiert" erhalten ([trigger-parser.ts](src/core/status/trigger-parser.ts)).
- Zwei XLSX-Referenz-Importe mit Diff-Vorschau; Trigger als Geschwister-Sidecar, weil sie in der Katalog-Datei zehnmal mitgereist wären (2,4 → 6,8 MB gemessen) ([import/](src/core/status/import/), [trigger-share.ts](src/core/status/trigger-share.ts)).
- Dev-Diagnose „Phasen-Vergleich": 490 Abweichungen im Bestand, verdichtet auf 12 systematische Muster — Entscheidungsgrundlage für den späteren Rückbau ([phasen-vergleich.ts](src/core/status/phasen-vergleich.ts)).

### v2.373.1 — Temperatur gemessen statt geraten (August 2026)

PATCH — v2.373.0 senkte den Standard auf 0,4, weil ein quellentreuer Text wenig Streuung brauche — belegt war das mit sechs Läufen an einer VB. 125 Läufe über 25 fiktive Vorhabensbeschreibungen zeigen: zwischen 0,2 und 1,0 gibt es keinen messbaren Unterschied in der Regeltreue, der ganze Abstand liegt unter dem Standardfehler.

- `TEMPERATUR_STANDARD = 1.0` schreibt die Server-Voreinstellung fest statt sie zu erben — Reproduzierbarkeit, keine Qualitätsaussage; ein Test hält den Wert ([sampling.ts](src/core/services/ai/sampling.ts)).
- `TEMPERATUR_SICHER`/`TEMPERATUR_MUTIG` → `TEMPERATUR_STANDARD`/`TEMPERATUR_ZWEITFASSUNG`; die Namen behaupteten eine Wirkung, die es nicht gibt ([zweitfassung.ts](src/plugins/antraege/gutachten/zweitfassung.ts)).
- Zweitfassung heißt jetzt „mit anderer Einstellung"; der v2.373.0-Marker `'mutig'` wird nur noch gelesen, statt gespeicherte Fassungen durchfallen zu lassen ([sampling.ts](src/core/services/ai/sampling.ts)).
- Mess-Aufbau + die beiden Fallen (Denkprozess an statt aus, zweiter Prozess am selben Server) dokumentiert ([gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md)).

### v2.373.0 — Sampling-Temperatur steuerbar, Zweitfassung auch ohne Bridge (August 2026)

MINOR — Die App sendete bisher **keinen** Sampling-Parameter: jeder Skill-Lauf fuhr still auf der Server-Voreinstellung (internes llama.cpp `temperature: 1.0`), während die Node-Eval derselben Skills auf 0 maß. Damit fehlte auch die naheliegende Zweitfassung an einer direkt angebundenen KI, wo es keinen zweiten Tab gibt.

- Zwei Temperatur-Konstanten, fest im Code, ohne Einstellung in der Oberfläche; `runSkill` setzt sie immer, DirectLLM schreibt sie in den Body ([sampling.ts](src/core/services/ai/sampling.ts), [direct-llm.ts](src/core/services/ai/transports/direct-llm.ts)).
- „Zweitfassung mit mutigerer Einstellung" — der Menü-Eintrag entfällt ohne Bridge nicht mehr, was er variiert steht in der Beschriftung ([zweitfassung.ts](src/plugins/antraege/gutachten/zweitfassung.ts)).
- `StepRun.fassung` hält die mutigere Einstellung am Lauf fest → Fußzeile, Verlaufs-Tabs und Meta-Zeilen unterscheiden die beiden Fassungen ([runner.ts](src/plugins/antraege/gutachten/runner.ts), [VersionVerlauf.tsx](src/plugins/antraege/kurzfassung/VersionVerlauf.tsx)).
- Die Prompt-Ansicht nennt die Temperatur in der Fußzeile — sonst wäre der Wert wieder unsichtbar ([PromptAnsichtDialog.tsx](src/plugins/antraege/gutachten/PromptAnsichtDialog.tsx)).
- **Gemessen, nicht bestätigt**: 3 Läufe bei ~1.0 hielten das Zeichenlimit, 3 bei 0,4/0,9 rissen es um 42–73 Zeichen — die erwartete bessere Regeltreue zeigte sich nicht ([gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md)).

### v2.372.4 — Sortier-Auswahl aus einer Quelle, drei Journey-Korrekturen (August 2026)

PATCH — Beim Nachtesten des Startseiten-Reviews fiel auf, dass die „Sortiert nach"-Pille eine **zweite** Options-Liste führte: in der Sicht „Bewilligt" zeigte sie „Neueste zuerst", während nach Bewilligungsdatum sortiert wurde — und dieser Schlüssel war nicht anwählbar. Dazu die drei offenen Journey-Befunde D2–D4.

- Sortier-Optionen kommen nur noch aus [sort.ts](src/plugins/antraege/sort.ts); die Pille liest sie über das reine [sortSeg.ts](src/plugins/antraege/filter/sortSeg.ts), die Doppel-Liste in [QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx) ist entfallen.
- Beschriftungen benennen das Feld statt der Richtung allein: „Eingang (neueste)" / „Bewilligung (älteste)" / „Frist (kürzeste)" — letztere hieß im Katalog „Älteste Eingänge zuerst" und beschrieb damit einen anderen Vergleich ([sort.ts](src/plugins/antraege/sort.ts)).
- Der „Hilfe"-Knopf nennt die Einführungs-Tour, solange sie offen ist — der pulsende Punkt daneben war `aria-hidden` und ohne Tooltip ([SeitenHilfeButton.tsx](src/components/help/SeitenHilfeButton.tsx)).
- „+10 mehr anzeigen" nennt jetzt den Rest, den es nicht zeigt („+10 anzeigen (628 weitere)"), und der doppelte Zähler unter der Liste ist weg ([MeineAntraegeSection.tsx](src/plugins/home/MeineAntraegeSection.tsx)).
- Der Sync-Punkt behauptet keine Aktualität mehr, die er nicht kennt — er meldete „Anträge sind aktuell", während der CSV-Punkt daneben offene Importe zeigte ([SyncStatusIndicator.tsx](src/components/ui/SyncStatusIndicator.tsx)).

### v2.372.3 — Kontext-Warnung und Fusszeile benennen nur eine KI, die es gibt (August 2026)

PATCH — Beim Testlauf gegen einen fiktiven Antrag am lokalen llama.cpp benannten zwei Stellen eine KI, die es dort gar nicht gibt: die Kontext-Warnung sprach vom „Fenster der Standard-KI", und die Fußzeile schrieb „· Standard-KI" unter einen Text, der nie über die Bridge lief. Ohne Bridge existieren weder Standard- noch agentischer Tab.

- Kontext-Warnung sagt jetzt „ins Fenster des Modells", wo kein Bridge-Ziel wirkt (`KontextBefund.fensterLabel`, [kontextWarnung.ts](src/plugins/antraege/gutachten/kontextWarnung.ts), [GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)).
- `applyLaufZiel(..., null)` **entfernt** den KI-Stempel statt ihn zu überspringen — der Schritt wird fortgeschrieben, ein Rest aus einem früheren Bridge-Lauf überlebte sonst ([runner.ts](src/plugins/antraege/gutachten/runner.ts), [workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts)).
- Gesichtet an einem echten Lauf: fiktive VB (77.023 Zeichen) auf einem Verbund der local-Kopie, Abschnitt A dreimal über das lokale Qwen — Vorschau und „Zuletzt gesendet" byte-identisch, 6 von 6 Regeln erfüllt ([gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md)).

### v2.372.2 — Startseite: Zahlen eindeutig, Layout entdichtet, Abnahme-Regel (August 2026)

PATCH — Stufe 3+4 des Startseiten-Reviews. „Offen" ist jetzt festgelegt: **909 = offene Vorgänge mit gültigem Eingangsdatum** (die Antragsliste zeigt unter „Offen" dieselbe Zahl). Konkurrierende Zahlen und dreifache Wiederholungen sind aufgelöst, die Seite füllt wieder ihren Platz.

- Kopfzeile trägt nur noch die Gesamtzahl — die Aufteilung stand wortgleich als Kachel im Hero-Band und als Zeile im Antragseingang-Widget ([homeSubtitle.ts](src/plugins/home/homeSubtitle.ts), [HomePage.tsx](src/plugins/home/HomePage.tsx)).
- „638 Anträge · 930 TVS" las sich als zweite Gesamtzahl; jetzt „638 Einträge · 930 Teilvorhaben" mit erklärendem Titel, und der doppelte Knopf „Zu meinen Anträgen →" ist weg (er tat dasselbe wie „Alle →" im Kartenkopf) — [MeineAntraegeBalken.tsx](src/plugins/home/MeineAntraegeBalken.tsx).
- Seitenspalte 260 → 300 px (das Widget schnitt seinen eigenen Titel ab) und „Meine Anträge" startet mit 10 statt 5 Zeilen — die Seite endete bei 43 % Leerraum ([HomeZweiSpalten.tsx](src/plugins/home/HomeZweiSpalten.tsx), [HomePage.tsx](src/plugins/home/HomePage.tsx)).
- Das schmalste Balken-Segment zeigt seine Zahl wieder (Schwelle 8 % → 4 %, darunter wandert sie in die Legende); die Segment-Tooltips nennen das Kalenderquartal ([DistributionBar.tsx](src/components/ui/DistributionBar.tsx), [quartalBuckets.ts](src/plugins/home/quartalBuckets.ts)).
- **Abnahme-Regel neu**: sichtbare Änderungen prüft Claude Code selbst in der Variante „local"; beim Nutzer bleibt nur, was der Dev-Server nicht zeigen kann ([CLAUDE.md](CLAUDE.md), [local-variante.md](docs/architecture/local-variante.md)).

### v2.372.1 — Wortwahl Startseite: Eingangsalter statt Frist, KI statt AI (August 2026)

PATCH — Stufe 2 des Startseiten-Reviews (v2.371.1). Der 90-Tage-Wert ist ein **Alter**, keine Frist — „über der 90-Tage-Frist" las sich als versäumter Termin, „nähern sich" hatte kein Objekt. Stellen, die eine echte Frist meinen (`frist_datum`, Meilensteine), behalten das Wort.

- Kopfzeile + Hero-Kacheln sprechen jetzt Alter („älter als 90 Tage" / „zwischen 31 und 90 Tagen") und leiten die Grenzen aus der Widget-Config ab — bis hierher stand „90" im Text, während nach der Config gezählt wurde ([homeSubtitle.ts](src/plugins/home/homeSubtitle.ts), [HomeHero.tsx](src/plugins/home/HomeHero.tsx)).
- „AI-Assistent" war die einzige englische Schreibweise der Oberfläche — direkt über dem „KI-Variante"-Umschalter derselben Karte; jetzt „KI-Assistent" ([widgetCatalog.ts](src/plugins/home/widgets/widgetCatalog.ts), [AiAssistantCard.tsx](src/plugins/home/AiAssistantCard.tsx)).
- Vier Kopien von „vor N T" (neben ausgeschriebenen „≤ 30 Tage") laufen über den geteilten `alterInTagen` ([relativeZeit.ts](src/core/utils/relativeZeit.ts)).

### v2.372.0 — Prompt sichtbar, Prompt-Defekte behoben, Kontext-Warnung, Zweitfassung mit der anderen KI (August 2026)

MINOR — Die KI-Kurzfassung eines 60-seitigen Antrags war unbrauchbar, und niemand konnte nachsehen, warum: der Skill-Editor zeigt die Vorlage, nicht den Lauf. Dazwischen lagen neun angehängte Blöcke, eine am Kontextfenster gekappte Vorhabensbeschreibung und drei Widersprüche. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Prompt-Ansicht** an der Karte und vor dem ersten Lauf: Maße, Bausteine, Wortlaut — als Vorschau und als das zuletzt Gesendete, aus derselben Kette wie der Lauf ([PromptAnsichtDialog.tsx](src/plugins/antraege/gutachten/PromptAnsichtDialog.tsx), [renderSkillPrompt](src/core/services/skills/run/run-skill.ts)).
- **Bugfix:** Der unsichtbare JSON-Ausgabe-Block widersprach jeder kuratierten Teil-Reihenfolge und wurde vom automatischen Feinschliff ohnehin verworfen — aus allen Gutachten-Skills entfernt ([Migration `ga-teilstruktur-entfernen-2026-08`](src/core/services/skills/registry/migrations.ts)).
- **Bugfix:** Zeichenlimit und Satzvorgaben waren gemeinsam nicht erfüllbar; der Prompt benennt jetzt den Vorrang, der Skill-Editor meldet Widerspruch und Dopplung ([check-engine.ts](src/core/services/skills/registry/check-engine.ts)).
- **Kontext-Warnung vor dem Lauf** statt Vermerk danach, inkl. Empfehlung zur anderen KI; `kontextBedarf` je Schritt kuratierbar ([kontextWarnung.ts](src/plugins/antraege/gutachten/kontextWarnung.ts), [WorkflowEditor.tsx](src/plugins/skill-verwaltung-kuration/WorkflowEditor.tsx)).
- **Zweitfassung mit der anderen internen KI** in den vorhandenen Versionsverlauf (Diff + Übernehmen), je Fassung mit ihrer KI beschriftet ([ziel-fallback.ts](src/core/services/ai/ziel-fallback.ts), [VersionVerlauf.tsx](src/plugins/antraege/kurzfassung/VersionVerlauf.tsx)).

### v2.371.1 — Startseiten-Review: Sidebar-Latch, Dark-Mode-Persistenz, tote QS-Kachel (August 2026)

PATCH — Erster Sicht-Check der Startseite über die Variante „local" (v2.371). Fünf Befunde, die im Bild messbar waren; die übrigen (widersprüchliche Zahlen, sechs Namen für einen Sachverhalt, Layout) brauchen fachliche Entscheidungen und folgen getrennt.

- **Bugfix:** Ein einmal schmales Fenster rastete die Icon-Leiste dauerhaft ein — der erzwungene Mobil-Modus schrieb in denselben State, der persistiert wird. Wahl und Zwang sind jetzt getrennt ([sidebarModus.ts](src/core/nav/sidebarModus.ts), [ShellLayout.tsx](src/core/ShellLayout.tsx)).
- **Bugfix:** Dark Mode überlebte den Neustart nur über die Einstellungen, nicht über Strg+Umschalt+D oder die Command Palette — jetzt EIN Weg für beides ([useDarkMode.ts](src/core/hooks/useDarkMode.ts)), bewacht von `no-raw-set-dark-mode`.
- Hero-Kacheln mit Zähler 0 entfallen; „QS-Freigaben offen" springt in einen echten offenen Entwurf statt in die ungefilterte Antragsliste ([heroChips.ts](src/plugins/home/heroChips.ts), [HomeHero.tsx](src/plugins/home/HomeHero.tsx)).
- Die Seitenleiste zeigte zweimal „E-Mail Anfragen" mit gleichem Icon und verschiedenen Zielen; der Kurations-Eintrag heißt jetzt „E-Mail Anfragen: Einstellungen" ([anfragen/index.ts](src/plugins/anfragen/index.ts)).

### v2.371.0 — Variante local: App ohne Ordner-Picker, fahrbar durch Claude Code (Juli 2026)

MINOR — Der Ordner-Picker der File System Access API ist per Browser-Sicherheit nicht skriptbar; ohne Handle blieb die App im WelcomeScreen, jede visuelle Prüfung war Handarbeit. `npm run dev:local` (Port 5175) startet sie stattdessen gegen die feste lokale Share-Kopie — kein Dialog, echte Daten. Detail: [local-variante.md](docs/architecture/local-variante.md).

- Dev-only Vite-Plugin legt eine HTTP-Brücke über die festen Ordner ([scripts/local-fs/](scripts/local-fs/)); der Client-Adapter spricht dagegen das FSAPI-Subset ([local-fs/](src/core/services/infrastructure/local-fs/)) und hängt an EINER Stelle ein: `readAll`/`writeAll` in [smb-handle.ts](src/core/services/infrastructure/smb-handle.ts).
- Drei Schichten halten den Zweig aus Builds: `__TEAMFLOW_LOCAL_FS__` hängt an `command === 'serve'` ([vite.config.ts](vite.config.ts)), `validateConfig` verbietet den `local`-Block in `variant: "production"` ([config-schema.mjs](scripts/config-schema.mjs)), Guard `local-fs-gate-eingegrenzt`.
- `window.__tf` macht die vorhandenen Dev-Fixtures programmatisch steuerbar ([window-hook.ts](src/dev-fixtures/window-hook.ts)) — `bereit()` wartet auf Mount UND abgeschlossenen Datenlauf, sonst screenshotet eine Automation die leere Tabelle.
- **Bugfix (bestand länger):** StartupScreen blieb unter StrictMode dauerhaft auf „Berechtigungen werden geprüft…" — Ref-Guard und cancelled-Flag blockierten sich gegenseitig ([StartupScreen.tsx](src/core/StartupScreen.tsx)); in gebauten Varianten unsichtbar, weil StrictMode Effekte nur im React-Dev-Build doppelt.
- Gemessen an der echten Kopie (14.221 Anträge): `/read` einer 67-MB-CSV in 188 ms, `__tf.bereit()` bei warmer IDB ~3,7 s.

### v2.370.0 — Bearbeiten mit KI: freie Ueberarbeitungs-Anweisung am Gutachten-Abschnitt (Juli 2026)

MINOR — Neu/Kürzer/Länger sind drei fertige Antworten auf eine Frage, die der Gutachter selbst stellen will: „technische Risiken auf die des Lösungswegs beschränken", „Lösungsweg vertiefen". Bisher blieb dafür nur mehrfach „Neu" würfeln oder von Hand umschreiben. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- Vierter Knopf „Bearbeiten mit KI" in der Werkzeugzeile; die Anweisung wird inline **anstelle** der Zeile eingegeben ([AnweisungLeiste.tsx](src/plugins/antraege/gutachten/AnweisungLeiste.tsx)) — der Abschnittstext bleibt beim Formulieren sichtbar.
- Technisch ein Modifier-Lauf **ohne** Modifier: neuer Prompt-Block `buildAnweisungBlock` ([run-skill.ts](src/core/services/skills/run/run-skill.ts)), ohne Anweisung byte-identisch zum Bestand.
- Die Anweisung zieht den bisherigen Text in den Prompt und schließt die Teil-Generierung aus ([workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts)) — sonst entstünde Abschnitt B frisch in Teilen statt fortgeschrieben.
- Vorfassungen tragen „Überarbeitet: „…"" statt „Sprachlich überarbeitet" ([kurzfassung-verlauf.ts](src/plugins/antraege/kurzfassung/kurzfassung-verlauf.ts)); additive `anweisung`-Felder an `StepRun`/`KurzfassungVersion`.
- Die letzten 5 Anweisungen liegen als Chips gerätelokal bereit ([anweisungVerlauf.ts](src/plugins/antraege/gutachten/anweisungVerlauf.ts)) — nie auf dem Share, nie im Snapshot.

### v2.369.1 — Hilfe-Kopfzeile: Tour-Erklaerung am Knopf statt am Info-Icon (Juli 2026)

PATCH — Nachlese am Gegenlesen von v2.369.0: das ⓘ war ein zweites Ziel für dieselbe Auskunft, die Abschnitts-Label rendern so groß wie fetter Fließtext (also keine Überschriften), und drei Docs standen noch als Wand da — `auslastung.md` mit 1151 Zeichen knapp unter der zu lasch gesetzten Schwelle.

- ⓘ entfällt; der Erklärtext hängt als Tooltip am Tour-Knopf selbst ([SeitenHilfeButton.tsx](src/components/help/SeitenHilfeButton.tsx)) — Wortlaut und 340px-Breite unverändert.
- Abschnitte sind in allen Docs `##`-Überschriften statt `**Fett-Label:**` — dieselbe Größenhierarchie, die `status-cockpit.md`/`meilensteine.md` schon hatten; am Renderer ändert sich dafür nichts.
- Verschachtelte Aufzählungen bekommen eigene Marker/Abstände ([MarkdownRenderer.tsx](src/components/ui/MarkdownRenderer.tsx)) — die Unterpunkte je UI-Bereich erbten sonst `list-disc` + `mb-3` von der ersten Ebene.
- Die letzten drei Wände aufgebrochen ([auslastung.md](docs/feedback-kontext/auslastung.md) je Tab, [suche.md](docs/feedback-kontext/suche.md) und [dokumente.md](docs/feedback-kontext/dokumente.md) je Bedienelement).
- Absatz-Schwelle des Guards von 1200 auf **700** gesenkt ([seitenHilfe.test.ts](src/core/services/feedback/__tests__/seitenHilfe.test.ts)); Schablone an allen drei Fundstellen auf Überschriften umgestellt.

### v2.369.0 — Hilfe-Dialog: Tour und Ueber die App in die Kopfzeile, Kontext-Docs strukturiert (Juli 2026)

MINOR — „Einführungs-Tour" und „Über die App" standen in der Fußzeile eines `h-[92vh]`-Dialogs: unterhalb einer Textwand am Bildschirmrand, wo sie niemand sucht. Und diese Textwand war real — neun der siebzehn Kontext-Docs hatten keine Leerzeile und verschmolzen im Renderer (`breaks: false`) zu EINEM Absatz. Schablone + Guard: [feedback-kontext/README.md](docs/feedback-kontext/README.md).

- `Dialog` bekommt den optionalen Slot `headerActions` (Titelzeile, links vom Schließen-X) ([dialog.tsx](src/components/ui/dialog.tsx)); die Seiten-Hilfe hängt Tour + ⓘ + „Über die App" als ghost-Knöpfe dorthin, die Fußzeile trägt nur noch „Text stimmt nicht" ([SeitenHilfeButton.tsx](src/components/help/SeitenHilfeButton.tsx)).
- Neun Docs von Bleiwüste auf Struktur umgebaut (Absätze, Unterpunkte je UI-Bereich, „Typische Aktionen" als Liste) — Vorbild war das bereits strukturierte `auslastung.md`.
- Technik-Teile (Datenmodell, Code, Route, Flag) stehen jetzt in **allen** Docs unter `## Technik` am Ende; damit verschwinden die sichtbaren Reste, u.a. `**Datenmodell:**` samt kv-Keys in [map-foerderfaehig.md](docs/feedback-kontext/map-foerderfaehig.md) und Route+Flag in [status-cockpit.md](docs/feedback-kontext/status-cockpit.md).
- Neuer Struktur-Guard je Doc ([seitenHilfe.test.ts](src/core/services/feedback/__tests__/seitenHilfe.test.ts)): keine Routen/Flags/Komponentennamen sichtbar, kein Technik-Fett-Label, kein Absatz über 1200 Zeichen, „Typische Aktionen" als Aufzählung, nichts hinter `## Technik`.
- Schablone an allen drei Fundstellen nachgezogen ([update-screen-context.md](docs/agents/update-screen-context.md), [SKILL.md](.claude/skills/feedback-kontext-pflege/SKILL.md), README) — sonst schreibt die nächste Runde wieder im alten Stil.

### v2.368.0 — Über die App: Spaltenteilung ziehbar (Juli 2026)

MINOR — Nachzug zu v2.366: die feste Aufteilung passte nicht zu jedem Lesebedürfnis, und „Alle aufklappen" war ein Knopf, der eine Liste mit 685 Einträgen komplett entfaltet — praktisch nie das, was jemand will.

- Spaltenteilung startet 50:50 und ist per Griff ziehbar ([UeberDieAppDialog.tsx](src/core/components/changelog/UeberDieAppDialog.tsx)) — über die geteilte `ZweiSpaltenResizable` statt eigener Drag-Logik, damit es keine dritte Resize-Implementierung gibt.
- Breite wird gerätelokal gemerkt (`teamflow_ueber_app_spalten_breite`), Doppelklick auf den Griff stellt 50:50 wieder her; Griff ist auch per Tastatur bedienbar.
- `ZweiSpaltenResizable` nimmt eine optionale `className` fürs Grid ([ZweiSpaltenResizable.tsx](src/components/zwei-spalten/ZweiSpaltenResizable.tsx)) — nötig für Konsumenten mit fester Container-Höhe (`h-full min-h-0`), sonst unverändert.
- Knopf „Alle aufklappen" entfällt samt `expandAll`-Zustand; die Aufklapp-Logik (aktuelle Hauptnummer + erste 3 Versionen offen) bleibt.

### v2.367.0 — Kopieren und Stil in der Werkzeugzeile (Juli 2026)

MINOR — „Text kopieren" und „Persönlicher Stil" lagen seit dem Vier-Ebenen-Umbau (v2.337) im ⋯-Menü der Abschnitts-Kopfzeile, dem Ort für „alles Seltenere". Beides ist aber Alltag — den fertigen Abschnitt in Mail/Word ziehen, den eigenen Stil setzen —, also gehören sie sichtbar unter den Text. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- Werkzeugzeile führt jetzt „Persönlicher Stil" (links bei Neu/Kürzer/Länger) und ein Kopier-Icon neben „Bearbeiten" ([WerkzeugZeile.tsx](src/plugins/antraege/gutachten/WerkzeugZeile.tsx)) — beides auch am freigegebenen Abschnitt.
- Aktiver persönlicher Stil zeigt sich am Knopf selbst (Kontur statt ghost), nicht nur als Vermerk in der Kopfzeile.
- Die noch leere Abschnitts-Karte bekommt „Persönlicher Stil" neben „… generieren" ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)) — dort wirkt er, dort war er bisher gar nicht erreichbar (kein ⋯-Menü).
- ⋯-Menü führt nur noch Feinschliff · Vorfassungen · Verwerfen ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)); `MenuAktion.offenLassen` entfällt mit seinem einzigen Nutzer ([AbschnittKopf.tsx](src/plugins/antraege/gutachten/AbschnittKopf.tsx)).
- Kopier-Zustand kommt aus `useKopierAktion` (Icon-Dreiklang, Fehler schlägt Erfolg — v2.301.3), kein zweiter Zwischenablage-Weg.

### v2.366.0 — Über die App: zweispaltig und größer (Juli 2026)

MINOR — Der Dialog startete 672 px breit mit drei Abschnitten untereinander; der Überblick allein füllt gut eine Bildschirmhöhe, „Änderungen & Updates" lag unerreichbar darunter. Dazu beschrieb der Was-Satz die App als Infrastruktur-Thema statt über ihren Nutzen.

- Dialog „Über die App" zweispaltig: links Überblick + Version, rechts „Änderungen & Updates" mit stehender Filterleiste, jede Spalte scrollt für sich ([UeberDieAppDialog.tsx](src/core/components/changelog/UeberDieAppDialog.tsx)); `flex-wrap` stapelt bei schmal gezogenem Dialog.
- Neue Größenstufe `2xl` (1120 px) + resizable-Starthöhe 92vh statt 80vh ([dialog.tsx](src/components/ui/dialog.tsx)) — die Höhe entspricht dem Seiten-Hilfe-Dialog.
- `resizeStorageKey` gebumpt (`…_size_v2`): eine gemerkte 672er-Größe hätte den neuen Default bei allen Bestandsnutzern überstimmt.
- Was-Satz + Doc-Überschrift benennen die App als **ZAH (ZIM-Arbeitshilfe)** — Textarbeit an Förderanträgen + Controlling der eigenen Anträge ([_app.md](docs/feedback-kontext/_app.md)); dasselbe Doc speist die Feedback-KI.

### v2.365.0 — KI-Variante Standard schaltet den Streamlit-Tab wirklich um (Juli 2026)

MINOR — Der Umschalter zurück auf die Standard-KI war wirkungslos: für „Standard" reichte die App `undefined` durch, und das heisst an der Bridge nicht „Standard-Tab", sondern „aktiver Tab". Nach dem ersten agentischen Lauf blieb jede Anfrage im agentischen Chat — während die Kontext-Warnung korrekt umsprang. Rein app-seitig, kein `BRIDGE_REV`-Bump. Detail: [streamlit-bridge.md](docs/architecture/streamlit-bridge.md).

- `aktivesZielFuerLauf()` nennt sein Ziel immer ausdrücklich, auch `'standard'` ([ki-ziel.ts](src/core/services/ai/ki-ziel.ts)) — wirkt für Gutachten, Chat, Kurzfassung, Nachforderungen und Batch zugleich.
- Der Ziel-Fallback wechselt jetzt wirklich die KI: Retry auf `'standard'` statt `undefined` ([ziel-fallback.ts](src/core/services/ai/ziel-fallback.ts)), Ergebnis trägt das tatsächlich genutzte `ziel`.
- Relevanz-Map erbt das Ziel des Laufs für Reset UND Submit ([relevanz-map.ts](src/plugins/antraege/gutachten/relevanz-map.ts)) — sie lief sonst gegen eine andere KI als der Abschnitt, den sie vorbereitet.
- Kontext-Cap folgt dem Lauf-Ziel statt der globalen Präferenz (`kontextZielFuer`, [workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts)) — nach einem Fallback wurde sonst gegen 774k gemessen und gegen 174k gefahren.
- Abschnitts-Fußzeile weist die verwendete KI aus (`StepRun.ziel`, [AbschnittFuss.tsx](src/plugins/antraege/gutachten/AbschnittFuss.tsx)) — bisher war nirgends ablesbar, welche KI geantwortet hat.

### v2.364.0 — Feedback: Verwaltung im Board, Statuswechsel im Widget, eigenes Feedback fortschreiben (Juli 2026)

MINOR — Feedback lief über zwei Oberflächen, und die PL kam an keine: `kuratorMenus: false` filterte die ganze `kuration`-Kategorie, obwohl der Service-Layer PL-Schreibrechte längst kannte. Ein Statuswechsel war nirgends sichtbar — das Home-Widget meldete nur neue Antworttexte. Und wer sein Feedback präzisieren wollte, musste ein zweites Ticket aufmachen. Ziel: EINE Feedback-Oberfläche, ein Ticket je Themenkomplex, das man fortschreibt. Detail: [feedback-system.md](docs/architecture/feedback-system.md).

- Verwaltungsrecht über `canManageFeedback` ([feature-flags.ts](src/config/feature-flags.ts), komponiert aus `canWriteDatenShare` — kein neuer Flag): Verwaltungs-Block am Ticket ([FeedbackVerwaltungBlock.tsx](src/components/feedback/FeedbackVerwaltungBlock.tsx)) + Zahnrad-Dialog für Inbox/FAQ/Sponsoring/Einstellungen ([FeedbackVerwaltungDialog.tsx](src/plugins/feedback-board/verwaltung/FeedbackVerwaltungDialog.tsx)); `feedbackDelete` jetzt auch für pl.
- Menüpunkt Kuration → Feedback entfällt: `feedback-kuration` ist nur noch ein `hideFromNav`-Redirect ([FeedbackKurationRedirect.tsx](src/plugins/feedback/FeedbackKurationRedirect.tsx)); `useAutoCollectFeedback` wandert ins Board ([FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)) — es war der einzige Pfad, über den prod-Feedback ankommt.
- Statuswechsel im Home-Widget, auch an fremden Tickets mit eigener Beteiligung (Stimme/Kommentar/Sponsoring) — vierte Ereignisart + `statusStand` am gerätelokalen Anker ([feedbackNews.ts](src/plugins/home/widgets/feedbackNews.ts)); Klick öffnet jetzt das Ticket.
- Autoren ergänzen ihr abgesendetes Feedback nachträglich — Titel, typspezifische Felder, weitere Screenshots/Dateien ([FeedbackErgaenzenForm.tsx](src/components/feedback/FeedbackErgaenzenForm.tsx), `appendAttachments` in [feedbackService.ts](src/core/services/feedback/feedbackService.ts)).
- Latenter Datenverlust behoben: `mergeItems` ließ lokalen Nutzertext bedingungslos gewinnen, obwohl `addComment` eine Vollkopie fremder Tickets lokal ablegt — jetzt entscheidet `updated_at` ([feedbackSharedFile.ts](src/core/services/feedback/feedbackSharedFile.ts)); Filter/Sortierung des Boards sind als reine Funktionen node-getestet ([boardFilter.ts](src/plugins/feedback-board/boardFilter.ts)).

### v2.363.0 — FKZ in der Tabelle per Klick kopieren (Juli 2026)

MINOR — Das FKZ ist die Kennung, mit der ein Antrag ins Fachsystem, in eine Mail oder nach Excel weitergereicht wird — bisher ging das nur per Maus-Markierung, und die kollidiert in einer Zeile, deren Klick das Detail öffnet. Bei einer Verbund-Sammelzeile war es gar nicht markierbar.

- Kopier-Icon in der FKZ-Spalte, sichtbar beim Überfahren der Zeile ([tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)); Verbund-Zeile kopiert das Verbund-FKZ.
- Geteilter `KopierIconButton` ([KopierIconButton.tsx](src/components/ui/KopierIconButton.tsx)) — dritte Kopie desselben Knopfes vermieden, `TvTitelCopyButton` ist jetzt nur noch dessen TV-Hülle.
- `SortableTable`-Zeilen tragen die benannte Hover-Gruppe `group/row` ([SortableTable.tsx](src/components/data-table/SortableTable.tsx)) — Zell-Renderer können Aktionen bei Zeilen-Hover einblenden.
- FKZ-Spalte 132 → 156 px, Kopier-Slot belegt dauerhaft Platz (kein Layout-Sprung beim Hover, Pitfall #14).

### v2.362.1 — Dokumentablage legt fehlenden Suchindex selbst an (Juli 2026)

PATCH — Eine per Drag-and-drop abgelegte PDF scheiterte mit rotem „Fehler: Orama not initialized". Ursache: die Orama-DB legten bisher nur der Dev-Seed und der Kurator-Vollindexlauf an — auf einer frischen Variant-IDB ohne Index vom Share blieb `db` die ganze Sitzung `null`, und in prod/pl gab es ohne Kurator-Rolle gar keinen Weg, sie je anzulegen. Der Wurf traf zudem erst NACH dem Speichern, riss also die schon gelungene Aufnahme mit (kein `docId`, kein `onIngested`).

- `ensureOramaDB()` legt einen fehlenden Index an, `persistOramaSoon()` speichert nachlaufend + koaleszierend ([orama-store.ts](src/core/services/search/orama-store.ts)) — die Ablage persistierte bisher gar nicht.
- `indexDocument` wartet auf den Init-Lauf, legt notfalls an und persistiert ([useSearch.ts](src/core/hooks/useSearch.ts)); der `?? 384`-Fallback gegen ein 768d-Schema ist weg.
- Index-Fehler beenden die Aufnahme nicht mehr: Dokument bleibt übernommen, Hinweis statt rotem Fehler ([DokumentAufnahme.tsx](src/core/components/DokumentAufnahme.tsx), [DokumenteListe.tsx](src/plugins/dokumente/DokumenteListe.tsx)).
- `orama-dimensions` wird jetzt überall dort mitgeschrieben, wo `orama-db` entsteht ([seed-data.ts](src/core/services/seed/seed-data.ts), [index-persistence.ts](src/core/services/search/index-persistence.ts)) — sonst rehydriert das Schema ohne `embedding`-Feld.
- Nebenbei: die Dokumente-Liste indexierte unter `doc-${Date.now()}` statt unter der Store-uuid — solche Einträge waren nie löschbar ([DokumenteListe.tsx](src/plugins/dokumente/DokumenteListe.tsx)).

### v2.362.0 — Sidebar-Navigation in drei Gruppen (Juli 2026)

MINOR — Zehn Menüpunkte als ununterbrochener Block: nichts sagte, was der tägliche Weg ist und was Beiwerk. Die Kategorisierung von v2.170 war dabei nie weg — `workflow` und `tools` standen unverändert in den Manifesten, das ShellLayout rendert sie nur beide ohne Label und ohne Trennlinie hintereinander. Und dass vier der zehn Seiten Beta sind, stand nirgends.

- Drei sichtbare Blöcke: täglicher Weg (ohne Beschriftung), „Werkzeuge", „In Erprobung" ([ShellLayout.tsx](src/core/ShellLayout.tsx)); Beschriftungen kommen aus `NAV_GRUPPEN_LABEL` ([groupNavPlugins.ts](src/core/nav/groupNavPlugins.ts)) und gelten auch für Strg+K.
- Neue Kategorie `erprobung` für Fristen & Meilensteine, E-Mail Anfragen, Förderfähigkeit und Status-Katalog ([plugin.ts](src/core/types/plugin.ts)) — bewusst am Manifest statt aus dem `featureFlag` abgeleitet.
- „In Erprobung" ist zuklappbar (Standard offen, gerätelokal gemerkt über [useCollapsedSection](src/core/hooks/useCollapsedSection.ts)); zugeklappt bleibt die gerade offene Seite stehen (`sichtbareGruppenItems`).
- Suche wandert zu den Werkzeugen; `order` gruppenweise gestaffelt (0–9 / 20–29 / 40–49 / 80–99), damit kein neuer Eintrag zwischen zwei Gruppen rutscht.
- Dauerwirkung: **ein neues Plugin startet in `erprobung`** und wandert später weiter ([add-plugin.md](docs/agents/add-plugin.md) mit Auswahltabelle).

### v2.361.0 — Feedback-Kanban anpassbar, Lane-Auswahl aufgeraeumt (Juli 2026)

MINOR — Auf dem Feedback-Board stauten sich alle Tickets in „Neu" (12 Karten = langes Scrollen), während „Abgelehnt"/„Geplant" als leere Schienen danebenstanden — das Home-Widget konnte längst Lanes wählen und zweispaltig rendern, die Seite nicht. Gleichzeitig war das Anpassungs-Popover unordentlich: die Spaltenzahl steckte als verstecktes zweites Klickziel („· 1 Sp.") in einem Chip und brauchte eine Erklär-Fußnote.

- Board-Kanban anpassbar: Lanes wählbar, 1/2 Kartenspalten je Lane, Farbmodus — Popover neben dem Dichte-Knopf ([FeedbackKanbanEinstellungen.tsx](src/components/feedback/FeedbackKanbanEinstellungen.tsx)), gerätelokal in localStorage ([boardKanbanConfig.ts](src/components/feedback/boardKanbanConfig.ts)); Default = bisheriges Board.
- Lane-Auswahl neu als bündige Zeilenliste (Häkchen links, 1/2-Schalter rechts) — geteilt von Home-Popover, Einstellungen › Widgets und Board ([LaneListe.tsx](src/components/ui/LaneListe.tsx)); `SettingsChipToggle` verliert den klickbaren `suffix`.
- `KanbanBoard` gibt einer zweispaltigen Lane im `fest`-Layout die doppelte Spurbreite — vorher hätte sie zwei Karten in 250px gequetscht ([KanbanBoard.tsx](src/components/kanban/KanbanBoard.tsx)).
- Feedback-Lane-Katalog + Mono-Rampe nach `src/components/` gezogen, damit Board und Widget eine Quelle teilen ([feedbackLanes.ts](src/components/feedback/feedbackLanes.ts), [laneAccent.ts](src/components/kanban/laneAccent.ts)).
- Detail: [home-widgets.md](docs/architecture/home-widgets.md); Screen-Kontext [feedback-board.md](docs/feedback-kontext/feedback-board.md) nachgezogen.

### v2.360.2 — Befehlssuche: Klick auf einen Eintrag wirkt wieder (Juli 2026)

PATCH — In der Befehlssuche (Strg+K) bewirkte ein Klick auf einen Eintrag nichts: die Palette schloss sich wortlos, ohne zu navigieren. Der Fehler steckte seit v2.83 drin und fiel nicht auf, weil die Palette ein Tastatur-Werkzeug ist — Pfeiltasten und Enter liefen über das fokussierte Eingabefeld weiter.

- Die Abdunkelung ist ein `absolute`-Geschwister und wurde deshalb ÜBER dem statischen Palettenkasten gemalt; sie fing jeden Klick ab und löste über die Hülle `onClose` aus. Fix: `relative` am Kasten ([CommandPalette.tsx](src/components/ui/CommandPalette.tsx)).

### v2.360.1 — Skill-Verwaltung vor dem Feedback-Board (Juli 2026)

PATCH — Die Skill-Verwaltung stand seit v2.360 als letzter Punkt hinter dem Feedback-Board. Das Board ist der Rückmelde-Kanal und gehört ans Ende der Liste, die Skill-Verwaltung zu den übrigen Werkzeugen.

- `order: 80` → `70`, also zwischen Status-Katalog (8) und Feedback-Board (75) ([skill-verwaltung-kuration/index.ts](src/plugins/skill-verwaltung-kuration/index.ts)); Bereichsliste in [_app.md](docs/feedback-kontext/_app.md) mitgezogen.

### v2.360.0 — Sidebar-Fusszeile aufgeraeumt + Ueber die App (Juli 2026)

MINOR — Der untere Rand der Sidebar trug drei Trennlinien und fünf Blöcke — und dazwischen einen großen Leerraum, weil der Spacer die System-Gruppe nach unten drückte: voll und leer zugleich. Gleichzeitig sah niemand den App-Überblick `_app.md`, der bis heute nur der Feedback-KI vorgelegt wurde.

- Skill-Verwaltung steht wieder oben als letzter Menüpunkt (`category: 'tools'`, `order: 80`); Einstellungen sitzen als Zahnrad in der Fußzeile ([FooterSettingsButton.tsx](src/core/components/FooterSettingsButton.tsx)) — die System-Gruppe entfällt samt Trennlinie.
- `hideFromNav` auf Einstellungen wirft sie auch aus Strg+K; der Command-Eintrag wird darum explizit ergänzt ([ShellLayout.tsx](src/core/ShellLayout.tsx)). Route und Strg+Umschalt+E bleiben unberührt.
- Neu „Über die App" hinter der Versionsnummer: Überblick aus `_app.md`, Fassung/Stand/Ausgabe, dann die Änderungsliste ([UeberDieAppDialog.tsx](src/core/components/changelog/UeberDieAppDialog.tsx)); ein Mount für beide Auslöser über [useUeberAppDialog.ts](src/core/components/changelog/useUeberAppDialog.ts).
- Die Einführungs-Tour startet jetzt aus der Hilfe-Fußzeile, der Puls-Punkt sitzt am Hilfe-Knopf der Startseite ([SeitenHilfeButton.tsx](src/components/help/SeitenHilfeButton.tsx)); `FooterTourButton` entfällt.
- `_app.md` wird nutzersichtbar und war entsprechend stale: vier Bereiche fehlten, der Deployment-Absatz stand mitten im Text — jetzt unter `## Technik` ([_app.md](docs/feedback-kontext/_app.md)).

### v2.359.0 — Tour-Ankuendigung raus, Hilfe bekommt Rueckkanal (Juli 2026)

MINOR — Der Fußzeilen-Knopf „Zeig es mir" kündigte auf jeder Seite außer Home seitenspezifische Touren an („In Vorbereitung"). Die sind vertagt, bis die Seiten stabil sind und mehr als eine Handvoll Leute damit arbeiten — bis dahin ist es ein Versprechen, das bei jedem Klick unerfüllt bleibt und den Rest der Oberfläche mit entwertet.

- Ankündigung raus; „Neu hier?" mit der echten Tour bleibt, aber nur noch auf Home ([FooterTourButton.tsx](src/core/components/FooterTourButton.tsx), umbenannt von `FooterShowcaseButton`).
- Die Absicht steht jetzt dort, wo sie hingehört: Fußzeile des Hilfe-Dialogs, ein Satz plus Detail hinter dem Info-Icon ([SeitenHilfeButton.tsx](src/components/help/SeitenHilfeButton.tsx)); Touren hängen später als zweite Tiefe unter dem Hilfetext ([runtime-layers.md](docs/architecture/runtime-layers.md)).
- „Text stimmt nicht" im Hilfe-Dialog öffnet das Feedback-Panel mit Typ „Problem" und fertiger Überschrift — der Guard erzwingt die Existenz eines Docs, nicht seine Aktualität, also darf das Melden von Drift kein Suchspiel sein.
- `openDialog({ vorbelegung })` als neuer, allgemeiner Weg für Auslöser, die den Anlass kennen ([useFeedbackDialog.ts](src/components/feedback/useFeedbackDialog.ts)); greift beim Mounten, „Typ ändern" bleibt frei.
- Version in der Sidebar-Fußzeile hängt an `ml-auto` statt `justify-between` — sonst rutscht sie nach links, sobald der Tour-Knopf `null` rendert.

### v2.358.0 — Arbeitsliste nur noch letzte drei Jahrgaenge (Juli 2026)

MINOR — „Diese Woche" zeigte 1771 überfällige Verbünde, die meisten aus 2013/2014 und alle mit demselben Befund „hängt seit 1.2 Antrag zugewiesen". Das ist kein Rückstand, sondern Altbestand mit unsauber gesetzten Status im Fachsystem.

- Der Eingangs-Zeitraum gilt wieder für **alle drei Listen-Bereiche** inklusive Tab-Zähler — die Begründung von v2.353 setzte voraus, alte Überfällige seien echte Arbeit ([MeilensteinePage.tsx](src/plugins/meilensteine/MeilensteinePage.tsx)).
- Vorbelegung auf **drei Jahrgänge** (laufendes Jahr + die beiden davor), abgeleitet aus `JAHR_CHIPS`, damit Chip-Leiste und Standard nicht auseinanderlaufen ([monitoringLogic.ts](src/plugins/meilensteine/monitoringLogic.ts)).
- Neuer Chip „Letzte 3 Jahre" als Rückweg zur Vorbelegung; „Alle Eingänge" zeigt weiterhin restlos alles ([JahresFilter.tsx](src/plugins/meilensteine/JahresFilter.tsx)).
- Key-Bump `bereich` → `bereichV2`: ein unter der alten Bedeutung gespeicherter Zeitraum hätte den neuen Standard überstimmt; Tab, Pills und „nach Verbund" bleiben erhalten ([ansichtPersistenz.ts](src/plugins/meilensteine/ansichtPersistenz.ts)).

### v2.357.0 — Seiten-Hilfe auf allen Seiten + groesserer Lese-Dialog (Juli 2026)

MINOR — Der Hilfe-Knopf aus v2.355 stand nur auf einer Seite und öffnete ein Fenster, in dem man scrollen musste, um die Seite zu verstehen — beides war als Muster gedacht, nicht als Endzustand.

- Knopf auf allen 20 Seiten mit Kontext-Doc, rechts im Seitenkopf ([ui-muster.md](docs/architecture/ui-muster.md)); `chat` bleibt außen vor (Redirect auf `/suche`, kein eigener Kopf).
- Lese-Dialog auf `size="xl"` + `h-[92vh]`, zentriert statt `align="top"` — passt ohne Scrollen, sitzt näher am oberen Rand ([SeitenHilfeButton.tsx](src/components/help/SeitenHilfeButton.tsx)).
- Kein `resizable` mehr: eine einmal gemerkte kleinere Größe hätte die neue Höhe dauerhaft überstimmt.
- Zwei Guards statt eines: kein Doc ohne Einbau, kein Einbau ohne Doc ([seitenHilfe.test.ts](src/core/services/feedback/__tests__/seitenHilfe.test.ts)) — ein neues Plugin braucht jetzt beides.

### v2.356.0 — Diese Woche nach Verbund gebuendelt (Juli 2026)

MINOR — „Diese Woche" listete 6954 überfällige Meilensteine als Einzelzeilen — ein Verbund von 2013 belegte sechs davon. Das sind aber nicht sechs Probleme, sondern eines: der Vorgang wurde nie angefasst.

- Punkte werden je Verbund gebündelt, Standard an, Schalter „nach Verbund" (gemerkt) ([DieseWocheTab.tsx](src/plugins/meilensteine/DieseWocheTab.tsx)).
- Die Sammelzeile nennt den **dringendsten** Punkt — „hängt seit 1.2 Antrag zugewiesen · Soll 23.9.2013" — plus die Zahl der offenen Meilensteine; Klick klappt sie inline auf.
- Damit ist der Tab keine zweite Übersicht: er sagt, WO ein Vorgang stehengeblieben ist, nicht nur dass er überfällig ist.
- Die Abschnitte Überfällig / Diese Woche fällig bleiben getrennt, der Aufklapp-Zustand je Abschnitt eigen.
- Bündelung als reine Funktion `gruppiereNachVerbund`; sie verlässt sich auf die Sortierung von `sammleWochenPunkte` statt ein zweites Mal zu sortieren ([monitoringLogic.ts](src/plugins/meilensteine/monitoringLogic.ts)).

### v2.355.0 — Seiten-Hilfe: Kontext-Doc als Kurzanleitung (Muster: Fristen & Meilensteine) (Juli 2026)

MINOR — Die App hatte längst ein Handbuch, es sah nur niemand: 15 Seiten-Docs in `docs/feedback-kontext/` liegen in jedem Build, wurden aber ausschließlich der Feedback-KI vorgelegt. Wer nachlesen statt fragen will, hatte keinen Weg dorthin. Zweiter Effekt: bisher fiel ein veraltetes Doc nur als leicht danebenliegende KI-Antwort auf — jetzt lesen es Nutzer und melden Abweichungen.

- „Hilfe"-Knopf im Seitenkopf öffnet das Kontext-Doc der Seite als Kurzanleitung; ohne Doc rendert er nichts ([SeitenHilfeButton.tsx](src/components/help/SeitenHilfeButton.tsx)).
- Eine Quelle für beide Leser statt zweier driftender Dateien: `entferneTechnik()` schneidet für Nutzer `## Technik` sowie die Zeilen `Datenmodell dahinter:` / `Code:` weg ([screenContext.ts](src/core/services/feedback/screenContext.ts)).
- Muster-Einbau auf „Fristen & Meilensteine" — eine Zeile im `actions`-Slot des `PageHeader` ([MeilensteinePage.tsx](src/plugins/meilensteine/MeilensteinePage.tsx)).
- Test prüft je Doc, dass außerhalb des Technik-Teils keine Datei-/Pfadangaben stehen ([seitenHilfe.test.ts](src/core/services/feedback/__tests__/seitenHilfe.test.ts)) — heute halten das alle 15 ein.
- Pflege-Regel nachgezogen: technisches nach unten, alles andere sieht der Nutzer ([update-screen-context.md](docs/agents/update-screen-context.md), [README.md](docs/feedback-kontext/README.md)).

### v2.354.0 — Feedback-Board startet im Board (Juli 2026)

MINOR — Das Feedback-Board öffnete in der Kartenliste; die Kanban-Ansicht mit den Status-Spalten — die einzige Sicht, die den Bearbeitungsstand aller Rückmeldungen auf einen Blick zeigt — musste jedes Mal von Hand eingeschaltet werden.

- Standard-Ansicht ist jetzt „Board"; die eigene Wahl wird weiterhin gerätelokal gemerkt ([FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)).
- Key-Bump `tf-feedback-board-view-v2` → `-v3`, sonst hätte der alte gespeicherte Wert den neuen Default überstimmt ([feedback-system.md](docs/architecture/feedback-system.md)).

### v2.353.0 — Fristen und Meilensteine: Ansicht bleibt erhalten (Juli 2026)

MINOR — Tab, Eingangs-Zeitraum und Pills waren reiner Session-Zustand: jedes Neuladen der Seite warf sie weg. Dazu passten zwei Vorbelegungen nicht mehr — der Standard-Zeitraum (laufendes Jahr + Vorjahr) entsprach keinem Jahres-Chip und wirkte darum wie „kein Filter gesetzt", und der Einstieg lag auf der Übersicht statt auf der täglichen Arbeitsliste.

- Ansicht wird gemerkt (Tab, Zeitraum, Übersicht-Pills, „nur meine" beider Listen) — ein localStorage-Key, der Suchtext bewusst ausgenommen ([ansichtPersistenz.ts](src/plugins/meilensteine/ansichtPersistenz.ts)).
- Einstieg auf „Diese Woche"; der Eingangs-Zeitraum ist dort weder sichtbar noch wirksam, damit ältere überfällige Vorgänge in der Arbeitsliste bleiben ([MeilensteinePage.tsx](src/plugins/meilensteine/MeilensteinePage.tsx)).
- Zeitraum-Vorbelegung auf das laufende Jahr — deckungsgleich mit dem ersten Jahres-Chip, die Vorauswahl ist damit sichtbar ([monitoringLogic.ts](src/plugins/meilensteine/monitoringLogic.ts)).
- „nur meine" ist mit gesetztem Kürzel vorbelegt (`standardFilter`), ohne Kürzel immer aus ([monitoringLogic.ts](src/plugins/meilensteine/monitoringLogic.ts)).
- Zurücksetzen-Knopf in der Übersicht, sichtbar sobald etwas vom Standard abweicht ([UebersichtTab.tsx](src/plugins/meilensteine/UebersichtTab.tsx)); Detail: [meilensteine.md](docs/architecture/meilensteine.md).

### v2.352.0 — Auslastung: ruhiger Ladezustand statt Fehlalarm (Juli 2026)

MINOR — Der erste Aufruf des Moduls zeigte drei gleichzeitige Lade-Signale (Kasten mit erfundenem Countdown, „Themen-Vektoren werden geladen …", Skeletons) und dazu ein gelbes „Vollständigkeits-Prüfung inaktiv" — ein **Fehlalarm**: die Gate-Sets entstehen erst in Phase 2 des Cache-Loads, davor liest die Diagnose sie leer und schickt den User grundlos ins CSV-Mapping. Ursache der Wartezeit selbst war die Reihenfolge, nicht das Datenvolumen: das `onInit`-Vorwärmen läuft vor dem Daten-Share-Grant und bleibt am Cold-Start wirkungslos.

- Diagnose-Hinweise als reine `baueVollstaendigkeitsHinweise` mit Pflicht-Argument `datenBereit` — schweigt während des Ladens ([vollstaendigkeit-felder.ts](src/plugins/auslastung/services/klassifizierung/vollstaendigkeit-felder.ts), [lade-status.test.ts](src/plugins/auslastung/__tests__/lade-status.test.ts)).
- Ein Ladezustand statt drei: Phasentext in der Kopf-Zeile + 2 px-Leiste ([ModulLadeStreifen.tsx](src/plugins/auslastung/components/ModulLadeStreifen.tsx), `.tf-ladeleiste` in [theme.css](src/theme.css)); `ModulLoadingBanner` entfällt.
- `useAuslastungReady` liefert zusätzlich die Phase (reine `bestimmeLadePhase`); der Themen-Vektor-Korpus meldet sich über [useKorpusLadeStatus](src/plugins/auslastung/hooks/useKorpusLadeStatus.ts), blockiert `ready` aber nicht.
- Tab-Inhalt bis `ready` abgedimmt + nicht bedienbar, davor Seiten-Skeleton statt leerer Fläche ([AuslastungView.tsx](src/plugins/auslastung/views/AuslastungView.tsx)).
- Zweiter Vorwärm-Anlauf nach `useStartupDataStatus.phase === 'done'` ([index.tsx](src/plugins/auslastung/index.tsx)) über das neue, mit dem Mount-Hook geteilte `refreshAntraegeCacheIfStale` ([useAntraegeCache.ts](src/plugins/auslastung/hooks/useAntraegeCache.ts)).

### v2.351.2 — Ordnername im Baum-Editor wieder lesbar (Juli 2026)

PATCH — Der Ordnername blieb auch nach v2.351.1 ein Zeichenrest. Ursache war nicht das Label, sondern sein Nachbar: `feldKlasse` bringt `w-full` mit, und Tailwind sortiert `w-full` hinter `w-[64px]` — das Zahlenfeld war 100 % breit und dank `shrink-0` unnachgiebig.

- Neue Basis-Klasse `feldKlasseSchmal` ohne `w-full` für Felder, die ihre Breite selbst setzen ([labels.ts](src/plugins/status-cockpit/labels.ts)).
- Reihenfolge-Feld und Namensfeld im Ordner-Editor nutzen sie ([KategorieEditor.tsx](src/plugins/status-cockpit/KategorieEditor.tsx)).
- Neuer Guard `no-w-full-neben-fixer-breite` fängt die Kombination projektweit ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)); an einer Wegwerf-Probe geprüft, dass er auslöst.
- LOC-Schwelle der Convention-Datei 1760 → 1800 (ein Guard mehr).

### v2.351.1 — Ordner zugeklappt starten und merken; Ordnername nicht mehr abgeschnitten (Juli 2026)

PATCH — Der Felder-Tab öffnete beim Aufruf alle Ordner und vergaß jede Wahl beim Verlassen. Im neuen Ordner-Editor war der Name auf einen Zeichenrest zusammengeschrumpft.

- Ordner im Felder-Tab starten zugeklappt; geöffnete bleiben es beim nächsten Aufruf ([FelderTab.tsx](src/plugins/status-cockpit/FelderTab.tsx)).
- Bei aktiver Suche stehen alle Ordner offen — sonst versteckte die Seite genau die Treffer.
- „Ordner bearbeiten" und die Versionsliste merken sich ihren Zustand ebenfalls ([StatusCockpitPage.tsx](src/plugins/status-cockpit/StatusCockpitPage.tsx)).
- Ordnername im Baum-Editor nimmt wieder den freien Platz statt auf 0 zu schrumpfen ([KategorieEditor.tsx](src/plugins/status-cockpit/KategorieEditor.tsx)).

### v2.351.0 — Ordnerbaum als echter Baum + Verlauf als Chronik (Juli 2026)

MINOR — Zwei Stellen des Status-Systems waren nach dem Zuwachs auf 505 Codes nicht mehr lesbar: der Ordner-Editor war eine Liste aus 19 Elternknoten-Auswahlen, und „Status & Verlauf" zeigte eine Wand aus 40 gleich aussehenden Zeilen — bei leerem Zeitstrahl, obwohl zwanzig Termine in den Daten stehen.

- „Ordner bearbeiten" ist ein echter Baum: Zweige klappen zu, Ziehen hängt um, Klick auf den Namen benennt um ([KategorieEditor.tsx](src/plugins/status-cockpit/KategorieEditor.tsx)).
- Die Ablege-Regeln liegen rein daneben — Ebenen bleiben getrennt, kein Nachfahre als Elternknoten ([ordnerDrag.ts](src/plugins/status-cockpit/ordnerDrag.ts)).
- Neue Verlaufs-Ansicht **Chronik**: die Termine aus den Datumsfeldern als senkrechter Zeitstrahl, nach Monat gruppiert ([chronik.ts](src/core/status/chronik.ts), [StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx)).
- Sie steht nach jedem Import bereit; der bisherige Zeitstrahl bleibt als zweite Sicht auf das gerätelokale Ereignis-Protokoll.
- „Warum dieser Status?" fasst gleiche Aussagen mehrerer Teilvorhaben zusammen und klappt Einträge ohne Beitrag weg ([StatusWarum.tsx](src/plugins/antraege/status/StatusWarum.tsx)).

### v2.350.0 — Eingangs-Zeitraum taggenau waehlbar (Juli 2026)

MINOR — Der Jahrgangs-Filter aus v2.349 konnte nur ganze Jahre. Für „was kam im zweiten Quartal rein" oder „die Woche vor der Frist" musste man weiter durch 671 Zeilen scrollen.

- Die beiden Von-Bis-Listen sind jetzt Datumsfelder (Tag, Monat, Jahr) statt Jahres-Auswahlen ([JahresFilter.tsx](src/plugins/meilensteine/JahresFilter.tsx)).
- Die Jahres-Chips bleiben als Kurzwahl und setzen das volle Kalenderjahr; die Felder zeigen danach 01.01. bis 31.12.
- Leeres Datumsfeld heißt „bis an den Rand der Daten", nicht „ungültig"; die Feld-Grenzen kommen aus dem tatsächlichen Datenbestand.
- Filter-Zustand ist ein ISO-Datumsbereich statt zweier Jahreszahlen — Vergleich bleibt ein String-Vergleich ([monitoringLogic.ts](src/plugins/meilensteine/monitoringLogic.ts)).
- Beschriftung „Jahrgang" → „Eingang", „Alle Jahre" → „Alle Eingänge", weil der Filter nicht mehr jahrweise arbeitet.

### v2.349.0 — Jahrgangs-Filter fuer Fristen und Meilensteine (Juli 2026)

MINOR — Die Seite listete alle 1836 offenen Verbünde, der älteste bei Woche 673. Weil nach Prognose vor Restzeit sortiert wird, standen genau diese Altlasten ganz oben; in „Diese Woche" erzeugten sie dauerhaft gerissene Meilensteine und machten die Arbeitsliste unbrauchbar.

- Neue Jahrgangs-Leiste im Seitenkopf: Chips für die drei jüngsten Jahre, Von-Bis-Listen und „Alle Jahre" ([JahresFilter.tsx](src/plugins/meilensteine/JahresFilter.tsx)).
- Vorbelegt mit laufendem Jahr + Vorjahr — beim Öffnen zeigt die Seite den aktuellen Bestand statt des vollen Archivs.
- Der Filter gilt für den ganzen Bereich (Übersicht, Diese Woche, Auswertung) samt der Zähler in der Tab-Leiste ([MeilensteinePage.tsx](src/plugins/meilensteine/MeilensteinePage.tsx)).
- **Die Ø-Bearbeitungsdauer der Auswertung ist damit standardmäßig jahrgangsbezogen** — „Alle Jahre" liefert wieder den Gesamtwert.
- Bezugsjahr ist der Antragseingang, gelesen über `parseGermanDate`; Verbünde ohne Antragsdatum erscheinen nur unter „Alle Jahre" und werden ausgewiesen ([monitoringLogic.ts](src/plugins/meilensteine/monitoringLogic.ts)).

### v2.348.0 — Rollen und Bezeichnungen aus der Kuerzel-Zuarbeit (Juli 2026)

MINOR — Der Katalog kannte 177 Codes aus Bildschirmfotos und genau zwei Rollen. Die Zuarbeit des Fachsystems führt 505 Codes mit amtlicher Bezeichnung und sechs Rollen — 126 unserer Einträge behaupteten „AB + FB", obwohl sie QS, PA, Juristen oder niemandem Bestimmten gehören.

- Rollen statt AB/FB-Achse: `ab`/`fb`/`qs`/`pa`/`jur` als Mehrfachauswahl, leere Auswahl = jeder darf setzen ([rollen.ts](src/core/status/rollen.ts)) — Bestandsfassungen werden zur Lesezeit übersetzt, nichts zu migrieren.
- Die Zuarbeit ist generierte Fremddaten ([seed-codes.data.ts](src/core/status/seed-codes.data.ts) via `npm run gen:status-codes`); unsere Kuration — Ordner, Phase, Rang — liegt getrennt daneben und überlebt jede Neugenerierung ([seed-codes.ts](src/core/status/seed-codes.ts)).
- Der Katalog wächst auf 508 Felder; die 330 Codes ohne Ordner-Nachweis landen sichtbar unter „Nicht zugeordnet" statt zu fehlen.
- Neuer Übernahme-Block im Felder-Tab: „Bei N Feldern weichen Bezeichnung oder Rollen ab" mit Vorschau — korrigiert nur diese beiden Angaben ([FelderTab.tsx](src/plugins/status-cockpit/FelderTab.tsx)).
- „Meine Rolle" im Profil kennt alle fünf Rollen; Statusliste und Felder-Tab filtern danach, neutrale Einträge bleiben immer sichtbar ([KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md), Pitfall #43).

### v2.347.0 — Ziehbare Spaltenteilung auf der Foerderfaehigkeit-Seite (Juli 2026)

MINOR — Auf der Förderfähigkeit-Seite ließ sich die Grenze zwischen Einreichungs-Liste und Detail nicht verschieben. Der Resize war im geteilten Shell längst da, aber unsichtbar — und die Seite gab dem Shell keine Höhe, sodass sie als Ganzes scrollte statt der Detailspalte.

- Der Einreichungen-Bereich wird zum Flex-Spalten-Kontext: Liste und Detail scrollen je für sich, Kopf und Sicht-Tabs bleiben stehen ([MapPage.tsx](src/plugins/map-foerderfaehig/MapPage.tsx)).
- Der Trenn-Griff im geteilten Master-Detail-Shell ist jetzt dauerhaft sichtbar und per Tastatur (←/→) sowie Doppelklick (Reset) bedienbar, Pointer- statt Maus-Events ([MasterDetailLayout.tsx](src/components/master-detail/MasterDetailLayout.tsx)) — wirkt auf alle Split-Seiten.
- Die Einreichungs-Liste lässt sich auf eine schmale Leiste einklappen (`collapsible`-Opt-in, Zustand gemerkt) ([EinreichungListe.tsx](src/plugins/map-foerderfaehig/components/EinreichungListe.tsx)).
- Neue reine Helfer `maxListWidth` + `keyboardWidthStep` samt Tests ([masterDetailLayout-logic.ts](src/components/master-detail/masterDetailLayout-logic.ts)).
- DESIGN_GUIDE hält die Fallgrube fest: `MasterDetailLayout` muss direktes Kind eines `flex flex-col`-Containers sein, Ausblenden über die Klasse statt das `hidden`-Attribut ([DESIGN_GUIDE.md](DESIGN_GUIDE.md)).

### v2.346.0 — Features fuer pl und kurator freischalten (Juli 2026)

MINOR — Die App ist nicht produktiv, der Nutzerkreis sind drei Testpersonen (dev, PL, Kurator). Etliche fertige Features standen trotzdem auf „nur dev" und waren für genau die zwei Menschen unsichtbar, die sie testen sollen. Ab jetzt gilt: was der dev geprüft hat, geht direkt an pl und kurator.

- **pl** bekommt Antrag-Aufbereitung, NF-Nachforderungen + Artefakt-Werkbank, MAP-Förderfähigkeit, Workflow-Entwürfe und die drei Assistent-Phasen ([pl.config.json](configs/pl.config.json)).
- **kurator** bekommt den Gutachten-Workflow (Testfläche für die selbst gepflegten Skills), Workflow-Entwürfe und die Assistent-Phasen ([kurator.config.json](configs/kurator.config.json)).
- `artefaktWerkbank` nur zusammen mit `nfNachforderungen` — allein fehlt der Artefakt-Leiste die NF-Karte; `workflowEntwuerfe` muss in `production`-Varianten explizit gesetzt werden ([feature-flags.ts](src/config/feature-flags.ts)).
- Die Assistent-Phasen sind damit sichtbar, nicht aktiv: Protokoll und Gedächtnis bleiben opt-in und gerätelokal (Pitfall #37/#38).
- Aufbereitung: Tor B (Sichtbarkeit) ist offen, Tor A (Skill-Seeds `aktiv:false`) bleibt zu — die PL sieht die deterministischen Sichten, die KI-Bausteine warten auf die Eval-Reife ([antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md)).

### v2.345.0 — Ordner-Spalten in der Fördertabelle (Juli 2026)

MINOR — Bislang gab es zwei fest im Code stehende Datums-Status-Spalten (FB, PreCheck). Mit dem kuratierten Ordnerbaum liegt dieselbe Frage — „wann ist in diesem Bereich zuletzt etwas passiert" — für jeden Ordner auf dem Tisch, ohne dass jemand Code anfasst.

- Je kuratiertem Ordner eine einblendbare Spalte mit dem jüngsten Termin ([tableColumns.tsx](src/plugins/antraege/tableColumns.tsx), Auflösung in [kategorie-projektion.ts](src/core/status/kategorie-projektion.ts)); der XLSX-Export zieht mit.
- Der Statuskatalog geht in die Projektions-Signatur ein: hängt die PL ein Feld um, wird die Slim-Projektion neu gebaut, obwohl sich kein Antrag geändert hat ([list-view-migration.ts](src/core/services/csv/list-view-migration.ts)).
- Die Spalten-Sichtbarkeit erkennt Ordner-Spalten am Präfix statt an einer festen Liste — sonst wäre die Auswahl nach jedem Reload weg.
- Neues Themen-Doc [KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md) (Spalten-Konvention, Herkunft des Seeds, AB/FB, was auf die Ableitung wirkt) + Pitfall #42 und Guard `status-kategorie-nur-aus-katalog`.

### v2.344.0 — Statuseinträge auf der Antragsseite, Rolle im Profil (Juli 2026)

MINOR — Der Katalog kannte die ~180 Statuseinträge des Fachsystems, zeigte sie aber nirgends. Die Antragsseite bekommt sie in genau der Ordnung, in der das Team seine Vorgänge kennt — und die eigene Rolle sortiert vor.

- Abschnitt „Statuseinträge" unter Timeline und Begründung, gruppiert nach den Ordnern des Fachsystems, Verbund und Teilvorhaben getrennt ([StatusCodeListe.tsx](src/plugins/antraege/status/StatusCodeListe.tsx)).
- „Meine Rolle" (AB / FB / beides) im Profil ([ProfilTab.tsx](src/plugins/einstellungen/ProfilTab.tsx)) — Vorauswahl der Liste, keine Sperre; ohne Angabe bleibt alles sichtbar.
- Der Statusverlauf löst die Code-Spalten jetzt gegen das Programm-Schema auf, sonst blieben die Einträge leer ([useStatusVerlauf.ts](src/plugins/antraege/status/useStatusVerlauf.ts)).
- Stillgelegte und auf „Ignoriert" gesetzte Felder erscheinen nicht — die Kuration im Cockpit wirkt hier unmittelbar.

### v2.343.0 — Status-Cockpit: Kuration des Statusbaums (Juli 2026)

MINOR — Der Katalog führt jetzt 184 Felder in 19 Ordnern; die flache Tabelle des Felder-Tabs war dafür nicht mehr die richtige Form. Und ohne Bedienoberfläche kommt weder der ausgelieferte Baum noch eine entdeckte Spalte je in der Team-Fassung an.

- Felder-Tab als Ordnerbaum, Verbund und Teilvorhaben getrennt, je Ordner eine eigene Tabelle ([FelderTab.tsx](src/plugins/status-cockpit/FelderTab.tsx)).
- Je Feld editierbar: Bezeichnung, Ordner, Zuständigkeit AB/FB, Prominenz sowie Spine-Phase, Rang und terminal — bei Wert-Feldern bleiben Phase und Rang beim Wert.
- Ordner anlegen, umbenennen, umhängen und stilllegen ([KategorieEditor.tsx](src/plugins/status-cockpit/KategorieEditor.tsx)); ein entfernter Ordner lässt keine toten Verweise zurück.
- Zwei Übernahme-Blöcke: fehlende Felder aus der Auslieferung nachziehen und in den CSV-Quellen gefundene Spalten einsortieren.
- Filter nach Ebene, Zuständigkeit und „nur mit Rang" — letzteres zeigt, was tatsächlich auf die Statusableitung wirkt.

### v2.342.0 — Statusableitung: Datums- und Textfelder tragen bei (Juli 2026)

MINOR — Bisher leitete sich die Phase allein aus den beiden Statuswert-Feldern ab; alle Termine des Fachsystems blieben stumm. Jetzt darf ein Termin die Phase heben — aber nur, wo die Projektleitung ihm einen Rang gibt.

- Datums- und Textfelder tragen mit der Phase des FELDES bei (`rang > 0` und lesbarer Wert), Wert-Felder unverändert mit der Kategorie des Werts ([ableitung.ts](src/core/status/ableitung.ts)).
- Konflikte werden weiter nur zwischen Wert-Feldern gemeldet — ein Antragseingang neben einem fertigen Gutachten ist Historie, kein Widerspruch.
- Kategorie ↔ Spine-Phase in beiden Richtungen an einer Stelle, terminale Felder in der Fachprüfung gelten als Ablehnung ([spine-kategorie.ts](src/core/status/spine-kategorie.ts)).
- Wirksam wird das für Antragseingang und Bewilligungsdatum; die 177 Codes des Fachsystems bleiben ohne Rang, bis die PL sie gegen die Simulation freigibt.

### v2.341.0 — Status-Katalog: Code-Spalten auflösen und entdecken (Juli 2026)

MINOR — Die Code-Felder tragen den rohen CSV-Spaltennamen; unter welchem Key die Spalte im Record landet, entscheidet erst das Programm-Mapping. Dazu die zweite Lücke: entdeckt wurden bisher nur neue Status*werte*, nie neue *Felder* — die eingeklappten Ordner des Fachsystems blieben damit unsichtbar.

- Auflösung Code → Record-Key über die Programm-Schemas, inkl. Begleit-Textspalte und Kollisionsschutz zugunsten kanonischer Felder ([feld-aufloesung.ts](src/core/status/feld-aufloesung.ts)).
- `sammleVorkommen` ist die eine Stelle für die Ebene/Herkunft-Regel; Ableitung, Cockpit und Historie bauen darauf auf ([cockpit-berechnung.ts](src/core/status/cockpit-berechnung.ts), [reconcile.ts](src/core/status/reconcile.ts)).
- Verbund-Codes werden aus der TV-Zeile gelesen, aber nur einmal gemeldet — sie stehen dort auf jeder Zeile gleich.
- Gemappte `D_`/`T_`-Spalten, die der Katalog nicht kennt, landen als unkuratierte Felder im gerätelokalen Puffer ([entdecke.ts](src/core/status/entdecke.ts)).
- Auf „Ignoriert" gesetzte oder stillgelegte Felder erzeugen keine Ereignisse mehr — bei ~180 Feldern ist das der Hebel gegen ein aufgeblähtes Log.

### v2.340.0 — Status-Katalog: 177 Codes des Fachsystems ausgeliefert (Juli 2026)

MINOR — Der Katalog kannte 7 Statusfelder. Das Fachsystem führt ~200 Codes, und der Code ist zugleich der CSV-Spaltenname (`D_XTEC` zum Ordner-Eintrag `[XTEC]`, `T_` für Texteinträge, `X` für Verbund-Ebene). Diese Runde liefert den Katalog aus — Kuration und Wirkung folgen.

- 19 Ordner in getrennten Verbund- und TV-Bäumen ([seed-kategorien.ts](src/core/status/seed-kategorien.ts)); vier im Fachsystem eingeklappte Ordner starten bewusst leer.
- 181 Code-Felder mit Label, Kategorie, Ebene und Zuständigkeit AB/FB ([seed-codes.ts](src/core/status/seed-codes.ts)) — aus Bildschirmfotos übertragen, von der PL zu bestätigen.
- Rang nur für 22 Felder, die eine Phase eindeutig markieren; alle übrigen tragen (noch) nicht zur Statusableitung bei.
- Die vier kanonisch gemappten Spalten (`D_AAE`, `D_ABB`, `D_AZ1_1`, `D_VBE`) bleiben Einzeleinträge und wandern nur in den Baum ([seed.ts](src/core/status/seed.ts)) — kein zweiter Eintrag auf derselben Spalte.

### v2.339.0 — Status-Katalog: Kategoriebaum + AB/FB im Datenmodell (Juli 2026)

MINOR — Der Status-Katalog kennt 7 Felder; das Fachsystem führt ~200 Statuscodes in einem Ordnerbaum (Kommunikation, Antragsbearbeitung → pre-check, Betreuung …), getrennt nach Verbund- und Teilvorhaben-Ebene und nach Zuständigkeit AB/FB. Fundament dafür: das Datenmodell, noch ohne Inhalt.

- `StatusKategorie`-Baum an der Katalog-Fassung, Feld-Eintrag um Code, Kategorie, Zuständigkeit, Typ „Text", Herkunft und Ableitungs-Rang erweitert — alles optional ([typen.ts](src/core/status/typen.ts)).
- Baum-Mechanik (Pfad, Kinder, Ebenen-Trennung, Zyklenschutz) in [kategorien.ts](src/core/status/kategorien.ts).
- Kategorie-Operationen + `ergaenzeSeedFelder`: eine neue Auslieferung ergänzt nur Lücken und fasst kuratierte Einträge nie an ([katalog-edit.ts](src/core/status/katalog-edit.ts)).
- JSON-Import prüft den Baum mit (eindeutige Ids, existierende Elternknoten, kein Ringschluss, gültige Feld-Zuordnung) ([export-import.ts](src/core/status/export-import.ts)).

### v2.338.0 — Detailseite: Fokus-Modus und weniger Sektionen (Juli 2026)

MINOR — Wer die Antragsliste einklappt, will an EINEM Antrag arbeiten — trotzdem blieb der komplette Listen-Werkzeugkasten im Kopf stehen (Suche, Sicht-Tabs, Export, Ansicht, Filter): tote Knöpfe, die Platz kosten. Zugleich war die Detailseite sektions-übersättigt und die Werkbank stand hinter den Feld-Sektionen, obwohl sie im Ablauf davor kommt.

- Fokus-Modus: eingeklappte Liste blendet alle Listen-Werkzeuge aus, es bleiben Titel + „Aufnehmen" ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx), Ableitung über `shouldShowList` in [listCollapse.ts](src/plugins/antraege/listCollapse.ts)).
- „Antrag-Aufbereitung öffnen" sitzt jetzt rechts in der Kopfzeile statt lose darunter (neuer `aktion`-Slot in [VerbundKopf.tsx](src/plugins/antraege/VerbundKopf.tsx)).
- Kurzbeschreibung ist klappbar, Default offen ([KurzbeschreibungCard.tsx](src/plugins/antraege/KurzbeschreibungCard.tsx)).
- „Verbundpartner und Teilvorhaben" lebt als Unterabschnitt in „Antragsdaten" — eine Sektion weniger ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)).
- Artefakt-Werkbank + Widerspruch stehen vor „Alle Felder" ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)).

### v2.337.2 — Meilenstein-Zeitstrahl: Namen vor Wochen-Achse (Juli 2026)

PATCH — Die Meilenstein-Namen brachen bei 210px ab („Schriftstück abgestimmt und …"), während die Wochen-Achse den Großteil der Breite hielt. Der Name ist die Information, die Achse nur die Verortung dazu.

- Label-Spalte 210 → 340px (die Achse gibt die Breite ab), Beschriftungen der Achse von ~12 auf ~8 ausgedünnt ([MeilensteinLeiste.tsx](src/plugins/meilensteine/MeilensteinLeiste.tsx)).

### v2.337.1 — Verbund-Detail: Status und Meilensteine einklappbar, Zeitstrahl-Achse gerade gerückt (Juli 2026)

PATCH — Die Verbund-Detailseite trug „Status &amp; Verlauf" und „Fristen &amp; Meilensteine" dauerhaft aufgeklappt, während die Nachbarsektionen einklappbar sind. Im Meilenstein-Zeitstrahl war die Wochen-Achse breiter als die Zeilen darunter — die Marken standen neben ihren Punkten.

- Beide Sektionen einklappbar mit Default ZU; die Kennzahlen (abgeleitete Phase bzw. Prognose/Frist/Restzeit) stehen im Kopf und bleiben eingeklappt sichtbar ([StatusDetailSection.tsx](src/plugins/antraege/status/StatusDetailSection.tsx), [MeilensteinSection.tsx](src/plugins/antraege/meilensteine/MeilensteinSection.tsx)).
- Achse und Zeilen teilen dasselbe Spaltenraster (`STATUS_W`), Randmarken werden nach innen gezogen statt zentriert ([MeilensteinLeiste.tsx](src/plugins/meilensteine/MeilensteinLeiste.tsx)).
- Meilenstein-Auswahl der Risiko-Meldung auf 440px erweitert, mit Titel-Tooltip ([MeilensteinSection.tsx](src/plugins/antraege/meilensteine/MeilensteinSection.tsx)).
- Kontext-Doc der Detailseite nennt die beiden Sektionen samt Einklapp-Verhalten ([antraege.md](docs/feedback-kontext/antraege.md)).

### v2.337.0 — Gutachten: Abschnitts-Karte auf vier Ebenen (Juli 2026)

MINOR — Die Abschnitts-Karte war über sieben Ebenen, drei getrennte Werkzeug-Orte und bis zu fünf einzelne Banner gewachsen. Sie hat jetzt vier: Kopf · Text · Werkzeugzeile · Fußzeile, plus ein Bewertungs-Band am Text.

- Kopfzeile trägt Pipeline-Status („Formuliert · Feinschliff"), Fallback-Badge und das ⋯-Menü; sie wird von leerem und befülltem Zustand geteilt ([AbschnittKopf.tsx](src/plugins/antraege/gutachten/AbschnittKopf.tsx)).
- Alle Meldungen laufen in EINEN Hinweis-Streifen statt in fünf Banner ([HinweisStreifen.tsx](src/plugins/antraege/gutachten/HinweisStreifen.tsx)).
- Abschnitts-QS als Strip am Text; Klick auf einen Befund markiert die Sätze über den bestehenden Fundstellen-Pfad — das Kontext-Panel zeigt die QS nicht mehr doppelt und startet eingeklappt ([QsStrip.tsx](src/plugins/antraege/gutachten/QsStrip.tsx), [KontextPanel.tsx](src/plugins/antraege/gutachten/KontextPanel.tsx)).
- Eine Werkzeugzeile ersetzt die drei Aktions-Orte; „Freigeben und weiter" trägt den QS-Stand als Badge ([WerkzeugZeile.tsx](src/plugins/antraege/gutachten/WerkzeugZeile.tsx)).
- 👍/👎 bleiben dauerhaft sichtbar in der Fußzeile (nicht im Menü) — das System lernt daraus ([AbschnittFuss.tsx](src/plugins/antraege/gutachten/AbschnittFuss.tsx)).
- Behoben: `SkillEditor` verletzte seit v2.336.0 Pitfall #15 (`onClick={() => void …}`) — der Guard war rot, der Verstoß ist raus; `gutachten-entwurf-kein-plain-textarea` deckt jetzt auch die Fußzeile ab ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)).

### v2.336.0 — Gutachten: Abnahme-Kriterien am Skill, satzgenaue KI-QS (Juli 2026)

MINOR — Die KI-QS bewertete vier fest verdrahtete Dimensionen, die weder am Skill hingen noch sagten, welcher Satz gemeint ist. Kuratoren pflegen jetzt prüfbare Abnahme-Kriterien je Abschnitts-Skill; die Befunde dürfen Satz-Nummern nennen.

- `SkillRecord.qsKriterien` additiv durch Normalisierung, Versions-Snapshot, Diff, Rollback und Bundle-Rundlauf ([storage.ts](src/core/services/skills/registry/storage.ts), [versioning.ts](src/core/services/skills/registry/versioning.ts)).
- Kriterien erreichen das Modell als autoritativer **Anhänge-Block** — der kuratierte `qs-basis`-Seed bleibt unangetastet ([run-skill.ts](src/core/services/skills/run/run-skill.ts), [qs.ts](src/plugins/antraege/gutachten/qs.ts)).
- Befunde tragen 0-basierte `satzIndizes`, gegen den echten Text validiert; Sätze ohne Beleg gehen als Prüfkandidaten mit ([belege.ts](src/plugins/antraege/gutachten/belege.ts)).
- Deterministische `StepRun.qsAbnahme` (bestanden ⇔ alle Befunde ok); jede Textänderung entwertet sie sichtbar, statt sie zu löschen ([runner.ts](src/plugins/antraege/gutachten/runner.ts)).
- Editor-Feld je Skill + registry-freie Ableitung „Kriterien aus Prompt" (nur Vorschläge, intern) ([qsKriterienAbleitung.ts](src/plugins/skill-verwaltung-kuration/qsKriterienAbleitung.ts)).

### v2.335.0 — Gutachten: Feinschliff automatisch in der Generierungs-Kette (Juli 2026)

MINOR — Der erste Kontakt mit einem generierten Abschnitt war bisher der Rohentwurf; den sprachlichen Feinschliff musste der Gutachter jedes Mal von Hand nachschieben. Er hängt jetzt automatisch an derselben Busy-Phase, der Rohentwurf bleibt als Vorfassung vergleichbar.

- `generateInto` kettet den Lektor-Lauf an; auch Modifier- und Bulk-Läufe gehen durch dieselbe Kette ([workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts)).
- `mitFeinschliff` degradiert bei Tor, Wurf UND Abbruch zum Rohentwurf — der bereits berechnete Entwurf geht nie verloren ([workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts)).
- Zurückgegebene `checks` stammen immer vom final angezeigten Text (sonst entschiede der Auto-Retry über eine unsichtbare Fassung).
- Busy-Anzeige wechselt sichtbar Formulieren → Feinschliff ([useStreamingBuffer.ts](src/plugins/antraege/kurzfassung/useStreamingBuffer.ts), [StreamingVorschau.tsx](src/plugins/antraege/kurzfassung/StreamingVorschau.tsx)).
- Additives `StepRun.feinschliffUebersprungen` + dezenter Hinweis; ein späterer manueller Feinschliff löscht die Markierung ([runner.ts](src/plugins/antraege/gutachten/runner.ts)).

### v2.334.0 — Gutachten: Transport-Fallback agentische KI auf Standard-KI (Juli 2026)

MINOR — Wer die agentische KI als Ziel gewählt hatte, verlor einen ganzen Gutachten-Lauf, sobald deren Tab nicht erreichbar war — mit rotem Fehlerbanner als erstem Kontakt. Jetzt übernimmt die Standard-KI still und der Abschnitt vermerkt es.

- Wiederverwendbarer Wrapper `mitZielFallback`: genau EIN Retry agentisch→standard, nie umgekehrt, nie bei Nutzer-Abbruch ([ziel-fallback.ts](src/core/services/ai/ziel-fallback.ts)).
- Kein Retry, wenn `ziel` beim aktiven Transport gar nicht wirkt — auf DirectLLM wäre der zweite Lauf byte-identisch ([ziel-fallback.ts](src/core/services/ai/ziel-fallback.ts)).
- Generierung, QS und Feinschliff laufen über den Wrapper; Preflight + Ping bleiben einmalig in der Hülle ([workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts)).
- `setError`/`setLlmAvailable` sind je Versuch gepuffert — ein geretteter Lauf hinterlässt kein Fehlerbanner ([workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts)).
- Additives `StepRun.zielFallback` + dezenter Info-Hinweis an der Karte ([types.ts](src/plugins/antraege/gutachten/types.ts), [runner.ts](src/plugins/antraege/gutachten/runner.ts)).

