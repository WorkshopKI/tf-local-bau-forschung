# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v6.67.0 — Fristen-Karte: Jetzt eingreifen und Rückstand (September 2026)

MINOR — Nutzer: „Ein Bearbeiter will sehen wie viel sind wir über den 90 Tagen, welche Meilensteine sind bereits gerissen, was kann ich tun um das wieder zu heilen … welche meiner Anträge stehen still um einzugreifen bevor Meilensteine gerissen werden."
Die Fristen-Karte sortierte Anlässe zweier Uhren über eine gemeinsame „T über"-Zahl, und keine davon war die Frist. Stufe 2 + 3 von 3 nach v6.66.0.
Es zählen nur laufende Fristen: von 1 658 Rückstands-Kandidaten des Bereichs waren 1 128 angehalten (13.09.2026).

- Fristen-Karte: eine Zeile je Verbund in „Jetzt eingreifen" (keine Bewegung, Frist läuft) und „Rückstand" (über der Frist oder Meilenstein gerissen), darunter die Aufgabe — [FristenWidget.tsx](src/plugins/home/widgets/FristenWidget.tsx)
- Modell und Hook ersetzen `fristAnlaesse.ts`/`useFristAnlaesse.ts`, Zieltage am Status der Zeile statt `STATUS_VB` — [fristenLage.ts](src/plugins/home/widgets/fristenLage.ts), [useFristenLage.ts](src/plugins/home/widgets/useFristenLage.ts)
- Tagesbrief-Thema `stillstand` heißt „Jetzt eingreifen", liest dieselbe Gruppe und nennt den nächsten Meilenstein — [useTagesbrief.ts](src/plugins/home/tagesbrief/useTagesbrief.ts), [punkte.ts](src/plugins/home/tagesbrief/punkte.ts), [themen.ts](src/plugins/home/tagesbrief/themen.ts)
- Kopfkarte: „Gilt als erreicht, sobald …" unter dem Blocker, „gerissen seit N T" statt „N T offen" — [KopfKarte.tsx](src/plugins/antraege/ausklapp/kopfkarte/KopfKarte.tsx), [AusklappInhalt.tsx](src/plugins/antraege/ausklapp/AusklappInhalt.tsx)
- Doku [home-widgets.md](docs/architecture/home-widgets.md), [status-achsen.md](docs/architecture/status-achsen.md), [meilensteine.md](docs/architecture/meilensteine.md), [vorgangssystem.md](docs/architecture/vorgangssystem.md) §16.2, [CONTEXT.md](CONTEXT.md), Feedback-Kontext [home](docs/feedback-kontext/home.md) · [antraege](docs/feedback-kontext/antraege.md), [Docu-Dashboard](docs/docu-dashboard/data.json)

### v6.66.0 — Eine Frist, ein Wort je Uhr (September 2026)

MINOR — Nutzer: „Es gibt viele Fristen, die alle verschiedenen berechnet werden und dem User etwas verwirren … Nur die Angabe von so vielen roten Tagen ist dann verwirrend …"
Vier Zähler trugen dasselbe „überfällig" und dasselbe Rot; die zweite 90-Tage-Uhr des Meilenstein-Plans hielt nie an — von 1 917 Verbünden, die sie „über der Frist" nannte, zeigte die Frist-Spalte 1 348× „angehalten" und nur 328× ebenfalls „über" (13.09.2026).
Stufe 1 von 3; die Fristen-Karte der Startseite baut v6.67.0 neu.

- Der Meilenstein-Plan liest dieselbe Bearbeitungsfrist wie die Frist-Spalte, neue Prognose „Frist angehalten", `BEWERTUNGS_VERSION` 4 → 5 — [frist-lage.ts](src/core/meilensteine/frist-lage.ts), [frist-ergebnis.ts](src/core/services/csv/frist-ergebnis.ts), [bewertung.ts](src/core/meilensteine/bewertung.ts)
- Ein Wort je Uhr: Frist „N T über Frist" / „noch N T" / „angehalten", Meilenstein „gerissen", Stillstand „keine Bewegung seit N Tagen, Ziel M Tage" — [uhrWorte.ts](src/core/utils/uhrWorte.ts)
- Eingesetzt in Frist-Spalte, Kopfkarte, Meilenstein-Abschnitt, „Diese Woche", Vorgangs-Board, Tagesbrief und Assistent — [fristAnzeige.ts](src/plugins/antraege/fristAnzeige.ts), [kopfkarteModell.ts](src/plugins/antraege/ausklapp/kopfkarte/kopfkarteModell.ts), [DieseWocheTab.tsx](src/plugins/meilensteine/DieseWocheTab.tsx), [punkte.ts](src/plugins/home/tagesbrief/punkte.ts), [akte.ts](src/core/services/assistent/kontext/akte.ts)
- Die Prognose am einzelnen Verbund trennt „Über der Frist" von „Frist nicht mehr zu halten" — [labels.ts](src/plugins/meilensteine/labels.ts)
- Guard `ueberfaellig-nur-fuer-die-frist` — [conventions-status.test.ts](src/__tests__/conventions-status.test.ts); Doku [meilensteine.md](docs/architecture/meilensteine.md), [vorgangssystem.md](docs/architecture/vorgangssystem.md) §6.3, [home-widgets.md](docs/architecture/home-widgets.md), [CONTEXT.md](CONTEXT.md), Feedback-Kontext [home](docs/feedback-kontext/home.md) · [meilensteine](docs/feedback-kontext/meilensteine.md) · [antraege](docs/feedback-kontext/antraege.md) · [vorgangs-board](docs/feedback-kontext/vorgangs-board.md)

### v6.65.1 — Feldnamen-Kollisionen entflechten (September 2026)

PATCH — Nutzer: „ja, mach die Mapping-Reparatur auch noch."
v6.65.0 meldete 20 Feldnamen-Kollisionen, löste sie aber nicht. Die teuerste: `termin_fur_nachlieferung ← D_ANT + T_ANT` — der Text überschreibt das Datum, weshalb R10 und R27 auf keinen von 2.537 Vorgängen zutreffen.

- Die Ableitung des Feldnamens aus der Label-XLS fragt jetzt, ob der Name vergeben ist, und hängt den Unterschied des Fachsystems an (`_datum`/`_text` bei `D_`/`T_`, `_plus`/`_minus` bei `+`/`−`) — [useCsvWizardState.ts](src/plugins/csv-sources-kuration/wizard/useCsvWizardState.ts)
- Knopf „Feldnamen entflechten" zieht den Bestand nach: die erste Spalte behält ihren Namen, die hintere bekommt einen eigenen ([spalten-kollisionen.ts](src/core/services/csv/spalten-kollisionen.ts), [CsvSchemaDetailDialog.tsx](src/plugins/csv-sources-kuration/CsvSchemaDetailDialog.tsx))
- Wirksam mit dem nächsten Import der Quelle, auch dem nächtlichen — der Feldname steckt in `canonicalRowHash`, ein geänderter Name macht jede Zeile „geändert"
- Trennzeichen der geplanten Verlaufs-Spalten: Team-Entscheidung „nicht beeinflussbar, mehrdeutige Werte notfalls ignorieren, weiter wenn der Export vorliegt" im Blatt festgehalten — [export-wunschliste-c16.md](docs/architecture/export-wunschliste-c16.md)

### v6.65.0 — PreCheck getrennt, Werte je Teilvorhaben, R7 bekommt einen Ausgang (September 2026)

MINOR — Nutzer: „wir wollen die Konsistenz und Fehlerfreiheit der App bei der Anzeige von Anträgen und deren Status und Events, Fristen etc. verbessern."
Drei C16-Screens des Verbunds KITED (ZKN125314) gegen die App gehalten: eine Zahl für drei verschiedene, ein Meilenstein am Status von heute, eine Aufgabe ohne Ausgang, zwei Rollen-Urteile in einer Spalte.
Alles am Tagesexport vom 11.09.2026 nachgezählt (12.359 TV-Zeilen), bevor etwas geändert wurde.

- Unter „Ohne Termin im Export" eine Zeile je verschiedenem Wert mit eigenem Träger statt einer Zahl für alle Teilvorhaben (2.214 von 2.289 `T_ABK`-Verbünden weichen ab) — [ohneDatum.ts](src/plugins/antraege/ausklapp/vorgangsverlauf/ohneDatum.ts), [OhneDatumBlock.tsx](src/plugins/antraege/ausklapp/vorgangsverlauf/OhneDatumBlock.tsx)
- Meilenstein-Seed 5/6 tragen die Datums-Zweige vor den Status-Zweigen; eine reine Status-Bedingung bekommt die Marke „nur Status": `momentaufnahme` ([seed.ts](src/core/meilensteine/seed.ts), [ist-termin.ts](src/core/meilensteine/ist-termin.ts), [ProbeAnzeige.tsx](src/plugins/meilensteine/ProbeAnzeige.tsx))
- R26 „NL prüfen", R27 „Erinnerung an NF", R28 „NF abwarten" geben R7 einen Ausgang — Strang `rne`, `datumNachFeld` gegen `D_ARW` ([todo-regeln.seed.ts](src/core/status/todo-regeln.seed.ts))
- PreCheck TV (AB) und PreCheck Verbund (FB) als zwei Spalten und zwei Projektions-Felder, zusammengeführt über `precheckUrteil` (negativ schlägt positiv) und über die Teilvorhaben gefaltet ([status-datum-gruppen.ts](src/core/services/csv/status-datum-gruppen.ts), [naechsterSchritt.ts](src/core/utils/naechsterSchritt.ts), [groupAggregates.ts](src/plugins/antraege/groupAggregates.ts), [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx))
- Zwei Spalten auf einem Feld-Key werden beim Öffnen eines Schemas gemeldet statt still überschrieben — 20 Fälle im Bestand, darunter `termin_fur_nachlieferung ← D_ANT + T_ANT`, das R10/R27 wirkungslos macht ([spalten-kollisionen.ts](src/core/services/csv/spalten-kollisionen.ts), [CsvSchemaDetailDialog.tsx](src/plugins/csv-sources-kuration/CsvSchemaDetailDialog.tsx)); Wunschliste an C16: [export-wunschliste-c16.md](docs/architecture/export-wunschliste-c16.md)
- Ein Nenner für „Meilensteine" in Karte und Klappe (war 10 gegen 9), „vor N Tagen" nennt seine Einheit, List-View-Projektion **10 → 11** (einmaliger Voll-Rebuild) ([ZeitverlaufReiter.tsx](src/plugins/antraege/ausklapp/zeitverlauf/ZeitverlaufReiter.tsx), [MeineAntraegeSection.tsx](src/plugins/home/MeineAntraegeSection.tsx), [list-view-migration.ts](src/core/services/csv/list-view-migration.ts)); Doku [todo-regeln-ab-seed.md](docs/architecture/todo-regeln-ab-seed.md), [vorgangssystem.md](docs/architecture/vorgangssystem.md), [meilensteine.md](docs/architecture/meilensteine.md), [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md), [CONTEXT.md](CONTEXT.md), [Feedback-Kontext](docs/feedback-kontext/antraege.md)

### v6.64.1 — Anlegen-Knoepfe leiser, Bedingungen schwerer, Kartenfuss auf Hover (September 2026)

PATCH — Nutzer zum Regelbereich aus v6.64.0: „wollten wir die +bedingung und + gruppe nicht optisch leiser machen (nicht fett) wie im screen von claude design?" und „und dafür die bedingungen fett".
Seit die gestrichelte Anlege-Karte entfallen ist, standen „+ Bedingung / + Gruppe" zweimal fast gleich aussehend übereinander — im Kartenfuß und unter der Kartenreihe — und kräftiger als die Bedingung, um die es geht.

- Alle vier Anlege-Knöpfe mager und sekundärfarben statt halbfett, Textfarbe erst beim Überfahren: `ANLEGEN_STIL` ([BedingungEditor.tsx](src/plugins/meilensteine/BedingungEditor.tsx))
- Der Fuß einer Karte erscheint erst, wenn die Maus über ihr steht oder ein Knopf den Fokus hat: `FUSS_AUF_HOVER` ([BedingungEditor.tsx](src/plugins/meilensteine/BedingungEditor.tsx))
- Getrennte Gruppen-Namen `group/karte` und `group/innenkarte`, damit eine Innenkarte nicht den Fuß der Elternkarte mitzieht ([BedingungEditor.tsx](src/plugins/meilensteine/BedingungEditor.tsx))
- Feldname in der Variante `leise` auf `font-medium` — er ist die Bedingung und trägt das Gewicht eines Kartentitels ([FeldWaehler.tsx](src/components/ui/FeldWaehler.tsx))
- Doku: [meilensteine.md → Der Bedingungs-Bereich](docs/architecture/meilensteine.md), [Feedback-Kontext](docs/feedback-kontext/meilensteine.md)

### v6.64.0 — Regelbereich: Bedingungen lauter, Probe leiser, Ist-Termin sichtbar (September 2026)

MINOR — Nutzer zu einem Claude-Design-Entwurf des Regelbereichs: „es ging darum die zusatz dinge (wirkung im bestand etc.) visuell leiser zu machen und die bedingungen aus denen sich ein meilenstein ergibt visuell lauter zu machen. was davon können wir übernehmen?"
Rahmen, Füllung und Kolben-Symbol machten den Probe-Streifen zum lautesten Element des Bereichs; der Ist-Termin lag darin zugeklappt unerreichbar, und eine gestrichelte Karte hielt am Zeilenende 140 px für zwei Knöpfe frei.

- Probe am Bestand zugeklappt als leise Zeile ohne Kasten, Label „Probe am Bestand"; aufgeklappt zwei Spalten statt drei ([ProbeAnzeige.tsx](src/plugins/meilensteine/ProbeAnzeige.tsx))
- Ist-Termin als eigene Zeile im Regelbereich — Auswahl, Satz und seine Marken, immer sichtbar: `IstTerminZeile` ([ProbeAnzeige.tsx](src/plugins/meilensteine/ProbeAnzeige.tsx), [KonfigurationTab.tsx](src/plugins/meilensteine/KonfigurationTab.tsx))
- Kurzfassung ohne Grundmengen-Präfix, dafür mit Vergleichswort und Fassung — auch „unverändert": `vergleichsWort`, `probeErklaerung` ([ProbeAnzeige.tsx](src/plugins/meilensteine/ProbeAnzeige.tsx))
- Gruppen-Zahl ohne Balken rechts im Kartenkopf; „+ Bedingung / + Gruppe" unter den Karten statt in der gestrichelten Karte (Karten 458 → 480 px) ([BedingungEditor.tsx](src/plugins/meilensteine/BedingungEditor.tsx))
- Schaltbarer Verbinder schreibt „UND"/„ODER" groß, das stille Wort bleibt klein ([BedingungsFugen.tsx](src/plugins/meilensteine/BedingungsFugen.tsx)); Doku [meilensteine.md → Probe am Bestand](docs/architecture/meilensteine.md), [Feedback-Kontext](docs/feedback-kontext/meilensteine.md)

