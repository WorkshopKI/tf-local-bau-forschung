# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

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

### v4.17.0 — Suche: klare Schalter, Markierung in der Tabelle, kein KI-Tab (August 2026)

MINOR — Vier Befunde aus dem Test der Suchseite. Zwei Schalter hießen fast gleich und taten Verschiedenes, ein Suchbereich beantwortete zwei Fragen auf einmal, die Markierung gab es nur in der Liste, und ein Klick auf „Warum?" riss ungefragt einen KI-Tab auf.

- **„Wortformen mitsuchen" statt „Ähnliche Begriffe mitsuchen"** ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx), [suche-relevanz.md](docs/architecture/suche-relevanz.md)): getrennt entlang der Achse — dasselbe Wort in anderer Form gegen dasselbe Thema in anderen Worten (Ähnlichkeitssuche); Deutungszeile und Kein-Treffer-Auswege ziehen mit
- **„nur Einrichtung" und „nur Ort & Bundesland" sind zwei Bereiche** ([suchbereich.ts](src/core/services/search/suchbereich.ts)): zusammengelegt mischte „wer" und „wo" — am Bestand gemessen 82 gegen 1 976 Treffer für „Bayern"
- **Die Tabelle markiert den Suchbegriff wie die Liste** ([SuchMarkierung.tsx](src/plugins/suche/SuchMarkierung.tsx), [columns.tsx](src/plugins/suche/columns.tsx)): Titel/Inhalt, FKZ, AST und Ort AST über einen Kontext; `accessor` bleibt roh, Sortierung/Filter/Export unverändert
- **„Warum?" öffnet keinen KI-Tab mehr** ([useAnalysePipeline.ts](src/plugins/suche/useAnalysePipeline.ts)): der Verfügbarkeits-Check läuft über den vorhandenen Guard `kiVerbindungGeprueft` (passiver Ping) statt über `ping()` mit seiner öffnenden Vorgabe
- **Der Grund steht, wo die Begründung erwartet wurde** ([TrefferZeile.tsx](src/plugins/suche/TrefferZeile.tsx)): ohne verbundene KI sagt der aufgeklappte Bereich das, statt „Noch keine Begründung."

### v4.15.0 — Hilfe steht auf jeder Seite am Blattrand (August 2026)

MINOR — „Rechtsbündig als letztes Element der Kopf-Aktionen" stand als Regel im Doc, aber rechtsbündig **wovon** stand nirgends. Auf elf Seiten steckte der Hilfe-Knopf darum in der schmalen Inhaltsspalte und hing mitten in der Fläche — auf den Förderanträgen 414 px vor dem Rand, gemessen auf einem 1520 px breiten Blatt. Gesucht wird er trotzdem am Rand, so wie ihn die Startseite zeigt.

- **Elf Kopfzeilen spannen jetzt die volle Blattbreite** ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx), [SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx), [EinstellungenPage.tsx](src/plugins/einstellungen/EinstellungenPage.tsx), [HomePage.tsx](src/plugins/home/HomePage.tsx) u. a.): der Rumpf behält seine Spaltenbreite (1024/896/672 px unverändert), nur der Kopf reicht bis an den Rand
- **Vier zentrierte Kurator-Spalten stehen links** ([CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx), [ProgrammeAdminPage.tsx](src/plugins/programme-kuration/ProgrammeAdminPage.tsx), [IndexManager.tsx](src/plugins/kurator/IndexManager.tsx), [AnfragenEinstellungenPage.tsx](src/plugins/anfragen/AnfragenEinstellungenPage.tsx)): `mx-auto` raus, sonst fluchten Titel und Inhalt nach dem Umbau nicht mehr
- **Die Regel steht jetzt geschrieben** ([ui-muster.md](docs/architecture/ui-muster.md)): Kopfzeile über die volle Blattbreite, schmalerer Rumpf erst darunter — samt Muster-Schnipsel
- **Guard `hilfe-knopf-am-blattrand`** ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts)): liest die Vorfahren-Kette des Knopfes über die Einrückung — auch hinter einer Klassen-Konstante — und fällt bei jedem `max-w-*` darüber; er hätte alle elf Fundstellen gemeldet
- **Gemessen in `dev:local` statt angesagt**: 15 Routen, Abstand zum Blattrand überall 24 bzw. 32 px (= das Seiten-Padding), Detail-Schließen-Kreuz 103 px darunter ohne Kollision, `__tf.fehler()` 0

### v4.14.0 — Suchindex: nur noch das gefuehrte Embedding-Modell (August 2026)

MINOR — Die Modell-Auswahl im Kurator-Bereich bot vier Embedding-Modelle an, obwohl die Entscheidung längst gefallen ist: der gesamte Bestand (Suchindex, Auslastungs-Korpus auf dem Share, Kategorie-Centroids) ist mit EmbeddingGemma gebaut, und ein Wechsel entwertet alle drei gleichzeitig (Pitfall #19). Eine Liste, aus der nur ein Eintrag richtig ist, ist keine Wahl, sondern eine Falle.

- **Nur noch das geführte Modell in der Registry** ([model-registry.ts](src/core/services/search/model-registry.ts)): MiniLM 384d und beide Harrier entfallen; ein persistierter Alt-Wert fällt still auf `DEFAULT_MODEL_ID`, der Indexer bemerkt den Wechsel gegen `index-model-id` und baut neu
- **Angabe statt Aufklapper** ([ActionCardModels.tsx](src/plugins/kurator/actions/ActionCardModels.tsx)): bei genau einem Modell steht dort dessen Label als Text — ein Dropdown mit einer Zeile sieht nach Wahl aus und ist keine; ab zwei Einträgen kommt Select samt Wechsel-Dialog zurück
- **Startwert ohne feste Modell-Id** ([IndexManager.tsx](src/plugins/kurator/IndexManager.tsx)): der Zustand startet auf `DEFAULT_MODEL_ID` statt auf einer genannten Id — die meldete zwischen zwei asynchronen Ladevorgängen kurz „Modell gewechselt"
- **Was ein entferntes Modell auffängt, steht jetzt geschrieben** ([add-embedding-model.md](docs/agents/add-embedding-model.md)): aktive Wahl, lokaler Index, Share-Korpus und Share-Index — vier Stellen, alle vorhanden, keine neu gebaut

### v4.13.0 — Detailseite kompakt, Historie belegt (August 2026)

MINOR — Die Antrags-Detailseite kostete zu viel Scroll-Weg, bevor das Wichtigste sichtbar wurde: fast alle Sektionen starteten offen, zwischen ihnen lagen je 48 px, und ein unsichtbarer leerer Block zog Strich plus Abstand ein. Dabei fiel auf, dass die Sektion „Historie" strukturell nie etwas zeigen konnte — sie las einen Store, den kein ausgeliefertes CSV-Mapping befüllt.

- **Beim Öffnen ist alles zu außer den Antragsdaten** ([detailSektionen.ts](src/plugins/antraege/detailSektionen.ts)): Klapp-Vorgaben und Speicher-Schlüssel an einer Stelle statt in acht Dateien; die Kurzbeschreibung öffnet nur mit Text, leer schrumpft sie auf eine Zeile ohne Schalter
- **Leere Sektionen nehmen ihren Trennstrich mit** ([detailRahmen.tsx](src/plugins/antraege/detailRahmen.tsx)): Strich als Klasse statt inline + `empty:hidden` — der Widerspruchs-Block hinterließ ohne Bescheid 25 px Leerraum mit Strich zwischen Werkbank und „Alle Felder"
- **Fokus-Modus räumt den Seitenkopf** ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx)): bei eingeklappter Liste bleiben Titel + Hilfe (139 → 57 px); Bereichs-Chip, Profil-Pille und „Aufnehmen" sind Listen-Werkzeuge
- **„Historie" zeigt das Import-Diff-Journal** ([VerbundHistorie.tsx](src/plugins/antraege/VerbundHistorie.tsx), [vorgangssystem.md §12.9](docs/architecture/vorgangssystem.md)): belegte Änderungen je Teilvorhaben statt „Noch keine Verbund-Änderungen erfasst", Nullpunkt dabei; `chronikFuerAntraege` liest Stand und Monate einmal je Verbund statt einmal je TV
- **Engere vertikale Maße** ([VerbundKopf.tsx](src/plugins/antraege/VerbundKopf.tsx), [CollapsibleDataSection.tsx](src/plugins/antraege/CollapsibleDataSection.tsx)): „Antragsdaten" steht 123 px höher (710 → 587), gemessen am echten Bestand in `dev:local`

