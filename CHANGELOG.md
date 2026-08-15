# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v4.60.1 — Kurator-Schalter oeffnet die Sitzung (August 2026)

PATCH — In Builds **ohne** Kurator-Zusatzpasswort öffnete nichts die Kurator-Sitzung: der freie Schalter im Profil setzte nur die Menü-Sichtbarkeit. Die Kurations-Seiten standen offen, aber jede Schreib-Aktion darin blieb grau — ohne dass irgendwo stand, warum. Detail: [modul-freischaltung.md](docs/architecture/modul-freischaltung.md).

- **Ohne Schloss folgt die Sitzung dem Schalter** (`spiegleKuratorSchalterInSession`, [modul-freischaltung.ts](src/core/modul-freischaltung.ts)) — beim Umlegen und bei jedem Start; mit Schloss unverändert ein No-op, dort entscheidet allein das Passwort
- **Der Schalter tut jetzt beides**, wie der Passwort-Weg: Profil-Flagge, Sitzung und Handle-Hochstufung auf `readwrite` in derselben Geste ([ZusatzModuleGruppe.tsx](src/plugins/einstellungen/profil/ZusatzModuleGruppe.tsx), Pitfall #25)
- **Ein grauer Knopf nennt seinen Grund sichtbar** ([CsvSchemaDetailDialog.tsx](src/plugins/csv-sources-kuration/CsvSchemaDetailDialog.tsx)) — er stand im `title` eines `disabled`-Buttons, und den zeigt kein Browser an; der Dialog verdeckte zusätzlich den Seiten-Banner
- **Vier Tests** halten die Invariante: mit Schloss unangetastet, ohne Schloss beidseitig gespiegelt, und eine laufende Sitzung wird nicht bei jedem Start verlängert ([modul-freischaltung.test.ts](src/core/__tests__/modul-freischaltung.test.ts))

### v4.60.0 — Spalten fuellen die Breite, der Griff schaltet um (August 2026)

MINOR — Die Fördertabelle stand fest auf Inhaltsbreite: jede Spalte nahm, was ihr längster Eintrag brauchte, und was übrig blieb, landete in einer leeren Füllspalte. Jetzt teilen sich die Spalten die verfügbare Breite und skalieren mit ihr; die alte Darstellung liegt einen Klick entfernt. Detail: [ui-muster.md](docs/architecture/ui-muster.md).

- **Einpassen wächst jetzt auch** (`flex: 1 1 auto`) — vorher blieb die Tabelle bei ihrer Wunschbreite stehen, sobald die Spaltensumme kleiner war als der Container ([tableLayout.ts](src/components/data-table/tableLayout.ts))
- **Der Griff trägt zwei Gesten**: Ziehen pinnt eine Pixelbreite, Klick verwirft erst einen Pin und schaltet danach Einpassen ↔ Inhaltsbreite um (der Doppelklick-Reset geht darin auf); 4px → 6px ([TotalWidthGrip.tsx](src/components/data-table/TotalWidthGrip.tsx))
- **Fix: ein Klick ohne Bewegung pinnte die Tabelle** — der Griff kannte die `DRAG_SCHWELLE` der Spaltengriffe nicht und committete auf jedem Mouseup
- **Umschalt-Zustand je Tabelle persistiert** in einem eigenen Schlüssel neben der gepinnten Breite ([useTotalTableWidth.ts](src/components/data-table/useTotalTableWidth.ts))
- **Boden der Fördertabelle** ist die Summe der Spalten-Mindestbreiten statt pauschal 720px ([AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx))

### v4.59.0 — Die Chronik zeigt zurueckgenommene Termine (August 2026)

MINOR — Nimmt jemand in C16 eine Setzung zurück, überschreibt der Nacht-Export die Spalte und die Zeile ist spurlos. Das Journal hielt es fest, die Chronik zeigte es nicht — die Aussage, für die es das Journal gibt, war die einzige unsichtbare. Detail: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md) + [vorgangssystem.md §12.10](docs/architecture/vorgangssystem.md).

- **Durchgestrichene Zeile am alten Tag** für jeden Termin, den der Export nicht mehr führt — `geleert` als „zurückgenommen", `geaendert` als „verschoben auf …", über Träger gefaltet ([chronik-zurueckgenommen.ts](src/core/status/chronik-zurueckgenommen.ts))
- **Fünfter Knotenzustand** (gestrichelter grauer Ring) samt Legende und Kennzahl „· 2 zurückgenommen"; beides zählt nicht in die Datumsangaben ([StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx), [verlauf-kennzahlen.ts](src/core/status/verlauf-kennzahlen.ts))
- **Nullpunkt unter der Chronik**, in drei unterschiedenen Fassungen und im selben Wortlaut wie die Historie-Sektion ([JournalNullpunkt.tsx](src/plugins/antraege/status/JournalNullpunkt.tsx), [journalTexte.ts](src/plugins/antraege/status/journalTexte.ts))
- **Ein Journal-Lesevorgang je Seite** statt drei — `stand.json` wiegt über 5 MB und ist bewusst nicht gecacht ([useJournalChroniken.ts](src/plugins/antraege/status/useJournalChroniken.ts))
- **Fix: „kein Journal" war beim Kaltstart eine Falschaussage** — `leseSidecar` wirft fehlenden Share-Handle und fehlende Datei auf dasselbe `null`; ein Deep-Link-Reload traf das zuverlässig. Vier Versuche über 11 s, bis dahin „lädt" (Bug-Klasse 1); heilt die Historie-Sektion seit v4.13 mit

### v4.58.0 — Der manuelle CSV-Import zeigt seinen Lauf (August 2026)

MINOR — Der Lauf dauert bei mehreren Quellen Minuten, und die manuellen Türen zeigten dabei nichts als einen Knopf, der „Importiere…" hieß. Das liest sich als Hänger. Detail: [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md).

- **Fortschritt im „● CSV"-Dialog** (Spinner + Phase + Balken + Prozent, Quellen-Zähler „2/3") — beide manuellen Türen riefen `runDataUpdate` mit leerem Options-Objekt, also ohne den `onPhase`-Kanal, den der Orchestrator seit je anbietet ([CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx), [OrdnerGruppe.tsx](src/plugins/einstellungen/daten/OrdnerGruppe.tsx))
- **„Fertig" nach dem Lauf**: der Import-Knopf verschwindet, sobald der Status auf `fresh` kippt — nichts sagte danach, dass man das Fenster zumachen kann
- **Drift ist keine Sackgasse mehr**: der Dialog zeigt den Bericht selbst, statt auf einen Banner zu verweisen, den nur der Banner-Lauf füllt; `driftAkzeptiertFuer` reicht „Trotzdem importieren" durch ([data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts))
- **„Verarbeitet" ist nicht „geändert"**: `RefreshReport.changedAntraege` trennt beides, die Meldung sagt „keine inhaltlichen Änderungen" statt neue Daten zu versprechen ([datenUpdateMeldung.ts](src/plugins/csv-sources-kuration/services/datenUpdateMeldung.ts))
- **`loadAll` schweigt nicht mehr, wenn es scheitert** ([store.ts](src/plugins/antraege/store.ts)): `console.warn` + `lastLoadedAt: 0`, sonst strandete ein fehlgeschlagener Post-Import-Refresh hinter dem TTL-Skip bis zum Browser-Reload

### v4.57.1 — Kanonische Felder zeigen ihre Kuerzel (August 2026)

PATCH — In der Feldauswahl standen die kanonischen Felder ohne Herkunft: `antragsdatum` sagt nicht, aus welcher Spalte des Fachsystems es entsteht. Die rohen Codes standen daneben, die Standardfelder schwiegen.

- **Kanonische Felder nennen ihre Quell-Kürzel** (`antragsdatum ← D_AAE`) in der Feldauswahl des Anlege-Dialogs; voller Satz im Tooltip, wenn mehrere Programme verschiedene Spalten mappen ([SpaltenDialog.tsx](src/plugins/antraege/eigene-spalten/SpaltenDialog.tsx))
- **Suchbar nach dem Code**: wer „D_AAE" eintippt, findet `antragsdatum` — die Herkunft anzuzeigen, aber nicht danach suchen zu lassen, wäre eine halbe Auskunft
- **Eine Auflösung statt zweier**: `rohSpaltenJeKanonisch` ist vom Plugin in den Kern gezogen ([spalten-inventar.ts](src/core/services/csv/spalten-inventar.ts)) — Kopf-Tooltip und Feldauswahl lesen jetzt dieselbe, statt bei der ersten Mapping-Feinheit auseinanderzulaufen

### v4.57.0 — Eigene Spalten fuer das Team (August 2026)

MINOR — Eine eigene Spalte war bisher eine Privatsache: gerätelokal, für niemanden sonst sichtbar. Wer eine erprobt hatte, konnte sie nur beschreiben, nicht weitergeben. Jetzt hebt sie ein Griff ins Team. Detail: [eigene-spalten.md](docs/architecture/eigene-spalten.md).

- **Team-Spalten** in der Sidecar `_intern/eigene-spalten.json`, idempotent-overwrite, Schreiben self-gated + `canManageTeamSpalten` ([team-store.ts](src/core/spalten/team-store.ts)); Lesen für alle, eigene Rubrik im Spalten-Menü
- **„Ins Team übernehmen"** am Stift einer persönlichen Spalte: Einweg-Kopie auf eine `frei:team:`-Id, die persönliche entfällt — und die Spaltenwahl zieht mit, sonst verschwände die Spalte im Moment des Teilens ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx))
- **Jede Ablage filtert beim Lesen auf ihre Herkunft** ([lesen.ts](src/core/spalten/lesen.ts)) — die Sidecar liegt im Klartext auf dem Share, eine `frei:ich:`-Zeile darin schöbe sonst allen eine „persönliche" Spalte unter, die niemand löschen kann
- **Ein gescheiterter Share-Write bricht ab, statt halb zu übernehmen** ([useEigeneSpalten.ts](src/plugins/antraege/useEigeneSpalten.ts)); neuer Guard: `team-store.ts` ist der einzige Share-Berührpunkt unter `core/spalten/`
- **Der Team-Cache unterscheidet zwei Fälle**: fehlende Datei leert ihn (gelöscht bleibt gelöscht), unerreichbarer Share lässt ihn stehen

### v4.56.0 — Regel-Spalten, Bearbeiten und Entfernen (August 2026)

MINOR — Die dritte Spaltenart: eine geordnete Regelkaskade, die je nach Zustand einen anderen Text zeigt. Dazu die beiden Wege, die bis hierher fehlten — eine angelegte Spalte ließ sich weder bearbeiten noch entfernen. Detail: [eigene-spalten.md](docs/architecture/eigene-spalten.md).

- **Regel-Spalten**: „erste zutreffende Regel gewinnt", Bedingungen über den geteilten [BedingungEditor](src/plugins/meilensteine/BedingungEditor.tsx) — dieselbe Komponente wie Meilensteine und Vorgangs-Regeln, kein Fork
- **Sortiert nach dem Rang der Regel**, nicht nach ihrem Text: die Reihenfolge ist die Aussage des Autors, alphabetisch stünde sie zufällig ([anzeige.ts](src/core/spalten/anzeige.ts))
- **Bearbeiten und Entfernen** über den Stift an der Spalte im Menü — ausblenden ist nicht löschen ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx))
- **Belegt, dass Textänderungen frei sind**: am echten Bestand 0,5 s gegen 6,0 s mit neuem Feld (14.225 Anträge) — genau die Zusage, für die die Rohwert-Projektion gebaut wurde
- **Behoben**: das Bearbeiten-Formular übernahm die Art einer bestehenden Spalte nicht und hätte eine Regel-Spalte beim Speichern in eine Feld-Spalte verwandelt ([SpaltenDialog.tsx](src/plugins/antraege/eigene-spalten/SpaltenDialog.tsx))

### v4.55.0 — Eigene Spalten: Feld und Sammel (August 2026)

MINOR — Der Spaltenvorrat war geschlossen: wer ein Feld brauchte, das die Registry nicht führt, hatte keinen Weg. Jetzt legt der Nutzer eigene Spalten an — aus einem rohen Feld oder als jüngstes Datum aus mehreren. Detail: [eigene-spalten.md](docs/architecture/eigene-spalten.md).

