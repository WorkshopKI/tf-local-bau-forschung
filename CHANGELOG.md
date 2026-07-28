# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

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

### v2.333.0 — Status-Katalog: Feldname statt feldId, CSV-Spalte als Herkunft (Juli 2026)

MINOR — Die Katalog-Tabelle zeigte je Zeile die technische `feldId` (`status`), obwohl der Katalog dafür längst einen kuratierten Namen führt („TV-Status"). Es fehlte zugleich die CSV-Spalte — der Bezeichner, unter dem ein Status im Fachsystem-Export tatsächlich steht.

- `feldLabel` hat jetzt EINE Heimat in `@/core/status` (vorher UI-lokal); Katalog- und Regeln-Tab zeigen den Feldnamen, die feldId bleibt im Tooltip ([feld-zugriff.ts](src/core/status/feld-zugriff.ts)).
- Neue Spalte **CSV-Spalte** in Katalog- und Felder-Tab: Herkunft je Feld aus den Programm-Schemas, mehrere Programme sammeln ihre Spaltennamen ([cockpit-berechnung.ts](src/core/status/cockpit-berechnung.ts)).
- Suche greift zusätzlich auf Feldname und CSV-Spalte ([KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx)).
- Label-Platzhalter sagt „wie Rohwert" statt den Rohwert zu spiegeln — leeres Label sah bisher aus wie ein gesetztes ([KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx)).
- `feldLabel` fällt auch bei leer geräumtem Label auf die feldId zurück (sonst bliebe die Spalte leer) ([feld-zugriff.test.ts](src/core/status/__tests__/feld-zugriff.test.ts)).

### v2.332.0 — Status-Katalog wird Team-Datei auf dem Daten-Share (Juli 2026)

MINOR — Der kuratierte Status-Katalog wirkte bisher nur auf dem Rechner, auf dem kuratiert wurde — praktisch kuratierte damit entweder niemand oder jeder neu. Er liegt jetzt als Team-Datei auf dem Daten-Share, wie der Meilenstein-Plan. Die Historie bleibt bewusst gerätelokal.

- Katalog als Sidecar `_intern/status-katalog.json`, Abgleich einmal beim App-Start ([katalog-share.ts](src/core/status/katalog-share.ts)).
- Speichern veröffentlicht für das Team; blieb es lokal, sagt die Seite das und bietet einen zweiten Anlauf ([StatusCockpitPage.tsx](src/plugins/status-cockpit/StatusCockpitPage.tsx)).
- Einmalige Sicherung des lokalen Standes vor der ersten Übernahme; lokale Fassungen mit unbekannter Nummer bleiben erhalten ([katalog-share.ts](src/core/status/katalog-share.ts)).
- Event-Log und Unkuratiert-Puffer bleiben gerätelokal; team-weit Kuratiertes räumt sich beim nächsten Import aus dem Puffer ([entdecke.ts](src/core/status/entdecke.ts)).
- Guard aufgeteilt: `status-katalog-share-only` (genau ein Share-Weg) und `status-event-log-local-only`; Pitfall #40 umgeschrieben.

### v2.331.0 — Meilensteine: Home-Widget, Detailsektion, Risiko-Meldung (Juli 2026)

MINOR — Das Monitoring kommt dorthin, wo gearbeitet wird: auf die Startseite, auf die Verbund-Detailseite und in einen Rückkanal zur Projektleitung. Wer absehbar einen Meilenstein reißt, kann das melden, statt dass es erst beim nächsten Blick in die Liste auffällt. Schließt die Ausbaustufe ab.

- Home-Widget „Meilensteine diese Woche" mit den dringendsten eigenen Meilensteinen ([MeilensteineWidget.tsx](src/plugins/home/widgets/MeilensteineWidget.tsx)).
- Abschnitt „Fristen & Meilensteine" auf der Verbund-Detailseite unter dem Status ([MeilensteinSection.tsx](src/plugins/antraege/meilensteine/MeilensteinSection.tsx)).
- Risiko-Meldung über den persönlichen Ordner an die Projektleitung; ohne Ordner bleibt sie lokal und sagt es ([risiko-storage.ts](src/core/meilensteine/risiko-storage.ts)).
- Architektur-Doku, CLAUDE.md-Eintrag und Pitfall #41 ([meilensteine.md](docs/architecture/meilensteine.md)).
- Modul-lokale Guards für Team-Sidecar, persönlichen Rückkanal und die Antragstyp-Einzelquelle ([konventionen.test.ts](src/core/meilensteine/__tests__/konventionen.test.ts)).

### v2.330.0 — Meilenstein-Auswertung: Bearbeitungszeiten je Antragstyp (Juli 2026)

MINOR — Die Frage „wie lange dauert es bei uns wirklich" bekommt eine Antwort: Ø-Bearbeitungszeit, Median, Anteil innerhalb der Frist und die Abweichung vom Soll — gesamt und getrennt nach FuE, DS, DL und NW. Dazu je Meilenstein die durchschnittlich erreichte Ist-Woche gegen die Soll-Woche.

- Neuer Reiter „Auswertung" mit Kennzahl-Kacheln und Verteilungs-Balken je Antragstyp ([AuswertungTab.tsx](src/plugins/meilensteine/AuswertungTab.tsx)).
- Dauer-Klassen bis 60 / 61–90 / 91–120 / über 120 Tage über den geteilten `DistributionBar`.
- Meilenstein-Tabelle mit Soll-Woche, Ø Ist-Woche, Δ und Reißquote je Knoten.
- Verteilung der offenen Verbünde nach Prognose als Zahlenleiste.
- Dauer-Statistik zählt abgeschlossene Vorgänge, Meilenstein-Statistik offene — beides getrennt beschriftet statt vermischt.

### v2.329.0 — Meilenstein-Cockpit: Übersicht, Zeitstrahl, Diese Woche (Juli 2026)

MINOR — Jetzt ist sichtbar, wo es klemmt: eine Zeile je offenem Verbund mit Zustands-Punkten je Meilenstein und Restzeit zur Gesamtfrist, daneben der Zeitstrahl Soll gegen Ist. Der Reiter „Diese Woche" beantwortet dieselbe Frage aus Sicht des Bearbeiters.

- Übersicht als Master/Detail mit Filtern nach Antragstyp, Prognose, Suche und „nur meine" ([UebersichtTab.tsx](src/plugins/meilensteine/UebersichtTab.tsx)).
- Zeitstrahl je Verbund: Soll als hohle Raute, Ist als Punkt, Verzugsstrecke dazwischen ([MeilensteinLeiste.tsx](src/plugins/meilensteine/MeilensteinLeiste.tsx)).
- „Diese Woche": überfällige und fällige Meilensteine über alle Verbünde, dringendstes zuerst ([DieseWocheTab.tsx](src/plugins/meilensteine/DieseWocheTab.tsx)).
- Sortierung nach Dringlichkeit — Prognose schlägt Restzeit ([monitoringLogic.ts](src/plugins/meilensteine/monitoringLogic.ts)).
- Ohne freigegebene Fassung bleibt die Auswertung leer statt Zahlen aus einem Entwurf zu zeigen ([useMeilensteinStand.ts](src/plugins/meilensteine/useMeilensteinStand.ts)).

### v2.328.0 — Meilenstein-Plugin: Konfiguration durch die PL (Juli 2026)

MINOR — Das Modul wird sichtbar: die Projektleitung legt Meilensteine an, verschiebt sie im Baum, setzt Soll-Wochen und ordnet ihnen per Auswahl die CSV-Spalten zu, die sie erfüllen — ohne Code-Änderung. Alle anderen sehen dieselbe Seite read-only.

- Neues Plugin „Fristen & Meilensteine" unter `/meilensteine` ([index.ts](src/plugins/meilensteine/index.ts)).
- Baum-Editor mit Anlegen, Löschen, Verschieben, Soll-Woche, Antragstyp-Filter und automatischer Nummerierung ([KonfigurationTab.tsx](src/plugins/meilensteine/KonfigurationTab.tsx), [knoten-edit.ts](src/core/meilensteine/knoten-edit.ts)).
- Struktureller Bedingungs-Editor ohne Freitext; Feld-Angebot aus allen gemappten CSV-Spalten ([BedingungEditor.tsx](src/plugins/meilensteine/BedingungEditor.tsx), [spalten-katalog.ts](src/core/meilensteine/spalten-katalog.ts)).
- Fassungen speichern, freigeben, zurückziehen und aus der Historie übernehmen ([useMeilensteinPlan.ts](src/plugins/meilensteine/useMeilensteinPlan.ts)).
- Schreibrecht ausschließlich über `canWriteDatenShare`; unbestätigte Zuordnungen sichtbar gekennzeichnet ([MeilensteinePage.tsx](src/plugins/meilensteine/MeilensteinePage.tsx)).

### v2.327.0 — Meilenstein-Persistenz: Team-Sidecar, Fassungen, Projektion (Juli 2026)

MINOR — Eine Frist-Definition, die auf jedem Rechner anders lautet, wäre wertlos: der Meilenstein-Plan liegt deshalb als kuratierte Team-Datei auf dem Daten-Share — die PL pflegt ihn, alle lesen ihn. Dazu die vorberechnete Frist-Projektion der offenen Verbünde, die sich nach jedem Import selbst erneuert.

- Plan als versionierte Sidecar `_intern/meilensteine.json` mit IDB-Cache und toleranter Normalisierung ([plan-storage.ts](src/core/meilensteine/plan-storage.ts)).
- Fassungen mit Historie, eigener Freigabe-Achse und Rollback nach vorne ([versionierung.ts](src/core/meilensteine/versionierung.ts)).
- Nur ein freigegebener Plan wird ausgewertet; ein Entwurf verschiebt keine team-weit sichtbaren Zahlen ([plan-storage.ts](src/core/meilensteine/plan-storage.ts)).
- Frist-Projektion der offenen Verbünde mit Signatur-Guard über Plan, Mapping, CSV-Stand und Kalendertag ([projektion.ts](src/core/meilensteine/projektion.ts)).
- Eigener Post-Import-Pass neben der Status-Nachpflege, best-effort ([import-integration.ts](src/core/meilensteine/import-integration.ts)).

### v2.326.0 — Meilenstein-Engine: Bewertung, Feld-Auflösung, Auswertung (Juli 2026)

MINOR — Die zweite Achse bekommt Rechenkraft: aus Meilenstein-Plan und Antragsdaten wird deterministisch abgeleitet, welcher Meilenstein erreicht, fällig oder gerissen ist und ob die 3-Monats-Frist noch zu halten ist. Dazu die Auswertung der tatsächlichen Bearbeitungszeiten je Antragstyp. Weiterhin ohne UI.

- Bewertungs-Engine je Verbund mit Soll-/Ist-Terminen, Zuständen und Frist-Prognose ([bewertung.ts](src/core/meilensteine/bewertung.ts)).
- Ist-Termine kommen aus den Daten statt aus einem Log, damit auch der Bestand auswertbar ist ([bewertung.ts](src/core/meilensteine/bewertung.ts)).
- Bedingungs-Felder werden als CSV-Spalten-Code über das Programm-Schema aufgelöst, nie hart verdrahtet ([felder.ts](src/core/meilensteine/felder.ts)).
- Ø-Bearbeitungszeit, Median, Soll-Anteil und Dauer-Klassen je FuE/DS/DL/NW plus Reißquote je Meilenstein ([auswertung.ts](src/core/meilensteine/auswertung.ts)).
- 58 Engine-Tests mit eingefrorener Uhr, inklusive Eltern-Regel, Typ-Filter und Zyklus-Schutz ([__tests__](src/core/meilensteine/__tests__)).

### v2.325.0 — Meilenstein-Fundament: Flag, Datenmodell, Plan v1 (Juli 2026)

MINOR — Die App zeigt bisher, WO ein Verbund steht, aber nicht, ob er dort rechtzeitig steht. Fundament für das Fristen-Monitoring: eine zweite Achse aus Bearbeitungs-Meilensteinen mit Soll-Wochen ab Antragseingang, verbindlich in der Struktur (MST 1 … 6) und kuratierbar in der Zuordnung. Noch ohne UI — Bewertung, Cockpit und Widget folgen.

- Feature-Flag `meilensteinMonitoring` end-to-end, aktiv in dev/pl/as/kurator ([feature-flags.ts](src/config/feature-flags.ts), [config-schema.mjs](scripts/config-schema.mjs)).
- Datenmodell + Auslieferungs-Plan v1 mit MST 1 … 6 inkl. Unter-Meilensteinen ([typen.ts](src/core/meilensteine/typen.ts), [seed.ts](src/core/meilensteine/seed.ts)).
- Nur eindeutig belegbare Zuordnungen sind aktiv; geratene Quellen bleiben inaktiv und als unbestätigt gekennzeichnet ([seed.ts](src/core/meilensteine/seed.ts)).
- Bedingungs-Evaluator aus der Ableitungs-Engine herausgelöst, damit Regeln und Meilensteine denselben nutzen ([bedingung.ts](src/core/status/bedingung.ts)).
- vb_phase → Antragstyp (FuE/DS/DL/NW) als Einzelquelle in den Core gezogen; Quickfilter und Auslastung greifen darauf zu ([vb-phase-mappings.ts](src/core/utils/vb-phase-mappings.ts)).

### v2.324.2 — Status-&-Verlauf-Widget: Karten einzeilig (Juli 2026)

PATCH — Im Home-Widget „Status & Verlauf" belegte jede Verbund-Karte zwei Zeilen (Kopf + eigener „nächster Schritt"), sodass nur wenige Verbünde ohne Scrollen sichtbar waren. Der nächste Schritt bzw. der Leer-Hinweis wandert jetzt in dieselbe Zeile, wodurch bei gleicher Höhe mehr Verbünde passen.