### v4.12.0 — Cross-Cutting-Review: unlesbar heisst nicht leer (August 2026)

MINOR — Ergebnis eines Cross-Cutting-Reviews entlang Pitfall #10/#23/#30/#31: neun bestätigte Befunde, vier davon mit derselben Wurzel. `readText` bildete „Datei fehlt" und „Datei ließ sich nicht lesen" auf dasselbe `null` ab; vier Sidecar-Schreiber machten daraus „also leer" und schrieben das Ergebnis als vollständige Datei zurück — womit fremder Team-Bestand verschwand. Die Trennung gab es bereits im Feedback-Modul, sie war nur nie verallgemeinert.

- **`readTextLage` trennt fehlend von unlesbar** ([atomic-write.ts](src/core/services/infrastructure/atomic-write.ts), [read-text-lage.test.ts](src/core/services/infrastructure/__tests__/read-text-lage.test.ts)): nur `NotFoundError` heißt „gibt es nicht"; `readText` bleibt für rein lesende Aufrufer unverändert tolerant
- **Vier Schreiber brechen jetzt ab, statt leer zu überschreiben** ([feedbackOutboxCollect.ts](src/core/services/feedback/feedbackOutboxCollect.ts), [kuerzel-map.ts](src/plugins/auslastung/services/identitaet/kuerzel-map.ts), [zugang-config.ts](src/core/services/infrastructure/zugang-config.ts), [katalog-share.ts](src/core/status/katalog-share.ts)): Team-Feedback, anonIds (Pitfall #18), MA-Zugänge und Katalog-Archiv bleiben erhalten
- **Kein Löschen ungesicherter Dateien mehr** ([snapshot.ts](src/core/services/csv/snapshot.ts), [migration.ts](src/core/services/infrastructure/migration.ts)): der Teil-Write-Aufräumer riss `antraege.jsonl` mit (kein `.backup`), die Legacy-Migration die nicht kopierten Quelldateien — beides verhinderte nichts und zerstörte etwas
- **Zwei ungegatete Inhalts-Läufe geschlossen** ([SkillTestlauf.tsx](src/plugins/skill-verwaltung-kuration/SkillTestlauf.tsx), [llm-klassifizierung.ts](src/plugins/auslastung/services/klassifizierung/llm-klassifizierung.ts), [bridge.ts](src/core/services/ai/bridge.ts)): Real-Daten-Testlauf und Auslastungs-Klassifizierung liefen roh am DSGVO-Gate vorbei; neu `getTransportForDatenLauf` für Läufe ohne Skill-Record
- **Guard-Scope war zu eng** ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts)): `no-raw-active-transport` deckte fünf Verzeichnisse per Allow-Liste — jetzt auch `skill-verwaltung-kuration/` und `auslastung/`, die zwei echten Ausnahmen begründet markiert

### v4.11.0 — Antraege sterben erst, wenn alle Quellen sie fallen lassen (August 2026)

MINOR — Fortsetzung von v4.9.0, jetzt als fachliche Regel statt als Guard: die Quellen reichen unterschiedlich weit zurück (Master + Begleitung bis 2015, Projektbeschreibung bis 2012). „Fehlt in diesem Export" sagt deshalb nichts über die Existenz eines Antrags — bis v4.10 löschte genau das ihn samt Verbund-Referenz und Akronym-Index.

- **Gelöscht wird erst, wenn der Antrag in ALLEN Quellen weg ist** ([importer.ts](src/core/services/csv/importer.ts), [csv-import.md](docs/architecture/csv-import.md)): `teileLoeschkandidaten` prüft die Löschkandidaten gegen die Row-Hashes der übrigen Aktenzeichen-Quellen
- **Der Rückhalt löst sich von selbst auf** ([importer.ts](src/core/services/csv/importer.ts)): jede Quelle löscht die Hashes ihrer ausgefallenen Zeilen vollständig — die letzte, die eine Zeile fallen lässt, findet nirgends mehr einen Hash; Reihenfolge egal
- **Ein gehaltener Antrag wird nicht neu gemergt** ([importer.ts](src/core/services/csv/importer.ts)): er behält seinen vollen Stand, statt auf die Felder der verbliebenen Quellen zusammenzuschrumpfen — ein Teil-Export soll den Bestand nicht aushöhlen
- **Sichtbar statt still** ([Step4Progress.tsx](src/plugins/csv-sources-kuration/wizard/Step4Progress.tsx), [auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)): `heldRemovals` im Import-Ergebnis, Audit-Eintrag, Zeile im Wizard-Abschluss, Summe im `[data-update]`-Log
- **Reißleinen** ([importer-loeschung-nur-wenn-ueberall-weg.test.ts](src/core/services/csv/__tests__/importer-loeschung-nur-wenn-ueberall-weg.test.ts)): Rückhalt, Reihenfolge-Unabhängigkeit, unangetasteter Bestand — und die Gegenprobe, dass eine einzeln getragene Zeile weiterhin sofort verschwindet

### v4.10.0 — Kanban-Fenster merkt eingeklappte Bahnen und traegt die Einstellungen (August 2026)

MINOR — Das Kanban-Fenster aus v3.47 war eine Ansicht zum Anschauen; gewünscht war eine zum Einrichten. Beides hing an derselben Frage: Wo darf Zustand liegen, wenn das Fenster seine Startseite überlebt?

- **Eingeklappte Bahnen überleben das Fenster** ([types.ts](src/plugins/home/widgets/types.ts), [home-widgets.md](docs/architecture/home-widgets.md)): `vollbildEingeklappt` in der Widget-Config, geschrieben über `mutiereConfig` auf den aktuellen Stand — im Widget bleibt das Einklappen flüchtig
- **Das Board-Primitiv nimmt den Einklapp-Zustand von außen** ([TfBoard.tsx](src/components/kanban/TfBoard.tsx), [board-komponente.md](docs/architecture/board-komponente.md)): optionale `einklapp`-Naht, Speicherform ist eine Liste statt der vollen Wunsch-Karte
- **Zahnrad im Fensterkopf zeigt dieselbe `WidgetConfigForm`** ([VollbildEinstellungen.tsx](src/plugins/home/widgets/VollbildEinstellungen.tsx), [fenster-in-fenster.md](docs/architecture/fenster-in-fenster.md)): der Storage-Kontext wird als Wert nachgereicht, kein Radix-Overlay im Fenster
- **`Escape` schließt erst das Panel, dann das Fenster** ([KanbanVollbild.tsx](src/plugins/home/widgets/KanbanVollbild.tsx)): Zuhörer am Fenster-Dokument in der Einfang-Phase — Reacts delegierter Griff erreichte einen Tastendruck ohne Fokus im Baum nie (gemessen: das Fenster ging zu)
- **Fenstertitel war leer** ([appFenster.ts](src/components/fenster/appFenster.ts)): `head.innerHTML` räumte das eben gesetzte `<title>` wieder weg, die Titelzeile zeigte „about:blank"

### v4.9.1 — Startseiten-Menue oeffnet einstoeckig und bleibt am Ausloeser (August 2026)

PATCH — Zwei Meldungen zum Rechtsklick-Menü aus v4.7.0, eine Wurzel: das Untermenü ging beim Öffnen automatisch mit auf, verdoppelte damit die gemessene Breite, und Radix schob die ganze Gruppe vom Auslöser weg nach links. Das Ergebnis sah nach zwei Fehlern aus und war einer.