### v6.63.0 — Wirkung am Bestand einklappbar, Unter-Meilenstein-Karten einzeilig (September 2026)

MINOR — Nutzer: „card probe bitte collapsible machen, und standard einklappen" und „die cards für die untermeilensteine sollen übersichtlich und kompakt sein, Text ‚erfüllt bei' in eine Zeile bringen".
Die Wirkungsleiste schob die Regel nach oben aus dem Blick; in den Unter-Meilenstein-Karten brach die Zahlenzeile dreifach um (179 px Text in 170 px Innenmaß).

- Wirkungsleiste als einklappbare Karte „Wirkung am Bestand", beim ersten Besuch zu ([ProbeAnzeige.tsx](src/plugins/meilensteine/ProbeAnzeige.tsx))
- Zugeklappt trägt der Kopf eine Kurzfassung: Zahlen mit Nenner, „geändert"/„neu" und jede Befund-Marke ([ProbeAnzeige.tsx](src/plugins/meilensteine/ProbeAnzeige.tsx))
- Auf-/Zu-Zustand gilt für den Reiter und überlebt den Reload: `wirkungOffen` ([ansichtPersistenz.ts](src/plugins/meilensteine/ansichtPersistenz.ts), [Test](src/plugins/meilensteine/__tests__/ansichtPersistenz.test.ts))
- Kaskaden `probeZustand`/`vergleichStand` für Kopf und Spalte gemeinsam ([ProbeAnzeige.tsx](src/plugins/meilensteine/ProbeAnzeige.tsx))
- Unter-Meilenstein-Karten 208 px breit, Zahlenzeile einzeilig, alle gleich hoch ([KonfigurationTab.tsx](src/plugins/meilensteine/KonfigurationTab.tsx)); Doku [meilensteine.md → Probe am Bestand](docs/architecture/meilensteine.md), [Feedback-Kontext](docs/feedback-kontext/meilensteine.md)

### v6.62.0 — Meilenstein-Plan als Tabelle, Zuordnung bestätigen (September 2026)

MINOR — Nutzer: „Fristen und Meilensteine wurde visuell von claude design überarbeitet (screen 1 und 2) was können wir davon übernehmen?" Übernommen ist die zugeklappte Liste der Konfiguration.
Bei 1 360 px brach dort jede Zeile um, „Woche" und „gilt für" standen achtmal, die Regel war abgeschnitten. „unbestätigt" setzte nur der Auslieferungs-Plan, zurück führte kein Weg.

- Zugeklappte Liste als Tabelle mit Spaltenköpfen, bündig über alle Ebenen; Griff und ⋯ beim Überfahren, Umbau-Schalter im ⋯-Menü ([MeilensteinZeile.tsx](src/plugins/meilensteine/MeilensteinZeile.tsx), [KonfigurationTab.tsx](src/plugins/meilensteine/KonfigurationTab.tsx))
- Spalte „Zuordnung" bestätigt per Klick oder nimmt zurück, Pille „N Zuordnungen unbestätigt" ([MeilensteinZeile.tsx](src/plugins/meilensteine/MeilensteinZeile.tsx))
- „Erfüllt, wenn" zeigt die oberste Ebene in Satzteilen, den vollen Satz im Tooltip: `bedingungUebersicht`, `SatzTeil` ([bedingung-text.ts](src/core/status/bedingung-text.ts), [Test](src/core/status/__tests__/bedingung-uebersicht.test.ts))
- Guard `quellspalten-an-bedingungen` erfasst `bedingungUebersicht(` ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts))
- Doku [meilensteine.md → Der Meilenstein um den Regelbereich](docs/architecture/meilensteine.md), [CONTEXT.md](CONTEXT.md), [Feedback-Kontext](docs/feedback-kontext/meilensteine.md)

### v6.61.0 — Tagesbrief: wer ist dran, Namen, Kürzel ↔ Status (September 2026)

MINOR — Nutzer: „folgende Ideen umsetzen: Wer ist dran? · Über Nacht mit Namen · Widerspruch Kürzel ↔ Status“. Oben stand AIRES „GA schreiben“ (liegt bei AB) für einen FB-Leser, und der Nachtlauf-Satz nannte vier Vorgänge, wo zwei Verbünde gemeint waren.
Die Rangliste gehört jetzt den eigenen Aufgaben; Fremdes, Befunde und Nachtlauf stehen mit Namen im Nachsatz.

- Einordnung „wer ist dran“ gegen die Rolle des Lesers (`zustaendigkeitVon`, gesperrt → Adresse aus dem AB-Satz), Kappung erst danach ([useTagesbrief.ts](src/plugins/home/tagesbrief/useTagesbrief.ts), [adresseTeile](src/core/status/aufgabe.ts))
- Zwei neue Themen im Arbeitsvorrat ohne Uhr: „Liegt bei anderen“ und „Kürzel ↔ Status“ ([themen.ts](src/plugins/home/tagesbrief/themen.ts), [typen.ts](src/plugins/home/tagesbrief/typen.ts), [punkte.ts](src/plugins/home/tagesbrief/punkte.ts))
- „Kürzel ↔ Status“ liest die Zählzeile von „Meine Anträge“ als Markierung `erledigtLautKuerzeln` ([dashboardAggregate.ts](src/plugins/home/dashboardAggregate.ts), [Test](src/plugins/antraege/__tests__/dashboardCounts.test.ts))
- Nachtlauf mit Namen je Verbund plus neuem Status; Nachsatz-Punkte mit Semikolon getrennt ([nachtlaufNamen.ts](src/plugins/home/tagesbrief/nachtlaufNamen.ts), [TagesbriefWidget.tsx](src/plugins/home/tagesbrief/TagesbriefWidget.tsx))
- Doku [home-widgets.md → Tagesbrief](docs/architecture/home-widgets.md), [CONTEXT.md](CONTEXT.md), [Feedback-Kontext](docs/feedback-kontext/home.md)

### v6.60.4 — Tagesbrief ohne Meilensteine (September 2026)

PATCH — Nutzer: „beim Tagesbrief die Meilensteine rausnehmen, die passen da nicht." Vier von fünf gerankten Zeilen waren Meilenstein-Sätze: ein Plan-Termin ab Eingang statt einer Handlung, und beim Entdoppeln verdrängte er den To-do-Punkt desselben Verbunds.

- Thema `fristen` (Meilensteine) aus `THEMEN`/`ThemaId` entfernt; Uhr-Themen sind Stillstand und Was zu tun ist ([themen.ts](src/plugins/home/tagesbrief/themen.ts), [typen.ts](src/plugins/home/tagesbrief/typen.ts))
- `meilensteinPunkte` entfällt, der Frist-Satz spricht nur noch Stillstand ([punkte.ts](src/plugins/home/tagesbrief/punkte.ts), [useTagesbrief.ts](src/plugins/home/tagesbrief/useTagesbrief.ts))
- `useFristAnlaesse` mit Parameter `mitMeilensteinen`; der Brief lädt nur Zieltage, das Fristen-Widget unverändert beide ([useFristAnlaesse.ts](src/plugins/home/widgets/useFristAnlaesse.ts))
- Tests nachgezogen, alte Abwahl `aus: ['fristen']` schadet nicht ([punkte.test.ts](src/plugins/home/tagesbrief/__tests__/punkte.test.ts), [baueBrief.test.ts](src/plugins/home/tagesbrief/__tests__/baueBrief.test.ts))
- Doku [home-widgets.md → Tagesbrief](docs/architecture/home-widgets.md), [CONTEXT.md](CONTEXT.md), [assistent-panel.md](docs/architecture/assistent-panel.md), [Feedback-Kontext](docs/feedback-kontext/home.md)

### v6.60.3 — version:bump --user ohne doppelten Minor-Block (September 2026)

PATCH — Ein Patch mit `--user` legte in changelog-user.md eine zweite Überschrift `## vX.Y` an (v6.59.2, v6.60.1), die von Hand zusammengeführt werden musste. Die Nutzer-Fassung führt einen Block je Minor-Version.

- `insertUserSkeleton` lässt den Text unverändert, wenn der Block der Minor-Version steht (`hatUserBlock`); das Script sagt dann, wohin der Eintrag gehört ([version-bump.mjs](scripts/version-bump.mjs), [Tests](src/__tests__/version-bump.test.ts))
- [CLAUDE.md → Versionierung](CLAUDE.md) und Agent [doku-nachzug](.claude/agents/doku-nachzug.md) nachgezogen: bei einem Patch den bestehenden Block ergänzen

### v6.60.2 — Meilensteine: Titel rückt an die Nummer (September 2026)

PATCH — PL zu v6.60.1: „die Titel textbox kann nach links breiter sein, da ist ein relativ grosser abstand". Die Nummernspalte war fest 46 px breit, die Nummern brauchen 15–22 px.

- Nummernspalte mindestens 26 px, das Titelfeld nimmt die Breite mit (260–560 px) ([KonfigurationTab.tsx](src/plugins/meilensteine/KonfigurationTab.tsx))
- Absatz über 700 Zeichen aus v6.60.1 im [Feedback-Kontext](docs/feedback-kontext/meilensteine.md) geteilt (Guard des Hilfe-Dialogs); [meilensteine.md](docs/architecture/meilensteine.md) nachgezogen

### v6.60.1 — Regelbereich: Kopfzeile bündig, breitere Karten (September 2026)

PATCH — PL zu v6.60: „bitte rechten Teil visuell alignen, das sieht jetzt sehr schlecht zu lesen aus wenn alle meilensteine eingeklappt sind" und „die cards der bedingung breiter machen so das ohne tooltip auch der spaltenname lesbar ist … es reicht wenn 3 cards nebeinander passen". Woche/Schalter/„gilt für" standen je Zeile woanders, der Feldname der Karte war abgeschnitten.

- Meilenstein-Kopf dreigeteilt (Titel · Mitte mit Zusammenfassung und Marken · fester Schalter-Block), Schalter in jeder Zeile bündig; „unbestätigt" bricht nicht mehr um ([KonfigurationTab.tsx](src/plugins/meilensteine/KonfigurationTab.tsx))
- Bedingungs-Karten wachsen mit der Reihe (`KARTEN_BREITE`, drei nebeneinander bei voller Breite) ([BedingungEditor.tsx](src/plugins/meilensteine/BedingungEditor.tsx))
- `FeldWaehler` `variante: 'leise'` bricht den Feldnamen um statt abzuschneiden ([FeldWaehler.tsx](src/components/ui/FeldWaehler.tsx))
- Doku [meilensteine.md](docs/architecture/meilensteine.md), [Feedback-Kontext](docs/feedback-kontext/meilensteine.md)

### v6.60.0 — Regelbereich als Karten (September 2026)

MINOR — PL nach v6.59: „es ist immer noch nicht sehr übersichtlich … bitte weitere design ideen"; aus vier Entwürfen und einem klickbaren Prototyp gewählt: Karten nebeneinander mit „und"/„oder"-Schaltern (C3). Beim Auslesen der Probe fielen echte Planfehler auf, die die alte Oberfläche verbarg (MST 4.3 bei allen offenen Verbünden erfüllt, MST 5 mit einem Status ohne Treffer, MST 2/5 ohne Datum). [Spec](docs/superpowers/specs/2026-09-11-regelbereich-karten.md)

- **Regelbereich als Karten** in allen drei Aufrufern: Kopfsatz, Gruppen als Karten, Innenkarten, Verbinder als Schalter; „alle | eine" und das Zuklappen einzelner Gruppen entfallen; ⋯-Menü mit Duplizieren/Auflösen ([BedingungEditor.tsx](src/plugins/meilensteine/BedingungEditor.tsx), [BedingungsFugen.tsx](src/plugins/meilensteine/BedingungsFugen.tsx), [ZeilenAktionen.tsx](src/plugins/meilensteine/ZeilenAktionen.tsx))
- Reine Bausteine `bedingungKopfsatz`, `dupliziereBedingung`, `loeseGruppeAuf`, `aufloesenAendertAussage` ([bedingung-text.ts](src/core/status/bedingung-text.ts), [bedingung-baum.ts](src/core/status/bedingung-baum.ts))
- **Wirkungsleiste und Befund-Marken** der Meilensteine: Probe, Vergleich mit der Fassung, Ist-Termin als Satz für genau diese Regel; `ohneDatum` exakt gezählt, `probeBefund`, `misstNurZeitpunkt` ([probe.ts](src/core/meilensteine/probe.ts), [ist-termin.ts](src/core/meilensteine/ist-termin.ts), [ProbeAnzeige.tsx](src/plugins/meilensteine/ProbeAnzeige.tsx))
- Meilenstein-Kopf mit „gilt für" und Befund-Punkt, Sammel-Meilenstein zeigt Unter-Meilensteine als Karten, Treffer je Feld in der Feld-Suche (`zaehleFeld`, `FeldWaehler` `variante: 'leise'` + `kennzahl`) ([KonfigurationTab.tsx](src/plugins/meilensteine/KonfigurationTab.tsx), [useMeilensteinProbe.ts](src/plugins/meilensteine/useMeilensteinProbe.ts), [FeldWaehler.tsx](src/components/ui/FeldWaehler.tsx))
- Tests [bedingung-kopfsatz.test.ts](src/core/status/__tests__/bedingung-kopfsatz.test.ts), [ist-termin.test.ts](src/core/meilensteine/__tests__/ist-termin.test.ts), [bedingung-baum.test.ts](src/core/status/__tests__/bedingung-baum.test.ts), [probe.test.ts](src/core/meilensteine/__tests__/probe.test.ts); Doku [meilensteine.md](docs/architecture/meilensteine.md)

### v6.59.2 — Ist-Termin folgt der Verknüpfung der Bedingung (September 2026)

PATCH — Frage der PL: „Was bedeutet das Dropdown Ist-Termin?" Beim Nachlesen fiel auf, dass der Rückfall ohne eigenes Feld das früheste Datum ALLER Bedingungsfelder nahm — bei „alle" also den ersten statt den letzten Schritt, bei „A nach B" das Vergleichsdatum. Die Abweichung sah dadurch besser aus, als sie war (im ausgelieferten Plan MST 3).