- **Feld- und Sammel-Spalten**, persönlich und gerätelokal; Anlegen aus dem Fuß des Spalten-Menüs, mit Pflicht-Vorschau an echten Zeilen ([SpaltenDialog.tsx](src/plugins/antraege/eigene-spalten/SpaltenDialog.tsx), Flag `eigeneSpalten`, dev+pl)
- **Projiziert werden die Rohwerte, nicht das Ergebnis** ([anzeige.ts](src/core/spalten/anzeige.ts)) — dadurch bleiben Datumsregeln taggenau und das Ändern von Text oder Farbe kostet **keinen** Neuaufbau; nur ein neues Feld tut das (gemessen: 6,0 s bei 14.225 Anträgen)
- **Alle vier Slim-Schreibpfade** führen den Beutel `frei_roh`, Projektion 6 → 7 ([list-view-migration.ts](src/core/services/csv/list-view-migration.ts)); Regressionstest gegen die Vollersatz-Falle ([merge-behaelt-freie-spalten.test.ts](src/core/services/csv/__tests__/merge-behaelt-freie-spalten.test.ts))
- **Eigene Spalten erklären sich selbst** — ihre Herkunftsangabe entsteht aus der Definition, dieselbe Struktur wie bei den eingebauten (v4.54)
- **Guard `eigene-spalten-lokal`**: die persönlichen Definitionen gehen nie auf den Share oder in den Snapshot ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts))

### v4.54.0 — Spaltenkoepfe erklaeren ihre Herkunft (August 2026)

MINOR — „PreCheck Status" war ein Badge ohne Herkunft: welche Kürzel darin zusammenlaufen und welche Regel den Wert wählt, stand nirgends in der Oberfläche. Der Tooltip nennt jetzt die Felder, die das geladene Schema wirklich mappt — nicht eine abgeschriebene Liste, die beim nächsten Mapping-Wechsel still falsch wäre.

- **Jeder Spaltenkopf erklärt sich beim Überfahren**: ein Satz, die Auswahlregel, die speisenden Felder als Code + Klartext ([SpaltenHilfeInhalt.tsx](src/components/data-table/SpaltenHilfeInhalt.tsx), [TableHeadRows.tsx](src/components/data-table/TableHeadRows.tsx))
- **Die Feldlisten kommen aus dem Schema, nicht aus dem Code** — PreCheck zeigt seine 9, FB seine 11 gemappten Spalten mit den Beschriftungen des Programms ([spaltenHilfe.ts](src/plugins/antraege/spaltenHilfe.ts), [useSpaltenHilfe.ts](src/plugins/antraege/useSpaltenHilfe.ts))
- **Eine leere Spalte sagt, warum sie leer ist**: „In diesem Programm ist dafür keine Spalte gemappt" statt einer stummen Zelle — gemessen an *Zuwendung* und drei Ordner-Spalten des Katalogs
- **Auch im Spalten-Picker**, am ⓘ je Zeile: die Herkunft steht da, wo man entscheidet, ob man die Spalte braucht ([ColumnPicker.tsx](src/components/data-table/ColumnPicker.tsx))
- **Guard `spalten-hilfe-abdeckung`** hält die Vollständigkeit in beide Richtungen — neue Spalte ohne Satz und Satz ohne Spalte fallen im Gate auf ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts))

### v4.53.0 — Verbundkennzeichen suchbar, nw statt netz, keine Null vor der Messung (August 2026)

MINOR — Nach dem FKZ ließ sich direkt suchen, nach dem Verbundkennzeichen nicht. Dieselbe Messung wie in v4.50, diesmal über die Spalten, die Codes tragen: von 512 Spalten bleiben genau vier — mehr Kennzeichen gibt es im Bestand nicht. Detail: [suche-relevanz.md](docs/architecture/suche-relevanz.md).

- **Verbundkennzeichen als eigene Fundstelle** (100 % gefüllt, 7.535 Verbünde): `vb:ZKN073232` → 9 Teilvorhaben, vorher 0 — die Nummer stand in keinem durchsuchten Feld ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts), [korpusFeldAufloesung.ts](src/plugins/antraege/services/korpusFeldAufloesung.ts))
- **Das Fachsystem-Aktenzeichen fällt mit dem FKZ zusammen** — `KNF065624` findet denselben Antrag wie `16KN065624`, über `fkz:`/`akz:`/`kennzeichen:` ([feldpraefix.ts](src/core/services/search/feldpraefix.ts))
- **Netzwerk-Präfix heißt jetzt `nw:`**; `netz:` wird weiter gelesen, damit gemerkte Suchen nicht ins Leere laufen
- **Keine Null vor der Messung**: der Ergebniskopf schrieb „0 Treffer", solange der erste Lauf noch lief (gemessen 357–666 ms) — jetzt steht dort „… Treffer" ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Spalte „Verbund-Nr."** blendet sich wie die übrigen Belege selbst ein ([autoSpalten.ts](src/plugins/suche/autoSpalten.ts), [columns.tsx](src/plugins/suche/columns.tsx)); `ALTAKZ` bleibt draußen — der Import setzt es auf „ignorieren"

### v4.52.0 — Bestandslauf: Befund oben, Zahlen eingeklappt (August 2026)

MINOR — Der Reiter *Kürzel* zeigte zwei Mess-Kacheln mit rund 40 gleichrangigen Zahlen in elf Abschnitten, alle immer offen: die eine Zeile, die eine Zusage bricht, stand neben einem Median. Jetzt steht die Wertung vor den Zahlen, und die Zahlen bleiben vollständig — §14.3 zitiert aus ihnen. Detail: [vorgangssystem.md §14.3/§15.4](docs/architecture/vorgangssystem.md).

- **Ein Block, ein Knopf, Befund in Sätzen** — Zusagen (✓), Auffälligkeiten (⚠) und Kennzahlen (ohne Symbol, weil kein Schwellwert erfunden wird) statt einer Zahlenwand ([BestandslaufBlock.tsx](src/plugins/status-cockpit/BestandslaufBlock.tsx)); die volle Auswertung liegt unter „Zahlen im Detail"
- **Die Wertung ist eine reine Funktion** und damit erstmals im Node-Test prüfbar — der Bestand selbst ist es nicht ([bestandslaufBefund.ts](src/plugins/status-cockpit/bestandslaufBefund.ts))
- **Auffälligkeiten tragen bis zu drei Belege**; ist der Beleg ein Kürzel, filtert ein Klick die Tabelle darunter ([erhebung.ts](src/core/status/verlauf/erhebung.ts))
- **„Vergleich: C16" hieß seit v3.23 falsch** — die Zeilen verglichen C16 mit sich selbst; jetzt „Obergrenze", und der Prozentwert der TV-Zeile entfällt, weil er Datumsfelder gegen Übergänge rechnete ([VerlaufBefundeBlock.tsx](src/plugins/status-cockpit/VerlaufBefundeBlock.tsx))
- **Neu gemessen: die dritte Haltedatum-Quelle greift nirgends** — 0 statt 1 638 aus §15.4, weil Stufe 2 inzwischen 5 585 Fälle beantwortet; offen sind 42 angehaltene Vorgänge, nicht 1 030 ([fristErhebung.ts](src/plugins/status-cockpit/fristErhebung.ts))

### v4.51.0 — Zeitstrahl zeigt jeden Termin, mit Rolle und Filter (August 2026)

MINOR — Teil 2 des Handoffs `_design/handoff/chronik`. Die Bahn zeigte nur die Termine, die einen Statuswechsel auslösen — gemessen 7,3 %; die übrigen standen vollständig in den Daten und wurden nicht gezeichnet. Rolle, Filter und Fokus der Chronik erbt sie jetzt mit. Detail + die vier Abweichungen vom Entwurf: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md).

- **Jeder Termin als Marke über der Bahn**, getönt nach Rolle; ein Tag = eine Marke mit „+n", was kollidiert entfällt ([bandTermine.ts](src/plugins/antraege/verlauf-band/bandTermine.ts), gemessen an ZKN084412/TV2: 18 Marken für 22 von 78 Terminen)
- **Klartext-Zeile mit Rangfolge** — Warnung, fehlende Kürzel (rot), fokussierter Termin, übrige Termine, Abschnittsnamen, Dauern ([bandBeschriftung.ts](src/plugins/antraege/verlauf-band/bandBeschriftung.ts)); dazu die **Rollenbilanz je Bahn** ([VerlaufBadges.tsx](src/plugins/antraege/status/VerlaufBadges.tsx))
- **Wer/Wo/Fokus wirken auf beide Ansichten**: Wer blendet ab, Wo blendet Bahnen aus, und die Achse bleibt dieselbe (gemessen: 0 px Abweichung bei „nur TV 3") ([bandGeometrie.ts](src/plugins/antraege/verlauf-band/bandGeometrie.ts), [StatusDetailSection.tsx](src/plugins/antraege/status/StatusDetailSection.tsx))
- **„Wer setzt" hat nur noch eine Quelle**: `baueUebergaenge` liest die Rollen aus der geladenen Fassung statt aus der Zuarbeit — die widersprachen sich an ZKN084412 um 37 Termine „Juristen" gegen null ([uebergaenge.ts](src/core/status/verlauf/uebergaenge.ts))
- **Balkenfarbe bleibt der Status** (der Entwurf färbt nach Rolle): PA ist Neutralgrau und von „neutral" nicht zu unterscheiden, ein Kürzel trägt bis zu vier Rollen, und der Balken nennt seinen Status als Text — `--tf-rolle-*-bar` entfällt ([theme.css](src/theme.css)); die Bahn zieht nach [BandBahn.tsx](src/plugins/antraege/verlauf-band/BandBahn.tsx)

### v4.50.0 — Netzwerk, Notizen und Wahlkreis werden mitdurchsucht (August 2026)

MINOR — Gefragt war, ob weitere Roh-CSV-Spalten mit sinnvollem Text in die Suche können. Entschieden hat nicht die Textmenge, sondern die Messung über alle drei aktiven Quellen (512 Spalten, 14.225 FKZ): welcher Text ist nirgendwo sonst auffindbar? Detail + verworfene Kandidaten: [suche-relevanz.md](docs/architecture/suche-relevanz.md).

- **Netzwerk** (11.492 Anträge): Name UND Netz-Kennzeichen — `netz:ProAnimalLife` findet 80 Teilvorhaben, vorher fand dieselbe Anfrage nur den Netzwerkantrag ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts))
- **Arbeitsnotizen** „Wichtig" + „Bemerkung" als EIN Feld (5.335): `notiz:Einbehalt` → 50 Treffer; dieser Text stand in keinem anderen durchsuchbaren Feld
- **Wahlkreis** (14.218) gehört zum „wo": „Northeim" 1 → 51 Treffer, die Bereichs-Beschriftung heißt jetzt „nur Ort, Bundesland & Wahlkreis" ([suchbereich.ts](src/core/services/search/suchbereich.ts))
- **NACE-Branchentext** fließt in die Deskriptoren (2.256): „Anstrichmitteln" 0 → 12; drei neue Belege in Zeile und Tabelle ([autoSpalten.ts](src/plugins/suche/autoSpalten.ts), [columns.tsx](src/plugins/suche/columns.tsx))
- **Korpus liest jeden Datensatz in EINEM Durchgang** statt einmal je Feld: 8.225 ms → 1.168 ms über 14.225 Anträge, trotz fünf zusätzlicher Felder

### v4.49.1 — Kuerzel ueberall in der Schreibweise des Teams (August 2026)

PATCH — Nachzug zu v4.48.3: dort lernte die Kürzel-Auswahl die Schreibweise des Teams, überall sonst stand weiter die Vergleichsform („Kürzel THÜ"). Die Bearbeitenden kennen ihr Kürzel gemischt geschrieben — 81 der 112 im Bestand sind es.

- **`anzeigeTokens` am Filter-Modus**, aus den Anträgen gelesen und rein zum Beschriften; verglichen wird weiter mit `tokens` ([bearbeiterFilter.ts](src/plugins/antraege/bearbeiterFilter.ts), Fassade [useBearbeiterSicht.ts](src/core/hooks/useBearbeiterSicht.ts))
- **Chip, Popover-Option und sechs Widget-Meta-Zeilen** nennen dieselbe Fassung — Meine Anträge, Antragseingang, Kanban, QS, Hängt fest, Meilensteine, Status & Verlauf
- **Drei Widgets bauten das Label selbst** und tragen es jetzt aus `bearbeiterScopeLabel` ([HaengtFestWidget.tsx](src/plugins/home/widgets/HaengtFestWidget.tsx), [MeilensteineWidget.tsx](src/plugins/home/widgets/MeilensteineWidget.tsx), [StatusVerlaufWidget.tsx](src/plugins/home/widgets/StatusVerlaufWidget.tsx))
- **Das Vorgangs-Board liest die Schreibweise aus den EIGENEN Zeilen** — wer die Seite direkt aufruft, hat den Anträge-Store nicht geladen ([useVorgangsBoard.ts](src/plugins/vorgangs-board/useVorgangsBoard.ts))
- **Guard `anzeigetokens-nur-anzeigen`**: die Anzeige-Fassung steht in keinem Vergleich ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts))