- **Untermenüs öffnen nicht mehr per Fokus** ([menueZeilen.tsx](src/plugins/home/anpassen/menueZeilen.tsx)): Radix fokussiert beim Öffnen die erste Zeile — Überfahren, Klick und `→` bleiben, der Fokus geht auf den Panel-Rahmen
- **Untermenü hängt absolut am Hauptmenü** ([StartseiteMenue.tsx](src/plugins/home/anpassen/StartseiteMenue.tsx), [home-widgets.md](docs/architecture/home-widgets.md)): der Popover misst wieder 250 statt 524 px, das Hauptmenü steht bündig am Auslöser und bleibt beim Aufklappen stehen — gemessen 1171/1171
- **Eigene Kollisionsrechnung fürs Untermenü** ([useStartseiteMenue.ts](src/plugins/home/anpassen/useStartseiteMenue.ts)): nach links nur, wenn rechts kein Platz ist und links einer wäre; dazu ein Höhendeckel gegen den unteren Rand (gemessen 353 statt 543 px)
- **Vorab offenes Untermenü misst einen Tick später** ([StartseiteMenue.tsx](src/plugins/home/anpassen/StartseiteMenue.tsx)): Floating UI reicht die Position asynchron nach, im Layout-Effekt steht das Panel noch am Ursprung — betraf „Widget hinzufügen"
- **Reißleinen** ([untermenueLage.test.ts](src/plugins/home/anpassen/__tests__/untermenueLage.test.ts)): Seitenwahl, Versatz und Deckel als reine Funktion, plus Quelltext-Guards gegen `onFocus` am Untermenü und gegen die Flex-Geschwister-Anordnung

### v4.9.0 — Import und Publish stoppen den Bestandsverlust (August 2026)

MINOR — Aus einer Bug-Jagd im Import-Pfad: `removedJoinValues` unterschied nicht zwischen „im Fachsystem gelöscht" und „vom Import gefiltert", der Merge löschte bedingungslos, und der Snapshot trug das Ergebnis team-weit. Fünf verschiedene Ursachen mündeten in denselben Datenverlust; zwei Guards schließen den katastrophalen Teil.

- **Join-Spalte muss in der gelesenen Kopfzeile stehen** ([importer.ts](src/core/services/csv/importer.ts), [csv-import.md](docs/architecture/csv-import.md)): war sie nur im Mapping, lief der Import durch und löschte den kompletten Bestand der Quelle — gemessen 44 → 0 Anträge bei umbenanntem `FKZ`, mit Erfolgsmeldung
- **Abbruch vor dem Share-Write und vor jedem Schema-Stempel** ([importer.ts](src/core/services/csv/importer.ts)): die Quell-Kopie bleibt unangetastet, die Quelle gilt nicht als erledigt und läuft im nächsten Auto-Refresh erneut an
- **Mengen-Plausibilität für `antraege` beim Publish** ([snapshot.ts](src/core/services/csv/snapshot.ts), [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md)): `PUBLISH_PRESERVE_WHEN_EMPTY` übersprang `antraege` per `continue` — jeder geschrumpfte Bestand ging kommentarlos auf den Share
- **Guard greift in beiden Publish-Pfaden** ([snapshot.ts](src/core/services/csv/snapshot.ts)): Voll-Write gegen den Manifest-Count, Delta-Write gegen die `removedKeys` — ab 20 Anträgen Basis, Abbruch unter der Hälfte
- **Offen und bewusst nicht mitgefixt**: Löschung aus einer Sekundärquelle trifft weiter Anträge, die der Master trägt ([importer.ts:472](src/core/services/csv/importer.ts:472)) — das ist eine fachliche Entscheidung, keine technische

### v4.8.0 — Dokumentensuche trennt Woerter deutsch (August 2026)

MINOR — Nachgeholt, was v4.6.0 ausdrücklich offengelassen hat. Orama lief auf der englischen Worttrennung, und deren Zeichenklasse kennt `ä ö ü ß` nicht: „Fördergeber" zerfiel in `f` + `rdergeber`. Die Suche fand damit noch etwas — aber über Bruchstücke. Betrifft nur die Dokumentenstufe; die Antragsstufe vergleicht rohe Zeichenketten.

- **Worttrennung deutsch, aus einer Konstante** ([orama-store.ts](src/core/services/search/orama-store.ts), [suche-relevanz.md §6](docs/architecture/suche-relevanz.md)): am echten Textbestand 14 778 statt 20 338 verschiedene Token, 1 217 zerrissene Wörter weniger; Bruchstücke wie `f` (859×) verbanden bisher jedes Umlautwort miteinander
- **Bindestrich trennt jetzt** — „ZIM-Kooperationsprojekt" ist auch über `kooperationsprojekt` auffindbar, vorher war der ganze Ausdruck ein Token
- **Alt-Index bleibt nutzbar statt stumm zu werden** ([orama-store.ts](src/core/services/search/orama-store.ts)): `load()` stellt seine Sprache wieder her, er bleibt in sich stimmig — niemand verliert die Dokumentensuche, bis der Kurator neu aufbaut
- **Der nächste Indexlauf baut erzwungen komplett neu** ([batch-indexer.ts](src/core/services/search/batch-indexer.ts)): inkrementell entstünde ein halber Index mit zwei Trennungen; Manifest UND Checkpoint fallen mit
- **Der Zustand ist sichtbar** ([IndexManager.tsx](src/plugins/kurator/IndexManager.tsx)): Ampel „Worttrennung geändert — Index neu aufbauen"; Guard `orama-create-mit-indexsprache` hält künftige `create(...)`-Stellen an die Konstante

### v4.7.0 — Startseite per Rechtsklick anpassen (August 2026)

MINOR — Umsetzung des Handoffs `_design/handoff/homepage-anpassen`. Ein Widget ein- oder auszublenden kostete vier Kontextwechsel: Startseite verlassen, Einstellungen öffnen, Liste suchen, zurück, Ergebnis prüfen — für eine Entscheidung, die beim Ansehen der Startseite fällt. Die Einstellungsseite bleibt und ist aus jedem Menü erreichbar; sie ist nur nicht mehr der einzige Weg.

- **Startseiten-Menü mit vier Auslösern** ([anpassen/](src/plugins/home/anpassen/), [home-widgets.md](docs/architecture/home-widgets.md)): Rechtsklick auf Fläche und Widget, Knopf im Seitenkopf, `⋯` im Widget-Kopf, „Widget hinzufügen" am Spaltenende — ein Popover an einem Punkt-Anker, kein zweites Menü über Radix' `ContextMenu`
- **Untermenüs Widgets und Darstellung** ([WidgetsUntermenue.tsx](src/plugins/home/anpassen/WidgetsUntermenue.tsx), [DarstellungUntermenue.tsx](src/plugins/home/anpassen/DarstellungUntermenue.tsx)): Checkliste beider Spalten mit Reihenfolge-Pfeilen und „alle"-Schalter, Primärfarbe und Hell/Dunkel — als Geschwister-Panel im selben Popover, nicht als zweite Layer
- **Rückgängig hält den vorherigen Config-Stand** ([rueckgaengigStore.ts](src/plugins/home/anpassen/rueckgaengigStore.ts)): ein Weg für Ausblenden, „alle aus" und „Startseite zurücksetzen" — Letzteres braucht deshalb keine Nachfrage
- **`⋯` löst den Stift ab** ([WidgetShell.tsx](src/plugins/home/widgets/WidgetShell.tsx)): der erschien nur bei Kanban und Ampel; die Widget-Einstellungen stehen jetzt als Eintrag im Menü und teilen weiter EINE `WidgetConfigForm` mit den Einstellungen. Leere Spalten bleiben bedienbar
- **Dunkelmodus auf gestufte Flächen** ([theme.css](src/theme.css), landete in v4.6.0): `#161718` → `#1e1f21` → `#232427` → `#26272a` statt einer Fläche, helle Rahmenkante statt abgedunkelter, stärkerer Menüschatten
- **Nicht übernommen:** „Dichte Normal/Kompakt" aus dem Prototyp — der löst sie über `body { font-size }`, was jede Seite der App träfe

### v4.6.0 — Suche: Trefferliste, Relevanz, Facetten, Auswege (August 2026)

MINOR — Umsetzung des Handoffs `_design/handoff/suche`. Der Handoff nennt den gleich aussehenden Score als Designproblem; er war ein Defekt: die Wortlaut-Stufe setzte ihn fest auf 1.0, und da die Ähnlichkeitssuche opt-in ist und der Dokumentenindex oft leer, hatten im Normalfall ALLE Treffer denselben Wert — die Standard-Sortierung „nach Score" gab damit die Reihenfolge des IDB-Cursors aus.