- Ist-Termin ohne `istDatumFeld` folgt der Verknüpfung (`erfuellungsDatum`: „alle" das späteste, „eine" das früheste der zutreffenden Teile); `BEWERTUNGS_VERSION` 3 → 4 ([bewertung.ts](src/core/meilensteine/bewertung.ts))
- Die Regel als eine Konstante `IST_AUS_BEDINGUNG` neben der Auswahl „Ist-Termin" und im Quellspalten-Tooltip ([quellen.ts](src/core/meilensteine/quellen.ts), [KonfigurationTab.tsx](src/plugins/meilensteine/KonfigurationTab.tsx))
- Tests: „alle", „eine" mit nicht zutreffendem Teil, Verschachtelung, „A nach B", Teile ohne Datum ([bewertung.test.ts](src/core/meilensteine/__tests__/bewertung.test.ts))
- Themen-Doc § Bewertung und Kontext-Doc nachgezogen ([meilensteine.md](docs/architecture/meilensteine.md))

### v6.59.1 — Guard gegen fremden cn-Import (September 2026)

PATCH — `npx shadcn@latest add` (CLI 4.21) schrieb in v6.59.0 trotz korrektem `components.json` `import { cn } from "cn"` samt fremdem npm-Paket und lieferte ein Menü, das geschlossen noch über eine Sekunde klickbar im DOM stand. Typecheck und Lint waren grün, aufgefallen ist es nur am `git diff package.json`. Beides fängt jetzt das Gate: Ist-Wert je 0, also Verbot statt Ratsche, und jeder Guard wurde einmal rot gesehen.

- Guard `cn-kommt-aus-lib-utils`: kein Import des npm-Pakets `cn`, `{ cn }` nur aus `@/lib/utils`, keine `cn`-Dependency in package.json, mit Probe und Gegenprobe ([conventions-clean-code.test.ts](src/__tests__/conventions-clean-code.test.ts))
- Guard `menue-ohne-ein-ausblend-animation`: kein `animate-in`/`animate-out` in `src/components/ui/*-menu.tsx` ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts))
- DESIGN_GUIDE §5 (nach `shadcn add` prüfen) und Kap. 7 (Menüs ohne Animation) nennen beide Guards ([DESIGN_GUIDE.md](DESIGN_GUIDE.md))

### v6.59.0 — Bedingungs-Editor: benannte Gruppen und Probe am Bestand (September 2026)

MINOR — Rückmeldung der PL nach dem ersten Anlegen: der Bedingungs-Bereich sei „noch nicht intuitiv und übersichtlich genug, gerade bei komplexeren und verschachtelten Gruppen", die Gruppennamen sollten änderbar sein — und man wolle beim Bauen sehen, was ein Meilenstein am Bestand trifft. Der gelobte Feld-Wähler bleibt. Builds vor v6.59 verwerfen den Gruppennamen beim Lesen; die Aussage der Regel bleibt gleich.

- **Benannte Gruppen**: optionaler `name` an UND/ODER-Gruppen, übersteht jeden Umbau und das Laden, steht im Kurzsatz vor dem Inhalt ([bedingung-baum.ts](src/core/status/bedingung-baum.ts), [bedingung-text.ts](src/core/status/bedingung-text.ts), [plan-storage.ts](src/core/meilensteine/plan-storage.ts))
- **Übersichtlicherer Editor**: Schalter „alle | eine", Rinne „und / oder", feste Spalten, Griff + ⋯-Menü statt sieben Icons, zuklappbare Gruppen, „+ Bedingung in ‚<Name>'" ([BedingungEditor.tsx](src/plugins/meilensteine/BedingungEditor.tsx), [ZeilenAktionen.tsx](src/plugins/meilensteine/ZeilenAktionen.tsx))
- **Probe am Bestand** im Konfigurations-Reiter: Treffer je Gruppe und Meilenstein über die Richtlinie 2025, offen/abgeschlossen getrennt, Differenz zur freigegebenen Fassung ([probe.ts](src/core/meilensteine/probe.ts), [useMeilensteinProbe.ts](src/plugins/meilensteine/useMeilensteinProbe.ts), [ProbeAnzeige.tsx](src/plugins/meilensteine/ProbeAnzeige.tsx))
- **UI-Bausteine**: neues `dropdown-menu.tsx` (ohne Animation, nach `context-menu.tsx`), `SegmentedToggle` mit Prop `dicht` ([dropdown-menu.tsx](src/components/ui/dropdown-menu.tsx), [SegmentedToggle.tsx](src/components/ui/SegmentedToggle.tsx))
- Tests [bedingung-baum.test.ts](src/core/status/__tests__/bedingung-baum.test.ts), [plan-storage.test.ts](src/core/meilensteine/__tests__/plan-storage.test.ts), [probe.test.ts](src/core/meilensteine/__tests__/probe.test.ts); Doku [meilensteine.md](docs/architecture/meilensteine.md), [Spec](docs/superpowers/specs/2026-09-11-bedingungs-editor-gruppen.md), [feedback-kontext/meilensteine.md](docs/feedback-kontext/meilensteine.md)

### v6.58.0 — Kürzerer Durchlauf: Plan-Modus ab Schwelle, eine Spec, Doku-Agent (September 2026)

MINOR — Der Durchlauf je Commit galt als langsam, verdächtigt waren die neuen Checks. Gemessen mit `npm run turnaround`: die Gates kosten 2,3 min und 1,3 rote Läufe je Commit — weniger als im August (3,0–3,2 min, 1,6–1,9); von 19,5 min Claude-aktiv sind 14,1 Modellzeit, dazu 4,7 min Warten auf Freigaben. Effort bleibt `xhigh`.

- **Plan-Modus ab Schwelle**, von Claude selbst aufgerufen; Rückfragen vorn gebündelt, Memory nur bei neuer Lehre ([CLAUDE.md](CLAUDE.md), [entwicklungsprozess.md](docs/architecture/entwicklungsprozess.md))
- **Eine Spec statt Spec + Plan**, Schwelle ohne „mehr als fünf Dateien" ([docs/superpowers/README.md](docs/superpowers/README.md), [Spec](docs/superpowers/specs/2026-09-11-turnaround.md))
- **Doku-Nachzug als Hintergrund-Agent** (Experiment) plus Guard für Agent-Frontmatter ([doku-nachzug.md](.claude/agents/doku-nachzug.md), [agent-konfiguration.test.ts](src/__tests__/agent-konfiguration.test.ts))
- **Ein Gate-Lauf** (`check:quick` = `check`) und `__tf.bereit()` bricht nach 40 s mit der Phase ab ([package.json](package.json), [window-hook.ts](src/dev-fixtures/window-hook.ts), [local-variante.md](docs/architecture/local-variante.md))
- **Messung wiederholbar**: `npm run turnaround` ([turnaround-metrik.mjs](scripts/turnaround-metrik.mjs))

### v6.57.4 — Tagesbrief nennt die Aufgabe statt des Meilenstein-Namens (September 2026)

PATCH — Der Tagesbrief sagte „KITED ist seit 227 Tagen fällig (QS freigegeben und versendet)", die Karte „Meine Anträge" darunter „Stellungnahme RNE prüfen". Die Klammer war das Label eines Meilensteins, der NICHT erreicht war, und las sich als eingetretener Zustand; weil der Meilenstein den Verbund vertrat, fiel die Aufgabe ganz weg.

- **Frist-Sätze nennen ihre Herkunft** („Meilenstein „…“" / „Stillstand „…“") und sprechen die Aufgabe des Verbunds mit, samt Rückfall- und Vorläufig-Vermerk ([punkte.ts](src/plugins/home/tagesbrief/punkte.ts))
- **Eine Aufgaben-Rechnung für alle Uhr-Themen** (`aufgabeFuer`, dieselbe `aufgabenAnzeige` wie die Karte) ([useTagesbrief.ts](src/plugins/home/tagesbrief/useTagesbrief.ts))
- Tests [punkte.test.ts](src/plugins/home/tagesbrief/__tests__/punkte.test.ts); Doku [home-widgets.md → Tagesbrief](docs/architecture/home-widgets.md), [feedback-kontext/home.md](docs/feedback-kontext/home.md)

### v6.57.3 — Status-Fassung bei jeder Datenaktualisierung nachziehen (September 2026)

PATCH — Die Status-Fassung (Kürzel-Klartext, ZAH-Phasen, Zieltage, To-do-Regeln, Betrachtungsbereich) kam genau einmal je Sitzung vom Share. Eine tagsüber veröffentlichte Fassung sah jeder andere Rechner erst beim nächsten Start. Jetzt holt jede Datenaktualisierung sie mit.

- **`holeNeuereFassung`** ersetzt den einmaligen Grant-Nachlauf: 4 KB Dateikopf, volle Datei nur bei neuer Nummer ([core/status/index.ts](src/core/status/index.ts))
- **`zieheFassungNach`** übernimmt und zieht Projektion + Anträge-Store nach, als Phase 0 von `runDataUpdate` und im Watcher „Jetzt laden" ([snapshot-refresh.ts](src/plugins/antraege/snapshot-refresh.ts), [data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts), [useSnapshotWatcher.ts](src/core/hooks/useSnapshotWatcher.ts))
- **Nachtlauf-Karte**: Kürzel-Klartexte folgen der Generation ([NachtlaufWidget.tsx](src/plugins/home/widgets/NachtlaufWidget.tsx)); Tests [katalog-nachlauf.test.ts](src/core/status/__tests__/katalog-nachlauf.test.ts)
- Doku: [status-system/README.md](docs/status-system/README.md), [recurring-bug-classes.md §1](docs/architecture/recurring-bug-classes.md), [home-widgets.md](docs/architecture/home-widgets.md)

### v6.57.2 — Startseite rechnet nach Import ohne Reload neu (September 2026)

PATCH — Nach einem CSV-Import oder geholten Datenbestand stand die Startseite teils bis zum Browser-Reload: nach fünf Minuten Offenstehen kippten alle To-do-Zellen dauerhaft auf „…" (gemessen 0 → 13, kein neuer Lauf), „Änderungen der letzten Nacht" und der Nachtlauf-Satz des Tagesbriefs lasen das Journal nie neu. Während des Veröffentlichens standen 30–40 s lang nur Platzhalter.

- **Anzeige am Schlüssel, nicht an der Uhr**: die 5-Min-TTL entscheidet nur noch über den Anstoß ([useBestandsAufgaben.ts](src/core/hooks/useBestandsAufgaben.ts))
- **Alter Stand bleibt markiert stehen** (↻ + Tooltip, im Tagesbrief in Worten), bis nach dem Import neu gerechnet ist — nur wenn sich allein der Bestand änderte ([aufgaben-anzeige.ts](src/core/status/aufgaben-anzeige.ts), [VorlaeufigMarke.tsx](src/components/ui/VorlaeufigMarke.tsx))
- **Journal-Leser und Auslastungs-Karte folgen der Bestands-Generation** ([useBestandGeneration.ts](src/core/hooks/useBestandGeneration.ts), [NachtlaufWidget.tsx](src/plugins/home/widgets/NachtlaufWidget.tsx), [useTagesbrief.ts](src/plugins/home/tagesbrief/useTagesbrief.ts), [AuslastungWidget.tsx](src/plugins/home/widgets/AuslastungWidget.tsx))
- **Guard** `journal-leser-folgt-dem-bestand`, zusammen mit dem Choke-Point-Guard in [conventions-bestand.test.ts](src/__tests__/conventions-bestand.test.ts)
- Doku: [recurring-bug-classes.md §1](docs/architecture/recurring-bug-classes.md), [home-widgets.md](docs/architecture/home-widgets.md), [feedback-kontext/home.md](docs/feedback-kontext/home.md)

### v6.57.1 — Assistent: ein Teilvorhaben im Widerspruch hält den Verbund offen (September 2026)

PATCH — Bei CALYPSO (Verbund abgelehnt, das Teilvorhaben im Widerspruch) schwieg der Assistent zur Frist und nannte den Vorgang „erledigt", während Liste und Detailseite „304 Tage überfällig" zeigten. Die Sperre fragte nur den Verbund-Status; ein Widerspruch ist offene Arbeit.

- **Weiche `vorgangAbgeschlossen`**: ein Verbund ist erst abgeschlossen, wenn auch jedes Teilvorhaben es ist ([abgeschlossen.ts](src/plugins/chat/assistent/abgeschlossen.ts))
- **Frist-Satz, Frist-Zahl und Vorgangsakte** (Frist, Stillstands-Wächter) fragen dieselbe Weiche ([kontextSnapshot.ts](src/plugins/chat/assistent/kontextSnapshot.ts), [vorgangsakte.ts](src/plugins/chat/assistent/vorgangsakte.ts))
- **Doku**: [assistent-panel.md](docs/architecture/assistent-panel.md) (Leitplanken der Vorgangsakte)

### v6.57.0 — Startseite macht Platz für den Assistenten (September 2026)

MINOR — Das Assistent-Dock liegt als Overlay über dem Blatt. Auf der Startseite verdeckte es die rechte Spalte und einen Streifen der Hauptspalte, und eine leere Seitenspalte hielt trotzdem 332 px besetzt. Jetzt fällt eine leere Seitenspalte weg, und die Startseite weicht dem offenen Dock aus.

- **Leere Seitenspalte fällt weg**: dieselbe Regel wie der Leer-Hinweis, das Lade-Skelett folgt ([HomePage.tsx](src/plugins/home/HomePage.tsx), [HomeZweiSpalten.tsx](src/plugins/home/HomeZweiSpalten.tsx), [HomeWidgetStack.tsx](src/plugins/home/widgets/HomeWidgetStack.tsx))
- **Startseite weicht dem offenen Dock aus**: rechter Außenabstand = Dock-Breite, nur auf dieser Seite ([DockAussparung.tsx](src/plugins/home/DockAussparung.tsx))
- Doku: [home-widgets.md](docs/architecture/home-widgets.md), Ausnahme vom Overlay in [assistent-panel.md](docs/architecture/assistent-panel.md), [feedback-kontext/home.md](docs/feedback-kontext/home.md)

### v6.56.1 — Assistent: der Frist-Chip folgt dem Frist-Satz (September 2026)

PATCH — Bei CALYPSO (Verbund abgelehnt, das Teilvorhaben im Widerspruch mit laufender Uhr) meldete der Kontext-Chip „1 Frist", während Faktenblock und Vorgangsakte zur Frist schwiegen. Die Zahl zählte die Uhren je Teilvorhaben ohne die Sperre für abgeschlossene Verbünde, die der Satz hat.