### v4.49.0 — Feldsuche in der Eingabe, Suchbeispiele auf der Startseite (August 2026)

MINOR — Wer weiß, in welcher Spalte sein Wort steht, konnte das bisher nur grob sagen: das Dropdown „Suche in" kennt fünf Bereiche und gilt für die ganze Anfrage. `FKZ: 16KN083001` oder `AST:GMBU` einzutippen fand nichts — „fkz:" war ein Suchwort wie jedes andere. Der Startzustand erklärte die Syntax bewusst nicht, weil es sie nicht gab; jetzt gibt es sie und er macht sie vor.

- **Feld direkt in der Eingabe**: `ast:Fraunhofer` (307), `ort:Dresden` (451), `titel:Laser ort:Dresden` (4) — Alltagswörter und Spaltencodes der Fördertabelle (`ORG_AST:`, `VB_TITEL:`), auch mit Leerzeichen getippt ([feldpraefix.ts](src/core/services/search/feldpraefix.ts))
- **Je Wort ein eigener Bereich**: das genannte Feld schlägt das Dropdown, Wörter ohne Präfix folgen ihm weiter ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts))
- **Dokumente und Ähnlichkeit bleiben außen vor**, solange ein Feld genannt ist — keine der beiden Quellen kann eine Feldangabe einhalten; die Deutungszeile schreibt es an ([useUnifiedSearch.ts](src/core/hooks/useUnifiedSearch.ts), [DeutungsZeile.tsx](src/plugins/suche/DeutungsZeile.tsx))
- **„So kannst du suchen"** auf der Startseite: sechs ausführbare Beispiele vom Thema bis zur Zwei-Felder-Anfrage ([SucheStartzustand.tsx](src/plugins/suche/SucheStartzustand.tsx))
- **Guard**: jedes Feld aus „alle Felder" braucht ein Präfix — sonst kann die Suche mehr, als sie sagt ([feldpraefix.test.ts](src/core/services/search/__tests__/feldpraefix.test.ts))

### v4.48.4 — Verlaufs-Leiste in Markenform: eckig, enger, lesbar (August 2026)

PATCH — Rückfrage zur neuen Leiste: warum sind die Chips rund? Weil sie das Filter-Idiom der App erben — nur ist diese Leiste zugleich die **Legende** der Marken in den Zeilen, und eine runde Legende neben einer eckigen Marke behauptet zwei verschiedene Dinge. Detail: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md).

- **Zweite Form am geteilten Chip** (`form="marke"`): eckig, häkchenlos, enger — gemessen 54–62 px statt Pillen mit Haken; die Pillen-Form bleibt überall sonst ([ToggleChip.tsx](src/components/ui/ToggleChip.tsx))
- **Zustand ohne Haken heißt Breite ohne Sprung**: die Schriftstärke bleibt in beiden Zuständen 500, sonst wandert die Nachbarschaft beim Klick (Pitfall #14, [DESIGN_GUIDE.md](DESIGN_GUIDE.md) Kap. 5)
- **Zahl im Chip war unter AA** — grau auf Weiß 2,85:1, jetzt 5,0:1; im getönten Zustand trägt sie `currentColor` statt 0,75 Deckkraft (die drückte 4,7:1 auf ~3,3:1) ([ToggleChip.tsx](src/components/ui/ToggleChip.tsx))
- **Träger-Chips nennen die Endung des Aktenzeichens** („TV 1 …426") — die laufende Nummer ordnet, zitieren lässt sie sich nicht ([VerlaufFilterLeiste.tsx](src/plugins/antraege/status/VerlaufFilterLeiste.tsx))
- **Marken enger und mit Umriss**: 3 statt 4 px Polster (17–20 px je Rollenmarke, 25 px für `TV1`), Rand auf `--tf-border-hover` — mit 0,08 Alpha las sich die Marke als loser grauer Text ([VerlaufBadges.tsx](src/plugins/antraege/status/VerlaufBadges.tsx))

### v4.48.3 — Kuerzel in der Schreibweise des Teams, Sprung mit Ziel (August 2026)

PATCH — Zwei Nachbesserungen an der Kürzel-Auswahl. Sie zeigte jedes Kürzel großgeschrieben — 81 der 112 Kürzel im Bestand sind aber gemischt geschrieben („THü", „JuHe"), und wer sein eigenes in einer Liste von 112 sucht, sucht es in seiner Schreibweise. Und „Kürzel ändern → Einstellungen" landete auf einer Seite mit acht Karten, ohne zu sagen, welche gemeint ist.

- **Die Auswahl zeigt die Schreibweise der Quelle** — verglichen und ins Profil geschrieben wird weiter die Normalform, damit die Identität nicht an einem Quellendetail hängt ([kuerzelOptionen.ts](src/plugins/auslastung/hooks/kuerzelOptionen.ts))
- **„THü" und „THu" sind wieder zu unterscheiden**: großgeschrieben trennte die beiden nur der Umlaut ([AntraegeSichtGruppe.tsx](src/plugins/einstellungen/profil/AntraegeSichtGruppe.tsx))
- **Alle drei Wege zur Kürzel-Einstellung springen mit `?sektion=sec-filter`** — der Hub scrollt die Karte an und lässt ihre Markierung stehen wie bei einem Suchtreffer ([BearbeiterSichtChip.tsx](src/components/bearbeiter/BearbeiterSichtChip.tsx), [HomePage.tsx](src/plugins/home/HomePage.tsx), [MeineAntraegeSection.tsx](src/plugins/home/MeineAntraegeSection.tsx))
- **Kollisionsregel im Test**: eine gemischte Schreibweise schlägt die normalisierte der `kuerzel-map`, egal welche Quelle zuerst gelesen wird ([kuerzelOptionen.test.ts](src/plugins/auslastung/__tests__/kuerzelOptionen.test.ts))

### v4.48.2 — Chronik: Rollenspalte fasst drei Marken, Monatslinie, dickerer Zeitstrahl (August 2026)

PATCH — Vier Rückmeldungen aus dem Gebrauch der neuen Chronik, drei davon Maße: die dritte Rollenmarke schob sich in den Ereignistext, die Monatsblöcke liefen ohne Trennung ineinander, und der Zeitstrahl-Balken blieb hinter dem Entwurf zurück. Detail: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md).

- **Die Rollenspalte fasst drei Marken** (76 statt 62 px, gemessen 67,5 belegt); mehr fällt zu „+n" zusammen, dessen Titel alle nennt — betrifft genau einen der 506 Codes ([VerlaufBadges.tsx](src/plugins/antraege/status/VerlaufBadges.tsx))
- **Rollen- und Träger-Marken sind schmaler** — ein Maß für beide, 4 statt 6 px Polster ([VerlaufBadges.tsx](src/plugins/antraege/status/VerlaufBadges.tsx))
- **Jeder Monatsblock beginnt mit einer Linie** über die ganze Breite, Monatsspalte eingeschlossen ([StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx))
- **Der Zeitstrahl-Balken ist 26 px hoch** statt 20 — das Maß des Entwurfs; die Schrift darin folgt der Konstanten statt einer eigenen Klasse ([VerlaufsBand.tsx](src/plugins/antraege/verlauf-band/VerlaufsBand.tsx))

### v4.48.1 — Startseiten-Kopf verschlankt, Sicht-Menue entrumpelt (August 2026)

PATCH — Die Startseite ist Einstieg, nicht Arbeitsfläche: unter der Begrüßung stand seit v4.47 eine eigene Zeile mit zwei Chips, obwohl der Betrachtungsbereich dort dieselbe Auskunft gibt wie im Förderanträge-Kopf und auch dort gewechselt wird. Das Sicht-Menü erklärte sich zudem mit einem Absatz, dessen Zusage („Ihr Kürzel bleibt dabei stehen") nach dem Umschalten sichtbar nicht mehr stimmte.

- **Der Kürzel-Chip steht neben der Begrüßung** statt in einer eigenen Zeile darunter — dieselbe Geometrie wie der `meta`-Slot im Förderanträge-Kopf ([HomePage.tsx](src/plugins/home/HomePage.tsx))
- **Bereichs-Chip nur noch dort, wo die Liste an ihm hängt**; das Startseiten-Aggregat verliert seine Ausblend-Zahl wieder ([useDashboardData.ts](src/plugins/home/useDashboardData.ts))
- **Sicht-Menü entrumpelt**: zwei Optionen, eine Zeile zu Reichweite und Gerätebindung, ein Weg in die Einstellungen ([BearbeiterSichtChip.tsx](src/components/bearbeiter/BearbeiterSichtChip.tsx))
- **Die unhaltbare Zusage ist raus** — nach dem Umschalten nennt der Chip „Alle Bearbeiter", das eigene Kürzel steht nur noch in der Option darunter ([home.md](docs/feedback-kontext/home.md))

### v4.48.0 — Chronik nach Schritt: Matrix ueber die Teilvorhaben, Rollenfarben, geteilter Filter (August 2026)

MINOR — Die Chronik kannte die Träger jedes Termins längst und faltete sie zu „3 Teilvorhaben" zusammen — genau die Auskunft, wegen der im Fachsystem der Verbund und danach jedes Teilvorhaben einzeln aufgerufen wird. Aus dem Design-Handoff `_design/handoff/chronik`, Teil 1 von 2 (der Zeitstrahl folgt).

- **Neue Ordnung „nach Schritt"** (Standard): eine Zeile je Kürzel, eine Spalte je Träger, dazu die TV-Streuung — an ZKN084412 gemessen 91 Schritte × 8 Spalten ([StatusSchrittMatrix.tsx](src/plugins/antraege/status/StatusSchrittMatrix.tsx), rein in [chronik-matrix.ts](src/core/status/chronik-matrix.ts))
- **Geteilte WER/WO-Leiste mit Fokus**: neutrale Einträge werden abgeblendet statt gefiltert — 144 der 505 Codes lässt das Fachsystem von jedem setzen ([verlauf-filter.ts](src/core/status/verlauf-filter.ts), [VerlaufFilterLeiste.tsx](src/plugins/antraege/status/VerlaufFilterLeiste.tsx))
- **Rollenfarben als Tokenfamilie** `--tf-rolle-*` für alle fünf Rollen inkl. Jur; die Filterleiste ist die Legende ([rollen-farbe.ts](src/core/status/rollen-farbe.ts), [theme.css](src/theme.css))
- **„Nach Datum" nennt die Teilvorhaben einzeln** statt „3 Teilvorhaben", und die Kopfzeile trennt Schritte von Datumsangaben ([VerlaufBadges.tsx](src/plugins/antraege/status/VerlaufBadges.tsx), [verlauf-kennzahlen.ts](src/core/status/verlauf-kennzahlen.ts))
- **Guard `rollen-farbe-eine-quelle`** misst den Kontrast jeder Rollenfarbe nach — fünf der zehn Werte des Entwurfs lagen unter 4,5:1 ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts), Doc: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md))

### v4.47.0 — Meine/Alle umschaltbar, Kuerzel-Auswahl vollstaendig (August 2026)

MINOR — „Meine Anträge" oder „alle" war bisher kein Zustand, sondern der WERT des Profil-Kürzels: umschalten hieß, die eigene Identität zu überschreiben und danach neu einzutippen. Dazu fand sich die halbe Zielgruppe in der Kürzel-Auswahl gar nicht — inaktive Kürzel waren ausgeblendet (fast jede PL ist als ehemalige Bearbeitung geführt), und die AB-Spalte wurde nie gesammelt.

- **Chip „Kürzel THÜ / Alle Bearbeiter" im Kopf von Förderanträgen und Startseite**, in beiden Zuständen sichtbar ([BearbeiterSichtChip.tsx](src/components/bearbeiter/BearbeiterSichtChip.tsx))
- **Eine Quelle für den Ausschnitt**: Liste, Startseiten-Aggregat, Kanban, Antragseingang und QS lesen denselben Modus ([useBearbeiterSicht.ts](src/core/hooks/useBearbeiterSicht.ts), pures `sichtModus` in [bearbeiterFilter.ts](src/plugins/antraege/bearbeiterFilter.ts))
- **Die Startseite zeigt jetzt auch ihren Betrachtungsbereich** — sie wandte ihn an, ohne es zu sagen ([HomePage.tsx](src/plugins/home/HomePage.tsx), `ausgeblendet` aus [useDashboardData.ts](src/plugins/home/useDashboardData.ts))
- **Kürzel-Auswahl führt AB-Kürzel und Ehemalige**: 33 rein administrative Kürzel waren nie wählbar, inaktive stehen als „· ehem." drin ([kuerzelOptionen.ts](src/plugins/auslastung/hooks/kuerzelOptionen.ts), [AntraegeSichtGruppe.tsx](src/plugins/einstellungen/profil/AntraegeSichtGruppe.tsx))
- **Der Inaktiv-Schalter wirkt nur noch auf Antragsmengen**, nicht mehr auf die Auswahl — samt Wegfall des Stale-Guards, der eine solche Wahl still zurücksetzte ([auslastung.md](docs/architecture/auslastung.md))

