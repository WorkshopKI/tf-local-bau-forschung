# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

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

### v2.295.1 — Skill- und Regel-Tabelle in der Breite ziehbar (Juli 2026)

PATCH — Die Default-Spalten der Skill-Tabelle summieren sich auf ~1.280px und liefen damit horizontal aus der Content-Box; dieselbe Ursache in der Qualitätsregeln-Tabelle. Die Förderanträge-Tabelle löst das bereits über einen Gesamtbreiten-Griff am rechten Rand.

- Skill-Tabelle bekommt den Gesamtbreiten-Griff (Ziehen skaliert alle Spalten proportional, Doppelklick setzt auf Fensterbreite zurück) ([SkillsTab.tsx](src/plugins/skill-verwaltung-kuration/SkillsTab.tsx)).
- Qualitätsregeln-Tabelle ebenso — gleiche Seite, gleiche Ursache ([RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx)).
- Kein neuer Baustein: `useTotalTableWidth` + `SortableTable`-Griff sind unverändert übernommen ([useTotalTableWidth.ts](src/components/data-table/useTotalTableWidth.ts)).

### v2.295.0 — Skill-Liste: Kategorien, Badges als Spalte, Tabelle als Standard (Juli 2026)

MINOR — 21 Skills standen flach und ohne fachliche Ordnung untereinander — Gutachten-Abschnitte, Aufbereitungs-Läufe, Anfragen-Skills und QS-Hilfsläufe gemischt. Zugleich zeigte ausgerechnet die dichteste Ansicht (Tabelle) die Reifegrad-/„inaktiv"-Badges gar nicht.

- Neue Kategorie-Achse für Skills (Gutachten · Nachforderungen · Aufbereitung · Anfragen · Qualitätssicherung · Sonstige), abgeleitet aus id/Name, Kurator-Override möglich ([skill-kategorien.ts](src/core/services/skills/registry/skill-kategorien.ts), `SkillRecord.kategorie`).
- Skill-Liste sortiert standardmäßig nach Kategorie, neue Kategorie-Facette mit Zähler; Sortier-Auswahl gilt jetzt in allen drei Ansichten ([skill-browse.ts](src/plugins/skill-verwaltung-kuration/skill-browse.ts), [SkillsTab.tsx](src/plugins/skill-verwaltung-kuration/SkillsTab.tsx)).
- Tabelle bekommt die Spalten „Kategorie" + „Status" (Reifegrad + inaktiv) sichtbar und „Transport" (nur intern / extern möglich) zuschaltbar ([skillTableColumns.tsx](src/plugins/skill-verwaltung-kuration/skillTableColumns.tsx), [skillBadges.tsx](src/plugins/skill-verwaltung-kuration/skillBadges.tsx)).
- Tabelle ist die Standard-Ansicht für Skills und Regeln — Storage-Keys `teamflow_skillreg_view_mode_v2` / `teamflow_skills_table_columns_v2` gebumpt, sonst hätten Alt-Einstellungen gewonnen ([SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx)).
- Kategorie im Skill-Editor setzbar (leer = abgeleitet, nur ein gesetzter Wert persistiert); `normalizeSkill` trägt das Feld durch Laden und Bundle-Import ([SkillEditor.tsx](src/plugins/skill-verwaltung-kuration/SkillEditor.tsx), [storage.ts](src/core/services/skills/registry/storage.ts)).

### v2.294.2 — Wortanzahl in der Meta-Zeile unter dem generierten Text (Juli 2026)

PATCH — Der Umfang eines Abschnitts wird in Wörtern beurteilt (die `wortanzahl`-Regel prüft genau das), die Meta-Zeile unter dem Text nannte aber nur die Satzzahl. Wer die Wortzahl wissen wollte, musste den Prüf-Block aufklappen oder den Text herauskopieren.

- Meta-Zeile zeigt `N Sätze · M Wörter · Entwurf` ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)); gleiche Zeile in der Kurzfassung ([ReviewCard.tsx](src/plugins/antraege/kurzfassung/ReviewCard.tsx)).
- `countWords` der Check-Engine wird exportiert statt nachgebaut — Anzeige und `wortanzahl`-Regel zählen garantiert gleich ([check-engine.ts](src/core/services/skills/registry/check-engine.ts)).

### v2.294.1 — Text kopieren sitzt jetzt direkt am Abschnitt (Juli 2026)

PATCH — Kopieren ist der häufigste Weg, einen fertigen Abschnitt weiterzuverwenden, saß aber als kleines Icon ohne Beschriftung ganz unten in der Knopfleiste — zwischen Bearbeiten, Daumen und Stil-Einstellungen und damit leicht zu übersehen.

- „Text kopieren" wandert **beschriftet in die Meta-Zeile direkt unter den Abschnitt**, neben das Info-Icon; aus der Aktionsleiste (Entwurf + freigegeben) entfernt ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)).
- Tooltip „Text in Zwischenablage kopieren", Erfolgs-Quittung als grüne „Kopiert"-Pille ([gutachten.css](src/plugins/antraege/gutachten/gutachten.css)).

### v2.294.0 — Sprachlicher Feinschliff fuer Gutachten-Abschnitte (Juli 2026)

MINOR — Ist ein Gutachten-Abschnitt inhaltlich und vom Umfang her abgenommen, gab es bisher nur „Neu / Kürzer / Länger" — und die generieren aus der Vorhabensbeschreibung neu, der mühsam abgestimmte Inhalt verschob sich also wieder. Für den letzten, rein sprachlichen Arbeitsgang fehlte ein Werkzeug.

- **„Sprachlicher Feinschliff"** in der Anpassen-Zeile der Abschnitts-Karte, abgesetzt von Neu/Kürzer/Länger; nur bei Entwürfen ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)).
- **Lektor-Skill** als kurator-pflegbare Registry-Daten; sein Prompt trägt **nur** den Abschnittstext, keine Vorhabensbeschreibung → intern-pflichtig (Pitfall #30) ([ga-lektor.seed.ts](src/core/services/skills/registry/ga-lektor.seed.ts)).
- **Deterministischer Wächter**: Zahlen-Inventar + Längen-Delta vorher/nachher, beratender Hinweis an der Karte ([lektorat.ts](src/plugins/antraege/gutachten/lektorat.ts)).
- Abgeschnittene oder leere Lektor-Antworten werden **verworfen** statt geschrieben ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)).
- Vorfassung landet im Versionsverlauf → Diff + „Diese Fassung übernehmen" wie gewohnt ([runner.ts](src/plugins/antraege/gutachten/runner.ts)); Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

### v2.293.0 — Teilvorhaben-Zeile: Eckdaten und Klassifikation raus, Titel kopierbar (Juli 2026)

