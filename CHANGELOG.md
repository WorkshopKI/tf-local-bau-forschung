# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v3.42.1 — Aufgeklappte leere Lane wieder einklappbar (August 2026)

PATCH — Gemeldet: „habe eine Lane gerade ausgeklappt, wie kann ich sie wieder einklappen, ich sehe kein Menü". Es gab keins: `setEntfaltet` kannte nur `true`, und die aufgeklappte leere Bahn verlor mit der Schiene auch Klick, Rolle und Titel — nur ein Neuladen faltete sie zurück. Detail: [feedback-system.md](docs/architecture/feedback-system.md).

- Die drei Spalten-Zustände als reine `spaltenAnsicht()` (`voll` · `schiene` · `leer-offen`) statt als Boolean in der Komponente — [boardSpalten.ts](src/plugins/feedback-board/boardSpalten.ts)
- Der Leer-Hinweis der aufgeklappten Bahn IST der Rückweg: aus dem stummen Gedankenstrich wird „leer — einklappen" — [TicketBoard.tsx](src/plugins/feedback-board/ticket/TicketBoard.tsx)
- Unerreichbare Bahnen bleiben Schiene, auch nach einem Klick; beim Ziehen taucht der Knopf nicht auf (Regressionsgatter zu v3.39) — [boardSpalten.test.ts](src/plugins/feedback-board/__tests__/boardSpalten.test.ts)

### v3.42.0 — To-do-Kaskade in der Kopfkarte, drei Ebenen-Pillen (August 2026)

MINOR — Die Kopfkarte beantwortete „was ist zu tun?" nur mit Knöpfen; die Antwort selbst stand seit v2.390 in der To-do-Engine, zu sehen aber nur im Vorgangs-Board. Sie wird jetzt am Antrag gelesen — und füllt nebenbei „Liegt bei", das allein aus dem Kürzel-Paar meist leer blieb (Bestand: 35,4 % → 55,0 % ableitbare Adressen). Detail: [vorgangssystem.md §16.3 + §16.8](docs/architecture/vorgangssystem.md).

- Aufgaben-Zeile in der Kopfkarte: To-do des eigenen Regelsatzes, „geliehen"-Marke, „warum?" mit Regel und gelesenen Feldern — [AufgabenZeile.tsx](src/plugins/antraege/ausklapp/kopfkarte/AufgabenZeile.tsx), [aufgabe.ts](src/plugins/antraege/ausklapp/kopfkarte/aufgabe.ts)
- Ausgewertet wird je Teilvorhaben (Verbundzeile faltet und nennt abweichende TVs mit Aktenzeichen); die Adresse für den Wächter kommt immer aus dem AB-Satz — [useZeilenTodo.ts](src/plugins/antraege/ausklapp/useZeilenTodo.ts)
- „Liegt bei" hat zwei Quellen und nennt im Tooltip, welche; uneinige Teilvorhaben bekommen ein eigenes Urteil statt einer ausgewählten Rolle — [liegtBei.ts](src/plugins/antraege/ausklapp/kopfkarte/liegtBei.ts)
- Ebenen-Pillen jetzt drei: Verbund (an) · Kürzel (an) · Meilensteine (aus); „Phasen" entfällt — die TV-Bahnen sind der Zeitverlauf, nicht eine Ebene darin — [ebenen.ts](src/plugins/antraege/ausklapp/zeitverlauf/ebenen.ts)

### v3.41.0 — Lanes selbst ordnen und ausblenden (August 2026)

MINOR — Gewünscht: Reihenfolge der Board-Lanes selbst bestimmen, einzelne ausblenden, und automatisch nur einklappen, was leer ist. Ausblenden konnte das Board schon — aber es kostete den Platz: `lanes` führte nur die sichtbaren, Wiedereinblenden hängte hinten an (so stand „Geplant" rechts von „Abgelehnt"), und das Popover zeigte trotzdem Katalogfolge. Detail: [feedback-system.md](docs/architecture/feedback-system.md).

- `BoardKanbanConfig.lanes` führt ALLE Lanes in Board-Reihenfolge, ausgeblendet per `sichtbar: false` — [boardKanbanConfig.ts](src/components/feedback/boardKanbanConfig.ts)
- Alt-Stand ohne Key-Bump: fehlende Lanes kommen ausgeblendet dazu, fehlendes `sichtbar` heißt sichtbar, ein unsichtbares Board heilt — `parseBoardKanbanConfig`
- Popover zeigt die ECHTE Spaltenfolge, je Zeile ein Pfeilpaar (Ränder gedämpft) unter der neuen Überschrift „Sichtbar · Folge · Spalten" — [FeedbackKanbanEinstellungen.tsx](src/components/feedback/FeedbackKanbanEinstellungen.tsx)
- Pfeile sind opt-in an der geteilten [LaneListe](src/components/ui/LaneListe.tsx) (`onVerschiebe`) — die Home-Widgets bleiben, wie sie waren
- Die Regel steht im Popover: leere Lanes klappen von selbst ein, abgewählte bleiben weg — auch mit Tickets

### v3.40.0 — Aufgeklappte Antragszeile nach dem Entwurf (August 2026)

MINOR — Umsetzung des Handoffs `_design/handoff/status-fristen-detail-ansicht/`. Der aufgeklappte Bereich beantwortete bisher „wie steht die Frist?", nicht „woran hängt es und was tue ich?". Er ordnet sich jetzt nach diesen drei Fragen; der Nachweis liegt darunter in zwei Reitern. Detail: [vorgangssystem.md §16](docs/architecture/vorgangssystem.md).