- Karte einzeilig: Akronym · Status-Badge · Konflikt · nächster Schritt (füllt, truncate) · Mini-Verlauf; vertikale Polsterung verschlankt ([StatusVerlaufWidget.tsx](src/plugins/home/widgets/StatusVerlaufWidget.tsx)).

### v2.324.1 — Anfragen: kein Auto-KI-Tab beim .msg-Ablegen, Verbinden-Dialog + Standard-KI (Juli 2026)

PATCH — Beim Ablegen einer `.msg`-Kurzanfrage startete sofort das automatische Tagging; war die interne KI noch nicht verbunden, riss dieser Lauf ungefragt einen neuen KI-Tab auf. Jetzt kein Auto-Tab mehr — stattdessen der schon vorhandene app-weite „Interne KI nicht verbunden"-Dialog zum direkten Verbinden. Zusätzlich laufen Tagging und Anonymisierung fest auf der Standard-KI.

- Drop-Aufnahme prüft die interne KI vorab passiv (`kiVerbindungGeprueft`); getrennt → Verbinden-Dialog statt Auto-Tab, Anfrage bleibt „Noch nicht getaggt" ([AnfrageAufnahme.tsx](src/plugins/anfragen/AnfrageAufnahme.tsx)).
- Gleicher Guard an „(Erneut) taggen" und „Anonymisieren" ([AnfrageMetadatenStrip.tsx](src/plugins/anfragen/AnfrageMetadatenStrip.tsx), [AnonymisierungView.tsx](src/plugins/anfragen/AnonymisierungView.tsx)).
- Preflight-Ping der Runner passiv (`ping({ openIfNeeded: false })`) → reißt selbst ohne Guard nie mehr einen Tab auf ([metadaten.ts](src/plugins/anfragen/services/metadaten.ts), [anonymisierung.ts](src/plugins/anfragen/services/anonymisierung.ts)).
- Tagging + Anonymisierung fest auf die Standard-KI gepinnt (`ziel: 'standard'`), unabhängig von der globalen KI-Präferenz (nicht die agentische).

### v2.324.0 — Feedback: Zusatzfelder als optional markiert + Screenshot-Hinweis bei knapper Eingabe (Juli 2026)

MINOR — Beim Feedback-Formular wirkten für kleine Anfragen alle drei Textboxen verpflichtend, obwohl schon immer eine reicht (nur das mittlere Feld war nicht als optional erkennbar). Jetzt sind die Zusatzfelder klar als „(optional)" markiert; wer mit nur einer Box abschickt, wird zuvor auf die Screenshot-Option hingewiesen.

- Nicht-Pflichtfelder zeigen ein dezentes „(optional)" (aus `!required` abgeleitet); hartkodiertes „(optional)" aus dem Idee-Label entfernt ([FeedbackInputStep.tsx](src/components/feedback/FeedbackInputStep.tsx), [constants.ts](src/components/feedback/constants.ts)).
- Screenshot-Hinweis vor dem Senden: nur bei Mehrfeld-Typen mit einer gefüllten Box und ohne Anhang; erster Klick zeigt den Hinweis ([Screenshot hinzufügen]/[Trotzdem senden]), zweiter sendet ([FeedbackInputStep.tsx](src/components/feedback/FeedbackInputStep.tsx)).
- Paste-Fläche imperativ fokussierbar (`forwardRef`/`focus()`) für den „Screenshot hinzufügen"-Sprung ([FeedbackScreenshotInput.tsx](src/components/feedback/FeedbackScreenshotInput.tsx)).

### v2.323.0 — Unvollständige Anträge nicht klassifizieren (zurückhalten bis vollständig) (Juli 2026)

MINOR — Ein unvollständiger Antrag (fehlendes Sammel-Datum D_XTEC bei FuE/DS, D_ADV bei DL/NW) wurde bisher trotzdem klassifiziert, obwohl er danach weder freigegeben noch zugewiesen werden kann. Die Vollständigkeits-Schranke gatet jetzt auch die Klassifizierung — konsistent zur schon gesperrten Freigabe/Zuweisung.

- Zentral in [buildVerbundClassificationViews](src/plugins/auslastung/services/verbund/verbund-aggregation.ts): unvollständige Verbünde werden zurückgehalten — kein Live-Lauf, persistierter Vorschlag ausgeblendet (taucht wieder auf, sobald vollständig).
- LLM-Batch, „Prompt kopieren" und der „offen"-Zähler schließen sie aus; Leiste zeigt „· N warten auf Vollständigkeit" ([LLMKlassifizierungButtons.tsx](src/plugins/auslastung/components/LLMKlassifizierungButtons.tsx)).
- Filter-Chips: unvollständige nur noch unter „Unvollständig", nicht in „Review nötig"/„LLM-Vorschlag" ([KlassifizierungsReview.tsx](src/plugins/auslastung/views/KlassifizierungsReview.tsx)).
- Manuelle Pill-Vergabe gesperrt; Spalte „Vorgeschlagen" zeigt „⏳ wartet auf Vollständigkeit" ([verbund-columns.tsx](src/plugins/auslastung/views/verbund-columns.tsx)).
- Detail + Invarianten: [docs/architecture/auslastung.md](docs/architecture/auslastung.md).

### v2.322.0 — Status-System Phase 6: Home-Widget + Abschluss (Juli 2026)

MINOR — Letzte Phase: Home-Widget + projektweiter Abschluss (Guard, CLAUDE.md, Übersichts-Doku). Damit ist das Status-System (Katalog/Historie/Ableitung/Cockpit/Timeline/Widget) vollständig — gerätelokal, gated hinter `statusCockpit`.

- Home-Widget „Status & Verlauf": pro Verbund abgeleiteter Status + Konflikt-Icon + Mini-Verlauf + erster nächster Schritt; Default unsichtbar, flag-gated ([StatusVerlaufWidget.tsx](src/plugins/home/widgets/StatusVerlaufWidget.tsx)).
- Guard `status-system-local-only`: `src/core/status/` nie Share-/Snapshot-/Personal-Writer, Status-Stores nie in `SNAPSHOT_FILES` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)).
- CLAUDE.md: Decision-Tree-Zeile + Pitfall #40 (Katalog = Einzelquelle, getStatusCategory snapshot-basiert, gerätelokal, Event-Log append-only).
- Übersichts-Doku [docs/status-system/README.md](docs/status-system/README.md).