### v4.46.1 — Abgeleitete To-dos heissen ueberall abgeleitet (August 2026)

PATCH — Am To-do stand die Marke „geliehen", während die Rollen-Bilanz derselben Seite „davon 68 abgeleitet" zählte: zwei Wörter für eine Sache, und das ungewöhnlichere davon an der sichtbarsten Stelle. `quelle`, Tooltip und Herkunftsspalte des Exports sagten ohnehin schon „abgeleitet".

- **Die Marke am To-do heißt „abgeleitet"** — Antrag-Detail, Ausklapp-Kopfkarte und Gruppenkopf im Vorgangs-Board ([TodoAnzeige.tsx](src/components/vorgang/TodoAnzeige.tsx), [aufgabe.ts](src/plugins/antraege/ausklapp/kopfkarte/aufgabe.ts), [VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx))
- **Gleicher Wortlaut im Status-Cockpit und in der FB-Erhebung** ([TodoPlatzhalterListe.tsx](src/plugins/status-cockpit/TodoPlatzhalterListe.tsx), [fbErhebungExport.ts](src/plugins/status-cockpit/fbErhebungExport.ts))
- **Die geliehene Kürzel-Bezeichnung bleibt „geliehen"** — anderer Sachverhalt (ein Wortlaut aus einer fremden Projektform), eigener Schirm ([kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts), [VerlaufBefundeBlock.tsx](src/plugins/status-cockpit/VerlaufBefundeBlock.tsx))

### v4.46.0 — Statuseintraege einklappbar, Detailseite vertikal verdichtet (August 2026)

MINOR — „Statuseinträge" war der einzige Block der Statussektion ohne Klapp-Zustand und rollte ungefragt aus: gemessen 1.383 px für „Status & Verlauf", davon über zwei Drittel Ordner-Liste. Dazu trugen mehrere Klapp-Köpfe ihren Bodenabstand am Button statt am Rumpf — die Marge blieb stehen, wenn der Rumpf verschwand.

- **„Statuseinträge" ist einklappbar, Default zu** — Kopfzeile behält die Anzahl, die Rollen-Chips erscheinen mit dem Inhalt, den sie filtern ([StatusCodeListe.tsx](src/plugins/antraege/status/StatusCodeListe.tsx))
- **„Offene Aufgaben" zieht mit**: startet zu und merkt sich den Zustand wie seine zwei Nachbarn ([OffeneAufgaben.tsx](src/plugins/antraege/status/OffeneAufgaben.tsx), zwei neue Einträge in [detailSektionen.ts](src/plugins/antraege/detailSektionen.ts))
- **Eingeklappt kostet nur noch die Kopfzeile** — die hängenden Margen von Statussektion, Aufgaben und Kurzbeschreibung gelten jetzt nur bei offenem Rumpf
- **Der Rumpf der Statussektion trägt `gap` statt `mt-5`-Wrapper**: ein Block, der `null` liefert, zeichnete bisher trotzdem seine 20 px ([StatusDetailSection.tsx](src/plugins/antraege/status/StatusDetailSection.tsx))
- **Trenn-Abstände enger**: Sektionsrahmen 32 → 24 px, Daten-Sektionskopf 40 → 36 px ([detailRahmen.tsx](src/plugins/antraege/detailRahmen.tsx), [CollapsibleDataSection.tsx](src/plugins/antraege/CollapsibleDataSection.tsx))

Gemessen am echten Bestand (1400 px, ein Verbund mit 25 Statuseinträgen): „Status & Verlauf" aufgeklappt **1.383 → 400 px**, Detailseite zugeklappt 835 → 791 px.

### v4.45.0 — Kuerzel-Wortlaut folgt der Kuration in der ganzen App (August 2026)

MINOR — Chronik und Zeitstrahl liegen in derselben Sektion und zeigten für dasselbe Kürzel verschiedene Texte: die Chronik den kuratierten Wortlaut der Fassung, die Spur die einkompilierten Fremddaten. Auf dem echten Bestand betraf das 111 von 505 Kürzeln.

- **Die kuratierte Fassung gewinnt** — was die PL im Kürzel-Tab freigibt, wirkt jetzt auch in der Verlaufs-Spur ([kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts), [uebergaenge.ts](src/core/status/verlauf/uebergaenge.ts))
- **Außer bei form-divergenten Kürzeln**: dort bleibt der Katalog, weil eine flache Kuration „AB in DL" nicht von „AB in NW" unterscheiden kann — 26 Kürzel, gewollt
- **Dem Katalog unbekannte Kürzel** bekommen den kuratierten Namen statt gar keinen (36 Codes der flachen Zuarbeit)
- **Rollen bleiben beim Katalog**: `rollenLage` unterscheidet „jede Rolle" von „Rolle unbekannt", was die Fassung nicht ausdrücken kann
- **Guard** `kuerzel-text-folgt-der-kuration` ([conventions-status.test.ts](src/__tests__/conventions-status.test.ts)) + Verhalten in [kuerzel-overlay.test.ts](src/core/status/__tests__/kuerzel-overlay.test.ts)

### v4.44.1 — Suchbereich-Optionen tragen Suche in selbst (August 2026)

PATCH — Aufgeklappt liegt die Optionsliste über der Seite; die Beschriftung „Suchen in:" daneben ist dann verdeckt, und jede Zeile las sich für sich allein als „alle Felder", „nur Dokumente" — ohne die Frage, die sie beantwortet.

- **Jede Option trägt „Suche in: …"** — zugeklappt wie aufgeklappt, damit der Kasten auch nach einem Zeilenumbruch lesbar bleibt ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx))
- **Die vorangestellte Beschriftung entfällt** — sonst stünde dort „Suchen in: Suche in: alle Felder"; die Auswahl trägt sie jetzt als `aria-label`
- **Der Präfix ist reine Darstellung**: `SUCHBEREICH_LABEL` bleibt der nackte Name, den Tooltip und Guards lesen ([suchbereich.ts](src/core/services/search/suchbereich.ts))

### v4.44.0 — Suchbereich heisst alle Felder und ist wieder der Standard (August 2026)

MINOR — Gewünscht war ein Eintrag „in allen Feldern suchen", standardmäßig gewählt. Den gab es bereits — er hieß nur „Titel, Beschreibung, Dokumente" und nannte damit drei von acht Feldern. Zweimal wurde deshalb gemeldet, ein Feld werde nicht durchsucht; beide Male stimmte es nicht.

- **Der Standardbereich heißt „alle Felder"**, im Gegensatz zu den vier „nur …"-Wahlen; die Zusage hält ein Guard ([suchbereich.ts](src/core/services/search/suchbereich.ts), [wortstamm.test.ts](src/core/services/search/__tests__/wortstamm.test.ts))
- **Ein eingeengter Bereich markiert sich farbig** — er ist der einzige Schalter der Zeile, der Treffer verschwinden lässt, ohne dass am Ergebnis etwas davon steht ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx))
- **Der gemerkte Bereich wird einmalig zurückgesetzt** (Schlüssel-Bump): eine irgendwann gewählte Einschränkung schlug bisher für immer den Code-Standard ([useSuchOptionen.ts](src/core/hooks/useSuchOptionen.ts))
- **Kein zweiter Eintrag im Aufklapper**: ein Duplikat neben „alles" hätte dasselbe zweimal angeboten — die Felder waren nie das Problem, die Beschriftung war es

### v4.43.0 — Chronik zeigt das Kuerzel, Naechste Schritte klappt zu, DL-Praefix korrigiert (August 2026)

MINOR — Gemeldet war dreierlei: der Chronik fehlt das Kürzel, „Nächste Schritte" steht immer offen, und „DL-Gutachten" nennt eine Projektform, die nicht dazugehört. Die dritte Meldung führte auf eine Datenursache: die App trägt **zwei** Kürzel-Zuarbeiten, die sich bei 76 Codes widersprechen — und keine der beiden ist pauschal die richtige.

- **Die Chronik führt das Kürzel** in eigener Spalte zwischen Datum und Rolle, wie im Fachsystem — auch an den kanonischen Feldern (`AAE`, `ABB`) und an den Fehlzeilen ([StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx))
- **„Nächste Schritte (in C16 zu setzen)" klappt zu**, Default zu; die Anzahl bleibt im Kopf stehen, die Rollen-Chips wandern in den Rumpf ([NaechsteSchritte.tsx](src/plugins/antraege/status/NaechsteSchritte.tsx), Vorgabe zentral in [detailSektionen.ts](src/plugins/antraege/detailSektionen.ts))
- **`XKS` heißt wieder „Gutachten fertig"** statt „DL-Gutachten fertig - FB/AB", `XQS` „Gutachten QS fertig" — dazu vier belegte Schreibfehler ([seed-label-korrekturen.ts](src/core/status/seed-label-korrekturen.ts)); ausgeliefert über den bestehenden Cockpit-Block, nicht automatisch
- **Der Abgleich beider Zuarbeiten ist gemessen**: 335 wortgleich, 58 zu Recht formabhängig, 36 nur flach geführt, **76 widersprüchlich** — davon 6 entschieden, 70 als Wasserstand im Test festgehalten ([KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md))
- **Keine Vorrangregel zwischen den Quellen**: mal ist die flache veraltet (`XKS`), mal trägt die form-bewusste den Tippfehler (`Biref`, `Verwedungsnachweis`) — eine globale Übernahme tauschte Fehler gegen Fehler

### v4.42.0 — Suche findet die Projektbeschreibung wieder, Einrichtungen auch per Kuerzel (August 2026)

MINOR — Gemeldet war „der Antragsteller GMBU wird nicht gefunden, obwohl er da ist". Beim Nachmessen am Bestand fiel ein größerer Defekt auf: die alten Feld-Aliase des Suchkorpus trafen **0 von 14.225** Anträgen — die gesamte Projektbeschreibung fehlte im Suchindex. Sichtbar war das nur als dünner Bestand.

- **Korpus-Felder werden aus dem CSV-Schema aufgelöst** statt geraten (Spalten-CODE → `resolveFieldKey`, alte Listen als Fallback) — [korpusFeldAufloesung.ts](src/plugins/antraege/services/korpusFeldAufloesung.ts); zweiter Fall von [recurring-bug-classes](docs/architecture/recurring-bug-classes.md) Klasse 5
- **Projektbeschreibung ist wieder durchsuchbar**: 9.225 Anträge tragen sie; „Netzwerkpartner" findet in „nur Titel & Kurzbeschreibung" 696 statt 0 ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts))
- **Neue Trefferstelle „Web-Adresse"** aus der Kontakt-Mail (`bergmann@gmbu.de` → `gmbu.de`), im Bereich „nur Einrichtung" — „GMBU" findet 35 statt 0 Anträge ([trefferstelle.ts](src/core/services/search/trefferstelle.ts), [suchbereich.ts](src/core/services/search/suchbereich.ts))
- **Nur der Host, nie die Adresse**, ohne Top-Level-Domain in der Suchform, mit Sperrliste gegen Projektträger- und Freemail-Domains (`vdivde-it.de` steht 26.933× in der Quelle)
- **Der Beleg zeigt sich selbst**: Spalte „Web-Adresse" blendet sich bei einem Domain-Treffer ein ([autoSpalten.ts](src/plugins/suche/autoSpalten.ts)) — sonst stünde das Suchwort in keinem sichtbaren Feld der Zeile

### v4.41.0 — Karten-Menues fuer das obere Band, Rechtsklick app-weit gezaehmt (August 2026)

MINOR — Die zwei Karten über den Spalten trugen als einzige kein `⋯` und ließen sich als einzige nicht abschalten. Und das Browser-Menü, das v4.40.2 auf den Karten zurückgab, hilft hier niemandem: „Zurück", „Neu laden", „Seitenquelltext" sind in einer Datei-App ohne Seiten keine Antwort.