- **Frist-Zahl folgt dem Frist-Satz**: eine reine `verbundFrist` liefert beide aus einer Sperre ([kontextSnapshot.ts](src/plugins/chat/assistent/kontextSnapshot.ts), Test [verbundFrist.test.ts](src/plugins/chat/assistent/__tests__/verbundFrist.test.ts))

### v6.56.0 — Bestandslauf über zwei Richtlinien, Bestandsfragen der Projektleitung (September 2026)

MINOR — Der Bestandslauf rechnete den ganzen Bereich, auch die Richtlinie 2015, für die C16 keine Trigger führt. Jetzt rechnet er nur die aktuelle und die vorige Richtlinie; ältere Zeilen sagen, warum ihnen die Kaskade fehlt. Auf dem Bestand bauen die Fragen der Projektleitung im Assistenten auf (gepaart gemessen: ~15 % schneller, das Lesen bleibt).

- **Lauf-Menge**: `bestandslaufMenge` = Bereich ∩ zwei jüngste Generationen, `nichtGerechnet` ([betrachtungsbereich.ts](src/core/status/betrachtungsbereich.ts), [bestands-lauf.ts](src/core/status/bestands-lauf.ts), [useBestandsAufgaben.ts](src/core/hooks/useBestandsAufgaben.ts))
- **Benannter Rückfall**: Nebenzeile „ältere Richtlinie – aus dem Status abgeleitet" in sechs Lesern ([aufgaben-anzeige.ts](src/core/status/aufgaben-anzeige.ts)); Board-Hinweis neben dem Chip ([VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx))
- **Block `bestand`**: Stau, Verfahrensschritte, Fristen, Zuweisung gezählt, Liegezeiten, Plan-Risiken ([bestandBlock.ts](src/plugins/chat/assistent/bestandBlock.ts), [usePlanRisiken.ts](src/plugins/chat/assistent/usePlanRisiken.ts))
- **Bestandsfragen der PL + Liegezeit-Vergleich**; der Klick startet einen fehlenden Lauf ([fragenKatalog.ts](src/plugins/chat/assistent/fragenKatalog.ts), [AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx))
- **Doku**: [vorgangssystem.md §17](docs/architecture/vorgangssystem.md), [status-achsen.md](docs/architecture/status-achsen.md), [assistent-panel.md](docs/architecture/assistent-panel.md)

### v6.55.0 — Assistent: voller Verlauf, Änderungs-Journal und eigene Arbeit (September 2026)

MINOR — Die Vorgangsakte trug vom Verlauf nur Kennzahlen und 30 Termine, vom Journal nichts. Jetzt schalten Fragen den vollen Verlauf (alle Termine, Statusabschnitte mit Dauer) und das Änderungs-Journal zu; dazu kennt der Assistent den Stand von Gutachten und Nachforderungen und frühere abgelehnte Einreichungen. Das Journal liest er nie selbst — er nimmt den Lauf der Detailseite mit.

- **Blöcke** `verlauf` / `journal`, je Unterhaltung, im Kontext-Chip genannt ([zusatzBloecke.ts](src/plugins/chat/assistent/zusatzBloecke.ts), [AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx))
- **Journal ohne eigenen Lesevorgang**: `laufendeJournalChroniken` ([useJournalChroniken.ts](src/plugins/antraege/status/useJournalChroniken.ts))
- **Akte**: Journal-Zähler, Artefakt-Karten und Prüfer-Hinweise, Vorgänger, Statusabschnitte ([vorgangsakte.ts](src/plugins/chat/assistent/vorgangsakte.ts), [useVorgangsakte.ts](src/plugins/chat/assistent/useVorgangsakte.ts))
- **Fragen**: Statusdauer, seit Export, zurückgenommen, eigene Arbeit, Umfeld ([fragenKatalog.ts](src/plugins/chat/assistent/fragenKatalog.ts))
- **Doku**: [assistent-panel.md → Zuschaltbare Blöcke](docs/architecture/assistent-panel.md)

### v6.54.0 — Assistent: Vorgangsakte und Fragen-Katalog (September 2026)

MINOR — Der Assistent bekam zum Vorgang Status, Frist, eine Aufgabe und vier Stammdaten; seine fünf festen Schnellfragen wussten nichts davon. Jetzt reist eine Vorgangsakte mit (Aufgaben je Regelsatz, offene Paare, Frist, Wächter, Meilensteine, Verlauf, Teilvorhaben), und das Dock bietet nur Fragen an, deren Signal vorliegt — im leeren Dock und als Folgefragen unter jeder Antwort. Die Projektleitung ist als eigener Schalter im Profil sichtbar.

- **Vorgangsakte**: aus den Funktionen der Karten, ohne Bearbeiter-Kürzel ([akte.ts](src/core/services/assistent/kontext/akte.ts), [vorgangsakte.ts](src/plugins/chat/assistent/vorgangsakte.ts), [useVorgangsakte.ts](src/plugins/chat/assistent/useVorgangsakte.ts))
- **Fragen-Katalog** statt Quick Actions: sechs Gruppen, Folgefragen ([fragenKatalog.ts](src/plugins/chat/assistent/fragenKatalog.ts), [AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx))
- **Projektleitung** als Profil-Schalter neben der Fachrolle, „nur PL" = „Keine eigene" ([AntraegeSichtGruppe.tsx](src/plugins/einstellungen/profil/AntraegeSichtGruppe.tsx), [nutzerRolle.ts](src/plugins/chat/assistent/nutzerRolle.ts))
- **Modell + Budget**: Rolle `standard`, Aufstieg nur bei Überlänge; 100 000 statt 24 000 Zeichen ([turn.ts](src/plugins/chat/assistent/turn.ts), [assembliere.ts](src/core/services/assistent/kontext/assembliere.ts))
- **Guard** `assistent-ohne-personen` ([ohnePersonen.test.ts](src/plugins/chat/assistent/__tests__/ohnePersonen.test.ts)); Doku [assistent-panel.md](docs/architecture/assistent-panel.md), [Spec](docs/superpowers/specs/2026-09-10-assistent-fragevorschlaege-design.md)

### v6.53.1 — Assistent: Auszüge nur aus Dokumenten des gefragten Vorgangs (September 2026)

PATCH — Bei „Was ist bei CALYPSO zu tun?" bot der Prompt als Beleg [1] einen Auszug aus der Anlage 4 von KITED an, einem fremden Antrag. Das Retrieval suchte global über den Fragetext und kannte den Vorgang nicht. Jetzt kommen mit Vorgang nur Auszüge aus seinen eigenen Dokumenten, und ohne eigene gibt es keinen Auszug.

- **Zugehörigkeit**: `trefferGehoertZumVorhaben` nach Dokument-Tag oder Kennung im Dateinamen, dieselbe Regel wie in der Aufnahmefläche ([vorhaben-dokumente.ts](src/core/services/assistent/vorhaben-dokumente.ts))
- **Kennungen**: `KontextEntitaet.kennungen` = Verbund-Nummer + Aktenzeichen aller TVs ([kontextSnapshot.ts](src/plugins/chat/assistent/kontextSnapshot.ts), [types.ts](src/core/services/assistent/kontext/types.ts))
- **Suche**: `SearchFilters.limit` + `nur`, der Filter greift vor dem Re-Ranker ([useSearch.ts](src/core/hooks/useSearch.ts))
- **Turn**: `retrieve(frage, entitaet)`, ein `doc:`-Scan je Turn für Retrieval und Dokument-Block ([turn.ts](src/plugins/chat/assistent/turn.ts), [useAssistentController.ts](src/plugins/chat/assistent/useAssistentController.ts))
- **Doku**: [assistent-panel.md → Auszüge nur vom gefragten Vorgang](docs/architecture/assistent-panel.md)

### v6.53.0 — Tagesbrief: Rückfrage wird gleich abgeschickt (September 2026)

MINOR — Das Fragezeichen am Tagesbrief-Punkt legte die Frage nur ins Eingabefeld des Assistent-Docks; man musste ein zweites Mal senden. Der Klick auf der Karte ist jetzt selbst die Geste, wie bei den Quick Actions im Dock.

- **Dock**: eine vorgelegte Frage wird beim Übernehmen abgeschickt; läuft gerade eine Antwort, steht sie im Eingabefeld statt verloren zu gehen ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx), [panelUiStore.ts](src/plugins/chat/assistent/panelUiStore.ts))
- **Doku**: [home-widgets.md → Tagesbrief](docs/architecture/home-widgets.md), [feedback-kontext/home.md](docs/feedback-kontext/home.md)

### v6.52.0 — Das gespeicherte Fristdatum entfällt (September 2026)

MINOR — Nach v6.49 lasen noch zwei Rechenwege nur `D_AAE`. Einer davon schrieb beim Import `frist_datum` in jeden Datensatz. Das Feld stimmte nur bei 506 von 13 690 Anträgen mit der Frist-Spalte überein; 13 021 Werte standen dort, wo die Spalte „angehalten" zeigt. Es entfällt, statt umgestellt zu werden ([Spec](docs/superpowers/specs/2026-09-10-frist-datum-entfaellt-design.md)).

- **Rechenwege**: der Merger-Rückfall `applyFristDatumFallback` und die toten `computeVerbundFristDatum`/`daysUntilFristAware` entfernt ([frist.ts](src/core/services/csv/frist.ts), [merger/helpers.ts](src/core/services/csv/merger/helpers.ts))
- **Datenmodell**: `frist_datum` fällt aus Standardfeldern, Listen-Projektion (v10) und Wizard-Slot. Altwerte sind über `AUSGEMUSTERTE_FELDER` nur noch sichtbar, wenn ein Schema sie mappt ([constants.ts](src/core/services/csv/constants.ts), [buildDisplayRows.ts](src/plugins/antraege/alleFelder/buildDisplayRows.ts))
- **Filter**: Der System-Filter „Fristdatum" entfällt. Der Seed räumt ausgemusterte System-Filter ab, und Kombi-Pins ohne Definition blenden sich aus ([filterRegistry.ts](src/core/services/csv/filter/filterRegistry.ts), [pinnedFilters.ts](src/plugins/antraege/filter/pinnedFilters.ts))
- **Gemessen** in dev:local (14 225 Anträge): Die Frist-Spalte ist vorher und nachher identisch (982 läuft · 13 021 angehalten · 222 nicht berechenbar, gleicher Hash). 0 Listen-Einträge tragen noch das Feld
- **Doku**: [antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md), [ui-muster.md](docs/architecture/ui-muster.md), [CONTEXT.md](CONTEXT.md) (Begriff „Frist")

### v6.51.1 — Kürzel-Paar der Fristen nennt seine CSV-Spalten (September 2026)

PATCH — Die letzte Lücke aus v6.51: ein Zieltag-Anlass „ALT gesetzt, ALU fehlt" zeigte keine Quellspalten. Das Kürzel findet sein Feld jetzt über den Katalog (`kuerzelIndex` der aktiven Fassung) statt über ein geratenes `D_` + Kürzel (Pitfall #44). Am echten Bestand haben alle 84 Paar-Anlässe von 301 Zieltagen zwei Felder.

- **Home-Fristen**: `zieltagAnlass` bekommt den Kürzel-Index und nennt die Felder beider Kürzel, das gesetzte zuerst; unbekannte Kürzel bleiben unbelegt ([fristAnlaesse.ts](src/plugins/home/widgets/fristAnlaesse.ts), [useFristAnlaesse.ts](src/plugins/home/widgets/useFristAnlaesse.ts))
- **Test**: NFD im Katalog gegen NFC im Paar, und keine zusammengesetzte Spalte ([fristAnlaesseQuellen.test.ts](src/plugins/home/widgets/__tests__/fristAnlaesseQuellen.test.ts))
- **Doku**: [ui-muster.md](docs/architecture/ui-muster.md) und [feedback-kontext/home.md](docs/feedback-kontext/home.md) nachgezogen

### v6.51.0 — Quellspalten auch an Frist, Home und Alle Felder (September 2026)

MINOR — Stufe C des Quellspalten-Vorhabens ([Spec](docs/superpowers/specs/2026-09-10-quellspalten-design.md)). Die übrigen Stellen, an denen ein Wert aus CSV-Spalten abgeleitet wird, nennen jetzt ebenfalls ihre Quellspalten, statt nur Codes oder gar nichts zu zeigen. Die festen Codes der Frist-Spalte nehmen ihre Beschriftung aus dem Schema.

- **Frist**: Bei `FRIST_GRUND` und dem Tooltip der Frist-Zelle ([tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)) stehen Code und Klartext. `FESTE_FELDER.frist` beschriftet sich aus dem Index ([spaltenHilfe.ts](src/plugins/antraege/spaltenHilfe.ts))
- **Home**: Die Fristen-Anlässe tragen ihre Quelle, beim Meilenstein den Knoten und beim Zieltag `STATUS_VB`. Das Kürzel-Paar bleibt bewusst ohne ([fristAnlaesse.ts](src/plugins/home/widgets/fristAnlaesse.ts)). Die Phasen-Marke des StatusVerlauf-Widgets liest `STATUS_VB` aus dem Schema
- **[„Alle Felder"](src/plugins/antraege/alleFelder/AlleFelderSection.tsx)**: Code inline und Quellspalten im Tooltip. `frist_datum` sagt, dass es beim Import gerechnet wird
- **[Status-Filter](src/plugins/antraege/filter/facets/StatusFilterFacet.tsx)**: Der Tooltip hat eine Zeile „Spalte" aus dem Schema
- **Abnahme** in dev:local nach sauberem Reload, `fehler()` = 0 ([ui-muster.md](docs/architecture/ui-muster.md))

### v6.50.0 — Quellspalten: Bedingungen und Felder nennen ihre CSV-Spalten (September 2026)

MINOR — Stufe B des Quellspalten-Vorhabens ([Spec](docs/superpowers/specs/2026-09-10-quellspalten-design.md)): „TIB gefüllt UND BIB gefüllt" sagte nicht, welche CSV-Spalte dahinter steht. Selbst Fachleute konnten eine falsche Spalte oder Kombination nur im Code finden. Jede Bedingung, die als Satz auf dem Bildschirm steht, nennt jetzt ihre Quellspalten, und zwar aus dem Schema aufgelöst statt von Hand abgeschrieben.

- **[spalten-inventar.ts](src/core/services/csv/spalten-inventar.ts)**: `baueQuellSpaltenIndex` löst jede Schreibweise einer `feldId` auf (kanonisch, custom, roher Code) und nennt die Programme, die das Feld nicht mappen. `rohSpaltenJeFeld` ist jetzt eine Projektion desselben Durchgangs ([ui-muster.md](docs/architecture/ui-muster.md))
- **[bedingung-quellen.ts](src/core/status/bedingung-quellen.ts)** + **[quellen.ts](src/core/meilensteine/quellen.ts)**: Die Erklärung einer Bedingung oder eines Meilensteins nimmt ihre Felder aus `bedingungFeldRefs` und den Satz aus `bedingungSatz`
- **[QuellSpaltenTooltip](src/components/quellspalten/QuellSpaltenTooltip.tsx)**: Der Index lädt erst beim Überfahren (`useQuellSpaltenIndex`). `SpaltenHilfeInhalt` gruppiert nach Feld
- **Eingebaut** in Meilenstein-Konfiguration, Leiste, „Diese Woche", To-do-Regeln und To-do-Herleitung. Der `FeldWaehler` zeigt `← D_AAE` am Auslöser
- **Guard `quellspalten-an-bedingungen`** ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts)): Wer eine Bedingung rendert, rendert ihre Quellspalten. Der Guard wurde einmal rot gesehen