### v2.321.0 — Status-System Phase 5: Timeline + Detail-Status + Konflikt-Badge (Juli 2026)

MINOR — Historie + abgeleiteter Status werden sichtbar: die Verbund-Detailseite bekommt einen Status-Abschnitt (Timeline + „Warum"-Erklärung + nächste Schritte), die Fördertabelle ein Konflikt-Badge. Gated hinter `statusCockpit` (dev/pl/kurator), read-only, kein LLM.

- Horizontale Timeline (reines React/CSS, keine Lib): Verbund-/TV-Lanes (einklappbar), Meilenstein-Marker, Dichte-Cluster, Aufzeichnungsgrenze, ehrliche Tooltips (datumFachlich vs erfasstAm) ([StatusTimeline.tsx](src/plugins/antraege/status/StatusTimeline.tsx)).
- „Warum"-Panel (führender Wert, Beiträge + Grund, Konfliktdetails) — geteilt von Detail + Tabellen-Badge ([StatusWarum.tsx](src/plugins/antraege/status/StatusWarum.tsx)).
- `#status`-Abschnitt in [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx); Konflikt-Badge (nur Multi-TV-Verbund-Zeilen mit echtem Widerspruch) in [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx).
- Reine Timeline-Logik (Prominenz/Lanes/Cluster) + gerätelokale Anzeige-Präferenzen (IDB, kein localStorage) ([timeline.ts](src/core/status/timeline.ts)); Tests.

### v2.320.0 — Status-System Phase 4: Status-Cockpit (Juli 2026)

MINOR — Die Schichten 1–3 werden sichtbar: das Flag `statusCockpit` geht in dev/pl/kurator an (bis hier war alles dormant). Neues Vollbild-Cockpit zum Kuratieren, Simulieren und Versionieren des Status-Katalogs — gerätelokal, Team-Abgleich nur über JSON-Export/Import.

- Flag `statusCockpit` in dev/pl/kurator aktiviert; Plugin `status-cockpit` (Tools, `/status-cockpit`) registriert ([index.ts](src/plugins/status-cockpit/index.ts)).
- Tabs Katalog/Felder/Regeln mit Inline-Edit + Filter-Pills + Suche, Vorkommen + „zuletzt gesehen", Unkuratiert-Übernahme ([KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx)).
- Simulation (Phasenverteilung Aktiv→Entwurf, Konflikte, Verbund-Phasenwechsel-Diff) + Versionierung + JSON-Export/Import mit referenzieller Validierung.
- Reine Berechnungen (Vorkommen/Simulation/Diff, Edit-Transforms, Export-Import) in [src/core/status/](src/core/status/cockpit-berechnung.ts) mit Tests.
- Feedback-KI-Kontext-Doc ([status-cockpit.md](docs/feedback-kontext/status-cockpit.md)).

### v2.319.0 — Status-System Phase 3: Ableitungs-Engine (Juli 2026)

MINOR — Schicht 3: der Hauptstatus wird deterministisch aus dem Feld-Ensemble abgeleitet (höchster Phasenrang, robust gegen einzelne veraltete Felder), ein terminaler Wert schlägt den Rang, Widersprüche werden als Konflikt ausgewiesen statt stillschweigend aufgelöst. Rein, kein LLM; dormant hinter `statusCockpit`.

- `leiteStatusAb`: Beiträge (berücksichtigt + Grund fürs „Warum"), führender Wert, terminal, Konflikt + Details, nächste Schritte ([ableitung.ts](src/core/status/ableitung.ts)).
- Nächste-Schritte-Regeln (ist/istNicht/gefüllt/leer + datumVor/-Nach, verschachtelte alle/einige; Werkzeug-Verweis = reine Navigation) + kleine Default-Regelmenge im Seed ([seed.ts](src/core/status/seed.ts)).
- Konflikt-Schwelle = 2 Spine-Stufen (1 Stufe bewusst kein Konflikt); Ableitungs-Typen in [typen.ts](src/core/status/typen.ts).
- Tests: Max-Rang, Terminal-schlägt-Rang, Konflikt, unkuratiert, leerer Feldsatz, Regel-/Datumsauswertung (eingefrorene Uhr).
- Detail: [docs/status-system/KATALOG-V1.md](docs/status-system/KATALOG-V1.md).

### v2.318.0 — Status-System Phase 2: append-only Status-Historie (Juli 2026)

MINOR — Schicht 2: jede Statusfeld-Änderung erzeugt ein append-only StatusEvent — macht die vom Legacy-Export zerstörte Historie rekonstruierbar (Grundlage der Timeline). Gated hinter `statusCockpit`, hier noch dormant. Erfassung per idempotentem Post-Import-Reconcile statt Merge-Diff (greift nicht in den heißen Merge-Pfad ein).

- Append-only Store `status_event` (getStatusEvents/appendEvents, keine Update/Delete-API) + StatusEvent-Modell ([event-store.ts](src/core/status/event-store.ts), [event-typen.ts](src/core/status/event-typen.ts)).
- Idempotenter Reconcile (aktuelle Werte vs. letzter Event-Stand) mit Ebene-Routing verbund/tv + Initial-Backfill je Programm ([reconcile.ts](src/core/status/reconcile.ts), [feld-zugriff.ts](src/core/status/feld-zugriff.ts)).
- Reine Sortier-/Grenz-Logik (datumFachlich vor erfasstAm, „ab hier lückenlos") ([event-sort.ts](src/core/status/event-sort.ts)).
- Post-Import-Hook `nachImportStatusPflege` (Discovery + Reconcile) im importCsvSource-Abschluss ([importer.ts](src/core/services/csv/importer.ts)).
- Detail: [docs/status-system/HISTORIE.md](docs/status-system/HISTORIE.md).

### v2.317.0 — Status-System Phase 1: Status-Katalog + Snapshot (Juli 2026)

MINOR — Fundament des neuen Status-Systems: die bisher hartkodierte Status→Kategorie-Map wird zu kuratierbaren, versionierten Daten. Phase 1 legt Katalog + Snapshot-Anbindung; alles Weitere bleibt dormant hinter dem Flag `statusCockpit` (dev/pl/kurator, hier noch aus). Real-Verhalten unverändert.

- Neues Modul [src/core/status/](src/core/status/index.ts): Katalog-Typen, deterministischer Seed aus `CATEGORY_MAP`, versionierter Store + kv-Zeiger, In-Memory-Snapshot.
- `IDBStore` v11: dedizierte gerätelokale Stores `status_katalog` + `status_event` (kein Snapshot-/Share-Anteil) ([idb-store.ts](src/core/services/storage/idb-store.ts)).
- `getStatusCategory` liest snapshot-first mit byte-identischem `CATEGORY_MAP`-Fallback ([status-canonical.ts](src/core/utils/status-canonical.ts)); Byte-Identität per Test abgesichert.
- Flag `statusCockpit` (default false) gated die gesamte Schicht; Post-Import-Auto-Discovery sammelt unbekannte Statuswerte als `unkuratiert` ([import-integration.ts](src/core/status/import-integration.ts)).
- Doku [docs/status-system/](docs/status-system/BESTANDSAUFNAHME.md) (Bestandsaufnahme + Katalog-v1-Defaults).

### v2.316.1 — Schema-Recovery-Panel-Gate korrigiert (Juli 2026)

PATCH — Das v2.316.0-Recovery-Panel war in JEDEM Build unsichtbar: es hing an `import.meta.env.DEV`, das in einem `vite build` (auch `build:dev`) immer false ist. Jetzt an `isDevContext()` (variant==='development').

- Panel-Gate von `import.meta.env.DEV` auf `isDevContext()` umgestellt — rendert jetzt korrekt im dev-Build ([SchemaRecoverySection.tsx](src/plugins/csv-sources-kuration/SchemaRecoverySection.tsx)).

### v2.316.0 — CSV-Schema-Recovery-Panel (dev) (Juli 2026)

MINOR — Wenn ein leer publizierter Snapshot die CSV-Quellen eines Rechners gewischt hat (Anträge da, aber „0 Schemas" / ● CSV grau), gab es bisher nur „neu mappen" oder Manifest-Handchirurgie. Dieses dev-only Panel stellt die Schemas aus einer guten `csv_schemas.jsonl` wieder her — lokal und über den Share. Ergänzt den Empty-Guard aus v2.312.

- Neues dev-only „CSV-Schemas wiederherstellen"-Panel auf der CSV-Sources-Seite: Datei wählen → in lokale IDB schreiben → Snapshot neu schreiben ([SchemaRecoverySection.tsx](src/plugins/csv-sources-kuration/SchemaRecoverySection.tsx)).
- Reiner Parser sondert Fixture-IDs + fremde Programme aus (keine Re-Kontamination); Restore + Republish über den echten Publish-Pfad statt Manifest-Handchirurgie ([schemaRecovery.ts](src/plugins/csv-sources-kuration/services/schemaRecovery.ts)).
- Gesture-sicherer JSONL-Datei-Picker ([csv-file-picker.ts](src/plugins/csv-sources-kuration/csv-file-picker.ts)); Regressionstest für den Parser ([schemaRecovery.test.ts](src/plugins/csv-sources-kuration/__tests__/schemaRecovery.test.ts)).
- Detail: [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md).

### v2.315.0 — Widerspruch/Stellungnahme: tragende Gruende gegen die Stellungnahme abgleichen (Juli 2026)

MINOR — Nach einer Rücknahmeempfehlung oder Ablehnung antwortet der Antragsteller. Diese Ansicht stellt die tragenden Gründe des Bescheids Punkt für Punkt der Stellungnahme gegenüber und bereitet die Antwort in der Werkbank vor. Schließt den Artefakt-Werkbank-Umbau ab. Nur dev.

- Neue Widerspruchs-/Stellungnahme-Sektion am Verbund-Detail, sichtbar sobald ein RNE/ABL-Bescheid existiert ([WiderspruchSection.tsx](src/plugins/antraege/widerspruch/WiderspruchSection.tsx)).
- Je tragendem Grund drei Zustände (ausgeräumt/teilweise/nicht ausgeräumt) + Notiz — die Bewertung trifft immer der Mensch ([widerspruch.ts](src/plugins/antraege/widerspruch/widerspruch.ts)).
- Die Gründe stammen aus der Provenienz des Bescheid-Laufs; die Stellungnahme wird über die normale Dokument-Mechanik zugeordnet ([useWiderspruch.ts](src/plugins/antraege/widerspruch/useWiderspruch.ts)).
- „Antwort in der Werkbank vorbereiten" öffnet die Werkbank mit den offenen Gründen vorangekreuzt ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)).
- Detail: [artefakt-engine.md](docs/architecture/artefakt-engine.md).

### v2.314.0 — RNE + ABL: Bescheid-Entwuerfe in der Werkbank mit strengem Freigabe-Tor (Juli 2026)

MINOR — Die Werkbank kann jetzt neben Nachforderungen auch Rücknahmeempfehlungen und Ablehnungen entwerfen — dieselbe Maschine, dieselben Textbausteine, aber ein strengeres Freigabe-Tor, weil ein Bescheid eine Rechtsfolge trägt. Nur dev; die Bausteine dafür legen Kuratoren im Katalog an.

- RNE/ABL-Füll-Skills + Workflows als Draft-Seeds (aktiv:false, freigabe:entwurf) — gegebene Bausteine wortgetreu, nur Platzhalter füllen ([bescheid-skill.seed.ts](src/core/services/skills/registry/bescheid-skill.seed.ts)).
- Der Artefakt-Schalter der Werkbank aktiviert RNE/ABL; die Generierung läuft über die bestehende NF-Maschine, je Typ mit eigenem Skill/Vorlage/Anker ([artefakt-typ.ts](src/plugins/antraege/nachforderungen/artefakt-typ.ts)).
- Strengeres Freigabe-Tor: unzugeordnete Punkte blockieren die Generierung, Konsistenz-Warnungen gegen die MAP-Fachbewertung sind einzeln zu quittieren, und der DOCX-Export braucht eine Pflicht-Freigabe ([bescheid-freigabe.ts](src/plugins/antraege/nachforderungen/bescheid-freigabe.ts)).
- Fehlt eine MAP-Bewertung, sagt der Tor das ehrlich („Konsistenz übersprungen"), statt still nichts zu prüfen ([map-bewertung.ts](src/plugins/antraege/werkbank/map-bewertung.ts)).
- Detail: [artefakt-engine.md](docs/architecture/artefakt-engine.md).

### v2.313.0 — Versionierte Backup-Historie der kleinen Struktur-Stores auf dem Share (Juli 2026)

MINOR — Defense-in-depth zum Empty-Guard (v2.312): falls eine kleine Struktur-Store-Datei doch mal defekt/leer/gelöscht wird (Teil-Write, Fremd-Eingriff), liegt der letzte gute Stand griffbereit statt „weg". Nur die kleinen Stores — antraege (421 MB) bleibt außen vor.

- Jeder Publish sichert `csv_schemas`/`programme`/`unterprogramme`/`verbuende`/`akronym_index` versioniert unter `<snapshot>/backups/<store>.<version>.jsonl` ([snapshot.ts](src/core/services/csv/snapshot.ts)).
- Nur nicht-leerer + gegenüber der jüngsten Sicherung geänderter Inhalt wird gesichert (ein defekter Write wird nie die jüngste Sicherung; keine Duplikate).
- Es werden die letzten `SMALL_STORE_BACKUP_KEEP` (5) distinkten Fassungen je Store gehalten, ältere werden gekappt.
- Best-effort: Backup-Fehler blockieren den Publish nie (der eigentliche Snapshot steht schon).
- Regressionstests (anlegen / Dedup / Prune) ([snapshot-empty-guard.test.ts](src/core/services/csv/__tests__/snapshot-empty-guard.test.ts)).

### v2.312.0 — CSV-Schemas beim Sync nicht mehr verlieren (Empty-Guard) + aussagekraeftige Ampel + Kurator-Autorefresh (Juli 2026)

MINOR — Ein leer publiziertes `csv_schemas` (Fixture-/Fehl-Publish, Vorfall-2026-06-Klasse) hat beim Snapshot-Sync die lokalen CSV-Quellen JEDES Consumers auf 0 gewischt — still, ohne Reconnect-Prompt (● CSV grau „unbekannt"). Zwei Guards stoppen den Datenverlust an beiden Enden; die Ampel sagt jetzt konkret, was fehlt.

- Consumer-Guard: ein leerer Remote-Struktur-Store (`csv_schemas`/`programme`) wischt den nicht-leeren lokalen Stand nicht mehr ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts)).
- Publish-Guard: ein leeres `csv_schemas` überschreibt keinen nicht-leeren Bestand auf dem Share mehr ([snapshot.ts](src/core/services/csv/snapshot.ts)).
- ● CSV-Ampel: statt grau „unbekannt" jetzt „Keine CSV-Quellen" / „CSV-Ordner verknüpfen" (mit Aktion) / „offline" ([CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx), [csv-freshness-state.ts](src/plugins/csv-sources-kuration/services/csv-freshness-state.ts)).
- Kurator-Build importiert die täglichen CSV-Exporte jetzt ebenfalls automatisch (`csvAutoRefresh: true`) ([kurator.config.json](configs/kurator.config.json)).
- Regressionstests für beide Guards ([snapshot-empty-guard.test.ts](src/core/services/csv/__tests__/snapshot-empty-guard.test.ts)).

### v2.311.0 — Artefakt-Werkbank am Verbund-Detail (Punkte, Baustein-Auswahl, Entwurf) (Juli 2026)

MINOR — Der bisherige Nachforderungs-Testballon ließ das LLM frei aus dem ganzen Katalog wählen. Die Werkbank dreht das um: der Prüfer benennt zuerst die offenen Punkte, bestätigt passende Bausteine und lässt dann nur noch die Platzhalter füllen. Ein Workspace in vier Schritten. Nur dev.

- Neue „Artefakt-Werkbank" am Verbund-Detail (Flag `artefaktWerkbank`) ersetzt die Nachforderungen-Sektion: Punkte erfassen → ankreuzen → Bausteine bestätigen → Entwurf ([WerkbankSection.tsx](src/plugins/antraege/werkbank/WerkbankSection.tsx)).
- Offene Punkte werden nach Prüfaspekt gruppiert und rein lokal gespeichert; Baustein-Vorschläge zeigen, warum sie angeschlagen haben ([bausteinAuswahl.ts](src/plugins/antraege/werkbank/bausteinAuswahl.ts)).
- Die Generierung läuft über die bestehende NF-Maschine — kein zweiter Pfad; der Lauf stempelt die adressierten Punkte + Baustein-Fassungen ([useNachforderungen.ts](src/plugins/antraege/nachforderungen/useNachforderungen.ts)).
- Der Prüfaspekt-Katalog wurde in ein abhängigkeitsfreies Modul gelöst, damit ihn Werkbank & Co. ohne den ganzen Aufbereitungs-Stack nutzen ([aspekt-katalog.ts](src/plugins/antraege/aufbereitung/aspekt-katalog.ts)).
- Detail: [artefakt-engine.md](docs/architecture/artefakt-engine.md).

### v2.310.0 — Textbaustein-Verwaltung + Word-Import (Juli 2026)

MINOR — Aufbauend auf dem Katalog-Datenmodell (v2.309): die Nachforderungs-Textbausteine lassen sich jetzt in der App pflegen, statt nur im Code zu leben. Neuer Reiter in der Skill-Verwaltung, mit Word-Import als Einfuhrweg.

- Reiter „Textbausteine" in der Skill-Verwaltung (dev/pl/kurator): Liste mit Filtern, Editor, Freigeben/Stilllegen, Versions-Historie mit Rollback ([TextbausteineTab.tsx](src/plugins/skill-verwaltung-kuration/TextbausteineTab.tsx)).
- „Aus Word importieren" liest eine .docx ein und legt je Textblock einen Baustein-Entwurf an; der Wortlaut bleibt unverändert ([TextbausteinImportDialog.tsx](src/plugins/skill-verwaltung-kuration/TextbausteinImportDialog.tsx)).
- Neue Bausteine und Importe starten als Entwurf; Freigabe erfolgt einzeln und mit Begründung ([versionierung.ts](src/core/services/skills/textbausteine/versionierung.ts)).
- Der Katalog wird erst beim ersten Speichern auf den Share geschrieben — bis dahin arbeitet jeder mit dem gemeinsamen Seed-Stand.
- Detail: [textbaustein-katalog.md](docs/architecture/textbaustein-katalog.md).

### v2.309.0 — Textbaustein-Katalog: NF-Bausteine werden versionierte, freigebbare App-Daten (Juli 2026)

MINOR — Die 78 NF-Bausteine waren hartkodierter Code — pflegbar nur durch einen Entwickler. Fundament, um sie (und später RNE/ABL) in der App zu pflegen: versioniert, freigebbar, per Word-Import befüllbar. Diese Phase legt das Datenmodell, die Phasen 3+ bauen die Verwaltung darauf.

- Neuer Katalog-Service mit eigener Sidecar `_intern/skills/textbausteine.json` (Storage-Profil der Skill-Registry, `kv`-Cache) ([textbausteine/](src/core/services/skills/textbausteine/)).
- Fassungen + Freigabe-Status wie bei Skills (Historie newest-first, Rollback als neue Version, kein Löschen) ([versionierung.ts](src/core/services/skills/textbausteine/versionierung.ts)).
- Lazy-Migration übernimmt die 78 Seed-Bausteine als freigegebene Version 1, idempotent und nie überschreibend ([migration.ts](src/core/services/skills/textbausteine/migration.ts)).
- Der Suchkern ist jetzt geteilt; der MAP-Abschluss nutzt ihn, Verhalten unverändert ([nf-suche.ts](src/plugins/map-foerderfaehig/abschluss/nf-suche.ts)).
- Erzeugte NF-Läufe stempeln den Katalog-Stand + verwendete Baustein-Fassungen (`katalogRef`) ([textbaustein-katalog.md](docs/architecture/textbaustein-katalog.md)).

### v2.308.0 — Fragen + Abdeckung pausiert, Zeitplan an die Einreichungs-JSON gehaengt (Juli 2026)

MINOR — Fragen-Ableitung und Aspekt-Abdeckung tragen in der Praxis noch nicht, standen aber weiter nutzbar in der Tab-Leiste. Der Zeitplan war umgekehrt pausiert, obwohl es eine belastbare Quelle gibt: die Einreichungs-JSON.

- Fragen- und Abdeckungs-Tab sind gesperrt mit Begründung; Code, Caches und gesetzte offene Punkte bleiben unangetastet ([pausierte-module.ts](src/plugins/antraege/aufbereitung/pausierte-module.ts)).
- Der Zeitplan öffnet sich wieder, sobald zum Vorgang eine MAP-Einreichung derselben Vorhabensbeschreibung zugeordnet ist ([tab-gating.ts](src/plugins/antraege/aufbereitung/tab-gating.ts)).
- Der Bezug entsteht rückwärts über die zugeordnete VB-Datei — eine Einreichung trägt kein Aktenzeichen ([map-verknuepfung.ts](src/plugins/antraege/aufbereitung/map-verknuepfung.ts)).
- Im geöffneten Zeitplan stehen ausschließlich die Arbeitspakete aus der JSON, nie die der pausierten PDF-Ernte ([EinreichungsPlan.tsx](src/plugins/antraege/aufbereitung/EinreichungsPlan.tsx)).
- Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

### v2.307.0 — Ergebnis zurückbringen: Dateien ziehen, auch Markdown (Juli 2026)

MINOR — ChatGPT Deep Research lädt den Report inzwischen auch als `.md` herunter — der Dialog nahm nur PDF und Word. Und der Abschnitt war die einzige Aufnahme-Fläche der App ohne Drag & Drop.

- „Ergebnis zurückbringen" hat eine Ablage-Fläche (ziehen ODER klicken) für PDF, Word, Markdown und Text ([RechercheTab.tsx](src/plugins/antraege/aufbereitung/RechercheTab.tsx)); der Inline-Link „PDF/Word hochladen" entfällt.
- Mehrere Dateien auf einmal ergeben je einen Import, mit Zähler und in EINEM Schreibvorgang ([useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts)).
- Gezogene Dateien werden auf ihre Endung geprüft, weil `accept` nur den Datei-Dialog filtert ([recherche-import.ts](src/plugins/antraege/aufbereitung/recherche-import.ts)).
- Nicht gelesene Dateien werden benannt, nachdem die geglückten Importe stehen — und ein gescheitertes „Text übernehmen" verwirft den eingefügten Report nicht mehr.
- Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

### v2.306.1 — Fünf tote `@deprecated`-Aliase abgelöst (Juli 2026)

PATCH — Kandidat 4 aus dem Konsolidierungs-Pass: von 29 `@deprecated`-Markern waren fünf reine Namens-Aliase ohne Daten-Bezug. Die übrigen 24 sind Lese-Rückfälle für Bestandsdaten und bleiben, bis eine Migration sie ablöst.

- Die Handle-Aliase `getSmbHandle` / `clearSmbHandle` / `pickAndStoreParentHandle` sind an 16 Dateien durch die kanonischen Namen ersetzt und entfernt ([smb-handle.ts](src/core/services/infrastructure/smb-handle.ts)).
- Der Re-Export-Shim `RegistryViewModeToggle` entfällt; die Skill-Verwaltung importiert direkt ([ViewModeToggle.tsx](src/components/ui/ViewModeToggle.tsx)).
- `getActiveProgramm` entfernt — außerhalb des Barrels ohne Aufrufer ([programmRegistry.ts](src/core/services/csv/programmRegistry.ts)).

### v2.306.0 — Gutachten-Hook: drei Nebenzustände bekommen eine Überschrift (Juli 2026)

MINOR — Kandidat 5 aus dem Konsolidierungs-Pass: der Gutachten-Hook trug neben der Ablauf-Steuerung drei Zustände, die je einen eigenen Auslöser und eine eigene Lebensdauer haben.

- Geltende Workflow-Definition, KI-Erreichbarkeit und persönlicher Skill-Tweak liegen jetzt als je ein kleiner Hook daneben ([workflow-hooks.ts](src/plugins/antraege/gutachten/workflow-hooks.ts)).
- Der Hook schrumpft von 674 auf 603 Zeilen; sein nach außen sichtbares Ergebnis (`GutachtenWorkflowController`) ist unverändert ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)).

### v2.305.4 — Drei Relativzeit-Formatierer stehen nebeneinander statt verstreut (Juli 2026)

PATCH — Kandidat 2 aus dem Konsolidierungs-Pass: drei unabhängige Implementierungen relativer Zeitangaben, jede mit eigener Behandlung kaputter Zeitstempel und ohne Kenntnis der anderen.

- Rechnung und die drei Sprachregister liegen jetzt in einer Datei; die Wortwahl bleibt bewusst verschieden und ist als solche dokumentiert ([relativeZeit.ts](src/core/utils/relativeZeit.ts)).
- Abgelöst in Feedback-Listen, Home-„Weitermachen" und der Dokument-Review-Liste ([feedbackUi.ts](src/components/feedback/feedbackUi.ts), [arbeitskontext-anzeige.ts](src/plugins/home/arbeitskontext-anzeige.ts), [PendingList.tsx](src/plugins/dokument-review/components/PendingList.tsx)).
- 30 Fälle schreiben die heutige Ausgabe aller drei Register fest ([relativeZeit.test.ts](src/core/utils/__tests__/relativeZeit.test.ts)); der Feedback-Weg zeigt bei kaputtem Zeitstempel nicht mehr „Invalid Date".

### v2.305.3 — Gescheitertes Kopieren sieht nicht mehr aus wie gelungenes (Juli 2026)

PATCH — Neun Kopier-Knöpfe bauten denselben Dreiklang aus Kopieren, Häkchen und 1500-ms-Rücksetzer je selbst nach — und entschieden jeder für sich, ob ein Fehlschlag sichtbar wird. Wer ihn nicht bemerkt, fügt den alten Inhalt der Zwischenablage ein (die Falle aus v2.301.3).

- Neuer Helfer `useKopierAktion` trägt den Kopier-Zustand samt fertig ausformuliertem Fehlergrund ([useKopierAktion.ts](src/core/hooks/useKopierAktion.ts)).
- Acht Knöpfe zeigen im Fehlerfall jetzt ein Warnzeichen statt eines Häkchens — Teilvorhaben-Titel, Chat, Gutachten-Abschnitt, Feedback-Prompt, Recherche (2×) und die beiden Eval-Panels.
- Der Fragen-Tab und der Zwischenablage-Export der Suche nennen den Grund statt nur „Fehler" ([FragenTab.tsx](src/plugins/antraege/aufbereitung/FragenTab.tsx), [SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx)).

### v2.305.2 — Blatt-Schicht kennt keine Plugin-Liste mehr (Juli 2026)

PATCH — Erster Kandidat aus dem Konsolidierungs-Pass: das Feedback-Panel lud für einen einzigen Anzeigenamen die gesamte Plugin-Liste. Das war die Wurzel aller vier in v2.302.4 aufgelösten Zyklen — behoben waren bisher nur die Folgekanten.

- Der Name des aktiven Bereichs kommt jetzt aus der Navigation statt aus der Plugin-Konfiguration ([useNavigation.ts](src/core/hooks/useNavigation.ts), [Router.tsx](src/core/Router.tsx), [FeedbackPanel.tsx](src/components/feedback/FeedbackPanel.tsx)).
- Neuer Wächter `no-plugins-config-in-components`: die geteilte Komponenten-Schicht importiert die Plugin-Konfiguration nicht mehr ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)).