- **Trefferstellen und Relevanz aus den Fundstellen** ([trefferstelle.ts](src/core/services/search/trefferstelle.ts), [suche-relevanz.md](docs/architecture/suche-relevanz.md)): „additive Fertigung" 570 Treffer → 158 hoch / 9 mittel / 403 gering statt 570× „1.00"; „Standards" trennt 9 Titeltreffer von 6 Firmennamen-Treffern
- **Trefferliste mit Textstelle** ([TrefferListe.tsx](src/plugins/suche/TrefferListe.tsx)) neben der Tabelle; Dokumenttreffer werden unter ihren Antrag gefaltet — der zweite Orama-Lauf je Suche entfällt
- **Drei benannte Optionen statt Fachjargon** ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx)): „genaue Wortfolge" (554) ≤ „alle Wörter" (570) ≤ „irgendein Wort" (963), Wortstämme („Normen" 3 → 28) und „Suchen in"
- **Deutungszeile „Gesucht wird"** ([DeutungsZeile.tsx](src/plugins/suche/DeutungsZeile.tsx)) mit abwählbaren Wort- und Stamm-Chips + **Facettenzeile** ([facetten.ts](src/plugins/suche/facetten.ts)) für Liste und Tabelle; die alten Treffer-Pillen entfallen
- **Kein-Treffer-Auswege mit geprüfter Trefferzahl** ([auswege.ts](src/plugins/suche/auswege.ts)), Startzustand mit letzten/gespeicherten/häufigen Suchen, „Warum?" je Zeile und Mehrfachauswahl

### v4.5.0 — Der Durchlauf wird kuerzer: Guards frueh, Schwellen am Ist, ein Build statt zwei (August 2026)

MINOR — Ein Feature-Durchlauf verlor die Zeit nicht in der Umsetzung, sondern davor und danach. Gemessen statt geschätzt: die Testsuite braucht 26 s und war nie der Engpass — dafür rissen zwei Limits ungefähr jedes zweite Feature, und ein Build lief doppelt. Beides ließ sich abstellen, ohne eine einzige Zusage aufzugeben.

- **Convention-Guards thematisch geteilt** ([conventions-status](src/__tests__/conventions-status.test.ts) / [-ui](src/__tests__/conventions-ui.test.ts) / [-daten](src/__tests__/conventions-daten.test.ts) + [health-baseline](src/__tests__/health-baseline.test.ts)): 58 `describe`-Blöcke wandern wortgleich, Testanzahl unverändert — die 3 211-Zeilen-Datei stand 38 Zeilen unter ihrem eigenen Limit und riss es mit jedem neuen Guard
- **`MAX_FILE_LOC` misst wieder Produktionscode** (1 200, Ist 1 011) und Tests getrennt (1 600, Ist 1 317): unter der alten Decke von 3 250 war `useStatusCockpit.ts` unbemerkt von 846 auf 1 011 LOC gewachsen
- **Reißleine der Kontext-Docs auf die Unfallgrenze 30 000**, die der Kommentar seit v2.409 selbst nennt — `antraege.md` stand bei 25 786 von 26 000, und viermal knapp nachziehen hatte jedes Mal eine eigene Runde gekostet
- **`npm run check:docs` (~6 s)** als Früh-Gate, `check:quick` fährt die volle Suite: eine reine Doc-Änderung lief mit `--changed` durch **kein** Testfile ([package.json](package.json))
- **`build:dev` aus `check` entfernt** — der abschließende `build:devpl` baut dev ohnehin; **25 maschinell erzwungene Pitfalls** nach [pitfalls.md](docs/architecture/pitfalls.md) ausgelagert (CLAUDE.md 66 382 → 54 408 Zeichen, geht in jede Session und jeden Subagenten)

### v4.4.4 — Ort und Bundesland werden durchsucht (August 2026)

PATCH — „Welche Vorhaben wurden 2026 in Berlin gefördert?" war bisher nicht zu beantworten. Der Standort kam als freier Substring aber nicht durch die Messung: „essen" holte 439 zusätzliche Anträge herein — fast alle aus H·essen, nicht aus Essen. Ortsangaben werden deshalb als einziges Feld am Wortanfang verglichen.

- **Ort + Bundesland im Wortlaut-Korpus** ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts)): „Berlin" → 1 392 Treffer, mit der Sicht „Bewilligt 2026" kombiniert → 68; beide Spalten je Seite, weil Firmensitz und Arbeitsort in 1 052 Sätzen auseinandergehen
- **Bundesland aus dem Kürzel aufgelöst** (`bundeslandName`): der Export kennt nur „SN"/„BW" — als Suchwort wertlos, weil ein zweistelliges Feld nur von einer zweistelligen Anfrage getroffen wird
- **Wortanfang statt freier Substring** (`standortSuchform`/`standortNadel`, [antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)): „essen" 684 → 255, „sachsen" 4 048 → 3 286 (Niedersachsen fällt raus, Sachsen-Anhalt bleibt); Präfix-Tippen bleibt, „dresd" findet Dresden
- **Beschriftungen nachgezogen** ([SucheLeerzustand.tsx](src/plugins/suche/SucheLeerzustand.tsx), [AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx)): „Nach Titel, Akronym, FKZ, Antragsteller oder Ort" statt des unbestimmten „Stammdaten", vierter Beispiel-Chip zeigt die Ortssuche
- Regression unverändert: „mobiinspec" 30, „16KN083001" 1

### v4.4.3 — Organisation wird durchsucht (August 2026)

PATCH — „Stammdaten" war der letzte offene Teil der Zusage aus dem Leerzustand der Suche. Am Bestand gemessen war eine Einrichtung über ihren Namen praktisch unauffindbar: 3 von 14 224 Anträgen ließen sich so finden, denn der Organisationsname steht so gut wie nie im Titel oder in der Kurzbeschreibung.

- **Organisation im Wortlaut-Korpus** ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts), [antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)): 5 461 Einrichtungen sind jetzt über ihren Namen erreichbar — 3 → 14 224 auffindbare Anträge
- **Zwei Spalten, ein Feld** (`verbindeOrganisation`): Rechtsperson (`ORG_AST`) und ausführende Stelle (`ORG_AFS`) weichen in 363 Sätzen voneinander ab — „Universität Münster" und „Universitätsklinikum Münster" sind derselbe Antrag; bei Gleichheit steht der Name nur einmal im Korpus
- **Platzhalter der Antragsliste nachgezogen** ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx)): nennt jetzt Akronym, FKZ und Antragsteller — der Tooltip daneben versprach sie schon seit v4.4.1
- Nicht aufgenommen: `ANTRAGSTELLER_AST` (weicht in 0 von 12 358 Sätzen von `ORG_AST` ab) und der Ort — er brächte vor allem Rauschen

### v4.4.2 — Aktenzeichen wird durchsucht (August 2026)

PATCH — Der Leerzustand der Suche verspricht „Nach Titel, Akronym, FKZ oder Stammdaten". Das Akronym kam mit v4.4.1 dazu, das Aktenzeichen war der letzte Teil dieser Zusage, den die Wortlaut-Stufe nie eingelöst hat — ein FKZ fand bis hierher nur, wer ein Dokument mit dieser Nummer im Index hatte.

- **Aktenzeichen im Wortlaut-Korpus** ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts), [antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)): „16KN083001" liefert den Antrag, „16KN0830" die 32 Sätze des ganzen Netzwerks
- **Als einziges Feld ohne Roh-Variante** (`akzLower`) — der Rohwert ist der Schlüssel der Korpus-Map; vorberechnet, weil ein `toLowerCase()` je Eintrag und Wort genau den GC-Druck erzeugte, den die anderen Felder vermeiden
- Gemessen: alle 14 225 Anträge stehen im Korpus, keiner bleibt per FKZ unerreichbar

### v4.4.1 — Wiedereinreichungen zählen als Netzwerkantrag, Akronym wird durchsucht (August 2026)

PATCH — Gemeldet war ein Suchfehler („MobiInspec Phase 1 nicht gefunden") mit vermuteter Ursache im FKZ-Suffix. Am Bestand gemessen sind es zwei Befunde: die Suffix-Regel greift tatsächlich zu eng (47 Netzwerkanträge), der gemeldete Treffer fehlte aber aus einem anderen Grund — sein Titel trägt als einziger des Netzwerks das Akronym nicht, und das Akronym stand nicht im Suchkorpus.

- **Antragsnummern 03/04/05 sind Netzwerkanträge** ([netzwerk.ts](src/plugins/antraege/netzwerk.ts)): Wiedereinreichung nach Ablehnung zählt hoch (Phase 1 `01→03→05`, Phase 2 `02→04`); die Grenze zum Teilvorhaben liegt bei 10 — am Bestand belegt (1728 → 1775 Leads)
- **Bei mehreren Versuchen gewinnt der jüngste** (`juengsterAntrag`): 18 Netzwerke tragen jetzt den Namen der gültigen statt der zurückgezogenen Einreichung („Telemedizin" statt „(Telemedizin)"); vorher entschied die Store-Reihenfolge
- **Akronym im Wortlaut-Korpus** ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts), [antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)): der Leerzustand versprach „Nach Titel, Akronym, FKZ …", durchsucht wurde das Feld nie — „mobiinspec" findet jetzt 30 statt 29 Treffer
- **Nicht angefasst**: der Embedding-Korpus (ein geänderter Text entwertete alle maschinen-lokalen Caches) und das Aktenzeichen (FKZ-Suche bleibt offen)