MINOR — Der aufgeklappte Teilvorhaben-Block zeigte eine Eckdaten-Karte, deren Werte (Antragsteller, VB-Phase, Unterprogramm, Antragsdatum) schon im Verbund-Kopf und in „Antragsdaten" stehen, plus Klassifikations-Pills, die per Feldnamen-Heuristik auf echten Daten nichtssagende Ein-Buchstaben-Tags produzierten. Gleichzeitig war der TV-Titel — der oft in andere Dokumente übernommen wird — weder markierbar noch einzeln kopierbar, weil die ganze Zeile ein `<button>` war.

- **Eckdaten-Karte** im Verbund-Kontext entfernt; nur der eigenständige Antrag ohne Verbund setzt noch `zeigeEckdaten` ([TvDetailBlock.tsx](src/plugins/antraege/TvDetailBlock.tsx), [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)).
- **Klassifikations-Pills** ersatzlos gestrichen (`KlassifikationPills.tsx` gelöscht).
- TV-Zeile ist jetzt das `role="button"`-Div statt `<button>` → **Titel mit der Maus markierbar**; Selektions-Guard verhindert das Zuklappen beim Loslassen ([TeilvorhabenListe.tsx](src/plugins/antraege/TeilvorhabenListe.tsx)).
- **Kopier-Icon je TV-Zeile** (Hover/Fokus) legt den vollen Titel in die Zwischenablage — auch den von `line-clamp-2` abgeschnittenen Teil ([TvTitelCopyButton.tsx](src/plugins/antraege/TvTitelCopyButton.tsx), jetzt mit `stopPropagation`).
- Kontext-Doc der Bildschirmseite nachgezogen ([antraege.md](docs/feedback-kontext/antraege.md)).

### v2.292.1 — Feedback-Titel wird nicht mehr abgeschnitten (Juli 2026)

PATCH — Lange Feedback-Titel waren doppelt gekürzt: in der Board-Liste einzeilig mit „…" (plus 90-Zeichen-Kappung), im Detail bei 140 Zeichen. Der Nutzer konnte seinen eigenen Titel nicht zu Ende lesen.

- **Board-Liste**: Titel bricht voll um statt einzeilig zu kürzen ([FeedbackCard.tsx](src/components/feedback/FeedbackCard.tsx)).
- **Board-Detail**: Überschrift ungekürzt ([FeedbackBoardDetail.tsx](src/components/feedback/FeedbackBoardDetail.tsx)).
- **Kurator-Liste + -Detail** analog ([FeedbackTicketRow.tsx](src/components/feedback/FeedbackTicketRow.tsx), [FeedbackTicketDetail.tsx](src/plugins/feedback/sections/FeedbackTicketDetail.tsx)).
- `feedbackTitle(item, Infinity)` = nicht kürzen; Kanban-Karten + Home-Widgets bleiben bewusst gekappt ([feedbackUi.ts](src/components/feedback/feedbackUi.ts)).
- Board-Suche liest den vollen Titel statt der ersten 90 Zeichen ([FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)).

### v2.292.0 — Feedback verbessern: Standard-KI + ein Lauf statt zwei (Juli 2026)

MINOR — „Feedback verbessern" lief minutenlang und zeigte im KI-Tab lange Reasoning-Schleifen bis zur Wiederholungs-Erkennung: der Lauf reichte als einziger kein `ziel` durch und landete damit im aktiven — also ggf. agentischen — Tab, ohne Chat-Reset und mit zwei LLM-Läufen, von denen der erste oft nichts zu fragen hatte. Details: [feedback-system.md](docs/architecture/feedback-system.md#feedback-verbesserung-geführter-ablauf-intern-only-v2206).