- **Beide Hero-Karten haben ihr eigenes `⋯`** — Resume: ausblenden + Arbeitsverlauf löschen; Alert: ausblenden, Kacheln abwählen, Fristen-Schwellen ([HeroMenue.tsx](src/plugins/home/anpassen/HeroMenue.tsx))
- **Ein Knopf für beide Wirte** statt zweier Kopien: `WidgetMenueKnopf` → [KartenMenueKnopf.tsx](src/plugins/home/anpassen/KartenMenueKnopf.tsx), Ziel-Vergleich über die reine `zielGleich`
- **`HomeWidgetConfig.hero`** additiv (fehlt = alles an); letzte Kachel weg ⇒ Karte aus, Karte an ⇒ Kacheln zurück ([homeWidgetsStore.ts](src/plugins/home/widgets/homeWidgetsStore.ts)) — Rückweg ist die Gruppe „Oben" im Widgets-Untermenü
- **Rechtsklick app-weit gezähmt**: Browser-Menü nur noch in Eingabefeldern, bei markiertem Text und mit Umschalt ([useBrowserKontextmenue.ts](src/core/hooks/useBrowserKontextmenue.ts), einmal am Dokument in der [ShellLayout](src/core/ShellLayout.tsx))
- **„Arbeitsverlauf löschen" wirkt sofort** — Zähler-Signal in den Effekt-Deps, sonst stünde die Karte unverändert da ([arbeitskontextSignal.ts](src/plugins/home/arbeitskontextSignal.ts)); Rückfrage-Wortlaut einmal geteilt

### v4.40.2 — Widget-Menue fuehrt nur noch eigene Punkte (August 2026)

PATCH — Das `⋯` eines Widgets führte „Widgets ▸" und „Darstellung ▸" mit: dieselben seitenweiten Punkte in jeder einzelnen Karte. Und der Rechtsklick auf eine Karte öffnete dasselbe Menü ein zweites Mal — dafür nahm er der Karte das Browser-Menü samt Kopieren.

- **Widget-Menü führt nur widget-eigene Punkte** (Ausblenden, Ein-/Aufklappen, Verschieben, Widget-Einstellungen); der Trenner gehört zum Eintrag, das Menü endet nie mit einer Linie ([WidgetMenue.tsx](src/plugins/home/anpassen/WidgetMenue.tsx))
- **„Widgets ▸"/„Darstellung ▸" stehen allein im Menü der freien Fläche** ([FlaechenMenue.tsx](src/plugins/home/anpassen/FlaechenMenue.tsx))
- **Rechtsklick auf eine Karte öffnet kein Menü mehr** — `[data-widget-id]` ist jetzt die Sperre des Rechtsklicks statt seiner Zielwahl (`darfMenueOeffnen`, [useStartseiteMenue.ts](src/plugins/home/anpassen/useStartseiteMenue.ts))
- **Reißleine gegen die Rückkehr**: reine Regel + Quelltext-Guards für beide Zuständigkeiten ([menueZustaendigkeit.test.ts](src/plugins/home/anpassen/__tests__/menueZustaendigkeit.test.ts))
- Zuständigkeits-Schnitt dokumentiert ([home-widgets.md](docs/architecture/home-widgets.md))

### v4.40.1 — Startup-Freigabe: Karte laeuft mit den Browser-Dialogen mit (August 2026)

PATCH — Chrome zeigt unter `file://` inzwischen mehrere Freigabe-Dialoge hintereinander, die Karte buchte den Fortschritt aber erst hinter der Kette: sie stand während aller drei Abfragen auf „Schritt 1 von 3" und sprang dann in die App. Und ein fehlgeschlagener Rescan buchte alle offenen Ordner als gewährt — der dritte wurde nie gefragt.

- **Fortschritt wird nach jedem Grant gebucht und gerendert** (`buchErgebnis`), laufende Zeile sagt „wartet auf Ihre Bestätigung" ([GuidedGrantSteps.tsx](src/core/components/GuidedGrantSteps.tsx))
- **Enge Kette**: kein Rescan mehr zwischen zwei Prompts — er verbrauchte das Activation-Fenster des nächsten; einer am Ende genügt ([GuidedGrantSteps.tsx](src/core/components/GuidedGrantSteps.tsx))
- **Gescheiterter Rescan bucht keinen Erfolg mehr** — Fehlerpfad liefert `null` statt eines leeren Sets ([guided-grant-progress.ts](src/core/components/guided-grant-progress.ts))
- **Rest-Ordner wird benannt** statt still übersprungen („Noch ein Ordner offen…", Enter genügt) ([GuidedGrantSteps.tsx](src/core/components/GuidedGrantSteps.tsx))
- **Bug-Klasse fortgeschrieben**: Activation ist zeit-, nicht zählbegrenzt; Reload ≠ Neustart als Repro-Falle ([recurring-bug-classes.md §2](docs/architecture/recurring-bug-classes.md))

### v4.40.0 — Kuration und Developer klappen zu, Datenpflege statt zweimal Kuration (August 2026)

MINOR — Nachlese zum Kuration-Umbau, aus dem Blick auf die fertige Seitenleiste: „Kuration" stand dort zweimal untereinander (Überschrift und einziger Eintrag darunter), die beiden unteren Gruppen ließen sich als einzige nicht wegräumen, und „Verzeichnisse" heißt in dieser App sonst überall Ordner auf der Platte.

- **Gruppen „Kuration" und „Developer" sind zuklappbar** (Standard offen, gemerkt je Gerät; zugeklappt bleibt der aktive Eintrag stehen) ([ShellLayout.tsx](src/core/ShellLayout.tsx))
- **Der Hub heißt in der Seitenleiste „Datenpflege"** — die Gruppe behält den Oberbegriff; Seitenname aus EINER Quelle ([kurationPanels.tsx](src/plugins/kuration/kurationPanels.tsx))
- **Panel „Verzeichnisse" → „Förderprogramme"**, Ordner und Panel-Id ziehen mit ([FoerderprogrammePanel.tsx](src/plugins/kuration/foerderprogramme/FoerderprogrammePanel.tsx)); die Redirects zeigen aufs neue Ziel ([routes.ts](src/core/routes.ts))
- **„Werkbank (dev)" → „Developer"** ([groupNavPlugins.ts](src/core/nav/groupNavPlugins.ts))
- **Vier Wegweiser im Text nachgezogen**, die noch die alte Menüführung nannten (CSV-Wizard, Drift-Dialog, leere Antragsliste, Eval-README)

### v4.39.2 — Feedback-Fenster: breiter, Titel ermuntert, Boxen ziehbar (August 2026)

PATCH — Weitere Nachlese aus dem Testbetrieb: 420 px waren beim Tippen zu eng, „(optional)" im Titel-Platzhalter beantwortete die Frage „muss ich?" mit nein, und das Schluss-Leerzeichen des Seiten-Präfix fiel beim Rendern weg.

- **Panel 420 → 470 px**, Schlüssel-Bump `…_v3` ([FeedbackPanel.tsx](src/components/feedback/FeedbackPanel.tsx))
- **Titel-Platzhalter ermuntert statt zu relativieren** („bitte kurz benennen, worum es geht"); technisch bleibt der Titel optional ([FeedbackInputStep.tsx](src/components/feedback/FeedbackInputStep.tsx))
- **Abstand hinter dem Seiten-Präfix aus dem Rand** statt aus dem Leerzeichen — der zusammengesetzte Titel behält es ([FeedbackInputStep.tsx](src/components/feedback/FeedbackInputStep.tsx))
- **Textboxen vertikal ziehbar** (`resize-y`), Startgröße unverändert knapp; die Screenshot-Ablage bleibt fest ([feedback-system.md](docs/architecture/feedback-system.md))

### v4.39.1 — Feedback-Erfassung: Aufnahme zuerst, Bild gross, Panel durchscheinend (August 2026)

PATCH — Nachlese zu v4.37 aus dem Testbetrieb: die Aufnahme stand hinter der Einfüge-Fläche, das Präfix im Titelfeld verdeckte den Platzhalter, und der Typ-Wechsel warf den getippten Text weg (der Screenshot blieb — was den Verlust wie einen Fehler aussehen ließ).

- **Aufnahme zuerst, prominenter, mit Mehrfach-Hinweis** ([FeedbackScreenshotInput.tsx](src/components/feedback/FeedbackScreenshotInput.tsx)): ab dem ersten Bild heißt der Knopf „Weiteren Bereich aufnehmen"
- **Miniaturbild öffnet die Vollansicht** — eine Lightbox für Erfassung UND Ticket-Screenshots ([FeedbackBildLightbox.tsx](src/components/feedback/FeedbackBildLightbox.tsx))
- **Typ-Wechsel verwirft nichts mehr**, Seiten-Präfix steht fest im Titel-Rahmen statt im Wert ([FeedbackInputStep.tsx](src/components/feedback/FeedbackInputStep.tsx))
- **Panel zu 88 % deckend + Weichzeichner**, Titel auf 15 px ([FeedbackPanel.tsx](src/components/feedback/FeedbackPanel.tsx))
- **Annotator und Lightbox per Portal an den Body** — `backdrop-filter` macht den Wirt zum Bezugsrahmen für `fixed` (neue [Bug-Klasse 22](docs/architecture/recurring-bug-classes.md))

### v4.39.0 — Werkbank-Gruppe, ein Sperr-Hinweis, gleicher Rahmen (August 2026)

MINOR — Abschluss des Kuration-Umbaus: der Rand um den Hub. Die Entwickler-Panels standen unter „Kuration", obwohl sie weder kuratorpflichtig sind noch etwas kuratieren; die verbliebene eigenständige Seite trug einen anderen Rahmen als der Hub daneben.

- **Sidebar-Gruppe „Werkbank (dev)"** ([groupNavPlugins.ts](src/core/nav/groupNavPlugins.ts)): die zwei DEV-Panels stehen unter eigenem Namen; ihre Flags sind in allen vier Variant-Configs genau dort `true`, wo `kuratorMenus` es ist — die Verfügbarkeit ändert sich in keiner
- **Dokument-Review trägt denselben Seitenkopf wie der Hub** ([DokumentReviewPage.tsx](src/plugins/dokument-review/DokumentReviewPage.tsx)): Titel links, Hilfe-Knopf am Blattrand — vorher stand dort nur der Knopf, ohne Titel
- **Der Sperr-Hinweis ist ein Bauteil** ([KuratorGesperrtHinweis.tsx](src/components/kurator/KuratorGesperrtHinweis.tsx)): die letzte Handkopie (Skill-Verwaltung) nutzt ihn mit `gesperrt`, weil ihr Schreibrecht zusätzlich an der Build-Variante hängt
- **Doku nachgezogen**: die geteilte Seitenform steht in der Entscheidungstabelle ([ui-muster.md](docs/architecture/ui-muster.md)), das Cheatsheet gilt für beide Hubs ([add-settings-section.md](docs/agents/add-settings-section.md)), Kuration ist auditiert ([layout-audit.md](docs/layout-audit.md))
- **Zwei Leichen entfernt**: das Kontext-Doc des seit v2.394 nicht mehr existierenden `feedback-kuration` und seine Guard-Ausnahme — eine Ausnahme für eine tote Id entschuldigt still den nächsten Bewohner desselben Namens

### v4.38.0 — CSV-Quellen wird ein Panel (August 2026)

MINOR — Auf Nutzerwunsch zieht auch die CSV-Quellen-Seite in den Hub. Damit ist die Kuration eine Seite mit fünf Panels; die Navigationsspalte liest sich als Weg, den die Daten nehmen: Übersicht → CSV-Quellen → Verzeichnisse → Suche & Index → Dienste.

- **Panel „CSV-Quellen"** ([CsvQuellenPanel.tsx](src/plugins/kuration/csv-quellen/CsvQuellenPanel.tsx)): links die Quellen mit ihren Aktionen, rechts der Zustand — Quellen, Zeilen, letzter Import, offene Aktualisierungen; Wartung und Wiederherstellung eingeklappt
- **Der Ordner `csv-sources-kuration/` bleibt** ([project-structure.md](docs/architecture/project-structure.md)): umgezogen ist, was nur Seite war — dort liegt auch die Auto-Refresh-Maschine, die App und Shell beim Start hochfahren
- **Ein Satz über die CSV-Frische, drei Orte**: Panel, Übersicht und der Punkt „● CSV" lesen `csvFreshnessAussage` ([csv-freshness-state.ts](src/plugins/csv-sources-kuration/services/csv-freshness-state.ts))
- **Sidebar-Kuration: vier Einträge statt neun** ([plugins.config.ts](src/plugins.config.ts)) — Kuration · Dokument-Review · DEV: State · DEV: Infra
- **Veralteter Plugin-Baum berichtigt** ([project-structure.md](docs/architecture/project-structure.md)): er führte `kurator/`, `dokumentenquellen-kuration/` und den Feedback-Redirect noch als Plugins

### v4.37.0 — Feedback-Erfassung: schmaler, kuerzer, Screenshot ohne Sichtblockade (August 2026)

MINOR — Der Erfassungs-Dialog kam aus dem Testbetrieb mit fünf Rückmeldungen zurück: zu breit, zu lang, zu viel zu tippen — und er verdeckte genau den Bildschirm, den man screenshotten wollte. Gemessen: 520 × 877 px → 420 × 535 px bei gleichem Funktionsumfang.

- **„Bereich aufnehmen (Win+Shift+S)" klappt das Panel weg** und fängt den Strg+V global ab ([FeedbackScreenshotInput.tsx](src/components/feedback/FeedbackScreenshotInput.tsx)) — der Entwurf bleibt dabei stehen ([FeedbackPanel.tsx](src/components/feedback/FeedbackPanel.tsx))
- **„Was hast du gemacht?" ist in „Was ist passiert?" aufgegangen** — `legacy`-Felder bleiben im Schema, nur nicht mehr im Formular ([constants.ts](src/components/feedback/constants.ts))
- **Bereichsauswahl als unauffälliges Dropdown oben rechts** („Seite: Home" statt „— Auto-erkannt: Home —"), Titel mit der erkannten Seite vorbelegt ([FeedbackInputStep.tsx](src/components/feedback/FeedbackInputStep.tsx))
- **Sieben Zeilen weniger**: App-Kontext und Verbessern-Erklärung als ⓘ, Dateiformate in der Ablage-Fläche ([FeedbackFileInput.tsx](src/components/feedback/FeedbackFileInput.tsx))
- **Breite 520 → 420 mit Schlüssel-Bump** (`teamflow_feedback_panel_width_v2`) — ohne ihn schlüge die gemerkte Breite den neuen Default; Detail in [feedback-system.md](docs/architecture/feedback-system.md)

### v4.36.0 — Programme und Filter werden ein Panel (August 2026)

MINOR — Zwei weitere Kurator-Seiten werden ein Panel. Beide beschreiben dieselbe Sache — die Ordnung, in der die importierten Daten stehen — und hängen an derselben Voraussetzung: dem aktiven Programm. Die Filterseite nannte es nie, obwohl ihre Liste daran hing.

- **Panel „Verzeichnisse"** ([VerzeichnissePanel.tsx](src/plugins/kuration/verzeichnisse/VerzeichnissePanel.tsx)): Programme, Unterprogramme und Filter auf einer Seite; jede Gruppe nennt das Programm, für das sie gilt
- **Drei Filter-Reiter werden drei Klappen mit Zähler** ([FilterGruppe.tsx](src/plugins/kuration/verzeichnisse/filter/FilterGruppe.tsx)): alle drei Bestände sind gleichzeitig sichtbar, statt zwei davon hinter Reitern zu liegen
- **Ein Sperr-Hinweis statt vier Handkopien** ([KuratorGesperrtHinweis.tsx](src/components/kurator/KuratorGesperrtHinweis.tsx)): die alten Kopien wiesen seit v4.28 auf einen Einstellungs-Weg, den es nicht mehr gibt
- **Panel ohne Nebenspalte bleibt einspaltig** ([settings-layout.css](src/components/settings/settings-layout.css)): bis hierher räumte das Raster der leeren zweiten Spalte 43 % ein — Listen-Panels standen auf halber Seite
- **Zwei Wege repariert**: `/admin/unterprogramme` hat wieder ein Ziel ([routes.ts](src/core/routes.ts)); „Öffnen" auf der Suchindex-Zeile der Übersicht landete seit v4.35 auf der Startseite ([UebersichtPanel.tsx](src/plugins/kuration/uebersicht/UebersichtPanel.tsx))

### v4.35.0 — Suchindex und Dokumentenquellen werden ein Panel (August 2026)

MINOR — Zwei Seiten, die dieselbe Frage beantworten, werden ein Panel: welche Ordner der Index einliest und wie er danach steht. Der Tab-Schnitt „Übersicht"/„Verwaltung" entfällt — er trennte die Aktion von dem Zustand, auf den sie wirkt.

- **Panel „Suche & Index"** ([SucheIndexPanel.tsx](src/plugins/kuration/suche-index/SucheIndexPanel.tsx)): links Aktionen und Dokumentenquellen, rechts der Zustand — man sieht beim Indexieren zu, statt danach den Reiter zu wechseln
- **Zwei Plugins weniger** ([plugins.config.ts](src/plugins.config.ts)): `kurator` und `dokumentenquellen-kuration` sind in den Hub gezogen; `/kuration/suchindex` und `/kuration/dokumentenquellen` leiten ins Panel bzw. auf die Gruppe
- **Seltenes steht eingeklappt**: Modell-Konfiguration, Suchqualität, Zurücksetzen und der Embedding-Korpus-Status liegen hinter zwei Klappen statt dauerhaft im Blick
- **Legacy-Whitelist zieht mit** ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts)): ein Umzug darf alte Schuld weder als neu melden noch still aus der Bewachung fallen lassen