### v4.4.0 — Meilenstein-Editor: sichtbar anlegen, ausrücken, vergleichen (August 2026)

MINOR — Fünf Rückmeldungen aus der Konfiguration, alle mit derselben Wurzel: der Baum-Editor verhielt sich wie eine Anzeige, nicht wie ein Arbeitsgerät. Der schwerste Punkt war unsichtbares Anlegen — der neue Meilenstein entstand unter einer zugeklappten Zeile und tauchte erst nach dem nächsten Laden auf. Detail: [meilensteine.md](docs/architecture/meilensteine.md), [tree-komponenten.md](docs/architecture/tree-komponenten.md).

- **Angelegt heißt sichtbar** ([KonfigurationTab.tsx](src/plugins/meilensteine/KonfigurationTab.tsx)): Elternzeile klappt auf, der Regel-Bereich des Neuen steht offen, der Cursor markiert die Bezeichnung
- **Mehrere Regel-Bereiche bleiben offen** — sie hängen an einem eigenen Satz statt an der Auswahl; die offene Zeile trägt links eine Kante, ein zweiter Klick schließt sie
- **„Eine Ebene höher"** als Knopf und Menü-Eintrag ([knoten-edit.ts](src/core/meilensteine/knoten-edit.ts)): der Knoten wird Geschwister seines Elternteils und landet direkt dahinter — bisher führte da nur die Maus heraus
- **Beide Ausgänge des Ziehens sind sichtbar** ([TfTree.tsx](src/components/tree/TfTree.tsx)): 3-px-Marke mit Punkt am Anfang für „dazwischen", 2-px-Rahmen für „hinein" — gilt für jeden Baum der App
- **Regeln dichter gesetzt** ([BedingungEditor.tsx](src/plugins/meilensteine/BedingungEditor.tsx)): am echten Plan gemessen 361 → 284 px für einen Meilenstein mit vier Bedingungen (−21 %)

### v4.3.0 — Verfahrensschritte wirken überall, Meilenstein-Regeln überleben den Neustart (August 2026)

MINOR — Der Phasenschnitt ist seit v2.409 kuratierbar, aber drei Stellen führten weiter ihre eigene Kopie — darunter zwei Wörter („Fachprüfung", „Nachforderung"), die in KEINER Fassung ein Phasenlabel waren. Daneben ein stiller Datenverlust: der Meilenstein-Editor bot neun Bedingungs-Operatoren an, das Lesen kannte sechs. Detail: [status-achsen.md](docs/architecture/status-achsen.md), [meilensteine.md](docs/architecture/meilensteine.md).

- **Alle neun Operatoren überleben den Neustart** ([plan-storage.ts](src/core/meilensteine/plan-storage.ts)); eine UND-Gruppe, die einen Zweig verliert, gilt jetzt als **nie** erfüllt statt als immer — `[].every(…)` ist `true`, der Meilenstein galt sonst für jeden Verbund als erreicht
- **Fristlauf im Vorgangs-Board aus der Fassung** statt aus vier eingetippten Phasen-Ids ([boardFilter.ts](src/plugins/vorgangs-board/boardFilter.ts)) — die Auslieferung hält die Uhr damit in der Entscheidung an, steuerbar je Phase im Baum-Editor
- **Handlungs-Formel zeigt nur noch die Aktion** ([naechsterSchritt.ts](src/core/utils/naechsterSchritt.ts)); ohne hinterlegte Handlung steht dort die Status-Kurzform — betrifft Home, Kanban-Widget und den Assistenten-Kontext, dessen Zeile „Phase" jetzt korrekt **Fördervariante** heißt
- **Gutachten-Karte fragt die Arbeitsliste** statt zwei Phasen-Ids ([artefaktKarten.ts](src/plugins/antraege/artefakte/artefaktKarten.ts)) — „wer ist am Zug" ist deren Frage, und die steht im Code
- **Guard `zah-phase-single-source`** ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)): keine feste Phasen-Id, keine Phasen-Beschriftung als Literal — auf dem Vorher-Stand hätte er alle drei Fundstellen gemeldet

### v4.2.0 — Suche: Assistent am Rand, UND/ODER, größeres Feld, Rückweg (August 2026)

MINOR — Die Suchseite war eine Insel: eigener Assistent-Knopf im Kopf statt des Streifens am Rand, ein Feld für „analytische Fragen" von einer Zeile Höhe, und ein Treffer-Klick ohne Rückweg. Der schwerste Punkt lag darunter — mehrere Stichwörter wurden als EINE Zeichenkette gesucht. Gemessen am Bestand (14 221 Anträge): „laser schweißen" fand **0**, jetzt 21. Detail: [assistent-panel.md](docs/architecture/assistent-panel.md), [suche.md](docs/feedback-kontext/suche.md).

- **Ein Streifen auf jeder Seite** ([AssistentSpine.tsx](src/plugins/chat/assistent/AssistentSpine.tsx)): auf `/suche` schaltet er den vollen Such-Chat, sonst das schlanke Dock — der „Assistent"-Knopf im Seitenkopf entfällt, `<main>` reserviert die 28 px jetzt für jede Spine ([ShellLayout.tsx](src/core/ShellLayout.tsx))
- **UND/ODER als Schalter** neben dem Feld ([useSuchVerknuepfung.ts](src/core/hooks/useSuchVerknuepfung.ts)): wortweise statt ganz-Zeichenkette ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)) + Orama-`threshold` 0/1 ([orama-store.ts](src/core/services/search/orama-store.ts)) — die Ähnlichkeitssuche bleibt unberührt, sie kennt keine einzelnen Wörter
- **„Mit KI analysieren" öffnet den Assistenten**; die zeilenweise Begründung zieht als **„Treffer begründen"** zu ihrem Gegenstück „Begründungen entfernen" in die Filterzeile ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Suchfeld ist ein ziehbares `<textarea>`** ([SearchInput.tsx](src/plugins/suche/SearchInput.tsx)): Enter startet wie bisher, Shift+Enter bricht um, die Größe wird gemerkt; die Kopfzeile bricht um, statt die Bedienelemente zu quetschen
- **Rückweg aus dem Antrags-Detail** ([herkunft.ts](src/plugins/suche/herkunft.ts)): Anfrage + Trefferfilter liegen sitzungs-lokal im [Store](src/plugins/suche/store.ts), „Zurück zur Suche" steht in der Detail-Kopfzeile — auch der Browser-Zurück-Knopf zeigt wieder Treffer

### v4.1.1 — Alt-Ordner benennt, was zu tun ist (August 2026)

PATCH — Der Alt-Ordner bat um „neu zuordnen", nachdem längst zugeordnet war: die Aufforderung steckte in der Beschriftung und kannte die Lage nicht. Detail: [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md).

- **Die Zeile sagt, was gilt** ([wurzelLage.ts](src/core/services/personal-roots/wurzelLage.ts)): sind alle Gruppen verbunden, ist der Alt-Ordner abgelöst — „wird nicht mehr gebraucht", **Entfernen** als beschrifteter Knopf, „Erneut freigeben" bleibt als Rückweg erreichbar
- `PERSONAL_ROOT_LEGACY_LABEL` wieder **neutral** ([personal-roots.ts](src/config/personal-roots.ts)) — es erscheint auch im Sammelbericht, wo eine Aufforderung nichts zu suchen hat
- Seine Zeile bleibt sichtbar, **auch wenn er gerade lesbar ist**: sonst nähme ein erfolgreiches „Erneut freigeben" den einzigen Weg mit, ihn loszuwerden
- Der erklärende Satz erscheint nur noch, wenn wirklich eine Gruppe zu verbinden ist ([WurzelnVerbinden.tsx](src/core/components/WurzelnVerbinden.tsx))
- `'kein-zugriff'` statt `0` im Bericht, wo wegen verfallener Berechtigung gar nicht gelesen wurde ([sammelBericht.ts](src/core/services/personal-roots/sammelBericht.ts)) — der Ausgang existierte, nur erzeugte ihn niemand