### v2.305.1 — Scan-Helfer ausgelagert, toten Code kuratiert abgebaut (Juli 2026)

PATCH — Abschluss des Konsolidierungs-Passes. Die Guard-Datei wuchs mit jeder neuen Konvention zugleich in ihrer Infrastruktur; und aus der MVP-Zeit lagen zwei komplette Bausteine im Baum, die nie an die App angeschlossen wurden.

- Datei-Suche und Fund-Formatierung der Konventions-Prüfungen liegen jetzt daneben; die Regeln selbst bleiben vollständig in einer Datei ([conventions-lib.ts](src/__tests__/conventions-lib.ts), Guard-Datei 1665 → 1566 Zeilen).
- Peer-Review-Panel und Versionshistorie samt ihrer Dienste und Typen entfernt — Stand März 2026, ohne einen einzigen Nutzer im Code (7 Dateien, zwei Dienst-Verzeichnisse).
- Vier Konstanten für Datei-Pfade aus der Zeit vor v1.9 entfernt, die niemand mehr las ([feedback.ts](src/core/types/feedback.ts), [constants.ts](src/core/services/csv/constants.ts)).
- Die Drift-Schwellen für Dateigröße und Dienst-Verzeichnisse auf den neuen Ist-Stand gesenkt statt sie stehen zu lassen.