- Kopfkarte „Woran es hängt": Urteil + drei Fakten (Bewegung · Meilensteine · Liegt bei) + **ein** Blocker mit den mitwartenden Stufen — [KopfKarte.tsx](src/plugins/antraege/ausklapp/kopfkarte/KopfKarte.tsx), [blocker.ts](src/plugins/antraege/ausklapp/kopfkarte/blocker.ts)
- Reiter heißen „Vorgangsverlauf" (Fristrechnung als Raster) und „Zeitverlauf"; die Klickzone wählt weiter vor — [AusklappInhalt.tsx](src/plugins/antraege/ausklapp/AusklappInhalt.tsx)
- Ebenen-Pillen (Phasen · Meilensteine · Kürzel · Verbund) und die Meilenstein-Ebene auf DERSELBEN Achse; die x-Skala kommt vom Band — [msEbene.ts](src/plugins/antraege/ausklapp/zeitverlauf/msEbene.ts), `ZeitAchse` in [bandGeometrie.ts](src/plugins/antraege/verlauf-band/bandGeometrie.ts)
- Meilenstein-Gliederung über `TfTree`, mit beidseitiger Hervorhebung zur Achse; `onZeilenHover` im Wrapper statt eigener Zeile — [GliederungSektion.tsx](src/plugins/antraege/ausklapp/gliederung/GliederungSektion.tsx)
- Aktionen sind echte Züge (Risiko melden · Detailseite · Verlauf kopieren) statt der drei Attrappen des Entwurfs; zwei Sachfehler des Handoffs korrigiert (Herkunft der 90 T, Ebene von „liegt bei") — [KopfAktionen.tsx](src/plugins/antraege/ausklapp/kopfkarte/KopfAktionen.tsx)
- Mitgefixt: `useVerbundMeilensteine` bewertete gegen `new Date()` statt gegen den gestempelten Stichtag — zwei Uhren in einer Karte

### v3.39.0 — Umgesetzte Tickets verschwinden nicht mehr spurlos (August 2026)

MINOR — Gemeldet: „als umgesetzt markiert, sofort aus seiner Lane verschwunden, aber nicht in der Lane Umgesetzt aufgetaucht". Der Schreibvorgang war korrekt — belegt am Bestand, gleiches Board, nur Sicht gewechselt: UMGESETZT meldete in „Alles offen" 0, in „Alles" 3. Die Bahnen bilden die ganze Pipeline ab, die Sicht (`istOffen`) schneidet die Endzustände weg; die Bahn stand daneben und behauptete „0".

- Eine Sicht deklariert ihren `statusRaum` (aus `istOffen` **abgeleitet**, keine zweite Handliste); `sichtKannStatus()` beantwortet „kann hier überhaupt etwas stehen?" — [smartViews.ts](src/plugins/feedback-board/smartViews.ts)
- Unerreichbare Bahn sagt „nicht in dieser Sicht" statt „0" und springt per Klick nach `SICHT_ALLE` — [TicketBoard.tsx](src/plugins/feedback-board/ticket/TicketBoard.tsx), `BoardSpalte.ausserhalbDerSicht`
- Die Meldung nennt den Verlust („#A7K2 → Umgesetzt · nicht in der Sicht „Alles offen""), einmal umhüllt für Menü, Ziehen, Bulk und Detail — [FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)
- Schiene der unerreichbaren Bahn in `--tf-text-secondary` (5,3:1 hell / 4,1:1 dunkel) statt tertiär-gedimmt (1,99:1) — sie trägt eine Auskunft, keine Null
- Neue Guards: `smartViews.test.ts` (Raum deckt sich mit `passt`, Sprungziel existiert in beiden Rollen), `boardSpalten.test.ts` um die Markierung erweitert

### v3.38.0 — VerlaufsBand: lesbare Flaechen, Dauern am Balken, weniger Gedraenge (August 2026)

MINOR — Ein Entwurfsvergleich legte einen messbaren Defekt frei: die Balken trugen den **satten** `--tf-kanban-*`-Akzent mit weißer Schrift, gerechnet **3,02–5,06:1 hell** (sechs von neun unter AA für 11-px-Text) und **2,14–2,92:1 dunkel** (alle neun). Die Tokens sind Farbchips für Kanban-Lane-Köpfe, nie Textuntergrund. Dazu klebte der Achsen-Boden seit v3.27 bei 24 px, auch wenn 1000 zur Verfügung standen.

- Getönte Flächen (30 % auf `--tf-bg`) statt satter, Schrift in `--tf-text`; der Akzent überlebt am Grenzstreifen — [bandFarbe.ts](src/plugins/antraege/verlauf-band/bandFarbe.ts), Guard `band-fuellung-kontrast`
- Achsen-Boden wächst mit der Bahn (`bodenFuer`, 24–56 px): kein Abschnitt trägt am Bestand mehr nur seine Nummer — [bandGeometrie.ts](src/plugins/antraege/verlauf-band/bandGeometrie.ts)
- Dauer je Abschnitt und die Warnung „hängt fest" in der zweiten Etage, in drei Durchgängen nach Rang vergeben — [bandBeschriftung.ts](src/plugins/antraege/verlauf-band/bandBeschriftung.ts)
- Kürzel über den Grenzen (widerruft „keine Codes in der Bahn"), gemessen gesetzt, Kollidierendes entfällt — [bandKanten.ts](src/plugins/antraege/verlauf-band/bandKanten.ts)
- Der Stillstands-Wächter wird je Zeile **einmal** gerechnet und von beiden Reitern gelesen — neu [useZeilenWaechter.ts](src/plugins/antraege/ausklapp/useZeilenWaechter.ts), Wortlaut aus [waechterLabels.ts](src/plugins/antraege/waechterLabels.ts)

### v3.37.0 — VerlaufsBand: hoehere Balken, Legende am Bild, eine Fusszeile, eine Kante je Tag (August 2026)

MINOR — Die Bahn hatte nach v3.32 Platz, gab ihn aber nicht weiter: `16KN073848 (diese Zeile)` brauchte 137 px in einer 128-px-Spalte, unter der Bahn standen zwei Sätze über dieselben Datumsspalten, und die Legende lag hinter einem davon. Dazu ein gemessener Befund: **51 Kanten auf 26 Tagen** — mehr als die Hälfte lag exakt übereinander, und obenauf ein 9-px-Handsymbol, nach dem als „mini Pfeil" rückgefragt wurde.

- Eine Kante je **Tag** statt je Übergang, Stil vom best belegten des Tages, Tooltip nennt jedes Kürzel — neu [bandKanten.ts](src/plugins/antraege/verlauf-band/bandKanten.ts)
- Balken 20 statt 16 px, Beschriftung 11 statt 10 — Messprofil `bandLabel` zieht mit ([textMessung.ts](src/components/data-table/messung/textMessung.ts))
- Spur-Beschriftung misst sich selbst (Profil `bandSpur`, 128–260 px) statt fester 128 — [VerlaufsBand.tsx](src/plugins/antraege/verlauf-band/VerlaufsBand.tsx)
- Legende direkt unter der Bahn, gerahmt, mit Farbmarke und Nummer darin — neu [BandFuss.tsx](src/plugins/antraege/verlauf-band/BandFuss.tsx)
- Eine Fußzeile statt zweier: Kurzauskunft + Info-Zeichen, `JournalFuss` entfällt — neu [herkunftsText.ts](src/plugins/antraege/verlauf-band/herkunftsText.ts)

### v3.36.0 — Glossar-Suche: Umlaute egal, mehrere Woerter (August 2026)

MINOR — Nachtrag zu v3.33: die Suche verglich eine Zeichenkette am Stück. „Prufung" fand „Prüfung" nicht, und „brief nf" traf nur, wer die Wortstellung des Bestands erriet — was gerade der nicht kann, der nachschlägt. Beides scheiterte bisher an der Treffer-Markierung: Falten verschiebt Positionen, `NFD` zerlegt „ü", „ß" wird zu „ss".

- Faltung mit **Herkunfts-Abbildung**: gesucht wird gefaltet, markiert im Original — neu [textFaltung.ts](src/core/utils/textFaltung.ts) (`falte`/`ursprung`)
- „ß" fällt auf „ss"; ein Treffer auf der halben Ausweitung markiert das ganze Zeichen
- Mehrere Wörter werden UND-verknüpft, reihenfolgeunabhängig, über verschiedene Felder hinweg — `leseSuche`/`Suchbegriff` in [glossarSuche.ts](src/plugins/glossar/glossarSuche.ts)
- Die Markierung zeichnet jedes Wort an jeder Stelle aus und verschmilzt überlappende Bereiche
- `normalisiereSuche` delegiert auf dieselbe Faltung — eine Definition von „vergleichbar" statt zwei — [columnPickerLogik.ts](src/components/data-table/columnPickerLogik.ts)

### v3.35.0 — Darstellungs-Menue: Zeilen-Pattern statt Optionsliste (August 2026)

MINOR — Das Menü kostete je Achse zwei Beschriftungszeilen plus eine 30-px-Zeile pro Wert; drei Achsen ergaben rund 430 px, und die Erklärzeile darunter liest niemand ein zweites Mal. Design-Handoff `_design/handoff/dropdown/`: eine Achse = eine Zeile, Beschriftung links, Auswahl rechts. Gemessen jetzt 380 × 182 px auf beiden Seiten.

- Zeilen-Pattern mit Kopfzeile + „Zurücksetzen"; Erklärzeilen und Häkchen-Liste sind weg — [DarstellungDropdown.tsx](src/components/ui/DarstellungDropdown.tsx)
- Jede Achse deklariert ihre Bedienform (`art`), An/Aus-Achsen tragen `anKey` — zwei Werte heißen nicht An/Aus — [darstellungsAchsen.ts](src/components/ui/darstellungsAchsen.ts)
- Der Knopf nennt die erste Abweichung und zählt die übrigen („Darstellung: Antrag mit TV +2") statt einer wachsenden `·`-Kette — [darstellungsAchsen.ts](src/components/ui/darstellungsAchsen.ts)
- „Beendet" und „Archivierte" sind Schalter; „Beendete zeigen" bleibt an den Aggregatnamen gebunden — [arbeitsvorrat.ts](src/plugins/antraege/arbeitsvorrat.ts)
- Das Segment kommt aus dem geteilten Bauteil, erweitert um `rolle='auswahl'` + `breit` — kein zweites Segment daneben — [SegmentedToggle.tsx](src/components/ui/SegmentedToggle.tsx)

### v3.34.0 — Alle Status-Spalten klappen den Verlauf auf; Unterzeile bindet an ihren Balken (August 2026)

MINOR — Zwei der vier Status-Spalten reagierten auf einen Klick, zwei nicht — nicht erklärbar. Und die neue Unterzeile aus v3.32 band optisch an nichts: ein Strich in Rahmenfarbe, zwei Pixel unter dem Balken schwebend, ließ „keine weiteren NF" zum Balken „NF gestellt" darüber gehören.

- Die ganze Rubrik **Status** klappt den Verlauf auf (auch FB Status und PreCheck Status) — über die Rubrik statt über eine Schlüsselliste, damit eine künftige Status-Spalte das erbt: [klickzonen.tsx](src/plugins/antraege/ausklapp/klickzonen.tsx)
- Der Anker der Unterzeile sitzt bündig an der Balken-Unterkante und trägt **dessen Farbe** — er liest sich als Fortsetzung des eigenen Abschnitts: [VerlaufsBand.tsx](src/plugins/antraege/verlauf-band/VerlaufsBand.tsx)
- `G_STATUS` ist exportiert, die Zuordnung Spalte→Reiter läuft über `ausklappReiter(key, gruppe)`: [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)

### v3.33.0 — Glossar: Suche links, breiter, in beiden Reitern (August 2026)

MINOR — „Im Glossar fehlt eine Suchmöglichkeit" — es gab sie, rechts neben den Reitern, auf 340 px gedeckelt und nur im ersten Reiter. Die Breite schnitt den eigenen Platzhalter ab („Abkürzung, Begriff, Statusw…"), also verschwieg das Feld, was es kann. Dazu fehlte alles, was man von einem Suchfeld erwartet.

- Das Feld steht **links vor den Reitern**, 520 px breit, mit ×-Knopf — [GlossarPage.tsx](src/plugins/glossar/GlossarPage.tsx)
- Es wirkt in **beiden** Reitern; „Für meine Rolle wichtig" filtert mit und behält Rolle + Richtlinien-Wahl über den Wechsel — [RollenSicht.tsx](src/plugins/glossar/RollenSicht.tsx)
- Tastatur: „/" fokussiert, Pfeil hoch/runter wandert (Liste scrollt nach), Enter nimmt den ersten Treffer, Escape leert — neue reine `flacheIds`/`naechsteId` in [glossarSuche.ts](src/plugins/glossar/glossarSuche.ts)
- Die Fundstelle ist im Treffer markiert — `markiere()` liefert Segmente, [Markiert.tsx](src/plugins/glossar/Markiert.tsx) rendert sie
- `fokusIstTippziel` löst die dritte Kopie der „tippt gerade jemand?"-Prüfung ab — [masterDetailLayout-logic.ts](src/components/master-detail/masterDetailLayout-logic.ts)

### v3.32.0 — VerlaufsBand nutzt die sichtbare Tabellenbreite; Balken tragen ausgeschriebene Namen (August 2026)

MINOR — Die Bahn war auf 620 px festgenagelt, während die Tabelle 1300 zeigte; schmale Abschnitte trugen eine Legendennummer, und der Leser sprang zwischen Balken und Legende. Der 24-px-Boden der Achse macht die kürzesten Abschnitte durch Breite allein nie beschriftbar — deshalb kommt zur Breite eine zweite Etage.

- Der Ausklappbereich nimmt die **sichtbare** Tabellenbreite (`min(100%, port)`, gemessener Scrollport) — [TableBody.tsx](src/components/data-table/TableBody.tsx), [SortableTable.tsx](src/components/data-table/SortableTable.tsx)
- Vier Stufen je Abschnitt, **gemessen** statt geraten: voller Name → Kurzform → unter dem Balken → Legendennummer — [bandBeschriftung.ts](src/plugins/antraege/verlauf-band/bandBeschriftung.ts)
- Die Legende nummeriert nur noch, wenn ein Abschnitt eine Nummer trägt; die feste Schwelle „ab sechs" entfällt — [VerlaufsBand.tsx](src/plugins/antraege/verlauf-band/VerlaufsBand.tsx)
- Die Bahn misst ihren Container; die festen 620/760 sind nur noch Erst-Rahmen-Wert — neuer geteilter Hook [useElementBreite.ts](src/core/hooks/useElementBreite.ts) (löst die zweite private Kopie in `GanttAchse.tsx` ab)
- Die Lesebreite zog vom ganzen Bereich an den Reiter mit Fließtext um — [FristenReiter.tsx](src/plugins/antraege/ausklapp/FristenReiter.tsx), [ZeilenBereich.tsx](src/plugins/antraege/ausklapp/ZeilenBereich.tsx)

### v3.31.1 — Antwortrunde 1 dokumentiert (August 2026)

PATCH — Was die Antwortrunde offen gelassen hat, steht jetzt mit Zahlen und Belegen da — sodass ein Wiedereinstieg ohne Chatverlauf auskommt. Kein Code, kein Reimport, kein neuer Export.

- Neuer Abschnitt §15 „Antwortrunde 1": gemessene Zahlen, wo die Antworten leben, warum die Sammelregel kein Alias ist — [vorgangssystem.md](docs/architecture/vorgangssystem.md)
- Offen festgehalten: DS-Grundregel (8 Abweichungen, 6× DL / 2× EP), `ÄZ`/`ÄZX` mit Bedeutungsumkehr, `VN gegrüft` fürs Fachsystem, 3.193 Vorbedingungen samt Prüf-Hypothese
- Erledigt festgehalten: 12 Kleinschreibungen als Frageklasse abgeschafft, 29 NW/FuE-Widersprüche entschieden, `strittig`-Marker per Vorgabe geklärt
- Fürs Hinweisblatt der nächsten Mappe notiert: **bei einer Sammelregel bleiben die Einzelzeilen leer** — genau dieser Konflikt hat den Widerspruch erzeugt

### v3.31.0 — FristenBand (August 2026)

MINOR — Die Frist stand als Liste da und ihre Zahl als Behauptung: welches Eingangsdatum gewonnen hat, warum der Punkt in der Spalte diese Farbe trägt, woher das Haltedatum kam — nichts davon war ablesbar. Das Band zeigt die Lage und nennt darunter jede Zahl.

- Achse Basis → Bezugszeitpunkt → Ziel plus beschriftete Herleitung in **einem** Bauteil; ersetzt die schlichte Liste aus Phase 2 — [FristenBand.tsx](src/plugins/antraege/fristen-band/FristenBand.tsx)
- Das gewinnende Basisfeld steht sichtbar da (`D_AAE` vs. `D_XTE`), das andere leiser; fehlt `D_XTE`, steht warum — [fristenBandModell.ts](src/plugins/antraege/fristen-band/fristenBandModell.ts)
- Die Punktfarbe der Frist-Spalte wird hergeleitet, aus **derselben** Stufentabelle, aus der `fristAmpelFromDays` liest — [fristAnzeige.ts](src/plugins/antraege/fristAnzeige.ts)
- Zweiter Ort: die Verbund-Detailseite, oberhalb des Aufklapp-Rumpfs — die Frist ist kein Nachschlagen — [StatusDetailSection.tsx](src/plugins/antraege/status/StatusDetailSection.tsx)
- **Fix aus der Abnahme**: im Ausklappbereich rechnete die Frist mit dem Zeilen-Status, Wächter und Zieltage aber mit dem Verbund-Status — ein Band über zwei Vorgänge — [useZeilenVerlauf.ts](src/plugins/antraege/ausklapp/useZeilenVerlauf.ts)

### v3.30.0 — Haltedatum aus dem Verlauf (August 2026)

MINOR — Die Fristen-Stoppuhr aus v3.11 wusste seit jeher, dass ein Vorgang steht — nur nicht, seit wann. Journal und Datumsfeld schweigen bei genau den Fällen, um die es geht. Die Verlaufsableitung kennt den Übergang samt Datum; gemessen am Bestand bekommen **1.638 von 5.623** angehaltenen Vorhaben erstmals ein Haltedatum.

- Dritte Quelle in der Kaskade, nach Journal und Datumsfeld: der Übergang in den heutigen Status — [haltedatum-aus-verlauf.ts](src/core/status/verlauf/haltedatum-aus-verlauf.ts)
- `FristErgebnis.haltedatumQuelle` unterscheidet belastbar (Journal, bestätigte Kante) von hergeleitet (Datumsfeld, bedingte Kante) — [frist-ergebnis.ts](src/core/services/csv/frist-ergebnis.ts)
- **Kein Zyklus, kein Wegwerf-Verlauf**: `baueUebergaenge` braucht den Bezugszeitpunkt gar nicht, der zweite Lauf entfällt, wo kein Haltedatum herauskam — [useZeilenVerlauf.ts](src/plugins/antraege/ausklapp/useZeilenVerlauf.ts)
- Bestandslauf im Cockpit rechnet jeden Vorgang zweimal und prüft die Diagonale: der Frist-Zustand darf sich nicht bewegen — [FristBefundeBlock.tsx](src/plugins/status-cockpit/FristBefundeBlock.tsx)
- Der Frist-Reiter rechnet nicht mehr nach, was der Hook schon gerechnet hat — dieselbe Zahl kam bis hierher aus zwei Aufrufen — [FristenReiter.tsx](src/plugins/antraege/ausklapp/FristenReiter.tsx)

### v3.29.0 — Antwortrunde 1 eingefaltet (August 2026)

MINOR — Die erste Klärrunde kam beantwortet zurück: 70 Fragen, 69 beantwortet. Die Antworten liegen jetzt im Code statt in einer Mappe, und die Ableitung stellt sie nicht mehr. Am Bestand vom 05.08. bleibt **eine** Frage übrig — dass es für DS keine Kürzel-Quelle gibt.

- Kuration neben Generat: 23 Vereinheitlichungen, 6 bestätigte Divergenzen, 8 DS-Wortlaute, 5 Quellkorrekturen — überleben `gen:kuerzel-katalog` samt Drift-Gatter auf jeden Wortlaut — [kuerzel-kuration.ts](src/core/status/kuerzel-kuration.ts)
- DS wird beantwortet statt geliehen: eigener Wortlaut schlägt die Sammelregel „DS = FuE", beides als Herkunft erkennbar — [kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts)
- „VN gegrüft" wird beim Lesen aufgelöst, der Rohwert bleibt im Tooltip sichtbar; Bestandsdaten unangetastet — [schreibfehler.ts](src/core/status/schreibfehler.ts)
- Zwei entschiedene Frageklassen entfallen (amtliche Kleinschreibung, `strittig`-Marker), eine kommt dazu: die K/T-Konvention prüft sich künftig selbst — [kt-konvention.ts](src/core/status/klaerfragen/kt-konvention.ts)
- **Fehler in der Ableitung behoben**: „führt die Fassung diesen Wert?" prüfte nur `wert`, nicht Varianten und amtliche Schreibweisen — Code 72 galt als fehlend, obwohl die App ihn auflöst — [useKlaerfragen.ts](src/plugins/status-cockpit/useKlaerfragen.ts)

### v3.28.1 — Zugangs-Passwoerter der pl-Variante neu gesetzt (August 2026)

PATCH — Alle drei Zugänge der pl-Variante sind frisch erzeugt: App-Wall, Auslastung, Kuration. Damit trägt jede Ebene ein eigenes Salt/Verifier-Paar aus einem Lauf, statt teils aus dem Varianten-Merge vom 05.08. zu stammen.

- `auth` + beide `moduleAuth`-Slots neu gesetzt (nur Salt + Verifier; die Passwörter selbst liegen nirgends im Repo) — [pl.config.json](configs/pl.config.json)
- **`dev` spiegelt den `auth`-Block von pl nicht mehr**: die dev-Variante hält weiter ihre eigene Kopie und öffnet nur, wenn das Standardpasswort unverändert blieb — [dev.config.json](configs/dev.config.json)

### v3.28.0 — VerlaufsBand (August 2026)

MINOR — Seit v3.19 liegt der Verlauf als Daten vor — je Spur lückenlose Abschnitte mit Dauer, 82,4 % zweiseitig verankert. Gezeichnet wurde er nie: der Reiter zeigte eine Aufzählung, ausdrücklich als Sicherheitsnetz, solange die Bauform offen war. Jetzt steht die Bahn, und die Liste ist eine Stufe tiefer gerückt — geteilt, nicht ersetzt.

- Mehrspurige Statusbahn (Verbund + je Teilvorhaben) auf **einer gewarpten Zeitachse**: derselbe Tag sitzt in jeder Spur an derselben Stelle, kurze Abschnitte bleiben über der Klickgrenze — [bandGeometrie.ts](src/plugins/antraege/verlauf-band/bandGeometrie.ts)
- Konfidenz sitzt an den **Kanten**, nie am Statusfeld: der Status ist beobachtete Tatsache, unsicher ist die Zuschreibung — [VerlaufsBand.tsx](src/plugins/antraege/verlauf-band/VerlaufsBand.tsx)
- Zwei leere Spurzustände sprechen verschieden („für diese Richtlinie keine Regeln" ≠ „kein Bearbeitungsstand"), dafür neu `VerlaufsSpur.regelLage` — [typen.ts](src/core/status/verlauf/typen.ts)
- „Verlauf kopieren" gibt Labels **und** Codes heraus, samt Katalogfassung und Rekonstruktions-Hinweis — [bandText.ts](src/plugins/antraege/verlauf-band/bandText.ts)
- `bezugsZeitpunkt` liest endlich die Frist-Uhr statt des nackten Stichtags; am Bestand heute folgenlos, weil kein Haltedatum belegt ist — [frist-bezug.ts](src/core/status/frist-bezug.ts), [vorgangssystem.md §14.9](docs/architecture/vorgangssystem.md)

### v3.27.2 — Kurator-Passwort im pl-Build gesetzt (August 2026)

PATCH — Der Slot `moduleAuth.kurator` trug seit seiner Einführung nur einen Platzhalter-Verifier: die Kurations-Rolle war in `pl` gar nicht erreichbar, der einzige Weg hinein war ein Überbleibsel aus einem Stand vor dem Schloss (v3.27.0). Mit dem gesetzten Passwort greift die dritte Regel erstmals wirklich.

- Beide Modul-Slots tragen echte Salt/Verifier-Paare, der Platzhalter-Hinweis ist raus — [pl.config.json](configs/pl.config.json)
- Damit gilt in `zah-pl.html`: Standard → beide Module zu · Auslastungs-Passwort → nur Auslastung · Kurations-Passwort → nur Kuration — [modul-freischaltung.md](docs/architecture/modul-freischaltung.md)

### v3.27.1 — Build-Ziel devpl statt devprod (August 2026)

PATCH — Die Zusammenlegung auf drei Varianten (v3.0) hat `build:all` mitgezogen, das Standard-Paar aber nicht: `build:devprod` baute weiter dev + prod, obwohl der Fach-Stack seit v3.0 komplett in `pl` liegt und der End-User-Build ihn gar nicht kompiliert. Wer der Default-Regel folgte, baute die Variante nicht, aus der getestet wird.

- `build:devprod` → **`build:devpl`** (dev + pl); `build:all`, `build:dev`, `build:pl`, `build:prod` bleiben, wie sie sind — [package.json](package.json)
- Die Default-Regel im Cheatsheet dreht sich entsprechend: dev + pl immer, `build:prod` zusätzlich bei geteiltem Code — [which-build-to-run.md](docs/agents/which-build-to-run.md)
- Drei Cheatsheets nannten `build:devprod` als Abnahme-Schritt — [add-embedding-model.md](docs/agents/add-embedding-model.md), [add-auslastung-tab.md](docs/agents/add-auslastung-tab.md), [optimize-remount-latency.md](docs/agents/optimize-remount-latency.md)

### v3.27.0 — Anmeldung legt den Freischalt-Zustand fest (August 2026)

MINOR — In `zah-pl` erschienen **beide** Modul-Menüs, egal welches Passwort an der Wall getippt wurde. Kein Code-Defekt: eine Freischaltung galt 12 h und überlebte jede Anmeldung, also blieb offen, was ein früherer Login geöffnet hatte. Für den Kurator-Slot existierte zudem nie ein benutzbares Passwort — der einzige Weg hinein war ein Überbleibsel aus einem pl-Stand vor dem Schloss.

- Steht eine Anmeldung an, wird jedes Modul mit Schloss VOR dem `rehydrate` geschlossen; die Wall öffnet danach genau den getroffenen Slot — [modul-freischaltung.ts](src/core/modul-freischaltung.ts), [App.tsx](src/core/App.tsx)
- Die Profil-Flagge `is_kurator` folgt dem getippten Passwort, sonst fordert eine Standard-Anmeldung weiter Schreibrechte auf dem Share an — [AppPasswordGate.tsx](src/core/AppPasswordGate.tsx)
- Die Ebenen-Prüfung ist als reine Funktion testbar (Basis → `auslastung` → `kurator`, erster Treffer gewinnt) und erstmals abgedeckt — [app-password.ts](src/core/services/infrastructure/app-password.ts)
- Die Wall nennt Modul-Passwörter, die Freischalt-Sektion sagt jetzt die Wahrheit über ihre Geltung — [AppPasswordGate.tsx](src/core/AppPasswordGate.tsx), [ModulFreischaltungSection.tsx](src/plugins/einstellungen/ModulFreischaltungSection.tsx)
- Einstellungs-Registry: „Module freischalten" ist auffindbar, der in `pl` tote Eintrag „Kurator-Bereich" ist weg — [settingsPanels.tsx](src/plugins/einstellungen/settingsPanels.tsx), [modul-freischaltung.md](docs/architecture/modul-freischaltung.md)

### v3.26.0 — Klaerfragen als Arbeitsmappe (August 2026)

MINOR — Was am Status- und Kürzelkatalog fachlich offen ist, stand bisher nur in `vorgangssystem.md` — als Handmessungen aus einer Konsolensitzung, die mit jedem Nacht-Export veralten und die niemand nachrechnen konnte. Die Befragung läuft Wochen und braucht eine Datei, die reihum geht. **70 Klärfragen** aus 14.222 Vorgängen, in sechs Herkünften mit je eigener Zuständigkeit.

- Neuer Reiter „Klärfragen" mit Bestandslauf, Zähler je Herkunft und XLSX-Export; read-only, kein Rückweg (das ist „Zu klären") — [KlaerfragenTab.tsx](src/plugins/status-cockpit/KlaerfragenTab.tsx)
- Die Ableitung entsteht bei jedem Lauf neu und ist rein; die drei Wert-Herkünfte sind disjunkt geordnet, Ids kommen aus Daten — [klaerfragen/](src/core/status/klaerfragen/)
- Fixierte Kopfzeile, Zeilenumbruch, entsperrte Antwortzellen und Auswahllisten kann der XLSX-Writer nicht; ein Nachschritt über `jszip` ergänzt sie und bricht ab, wenn seine Formatannahme nicht mehr stimmt — [arbeitsmappe-veredelung.ts](src/core/status/export/arbeitsmappe-veredelung.ts)
- `uneinigeKuerzel()` liefert erstmals, WELCHE Projektform was sagt — bisher nur die Namensliste — [kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts)
- §14.4 ist bis auf die DS-Lücke abgearbeitet; `AB` → 51 und `XHSP` → 50 sind fachlich bestätigt und decken sich mit C16 — der erste direkte Beleg für die Güte des Exports — [vorgangssystem.md](docs/architecture/vorgangssystem.md)

### v3.25.0 — Arbeitsliste folgt dem Phasenschnitt nicht mehr (August 2026)

MINOR — Katalog-Fassung 19 löste die Phase „Vollständigkeit" auf und hängte deren Codes an „Prüfung" — ein gewollter Schnitt, der nebenbei **448 Anträge** die Arbeitsliste wechseln ließ: „Wartet auf Antragsteller" fiel von 52 auf 0, der Altanträge-Balken der Auslastung von 395 auf 22 Teilvorhaben (leer bei 22 von 32 MAs). Entschieden hatte das niemand; in den Reitern blieb es unsichtbar, weil das Aggregat „Vor Entscheidung" drei Kategorien bündelt.

- Codes mit fachlich fester Arbeitsliste (33–37, 59) hängen jetzt am **Code** statt an einer Phasen-Id — `kategorieVorgabe` bleibt für alle übrigen wirksam — [kategorie-ableitung.ts](src/core/status/kategorie-ableitung.ts)
- „Altlast" ist an die fünf amtlichen Codes gebunden statt an zwei Kategorien der beweglichen Achse, mit Rückfall für unbekannte Schreibweisen — [altlast.ts](src/plugins/auslastung/services/kapazitaet/altlast.ts)
- Regressionsgatter setzt den Phasenschnitt der Fassung 19 aktiv, statt auf dem Seed zu laufen, wo die Lücke unsichtbar blieb — [altlast.test.ts](src/plugins/auslastung/__tests__/altlast.test.ts)
- Gegenprobe hält fest, dass nicht verankerte Codes weiter dem kuratierten Schnitt folgen — [zah-phasen-daten.test.ts](src/core/status/__tests__/zah-phasen-daten.test.ts)
- Warum `status-category-not-curated` allein nicht reichte, steht bei den Achsen — [status-achsen.md](docs/architecture/status-achsen.md), Pitfall #50

### v3.24.1 — Freischaltung ueberlebt den Reload (August 2026)

PATCH — Auf dem Produktivsystem verlor die Modul-Freischaltung nach dem erzwungenen Reload ihren Eintrag: Slot wieder „gesperrt", kein Menüpunkt, keine Meldung — ein zweiter Versuch klappte. Ein Wettlauf, den nur langsame Maschinen verlieren, deshalb im Dev nie sichtbar.

- Schreiben löst erst beim **Commit** der Transaktion auf statt beim Request; `onabort` lehnt ab, damit aus stillem Verlust kein stiller Hänger wird — [idb-store.ts](src/core/services/storage/idb-store.ts)
- `updateProfile` schreibt nicht mehr im `setState`-Updater und ist damit tatsächlich abwartbar (betraf `is_kurator` vor dem Reload) — [useProfile.ts](src/core/hooks/useProfile.ts)
- Der Store behauptet die Freischaltung erst nach dem Schreiben, und Fehler nach der Passwortprüfung stehen sichtbar da statt geschluckt zu werden — [useModulFreischaltung.ts](src/core/hooks/useModulFreischaltung.ts), [ModulFreischaltungSection.tsx](src/plugins/einstellungen/ModulFreischaltungSection.tsx)
- Regressionsgatter „Commit vor Aufloesung" für `set`/`delete` samt Abbruch-Fall — [idb-store.test.ts](src/core/services/storage/__tests__/idb-store.test.ts)
- Bug-Klasse 18 „Schreiben und sofort neu laden" festgehalten — [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)

### v3.24.0 — Feedback-Werkzeugleiste an Förderanträge angeglichen (August 2026)

MINOR — In einer Toolbar-Zeile standen fünf Bauformen für dieselbe Art Aufgabe, und drei Icons trugen eine Bedeutung, die sie in der übrigen App nicht haben. Was Förderanträge schon konnte, war hier nachgebaut statt benutzt.

- Das „Darstellung"-Menü der Förderanträge ist geteilt und trägt am Board Gruppierung · Dichte · Archivierte — aus drei Bedienelementen wird eines — [DarstellungDropdown.tsx](src/components/ui/DarstellungDropdown.tsx)
- Liste/Board läuft über den geteilten `ViewModeToggle` (Modi jetzt als Prop) statt über eine eigene Segmentgruppe — [ViewModeToggle.tsx](src/components/ui/ViewModeToggle.tsx)
- Der Rollen-Umschalter ist eine Kopf-Pille im Stil von „Profil: THÜ"; die Hilfe steht wie überall als letztes Element — [RollenPille.tsx](src/plugins/feedback-board/RollenPille.tsx)
- Icon-Vokabular vereinheitlicht (`Filter`, `SquareKanban`, `Inbox`, `Pencil`, `ThumbsUp`) und in der Muster-Doku festgehalten — [ui-muster.md](docs/architecture/ui-muster.md)
- Zwei Doppelbauten aufgelöst: `FarbmodusOption` (2×) → [FarbmodusToggle.tsx](src/components/kanban/FarbmodusToggle.tsx), zwei handgebaute Punkte-Menüs → ein `Popover` in [SponsorButton.tsx](src/components/feedback/SponsorButton.tsx)

### v3.23.0 — C16 als alleinige Regelquelle, Bedingungen ausgewertet (August 2026)

MINOR — Die Verlaufsableitung rechnete gegen 41 Regeln, die eine einzelne Bearbeiterin für ihr eigenes Excel-Dashboard notiert hatte: unvollständig und nur für NW. C16 ist der Export aus dem laufenden Fachsystem und damit die tatsächliche Konfiguration. Der Wechsel hebt die Verbund-Deckung von 21,0 % auf 62,9 % und die messbaren Verweildauern von 16.200 auf 62.396 Abschnitte.

- C16 ist alleinige Regelquelle: Nachschlag je Richtlinie statt je Projektform, `statusTv`/`statusVb` als getrennte Wirkungsebenen — [c16-regeln.ts](src/core/status/verlauf/c16-regeln.ts)
- Vorbedingungen werden ausgewertet, und zwar gegen den Stand **am Tag des Kürzels**: laufender Status plus damals gesetzte Kürzel; 3.193 Übergänge scheitern daran — [uebergaenge.ts](src/core/status/verlauf/uebergaenge.ts)
- Der Bedingungs-Auswerter des Navigators bekommt eine Heimat und einen zweiten Aufrufer statt einer Kopie; `navigator.test.ts` blieb ohne Änderung grün — [trigger-bedingung.ts](src/core/status/trigger-bedingung.ts)
- Nicht auswertbar ist weder wahr noch falsch: neue Konfidenz `trigger_bedingt` samt Grund im aufgeklappten Bereich — [typen.ts](src/core/status/verlauf/typen.ts)
- Die Zuarbeit-Regeln bleiben erhalten (`quelle: 'zuarbeit'`); drei von 41 bleiben als Klärfall übrig, alle drei die `XPC`-Familie — [klaerfaelle.ts](src/core/status/verlauf/klaerfaelle.ts), [§14.7](docs/architecture/vorgangssystem.md)

### v3.22.0 — Feedback-Board: Platz für das Board, Typ-Badge, Verlauf im Panel (August 2026)

MINOR — Nachlese aus der Benutzung des Redesigns: neben dem Detail-Panel blieben dem Board 250 px, drei leere Lanes belegten die Hälfte der Breite, der Typ war in der Liste nur ein Farbpunkt, und die Kommentar-Spur war noch die alte von v2.199. Vier Stellen, an denen der Handoff nicht die bessere Vorgabe war.

- `MasterDetailLayout` misst die Startbreite wahlweise von RECHTS (`detailDefaultWidth`): das Detail startet schmal, die Liste bekommt den Rest und behält ihn beim Fenster-Resize — [masterDetailLayout-logic.ts](src/components/master-detail/masterDetailLayout-logic.ts)
- Board-Spalten wachsen mit (`flex: 1 1 262px`, 228–340 px) statt fest 262 px zu bleiben — [ticketsystem.css](src/plugins/feedback-board/ticketsystem.css)
- Leere Lanes klappen wieder zur 44-px-Schmalschiene ein (ging beim Redesign verloren) und bleiben Drop-Ziel: Ziehen faltet alle auf, Klick eine einzelne — [TicketBoard.tsx](src/plugins/feedback-board/ticket/TicketBoard.tsx)
- Der Typ steht in der Liste als beschriftetes Badge statt als Farbpunkt; die Container-Query-Schwellen wandern um die neue Spalte mit — [TicketZeile.tsx](src/plugins/feedback-board/ticket/TicketZeile.tsx)
- Eigener „Verlauf" im Detail-Panel mit Bausteinen, „Als Rückfrage senden" / „Als Ergänzung"; `ctx.kommentiere` meldet Erfolg zurück, damit der Entwurf bei einem Share-Fehler stehenbleibt — [VerlaufBlock.tsx](src/plugins/feedback-board/ticket/VerlaufBlock.tsx)

### v3.21.0 — Ausklappbarer Bereich an der Tabellenzeile (August 2026)

MINOR — Die Verlaufsableitung aus v3.19 hatte noch keinen Ort, an dem sie ankommt: sichtbar waren nur Bilanzzahlen im Kurator-Panel. Jetzt geht unter einer Tabellenzeile ein Bereich auf, der zeigt, wie der Vorgang zu seinem Status kam — und was seine Frist wirklich trägt.

- Status- und Frist-Zelle klappen einen Bereich mit zwei Reitern auf; FKZ und Akronym navigieren weiter ins Detail, der Zeilenklick entfällt — [ausklapp/](src/plugins/antraege/ausklapp/)
- Reiter *Verlauf*: je Teilvorhaben und Verbund die Statusabschnitte und die Kürzel dazwischen, mit Rolle, Konfidenz und Journal-Nullpunkt — der erste Renderer der Spuren aus v3.19
- Reiter *Fristen und Meilensteine*: dieselbe Engine mit tieferer Eingabe (`D_XTE` aus dem Schema, Haltedatum) — `ermittleHaltedatum` bekommt seinen ersten Produktions-Aufrufer — [FristenReiter.tsx](src/plugins/antraege/ausklapp/FristenReiter.tsx)
- `SortableTable` kann jetzt Detailzeilen (`isRowExpanded`/`renderRowDetail`) statt sie zum fünften Mal je Seite nachzubauen — [TableBody.tsx](src/components/data-table/TableBody.tsx)
- Die „Verlaufs-Näherung (max. 5)" im Popover weicht „Ganzen Verlauf zeigen"; die Regeln der Zuarbeit haben über eine Fassade weiter genau einen Leser, die Guard-Ausnahme entfällt — [fuer-vorgang.ts](src/core/status/verlauf/fuer-vorgang.ts)

### v3.20.0 — Verlaufs-Segmente: warum die Dauer unsicher ist (August 2026)

MINOR — 68,3 % der Abschnitte trugen „Dauer unsicher", und daraus las sich „die Verweildauern sind wertlos". Die Zahl mischte zwei Dinge: eine offene Grenze und eine gemessene Ein-Tages-Dauer. Vor dem Band in Phase 3 muss klar sein, welches davon überwiegt.

- Vier disjunkte Auslöser hinter `dauerUnsicher` (Summe = `segmenteUnsicher`, per Test): **nur 1.719 von 31.135 (5,5 %)** sind gemessene ≤ 1-Tages-Dauern, 94,5 % sind offene Grenzen — [erhebung.ts](src/core/status/verlauf/erhebung.ts)
- Verteilung der 16.200 messbaren Dauern aus einem Histogramm statt eines Sammel-Arrays: Median 10 T, p75 37 T, 28,9 % über 30 Tagen — die Dauerachse trägt — [VerlaufBefundeBlock.tsx](src/plugins/status-cockpit/VerlaufBefundeBlock.tsx)
- Negative Dauern (Termin nach dem Bezugszeitpunkt) sind ein eigener Befund statt stiller Teil von „stand einen Tag" — im Bestand null Fälle
- C16-Vergleich gemessen: **null Widersprüche** bei zwei Überlappungs-Paaren; die Zuarbeit deckt FuE, DS und DL mit **0** Verbünden, C16 löst `AB` → 51 und `XHSP` → 50 auf — [vorgangssystem.md §14.5](docs/architecture/vorgangssystem.md)
- Die 63,2 % C16-Deckung sind eine **Obergrenze**: alle 287 statusetzenden Zeilen tragen eine Bedingung, keine einzige ist bedingungsfrei

### v3.19.0 — Verlaufsableitung (August 2026)

MINOR — Das Vorgangssystem erklärt den aktuellen Status, aber nicht den Weg dorthin. Das Import-Diff-Journal beginnt erst am 05.08.2026 und kennt null Statuswechsel — eine Spur, die nur beobachten kann, erklärt bei jedem Vorgang nur ihre eigene Blindheit. Also wird abgeleitet, mit Herkunft an jeder Spur. Reines Modul, keine UI (Band und Ausklappmechanik folgen).

- `baueVerlauf` baut je Teilvorhaben und Verbund eine Spur aus den `D_`-Spalten und den Statuswechsel-Regeln der Kürzel-Zuarbeit; Kürzel-Nachschlag immer × Projektform, historische Formen doppelt geführt — [verlauf/](src/core/status/verlauf/)
- Vier Spurzustände statt einer leeren Zeile, und Abweichungen zum Export in zwei Arten getrennt: 11.134 „gar nicht ableitbar" gegen **152** echte Widersprüche — [typen.ts](src/core/status/verlauf/typen.ts)
- Bestandslauf im Reiter *Kürzel* der Vorgangs-Regeln: 12.356 Teilvorhaben in 6.614 Vorhaben, 86,1 % mit Verlauf, aber nur 21,0 % der Verbünde mit abgeleitetem Statuswechsel — [VerlaufBefundeBlock.tsx](src/plugins/status-cockpit/VerlaufBefundeBlock.tsx)
- Zwei Guards halten Pitfall #44: der Status-Pfad kennt das Verlaufs-Modul nicht, und die durchweg `aktiv: false`-Regeln der Zuarbeit haben genau einen Konsumenten — [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)
- Gemessen und richtiggestellt: `Sonderstatus` und die Partner-Werte kommen im Antragsbestand **null**-mal vor — sie stehen nur auf Roh-Exportzeilen ohne Förderkennzeichen — [vorgangssystem.md §14](docs/architecture/vorgangssystem.md)

### v3.18.0 — Feedback-Tickets: Mehrfachauswahl, Ziehen, Kontextmenue, Swimlanes (August 2026)

MINOR — Etappe 2 des Feedback-Redesigns: alles, was MEHRERE Tickets betrifft. Nach Etappe 1 war jede Änderung ein Klick weit entfernt — aber vierzig Tickets an einen Bearbeiter zu geben blieben vierzig Einzelklicks.

- Mehrfachauswahl mit Häkchen + dunkle Bulk-Leiste (Status · Aufwand · Zuweisen · Archivieren); jede Aktion mit Sammel-Toast und Rückgängig je Ticket — [auswahl.ts](src/plugins/feedback-board/auswahl.ts), [BulkLeiste.tsx](src/plugins/feedback-board/ticket/BulkLeiste.tsx)
- `updateFeedbackMany`: ein Lese-/Schreiblauf statt n — fünfzig Einzelaufrufe wären fünfzig SMB-Runden und fünfzig Rennen um dieselbe Datei — [feedbackService.ts](src/core/services/feedback/feedbackService.ts)
- Karten zwischen den Spalten ziehen; eine markierte Karte nimmt die Auswahl mit, eine unmarkierte nur sich selbst — [TicketBoard.tsx](src/plugins/feedback-board/ticket/TicketBoard.tsx)
- Rechtsklick öffnet dasselbe Menü wie `⋯`; darin ein Schnell-Kommentar mit Bausteinen, `Strg+↵` und „Als Rückfrage" (Beitrag + Statuswechsel in einem Zug) — [TicketMenue.tsx](src/plugins/feedback-board/ticket/TicketMenue.tsx)
- Gruppierung in klappbare Bänder nach Bereich/Aufwand/Ersteller (Aufwand fachlich sortiert), Esc-Kaskade und `J`/`K` — [gruppierung.ts](src/plugins/feedback-board/gruppierung.ts)

### v3.17.0 — Feedback-Tickets: Verwaltung an der Karte, Status Rueckfrage, Sichten und Facetten (August 2026)

MINOR — Das Board hatte drei Defekte, die erst bei realer Ticketmenge greifen: die Verwaltungsfelder lagen vier Ebenen tief in einem eingeklappten Akkordeon, eine Entwickler-Rückfrage versandete als Kommentar, den niemand sah, und ab etwa hundert Tickets gab es keinen Einstieg außer „alle". Umbau nach Handoff `_design/handoff/feedback-redesign`; Etappe 1 von 2 (Massenbearbeitung folgt).

- Status, Aufwand, Zuständigkeit und Bereich sind Inline-Chips an Karte, Zeile und in einer festen Aktionsleiste im Detail — jede Änderung mit Toast und „Rückgängig" — [ticket/](src/plugins/feedback-board/ticket/)
- Neuer Status **Rückfrage** mit eigener Board-Spalte, Sicht „Wartet auf mich" und Klartext-Streifen, der Aufwand in Dauer übersetzt — [dauerText.ts](src/plugins/feedback-board/ticket/dauerText.ts)
- Rollenabhängige Sichten mit Zählern, Facetten-Leiste (Typ · Status · Bereich), Spalten-Kappung, Spaltenkopf-Summen, drei Dichte-Stufen — [smartViews.ts](src/plugins/feedback-board/smartViews.ts), [boardZahlen.ts](src/plugins/feedback-board/boardZahlen.ts)
- Neue Felder `assignee`/`bereich` + `FeedbackComment.kind` (additiv, Kurator-Felder shared-wins); Autor darf sein eigenes Ticket ändern, solange es auf „Neu" steht — [feedback.ts](src/core/types/feedback.ts)
- Zwölf abgelöste bzw. tote Bausteine entfernt (−1.400 LOC), `ScopeTabs` um Variante `pills-solid` + `trailing`-Slot erweitert — [feedback-system.md](docs/architecture/feedback-system.md)

### v3.16.1 — Gesamtbreiten-Griff auf 4px (August 2026)

PATCH — Der Griff am rechten Tabellenrand war auch nach 12 → 8 px noch zu breit für das, was er ist: eine Kante, kein Bedienelement mit Fläche.

- Griff 8 → 4 px, Griffpunkte 2 → 1,5 px (2 px füllten die 3 px Innenbreite fast randlos und lasen sich als Strich) — [TotalWidthGrip.tsx](src/components/data-table/TotalWidthGrip.tsx)
- Ziehen und Doppelklick-Reset in der 4-px-Rinne nachgemessen: 1.132 → 912 px gepinnt, Doppelklick zurück auf 1.132 und Eintrag gelöscht

### v3.16.0 — Kurzlabel aus einer Quelle (August 2026)

MINOR — Die Kurzform eines Statuswerts lag dreifach hartkodiert und war auseinandergelaufen: die Suche schrieb „Wiederspr. zur Ablehn." (Tippfehler), das Archiv-Kopfband „abgelehnt/zurückgez.", die Antragsliste „abgel./zurückgez.". Die Fassung für Code 72 war zudem auf eine Schreibweise geschlüsselt, die im Bestand gar nicht vorkommt — sie hat dort nie gegriffen (29 Fälle), und 65 % des Bestands (Sonderstatus, Skizze, Partner) hatten überhaupt keine Kurzform.

- Eine Quelle: `kurz` am Code-Katalog (30 Werte, gegen den Produktivbestand freigegeben) + kuratierbares `kurzLabel` je Code — [status-codes.ts](src/core/status/status-codes.ts), [katalog-edit.ts](src/core/status/katalog-edit.ts)
- Ein Lookup: `statusKurzLabel()` für enge Flächen, `statusLabel()` für Tooltip/Export/Prompt; fehlt beides, steht der gekürzte Bezeichner mit „…" da statt einer stillen Ersetzung — [status-wert-labels.ts](src/core/utils/status-wert-labels.ts)
- 15 Anzeigestellen tragen jetzt Kurzform **und** Tooltip mit dem vollen Bezeichner; `STATUS_LABELS`/`getStatusLabel` und die beiden anderen Kopien sind entfallen — [status-mappings.ts](src/core/utils/status-mappings.ts)
- Pflegeliste + Spalte „Kurzform" im Reiter *Statuswerte*, nach Vorkommen im Bestand sortiert; Längenhinweis meldet, blockiert aber kein Speichern — [KurzLabelPflege.tsx](src/plugins/status-cockpit/KurzLabelPflege.tsx)
- `statusKurz` heißt `statusHerleitungKopf`; das Herleitungs-Popover nennt die Kurzform und ihre Herkunft (Fassung / Auslieferung / nicht gepflegt) — [herleitung.ts](src/core/status/herleitung.ts)

### v3.15.0 — Spaltenfilter zeigen Trefferzahlen (August 2026)

MINOR — Die Spalten-Filter listeten nur die Werte auf; wie viele Zeilen hinter einem stehen, sah man erst nach dem Anwenden. Bei 605 Akronymen oder 33 FB-Kürzeln ist das ein Blindflug.

- Hinter jedem Wert steht seine Trefferzahl — **einseitige Facette**: andere aktive Spaltenfilter zählen mit, der eigene nicht — [useColumnFilters.ts](src/components/data-table/useColumnFilters.ts)
- Ein Wert, den die anderen Filter auf 0 drücken, bleibt wählbar (ausgegraut statt weg) — [ColumnFilterDropdown.tsx](src/components/data-table/ColumnFilterDropdown.tsx)
- Im Jahr→Monat-Baum trägt auch der Ordner seine Summe; die Zahl steckt im Knoten, nicht im Render — [filterBaum.ts](src/components/data-table/filterBaum.ts)
- Gerechnet wird nur für die gerade geöffnete Spalte (ein Durchlauf beim Öffnen statt ~25 bei jedem Klick) — [TableHeadRows.tsx](src/components/data-table/TableHeadRows.tsx)
- Die Suche zieht mit, über ihren eigenen Wert-Zugriff (`filterType: 'year'`) — [useSearchResults.ts](src/plugins/suche/useSearchResults.ts)

### v3.14.1 — DS und Irrlaeufer sind zwei verschiedene Luecken (August 2026)

PATCH — Hinter dem fehlenden Projektform-Treffer standen zwei ganz verschiedene Sachverhalte, die als ein „unbekannt" verschmolzen waren: **DS** ist eine echte Projektform, die nur nach der Zuarbeit entstanden ist (nachlieferbar), **Irrläufer** ist begrifflich gar keine — an uns gesendet, aber nicht unsere Zuständigkeit (nie nachlieferbar).

- `projektformLage()` unterscheidet `zuarbeit-aelter` von `keine-projektform`, damit niemand das eine mit der Lösung des anderen „repariert" (etwa DS auf FuE mappt) — [kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts)
- `projektformVonVbPhase()` bleibt unverändert die schlanke Frage „kann ich nachschlagen?" und liest nur noch aus der Lage ab — kein zweiter Weg

### v3.14.0 — Kuerzelkatalog je Projektform aus der Zuarbeit (August 2026)

MINOR — Die Kürzeltabelle war flach: ein Kürzel, eine Bezeichnung. 77 Kürzel bedeuten aber je nach Projektform etwas anderes — `AB` ist in DL die „Bewilligungsempfehlung durch Haushaltsbeauftragte", sonst „bewilligungsreif/Akte an Euronorm". Am Produktivbestand gemessen: **11 216 von 14 222 Anträgen (78,9 %)** tragen mindestens ein Kürzel, dessen angezeigter Klartext für ihre Projektform falsch ist.

- Katalog mit Schlüssel **Kürzel × Projektform** (608 Kürzel, 1 350 Paare) aus der Zuarbeit generiert — [gen-kuerzel-katalog.mjs](scripts/gen-kuerzel-katalog.mjs)
- Nachschlagen nur über `kuerzelAuskunft(kuerzel, projektform)`; unbekannte Projektform + uneinige Formen ⇒ `eindeutig: false` statt geratener Bedeutung — [kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts)
- Historische Kürzel bleiben über `ersetztDurch` auflösbar (83 Umbenennungen), damit Altfälle lesbar bleiben — [kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts)
- 41 Trigger-Regeln importiert, **alle `aktiv: false`**; Benachrichtigung und Statuswechsel als getrennte Felder, 15 unauflösbare Zielstatus markiert statt geraten — [kuerzel-trigger.data.ts](src/core/status/kuerzel-trigger.data.ts)
- Guard `kuerzel-nie-flach` verbietet den direkten Zugriff auf die Rohtabelle — [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)

### v3.13.1 — Projektart-Menue liegt vor der Tabelle (August 2026)

PATCH — Das neue Untermenü lag hinter der Tabelle: die aufgeklappte Pille trägt eine Animation mit `transform` und ist damit ein eigener Stacking-Context — ein `z-index` darin gilt nur innerhalb der Pille. Dazu las sich der Knopf „Einzelprojekt · Einzelprojekt 397", weil der Oberpunkt im Menü noch einmal steht und sich selbst als aktiven Unterpunkt fand.

- Untermenü hängt am `document.body` und wandert beim Scrollen mit dem Anker mit (Muster aus `ColumnFilterDropdown`) — [CollapsibleSeg.tsx](src/plugins/antraege/filter/CollapsibleSeg.tsx)
- Was der Segment-Knopf anzeigt (aktiv? welche Zahl? welcher Zusatz?) entscheidet ein reines, geprüftes Modul — [segAnzeige.ts](src/plugins/antraege/filter/segAnzeige.ts)

### v3.13.0 — Projektart-Filter: Einzelprojekt mit Menue, Zaehler folgen dem Antragstyp (August 2026)

MINOR — Die Projektart brachte fünf Segmente in eine Leiste, die schon vier Pillen trägt, und zwei davon lasen sich wie eine Aufteilung von „Einzelprojekt" (397 = 38 + 192), die sie nicht sind. Dazu zählten die Stufen den vollen Bestand, während der Antragstyp-Filter davor schon geschnitten hatte.

- Die Netzwerkbezug-Stufen hängen im **Menü** unter „Einzelprojekt" statt daneben; Kurzform „mit / ohne NW Bezug" — [projektartQuickfilter.ts](src/plugins/antraege/filter/projektartQuickfilter.ts)
- Segment-Knöpfe können ein Untermenü tragen (`unterpunkte`, opt-in — die fünf anderen Nutzer von `SegGroup` bleiben unverändert) — [CollapsibleSeg.tsx](src/plugins/antraege/filter/CollapsibleSeg.tsx)
- Projektart-Zähler folgen dem gewählten Antragstyp (einseitig: „FuE" schneidet mit, die eigene Auswahl nicht) — [QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx)
- Mehrere Filter-Pillen dürfen gleichzeitig offen sein; der Zustand ist eine Menge statt eines Einzelwerts, alter Einzelwert wird gelesen — [quickfilterExpanded.ts](src/plugins/antraege/filter/quickfilterExpanded.ts)
- Eine filternde Pille ist markiert — zugeklappt Rahmen + Grund, aufgeklappt die Beschriftung — [CollapsibleSeg.tsx](src/plugins/antraege/filter/CollapsibleSeg.tsx)

### v3.12.0 — Tabelle: stehende Kopfzeile, Darstellungs-Menue, verdichteter Seitenkopf (August 2026)

MINOR — Der Seitenkopf der Fördertabelle war auf fünf Zeilen gewachsen: die drei Schalter „Ansicht", „Gruppierung" und „Beendet" belegten rechts rund 640 px und drängten die Quickfilter in einen Umbruch, unter dem die Trefferzahl noch eine eigene, links leere Zeile bekam. Nachgemessen bei 1.226 px Inhaltsbreite: 70 px weniger Kopf, zwei Zeilen weg. Und beim Blättern nach unten verschwand die Kopfzeile — bei 21 Spalten weiß dann niemand mehr, welche Spalte er liest.

- Die drei Achsen teilen sich ein Menü „Darstellung"; der Knopf nennt nur, was vom Standard abweicht — [darstellungsAchsen.ts](src/plugins/antraege/darstellungsAchsen.ts)
- Trefferzahl reitet im Umbruch der Quickfilter mit (Slot in der Toolbar, kein Geschwister — als Nachbar bricht sie immer eigenständig um) — [QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx)
- Kopf- und Rubrikzeile bleiben stehen; dafür wird der Tabellenkasten selbst der senkrechte Scroller — [SortableTable.tsx](src/components/data-table/SortableTable.tsx)
- Lade-Streifen wandert MIT in den Scroller (`footerSlot`, `sticky left-0`) und der Beobachtungs-Bereich auf den Kasten — sonst lädt die Seite sofort alles nach oder gar nichts mehr — [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx)
- Platz für den senkrechten Scrollbalken fest reserviert: er erschien sonst erst nach der Breitenmessung und verengte genau das gemessene Element — [SortableTable.tsx](src/components/data-table/SortableTable.tsx)

### v3.11.0 — Fristen-Stoppuhr: die Uhr haelt mit der Erstentscheidung an (August 2026)

MINOR — Die 90-Tage-Uhr rechnete für **jeden** Antrag bis heute weiter, auch für einen 2018 abgelehnten: CRISPROMIC zeigte „seit 2 760 T" — exakt Eingang + 90 Tage. Die Arithmetik stimmte, das Kriterium fehlte. Ebenso schwer wog die Gegenrichtung: „keine Basis", „keine Frist nötig" und „terminal" waren alle dieselbe leere Zelle. Das Haltekriterium existierte bereits — aber nur im Vorgangs-Board, als feste Code-Menge.

- Frist liefert einen **Zustand** statt einer Zahl (`laeuft` / `angehalten` / `nicht_berechenbar`), jeder mit eigener Anzeige und eigenem Grund — [frist-ergebnis.ts](src/core/services/csv/frist-ergebnis.ts)
- Das Haltekriterium ist **Katalogdatum am Verfahrensschritt** (`fristLaeuft`) und damit ohne Release änderbar; Seed hält ab „Entscheidung" an — [zah-phasen.ts](src/core/status/zah-phasen.ts)
- Haltedatum als Kaskade Journal → Datumsfeld derselben Phase → „unbekannt"; nie ersatzweise weiterlaufen lassen — [haltedatum.ts](src/core/status/haltedatum.ts)
- Tab-Zähler „Überfällig"/„Diese Woche" fragen dieselbe Engine wie die Spalte daneben (vorher Eingangsalter mit eigenen 84/90-Literalen) — [views.ts](src/plugins/antraege/views.ts)
- Guard `no-inline-frist-arithmetik`: die Zahl 90 gehört ins Fristmodul, `ANTRAG_SLA_DAYS` benutzen ist erwünscht — [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)

### v3.10.0 — Team-Antwort im Board, Verwaltung fuer alle PL (August 2026)

MINOR — Eine öffentliche Team-Antwort war im Board unsichtbar: `kurator_response` lag in jedem Kanban-Item, wurde aber nirgends gerendert, und das einzige Signal war ein Badge hinter `mine && unread`. `mine` wiederum war kaputt — erfasst wurde unter `profile.name`, verglichen gegen das Kürzel, also galt jedes eigene Ticket als fremd („Von mir" leer, keine Glocke, kein „Ergänzen").

- „Antwort"-Pill auf Karte und Listenzeile, solange eine Antwort existiert; Wortlaut im Hover, Antworttext ist mitsuchbar — [FeedbackAntwortHover.tsx](src/components/feedback/FeedbackAntwortHover.tsx)
- Zugehörigkeit über eine tolerante Identität (Kürzel UND Profilname), Schreiben behält EINE kanonische Id; Guard `no-direct-feedback-user-id-compare` — [feedbackIdentitaet.ts](src/core/services/feedback/feedbackIdentitaet.ts)
- „Ergänzen" hängt nur noch am Schreibrecht: jedes PL-Mitglied darf jedes Ticket fortschreiben (Beta) — [FeedbackBoardDetail.tsx](src/components/feedback/FeedbackBoardDetail.tsx)
- Schreib-Lage `geschrieben|kein-schreibrecht|fehler`: „Gespeichert" nur noch bei echtem Write, und ein unlesbarer Stand dampft den Teambestand nicht mehr auf ein Ticket ein — [feedbackSharedFile.ts](src/core/services/feedback/feedbackSharedFile.ts)
- Einstellungen-Reiter fragt die Datei-Lage statt der nie gefüllten Legacy-Registrierung; System-Prompt kommt endlich vom Share — [FeedbackConfigPanel.tsx](src/plugins/feedback-board/verwaltung/FeedbackConfigPanel.tsx)

### v3.9.0 — Tabelle: Ueberschuss an abgeschnittene Spalten, Filter-Chevron on demand, FKZ-Kopierknopf ueberlagert (August 2026)

MINOR — Schmale Spalten waren breiter als ihr Inhalt: `min-width:100%` streckte im Scroll-Modus ALLE Prozent-`<col>` proportional (nachgemessen +25 % je Spalte), der Kopf reservierte 38 px für Sortierpfeil und Filter-Chevron, und der FKZ-Kopierknopf belegte 28 px für etwas, das nur beim Hover erscheint. Ergebnis: FKZ 179→111, die vier Kürzel-Spalten 101→64, Frist 116→90.

- Freier Platz geht nur noch an Spalten, deren Text `maxWidth` kürzt; ein gezogener Override schützt seine Spalte, der Rest parkt in einer zellenlosen Füller-`<col>` — [tableSizing.ts](src/components/data-table/tableSizing.ts)
- Filter-Chevron verlässt den Textfluss und erscheint beim Überfahren; dauerhaft sichtbar (und im Kopf eingerechnet) nur, wo ein Filter liegt — [TableHeadRows.tsx](src/components/data-table/TableHeadRows.tsx)
- FKZ-Kopierknopf liegt im rechten Zellpolster statt in einem reservierten Slot — [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)
- Kopf-Messmodell korrigiert: `<th>` ist fett, und `button` hebt `uppercase` auf („Status und nächster Schritt" war 31 px zu breit veranschlagt, ZTP 1,2 px zu schmal) — [textMessung.ts](src/components/data-table/messung/textMessung.ts)
- Drag-Rückrechnung deckelt `scale` auf 1 — mit verteiltem Überschuss hätte ein Zug an einer unverteilten Spalte ihre Breite durch 1,4 geteilt gespeichert — [useColumnResize.ts](src/components/data-table/useColumnResize.ts)

### v3.8.0 — Projektart: Einzel- und Kooperationsprojekt als eigene Achse (August 2026)

MINOR — Einzel- vs. Kooperationsprojekt war fachlich längst da (die Aufbereitung beschriftet den 1-TV-Fall so), aber nirgends filterbar. Einzelprojekt = FuE/DS mit genau einem Teilvorhaben, Kooperationsprojekt mit mehreren; der Netzwerkbezug (16KN/16EP) liegt als zwei Unterstufen darin.

- Neue Pille „Projektart" neben „Antragstyp", fünf Stufen mit Zählern und Klartext-Tooltips — [QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx)
- Abgeleitete Klassifikation als eigener Pipeline-Schritt neben PreCheck, nicht als Seed-Facette (die Engine machte aus einem Nicht-Slim-Feld still ein `() => true`) — [projektartQuickfilter.ts](src/plugins/antraege/filter/projektartQuickfilter.ts)
- Die TV-Zahl kommt aus `verbundById`, also filter-unabhängig: ein Statusfilter macht aus einem Kooperationsprojekt kein Einzelprojekt — [useFilteredAntraege.ts](src/plugins/antraege/useFilteredAntraege.ts)
- `istEinzelFkz` (16EP) als Gegenstück zu `extractNetzwerkId` (16KN) — bewusst nicht „alles außer 16KN" — [netzwerk.ts](src/plugins/antraege/netzwerk.ts)
- Zähler und Filter laufen über dieselbe Prädikatsfunktion; ein Test hält fest, dass `mit + ohne < Einzelprojekt` gelten darf (16DS gehört in keine Unterstufe) — [projektartQuickfilter.test.ts](src/plugins/antraege/__tests__/projektartQuickfilter.test.ts)

### v3.7.0 — Antragseingang-Filter nach Monaten, neueste zuerst (August 2026)

MINOR — Der Spaltenfilter bucketete auf das Jahr und sortierte aufsteigend: die Liste startete bei 2018, das aktuelle Jahr stand hinter einer Scroll-Strecke. Nebenbefund: Zeilen ohne lesbares Datum lieferten `''`, waren nicht anwählbar und fielen still aus der Tabelle, sobald ein Jahr angehakt war.

- Filterwert ist der Monat, das Jahr die Gruppe; neueste zuerst, Jahre zugeklappt — [spaltenFilterWerte.ts](src/plugins/antraege/spaltenFilterWerte.ts)
- Das Dropdown wird mit `groupOf` zweistufig (`TfTree`, Tri-State); ohne die Prop bleibt es die flache Liste wie bisher — [ColumnFilterDropdown.tsx](src/components/data-table/ColumnFilterDropdown.tsx)
- Reiner Baum-Adapter; Werte außerhalb der Suchtreffer überleben einen Klick — [filterBaum.ts](src/components/data-table/filterBaum.ts)
- `SortableColumn.filterSort` / `.filterGroupOf`: Reihenfolge-Hoheit liegt bei der Spalte, nicht beim Dropdown — [types.ts](src/components/data-table/types.ts)
- Zeilen ohne Datum stehen als „(leer)" am Ende und bleiben wählbar — [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)

### v3.6.1 — Abschnitts-Bänder zählen den Abschnitt, nicht die Seite (August 2026)

PATCH — Die Zahl an einem Abschnittskopf kam aus den GERENDERTEN Zeilen, nicht aus dem Abschnitt: sie wuchs beim Nachladen, und ihre Summe ergab exakt die Seitengröße (gemessen: „AAt 48" + „AM 12" = 60). Betraf Tabelle (status/netzwerk/fb/ab) und die Status-Abschnitte in Listen- und Karten-Ansicht.

- Abschnitts-Zahlen kommen aus dem vollen Satz statt aus der Seite — eine Zählung für alle drei Ansichten — [zaehleJeAbschnitt](src/plugins/antraege/antragGroups.ts)
- Abschnitts-Id einer Gruppe hat eine Heimat (`statusSectionIdOf`); Zähler und Sektionierung können nicht mehr verschiedene Schlüssel bilden — [antragGroups.ts](src/plugins/antraege/antragGroups.ts)
- Der Arbeitsvorrat/Beendet-Zweig braucht dafür keine Sonderbehandlung mehr — er läuft über denselben Weg — [AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx)

### v3.6.0 — Beendet-Schalter: eigene Achse statt Kopplung an die Gruppierung (August 2026)

MINOR — Der Arbeitsvorrat/Beendet-Split hing an „Gruppierung: Keine". Das war eine stille Kopplung: wer gruppierte, verlor die Trennung. Als die Verbund-Verdichtung mit v3.4 aus der Gruppierung auf die Ansicht-Achse wanderte, tauchte der Split unangekündigt bei allen auf, die zuvor „Gruppierung: Verbund" stehen hatten.

- Dritter Toolbar-Schalter „Beendet: ausgeblendet | eingeblendet" im Reiter „Alle", unabhängig von Ansicht und Gruppierung — [arbeitsvorrat.ts](src/plugins/antraege/arbeitsvorrat.ts)
- Ausgeblendete Zeilen bleiben unter **jeder** Gruppierung abzählbar: Streifen unter der Liste mit Zahl und Aufschlüsselung — [AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx)
- Die zwei Bänder (Arbeitsvorrat/Beendet) erscheinen nur noch, wo sie etwas trennen — bei „Gruppierung: Keine" und eingeblendetem Beendet-Teil — [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx)
- Drei Notbremsen in EINER reinen Funktion statt verstreut: nichts Beendetes, nur Beendetes, laufende Suche — [istBeendetVersteckt](src/plugins/antraege/arbeitsvorrat.ts)
- Schalter-Zustand behält seinen localStorage-Schlüssel — ein neuer hätte jeden bestehenden Wunsch verworfen — [useBeendetSichtbarkeit.ts](src/plugins/antraege/useBeendetSichtbarkeit.ts)

### v3.5.0 — Tabelle: Auto-Spaltenbreiten, sichtbarer Breiten-Griff, Sticky-Kopf, Spalten-Sets (August 2026)

MINOR — Seit v3.3.0 sind 24 Spalten plus die Ordner-Spalten des Statuskatalogs wählbar; die Tabelle war dafür nicht gebaut. Die Breiten stammten aus handgepflegten Pixelwerten statt aus dem Inhalt, der Griff für die Gesamtbreite lag im Scroll-Zustand außerhalb des Sichtfelds (gemessen: 731 px rechts daneben), und beim Scrollen verschwanden Kopfzeile und FKZ.

- Spaltenbreiten kommen aus dem Inhalt statt aus gepflegten Pixelwerten (Kette: gezogen > gemessen > gepflegt); gemessen wird der volle gefilterte Satz, damit Nachladen und Sortieren die Breiten nicht verschieben — [messung/spaltenBreite.ts](src/components/data-table/messung/spaltenBreite.ts)
- Rubrik-Kopfzeile über den Spaltenköpfen; dafür ist die Registry nach Rubrik geordnet (Antrag · Zuständigkeit · Antragsdaten · Status · Termine) — Tabelle und XLSX-Export ziehen gemeinsam mit — [rubrikSpannen.ts](src/components/data-table/rubrikSpannen.ts)
- Spalten-Picker mit Suchfeld (ab 12 Spalten), Zähler „x von y" und Rubrik-Schalter „alle/keine"; die erzwungene MA-Spalte steht jetzt als „auto" drin statt zu fehlen — [columnPickerLogik.ts](src/components/data-table/columnPickerLogik.ts)
- Die FKZ-Spalte bleibt beim waagerechten Scrollen stehen; die Beschriftung der Gruppierungs-Bänder ebenfalls — [TableBody.tsx](src/components/data-table/TableBody.tsx)
- Doppelklick auf den Spaltengriff verwirft eine gezogene Breite, statt die gemessene festzuschreiben — die Spalte folgt danach wieder dem Inhalt — [columnWidthStorage.ts](src/components/data-table/columnWidthStorage.ts)
- Der Griff für die Tabellenbreite steht jetzt neben dem Scroll-Container statt darin — bei vielen Spalten lag er außerhalb des Sichtfelds und war nur 15 px hoch — [TotalWidthGrip.tsx](src/components/data-table/TotalWidthGrip.tsx)
- Tabellen-Baustein entlang seiner Verantwortungen zerlegt — Layout-Rechnung, Resize, Griff, Kopf, Körper je eigene Datei; die drei Größen-Modi sind erstmals testbar statt nur im Dateikopf beschrieben — [tableLayout.ts](src/components/data-table/tableLayout.ts)
- Datumsspalten zeigen `30.07.2018` statt `2018-07-30`; der XLSX-Export schrieb unter „FB Status", „PreCheck Status" und allen Ordner-Spalten das ISO-Datum statt des Labels — [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)
- Ein Klick ohne Ziehen auf den Spaltengriff schrieb bisher eine Spaltenbreite (im gestauchten Modus sogar eine verrechnete) — [useColumnResize.ts](src/components/data-table/useColumnResize.ts)

### v3.4.0 — Glossar (August 2026)

MINOR — Statuswerte, Kürzel, Trigger-Herkunft und Zieltage sind gepflegt, waren aber nur über „Vorgangs-Regeln" erreichbar — ein Kurationswerkzeug voller Eingabefelder. Wer wissen will, was RNE heißt, öffnet es nicht. Dazu beschrieb der Begriffs-Abschnitt in „Über die App" einen Stand vor dem Vorgangssystem.

- Neues Modul „Glossar" unter Werkzeuge, ohne Feature-Flag: ein Suchfeld über Abkürzungen, Statuswerte, Kürzel und To-do-Regeln — [src/plugins/glossar/](src/plugins/glossar/), Seed in [abkuerzungen.seed.ts](src/core/glossar/abkuerzungen.seed.ts)
- Kürzel-Detail zeigt „Löst aus" (Trigger-Wirkung nach Wortlaut gebündelt) und „Wird verwendet von" (prüfende Regeln) — [navigator.ts](src/core/status/navigator.ts) `wirkungGruppen`, Rückwärts-Index über `todoFeld()` (Pitfall #44)
- Rollensicht „Für meine Rolle wichtig": Kürzel je Fachrolle nach Vorkommen, Filter auf die Richtlinie, neutrale Kürzel abgesetzt — [RollenSicht.tsx](src/plugins/glossar/RollenSicht.tsx)
- Begriffe richtiggestellt und ins Glossar umgezogen: „Rollen" getrennt in Ausgabe/Berechtigung und Fachrolle, Verfahrensschritt und Arbeitsliste ergänzt — [_app.md](docs/feedback-kontext/_app.md)
- Hilfe-Dialog: Titel 18 px über Abschnitten mit 16 px — die Hierarchie stand auf dem Kopf; dazu ein Weg ins Glossar aus Hilfe-Kopfzeile und Herleitungs-Popover

### v3.3.0 — Zuständigkeits-Spalten und geordneter Spalten-Picker (August 2026)

MINOR — Der Reiter „Begleitung" filtert nach den Antragsphasen-Kürzeln (TIB/BIB), zeigt aber Anträge in der Begleitphase — wer sie begleitet (ZTP/PFM), stand nirgends. Und der Spalten-Picker war eine ungegliederte Liste von 37 Einträgen.

- Vier Zuständigkeits-Spalten statt einer: TIB · BIB · ZTP · PFM, BIB ab Werk eingeblendet — [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)
- Spalten-Picker nach Rubriken (Antrag/Zuständigkeit/Status/Termine/Ordner je Ebene), Überschriften bleiben beim Scrollen stehen — [ColumnPicker.tsx](src/components/data-table/ColumnPicker.tsx), opt-in über `SortableColumn.gruppe`
- Neue Standardspalten werden bestehenden Auswahlen einmalig nachgereicht statt still zu fehlen — [useAntraegeColumnsStore.ts](src/plugins/antraege/useAntraegeColumnsStore.ts)
- Kürzel-Pills ohne Versalien: „StE" bleibt „StE" — [MaKuerzelBadge.tsx](src/plugins/antraege/MaKuerzelBadge.tsx)

### v3.2.2 — Favicon prod auf ZIM-Lila (August 2026)

PATCH — Das Schiefer-Blau aus v3.2.1 war ein Platzhalter meiner Wahl; prod trägt jetzt die Hausfarbe.

- `build.faviconColor` der prod-Variante auf `#5C2483` — [prod.config.json](configs/prod.config.json); Weiß darauf 10,3:1
- Farbliste im Branding-Runbook nachgezogen, inklusive der Ansage, dass der Fallback `#506786` bewusst keiner Variante gehört — [change-app-branding.md](docs/agents/change-app-branding.md)

### v3.2.1 — Tab-Titel auf ZIM umgestellt + Favicon je Variante (August 2026)

PATCH — Der prod-Tab hieß „ZAH prod" — ein Bauzeit-Etikett vor Endnutzern, während die Datei längst `zim-dashboard.html` heißt. Und die App hatte überhaupt kein Favicon: unter `file://` läuft die `favicon.ico`-Anfrage ins Leere, im Tab stand das generische Blatt.

- Tab-Titel: prod `zim-dashboard`, pl `zim-pl`, dev `zim-dev` — [configs/](configs/prod.config.json). Dateinamen und Sidebar-Label bleiben (`outputFilename` hängt am IndexedDB-Namen)
- Favicon als Inline-`data:`-URI: Monogramm „Z" auf abgerundetem Quadrat, Geometrie auf 16 px gemessen — [scripts/favicon.mjs](scripts/favicon.mjs). Icon-**Dateien** gehen hier nicht: Vite lehnt das Inlinen von Icon-Links ab, singlefile inlined nur JS/CSS
- Neues optionales `build.faviconColor` (`#rrggbb`, validiert): prod schiefer-blau, pl grün, dev orange, local grau — gleichzeitig offene Builds sind im Tab unterscheidbar
- Injektion im bestehenden Hook (jetzt `teamflow-index-html-branding`), der schon Titel und Loader-Label ersetzt — [vite.config.ts](vite.config.ts)
- Guards: Farben paarweise verschieden, kaputte Farbe = Validierungsfehler statt stiller Default, `index.html`-Kopie byte-gleich zu `favicon.mjs` — [favicon.test.ts](src/config/__tests__/favicon.test.ts)

### v3.2.0 — Tabelle: Ansicht und Gruppierung getrennt (August 2026)

MINOR — Die Pille „Gruppierung" mischte zwei Dinge: „Status" bildete Abschnitte, „Verbund" verdichtete Teilvorhaben zu einer Zeile. Weil beides im selben Schalter saß, schlossen sie sich aus — wer nach Status gruppieren wollte, verlor die Verdichtung. Jetzt sind es zwei Achsen.

- Neue Achse **Ansicht** (`antrag` / `antrag-mit-tv`) mit eigenem Store-Slot; `verbund` ist als Gruppierung entfallen — [tableGrouping.ts](src/plugins/antraege/tableGrouping.ts), [store.ts](src/plugins/antraege/store.ts)
- Drei neue Gruppierungen: **NW** (reuse der Netzwerk-Engine inkl. Namens-Index), **FB** (`tib_kuerz`) und **AB** (`bib_kuerz`), alphabetisch, „ohne …" als letzter Abschnitt
- Persistenz-Whitelist kommt aus den Optionen (`istTableGroupingMode`) statt aus einer zweiten Literal-Liste — ein gespeichertes `verbund` fällt dadurch auf `none`
- **Fix:** die Status-Bänder der Tabelle zeigten die rohe Abschnitts-Id („VOR-ENTSCHEIDUNG"); die Beschriftung kommt jetzt vom Builder — [AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx)
- Nachgemessen in `dev:local` (Reiter „Diese Woche", 49 TV): Ansicht „Antrag" → 34 Zeilen, alle Band-Summen = Zeilenzahl, „Ohne Netzwerk" zuletzt, `__tf.fehler()` = 0

### v3.1.0 — Drift-Bilanz und Ist-Stand (August 2026)

MINOR — Der Phasenschnitt wird seit v2.409 in der App kuratiert, prod läuft weiter auf dem Seed — wie weit beide auseinander sind, wusste niemand. Und Beschluss und Umsetzung waren unverbunden: die Klärung sagte bei Code 29 „einig → Abgeschlossen", der Baum hielt ihn ohne Phase, der Widerspruch fiel nirgends auf.

- Neue Bilanz `katalogDrift(fassung, seed)` nach Phasen/Zuordnungen/Zieltagen/Statuswerten/Prominenz, angezeigt als ausklappbare Zeile im Statuswerte-Tab — [katalog-drift.ts](src/core/status/katalog-drift.ts), [README](docs/status-system/README.md). Kein Nachzieh-Knopf: sie stellt fest.
- Gezählt wird die **Sache**, nicht die Katalogzeile — ein Status steht an TV- und Verbund-Feld; ungefiltert meldete die Bilanz jeden Zieltag doppelt (30 statt 17 im Bestand)
- „Zu klären" zeigt je Zeile den **Ist-Stand** des Katalogs mit den Vermerken umgesetzt / noch offen / abweichend beschlossen, dazu den Filter „Nicht umgesetzt" — [gruppen.ts](src/plugins/zu-klaeren/gruppen.ts), [klaerung.md](docs/architecture/klaerung.md)
- Der Export „Seed-Änderungen" kommt aus der **Fassung** statt aus den Antworten ([seedExport.ts](src/plugins/zu-klaeren/seedExport.ts)): am 05.08. nannte er fünf Änderungen, während der Baum zehn Umhängungen und drei Phasenänderungen trug
- `useKlaerung` verglich Fassung und Auslieferung in einer eigenen Schleife — ersetzt durch dieselbe Bilanz; die Pillen-Zahl „30" kommt jetzt aus den Zeilen statt aus dem Code

### v3.0.1 — Kommentar geht nicht mehr still verloren (August 2026)

PATCH — Gemeldet: Kommentar schreiben, senden, Ticket schließen, wieder öffnen — Kommentar weg, ohne jede Meldung. Ursache ist eine Verwechslung zwei Ebenen tiefer: `readText` schluckt jeden Lesefehler und liefert `null`, ununterscheidbar von „Datei gibt es nicht".

- Neue Lage-Unterscheidung `ok`/`leer`/`unlesbar` ([readSharedFileLage](src/core/services/feedback/feedbackSharedFile.ts)); `readSharedFile` bleibt für Leser unverändert
- Schreibende Pfade (`addComment`, `toggleVote`, `sponsorTicket`, `unsponsorTicket`) brechen bei `unlesbar` ab, statt auf leerer Basis zu rechnen — vorher hielten sie das Ticket für nicht existent und verwarfen die Eingabe wortlos
- **Verhinderter Datenverlust:** in derselben Lage schrieb der Vorgang den lokalen Teilbestand über die geteilte Datei — fremde Kommentare/Stimmen wären verschwunden ([addComment.test.ts](src/core/services/feedback/__tests__/addComment.test.ts) hält beides fest)
- Fehlschlag ist jetzt sichtbar und der Text bleibt stehen ([FeedbackCommentThread.tsx](src/components/feedback/FeedbackCommentThread.tsx)) — `useAsyncAction.error` wurde nie gerendert, `ok:false` gar nicht ausgewertet
- Nachgemessen in `dev:local`: Kommentar senden → schließen → öffnen hält (vorher/nachher), kein Hinweis-Banner im Normalfall, `__tf.fehler()` = 0

### v3.0.0 — Build-Konsolidierung: drei Varianten, Module per Zusatzpasswort (August 2026)

MAJOR — Aus fünf Build-Varianten werden drei. `as` und `kurator` unterschieden sich von `pl` nur in Flags bei byte-gleichem Code — die Trennung sparte kein Byte und kostete Pflege (`as` fiel über zwölf Flags zurück, v2.403). Was die Zielgruppen trennte, entscheidet jetzt ein Zusatzpasswort zur Laufzeit.

- `pl`, `as` und `kurator` gehen in einem `zah-pl.html` auf; Auslastung und Kuration liegen dort hinter je einem Zusatzpasswort — [modul-freischaltung.md](docs/architecture/modul-freischaltung.md), Pitfall #51
- Der prod-Build heißt **`zim-dashboard.html`** (vorher `zah-prod.html`) — [prod.config.json](configs/prod.config.json)
- Elf Feature-Flags entfernt (38 → 27): sie trugen überall denselben Wert oder bedienten nur eine abgeschaffte Variante — [feature-flags.ts](src/config/feature-flags.ts)
- Der doppelte Kurator-Login ist weg: `_intern/kurator-config.enc` entfällt, geblieben ist der Build-Weg; die Audit-Identität kommt jetzt aus dem Profilnamen statt aus dem Build-Label — [update-author.ts](src/core/services/infrastructure/update-author.ts)
- Variant-Configs enthalten nur noch ihre Abweichungen (`buildBasis()` als neutrale Basis) — [config-schema.mjs](scripts/config-schema.mjs)

**Migration.** `zim-dashboard.html` leitet einen neuen IndexedDB-Namen ab (`teamflow-zim-dashboard`);
bestehende prod-Installationen laufen **einmalig** durch Onboarding + Ordner-Freigabe + Profil.
Fachdaten gehen nicht verloren — der Share ist die Quelle der Wahrheit, die IDB nur Cache. Die
alte `teamflow-zah-prod`-DB bleibt harmlos liegen und kann über die DevTools gelöscht werden.
Nutzer von `zah-as.html` / `zah-kurator.html` wechseln auf `zah-pl.html` (ebenfalls einmaliger
Erststart). `_intern/kurator-config.enc` wird nicht mehr gelesen.

**Vor dem Rollout**: die Platzhalter-Passwörter ersetzen —
`npm run set-password -- pl --modul auslastung "<pw>"` und `--modul kurator "<pw>"`.

### v2.416.0 — Kommentare im Hover lesen, neue Kommentare sichtbar (August 2026)

MINOR — Die Diskussion an einem Ticket war unsichtbar: das Board zeigte `💬 3` als stumme Zahl, den Inhalt gab es nur nach einem Klick im Detail-Panel. Genau die Tickets mit laufender Diskussion sind aber die wichtigen.

- Hover über den Kommentar-Zähler zeigt die letzten vier Kommentare direkt (gekürzt, scrollbar, „+N ältere") — [FeedbackCommentHover.tsx](src/components/feedback/FeedbackCommentHover.tsx); Klick öffnet weiterhin das Detail
- Thread und Vorschau teilen sich eine Darstellung ([FeedbackCommentList.tsx](src/components/feedback/FeedbackCommentList.tsx)) und eine reine Auswahl-Funktion (`waehleKommentarVorschau` in [feedbackUi.ts](src/components/feedback/feedbackUi.ts))
- Neue Kommentare tragen ein blaues **„+N"** im Kopf der Karte (neben „Antwort") und sind in Vorschau + Thread hinterlegt — [FeedbackKanban.tsx](src/components/feedback/FeedbackKanban.tsx) / [FeedbackCard.tsx](src/components/feedback/FeedbackCard.tsx)
- Gelesen-Stand gerätelokal je Ticket ([kommentarStand.ts](src/components/feedback/kommentarStand.ts) + [useUnreadComments.ts](src/components/feedback/useUnreadComments.ts)); Details + Invarianten in [feedback-system.md](docs/architecture/feedback-system.md)
- Nachgemessen in `dev:local`: Erststart setzt die Baseline und zeigt **kein** „+N"; nach zwei fremden Kommentaren „+2", nach dem Öffnen weg; Vorschau 340×282 mit Innen-Scroll (464 px Inhalt), am schmalen Rand vollständig im Bild; dense-Kopfzeile ohne Überlauf (Antwort + „+1" + Datum in 200 px); `__tf.fehler()` = 0
- `feedbackImprove.test.ts` nach `ISOLATED_TESTS` ([vitest.config.mts](vitest.config.mts)) — sein `screenContext`-Mock hielt der neuen Ladereihenfolge im geteilten Modul-Register nicht stand

### v2.415.2 — Feedback-Karte erzeugt keine verschachtelten Buttons mehr (August 2026)

PATCH — Das Feedback-Board meldete bei jedem Laden zwei React-Fehler: die Vote-Pille (ein `<button>`) saß in der Meta-Zeile innerhalb des Karten-`<button>` — ungültiges HTML.

- Die anklickbare Kartenfläche ist jetzt ein `div role="button"` mit `tabIndex` und Enter-/Leertaste-Handler ([FeedbackCard.tsx](src/components/feedback/FeedbackCard.tsx))
- Gleiches Muster wie die Board-Karte in [FeedbackKanban.tsx](src/components/feedback/FeedbackKanban.tsx); die Sibling-Lösung aus `FeedbackTicketRow.tsx` trägt hier nicht, weil die Pille im Textfluss sitzt statt am Rand
- Klick auf die Pille wählt die Karte weiterhin nicht mit aus — `FeedbackVotePill` stoppt die Propagation bereits selbst
- Nachgemessen in `dev:local`: Liste und Board je frisch geladen `__tf.fehler()` = 0 (vorher 2), `document.querySelectorAll('button button')` = 0
- Geometrie unverändert gegen den Vorher-Wert (Karte 950×96 bei x=259, Titel x=313/w=846, Pille x=1157); Fokusring bleibt (`:focus-visible`), Enter/Leertaste/Klick wählen, Vote zählt hoch und runter

### v2.415.1 — Kommentarfeld waechst mit und ist ziehbar (August 2026)

PATCH — Das Kommentarfeld im Feedback-Detail war einzeilig und fest: wer mehr als einen Satz schrieb, sah den eigenen Text nicht mehr.

- Feld startet auf **drei Zeilen** und **wächst beim Schreiben mit** (Rezept aus dem Chat-Composer), gedeckelt bei 320 px — darüber scrollt es intern ([FeedbackCommentThread.tsx](src/components/feedback/FeedbackCommentThread.tsx))
- Zusätzlich am nativen Anfasser ziehbar (`resize-y`); die gezogene Höhe wird gerätelokal gemerkt, weil das Detail-Panel je Ticket neu mountet
- Auto-Wachsen und Anfasser schreiben beide `style.height` — deshalb setzt das Ziehen die **Mindest**höhe, nicht eine feste Höhe ([berechneKommentarHoehe](src/components/feedback/feedbackUi.ts))
- Erkannt wird das Ziehen an der Zeiger-Geste, nicht per `ResizeObserver`: der könnte Tipp-Wachstum nicht unterscheiden und würde die Mindesthöhe beim Schreiben hochratschen
- Nachgemessen in `dev:local`: leer 70 px, 4 Zeilen 87 px, 20 Zeilen gedeckelt auf 320 px mit internem Scrollen; gezogene 200 px überleben Tastendruck, Ticket-Wechsel und Reload; ohne Ziehen bleibt der Schlüssel leer

### v2.415.0 — Autorschaft der Klaerung ist der Profilname (August 2026)

MINOR — Autorschaft ist eine Person, das Bearbeiter-Kürzel eine Rolle im Fachsystem. Projektleitung und Kuration haben keines und waren damit von der Klärung ausgesperrt — ausgerechnet die zwei Rollen, die den Phasenschnitt kuratieren.

- **Der Autor kommt aus `UserProfile.name`**, nicht mehr aus `bearbeiter_kuerzel`; gesperrt wird nur noch, wenn der Name leer ist ([useKlaerung.ts](src/plugins/zu-klaeren/useKlaerung.ts), `istAntwortfaehig` in [konsens.ts](src/plugins/zu-klaeren/konsens.ts))
- **Die Sonderfälle `alle` und `MUE,SCH` entfallen** — sie waren Sammelwerte des Kürzel-Felds; ein Profilname meint immer genau einen Menschen
- **Zwei Formen statt einer**: `normalisiereAutor` keyt Faltung und Dateiname, `anzeigeAutor` steht in der Datei, in Spaltenköpfen und im Export — sonst läse man „THOMAS HÜBSCH" ([typen.ts](src/plugins/zu-klaeren/typen.ts), `KlaerungStand.namen`)
- Der Share trug vorher **eine** Autor-Datei mit zwei Zeilen, beide von derselben Abnahme und die zweite ein Widerruf — kein wirksames Urteil, kein Kommentar, also keine Migration nötig ([klaerung.md](docs/architecture/klaerung.md))
- Nachgemessen in `dev:local` mit Profil „Local Dev" (Kürzel `alle`, bisher gesperrt): Urteil und Beitrag geschrieben, `LOCAL_DEV.jsonl` trägt `"autor":"Local Dev"`, Anzeige „Rückfrage von Local Dev", beides zurückgezogen — `__tf.fehler()` = 0

### v2.414.0 — Rotation der Fassungsdatei mit Archiv (August 2026)

MINOR — `_intern/status-katalog.json` trug 18 Fassungen à ~250 KB und wurde bei **jedem** App-Start vollständig gelesen und geparst; mit der `.backup` daneben waren das ~7 MB auf dem Share. Gelöscht wird nichts — die Versionierung existiert, damit man zurückkann.

- **Die jüngsten acht Fassungen bleiben in der Hauptdatei, ältere wandern nach `_intern/status-katalog-archiv.json`** — reine Aufteilung in [katalog-rotation.ts](src/core/status/katalog-rotation.ts), angewandt im Schreibpfad ([katalog-share.ts](src/core/status/katalog-share.ts))
- **Archiv zuerst, Hauptdatei danach**: ohne Schreibrecht aufs Archiv wird nicht rotiert und die Hauptdatei bleibt vollständig — lieber eine große Datei als eine verlorene Fassung (viertes Sidecar-Profil in [add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md), Pitfall #23)
- **Die aktive Fassung bleibt immer in der Hauptdatei**, auch wenn sie alt ist — sonst müsste jeder Client beim Start doch das Archiv lesen
- **Das Versions-Panel kennzeichnet archivierte Fassungen und lädt das Archiv nach, sobald es offen ist**; `reaktivieren` fällt auf das Archiv zurück, wenn die lokale IDB die Fassung nicht kennt ([StatusCockpitPage.tsx](src/plugins/status-cockpit/StatusCockpitPage.tsx), [useStatusCockpit.ts](src/plugins/status-cockpit/useStatusCockpit.ts))
- Am echten Share gemessen: Hauptdatei 3,47 → 2,07 MB, Archiv 2,28 MB, 18 Fassungen lückenlos; v3 aus der IDB gelöscht und über den Archivpfad reaktiviert (`__tf.fehler()` = 0)

### v2.413.4 — Zu-klaeren-Tabelle vertikal verdichtet (August 2026)

PATCH — Die Tabelle wird im Fachtermin per Bildschirmfreigabe durchgegangen; 30 Zeilen à 58,5 px passten auf keinen Bildschirm. Treiber war das einzige zweizeilige Label: „gehört nach …" machte jede Zeile 46 px hoch statt 28 px. Reine Darstellung, kein Verhalten.

- **Mittlerer Antwortknopf heißt „andere"** (Tooltip trägt den ganzen Satz) — drei gleich kurze Wörter, kein Umbruch ([labels.ts](src/plugins/zu-klaeren/labels.ts))
- **Die drei Knöpfe sitzen als Streifen auf gemeinsamer Kante** statt einzeln mit Zwischenraum: 254 → 207 px breit, 46 → 22 px hoch ([AntwortZelle.tsx](src/plugins/zu-klaeren/AntwortZelle.tsx)); das geteilte `ToggleChip` bleibt unangetastet
- **Keine Linie je Datenzeile mehr** (Gruppenkopf gliedert, `hover` führt), kleineres Zeilenpolster ([PunkteTabelle.tsx](src/plugins/zu-klaeren/PunkteTabelle.tsx))
- **Spalte „Stand" erscheint erst, wenn eine Zeile etwas meldet** — eine Quelle für Anzeige und Sichtbarkeit (`standMarke`/`zeigtStand` in [gruppen.ts](src/plugins/zu-klaeren/gruppen.ts)); die 132 px gehen an die Bezeichnung
- Nachgemessen in `dev:local` bei 1440×900: Zeile 58,5 → 30 px, Gruppenkopf 33 → 25 px, Tabelle 2042 → 1122 px (−45 %); für einen Bildschirm ohne Scrollen fehlen weiter 328 px — nicht durch kleinere Schrift erzwungen (12 px bleibt)

### v2.413.3 — Jahres-Menue heisst durchgaengig „Jahre" (August 2026)

PATCH — Nachzug zu v2.413.2: „Letzte 3 Jahre" neben „Alle Jahrgänge" im selben Menü war halb umbenannt.

- **Alle Beschriftungen des Jahres-Menüs sprechen von „Jahren"** — leere Auswahl „Alle Jahre", Mehrfachauswahl „N Jahre" ([VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx))
- Nachgemessen in `dev:local` über alle vier Zustände: Vorbelegung „Letzte 3 Jahre", leer „Alle Jahre", ein Jahr „2026", zwei Jahre „2 Jahre" (Tooltip „2026, 2025")

### v2.413.2 — Jahres-Filter heisst „Letzte 3 Jahre" (August 2026)

PATCH — Der Jahres-Filter des Vorgangs-Boards nannte sich „Letzte 3 Jahrgänge"; gemeint sind schlicht die letzten drei Jahre des Antragseingangs.

- **Schnellweg + Button-Beschriftung heißen „Letzte 3 Jahre"** statt „Letzte 3 Jahrgänge" ([VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx)); die übrigen Beschriftungen des Menüs („Alle Jahrgänge", „N Jahrgänge") bleiben unverändert

### v2.413.1 — Arbeitsliste entscheidung heisst Zu entscheiden (August 2026)

PATCH — „Entscheidungsreif" war ein unschrumpfbares Einzelwort von 117 px und passte in die 170-px-Lanes des Kanban nur mit Ellipse — abgekürzt las es sich wieder wie der Verfahrensschritt „Entscheidung", also genau die Verwechslung, die v2.409 beseitigt hat. Detail: [status-achsen.md](docs/architecture/status-achsen.md).

- **Arbeitsliste `entscheidung` heißt „Zu entscheiden"** (Kurzform „Zu entsch.") — bricht an der Wortgrenze und reiht sich neben „Zu bearbeiten" in dieselbe Frageform ein ([status-category-labels.ts](src/core/utils/status-category-labels.ts))
- Im Kanban nachgemessen bei 1280 und 1024 px über sieben Lanes: **keine Bezeichnung kürzt mehr ab** (83 px statt 117 in einer 83-px-Spur); die Leitplanken in [KanbanBoard.tsx](src/components/kanban/KanbanBoard.tsx) bleiben für die nächste lange Bezeichnung

### v2.413.0 — Regel-Werkstatt: Wirkung, Probelauf, Straenge (August 2026)

MINOR — Die To-do-Regeln sollen künftig von AB- und FB-Vertretern selbst festgelegt werden. Der Editor trug bereits; es fehlte alles vor und nach dem Bearbeiten: die Wirkung einer Regel am Bestand, die Probe am echten Fall, die Zahl vor dem Scharfschalten. Detail: [vorgangssystem.md §11a](docs/architecture/vorgangssystem.md).

- **Wirkung je Regel am Bestand messen** — „trifft 153 · gewinnt 43" macht die Kaskade sichtbar; Sperren zählen, wie oft sie greifen ([regel-wirkung.ts](src/core/status/regel-wirkung.ts), [useRegelWirkung.ts](src/plugins/status-cockpit/useRegelWirkung.ts))
- **Probe am Fall**: Aktenzeichen eingeben, Ergebnis der Engine samt Sperren und Feldwerten — dieselbe Ansicht wie am Antrag ([RegelProbelauf.tsx](src/plugins/status-cockpit/RegelProbelauf.tsx))
- **Änderungsmessung vor dem Speichern**: beide Fassungen über denselben Bestand, gruppiert alt → neu — gemessen, nicht geschätzt ([regel-aenderung.ts](src/core/status/regel-aenderung.ts))
- **Sperren greifen nach Strang** statt nach sieben Regel-Ids; eine später ergänzte Regel gehört automatisch dazu ([regelsatz.ts](src/core/status/regelsatz.ts), Pitfall #51)
- **Begründung je Regel** — Herkunft und Beschluss, überlebt Speichern, Export/Import und Nachziehen ([typen.ts](src/core/status/typen.ts))

### v2.412.0 — Vorgangs-Regeln: Klaerung, Trigger-Herkunft, Benennung (August 2026)

MINOR — Vor der AB-Sitzung fehlten zwei Dinge: die Antworten der Klärung hingen an einer Id, die sich beim nächsten eingefügten Punkt verschoben hätte, und in der App ließ sich nicht nachsehen, wodurch ein Status überhaupt entsteht. Dazu die Benennung: unter „Status-Katalog" vermutete niemand die Regeln. Detail: [klaerung.md](docs/architecture/klaerung.md), [vorgangssystem.md](docs/architecture/vorgangssystem.md).

- **Grundsatzfragen tragen stabile Ids**; bereits geschriebene Antworten werden beim Lesen übersetzt, nicht migriert (append-only Ablage) ([seed-phasenschnitt.ts](src/plugins/zu-klaeren/seed-phasenschnitt.ts), [fold.ts](src/plugins/zu-klaeren/fold.ts), Guard `no-index-punkt-id`)
- **Vier neue Grundsatzfragen** aus der Bestands-Erhebung: PreCheck jenseits „beantragt", PreCheck-Vollständigkeit, Zieltage als Soll oder Ist, Abgrenzung 31/33/34
- **„Wodurch dieser Status entsteht"** am Statuswert — setzende Kürzel mit Rolle, Ebene und Richtlinien, gebündelt statt neunmal derselbe Satz ([trigger-herkunft.ts](src/core/status/trigger-herkunft.ts), [StatusHerkunftBlock.tsx](src/plugins/status-cockpit/StatusHerkunftBlock.tsx))
- **Reiter benannt und erklärt**: Statuswerte / Kürzel / To-do-Regeln, je mit einem Zwecksatz ([labels.ts](src/plugins/status-cockpit/labels.ts))
- **Plugin heißt „Vorgangs-Regeln"** und ist mit dem Vorgangs-Board in beide Richtungen verknüpft; Route, Ordner und Id bleiben `status-cockpit` ([index.ts](src/plugins/status-cockpit/index.ts))

### v2.411.0 — Profilhaken benannt, Reitergruppen getrennt, Lane-Zaehler sichtbar (August 2026)

MINOR — Nachlese zu v2.404/v2.410 samt Sichtprüfung am echten Bestand. Der Profilhaken hieß seit der Trennung von Antrags- und Begleitphase falsch, die Reiterleiste zeigte zwei Bestandssichten und drei Zeitschnitte als eine Reihe, und die Prüfung fand zwei Stellen, an denen Text schlicht verschwand. Detail: [status-achsen.md](docs/architecture/status-achsen.md).

- **Profilhaken heißt jetzt „Meine ZTP-/PFM-Zuständigkeiten mitzählen"** und benennt die Folge ohne Haken genau, statt Sichtbarkeit zu suggerieren ([ProfilTab.tsx](src/plugins/einstellungen/ProfilTab.tsx))
- **Trenner in der Reiterleiste** vor „Diese Woche" — additiver Slot `trennerDavor` am Primitiv, keine zweite Leiste ([ScopeTabs.tsx](src/components/ui/ScopeTabs.tsx), [AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx))
- **Kanban-Lane „Entscheidungsreif": der Zähler war vollständig abgeschnitten** — die Zahl weicht nie mehr, die Bezeichnung als letzte ([KanbanBoard.tsx](src/components/kanban/KanbanBoard.tsx))
- **Tooltips am rechten Fensterrand** schrumpften auf einen Rest-Streifen (gemessen 151 statt 300 px) statt zu klemmen ([Tooltip.tsx](src/components/ui/Tooltip.tsx))
- `file://`-Tauglichkeit des `zah-pl`-Builds statisch geprüft: keine absoluten Asset-Pfade, kein relativer `fetch`, kein Datei-Worker; Restrisiken als Prüfliste im Protokoll (Doppelklick-Test bleibt Handtest)

### v2.410.0 — Verfahrensschritt kuratierbar, Arbeitsliste unterscheidbar (August 2026)

MINOR — Die Abstimmung mit AB und FB hat ergeben, dass der Phasenzuschnitt strittig ist und mehrfach geändert wird; ein Release je Iteration ist dafür zu langsam. Zugleich hießen vier der neun Arbeitslisten wortgleich wie ein Verfahrensschritt — zwei Spalten mit halb denselben Wörtern, und keine sagte wozu. Detail: [status-achsen.md](docs/architecture/status-achsen.md).

- **ZAH-Phasen sind kuratierbare Daten**: 3 bis 9 Schritte, freie Beschriftung, dazu Arbeitslisten-Vorgabe und Zieltage-Relevanz je Schritt ([zah-phasen.ts](src/core/status/zah-phasen.ts), [zah-phasen-edit.ts](src/core/status/zah-phasen-edit.ts))
- **Baum-Editor im Status-Katalog** — Statuswert per Zug umhängen, Schritte sortieren und umbenennen; Löschen fragt „wohin mit den n Statuswerten?" ([PhasenBaum.tsx](src/plugins/status-cockpit/PhasenBaum.tsx))
- **Vier Modul-Ebenen-Leser folgen jetzt der Fassung** statt beim Import einzufrieren: Sidebar-Gruppierung, Verfahrensleiste, Filter, Kategorie-Ableitung ([statusGroups.ts](src/plugins/antraege/filter/statusGroups.ts), [statusZuStepperPosition.ts](src/plugins/antraege/statusZuStepperPosition.ts))
- **Arbeitslisten umbenannt** (offen → „Zu bearbeiten", abgeschlossen → „Erledigt", …) und aus EINER Quelle bezogen; Reiter und Abschnitte tragen eigene Aggregatnamen ([status-category-labels.ts](src/core/utils/status-category-labels.ts))
- Abschnitte werden über stabile Ids gekeyt statt über Anzeigenamen — **der gespeicherte Zuklapp-Zustand der Status-Abschnitte geht dabei einmalig verloren** ([useStatusSectionCollapsed.ts](src/plugins/antraege/useStatusSectionCollapsed.ts))

### v2.409.0 — Konfliktschutz beim Veröffentlichen der Katalog-Fassung (August 2026)

MINOR — Der Katalog wird ab sofort von mehreren PL-Personen asynchron gepflegt; der Schreibweg war für einen Schreiber gebaut. `naechsteVersionsnummer` zählte die lokale Liste hoch und `schreibeKatalogAufShare` ersetzte die Datei damit — die fremde Fassung war überschrieben UND aus der Historie verschwunden, ohne Meldung. Detail: [status-system/README.md](docs/status-system/README.md) + [recurring-bug-classes.md §16](docs/architecture/recurring-bug-classes.md).

- **Read-before-write mit Vereinigung der Fassungsliste** — fremde Fassungen kommen vor dem Schreiben in den Cache, auch wenn der Konflikt bewusst übergangen wird; Inhalte werden nie gemischt ([katalog-konflikt.ts](src/core/status/katalog-konflikt.ts))
- **Optimistisch geprüft wie im Journal**: `aktiv > basisVersion` plus Nummern-Kollision, nachgeprüft unmittelbar vor dem Schreiben ([katalog-share.ts](src/core/status/katalog-share.ts))
- **Konflikt kommt vor den Menschen** — Nummer, Autor, Zeitpunkt, Zahl abweichender Einträge, zwei Wege; beide lassen beide Fassungen in der Datei ([KatalogKonfliktDialog.tsx](src/plugins/status-cockpit/KatalogKonfliktDialog.tsx))
- **Frühwarnung beim Fensterfokus** aus 4 KB Dateikopf statt 2,9 MB, kein Polling, kein automatisches Umschalten ([sidecar-datei.ts](src/core/status/sidecar-datei.ts))
- Reißleine für Kontext-Docs 10000 → 20000 Zeichen: `status-cockpit.md` stand bei 9992 an der Wand ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts))

### v2.408.0 — Phasenvorschlag für Kürzel aus Trigger-Tabelle und Auslieferung (August 2026)

MINOR — Kein einziges der 508 Kürzel trug eine ZAH-Phase, also lieferte `bestimmeSeit` für den gesamten Bestand `null` — die „seit"-Zeile der Status-Erklärung war tot. 508 Zuordnungen von Hand sind keine Option; Trigger-Tabelle und Auslieferung wissen es bereits. Detail: [vorgangssystem.md §13](docs/architecture/vorgangssystem.md).

- **Zwei Quellen, getrennte Bänder** — 33 Vorschläge aus der Trigger-Tabelle, 13 aus der Auslieferung, Endstand 46 von 508 ([feld-phase-vorschlag.ts](src/core/status/feld-phase-vorschlag.ts))
- **Kein Vorschlag bei Uneinigkeit**: verschiedene Phasen über die Richtlinien oder Widerspruch zwischen den Quellen werden benannt statt geglättet ([FeldPhasenUebernahmeDialog.tsx](src/plugins/status-cockpit/FeldPhasenUebernahmeDialog.tsx))
- **Kein Vorschlag ist eine Antwort**: 472 Kürzel nach Grund gruppiert, und die Kopfzeile sagt, warum mehr nicht ableitbar ist ([FelderTab.tsx](src/plugins/status-cockpit/FelderTab.tsx))
- **Zeilenweise Auswahl** statt alles-oder-nichts, übernommen in EINEM `setState` ([katalog-edit.ts](src/core/status/katalog-edit.ts))
- **Filterchip „ohne Phase"** für den Rest von Hand ([FelderAbgleich.tsx](src/plugins/status-cockpit/FelderAbgleich.tsx))

### v2.407.0 — Modul Zu klären: Export, Phasen-Lesespalte und Doku (August 2026)

MINOR — Zweiter Teil des Klärungs-Moduls: die Klärung war beantwortbar, aber ihr Ergebnis kam nicht heraus, und die Vorkommen-Spalte stand leer. Dazu die Nachlese am Phasenschnitt selbst — er ist jetzt auch im Katalog-Tab sichtbar, statt nur zu wirken.

- **Drei Ausgaben statt einer**: Arbeitsmappe für den Termin, Markdown-Kurzfassung fürs Protokoll, pastefähiger Seed-Diff für die Umsetzung — Strittiges bleibt aus dem Diff draußen ([export.ts](src/plugins/zu-klaeren/export.ts))
- **Vorkommen je Statuscode** mit Bestandsstempel, über den ganzen Bestand ohne Betrachtungsbereich ([vorkommen.ts](src/plugins/zu-klaeren/vorkommen.ts))
- **Neu gelesen bei Fensterfokus** und per Knopf, kein Polling ([useKlaerung.ts](src/plugins/zu-klaeren/useKlaerung.ts))
- **ZAH-Phase als Lesespalte** im Katalog-Tab — sichtbar, nicht änderbar ([KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx))
- **Arbeitsmappen-Helfer hochgezogen** zum zweiten Konsumenten, doppeltes `zeitstempel` eingesammelt ([arbeitsmappe.ts](src/core/status/export/arbeitsmappe.ts))