- **Immer die Standard-KI** (`FEEDBACK_ZIEL`) statt des aktiven Tabs, und **frischer Chat vor jedem Lauf** inkl. Retry (Pitfall #36) ([feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts)).
- **Rückfragen-Lauf entfällt deterministisch**, wenn alle nicht-optionalen Felder befüllt sind oder der Typ nur eines hat — ein statt zwei KI-Aufrufe ([feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts), [constants.ts](src/components/feedback/constants.ts)).
- **Kategorie wird vorgegeben statt erfragt** (aus der Typ-Wahl) und im Parser erzwungen; die Kategorie-Abgrenzung fällt aus beiden Verbessern-Prompts ([feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts)).
- **Ladezustand nennt die genutzte KI** und erklärt sie, wenn die globale Variante auf „Agentisch" steht ([FeedbackVerbessernFlow.tsx](src/components/feedback/FeedbackVerbessernFlow.tsx)).
- **Tests** für Reset+Ziel je Lauf, den übersprungenen Rückfragen-Lauf und die erzwungene Kategorie ([feedbackImprove.test.ts](src/core/services/feedback/__tests__/feedbackImprove.test.ts)).

### v2.291.0 — Zuweisung wartet sichtbar auf die CSV-Bestätigung (Juli 2026)

MINOR — Das eigentliche Zuweisen passiert im Fachsystem; bestätigt wird es erst durch den CSV-Import am Folgetag. Dieses Warten war in der App unbenannt: die MA sah „Vorgemerkt" mit Rückgängig-Knopf, die PL sah nicht, wenn eine Bestätigung ausblieb. Details: [auslastung.md](docs/architecture/auslastung.md#zuweisung--vollzug-das-csv-bestätigt-v2291).

- **Dritter Zeilen-Zustand „Dir zugewiesen · Bestätigung folgt"** auf der Startseite — ohne Aktion, denn die Entscheidung fällt im Fachsystem ([neueAntraegeVerbund.ts](src/plugins/home/neueAntraegeVerbund.ts), [NeueAntraegeVerbundRow.tsx](src/plugins/home/NeueAntraegeVerbundRow.tsx)).
- **Fremd zugewiesene Verbünde verschwinden aus dem Angebot** — verbund-weit, nicht erst wenn die CSV das Kürzel bringt ([NeueAntraegeFuerDich.tsx](src/plugins/home/NeueAntraegeFuerDich.tsx)).
- **Detail-Streifen benennt den Wartezustand** (`CSV-Bestätigung offen · N T`) ([ZuweisungStreifen.tsx](src/plugins/auslastung/components/ZuweisungStreifen.tsx)).
- **PL-Alarm für überfällige Bestätigungen** ab 3 Tagen als amber `⧗ N T` in der Zuweisungs-Liste ([cockpit-helpers.ts](src/plugins/auslastung/views/cockpit-helpers.ts), [VerbundListe.tsx](src/plugins/auslastung/views/VerbundListe.tsx)).
- **Tests** für Fälligkeit, Zuweisung-schlägt-Vormerkung und den verbund-weiten Ausschluss ([cockpit-helpers.test.ts](src/plugins/auslastung/__tests__/cockpit-helpers.test.ts), [neueAntraegeVerbund.test.ts](src/plugins/home/__tests__/neueAntraegeVerbund.test.ts)).

### v2.290.0 — Übernahme-Wunsch: Rückzug wirkt sofort, erledigte räumen sich (Juli 2026)

MINOR — User-Feedback aus dem Zuweisungs-Cockpit: ein zurückgezogener Wunsch blieb bis zum nächsten Einsammeln stehen, die PL sah nirgends wer was zurückgezogen hat, und die Bilanz meldete „14 Wünsche gelesen", obwohl die meisten längst zugewiesen waren. Details: [auslastung.md](docs/architecture/auslastung.md#lebenszyklus-eines-übernahme-wunsches-v2290).

- **Rückzug wirkt sofort** — die Liste vergleicht die Store-Wünsche gegen die ohnehin gelesenen persönlichen Ordner; der Einsammel-Klick persistiert nur noch ([uebernahme-einsammeln.ts](src/plugins/auslastung/services/onboarding/uebernahme-einsammeln.ts), [ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx)).
- **Wer hat was zurückgezogen** — Toolbar-Hinweis + Tooltip an der Einsammel-Bilanz, mit Kürzel, Akronym und Aktenzeichen ([ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx)).
- **Erledigte Wünsche räumen sich** aus der persönlichen Datei, sobald der Verbund vergeben ist ([useMyUebernahmeWuensche.ts](src/plugins/auslastung/hooks/useMyUebernahmeWuensche.ts), [NeueAntraegeFuerDich.tsx](src/plugins/home/NeueAntraegeFuerDich.tsx)).
- **Bilanz weist „bereits vergeben" aus**, damit die gelesene Zahl erklärt ist ([useAuslastungData.ts](src/plugins/auslastung/hooks/useAuslastungData.ts)).
- **Retraktion fasst nur `status:'selbst'` an** — sonst löschte das Selbst-Aufräumen des MA die Freigabe mit ([uebernahme-einsammeln.test.ts](src/plugins/auslastung/__tests__/uebernahme-einsammeln.test.ts)).

### v2.289.0 — Feedback: Kategorie UX entfaellt (geht in Idee auf) (Juli 2026)

MINOR — User-Feedback: „Etwas ist umständlich" (UX) und „Ich wünsche mir etwas" (Idee) sind für Melder nicht unterscheidbar — zu viele Auswahl-Optionen, niemand weiß, was er nehmen soll. Beide sind ohnehin Verbesserungswünsche am Bestand (beide sponsorbar). Details: [feedback-system.md](docs/architecture/feedback-system.md), Entfernungs-Rezept: [add-feedback-category.md](docs/agents/add-feedback-category.md).

- **Vier statt fünf Feedback-Typen** — der UX-Typ ist aus Eingabe, Filter-Chips, Kurator-Dropdown und Badges raus ([constants.ts](src/components/feedback/constants.ts), [FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx), [FeedbackAdminPage.tsx](src/plugins/feedback/FeedbackAdminPage.tsx)).
- **Bestands-Tickets migrieren beim Lesen** auf „Idee" inkl. Feld-Umschlüsselung (pain→goal, better→idea) — nicht-destruktiv, kein Share-Write nötig ([feedbackStorage.ts](src/core/services/feedback/feedbackStorage.ts)).
- **Outbox-Import heilt mit**, damit Alt-Clients keine tote Kategorie nachliefern ([feedbackOutboxCollect.ts](src/core/services/feedback/feedbackOutboxCollect.ts)).
- **Umständlich-Signale klassifizieren jetzt als Idee** statt unklassifiziert zu bleiben; die LLM-Kategorien kennen nur noch bug/feature/praise/question ([feedbackClassification.ts](src/core/services/feedback/feedbackClassification.ts), [feedbackLlm.ts](src/core/services/feedback/feedbackLlm.ts)).
- **Sponsorbarkeit auf `idea` reduziert** — der Helper bleibt die einzige Quelle ([feedbackSponsoring.ts](src/core/services/feedback/feedbackSponsoring.ts)).

### v2.288.0 — Übernahme-Wunsch bleibt in der offenen Liste (Juli 2026)

MINOR — User-Feedback: Anträge mit Übernahme-Wunsch verschwanden aus der Status-Sicht „offen", sobald die PL die Wünsche eingesammelt hatte. Ein Wunsch ist aber eine Bewerbung, keine Zuweisung — der Antrag ist weiter unverteilt. Details: [auslastung.md](docs/architecture/auslastung.md#status-filter-im-zuweisungs-cockpit-v2288).

- **„offen" heißt jetzt „niemandem zugewiesen"** — Wunsch-Anträge bleiben in der Liste und erscheinen zusätzlich unter „Übernahme-Wunsch" ([cockpit-helpers.ts](src/plugins/auslastung/views/cockpit-helpers.ts)).
- **Interessenten stehen als Kürzel in der Zeile** statt nur als Zähler „2 will" (ab 4 gekürzt auf `+N`) ([VerbundListe.tsx](src/plugins/auslastung/views/VerbundListe.tsx)).
- **Dedupe/Sortierung der Wünsche als geteilter Helfer** `interessentenNachWunschzeit` — Liste und Detail-Panel teilen eine Quelle ([DetailPanel.tsx](src/plugins/auslastung/views/DetailPanel.tsx)).
- **Status-Chips erklären sich per Tooltip** (Überlappung „offen" ∩ „Übernahme-Wunsch" ist gewollt) ([FilterToolbar.tsx](src/plugins/auslastung/views/FilterToolbar.tsx)).
- **Regressionsschutz** für die Status-Aggregation inkl. „freigegeben + selbstEingetragen ist nicht offen" ([cockpit-helpers.test.ts](src/plugins/auslastung/__tests__/cockpit-helpers.test.ts)).

### v2.287.2 — Zeitplan-Gantts der Aufbereitung ziehen 1:1-Zeichnung nach (Juli 2026)

PATCH — „Nach AP" und „Nach Person" hatten denselben Defekt wie der Prüfblatt-Gantt: viewBox fester Breite, breites Panel, alles darin hochskaliert. v2.287.1 hat nur den Aufrufer im MAP-Modul geradegezogen; jetzt zieht die Aufbereitung nach.

- **Beide Zeitplan-Ansichten zeichnen 1:1**: Schriftgrößen sind wieder echte Pixel ([GanttZeitplan.tsx](src/plugins/antraege/aufbereitung/GanttZeitplan.tsx), [PersonenZeitplan.tsx](src/plugins/antraege/aufbereitung/PersonenZeitplan.tsx)).
- **Messung als geteilter Hook** `useGanttBreite` + reine `zeichenBreite` — eine Heimat statt drei Kopien; die plugin-lokale Fassung im MAP-Modul entfällt ([GanttAchse.tsx](src/plugins/antraege/aufbereitung/GanttAchse.tsx)).
- **Hook vor dem Leer-Zweig** in „Nach Person", sonst kippt die Hook-Reihenfolge beim Wechsel auf „keine MA-Zuordnung" (React #310) ([PersonenZeitplan.tsx](src/plugins/antraege/aufbereitung/PersonenZeitplan.tsx)).
- **Tests am Ort der Geometrie** statt im MAP-Plugin ([gantt-achse.test.ts](src/plugins/antraege/aufbereitung/__tests__/gantt-achse.test.ts)).

### v2.287.1 — Foerderfaehigkeit: Gantt zeichnet 1:1 statt hochskaliert (Juli 2026)

PATCH — Der Arbeitspaket-Gantt im Prüfblatt zeichnete Schrift und Balken rund ein Drittel zu groß. Ursache war kein Stilwert, sondern ein viewBox fester Breite in einem breiten Panel: das SVG skalierte hoch und alles darin mit. Die Maße selbst entsprachen längst dem Handoff.

- **viewBox folgt der gemessenen Panel-Breite**: 1 SVG-Einheit = 1 CSS-Pixel, `fontSize={12}` bleibt 12 px — unabhängig davon, wie breit das Prüfblatt steht ([ApGantt.tsx](src/plugins/map-foerderfaehig/components/ApGantt.tsx)).
- **Zeichenbreite als reine Ableitung** mit Sockel für schmale Panels, statt Rechnerei in der Komponente ([gantt-daten.ts](src/plugins/map-foerderfaehig/ansicht/gantt-daten.ts)).
- **Geteilte Achse nimmt die Breite entgegen** (`macheAchse(achseMax, gesamtBreite)`, `achse.plotRight`); ohne Angabe bleibt es beim festen Maß, die Zeitplan-Ansichten der Aufbereitung ändern sich nicht ([GanttAchse.tsx](src/plugins/antraege/aufbereitung/GanttAchse.tsx)).
- **Balkenhöhe auf Handoff-Maß** (12 px, voll gerundet) statt an die Zeilenhöhe gekoppelt ([ApGantt.tsx](src/plugins/map-foerderfaehig/components/ApGantt.tsx)).

### v2.287.0 — Wasserzeichen rueckt nur bei echtem Fortschritt vor (Juli 2026)

MINOR — Jeder geparste Konsolidierungslauf galt als Erfolg und schrieb das Wasserzeichen fort — auch wenn KEINE Operation ankam. Die betroffenen Ereignisse waren damit dauerhaft verloren, ohne Spur. Der Prompt-seitige Auslöser fiel mit v2.285.0, die Folgenschwere blieb offen. Detail: [assistent-gedaechtnis.md](docs/architecture/assistent-gedaechtnis.md#wasserzeichen-kontrakt-v2287).

- **Fortschritt nur bei echter Verarbeitung**: ein Lauf mit ausnahmslos defekten Verwürfen hält die Position und bietet dieselben Ereignisse erneut an ([konsolidierung.ts](src/core/services/assistent/gedaechtnis/konsolidierung.ts)).
- **Verwurfs-Art trennt die zwei Fälle**: Duplikat/Kapazität = `gesaettigt` (inhaltlich erledigt, rückt vor), alles andere = `defekt` ([operationen.ts](src/core/services/assistent/gedaechtnis/operationen.ts)).
- **Backstop gegen den Dauer-Freeze**: nach `MAX_DEFEKT_WIEDERHOLUNGEN` rückt das Wasserzeichen trotzdem vor — ein permanenter Defekt würde den Stau sonst endlos wachsen lassen ([types.ts](src/core/services/assistent/gedaechtnis/types.ts)).
- **Einstellungen benennen die Folge**: „bleiben offen" vs. „übersprungen" statt eines pauschalen Fehlertexts ([GedaechtnisSektion.tsx](src/plugins/einstellungen/GedaechtnisSektion.tsx)).

### v2.286.0 — KI-Zweitmeinung nach dem eigenen Urteil (Juli 2026)

MINOR — Der Substanzcheck konfrontiert den Antragstext mit harten Daten; die Skala-Bewertung des Innovationsgrads blieb reine Menschenarbeit. Offen war, ob eine KI-Einschätzung dort hilft oder nur ankert. Der Testballon beantwortet das experimentell — die KI stuft mit ein, spricht aber erst, wenn der Mensch entschieden hat. Detail: [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md).

- **Zweitmeinung im selben Lauf**: `innoZweitmeinung` fällt im bestehenden Infografik-Aufruf mit ab, kein zweiter LLM-Call; Ankertexte kommen aus der Checklisten-Entität, nie hartkodiert ([zweitmeinung.ts](src/plugins/map-foerderfaehig/infografik/zweitmeinung.ts)).
- **Gate „Urteil zuerst" redigiert statt zu flaggen**: ohne eigene Stufe trägt der Vergleich gar keine KI-Stufe mehr — die Komponente kann die Regel nicht brechen ([zweitmeinung-vergleich.ts](src/plugins/map-foerderfaehig/ansicht/zweitmeinung-vergleich.ts)).
- **Kein Score-Leak by construction**: kein Feld an `MapItemBewertung`, deshalb für Abschluss-Entwürfe und Report unerreichbar; ein Guard hält das fest ([konventionen.test.ts](src/plugins/map-foerderfaehig/__tests__/konventionen.test.ts)).
- **Anker-Stempel in der Nutzlast, nicht im Cache-Key**: ein Anker-Edit kennzeichnet die Zweitmeinung als veraltet, statt Canvas, Delta und Wirkungskette mitzulöschen; `INFOGRAFIK_SCHEMA_VERSION` 2 → 3 ([schema.ts](src/plugins/map-foerderfaehig/infografik/schema.ts)).
- **Smoke misst Vollständigkeit + Stabilität**: Gold-Werte sind für alle vier Fixtures gleich und rein informativ; `maxTokens` 6144 → 8192, weil eine abgeschnittene Antwort den ganzen Lauf killt ([smoke-runner.ts](src/plugins/map-foerderfaehig/substanz/smoke-runner.ts)).

### v2.285.0 — Prompt-Audit: Mehrdeutigkeiten in allen Prompts behoben (Juli 2026)

MINOR — Nachdem der G-Fix (v2.284.1) gewirkt hatte, wurden ALLE Prompts des Repos gegen zehn Defektmuster geprüft. Häufigster Befund war nicht die elidierte Wortlaut-Vorgabe, sondern zwei Blöcke, die Gegenteiliges fordern, während der Vorrang nur im Code-Kommentar steht — den sieht das Modell nicht. Befundliste + Begründungen: [prompt-audit-2026-07.md](docs/prompt-audit-2026-07.md).

- **Bug-Klasse 13 hatte einen zweiten Fundort**: der KI-Korrektur-Pfad schickte den Pflicht-Anfang weiter zitiert und abgeschnitten; Generierung und Korrektur teilen jetzt EINE Quelle ([check-engine.ts](src/core/services/skills/registry/check-engine.ts), [korrektur.ts](src/core/services/skills/registry/korrektur.ts)).
- **Inhaltsleere und widersprüchliche Anweisungen entfernt**: „Vermeide die hinterlegten Formulierungen" (verwies auf nichts, hing an B/C/D/G), leere Konsistenz-Referenz-Überschrift, JSON-gegen-Fließtext ohne Vorrang-Angabe ([run-skill.ts](src/core/services/skills/run/run-skill.ts), [context-provider.ts](src/plugins/antraege/gutachten/context-provider.ts)).
- **Anonymisierer entschärft** (produktiv, DSGVO): Zielkonflikt aufgelöst, Literalitäts-Pflicht auf das wiedereingesetzte `mapping` begrenzt, Echtwerte aus der Feld-Schablone entfernt; Migration `ANFRAGE_ANON_KLAR_MIGRATION`, pristine-only ([anfrage-anonymisieren.seed.ts](src/core/services/skills/registry/anfrage-anonymisieren.seed.ts)).
- **Assistent und Gedächtnis nutzen `QUELLENTREUE_REGELN`** statt der auf Gutachtentext gemünzten Grundsatz-Regeln; das Panel bekommt einen Abbruch-Knopf (Bridge kennt weder maxTokens noch Timeout) ([grundsatz.ts](src/core/services/skills/registry/grundsatz.ts), [sessionStore.ts](src/plugins/chat/assistent/sessionStore.ts)).
- **Zwei neue Guards**: erweiterte Wortlaut-Regel über alle prompt-bauenden Verzeichnisse, Kompakt-gegen-Pretty-Print-Regel, plus ein Test über dem GERENDERTEN Prompt ([prompt-hygiene.test.ts](src/core/services/skills/run/__tests__/prompt-hygiene.test.ts)) — Block-übergreifende Widersprüche sieht keine Quelltext-Regex.

### v2.284.1 — Pflicht-Anfang in Abschnitt G loest keinen Reasoning-Loop mehr aus (Juli 2026)

PATCH — Abschnitt G verlangte den Pflicht-Satzanfang „**exakt**" und zeigte ihn zugleich zitiert und per Auslassungszeichen abgeschnitten. Diese Anweisung ist nicht erfüllbar: der Wortlaut endet mitten im Satz, sein Ende ist verdeckt. Qwen suchte im Reasoning wiederholt die String-Grenze, degenerierte in Wiederholung und verbrauchte das Ausgabebudget — Lauf ohne Antwort. Detail: [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).

- **Pflicht-Anfang steht in einem eigenen, unzitierten Block** auf eigener Zeile, mit dem expliziten Hinweis, dass er absichtlich mitten im Satz endet ([seed.ts](src/core/services/skills/registry/seed.ts), `abschnittTemplate.pflichtAnfang`).
- **Derselbe Fix im KI-Korrektur-Pfad** — `pflicht_anfang.hint` landet im selben Modell ([check-engine.ts](src/core/services/skills/registry/check-engine.ts)).
- **Bestands-Registries werden gehoben** (`GA_PFLICHT_ANFANG_KLAR_MIGRATION`, pristine-only, zwei Alt-Stände mit/ohne Stilbeispiel); kuratierte Edits bleiben unberührt ([migrations.ts](src/core/services/skills/registry/migrations.ts)).
- **Abschnitte B–F bleiben byte-identisch** — `pflichtAnfang: undefined` ändert das Template nicht, sonst zöge der Fix deren Migrations-Erkennung mit.
- **Guard `keine-elidierte-wortlaut-vorgabe`** verbietet die Kombination Literalitäts-Wort + elidiertes Zitat unter `skills/` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)); neue Bug-Klasse 13 dokumentiert.

### v2.284.0 — Erneut hochgeladene Dokumente ersetzen statt zu vervielfachen (Juli 2026)

MINOR — Das Dokument-Inventar aus v2.282 zeigte für fünf hochgeladene Dateien fünfzehn Zeilen. Nicht doppelt gerendert, sondern echter Bestand: `add` vergibt pro Aufnahme eine frische UUID, jede erneut abgelegte Datei legte also einen weiteren Record an. Unsichtbar, solange der Gutachten-Pfad ohnehin nur ein Dokument las. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Neu-Aufnahme ersetzt die vorherige Fassung** statt einen zweiten Record anzulegen — gleicher Verbund + gleicher Dateiname ([DokumentAufnahme.tsx](src/core/components/DokumentAufnahme.tsx), [dokumentDubletten.ts](src/core/components/dokumentDubletten.ts)).
- **`id` und `created` bleiben beim Ersetzen** — VB-Wahl und Korpus-Auswahl zeigen weiter auf das Dokument, das Inventar sortiert nicht um ([store.ts](src/plugins/dokumente/store.ts)).
- **Altbestand als „ältere Fassung" markiert** mit Sammel-Aktion „Ältere Fassungen entfernen"; sie zieht erst die Verweise um, löscht dann aus IDB und Suchindex ([KorpusInventar.tsx](src/plugins/antraege/gutachten/KorpusInventar.tsx), [useGutachtenQuellen.ts](src/plugins/antraege/gutachten/useGutachtenQuellen.ts)).
- **Nie automatisch beim Laden aufgeräumt** — es sind Nutzerdaten, das Löschen bleibt ein bewusster Klick mit Rückfrage.
- **Tag-Scan hat nur noch eine Implementierung** — `listDocsByTag` im Dokumente-Store, `listDocsByFkz` delegiert ([vbDokument.ts](src/plugins/antraege/kurzfassung/vbDokument.ts)).

### v2.283.0 — Regelprüfung unter dem Entwurf (Juli 2026)

MINOR — Der Knopf „Prüfen" wirkte wie ein Blindgänger: er rechnete zwar deterministisch neu, aber die Checks entstehen ohnehin bei jeder Generierung/Bearbeitung — und das Ergebnis landete im rechten Panel, das eingeklappt sein konnte. Klick ohne sichtbare Wirkung. Zugleich saß die Prüfung getrennt von dem Text, den sie bewertet. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Regelprüfung wandert unter den Entwurf** — aufklappbar über den Meta-Zeilen-Trigger „prüft N Regeln" ([PruefBlock.tsx](src/plugins/antraege/gutachten/PruefBlock.tsx), [SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)).
- **Zu bei grüner Prüfung, offen bei Befund** — Default wird bei jeder Änderung des Prüf-Ergebnisses neu abgeleitet (`pruefSummary`), die betroffene Gruppe klappt auf.
- **Trigger zeigt den Befund schon zugeklappt** („prüft 3 Regeln · 1 Hinweis", amber/rot) und zählt `run.checks` statt der live aktiven Skill-Regeln.
- **„Prüfen" raus aus der Anpassen-Zeile**, als „Neu prüfen" in den aufgeklappten Block — dort, wo sein Ergebnis sichtbar ist.
- **Rechte Spalte heißt „Quelle & KI-Hinweise"** und trägt nur noch Belege, beratende KI-QS und Denkprozess ([KontextPanel.tsx](src/plugins/antraege/gutachten/KontextPanel.tsx)).

### v2.282.0 — Gutachten: Dokument-Inventar + Korpus mit Auswahl (Juli 2026)

MINOR — Wer im Gutachten fünf Dokumente hochlud, sah danach eines: die Seite zeigte nur den VB-Dateinamen, und `findVorhabensbeschreibung` nahm von mehreren VB-getaggten Dateien die jüngste. Weil `typAusDateiname` jeden unerkannten Dateinamen auf `vorhabensbeschreibung` zurückfallen lässt, landeten „Projektbeschreibung"/„Wirkung" ebenfalls dort — welche gewann, hing am Konvertierungstempo. Das Gutachten entstand also aus einem willkürlich gewählten von fünf Dokumenten, ohne Hinweis. Detail: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Dokument-Inventar** in der Gutachten-Sektion — alle Verbund-Dokumente mit Typ, Zeichenzahl und Kopf „N Dokumente · M im Gutachten-Kontext" ([KorpusInventar.tsx](src/plugins/antraege/gutachten/KorpusInventar.tsx)).
- **Maßgebliche VB explizit wählbar** statt „jüngste gewinnt"; der Pick liegt auf Verbund-Ebene, alle Konsumenten erben ihn ([vbDokument.ts](src/plugins/antraege/kurzfassung/vbDokument.ts)).
- **Zusatzdokumente per Checkbox in den KI-Kontext**, zusammengeführt zu einem Korpus mit der VB als Präfix ([korpusQuelle.ts](src/plugins/antraege/gutachten/korpusQuelle.ts), [korpusAuswahl.ts](src/plugins/antraege/gutachten/korpusAuswahl.ts)).
- **Opt-in als harte Eigenschaft**: leere Auswahl ⇒ Korpus byte-identisch zur VB ⇒ gleicher Hash ⇒ bestehende Relevanz-Map-Caches und freigegebene Abschnitte bleiben unberührt ([korpus-kontext.test.ts](src/plugins/antraege/gutachten/__tests__/korpus-kontext.test.ts)).
- **Kontextfenster-Warnung misst den Korpus** statt nur der VB; Korpus-Primitive aus dem dev-gegateten Aufbereitungs-Verzeichnis gelöst ([dokumentKorpus.ts](src/plugins/antraege/dokumentKorpus.ts)).

### v2.281.1 — Schwache Bewertungen faerben die Kriteriumskarte (Juli 2026)

PATCH — Eine B0- oder B1-Bewertung war nur am gewählten Segment zu erkennen: beim Scrollen durch 23 Kriterien fiel ein Befund nicht auf. Der Design-Prototyp färbt dort die Karte; hier trägt die Farbe Akzentkante, Stufenbadge und eine sehr helle Fläche (DESIGN_GUIDE: kein satter Hintergrund).

- **B0/B1 färben die ganze Kriteriumskarte** — Kante, Badge „B1 · 1" und `-bg`-Fläche; B2/B3 bleiben ruhig, ein Haken soll nicht schreien ([SkalaKarte.tsx](src/plugins/map-foerderfaehig/components/SkalaKarte.tsx)).
- **Segmentfarbe folgt der Stufe** statt immer `--tf-primary`: B0 rot, B1 amber, B2 primär, B3 grün ([SkalaKarte.tsx](src/plugins/map-foerderfaehig/components/SkalaKarte.tsx)).
- **Binäre Kriterien sprechen dieselbe Sprache**: „nicht erfüllt" und „NF notwendig" färben die Karte ebenso ([ItemKarte.tsx](src/plugins/map-foerderfaehig/components/ItemKarte.tsx)).
- **Fix: „vollständig" ist nicht „gut"** — der Innovationsgrad wurde grün, sobald alle drei Kategorien bewertet waren, auch bei 3 von 9 Punkten; unterhalb des Kurzpfads ist er jetzt amber ([bewertungs-signal.ts](src/plugins/map-foerderfaehig/ansicht/bewertungs-signal.ts)).
- **Einstufung als reine Ableitung** mit Test statt Farblogik in den Komponenten — die `.tsx` bilden nur noch Signalstufe → Token ab ([bewertungs-signal.test.ts](src/plugins/map-foerderfaehig/__tests__/bewertungs-signal.test.ts)).

### v2.281.0 — Foerderfaehigkeit: gefuehrter Pruefablauf in drei Phasen (Juli 2026)

MINOR — Die Förderfähigkeitsprüfung zeigte elf gleichrangige Reiter: kein roter Faden, kein Fortschritt, keine Antwort auf „was kommt als Nächstes". Der Design-Handoff gruppiert sie in drei Phasen mit Führungsleiste. Übernommen sind Aufbau und Optik — die Zahlen bleiben die der App, denn der Prototyp zählte gegen eine Konstante und konnte nie fertig werden.

- **Drei Phasen statt elf Reitern** (1 Verstehen · 7 Schritte → 2 Bewerten → 3 Abschluss); Checkliste und Import-Report stehen als Konfiguration daneben ([schritte.ts](src/plugins/map-foerderfaehig/ansicht/schritte.ts), [PhasenNav.tsx](src/plugins/map-foerderfaehig/components/PhasenNav.tsx)).
- **Führungsleiste** mit „Schritt X von 9 · Phase N", Zurück/Weiter und dem nächsten offenen Schritt; auf den Konfigurations-Screens ohne Zähler ([GuideLeiste.tsx](src/plugins/map-foerderfaehig/components/GuideLeiste.tsx)).
- **Statuspunkte aus echten Signalen** — zugeordnete VB, vorhandene Analyse, Fortschritt aus `bewerte()`, Rechencheck-Warnungen; Gesamtzahl kommt aus der Checklisten-Fassung, nie aus einer Konstante ([schritte.test.ts](src/plugins/map-foerderfaehig/__tests__/schritte.test.ts)).
- **`KompaktAnsicht` zerlegt** in Prüfblatt, Phasen-Nav, Führungsleiste und „Vorhaben kompakt"; Schritte bleiben nach dem ersten Besuch montiert, Scrollstand und Eingaben überleben den Wechsel ([PruefBlatt.tsx](src/plugins/map-foerderfaehig/components/PruefBlatt.tsx)).
- **Nicht existierende `--tf-*`-Tokens ersetzt** (`--tf-danger`/`-warning`/`-success`/`--tf-primary-fg` lebten nur von Fallbacks) und `ScopeTabs` um einen `leading`-Slot erweitert, statt eine zweite Tab-Leiste zu bauen ([ScopeTabs.tsx](src/components/ui/ScopeTabs.tsx)).

### v2.280.0 — KI-Status im Titel des Streamlit-Tabs (Juli 2026)

MINOR — Das Bookmarklet zeigte seinen Zustand nur als Pill unten rechts **im** KI-Tab — also genau dort, wo man nur hinsieht, wenn man hinwechselt. Wer in der App arbeitet, sah nicht, ob die KI vorankommt. Der Tab-Titel trägt den Zustand jetzt in die Chrome-Tab-Leiste.

- **Tab-Titel des KI-Tabs spiegelt den Bridge-Zustand**: `⏳ 0:42 · 1,4k` im Lauf, `✅ Fertig` für 60 s, `⚠️ …` bleibt stehen; Symbol vorne, damit es bei abgeschnittenem Tab sichtbar bleibt ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)).
- **Laufzeit UND Antwort-Umfang**, weil nur der wachsende Umfang „kommt voran" belegt — eine Uhr tickt auch bei totem Server weiter ([tab-titel.ts](src/core/services/ai/streamlit-bridge/tab-titel.ts)).
- **Angehängt an `setBadge()`** — den einzigen Statuswechsel-Punkt des Snippets, damit Tab und Pill nicht auseinanderlaufen; keine neuen Timer (Ticker in der 400-ms-Poll-Schleife, Quittung + Rerun-Re-Assert im 4-s-Watchdog).
- **Drift-Test** wie bei Echo-/Antwort-Logik: JS-Fassung zwischen den `<tab-titel-core>`-Markern läuft gegen dieselben Fixtures wie das TS-Modul ([tab-titel.test.ts](src/core/services/ai/streamlit-bridge/__tests__/tab-titel.test.ts)).
- **`BRIDGE_REV`-Bump → Bookmarklet muss neu installiert werden** (Einstellungen → Interne KI), sonst bleibt der alte Stand ohne Tab-Titel aktiv ([streamlit-bridge.md](docs/architecture/streamlit-bridge.md)).

