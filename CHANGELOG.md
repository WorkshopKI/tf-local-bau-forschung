# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v2.149.0 — Feedback: Archiviert-Filter + feinere Aufwand-Skala (Juni 2026)

MINOR — Zwei Verbesserungen im Kurator-Feedback-Modul (aus dem Board-Feedback).

- **Archivierte ausblenden:** Im Status-Filter gibt es jetzt einen eigenen Chip „Archiviert" plus
  eine Checkbox „Archivierte einblenden" ([FeedbackTicketList.tsx](src/plugins/feedback/sections/FeedbackTicketList.tsx)).
  Standardmäßig sind archivierte Tickets **überall ausgeblendet** — auch unter „Alle" (der „Alle"-Zähler
  zeigt entsprechend die nicht-archivierte Zahl). Die Checkbox blendet sie additiv in „Alle" ein
  (Preference in `localStorage`); der „Archiviert"-Chip zeigt gezielt nur die Archivierten, unabhängig
  von der Checkbox. Filter-/Zähler-Logik in [FeedbackAdminPage.tsx](src/plugins/feedback/FeedbackAdminPage.tsx)
  über `istArchiviert` (Pitfall #21, kein Literal-Vergleich).
- **Feinere Aufwand-Skala** (7 statt 4 Stufen): `XS=2h, S=4h, M=8h, L=2 Tage, XL=4 Tage, XXL=1 Woche,
  Epic=>2 Wochen` ([feedback.ts](src/core/types/feedback.ts)). Neuer geordneter Export `EFFORT_ORDER`
  ersetzt die hartkodierten Stufen-Arrays in Aufwand-Dropdown + Sponsoring-Schwellen-Editor (DRY).
  `EFFORT_HOURS` / `EFFORT_LABELS` / `EFFORT_SHORT_LABELS` / `DEFAULT_SPONSORING_THRESHOLDS` entsprechend
  erweitert (`Record<EffortEstimate, …>` erzwingt Vollständigkeit). **Keine Daten-Migration** — die
  Codes `S/M/L/XL` bleiben gültig; Anzeige-Labels werden am Render-Punkt abgeleitet.

### v2.148.0 — Konventions-Guard `no-parallel-scope-tabs` (Layout-Schicht Phase 5) (Juni 2026)

MINOR (test-only) — Drift-Schutz: verhindert, dass unterstrichene Listen-Sicht-Tabs außerhalb
des `ScopeTabs`-Primitivs neu hand-gebaut werden.

- **Neuer Guard** `no-parallel-scope-tabs` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)):
  scannt `.tsx` auf die kanonische Aktiv-Tab-Signatur `border-b-2 border-[var(--tf-text)]` außerhalb
  von `ScopeTabs.tsx`. `@/components/ui/tabs` (Inline-Style-Border) trifft das Muster nicht.
- **Grandfatherte Bestands-Tabs** (außerhalb des schlanken Umfangs, Migration später):
  `SkillVerwaltungPage.tsx` (gezählte Tabs, ScopeTabs-Kandidat) + `SkillEditor.tsx` (2-Tab-Nav mit
  Border-Container, anderes Muster) — per Pfad-Allowlist, dokumentiert in
  [docs/layout-audit.md](docs/layout-audit.md). Echte Ausnahme weiter über `// allow-scope-tabs`.
- `MAX_FILE_LOC` 1095→1135 (Guard-Zuwachs in der Aggregator-Datei).

### v2.147.0 — PageHeader / StatusDot / FilterChip adoptiert (Layout-Schicht Phase 4) (Juni 2026)

MINOR — Drei byte-invariante Umstellungen auf die neuen Primitive (gleiches Aussehen, jetzt aus
der Schicht). Stellen, die nicht 1:1 invariant wären, bewusst aufgeschoben (dokumentiert in
[docs/layout-audit.md](docs/layout-audit.md) → „Adoptions-Status").

- **PageHeader** ← Förderanträge-Titel ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx))
  — exakter Match (gleiche Wrapper-/H1-Klassen, Meta-Slot für die Bearbeiter-Filter-Pill).
- **StatusDot** ← [StatusDotRow.tsx](src/plugins/antraege/StatusDotRow.tsx) (Farbe weiter via
  `getStatusCategoryColor()`; `title`/`ariaLabel` erhalten).
- **FilterChip** ← [ActiveFilterChips.tsx](src/plugins/antraege/filter/ActiveFilterChips.tsx).
- **Bewusst nicht adoptiert:** PageHeader an Auslastung/Einstellungen (abweichendes
  `leading`/`tracking`/`gap` → nicht invariant) und StatusBadge (keine byte-invariante Fundstelle;
  `StatusBarRow` rendert Balken, `KategoriePill` ist reicher). Beide stehen bereit/smoke-getestet.

### v2.146.0 — ScopeTabs-Konsolidierung: Förderanträge-Tabs + Chat-Pills (Layout-Schicht Phase 3) (Juni 2026)

MINOR — Die zwei driftenden „Listen-Sichten-mit-Zähler"-Implementierungen laufen jetzt durch
das geteilte `ScopeTabs`-Primitiv. Förderanträge ist klassen-identisch (struktureller No-op);
die Chat-Filter sind die **eine bewusste** Konsistenz-Änderung (waren schon Pills, jetzt aus
einem Bauteil).

- **Förderanträge-Header-Tabs** ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx)):
  Inline-`<button>`-Render → `ScopeTabs variant='tabs'`. Gleiche View-Counts (`de-DE`), gleiche
  Klassen → visuell identisch.
- **Chat-Historie-Filter** ([ConversationSidebar.tsx](src/plugins/chat/components/ConversationSidebar.tsx)):
  `sf-chip`-Buttons → `ScopeTabs variant='pills'`. `counts` aus `groupConversations` unverändert.
  Die nun ungenutzten `.sf-chip`/`.sf-n`-Regeln aus [chat.css](src/plugins/chat/chat.css) entfernt
  (Pill-Styles leben jetzt im Primitiv).
- Regressions-Anker (Tabs/Counts/Gruppierung) blieben unverändert grün.

### v2.145.0 — Vier fehlende Layout-Primitive (Layout-Schicht Phase 2) (Juni 2026)

MINOR — Additive, domänenfreie Primitive in `src/components/ui/`; noch **keine** Modul-
Umstellung (die kommt in Phase 3/4). Ergänzen die bereits bestehende Schicht
(MasterDetailLayout, SortableTable, SectionHeader, tabs, button, badge).

- **[PageHeader.tsx](src/components/ui/PageHeader.tsx)** — großer Seitentitel + optionale
  Meta-Zeile / Aktionen (aus den hand-rolled H1s destilliert).
- **[StatusBadge.tsx](src/components/ui/StatusBadge.tsx)** — `StatusBadge` (Pill) + `StatusDot`
  (farbiger Punkt). Farbe kommt immer vom Aufrufer — keine Status-Domänenlogik in der Schicht.
- **[FilterChip.tsx](src/components/ui/FilterChip.tsx)** — abgerundeter „Label: Wert"-Chip,
  optional entfernbar (aus `ActiveFilterChips` destilliert).
- **[ScopeTabs.tsx](src/components/ui/ScopeTabs.tsx)** — Listen-Sicht-Tabs mit Zähler,
  `variant: 'tabs' | 'pills'` (breit/unterstrichen = Förderanträge · kompakt = Chat). EIN
  Bauteil, zwei Darstellungen; Abgrenzung zu `ui/tabs.tsx` (generische Navigation).
- Smoke-Tests ([layout-primitives.test.ts](src/components/ui/__tests__/layout-primitives.test.ts)):
  Render via `renderToStaticMarkup` (node-Env), `variant` schaltet die Darstellung, Token-Klassen.

### v2.144.0 — CTA-Primärfarbe gekoppelt + Kontrast-Guard (Layout-Schicht Phase 1) (Juni 2026)

MINOR — Erster Schritt der schlanken Layout-Schicht ([docs/layout-audit.md](docs/layout-audit.md)):
der Default-Button (CTA) trägt jetzt die **gewählte Primärfarbe** statt anthrazit. Additiv,
keine Migration.

- **Token-Fix** ([src/theme.css](src/theme.css)): `--primary` von `var(--tf-text)` auf
  `var(--tf-primary)` umgestellt — `bg-primary`/`text-primary` (Default-CTA, `link`-Button,
  `switch`-checked, `slider`-range) erben damit die User-Farbe. CTA-Vordergrund über neues
  `--tf-on-primary: #fff` (bewusst **ohne** Dark-Flip — anders als `--tf-primary-foreground`,
  das im Dark-Block auf `--tf-bg` kippt und u.a. in `Step2KindFilterToggle` genutzt wird).
  `--tf-primary` wird im Dark-Block nicht aufgehellt → Weiß ist in beiden Modes kontrastsicher.
- **Bernstein-Preset** ([src/components/ui/theme.ts](src/components/ui/theme.ts)): `l` von 42 % auf
  40 % gesenkt — einziges Preset unter 4,5:1 gegen Weiß (4,21:1 → 4,58:1).
- **Kontrast-Guard** `preset-contrast-contract` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)):
  rechnet je `PRESET_COLORS`-Preset HSL→sRGB→relative Luminanz→WCAG-Kontrast gegen `#fff` und
  erzwingt ≥ 4,5:1 — verhindert, dass ein künftig zu helles Preset den weißen CTA-Text bricht.

### v2.143.0 — Sidebar-Status „CSV-Import aktuell?" + Import-Modal (Juni 2026)

MINOR — Dritter Status-Indikator unten links in der Sidebar (neben **● Sync** und **● KI**),
der den Stand der täglichen Legacy-CSV-Exporte gegen den importierten Datenbestand zeigt.
Additiv, keine Migration; nur in Import-Rollen (pl/kurator/dev) sichtbar.

- **Neuer Indikator** ([CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx)):
  Punkt+Wort „● CSV" im Muster von [BridgeStatusIndicator.tsx](src/components/ui/BridgeStatusIndicator.tsx).
  **Grün** = alle verknüpften Exporte importiert · **rot** = es gibt neuere/geänderte Exporte ·
  **grau** = nicht prüfbar (offline / Ordner nicht verknüpft / vor dem ersten Check) ·
  **amber+pulse** = Import läuft.
- **Inhaltsbasierte Erkennung**: Wiederverwendung von `collectCandidates`
  ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)) — Checksumme +
  Größen-Guard, derselbe Pfad wie „Jetzt aktualisieren". Kein Kalendertag-Vergleich (Datei-mtime
  über SMB unzuverlässig, vgl. v2.137.1). Die nur am Wochenende exportierte Projektbeschreibungs-
  Quelle braucht **keinen** Sonderfall: sie zählt nur als „neuer", wenn ihr Inhalt sich wirklich
  geändert hat — ein älterer, unveränderter Stand bleibt grün.
- **Klick → Detail-Dialog** (analog „Interne KI"): Status, „Letzter CSV-Import" (jüngstes
  `last_imported_at`), Liste der betroffenen Quellen, **„Jetzt importieren"** (`runDataUpdate` —
  exakt der Einstellungen-Pfad, via [useAsyncAction](src/core/hooks/useAsyncAction.ts), Pitfall #15)
  und „Zu den Einstellungen".
- Hintergrund-Check ohne Permission-Prompt (`collectCandidates` nutzt nur `queryPermission`);
  re-prüft beim Start-Pass-`done`, bei SMB-online und auf jedes `csvSourcesSignal` (nach Import,
  Ordner-Verknüpfen, Snapshot-Sync). Verdrahtet in [ShellLayout.tsx](src/core/ShellLayout.tsx).

### v2.142.0 — Anfrage-Detail „Layout A": Vorher/Nachher-Zwei-Spalten (Juni 2026)

MINOR — Umsetzung des Claude-Design-Handoffs (`_design/handoff/Anfragen`): die Detailansicht
einer Anfrage ([AnfrageDetail.tsx](src/plugins/anfragen/AnfrageDetail.tsx)) wird von vertikal
gestapelten Blöcken auf ein **Zwei-Spalten-Vorher/Nachher**-Layout umgebaut. Additiv, keine
Migration; sämtliche Funktion (Live-Export-Guard, editierbarer Anon-Text, Finalisierung, mailto)
bleibt erhalten.

- **Stepper als View-Umschalter** ([AnfrageStepper.tsx](src/plugins/anfragen/AnfrageStepper.tsx)):
  Schritte 1–3 zeigen Paar 1 (Original ↔ Anonymisiert), 4–5 Paar 2 (Anonyme Antwort ↔ Finale
  Antwort). Echter Pipeline-Status bleibt am `active`-Schritt; die gezeigte View bekommt eine
  zusätzliche `viewing`-Markierung.
- **View 1** ([AnonymisierungView.tsx](src/plugins/anfragen/AnonymisierungView.tsx), absorbiert
  `AnfrageAnonymisierung` + `ReviewEditor`): Original mit PII amber, anonymisierter Text editierbar
  mit Platzhaltern blau + Live-Leaks rot; Badge „Keine PII"/„… PII-Treffer" vom Guard getrieben;
  Mapping-Lade (mit „Alias"-Badge bei doppeltem Platzhalter); Actbar Kopieren/FAQ-öffnen/Erneut.
- **View 2** ([AntwortView.tsx](src/plugins/anfragen/AntwortView.tsx), absorbiert
  `RueckimportFinalisierung` + `FinaleAntwortAusgabe`): Antwort-Textarea ↔ Live-de-anonymisierte
  Finale (eingesetzte Originale blau); Warnzeile für fehlende/unbekannte Platzhalter; „Antwort
  übernehmen" konsolidiert in On-blur-Persist (Status monoton).
- **Gemeinsam resizable Panes** ([useSyncedPaneHeight.ts](src/plugins/anfragen/useSyncedPaneHeight.ts),
  ein Höhen-State zieht beide Spalten, persistiert), **Synchron-Scrollen** + **Untereinander**-Stack,
  **Hervorheben**-Schalter (geteilt). Mehr-Art-Highlight additiv in
  [highlight.ts](src/plugins/anfragen/highlight.ts) (`buildKindedSegments`, Prioritäts-Merge) +
  [HighlightedText.tsx](src/plugins/anfragen/HighlightedText.tsx); Finale-Segmente via
  `wiedereinsetzenSegmente`. Co-located Scoped CSS
  [anonymisierung-detail.css](src/plugins/anfragen/anonymisierung-detail.css) (nur `--tf-*`-Tokens,
  Dark-Mode flippt).

### v2.141.0 — Anfragen: UI-Parität mit Förderanträgen (Ansichten, Collapse, Löschen) (Juni 2026)

MINOR — das Anfragen-Modul ([src/plugins/anfragen/](src/plugins/anfragen/), dev) übernimmt
die Layout-Patterns der Förderanträge für mehr Konsistenz. Additiv, keine Migration.

- **Drei Ansichten** Liste/Tabelle/Karten über einen store-agnostischen, jetzt geteilten
  `ViewModeToggle` ([src/components/ui/ViewModeToggle.tsx](src/components/ui/ViewModeToggle.tsx) —
  promoviert aus der Skill-Verwaltung, die per dünnem Re-Export unverändert weiterläuft).
  `viewMode` persistiert pro Browser (localStorage). Tabelle nutzt den generischen
  `SortableTable` ([AnfrageTabelle.tsx](src/plugins/anfragen/AnfrageTabelle.tsx)), Karten ein
  Tile-Grid ([AnfrageKarten.tsx](src/plugins/anfragen/AnfrageKarten.tsx)).
- **Collapse-to-Rail**: `MasterDetailLayout` ([src/components/master-detail/MasterDetailLayout.tsx](src/components/master-detail/MasterDetailLayout.tsx))
  bekommt opt-in `collapsible`/`listCollapsedKey`/`collapsedRailLabel` + Render-Funktions-`list`
  (Collapse-API). Default aus → die 4 anderen Konsumenten bleiben unverändert. Im schmalen
  Sidebar-Modus wird die Listenansicht erzwungen.
- **Prominenter Status** als farbiger Badge (Fortschritt-Semantik, `STATUS_VARIANT` in
  [status.ts](src/plugins/anfragen/status.ts)) im Detail-Header und in allen Listen-Ansichten.
- **Löschen** im Detail-Header und als Zeilen-/Karten-Hover-Aktion über die wiederverwendbare
  [AnfrageDeleteControl.tsx](src/plugins/anfragen/AnfrageDeleteControl.tsx) (Inline-Zwei-Schritt-
  Bestätigung, `useAsyncAction`).
- **Einklappbare Detail-Abschnitte** (Stammdaten/Mailtext/Anonymisierung/Antwort) über die um
  ein optionales `storageKey` (Persistenz) erweiterte
  [CollapsibleSection.tsx](src/components/ui/CollapsibleSection.tsx).

### v2.140.1 — Snapshot-Write schließt Fixture-Quellen aus (Defense-in-depth) (Juni 2026)

PATCH — schließt die Lücke, durch die der Fixture-Vorfall überhaupt entstehen konnte.
**Ursache des Vorfalls:** Ein versehentlich gegen den echten Share geöffneter **Dev-Build**
(nur dort `demoDataBundled: true`) auto-seedet die `fixture-real-*`-Demo-Quellen; der
nächste Snapshot-Write serialisierte den **gesamten** Schema-Store ([snapshot.ts](src/core/services/csv/snapshot.ts))
inkl. dieser Fixtures auf den Share → überschrieb die echten Quellen → alle pl/kurator-
Rechner zogen sich den Demo-Snapshot. (Build-Zeit-Schutz gegen `demoDataBundled` auf
`production` gibt es, aber keinen Laufzeit-Schutz am Publish-Boundary.)

- **Fix:** `loadSmallStoreData` (Choke-Point für Voll- UND Delta-Write) filtert
  `fixture-real-*`-Schemas (`isFixtureSchemaId`) aus dem publizierten Snapshot — Demo-Daten
  gelangen nie auf den Share; der lokale Dev-Store behält die Fixtures.
- Regressions-Test [snapshot-fixture-exclusion.test.ts](src/core/services/csv/__tests__/snapshot-fixture-exclusion.test.ts):
  echtes + Fixture-Schema → publizierte `csv_schemas.jsonl` enthält nur das echte.

### v2.140.0 — CSV-Kuration: „Demo-Quelle → echte Quelle umwandeln" (Juni 2026)

MINOR — Abschluss der Fixture-Härtung: ein Kurator kann eine fälschlich auf einem
Produktiv-Share gelandete Demo-/Fixture-Quelle (`fixture-real-*`) in eine echte Quelle
umwandeln, **ohne neu zu mappen**.

- **Button „In echte Quellen umwandeln (Mapping bleibt)"** im roten Fixture-Banner der
  CSV-Sources-Seite ([CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx)).
  Wandelt alle `fixture-real-*`-Quellen um: `column_mapping`/`join_key`/`priority`/`is_master`/
  `encoding`/`separator` bleiben erhalten, es gibt eine neue **Nicht-Fixture-ID** (vom
  Quellnamen abgeleitet, slugifiziert, kollisionssicher), der Import-Zustand wird zurückgesetzt.
  Danach läuft der Auto-Refresh für diese Quellen normal; die echten CSVs spielt man via
  „CSV neu wählen"/Auto-Refresh ein, dann „Antrags-Daten zurücksetzen".
- Logik in [convert-fixture-source.ts](src/plugins/csv-sources-kuration/services/convert-fixture-source.ts)
  (`deriveRealSchemaId` / `buildRealSchemaFromFixture` / `convertAllFixtureSources`), TDD-getestet
  inkl. der Endlosschleifen-Falle (ein Quellname, der selbst zu `fixture-real-…` slugifiziert,
  bekommt einen `q-`-Präfix vor der Kollisions-Schleife). Audit-Event `csv_fixture_converted`.

### v2.139.0 — CSV-Kuration: Encoding-Wahl im Re-Import + Warnung bei Demo-/Fixture-Quellen (Juni 2026)

MINOR — zwei Härtungen aus dem „Produktion lief unbemerkt auf Demo-Fixtures"-Vorfall
(echte Legacy-CSVs wurden nie importiert, weil nur `fixture-real-*`-Quellen registriert
waren — die sind per `isFixtureSchemaId` vom Auto-Refresh ausgeschlossen).

- **Encoding-Selektor im „CSV neu wählen"-Dialog** ([CsvSourceReimportDialog.tsx](src/plugins/csv-sources-kuration/CsvSourceReimportDialog.tsx)):
  bisher las der Re-Import stur mit dem **gespeicherten** `schema.encoding` (oft UTF-8) →
  Windows-1252-Umlaute wurden zu `�`. Jetzt: Dropdown UTF-8 / Windows-1252 **plus
  Auto-Erkennung** (`readWithEncodingFallback`) — weicht das erkannte Encoding vom Schema
  ab, wird die Auswahl einmalig automatisch korrigiert und ein Hinweis gezeigt. Die Wahl
  fließt als `encodingOverride` in den Import **und** wird aufs Schema persistiert
  (`persistCsvSourceMeta` schreibt `encoding` mit), damit der nächste Auto-Refresh dieselbe
  Kodierung nutzt. Die Header-Validierung re-läuft bei jedem Encoding-Wechsel.
- **Warn-Banner bei Fixture-Quellen** ([CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx)):
  in einem Nicht-Dev-Build (`!isDevFixturesEnabled()`) mit registrierten `fixture-real-*`-
  Quellen erscheint ein rotes Banner („Nur Demo-/Fixture-Quellen … echte CSV-Exporte werden
  nie importiert"). Entscheidung in der getesteten Pure-Funktion
  [`fixtureSourceWarning`](src/plugins/csv-sources-kuration/services/fixture-source-warning.ts)
  (allFixtures vs. gemischt). Hätte den Vorfall sofort sichtbar gemacht.

### v2.138.0 — Einstellungen/Speicher: „Letzter CSV-Import" mit Datum/Uhrzeit (Juni 2026)

MINOR — die Datenaktualisierung-Sektion (Einstellungen → Speicher) zeigt jetzt, von
wann die CSV-Daten stammen, damit der User sofort sieht, ob er auf aktuellen Daten
arbeitet.

- **Neue Info-Zeile „Letzter CSV-Import: <Datum, Uhrzeit>"** unter der Datenaktualisierung-
  Beschreibung ([SpeicherTab.tsx](src/plugins/einstellungen/SpeicherTab.tsx)). Quelle ist
  das jüngste `last_imported_at` über alle CSV-Schemas (ISO-Strings sortieren chronologisch);
  Format wie anderswo via `toLocaleString('de-DE')`.
- **Live nach „Jetzt aktualisieren"**: nach einem manuellen Update werden die Schemas neu
  eingelesen, sodass der Zeitstempel ohne Browser-Reload stimmt.
- Sichtbar in dev/pl/kurator (wo CSV-Schemas geladen werden); in prod ohne CSV-Import bleibt
  die Zeile aus. Ergänzt den Erkennungs-Fix aus v2.137.1 um die nötige Sichtbarkeit.

### v2.137.1 — CSV-Auto-Refresh: stille Nicht-Erkennung geänderter Quellen auf Citrix behoben (Juni 2026)

PATCH — eine nächtlich aktualisierte CSV-Quelle wurde auf einem Citrix-Produktivrechner
(pl-Variante) nicht als „neu importieren" erkannt; auf einem Dev-Laptop mit demselben
Build funktionierte es. Ursache + Fix:

- **Root Cause**: `decideSourceUpdateState` ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts))
  schloss über einen reinen mtime-Fast-Path (`file.lastModified <= source_last_modified`)
  zu `up_to_date` kurz — **ohne den Inhalt zu lesen**. Die Baseline `source_last_modified`
  reist (nicht-portabel) per Snapshot zu den pl-Rechnern; trägt die nächtlich neu
  geschriebene CSV über SMB/Citrix eine mtime, die die Baseline nicht überschreitet
  (Timestamp-Preserve, Uhr-Skew, Metadaten-Cache), verschluckte der Fast-Path die
  Inhaltsänderung still. Der bestehende „Cold-Start"-Fix adressierte nur die
  False-Positive-Richtung; die False-Negative-Richtung blieb offen. Auf dem Laptop
  erzwangen die frisch kopierten Dateien / die fehlende Baseline den Hash-Pfad → erkannt.
- **Fix — Size-Guard**: neues Schema-Feld `CsvSchema.last_file_size` (`File.size`, Byte;
  **portabel** wie `file_checksum`, reist im Snapshot mit). Der billige Skip greift jetzt
  nur noch bei `mtime <= Baseline` **UND** unveränderter Byte-Größe; bei abweichender
  (oder unbekannter) Größe fällt der Pfad in den autoritativen `file_checksum`-Vergleich.
  Eine stale/nicht-fortgeschrittene mtime kann eine Inhaltsänderung damit nicht mehr
  verstecken. `last_file_size` wird überall gestempelt, wo `source_last_modified` gesetzt
  wird (Import, Auto-Refresh, Reselect). Alt-Schemas ohne Feld fallen einmalig in den
  Hash-Pfad und heilen mit dem nächsten Import. Rest-Blindfleck (bewusst): identische
  Byte-Größe + geänderter Inhalt + stale mtime.
- **Sofort-Workaround (bis Deploy)**: auf dem betroffenen Rechner „CSV neu wählen" /
  Force-Import überspringt den mtime-Pfad und importiert die aktuellen Daten direkt.
- Regressions-Tests in [decide-source-update-state.test.ts](src/plugins/csv-sources-kuration/__tests__/decide-source-update-state.test.ts)
  (mtime ≤ Baseline + geänderte Größe ⇒ `update_available`) + Übergangsfall ohne Baseline.

### v2.137.0 — Anfragen: Kuration-Seite „Anfragen" + team-weit editierbare ZIM-FAQ-Assistent-URL (Juni 2026)

MINOR — neue Kuration-Seite zum Pflegen der Anfragen-Modul-Einstellungen, plus
Konsolidierung der URL-Default-Literale.

- **Neuer Sidebar-Punkt „Anfragen" unter Kuration** (Plugin `anfragen-kuration`,
  `category: 'kuration'`, `kuratorOnly: true`, `featureFlag: 'anfragen'`, Route
  `/kuration/anfragen`) — sichtbar in dev/kurator nach dem Kurator-Toggle, nur wenn
  das Anfragen-Modul aktiv ist.
- **ZIM-FAQ-Assistent-URL im GUI editierbar**: Settings-Seite im Stil von
  Einstellungen/Profil (`SectionHeader` + URL-Feld + Speichern/Auf-Standard-
  zurücksetzen), bewusst erweiterbar für künftige Anfragen-Einstellungen.
- **Persistenz team-weit auf dem Daten-Share**: Sidecar `_intern/anfragen-settings.json`
  (idempotent-overwrite via `atomicWrite`, kurator-gated über `requireOnline()` +
  `canWriteDatenShare()`, Audit-Event `anfragen_settings_updated`). Mirror, nicht
  Master: Auflösung **GUI-Override → IDB-Cache → Build-Default**, bleibt offline über
  den Fallback funktional. Der Export-Link im Review liest die URL jetzt override-aware.
- **Default-Konsolidierung**: die ZIM-FAQ-Assistent-URL hat als Code-Default jetzt
  EINE Quelle (`DEFAULT_ANFRAGEN_DASHBOARD_URL` in `feature-flags.ts`);
  `scripts/config-schema.mjs` trägt sie nicht mehr doppelt (nur noch optionaler
  Per-Variant-Override-Slot, `null` = Default). Interne Bezeichner unverändert.

Neue Dateien `src/plugins/anfragen/settings.ts` + `AnfragenEinstellungenPage.tsx`;
Plugin-Def + Registrierung in `plugins.config.ts`; angepasst `ReviewEditor.tsx`,
`feature-flags.ts`, `config-schema.mjs`, `docs/architecture/data-layout.md`. Keine
Migration (der Sidecar wird beim ersten Speichern angelegt).

### v2.136.3 — Anfragen: Recall-Eval-Panel startet eingeklappt (Juni 2026)