### v6.49.0 — Ein Anker: Meilensteine zählen ab dem wirksamen Eingang (September 2026)

MINOR — Stufe A des Quellspalten-Vorhabens ([Spec](docs/superpowers/specs/2026-09-10-quellspalten-design.md)): Wer fragt, aus welchen Spalten eine Frist rechnet, fand zwei Antworten. Die Frist-Spalte der Tabelle zählte ab dem späteren aus `D_AAE` und `D_XTE`, der Meilenstein-Anker nur ab `D_AAE`, und das an drei Rechenstellen je für sich. Jetzt gibt es einen einzigen Anker. Gepaart gemessen: 28 von 2 082 offenen Verbünden verschieben sich um +1 bis +61 T (Median +8), kein Zustand und keine Prognose kippt.

- **[anker.ts](src/core/meilensteine/anker.ts)** (neu): `baueAnkerLeser` löst `D_XTE` über das Schema auf. Projektion und Verbund-Detailseite nutzen denselben Leser ([meilensteine.md](docs/architecture/meilensteine.md) § Bewertung)
- **[frist.ts](src/core/services/csv/frist.ts)**: `verbundWirksamerEingang` ist die Verbund-Schwester von `wirksamerEingang`
- **[bewertung.ts](src/core/meilensteine/bewertung.ts)** + **[auswertung.ts](src/core/meilensteine/auswertung.ts)**: Soll, Woche, Frist und Dauern zählen ab `anker`. `antragsdatum` bleibt für den Jahresfilter, `BEWERTUNGS_VERSION` 3
- **[useMeilensteinStand.ts](src/plugins/meilensteine/useMeilensteinStand.ts)**: Die Dauern der Auswertung zählen ab demselben Anker (125 von 5 969 werden kürzer, Median −5 T)
- **Beschriftung**: „Gesamtfrist ab wirksamem Eingang"; die Tooltips an Gesamtfrist und „Eingang" nennen `D_AAE`/`D_XTE` ([labels.ts](src/plugins/meilensteine/labels.ts)). Neue Glossar-Einträge „Quellspalte" und „wirksamer Eingang" in [CONTEXT.md](CONTEXT.md)

### v6.48.1 — der Assistent spricht die Kaskade, nicht die alte Formel (September 2026)

PATCH — Beim Lauf gegen die interne KI (v6.47.1, DynaMaint) widersprach der Assistent der Karte 20 Pixel daneben: sie sagte „Widerspruch gg Abl bearbeiten · liegt bei AB/FB/Jur", er sagte „Ablehnungsbescheid erstellen". Der Faktenblock sprach allein `schrittText` — die Formel, die das Projekt längst als Rückfall führt. Solange der Assistent „dazu weiß ich nichts" antwortete, fiel das nicht auf; mit der mitgereisten Entität wurde daraus eine falsche Handlungsanweisung.

- **[assembliere.ts](src/core/services/assistent/kontext/assembliere.ts)**: `KontextEntitaet.aufgabe` (Ergebnis von `aufgabenAnzeige`) hat Vorrang vor `schrittText`; ein Rückfall gibt sich zu erkennen ([assistent-panel.md](docs/architecture/assistent-panel.md))
- **[kontextSnapshot.ts](src/plugins/chat/assistent/kontextSnapshot.ts)**: füllt es aus der **bereits gerechneten** Ablage — Verbund gefaltet über alle TVs, wie die Verbundzeile
- **[AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)**: `useZeilenAufgaben('nie', …)` liest nur, was da ist — ein shell-weites Dock stößt keinen Bestandslauf an
- **[CONTEXT.md](CONTEXT.md)**: „N Tage überfällig" sind **zwei** Zähler (Meilenstein-SollDatum vs. kritische Frist) — DynaMaint 324 gegen 318, beide richtig; gemessen, kein Fehler
- **An der internen KI abgenommen**: dieselbe Frage, Antwort jetzt „Widerspruch gegen die Ablehnung zu bearbeiten — das liegt bei AB/FB/Jur", `fehler()` = 0

### v6.48.0 — Ein Durchgang, viele Mitfahrer: der geteilte Roh-Halter des Bestands (September 2026)

MINOR — Der Bestand wird an dreizehn Stellen gelesen, und jeder Lesevorgang kostet ~2,2–3,3 s: IndexedDB cacht die Deserialisierung von 14 225 Records nicht. Gleichzeitige Durchgänge teilten sich nichts, sondern behinderten sich — zwei nebeneinander kosteten je das 1,6-fache, also mehr als nacheinander. Ein sitzungslanger Halter scheidet aus (die Roh-Records sind 284 MB); ein laufzeit-begrenzter ist gratis.

- **[roh-halter.ts](src/core/status/roh-halter.ts)** (neu): die Roh-Arrays eines Programms, geteilt unter allen Durchgängen, die gerade laufen — Nutzerzähler statt TTL, `bestandGeneration()` als Schlüssel ([§17](docs/architecture/vorgangssystem.md))
- **[vorgangs-quelle.ts](src/core/status/vorgangs-quelle.ts)** + **[ladeBestand.ts](src/plugins/status-cockpit/ladeBestand.ts)**: beide lesen über den Halter; `ladeBestand` gibt damit den Lesecode ab, den es von `jederVorgang` dupliziert hatte
- **Async-Generator statt Callback**, nachgemessen: als Callback wanderte der Schleifenrumpf in eine Closure und wurde bei byte-identischem Code ~400 ms langsamer; mit `for await` ist die Rechenzeit auf 1 ms identisch
- **Richtigstellung zu v6.47**: die dort notierten „12–15 s" der Regeln-Seite waren der Dev-StrictMode-Zwilling — produktiv sind es 6,4–6,9 s ([§17](docs/architecture/vorgangssystem.md))
- **[Spec](docs/superpowers/specs/2026-09-10-geteilter-bestands-durchgang-design.md)** + **[Plan](docs/superpowers/plans/2026-09-10-geteilter-bestands-durchgang.md)**: Befund, Messfallen und die Warnung, dass der Boden dieser Maschine um ±33 % schwankt — Vergleiche nur gepaart

### v6.47.1 — die Rückfrage aus dem Tagesbrief nimmt ihren Vorgang mit (September 2026)

PATCH — Der Rückfrage-Knopf des Tagesbriefs legte „Was ist bei CALYPSO zu tun?" ins Dock und gab nur den Text mit: auf der Startseite ist nichts selektiert, also stand im Faktenblock „Keine Entität ausgewählt" — die Antwort „dazu liegen mir keine Informationen vor" war prompt-konform. Der zweite Fund wog schwerer und war unsichtbar: Deep-Links legen regelmäßig eine Verbund-Nummer in den Aktenzeichen-Slot; die Detailseite heilt das seit v4.82, der Kontext-Snapshot des Assistenten nicht.

- **[TagesbriefWidget.tsx](src/plugins/home/tagesbrief/TagesbriefWidget.tsx)** + **[panelUiStore.ts](src/plugins/chat/assistent/panelUiStore.ts)**: die vorgelegte Frage reist mit ihrem Vorgang; der Chip nennt ihn, statt „Startseite" zu sagen ([assistent-panel.md](docs/architecture/assistent-panel.md))
- **[kontextSnapshot.ts](src/plugins/chat/assistent/kontextSnapshot.ts)**: ein ausdrücklich mitgegebener Vorgang hat Vorrang vor der Store-Selektion — und der Aktenzeichen-Zweig heilt jetzt eine Verbund-Nummer, statt auf einen Stub ohne Status und Frist zu fallen
- **[detailAufloesung.ts](src/plugins/antraege/detailAufloesung.ts)**: `artDesSchluessels` hebt die Frage „Aktenzeichen oder Verbund?" aus `loeseDetailAuf` heraus — eine Schleife, zwei Leser, kein Drift
- **[punkte.ts](src/plugins/home/tagesbrief/punkte.ts)**: „Wo stehe ich bei X?" trug seinen Vorgang bisher nicht mit; Listenfragen bleiben bewusst ohne
- **Am echten Bestand abgenommen** (14 225 Anträge): Chip „Startseite" → „Verbund WidyLa · DS · 1 Frist", Sprung auf `#/antraege/ZKN121715` zeigt „Verbund ATLAS · FuE · 1 Frist" statt der nackten Nummer

### v6.47.0 — Der Bestandslauf wartet auf den Start — und die Leser folgen der Generation (September 2026)

MINOR — Ein Performance-Audit über die ganze App fand als stärksten Hebel nicht die Rechnung, sondern den Zeitpunkt: der Bestandslauf startete im Leerlauf mitten in den Start-Datenlauf hinein, belegte dessen Thread und SMB-Leitung — und wurde danach über die Bestands-Generation entwertet. Am ersten Start des Tages fiel er zweimal an. Der zweite Fund ist ein Wahrheitsproblem: der Schlüssel trägt die Generation, die Leser folgten ihr nicht.

- **[useBestandsAufgaben.ts](src/core/hooks/useBestandsAufgaben.ts)**: Leerlauf-Leser warten den Start-Datenlauf ab (Vorbild `auslastung/index.tsx`), mit Zeit-Rückfall gegen eine hängende Startphase — `'sofort'` (Board) und `'nie'` unberührt
- **[bestand-generation.ts](src/core/services/bestand-generation.ts)**: `subscribeBestandGeneration` — die Leser folgen dem Zähler jetzt per `useSyncExternalStore`; vorher fror ein gemounteter Leser seinen Schlüssel ein und zeigte bis Sitzungsende die To-dos von VOR dem Import
- **[feld-aufloesung.ts](src/core/status/feld-aufloesung.ts)**: der Vorkommen-Plan wird über (Feldliste, Auflösung) memoisiert — das Cockpit kompilierte ihn je Verbund neu (~7 535× je Kaltbesuch), der Board-Pfad hob ihn längst heraus
- **[navigator.ts](src/core/status/navigator.ts)**: `wirkungZeilen` liest aus einem Kürzel-Index statt die ganze Trigger-Tabelle je Feld-Zeile zu filtern — im Kürzel-Reiter waren das über eine Million `normKey`-Aufrufe je Render, auch für zugeklappte Klappen
- **Gemessen am echten Bestand** (14 225 Anträge, 12 359 Vorgänge, 7 535 Verbünde): Bestandslauf 5 531 ms, davon **idb 3 125 ms** — die Rechnung (sammeln 938 · todo 189 · wächter 597) ist nicht mehr der Engpass ([§17](docs/architecture/vorgangssystem.md))

### v6.46.0 — Tagesbrief — was zuerst dran ist (September 2026)

MINOR — Die Startseite zeigte sechs richtige Karten und sagte trotzdem nicht, was **zuerst** dran ist: die überfällige Frist stand in „Fristen", die Änderung von heute Nacht im Nachtlauf, der eigene Entwurf woanders. Der deterministische Kern dafür lag seit dem Assistent-Panel bereit (`baueArbeitsvorratUebersicht`) — er ging nur in einen Prompt, nie auf den Bildschirm.

- **[src/plugins/home/tagesbrief/](src/plugins/home/tagesbrief/)**: neues Home-Widget am Kopf der Hauptspalte, Flag `tagesbrief` (dev + pl) — deterministisch gerankter Kurztext, LLM erst bei der Rückfrage ([home-widgets.md → Tagesbrief](docs/architecture/home-widgets.md))
- **[useFristAnlaesse.ts](src/plugins/home/widgets/useFristAnlaesse.ts)**: der Ladeeffekt des Fristen-Widgets ist **gehoben, nicht kopiert** — eine Herleitung, zwei Leser
- **Config v6** (`migriereV5Tagesbrief`): einmalig einblenden **und** an den Kopf stellen — die einzige begründete Ausnahme von „`position` bleibt unberührt"
- **In der Abnahme gefunden**: über den rohen Bestandslauf standen drei Vorgänge mit „seit 4028 Tagen überfällig" an der Spitze (Karte darunter: höchstens 223), und das Journal zählte 262 statt 7 Vorgängen — beides zieht jetzt aus derselben Quelle wie die Nachbarkarte
- **Neuer Guard `entdeckung-ohne-marke`**: keine Karte in `ENTDECKUNG_WIDGETS` trägt eine Beta-/Experten-Marke — eine Marke legte die Selbst-Einblendung still (der gemessene v6.19-Fall)

### v6.45.0 — Eine Groesse, ein Name — und Ratschen, deren Ausweg wirklich offen steht (September 2026)

MINOR — Zwei Größen liefen im Bestand unter mehreren Namen: `strOrNull` stand zehnmal privat in `plugins/antraege/` — unter **einem** Namen mit **vier** Verhalten —, ein Tag in Millisekunden 13-mal unter vier Namen. Beim Nachziehen der Ratsche fiel auf, dass **fünf von fünf** Ratschen einen Ausweg nennen, den ihr eigener Code nicht annimmt.