### v2.279.0 — Substanzcheck: Widersprueche, Unschaerfe, Zielkriterien (Juli 2026)

MINOR — Ein mit KI geschriebener Antrag liest sich glatt und sagt wenig: er kann den eigenen Einreichungsdaten widersprechen und durchweg unbeziffert bleiben, ohne dass es beim Erstlesen auffällt. Der Substanzcheck bewertet keine Textqualität, sondern hält Behauptungen gegen harte Zahlen und gegen die Quantifizierungspflicht. Alles reitet auf dem bestehenden Infografik-Lauf mit — kein zusätzlicher LLM-Aufruf.

- **Fakten-Block** aus dem Strukturmodell (Laufzeit, PM je AP, Kosten, Fördersatz) geht als Referenzseite ins Prompt; nur Aggregate, nichts Personenbezogenes ([fakten.ts](src/plugins/map-foerderfaehig/infografik/fakten.ts)).
- **Widersprüche + Unschärfe-Begriffe** als neue Antwortfelder mit strengem Parser — im Zweifel verwerfen statt raten, leere Liste ist ein gutes Ergebnis ([substanz.ts](src/plugins/map-foerderfaehig/infografik/substanz.ts), [WiderspruchListe.tsx](src/plugins/map-foerderfaehig/components/WiderspruchListe.tsx), [UnschaerfeListe.tsx](src/plugins/map-foerderfaehig/components/UnschaerfeListe.tsx)).
- **Ein-Klick-Nachforderung** mit Formulierungs-Leitplanke im Code: immer Zahl + Messverfahren, nie „näher erläutern"; Registry-Bausteine bleiben wortgetreu ([nf-praezision.ts](src/plugins/map-foerderfaehig/substanz/nf-praezision.ts)).
- **Kontrollfähige Zielkriterien (RL 4.5.1)** als Tabelle im Gutachten-Gerüst; gespeichert wird die Abwahl, damit neue Zeilen nicht still herausfallen ([zielkriterien.ts](src/plugins/map-foerderfaehig/substanz/zielkriterien.ts), [markdown.ts](src/plugins/map-foerderfaehig/abschluss/markdown.ts)).
- **dev-Reiter „Substanz-Smoke"** misst vier fiktive Fassungen inkl. Falsch-Positiv-Kontrolle; `npm run check` bleibt LLM-frei ([smoke-runner.ts](src/plugins/map-foerderfaehig/substanz/smoke-runner.ts), [map-testleitfaden.md](docs/map-testleitfaden.md)).