PATCH — das dev-only Recall-Eval-Panel (`AnfrageRecallEval`) startet jetzt **eingeklappt**
statt offen (`useState(false)`). Sauberere Startseite; das Panel wird erst bei Bedarf per
Chevron aufgeklappt. Verhalten sonst unverändert (Chevron, Card, „Recall-Eval starten").

### v2.136.2 — Anfragen: flachere Drop-Zone + Umbenennung „ZIM-Dashboard" → „ZIM FAQ-Assistent" (Juni 2026)

PATCH — zwei UX-/Wording-Tweaks im Anfragen-Modul, keine Verhaltens-/Datenänderung.

- **Drop-Zone flacher**: die `.msg`-Aufnahmefläche frisst weniger vertikalen Platz
  (`p-8` → `px-6 py-4`, Mail-Icon 20 → 18 px). Dafür hat `FileDropZone` jetzt einen
  optionalen `padding`-Prop (Default `p-8` — die anderen drei Aufrufer Dokumente/Anträge
  bleiben unverändert); nur der Anfragen-Aufruf nutzt die kompakte Variante.
- **„ZIM-Dashboard" → „ZIM FAQ-Assistent"**: das externe Claude-Artifact heißt in der UI
  jetzt „ZIM FAQ-Assistent" — Export-Button (`Kopieren & ZIM FAQ-Assistent öffnen`),
  Button-Tooltip und der Rückimport-Placeholder. Die internen Bezeichner
  (`anfragen.dashboardUrl`, `getAnfragenDashboardUrl`) bleiben unverändert (kein
  Config-/API-Bruch); aktive Doc-Kommentare wurden mitgezogen.

Die URL des Assistenten ist und bleibt ein Konfigwert: Default in `scripts/config-schema.mjs`
(`anfragen.dashboardUrl`, genutzt von `npm run dev`) + Fallback in `src/config/feature-flags.ts`
(`getAnfragenDashboardUrl`); pro Build-Variante via `anfragen.dashboardUrl` in der jeweiligen
`configs/*.config.json` überschreibbar.

Betrifft `src/components/ui/FileDropZone.tsx`, `src/plugins/anfragen/AnfrageAufnahme.tsx`,
`src/plugins/anfragen/ReviewEditor.tsx`, `src/plugins/anfragen/RueckimportFinalisierung.tsx`
+ Doc-Kommentare in den Config-/Schema-Dateien. Keine Migration.

### v2.136.1 — Anfragen: Recall-Eval einklappbar + Tooltip in der E-Mail-Liste (Juni 2026)

PATCH — zwei kleine UX-Tweaks im Anfragen-Modul, keine Verhaltens-/Datenänderung.

- **Recall-Eval-Panel (dev) klar einklappbar**: das native `<details>` (unauffällige
  Aufklapp-Marke) ist jetzt ein design-konsistenter Collapse mit rotierendem Chevron
  (gleiches Pattern wie `CollapsibleSection`), Card-Rahmen + Flask-Icon bleiben. Der lange
  Recall-Report lässt sich nach dem Lauf bewusst wegklappen, statt die Master-Detail-Ansicht
  nach unten zu drücken. Default offen; „Recall-Eval starten" unverändert über `useAsyncAction`.
- **Voller Betreff/Absender bei Hover**: in der Anfragen-Master-Liste tragen die trunkierten
  Betreff- und Absender-Zeilen jetzt ein natives `title`-Attribut — bei schmaler Spalte ist
  der vollständige Titel per Mouse-Over lesbar (etabliertes Codebase-Pattern, kein Tooltip-Bundle).

Betrifft `src/plugins/anfragen/AnfrageRecallEval.tsx`, `src/plugins/anfragen/AnfrageListe.tsx`.
Keine Migration.

### v2.136.0 — Sidebar-Statusleiste „Variante D": Punkt + Wort (Juni 2026)

MINOR — Redesign der unteren Sidebar-Statusleiste nach Design-Handoff
(`_design/handoff/sidebar-status-bar/`). Die beiden icon-only Zustände (Bot / Database)
waren nicht selbsterklärend — der Nutzer musste jedes Mal den Tooltip aufrufen.

- **Jeder Zustand jetzt als farbiger Punkt + kurzes Wort** (`● Sync`, `● KI`) statt Icon —
  sofort lesbar, kein Tooltip nötig. Das Wort bleibt neutral, nur der 7-px-Punkt trägt die
  Live-Status-Farbe. Reihenfolge: `Neu hier?` · `● Sync` · `● KI` · `Version`.
- **Schmaler Zustand**: wird die ausgeklappte Sidebar unter 200 px gezogen (Power-User),
  entfällt „Neu hier?" komplett; der Platz geht an Status + Version (Version rechtsbündig).
- **„Getrennt" jetzt amber statt rot** (handlungsbarer Zustand, kein harter Fehler) — betrifft
  KI-getrennt und Sync-offline. KI-Boot-Zustand (`unknown`, vor erstem KI-Tab) bleibt grau.
- Bestehende Dialogs (Synchronisierung / Interne KI) + Live-Status-Logik unverändert; nur die
  Trigger-Darstellung + das Footer-Layout wurden überarbeitet.

Betrifft `src/components/ui/SyncStatusIndicator.tsx`, `src/components/ui/BridgeStatusIndicator.tsx`,
`src/core/ShellLayout.tsx`, `src/core/components/BuildInfo.tsx`. Keine Migration.

### v2.135.2 — Fix: „Anfragen → Anonymisieren" hängt mit lokalem llama.cpp nie endet (Juni 2026)

PATCH — der Anonymisieren-Schritt (Modul Anfragen) blieb mit dem lokalen llama.cpp/qwen-
Server ewig im Spinner, obwohl der Server seine Tokens längst generiert hatte. Ursache:
`runSkill` fuhr immer dann den **Streaming-Pfad** (`streamConversation`), wenn Thinking
aktiv war (`thinkingBudget !== 'none'`) — auch ohne Live-Vorschau-Consumer. Der
DirectLLM-Stream-Loop terminiert aber nur über `[DONE]`/Verbindungsschluss und hat
**keinen Timeout**; liefert der Server kein erkanntes Abschluss-Signal, settlet das
Promise nie. Der gut funktionierende Auslastungs-Klassifizierungs-Batch nutzt dagegen den
non-streaming-Pfad (`submitMessage` → `res.json()`, gebundene Completion).

- **Fix:** `runSkill` streamt jetzt **nur noch, wenn ein Delta-Consumer existiert**
  (`onContentDelta`/`onThinkingDelta`). Thinking allein triggert kein Streaming mehr.
- **Wirkung:** Anonymisieren + Glätten (kein Consumer) laufen über den robusten
  non-streaming-Pfad — dieselbe Completion wie die Klassifizierung. Reasoning +
  `<think>`-Bereinigung bleiben erhalten. Interaktive Flows (Gutachten/Kurzfassung,
  Live-Vorschau mit Callbacks) streamen unverändert weiter.

Betrifft `src/core/services/skills/run/run-skill.ts` (+ präzisierte Kommentare in
`anonymisierung.ts`/`finalisierung.ts`, Regressions-Test in `run-skill.test.ts`).
Keine Migration.

### v2.135.1 — Sidebar-Status: zwei kompakte Farb-Icons (Juni 2026)

PATCH — Feinschliff der Fußzeilen-Statusanzeige (aus v2.135.0). In der oft schmal
eingestellten Sidebar war die Mischung aus Datenbank-Icon + farbigem Punkt + Text
„Verbunden" + KI-Icon zu breit; der Punkt/das KI-Icon rutschten an den rechten Rand
und waren kaum klickbar.

- Jetzt **zwei farbige Icons nebeneinander** (links **KI** / Bot, rechts **Datenbestand**
  / Database), eng gruppiert und rechts ausgerichtet — beide klickbar (Dialog wie bisher).
- **Punkt + „Verbunden"-Text entfernt** (kein Platz in schmaler Sidebar); der Status
  steckt in der **Icon-Farbe** (grün = verbunden, rot = getrennt/offline, gelb-pulsierend =
  Sync läuft) + Tooltip. Icons **etwas größer** (KI 15 px, Datenbestand 14 px).

Betrifft `SyncStatusIndicator.tsx`, `BridgeStatusIndicator.tsx`, `ShellLayout.tsx`. Keine Migration.

### v2.135.0 — Live-Verbindungsstatus der internen KI (Juni 2026)

MINOR — die Verbindung zur internen KI (Streamlit-Bridge) wird jetzt **automatisch erkannt und überall
angezeigt**; der manuelle „Verbindung testen"-Klick entfällt.

- **Zentrale Status-Quelle** ([bridge-status.ts](src/core/services/ai/bridge-status.ts), Zustand-Store):
  der `StreamlitBridgeTransport` spiegelt jedes Inbound-Signal des Bookmarklets (`tf-bridge-ready`/`tf-pong`/
  `tf-app-ping`/`tf-stream`/`tf-response`) als `connected`; Ping-Timeout/geschlossener Tab → `disconnected`;
  URL-Wechsel → `unknown`. Status `'unknown'` (Boot) bleibt grau (kein falsches Rot).
- **Auto-Erkennung** ([useBridgeHeartbeat.ts](src/core/hooks/useBridgeHeartbeat.ts)): passiver Poller (öffnet
  nie selbst einen Tab). Zwei-Stufen-Takt ~3 s — günstiger `window.closed`-Check (fängt den geschlossenen
  KI-Tab in ~3 s) + alle ~15 s ein passiver Ping (fängt „Tab offen, aber Bridge tot").
- **Homepage-Karte** ([AiAssistantCard.tsx](src/plugins/home/AiAssistantCard.tsx)): zeigt den echten Status
  (grün/grau) und einen **„Verbinden"**-Button — die interne KI lässt sich direkt von der Startseite öffnen
  (vorher nur über Einstellungen → KI-Assistent).
- **Sidebar-Fußzeile**: neues **KI-Icon** (Bot, grün/rot/grau) neben dem Datenbestand-Indikator, der zusätzlich
  ein **Datenbank-Icon** bekommt. Klick aufs KI-Icon öffnet einen kleinen Verbinden-Dialog.
- **Trennungs-Hinweis** ([BridgeDisconnectHint.tsx](src/components/ui/BridgeDisconnectHint.tsx)): schließt der
  Nutzer den KI-Tab versehentlich, erscheint unten rechts „Interne KI getrennt — wurde der KI-Tab geschlossen?"
  mit „Erneut verbinden". Nur beim Übergang `verbunden → getrennt` (kein Fehlalarm beim Start).
- **Gemeinsamer Verbinden-Helper** ([connect-ki.ts](src/core/services/ai/connect-ki.ts)) — eine Quelle für
  Einstellungen, Homepage, Sidebar und Hinweis (kein Code-Duplikat).
- **Bookmarklet-Selbsttest** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)):
  die KI-Tab-Leiste prüft nach dem Aktivieren automatisch die Gegenrichtung und zeigt „ZAH App erreichbar"
  ohne manuellen Klick. **Das Bookmarklet muss dafür einmal neu installiert (neu in die Lesezeichenleiste
  gezogen) werden** — die App-seitige Auto-Erkennung funktioniert auch ohne.

Keine Migration. Betrifft `ShellLayout.tsx`, `SyncStatusIndicator.tsx`, `HomePage.tsx`, `StreamlitBridgeSection.tsx`.

### v2.134.2 — Skill-Verwaltung: „Speichern" fragt nicht mehr fälschlich nach (Juni 2026)

PATCH — der Editor-interne **„Speichern"**-Button (Skill-Editor + Workflow-Schritt-Editor) löste nach
erfolgreichem Speichern die Leave-Guard-Nachfrage **„Ungespeicherte Änderungen — speichern, bevor Sie
wechseln?"** aus, statt einfach zu schließen.

- **Ursache:** Beide Editoren verdrahteten den Speichern-Erfolg (`useAsyncAction(doSave, { onSuccess })`)
  mit dem **guarded** `onBack` (`requestClose → guardLeave`). Der Guard sah den Editor weiterhin als
  `dirty` (`editStateRef` lädt erst nach dem Render-Commit nach; zudem bleibt `dirty` strukturell `true`,
  weil `doSave` `version+1`/`geaendert_am`/`historie` schreibt, die der `draft` nicht trägt, und der
  `skill`-Prop nach dem Persist nie aktualisiert wird) → Nachfrage trotz gerade erfolgtem Speichern.
- **Fix:** eigener, **ungeguardeter** Close-Callback `onSaved` (= `closeEditor`) für den Speichern-/
  Rollback-Erfolg; Zurück-Link/„Abbrechen" bleiben auf dem guarded `onBack`. Damit verhält sich der
  Skill-/Workflow-Editor wie der bereits korrekte `RegelEditor` (Save schließt direkt). Nachfrage erscheint
  nur noch beim Verlassen **ohne** Speichern.

Betrifft `SkillEditor.tsx`, `WorkflowEditor.tsx`, `SkillVerwaltungPage.tsx` (Kuration). Keine Migration.

### v2.134.1 — Anfragen: Anonymisierung robust gegen Eigenheiten der internen KI (Juni 2026)

PATCH — zwei Fixes am Anonymisierer des Moduls „Anfragen" (dev), der an Eigenheiten der internen KI
(Streamlit-Bridge, Reasoning IMMER an) scheiterte („…nicht im erwarteten JSON-Format {anonymisiert,
mapping}").

- **Thinking-Block inline:** `runAnonymisierung`/`polishAntwort` gaben kein `thinkingBudget` → `runSkill`
  übersprang `extractThinking` → der inline `<think>…</think>`-Reasoning-Block (oft mit einem
  JSON-Format-Beispiel darin) blieb im `raw`, und der Parser griff das Beispiel statt der echten Antwort.
  Fix: `thinkingBudget: 'medium'` wie bei allen anderen Skill-Läufen; Parser ankert zusätzlich auf das
  Feld `"anonymisiert"`.
- **Früh-Finalisierung „Starte…":** das Bridge-Bookmarklet
  ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js))
  finalisierte die Antwort nach `SETTLE_MS = 2500 ms` DOM-Idle ohne Schutz gegen kurze, noch wachsende
  Teil-Antworten; unter Last pausiert das Thinking-Modell nach einem ersten „Starte…"-Token > 2,5 s →
  `submitMessage` bekam „Starte…" statt des JSON (kein Stream-Fallback; der Chat maskiert es via Streamlits
  eigener Darstellung). Fix Ebene 1 (App, kein Re-Install): bounded **Retry** in `runAnonymisierung`
  (3 Versuche). Fix Ebene 2 (Bookmarklet): `SETTLE_MS` 2500 → 5000 + doppeltes Idle-Fenster für sehr kurze
  Antworten (< 40 Zeichen). **Das Bookmarklet muss einmal neu installiert werden**, damit Ebene 2 greift.

Dev-only (Modul „Anfragen"), keine Migration.

### v2.134.0 — Gutachten: Workflow-Auswahl im Antrag (dev-Test) (Juni 2026)

MINOR — Folgeschnitt zu v2.133.0: In **dev** kann man im Antrag auswählen, **welchen** GA-Workflow der
Gutachten-Stepper fährt, um einen frisch gebauten **Entwurf**-Workflow an einem echten Antrag testweise
durchzuspielen. Greift **nur** wenn Entwürfe erlaubt sind **und** es >1 wählbaren Workflow gibt — sonst
kein Dropdown, **GA byte-identisch** (prod/pl/as unverändert). Bewusst klein: kein neues Run-Keying, keine
Output-Typen, kein zweiter Skill-/Generierungs-Pfad.

- **Eine Erkennungs-/Auflösungs-Quelle** ([active-workflow.ts](src/plugins/antraege/gutachten/active-workflow.ts)):
  `resolveWorkflowSteps` nimmt optional `opts.workflowId` — eine explizite, gültige + verfügbare Wahl
  gewinnt über den Tie-Break, sonst byte-identisch. Kandidaten-Prädikat `istWorkflowKandidat` als EINE
  Quelle; neue reine `verfuegbareWorkflows(file, typ, {erlaubeEntwuerfe})` fürs Dropdown.
- `buildSkillMap` ([skill-context.ts](src/plugins/antraege/gutachten/skill-context.ts)) nimmt optional
  `{ artefaktTyp, workflowId }` und nutzt **denselben** Auflöser (ohne Opts byte-identisch → `useBatchJob`
  unberührt).
- **Dropdown** ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts) +
  [GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)): lokaler `testWorkflowId`-State
  (resettet pro Reload), Lade-Effekt speist `{ workflowId }` ein und lädt bei Wechsel Run/Steps/SkillMap neu;
  das `select` „Workflow (dev-Test)" erscheint nur bei `erlaubeWorkflowEntwuerfe() && >1` Workflow.
- Bekannte Vereinfachung: Run-Keying bleibt `(artefaktTyp, scope)` — zwei GA-Workflows teilen den Run;
  abweichende Schritt-IDs starten leer (gewolltes Test-Verhalten). Per-Workflow-Keying erst, wenn nötig.

### v2.133.1 — Streamlit-Bridge: Status-Leiste über der neuen Tab-Leiste sichtbar (Juni 2026)

PATCH — auf der geänderten internen-KI-Seite (`gpt.vdivde-it.de`, jetzt volle-Breite-Tab-Leiste mit
hohem eigenem Stacking-Context) verschwand die Bridge-Status-Leiste **hinter** den Tabs — `z-index:99999`
reichte nicht mehr. Symptom: „Bookmarklet geht nicht / Klick macht nichts". Tatsächlich war die Bridge
**funktional installiert und von der App erreichbar**, nur die Leiste unsichtbar (und der „Klick macht
nichts"-Effekt war der gewollte Doppel-Install-Guard).

- `z-index` der Leiste ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js))
  von `99999` auf das Maximum **`2147483647`** angehoben. Live auf `gpt.vdivde-it.de` bestätigt.
- **Bookmarklet-Änderung ⇒ einmal neu installieren** (aus Einstellungen → Bridge-Sektion neu ziehen).

### v2.133.0 — Workflow-Verwaltung: alle Workflows pflegen + variantenbewusste dev-Freigabe (Juni 2026)

MINOR — der Workflows-Tab der Skill-Verwaltung zeigte bisher genau **einen** fest verdrahteten Workflow
(`zim-ep`). Jetzt verwaltet er **alle** Workflows (Gutachten, NF, …) und bekommt ein **variantenbewusstes
Freigabe-Modell**: in **dev** Entwürfe bauen + ausführen, per **Freigabe** in pl/prod/as/kurator verfügbar
machen. Additiv (`params`/Feld-Defaults, kein Schema-Bump, kein neuer Object-Store/Transport); **GA
byte-identisch**.

- **Freigabe-Achse** ([types.ts](src/core/services/skills/registry/types.ts), [storage.ts](src/core/services/skills/registry/storage.ts)):
  `WorkflowDef.freigabe?: 'entwurf'|'freigegeben'` (normalize defaultet fehlend → `'freigegeben'`, fail-safe —
  zim-ep/nf bleiben überall verfügbar). Getrennt von `aktiv` (globaler An/Aus, geteilte `registry.json`).
  Neuer Artefakt-Typ `'precheck'`.
- **Flag** `features.workflowEntwuerfe` ([runtime-config.ts](src/config/runtime-config.ts), nur dev `true`) +
  Ableitung `erlaubeWorkflowEntwuerfe()` ([feature-flags.ts](src/config/feature-flags.ts)); reine Gate-Funktion
  `istWorkflowVerfuegbar` ([workflow-steps.ts](src/core/services/skills/registry/workflow-steps.ts), kein
  `runtimeConfig`-Import).
- **Kuration** ([SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx) +
  neue Komponenten `WorkflowSwitcher`/`WorkflowMetaEditor`): Switcher über alle Workflows (Typ-Badge +
  Status), Anlegen (`blankWorkflow` → Entwurf), Metadaten (Name/Typ/Ebene/Aktiv), Freigeben/Zurückstellen,
  Löschen (eigene) bzw. Deaktivieren (Seeds, Remerge-Schutz). Tab-Zähler = Anzahl Workflows.
- **Laufzeit** ([active-workflow.ts](src/plugins/antraege/gutachten/active-workflow.ts)): neue reine
  `resolveWorkflowSteps(file, artefaktTyp, {erlaubeEntwuerfe})` (Tie-Break freigegeben-vor-Entwurf, dann
  Version; ga-Fallback `ZIM_EP_DEF`). `resolveActiveWorkflow` bleibt dünner GA-Wrapper — alle drei
  GA-Aufrufer (inkl. `useBatchJob`) unberührt; dev sieht/fährt Entwürfe, andere Varianten nur Freigegebenes.
- Abgrenzung: PreCheck-**Laufzeit** (Einstiegspunkt im Antrag, Workflow-Auswahl-UI je Typ, PreCheck-Outputs)
  ist bewusst der nächste Schnitt (Prompt B), nicht Teil dieser Version.

### v2.132.1 — Streamlit-Bridge: „Prompt-Vorlagen"-Spalte automatisch ausblenden (Juni 2026)

PATCH — das Bridge-Bookmarklet blendet beim Aktivieren die rechte **„Prompt-Vorlagen"**-Spalte der
internen KI-Seite aus und gibt dem (von der App ferngesteuerten) Chat die volle Breite. Übernimmt den
bewährten CSS-Trick des alten ZIM-Bookmarklets, additiv im Snippet — Bridge-Kernlogik unverändert.

- **Rein per CSS** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  neue `installTemplateHide()`): injiziertes `<style id="tf-bridge-layout">` blendet
  `[data-testid="stColumn"]:has(#prompt-vorlagen)` aus und setzt die Geschwister-Chat-Spalte auf volle
  Breite. Verankert am Streamlit-Auto-Anker `#prompt-vorlagen` → wird bei jedem Rerun neu erzeugt, die
  Regel greift **flackerfrei ohne Observer**.
- **Sicherheitsnetz `ensureVorlagenHook()`**: fehlt der Anker mal (Streamlit-Änderung), wird die
  „Prompt-Vorlagen"-Überschrift per Text-Match (`/prompt[\s-]*vorlagen/i`) gefunden und der Anker
  nachgesetzt. Re-Check im **bestehenden** `MutationObserver` (kein zweiter Observer; im Normalfall
  `getElementById`-Early-Return).
- **Bookmarklet-Änderung ⇒ einmal neu installieren** (aus Einstellungen → Bridge-Sektion neu ziehen).

### v2.132.0 — Regel-Editor: Erkennung ohne Regex-Wissen + zweiseitiger KI-Hinweis + Typ-Transparenz (Juni 2026)

MINOR — `verbotenes_muster`-Regeln lassen sich jetzt ohne Regex-Kenntnis pflegen; der generierte
KI-Hinweis leakt keinen rohen Regex mehr. Alles **additiv in `params.*`** (kein Schema-Bump, keine
`normalize`-Änderung); **Phrasen-Bestand byte-identisch** in Check *und* Hinweis.

- **Eine Erkennungs-Quelle** ([check-engine.ts](src/core/services/skills/registry/check-engine.ts)):
  neue reine Helfer `eingabeModusOf` / `kompiliereGruppe` / `erkennungsEintraege` (über das Dach-Barrel
  exportiert). Drei Eingabe-Modi — **Phrasen** (Default, wörtlich auto-escaped), **Synonym-Gruppen**
  (Stamm + Varianten → App kompiliert die Alternation), **Regex** (Experten, Literal-Fallback bei
  Parse-Fehler). Check-Engine **und** Live-Tester nutzen dieselbe Funktion (kein zweiter Matcher).
- **Zweiseitiger, regexfreier Hinweis**: `verbotenes_muster.hint` baut aus `hinweisVermeiden`/
  `hinweisStattdessen` bzw. menschenlesbaren Labels „Vermeide … Formuliere stattdessen …" — nie roher
  `(?:…)`/`\b` im Prompt (`buildPromptHinweis`/`buildPromptVorgaben` profitieren automatisch).
- **Editor** ([MusterErkennungEditor.tsx](src/plugins/skill-verwaltung-kuration/MusterErkennungEditor.tsx),
  neue Plugin-Komponente): Modus-Umschalter, Synonym-Builder mit Stamm + Varianten-Chips + generiertem
  Muster, Regex-Live-Validierung pro Zeile, **modusunabhängiger Live-Tester** (markiert Treffer
  clientseitig), zwei KI-Hinweis-Felder. Die alte „Muster sind reguläre Ausdrücke"-Checkbox entfällt;
  Alt-Regeln öffnen via `eingabeModusOf` im richtigen Modus.