### v4.34.0 — Kuration wird ein Hub mit Lage-Uebersicht (August 2026)

MINOR — Die Kuration bekommt die Seitenform der Einstellungen und endlich einen Ort, der sagt, was ansteht. Bis hierher war der Zustand der Daten auf sieben Seiten verstreut: man musste jede aufsuchen, um zu erfahren, dass dort nichts zu tun war.

- **Hub `/kuration`** ([kuration/](src/plugins/kuration/)): Navigationsspalte, Suche über alle Abschnitte, Sprungmarke — Panels „Übersicht" und „Dienste"
- **Panel „Übersicht"** ([UebersichtPanel.tsx](src/plugins/kuration/uebersicht/UebersichtPanel.tsx)): Suchindex, CSV-Import und Dokument-Prüfung mit echtem Zustand (auch im Ruhezustand sichtbar), rechts die Kurator-Sitzung samt „Sperren"
- **Eine Quelle je Aussage**: die Index-Ampel ([indexAmpel.ts](src/core/services/search/indexAmpel.ts)) und der CSV-Satz ([csv-freshness-state.ts](src/plugins/csv-sources-kuration/services/csv-freshness-state.ts)) werden gelesen, nicht neu hergeleitet — Guard `kuration-hub-eine-schicht` hält den Hub auf der geteilten Schicht
- **„E-Mail Anfragen: Einstellungen" ist Panel „Dienste"** — ein Menüpunkt für ein Textfeld weniger; `/kuration/anfragen` leitet dorthin ([routes.ts](src/core/routes.ts))
- **Zwei tote Wege repariert**: `/admin/feedback` zeigte auf `/kuration/feedback`, das es seit v2.364 nicht gibt (jetzt `/feedback-board`); `/admin/unterprogramme` ist entfallen

### v4.33.0 — Einstellungs-Seitenform wird geteilte Schicht (August 2026)

MINOR — Vorbereitung des Kuration-Hubs: die Seitenform, die das Einstellungs-Redesign hervorgebracht hat, bekommt einen zweiten Wirt. Bis hierher ändert sich nichts Sichtbares — die Einstellungen sind die Nullprobe.

- **Layout-Schicht geteilt** ([components/settings/](src/components/settings/)): die 16 Bauteile, die Navigationsspalte und der Panel-Vertrag stehen nicht mehr unter `plugins/einstellungen/_shared`, sondern als domänenfreie Schicht in `src/components/`
- **`SettingsHubPage` extrahiert** ([SettingsHubPage.tsx](src/components/settings/SettingsHubPage.tsx)): Kopf, Spaltenraster, Sprung-Zähler, Scroll und stehende Markierung liegen genau einmal; `EinstellungenPage` ist ein Aufrufer von 23 Zeilen
- **CSS kommt vom Modul, nicht von der Seite** ([settings-layout.css](src/components/settings/settings-layout.css)): ein Wirt, der den seitenlokalen Import nicht spiegelt, stünde einspaltig und ohne Trefferring da, ohne dass etwas fehlschlägt
- **Hilfe-Knopf-Guard kennt den Hub-Einbau** ([seitenHilfe.test.ts](src/core/services/feedback/__tests__/seitenHilfe.test.ts)): eine Seite darf ihre `pluginId` an den Rahmen reichen, statt den Knopf selbst zu schreiben

### v4.32.0 — Einstellungs-Suche nennt ihr Ziel, KI-Variante entdoppelt (August 2026)

MINOR — Nachlese am Redesign. Die Suche sprang auf die richtige Seite, ließ den Nutzer dort aber suchen: der Treffer blitzte 1,8 s auf, und wenn die Seite gar nicht scrollen musste, bewegte sich überhaupt nichts. Dazu zwei Stellen, die sich selbst erklärten statt zu wirken.

- **Trefferzeile nennt den Weg** ([SettingsNav.tsx](src/plugins/einstellungen/SettingsNav.tsx), [settingsPanels.tsx](src/plugins/einstellungen/settingsPanels.tsx)): „Mein Profil › Persönlicher Assistent" statt nur der Seite; neues Registry-Feld `gruppe`, gehalten vom Guard `settings-treffer-weg`
- **Markierung bleibt stehen**, bis der Nutzer das nächste Mal klickt oder tippt ([settings-layout.tsx](src/plugins/einstellungen/_shared/settings-layout.tsx), [einstellungen-layout.css](src/plugins/einstellungen/einstellungen-layout.css)) — deklarativ aus dem Sprung-Kontext statt per `classList`-Griff, Scroll zentriert statt oben
- **Fußzeile „Suche mit Strg + , · Details überall hinter ⓘ" entfernt** samt Kürzel: es stand 22 px unter dem Suchfeld und setzte den Cursor in genau dieses Feld
- **KI-Variante entdoppelt** ([KiVariantSelector.tsx](src/core/components/KiVariantSelector.tsx)): neue Stufe `nurSteuerung` — Label und Erklärung liefert die Zeile, der eigene Erklärabsatz lief in der Nebenspalte über den Kartenrand
- **`SettingsOption` bricht um statt zu überlappen**: zu breite Steuerung rutscht in die zweite Zeile (Mindestbreite am engsten Wirt gemessen, nicht geschätzt)

### v4.31.0 — Interne KI zweispaltig, Suche klappt ihr Ziel auf (August 2026)

MINOR — Letzte Etappe des Einstellungs-Redesigns. Die vierte Seite steht zweispaltig, und beim Abnehmen fiel auf, dass die Suche ihr Sprungziel nur dann aufklappte, wenn es auf derselben Seite lag — ausgerechnet der Sprung auf eine andere Seite blieb wirkungslos.

- **Seite „Interne KI" zweispaltig** ([ki/](src/plugins/einstellungen/ki/)): links die Verbindung mit Statuskarte und der Einrichtung in fünf Schritten, rechts Antwortverhalten und Recherche-Ziele; die dev-Werkbank (Provider, zwei Eval-Panels, Zweit-LLM) steht eingeklappt darunter
- **Kontextfenster als Automatik/Manuell** ([AntwortverhaltenGruppe.tsx](src/plugins/einstellungen/ki/AntwortverhaltenGruppe.tsx)) mit der Zeichenzahl in Klartext statt nur in Tokens
- **Sprungziel klappt idempotent auf** ([useCollapsedSection.ts](src/core/hooks/useCollapsedSection.ts), [settings-layout.tsx](src/plugins/einstellungen/_shared/settings-layout.tsx)): ein Toggle aus dem Mount-Effekt hebt sich im StrictMode auf — neue Bug-Klasse 21 in [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)
- **Doku nachgezogen**: neun Architektur-Docs auf die neuen Dateipfade, [einstellungen.md](docs/feedback-kontext/einstellungen.md) (zugleich Seiten-Hilfe) neu geschrieben, Cheatsheet [add-settings-section.md](docs/agents/add-settings-section.md) angelegt
- Damit sind die vierzehn `*Tab.tsx`/`*Section.tsx`-Dateien der alten Einstellungen vollständig in vier Seiten-Ordner aufgelöst

### v4.30.0 — Darstellung und Daten zweispaltig (August 2026)

MINOR — Dritte Etappe des Einstellungs-Redesigns: „Darstellung & Bedienung" und „Daten & Verbindungen" stehen zweispaltig. Die sieben `*Tab.tsx`-Dateien dahinter sind in Gruppen aufgegangen; die langen Erklärabsätze stehen im ⓘ, das Seltene in Klappen mit Zähler.