### v2.305.0 — Workflow-Hook in seine Verantwortungen zerlegt (Juli 2026)

MINOR — Der Gutachten-Workflow-Hook mischte auf 870 Zeilen vier Aufgaben: Registry laden, persistieren, generieren und die Schritt-Aktionen. Der Generierungsteil war der größte und brauchte als einziger kein React. Keine Verhaltensänderung, die Oberfläche für die Oberfläche bleibt unverändert.

- Generierung, KI-Qualitätscheck und Feinschliff liegen jetzt React-frei nebenan, mit ausdrücklich übergebenen Abhängigkeiten statt stiller Zugriffe ([workflow-generierung.ts](src/plugins/antraege/gutachten/workflow-generierung.ts)).
- Speichern und die Hülle für Zustandswechsel sind eine eigene Schicht; die Regel „ein Zustandswechsel, ein Schreibvorgang" steht jetzt an einer Stelle statt in jeder Aktion ([workflow-persistenz.ts](src/plugins/antraege/gutachten/workflow-persistenz.ts), 7 neue Tests).
- Der Hook schrumpft von 870 auf 674 Zeilen und ist nur noch Bindung: laufend/abbrechen/Fehlerbanner ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)).
- `GutachtenWorkflowController` ist unverändert; `GutachtenSection` und alle weiteren Konsumenten wurden nicht angefasst, alle 23 Gutachten-Testdateien bleiben grün.