- **Typ-Transparenz** ([RegelEditor.tsx](src/plugins/skill-verwaltung-kuration/RegelEditor.tsx)):
  read-only Typ-Chip (Schloss-Icon, „Typ · Check-Engine") + bewusster „Typ ändern"-Pfad mit Warnung,
  der die typ-spezifischen `params` auf `DEFAULT_PARAMS[neu]` zurücksetzt (pure `wechsleRegelTyp`).
- Hinweis: Die Seed-Regel `seed-passiv-stil` (Passiv-Floskel, `istRegex:true`) zeigt damit im Hinweis
  statt des rohen Regex den generischen Satz — die Umstellung auf Synonym-Gruppen + gepflegte
  KI-Hinweise erfolgt bewusst nachträglich über die UI (kein Seed-Write).

### v2.131.5 — Qualitätsregeln: Intro-Text hinter Info-Icon (vertikaler Platz) (Juni 2026)

PATCH — der Intro-Absatz „Jede Regel kodiert eine Erfahrung …" kostete vor der Tabelle eine ganze Zeile.
Jetzt hinter einem **Info-Icon in der Suchleisten-Zeile** ([SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx),
`TAB_HELP` + `Tooltip`) versteckt; der `<p>`-Absatz in [RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx)
ist entfernt. Der Nutzer sieht die Tabelle sofort, die Erklärung bleibt per Hover/Fokus abrufbar.

### v2.131.4 — Regel-Filter: Typ-Facette entfernt (Overlap mit Kategorie/Prüfart) (Juni 2026)

PATCH — die Kategorie („Art") wird per `effektiveKategorie()` aus `typ` + `pruefart` abgeleitet
([kategorien.ts](src/core/services/skills/registry/kategorien.ts)); die grob gruppierte **Typ**-Facette war
damit redundant: „Fachlich/Administrativ" standen doppelt (Typ *und* Prüfart), „Umfang & Länge" ≈ Kategorie
„Umfang".

- **Typ-Facette aus der Filter-Leiste entfernt** ([RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx)).
  Facetten jetzt: **Kategorie · Prüfart · Schweregrad · Aktiv** (Zeile 1) + **Verwendet in** (Zeile 2).
- Tote Gruppierungs-Helfer entfernt (`TYP_GRUPPE`/`typGruppeLabel`/`REGEL_TYP_GRUPPE_ORDER` aus
  [regelShared.tsx](src/plugins/skill-verwaltung-kuration/regelShared.tsx); `typ` aus dem Facetten-Hook
  [useRegelFilters.ts](src/plugins/skill-verwaltung-kuration/useRegelFilters.ts)). **`typLabel` bleibt** — die
  Tabellen-**Spalte** „Typ" zeigt weiter den granularen Typ pro Regel.
- Kategorie = Inhalts-Achse, Prüfart = Mechanismus (textlich/fachlich/administrativ) bewusst behalten.

### v2.131.3 — Qualitätsregeln-Tabelle: breitere Standard-Spaltenbreiten (Juni 2026)

PATCH — Folge der content-width-Umstellung (v2.131.2): ohne die alte `width:100%`-Streckung rendert die
Qualitätsregeln-Tabelle ihre Default-Breiten exakt → die „Regel"-Spalte (180px) war beim ersten Laden zu
schmal für die langen Regel-Namen, die „Parameter"-Spalte (300px) unnötig breit.

- **Neue Defaults** in [regelTableColumns.tsx](src/plugins/skill-verwaltung-kuration/regelTableColumns.tsx):
  Regel 180→290, Art 150→160, Parameter 300→200, Schweregrad 120→110, Verwendet in 160→230 (Typ/Aktiv
  unverändert). Proportionen wie vom Nutzer per Screenshot vorgegeben (breite Namens- + Verwendet-Spalte).
- Wirkt nur auf den **Erst-Lade**-Zustand; bereits per Drag gespeicherte Breiten (localStorage
  `teamflow_regeln_table_col_widths`) bleiben unangetastet.

### v2.131.2 — Spalten-Resize springt nicht mehr beim Greifen (Juni 2026)

PATCH — beim Greifen des Spalten-Resize-Handles in der geteilten `SortableTable`
([SortableTable.tsx](src/components/data-table/SortableTable.tsx)) sprang die Spalte breiter und der
Handle stand nicht mehr bündig am Spaltenende (Bug bestand „schon immer").

- **Ursache**: Die Tabelle rendert `table-layout: fixed; width: 100%`. Liegt die Summe der Spaltenbreiten
  unter der Container-Breite, streckt der Browser jede Spalte proportional → die gerenderte `th.offsetWidth`
  ist größer als die `<col>`-Breite. Der Resize-Seed (`startWidth = th.offsetWidth`) überschätzte damit und
  pinnte die Spalte auf ihre gestreckte Breite, die erneut gestreckt wurde → Sprung + Handle-Drift.
- **Fix**: resizbare Tabellen rendern jetzt **content-width** (so breit wie die Spaltensumme, wie die
  Förderanträge- und Suche-Tabelle) — keine Streckung mehr, `th.offsetWidth == col-Breite`, Seed stimmt,
  kein Sprung. Während des Drags wächst die Tabellenbreite live mit (`table.style.width = Summe`), damit
  `table-layout:fixed` die Nachbarspalten nicht staucht, sondern horizontal scrollt. Spiegelt das
  bestehende `SearchResultsTable`-Modell.
- **Sichtbare Folge**: schmale resizbare Tabellen (Regeln 1140px, Skills 1004px, Feedback-Board 1416px)
  füllen die Breite nicht mehr proportional, sondern sind genau so breit wie ihre Spalten (ggf. Leerraum
  rechts / Scroll bei Bedarf). Förderanträge (war schon content-width via `fitContentWidth`) unverändert.

### v2.131.1 — Typ-Gruppe: „Keine Aufzählungen" → „Muster & Pflichttext" (Juni 2026)

PATCH — die Typ-Facette ([regelShared.tsx](src/plugins/skill-verwaltung-kuration/regelShared.tsx)
`typGruppeLabel`) bündelt `keine_aufzaehlungen` jetzt mit in **„Muster & Pflichttext"** (zuvor eigene
Gruppe). Damit nur noch drei Textregel-Gruppen: Umfang & Länge / Muster & Pflichttext / (QS-Fallback).

### v2.131.0 — Qualitätsregeln-Filter: aufgeräumt (Typ-Gruppen, Skill-Zeile, kein Zähler) (Juni 2026)

MINOR — Feinschliff der Facetten-Leiste ([RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx)),
damit man „den Wald vor lauter Bäumen" sieht:

- **Typ-Facette gruppiert** statt jeden Einzel-Typ aufzulisten ([regelShared.tsx](src/plugins/skill-verwaltung-kuration/regelShared.tsx)
  `typGruppeLabel`): **„Umfang & Länge"** (Zeichen/Wörter/Sätze/Satzlänge/Absätze) und **„Muster & Pflichttext"**
  (Verbotenes Muster + Pflicht-Anfang); „Keine Aufzählungen" + QS-Fallback (Textlich/Fachlich/Administrativ)
  bleiben. Die Tabellen-**Spalte** „Typ" bleibt granular (`typLabel`) — nur die Facette bündelt.
- **„Verwendet in" in eine eigene zweite Zeile** — aufgeklappt wird die Skill-Liste sehr breit und
  verdrängte sonst die übrigen Pillen.
- **Treffer-Zähler entfernt** (kein „20 Regeln" mehr).

### v2.130.1 — Qualitätsregeln: „Spalten"-Picker in die Filter-Zeile (Juni 2026)

PATCH — der „Spalten"-Umschalter der Tabellen-Ansicht ([RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx))
saß in einer eigenen Zeile unter den Filter-Pillen. Spalten-Definition + Sichtbarkeit (`buildRegelColumns` +
`useColumnVisibility`) sind jetzt in `RegelnTab` hochgezogen; der `ColumnPicker` rendert im rechten Cluster
der Filter-Leiste (neben Treffer-Zähler/„Zurücksetzen", nur im Tabellen-Modus). `RegelnTableView` bekommt
`columns`/`visibleKeys` als Props — die separate Zeile entfällt. Reine Layout-Änderung.

### v2.130.0 — Qualitätsregeln: Gruppierung → Facetten-Filter-Leiste (Juni 2026)

MINOR — die **Qualitätsregeln**-Liste in der Skill-Verwaltung ([RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx))
hatte als einzige sichtbare Steuerung eine „Gruppiert:"-Pille (nur Tabellen-Modus); die echten Filter
lagen versteckt in den Tabellen-Spaltenköpfen und fehlten in Liste/Karten. Bei wachsender Regelzahl
schlecht filterbar.

- **Gruppierung entfernt**, ersetzt durch eine sichtbare **Facetten-Filter-Leiste** (UX wie Förderanträge-
  Quickfilter, `CollapsibleSeg`) — wirkt jetzt in **allen** Ansichten (Liste/Tabelle/Karten).
- Facetten (Einfach-Auswahl, AND-kombiniert): **Kategorie** („Art", `effektiveKategorie` — 6 Buckets),
  **Typ** (Unterkategorie), **Prüfart** (textlich/fachlich/administrativ), **Schweregrad**, **Aktiv**,
  **Verwendet in** (Skill, n:m). Treffer-Zähler + „Zurücksetzen".
- **Bestehendes Datenmodell genutzt** — keine neuen Felder; Kategorie strikt über
  `effektiveKategorie`/`kategorieLabel` (Pitfall #31, keine zweite typ→kategorie-Quelle).
- Neuer Hook [useRegelFilters.ts](src/plugins/skill-verwaltung-kuration/useRegelFilters.ts) (reine
  `applyRegelFilters`/`computeRegelCandidates` + Tests). Entfernt: `regelGrouping.ts`,
  `useRegelColumnFilters.ts` (Spalten-Header-Filter) — eine sichtbare Filter-Quelle.

### v2.129.1 — Spalten-Trennlinien im Tabellenkopf als Resize-Hinweis (Juni 2026)

PATCH — die geteilte `SortableTable` ([src/components/data-table/SortableTable.tsx](src/components/data-table/SortableTable.tsx))
zeigt im Kopf keine Spalten-Begrenzung, der einzige Resize-Hinweis war eine transparente, nur beim
Hovern sichtbare 6px-Greifzone. User sahen dadurch nicht, wo eine Spalte endet bzw. wo sie zum
Resizen greifen können.

- **Fix**: dünne vertikale Trennlinie (`borderRight: 0.5px var(--tf-border)`) am rechten Rand jeder
  Kopf-Spalte — gegated auf `resizeEnabled` (nur bei resizbaren Tabellen) und ohne die letzte Spalte.
  Die Linie deckt sich pixelgenau mit der bestehenden Greifzone (`right-0`), die beim Hovern weiter
  via `--tf-border-hover` nachdunkelt. Spiegelt das etablierte Muster aus
  [SearchTableHeader.tsx](src/plugins/suche/SearchTableHeader.tsx).
- Betrifft alle resizbaren SortableTable-Ansichten (Regeln/Check-Regeln, Förderanträge,
  Auslastungs-Klassifizierung). Body-Zellen bleiben bewusst ohne vertikale Linien (Design-Vorgabe:
  nur horizontale 0,5px-Borders).

### v2.129.0 — Modul „Anfragen": E-Mail-Kurzanfrage → anonymisierte ZIM-Antwort (Juni 2026)

MINOR — neues **dev-only** Plugin „Anfragen" (Flag `features.anfragen`, nur dev). Ein Förderreferent nimmt
eine Outlook-`.msg`-Kurzanfrage auf (body-only), lässt sie per **interner** KI anonymisieren (+ lokale
Mapping-Tabelle), exportiert die anonyme Version guard-gated in die Zwischenablage fürs externe
ZIM-Dashboard, importiert die anonyme Antwort zurück und setzt die Originaldaten **deterministisch**
wieder ein → mail-fertige Antwort (Clipboard/`mailto`).

- **`.msg`-Parser** ([src/core/services/msg/parse-msg.ts](src/core/services/msg/parse-msg.ts)): body-only über
  das bereits gebündelte `cfb` + nativen `TextDecoder` — bewusst **kein** `msgreader` (dessen
  `iconv-lite`/`Buffer`-Abhängigkeit läuft unter `file://` nicht polyfill-frei). Plain-Text > HTML > RTF
  (degradiert). Anhänge werden nur gezählt, nie verarbeitet.
- **Anonymisierungs-Skill** `anfrage-anonymisieren` in der geteilten `registry.json` — startet ZWINGEND
  **`aktiv: false`** (neues additives `SkillRecord.aktiv`-Gate); Originaltext über `{{zielText}}` → interner
  Transport erzwungen. Freischaltung ist ein manueller Schritt nach dem Recall-Gate.
- **Export-Guard** ([export-guard.ts](src/plugins/anfragen/services/export-guard.ts)): deterministischer
  Mapping-Gegenscan + Pattern-Scan (E-Mail/FKZ/IBAN/X.500-DN/Hostname/Telefon) bei JEDEM Kopieren; Export
  disabled solange nicht sicher. Convention-Guards: `anfrage-no-mapping-in-transport`,
  `anfrage-export-only-via-guard`.
- **Persistenz** im `kv`-Store (`anfrage:<id>`), kein neuer IDB-Object-Store/Version-Bump. `mapping`/
  `originalMd` (sensibelste Strukturen) verlassen den Rechner nie.
- **Recall-Gate** (Phase 9): fiktive Fixtures (alle `PiiTyp`) + Recall-Scoring + dev-Eval-Panel.

Dev-only — `anfragen: false` in prod/pl/kurator/as, keine Migration. Neue Dependency `cfb` (browser-safe,
schon transitiv via `xlsx`).

### v2.128.1 — Dev-Build: Skill-Bearbeitung ohne Kurator-Session (Juni 2026)

PATCH — im **dev**-Build (`build:dev` + `npm run dev`) ist die Skill-/Regel-Registry jetzt **direkt
editierbar**, ohne erst die Kurator-Session zu aktivieren. Begründung: der Entwickler muss alles testen
können und hat per Definition volle Rechte.

- **Fix**: `canEditSkillRegistry()` ([feature-flags.ts](src/config/feature-flags.ts)) kurzschließt jetzt
  über `isDevContext()` → dev ist immer voll editierbar. Die einzige Edit-Schranke
  ([useSkillRegistry.ts](src/plugins/skill-verwaltung-kuration/useSkillRegistry.ts)) routet alle
  Editoren/Tabs hierüber.
- **Unverändert**: pl (Schreibrecht ohne Kurator-Login), kurator (nur mit aktiver Session), prod/as
  (Plugin aus bzw. read-only) — `isDevContext()` ist dort `false`. Physischer Write-Guard
  (`queryPermission` in `writeSkillRegistry`) bleibt bestehen.

Dev-only — keine Auswirkung auf Produktions-Varianten, keine Migration.

### v2.128.0 — Changelog-Modal: „Alle aufklappen"-Umschalter (Juni 2026)

MINOR — neben den 10er-Paketen (v2.127) gibt es in der Filterleiste des Changelog-Modals jetzt
wieder einen Umschalter **„Alle aufklappen" / „Alle zuklappen"**: ein Klick öffnet alle Pakete und
Versions-Karten auf einmal (bzw. klappt zurück auf den kompakten Default — erste 3 offen, Rest zu).
Steckt in den Collapsible-Keys → der Umschalter mountet sauber neu (Radix `defaultOpen` greift nur
beim Mount); bleibt über Filter-/Zeit-Wechsel erhalten.

Additiv — keine Migration, keine Config-Änderung.

### v2.127.0 — Changelog-Modal: 10er-Pakete + frei größenveränderbar (Juni 2026)

MINOR — das Changelog-Modal ist bei vielen Versionen handlicher:

- **10er-Pakete**: pro Hauptnummer bleiben die obersten 3 (sichtbaren) Versionen einzeln und
  aufgeklappt; alle weiteren werden in zugeklappte 10er-Pakete nach Versionsnummer gebündelt
  (`v2.110 – v2.119 · N`) — die lange Scroll-Liste wird deutlich kürzer. Filter (Kategorie /
  „Letzter Monat") greift zuerst; leere Pakete entfallen, Pakete klappen bei Filterwechsel zu.
  Reine Funktion `bucketizeMinors` ([deriveChangelog.ts](src/core/components/changelog/deriveChangelog.ts),
  unit-getestet); die Versions-Karte ist als `MinorCard` ausgelagert.
- **Größenveränderbar**: das Modal lässt sich an der unteren rechten Ecke frei vergrößern; die
  gewählte Größe wird in `localStorage` (`teamflow_changelog_dialog_size`) gemerkt und beim
  nächsten Öffnen wiederhergestellt. Umgesetzt als opt-in `resizable`/`resizeStorageKey` an der
  geteilten [Dialog](src/components/ui/dialog.tsx)-Komponente (natives CSS `resize`, Grenzen
  ~360×280 bis 95vw×95vh); alle anderen Dialoge unverändert.

Additiv — keine Migration, keine Config-Änderung.

### v2.126.0 — Changelog „Mit KI glätten" inkrementell + auf den Daten-Share (Juni 2026)

MINOR — das Entwickler-Werkzeug „Mit KI glätten" im Changelog-Modal
([ChangelogPolishPanel.tsx](src/core/components/changelog/ChangelogPolishPanel.tsx)) speichert das
geglättete Ergebnis jetzt auf den **Daten-Share** statt per Datei-Picker in die Quelldatei — alle
Build-Varianten (prod/pl/as/kurator) lesen den nutzerfreundlichen Changelog damit **zur Laufzeit**,
ohne Rebuild.

- **Speicherort** `_intern/changelog-user.md` (neuer Store
  [changelogShare.ts](src/core/components/changelog/changelogShare.ts): `atomicWrite` + Audit-Log,
  Lesen best-effort mit Fallback). Lesepfad-Priorität im Modal: Share → eingebettete
  `changelog-user.md` → aus CHANGELOG.md abgeleitet.
- **Inkrementell**: „Mit KI glätten" verarbeitet nur die Versionen, die noch **nicht** im
  Share-Changelog stehen, und merged das Ergebnis über den Bestand (reine Helfer
  `splitMinorSections` / `selectNewMinorSections` / `mergeChangelog` in
  [deriveChangelog.ts](src/core/components/changelog/deriveChangelog.ts), unit-getestet). Erstlauf
  glättet alles; Schalter „Alle neu glätten" erzwingt einen Komplettlauf.
- **Review bleibt**: der gemergte Stand erscheint editierbar im Textfeld, „Auf Share speichern"
  schreibt ihn und aktualisiert die Modal-Anzeige sofort. Gating unverändert (`isDevContext()`).
- Der `## vX.Y — JJJJ-MM`-Datums-Suffix bleibt beim Glätten erhalten (Prompt-Regel) → der
  „Letzter Monat"-Filter (v2.125) funktioniert auch auf dem Share-Changelog.

Additiv — keine Migration: ohne Share-Datei verhält sich das Modal wie bisher (eingebettet/abgeleitet).

### v2.125.0 — Changelog-Modal: erste 3 Karten offen, kompakter, Filter „Letzter Monat" (Juni 2026)

MINOR — das „Änderungen & Updates"-Modal (Klick auf die Versionsnummer in der Sidebar) wurde
nutzerfreundlicher:

- **Erste 3 Versions-Karten offen**: beim Öffnen sind nun die obersten drei Minor-Karten der
  aktuellen Hauptnummer aufgeklappt (statt nur einer) — auch nach Tab-Wechsel
  ([ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx): `idx < 3`, Filter im
  Collapsible-`key` → deterministisches Re-Mount).
- **Kompakteres Modal**: Höhe von voller Fensterhöhe auf `max-h-[80vh]` gedeckelt (~20 % kürzer);
  scoped per `className`-Override, die geteilte `Dialog`-Komponente bleibt unverändert.
- **Neuer Zeit-Filter „Letzter Monat"** (orthogonal zu den Kategorie-Tabs): blendet ältere Versionen
  aus und zeigt nur den aktuellen + vorigen Kalendermonat. Monatsgenau aus den ohnehin in der
  CHANGELOG vorhandenen Datums-Labels — `deriveUserChangelogFromDev` trägt das jüngste Monats-Datum
  je Minor jetzt als normalisierten ISO-Suffix (`## v2.x — YYYY-MM`) durch die Pipeline
  ([deriveChangelog.ts](src/core/components/changelog/deriveChangelog.ts)).

Additiv — keine Migration, keine Config-Änderung.

### v2.124.3 — Datenaktualisierung: Nachname statt „unbekannt" / „ZAH PL" als Urheber (Juni 2026)

PATCH — der bei einer Datenaktualisierung geschriebene Snapshot stempelt jetzt einen
**menschlich identifizierbaren Urheber** ins `createdBy` (Anzeige im
[NewSnapshotBanner](src/core/components/NewSnapshotBanner.tsx) als „Neuer Datenbestand … von **X**").

- **Ursache**: in den Varianten pl/as ist das Profil-Kürzel fast immer „**alle**" (Übersichts-Modus)
  und es gibt keinen Kurator-Namen → die Attribution fiel auf das generische Build-Label („ZAH PL")
  oder — im direkten Einzel-Import — auf den Literal-String „**unbekannt**". Niemand sah, **wer**
  aktualisiert hat.
- **Fix**: neuer gemeinsamer Resolver
  [resolveSnapshotAuthor](src/core/services/infrastructure/update-author.ts) mit Präzedenz
  Kurator-Name → echtes Profil-Kürzel (nicht „alle"/leer) → **Nachname** (= Name des persönlichen
  Ordners, `getPersoenlichHandle().name`) → Build-Label → „unbekannt". Verwendet an allen drei
  Schreibstellen ([data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts),
  [importer.ts](src/core/services/csv/importer.ts),
  [useCsvAutoRefreshCheck.ts](src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts)).
- **Pitfall #27**: der Resolver liest `profile.bearbeiter_kuerzel` direkt aus der IDB (Service-Pfad,
  `useMeinKuerzel()` ist ein Hook) — markiert per `// allow-direct-kuerzel`; läuft nur in
  pl/kurator/as **ohne** MA-Login, wo der Hook ohnehin das Profilfeld liefert.

Additiv/Bugfix — **keine Migration**: bereits auf dem Share liegende Snapshots mit
`createdBy:"unbekannt"` behalten ihren Wert; erst der nächste Schreibvorgang stempelt den Nachnamen.

### v2.124.2 — AS-Home: „Alle"-Auswahl zeigt Übersicht statt Kürzel-Hinweis (Juni 2026)

PATCH — Folge-Fix zu v2.124.0 (AS-Kürzel-Dropdown). Wählt der AS-User im Profil „**Alle**", zeigt die
**Home**-Seite jetzt — wie PL — die Liste **„ALLE ANTRÄGE"** (offene Anträge aller MAs, MA-Kürzel je
Zeile) statt der Hinweis-Karte „Ihr Bearbeiter-Kürzel ist noch nicht gesetzt".

- **Ursache**: die `alleMode`-Hinweis-Karte ([HomePage.tsx](src/plugins/home/HomePage.tsx)) war an
  `!isAuslastungEnabled()` gekoppelt → AS (auslastung aus) traf den Hinweis, obwohl „Alle" eine
  bewusste Auswahl ist.
- **Fix**: Gate auf `!isKuerzelDropdownEnabled()` (Helper aus v2.124.0). Der Hinweis bleibt nur in
  Varianten **ohne** Dropdown (prod); wo der Dropdown existiert (AS via Flag, pl/dev/kurator via
  auslastung-Fallback), erscheint die Übersicht. Der AS-Pfad läuft gefahrlos durch: Inaktiv-Exklusion
  ist ohne Auslastungs-Modul ein No-op, [MaKuerzelBadge](src/plugins/antraege/MaKuerzelBadge.tsx)
  rendert das rohe `tib_kuerz`.

Additiv/Bugfix — keine Migration, keine Config-Änderung.

### v2.124.1 — Streamlit-Bridge: Chat-Auto-Reset vor „Mit KI analysieren" (Juni 2026)

PATCH — der Such-„Mit KI analysieren"-Lauf setzt den internen Streamlit-Chat jetzt
automatisch zurück, bevor er die Begründungen generiert. Vorher schleppte ein alter
Chat-Verlauf (von einer früheren Frage) als Störkontext mit und verfälschte die
Begründungen — man musste manuell „Neuer Chat" klicken.

- **Protokoll** (`tf-reset` → `tf-reset-done {found}`): `AITransport.resetChat?()` (optional,
  nur die Streamlit-Bridge implementiert es) lässt das Bookmarklet den „Neuer Chat"/
  „Zurücksetzen"-Button der KI-Seite klicken — Strategie wie im alten ZIM-Bookmarklet:
  erst Reset-Symbol (⟳/↻/🔄), dann Reset-Text (zurücksetzen/reset/clear/neu starten/neuer
  chat), die eigene Bridge-Leiste ausgenommen. Best-effort (Timeout 6 s, kein `window.open`).
  Dateien: [bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  [streamlit.ts](src/core/services/ai/transports/streamlit.ts).
- **Timing** ([begruendung.ts](src/plugins/suche/analyse/stages/begruendung.ts)): einmal vor dem
  ersten Batch + **adaptiv** vor Folge-Batches, wenn der seit dem letzten Reset akkumulierte
  Kontext ~30K Token übersteigt (schützt das ~50K-Fenster der internen KI). Im Normalfall
  (≤3 Batches, ~20K) greift nur der eine Reset am Anfang.
- DirectLLM/OpenRouter brauchen keinen Reset (stateless API) → `resetChat` dort nicht
  implementiert; der Lauf degradiert sauber (kein Abbruch bei fehlendem/fehlgeschlagenem Reset).

⚠️ **Bookmarklet einmal neu installieren** (neu ins Lesezeichen ziehen / aktivieren), sonst
greift der Reset nicht. Da der Streamlit-Chat eine geteilte Session ist, löscht ein
Analyse-Lauf den dort offenen Chat-Verlauf.

### v2.124.0 — AS-Variante: Kürzel-Auswahl als Dropdown in den Einstellungen (Juni 2026)

MINOR — die **AS**-Variante zeigt im Profil (Einstellungen → Bearbeiter-Filter) jetzt — wie PL —
eine **Auswahlliste** („Alle" + jedes TIB-Kürzel) statt des Freitextfelds.

- **Neues optionales Flag** `kuerzelDropdown` (default false; nur AS = true) entkoppelt den Dropdown
  vom Auslastungs-Modul. Helper [isKuerzelDropdownEnabled()](src/config/feature-flags.ts) fällt auf
  `auslastung` zurück → **pl/dev/kurator unverändert**, prod bleibt Freitext.
- [useKuerzelFilterOptions](src/plugins/auslastung/hooks/useKuerzelFilterOptions.ts) gated nun auf den
  neuen Helper; Datenquelle ist die in AS vorhandene distinct-`tib_kuerz`-Liste aus den Anträgen
  (kein Auslastungs-Daten-Sync nötig — alle Kürzel `aktiv`).
- In AS ist die Checkbox „Inaktive einblenden" ausgeblendet (keine Aktiv/Inaktiv-Daten ohne das Modul).

Additiv, opt-in pro Variante — **keine User-Aktion**, keine Migration.

### v2.123.0 — Einblendbare Spalte „PreCheck Status" + Generalisierung der Datums-Status-Spalten (Juni 2026)

MINOR — zweite einblendbare Tabellen-Spalte „PreCheck Status" (analog „FB Status", v2.121.0):
jüngstes gültiges Datum über mehrere PreCheck-relevante Legacy-Spalten → Label der Gewinner-Spalte
als **grauer** Badge (FB Status bleibt blau, dadurch unterscheidbar), Tooltip = Datum (`DD.MM.YYYY`).

- **Quell-Spalten** (Tie-Break = Reihenfolge): `D_PC+`, `D_PC?`, `D_PC-`, `D_XPC+`, `D_XPC?`,
  `D_XPC-`, `D_PCQ`, `D_PCAN`, `D_PCAL`. (`D_XPC+`/`D_XPC-` sind bewusst auch in der FB-Gruppe —
  die Gruppen sind unabhängig.)
- **Generalisierung statt Copy-Paste**: die FB-Pipeline aus v2.121.0 wurde zu einer
  **Gruppen-Registry** verallgemeinert — `fb-status-felder.ts` → [status-datum-gruppen.ts](src/core/services/csv/status-datum-gruppen.ts)
  mit `STATUS_DATUM_GRUPPEN` (FB + PreCheck), generischem `resolveStatusDatumFelder(schemas, codes)` +
  `computeStatusDatum`. FB-Verhalten + Slim-Keys (`fb_status_*`) unverändert. Eine neue Gruppe braucht
  künftig nur einen Registry-Eintrag + zwei Slim-Felder + eine `statusDatumColumn(...)`.
- **Mapping-robust**: Codes werden über die Schema-`column_mapping` aufgelöst (Standard/Custom,
  recurring-bug-classes #5); `?`/`+` bleiben im Code-Vergleich erhalten, `-` wird gestrippt →
  `D_PC+`/`D_PC?`/`D_PC-` kollidieren nicht. Badge-Label = `ColumnMappingEntry.label`, Fallback Code.
- **Slim-Projektion**: neue Felder `precheck_status_label`/`_datum` in `AntragListItem`;
  `LIST_VIEW_PROJECTION_VERSION` **3 → 4** → Auto-Reprojekt aus den vorhandenen Voll-Records beim
  ersten Start (**kein CSV-Re-Import nötig**). Spalte sortier- (Datum) + filterbar (Label), default aus.

Additiv — **keine User-Aktion**. Voraussetzung für sichtbare Werte: die Spalten müssen in der CSV-Quelle gemappt sein.

### v2.122.0 — Suche „Mit KI analysieren": Begründung-Spalte statt Tabellen-Overwrite (Juni 2026)

MINOR — „Mit KI analysieren" auf der Suchseite annotiert jetzt die **bestehenden** BM25-/
Ähnlichkeits-Treffer, statt sie durch ein eigenes Retrieval zu **ersetzen**. Gleiche Zeilen,
**genau** die vom User gewählten Spalten — plus **eine** zusätzliche Spalte **„Begründung"**
(2–3 Sätze pro Treffer: warum er für die Anfrage relevant ist). Das frühere Verhalten (LLM-
gewählte, oft leere dynamische Spalten + Überschreiben der Tabelle) ist abgelöst.

- **Overlay statt Replace**: Pipeline ([analyse/pipeline.ts](src/plugins/suche/analyse/pipeline.ts))
  ist einstufig; sie liefert eine `begruendungById`-Map, die SuchSeite per `r.id` über
  `searchResults` legt ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx)). Neue Stufe
  [analyse/stages/begruendung.ts](src/plugins/suche/analyse/stages/begruendung.ts) baut die
  LLM-Blöcke direkt aus `UnifiedSearchResult` (kein IDB-Reload). Die Spalte füllt sich
  **progressiv** pro Batch; die Tabelle bleibt sichtbar (kein blockierender Stepper).
- **Editierbarer Prompt**: vor dem Lauf öffnet ein Dialog
  ([AnalysePromptDialog.tsx](src/plugins/suche/AnalysePromptDialog.tsx)) den editierbaren
  Anweisungstext + eine read-only **Voll-Vorschau** des assemblierten Prompts. Frage,
  JSON-Vertrag und Trefferliste werden fest umrahmt (Edits brechen das Parsing nicht); letzte
  Anweisung in localStorage (`teamflow_suche_analyse_prompt`), Reset auf Default.
- **Umfang**: nur die aktuell angezeigten Treffer, **Top 50 nach Score** (Hinweis im Dialog,
  falls mehr); Begründung gilt für **alle** Zeilen (Anträge **und** Dokumente).
- **Spalte „Begründung"** ([columns.tsx](src/plugins/suche/columns.tsx)) erscheint nur nach einer
  Analyse, ist im Export (CSV/XLSX/Clipboard) automatisch enthalten und lässt sich per
  „Begründungen entfernen" wieder ausblenden (Treffer bleiben).
- Transport unverändert `getActiveTransport()` (Prod ohnehin intern — `validateConfig` verbietet
  OpenRouter bei festem Daten-Share). Entfernt: alte 5-Stufen-Pipeline (query-understanding,
  retrieval, batch-extraction, merge, validation) + dynamische Spalten + Stepper/ValidationBanner.

Additiv aus User-Sicht — **keine User-Aktion**, keine bestehenden Daten/Configs geändert.

### v2.121.0 — Einblendbare Spalte „FB Status" (Förderanträge-Tabelle) (Juni 2026)

MINOR — neue, standardmäßig ausgeblendete Tabellen-Spalte „FB Status" (via Spalten-Picker
einblendbar). Sie schaut pro Antrag (TV) über mehrere Legacy-Datums-Spalten, die im
Altsystem ein FB setzt, ermittelt das **jüngste gültige Datum** und zeigt das **Label der
Gewinner-Spalte** als Badge; der **Tooltip** trägt das Datum (`DD.MM.YYYY`). Kein gültiges
Datum → leere Zelle.

- **Quell-Spalten** (Tie-Break = Reihenfolge): `D_XPC+`, `D_XPC-`, `D_ALS`, `D_ALU`,
  `D_XALF`, `D_AT4`, `D_XKS`, `D_ART`, `D_ABLT`, `D_ÄT`, `D_ZBT` —
  [fb-status-felder.ts](src/core/services/csv/fb-status-felder.ts).
- **Mapping-robust**: die Spalten-Codes werden über die Schema-`column_mapping` aufgelöst
  (Standard- ODER Custom-Mapping, vgl. recurring-bug-classes #5 / `resolveVollstaendigkeitsFelder`).
  Badge-Label = `ColumnMappingEntry.label` (Label-XLS), Fallback = roher Code. Spalten, die
  nicht gemappt sind, fehlen schlicht → werden ignoriert.
- **Slim-Projektion**: Ergebnis (Label + ISO-Datum) wird einmalig bei der List-View-Projektion
  berechnet und als `fb_status_label`/`fb_status_datum` in `AntragListItem` gehalten
  ([list-view.ts](src/core/services/csv/list-view.ts), alle Merge-/Delta-/Snapshot-Projektionspfade
  reichen die aufgelösten Felder durch). `LIST_VIEW_PROJECTION_VERSION` **2 → 3** → beim ersten
  Start nach dem Update reprojiziert die List-View automatisch aus den vorhandenen Voll-Records
  (~5 s bei 13k, **kein CSV-Re-Import nötig**).
- Spalte ist sortierbar (nach Datum) + filterbar (nach Label). Voraussetzung für sichtbare
  Werte: die Spalten müssen in der CSV-Quelle gemappt sein.

Additiv — **keine User-Aktion**, keine bestehenden Daten/Configs geändert.

### v2.120.1 — Tab-Zähler konsistent zur Liste (Begleitphase) (Juni 2026)

PATCH — die Tab-Zähler („Offen 1.054", „Alle …") zählten **mehr** Anträge als die Liste darunter
tatsächlich zeigte (z.B. „Offen 1.054" → nur 874 Zeilen). Ursache: `viewCounts`/`viewCount`
([views.ts](src/plugins/antraege/views.ts)) wendeten den **Begleitphasen-Filter nicht** an, den das
Listenrendering ([useFilteredAntraege.ts](src/plugins/antraege/useFilteredAntraege.ts) →
`filterByBegleitungPhase`) standardmäßig anlegt. Da `isOpenStatus` die Begleitphase (VN-/ZB-Stati)
**einschließt** ([status-canonical.ts](src/core/utils/status-canonical.ts)), wurden offene
Begleit-Anträge mitgezählt, aber aus der Liste ausgeblendet — die Differenz wurde mit der neuen
Trefferzahl (v2.120.0) sichtbar.

- Beide Count-Funktionen überspringen jetzt VN-/ZB-Stati, wenn der Profil-Toggle „inkl. Begleitung"
  aus ist (`bearbeiter.includeBegleitung`) — exakt wie die Liste. Wirkt auf die Header-Tabs **und**
  die `QuickViewChips`. Ohne `bearbeiter`-Mode (Tests/Edge) bleibt das Verhalten unverändert.
- Regressions-Tests in [views.test.ts](src/plugins/antraege/__tests__/views.test.ts) pinnen das
  Ein-/Ausblenden je `includeBegleitung`.

Reine Korrektur (Tab-Zahl = sichtbare Liste) — **kein Migrationsbedarf**.

### v2.120.0 — Trefferzahl nach Filterung in der Förderanträge-Liste (Juni 2026)

MINOR — die Förderanträge-Liste zeigte bisher nur die Tab-Gesamtzahlen oben (z.B. „Offen 1.054");
nach dem Filtern (Suche, Status/Antragstyp-Chips, Tabellen-Spaltenkopf-Filter) gab es **keine
Rückmeldung**, wie viele Datensätze übrig bleiben. Neu: eine dezente Trefferzahl in der Toolbar-Zeile
(z.B. „1.054 Anträge"), sichtbar in allen drei Ansichten, **immer auf TV-Ebene** gezählt.

- **Alle Filterstufen einbezogen**: List/Karten nutzen `filtered.length`
  ([useFilteredAntraege.ts](src/plugins/antraege/useFilteredAntraege.ts)); die Tabelle meldet ihren
  spaltengefilterten `filteredRows.length` per Callback-Prop `onFilteredCountChange` an die Toolbar
  ([AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx) → [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx)),
  damit auch die Spaltenkopf-Filter (Status-Dropdown etc.) die Zahl bewegen.
- **TV-Ebene stabil**: der Count nimmt die Pre-Collapse-Länge — Gruppierung nach Verbund kollabiert
  nur die Darstellung, nicht die Zählung. Stil + Platzierung gespiegelt von der Suchseite
  („X Ergebnisse"). Leer-Fall zeigt weiter nur die bestehende „Keine Anträge"-Meldung.

Rein additiv — **kein Migrationsbedarf**, keine Daten/Config-Änderung.

### v2.119.0 — Globaler `--tf-*`-Token-Vertrag in theme.css + Convention-Guard (Juni 2026)

MINOR-Bump — die in [v2.67.1](docs/CHANGELOG-ARCHIV.md) dokumentierte „nackt"-Falle ist jetzt **strukturell**
gelöst statt pro Datei geflickt. Das Design-Tool erzeugt eine Skala-basierte Token-Sprache (Typo/Spacing/Radius/
Motion/Soft-Farben), die [src/theme.css](src/theme.css) nie mitbrachte; ein undefiniertes `var()` ohne Fallback
macht die **gesamte** CSS-Deklaration ungültig → Komponenten rendern „nackt". Bis hierher lebten die fehlenden
Tokens als lokale Lückenfüller in **drei** Dateien (`chat.css`, `gutachten.css`, `felder.css`) und divergierten
sogar (`--tf-font-sans` mal mit, mal ohne Geist → je Plugin eine andere Schrift).

- **Kanonisch global**: alle Skala-Tokens (`--tf-text-*`, `--tf-space-*`, `--tf-weight-*`, `--tf-font-*`,
  `--tf-tracking-caps`, `--tf-radius-sm/-pill/-dialog`, `--tf-border-thin`, `--tf-duration-*`, `--tf-ease`,
  `--tf-shadow-dialog`), die fehlenden Border-Glieder (`--tf-info/-success/-warning-border`), die Soft-Familie
  (`--tf-primary/-info/-success/-warning/-danger-soft`) und `--tf-primary-foreground` einmal in `theme.css`
  (Light + `[data-theme="dark"]`) definiert. Lokale Duplikate in chat/gutachten/felder.css entfernt; die
  font-sans-Divergenz beseitigt (Geist global).
- **Alias-/Tippfehler-Namen** im Code auf die kanonischen Tokens umbenannt: `--tf-error-bg/-text`/`--tf-error` →
  `--tf-danger-bg/-text`, `--tf-danger` (suffixlos, inkl. Hex-Fallback) → `--tf-danger-text`, `--tf-bg-subtle` →
  `--tf-bg-secondary` (kein neuer Alias-Token — die Doppelnamen werden so nicht zementiert).
- **Guard**: neuer Convention-Test `theme-token-contract` in
  [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts) scannt CSS **und** TSX/TS (auslastung
  nutzt die Tokens inline im `.tsx`). Ein `var(--tf-…)` ohne Fallback auf ein global undefiniertes Token ist ab
  jetzt ein **Build-Fehler** (`npm run check` rot), mit-Fallback nur eine Warnung. Ausnahme: `// allow-tf-token: <grund>`.

Rein additiv + Umbenennungen — **kein Migrationsbedarf**, kein bestehender Token-Wert geändert.

### v2.118.2 — Gutachten-Überschrift linksbündig zum Titeltext (Juni 2026)

PATCH — Nachzügler zur Überschriften-Vereinheitlichung (v2.117.1): Bei „Gutachten" fluchtete zwar der
Chevron, der **Titeltext** stand aber ~6px weiter rechts als bei Antragsdaten/Nachforderungen (12px
Chevron↔Titel-Gap in `.g-progress-l` statt 6px). Gap auf 6px reduziert (wie `gap-1.5` der übrigen
Klapp-Header), den größeren Titel↔Zähler-Abstand per `margin-left` an `.g-pcount` erhalten
([gutachten.css](src/plugins/antraege/gutachten/gutachten.css)).

### v2.118.1 — „Alle Felder": Flag-Cluster am echten Datenbestand + Zeilen-Layout (Juni 2026)

PATCH — der Technologie-Kennzeichen-Cluster wurde an echten SMB-Daten **gar nicht** gebündelt
(„bündelt 0 Technologie-Kennzeichen"), weil die Erkennung nur exakte `group_path`-Top-Labels
bzw. `boolean`-Feldtypen prüfte. Echte Schemas verschachteln die Flags aber unter
`Zukunftstechnologien (TV-Ebene) › <Kategorie>` mit **string**-`Y`/`N`-Werten → beide Pfade verfehlten.

- **Inhaltsbasierte Erkennung** ([flags.ts](src/plugins/antraege/alleFelder/flags.ts)): `isFlagGroup` =
  `group_path`-Keyword (jetzt `includes` statt exakt, fängt Ebenen-Suffixe) **ODER** `isBoolishGroup`
  (alle befüllten Werte reine Y/N-Tokens, ≥2). Unterbereich = `group_path`-Blattname (`leafSubgroup`).
- **Zeilen-Layout** ([felder.css](src/plugins/antraege/alleFelder/felder.css)): Label-Spalte gedeckelt
  (`minmax(180px,340px) 1fr`) statt `1fr 1.5fr` — auf breiten Detail-Panels klaffte sonst eine große Lücke
  zwischen Label und Wert.
- +5 Unit-Tests (`isBoolishGroup`/`isFlagGroup`/`leafSubgroup` + Suffix-`group_path`).

### v2.118.0 — „Alle Felder"-Optimierung (Glance + Partner-Tabelle + Flag-Cluster) (Juni 2026)

MINOR-Bump — die „Alle Felder"-Sektion der Antrag/Verbund-Detailseite ist nach dem Claude-Design-Handoff
(`_design/handoff/antrag-detail-alle-felder`) neu gestaltet. Reine UI-/Ableitungs-Erweiterung, kein
Datenmodell-/Schema-Change; neuer kohäsiver Unterordner [src/plugins/antraege/alleFelder/](src/plugins/antraege/alleFelder/).

- **Auf einen Blick (Glance)**: kuratiertes 8-Fakten-Raster ([VerbundGlance.tsx](src/plugins/antraege/alleFelder/VerbundGlance.tsx) +
  [glanceFacts.ts](src/plugins/antraege/alleFelder/glanceFacts.ts)) ersetzt den bisherigen Stammdaten-Block in
  [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx).
- **Verbundpartner-Tabelle**: eine Zeile pro Teilvorhaben statt `Wert / Wert / Wert`-Slash-Suppe
  ([VerbundPartnerTabelle.tsx](src/plugins/antraege/alleFelder/VerbundPartnerTabelle.tsx) +
  [partnerRows.ts](src/plugins/antraege/alleFelder/partnerRows.ts), AST-bevorzugt + AFS-Fallback,
  Koordinator-Kante, Summenzeile); die interaktive Teilvorhaben-Liste bleibt.
- **Technologie-Kennzeichen konsolidiert**: ~49 Booleans → ein Akkordeon-Cluster
  ([FlagCluster.tsx](src/plugins/antraege/alleFelder/FlagCluster.tsx) + [flags.ts](src/plugins/antraege/alleFelder/flags.ts)).
  Erkennung **dual**: `group_path` der echten SMB-Schemas ODER boolean-Typ/`zt_`-Präfix für die Fixtures
  (die kein `group_path` setzen); TV-/VB-Varianten gemerged (Y, wenn eine Ebene/ein TV Y trägt).
- **Relevant/Mit-Werten/Alle-Tabs + Sticky-Sprung-Index + Akkordeon-Gruppen**
  ([AlleFelderSection.tsx](src/plugins/antraege/alleFelder/AlleFelderSection.tsx), bleibt gemeinsames Bauteil
  für Verbund + TV; `headerVariant` aus v2.117.1 beibehalten).
- **Kuratierte Duplikat-/Roh-Klassifikation** ([felderKuration.ts](src/plugins/antraege/alleFelder/felderKuration.ts))
  für den Relevant-Filter — Seed aus Handoff-Labels + Fixture-Keys, vom Team erweiterbar
  (Bausteine = kuratierte App-Daten).
- `buildDisplayRows` + `AlleFelderSection` nach `alleFelder/` verschoben (gleiche API; Importer nachgezogen).
  28 neue Unit-Tests (classifyField/flags/glanceFacts/partnerRows/format).

### v2.117.1 — Verbund-Detail: Abschnitts-Überschriften vereinheitlicht (Juni 2026)

PATCH — die Klapp-Überschriften der Verbund-Detailseite sind jetzt einheitlich im Nachforderungen-Stil
(16px medium, Title-Case, Chevron 15, linksbündig bei x=0) statt teils kleiner Großbuchstaben.

- **Antragsdaten** + **Verbund-Historie** ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)): 11px-Uppercase → 16px medium.
- **Alle Felder**: neuer optionaler Prop `headerVariant` an [AlleFelderSection.tsx](src/plugins/antraege/AlleFelderSection.tsx); die Verbund-Aggregat-Ansicht ([VerbundAlleFelder.tsx](src/plugins/antraege/VerbundAlleFelder.tsx)) nutzt `'section'` (16px), die TV-Detail-Nutzung bleibt auf `'compact'` (11px) — dort sitzt sie zwischen kleineren Sub-Sektionen.
- **Gutachten**: linke Einrückung der Fortschrittsleiste (`.g-progress` `margin 0 2px` → `0 0`) auf x=0 wie Nachforderungen.

### v2.117.0 — Verbund-Detailseite: einklappbare Abschnitte (Juni 2026)

MINOR-Bump — die wesentlichen Abschnitte der Verbund-Detailseite ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx))
sind jetzt einzeln ein-/ausklappbar, damit beim Texten der Artefakte (Gutachten/NF/…) gezielt Platz
freigeräumt werden kann. Reine UI-Erweiterung, kein Datenmodell-/Schema-Change.

- **Neuer „Antragsdaten"-Sammelblock**: Stammdaten + Status/Workflow + Teilvorhaben liegen unter einer
  gemeinsamen, einklappbaren Überschrift (nur echte Verbünde; bei pseudo unverändert). Die Kurzbeschreibung
  bleibt darüber sichtbar.
- **Gutachten / Kurzfassung / Nachforderungen / Verbund-Historie** ebenfalls einzeln einklappbar — das
  Header-Toggle-Muster der bestehenden „Alle Felder"-Sektion ([AlleFelderSection.tsx](src/plugins/antraege/AlleFelderSection.tsx)),
  Chevron + Titel als Button. Artefakt-Sektionen verstecken ihren Body via CSS (`hidden`) statt zu unmounten,
  damit ein offener Markdown-Editor/Stand seinen Buffer behält; Aktions-Buttons (Erzeugen/Export) bleiben im
  eingeklappten Header erreichbar.
- **Unabhängige Schalter**, jeder Zustand pro Browser persistiert ([useCollapsedSection](src/core/hooks/useCollapsedSection.ts),
  Keys `verbund_*_collapsed`), Default überall offen (heutiges Bild). Kein Akkordeon.
- **Sprung-Nav-Kopplung**: ist der Antragsdaten-Block eingeklappt, klappt ein Klick auf „Stammdaten"/„Workflow"/
  „Teilvorhaben" ihn zuerst auf und scrollt dann (die `id` von Gutachten/NF sitzt auf dem äußeren Wrapper und
  bleibt erreichbar). **Alle Felder** war bereits einklappbar und bleibt unverändert.

### v2.116.0 — Markdown-Live-Preview-Inline-Editor (Gutachten-Abschnitte) (Juni 2026)

MINOR-Bump — neuer Editor für die Abschnitts-Bearbeitung in der Gutachten-Werkstatt; reiner UI-Tausch,
kein Datenmodell-/Schema-Change (Buffer bleibt rohes Markdown = Ground-Truth, kein Roundtrip).

- **Live-Preview statt Plain-Textarea** ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)):
  Der Entwurfs-Editor ist jetzt CodeMirror + neue Extension [markdownLivePreview.ts](src/components/ui/markdownLivePreview.ts)
  über dem vorhandenen `@codemirror/lang-markdown`. Fett/Kursiv/Headings werden inline gerendert, die
  Marker (`**`/`*`/`#`) via `Decoration.replace` versteckt. Conceal-Logik in der pure
  `computeLivePreviewRanges` (node-testbar, kein `EditorView`); `EditorView.atomicRanges` lässt Pfeiltasten
  sauber über versteckte Marker springen.
- **Fokus-gesteuertes Einblenden**: Marker erscheinen nur auf der **Cursor-Zeile und nur bei Editor-Fokus**;
  unfokussiert (frisch geöffnet / weggeklickt) ist die Vorschau vollständig clean. Kein Autofokus — der
  Editor geht als gerenderte Vorschau auf, Marker erscheinen erst beim Klick in eine Zeile.
- **Save vom Live-Doc**: ⌘/Strg+Enter (Keymap, `Prec.highest`, Ref-Pattern gegen Stale-Closures) und der
  „Übernehmen"-Button lesen `view.state.doc` — der 300-ms-Debounce in `MarkdownEditor` verschluckt so keinen
  letzten Tastendruck mehr.
- **MarkdownEditor** um drei rückwärtskompatible optionale Props erweitert: `autoFocus`, `frame`
  (`'none'` = ohne eigenen Rahmen) und `onCreateEditor` (View-Ref). `MarkdownEditorWithPreview` (Split-Pane)
  bleibt unverändert.
- **CodeMirror-Deps** `@codemirror/view`/`state`/`language` exakt gepinnt (genau eine CM-Instanz).
- **Convention-Guard** `gutachten-entwurf-kein-plain-textarea` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts))
  schützt gegen Rückfall auf ein rohes `<textarea>`.

### v2.115.0 — Neue Build-Variante „as" (wie pl, ohne Auslastung) (Juni 2026)

MINOR-Bump — additive neue Produktions-Variante, kein Code-Change (rein config-getrieben).

- **`configs/as.config.json`** (NEU): Kopie von [configs/pl.config.json](configs/pl.config.json) mit
  `build.outputFilename: "zah-as"`, `label: "ZAH AS"`, `browserTabTitle: "ZAH as"`. Auslastungs-Domäne
  abgeschaltet: `features.auslastung` + `auslastungSelbstEintragung` (Startseiten-Selbsteintragung) +
  `deAnonymisierung` + `maVerwaltungPasswort` auf `false`. Alle übrigen pl-Werte unverändert (Schreib-Build
  `datenShareSchreibrecht: true`, Gutachten/Skills, CSV-Auto-Refresh, `onlineStatusTab`). Eigene IndexedDB
  `teamflow-zah-as` (automatisch via `deriveVariantDbName`).
- **Eigenes Zugangspasswort** statt des pl-Passworts: `scripts/set-app-password.mjs` akzeptiert jetzt
  `as` (`ALLOWED`), Runtime ([app-password.ts](src/core/services/infrastructure/app-password.ts)) prüft
  ohnehin nur `sentinel.v === 1`, nicht die `role`. Gesetzt via `npm run set-password -- as "<pw>"`.
- **Build-Scripts**: `npm run build:as` (+ `prebuild:as`); `build:all` zieht die as-Variante mit.
- Keine Auslastungs-Sichtbarkeit: Plugin, Sidebar, Routing, MA-Spalte, Korpus-Autoload und die
  Startseiten-Selbsteintragung sind aus — rein flag-gesteuert, kein TS/TSX angefasst.

### v2.114.1 — Wording „Anpassen:" (Juni 2026)

PATCH-Bump — Text-Korrektur: Label der Refine-Zeile von „Anpassen" → „Anpassen:" (Doppelpunkt, da es
die nachfolgenden Buttons einleitet), [SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx).

### v2.114.0 — Gutachten-Detailansicht verschlankt (Juni 2026)

MINOR-Bump — UI-Refactor der Gutachten-Werkstatt-Karte + kleiner DSGVO-Warnhinweis. Kein Schema-/
Persistenz-Change.

- **Transport-Anzeige oben rechts entrümpelt** ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)):
  das dauerhafte „<Modell> · lokal" (`g-model`) ist weg. Stattdessen erscheint **nur bei externer KI**
  ein fetter Warn-Pill „⚠ Externe KI: <Provider>". Signal = authoritative DSGVO-Klasse
  (`bridge.getActiveKlasse() === 'extern'`, `getActiveProviderName()`), NICHT der mehrdeutige
  `modell`-Name (LAN-„Cloud API" = intern). Dokument-tragende Gutachten-Skills sind per
  Transport-Policy ohnehin intern erzwungen (Pitfall #30) → der Hinweis feuert im Normalbetrieb nicht.
- **Meta-Zeile schlanker** ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)):
  „15 Sätze · Entwurf [· mit persönlichem Stil] · prüft N Regeln" + Info-Icon. Die Provenienz
  („erzeugt mit <Skill> v<n>") steckt jetzt im Tooltip des Info-Icons (klickbar → öffnet den Skill,
  wenn verfügbar); der Transport-Name („Cloud API") ist ganz entfernt.
- **Anpassen-Tools direkt am Text** (dezente `g-refine-row` zwischen Meta-Zeile und „Vorfassungen",
  nur im Entwurf-Zustand): Neu/Kürzer/Länger · Thinking · Prüfen · KI-QS als Ghost-Buttons. Die untere
  Aktionsleiste reduziert sich auf eine Zeile: Bearbeiten/👍/👎/Stil … Verwerfen … „Freigeben & weiter".
- Neue scoped CSS-Klassen `.g-extern-warn`, `.g-meta-info`, `.g-refine-row`. Busy-/Freigegeben-Zweig,
  Inline-Editor, einklappbare Rail unverändert. Scope: Gutachten-Ansicht (Kurzfassung-`ReviewCard` unberührt).

### v2.113.0 — Abschnitts-Rail einklappbar (nur Kreise) (Juni 2026)

MINOR-Bump — neues UI-Feature in der Gutachten-Werkstatt. Kein Schema-Change; neuer localStorage-Pref-Key.

- Die vertikale Abschnitts-Rail ([AbschnittNav.tsx](src/plugins/antraege/gutachten/AbschnittNav.tsx)) lässt
  sich per Toggle (Chevron oben) **einklappen**: dann nur die Kreis-Badges (56px, Titel als Tooltip) —
  horizontal platzsparend, wenn der Nutzer mehr Breite für Entwurf/Panel will. Ausgeklappt wie gehabt
  (Titel + ✓, ziehbare Breite).
- Eingeklappt fixiert der Container ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx))
  die Rail-Breite und blendet die Ziehleiste aus; ausgeklappte Breite bleibt erhalten. Der Zustand wird
  persistiert (`teamflow_gutachten_rail_collapsed`).