### v2.278.0 — KI-Analysen ueberleben den Seitenwechsel (Juli 2026)

MINOR — Nach „Mit KI analysieren" waren Steckbrief, Canvas, Delta und Wirkungskette weg, sobald man eine andere Seite aufrief. Die Ergebnisse lagen die ganze Zeit im kv-Store — der Baustein-Cache IST ihre Persistenz —, nur las sie beim Öffnen niemand zurück. Dieselbe Lücke steckte in der Antrag-Aufbereitung.

- **Rehydrierung beim Öffnen** über den vorhandenen Cache, ohne Transport und ohne LLM-Lauf: [analyse-cache.ts](src/plugins/map-foerderfaehig/vb/analyse-cache.ts) (MAP, 3 Bausteine) + [baustein-rehydrierung.ts](src/plugins/antraege/aufbereitung/baustein-rehydrierung.ts) (Aufbereitung, 6 Bausteine).
- **`leseBausteinCache`** als einzige Lesestelle der Cache-Shape; `getOrComputeBaustein` nutzt sie intern ([bausteine.ts](src/plugins/antraege/aufbereitung/bausteine.ts)).
- **Render-Schleife behoben**: der Korpus-Effekt der Aufbereitung hing an einem pro Render neu gebauten `ctx` und trieb sich über `setKorpusMass` selbst an — ein voller Dokument-Scan je Render ([useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts)).
- **Tab-Gating** sperrt nur noch, solange ein Lauf `laeuft` — sonst hätte ein Teil-Treffer genau die Tabs gesperrt, deren Leerzustand den Start-Button trägt ([tab-gating.ts](src/plugins/antraege/aufbereitung/tab-gating.ts)).
- **`deleteEinreichung`** räumt die KI-Ergebnisse über alle Korpus-Stände mit ab ([store.ts](src/plugins/map-foerderfaehig/store.ts)).