- **Zwei Seiten, sieben Gruppen** ([darstellung/](src/plugins/einstellungen/darstellung/), [daten/](src/plugins/einstellungen/daten/)): `DarstellungTab`, `TastaturTab`, `WidgetsSettingsSection`, `SpeicherTab`, `TagsTab`, `OnlineTab` und `DokumentenquellenTab` sind darin aufgelöst
- **Ein Schalter je Widget statt zweier Zustands-Pillen** ([WidgetsGruppe.tsx](src/plugins/einstellungen/darstellung/WidgetsGruppe.tsx)); ausgeschaltete Zeilen sind gedimmt, der Zähler nennt jetzt auch den Nenner („13 von 15 sichtbar")
- **Reihenfolge bleibt bei den Pfeilen**: der Griff aus dem Prototyp verspricht ein Ziehen, das die Widget-Verwaltung nicht kennt
- **Team-Status-Liste und Tag-Liste stehen in Klappen** („1 online · 1 zuletzt aktiv", Tag-Anzahl) — beide vollständig, nur nicht mehr dauerhaft aufgeschlagen
- **Key-Bump für die Widget-Klappe**: der alte Abschnitt war offen und hatte das persistiert — ohne neuen Schlüssel bliebe er bei jedem Bestandsnutzer offen ([default-aendern-braucht-key-bump](docs/architecture/recurring-bug-classes.md))

### v4.29.0 — Mein Profil zweispaltig (August 2026)

MINOR — Zweite Etappe des Einstellungs-Redesigns: „Mein Profil" steht zweispaltig. Links, was du über dich pflegst (Account, Fachprofil), rechts, was daraus folgt (welche Anträge du siehst, welche Module offen sind, was der Assistent mitschreibt). Kein Bereich entfällt — was selten gebraucht wird, steht eingeklappt mit Zähler.

- **Fünf Gruppen statt neun ALL-CAPS-Sektionen** ([profil/](src/plugins/einstellungen/profil/)): `ProfilTab`, `MeineTechnologienTab`, `AssistentTab`, `GedaechtnisSektion` und `ModulFreischaltungSection` gehen darin auf; Zustand + Auto-Save des Fachprofils liegen in [useFachprofil.ts](src/plugins/einstellungen/profil/useFachprofil.ts)
- **Zähler aus dem echten Zustand**: „13 von 30 aktiv" (Themen), „3 Begriffe" (Kompetenzen), „N Ereignisse" (Protokoll), Restlaufzeit je Modul als Status-Badge
- **Gedächtnis-Verwaltung bleibt vollständig**, nur eingeklappt ([GedaechtnisVerwaltung.tsx](src/plugins/einstellungen/profil/GedaechtnisVerwaltung.tsx)) — der Prototyp zeigt an dieser Stelle nur den Schalter
- **Der Kopf zeigt den echten Speicher-Zustand** statt einer festen Textmarke ([ProfilPanel.tsx](src/plugins/einstellungen/profil/ProfilPanel.tsx)); vor dem ersten Schreiben steht dort die Zusage „Automatisch gespeichert"
- **Zwei Anzeigefehler nebenbei**: die Kürzel-Pille behauptete „Kürzel ALLE" (der Aus-Zustand des Filters), und die Zusammenfassung nannte Hauptkategorie und Antragstypen auch ohne Programm-Id

### v4.28.0 — Einstellungen: vier Seiten statt fünf, Details hinter dem ⓘ (August 2026)

MINOR — Erste Etappe des Redesigns aus `_design/handoff/einstellungen-zweispaltig`: Registry, Navigation und die Bauteile, auf denen die vier Seiten danach entstehen. Die Inhalte selbst stehen noch wie bisher; sichtbar ändert sich der Menüschnitt und die Art, wie Erklärungen erscheinen.

- **„Meine Technologien" ist kein eigener Menüpunkt mehr** ([settingsPanels.tsx](src/plugins/einstellungen/settingsPanels.tsx)): vier Seiten statt fünf, flache Liste statt zweier Gruppen — die fünf `sec-`Anker wandern unverändert nach „Mein Profil" und behalten den alten Menünamen als Suchbegriff
- **Das ⓘ öffnet auf Klick statt auf Hover** ([settings-primitives.tsx](src/plugins/einstellungen/_shared/settings-primitives.tsx)): Voraussetzung dafür, dass die Erklärabsätze der Seiten dort hineinziehen — ein Tooltip verschwindet beim Lesen
- **Neue Layout-Schicht** ([settings-layout.tsx](src/plugins/einstellungen/_shared/settings-layout.tsx), [einstellungen-layout.css](src/plugins/einstellungen/einstellungen-layout.css)): Zweispalten-Rumpf, Gruppen-Karte, Options-Zeile, Klappe, Stepper — Umbruch über eine Container-Query, weil die App-Sidebar ziehbar ist
- **Der Sprung der Suche klappt sein Ziel auf** ([EinstellungenPage.tsx](src/plugins/einstellungen/EinstellungenPage.tsx)): Sprung-Kontext statt nur Scroll; der Scroll läuft jetzt über `setTimeout` statt `requestAnimationFrame`, das im Hintergrund-Tab ruht
- **Zwei tote Suchtreffer geheilt**: `sec-gedaechtnis-eval` stand nie im Index, `sec-arbeitsverlauf`/`sec-verzeichnisse` hatten keinen Anker ([SpeicherTab.tsx](src/plugins/einstellungen/SpeicherTab.tsx))

### v4.27.0 — Der Rest der CSV-Bugjagd (August 2026)

MINOR — Die letzten neun Befunde der CSV-Bug-Jagd. Zwei ändern das Verhalten spürbar: eine korrigierte Spalten-Typ-Angabe wirkt jetzt, und der Beispieldaten-Knopf kann keinen belegten Suchindex mehr leeren.

- **Der Typ geht in den Row-Hash ein** ([hash.ts](src/core/services/csv/hash.ts), [csv-import.md](docs/architecture/csv-import.md)): eine Korrektur `string → date` galt bisher als „keine Änderung", also lief die Koerzion nie — Preis ist ein einmaliger Voll-Merge beim ersten Import nach dem Update
- **Der Seed rührt einen belegten Suchindex nicht mehr an** ([seed-data.ts](src/core/services/seed/seed-data.ts), [IndexManager.tsx](src/plugins/kurator/IndexManager.tsx)): das Bestands-Gate stand hinter `createOramaDB`, und der Knopf war sichtbar, weil er den alten Seed-Flag las
- **Abbruch und Checksum beschreiben wieder die Quelldatei** ([importer.ts](src/core/services/csv/importer.ts)): die Share-Kopie wird erst nach der Abbruch-Schranke ersetzt, und `file_checksum` wird nur für ein echtes `File` gestempelt
- **Ein Master bleibt ein Master** ([CsvSourceWizard.tsx](src/plugins/csv-sources-kuration/wizard/CsvSourceWizard.tsx), [schema-config-transfer.ts](src/plugins/csv-sources-kuration/services/schema-config-transfer.ts)): der Wizard löst die bisherige Master-Quelle wirklich ab, und ein Konfig-Import zieht keinen fremden `join_key` hinein
- **Vier Dialog-Importe nehmen das Daten-Mutations-Gate**, `isListViewProjectionCurrent` prüft auch die Schema-Signatur, und vier UI-Zusagen zur Spalten-Reihenfolge stimmen wieder

### v4.26.0 — Das Kanban-Fenster hat eigene Bahnen (August 2026)

MINOR — Im Kanban-Fenster widersprach das Einstellungs-Panel dem Bild daneben: „Wartet auf Antragsteller" stand angehakt da und war nicht zu sehen, „Bewilligt" ohne Haken war die größte Bahn. Das Fenster las die Einstellung gar nicht — es leitete seine Bahnen aus dem Bestand ab. Jetzt hat es eine eigene.

- **Eigene Bahnen je Fenster** ([types.ts](src/plugins/home/widgets/types.ts), [home-widgets.md](docs/architecture/home-widgets.md)): Auswahl, Reihenfolge und Kartenspalten (1–3) in `vollbildLanes` — die Startseite behält ihre; Farben und Datenbasis bleiben geteilt
- **Vier reine Funktionen statt einer Ableitung** ([kanbanLanes.ts](src/plugins/home/widgets/kanbanLanes.ts)): Clustering, Startvorschlag, Projektion, toleranter Leser; `ZWEISPALTIG_AB` schlägt nur noch vor, statt zu überstimmen
- **Das Fenster projiziert selbst** ([KanbanVollbild.tsx](src/plugins/home/widgets/KanbanVollbild.tsx), [fenster-in-fenster.md](docs/architecture/fenster-in-fenster.md)): es bekommt die Karten aller Kategorien, damit eine wieder eingeblendete Bahn auch dann Karten hat, wenn die Startseite ausgehängt ist
- **Panel ohne Kontext-Nachbau** ([VollbildEinstellungen.tsx](src/plugins/home/widgets/VollbildEinstellungen.tsx)): reine Props statt `StorageContext`-Provider im zweiten React-Baum, mit Pfeilspalte und „Anordnung zurücksetzen"; Panel 340 px (die Pfeile kosten den Namen 44 px)
- **Verschieben hat eine Heimat** ([laneFolge.ts](src/components/ui/laneFolge.ts)): `verschiebeUmEinen` teilt sich mit dem Feedback-Board, statt die Index-Arithmetik ein zweites Mal zu buchstabieren

### v4.25.0 — Kurations-Klicks raeumen auf, was sie anrichten (August 2026)

MINOR — Fünf Befunde der CSV-Bug-Jagd an den Kurations-Klicks: jeder tat weniger, als er zusagte, und was liegen blieb, fiel erst Tage später beim nächsten Import auf.

- **„Quelle löschen" räumt auf** ([quelle-entfernen.ts](src/plugins/csv-sources-kuration/services/quelle-entfernen.ts), [csv-import.md](docs/architecture/csv-import.md)): Row-Hashes und Anträge fallen sofort statt Stück für Stück beim nächsten Import einer anderen Quelle — der Bestätigungstext sagt jetzt, was wirklich passiert
- **Ein abgebrochenes Re-Mapping nimmt sein Schema zurück** ([RemapCsvColumnsDialog.tsx](src/plugins/csv-sources-kuration/RemapCsvColumnsDialog.tsx), [CsvAddColumnsDialog.tsx](src/plugins/csv-sources-kuration/CsvAddColumnsDialog.tsx)): sonst trug das Schema das neue Mapping und die Daten das alte, dauerhaft
- **Der Auto-Adopt überschreibt keine frisch gemappte Spalte mehr** ([new-column-mapping.ts](src/plugins/csv-sources-kuration/services/new-column-mapping.ts)): der Banner arbeitet mit einer Momentaufnahme des Schemas
- **Auch Dialog-Importe journalisieren** ([CsvSourceReimportDialog.tsx](src/plugins/csv-sources-kuration/CsvSourceReimportDialog.tsx), [CsvSourceWizard.tsx](src/plugins/csv-sources-kuration/wizard/CsvSourceWizard.tsx)): bisher stempelten sie den Nacht-Export als erledigt, ohne ihn je aufzuzeichnen
- **Die Schema-Wiederherstellung verlangt einen `join_key`** ([schemaRecovery.ts](src/plugins/csv-sources-kuration/services/schemaRecovery.ts)): ohne ihn wurden die Row-Hashes auf einer beliebigen Spalte gekeyt

### v4.24.0 — Suche: der Treffer zeigt seinen Beleg (August 2026)

MINOR — „Dresden" im Bereich „nur Ort & Bundesland" lieferte 485 Treffer, und markiert war das Suchwort in 4 von 30 Zeilen — bei denen, wo die Stadt zufällig im Firmennamen stand. Von den neun Trefferstellen haben sieben längst einen Platz im Ergebnis; `standort` und `deskriptoren` hatten keinen. Ein Etikett „Ort" sagt DASS, nicht WAS.

- **Zwei Belege stehen jetzt am Treffer** ([search-result.ts](src/core/types/search-result.ts), [search-corpus.ts](src/plugins/antraege/services/search-corpus.ts)): der gesuchte Ortstext (Ort AFS + Ort AST + beide Bundesländer) und die Deskriptoren — Suchform unverändert, nur der Trenner ist jetzt sichtbar
- **Die Tabelle blendet die erklärende Spalte selbst ein** ([autoSpalten.ts](src/plugins/suche/autoSpalten.ts), [columns.tsx](src/plugins/suche/columns.tsx)): ausgelöst durch die Einstellung „nur Ort & Bundesland" oder durch die Fundstelle; im Spalten-Aufklapper als „auto" markiert, ohne die persönliche Spaltenwahl zu ändern
- **Neue Spalten „Ort & Bundesland" + „Deskriptoren"** ([columns.tsx](src/plugins/suche/columns.tsx)): „Ort AST" bleibt unangetastet — sie trägt nur `ort_ast` und könnte weder „Bayern" noch einen abweichenden Ausführungsort markieren
- **Trefferliste eine Zeile kürzer** ([TrefferZeile.tsx](src/plugins/suche/TrefferZeile.tsx)): die Etiketten ziehen in die Kopfzeile, der Belegwert in die Fundstellen-Zeile — 111 px → 82 px je Zeile, 30 von 30 Zeilen markiert statt 4
- **Regel + Messung stehen einmal** ([suche-relevanz.md](docs/architecture/suche-relevanz.md), [autoSpalten.test.ts](src/plugins/suche/__tests__/autoSpalten.test.ts)): welche Trefferstelle wo sichtbar ist, und warum die Liste genau zwei Einträge hat

### v4.23.0 — Demo-Umwandlung raeumt auf, Meldungen sagen die Wahrheit (August 2026)

MINOR — Neun Befunde der CSV-Bug-Jagd, gemeinsamer Nenner: die App tat etwas anderes, als sie sagte. Die Demo-Umwandlung ließ ihre Daten liegen, „Bereits aktuell." stand für drei verschiedene Lagen, und ein Feld-Label konnte umbenannt werden, ohne dass die Spalte es je erfuhr.

- **Demo→Echt räumt die Demo-Daten mit ab** ([convert-fixture-source.ts](src/plugins/csv-sources-kuration/services/convert-fixture-source.ts), [loeschregel.ts](src/core/services/csv/loeschregel.ts), [csv-import.md](docs/architecture/csv-import.md)): nach derselben Löschregel wie der Import — der Erfolgs-Banner empfiehlt nicht mehr den herkunftsblinden Reset, und die abgeleitete Id kollidiert nicht mehr mit einer Quelle in einem anderen Programm
- **„Bereits aktuell." nur noch, wenn es stimmt** ([datenUpdateMeldung.ts](src/plugins/csv-sources-kuration/services/datenUpdateMeldung.ts), [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md)): ein gar nicht gelaufener Lauf, blockierte Quellen, Fehler und ein unvollständig geladener Snapshot werden benannt
- **Die ● CSV-Ampel prüft nach einem Banner-Import neu** ([useCsvAutoRefreshCheck.ts](src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts)): bisher blieb sie den Rest der Sitzung rot und zeigte einen Import-Stand von vor dem Lauf
- **Zwei Lock-Wahrheiten** ([lockKonfliktText.ts](src/plugins/csv-sources-kuration/components/lockKonfliktText.ts), [schemaRecovery.ts](src/plugins/csv-sources-kuration/services/schemaRecovery.ts)): „eigener Tab" heißt laufender Vorgang und fragt vor dem Übernehmen; „Snapshot neu schreiben" überstempelt keinen fremden Lock mehr
- **Feld-Umbenennungen erreichen die Ordner-Spalte** ([kategorie-projektion.ts](src/core/status/kategorie-projektion.ts), [useStatusCockpit.ts](src/plugins/status-cockpit/useStatusCockpit.ts)): das Label geht in die Projektions-Signatur ein, und eine Katalog-Kuration baut die Projektion sofort neu — dazu blockieren ignorierte Spalten den Import nicht mehr und der Netzwerk-Namen-Index latcht keinen leeren Bestand

### v4.22.0 — Ein Snapshot gehoert einem Programm, eine Quelle einer Datei (August 2026)

MINOR — Vier weitere Befunde der CSV-Bug-Jagd. Drei behandelten den Snapshot, als wäre er der ganze Datenbestand des Rechners; der vierte band eine Quelle an die falsche Datei und schrieb die Fehlbindung als Selbstheilung fest.

- **Der Sync fasst nur das eigene Programm an** ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts), [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md)): `clear()` auf den ganzen Store löschte auf einem Rechner mit zwei Programmen den Bestand des Nachbarn — der danach nie wieder gesynct wurde
- **Eine Löschung überlebt das gebündelte Delta** ([snapshot.ts](src/core/services/csv/snapshot.ts)): wurde dasselbe Aktenzeichen im Lauf auch berührt, fiel es durch beide Raster; jetzt entscheidet der Bestand statt der Meldung
- **Ein reiner Demo-Rechner publiziert gar nicht** ([snapshot.ts](src/core/services/csv/snapshot.ts)): der Fixture-Filter schützte nur die Schema-Datei, Anträge und Verbünde gingen ungefiltert auf den Team-Share
- **Der Header-Fallback muss überzeugen** ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts), [csv-import.md](docs/architecture/csv-import.md)): eine Datei wird nur zugeordnet, wenn sie alle Schema-Spalten führt und keine zweite das auch tut
- **Der kuratierte Dateiname schlägt die lokale Filemap** ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts)): sonst gewann eine einmal falsch geheilte Bindung dauerhaft