- Die Verbindungslinie sitzt jetzt in einem eigenen Steps-Wrapper (Bezug = Kreise, unabhängig vom Toggle);
  eingeklappt zentriert auf Kreismitte. Tastatur (↑/↓) + aktiver/freigegebener Badge-Zustand unverändert.

### v2.112.3 — DOCX-Export: `**fett**` als echte Word-Fett-Runs (Juni 2026)

PATCH-Bump — schließt den in v2.112.2 offen gelassenen Punkt: „es ist jetzt richtig". Kein Schema-/
Persistenz-Change. Betroffen: [fill-template.ts](src/core/services/gutachten-vorlagen/fill-template.ts).

- Der Vorlagen-Füller fügte `finalerText` bisher verbatim ein → die vom Skill erzeugten
  `**Kurztitel:**`-Auszeichnungen standen literal im Word-Dokument. Neuer Helfer `inlineMarkdownToRuns`
  wandelt `**fett**` in echte WordML-Fett-Runs (`<w:rPr><w:b/></w:rPr>`); normaler Text bleibt
  run-identisch (kein `<w:rPr>`), `xml:space="preserve"` erhält die Leerzeichen an den Segment-Grenzen.
- **Bewusst minimal** (CLAUDE.md-STOPP-Pfad): nur `**fett**` (das einzige Skill-Inline-Markdown laut
  [seed.ts](src/core/services/skills/registry/seed.ts)); unbalancierte `**` bleiben literaler Text (kein
  Inhaltsverlust); `*kursiv*`/Code werden nicht behandelt. Zwei neue Tests in
  [fill-template.test.ts](src/core/services/gutachten-vorlagen/__tests__/fill-template.test.ts).

### v2.112.2 — Generierten Text als Markdown rendern (Juni 2026)

PATCH-Bump — Anzeige-Fix in den Review-Karten ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)
+ [ReviewCard.tsx](src/plugins/antraege/kurzfassung/ReviewCard.tsx)). Kein Schema-/Persistenz-Change.

- Der finale Text wurde bisher als roher Plain-Text (`split(/\n{2,}/)`) gezeigt, sodass die vom Skill
  **bewusst erzeugten** Markdown-Auszeichnungen (z.B. „**Kurztitel:** …" laut [seed.ts](src/core/services/skills/registry/seed.ts))
  als literale `**` erschienen — anders als die Quellenanalyse, die längst über den `MarkdownRenderer` läuft.
  Jetzt rendern beide Review-Karten den Text via `MarkdownRenderer` (Bearbeiten-Modus bleibt Plain-Text-Editor
  = Markdown-Quelle).
- **Offen/bewusst NICHT enthalten**: Der DOCX-Export ([fill-template.ts](src/core/services/gutachten-vorlagen/fill-template.ts)
  `buildAnchorParagraphs`) fügt `finalerText` weiterhin verbatim ein → im Word-Dokument stehen die `**` noch
  literal. Markdown→WordML (Fett-Runs) ist ein separater, größerer Eingriff in den getesteten Export-Pfad.

### v2.112.1 — Thinking-Schalter kompakt (An/Aus) (Juni 2026)

PATCH-Bump — UI-Tweak am Thinking-Control ([ThinkingControl.tsx](src/plugins/antraege/kurzfassung/ThinkingControl.tsx),
geteilt von Gutachten + Kurzfassung). Kein Schema-/Persistenz-Change.

- Vom 3-stufigen Dropdown (Aus/Niedrig/Standard, mit Brain-Icon) auf einen **kompakten An/Aus-Toggle**
  (`role="switch"`, kein Icon, platzsparend). „An" setzt das kanonische Standard-Budget
  (`'medium'` = `THINKING_ON_BUDGET`), „Aus" = `'none'`; jeder Wert ≠ 'none' gilt als aktiv.
- `ThinkingBudget` (`'none' | 'low' | 'medium' | 'high'`) **unverändert** — nur die UI-Auswahl
  wurde reduziert; die Transport-Ladder/Skill-Logik bleibt gleich.

### v2.112.0 — Gutachten-Detailansicht: Docked-Rail-Layout (Handoff `workflow-stepper-neu`) (Juni 2026)

MINOR-Bump — **größerer UI-Refactor** der Gutachten-Werkstatt (Verbund-Detailseite, Feature-Flag
`gutachtenWorkflow`, dev). Additiv: keine Daten-/Schema-/Persistenz-Änderung, keine Migration. Port der
optimierten Design-Variante aus `_design/handoff/workflow-stepper-neu/` (Werkstatt · Stepper d160 ·
Aktionsleiste V4 · Grün gedämpft). `npm run check`/`build:devprod` grün.

- **Docked Rail**: die Abschnitts-Rail ist jetzt an die Entwurf-Karte **angedockt** (gemeinsamer
  abgerundeter Rahmen, kein Gap) statt separater Spalte — neuer `.g-docked`-Flex-Container in
  [GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx); Grid zweispaltig
  (Docked-Einheit · Panel). Rail grau (`--tf-bg-secondary`), aktiver Schritt hebt sich weiß ab,
  Default-Breite 190px (Range 150–320), Ziehleiste (`.g-resize-handle`) liegt zwischen Rail und Karte.
  Rail-Steps sticky (`.g-rail-inner`) → bleiben beim Scrollen langer Karten sichtbar.
- **Rail-Feinschliff** ([AbschnittNav.tsx](src/plugins/antraege/gutachten/AbschnittNav.tsx)): Label nur der
  Titel (kein „X — "-Präfix; Buchstabe steckt im Badge); freigegebenes Badge = grüner Kreis **mit Buchstabe**
  (kein Häkchen-Ersatz) + kleines ✓ rechts vom Label.
- **Grün gedämpft**: `--g-green` `hsl(145,60%,33%)` → `hsl(145,30%,33%)` (entsättigt, passt zur Primärfarbe).
- **Aktionsleiste V4** ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)): kompakte
  Icon-Hauptzeile (Bearbeiten / 👍 / 👎 / Stil) + CTA „Freigeben & weiter →" rechts; Notizfeld erscheint
  kontextuell bei 👎 (Slide-in). Die Generier-Steuerungen (Neu/Kürzer/Länger/Prüfen/KI-QS/Verwerfen/Thinking)
  bleiben **vollständig** als dezente Zweitzeile — keine Funktionalität entfernt.
- **Unverändert**: schmaler Einspalten-Fallback (horizontaler Stepper + Block-Panel), Kontext-Panel
  (einklappbar/resizebar), Inline-Editor, Streaming, Export, Ein-Votum-je-Version-Semantik.

### v2.111.0 — Konsolidierung: auslastung entzerrt, `@/ui`-Shim retired, Artefakt-Achse dokumentiert (Juni 2026)

MINOR-Bump — **verhaltenserhaltendes** Aufräumen (kein Feature-/UI-/Schema-/Persistenz-Change), additive
Convention-Tests + Doku. Drei Phasen, je `npm run check` grün + eigener Commit; Schranken nur gesenkt, nie erhöht.

- **auslastung entzerrt**: [ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx) von **1285 → 687 LOC**
  zerlegt — `cockpit-helpers.ts`, `DetailPanel.tsx`, `VerbundListe.tsx`, `FilterToolbar.tsx` ausgelagert (rein
  prop-getrieben, Verhalten identisch). Die Matching-`useEffect`-Orchestrierung (`matchReqIdRef`-Stale-Guard) blieb
  bewusst im Cockpit (HIGH-risk State-Kopplung — STOPP-Signal). Drift-Guard `MAX_FILE_LOC` 1500 → 980 (neuer globaler
  Ist 846 = `smb-handle.ts`).
- **Legacy + `@/ui`-Shim abgeräumt**: tote `@deprecated`-Symbole entfernt (`recomputeAntragCounts` inkl. Barrel,
  `QuickTag`/`QUICK_TAGS`, orphan `KuratorLoginGate.tsx`); 63 `@/ui`-Barrel-Importe mechanisch auf `@/components/ui/*`
  migriert (Dialog/Select bleiben Adapter via `@/ui/Dialog|Select`-Subpfad). Drift-Guard `MAX_UI_SHIM_IMPORTS` 64 → 0
  (Barrel-Sunset). **KEEP** (echte Live-/Migrations-Pfade, entgegen Erst-Inventar): `getSmbHandle` (20+ Nutzer),
  `clearSmbHandle`, `is_admin`/`adminOnly`/`admin_status`-Familie, `pickAndStoreParentHandle`/`…Dokumentenquelle…`,
  `zeitraum_bis`, `LEGACY_PRE_V2_AKTENZEICHEN` (live in `seed-data.ts`); `LEGACY_CSV_*`/`LEGACY_FEEDBACK_*`-Konstanten
  konservativ belassen.
- **Doku + Guards**: [CLAUDE.md](CLAUDE.md) um die **Artefakt-Achse** ergänzt (`artefaktTyp`/`ebene`/`pruefart`,
  Kategorie-Modell via `effektiveKategorie`, Zwei-Achsen-Status, „Bausteine = kuratierte App-Daten"); neue Pitfalls
  **#31–#34**; neue Convention-Tests `no-hardcoded-kategorie-mapping` (Kategorie-Einzelquelle) + NF-Wortgetreu-Guard
  (System-Prompt + Modifier) in [nf-skill.test.ts](src/core/services/skills/registry/__tests__/nf-skill.test.ts).

### v2.110.1 — Vollständige `verbuende.jsonl` an der Quelle (Juni 2026)

PATCH-Bump — Korrektheits-Bugfix, **kein** Schema-/Snapshot-Format-Change, kein neuer Object-Store. Die
veröffentlichte `verbuende.jsonl` war **unvollständig** (bestätigt: `verbund_id` „ZKN110630" fehlte, obwohl
Teilanträge mit dieser ID existierten); der UI-Self-Heal in [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)
maskierte das nur in der Detailansicht, andere Konsumenten (Home-Dashboard, Historie) bekamen lückenhafte Daten.

- **Ursache**: Der Snapshot-**Schreib**pfad ([snapshot.ts](src/core/services/csv/snapshot.ts) `loadSmallStoreData`,
  genutzt von Voll- **und** Delta-Write) serialisierte die Verbünde aus dem abgeleiteten Cache über den
  `programm_id`-Index, **ohne** ihn vorher gegen die Quelle (Anträge) abzugleichen. `healMissingVerbuende`
  lief bisher nur im End-User-**Lese**pfad ([data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts)),
  nie vor einem Kurator/PL-**Write** → der Writer publizierte die Lücke seines eigenen Caches. Zusätzlich
  setzte der Merge-Update-Pfad die `programm_id` nie neu, sodass mis-filed Records dauerhaft aus dem
  Index-Query fielen.
- **Fix an der Quelle**: `loadSmallStoreData` ruft `healMissingVerbuende` **vor** dem Serialisieren (ein
  Choke-Point für beide Write-Pfade) → die veröffentlichte Datei ist vollständig, egal ob der Writer-Cache
  fehlende oder mis-filed Records hatte. Merge-Update-Pfade ([single.ts](src/core/services/csv/merger/single.ts),
  [batched.ts](src/core/services/csv/merger/batched.ts)) heilen den `programm_id`-Drift am Bestands-Record.
- **Invariant-Guard**: nach dem Heal prüft `loadSmallStoreData`, dass jeder von den Anträgen referenzierte
  Verbund serialisiert ist — Restlücke = tiefere Divergenz: Dev wirft (statt lückenhaft zu publizieren),
  Laufzeit loggt `console.error`. Regressionstests: absent + mis-filed → vollständige Datei, Guard wirft im Dev.

### v2.110.0 — Verbund-Detailseite „Kompakt"-Layout (Juni 2026)

MINOR-Bump — reine Layout-/Darstellungs-Optimierung der Verbund-/Antrag-Detailseite
([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)), **kein** Daten-/Schema-/Persistenz-Change,
alle Funktionen bleiben (TV-Aufklappen, Historie, Pseudo-Verbund, `onOpenAntrag`, Gutachten/NF). Umsetzung
des Handoffs `_design/handoff/workflow-stammdaten/` (Variante B „Kompakt"; Variante C „Tabbed" bewusst
nicht). Ziel: ~20 Zeilen Höhe sparen → Gutachten/Nachforderungen ohne langes Scrollen erreichbar. Reine
Tailwind-Übersetzung (kein scoped CSS). Betrifft **Produktion** (prod/kurator/pl), nicht hinter dev-Flag.

- **Kompakter Header**: Akronym + Status-Badge + FKZ in **einer** Zeile (statt Badge-Zeile über dem Titel),
  Untertitel darunter.
- **Warnung „Früher abgelehnt"** ([AbgelehnteVorgaengerBanner.tsx](src/plugins/antraege/AbgelehnteVorgaengerBanner.tsx)):
  3- → **1-zeilig**, Klick öffnet die volle (anklickbare) Vorgänger-Liste, Kopf klappt wieder ein.
- **Sticky Sprung-Navigation**: Anker-Leiste (Beschreibung/Stammdaten/Workflow/Teilvorhaben/↓ Gutachten/
  ↓ Nachforderungen), **dynamisch** nur für vorhandene Sektionen (Pseudo/Flags). Klebt im
  PanelShell-Scrollcontainer unter der Close-Bar (`top-[34px]`); Klick scrollt per `scrollIntoView`
  (Container-agnostisch, Sektionen tragen `scroll-mt-[80px]`) — nicht `window.scrollTo` wie der Prototyp.
- **Kurzbeschreibung**: auf 3 Zeilen geklemmt (`line-clamp-3`) + „↓ Volltext lesen"-Toggle (erst ab >220 Zeichen).
- **Stammdaten**: inline **4-Spalten** (`grid-cols-[auto_1fr_auto_1fr]`, Label vor Wert, Ellipsis + Tooltip)
  statt gestapeltem 2×3-Raster (`KeyVal` → `StammCell`-Fragment).
- **Status & Workflow** ([WorkflowStepper.tsx](src/plugins/antraege/WorkflowStepper.tsx)): neuer optionaler
  `collapsible`-Modus (Default eingeklappt) — Status-Badge „● Eingang, Schritt 1/5" + „Alle Schritte ↓";
  Step-Logik unverändert in der Komponente.
- **Teilvorhaben**: 3- → **2-zeilig** (Titel-/XSW-Zeile entfällt in der Liste; bleibt im aufgeklappten
  `TvDetailBlock`), Aufklapp-Verhalten + Status-Badge unverändert.

### v2.109.0 — Gutachten-Workflow „Werkstatt"-Layout + Inline-Bearbeiten (Juni 2026)

MINOR-Bump — additiv, **kein** Object-Store/Schema-Bump (alte `WorkflowRun`s laden unverändert). Der
Gutachten-Review-Workflow (dev-only, Flag `gutachtenWorkflow`) bekommt das mit dem Claude-Design-Tool
überarbeitete **„Werkstatt"-Layout** (Handoff `_design/handoff/workflow-mit-bearbeiten/`) und eine neue
**Inline-Bearbeitung** des Entwurfstexts. Styling als co-located gescopte CSS (`.gutachten-werkstatt`,
Konvention `chat.css`/`kompetenz-matrix.css`).

- **3-Spalten-Werkstatt** ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx) +
  [gutachten.css](src/plugins/antraege/gutachten/gutachten.css)): Fortschrittsleiste mit Export oben
  (die TV-/Verbund-Kontextkarte des Handoffs entfällt — `VerbundDetail` zeigt den Verbund-Kontext bereits
  darüber), dann **breiten-verstellbare** Stepper-Rail (`.g-rail`, [AbschnittNav.tsx](src/plugins/antraege/gutachten/AbschnittNav.tsx)) ·
  Entwurf-Karte · ein-/ausklappbares + **breiten-verstellbares** „Quelle & Prüfung"-Panel ([KontextPanel.tsx](src/plugins/antraege/gutachten/KontextPanel.tsx),
  Antragsbezug = `quellenanalyse`, Prüfung = `checks`, Denkprozess, Provenance). Schmaler Container →
  einspaltiger Fallback (gemessene Container-Breite, kein `@media`). Fehlende `--tf-*`-Tokens lokal auf den
  Scope-Root definiert (Token-Falle: `font:`/`box-shadow:` würden sonst lautlos ausfallen).
