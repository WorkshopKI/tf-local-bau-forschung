# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

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