### v2.277.1 — Guard: pauschales kv-Leeren muss Setup-Schluessel aussparen (Juli 2026)

PATCH — Nachzug zu v2.277: in den anderen Varianten gibt es nichts zu verschonen (`dev-fixtures` wird dort komplett wegge-tree-shaked, geprüft am pl-Bundle; kein anderer Pfad leert den kv-Store pauschal). Statt Code zu duplizieren, sichert jetzt ein Guard die Regel für jeden künftigen Reset ab — in jeder Variante.

- **Kanonische Setup-Key-Liste** `SETUP_IDB_KEYS`/`istSetupKey` als einzige Quelle ([setup-keys.ts](src/core/services/storage/setup-keys.ts)); `resetAll` nutzt sie statt einer lokalen Kopie.
- **Convention-Test `no-blanket-idb-wipe`**: wer unpräfixiert `idb.keys()` holt UND `idb.delete(...)` ruft, muss aus setup-keys.ts importieren ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)).
- Guard gegen die echte Regression verifiziert (alten Stand kurz wiederhergestellt → Test schlägt fehl), nicht nur „läuft grün".
- Zwei Fehlalarme beim Bau geschärft: `cache.keys()` einer Map und rein lesende State-Dumps zählen nicht.
- `MAX_FILE_LOC`-Baseline 1480 → 1545 (Guard-Aggregator wächst mit jeder Convention).