- **Inline-Bearbeiten** ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)):
  „Bearbeiten" → Plain-Text-Editor (Übernehmen/Abbrechen, `⌘/Strg+Enter` / `Esc`), „bearbeitet"-Badge mit
  „Zurücksetzen". `StepRun.originalText` snapshottet den generierten Text (additiv); reine Reducer
  `applyBearbeitung`/`applyZuruecksetzen` ([runner.ts](src/plugins/antraege/gutachten/runner.ts)), Checks
  laufen nach Save deterministisch neu (`runRegelChecks`), Export übernimmt den editierten Text automatisch.
  Persist über `reduce` (ein `setState` + ein `persist`, Pitfall #16/#20), Save via `useAsyncAction` (#15).
- **Persönlicher-Stil-Dialog** ([TweakEditor.tsx](src/plugins/antraege/kurzfassung/TweakEditor.tsx)): vom
  Slide-Over auf den kanonischen, zentrierten `Dialog` umgebaut (560px) — Master-Toggle, Preset-Chips,
  visuelle „So wird kombiniert"-Schichtung (Kurator-Lock) + „Technische Ansicht"-Toggle. Tweak-Logik
  (Rangfolge, Persistenz, `buildTweakBlock`/`buildPromptVorgaben`) unverändert; auch der Kurzfassung-Pfad
  nutzt den neuen Dialog.
- **Bewusst nicht umgesetzt** (Prototyp-Fiktion ohne Backing): Inline-Beleg-Popover im Fließtext
  (kein strukturiertes Claim→Quelle-Substrat) und die „Belege als Fußnoten"-Export-Option.

### v2.108.0 — Artefakt-Engine: Substrat + NF-Nachforderungen + GA-QS (Juni 2026)

MINOR-Bump — additiv, **kein** neuer Object-Store, **GA byte-identisch**. Die Gutachten-Maschine wird
zum generischen **Artefakt-Substrat** verallgemeinert; darauf entsteht **NF (ZIM-Nachforderungen)** als
erstes neues Artefakt *mit Inhalt* plus der **GA-QS-Regelsatz**. Eine Achse „Artefakt-Typ" trennt sich
von der amtlichen Status-Wirbelsäule. Alles Code-Seed (reproduzierbar, additiv via `mergeMissingSeeds`),
dev-only hinter Flag. Detail: [docs/architecture/artefakt-engine.md](docs/architecture/artefakt-engine.md).

- **Substrat** ([types.ts](src/core/services/skills/registry/types.ts)): `WorkflowDef.artefaktTyp`
  (`'ga'`-Default) + `WorkflowDef.ebene` (`'verbund'`-Default), `QualitaetsRegel.pruefart`
  (`'textlich'`-Default) — additiv, normalize-tolerant, Default-Resolver `artefaktTypOf`/`ebeneOf`/`pruefartOf`.
- **Run-Keying je (Typ, Scope)** ([workflow-store.ts](src/plugins/antraege/gutachten/workflow-store.ts)):
  `workflow-run:<typ>:<scopeId>`; GA-Bestands-Runs unter dem Alt-Key `gutachten-workflow:<az>` bleiben
  lesbar (Alt-Key-Fallback + lazy Promotion) — **verlustfreie Migration, GA byte-identisch**. Personal-
  Mirror je Typ disjunkt (`ga`→`gutachten/`, `nf`→`nachforderungen/`); der Backup-Sweep
  ([gutachten-backup.ts](src/core/services/personal-storage/gutachten-backup.ts)) spiegelt beide Key-Formen.
- **Vorlage als Ground-Truth + Audit** ([fill-template.ts](src/core/services/gutachten-vorlagen/fill-template.ts)):
  Vorlage frisch gelesen + SHA-256-Stempel (`FillResult.hash` → `WorkflowRun.vorlageRef`); `fillTemplate`
  auf generische `ArtefaktBlock[]` geweitet; Dateiname je Typ (`opts.dateiPrefix`, Default `Gutachten_EP`);
  fehlende/kaputte Vorlage → `FillResult.fehler` statt Throw.
- **NF-Baustein-Katalog** ([nf-bausteine.seed.ts](src/core/services/skills/registry/nf-bausteine.seed.ts)):
  72 Bausteine **wortgetreu** aus dem kuratierten NF-Prompt (G/T1–T3); Scope aus dem ID-Präfix, Platzhalter
  (`fill`/`choose`/`optional`/`wert`) deterministisch via `extractPlatzhalter` abgeleitet.
- **NF-Skill + WorkflowDef** ([nf-skill.seed.ts](src/core/services/skills/registry/nf-skill.seed.ts)):
  Auswahl/Füll-Skill (Lücke → Baustein → Platzhalter **wortgetreu** füllen; keine Befehls-/Freigabe-Schicht),
  `WorkflowDef` `zim-nf` (`artefaktTyp:'nf'`, `ebene:'tv'`, **Draft** `aktiv:false`). Neue Inhalts-Slots
  `{{nfBausteine}}`/`{{tvKontext}}`/`{{verbundKontext}}` in `INHALTS_SLOTS` (intern-pflichtig, Pitfall #30).
- **NF-QS + Verbund-Merge + Pro-TV-Ausgabe** ([nachforderungen/](src/plugins/antraege/nachforderungen/)):
  QS-Regelsatz mit `pruefart` (administrativ: kein ungefüllter Platzhalter passiert das Tor; textlich;
  fachlich/LLM-QS). G-Bausteine **einmal** am Verbund gefüllt, wortgleich in **jede** TV-NF; T-Bausteine je
  TV. Pro TV: DOCX (generische Füllung) + **E-Mail-Entwurf** (mailto). **Entwurf ≠ Entscheidung** — es wird
  nichts versendet. Schlanke Sektion hinter Feature-Flag `nfNachforderungen` (**nur dev**).
- **GA-QS aus QS v2** ([ga-qs.seed.ts](src/core/services/skills/registry/ga-qs.seed.ts)): die 5 Prüfabschnitte
  als `QualitaetsRegel` mit `pruefart`, gebunden an `artefaktTyp='ga'` (`qsRegelnFuerArtefakt`); die
  Abschnittszuordnung A–G ↔ tatsächliche Gutachten-Überschriften übernommen (keine Phantom-Lücken).
  GA-Skill-Abgleich gegen das GA-Referenz-Prompt: 3-teilige B-Struktur + 750-Wörter-Selbstprüfung + L=+50%-
  Modifier bestätigt vorhanden, **Stilbeispiele** in A/C/G additiv ergänzt — GA-Verhalten unverändert.
- Migration: rein additiv. Bestands-GA-Runs werden beim ersten Öffnen vom Alt-Key auf den neuen Key
  promotet (kein Datenverlust). NF-Seeds bleiben Draft (nicht scharf). Bundle nicht messbar gewachsen.

### v2.107.0 — Gutachten-Detail: einklappbare Liste + vertikale Abschnitts-Nav (Juni 2026)

MINOR-Bump — reine UI/UX auf Bestand (kein Schema-Bump, kein neuer Object-Store). Zwei
Verbesserungen im Förderanträge-Detail (Gutachten-Workspace): mehr Platz fürs Detail und der
Workflow-Stand auf einen Blick — statt sieben Buchstaben deuten zu müssen.

- **Antrags-Liste einklappbar** ([AntraegePage.tsx](src/plugins/antraege/AntraegePage.tsx) +
  [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx)): bei offenem Detail klappt ein Chevron
  in der Toolbar die Liste ganz ein; eine schmale „Anträge einblenden"-Leiste am Rand blendet sie
  wieder ein, das Detail nutzt den frei werdenden Platz. Zustand persistiert (localStorage), additiv
  neben der bestehenden Listenbreite. Pure-Helper [listCollapse.ts](src/plugins/antraege/listCollapse.ts)
  (env-node-getestet). Die Förderanträge-Seite nutzt bewusst **kein** `MasterDetailLayout` (eigener
  3-Pane-Split mit Filter) — der Collapse liegt daher direkt im Antraege-Split.
- **Vertikale Abschnitts-Navigation** (neu: [AbschnittNav.tsx](src/plugins/antraege/gutachten/AbschnittNav.tsx),
  auf `ListItem`): ersetzt die horizontalen A–G-Buchstaben-Tabs durch eine benannte Liste —
  Buchstaben-Badge + voller Name + Statussymbol (freigegeben ✓ / in Arbeit / offen), der aktive grün
  hervorgehoben (`aria-current`). Status **rein aus `StepRun.status`** (Pure-Helper `stepNavDescriptor`).
  Klick springt über `weiterschaltenStep` (auch leere Abschnitte → öffnet den Generieren-Prompt).
- **Zweispaltiger Body** ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)):
  links die Nav, rechts der **unveränderte** aktive Abschnitt (`ActiveAbschnitt`/`SectionReviewCard`).
  Die bisherigen Vorschau-Zeilen der übrigen Abschnitte entfallen — ihr Stand ist am Nav-Status ablesbar.
- **Responsiv + Tastatur** ([nav-layout.ts](src/plugins/antraege/gutachten/nav-layout.ts)): unter einer
  Breitenschwelle (ResizeObserver) fällt die Nav auf den kompakten horizontalen `AbschnittStepper`
  (Bestand) zurück; ↑/↓ wechselt Abschnitte, der aktive scrollt in den Blick, Fokusring.
- `ListItem` um additive optionale Props `active`/`activeClassName` erweitert (Defaults unverändert).
- Die amtliche Phasen-Leiste (Precheck/NF/Gutachten/QS) wurde **nicht** angefasst. Hinter Feature-Flag
  `gutachtenWorkflow` (nur dev). Reine UI, Bundle nicht messbar gewachsen.

### v2.106.0 — Gutachten-Workflow: „Alle Abschnitte als Entwurf erstellen" (Juni 2026)

MINOR-Bump — additive UX im Gutachten-Workflow A–G (kein Schema-Bump, kein neuer Object-Store).
Bisher lief der Workflow strikt abschnittsweise (generieren → prüfen → freigeben → „Weiter bei …");
wer **einmal alles als Rohentwurf** wollte, musste zwischendurch freigeben, weil der Einzellauf nur
**freigegebene** Vorabschnitte als Kontext durchreicht. Neu: **ein Klick** erzeugt alle noch
**fehlenden** Abschnitte nacheinander als **Entwurf** — ohne Zwischen-Freigabe; jeder neue Entwurf
bekommt die vorherigen Abschnitte (auch Entwürfe) als Kontext.

- **Bulk-Aktion `generiereAlle`** in [useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts):
  Generierungs-Kern in `generateInto(base, stepId, …)` extrahiert (arbeitet auf einem **übergebenen**
  Run → kein stale Closure; B sieht A's frischen Entwurf). Schleife über die fehlenden Abschnitte,
  `quelle:'entwurf'` für `buildVorherigeAbschnitte`, Run lokal durchgereicht, **Persist pro Abschnitt**
  (Pitfall #16/#20). `runGeneration` (Einzellauf + Auto-Retry) nutzt denselben Kern — Verhalten
  unverändert.
- **Umfang „nur fehlende"** (reine Auswahl `leereSchritte` in [runner.ts](src/plugins/antraege/gutachten/runner.ts)):
  bestehende Entwürfe **und** Freigaben bleiben unangetastet und dienen als Kontext → **idempotent
  fortsetzbar** (Transport weg → erneut klicken macht weiter). Single-pass (kein Auto-Retry im Bulk,
  wie der Batch-Pfad); STOPP bei Transport-weg/Abbruch/Fehler, fertige Entwürfe bleiben persistiert.
- **UI** ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)): Sekundär-Button
  „Alle Abschnitte erstellen" im Sektionskopf (nur wenn fehlende Abschnitte da sind), wird während des
  Laufs zu „Stopp" + Fortschrittszeile; der aktive Abschnitt zeigt den Live-Stream und „läuft" sichtbar
  durch A→G. Pro Abschnitt der zum jeweiligen Skill gehörende persönliche Tweak.
- **DSGVO/Transport** unverändert pro Abschnitt über `getTransportForSkillRun` (Pitfall #30).
- Hinter Feature-Flag `gutachtenWorkflow` (nur dev). Reine Logik/UI, Bundle nicht messbar gewachsen.

### v2.105.0 — Relevanz-Map: kuratierter VB-Kontext statt Volltext (Juni 2026)

MINOR-Bump — additive Infrastruktur für den Gutachten-Workflow (kein Migrationsschritt, kein
Schema-Bump, kein neuer Object-Store). Bisher kippte **jeder** Skill-Aufruf den **vollen**
`{{vbMarkdown}}` (30–60 Seiten Vorhabensbeschreibung, nur zeichen-gecappt) in den Prompt — die
Seiten konkurrieren mit der eigentlichen Aufgabe um die Attention. Neu: **ein interner LLM-Lauf**
(P0-konform intern) wählt **antragsweit** je Gutachten-Abschnitt die **relevanten** VB-Sektionen aus
— **wortgetreu, per Heading verankert** (Auswählen, nicht Zusammenfassen). Das Bestandsverhalten
bleibt **byte-identisch**: Default überall `kontextBedarf: 'voll'`; der `relevant`-Pfad ist verdrahtet,
aber das Umschalten der Schritte ist eine spätere eval-gestützte Kurator-Entscheidung.

- **Relevanz-Map-Kern** (neu: [relevanz-map.ts](src/plugins/antraege/gutachten/relevanz-map.ts)):
  `parseVbHeadings` (H2/H3 + Intro-Span), `buildRelevanzPrompt`, tolerantes `parseRelevanzMap`
  (Heading-IDs, kein erzwungenes JSON), wortgetreues `assembleVbRelevant` (per Span, Dokument-
  reihenfolge, Budget), `computeRelevanzMap`/`getOrComputeRelevanzMap` (IDB-`kv`-Cache per VB-Hash).
- **Seed-Skill `relevanz-map`** ([seed.ts](src/core/services/skills/registry/seed.ts), additiv via
  `mergeMissingSeeds`): intern-pflichtig (`{{vbMarkdown}}` → DSGVO-Transport-Policy, Pitfall #30).
- **Kontext-Vertrag** `WorkflowStep.kontextBedarf` (`voll`/`relevant`/`nur_zieltext`/`kein`, Default
  `voll` via `normalizeStepRolle`); neuer Slot `{{vbRelevant}}` im Skill-Runner (No-op ohne Platz-
  halter → Bestands-Skills byte-identisch) und in `INHALTS_SLOTS` (P0). `runGeneration` zieht für
  `relevant`-Schritte über einer Größen-Schwelle die gecachte Map und reicht den Auszug durch —
  **jeder Fehlerpfad degradiert still zu Volltext**.
- **Override** „Vollständigen Kontext erzwingen" (pro Lauf) in den Generierungs-Controls
  ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)).
- **Eval-A/B** `--kontext voll|relevant|both` ([skill-eval](src/core/services/skill-eval/README.md)):
  stellt voller VB vs. Relevanz-Auszug je Skill×Abschnitt gegenüber (Judge-Scores + Check-Pass-Raten).
  Gate vor jedem Default-Wechsel.
- Hinter Feature-Flag `gutachtenKurzfassung` (nur dev). Reine Logik/Daten, Bundle nicht messbar gewachsen.

### v2.104.0 — Skill-Verwaltung: freier Editor-Wechsel + Nachfrage bei ungespeicherten Änderungen (Juni 2026)

MINOR-Bump — UX-Verbesserung + Bugfix in der **Skill-Verwaltung** (Master-Detail mit den Tabs Skills,
Qualitätsregeln, Workflows). Bisher ließ sich bei offenem Editor **keine** andere Listenzeile
auswählen: ein Klick aktualisierte zwar den Parent-State, aber der Editor zeigte weiter den alten
Entwurf (`useState(initial)` re-seedet nicht ohne Remount) — erst „Speichern" schloss ihn. Jetzt
verhält es sich wie bei den Anträgen: **immer frei wechselbar**, mit **Nachfrage**, wenn der Editor
ungespeicherte Änderungen hat.

- **Remount beim Wechsel** ([SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx)):
  `key` an jedem Editor (Regel/Skill/Workflow) → eine neue Auswahl seedet den Entwurf frisch und wird
  sofort angezeigt.
- **Zentraler Leave-Guard** (neu: [editorGuard.ts](src/plugins/skill-verwaltung-kuration/editorGuard.ts),
  [UnsavedChangesDialog.tsx](src/plugins/skill-verwaltung-kuration/UnsavedChangesDialog.tsx)): jeder
  Editor meldet uniform `{ dirty, save }`; **alle** Verlassen-Aktionen (andere Zeile wählen, „+ Neu",
  Tab-Wechsel, Zurück/Escape) laufen durch `guardLeave`. Bei ungespeicherten Änderungen erscheint die
  Nachfrage **Speichern / Verwerfen / Abbrechen** (gestylter Dialog). „Speichern" persistiert über
  denselben Pfad wie der In-Editor-Button (inkl. Version-Bump/Historie beim Skill) und wechselt dann.
- **Editoren** ([RegelEditor](src/plugins/skill-verwaltung-kuration/RegelEditor.tsx),
  [SkillEditor](src/plugins/skill-verwaltung-kuration/SkillEditor.tsx),
  [WorkflowEditor](src/plugins/skill-verwaltung-kuration/WorkflowEditor.tsx)): `dirty`-Erkennung +
  Reporting via `useReportGuardState`; persist-only `doSave`-Closure (kein Schließen). In-Editor-
  „Speichern"/„Abbrechen" unverändert. Im Nur-Lese-Modus (Kurator aus) nie dirty → Wechsel immer sofort.
- Additiv, keine Daten-/Schema-Migration. Sichtbar in dev + kurator (nach Login). Typecheck + Suite
  (2119 Tests) grün; keine React-Testinfrastruktur im Projekt → Interaktion manuell verifiziert.

### v2.103.2 — Bugfix: Verbund-Detailseite öffnete ungefragt den KI-Tab (Juni 2026)

PATCH-Bump — Bugfix. Klickte man einen Verbund an, der **bereits LLM-generierte Abschnitte**
(Gutachten-Kurzfassung) hat, öffnete sich neben der Detailansicht ein **zweiter Browser-Tab** auf die
interne KI-URL (`https://gpt.vdivde-it.de/`). Ursache: die **Verfügbarkeits-Probe** beim Mount der
Detailseite (`bridge.getActiveTransport().ping()`, ausgelöst wenn eine Vorhabensbeschreibung existiert
und der Stand nicht `freigegeben` ist) rief auf der **aktiven Streamlit-Bridge** `ensureConnection()`
→ **bedingungslos** `window.open(...)`. Ein rein lesender Check hatte damit den Seiteneffekt, einen Tab
zu öffnen.

- **Passiver Ping** ([streamlit.ts](src/core/services/ai/transports/streamlit.ts)): `ping()` bekommt
  einen optionalen Schalter `PingOptions { openIfNeeded?: boolean }` (Default `true` =
  bestehendes Verhalten). Bei `openIfNeeded: false` pingt die Streamlit-Bridge nur ein **bereits
  offenes** Fenster und öffnet selbst keins → ohne lebendes Handle sofort `false` (statt 5-s-Timeout +
  Leertab). `DirectLLM.ping(_opts?)` ignoriert die Option (kein Fenster-Seiteneffekt);
  `AIBridge.pingActive(opts?)` reicht sie durch.
- **Mount-/Refresh-Proben passiv** ([useKurzfassung.ts](src/plugins/antraege/kurzfassung/useKurzfassung.ts),
  [useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)): die vier
  Lade-/`refreshVb`-Proben nutzen `ping({ openIfNeeded: false })`. Der End-Zustand bleibt identisch
  (Bridge nicht verbunden → `llmAvailable = false` → Generieren-Button disabled), nur **ohne** den
  ungefragten Tab. Explizite Nutzer-Gesten (Generieren/QS-Pre-Flight, Verbindungstest in den
  Einstellungen, SkillTestlauf, Chat, Suche, Batch) öffnen den Tab unverändert (Default `true`).
- **Erzwingung**: neuer Test [streamlit-ping.test.ts](src/core/services/ai/__tests__/streamlit-ping.test.ts)
  (passiver Ping ohne Fenster → `false` **und** kein `window.open`; aktiver Ping → `window.open`).
  Convention-Test `no-raw-active-transport` bleibt grün (`.ping(`-Zeilen sind ausgenommen). Das
  Feature ist dev-only (`gutachtenKurzfassung`/`gutachtenWorkflow`), der Transport-Fix wirkt global.
  Wiederkehrende Bug-Klasse dokumentiert in
  [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).

### v2.103.1 — Bugfix: „Verbund nicht gefunden" auf der Förderanträge-Detailseite (Juni 2026)

PATCH-Bump — Bugfix. Auf manchen Installationen zeigte die Verbund-Detailseite für **jeden** Verbund
„Verbund &lt;ID&gt; nicht gefunden", obwohl die Liste die Teilvorhaben (TVs) korrekt anzeigte. Ursache:
der `verbuende`-Object-Store (ein **abgeleiteter Aggregat-Cache** der Anträge, gruppiert nach
`verbund_id`) war leer, und der version-/hash-idempotente Snapshot-Sync lud ihn nicht nach (leere/
veraltete `verbuende.jsonl` auf dem Share **oder** ein durch einen transienten Read-Fail gestrandeter
lokaler Store). Die Anträge selbst (Source of Truth) waren da — nur der Cache fehlte.

- **Detailseite degradiert sauber** ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)):
  fehlt der Cache-Record, sind aber die TVs da, baut die View den Verbund-Header aus den TVs
  (neuer Helfer `buildVerbundFromTeilantraege`, [pseudoVerbund.ts](src/plugins/antraege/pseudoVerbund.ts))
  statt „nicht gefunden". Status/Akronym/Titel haben die Lead-TV-Fallbacks ohnehin.
- **Cache heilt sich selbst** (neuer Service `healMissingVerbuende`,
  [verbuende-rebuild.ts](src/core/services/csv/verbuende-rebuild.ts)): beim Start-Datenupdate
  ([data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts)) werden fehlende
  Verbund-Records aus der Slim-List-View rekonstruiert — **unabhängig** von `r.synced`, weil der leere
  Cache gerade beim idempotent übersprungenen Sync bestehen bleibt. Billig, wenn der Cache da ist
  (nur ein `verbuende`-Index-Read); vorhandene (kuratierte) Records bleiben unangetastet.
- **Stranding verhindert** ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts)): `SYNC_VERSION`
  wird nicht mehr festgeschrieben, wenn ein Store wegen Read-/Parse-Fehler nicht integriert werden
  konnte → der nächste Sync lädt den fehlenden Store nach, statt ihn idempotent dauerhaft zu überspringen.
- Sichtbar in **allen** Varianten (Förderanträge ist überall vorhanden). Tests:
  [verbuende-rebuild.test.ts](src/core/services/csv/__tests__/verbuende-rebuild.test.ts) +
  [pseudoVerbund.test.ts](src/plugins/antraege/__tests__/pseudoVerbund.test.ts).

### v2.103.0 — DSGVO-Transport-Policy: dokument-tragende KI-Läufe code-seitig intern erzwungen (Juni 2026)

MINOR-Bump — eine zentrale, **fail-safe** Transport-Policy zieht die harte Regel **„Dokumentinhalte nie an externe APIs"** aus dem reinen Build-Flag in den Code: dokument-tragende Läufe (Generierung **und** LLM-QS, Batch, Metadaten-Extraktion) können nicht mehr auf einem externen Transport landen. **Ehrliche Einordnung:** ändert das **Prod-Verhalten nicht** (OpenRouter dort via `isOpenRouterEnabled()` ohnehin aus) — der Wert ist **Defense-in-Depth** (zweite Verteidigungslinie unterhalb des Build-Flags, mit Convention-Test gegen Regression) und schaltet später einen In-App-Judge über reale Daten (intern-only) frei. **Additiv**, kein Schema-Bump.

- **Resolver** ([transport-policy.ts](src/core/services/ai/transport-policy.ts)): reine Funktionen `classifyProvider({type,endpoint})` → `intern`/`extern` (OpenRouter per Typ **oder** Endpoint-Heuristik), `erlaubteTransportKlassen({enthaeltDokumentInhalte})`, `skillEnthaeltDokumentInhalte(skill)` mit **Ableitung schlägt Flag** (referenziert das Template einen Inhalts-Slot `{{vbMarkdown}}`/`{{stammdaten}}`/**`{{zielText}}`**/`{{vorherigeAbschnitte}}`, ist der Skill intern-pflichtig — egal was der explizite Flag sagt; fehlt der Slot, fail-safe Default `true`). `SkillRecord.enthaeltDokumentInhalte?` additiv + tolerant normalisiert ([types.ts](src/core/services/skills/registry/types.ts), [storage.ts](src/core/services/skills/registry/storage.ts)).
- **Bridge** ([bridge.ts](src/core/services/ai/bridge.ts)): führt die aktive Klasse (`switchProvider` → `classifyProvider`), `getActiveKlasse()`; die gegatete Wahl `getTransportForSkillRun(skill)` **wirft** einen klaren DSGVO-Fehler statt Inhalt extern zu senden, wenn der aktive Provider extern und der Skill inhalts-tragend ist. `pingActive()` kapselt den reinen Verfügbarkeitscheck (trägt keinen Inhalt).
- **Aufrufstellen gegatet**: `runGeneration` + `runQs` ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)) und die Batch-Generierung ([useBatchJob.ts](src/plugins/antraege/gutachten-batch/useBatchJob.ts)) ziehen den Transport über `getTransportForSkillRun`; `.ping()`-Checks bleiben roh/`pingActive()`. Sekundär: die Metadaten-Extraktion ([metadata-extractor.ts](src/core/services/search/metadata-extractor.ts)) klassifiziert ihren eigenen `DirectLLMTransport`-Endpoint und fällt bei extern auf `FALLBACK_METADATA` zurück (kein Bridge-Refactoring; Prod unverändert).
- **Erzwingung gegen Regression**: Convention-Test `no-raw-active-transport` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts), **Pitfall #30**) verbietet rohes `getActiveTransport()` in der Gutachten-/Batch-Domäne (außer `.ping()`-Zeilen); Inline-Ausnahme `// allow-raw-active-transport: <grund>`.
- **Editor-Sichtbarkeit** ([SkillEditor.tsx](src/plugins/skill-verwaltung-kuration/SkillEditor.tsx)): abgeleitete Klassifizierung als Badge („Dokumentinhalte → nur intern" / „inhaltsfrei → extern möglich") + Kurator-Override (`enthaeltDokumentInhalte`), der **wirkungslos** ist, wenn ein Inhalts-Slot intern erzwingt (Checkbox disabled + Hinweis). Doku: [docs/architecture/transport-policy.md](docs/architecture/transport-policy.md). Dev-Eval-Harness (`src/core/services/skill-eval/`) bewusst **ausgenommen** (eigene Fiktiv-Daten-Policy). Tests: Resolver/Ableitung + Bridge-Gating (Mock-Bridge) + Convention-Test.

### v2.102.0 — Gutachten-Workflow: KI-Qualitäts-Check (beratend) + beschränkter Auto-Retry (Juni 2026)

MINOR-Bump — zwei optionale, komponierbare Erweiterungen des kuratierbaren Gutachten-Workflows (beide **additiv**, kein Schema-Bump; sie ergänzen die deterministischen Checks, ersetzen sie nicht). Ohne LLM degradiert alles sauber; der Bearbeiter-Text wird **nie** automatisch überschrieben.

- **LLM-QS-Schritt** (`rolle: 'llm_qs'`): ein nachgeschalteter Schritt bewertet einen Generierungs-Abschnitt **qualitativ + beratend** (Dimensionen Erdung in der VB / Kohärenz / Vollständigkeit / Ton) über **denselben internen Transport** wie die Generierung — markierter `###`-Freitext (kein erzwungenes JSON), tolerant geparst (`parseQsBefunde`, kein Throw → `'unklar'`). Datenmodell: `WorkflowStep.rolle`/`qsZielStepId` ([registry/types.ts](src/core/services/skills/registry/types.ts)), `StepRun.qsHinweise` ([gutachten/types.ts](src/plugins/antraege/gutachten/types.ts)), reiner Reducer `applyQsHinweise` ([runner.ts](src/plugins/antraege/gutachten/runner.ts)), Seed-Skill `qs-basis` via `mergeMissingSeeds` ([seed.ts](src/core/services/skills/registry/seed.ts)), zwei optionale Prompt-Slots `{{zielText}}`/`{{abschnittszweck}}` in der EINEN Kompositionsstelle ([run-skill.ts](src/core/services/skills/run/run-skill.ts), byte-identisch für Bestands-Skills). Auslösung manuell per **„KI-QS prüfen"** auf der Abschnittskarte; Befunde in einem eigenen Block **„KI-Qualitätshinweis (beratend)"** getrennt von den Checks ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx) + [QsHinweisList.tsx](src/plugins/antraege/gutachten/QsHinweisList.tsx)). `llm_qs`-Schritte sind reine Konfiguration und aus der Generierungs-Schrittfolge der Laufzeit gefiltert.
- **Beschränkter Auto-Retry** (`autoRetry`/`maxRetries`, opt-in pro Generierungs-Schritt): generieren → prüfen → bei `fehler` und Versuch < N automatisch mit passendem Modifier neu generieren, sonst STOPP + neutraler Vermerk. Harte Decke N (`[0..3]`, Default 2); **kein** offener Loop, **keine** LLM-Entscheidung über den Ablauf, Transport weg ⇒ sofort STOPP. Richtungssignal aus der Check-Engine (`CheckResult.richtung` `'zu_lang'`/`'zu_kurz'`) → reine `chooseRetryModifier` ([retry-policy.ts](src/plugins/antraege/gutachten/retry-policy.ts), getrennt von der State-Machine in `runner.ts`); Orchestrator-Loop mit Zähler im Hook ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)).
- **Kurations-UI** ([WorkflowEditor.tsx](src/plugins/skill-verwaltung-kuration/WorkflowEditor.tsx) + [WorkflowsTab.tsx](src/plugins/skill-verwaltung-kuration/WorkflowsTab.tsx)): Rolle-Auswahl, `qsZielStepId`-Dropdown (nur Generierungs-Schritte), Auto-Retry-Toggle + `maxRetries`; KI-QS-/Auto-Retry-Badges in der Schritt-Liste. Normalisierung beim Speichern über `normalizeStepRolle` (eine Quelle). QS-Ausprägungen über die zugeordneten Regeln/Dimensionen des `qs-basis`-Skills (kein neues Vererbungssystem). Sichtbar im **kurator**-Build; Laufzeit hinter `gutachtenKurzfassung` (dev). Tests: Normalisierung/Klemmung, `richtung`, QS-Parser, Reducer, `chooseRetryModifier` + Loop-Terminierung.

### v2.101.0 — Kuratierbarer Gutachten-Workflow (Schritte als Daten statt Code) (Juni 2026)

MINOR-Bump — der bisher **hart verdrahtete** ZIM-EP-Gutachten-Workflow (Abschnitte A–G) ist jetzt **kuratierbare Daten** in der Skill-Registry. In der **Skill-Verwaltung** (kurator) gibt es einen dritten Tab **„Workflows"**: Schritte per Drag-Drop (oder ▲▼) umsortieren, Skill-Zuordnung + Anwendbarkeits-Gate pro Schritt editieren und einen Schritt in **genau eine** Unterschritt-Ebene (5 → 5a/5b) zerlegen. Die deterministische Laufzeit (State-Machine, Checks) bleibt unverändert; sie liest die Schritte aus der aktiven `WorkflowDef` statt aus einer Konstante. Verhalten für `zim-ep` ist byte-identisch zur alten Hartverdrahtung (per Cross-Layer-Test abgesichert).

- **Datenmodell** ([registry/types.ts](src/core/services/skills/registry/types.ts)): additiv `GateExpr` / `WorkflowStep` / `WorkflowDef` + `SkillRegistryFile.workflows?`; toleranter `normalizeWorkflowDef` (Defaults, `parentStepId`-Tiefe > 1 → Top-Level geklemmt) + additiver Seed-Merge ([storage.ts](src/core/services/skills/registry/storage.ts)). Seed `ZIM_EP_DEF` (id `zim-ep`) spiegelt A–G ([seed.ts](src/core/services/skills/registry/seed.ts)). Reiner `evalGate`-Resolver (kein `eval()`/Funktionsstrings).
- **Laufzeit datengetrieben**: `StepId` von der geschlossenen A–G-Union auf offenes `string` geweitet (kein Schema-Bump, Keys A–G bleiben gültig — Pitfall #29); Runner/Batch/Kontext nehmen die geordnete Schrittliste als Parameter; neuer Adapter [resolveActiveWorkflow](src/plugins/antraege/gutachten/active-workflow.ts) (Fallback Seed, topologische Flachklappung der einen Unterschritt-Ebene). Stepper/Review-Section/Batch rendern aus der aktiven Def.
- **Kurations-UI** ([WorkflowsTab](src/plugins/skill-verwaltung-kuration/WorkflowsTab.tsx) + [WorkflowEditor](src/plugins/skill-verwaltung-kuration/WorkflowEditor.tsx)): kanonisches `MasterDetailLayout`/`ListItem`, native HTML5-DnD-Reorder + Hoch/Runter-Fallback (keine neue Dependency); reine Helfer `reorderSteps` / `computeStepNumbers` / `flattenStepsTopological` mit Tests. Persistenz self-gated über `writeSkillRegistry`, Version-Bump pro Speichern.
- **DOCX-Export** überspringt Schritte ohne gültigen Anker (`ankerKeyGueltig`); die `AbschnittId`-Anker-Union bleibt geschlossen. Sichtbar im **kurator**-Build (Workflows-Tab nach Kurator-Login); Laufzeit-Workflow im dev-Build hinter `gutachtenWorkflow`.

### v2.100.0 — Changelog-Modal: Filter nach Kategorie (Neu & geändert / Bugfixes) (Juni 2026)

MINOR-Bump — das Nutzer-Changelog-Modal (Klick auf die Versionsnummer) hat jetzt oben einen **Kategorie-Filter**: „Alle" / „Neu & Verbesserungen" / „Bugfixes" (je mit Anzahl). Nutzer sehen damit gezielt nur neue/geänderte Funktionen **oder** nur Fehlerbehebungen. Jede Änderung wird kategorisiert und je Version unter dem passenden Abschnitt gruppiert; leere Versionen/Kategorien werden im aktiven Filter ausgeblendet.

- **Kategorisierung** ([deriveChangelog.ts](src/core/components/changelog/deriveChangelog.ts)): aus CHANGELOG.md abgeleitete Einträge werden per Bump-Typ (MINOR/MAJOR → Feature, PATCH → Bugfix) plus Keyword-Override (`neu`/`hinzugefügt` ↔ `fix`/`bug`/`behoben`/`crash` …) in `### Neu & Verbesserungen` / `### Fehlerbehebungen` gebündelt. Die geglättete [changelog-user.md](src/core/components/changelog/changelog-user.md) liefert die Kategorie exakt über ihre `### Neu`/`### Bugfixes`-Untersektionen — eine Parser-Pipeline für beide Quellen.
- **UI** ([ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx)): klebender Filter-Balken am oberen Modal-Rand, Kategorie-Badges (`success`/`warning`), Inline-Markdown je Änderung. Tests erweitert ([deriveChangelog.test.ts](src/core/components/changelog/__tests__/deriveChangelog.test.ts)).

### v2.99.1 — Dev-Fixtures lösen kein CSV-Auto-Update mehr aus (Juni 2026)

PATCH-Bump — Bugfix, nur im dev-Build sichtbar. Die eingebauten Dev-Seed-Fixtures (`docs/fixtures/schema-*.ts`, IDs `fixture-real-anb/-bgl/-prjbsp`) wurden vom Auto-Refresh-Check fälschlich per Header-Match (`resolveFileViaDir`) an eine zufällig passende **echte** Share-CSV gekoppelt (z.B. die 65-MB-`9052_PrjBsp_AitisiGPT.csv`) und im „CSV Daten aktualisieren"-Dialog angeboten — wer importierte, überschrieb das 14-Zeilen-Sample mit ~42k Echt-Zeilen parallel zur echten Quelle.

- **Fix**: neues Prädikat `isFixtureSchemaId()` ([fixture-ids.ts](src/core/services/seed/fixture-ids.ts), Präfix `fixture-real-`); `checkSourceForUpdate()` ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts)) gibt für Fixture-Schemas früh den neuen Status `local_fixture` zurück → kein „neue CSV vom …"-Badge ([CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx)), deaktivierter Update-Button (erklärender Tooltip), keine Banner-Kandidatur (`collectCandidates` ignoriert den Status). Manuelles „CSV neu wählen" + „Demo-Seeds entfernen" bleiben unberührt.
- **Scope**: reiner dev-Effekt — prod/pl/kurator bundeln keine Fixtures (`demoDataBundled: false`), dort 0 Verhaltensänderung. Test: [fixture-ids.test.ts](src/core/services/seed/__tests__/fixture-ids.test.ts).