### v2.304.0 — Seed-Split abgeschlossen, seed.ts ist nur noch die Sammelstelle (Juli 2026)

MINOR — 14 Skills lagen schon in eigenen Dateien, vier Gruppen noch inline in `seed.ts` (868 Zeilen, die mit jedem Skill weiterwuchsen). Reine Verschiebung: die Skills liegen live auf dem geteilten Share, jede inhaltliche Änderung wäre sofort produktiv wirksam.

- Kurzfassung, die vier Abschnitts-Skills B–G, QS-Basis und Relevanz-Map haben eigene Dateien ([gutachten-kurzfassung.seed.ts](src/core/services/skills/registry/gutachten-kurzfassung.seed.ts), [gutachten-bg.seed.ts](src/core/services/skills/registry/gutachten-bg.seed.ts), [qs-basis.seed.ts](src/core/services/skills/registry/qs-basis.seed.ts), [relevanz-map.seed.ts](src/core/services/skills/registry/relevanz-map.seed.ts)).
- Geteilte Template-Hülle und Zeitstempel liegen in [ga-seed-basis.ts](src/core/services/skills/registry/ga-seed-basis.ts) — sonst wäre es eine Kopie oder ein Ringschluss geworden.
- [seed.ts](src/core/services/skills/registry/seed.ts) ist von 868 auf 110 Zeilen geschrumpft und nur noch Sammelstelle; kein einziger Importpfad eines Konsumenten hat sich geändert.
- Byte-Identität des gesamten Seed-Bestands (Skills, Prompts, Regeln, Workflows) gegen den Vor-Split-Stand nachgewiesen; alle 28 Skill-Testdateien unverändert grün.

### v2.303.0 — Baustein-Zustand als eine Karte statt zwoelf Staende (Juli 2026)

MINOR — Der Aufbereitungs-Hook hielt je KI-Baustein zwei getrennte Zustände, macht zwölf insgesamt. Jede Änderung musste sechs bis zwölf Stellen synchron treffen — es genügte, eine zu vergessen, und genau daran hingen mehrere Fixes der letzten Releases. Keine Verhaltensänderung, die Oberfläche des Hooks bleibt unverändert.

- Ein Katalog beschreibt die sechs Bausteine einmal (Skill, Cache-Key, Lauf, Reihenfolge); Hook, Rehydrierung und Cache-Löschung ziehen sich ihre Arbeit daraus ([baustein-katalog.ts](src/plugins/antraege/aufbereitung/baustein-katalog.ts)).
- Zwölf `useState` im Hook wurden einer; die Zustands-Übergänge liegen jetzt hook-frei und einzeln geprüft daneben ([baustein-zustand.ts](src/plugins/antraege/aufbereitung/baustein-zustand.ts), 17 neue Tests).
- „Neu aufbereiten" und der Kontext-Wechsel erfassen nachweislich jeden Baustein statt sechs aufgezählter — ein neuer Baustein ist ab jetzt ein Tabellen-Eintrag ([useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts)).
- `UseAufbereitungResult` ist unverändert; kein Tab und kein anderer Konsument wurde angefasst.

### v2.302.5 — eine Zwischenablage fuer alle, Kopier-Fehler werden sichtbar (Juli 2026)