- **[fieldLookup.ts](src/plugins/antraege/fieldLookup.ts)**: ein `strOrNull` statt zehn — eine Kopie gab ungetrimmt zurück, eine akzeptierte zusätzlich `number` (an ihren drei Aufrufstellen unerreichbar)
- **[zeitEinheiten.ts](src/core/utils/zeitEinheiten.ts)**: `MS_TAG` als einzige Heimat; `MS_TAG`/`TAG_MS`/`DAY_MS`/`MS_PER_DAY` und 15 nackte Literale zeigen jetzt dorthin — Ratsche `zeitkonstante-hat-einen-namen` **21 → 2**
- **Guard-Defekt behoben**: der Marker im Code hieß anders als der, den die Fehlermeldung nennt (5 von 5 Ratschen) — neuer Wächter `ausweg-heisst-wie-die-regel` hält beide zusammen
- **Zweiter Guard-Defekt**: `zeitkonstante-hat-einen-namen` zählte Fließtext und die *Definition* benannter Konstanten mit — also genau den Weg raus, den er empfiehlt (7 der 9 Treffer)
- **[code-quality-baseline.md](docs/architecture/code-quality-baseline.md)**: „Exporte ohne Nutzer" trennt jetzt **überexportiert** (254, `export` streichen) von **tot** (86); `exhaustive-deps` kostet gemessen 49 Verstöße, die vorhandenen Direktiven verdecken weitere 42 ([eslint.config.js](eslint.config.js))

### v6.44.1 — Ein Timeout heisst zuerst: sshd steht (September 2026)

PATCH — Der Laptop-Tunnel zur internen KI lief in eine Timeout-Schleife; `sshd` stand nach einem Neustart auf `Stopped`. Die Fehlersuch-Tabelle schickte für dieses Bild auf DHCP und VPN und ordnete den gestoppten Dienst „Connection refused" zu — beides führt am Fund vorbei.

- **[ki-tunnel-dev.md](docs/architecture/ki-tunnel-dev.md)**: `Get-Service sshd` ist jetzt die **erste** Prüfung bei „Connection timed out", mit dem Grund an einer Stelle in Schritt 1
- Die Firewall-Regel hängt am **Programm** `sshd.exe`, nicht an Port 22 — ohne laufenden Dienst greift sie nicht, und die Pakete werden still verworfen (Timeout statt RST)
- Zeile „`curl` meldet Connection refused" berichtigt: steht eine SSH-Sitzung, läuft `sshd` per Definition — dort bleibt nur die Loopback-Bindung der Weiterleitung
- **Nachgemessen**: nach `Start-Service sshd` baut die Schleife der `.cmd` den Tunnel selbst wieder auf, `curl` → HTTP 200; ein aktiver NordVPN-Tunnel auf der Dev-Maschine stört nicht

### v6.44.0 — Stille Test-Auslassungen werden laut (September 2026)

MINOR — 16 Tests liefen nur auf der Dev-Maschine: sie hängen an Fixtures, die per `.gitignore` bewusst nicht im Repo liegen. Auf einem frischen Klon verschwanden sie **wortlos**, und der Lauf blieb in beiden Fällen grün — zwei Entwickler führten aus demselben Commit unterschiedliche Testmengen aus.

- **[fixture-gate.ts](src/__tests__/fixture-gate.ts)**: ein gemeinsamer Torwächter statt fünf handgeschriebener `existsSync(…) ? describe : describe.skip`
- **Wächter `fixture-tore-melden-sich`** wird **rot**, wenn ein Block nicht laufen kann — mit Quittung `TF_OHNE_FIXTURES=1`, damit ein Rechner ohne Fixtures nicht dauerhaft rot bleibt
- Zweiter Wächter verhindert, dass sich künftig wieder ein Block an der Bilanz vorbei selbst abschaltet
- **Gemessen statt vermutet**: vitest 4 zeigt `console`-Ausgaben bestandener Tests im Standard-Reporter *nicht* — weder aus der Sammelphase noch aus einem laufenden Test. „Laut" heißt in diesem Reporter zwangsläufig „rot"

### v6.43.0 — importCsvSource wird ein Orchestrator mit benannten Schritten (September 2026)

MINOR — Der dritte und letzte der geplanten Schnitte, und der einzige, der Logik bewegt statt nur Dateien: `importCsvSource` war eine Prozedur von 469 Zeilen, deren Rumpf aus genau EINEM `try`-Block bestand — vierzehn Phasen, jede eine Ebene tiefer als die Funktion, die sie enthielt.

- **[importer-schritte.ts](src/core/services/csv/importer-schritte.ts)**: sieben benannte Phasen; **kein Schritt schreibt in ein geteiltes `result`/`timings`-Objekt** — jeder gibt zurück, was er ermittelt hat
- `importCsvSource` **469 → 237 Zeilen** und ist jetzt lesbar als das, was es ist: Lock, drei Abbruch-Schranken, Speicher-Freigabe, Ergebnis-Zusammenbau
- Die **Abbruch-Schranke vor dem Ersetzen der Share-Kopie** bleibt bewusst im Orchestrator sichtbar — sie verhindert, dass ein abgebrochener Lauf Kopie und Bestand auseinanderlaufen lässt
- **Der Guard `ein-name-eine-implementierung` hat sofort etwas gefunden**: der Importer trug eine byte-gleiche private Kopie von `findJoinColumn`, die es in [merger/helpers.ts](src/core/services/csv/merger/helpers.ts) längst gab — sichtbar erst, als die Extraktion sie aus dem Modul-Privaten hob

### v6.42.0 — Zwei DAOs werden Ordner: idb-csv und smb-handle (September 2026)

MINOR — Zwei Dateien mit zusammen 1.574 LOC und 192 Importeuren waren formal je EINE Verantwortung, faktisch ein DAO für zehn Entitäten und ein Handle-Manager mit vier Fremdaufgaben. Beide Schnitte sind reine Verschiebearbeit: **kein Import-Spezifizierer ändert sich**, die Export-Menge ist nachweislich identisch.

- **[idb-csv/](src/core/services/csv/idb-csv/)** — 633 LOC → 10 Module je Entität; am Dateinamen ist jetzt ablesbar, ob der Voll-Store oder die Slim-Projektion angefasst wird (Pitfall #32)
- **[smb-handle/](src/core/services/infrastructure/smb-handle/)** — 941 LOC → 7 Module entlang der schon vorhandenen Kommentar-Banner; die Berechtigungs-Orchestrierung (37 % der Datei, trägt die `file://`-Regel „ein Prompt pro Gesture") ist jetzt ein eigenes Modul
- Submodule importieren einander **direkt**, nie über ihr Barrel — sonst Zyklus, und `npm run cycles` fährt mit leerer Allowlist (0 Cluster über 2.067 Dateien)
- **Zwei Convention-Guards mussten mitziehen**: sie führten `smb-handle.ts` als Pfad-Fragment auf ihrer Erlaubt-Liste und wurden vom Umzug rot ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts))

### v6.41.1 — Zwei Guards nennen ihre Reichweite (September 2026)

PATCH — Zwei der neuen Ratschen messen weniger, als ihr Name nahelegt. Das steht jetzt bei ihnen — dieselbe Verwechslung machte `no-raw-async-onclick` monatelang zu einem Guard ohne Reichweite.

- **`vier-parameter-sind-ein-objekt`** sieht nur einzeilige `function`-Deklarationen; eine AST-Messung findet 375 Signaturen mit ≥4 Parametern, nicht 18. Der Ausschnitt ist Absicht (88 % aller Signaturen sind niladisch bis dyadisch), aber er muss dranstehen
- **`verschachtelung-vierzehn`** misst Einrückung, nicht Kontrollfluss-Tiefe: die echte maximale Verschachtelung im Bestand ist **6**, erreicht von fünf Funktionen — ein Verschachtelungsproblem gibt es nicht

### v6.41.0 — Zwei blinde Flecken: ein Guard ohne Reichweite, fuenf Dateien binaer fuer git (September 2026)

MINOR — Zwei Befunde aus der adversarischen Gegenprüfung der Messung, beide seit Monaten unbemerkt durch das komplette Gate gelaufen: ein Guard, der eine Abdeckung behauptet, die er nicht hat — und fünf Quelldateien, die git als binär führt.

- **`no-raw-async-onclick` sah nur eine von drei Schreibweisen**: sein Muster trifft `onClick={() => void fn()}`, nicht die Blockform (33×) und kein anderes Handler-Prop (17×). **Alle 50** liegen außerhalb der Whitelist, in 38 Dateien — darunter `App.tsx` und ausgerechnet die als Vorbild genannte `CsvQuellenPanel.tsx`
- Die Lücke wird jetzt **gezählt und gedeckelt** statt geweitet-und-whitelistet ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts)), dazu eine Musterkontrolle für beide Muster
- **Sechs Dateien trugen literale Steuerzeichen**, fünf davon mit NUL und damit für git **binär**: kein Diff-Review, kein textuelles Merge, kein `git log -S`, `git blame` entwertet. Zeichengleich auf Escape-Sequenzen umgestellt — der Laufzeitwert ist derselbe
- Neuer Guard **`keine-steuerzeichen-im-quelltext`** (Ist 0) hält das fest
- **`fmt` wieder eine Quelle**: die neue Guard-Datei hatte sich eine eigene Kopie gebaut; die geteilte Fassung in [conventions-lib.ts](src/__tests__/conventions-lib.ts) kann jetzt kappen

### v6.40.1 — Ein abgebrochener Umbau wird abgeschlossen: totes Duplikat entfernt (September 2026)

PATCH — `fb-status-felder.ts` war seit Juni 2026 eine zweite Wahrheit: die Verallgemeinerung nach `status-datum-gruppen.ts` war fertig, aber die Löschung blieb liegen — ein Notfall-Restore (`3b5bc857`) hatte sie zurückgeholt, nachdem ein fremder Commit die gestagte Löschung einer Parallel-Session mitgenommen und `master` gebrochen hatte.

- **`fb-status-felder.ts` + Test gelöscht** (228 LOC): keine Produktions-Importstelle; beide Dateien führten dieselbe 11-elementige `FB_STATUS_CODES`-Liste byte-identisch
- Kein Testverlust: [status-datum-gruppen.test.ts](src/core/services/csv/__tests__/status-datum-gruppen.test.ts) deckt jede Zusicherung des gelöschten Tests ab und zusätzlich `D_PC?`/`D_XPC?`
- Zwei Doku-Verweise auf die tote Datei nachgezogen ([korpusFeldAufloesung.ts](src/plugins/antraege/services/korpusFeldAufloesung.ts), [suche-relevanz.md](docs/architecture/suche-relevanz.md))

### v6.40.0 — Die Clean-Code-Achse: elf Regeln zur Codeform, jede mit gemessenem Ist (September 2026)

MINOR — Die ~90 vorhandenen Guards prüfen ausschließlich Fachregeln; eine Achse für die Form des Codes gab es nicht. Sie fehlte nicht, weil die Disziplin fehlt — vier der elf Regeln haben heute **null** Verstöße und halten damit gratis einen Zustand, den bisher nur Gewohnheit hielt.

- **[conventions-clean-code.test.ts](src/__tests__/conventions-clean-code.test.ts)**: 4 Verbote (Ist 0) + 7 Ratschen (Ist eingefroren, darf nur sinken) — jede Schwelle am Bestand gemessen, jede einmal ROT gesehen
- **Ratsche statt Drift-Warnung**, weil die Projekthistorie das entscheidet: über die vier `health-baseline`-Schwellen stehen **70 Anhebungen gegen 5 Senkungen**
- **`eslint-disable-nur-fuer-inaktive-regel`** dreht eine geladene Falle in einen Stolperdraht: alle 72 Direktiven unterdrücken heute *inaktive* Regeln — wer `exhaustive-deps` einschaltet, bekommt sonst null Treffer und hält das für sauber
- **Musterkontrollen für jedes Muster** (Probe + Gegenprobe): ein absichtlich gebrochenes `as any`-Muster fand 0 statt 25 Stellen, die Ratsche blieb dabei **grün** — nur die Kontrolle bemerkte den entwaffneten Guard
- Die Datei nimmt **sich selbst** aus jedem Scan: sie muss die verbotenen Muster im Klartext nennen (dieselbe Klasse wie die 7 Wochen, in denen `MAX_FILE_LOC` die Guard-Datei maß)

### v6.39.1 — Guard-Scanner: 27,5 Prozent weniger Lesearbeit, Blockregeln moeglich, frischer Klon laeuft (September 2026)

PATCH — Der geteilte Guard-Scanner las bei jedem Voll-Durchlauf eine 7,00-MB-Datei mit, die keine Konvention enthält; nur ein einziger Guard hatte die Falle bemerkt und für sich allein repariert. Dazu zwei Vorarbeiten für die Clean-Code-Achse.

- **`src/generated/` fliegt aus [conventions-lib.ts](src/__tests__/conventions-lib.ts)**: eine Datei, 7,00 MB, **27,5 %** jedes Voll-Scans — Testlaufzeit von `check:docs` 18,6 s → 15,0 s
- Die lokale Reparatur in [conventions-status.test.ts](src/__tests__/conventions-status.test.ts) entfällt; die Begründung steht jetzt einmal bei `UEBERSPRUNGEN`
- **`findInContent`** ergänzt: Regeln, die über einem BLOCK entscheiden (leerer `catch`, mehrzeilige Signatur), brauchen keinen eigenen Datei-Scan mehr
- **Frischer Klon lief nicht**: `src/generated/ort-wasm-gz.ts` ist gitignored und wird statisch importiert, aber kein Pre-Hook von `typecheck`/`test` erzeugte sie — `pretypecheck`/`pretest` schließen das (0,19 s, idempotent)

### v6.39.0 — Codequalitaets-Baseline: die Kennzahlen bekommen einen Zaehler (September 2026)

MINOR — Technische Schuld war bisher nur als Gefühl vorhanden: die einzige Struktur-Schranke (`MAX_FILE_LOC` und Geschwister) wurde 70-mal angehoben und 5-mal gesenkt, und sieben Wochen lang maß sie die Guard-Datei selbst statt den Produktionscode. Dieser Schritt misst nur — er verbietet nichts.

- **Mess-Modul** [quality-metrics.mjs](scripts/lib/quality-metrics.mjs): zehn Kennzahlen (Größe, Typsicherheit, Fehlerbehandlung, Marker, Guard-Ausnahmen, Kopplung, Duplikate, Testbezug, tote Exporte, Guard-Suite über sich selbst), reine Node-Stdlib
- **Bericht** [code-quality-baseline.md](docs/architecture/code-quality-baseline.md) per `npm run qualitaet` — versioniert und **ohne Lauf-Datum**, damit ein Diff nur bei echter Drift entsteht; bewusst NICHT im `precheck`
- **`countLoc()` genau einmal definiert** — bis hierher zählte `health-baseline` `split(/\r?\n/)` und `code-map` die Newlines: bei `SuchSeite.tsx` 1233 gegen 1232
- **`src/generated/` ausgeschlossen**: das inline-gzippte ORT-WASM sind 7,34 MB in EINER Zeile und trägt keine Kennzahl
- Erster Befund: 72 `eslint-disable` unterdrücken **ausnahmslos inaktive** Regeln (49× `exhaustive-deps`), und 11 der 55 `vi.mock`-Testdateien stehen nicht in `ISOLATED_TESTS`