### v2.277.0 — Dev-Szenarien verschonen Name und Kuerzel (Juli 2026)

MINOR — Auflösung des „ständig neue Anmeldung"-Reports aus dem Citrix-Test: weder Citrix noch der Startup-Wizard, sondern die Dev-Fixtures. **Jedes** der 6 Szenarien beginnt mit `resetAll`, und das löschte jeden kv-Schlüssel ausser `smb-handles` — also auch `profile` + `onboarding-complete`. Fingerabdruck: Name/Kürzel neu tippen, Ordner aber weiter verbunden. Dev-only (`devFixtures`), pl/prod waren nie betroffen.

- **`resetAll` verschont die Setup-Schlüssel** `profile` + `onboarding-complete` — dieselbe Begründung, aus der der SMB-Handle längst verschont wurde ([helpers.ts](src/dev-fixtures/helpers.ts)).
- **Neue Einzel-Aktion „Onboarding zurücksetzen"** für den gezielten Erstlauf-Test ([actions.ts](src/dev-fixtures/actions.ts), Knopf in [FixturesPanel.tsx](src/plugins/dev-infrastructure-test/panels/FixturesPanel.tsx)).
- Szenario-Beschreibung + Panel-Vorspann sagten „alle Stores leeren" und stimmten nicht mehr — nachgezogen ([scenarios.ts](src/dev-fixtures/scenarios.ts)).
- Diagnose-Reihenfolge in Bug-Klasse 12 ergänzt: im dev-Build **zuerst** nach angewendeten Fixture-Szenarien fragen ([recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)).