### v2.99.0 — Changelog-Modal: Klick auf die Versionsnummer zeigt „Was ist neu?" (Juni 2026)

MINOR-Bump — die Versionsnummer unten in der Sidebar ([BuildInfo.tsx](src/core/components/BuildInfo.tsx)) ist jetzt klickbar und öffnet ein zentriertes Modal mit einem nutzerfreundlichen Changelog: gruppiert nach Hauptnummer (Major) als ausklappbare Über-Überschrift (aktuelle Major auf, frühere zu), darunter die Minor-Versionen `x.yy` als ausklappbare Abschnitte mit Änderungen/Bugfixes. Patch-Versionen `x.yy.zz` werden unter ihrer Minor zusammengefasst (nicht einzeln gelistet); neueste oben.

- **Inhalt** ([deriveChangelog.ts](src/core/components/changelog/deriveChangelog.ts)): standardmäßig automatisch aus dieser CHANGELOG.md (+ [Archiv](docs/CHANGELOG-ARCHIV.md)) abgeleitet — Datei-Links/Datums-Klammern entfernt, pro Minor aggregiert, auf die aktuelle Hauptnummer gefiltert. Eine committed [changelog-user.md](src/core/components/changelog/changelog-user.md) (geglättete Fassung) hat Vorrang, sobald sie `## vX.Y`-Abschnitte enthält.
- **Rendering** ([ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx)): `Dialog` (Höhen-Cap + interner Scroll, `no-raw-modal`-konform) + geschachtelte `Collapsible` + `MarkdownRenderer`. Markdown-Quellen via `?raw` zur Build-Zeit inlined (file://-tauglich, Pitfall #1/#2).
- **Dev-Werkzeug** „Mit KI glätten" ([ChangelogPolishPanel.tsx](src/core/components/changelog/ChangelogPolishPanel.tsx), nur `isDevContext()`): schreibt den abgeleiteten Text per interner KI in nutzerfreundliche Sprache um und speichert das Ergebnis via File System Access API zurück nach `changelog-user.md` (danach committen → prod sieht den geglätteten Text). Async-Handler über `useAsyncAction` (Pitfall #15).
- Sichtbar in **allen** Varianten (kein Feature-Flag); Glätten-Button nur im dev-Build. Tests: [deriveChangelog.test.ts](src/core/components/changelog/__tests__/deriveChangelog.test.ts).

### v2.98.3 — Start-Daten-Update: Fortschritts-Banner statt Spinner-Toast (Juni 2026)

PATCH-Bump — rein visuell, keine Verhaltensänderung. Der laufende Fortschritt der Start-Datenaktualisierung (`runDataUpdate`) erscheint nicht mehr als Spinner-Toast oben rechts, sondern als **vollbreite Banner-Zeile am oberen Rand des Inhalts** mit Phasen-Label + determiniertem Fortschrittsbalken + Prozent — gleiche visuelle Sprache wie der [CsvAutoRefreshBanner](src/plugins/csv-sources-kuration/components/CsvAutoRefreshBanner.tsx).

- Neue Komponente [StartupDataUpdateBanner](src/core/components/StartupDataUpdateBanner.tsx), im [ShellLayout](src/core/ShellLayout.tsx) neben den anderen Bannern gemountet (`isDataShareEnabled()`). Liest den Fortschritt aus dem erweiterten Koordinations-Store [useStartupDataStatus](src/core/services/csv/startup-data-status.ts) (`progress`-Slice, per Selektor → der Snapshot-Watcher re-rendert nicht mit).
- [App.tsx](src/core/App.tsx): `onPhase` schreibt die `fraction` jetzt **gedrosselt** (nur bei Label- oder Prozent-Wechsel) in den Store statt sie zu verwerfen; `syncBusy`/Spinner-`<span>` entfernt. Der Completion-Toast („…aktualisiert (Stand: …)") bleibt unverändert oben rechts.

### v2.98.2 — Frühwarnung bei CSV-Format-Drift (Juni 2026)

PATCH-Bump — [importer.ts](src/core/services/csv/importer.ts): wenn ein Import **> 80 %** aller Zeilen als „geändert" erkennt (und > 200 Zeilen), `console.warn` + Audit `csv_import_format_drift_warning`. So fällt sofort auf, wenn sich nicht der Inhalt, sondern das **Export-Format** geändert hat (Encoding, Zahlen-/Datumsformat — z.B. ein Excel-Roundtrip), statt nur einen langsamen Lauf zu bemerken. Reine Diagnose, keine Verhaltensänderung.

### v2.98.1 — Delta-Write: Voll-Write-Fallback bei großem Change-Set (Juni 2026)

PATCH-Bump — Messung (dev, strukturell abweichender Export → touched ≈ alle 14k): der Delta-Write war mit `snapshotWrite=30,7 s` **langsamer** als ein Voll-Write, weil `getAntraegeByKeys(14k)` (Einzel-Gets) + ein Delta ≈ volle Datei teurer sind als der gestreamte Cursor-Voll-Write. [snapshot.ts](src/core/services/csv/snapshot.ts) `writeProgrammSnapshotDelta` macht jetzt eine **Compaction (Voll-v2-Basis)**, wenn das Change-Set groß ist (> 50 % der Basis UND absolut > `DELTA_FULL_FALLBACK_MIN`=2000) — kleine Programme bleiben immer Delta. Verhindert den „Delta langsamer als Voll"-Pathologiefall; ändert nichts am Normalfall (kleine Tages-Deltas).

> Hinweis: Der dominante Posten in dem Lauf war der **Merge (67 s)**, nicht der Snapshot-Write — Folge des `touched≈alle` (Export weicht strukturell von der Baseline ab, alle Row-Hashes ändern sich). Delta hilft dort nicht; das adressiert Phase B (ein Merge pro Batch) bzw. eine stabilere Row-Hash-Basis (Prod-Export-Stabilität).

### v2.98.0 — Delta-Snapshots: Schreiber aktiv (Phase D, pl + kurator) (Juni 2026)

MINOR-Bump — **Delta-Snapshot-Rollout Phase 2: der Schreiber.** pl/kurator publizieren beim CSV-Import jetzt nur noch die **geänderten** `antraege`-Records (`antraege.delta.<seq>.jsonl`) statt der vollen `antraege.jsonl`. Spart dem Writer den ~25-s-Voll-Write (Messung) **und** jedem der 30 Konsumenten den täglichen Voll-Download — beide laden/schreiben nur das Tages-Delta (~hunderte statt 14k Records). Aktiviert, weil aktuell nur 2 PL-User aktiv sind (Delta-Leser v2.97 ist Voraussetzung; mixed-version-Risiko hier vernachlässigbar).

- **Delta-Schreiber** ([snapshot.ts](src/core/services/csv/snapshot.ts) `writeProgrammSnapshotDelta`): lädt nur die geänderten Records keyed (`getAntraegeByKeys`, kein 14k-Cursor), schreibt `antraege.delta.<seq>.jsonl` + Manifest. Kleine Stores (verbuende/akronym/schemas/…) bleiben voll (klein); die `antraege`-Basis bleibt unangetastet. **Compaction**: ohne v2-Manifest / nach `MAX_DELTAS`(14) → voller v2-Basis-Write (`writeProgrammSnapshot({emitDeltaBase})`), alte Delta-Dateien werden gelöscht. Lokale Cursor + Record-Hash-Map werden nachgezogen (Writer re-sync't sein eigenes Delta nicht).
- **Verdrahtung**: [importer.ts](src/core/services/csv/importer.ts) reicht `runMergeForDeltas`→`{touchedAz,removedAz}` als `changedAktenzeichen`/`removedAktenzeichen` hoch; [auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts) sammelt die Vereinigung je Programm und schreibt EIN Delta pro Batch. Gated über `isDeltaSnapshotWriteEnabled()` ([feature-flags.ts](src/config/feature-flags.ts)) — Flag `deltaSnapshotWrite` (pl/kurator/dev true, prod false; default false → Tests/dev-Server unverändert auf v1).
- **Keyed Multi-Get** `getAntraegeByKeys` ([idb-csv.ts](src/core/services/csv/idb-csv.ts)).
- Tests: [snapshot-delta-roundtrip.test.ts](src/core/services/csv/__tests__/snapshot-delta-roundtrip.test.ts) — Schreiber→Leser identischer Stand (Basis+2 Deltas), Bootstrap-Voll-Write auf leerem Share, Teil-Konsument holt nur das neue Delta. Byte-Identität (gleiche `JSON.stringify`) hält die Record-Hash-Map konsistent.

### v2.97.0 — Delta-Snapshots: Leser (Phase C, 2-Phasen-Rollout) (Juni 2026)

MINOR-Bump — **Delta-Snapshot-Rollout Phase 1: der Leser.** Vorbereitung darauf, dass künftig nur noch geänderte `antraege`-Records publiziert/geladen werden (statt täglich die volle `antraege.jsonl` × 30 Konsumenten). Additiv + rückwärtskompatibel; der **Schreiber** (Phase D) bleibt vorerst aus → in Produktion ändert sich noch nichts, außer dass die App ein v2-Manifest *lesen* kann.

- **Manifest v2** ([snapshot.ts](src/core/services/csv/snapshot.ts)): optionaler `delta`-Block (`baseVersion`, `deltaStores`, geordnete `deltas[]` mit `changedFile`/`removedKeys`/`hash`). Der v1-`stores`-Block bleibt erhalten (Hash = **Basis**-Datei) → alte Leser bekommen stets eine valide Basis.
- **Delta-Leser** ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts) `syncAntraegeViaDelta`): bei v2 + `delta` für `antraege` lädt der Konsument die **Voll-Basis nur** bei Generation-Wechsel (Compaction)/Cold-Start/Seq-Lücke, sonst nur die noch nicht angewandten `antraege.delta.<seq>.jsonl`. Anwendung über `applyAntraegeDiff`/`applyListViewDiff` (wiederverwendet). Neue Cursor `SYNC_DELTA_SEQ_KEY` + `SYNC_BASE_VERSION_KEY` ([snapshot-keys.ts](src/core/services/csv/snapshot-keys.ts)); Crash-sicher (Hash-Map vor Seq persistiert). v1-Manifest → unveränderter Pfad.
- Tests: [snapshot-delta-reader.test.ts](src/core/services/csv/__tests__/snapshot-delta-reader.test.ts) — Kalt-Konsument (Basis+2 Deltas), Teil-Konsument (nur fehlendes Delta, ohne Basis-Read), Idempotenz.
- **Rollout:** diesen Build (Leser) erst flächig ausrollen (zentrale HTML, ~1 Tag bis alle neu geladen haben), dann Phase D (Delta-Schreiber-Flag in pl/kurator). So liest jeder Client Deltas, bevor einer welche schreibt.

### v2.96.4 — Konsumenten laden csv_row_hashes nicht mehr (Juni 2026)

PATCH-Bump — erster Schritt der Skalierungs-Roadmap (30 prod + 8 Writer). `csv_row_hashes` (~14k+ Zeilen) wird **nur von Writer-Builds** gebraucht (CSV-Import-Diff in [importer.ts](src/core/services/csv/importer.ts); sonst nur Kurator-Delete-Cascade + dev-Seed) — read-only prod-Konsumenten lesen es **nie** zurück, luden es aber bei jedem neuen Snapshot voll mit.

- [snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts): überspringt `csv_row_hashes.jsonl` im Store-Loop, wenn `!isDatenShareWritable()` (prod). Writer (pl/kurator/dev, `datenShareSchreibrecht`) laden es unverändert.
- Effekt: 30 Konsumenten sparen den täglichen `csv_row_hashes`-Download. Eigenständiger, risikoarmer Schritt vor dem Delta-Snapshot-Projekt (das den großen `antraege`-Download adressiert).

### v2.96.3 — CSV-Auto-Import: lokale Daten sofort nach dem Merge zeigen (Juni 2026)

PATCH-Bump — gefühlte Start-Zeit gesenkt, ohne Architektur-Umbau. Bisher aktualisierte der Orchestrator den In-Memory-Store erst **nach** dem ~24-s-Snapshot-Publish → der lokale User sah die neuen Anträge erst am Ende (~58 s), obwohl sie nach dem Merge (~34 s) längst in der IDB standen; der Publish ist nur für die anderen Rechner nötig.

- **`runAutoRefresh.onAfterMerge(programmIds)`** ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)): wird nach allen Merges, **vor** dem gebündelten Snapshot-Write aufgerufen. Orchestrator ([data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts)) und Banner-Hook ([useCsvAutoRefreshCheck.ts](src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts)) laden dort den Antraege-Store je betroffenem Programm neu (`refreshAntraegeStoreAfterSync`) — Liste/Home zeigen die neuen Daten sofort.
- **Ehrliches Publish-Label**: neue Phase `'publishing'` ([App.tsx](src/core/App.tsx)-Toast: „Daten lokal aktuell — Datenbestand wird für das Team veröffentlicht…"; Banner [CsvAutoRefreshBanner.tsx](src/plugins/csv-sources-kuration/components/CsvAutoRefreshBanner.tsx): „veröffentliche"). Der Publish bleibt **awaited** (zuverlässig, kein „Daten bleiben lokal hängen"-Risiko bei Tab-Close) — der Spinner läuft bis zum Ende, aber die eigenen Daten sind schon sichtbar.
- Backward-compat-sicher: kein Snapshot-Format-Touch. (Delta-Snapshots wurden evaluiert + zurückgestellt — Backward-Compat-Rollout nötig + fixt den wachsenden Merge nicht.)

### v2.96.2 — CSV-Auto-Import: Snapshot nur einmal pro Batch schreiben (Juni 2026)

PATCH-Bump — messwert-getriebene Beschleunigung des CSV-Import-Pfads. Messung (dev, 3 Quellen importiert): `[data-update] total=170 s` — davon **snapshotWrite 76,7 s (45 %)** + merge 61,7 s (36 %). Der Snapshot-Write ist **touched-unabhängig** (schreibt immer alle ~14k Records + SHA-256, ~25 s/Stück) — und bei N Quellen schrieb bisher **jeder** `importCsvSource` einen eigenen vollen Snapshot.

- **Gebündelter Snapshot-Write** ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)): `importCsvSource` bekommt `deferSnapshotWrite` ([importer.ts](src/core/services/csv/importer.ts)) und überspringt das Publizieren; `runAutoRefresh` schreibt den Snapshot **einmal pro betroffenem Programm** nach dem Batch — unter Build-Lock + Heartbeat. Spart bei 3 Quellen 2 von 3 Voll-Writes (hier ~51 s). **Prod-relevant**, weil der Write übers Netzlaufwerk geht und unabhängig von der Zeilenzahl anfällt.
- Der lokale Merge-/Hash-Stand wird unverändert pro Quelle voll berechnet; nur das Schreiben auf den Share ist gebündelt. `source_last_modified` jeder Quelle ist vor dem Batch-Write gestempelt → der eine Snapshot trägt alle aktuellen Stände.
- Hinweis zum dev-Messwert: `merge 61,7 s` (touched=alle 14k) entsteht, weil die dev-CSVs nicht zur Snapshot-Baseline passen (Voll-Re-Merge). Auf prod fasst ein Import nur die wirklich geänderten Zeilen an → Merge bricht ein; der gebündelte Snapshot-Write bleibt der dominante, jetzt halbierte Posten.

### v2.96.1 — Start-Update: CSV-Banner-Race + Fortschritts-Spinner (Juni 2026)

PATCH-Bump — zwei UX-Korrekturen am Start-Datenupdate.

**CSV-Banner nicht parallel zum Auto-Import** (Folgefix zu v2.95.1): Nachdem der CSV-Ordner verknüpft ist, importiert der Start-Orchestrator neue Export-CSVs automatisch (Toast „CSV-Import: …"). Der CSV-Auto-Refresh-Banner („X CSV-Quellen haben neue Daten — Jetzt aktualisieren") erschien dabei **parallel**, weil [useCsvAutoRefreshCheck](src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts) dieselben Kandidaten unabhängig erkannte (v2.95.1 hatte nur den Snapshot-Watcher koordiniert). Beide Check-Effekte sind jetzt auf `startup-data-status === 'done'` gegated. Während der Start-Pass läuft → kein Banner; danach Re-Check → nur was wirklich übrig ist (unverknüpfte Quellen / Drift); importierte Quellen sind `up_to_date` → Banner verschwindet.

**Toast-Spinner + Fortschritts-Zähler** ([App.tsx](src/core/App.tsx)): Der Sync-Toast zeigte den aktuellen Schritt nur als statischen Text (📥) — ohne Bewegung war nicht erkennbar, ob der (je Quelle Sekunden dauernde) Import noch läuft. Jetzt rotiert ein Spinner, solange der Pass aktiv ist (`syncBusy`); bei Abschluss erscheint wieder 📥 + Stand. Der CSV-Import-Schritt zeigt zusätzlich den Quellen-Zähler („CSV-Import: <Quelle> (2/3)…", [data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts)).

### v2.96.0 — Start-Update Schritt 2: inkrementeller antraege-Sync (Juni 2026)

MINOR-Bump — **messwert-getriebene Beschleunigung** des Start-Datenbestand-Syncs. Messung (v2.95, pl, ~14k Anträge, neuer Snapshot): **37,3 s** gesamt, davon **idbWrite 18,3 s (49 %)**, SMB-read 11,6 s (31 %), listView 5,0 s (13 %), parse 2,1 s. Die DB-Integration dominiert — und ein neuer Snapshot ändert typischerweise nur wenige Records.

- **Inkrementeller ANTRAEGE-Sync** ([incremental-antraege.ts](src/core/services/csv/incremental-antraege.ts)): statt `clear` + Rewrite aller ~14k Records vergleicht der Sync die rohen JSONL-Zeilen gegen eine lokale Per-Record-Hash-Map (`murmurhash3` je Zeile, kv-Key `snapshot-record-hashes-<programmId>`) und schreibt **nur geänderte** Records + löscht entfernte ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts)). Korrektheits-Invariante: schreibt nie zu wenig (Hash-Abweichung ⇒ Schreibung); externe Writes (Merger) machen die Map veraltet → selbstheilender Re-Write beim nächsten Sync, kein übersprungener Write. Cold-Start / keine Map → Voll-`replaceStore` + Map-Aufbau (Fallback).
- **Inkrementelle List-View**: nur geänderte Records werden projiziert + entfernte gelöscht (statt 14k-Voll-Reprojektion), sofern die Projektion auf aktueller Schema-Version liegt (`isListViewProjectionCurrent`) — sonst Voll-Rebuild.
- Erwartung auf „neuer Snapshot, wenige Änderungen"-Tagen: idbWrite + listView brechen ein → **SMB-read (~12 s) wird der neue Boden** (weiter senkbar nur über Delta-Snapshots auf dem Share = separates größeres Vorhaben). Log `[snapshot-sync] antraege inkrementell: changed/removed/unchanged` zeigt den Effekt.
- **Rollout**: bestehende Installationen haben noch keine Hash-Map → der **erste** neue Snapshot nach dem Update läuft einmalig als Voll-Replace (baut die Map), ab dem zweiten inkrementell. Auch speicherschonender (kein 14k-Voll-Parse im RAM; vgl. OOM-Klasse v2.61.5). Tests: [incremental-antraege.test.ts](src/core/services/csv/__tests__/incremental-antraege.test.ts).

### v2.95.1 — Start-Update: Banner + Toast erschienen gleichzeitig (Juni 2026)

PATCH-Bump — beim Start zeigten der Snapshot-Watcher-Banner („Neuer Datenbestand … — Jetzt laden") UND der Fortschritts-Toast („Datenbestand wird aktualisiert…") **gleichzeitig** denselben neuen Snapshot an: der Start-Orchestrator lädt ihn automatisch, der Watcher detektierte dieselbe Versions-Differenz unabhängig (Race: Watcher-Initial-Check vor Abschluss des Start-Sync).

- Neuer Phasen-Store [startup-data-status.ts](src/core/services/csv/startup-data-status.ts) (`idle`/`running`/`done`): [App.tsx](src/core/App.tsx) setzt `running` beim Start-Pass, `done` im finally.
- [useSnapshotWatcher](src/core/hooks/useSnapshotWatcher.ts) unterdrückt seinen Banner solange `phase !== 'done'` und prüft beim Übergang auf `done` einmal nach. Nach Abschluss gleicht der Orchestrator den lokalen Stand an → kein Banner; kam der Start-Sync nicht durch, erscheint der Banner als **Recovery**. Der Banner bleibt für **mid-session** geschriebene Fremd-Snapshots erhalten.

### v2.95.0 — Start-Datenaktualisierung: ein orchestrierter Pfad + Per-Phasen-Timing (Juni 2026)

MINOR-Bump — **Datenbestand- und CSV-Aktualisierung beim Start zu EINEM sequenzierten, messbaren Pfad zusammengeführt** (pl + kurator). Schritt 1 von 2: Instrumentieren + Konsolidieren jetzt, messwert-getriebene Speed-ups danach.

- **Neuer Orchestrator `runDataUpdate`** ([data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts)): sequenziert in der gewünschten Reihenfolge **Datenbestand (Snapshot je Programm) → Export-CSV (Check + Auto-Import)**. Die beiden schweren Primitive (`syncProgrammSnapshot`, `runAutoRefresh`) bleiben unverändert und werden nur komponiert. In-Flight-Guard verhindert Überlappung von Start-Sync/Button. Build-Lock-Konflikt beim CSV-Import → kein Crash, `lockBusy` gesetzt (paralleler Schreiber gewinnt).
- **CSV-Import läuft jetzt automatisch beim Start** (pl + kurator, gleiche Gate wie der Banner; prod unverändert nur Snapshot-Sync). Vorher hinter Banner-Klick. Snapshot-Check pro Start statt 1×/Tag (`force: true`; Manifest-Read ~1 KB, Store-Load bleibt version-gated). [App.tsx](src/core/App.tsx) idle-deferred + non-blocking wie bisher, Toast zeigt Phasen-Fortschritt.
- **Per-Phasen-Timing** ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts) `SyncResult.timings`, [importer.ts](src/core/services/csv/importer.ts) `ImportResult.importTimings`): trennt **SMB-Netzwerk-I/O** (manifestRead/smbRead/snapshotWrite) von **Parse** und **IDB-Integration** (idbWrite/listViewRebuild/merge). Always-on `[data-update]`-Konsolenzeile + letzter Breakdown in `localStorage['teamflow_last_data_update_timing']` — Basis für Schritt 2.
- **tfPerf in pl/kurator aktivierbar** ([tfPerf.ts](src/core/utils/tfPerf.ts)): `localStorage.teamflow_perf='1'` + Reload schaltet die `[tf-perf]`-Marker auch im production-`file://`-Build ein (Dev-Server hat kein SMB-Onboarding).
- **`collectCandidates` aus dem Hook in den Service extrahiert** ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)) — Hook + Orchestrator nutzen denselben React-freien Pfad. Manueller Button **„Jetzt aktualisieren"** im Speicher-Tab ([SpeicherTab.tsx](src/plugins/einstellungen/SpeicherTab.tsx)) ruft denselben Orchestrator.
- Bewusst unverändert: `useSnapshotWatcher.applyNow` (behält den v2.21.3-Cold-Start-Guard; nutzt das geteilte `syncProgrammSnapshot`-Primitiv). Such-/Embedding-Index ist nicht Teil des Flows.

### v2.94.5 — Chat: „Antragsarchiv Suche" umbenannt + Pille nur bei Aktivierung (Juni 2026)

PATCH-Bump — [Composer.tsx](src/plugins/chat/components/Composer.tsx): „Archiv-Suche" → **„Antragsarchiv Suche"** (Werkzeuge-Menü + Pille). Die Pille in der Eingabebox erscheint jetzt **nur, wenn der Nutzer die Suche aktiviert hat** (`useRAG === true`; Default aus). Footer-Disclaimer ist abhängig vom Status: an → „Antworten basieren auf dem Antragsarchiv und können Fehler enthalten.", aus → „Antworten können Fehler enthalten.".

### v2.94.4 — Chat: Archiv-Suche (RAG) standardmäßig aus (Juni 2026)

PATCH-Bump — Default von `useRAG` in [useChatController.ts](src/plugins/chat/useChatController.ts) auf `false`. Die Archiv-Suche (RAG-Kontext aus dem Antrags-Archiv) ist beim Start aus und per „+"-Werkzeuge-Menü einschaltbar.

### v2.94.3 — Chat: „Archiv-RAG"-Header-Badge + „Archiv-Suche"-Pille entfernt (Juni 2026)

PATCH-Bump — **UI-Entrümpelung im Chat, keine Funktionsänderung.** Der „Archiv-RAG"-Badge neben dem Konversationstitel ([ConversationHeader.tsx](src/plugins/chat/components/ConversationHeader.tsx)) und die sichtbare „Archiv-Suche"-Pille in der Eingabebox ([Composer.tsx](src/plugins/chat/components/Composer.tsx)) sind entfernt. Die RAG-/Archiv-Suche bleibt über das „+"-Werkzeuge-Menü umschaltbar (Default an); ungenutzte `Search`-Import + `vectorReady`-Destrukturierung mitentfernt.

### v2.94.2 — Streamlit-Bridge: Badge + Test-Button in einer Zeile (Juni 2026)

PATCH-Bump — **reine Optik im Bookmarklet** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)): Status-Badge und „ZAH-App testen"-Button sitzen jetzt in einer fixierten Flex-Leiste oben rechts (`display:flex; gap:6px`) statt untereinander.

### v2.94.1 — Streamlit-Bridge: Heading-Anker-Slugs + Listen-Nummerierung gefixt (Juni 2026)

PATCH-Bump — **zwei HTML→Markdown-Korrekturen im Bookmarklet** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)), aufgefallen beim Live-Test gegen AitisiGPT:
- **Heading-Anker leakten als Text** („…(KI)?#was-ist-kuenstliche-intelligenz-ki"): `inlineMd` fiel bei leerem Link-Label auf die `href` zurück → bei Streamlit-Heading-Ankern (`href="#slug"`) wurde der Slug sichtbar. Fix: In-Page-Anker (`href` beginnt mit `#`) liefern nur ihr Label (meist leer), nie die href; `data-testid*="headeraction"` als Noise.
- **Nummerierte Listen zeigten überall „1."**: verschachtelte Bullets waren nur 2 Spaces eingerückt → unter „1. " (Inhalt ab Spalte 3) bricht marked die Liste. Fix: 3 Spaces pro Ebene.

### v2.94.0 — Streamlit-Bridge: Antwort streamen, Tabellen + Thinking erhalten (Juni 2026)

MINOR-Bump — **Live-Streaming der KI-Antwort + vollständige, strukturierte Übertragung.** Bisher kam die Antwort **abgeschnitten** (Stabilitäts-Gate feuerte bei AitisiGPTs ~2-s-Streaming-Pause zu früh) und **ohne Tabellen** (`textContent` flachte Struktur ein).

- **`streamConversation` im `StreamlitBridgeTransport`** ([streamlit.ts](src/core/services/ai/transports/streamlit.ts)): der Chat ([useChatController.ts](src/plugins/chat/useChatController.ts) `runStreaming`) streamt darüber automatisch (Feature-Detection). Eigene `streams`-Map; `tf-stream {id,content}` (Voll-Snapshots) → Delta-Suffix via `onDelta`; finaler `tf-response {id,result,reasoning?}` → `StreamResult{content,reasoning}`. Abort → `{aborted:true}` ohne throw. `submitMessage`-Timeout 60 s → 200 s.
- **Bookmarklet** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)): **HTML→Markdown**-Konverter (`htmlToMd`) inkl. GFM-Tabellen/Listen/Code → der Chat rendert echte Tabellen (marked `gfm:true`). **Completion = Streamlit-Skript idle** statt Text-Stabilität: `isRunning()` (`stStatusWidget`/Stop-Button) + `MutationObserver`-DOM-Aktivität; finalisiert erst bei nicht-leerer Antwort, nicht-laufendem Skript und ~2,5 s Ruhe → keine vorzeitige Truncation mehr bei Pausen/Thinking/Last. Live-`tf-stream` pro Änderung.
- **Thinking** ([best-effort]): AitisiGPT zeigt Reasoning als Info-Icon-Tooltip nach der Antwort → wird (Hover-Simulation + Streamlit-Tooltip-Selektoren) ausgelesen und als `reasoning` übertragen → TeamFlow zeigt es im vorhandenen aufklappbaren Thinking. Nicht gefunden → Antwort trotzdem vollständig (graceful).

### v2.93.0 — Streamlit-Bridge: Verbindungstest repariert + bidirektionaler Handshake (Juni 2026)

MINOR-Bump — **„Verbindung testen" funktioniert jetzt; neuer Gegenrichtungs-Test.** Bug: der Test baute einen Wegwerf-`StreamlitBridgeTransport` und rief `window.open` erneut auf → der schon offene KI-Tab wurde neu geladen und das injizierte Bookmarklet gelöscht; der `tf-ping` erreichte den Tab nie (Badge blieb auf „Interne KI", wechselte nie auf „Verbunden").

- **Fenster-Handle aus `event.source`** ([streamlit.ts](src/core/services/ai/transports/streamlit.ts)): der Transport übernimmt bei jeder `tf-*`-Nachricht `event.source` als Handle. Das Bookmarklet ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)) sendet beim Aktivieren `tf-bridge-ready` an `window.opener` → die App kennt das exakte Tab, kein erneutes `window.open`/Reload.
- **Persistenter Transport für den Test** ([bridge.ts](src/core/services/ai/bridge.ts) `getStreamlitTransport()`): nur die eine, seit App-Start lebende Instanz hat das Handle gecaptured. [StreamlitBridgeSection.tsx](src/plugins/einstellungen/StreamlitBridgeSection.tsx) testet/öffnet darüber statt mit einem Wegwerf-Transport.
- **Bidirektional** (Nutzer-Vorschlag): links (App) „Verbindung testen" → „Interne KI erreichbar"; rechts (KI-Tab) neuer Button „ZAH-App testen" → `tf-app-ping`/`tf-app-pong` → „ZAH App erreichbar". Kein `window.opener` → Badge-Hinweis „Tab aus der App öffnen".
- **Voraussetzung** (in Doku ergänzt, [streamlit-bridge.md](docs/architecture/streamlit-bridge.md)): KI-Tab muss aus der App geöffnet werden; setzt die KI-Seite `Cross-Origin-Opener-Policy: same-origin`, ist keine Tab-zu-Tab-Kommunikation möglich (vor Rollout prüfen).

### v2.92.5 — „Modell"-Provenienz in Gutachten/Skill-Reviews nutzt Anzeige-Namen (Juni 2026)