### v4.21.0 — Eine Bahn kann drei Kartenspalten breit sein (August 2026)

MINOR — Der Spaltenschalter je Lane bot 1 oder 2. Wer eine volle Bahn breiter stellen wollte, war damit am Ende — und die Menge `1 | 2` stand sechsmal wortgleich im Code, also an sechs Stellen zu ändern. Detail: [board-komponente.md](docs/architecture/board-komponente.md).

- **Dritte Kartenspalte im Primitiv** ([tf-board.css](src/components/kanban/tf-board.css), [TfBoard.tsx](src/components/kanban/TfBoard.tsx)): eigener Boden je Layout-Form (662 px gedeckelt, 488 px geteilt), gerechnet wie der zweispaltige — die Karte behält ihre Breite, die Bahn wird kürzer
- **Eine Heimat für die Spaltenzahl** ([tfBoardBahn.ts](src/components/kanban/tfBoardBahn.ts)): `TfBahnSpalten` plus tolerantes `leseSpalten`; Lane-Typen, Schalter und Persistenz beziehen sie von dort statt sie zu buchstabieren
- **Schalter 1/2/3 überall, wo Lanes eingestellt werden** ([LaneListe.tsx](src/components/ui/LaneListe.tsx)): Feedback-Board-Popover, Startseiten-Menü, Einstellungen › Widgets und das Zahnrad des Kanban-Fensters — die Kopfbreite ist aus der Segmentzahl gerechnet
- **Die Einstellungs-Ansicht des Startseiten-Menüs ist 290 px breit** ([StartseiteMenue.tsx](src/plugins/home/anpassen/StartseiteMenue.tsx)): in den 250 px des Menüs kürzte das dritte Segment vier von neun Kategorienamen; gekürzte Namen tragen jetzt ihren `title`
- **Im Kanban-Fenster bleibt es bei 1|2** ([kanbanLanes.ts](src/plugins/home/widgets/kanbanLanes.ts)): dort wird die Spaltenzahl aus dem Bestand abgeleitet, und der echte Bestand liefe über jede Schwelle

### v4.20.0 — Merge schreibt vollstaendig, Drift prueft Spalten-Identitaet (August 2026)

MINOR — Vier Befunde der CSV-Bug-Jagd, die den Bestand im Normalbetrieb still verändert haben statt im Störfall. Drei Mal schrieb der Merge etwas Plausibles, dem niemand ansah, dass es nicht aus der Quelle stammte; einmal verglich die Drift-Prüfung Spalten**namen**, während die Zuordnung an der Position hängt.

- **Ordner-Spalten überleben den Import** ([batched.ts](src/core/services/csv/merger/batched.ts), [single.ts](src/core/services/csv/merger/single.ts), [csv-import.md](docs/architecture/csv-import.md)): beide Merge-Pfade schreiben die Slim-Projektion jetzt mit `kat_status` — bisher verlor jeder berührte Antrag seine kuratierten Ordner-Werte bis zum nächsten App-Start
- **Eine korrigierte VB_KURZNAM erreicht den Verbund-Record** ([batched.ts](src/core/services/csv/merger/batched.ts)): first-write-wins ließ Liste und Detailseite dauerhaft zwei verschiedene Akronyme zeigen; ein leerer Wert überschreibt weiterhin nichts
- **Der Verbund-Heal erfindet keinen Titel und keinen Status mehr** ([verbuende-rebuild.ts](src/core/services/csv/verbuende-rebuild.ts)): er nahm beides vom ersten Teilvorhaben und lief vor jedem Publish — die Konsumenten fallen ohnehin zur Lesezeit auf den Lead-TV zurück
- **Mis-filed Verbund-Records werden repariert statt ersetzt** ([verbuende-rebuild.ts](src/core/services/csv/verbuende-rebuild.ts)): ein Record mit falscher `programm_id` galt im Index als fehlend und verlor dabei seinen kuratierten Inhalt
- **Die Drift-Prüfung vergleicht Spalten-Identität** ([csv-drift-check.ts](src/plugins/csv-sources-kuration/services/csv-drift-check.ts), [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md)): verschobene PapaParse-Aliasgruppen (`X`, `X_1`, …) blockieren die Quelle — als einzige Drift-Art auch gegen „Trotzdem importieren"

### v4.19.0 — Ein Verfuegbarkeits-Check oeffnet keinen KI-Tab mehr (August 2026)

MINOR — Nachlese zu v4.17.0: der ungefragt aufgerissene KI-Tab war kein Einzelfall der Suchseite. `ping()` trägt `openIfNeeded: true` als Vorgabe und ruft `window.open` — die Klasse stand seit v2.103.2 als Nr. 8 in den Bug-Klassen und war trotzdem an fünf weiteren Stellen offen.

- **Fünf Stellen pingen jetzt passiv oder hinter dem Guard** ([turn.ts](src/plugins/chat/assistent/turn.ts), [SkillTestlauf.tsx](src/plugins/skill-verwaltung-kuration/SkillTestlauf.tsx), [llm-klassifizierung.ts](src/plugins/auslastung/services/klassifizierung/llm-klassifizierung.ts), [useNachforderungen.ts](src/plugins/antraege/nachforderungen/useNachforderungen.ts), [eval-batch.ts](src/core/services/skill-eval/eval-batch.ts)): Assistent-Turn, Skill-Testlauf, Auslastungs-Klassifizierung, NF-Generierung und Skill-Eval
- **Statt eines Tabs der Verbinden-Dialog**: die vier Klick-Pfade rufen vorher `kiVerbindungGeprueft` ([ki-guard.ts](src/core/services/ai/ki-guard.ts)) — der geöffnete Tab trug ohnehin kein Bookmarklet und hätte nie geantwortet
- **Guard `kein-oeffnender-ping`** ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts)): flaggt `.ping()` und `openIfNeeded: true` in jeder Datei ohne `kiVerbindung*`; Inline-Ausnahme für die beiden „Verbindung testen"-Knöpfe der Einstellungen
- **Der Assistenten-Turn hat einen eigenen Test** ([turn.test.ts](src/plugins/chat/assistent/__tests__/turn.test.ts)): er prüft die Ping-Argumente, nicht nur das Ergebnis
- **Bug-Klasse 8 umgeschrieben** ([recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)): „eine Nutzer-Geste darf den Tab öffnen" ist überholt — jetzt öffnet kein Verfügbarkeits-Check ein Fenster

### v4.18.0 — Gefiltert heisst nicht geloescht, unlesbar nicht leer (August 2026)

MINOR — Fünf Befunde der CSV-Bug-Jagd, zwei Wurzeln: Der Import konnte „vom Filter verworfen" nicht von „im Fachsystem gelöscht" unterscheiden, und mehrere Stellen lasen einen Fehler als leeres Ergebnis. Beides endete darin, dass Bestand verschwand und der Lauf Erfolg meldete.

- **Gefiltert heisst nicht gelöscht** ([importer.ts](src/core/services/csv/importer.ts), [csv-import.md](docs/architecture/csv-import.md)): eine leere oder im Katalog unbekannte Unterprogramm-Zelle löscht den Antrag nicht mehr — nur der bewusst deaktivierte Code tut es; Zeilen ohne Förderkennzeichen werden exakt gezählt statt als gedeckelte Stichprobe gemeldet
- **Whitespace im Spaltenkopf leert keine Spalte mehr** ([parser.ts](src/core/services/csv/parser.ts)): alle vier Parse-Wege lasen die Werte unter dem getrimmten, PapaParse legt sie unter dem rohen Namen ab — in der Join-Spalte hätte das den Bestand der Quelle als entfernt gemeldet
- **Ein unlesbares Delta ist kein leeres Delta** ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts), [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)): der Cursor bleibt stehen statt weiterzuspringen, der Lauf meldet sich als unvollständig — bisher waren die Änderungen des Tages danach dauerhaft weg
- **Vier stumme Fehler melden sich** ([schemaRegistry.ts](src/core/services/csv/schemaRegistry.ts), [auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts), [Step4Progress.tsx](src/plugins/csv-sources-kuration/wizard/Step4Progress.tsx)): gescheiterte Quell-Kopie bricht ab, PapaParse-Zeilenfehler und nicht veröffentlichter Snapshot stehen im Abschluss und im Bericht
- **„Antrags-Daten zurücksetzen" räumt vollständig** ([idb-csv.ts](src/core/services/csv/idb-csv.ts)): Slim-Projektion und Snapshot-Marken gehen mit — sonst zeigte die App den alten Bestand weiter und der nächste Abgleich hielt sich für erledigt