### v4.1.0 — Multi-Root für persönliche Ordner (August 2026)

MINOR — Die persönlichen Ordner liegen ab sofort unter zwei Wurzeln statt einer (PL, Bearbeiter). Der bisherige Einzel-Slot wird zum Präfix-Slot nach dem Muster der DMS-Quellen. Das eigentliche Risiko liegt daneben: „kein Handle → `return`" war bei EINER Wurzel ehrlich, bei zweien sieht Teil-Einsammeln aus wie Erfolg. Detail: [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md).

- **Wurzeln aus der Config** (`personalFolder.roots`, [personal-roots.ts](src/config/personal-roots.ts)) — eine dritte Gruppe ist ein Config-Eintrag, kein Release; `getUserFoldersRoots` ist die einzige Lesestelle und liefert auch die NICHT verbundenen (Guard `personal-roots-single-reader`)
- **Ein Knopf je Gruppe** statt Auto-Pick im Sammel-Klick ([WurzelnVerbinden.tsx](src/core/components/WurzelnVerbinden.tsx)): unter `file://` verbraucht jeder Berechtigungs-Dialog die User-Activation, eine Schleife verhungert ab der zweiten Wurzel
- **Bericht je Wurzel** statt Summe („PL-Ordner: 4 eingesammelt · Bearbeiter-Ordner: nicht verbunden"), 0 wird ausgeschrieben; kein harter Gate — [sammelBericht.ts](src/core/services/personal-roots/sammelBericht.ts)
- **Dubletten-Regel** an genau einer Stelle ([juengsterGewinnt.ts](src/core/services/personal-roots/juengsterGewinnt.ts)): dieselbe Person unter zwei Wurzeln → jüngster Stand, kein Root hat Vorrang; Store-Applies laufen weiter genau einmal (Pitfall #16/#20)
- **Stale-Guard** in [mergeSponsorVotes.ts](src/core/services/feedback/mergeSponsorVotes.ts) + [mergeFeedbackVotes.ts](src/core/services/feedback/mergeFeedbackVotes.ts): die vier `autoCollect*` sind Read-Modify-Write-Zyklen ohne Lock, ihr Batch existiert am Aufrufort nicht — eine ältere Quelldatei darf die frische Stimme nicht zurückziehen
- Der Alt-Slot bleibt **lesbar** und erscheint als eigener Eintrag „Bisheriger Ordner (bitte neu zuordnen)" — nie automatisch einer Gruppe zugeordnet

### v4.0.0 — Ablageort-Umzug + CSV-Pfad-Anzeige (August 2026)

MAJOR — Der Datenordner zieht um. Ein neuer Pfad in der Config allein bewirkt dabei **nichts**: ein FSAPI-Handle hängt am Dateisystem-Objekt, nicht am Anzeigepfad — bestehende Installationen hätten still im alten Ordner weitergeschrieben, halbes Team auf neu, halbes auf alt, bei live geteilter `registry.json`. Also ein explizites Gate. Detail: [build-varianten.md](docs/architecture/build-varianten.md).

- **Umzugs-Gate**: `data.shareGeneration` in der Config gegen die zuletzt verbundene Generation in der IDB; liegt sie zurück, zeigt der Start den neuen Pfad und erzwingt EIN Neu-Verbinden — [share-generation.ts](src/core/services/infrastructure/share-generation.ts), [StartupScreen.tsx](src/core/StartupScreen.tsx)
- Der alte Handle bleibt dabei **stehen**; `connectDataShare` rollt bei falschem Ordnernamen oder gewähltem Unterordner auf ihn zurück (der Picker persistiert VOR der Prüfung) und stempelt die Generation nur am Erfolg — [connect-data-share.ts](src/core/services/infrastructure/connect-data-share.ts)
- **CSV-Import-Pfad** (`data.fixedCsvImportPfad`) wird beim Verknüpfen angezeigt und ist kopierbar — die FSAPI erlaubt keine Vorauswahl; Kopieren und Picken bleiben zwei Knöpfe (User-Activation) — [SpeicherTab.tsx](src/plugins/einstellungen/SpeicherTab.tsx), [CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx)
- Der doppelt nachgebaute Pfad-Kopier-Block ist **ein** Bauteil auf `useKopierAktion` — [PfadKopierZeile.tsx](src/components/ui/PfadKopierZeile.tsx); der Beispielpfad im WelcomeScreen nennt keinen echt aussehenden Ordner mehr
- Die Fehlermeldung des Kopier-Helfers sprach vom „Auftragstext" und stand damit wörtlich unter einem Pfad-Knopf — [kopieren.ts](src/core/utils/kopieren.ts)

**Migration**: Keine Datenmigration. Beim ersten Start nach dem Rollout erscheint einmalig das Umzugs-Banner; ein Klick auf „Neuen Datenordner verbinden" genügt. Reihenfolge beim Ausrollen: **erst** den Ordner auf dem Share umziehen, **dann** die Builds mit `shareGeneration: 2` verteilen — umgekehrt landen alle im Gate, während das Ziel noch nicht existiert. Den alten Ordner nicht löschen, sondern schreibgeschützt setzen.

### v3.49.0 — Kanban-Bahnen einklappbar, Kanban im eigenen Fenster (August 2026)

MINOR — Gewünscht: Bahnen einklappen wie im Feedback-Board, und ein Vollbild-Zeichen, das alle eigenen Anträge in einem eigenen Fenster zeigt. Das Einklappen war ein Flag am Primitiv, das die Widgets nie gesetzt hatten — leere Bahnen waren dort 44 px, die aussahen wie ein Knopf und keiner waren. Detail: [fenster-in-fenster.md](docs/architecture/fenster-in-fenster.md) + [board-komponente.md](docs/architecture/board-komponente.md).

- **Bahnen einklappbar** in beiden Home-Kanbans (`features.einklappbar`), Zustand bleibt flüchtig — [AntragKanbanWidget.tsx](src/plugins/home/widgets/AntragKanbanWidget.tsx)
- **Kanban im eigenen Fenster**: `about:blank` erbt die Herkunft des Openers, eine zweite React-Wurzel darin teilt Realm und Stores mit der App statt sie neu zu starten; Stile und Theme werden gespiegelt und nachgeführt — [appFenster.ts](src/components/fenster/appFenster.ts), neuer Guard `no-parallel-fenster-features`
- Dort **alle** Kategorien mit Karten (nicht nur die konfigurierten), ohne Kappung, Spaltenzahl aus dem Bestand — [kanbanLanes.ts](src/plugins/home/widgets/kanbanLanes.ts); Karten-Klick öffnet den Antrag in der App, das Verlassen der Startseite friert den Stand **sichtbar** ein
- **Zweispalten-Boden korrigiert** (445 px `gedeckelt` / 329 px `geteilt`, vorher 300 für beide): sieben Bahnen in 1600 px landeten alle auf dem Boden, die Karte maß 132 statt 210 px — zwei Spalten machten die Karte schmaler statt die Bahn kürzer — [tf-board.css](src/components/kanban/tf-board.css)
- Fenster-Geometrie aus der Seiten-Hilfe **gehoben** statt kopiert ([fensterGeometrie.ts](src/components/fenster/fensterGeometrie.ts)); Kategorien-Reihenfolge lag zweimal wortgleich, jetzt bei den Beschriftungen ([status-category-labels.ts](src/core/utils/status-category-labels.ts))

### v3.48.0 — Chronik: wer hat gesetzt, was fehlt (August 2026)

MINOR — Gewünscht: als FB auf einen Blick sehen, welche Kürzel meine sind, was der AB gesetzt hat und wo eine Seite offen steht. Beides lag längst vor — die Rolle am Feld, die Lücke im Wächter —, nur nicht in der Chronik. Dazu drei Flächen weg, die keiner benutzt. Detail: [vorgangssystem.md §16.11/§16.12](docs/architecture/vorgangssystem.md).

- **Rollenspalte** (AB/FB/QS/PA/Jur) hinter dem Tag, neutrale Einträge bleiben leer; gemessen tragen 26 von 29 Zeilen ein Kürzel, Zeilenhöhe unverändert 20 px — [StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx)
- **Eigene Rolle** aus dem Profil (`status_rolle`): Kante auf der Achse + Kürzel in `--tf-primary`, Kopf sagt „hervorgehoben: FB". **Hervorheben statt filtern** — der Partner bleibt sichtbar
- **Fehlende Gegenstücke** als Zeile unter dem gesetzten Termin („Gutachten kaufmännisch fertig · fehlt seit 159 T"), **je Teilvorhaben** gerechnet und nicht als Termin gezählt — [waechter.ts](src/core/status/waechter.ts)
- Reiter **„Zeitstrahl"** (Ereignis-Protokoll, blieb leer) entfallen, das **Band** erbt den Namen; der gespeicherte Wert bleibt `band`, ein alter `zeitstrahl` fällt auf die Chronik zurück — [timelinePrefs.ts](src/plugins/antraege/status/timelinePrefs.ts)
- **Fristen-Band der Detailseite** entfernt — es stand vor dem Aufklapp-Rumpf und war die einzige nicht schließbare Fläche; mit ihm `StatusTimeline`, `baueLanes`/`clustere`, `aufzeichnungsGrenze` und `fristen-band/`

### v3.47.0 — Encoding-Drift heilt sich, fehlende Spalten sind uebergehbar (August 2026)

MINOR — Gewünscht war ein Schalter, um blockierende Spalten-Drift zu übergehen. Beim Nachsehen war die Drift auf allen drei Quellen der lokalen Kopie **dieselbe Spalte zweimal**: der Export wechselte auf UTF-8, `Nachrücker` las sich als `NachrÃ¼cker`. „Trotzdem importieren" hätte dort jeden Umlaut im Bestand verstümmelt. Also beides — Heilung zuerst, Ausweg danach. Detail: [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md).

- **Encoding-Drift heilt sich**: bei Drift wird einmal ohne erzwungenes Encoding gelesen; übernommen wird nur, wenn danach **keine** Schema-Spalte mehr fehlt (`encodingHeilungTraegt`) — [csv-drift-check.ts](src/plugins/csv-sources-kuration/services/csv-drift-check.ts)
- Das erkannte Encoding geht **vor** dem Import ins Schema (`csv_schema_encoding_korrigiert`), damit `importCsvSource` es selbst aufgreift — der Re-Import-Dialog konnte das seit je, der automatische Weg nicht
- Eine reine **Schema-Änderung publiziert jetzt** (Encoding/adoptierte Spalte): vorher wuchs `programmeToPublish` nur bei Zeilen-Deltas, ein Kodierungs-Wechsel ist aber inhaltlich identisch — die Korrektur blieb lokal, der Snapshot trug die alte Kopie weiter, jeder andere Rechner heilte erneut
- **„Trotzdem importieren"** pro Quelle im Drift-Bericht (`driftAkzeptiertFuer`): einmalig, nie gespeichert, protokolliert als `csv_auto_refresh_drift_akzeptiert` — [auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)
- Der Bericht zeigt dafür die **Spaltennamen** statt nur Zähler und benennt die Folge (Felder werden geleert, soweit keine andere Quelle sie trägt) — [CsvAutoRefreshDriftDialog.tsx](src/plugins/csv-sources-kuration/components/CsvAutoRefreshDriftDialog.tsx)
- „Erzwungen geprüft — keine Änderungen gefunden" verschweigt keine übersprungenen Quellen mehr — [CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx)

### v3.46.1 — Ein Lock je Aktualisierungslauf — kein Abbruch am eigenen Nachhall (August 2026)

PATCH — Gemeldet (nur Citrix, tagelang unauffällig): zwei neue CSV-Quellen, erste importiert, dann brach der Lauf ab und das Banner meldete **„THü (PL) aktualisiert gerade"** — der Nutzer war allein in der App. Der Lock wurde pro Quelle genommen; im Freigabe-Fenster dazwischen legte ein noch laufender Heartbeat-Schlag die gelöschte Lock-Datei neu an. Beweis im Audit-Log: zweimal ein `build_lock_force` gegen den **eigenen** Namen, eine Sekunde nach dem eigenen Release. Detail: [recurring-bug-classes §19](docs/architecture/recurring-bug-classes.md) + Pitfall #52.

- **Ein Lock je Lauf** statt je Quelle: gehalten über alle Quellen **plus** Snapshot-Write (`lockHeldByCaller`) — aus N Freigabe-Fenstern wird eines ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts))
- `startHeartbeat(idb).stop()` **wartet den laufenden Schlag ab**; `heartbeat` prüft sein Stopp-Flag direkt vor dem Write und hält keinen fremden Lock frisch ([build-lock.ts](src/core/services/infrastructure/build-lock.ts))
- Der Lock trägt eine Tab-Kennung (`owner_id`, nicht persistiert): ein eigenes Überbleibsel wird übernommen, ein fremder Lock nie — Alt-Locks verhalten sich unverändert
- Freigabe wird **verifiziert** statt behauptet: nachlesen, einmal nachfassen, sonst `build_lock_release_failed` — der Erfolgs-Eintrag log bisher auch bei fehlgeschlagenem Löschen
- Banner nennt nicht mehr den eigenen Namen als Fremd-Blockierer (`fremd` / `gleicher-name` / `eigener-tab`, [lockKonfliktText.ts](src/plugins/csv-sources-kuration/components/lockKonfliktText.ts)); Abbruch durch echten Fremd-Lock passiert jetzt **vor** dem ersten Import, hinterlässt also keine gemergten-aber-unpublizierten Quellen

### v3.46.0 — Chronik zweispaltig, Schalter nur mit Inhalt (August 2026)

MINOR — Gemeldet: der Schalter „Nebensächliches" zeigt keine Wirkung — er ist **gegenstandslos**, keine der 15 nebensächlichen Kommunikations-Spalten existiert in einem der acht Import-CSVs. Dazu die gewünschte Verdichtung: der Verlauf soll auf einen Blick dastehen. Detail: [vorgangssystem.md §16.10](docs/architecture/vorgangssystem.md). Code bereits in `ba77c447`.

- Monat links in einer eigenen Spalte, ein Termin auf **einer** Zeile (Begleittext gekürzt, voller Wortlaut im `title`) — [StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx)
- Der Chip erscheint nur, wenn der Vorgang nebensächliche Termine hat, und trägt ihre Anzahl; `teileChronik` trennt die fertige Chronik statt sie zweimal zu bauen — [chronik.ts](src/core/status/chronik.ts)
- Zähler nennt die Spanne; ab **zwei** übersprungenen Monaten steht „N Monate ohne Termin" in der Monatsspalte (`monateDazwischen`)
- Zeilenhöhe in **px** statt als Faktor: ein Faktor rechnet gegen die geerbte Schriftgröße — gemessen 20 px im Ausklapp gegen 24 px auf der Detailseite
- Gemessen (13 090 Vorgänge: Median 22 Termine in 6 Monaten): `16EP250140` (28/8) 1 003 → **659 px**, ein Median-Fall **460 px**

### v3.45.0 — Ein Board-Primitiv statt dreier Nachbauten (August 2026)

MINOR — Das Kanban-Lane-Layout stand dreimal da: als geteilte Shell (v2.228 aus dem Feedback-Kanban extrahiert) und, seit dem Handoff v3.17, ein zweites Mal als CSS im Feedback-Board. Belegte Folge: der **1|2-Spalten-Schalter des Boards war wirkungslos** — im Popover wählbar, persistiert, durchgereicht, im Nachbau nie gelesen. Detail: [board-komponente.md](docs/architecture/board-komponente.md).

- Neues Primitiv `TfBoard` trägt alle drei Kanbans (Feedback-Board + beide Home-Widgets); `KanbanBoard.tsx` entfällt ([src/components/kanban/](src/components/kanban/TfBoard.tsx))
- **Der 1|2-Spalten-Schalter wirkt jetzt**: eine zweispaltige Bahn wird doppelt so breit und stellt ihre Karten nebeneinander ([tf-board.css](src/components/kanban/tf-board.css))
- Karten-Ziehen läuft über eine opake Naht (`zieh`), damit ein späterer Bibliotheks-Einzug keinen Aufrufer anfasst — heute weiter natives HTML5 ([TfBoard.tsx](src/components/kanban/TfBoard.tsx))
- Zwei Guards halten die Wiederholung fern: `no-parallel-board-geometry` + `no-parallel-board-dnd` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts))
- Gemessen und angeglichen: Kopf-Lücke 4 px (bei „Wartet auf Antragsteller" in 170 px fehlten der Bezeichnung genau 4), Zähler rechtsbündig (vorher 148 px Leerraum dahinter), Schiene einheitlich 44 px

### v3.44.1 — Vorgangsverlauf: Chronik ungekuerzt, Nachschlage-Bloecke zu (August 2026)

PATCH — Der Höhendeckel aus v3.44.0 saß an der falschen Stelle: der Reiter wird **wegen** des Verlaufs geöffnet, und ein Kasten, der zehn von 28 Terminen zeigt, liest sich als der ganze Verlauf. Die Länge fangen jetzt die Blöcke darunter ab. Detail: [vorgangssystem.md §16.9](docs/architecture/vorgangssystem.md).

- Chronik ohne Höhendeckel und ohne eigenen Scrollbereich, im Ausklapp wie auf der Detailseite — die Prop `maxHoehe` entfällt ersatzlos ([StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx))
- „Ohne Termin im Export" und „Wie die Bearbeitungsfrist zustande kommt" starten **zugeklappt**; die erste trägt ihre Anzahl in der Überschrift ([VorgangsverlaufReiter.tsx](src/plugins/antraege/ausklapp/vorgangsverlauf/VorgangsverlaufReiter.tsx))
- Auch die beiden Klapp-Zustände werden nicht persistiert — lokaler `useState` wie der Schalter „Nebensächliches", der Ausklapp merkt sich weiterhin nichts
- Gemessen: `16EP260076` (15 Termine) 1 184 → **989 px** trotz jetzt vollständiger Chronik; `16EP250140` (28 Termine) 1 525 px, davon 1 003 px Chronik

### v3.44.0 — Vorgangsverlauf zeigt die Chronik (August 2026)

MINOR — Der Reiter hieß wie das C16-Fenster und zeigte die **Fristrechnung** — darin genau zwei Feldkürzel (`D_AAE`, `D_XTE`). Wer ihn wegen seines Namens öffnete, fand keinen Verlauf; die Chronik gab es nur auf der Verbund-Detailseite. Detail: [vorgangssystem.md §16.9](docs/architecture/vorgangssystem.md).

- Drei Blöcke statt einem: Chronik · Ohne Termin im Export · Fristrechnung — [VorgangsverlaufReiter.tsx](src/plugins/antraege/ausklapp/vorgangsverlauf/VorgangsverlaufReiter.tsx)
- Die Chronik ist die **wiederverwendete** [StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx) der Detailseite, kein zweiter Renderer; neu ist nur ihr optionaler Höhendeckel
- Codes, die der Export nur als Wert führt (`T_ABK`, `T_AMA`, …), stehen als eigener Block — Begleitnotizen zu Datumsfeldern (`T_AAI`) ausdrücklich nicht — [ohneDatum.ts](src/plugins/antraege/ausklapp/vorgangsverlauf/ohneDatum.ts)
- Gemessen: Median 22 Termine je Vorgang (p90 31, max 47) → Liste im Ausklapp auf 320 px gedeckelt, Zähler bleibt stehen; Detailseite unverändert ungedeckelt
- Gegen C16 gemessen: von 25 Protokollzeilen liefert der Export 15 datiert, 6 nur als Wert, 4 gar nicht (`AA`, `XARF`, `ID` zweimal) — eine Frage an die Export-Definition, kein Code-Fehler

### v3.43.2 — Stillstands-Waechter: Zeile und Board sagen wieder dasselbe (August 2026)

PATCH — Gemeldet als Nebenbefund: das Board sagt für `16EP250140` „hängt ≥23 T", der Fristen-Reiter derselben Zeile „läuft". Ursache war kein zweiter Evaluator, sondern eine vertauschte Eingabe — der Ausklappbereich reichte den **Nullpunkt** des Journals als **letzte Änderung** durch (seit v3.31). Detail: [vorgangssystem.md §12.2](docs/architecture/vorgangssystem.md).

- `ZeilenVerlauf.journalAenderung` neu: die belegte letzte Änderung DIESER Zeile, `null` wo die Chronik sie nicht deckt — [useZeilenVerlauf.ts](src/plugins/antraege/ausklapp/useZeilenVerlauf.ts)
- Die drei Aufrufer lesen sie statt `journalAb` — [ZeilenBereich.tsx](src/plugins/antraege/ausklapp/ZeilenBereich.tsx), [VerbundFristenBand.tsx](src/plugins/antraege/fristen-band/VerbundFristenBand.tsx), [VerbundBand.tsx](src/plugins/antraege/verlauf-band/VerbundBand.tsx)
- Am Bestand gemessen: 1 056 von 1 057 hängenden Vorgängen meldeten in der Zeile „läuft"; Wortlaut und Zahl decken sich jetzt mit dem Board (25 T, Ziel 14)
- Guard `kein-nullpunkt-als-letzte-aenderung` — beide Werte sind `string | null`, der Typ konnte sie nie trennen — [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)
- Nebenwirkung: die Stillstands-Marke der Verlaufs-Bahn (v3.38) ist erstmals am echten Bestand zu sehen, nicht nur über eine invertierte Bedingung

### v3.43.1 — Spaltenkopf ohne Einklapp-Zeichen; Dunkelmodus kein Abnahme-Kriterium (August 2026)

PATCH — Zwei Ansagen: „das Einklapp-Icon kann weg, Tooltip reicht" und „Dunkelmodus wird gar nicht genutzt, muss ab jetzt nicht mehr optimiert werden". Letzteres rückwirkend relevant: die Füllung der eingeklappten Bahn (v3.43.0) wich allein einem Dunkel-Kontrast von 3,7:1.

- Kein `PanelLeftClose` mehr in der Kopfzeile — sie IST die Klickfläche, der Titel sagt, was ein Klick tut; die Hover-Fläche bleibt der Hinweis — [TicketBoard.tsx](src/plugins/feedback-board/ticket/TicketBoard.tsx), [ticketsystem.css](src/plugins/feedback-board/ticketsystem.css)
- Dunkelmodus ist **kein Abnahme-Kriterium** mehr: Checkliste durchgestrichen, hell entscheidet bei Widerspruch — [DESIGN_GUIDE.md](DESIGN_GUIDE.md)
- Unverändert Pflicht: Tokens statt Hex, Guard `theme-token-contract`, Palette in DESIGN_GUIDE Kap. 9 — der Dunkelmodus soll funktionieren, nur nicht mehr optimiert werden

### v3.43.0 — Jede Board-Lane voruebergehend einklappbar (August 2026)

MINOR — Gewünscht: „User soll eine Lane egal ob sie voll ist oder nicht vorübergehend einklappen können (um die anderen besser lesen zu können)". Bis v3.42.1 konnte das nur eine LEERE Bahn; für eine gefüllte gab es allein das dauerhafte Ausblenden über die Lane-Auswahl. Detail: [feedback-system.md](docs/architecture/feedback-system.md).

- `spaltenAnsicht` nimmt einen Wunsch (`auto` · `offen` · `zu`) statt eines Booleans und kennt den vierten Zustand `voll-schiene` — [boardSpalten.ts](src/plugins/feedback-board/boardSpalten.ts)
- Der Spaltenkopf ist der Einklapp-Schalter (`PanelLeftClose`, app-weit „Fläche einklappen"); die Schiene trägt den echten Bestand statt einer Null — [TicketBoard.tsx](src/plugins/feedback-board/ticket/TicketBoard.tsx)
- Eingeklappt ≠ ausgeblendet: die Bahn bleibt Drop-Ziel, behält die volle Akzentkante und bleibt beim Ziehen schmal — [ticketsystem.css](src/plugins/feedback-board/ticketsystem.css)
- Nicht persistiert (Komponenten-State) — der Zustand beantwortet „was schaue ich gerade an", nicht „wie soll mein Board aussehen"; letzteres bleibt die Lane-Auswahl unter „Board anpassen"
- Gatter: jeder von Hand erzeugte Zustand kommt mit `auto` zurück, unerreichbare Bahnen bleiben unter JEDEM Wunsch Schiene (v3.39) — [boardSpalten.test.ts](src/plugins/feedback-board/__tests__/boardSpalten.test.ts)

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