PATCH-Bump — **nur sichtbare Provenienz-Beschriftung, keine Logik.** Die `modell`-Felder der generierten Stände zeigten den technischen Transport-`name` („Streamlit"). Jetzt `transport.displayName ?? transport.name` → für die Bridge „Interne KI", DirectLLM unverändert (llama.cpp etc.). Betroffen: Kurzfassung ([useKurzfassung.ts](src/plugins/antraege/kurzfassung/useKurzfassung.ts)), Gutachten-Workflow ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)), Batch ([useBatchJob.ts](src/plugins/antraege/gutachten-batch/useBatchJob.ts)), Skill-Testlauf ([SkillTestlauf.tsx](src/plugins/skill-verwaltung-kuration/SkillTestlauf.tsx)). `modell` ist eine reine Anzeige-Zeichenkette (kein Logik-Vergleich); bestehende Records behalten ihren alten Wert.

### v2.92.4 — Provider-Anzeigename vom Logik-Namen entkoppelt („Interne KI") (Juni 2026)

PATCH-Bump — **Anzeige-Wording, keine Logik-Änderung.** Der aktive Provider erschien an mehreren Stellen noch als technischer „Streamlit" (Such-Tooltip, Such-Fehlermeldung, Feedback-Chatbot, Batch-Start-Dialog). Neu: `AITransport.displayName` (optional, Fallback auf `name`) entkoppelt den Endnutzer-Anzeigenamen vom internen Logik-`name`. `StreamlitBridgeTransport.displayName = 'Interne KI'`, `DirectLLMTransport.displayName = name` (dev-Kontext). Anzeige-Stellen ([useAnalysePipeline.ts](src/plugins/suche/useAnalysePipeline.ts), [FeedbackChatbot.tsx](src/components/feedback/FeedbackChatbot.tsx), [bridge.ts](src/core/services/ai/bridge.ts) `getActiveProviderName`) nutzen jetzt `displayName ?? name`. **Unverändert:** Logik-Vergleiche (`transport.name === 'Streamlit'` in feedbackLlm.ts) und `modell:`-Provenienz-Felder bleiben auf dem technischen `name`. Der Chat-Footer war über `providerLabel()` bereits entkoppelt.

### v2.92.3 — Streamlit-Bridge: „Code kopieren" entfernt + Badge-Farbe aus Design-System (Juni 2026)

PATCH-Bump — **UI-Aufräumen, keine Logik.** „Code kopieren"-Button + zugehörige Anleitungs-/Fehler-Texte aus der Installer-Sektion ([StreamlitBridgeSection.tsx](src/plugins/einstellungen/StreamlitBridgeSection.tsx)) entfernt (inkl. ungenutzter `copy`-Action, `copied`-State, Copy/Check-Icons) — nur noch das ziehbare Lesezeichen. Das Status-Badge im Bookmarklet ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)) nutzt jetzt die weichen Pastell-Töne des Design-Systems (success/warning/danger aus `theme.css` als Literale, da die fremde KI-Seite keine CSS-Variablen kennt) statt des grellen Vollton-Grüns — Pillen-Look wie `badge.tsx`.

### v2.92.2 — Streamlit-Bridge: Endnutzer-Wording „interne KI" statt „Streamlit"/„TF" (Juni 2026)

PATCH-Bump — **nur sichtbare Texte, keine Logik.** Endnutzer kennen weder „Streamlit" (technisch) noch das „TF"-Präfix. In der Installer-Sektion ([StreamlitBridgeSection.tsx](src/plugins/einstellungen/StreamlitBridgeSection.tsx)) heißt es jetzt „Interne KI" (Abschnitt, „Adresse der internen KI", „Interne KI öffnen", Lesezeichen-Button „Interne KI", Schritt-Anleitung) und die Badge-/Antwort-Texte im Bookmarklet ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)) sind eingedeutscht ohne „TF": „Interne KI"/„Verbunden"/„Arbeitet…"/„Zeitüberschreitung"/„Fehler". Entwickler-Doku (streamlit-bridge.md) bleibt technisch korrekt bei „Streamlit".

### v2.92.1 — Streamlit-Bridge: Startwert-URL auf internen gpt-oss-Server (Juni 2026)

PATCH-Bump — **nur der Default-Startwert der Streamlit-URL.** Statt `http://localhost:8501` (lokale Test-App) ist der Startwert jetzt `https://gpt.vdivde-it.de/` (interner gpt-oss). Pro Rechner weiterhin frei konfigurierbar (IDB `ai-provider`), der Startwert greift nur, wenn nichts gespeichert ist. Geändert in [streamlit.ts](src/core/services/ai/transports/streamlit.ts) (Transport-Default), [EinstellungenPage.tsx](src/plugins/einstellungen/EinstellungenPage.tsx), [StreamlitBridgeSection.tsx](src/plugins/einstellungen/StreamlitBridgeSection.tsx) (Fallback + Placeholder), [AIProviderTab.tsx](src/plugins/einstellungen/AIProviderTab.tsx) (Provider-Preset); README + zwei Suche-Kommentare (kein hartkodiertes `localhost:8501` mehr).

### v2.92.0 — Streamlit-Bridge: In-App-Bookmarklet-Installer + Endkunden-tauglich (Juni 2026)

MINOR-Bump — **neuer In-App-Installer + Korrektheits-Fixes am bestehenden Transport, additive Flag-Erweiterung.** Zugang zum internen LLM (gpt-oss) ohne API: eine Streamlit-Chat-App läuft im parallelen Tab, TeamFlow öffnet sie per `window.open` und tauscht via `postMessage` aus (`StreamlitBridgeTransport` = `AITransport` wie OpenRouter/llama.cpp). Der Transport existierte schon, war aber nicht nutzbar (kein Weg ans Bookmarklet, URL in Produktion nicht konfigurierbar, konfigurierte URL nie wirksam). Jetzt end-to-end nutzbar in **dev + prod + kurator + pl**.

- **In-App-Installer** [StreamlitBridgeSection.tsx](src/plugins/einstellungen/StreamlitBridgeSection.tsx) im KI-Assistent-Tab: Streamlit-URL konfigurieren + speichern, ziehbares Bookmarklet „TF Streamlit Bridge" (+ „Code kopieren"-Fallback), „Streamlit-Tab öffnen" (synchron, popup-blocker-sicher), „Verbindung testen" (echter `tf-ping`→`tf-pong`, nicht DirectLLM), deutsche Schritt-für-Schritt-Anleitung.
- **Bookmarklet als Single Source of Truth** [snippet.js](src/core/services/ai/streamlit-bridge/snippet.js) + `snippet.ts` (`?raw`-inlined, kein Runtime-`fetch`/`file://`-tauglich). Gehärteter DOM-Scrape: Selektor-Fallbacks, Submit per Button/Enter, Baseline-Zählung, nur Assistant-Nachricht (User-Echo übersprungen), Stabilitäts-Gate gegen Teil-Streaming. `public/bridge.js` (verwaist, falsche Selektoren) gelöscht.
- **Korrektheits-Fixes:** [bridge.ts](src/core/services/ai/bridge.ts) `switchProvider` aktualisiert die Streamlit-URL jetzt per neuer `updateUrl()` (vorher: Transport nur angelegt wenn keiner existierte → URL-Änderung wirkungslos; kein Listener-Leak); [App.tsx](src/core/App.tsx) wendet die gespeicherte URL auch für `type==='streamlit'` beim Start an; [streamlit.ts](src/core/services/ai/transports/streamlit.ts) Origin-Check gegen die konfigurierte URL-Origin statt hart `localhost` (interne Hosts/IPs).
- **KI-Assistent-Tab + Sektions-Gating:** [AIProviderTab.tsx](src/plugins/einstellungen/AIProviderTab.tsx) in drei unabhängig gegatete Sektionen — Kontextlänge+Thinking (`isLlmKontextSettingEnabled`, dev+pl), Bridge (`isStreamlitBridgeEnabled`, alle vier), Provider-Switcher (`isDevContext`). prod/kurator sehen **nur** die Bridge.
- **Feature-Flag `streamlitBridge`** (optional, default false; `isStreamlitBridgeEnabled()`): config-schema + `TeamflowFeatures` + alle vier Variant-Configs (true) + `_template`. Doku: neues [docs/architecture/streamlit-bridge.md](docs/architecture/streamlit-bridge.md), CLAUDE.md-Decision-Tree, README.

### v2.91.0 — Kanonisches Master-Detail-Shell (Split-View) + Skill-Verwaltung angeglichen (Juni 2026)

MINOR-Bump — **neue datenagnostische Shell-Komponente + Layout-Umstellung der Skill-Verwaltung, keine Daten-/Editor-Logik-Änderung.** Tabellenartige Seiten erfanden ihr eigenes Detail-Layout: Förderanträge nutzt eine Split-View (Liste links schrumpft, Detail rechts), Skill-Verwaltung navigierte auf eine **Vollseite**. Split-View ist jetzt das verbindliche Detail-Paradigma; das generische Split-Verhalten ist in ein schlankes Shell extrahiert.

- **Neu `src/components/master-detail/`:** [`MasterDetailLayout`](src/components/master-detail/MasterDetailLayout.tsx) — datenagnostisches Split-Shell (Liste links, Detail rechts; im Detail-Modus schrumpft die Liste auf eine resizable Sidebar mit Drag-Handle + localStorage-Breite, Detail behält `detailMinWidth`). Props: `list`, `detail?`, `onCloseDetail?`, `listWidthKey?`, `narrowDefaultWidth=460`/`narrowMinWidth=320`/`detailMinWidth=300`. Escape schließt (außer Fokus in Eingabefeld). **Aus dem Förderanträge-Muster destilliert, nicht kopiert** — `AntraegePage`/`AntraegeMain` bleiben unangetastet (gewachsen, Referenz). KEIN Antrags-/Such-/Filter-Wissen im Shell.
- **Pure Logik node-getestet:** [`masterDetailLayout-logic.ts`](src/components/master-detail/masterDetailLayout-logic.ts) (`effectiveListWidth`/`clampDragWidth`/`listPaneClass`/`listPaneStyle`/`shouldCloseOnEscape`) + 11 Unit-Tests — Projekt-Konvention „kein RTL/jsdom", Render/Drag-Verdrahtung im visuellen Self-Check.
- **Skill-Verwaltung umgestellt:** [SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx) rendert `SkillEditor`/`RegelEditor` jetzt im `detail`-Slot rechts neben der Liste statt als Vollseiten-Ersatz (Höhenkontext-Wrapper wie AntraegePage; Header/Tabs/View-Toggle/Suche bleiben sichtbar). Selektion = unveränderter In-Page-State (kein Routing); Editoren inhaltlich unverändert. View-Modi (Liste/Tabelle/Cards) bleiben.
- **Convention-Test bewusst weggelassen:** kein verlässlich enges Prädikat — `narrow={` ist mehrdeutig (auch Density-Prop-Drilling), `cursor-col-resize`/`aria-orientation="vertical"` trifft 9 Dateien (Spalten-/Panel-/Nav-Resizer, kein Master-Detail). Per CLAUDE.md-Konvention „lieber kein Test als ein totgewhitelisteter"; Konvention lebt narrativ in DESIGN_GUIDE + Cheatsheet.
- **Doku:** [DESIGN_GUIDE.md](DESIGN_GUIDE.md) Kap. 5 „Split-View" auf `MasterDetailLayout` als kanonisches Shell umgeschrieben (Spielzeug-`grid-cols-2` ersetzt); neues Cheatsheet [docs/agents/add-table-detail-page.md](docs/agents/add-table-detail-page.md) + Einträge in [docs/agents/README.md](docs/agents/README.md) + CLAUDE.md-Decision-Tree. Zweite hand-gerollte Split-View ([dokumente/index.tsx](src/plugins/dokumente/index.tsx)) als Migrations-Kandidat notiert (out of scope). Alle Tests grün (1855), dev/prod/kurator bauen sauber.

### v2.90.0 — `ListItem` als einzige Quelle für Listenzeilen (`inline`-Layout + `actions`-Slot) (Juni 2026)

MINOR-Bump — **rein additive Komponenten-Erweiterung + Migration zweier Listen, keine Breaking-Change.** Die kanonische Zeilen-Komponente [`ListItem`](src/components/ui/ListItem.tsx) konnte bisher nur **zweizeilig** (Titel über Subtitle). Einzeilige Daten-Zeilen mit Aktions-Buttons (Skill-/Regel-Liste) bauten deshalb rohes `flex`-Markup mit hartkodierten Pixelwerten + lokal dupliziertem `RowAction`-Helfer — die Vorlage, an der Coding-Agents Zeilen-Layouts neu erfinden. Jetzt deckt `ListItem` beide Fälle ab.

- **`ListItem` additiv erweitert:** neue optionale Props `layout?: 'stacked' | 'inline'` (Default `'stacked'`) + `actions?: React.ReactNode`. `inline` rendert Titel + Subtitle nebeneinander (Titel `whitespace-nowrap`, Subtitle `truncate flex-1`) mit Container-Chrome (`px-4 py-2.5`, Hover-Background); der `actions`-Slot sitzt rechtsbündig nach `meta` und bringt den Stop-Propagation-Wrapper mit (Aktions-Klick löst die Zeilen-`onClick` nicht aus). Trenner für beide Layouts über die bestehende `last`-Logik (untere `0.5px`-Border). **Default-Pfad byte-identisch** — die 5 Bestands-Sites (`MeineAntraegeSection`, `SpeicherTab`, `TastaturTab`, `TagsTab`, `DirectoriesStep`) unverändert.
- **`RowAction` kanonisiert:** neuer [`src/components/ui/RowAction.tsx`](src/components/ui/RowAction.tsx) (self-contained `stopPropagation`) + `@/ui`-Re-Export. Die **2** Duplikate vereint — lokales `RowAction` in `SkillsTab.tsx` und `RowActionButton` in `skillTableColumns.tsx`. (`ZuweisungsCockpit` hatte entgegen erster Annahme keinen RowAction — Variablen-Treffer `unassignRowAction`.)
- **Skill-Listen migriert:** `SkillsTab` + `RegelnTab` `list`-Modus von Hand-`flex`-Markup auf `<ListItem layout="inline">` umgestellt (Optik unverändert). RegelnTab als nicht-triviale Abbildung: `TypPill` in den `title`-Slot gefaltet, `SevPill` + „Verwendet in" als `meta`, `Switch` als `actions`.
- **Doku:** [DESIGN_GUIDE.md](DESIGN_GUIDE.md) Kap. 5 „Listen-Item" beschreibt `ListItem` jetzt als kanonische Komponente mit beiden Layouts + `actions`/`RowAction` („Listenzeilen nie per Hand bauen").
- **Convention-Test `no-handrolled-list-row` bewusst weggelassen:** Kalibrierung ergab kein verlässlich enges Prädikat — `flex items-center` + `cursor-pointer` + `hover:bg` trifft ~38 Dateien, fast ausschließlich legitime Buttons/Labels/Filter-Facets/Menü-Items/Nav/Toggles; die echten Button-basierten Daten-Zeilen (`DokumenteListe`, `FeedbackTicketList`, `ManifestListItem`) tragen das Row-`flex` auf einer Kind-Zeile und würden gar nicht getroffen. Ein Test hier bräuchte ~30 Whitelist-Einträge (totgewhitelistet) bei ~null echtem Schutz → CLAUDE.md Doku-Konvention „lieber kein Test als ein totgewhitelisteter". Konvention lebt narrativ im DESIGN_GUIDE. Alle Tests grün (1844), dev/prod/kurator bauen sauber.

### v2.89.2 — gutachten-kurzfassung.md auf Registry-Ist-Zustand (Juni 2026)

PATCH-Bump — **reine Doku-Korrektur.** [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md) trug noch Pre-Registry-Migration-Inhalte (`SkillDefinition` mit `runChecks`/`parse`, `kurzfassung-skill.ts`, `checks.ts` mit `passivStil`) und behauptete im Generalisierungs-Abschnitt, Skill-Registry/Workflow/Kurator-UI seien „NICHT umgesetzt". Auf den Ist-Zustand gebracht: Baustein 2 beschreibt jetzt `SkillRecord` (Daten, `regelIds`) + die deklarative Check-Engine (`runRegelChecks`/`QualitaetsRegel`, 5 Seed-Regeln) + den Seed `SEED_SKILL`; der Generalisierungs-Abschnitt listet Registry (v2.69), Skill-Verwaltung (`skillVerwaltung`) und Workflow A–G (`gutachtenWorkflow`) als umgesetzt, mit „noch offen": kurator-konfigurierbares DOCX-Mapping + TV-Scoping. Kein Code-Change.

### v2.89.1 — Health-Baseline als Drift-Warnung (Juni 2026)

PATCH-Bump — **Test-Ergänzung, keine Verhaltensänderung.** Neuer `describe('health-baseline')`-Block in [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts) hält nach P1–P6 + Skill-Dach die erreichten Strukturkennzahlen mit großzügigem Puffer fest — fängt schleichenden Wildwuchs, nicht jeden Feature-Zuwachs. Schwellen als benannte Konstanten oben im Block, jede Fehlermeldung mit Ist-Wert + Hinweis „bewusst anheben, wenn gewollt".

- **4 Kennzahlen:** `features.*`-Flags ≤ 27 (Ist 23), Top-Level-Dirs unter `src/core/services/` ≤ 18 (Ist 18, keine Reserve), größte `src/`-Datei ≤ 1500 LOC (Ist ~1219), `@/ui`-Shim-Importe ≤ 64 (Ist 64, darf nur sinken). Metrik „`fixed inset-0` == 0" weggelassen (redundant zu `no-raw-modal`).
- Convention-Tests jetzt 15 statt 11. Kein `npm run health`-Skript (Test genügt).

### v2.89.0 — Skill-Service-Verzeichnisse unter ein `skills/`-Dach (Juni 2026)

MINOR-Bump — **strukturelle Reorganisation, reiner Move + Re-Export, keine Logikänderung.** Die drei Top-Level-Service-Verzeichnisse einer Domäne (`services/skills/`, `services/skill-registry/`, `services/skill-tweaks/`) liegen jetzt als Submodule unter einem Dach: `services/skills/{run,registry,tweaks}` + Dach-Barrel `services/skills/index.ts`. Beseitigt den **Doppelpfad**: `splitSentences`/`CheckResult`/`CheckLevel`/`SkillModifierKey` waren über `skills` UND `skill-registry` erreichbar — jetzt haben sie genau **eine** Heimat (`registry/`), einmal vom Dach re-exportiert.

- **Moves (`git mv`, Historie erhalten):** `skills/` → `skills/run/`, `skill-registry/` → `skills/registry/`, `skill-tweaks/` → `skills/tweaks/`. `seed.ts` inhaltlich unangetastet. `services/skill-registry/` + `services/skill-tweaks/` existieren als Top-Level nicht mehr (kein Shim — Ziel ist Eindeutigkeit).
- **Call-Sites (28 Dateien)** auf den einen Dach-Pfad `@/core/services/skills` umgestellt; in 6 Mehrfach-Importeuren die nun doppelten Import-Zeilen zu je einer zusammengeführt. `run/run-skill.ts` importiert die Registry-Symbole relativ via `../registry`.
- **Service-Verzeichnisse unter `src/core/services/` von 20 → 18.** Docs: [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md) (Skill-Struktur + Pfade), CLAUDE.md (Struktur-Notiz). Daten-Pfad `_intern/skills/registry.json` unverändert (Share-Layout). Alle Tests grün, dev/prod/kurator/pl bauen sauber.

### v2.88.0 — Bauantrag-Demo-Domäne + Demo-Variante entfernt (Juni 2026)

MINOR-Bump — **Feature-Entfernung, keine Breaking-Change für Produktivdaten** (Bauantrag war reine Demo). Entfernt die in sich geschlossene Bauantrag-Domäne (`Vorgang` mit `type: 'bauantrag'`) samt der nur dafür existierenden `demo`-Build-Variante. Beseitigt die „Förder-vs-Bau"-Mehrdeutigkeit (zwei Datenmodelle, zwei Bereiche, paralleler Workflow-/Artefakt-Stack), an der Coding-Agents Pfade verwechselten. **Förder-Fixtures + alle Produktivpfade (prod/kurator/pl) unberührt.** dev-Build von ~3206 → 2983 Module; alle Tests grün, 4 verbliebene Varianten (dev/prod/kurator/pl) bauen sauber.

- **Entfernt:** Plugin `src/plugins/bauantraege/` (7 Dateien); Vorgang-only-Infra (`useVorgangDetail`, `ArtefakteTab`, `SimilarCases`, `VorgangDokumenteTab`, `VerlaufTab`, `StatusSelect`); Artefakt-/Template-Stack (`services/artifacts.ts`, `templates.ts`, `ai/prompts.ts`, `export/docx-export.ts` + `docx-templates.ts`, `services/workflow/`); Seed-Demo (`bauantraege-data.ts`, `dokumente-data.ts`, `artefakte-data.ts`, `seed/docs/bau-*.ts` × 35); Storage-Methoden `saveVorgang`/`loadVorgang`/`listVorgaenge`/`deleteVorgang`.
- **department-Kollaps auf Förder-only:** `isBauantraegeEnabled()` + `hasDepartmentChoice()` entfernt; `department`-Modell (`'antraege' | 'bauantraege' | 'beide'`) auf `'antraege'` verengt + Threading aus Router/ShellLayout/App entwirrt; Onboarding-Abteilungs-Picker + ProfilTab-Auswahl entfernt; `'bauantraege'`-Zweige in HomePage/Feedback raus. `UserProfile.department` bleibt als Feld (Persistenz-Kompat; alte `'beide'`/`'bauantraege'`-Profile inert, keine Migration → bleibt MINOR).
- **`Vorgang`-Typ bleibt:** das Home-Dashboard nutzt ihn weiter als Projektions-Shape für Förderanträge (`AntragVorgang = Vorgang & {…}` in `dashboardAggregate.ts`); nur `Artifact`-Interface + `type`-Feld entfernt.
- **Seed chirurgisch getrennt:** `seedTestData()` lädt nur noch die Förder-Fixture-CSVs (`fixture-loader.ts` / `seedFromFixtureCsvs` / `FIXTURE_SCHEMA_IDS` / `docs/fixtures/` **unberührt**); `SeedResult` → `{ antraege }`.
- **Suche:** Bauantrag-Pill + Filter-/Count-Zweige in `SuchSeite` / `suchseite-utils` / `useUnifiedSearch` / `ColumnPicker` raus (Förder + Dokument bleiben).
- **Demo-Variante entfernt:** `configs/demo.config.json` gelöscht; `'demo'` aus `variant`-Union (runtime-config) + `allowedVariants` (config-schema); `features.bauantraege` aus Schema/Typ/allen Configs; `build:demo` / `prebuild:demo` aus package.json + `build:all`.
- **Bewusst belassen (Bleibt):** geteiltes Status-Vokabular (`status-mappings.ts` / `status-canonical.ts` + zugehörige Tests/Fixtures), DMS-Doc-Type `"Bauantrag"` in der Metadaten-Klassifizierung (eigene Domäne), `demoDataBundled`-Flag (dev nutzt es für den Förder-Fixture-Auto-Seed).

### v2.87.0 — IndexedDB pro Build-Variante getrennt (Juni 2026)

MINOR-Bump — **Verhaltensänderung an der Persistenz-Grundlage.** Bisher teilten alle 5 Build-Varianten denselben IndexedDB-Namen `teamflow`; unter `file://` haben prod/kurator/pl denselben Origin → sie schrieben auf einem Rechner in **dieselbe** DB. Das war die strukturelle Wurzel der Bug-Klasse 1/3 (Datenverlust beim Varianten-Wechsel, 263 KB → 7 KB, v2.24.4). Der DB-Name wird jetzt pro Variante suffigiert.