### v6.38.0 — AI-native SDLC: Grill-Skill, Zeiger-Skills, Hook, Glossar, Review-Policy (September 2026)

MINOR — Anthropics AI-native SDLC Playbook und Pococks `grill-with-docs`, auf dieses Repo übertragen: Regeln, die bisher nur Prosa waren (keine Heredocs, `git add` nur mit Pathspec), erzwingt jetzt ein Hook; die riskantesten Cheatsheets laden als Skill automatisch; das Interview vor dem Bauen hat ein Format; ein Entwickler-Glossar und eine Review-Policy gibt es erstmals. Detail: [entwicklungsprozess.md](docs/architecture/entwicklungsprozess.md).

- **Hook + Deny-Regeln** in [.claude/settings.json](.claude/settings.json): [bash-guard.mjs](scripts/hooks/bash-guard.mjs) blockt Heredocs, `git add -A/./-u` und verwerfende Git-Befehle mit Grund; eingefrorene Pfade (`_archive/`, `_reference/`, `src/generated/`) sind für Edit/Write gesperrt
- **Skill `grillen`** ([SKILL.md](.claude/skills/grillen/SKILL.md)): Befund zuerst, Frontier-Runden mit Empfehlung, Pflicht-Zweige des Repos, Glossar-Pflege inline — Frage-Schritt des Brainstormings
- **Acht Zeiger-Skills** (`plugin-anlegen` … `filter-facet-anlegen`) öffnen ihr Cheatsheet automatisch; die Quelle bleibt [docs/agents/](docs/agents/README.md)
- **Glossar + Review-Policy**: [CONTEXT.md](CONTEXT.md) (Begriffe, *nicht sagen*, Mehrdeutigkeiten) und [REVIEW.md](REVIEW.md) (vier Pässe, Nit-Deckel 5) für `/code-review`
- **Leichte Artefakt-Kette**: `## 0. Anlass` als Pflicht-Abschnitt jeder Spec, Schwelle für Spec + Plan im Repo ([docs/superpowers/README.md](docs/superpowers/README.md)); Guard [agent-konfiguration.test.ts](src/__tests__/agent-konfiguration.test.ts) prüft Skills, Hook, Settings und Specs in `check:docs`

### v6.37.1 — Veraltete CSV-Datei wird nicht mehr über den Team-Stand importiert (September 2026)

PATCH — Das Produktiv-Audit-Log nannte den Verursacher von v6.37.0: ein Laptop mit einem für Dev-Zwecke eingestellten CSV-Ordner (Exporte vom 21./23.08.) lief gegen den echten Share und importierte dreimal am Tag die alten Dateien über den aktuellen Stand (`changed 1028, heldRemovals 66`) — 18 Tage zurück, bis der nächste Kollege wieder vordrehte. Die 6-h-Divergenz aus v6.37.0 greift dort nicht; die Dateien liegen 18 Tage auseinander, in die falsche Richtung. Detail: [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md).

- **Ältere Datei als der Team-Stempel (≥ 24 h) wird NICHT importiert** und nicht gestempelt — Block mit „Trotzdem importieren" wie bei Spalten-Drift ([csv-quell-divergenz.ts](src/plugins/csv-sources-kuration/services/csv-quell-divergenz.ts), [auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts))
- Bericht, Banner und Dialog zeigen beide Dateien mit Datum, Größe und Urheber; Audit `csv_quelle_veraltet`; `[data-update]` führt `veraltet=` ([CsvAutoRefreshDriftDialog.tsx](src/plugins/csv-sources-kuration/components/CsvAutoRefreshDriftDialog.tsx))

### v6.37.0 — CSV-Quellen: lokaler Import-Stempel, Divergenz-Warnung (September 2026)

MINOR — Produktivsystem, fünf pl-Rechner nach dem Share-Umzug: bei **jedem** Start importierte die App alle drei Quellen neu (Konsole: `imported=3 upToDate=0`, drei Merges mit ~1000 „geänderten" Zeilen, Publish), obwohl die Exporte nur nachts entstehen. Alles, woran die App „schon importiert" erkannte, lag im Snapshot — und den ersetzt der jeweils letzte Publizierer; sehen zwei Rechner die Quelle verschieden, importieren und veröffentlichen sie im Wechsel. Detail: [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md), [recurring-bug-classes.md #26](docs/architecture/recurring-bug-classes.md).

- **Lokaler Import-Stempel** je Quelle im kv-Store, nie im Snapshot: ein Rechner importiert eine Datei höchstens einmal, egal wessen Stempel der Sync hereinträgt ([lokaler-stempel.ts](src/core/services/csv/lokaler-stempel.ts), [csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts))
- **Divergenz-Warnung**: gleiche Export-Nacht, anderer Inhalt, trotzdem Änderungen ⇒ zwei Rechner lesen verschiedene Kopien — Banner, Dialog (beide Dateien mit Größe, Datum, Urheber) und Audit `csv_quelle_divergenz`; Warnung, kein Block ([csv-quell-divergenz.ts](src/plugins/csv-sources-kuration/services/csv-quell-divergenz.ts))
- **Der Start-Pass berichtet in den Banner** statt nur in einen 6-Sekunden-Toast — Divergenz, Drift, Fehler aus dem automatischen Lauf bleiben stehen ([start-bericht.ts](src/plugins/csv-sources-kuration/services/start-bericht.ts))
- **Diagnose im Audit-Log**: `csv_auto_refresh_started` nennt je Kandidat den Grund samt eigener Datei und Team-Stempel, `csv_source_auto_updated` Größe + Checksum, das Schema seinen Urheber (`source_stamped_by`); `[data-update]` führt `changed= errors= divergenz=` ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts))
- Der Kopie-Ordner-Guard steht jetzt im Banner statt nur in der Konsole, die pl-Nutzer nie sehen ([CsvAutoRefreshBanner.tsx](src/plugins/csv-sources-kuration/components/CsvAutoRefreshBanner.tsx))

### v6.36.1 — Abschnitt D bekommt seine Umfangs-Vorgabe zurueck (August 2026)

PATCH — Beim Nebeneinanderlegen der Vorgaben aller sieben Abschnitte (v6.36) stand D als einziger auf `{}`. Der Seed führt 300–350 seit jeher; auf den Share kam der Wert nie, und niemand hat je gemerkt, dass D ungeprüft lief. Detail: [artefakt-engine.md](docs/architecture/artefakt-engine.md).

- **D prüft jetzt 300–350 Wörter als `fehler`** — dieselbe Vorgabe wie C, dieselbe Sorte Abschnitt; damit greift auch dort der automatische Korrektur-Versuch ([migrations.ts](src/core/services/skills/registry/migrations.ts))
- Gemessen an neun gespeicherten D-Texten, was ohne Prüfung entstand: **1 im Band**, drei mit **neun Wörtern** (9, 9, 9, 341, 356, 387, 412, 419, 841)
- Ursache: `applySkillVorgaben` (v2.296) wandelte nur Regel-Records um, die es auf dem Share gab — `mergeMissingSeeds` ergänzt fehlende Skills, nie fehlende Felder eines vorhandenen
- Gesetzt wird **nur, wo gar keine Wortanzahl steht**; ein kuratierter Wert, auch ein weicherer Schweregrad, bleibt unangetastet

### v6.36.0 — Der Standardsatz zieht an den Workflow, der fachliche Pruefer geht an (August 2026)

MINOR — 37 Regel-Deklarationen über A–G, davon 25 dieselbe Regel mehrfach: eine Änderung an „keine Aufzählungen" waren sechs Änderungen. Der Satz zieht an den Workflow, wo er hingehört — und der seit v6.27 stillgelegte fachliche Prüfer geht mit an. Detail: [artefakt-engine.md](docs/architecture/artefakt-engine.md).

- **`WorkflowDef.standardRegelIds`** trägt die vier Form-Regeln für jeden Abschnitt; die aufgelöste Regelliste bleibt A–F **identisch**, nur G gewinnt die bisher fehlende Aufzählungs-Regel ([selectors.ts](src/core/services/skills/registry/selectors.ts))
- **Am Workflow und nicht am Prüfer**: sonst hätte ein abgeschalteter Prüfer stillschweigend vier Form-Regeln aus allen sieben Abschnitten mitgenommen ([types.ts](src/core/services/skills/registry/types.ts))
- **`SkillRecord.ohneStandard`** macht aus der Lücke eine Ansage — E und F tragen bewusst keine Passiv-Regel, was bisher von einem Versehen nicht zu unterscheiden war ([gutachten-bg.seed.ts](src/core/services/skills/registry/gutachten-bg.seed.ts))
- **Der fachliche Prüfer ist an** (`qs-basis`, dritter KI-Lauf je Abschnitt auf der Gegenrolle) — er existiert nur in dev und pl, der Kill-Switch bleibt am Skill ([qs-basis.seed.ts](src/core/services/skills/registry/qs-basis.seed.ts))
- Gemessen am gespeicherten Eval-Korpus (224 echte Abschnitts-Texte): die zwei geschlossenen Lücken schlagen **null-mal** an, der Umzug ist damit verhaltensneutral

### v6.35.0 — Die Korrektur-Anweisung nennt das Ziel zuerst (August 2026)

MINOR — Erstmals gegen die **interne KI** gemessen statt gegen den OpenRouter-Zwilling. Sie verhält sich anders — und die Korrektur-Anweisung entscheidet sich an einem Detail: das Modell zielt auf die zuerst genannte Zahl. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Die Korrektur-Anweisung nennt jetzt das ZIEL zuerst**, die Ränder dahinter („Kürze auf rund 450 Wörter (Untergrenze 400, Obergrenze 500)") ([korrektur.ts](src/core/services/skills/registry/korrektur.ts))
- Gemessen an der internen KI, Abschnitt B: Obergrenze zuerst → 659 **→ 377** (25 % unter dem Band); Ziel zuerst → 399 **→ 443** und 539 **→ 482**, beide im Band
- **Der komplette Weg trägt ohne Zutun**: B frisch erzeugt 645 → automatische Korrektur → **473**, 6 von 6 Checks ok; C **→ 304**, 5 von 5 ok
- Die interne KI schreibt anders als Haiku — B **725 statt 310–440** (zu lang), C **106 statt 244–321** (zu kurz); was am Zwilling gewinnt, gewinnt nicht am Original
- Vor diesen Änderungen stand C bei 106 Wörtern gegen ein Ziel von 300–350, B bei 725 gegen 400–500

### v6.34.0 — Ueberschriften im Gutachten-Fliesstext werden gefunden (August 2026)

MINOR — Die Prompts verlangen „keine Zwischenüberschriften", und `keineAufzaehlungen` ist als `fehler` gebunden — trotzdem trug jeder vierte B-Text Markdown-Überschriften bis in den DOCX-Export. Die Regel sucht Listen-Marker; eine Überschrift ist keiner. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Neuer Regel-Typ `keine_ueberschriften`** als Geschwister von `keine_aufzaehlungen` — dieselbe Absicht („ein geschlossener Fließtext"), die fehlende Hälfte der Umsetzung ([check-engine.ts](src/core/services/skills/registry/check-engine.ts))
- Gemessen an 224 echten Abschnitts-Texten aus vorhandenen Eval-Läufen: **17 von 77 B-Texten** betroffen, C–G sauber, **kein einziger Fehlalarm** — ohne neuen Modell-Aufruf
- Als geteilte Regel `seed-keine-ueberschriften` an **alle sieben** Abschnitte gebunden, auch an E und F ([gutachten-kurzfassung.seed.ts](src/core/services/skills/registry/gutachten-kurzfassung.seed.ts))
- **Bewusst `hinweis`, nicht `fehler`**: ein `fehler` verwürfe über den `neu`-Retry einen sonst brauchbaren Abschnitt, und der Nutzen davon ist ungemessen (Mess-Budget erschöpft)
- **Gemessen und verworfen**: die Platzhalter-Regel und fünf Meta-/TODO-Muster schlagen auf denselben Texten null-mal an — sie würden nur eine dauerhaft grüne Zeile je Abschnitt hinzufügen

### v6.33.0 — Die Wortanzahl von B und C wird durchsetzbar (August 2026)