### v2.276.0 — Identitaet aus persoenlichem Ordner wiederherstellbar + Auto-Kette entschaerft (Juli 2026)

MINOR — Citrix-Tester mussten „oft" Name und Kürzel neu eintippen. Ursache liegt ausserhalb der App (die IndexedDB wird geräumt bzw. wandert im Citrix-Profil nicht mit; `onboarding-complete` löscht die App nirgends) — aber die App schrieb ihr Profil seit jeher nach `<pers>/ZAH/profile.json` und **las es nie zurück**: `loadPersonalSettings` hatte keinen einzigen Aufrufer. Ein Backup, das niemand liest, ist keins.

- **„Aus persönlichem Ordner wiederherstellen"** in Schritt 0 des Onboardings — holt Name, Kürzel, Farbe und persönliche Einstellungen zurück und springt zur Zusammenfassung ([Onboarding.tsx](src/core/Onboarding.tsx)).
- **`navigator.storage.persist()`** beim Init angefragt (best-effort, nicht awaited) — senkt die Eviction-Wahrscheinlichkeit, ersetzt kein Backup ([storage/index.ts](src/core/services/storage/index.ts)).
- **Auto-Kette bucht nur noch Erfolge** (`resolveAfterGrant` mit `attemptedSlot=null`); die 300ms-Dauer-Heuristik aus v2.275.0 ist entfernt ([guided-grant-progress.ts](src/core/components/guided-grant-progress.ts)).
- Grund: Wall-Clock trennt „kein Dialog" nicht von „abgelehnt" — unter Citrix-Last kippte die Schwelle und der Persönliche Ordner wurde still als abgelehnt gebucht und übersprungen.
- **Neue Bug-Klasse 12** „Zustand nur in der Varianten-IDB = ein Verlust, keine Wiederherstellung" ([recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)).

### v2.275.1 — Hinweis beim Wechsel der KI-Variante im Chat (Juli 2026)

PATCH — Seit v2.274 wechselt der Umschalter wirklich den Streamlit-Tab. Weil die Bridge aus App-Sicht single-turn ist (nur die letzte Nutzer-Nachricht geht raus), liegt der Gesprächsfaden in der Historie des Tabs — der neue kennt die bisherigen Züge nicht. Für den Nutzer war das nirgends sichtbar.

- **Hinweis am Umschalter**, wenn mitten in einem laufenden Gespräch gewechselt wird ([KiVariantSelector.tsx](src/core/components/KiVariantSelector.tsx)).
- **Reine `sollWechselHinweisZeigen`** entscheidet wann: nur bei aktiver Bridge, laufendem Gespräch und echtem Wechsel ([ki-ziel.ts](src/core/services/ai/ki-ziel.ts)).
- Bewusst **nachgelagerter Hinweis statt Bestätigungsdialog** — der Wechsel ist verlustfrei umkehrbar.

### v2.275.0 — Startup-Freigabe: Wizard oben, weniger Mausweg und Klicks (Juli 2026)

MINOR — Das Browser-Popup zur Ordner-Freigabe erscheint oben am Bildschirm, die Wizard-Karte stand aber mittig: bei drei Ordnern pendelte der User sechsmal über die halbe Bildschirmhöhe. Echtes Auto-Abfragen aller Ordner ist browserseitig blockiert (Chromium verbraucht die User-Activation pro `requestPermission`) — also Weg verkürzen statt Schritte streichen.

- **Karte im Stepper-Zweig oben statt zentriert** (`items-start pt-[210px]`, direkt unter der Popup-Zone) plus fehlendes `overflow-y-auto` ([StartupScreen.tsx](src/core/StartupScreen.tsx)).
- **Auto-Fokus auf den Freigabe-Button ab Schritt 2** — nach „Zulassen" genügt Enter, kein Mausweg zurück ([GuidedGrantSteps.tsx](src/core/components/GuidedGrantSteps.tsx)).
- **Optimistische Auto-Kette**: nach einem Erfolg wird der nächste Ordner sofort probiert; in Chrome/`file://` folgenlos, in Browsern mit gebündelten Permissions spart es Klicks.
- **Stiller Fehlschlag wird nie als „abgelehnt" gebucht** (`ketteAbgebrochenOhnePrompt`, 300ms-Schwelle) — sonst wäre der Ordner dauerhaft übersprungen ([guided-grant-progress.ts](src/core/components/guided-grant-progress.ts)).
- Beide Zusätze in der Bug-Klasse dokumentiert; der erste Grant pro Klick bleibt bewusst unverändert ([recurring-bug-classes.md §2](docs/architecture/recurring-bug-classes.md)).