- **DB-Name = `teamflow-<outputFilename>`** (`teamflow-zah-prod` / `teamflow-zah-kurator` / `teamflow-zah-pl` / `teamflow-zah-demo` / `teamflow-zah-dev`; Dev-Server `teamflow-dev`). Diskriminator ist `build.outputFilename` — `variant` kollabiert prod/kurator/pl auf `'production'` und ist als Suffix unbrauchbar. Pure, testbare Ableitung `deriveVariantDbName()` + Laufzeit-Wrapper `getVariantDbName()` in [runtime-config.ts](src/config/runtime-config.ts); `IDBStore` bekommt den Namen via Konstruktor (bleibt konfig-frei), verdrahtet in [storage/index.ts](src/core/services/storage/index.ts). `version=8` + alle `onupgradeneeded`-Migrationen unverändert; weiterhin genau **eine** `IDBStore`-Instanz.
- **Kein Migrations-/Kopier-Code** (Option A — frischer Sync): die neue Variant-DB startet **leer** und lädt beim Erststart über den bestehenden Snapshot-Sync aus dem Daten-Share (Share = Source of Truth, IDB = Cache). Eine Migration müsste raten, welche Variante die Alt-Daten erbt — auf Multi-Varianten-Rechnern nur verschobenes Problem.
- **Migrations-Hinweis (Update auf v2.87):** Beim **ersten** Öffnen jeder Variante läuft **einmalig** ein Share-Sync — entspricht dem täglichen „neuer Datenstand"-Reload, beim Erststart zusätzlich die kleinen Stammdaten-Stores (Programme/Unterprogramme/Schemas/Akronym-Index). Da auch der `kv`-Store frisch ist, muss zusätzlich **einmalig der Daten-Share-Handle neu freigegeben** werden; Profil/Einstellungen kommen aus dem persönlichen Ordner zurück (gleicher Ordner für alle Varianten wählen), und **pl lädt das Embedding-Korpus neu** aus dem Share-Mirror. Alles über die bestehenden Cold-Start-Pfade. Die alte `teamflow`-DB bleibt verwaist liegen (harmlos, manuell via DevTools löschbar).
- **Regressions-Guard:** neuer Unit-Test [variant-db-name.test.ts](src/config/__tests__/variant-db-name.test.ts) (alle 6 outputFilename-Werte + Invariante „nie der nackte `teamflow`" + 4 distinkte `file://`-Builds). Verifiziert: Builds dev/prod/pl/kurator grün, vier getrennte DBs in DevTools, prod-Daten überleben einen pl-Erststart (manueller Multi-Varianten-Test).
- **Bewusst außerhalb des Scopes:** localStorage (`teamflow_*`) + die physischen Share-Dateien bleiben origin-/share-weit geteilt — die „nicht zwei Varianten gleichzeitig **schreibend** offen"-Regel gilt für Share-Writes weiter, ist aber für den reinen Varianten-**Wechsel** jetzt entschärft. Doku: [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md) Klasse 3 (Ist-Zustand), [data-layout.md](docs/architecture/data-layout.md), CLAUDE.md `file://`-Constraints.

### v2.86.0 — Flag-Hygiene: 4 tote/immer-an Feature-Flags entfernt (Juni 2026)

MINOR-Bump — Config-Schema-Reduktion (28 → 24 `features.*`). Entfernt 4 Flags, die in allen 5 Varianten identisch waren bzw. keinen Runtime-Konsumenten mehr hatten; Wert fest verdrahtet, **kein Verhalten geändert** (alle 1842 Tests grün; Builds dev/prod/pl/kurator sauber).

- **`requireKuratorLogin`** (tot) — seit v2.16 durch das build-time `auth`-Gate (`isAppGateRequired()`) abgelöst, kein Runtime-Konsument mehr. Raus aus `TeamflowFeatures`, `DEFAULT_CONFIG`, `requiredFlags`, beiden `validateConfig`-Warnungen und allen 5 Configs; Doc-Kommentar in `KuratorLoginGate.tsx` (deprecated) entschärft.
- **`chat` / `feedbackBoard`** — reine Plugin-Gates, in allen Varianten `true`. `featureFlag` aus chat-/feedback-board-Plugin entfernt (laden jetzt unbedingt); Helper `isChatEnabled`/`isFeedbackBoardEnabled` gelöscht. Sidebar-Sichtbarkeit unverändert (war überall an).
- **`presenceHeartbeat`** — in keiner Config gesetzt, überall via `!== false` an. Guard in `useHeartbeat` entfernt (Heartbeat läuft immer), Helper `isPresenceHeartbeatEnabled` gelöscht.
- **`suche` bewusst behalten** (STOPP-Default „im Zweifel behalten"): hat einen echten Funktions-Branch (`SEMANTIC_SOURCES_ENABLED` in [antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)) **und** die Sichtbarkeits-Matrix (Suche „–" in prod) deutet auf intendierte Varianz, obwohl aktuell alle Configs `true` setzen → nicht entfernt, um keinen latenten Regressionsweg zu öffnen.
- **Kein Merge** der zufällig ko-variierenden Flag-Gruppen (dev-only-Paar, dev+pl-Sextett) — semantisch unabhängig, konservativ getrennt gelassen.

### v2.85.0 — Auslastung-Services in 6 kohäsive Submodule gegliedert (Juni 2026)

MINOR-Bump — reiner Datei-Umzug + Re-Export, **keine** Verhaltensänderung (alle 1842 Tests grün, Typecheck + Build:dev sauber). Die 42 flachen Service-Dateien unter `src/plugins/auslastung/services/` (~Viertel der Codebase) bekommen eine innere Gliederung in 6 Submodule mit je einem `index.ts`-Barrel: `matching/` · `klassifizierung/` · `kapazitaet/` · `identitaet/` · `onboarding/` · `verbund/`. Querschnitt/Store (auslastung-store, cross-tab, export-service, default-labels, tib-mail) bleiben im `services/`-Root.

- **Deep-Importeure repointet** (~94 Dateien: Views/Hooks/Components/Tests + 6 externe) auf den Submodul-Index `@/plugins/auslastung/services/<submodul>`; neues Top-Barrel `services/index.ts`. Service-interne Cross-Submodul-Importe nutzen **direkte** Pfade (`../<submodul>/<datei>`), der Graph ist azyklisch.
- **Cluster-Feinschliff** ggü. Vorschlag: `embedding-matcher` → `matching/`, `antragstyp-praeferenz` → `kapazitaet/` (folgt dem Import-Graph), `kontingent` → `matching/` (Matcher-Scoring-Helfer).
- **Test-Nachzug**: `vi.mock` muss den **konkreten** Submodul-Pfad treffen, nicht das Barrel (sonst no-op) — `verbund-aggregation-livecache`; `readFileSync`-Source-Pfade in `altlast-ranking-guard` nachgezogen.
- Doku: Submodul-Struktur in [auslastung.md](docs/architecture/auslastung.md) + [project-structure.md](docs/architecture/project-structure.md) (Current-State).

### v2.84.0 — Convention-Test-Härtung (Bug-Klasse 1 + 5) + Doku-Diät (Juni 2026)

**Test-Härtung (Phase A/B):**
- Neue Convention-Tests in `codebase-conventions.test.ts`: `import-requires-store-refresh` + `antraege-write-requires-listview-rebuild` (recurring-bug-classes Klasse 1) und `no-hardcoded-canonical-field` (Klasse 5); dateiweiter Helper `findFilesViolating`.
- Cold-Start-Store-Refresh-Fix: `RemapCsvColumnsDialog` + `CsvAddColumnsDialog` rufen `refreshAntraegeStoreAfterSync` nach dem Re-Import (sonst bleibt der In-Memory-Store bis zum manuellen Reload stale).
- Inline-Whitelists (Refresh im Caller / Seed vor Store-Load / dev-only): `auto-refresh.ts`, `fixture-loader.ts`, `dev-fixtures/import.ts`.

**Doku-Diät (Phase C/D):**
- CLAUDE.md 48,5 KB → ~30 KB: Pitfalls #9–#29 sind jetzt Ein-Satz-Index + Link, Volltext in den Themen-Docs (`### Pitfall #N`-Anker); File-Size-Limit-Essay → `project-structure.md`; Feature-Flag-Absätze gekürzt; neue „Doku-Konventionen"-Sektion + aktualisierte „maschinell erzwungen"-Kopfnotiz.
- CHANGELOG-Split: jüngste 15 Blöcke im Root (< 30 KB), 80 ältere → `docs/CHANGELOG-ARCHIV.md`.
- `eval_report.json` → `_archive/eval-reports/`.

### v2.83.0 — UI-Konsolidierung: eine Implementierung pro Primitive, `@/ui` wird Shim (Juni 2026)

MINOR-Bump v2.83.0 — die zwei parallelen UI-Bibliotheken (`src/ui/` TF + `src/components/ui/` shadcn) werden zu **einer** vereinigt. Heimat ist `src/components/ui/`; `src/ui/index.ts` ist nur noch ein **Re-Export-Shim** — die ~70 Barrel-Importe bleiben unverändert kompilierbar, es gibt aber nur noch einen Code-Pfad pro Primitive. Additiv/kompatibel, keine Call-Site-Massenmigration.

- **Token-Vereinigung** ([theme.css](src/theme.css)): die shadcn-Tokens (`--background`, `--primary`, `--muted`, `--border`, `--input`, `--ring`, `--destructive`, …) zeigen jetzt auf `var(--tf-*)` und flippen automatisch über die TF-Kaskade unter `[data-theme="dark"]`. Der tote `.dark`-Block (matchte nie, da die App nur `data-theme` setzt) wurde entfernt — behebt nebenbei, dass shadcn-Komponenten im Dark-Mode hell durchschlugen.
- **Button** ([button.tsx](src/components/ui/button.tsx)): kanonisch = shadcn (cva); zusätzlich TF-Aliase `primary→default`, `danger→destructive`, `secondary→outline`, `md→default` (vor cva aufgelöst) + Props `loading`/`icon`. Alle ~44 TF-Call-Sites unverändert lauffähig.
- **Dialog** ([Dialog.tsx](src/ui/Dialog.tsx)): nur noch dünner Adapter auf den kanonischen `@/components/ui/dialog`.
- **Badge/Tabs/Card**: TF-Implementierungen sind jetzt kanonisch in `src/components/ui/`. **Input**: shadcn kanonisch (Barrel-Re-Export).
- **19 Unikate** (SectionHeader, MarkdownRenderer, FileDropZone, theme.ts, …) nach `src/components/ui/` verschoben; ~19 Direkt-Importe umgestellt.
- **Convention-Test** `no-new-tf-ui-files` ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)): `src/ui/` darf nur noch `index.ts` + `Dialog.tsx` + `Select.tsx` enthalten.
- **Select nicht konsolidiert** (STOPP #2): [ProgrammSwitcher](src/core/components/ProgrammSwitcher.tsx) nutzt die Radix-Compound-API; TF- und shadcn-Select bleiben vorerst beide bestehen (auf späteres Prompt vertagt).

### v2.82.1 — Thinking-Schalter → kompaktes Budget-Dropdown (Aus/Niedrig/Standard) (Juni 2026)

PATCH-Bump v2.82.1 — der Thinking-On/Off-Schalter neben den Generieren-Buttons wird ein **kompaktes Dropdown** mit Budget-Stufen; das Brain-Icon ist kleiner.

- **[`ThinkingControl`](src/plugins/antraege/kurzfassung/ThinkingControl.tsx)** (ersetzt `ThinkingToggle`): kleines Brain-Icon (12px) + „Thinking" + `<select>` **Aus / Niedrig / Standard** (`none`/`low`/`medium`). Aktiver Rahmen sobald ≠ Aus. Die Stufe `'high'` bleibt bewusst ausgeblendet (Transport kennt sie, UI bietet sie nicht an).
- **Budget statt Boolean** durch die Stacks: `useKurzfassung` + `useGutachtenWorkflow` halten jetzt `thinkingBudget: ThinkingBudget` (+ `setThinkingBudget`) statt `thinkingEnabled`; Default weiterhin aus der Einstellung (`getLlmThinkingEnabled()` → `'medium'`). Wert wird direkt an `runSkill` durchgereicht (kein `budgetForThinking`-Zwischenschritt mehr im Generierungs-Call). `denkprozessAngefordert = budget !== 'none'`.
- Gilt in beiden Flächen (standalone Kurzfassung + Workflow A–G) und an allen Generier-Stellen. Die globale Einstellung (KI-Assistent) bleibt der einfache An/Aus-Default; pro Generierung ist die Stufe wählbar. Der separate Chat-Plugin-`ThinkingToggle` ist davon unberührt.

### v2.82.0 — Live-Streaming-Vorschau der KI-Generierung („mitlesen") (Juni 2026)

MINOR-Bump v2.82.0 — bisher zeigte die Skill-Generierung (Kurzfassung + Gutachten-Workflow A–G) nur einen „Generiere…"-Spinner: der Runner streamte zwar (bei aktivem Thinking), warf die Deltas aber weg (no-op `onDelta`) bzw. nutzte ohne Thinking den Nicht-Streaming-Pfad. Jetzt läuft die Antwort (und der Denkprozess) **live mit**, sodass man beim Erstellen mitlesen kann.

- **Runner** ([run-skill.ts](src/core/services/skills/run-skill.ts)): `SkillRunInput` += `onContentDelta` / `onThinkingDelta`. Der Streaming-Pfad wird gefahren, sobald der Transport streamen kann UND Thinking aktiv ist **oder** die UI Deltas möchte — die Callbacks reichen Antwort- bzw. Reasoning-Deltas inkrementell durch (`reasoning_content`/`reasoning` UND `<think>`-Fallback). Endergebnis (`raw`/`thinking`) identisch zum Nicht-Streaming-Pfad; Abbruch weiterhin → `AbortError` (kein Teil-Record).
- **Gedrosselter Puffer** [`useStreamingBuffer`](src/plugins/antraege/kurzfassung/useStreamingBuffer.ts): Token-Deltas landen in Refs, Flush in den React-State nur ~alle 66 ms — verhindert Hunderte Re-Renders/s bei schnellem LLM. Genutzt von [useKurzfassung](src/plugins/antraege/kurzfassung/useKurzfassung.ts) **und** [useGutachtenWorkflow](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts) (eine Quelle).
- **UI** [`StreamingVorschau`](src/plugins/antraege/kurzfassung/StreamingVorschau.tsx): ersetzt den reinen Spinner in allen vier Busy-Zuständen (initiale Generierung + Re-Generierung, je Kurzfassung + Workflow). Zeigt den streamenden „Denkprozess (läuft…)" + die rohe Antwort mit Auto-Scroll + „Stopp". Die rohe Antwort enthält die `###`-Abschnittsmarker (echter Fortschritt); die saubere geparste Ansicht erscheint nach Abschluss in der Review-Karte.
- Streaming gilt jetzt auch **ohne** Thinking (vorher nur bei Thinking) — man sieht die Antwort generell aufwachsen. Kein Mehrverbrauch; nur die Anzeige.

### v2.81.2 — Thinking: Output-Budget-Aufschlag gegen abgeschnittene Antwort (Juni 2026)

PATCH-Bump v2.81.2 — mit aktivem Thinking kam ein leerer finaler Text („0 Sätze", „Antwort ohne erwartete Abschnitte"), obwohl der **Denkprozess** korrekt erfasst wurde. Ursache: `max_tokens` deckelt Reasoning **und** Antwort gemeinsam; der (oft lange) Reasoning-Block fraß die ~2048 Token komplett auf, für die eigentliche Antwort blieb nichts. **Kein** Server-/Config-Problem — `kontext_groesse` (63k) reicht; gedeckelt hat das per-Request-`max_tokens`, das die App aus `skill.maxTokens` sendet.

- **Fix** in [run-skill.ts](src/core/services/skills/run-skill.ts): bei `thinkingBudget !== 'none'` wird `max_tokens` um `THINKING_OUTPUT_HEADROOM` (8192) aufgeschlagen (Basis `skill.maxTokens` bleibt für die Antwort, der Aufschlag trägt das Reasoning). Ohne Thinking unverändert (kein Mehrverbrauch — `max_tokens` ist nur ein Deckel, das Modell stoppt am EOS).
- Greift in beiden Pfaden (standalone Kurzfassung + Workflow A–G), da beide denselben `runSkill` nutzen.
- Edge (bewusst offen): eine VB nahe dem Zeichen-Cap (~178k) PLUS Thinking könnte das Kontextfenster knapp machen (VB-Cap-Reserve = 4096 Token). In der Praxis sind VBs weit darunter; degradiert sonst wie bisher (Server-seitiger Context-Shift).

### v2.81.1 — Thinking + Denkprozess auch im vollen Gutachten-Workflow A–G (Juni 2026)

PATCH-Bump v2.81.1 — der Thinking-Schalter und die Denkprozess-Anzeige aus v2.80.x saßen nur in der **standalone** „A — Kurzfassung"-Sektion ([useKurzfassung](src/plugins/antraege/kurzfassung/useKurzfassung.ts) / [ReviewCard](src/plugins/antraege/kurzfassung/ReviewCard.tsx)). Wer den **vollen Workflow A–G** ([GutachtenSection](src/plugins/antraege/gutachten/GutachtenSection.tsx), Flag `gutachtenWorkflow`) nutzt, sah weder Schalter noch Trace — dort läuft ein eigener Stack ([useGutachtenWorkflow](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts) → [runner.ts](src/plugins/antraege/gutachten/runner.ts) → [SectionReviewCard](src/plugins/antraege/gutachten/SectionReviewCard.tsx)), in den Thinking nie verdrahtet war. Jetzt ist er identisch ausgestattet.

- **Schalter pro Abschnitt**: `useGutachtenWorkflow.thinkingEnabled` (Default aus der Einstellung, pro Lauf übersteuerbar, nicht persistiert); [`ThinkingToggle`](src/plugins/antraege/kurzfassung/ThinkingToggle.tsx) neben „… generieren" (leerer Abschnitt) und in der Aktionsleiste jeder Abschnitts-Review-Karte. `runGeneration` reicht `budgetForThinking(thinkingEnabled)` an `runSkill`.
- **Denkprozess persistiert + angezeigt**: `StepRun` + `GenerationInput` ([types.ts](src/plugins/antraege/gutachten/types.ts) / [runner.ts](src/plugins/antraege/gutachten/runner.ts)) tragen `denkprozess` / `denkprozessAngefordert`; `applyGeneration` schreibt sie. `SectionReviewCard` zeigt den aufklappbaren „Denkprozess" bzw. den „kein Reasoning geliefert"-Hinweis (wie die Kurzfassung). Die A-Migration ([kurzfassung-migration.ts](src/plugins/antraege/gutachten/kurzfassung-migration.ts)) reicht beide Felder mit durch.
- Hintergrund: in den Screenshots war die sichtbare Sektion der A–G-Workflow (Abschnitte B/C darunter), nicht die standalone Kurzfassung — daher fehlte der in v2.80.1 nur dort ergänzte Schalter.

### v2.81.0 — Convention-Test `no-raw-modal` + Dialog als kanonischer Modal-Pfad (Juni 2026)

MINOR-Bump v2.81.0 — Härtung der wiederkehrenden Bug-Klasse 7 (hand-gerollte Modals ohne Höhen-Cap, [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)). Der kanonische Dialog ([dialog.tsx](src/components/ui/dialog.tsx)) hat Höhen-Cap + internen Scroll bereits eingebaut; daran vorbei gebaute `fixed inset-0`-Overlays werden ab jetzt **maschinell** verhindert. Additiv: zwei neue optionale Dialog-Props, keine Regression bei den Bestands-Nutzern (Defaults = heutiges Verhalten).

- **Convention-Test `no-raw-modal`** ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts), analog `no-raw-async-onclick`): `fixed inset-0` außerhalb der zwei Dialog-Dateien ist verboten; Inline-Ausnahme `// allow-raw-modal: <grund>`.
- **Dialog-Props** `size` (`sm`/`md`/`lg`/`xl`, Default `md` = bisher) + `align` (`center`/`top`, Default `center`). Höhen-Cap + Scroll gelten für alle Größen.
- **3 Referenz-Migrationen** auf den Dialog: [SkillTestlauf](src/plugins/skill-verwaltung-kuration/SkillTestlauf.tsx), [KonvertierungReviewDialog](src/core/components/KonvertierungReviewDialog.tsx), [NeueAntraegeAlleModal](src/plugins/home/NeueAntraegeAlleModal.tsx) (reine Hüllen-Substitution, kein UI-Text/Logik geändert).
- **24 Altfälle** per Marker whitelisted (Vollbild-Zustände, Spezial-Overlays, Drawer, Auslastungs-Dialoge) — opportunistische Migration später. `AufnahmeOverlay` bleibt bewusst custom (Multi-Phasen-Wizard-Host, Klasse-7-Referenzmuster).

### v2.80.1 — Thinking pro Generierung umschaltbar + Trace-Sichtbarkeit (Juni 2026)

PATCH-Bump v2.80.1 — Nachschärfung zu v2.80.0: Thinking ließ sich nur global in den Einstellungen (Default aus) schalten → der Denkprozess war praktisch nie sichtbar. Jetzt ist der Schalter **pro Generierung** direkt an den Buttons, und es gibt Feedback, falls Thinking lief, aber keinen Trace lieferte.

- **Pro-Generierung-Schalter** [`ThinkingToggle`](src/plugins/antraege/kurzfassung/ThinkingToggle.tsx) (Toggleable-Pill, Pitfall #14) neben „Kurzfassung erstellen" und in der Aktionsleiste neben „Neu"/„Kürzer"/„Länger". `useKurzfassung.thinkingEnabled` initialisiert aus der Einstellung (= Standardwert), ist dann pro Lauf übersteuerbar (nicht persistiert) — so kann man gezielt eine „Neu"-Fassung **mit** Thinking generieren, ohne in die Einstellungen zu wechseln.
- **Trace-Feedback**: lief ein Lauf mit Thinking, lieferte das Modell aber keinen separaten Denkprozess (`denkprozessAngefordert` ohne `denkprozess`), zeigt [ReviewCard](src/plugins/antraege/kurzfassung/ReviewCard.tsx) einen dezenten Hinweis (Modell/Server unterstützt evtl. kein Reasoning) statt stillschweigend nichts.
- Einstellungs-Hilfetext ([AIProviderTab](src/plugins/einstellungen/AIProviderTab.tsx)) klärt: der Schalter ist die Voreinstellung, pro Generierung umstellbar.

### v2.80.0 — Kurzfassung: Vorfassungs-Diff + Thinking-Steuerung (Juni 2026)

MINOR-Bump v2.80.0 — zwei additive Erweiterungen am Gutachten-Kurzfassung-Testballon (Feature-Flag `gutachtenKurzfassung`, dev). Bisher zeigte „Vorfassungen" frühere Fassungen nur als Volltext-Liste (Änderungen selbst suchen) und Reasoning/„Thinking" war im Skill-Runner hart deaktiviert. Jetzt: **Zwei-Spalten-Diff** statt Liste und ein **Thinking-Schalter** mit aufklappbarer Denkprozess-Anzeige. Keine neue Dependency, kein neuer Object-Store, kein neues Feature-Flag — alles additiv im bestehenden `kv`-Record (alte Records bleiben ladbar). Detail: [docs/architecture/gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

- **Vorfassungs-Diff** ([VersionVerlauf.tsx](src/plugins/antraege/kurzfassung/VersionVerlauf.tsx)): die „Vorfassungen"-Sektion vergleicht jetzt zweispaltig — links die aktuelle Fassung (Einfügungen grün), rechts per **Tabs** die gewählte Vorfassung (Löschungen rot durchgestrichen) inkl. Meta, Prüf-Ergebnis und „Diese Fassung übernehmen". Reiner, getesteter Diff-Helfer [kurzfassung-diff.ts](src/plugins/antraege/kurzfassung/kurzfassung-diff.ts) (`computeFinalerTextDiff`/`diffStats`) kapselt `diff-match-patch` (vorhandene Dependency, wie [DiffView.tsx](src/ui/DiffView.tsx)). Wirkt auch im Gutachten-Workflow ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx), teilt die Komponente).
- **Thinking-Schalter** ([llm-thinking.ts](src/core/services/ai/llm-thinking.ts), per-Maschine `localStorage`, Default aus): neuer Switch „Thinking nutzen" in [AIProviderTab](src/plugins/einstellungen/AIProviderTab.tsx) („KI-Assistent", immer sichtbar neben der Kontextlänge). An → Reasoning-Budget `'medium'`.
- **Denkprozess erfassen + anzeigen**: `SkillRunInput.thinkingBudget` (default `'none'` → off-Pfad byte-identisch) in [run-skill.ts](src/core/services/skills/run-skill.ts); bei aktivem Thinking fährt der Runner den **Streaming-Pfad** (no-op `onDelta`) nur zur Reasoning-Erfassung (robuste Trennung via `reasoning_content`/`reasoning`-Feld UND `<think>`-Fallback). Abbruch wird zu `AbortError` re-thrown (kein Teil-Record). Persistiert als `KurzfassungRecord.denkprozess`; [ReviewCard](src/plugins/antraege/kurzfassung/ReviewCard.tsx) zeigt es in einem aufklappbaren „Denkprozess". Snapshot/Restore reichen das Feld mit durch ([kurzfassung-verlauf.ts](src/plugins/antraege/kurzfassung/kurzfassung-verlauf.ts)).
- Tests: [kurzfassung-diff.test.ts](src/plugins/antraege/kurzfassung/__tests__/kurzfassung-diff.test.ts) (Einfügung/Löschung/Stats), erweiterte [kurzfassung-verlauf.test.ts](src/plugins/antraege/kurzfassung/__tests__/kurzfassung-verlauf.test.ts) (`denkprozess`-Round-Trip).

### v2.79.1 — Kontextlänge: Default 62k + Hilfetext live (Juni 2026)

PATCH-Bump v2.79.1 — kleine Korrekturen am Kontextlänge-Feld ([AIProviderTab](src/plugins/einstellungen/AIProviderTab.tsx)):

- **Default-Voreinstellung 62.000 Tokens** (vorher 32.768) — sowohl im UI-Feld als auch intern (`DEFAULT_LLM_CONTEXT_TOKENS`, [llm-context.ts](src/core/services/ai/llm-context.ts)). 62k → ~173.712 Zeichen VB.
- **Hilfetext live**: der angezeigte abgeleitete Zeichen-Cap aktualisiert sich jetzt schon beim Tippen (aus dem Eingabewert), nicht erst nach Verlassen des Feldes — Text und Wert stimmen immer überein.

### v2.79.0 — LLM-Kontextlänge konfigurierbar + abgeleiteter VB-Schwellwert + Warnung (Juni 2026)

MINOR-Bump v2.79.0 — der Schwellwert, ab dem eine zu lange Vorhabensbeschreibung (VB) vor dem LLM-Call gekürzt wird, war hartkodiert (`VB_CHAR_CAP`) und musste bei jedem LLM-Wechsel im Code nachgezogen werden; der „gekürzt"-Zustand war nur ein winziger grauer Zusatz. Jetzt **meldet der Nutzer die LLM-Kontextlänge in den Einstellungen**, der Schwellwert wird daraus **abgeleitet**, und bei Überschreitung erscheint eine **handlungsleitende Warnung** — in beiden Generierungspfaden (Kurzfassung + Gutachten-Workflow A–G).

- **Einstellung** ([llm-context.ts](src/core/services/ai/llm-context.ts), getestet): Kontextfenster (Tokens) in `localStorage` (per-Maschine, synchron). `computeVbCharCap(tokens) = max(4000, (tokens − 4096-Reserve) × 3 Zeichen/Token)` — konservativ gegen serverseitigen Context-Shift. Bsp.: 70k Tokens → ~197.700 Zeichen, Default 32k → ~86k.
- **UI** ([AIProviderTab](src/plugins/einstellungen/AIProviderTab.tsx) „KI-Assistent"): neues Feld „Kontextfenster (Tokens)" + Live-Anzeige des abgeleiteten Zeichen-Limits. Tab jetzt sichtbar, wo die LLM-Generierung läuft (dev + pl, `isLlmKontextSettingEnabled()`); in pl **nur** das Kontextfeld (Provider-Switcher bleibt dev-only).
- **Schwellwert dynamisch**: `SkillRunInput.vbCharCap` ([run-skill.ts](src/core/services/skills/run-skill.ts)); die Hooks reichen `getVbCharCap()` durch. `capVbMarkdown` bleibt pur (Cap als Param); `VB_CHAR_CAP` nur noch statischer Fallback.
- **Warnung** (beide Pfade): proaktiv im „VB vorhanden"-Zustand (Zeichen/Limit/Kontext + Empfehlung, **vor** dem Generieren) sowie prominentes Banner statt grauem Zusatz, wenn `vbGekuerzt`. Einmaliger Hinweistext `VB_KUERZEN_HINWEIS` (unwichtige Abschnitte im Original entfernen → „VB ersetzen" → neu, bzw. Kontextlänge erhöhen).

### v2.78.1 — Auto-Sicherung des aktuellen Gutachten-Stands beim App-Start (Juni 2026)

PATCH-Bump v2.78.1 — Ergänzung zu v2.78.0: Der Store-Spiegel entsteht nur beim **Schreiben** eines Records → Daten, die VOR dem Feature erzeugt (oder offline ohne Ordner-Freigabe bearbeitet) wurden, hatten noch keinen Disk-Spiegel und ein bloßes Neuladen sicherte sie nicht. Jetzt läuft beim App-Start ein **einmaliger Catch-up-Sweep**.

- **Sweep** [gutachten-backup.ts](src/core/services/personal-storage/gutachten-backup.ts) (`backupGutachtenStateToPersonal`): liest per `idb.entries('gutachten-workflow:'/'gutachten-kurzfassung:')` + dem Batch-Singleton alle Records und spiegelt sie in den persönlichen Ordner — nur wenn der Spiegel **fehlt ODER der IDB-Stand neuer** ist (`isNewer`), also kein Schreib-Sturm bei jedem Start und kein Überschreiben einer neueren Disk-Kopie.
- **Hook** in [ShellLayout.tsx](src/core/ShellLayout.tsx): neues `useEffect([])` beim Mount (= einmal pro Session, nach Startup/Ordner-Freigabe), gegated auf `gutachtenWorkflow`/`gutachtenKurzfassung`. Best-effort, non-blocking; self-gated auf Handle + readwrite-Permission (`queryPermission`, no-op sonst).
- Danach genügt ein **Neuladen** der App (mit freigegebenem persönlichem Ordner), um den aktuellen Stand zu sichern; laufende Bearbeitungen spiegeln sich ohnehin per `put`.
- Test [gutachten-backup.test.ts](src/core/services/personal-storage/__tests__/gutachten-backup.test.ts): Spiegeln, Idempotenz, Re-Spiegel bei neuerem IDB-Stand, no-op ohne Ordner, Batch-Singleton.

### v2.78.0 — Gutachten-/Workflow-Status browser-wechsel-fest (Personal-Folder-Spiegel) (Juni 2026)

MINOR-Bump v2.78.0 — der Gutachten-Generierungs-/Workflow-**Status** überlebt jetzt einen Browser-Wechsel. Bisher lag er nur in der browser-profil-lokalen IndexedDB → ein anderer Browser/Profil startete leer. Jetzt: **Mirror-on-write + Hydrate-on-IDB-miss** — WorkflowRun, Kurzfassung und Batch-Job werden zusätzlich als JSON in den persönlichen Ordner gespiegelt und bei leerer IDB von dort zurückgeladen. IDB bleibt Primary; der persönliche Ordner ist die durable Kopie.

- **Kapselung in den Stores** ([workflow-store.ts](src/plugins/antraege/gutachten/workflow-store.ts), [kurzfassung-store.ts](src/plugins/antraege/kurzfassung/kurzfassung-store.ts), [batch-store.ts](src/core/services/gutachten-batch/batch-store.ts)): `put` schreibt IDB + Spiegel, `get` hydratisiert bei IDB-Miss vom Spiegel **und seedet IDB** (nur 1× Disk-Read), `delete` entfernt den Spiegel mit. **Keine Caller-Änderung** — Runner-Reducer, `useGutachtenWorkflow`, `useBatchJob`-Resume rufen weiter `getX/putX`.
- **Generischer Helfer** [state-mirror.ts](src/core/services/personal-storage/state-mirror.ts) (`mirrorJsonToPersonal`/`hydrateJsonFromPersonal`/`removePersonalMirror`, alle best-effort über `getPersoenlichHandle` + `atomicWrite`/`readText`/`removeFile`) + Pfade in [personal-layout.ts](src/core/services/personal-storage/personal-layout.ts): `ZAH/antraege/{key}/gutachten/workflow-run.json` + `kurzfassung.json`, Singleton `ZAH/gutachten-batch-job.json`.
- **Best-effort**: ohne Handle/Permission/offline ist die IDB weiter Source-of-Truth (kein Wurf, blockiert die Generierung nie). Spiegel mit `.backup`-Rotation (Restore-Quelle). Hydrate schreibt **nie** leer/null nach Disk → kein Cold-Start-Datenverlust.
- **Grenzen**: Aufnahme-`doc:*`-Records werden nicht zusätzlich rehydratisiert (VB liegt schon als `.md` + `resolveVb`-Disk-Fallback, Stammdaten via Share → Generierung läuft). Last-Writer-wins auf der Platte (kein cross-browser Live-Merge). Der neue Browser muss den persönlichen Ordner einmal neu freigeben (bestehende Startup-Kette), erst dann greift die Hydration.
- Test [state-mirror.test.ts](src/core/services/personal-storage/__tests__/state-mirror.test.ts): Round-Trip, no-op ohne Handle, und Store-Durabilität (put → IDB leeren → get hydratisiert + seedet; delete entfernt Spiegel).

### v2.77.1 — Gutachten-LLM-Generierung in der PL-Variante freigeschaltet (Juni 2026)

PATCH-Bump v2.77.1 — die Gutachten-Features (`gutachtenKurzfassung` + `gutachtenWorkflow` A–G inkl. ZIP-Aufnahme + Batch) sind jetzt auch in der **pl**-Variante aktiv ([configs/pl.config.json](configs/pl.config.json), bisher dev-only). Reiner Config-Flip, **kein** Code. Die Generierung läuft in pl über das **lokale llama.cpp** (`ki.localLlama`, `localhost:8081`) — OpenRouter bleibt in pl aus, daher greift der `validateConfig()`-Cloud-Guard nicht (keine Echt-Daten an Cloud-APIs). Ohne laufenden lokalen LLM-Server degradiert die Generierung mit klarer Meldung; Aufnahme/Review/DOCX-Füller laufen LLM-frei.

### v2.77.0 — Qualitätsregeln: Gruppierung + Spalten-Filter (Juni 2026)

MINOR-Bump v2.77.0 — die Qualitätsregeln-Tabelle der Skill-Verwaltung bekommt **Gruppierung** + **Spalten-Header-Filter** im Förderanträge-Stil, weil die Regelmenge mit dem Gutachten-Workflow A–G wächst. Tabellen-Modus; Listen-/Karten-Modus behalten nur die Suche. Datenmodell/Persistenz/`canEdit`/Editor unverändert.

- **„Gruppiert:"-Pille** ([RegelnTab.tsx](src/plugins/skill-verwaltung-kuration/RegelnTab.tsx) + [regelGrouping.ts](src/plugins/skill-verwaltung-kuration/regelGrouping.ts)): Keine / Typ / Schweregrad / Skill / Aktiv. Sektionen über den eingebauten `SortableTable`-Mechanismus (`sectionKeyOf`/`renderSectionHeader`, Band-Optik wie Förderanträge `StatusBand`). **Skill ist n:m** — eine Regel erscheint unter jedem zugeordneten Skill (`RegelRow`-Wrapper mit eindeutigem `_rowKey`), ungenutzte unter „Ohne Zuordnung". Header-Sort bei aktiver Gruppierung **section-stabil** (innerhalb der Bänder, Muster aus `AntraegeTable`). Modus in localStorage (`teamflow_regeln_grouping`). Pille wiederverwendet das store-freie `CollapsibleSeg` aus `src/plugins/antraege/filter/`.
- **Spalten-Header-Filter** ([useRegelColumnFilters.ts](src/plugins/skill-verwaltung-kuration/useRegelColumnFilters.ts) + `filterable`-Spalten in [regelTableColumns.tsx](src/plugins/skill-verwaltung-kuration/regelTableColumns.tsx)): Typ / Schweregrad / Aktiv (Exact-Match) + **Verwendet in** (Skill-**Membership** — eine eigene kleine Logik, weil die generische `useColumnFilters` nur Exact-Match kann; UI bleibt die generische `ColumnFilterDropdown`). Kandidaten aus dem Eingabe-Regelsatz (kollabieren nicht bei aktivem Filter).
- **Bug-Fix `absatz_min`** ([regelShared.tsx](src/plugins/skill-verwaltung-kuration/regelShared.tsx)): Typ war nicht in `TYP_LABEL`/`DEFAULT_PARAMS`/`ADD_TYPEN` → Regel „Absätze" zeigte „unbekannter Typ" und war nicht anlegbar. Label „Absätze" + Default `{ min: 1 }` + Min-Feld im [RegelEditor.tsx](src/plugins/skill-verwaltung-kuration/RegelEditor.tsx) ergänzt; `REGEL_TYP_ORDER` als stabile Sektions-Reihenfolge exportiert.

### v2.76.0 — Skill-Verwaltung im Förderanträge-Layout (beide Tabs konsistent) (Juni 2026)

MINOR-Bump v2.76.0 — die **Skill-Verwaltung** ([src/plugins/skill-verwaltung-kuration/](src/plugins/skill-verwaltung-kuration/)) übernimmt das Layout der Förderanträge-Seite: vollbreiter Kopf mit **Unterstrich-Tabs**, **Suchleiste**, **Ansichts-Umschalter** (Liste/Tabelle/Karten) und **Spalten-Picker** über einer dichten Tabelle. **Beide Tabs** (Skills + Qualitätsregeln) bekommen dieselbe UI/UX **und** denselben User-Journey. Reine Präsentations-Umstellung — Persistenz (`useSkillRegistry`/`registry.json`), `canEdit`-Gating und alle Aktionen unverändert. **Keine Migration**, keine neuen Stores/Sidecars.

- **Generische Daten-Tabelle wiederverwendet** ([src/components/data-table/](src/components/data-table/)): `SortableTable` + `ColumnPicker` + `useTableSort`/`useColumnVisibility`/`useColumnWidths` (eigene localStorage-Keys `teamflow_skills_*` / `teamflow_regeln_*`) — identische Optik wie die Förderanträge-Tabelle. Status-Pille-Analog: Regeln-Anzahl als `Badge`.
- **Drei Ansichts-Modi je Tab** ([RegistryViewModeToggle.tsx](src/plugins/skill-verwaltung-kuration/RegistryViewModeToggle.tsx), store-agnostisch da der Antraege-`ViewModeToggle` storegebunden ist): Tabelle (Default), Liste, Karten — per Tab in localStorage persistiert. Spalten-Builder [skillTableColumns.tsx](src/plugins/skill-verwaltung-kuration/skillTableColumns.tsx) + [regelTableColumns.tsx](src/plugins/skill-verwaltung-kuration/regelTableColumns.tsx); Aktions-Icons / Aktiv-Switch mit `stopPropagation`, damit der Zeilen-Klick (= Bearbeiten) nicht mitfeuert.
- **Vereinheitlichter Edit-Journey**: Regeln editieren nicht mehr **inline aufklappend**, sondern — wie Skills — in einer **Vollbild-Editor-Ansicht** (Zeilen-Klick → Editor mit Zurück-Button; „+ Neue Regel" → Typ-Picker → Editor). [RegelEditor.tsx](src/plugins/skill-verwaltung-kuration/RegelEditor.tsx) erhielt einen `canEdit`-Read-only-Modus (analog `SkillEditor`); Editing + „Neu" wurden auf Page-Ebene gehoben, Mutationen laufen zentral über **eine** `useAsyncAction`-Persist. Geteilte Bausteine in [regelShared.tsx](src/plugins/skill-verwaltung-kuration/regelShared.tsx) + [registryFormat.ts](src/plugins/skill-verwaltung-kuration/registryFormat.ts) (Zirkular-Import-frei).
- **Bewusst weggelassen** (kein Sinn für Skills/Regeln): semantische/Embedding-Suche, Quickfilter-Pillen, XLSX-Export, Status-Gruppierung, Spalten-Header-Filter. Prompt-Vorschau bleibt Skills-Karten-spezifisch; Regel-Löschen weiterhin im Editor (mit Verwendungs-Warnung).