MINOR — Der Befund aus v6.32 („das Ziel liegt über dem, was das Modell schreibt") galt nur für einen einzelnen Wurf. Mit der Wortanzahl als `fehler` greift der vorhandene `laenger`-Retry, und die Zielzahlen sind erreichbar. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **B und C führen die Wortanzahl als `fehler` statt `hinweis`** — nur so startet `chooseRetryModifier` einen Korrektur-Versuch; B erreicht damit 9 von 9 Läufen das Band 400–500 (vorher: nie) ([gutachten-bg.seed.ts](src/core/services/skills/registry/gutachten-bg.seed.ts))
- Der Seed übernimmt für B die vom Team kuratierten **400–500** statt der alten 750, die nachgemessen kein Modell erreicht
- **Die Eval-Harness kennt den Auto-Retry** — Decke aus der Workflow-Definition, `--no-auto-retry` schaltet ab; ohne sie maß jede Zahl den ersten Wurf, den in der App niemand sieht ([eval-run.ts](src/core/services/skill-eval/eval-run.ts))
- Der automatische Korrektur-Lauf nennt jetzt denselben Zielwert wie der manuelle Knopf (`retryKorrekturAnweisung`, ohne messbaren Effekt) ([retry-policy.ts](src/plugins/antraege/gutachten/retry-policy.ts))
- **Zurückgenommen nach der Messung**: zwei „prinzipiellere" Korrektur-Wortlaute („N bis M", „rund MITTE") schnitten schlechter ab als der Bestand (10/18 und 11/18 gegen 14/18) — Sonnet 5 löst es ebenfalls nicht

### v6.32.0 — Abschnitt B und C: die Zahl ueberlebte den Formwechsel (August 2026)

MINOR — Beide Abschnitte lieferten 3/3 zu wenig Wörter, und beide Male war es eine Umfangs-Zahl, die eine Form überlebt hat, für die sie nie geeicht war. Anders als bei A war die Messung selbst in Ordnung. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **B forderte in der Prosa mindestens 750 Wörter, in der Regel 400–500** — die Teil-Richtwerte ≥150/≥150/≥450 blieben bei der Ent-Dopplung 2026-07 stehen und waren auf den alten Stand geeicht ([gutachten-bg.seed.ts](src/core/services/skills/registry/gutachten-bg.seed.ts))
- **C's Umfang gehörte zu einer Form, die es nicht mehr gibt**: 300–350 Wörter galten, als der finale Text ALLE Risiken mit Kurztitel trug; heute ist er eine gefilterte Teilmenge ohne eigene Tiefenangabe
- Gemessen (Haiku, 3 VBs): **C 203/235/218 → 309/244/283**, B ohne Richtung (360/364/364 → 440/321/337) — B's Ziel liegt über dem, was das Modell für diesen Abschnitt schreibt
- **Der `laenger`-Retry feuert bei zu kurzem Text nie** — `chooseRetryModifier` startet nur bei `fehler`, die Wortanzahl ist an B und C ein `hinweis` ([retry-policy.ts](src/plugins/antraege/gutachten/retry-policy.ts))
- Der Wächter, der das hätte fangen müssen, prüft Teil-Richtwerte jetzt als **Summe**; `npm run eval:skills` meldet Prompt-Widersprüche VOR dem ersten Modell-Aufruf ([check-engine.ts](src/core/services/skills/registry/check-engine.ts), [cli.ts](src/core/services/skill-eval/cli.ts))

### v6.31.0 — Doppelfoerderung: der Bestand waehlt das Schlagwort (August 2026)

MINOR — Der erste Messlauf gegen die interne KI zeigte: 45,6 % der gelieferten Schlagworte trafen im Bestand **nichts**, 13,4 % fluteten. Das ist kein Prompt-Mangel, sondern eine Wissensgrenze — das Modell sieht den Bestand nicht, die App schon. Detail: [doppelfoerderung.md](docs/architecture/doppelfoerderung.md).

- Das Modell liefert je Achse **zwei bis drei Vorschläge eng → weit** statt eines Worts; ein KI-Lauf je Zeile wie bisher ([schlagworte.ts](src/plugins/doppelfoerderung/services/schlagworte.ts))
- Die Wahl trifft der Bestand: Rang `trägt` vor `markiert` vor `tot` vor `flutet`, bei Gleichstand der engere ([wortwahl.ts](src/plugins/doppelfoerderung/services/wortwahl.ts))
- Ein nachgeschlagenes Wort trägt `↳` und nennt im Tooltip den verworfenen Erstvorschlag mit seiner Trefferzahl ([ErgebnisTabelle.tsx](src/plugins/doppelfoerderung/components/ErgebnisTabelle.tsx))
- Gemessen (3 × 29 Meldungen, 261 Schlagworte): tote Wörter **45,6 % → 29,1 %**, „zu weit" **13,4 % → 7,3 %**, Median 1 → 4, „nicht beurteilbar" 9 → 3 Zeilen; Wartezeit +55 %
- **Nicht gelöst**: die Wiederholbarkeit — 8 von 29 Zeilen wechseln über drei Läufe weiter ihr Urteil (Abschnitt 12)

### v6.30.0 — Abschnitt A: Zweck, Weglass-Liste und das verlorene Ausgabeformat (August 2026)

MINOR — Die Kurzfassung wird veröffentlicht und steht dort allein — das stand nirgends, und ohne den Zweck war nicht begründbar, warum Antragsteller, FuE-Risiko und Abgrenzung zum Stand der Technik nicht hineingehören. Darunter lagen zwei Defekte, die erst der Messlauf zeigte. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Das Ausgabeformat war im kuratierten Prompt verloren** — ohne `### Finaler Text` nahm der Parser die GANZE Antwort samt erfundener Titelzeile, Förderkennzeichen und Antragsteller-Zeile; daran riss das Zeichenlimit ([gutachten-kurzfassung.seed.ts](src/core/services/skills/registry/gutachten-kurzfassung.seed.ts))
- Zweck, Weglass-Liste und das Zeichenlimit als **Schreib**-Anweisung (1.100 Zeichen auf zehn Sätze = rund 15 Wörter je Satz) statt als Nachkontrolle — `mitVeroeffentlichungsKontrakt`, eine Funktion für Seed und Migration
- **Der Eval-Judge sah nur 10–12 % der VB** (Cap 12.000 bei 100.000+ Zeichen) und wertete korrekt übernommene Kennzahlen als „nicht belegt" ab; Default jetzt die ganze VB, `--judge-vb-cap` senkt ihn ([judge.ts](src/core/services/skill-eval/judge.ts))
- Die `beschreibung` von A trägt den Umfang — sie ist das einzige Feld, aus dem der Judge erfährt, was der Abschnitt leisten soll
- Gemessen (Haiku 4.5 / Opus 5, 3 fiktive EP): fachliche Korrektheit **3,00 → 4,67**, Regeltreue **3,00 → 4,33**, Läufe ohne Check-Fehler **0/3 → 2/3**

Rollout über `ga-a-veroeffentlichung-2026-08`, additiv und zeilenweise; eine selbst geschriebene `beschreibung` bleibt stehen.

### v6.29.0 — Zeitplan-Pause aufgehoben (August 2026)

MINOR — Der Zeitplan-Tab war seit v2.266 gesperrt, weil „die Arbeitspaket-Erkennung aus den PDF-Quellen zu unzuverlässig" sei. Der Grund lag eine Schicht tiefer, im Konverter (v6.28.0) — behoben trägt die Ernte. Nachgemessen über den echten `baueRun`-Pfad, dann aufgehoben; zwei Defekte, die erst die offene Sicht zeigte, gleich mit. Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

- Zeitplan-Tab, „Zeitplan öffnen"-Einstieg und die Zahlen-Quervergleiche sind **unbedingt offen**; ein Antrag ohne lesbaren Arbeitsplan bekommt den Leerzustand statt einer Sperre ([tab-gating.ts](src/plugins/antraege/aufbereitung/tab-gating.ts))
- Die Pause ist **entfernt**, nicht auf `false` gestellt — `ZEITPLAN_PAUSIERT`, `zeitplanVerfuegbar` und `sichtbareZeitplanBefunde` samt ihrer Gates sind weg ([pausierte-module.ts](src/plugins/antraege/aufbereitung/pausierte-module.ts))
- **Anlage 5 wird auch aus der VB gelesen**, wenn sie kein eigenes Dokument ist (so in allen drei synthetischen Anträgen) — vorher zeigte der Tab 9 Text-Zeilen ohne PM/MA statt der 21 vollständigen ([store.ts](src/plugins/antraege/aufbereitung/store.ts))
- **„Januar 2024" ist kein Monat 2024**: Beginn/Ende-Spalten mit Datums-Werten werden als Kalendermonate gelesen (M1 = frühester Beginn), Monats-Indizes über 240 verworfen — die Gantt-Achse ging sonst bis M2026 ([tabellen.ts](src/plugins/antraege/aufbereitung/tabellen.ts))
- Messung 100 generierte DOCX-Anträge: 49 mit AP-Tabelle → **100 %** auswertbare Monats-Spannen, `zeitplanUnsicher` false 49/49; 49 ohne → `run.zeitplan === null`, kein falscher Gantt

**Unverändert pausiert**: Fragen-Tab, Abdeckungs-Tab und die nicht prüfrelevanten Zahlen-Kategorien — andere Gründe, eigene Entscheidungen.

### v6.28.0 — Die PDF-Konvertierung liest die Gliederung aus dem Dokument (August 2026)

MINOR — Gemessen an den drei synthetischen Anträgen kamen aus einem PDF **0 von 44–47 Überschriften** an, 0 Listen, 0 Auszeichnungen — obwohl alle drei PDFs ihre Gliederung als Tag-Baum mitbringen. Der Konverter las nur `getTextContent()` und warf die Struktur weg. Folge: `parseVbHeadings` fand genau eine Sektion, die Relevanz-Map des Gutachtens war auf jedem PDF-Antrag blind. Detail: [pdf-konvertierung.md](docs/architecture/pdf-konvertierung.md).

- **Sprosse 1 — Tag-Baum**: `getStructTree()` + Marked-Content-Ids ergeben Überschriften, Listen und Tabellen wie im Original; Kopf-/Fußzeilen fallen als Artefakte weg ([pdf-struktur.ts](src/core/services/converter/pdf-struktur.ts))
- **Sprosse 2 — Schriftgrößen** für PDFs ohne Tags: Grundgröße nach Zeichen (nicht nach Zeilen), umbrochene Überschriften werden zusammengesetzt, und über 25 % Trefferquote gilt das Signal als unbrauchbar ([pdf-ueberschriften.ts](src/core/services/converter/pdf-ueberschriften.ts))
- **Sprosse 3 — flach**: der Bericht sagt jetzt, dass die Überschriften verloren sind, und nennt den Umweg über den PDF-Client ([conversion-report.ts](src/core/services/converter/conversion-report.ts))
- Ein Inhaltsverzeichnis wird als **Liste** gesetzt (getaggt oder als Absatz-ganz-im-Link erkannt) — als blanke Zeilen las die Gliederungs-Erkennung jede IHV-Zeile als Kapitel: 59 statt 47 Sektionen
- Gemessen nach dem Umbau: **46/48/45 Überschriften** (Referenz 46/47/44), Relevanz-Map 32/34/31 = exakt die Referenz

**Wo es aufschlägt**: jede VB-Aufnahme (Aufbereitung, Gutachten, Dokumente, Chat-Anhänge) — die Konvertierung ist eine Stelle. DOCX war und bleibt strukturtreu; die Leiter betrifft nur PDF.

### v6.27.1 — die Zieldatei überlebt einen gescheiterten Write (August 2026)

PATCH — `atomicWrite` benannte das Ziel zur `.backup` um, **bevor** es den neuen Inhalt schrieb; bei `atomicWriteStream` umfasste dieses Fenster den ganzen `produce`-Lauf. Jeder Abbruch darin ließ nur `<datei>.backup` zurück — belegt an `_intern/skills/registry.json`. Regel: [add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md).

- **Reihenfolge gedreht**: erst `.tmp` schreiben, dann rotieren, dann umbenennen — das Fenster ohne Zieldatei schrumpft auf zwei Umbenennungen ohne Nutzdaten-I/O ([atomic-write.ts](src/core/services/infrastructure/atomic-write.ts))
- **Gescheiterter Einwechsel wird zurückgedreht** — schlägt die letzte Umbenennung fehl, trägt das Ziel wieder seinen alten Inhalt (`tauscheTmpEin`, geteilt von beiden Schreibern)
- Der Kommentar „das Ziel bleibt unberührt" an `atomicWriteStream` war falsch; er stimmt jetzt
- **Warum die grüne Suite das trug**: der einzige Fehlerfall-Test lief mit `skipBackup` — dem einen Profil, das das Ziel nie wegbenennt ([atomic-write-konformitaet.test.ts](src/core/services/infrastructure/local-fs/__tests__/atomic-write-konformitaet.test.ts))
- Neuer Ordnungs- **und** Ergebnis-Nachweis, jeder Zweig einmal rot gesehen ([atomic-write-reihenfolge.test.ts](src/core/services/infrastructure/__tests__/atomic-write-reihenfolge.test.ts))

### v6.27.0 — Der fachliche Prüfer wird gebunden (August 2026)

MINOR — Die fachliche Prüfung war vollständig gebaut und nirgends gebunden: `zim-ep` trug sieben Generierungs-Schritte und keinen `llm_qs`, also erschien der QS-Knopf nie und `ga-qs-quellenabgleich` — eine `fehler`-Regel — ist noch nie gelaufen. Detail: [artefakt-engine.md](docs/architecture/artefakt-engine.md).

- **Ein Prüfer ist ein Skill mit `pruefart`**, gebunden am ARTEFAKT (`WorkflowDef.pruefer`) statt als sieben `llm_qs`-Schritte ([selectors.ts](src/core/services/skills/registry/selectors.ts))
- **Drittes Bein der Kette**: `mitPruefung` nach dem Feinschliff — auch nach Überarbeitungen, auf der **Gegenrolle** der Generierung, beratend und ohne Auto-Retry ([workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts))
- **Prüfkatalog am Prüfer** (`gruppe` · `kriterium` · `herkunft` · `giltFuer`); eigene `qsKriterien` am Abschnitt schlagen ihn ([PruefkatalogEditor.tsx](src/plugins/skill-verwaltung-kuration/PruefkatalogEditor.tsx))
- **Er startet stillgelegt** — sein Prompt ist an echten Abschnitten nie gemessen worden, und er kostet je Abschnitt einen KI-Lauf (A–G ~10 → ~15 min). Rollout `ga-fachpruefer-2026-08` ([migrations.ts](src/core/services/skills/registry/migrations.ts))
- Abgenommen in der laufenden App: Migration legt einen Bestands-Share still, Katalog-Zeile bis auf die Platte gespeichert, 0 Konsolenfehler

### v6.26.0 — Jede Vorgabe nennt ihren Grund (August 2026)

MINOR — Am Zeichenlimit der Kurzfassung stand nirgends, dass es aus einem fremden Formularfeld kommt, das 1.200 Zeichen fasst. Deshalb stand es gleichrangig neben einer hausgemachten Satzzahl, die ihm rechnerisch widersprach — und niemand konnte sagen, welche der beiden verhandelbar ist. Detail: [skill-vorgaben.md](docs/architecture/skill-vorgaben.md).

- **`herkunft` an Regel und Vorgabe** — ein Satz, den der Kurator schreibt und der NICHT in den Prompt geht ([types.ts](src/core/services/skills/registry/types.ts))
- **Er reist bis an die Prüfung**: `runRegelChecks` stempelt ihn wie `kategorie` auf das `CheckResult`, die Check-Liste zeigt ihn als „Grund:"-Zeile unter dem Befund ([CheckList.tsx](src/plugins/antraege/kurzfassung/CheckList.tsx))
- **Gepflegt wird er im Skill-Editor (je Vorgabe) und im Regel-Editor** ([VorgabenEditor.tsx](src/plugins/skill-verwaltung-kuration/VorgabenEditor.tsx), [RegelEditor.tsx](src/plugins/skill-verwaltung-kuration/RegelEditor.tsx))
- **Kurzfassung: Zeichenlimit 1.000 → 1.100** („900 ± 200", hundert Zeichen Luft zum harten Rand) samt Grund — Rollout über `ga-a-zeichen-herkunft-2026-08`, Wert und Grund unabhängig pristine-geschützt ([migrations.ts](src/core/services/skills/registry/migrations.ts))
- Abgenommen in der laufenden App: Grund-Zeile an Ampel-Zeile UND Fehler-Karte, Editor speichert bis auf den Share, 0 Konsolenfehler