PATCH — Der v2.301.3-Fix („erst kopieren, dann öffnen") schuf einen gehärteten Kopier-Helfer, ließ ihn aber im Aufbereitung-Modul liegen. Die übrigen 26 Kopier-Stellen trugen dieselbe Race weiter, und etliche verschluckten den Fehler still — der Knopf sah aus wie erledigt, in der Zwischenablage lag der alte Inhalt.

- Ein Kopier-Weg für die ganze App: `kopiereText` liegt jetzt im Core und fährt überall den Rückfall ([kopieren.ts](src/core/utils/kopieren.ts)); alle 16 Aufrufer-Dateien umgestellt.
- Gescheitertes Kopieren wird sichtbar statt still verschluckt — u.a. beim Pfad im Startbildschirm, beim Feedback-Prompt und bei den Zugangspasswörtern, die nur EINMAL anzeigbar sind ([PasswortAnzeigeDialog.tsx](src/plugins/auslastung/components/PasswortAnzeigeDialog.tsx)).
- „Kopieren & ZIM FAQ-Assistent öffnen" kopiert jetzt nachweislich, bevor der Tab aufgeht — vorher konnte der Assistent eine fremde Anfrage aus der Zwischenablage bekommen ([AnonymisierungView.tsx](src/plugins/anfragen/AnonymisierungView.tsx)).
- Neuer Guard `no-raw-clipboard` hält den Weg eindeutig; eine begründete Ausnahme bleibt (Rich-Text nach Outlook, [clipboard.ts](src/plugins/anfragen/services/clipboard.ts)).

### v2.302.4 — Laufzeit-Import-Zyklen aufgeloest, tote Bruecke entfernt (Juli 2026)

PATCH — Erster Schritt eines Konsolidierungs-Passes: keine Verhaltensänderung, nur Struktur. Vier Module zogen ein Symbol aus einem Sammel-Import, der nebenbei die ganze Plugin-Liste mitlud — und die führt zu jedem Modul zurück. Solche Ringe sind zur Laufzeit fragil und führen beim Lesen des Codes in die Irre.

- Vier Laufzeit-Importzyklen aufgelöst, jeweils per Direktimport aufs Quellmodul ([OnlineTab.tsx](src/plugins/einstellungen/OnlineTab.tsx), [FeedbackKanbanWidget.tsx](src/plugins/home/widgets/FeedbackKanbanWidget.tsx), [WidgetConfigForm.tsx](src/plugins/home/widgets/WidgetConfigForm.tsx), [FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)).
- Auslastungs-Store hängt nicht mehr am `onboarding`-Sammel-Import, der ihn selbst zurück-importierte ([useAuslastungData.ts](src/plugins/auslastung/hooks/useAuslastungData.ts)).
- `plugins/home/naechsterSchritt.ts` gelöscht — Weiterleitung ohne Nutzer; die Handlungs-Formel lebt in [core/utils/naechsterSchritt.ts](src/core/utils/naechsterSchritt.ts).
- Neuer Wächter `npm run cycles` (in `npm run check`, abhängigkeitsfrei): findet Laufzeit-Zyklen; Allowlist ist leer und soll es bleiben ([check-cycles.mjs](scripts/check-cycles.mjs)).

### v2.302.3 — Aufbereitung: echter Verbindungs-Check vor dem Lauf, ehrliche Fehlerseiten (Juli 2026)

PATCH — Gemeldet: KI getrennt, Knopf klickbar, danach „Fehler" an allen sechs Abschnitten — und kein Verbinden-Dialog. Der Preflight fragte nicht die Bridge, sondern nur, ob irgendein KI-Tab offen ist (`hasLiveBridgeWindow`). Ein Tab ohne aktives Lesezeichen bestand diese Prüfung, antwortete aber nie.

- Preflight pingt die Bridge wirklich (passiv, max. 5 s, öffnet keinen Tab) statt ein offenes Fenster für eine Verbindung zu halten ([ki-guard.ts](src/core/services/ai/ki-guard.ts), `kiVerbindungGeprueft`).
- Der Check läuft auf dem Transport, der den Lauf **fährt**: ein externer Provider bricht jetzt einmal am Knopf ab statt sechsmal im Stepper ([useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts)).
- Kein „Tab öffnen"-Link mehr an gescheiterten Abschnitten — dort steht kein Ergebnis, nur dieselbe Wiederholen-Seite ([uebersicht.ts](src/plugins/antraege/aufbereitung/uebersicht.ts), `zeigtTabLink`).
- Sechs Kopien der Fehlerseite zu einer zusammengezogen, die den echten Grund zeigt statt fest „Der interne KI-Dienst ist nicht erreichbar" zu behaupten ([BausteinFehler.tsx](src/plugins/antraege/aufbereitung/BausteinFehler.tsx)).

### v2.302.2 — Aufbereitung: KI-Verbindung steht vor dem Klick da, Fehler nennen ihren Grund (Juli 2026)

PATCH — Nachtrag zu v2.302.1, aus der Rückfrage „der Knopf dürfte doch gar nicht klickbar sein, wenn die interne KI nicht verbunden ist". Der Verbindungszustand stand bisher nur am Sidebar-Punkt; die Seite selbst schwieg bis zum Klick. Der Knopf bleibt bewusst klickbar — der Klick ist der Weg zum Verbinden —, sagt seinen Zustand aber jetzt vorher an.

- Das Cockpit zeigt „● Interne KI ist getrennt / noch nicht verbunden — der Klick bietet zuerst das Verbinden an" ([uebersicht.ts](src/plugins/antraege/aufbereitung/uebersicht.ts), rein + getestet).
- Der Hinweis erscheint nur, wenn der Lauf überhaupt über die Bridge geht; bei einem anderen Provider ist ihr Zustand belanglos.
- Ein gescheiterter KI-Abschnitt nennt seinen Grund im Stepper statt nur „Fehler" — u.a. die DSGVO-Transport-Policy „aktiver Provider ist extern" ([useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts)).
- Ein in der Build-Variante gesperrter Abschnitt sagt das ebenfalls, statt als namenloser Fehler zu erscheinen.

### v2.302.1 — Aufbereitung: die Knoepfe sagen, wenn der Antrag noch nicht geladen ist (Juli 2026)

PATCH — „Mit KI aufbereiten" tat nichts: kein Ladezustand, keine Meldung, und ein Reload heilte es. Beide Kopf-Aktionen brechen ohne aufgelösten Antrag wortlos ab (`if (!ctx) return`), und aufgelöst wurde er genau einmal pro Route — lief dieser Leseversuch ins Leere (Start-Sync noch nicht durch, Datenaktualisierung mittendrin), blieb die Seite dauerhaft ohne Kontext. Bug-Klasse 1, sichtbar als toter Knopf statt als Fehler.

- Die Aufbereitungs-Seite kennt drei Zustände (bereit / lädt / nicht auflösbar) und zeigt ohne Antrag einen Hinweis + „Erneut versuchen" statt Knöpfe, die ins Leere klicken ([kontext-zustand.ts](src/plugins/antraege/aufbereitung/kontext-zustand.ts), [AufbereitungPage.tsx](src/plugins/antraege/aufbereitung/AufbereitungPage.tsx)).
- `useVerbundDetailData` löst erneut auf, sobald der Antrags-Store nachlädt, und meldet `laedt` — der Zustand heilt sich ohne Reload ([useVerbundDetailData.ts](src/plugins/antraege/useVerbundDetailData.ts)).
- Fehler aus „Neu aufbereiten" / „KI-Bausteine neu berechnen" stehen unter dem Seitenkopf; bisher hatten sie nur im pausierten Zeitplan-Tab einen Anzeigeort.
- Ohne Kontext werfen die drei Aktionen jetzt eine lesbare Meldung, statt still zurückzukehren ([useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts), Pitfall #15).
- Die Verbund-Detailseite behauptet „nicht gefunden" erst nach abgeschlossener Auflösung ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)).

### v2.302.0 — Filter-Zaehler zeigen die Zeilenzahl, Uebernahme-Wuensche ohne Geister-Eintraege (Juli 2026)

MINOR — Zwei Meldungen aus dem Auslastungs-Modul, beide „die Zahl passt nicht zu dem, was ich sehe": die Filter-Pillen zählten über den gesamten Pool statt über die gefilterte Ansicht (Kategorie 30 + Antragstyp 16 → Liste zeigt 9), und das Einsammeln meldete „14 neu" bei Pille `Übernahme-Wunsch 0`. Ursache im zweiten Fall: der Merge legte `selbst`-Records für Anträge an, die die Zuweisungs-Liste gar nicht führt — unsichtbar, mit Phantom-Stunden, und beim nächsten Sessionstart vom Reconciler weggeräumt (also ewig wieder „neu").

- Filter-Pillen beider Auslastungs-Tabs zählen facettiert: die Zahl an einer Pille ist die Zeilenzahl nach dem Klick ([facetCounts.ts](src/plugins/auslastung/views/facetCounts.ts), Invarianten-Test über alle Filter-Kombinationen).
- Filterung und Zählung teilen dieselben Bucket-Funktionen ([cockpit-helpers.ts](src/plugins/auslastung/views/cockpit-helpers.ts), `viewFilterBucketsOf` in [KlassifizierungsReview.tsx](src/plugins/auslastung/views/KlassifizierungsReview.tsx)); „Hohe Confidences freigeben" nennt die Zahl, die die Aktion auch freigibt.
- Die Pille „Übernahme-Wunsch" zählt auch noch nicht eingesammelte Vormerkungen — dieselbe Definition wie das `⚑ N vorgemerkt` der Zeile.
- Wünsche auf Anträge außerhalb der Liste werden nicht mehr angelegt, sondern als „nicht mehr zuweisbar" mit Grund ausgewiesen ([uebernahme-einsammeln.ts](src/plugins/auslastung/services/onboarding/uebernahme-einsammeln.ts)).
- `reconcileZuweisungen` kollabiert eine Verbund-Gruppe nur noch bei vorhandener Freigabe — mehrere Interessenten überleben den App-Neustart (Pitfall #26, [useAuslastungData.ts](src/plugins/auslastung/hooks/useAuslastungData.ts)).

### v2.301.3 — Erst kopieren, dann den externen Dienst oeffnen (Juli 2026)

PATCH — „Kopieren & ChatGPT öffnen" hing am Anker-Klick: die Navigation lief im selben Tick wie das Kopieren, und der Fokuswechsel ließ Chrome den Kopier-Aufruf ablehnen. Der Fehler wurde nirgends angezeigt, die Zwischenablage behielt still ihren alten Inhalt — im Chat landete ein Auftrag aus einer früheren Fassung.

- Erst kopieren, dann den Dienst öffnen; scheitert das Kopieren, wird der Dienst nicht geöffnet ([RechercheTab.tsx](src/plugins/antraege/aufbereitung/RechercheTab.tsx)).
- Neuer `kopiereText`-Helfer mit `execCommand`-Rückfall, der bei Misserfolg wirft statt still zu scheitern ([kopieren.ts](src/plugins/antraege/aufbereitung/kopieren.ts)).
- Der Knopf zeigt „kopiert" bzw. den Fehler an und entwertet die Bestätigung, sobald sich der Auftragstext ändert.

### v2.301.2 — KI-Knopf sagt, was er startet (Juli 2026)

PATCH — Stand ein einzelner KI-Abschnitt auf „ausstehend" (etwa der Recherche-Auftrag nach dem Cache-Key-Bump aus v2.301), griff man zu „Neu aufbereiten" — und der Knopf wirkte kaputt: er rechnet nur den deterministischen Teil und startet keinen KI-Abschnitt. Was fehlte, war nicht die Funktion, sondern die Beschriftung.

- Der KI-Knopf beschriftet sich aus dem Zustand: „Fehlende KI-Abschnitte starten (N)", wenn nur einzelne fehlen ([uebersicht.ts](src/plugins/antraege/aufbereitung/uebersicht.ts)).
- Inline-Hinweis im Cockpit: fertige Abschnitte kommen aus dem Zwischenspeicher, „Neu aufbereiten" startet keine KI ([UebersichtTab.tsx](src/plugins/antraege/aufbereitung/UebersichtTab.tsx)).
- Der deterministische Knopf heißt jetzt „Neu aufbereiten (ohne KI)"; beide Kopfleisten (Seite + Cockpit) nutzen dieselbe Quelle ([AufbereitungPage.tsx](src/plugins/antraege/aufbereitung/AufbereitungPage.tsx)).

### v2.301.1 — Externe Recherche-Importe ueberleben Neu aufbereiten (Juli 2026)

PATCH — Ein Klick auf „Neu aufbereiten" warf die zurückgebrachten Deep-Research-Ergebnisse weg. Die kosten einen 5–10-minütigen externen Lauf plus Hin- und Rückweg über die Zwischenablage — und sie hängen gar nicht am Antrags-Korpus, der neu aufbereitet wird.

- Importierte externe Recherche-Ergebnisse überleben „Neu aufbereiten"; entfernt werden sie nur über den Löschen-Knopf im Recherche-Tab ([store.ts](src/plugins/antraege/aufbereitung/store.ts)).

### v2.301.0 — Deep-Research-Auftrag kommt aus einer festen Vorlage, die KI liefert nur Stichworte (Juli 2026)

MINOR — Der Deep-Research-Auftrag für ChatGPT/Claude/Mistral wurde bisher vom internen Modell frei formuliert. Es fasste dabei die Vorhabensbeschreibung nach und schrieb genau das hinein, was extern erst recherchiert werden soll: die im Antrag identifizierten Lücken, seine Marktzahlen, seine Wettbewerberliste, seine Zielkennwerte. Der externe Dienst bestätigte damit den Antrag, statt unabhängig zu recherchieren — und Antragsinhalt verließ mit dem Kopieren den geschützten Bereich.

- Der Auftragstext kommt jetzt aus einer festen Vorlage im Code, die nach Kennwerten, Marktgrößen und Lücken FRAGT, statt sie vorzugeben ([recherche-auftrag.ts](src/plugins/antraege/aufbereitung/recherche-auftrag.ts)).
- Die KI liefert nur noch Stichworte (Technologiefeld, Verfahren, Leistungsdimensionen, Marktsegmente, englische Suchbegriffe) — Zahlwerte und identifizierende Angaben filtert ein deterministischer Sanitizer heraus ([recherche-stichworte.ts](src/plugins/antraege/aufbereitung/recherche-stichworte.ts)).
- Die Stichworte sind im Recherche-Tab als Chips editierbar; jede Eingabe läuft durch dieselbe Regel und wird bei Ablehnung mit Grund gemeldet ([StichworteEditor.tsx](src/plugins/antraege/aufbereitung/StichworteEditor.tsx)).
- Skill-Seed auf die Stichwort-Aufgabe umgestellt (maxTokens 2048 → 512); Bestands-Shares hebt die Migration `aufbereitung-dr-stichworte-2026-07` ([migrations.ts](src/core/services/skills/registry/migrations.ts)).
- Baustein-Cache-Key trägt die Stichwort-Schema-Version, Markdown-Vorschau und Stift-Bearbeitung aus v2.300 bleiben. Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

### v2.300.0 — Deep-Research-Auftrag als Markdown-Vorschau, per Stift bearbeitbar (Juli 2026)

MINOR — Der anonyme Deep-Research-Auftrag im Recherche-Tab stand als Textwand da, in der die Zeilenumbrüche als literale `\n` mitten im Satz klebten. Und obwohl die Seite zum Prüfen des Textes auffordert, war er nicht änderbar: fand der Leak-Check eine identifizierende Angabe, half nur ein kompletter KI-Neulauf mit ungewissem Ausgang.

- Auftragstext erscheint als gerenderte Markdown-Vorschau (Gliederung, Listen) statt als Rohblock; kopiert wird weiterhin der Markdown-Quelltext ([RechercheTab.tsx](src/plugins/antraege/aufbereitung/RechercheTab.tsx)).
- Neue Normalisierung `normalisiereAuftragstext` räumt doppelt escapte Umbrüche aus dem Modell-JSON — auch für bereits gecachte Aufträge ohne Neulauf ([recherche-prompt.ts](src/plugins/antraege/aufbereitung/recherche-prompt.ts)).
- Stift-Bearbeitung des Auftrags über den geteilten Markdown-Editor mit Live-Vorschau, Strg+Enter übernimmt, Esc bricht ab.
- Jede von Hand gesetzte Fassung läuft durch denselben Leak-Check: eine identifizierende Angabe bleibt gesperrt und ungespeichert, ein bereinigter Text ist sofort wieder kopierbar ([useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts)).
- Bearbeitete Fassungen überleben den Seitenwechsel und lassen sich per „Zurück zum KI-Text" verwerfen. Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

### v2.299.0 — Semikolon und Gedankenstrich in KI-Texten verboten (Juli 2026)

MINOR — In den generierten Gutachten-Abschnitten tauchten regelmäßig Semikolons und Gedankenstriche mitten im Satz auf, typische LLM-Manier und im ZIM-Gutachten unerwünscht. Dagegen gab es bisher nichts: weder eine Prompt-Vorgabe noch einen Check nach dem Lauf.

- Neue geteilte Bibliotheks-Regel „Semikolon & Gedankenstrich" (`verbotenes_muster`, Schweregrad fehler) in [seed.ts](src/core/services/skills/registry/seed.ts) — sie ist zugleich Prompt-Vorgabe und deterministischer Check, Fundstellen inklusive („Anzeigen"-Sprung).
- Die Regel hängt an ALLEN sieben generativen Schritten des `zim-ep`-Workflows und ist damit die generelle Vorgabe für jeden KI-Fließtext; ein Guard über `ZIM_EP_DEF` lässt einen künftigen Abschnitt auffallen, der sie vergisst ([interpunktion.test.ts](src/core/services/skills/registry/__tests__/interpunktion.test.ts)).
- Muster bewusst eng: nur `;` und der Gedankenstrich zwischen Leerzeichen — Wortverbindungen („KI-gestützt") und Zahlenbereiche („2024–2026") bleiben unbeanstandet, mit Gegenproben festgeschrieben.
- Der Lektor („Sprachlicher Feinschliff") entfernt die Zeichen jetzt verpflichtend und ist selbst gedankenstrichfrei formuliert ([ga-lektor.seed.ts](src/core/services/skills/registry/ga-lektor.seed.ts)); den Nachweis liefert der Regel-Lauf nach dem Feinschliff.
- Rollout auf Bestands-Shares über den Marker `ga-interpunktion-2026-07` ([migrations.ts](src/core/services/skills/registry/migrations.ts)) — additiv, kuratierte Regellisten und Templates bleiben unberührt. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

### v2.298.0 — Aufbereitung läuft auf der Standard-KI (Juli 2026)

MINOR — Ein realer Aufbereitungs-Lauf dauerte sehr lange und endete mit 2× „eingeschränkt" + 2× „Fehler". Ursache war nicht der Prompt, sondern das Ziel-Modell: alle sechs Bausteine folgten der globalen KI-Variante und liefen auf dem agentischen Tab — sechs Volldurchgänge über den Antragstext, häufig in einem Format, das der Parser nicht lesen kann, teils bis in die Transport-Deadline. Dieselbe Klasse wie v2.292.0.

- Ziel-KI der Bausteine fest auf Standard gepinnt, entschieden in der reinen [lauf-ziel.ts](src/plugins/antraege/aufbereitung/lauf-ziel.ts) (Muster `FEEDBACK_ZIEL`); der DR-Baustein verliert sein hartes `ziel:'agentisch'` ([recherche-prompt.ts](src/plugins/antraege/aufbereitung/recherche-prompt.ts)).
- Agentisch-Fallback nennt `'standard'` jetzt ausdrücklich statt `undefined` = aktiver Tab ([bausteine.ts](src/plugins/antraege/aufbereitung/bausteine.ts)); MAP bleibt bewusst an der globalen Variante.
- Korpus-Warnung rechnet gegen das Fenster der tatsächlich genutzten KI und bietet bei zu grossem Korpus die agentische Notausfahrt an ([QuellenPanel.tsx](src/plugins/antraege/aufbereitung/QuellenPanel.tsx), [useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts)).
- Übersicht-Tab nennt die genutzte KI und erklärt den Vorrang, wenn die globale Variante auf „Agentisch" steht ([UebersichtTab.tsx](src/plugins/antraege/aufbereitung/UebersichtTab.tsx)).
- Vier Prompt-Restbefunde behoben: Zahlen lud zur leeren Liste ein (die den Lauf verdoppelt), Glossar/Verwertung/Steckbrief gegen Beispiel-Echo abgesichert — Nachtrag in [docs/prompt-audit-2026-07.md](docs/prompt-audit-2026-07.md), Detail in [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

### v2.297.0 — Lesemodus: Silhouette-Balken entfernt, Gliederung ziehbar (Juli 2026)

MINOR — Der Lesemodus trug links zwei Navigationen: den proportionalen Silhouette-Balken (ein Block je Hauptkapitel) und daneben die beschriftete Gliederung. Der Balken war funktional redundant und kostete Breite, die der fest 208 px schmalen Gliederung fehlte — deren Punkte brachen früh ab („3.2.2 Entwicklungslinie 2: Ge…").

- Silhouette-Scroll-Navigation im Lesemodus entfernt (`LesemodusSilhouette.tsx` gelöscht, `findeL1Block` in [silhouette-core.ts](src/plugins/antraege/aufbereitung/silhouette-core.ts) mit); die Abdeckungs-Silhouette bleibt unberührt.
- Gliederungsspalte per Griff ziehbar (150–560 px, Doppelklick = zurück, Pfeiltasten ±16 px), Breite gerätelokal gemerkt ([useTocBreite.ts](src/plugins/antraege/aufbereitung/useTocBreite.ts), nutzt das geteilte `clampBreite`).
- Ziehen setzt nur die CSS-Variable `--lm-toc-breite` — der Lesepane rendert nicht pro Frame neu ([LesemodusTab.tsx](src/plugins/antraege/aufbereitung/LesemodusTab.tsx)).
- Detail: [docs/architecture/antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) (Abschnitt „Lesemodus aufgewertet").

### v2.296.1 — Tabellen passen sich der Fensterbreite an (Juli 2026)

PATCH — Der Breiten-Griff aus v2.295.1 konnte Tabellen nur breiter ziehen, nie schmaler: bei `table-layout: fixed` ist die Summe der Pixel-`<col>` ein harter Boden für die Tabellenbreite (CSS 2.1 §17.5.2.1), eine kleinere `width` wird ignoriert. Betroffen war jede Tabelle auf `SortableTable`.

- `<col>` werden als Prozent ihrer Pixel-Summe gerendert; die Tabelle passt sich damit dem Container an und scrollt erst unter 720px ([tableSizing.ts](src/components/data-table/tableSizing.ts), neu, mit der Messung im Dateikopf).
- Drei klare Größen-Modi in [SortableTable.tsx](src/components/data-table/SortableTable.tsx): Einpassen (Default) · Gepinnt (Griff) · Scroll (`fitContentWidth`), Wrapper-Zeile passend je Modus.
- Spalten-Drag rechnet live in Prozent und committet die Breite zurückgerechnet — im gestauchten Zustand schrumpft eine Spalte nicht mehr bei jedem Anfassen.
- Wirkt ohne Caller-Patch auch für Anfragen und die Feedback-Board-Liste; Förderanträge behalten via `fitContentWidth` ihr Scroll-Verhalten.
- Muster stammt 1:1 aus [SearchResultsTable.tsx](src/plugins/suche/SearchResultsTable.tsx) (Suche), wo es seit längerem läuft — kein neuer Mechanismus.

### v2.296.0 — Umfangs-Vorgaben gehoeren zum Skill, nicht in die Regel-Bibliothek (Juli 2026)

MINOR — Ein Regel-Record trug zwei Ebenen zugleich: die Art der Prüfung (Satzanzahl) UND den nur für einen Skill gültigen Wert (8–12). Die Bibliothek wuchs dadurch auf 25 Regeln — 16 davon Ein-Skill-Parametrisierungen, 8 verwaiste Altstände. Zugleich verdeckte der offene Skill-Editor die in der Liste angewählte Regel.

- Umfang & Form (Wortanzahl, Satzanzahl, Zeichen, Absätze, Satzlänge, keine Aufzählungen, Pflicht-Anfang) sind jetzt Eigenschaften des Skills, nicht Bibliotheks-Regeln; zur Laufzeit als Regeln materialisiert, damit Checks/Prompt/Eval unverändert bleiben ([vorgaben.ts](src/core/services/skills/registry/vorgaben.ts), [skill-vorgaben.md](docs/architecture/skill-vorgaben.md)).
- Neue Sektion „Umfang & Form" im Skill-Editor; die Regel-Bibliothek schrumpft auf 9 wiederverwendbare Regeln, `+ Neue Regel` legt direkt ein verbotenes Muster an ([VorgabenEditor.tsx](src/plugins/skill-verwaltung-kuration/VorgabenEditor.tsx), [regelShared.tsx](src/plugins/skill-verwaltung-kuration/regelShared.tsx)).
- Umschalter „Team | Persönlich" am Skill: Kurator/PL ändert für alle, jeder Nutzer verschiebt freigegebene Werte für sich (persönlicher Ordner); Prompt und Prüfung ziehen dieselbe Liste ([PersoenlichePanel.tsx](src/plugins/skill-verwaltung-kuration/PersoenlichePanel.tsx), `SkillTweak.vorgabenOverride`).
- Anwählen einer Regel wechselt die Detailansicht wieder — die drei parallelen Editor-States sind ein diskriminierter Zustand, Tabwechsel schließt mit ([SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx)).
- Detail-Kopfzeile mit Schließen-X oben rechts statt drei einzeln gebauter „← Skill-Verwaltung"-Links ([DetailKopf.tsx](src/plugins/skill-verwaltung-kuration/DetailKopf.tsx)).

**Migration:** `SKILL_VORGABEN_MIGRATION` überführt Bestands-Shares einmalig und marker-gesichert (mehrfach genutzte und inaktive Regeln bleiben unangetastet, Waisen werden entfernt) — kein Nutzer-Eingriff nötig ([migrations.ts](src/core/services/skills/registry/migrations.ts)).

