# Changelog-Archiv — TeamFlow Local App

Ältere Versionsblöcke (append-only, chronologisch absteigend). Die jüngsten Versionen stehen im Root-[CHANGELOG.md](../CHANGELOG.md). Bump-Regeln + Architektur: [CLAUDE.md](../CLAUDE.md).

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

### v2.75.0 — Batch-Generierung von Gutachten-Entwürfen (Teil B) (Juni 2026)

MINOR-Bump v2.75.0 — aufbauend auf der Aufnahme (v2.74.0) erzeugt der Gutachter für eine kleine Antragsmenge (~10) **sequenziell Gutachten-Entwürfe** über den vorhandenen Workflow-Runner — eine **dünne Schleife**, KEIN zweiter Generierungs-/Prompt-Pfad, KEINE Auto-Freigaben/Modifier/Retries. Hinter Feature-Flag `gutachtenWorkflow` (**nur dev**). EIN aktiver Job, additiver IDB-Store, `WorkflowRun`-Format unverändert.

- **Service-Schicht** ([src/core/services/gutachten-batch/](src/core/services/gutachten-batch/)): `runBatch`-Runner (sequenziell, je Antrag A oder A–G) mit **injizierbarer `erzeugeAbschnitt`-Dep** → Tests ohne LLM. Reine `job-state`-Übergänge, `mengen`-Berechnung (bereit/ohne-VB/bereits-Stand), `batch-store` (`kv` `gutachten-batch:aktiv`, kein Version-Bump — Pitfall #29). **Idempotenz** vollständig in `erzeugeAbschnitt` (vorhandene Stände — Entwurf ODER Freigabe — werden übersprungen). Transport-Verlust ⇒ Job **pausiert** (nicht abgebrochen), Wiederaufnahme ab `aktiverIndex`.
- **`vorherigeAbschnitte`-Quelle als Parameter** ([context-provider.ts](src/plugins/antraege/gutachten/context-provider.ts)): 5. Positions-Param `quelle: 'freigegeben' | 'entwurf'` (Default `'freigegeben'`). Im Batch mangels Freigaben die im selben Lauf erzeugten **Entwürfe** der Vorgänger, im Prompt mit „(Entwurf)"-Marker. Einzige bewusste Abweichung vom Einzellauf; Default-Pfad **byte-identisch**.
- **Batch-lokaler Disk-Spiegel** ([gutachten-mirror.ts](src/core/services/gutachten-batch/gutachten-mirror.ts)): nur die Batch-Schleife schreibt jeden Entwurf zusätzlich als `ZAH/antraege/{FKZ}/gutachten/{stepId}-{slug}.md` (best-effort; der Einzellauf-Persistenzpunkt bleibt unangetastet).
- **Hook + UI** ([src/plugins/antraege/gutachten-batch/](src/plugins/antraege/gutachten-batch/)): `useBatchJob` baut die **reale** `erzeugeAbschnitt`-Dep aus denselben Primitiven wie der Einzellauf (`runSkill` → `runRegelChecks` → `applyGeneration` → `putWorkflowRun`, persönlicher Tweak via `composeSkillPrompt`); Transport ausschließlich über `bridge.getActiveTransport()` (keine eigene Wahl). `buildStammdaten`/`buildSkillMap` nach [skill-context.ts](src/plugins/antraege/gutachten/skill-context.ts) extrahiert (eine Quelle). Start-Dialog (Mengen/Ausschlüsse, „Nur A"/„A–G", Transport-Status) + Monitor (Live-Status, Pausieren/Fortsetzen/Abbrechen, Link je Zeile zur Gutachten-Sektion). `AufnahmeHost` (page-level) hält den Job über das Schließen des Overlays hinweg; Reload bietet `laeuft`/`pausiert`-Jobs als fortsetzbar an. **KEINE** Review-Queue/Facette.
- **Bewusst verschoben**: Orama-Indexierung der persönlichen Dokumente, Review-Queue-Facette an der Antragstabelle, Overnight-/Hintergrundlauf, TV-spezifisches Dokument-Scoping.

### v2.74.0 — Einfache ZIP-Aufnahme von Antragsdokumenten (Teil A) (Juni 2026)

MINOR-Bump v2.74.0 — der Gutachter bringt seine Antragsdokumente als **ZIP** mit (Vorhabensbeschreibungen + weitere Dokumente, Dateiname = FKZ + Name) und nimmt sie über einen schlanken, **rein dateibasierten** Flow in seinen **persönlichen Ordner** auf. KEIN LLM, KEINE Indexierung, KEINE Triage-Pipeline. Hinter Feature-Flag `gutachtenWorkflow` (**nur dev**); Button „Aufnehmen" im Förderanträge-Header öffnet ein Overlay. Erster Baustein für die Batch-Generierung (Teil B folgt). Additiv, **keine Migration**, **nichts Neues in IDB** außer trivialem UI-Zustand.

- **Ordner-Layout** ([personal-layout.ts](src/core/services/personal-storage/personal-layout.ts)): EINE Quelle für `ZAH/antraege/{FKZ}/dokumente/*.md` + `ZAH/eingang/*.zip|.manifest.json` (unter dem bestehenden `ZAH/`-Namespace). FS-Schreiber [antraege-eingang.ts](src/core/services/personal-storage/antraege-eingang.ts) über `atomicWrite` (`skipBackup`).
- **Reine, getestete Module** ([src/plugins/antraege/aufnahme-einfach/](src/plugins/antraege/aufnahme-einfach/)): `zip-durchlauf` (jszip flach, `__MACOSX`/`.DS_Store`/`Thumbs.db`-Skip, ZIP-in-ZIP melden, `.doc` ablehnen — nur `.pdf`/`.docx`), `dateiTyp` (statische Keyword→Typ-Map: VB/TVB/Stellungnahme/unklar), `frontmatter` (`fkz/typ/quelle/konvertiert_am`), `manifest` (löschbar erst wenn nichts mehr offen).
- **Flow**: Drop (Dateien oder EIN ZIP) → reduzierte Triage-Liste (FKZ-Chip + Inline-Eingabe, Typ-Pills, Status — KEINE Bulk/Filter/Konfidenz) → „Konvertieren & ablegen" (sequenziell `DocConverter` → `.md`, Fortschritt + Abbrechen, Fehlerisolation) → Abschluss (N/M/K + Merkliste FKZ mit neuer VB). Original-ZIP wird vor der Verarbeitung nach `eingang/` kopiert; Bestandsblock erlaubt Löschen erst bei Vollständigkeit.
- **VB-Auflösung erweitert** ([vbDokument.ts](src/plugins/antraege/kurzfassung/vbDokument.ts) `resolveVb`/`pickVb`): bei fehlender indexierter VB Fallback auf `antraege/{FKZ}/dokumente/` mit Frontmatter `typ: vorhabensbeschreibung` (jüngste, über alle `knownIds`). **IDB hat Vorrang** → Verhalten für Bestandsnutzer byte-identisch. `useGutachtenWorkflow` additiv umgestellt; `buildKurzfassungContext` aus VerbundDetail extrahiert (eine Quelle für Einzellauf + Batch).

### v2.73.0 — Gutachten-Workflow A–G: deterministischer Runner über Registry-Skills (Juni 2026)

MINOR-Bump v2.73.0 — der Kurzfassung-Testballon (nur Abschnitt A) wird zum vollständigen **Gutachten-Workflow A–G**: eine **deterministische State Machine**, die Registry-Skills als Schritte verkettet (KEIN LLM-gesteuerter Agent — LLM nur INNERHALB der Schritte; Ablauf/Gates/Persistenz sind Code+Daten). Ein Gutachter arbeitet A→G sequenziell ab, gibt jeden Abschnitt einzeln frei, kann unterbrechen/wiederaufnehmen und exportiert am Ende alle freigegebenen Abschnitte an ihre Anker in die Word-Vorlage. Hinter Feature-Flag `gutachtenWorkflow` (**nur dev**), löst die Kurzfassung-Sektion per else-if-Präzedenz ab. Additiv, **keine Migration bestehender Stores**.

- **Skill-Seeds B–G** ([seed.ts](src/core/services/skill-registry/seed.ts)): sechs neue `SkillRecord`-Seeds (Hintergrund/Stand der Technik/Lösungsweg, Technische Risiken, Markt, Unternehmensgegenstand, Ergebnisverwertung, Technologiekompetenz) mit `{{vorherigeAbschnitte}}`-Slot. Regeln nur über vorhandene Typen + neuer Typ **`absatz_min`** ([check-engine.ts](src/core/services/skill-registry/check-engine.ts), [types.ts](src/core/services/skill-registry/types.ts), [selectors.ts](src/core/services/skill-registry/selectors.ts)). **Additiver Seed-Merge** ([storage.ts](src/core/services/skill-registry/storage.ts) `mergeMissingSeeds`): ergänzt fehlende Skills/Regeln per `id` in kuratierte Bestands-Registries, überschreibt NIE, idempotent; Kurator-Hinweis (`ergaenzt`).
- **Workflow-Runner** ([src/plugins/antraege/gutachten/](src/plugins/antraege/gutachten/)): statische `ZIM_EP_WORKFLOW`-Definition, reine Reducer (`runner.ts`: generate/pruefen/freigeben/erneutOeffnen/weiterschalten/verwerfen/uebernehmen), `WorkflowRun` im `kv`-Store unter `gutachten-workflow:<aktenzeichen>` (**kein** neuer Object-Store/Version-Bump, Pitfall #29). Persist nach jedem Statuswechsel, nie während des Streams. „Erneut öffnen" setzt nur den Schritt zurück; spätere bleiben freigegeben + dezenter Konsistenz-Hinweis (`freigabeHash`).
- **Kontext-Slot `vorherigeAbschnitte`** ([context-provider.ts](src/plugins/antraege/gutachten/context-provider.ts) + [run-skill.ts](src/core/services/skills/run-skill.ts)): freigegebene frühere Abschnitte (je ~2000 Zeichen gekürzt) als Konsistenz-Referenz. A bleibt byte-identisch (kein Platzhalter im A-Template).
- **Migration** ([kurzfassung-migration.ts](src/plugins/antraege/gutachten/kurzfassung-migration.ts)): ein alter `gutachten-kurzfassung:<key>`-Lauf wird beim ersten Öffnen als Schritt A übernommen — **lesend**, Original-Record unangetastet.
- **UI** (generalisiert aus der Kurzfassung-Karte, NICHT dupliziert): `GutachtenSection` (Kopf + Fortschritt + Export), `AbschnittStepper` (typografisch A–G), `AbschnittRow` (zugeklappte freigegebene Zeilen), `SectionReviewCard` (= verallgemeinerte `ReviewCard`), `ResumeLine`. Degradation ohne Transport: freigegebene Stände + Export bleiben nutzbar.
- **Mehrfach-Anker-Export** ([fill-template.ts](src/core/services/gutachten-vorlagen/fill-template.ts) + [anchor-mapping.ts](src/core/services/gutachten-vorlagen/anchor-mapping.ts)): fügt ALLE freigegebenen Abschnitte an ihren Ankern ein (pro Abschnitt frischer Scan → reihenfolge-stabil, dokument-unabhängig; fehlender Anker → übersprungen+Warnung). EP-Anker-Mapping **verifiziert gegen die echte `Gutachten_EP.docx`**. VB-Vorlage (abweichende E/F/G, pro Partner wiederholt) = dokumentierter Folgeschritt. Vorlagen-Dialog um „Abschnitte"-Block erweitert.
- **Retrieval (Schritt 4) bewusst weggelassen** in v1: ein sauberer Pro-FKZ-Tag-Filter ist auf dem aktuellen Orama-Schema nicht möglich (`tags` = komma-gejointer String; `where` kann nicht containment-filtern); Schema-Umbau + Reindex nicht in v1. Saubere Seam (`retrievalQueries`) bleibt. Offen für Folgephasen: VB-Mapping + per-Partner-Sektionen, Batch-Modus, Eval-Harness.

### v2.71.1 — Kurzfassung: VB-Cap von 24k auf 100k Zeichen angehoben (Juni 2026)

PATCH-Bump v2.71.1 — der VB-Abschneide-Cap vor dem LLM-Call (`VB_CHAR_CAP` in [run-skill.ts](src/core/services/skills/run-skill.ts)) war mit 24.000 Zeichen (~4–5 Seiten) viel zu konservativ: bei längeren Vorhabensbeschreibungen sah das LLM den Schluss nie, die Kurzfassung verpasste Aspekte (UI-Hinweis „VB für die Analyse gekürzt"). Cap auf **100.000 Zeichen** angehoben — dimensioniert fürs kleinste produktiv genutzte Kontextfenster (lokales LLM ~50k Tokens: ~33k Tokens VB + ~2k Output + Overhead bleibt mit Headroom darunter; Cloud 128k ist Superset). Eine vollständige ZIM-Verbund-VB (~25 Seiten ≈ 75k Zeichen) geht jetzt komplett durch; `vbGekuerzt` greift nur noch bei echten Ausreißern. Der Cap bleibt als sichtbarer Guard erhalten (Entfernen würde stillen serverseitigen Context-Shift statt eines ehrlichen Hinweises bedeuten).

### v2.71.0 — Kurzfassung: Vorfassungen vergleichen & zurückholen (Juni 2026)

MINOR-Bump v2.71.0 — bisher überschrieb jeder Klick auf „Neu" / „Kürzer" / „Länger" in der Kurzfassung-Review die aktuelle Fassung ersatzlos (in State **und** IndexedDB); die vorige war weg. Jetzt wird vor jeder Re-Generierung die noch aktive Fassung als Schnappschuss aufbewahrt — der Bearbeiter kann frühere Fassungen vergleichen und per „Diese Fassung übernehmen" wieder zur aktiven machen (deckt „evtl. war die alte doch ok" ab).

- **Datenmodell** ([types.ts](src/plugins/antraege/kurzfassung/types.ts)): neues `KurzfassungVersion`-Interface + optionale Felder `verlauf?` (bounded, älteste zuerst) und `modifier?` auf `KurzfassungRecord`. Additiv & optional → alte Records ohne `verlauf` laden weiter. **Kein** neuer Object-Store/Version-Bump — der Verlauf lebt im selben `kv`-Record `gutachten-kurzfassung:<key>` (Pitfall #29, `file://`-`onblocked`-Vermeidung).
- **Reine Helfer** ([kurzfassung-verlauf.ts](src/plugins/antraege/kurzfassung/kurzfassung-verlauf.ts), getestet): `appendVerlauf` (Snapshot anhängen, Cap `MAX_VERLAUF = 5`), `restoreVersion` (Swap: gewählte Vorfassung wird aktiv, bisher aktive wandert in den Verlauf — nichts geht verloren; Status zurück auf `entwurf`), `snapshotOf`, `versionLabel`, `formatDate`.
- **Hook** ([useKurzfassung.ts](src/plugins/antraege/kurzfassung/useKurzfassung.ts)): Generierung schreibt `verlauf`/`modifier`; neue self-catching Action `uebernehmen(index)`.
- **UI** ([VersionVerlauf.tsx](src/plugins/antraege/kurzfassung/VersionVerlauf.tsx)): aufklappbarer „Vorfassungen (N)"-Block unter der aktuellen Fassung — je Fassung Modifier-Label, Datum, Satz-/Zeichenzahl (direkter Vergleich), Prüf-Ergebnis, Volltext + „Diese Fassung übernehmen". Eingebunden in [ReviewCard](src/plugins/antraege/kurzfassung/ReviewCard.tsx).

### v2.70.0 — Dokumenten-Aufnahme: Konvertierung prüfen + Warnung bei Konvertierungsproblemen (Juni 2026)

MINOR-Bump v2.70.0 — beim Ablegen einer docx/pdf für die Kurzfassung wird die Datei intern nach Markdown konvertiert (pdfjs für PDF-Text, mammoth+turndown für DOCX). Bisher war das eine Black Box: mammoth-Warnungen wurden verworfen, gescannte/textlose PDFs unbemerkt, Tabellen/Grafiken kommentarlos verloren. Da die KI **nur den extrahierten Text** sieht, erfährt der Bearbeiter jetzt von Konvertierungsproblemen und kann den konvertierten Text prüfen — bei Bedarf extern korrigieren (z. B. PDF → OCR/DOCX) und neu hochladen.

- **Konvertierungs-Report** ([conversion-report.ts](src/core/services/converter/conversion-report.ts), reine + getestete Funktion): `charCount`, `tableCount`, `imageCount` + deutsche Warnungen. Erkennt gescanntes PDF (0 Zeichen) bzw. bildbasiertes PDF (Ø < 80 Zeichen/Seite) als **Warnung**; Tabellen/Bilder + mammoth-Messages als **Hinweis** (dedupliziert, Cap 5). Wird am Dokument persistiert (`DocumentMeta.conversion`, optional → rückwärtskompatibel).
- **Review-Dialog** ([KonvertierungReviewDialog](src/core/components/KonvertierungReviewDialog.tsx)): zeigt die Warnungen + das tatsächlich extrahierte Markdown (via `MarkdownRenderer`, Frontmatter entfernt).
- **Anzeige**: Im „VB vorhanden"-Zustand der Kurzfassung-Sektion ([KurzfassungSection](src/plugins/antraege/kurzfassung/KurzfassungSection.tsx)) Dateiname + Warn-Banner (bei Problemen) + „Konvertierung prüfen" + „VB ersetzen" (neuestes VB-Dokument gewinnt). Zusätzlich „Konvertierung prüfen"-Link in der Aufnahme-Zeile ([DokumentAufnahme](src/core/components/DokumentAufnahme.tsx)).

### v2.69.2 — Verbund-Detail: TVs beim Erstaufruf eingeklappt (Juni 2026)

PATCH-Bump v2.69.2 — beim ersten Öffnen einer Verbund-Detailseite sind jetzt alle Teilvorhaben **eingeklappt** ([VerbundDetail](src/plugins/antraege/VerbundDetail.tsx)) — mehr Übersicht beim ersten Blick (Stammdaten, Status, TV-Liste, Kurzfassung), statt direkt in einem aufgeklappten TV zu landen.

- Echter Verbund: beim Erstaufruf wird kein TV vorab expandiert (auch nicht der gezielt angeklickte `initialExpandedTvAz`). Ein TV öffnet sich erst per Klick.
- Navigation **im selben Verbund** (Prop-Wechsel ohne Verbund-Wechsel) expandiert den angesteuerten TV weiterhin — getrennt über `lastVerbundIdRef` (Erstaufruf vs. In-Verbund-Navigation).
- Pseudo-/Solo-Verbund unverändert: dessen einziger TV bleibt aufgeklappt (sonst wäre die Seite leer, da die Stammdaten dort im TV-EckdatenCard liegen).

### v2.69.1 — Antrag-Detail: Unterprogramm-Name statt -Nummer anzeigen (Juni 2026)

PATCH-Bump v2.69.1 — in der Detail-Ansicht zeigt das Feld „Unterprogramm" jetzt den sprechenden Namen (z.B. „ZIM FuE-Projekte 2025") statt der nackten Nummer („138"). Betrifft die Verbund-Stammdaten ([VerbundDetail](src/plugins/antraege/VerbundDetail.tsx)) und die TV-Eckdaten ([EckdatenCard](src/plugins/antraege/EckdatenCard.tsx) / [eckdatenConfig](src/plugins/antraege/eckdatenConfig.ts)).

- Neuer Hook [`useUnterprogrammLabels`](src/plugins/antraege/useUnterprogrammLabels.ts) liefert die Code→Name-Map der Unterprogramme eines Programms aus IDB (`listUnterprogramme`), mit Modul-Cache pro Programm (jede TV-EckdatenCard löst sonst denselben IDB-Read aus).
- Fallback: ist zu einem Code kein Label registriert (z.B. Unterprogramme nicht importiert), bleibt die Nummer stehen.
- `getFieldDisplayInfo(field, antrag, opts)` um `opts.unterprogrammLabels` erweitert; bei aufgelöstem Label entfällt die Mono-Schrift (Klartext-Name statt ID-Optik).

### v2.69.0 — Skill-Registry v1: Skills & Qualitätsregeln als Kurator-Daten mit Tuning-Schleife (Juni 2026)

MINOR-Bump v2.69.0 — der Gutachten-Testballon wird vom hartcodierten Prompt+Check zur **Kurator-pflegbaren Registry**. Skills (Prompt-Vorlage, Modifikatoren, Slots) und parametrisierte Qualitätsregeln (Zeichen-/Satz-Limits, verbotene Muster, …) leben jetzt als Daten in `_intern/skills/registry.json`; jede Regel erzeugt aus **einer Quelle** sowohl den Prompt-Hinweis (KI zielt darauf) als auch den Check (System prüft es) — keine Drift. Neue Kurationsseite „Skill-Verwaltung" + Sandbox-Testlauf am echten Antrag (Mockups: `_design/handoff/skill-verwaltung/`).

- **Neuer Service** [src/core/services/skill-registry/](src/core/services/skill-registry/): Datenmodell (`SkillRecord`, `QualitaetsRegel`, vorwärts-kompatibel — unbekannte Regel-Typen werden behalten, nicht verworfen), deklarative Check-Engine (`runRegelChecks` + `buildPromptVorgaben`, gemeinsame `splitSentences`-Heuristik), Seed (aus dem Testballon abgeleitet) und Share-IO (`atomicWrite`/`readText` + IDB-Cache, Muster `feedbackSharedFile.ts`).
- **Neues Plugin** `skill-verwaltung-kuration` (Flag `skillVerwaltung`, `category: 'tools'`): Tabs Skills / Qualitätsregeln, Skill-Editor (live „Formale Vorgaben" aus den Regeln), Regel-Bibliothek mit Inline-Editor + „verwendet in", Sandbox-Testlauf. Sichtbar in **dev + kurator + pl**.
- **Schreib-Berechtigung** über neuen Helper `canEditSkillRegistry()` ([feature-flags.ts](src/config/feature-flags.ts)) — komponiert aus bestehenden Primitiven (kein neues Auth-Muster): pl editiert via `datenShareSchreibrecht`, kurator/dev via aktiver Kurator-Session; prod/demo read-only.
- **Migration**: `skills/checks.ts` + `kurzfassung-skill.ts` entfernt; der Kurzfassung-Skill ist jetzt der Seed, `run-skill.ts` ist registry-getrieben. Die Kurzfassungs-Sektion lädt den Skill aus der Registry (Cache→Seed-Fallback) — Verhalten für den Gutachter unverändert. Persistierte Läufe tragen optional `skillId`/`skillVersion` (alte Läufe laden unverändert).
- **Seed-on-open**: beim ersten Öffnen mit Schreibrecht wird der Startbestand (Kurzfassung-Skill + 5 Default-Regeln, inkl. der Praxis-Befunde `zeichen_max 1000` + `satzlaenge_max 25`) auf den Share persistiert.

### v2.68.5 — Förderanträge-Tabelle: TIB-Spalte (Bearbeiter-Kürzel) im Spalten-Picker wählbar (Juni 2026)

PATCH-Bump v2.68.5 — die MA-/Bearbeiter-Spalte (`tib_kuerz`) ist jetzt regulär über den „Spalten"-Picker der Tabellen-Ansicht wählbar ([tableColumns](src/plugins/antraege/tableColumns.tsx) + [AntraegeMain](src/plugins/antraege/AntraegeMain.tsx)). Use-Case: bei aktivem Bearbeiter-Filter + „Auch außerhalb meiner Anträge suchen" sieht der User jetzt, von welchem TIB ein fremder Antrag stammt.

- Spalte (Label **„TIB"**, key `tib_kuerz`) sitzt in der Registry direkt nach FKZ → erscheint im Picker als zweiter Eintrag und in der Tabelle als zweite Spalte. Default aus.
- `resolveAntragTableColumns` auf Set-Union vereinfacht: im „alle"-/Übersichtsmodus (`showMaColumn`) wird die Spalte weiterhin automatisch erzwungen, ohne Duplikat falls sie zugleich im Picker gewählt ist.
- Im „alle"-Modus (Spalte ohnehin erzwungen) wird der Eintrag aus dem Picker ausgeblendet, damit keine wirkungslose Checkbox entsteht; in „meine Anträge" bleibt sie wählbar.
- Vorher rendered-Header-Label dieser Spalte war „MA" → jetzt einheitlich „TIB" (eine Spaltendefinition für Auto-Show + Picker).

### v2.68.4 — Förderanträge-Header: „Auch außerhalb meiner Anträge suchen" eine Zeile höher (Juni 2026)

PATCH-Bump v2.68.4 — die Checkbox „Auch außerhalb meiner Anträge suchen" ([AntraegeHeader](src/plugins/antraege/AntraegeHeader.tsx)) sitzt jetzt in der Such-Zeile (rechts neben dem Ähnlichkeits-Select) statt in einer eigenen Zeile darunter — spart vertikalen Platz.

- Belegt denselben Slot wie die „inaktive MAs"-Checkbox; beide schließen sich gegenseitig aus (`inaktive MAs` nur ohne Bearbeiter-Filter, „außerhalb" nur **mit** aktivem Bearbeiter-Filter + aktiver Suche), daher kein Layout-Konflikt.

### v2.68.3 — Gutachten-Aufnahme: Verbund- & TV-FKZ akzeptieren, sonst manuelle Zuordnung (Juni 2026)

PATCH-Bump v2.68.3 — die Dokumenten-Aufnahme der Kurzfassung ([DokumentAufnahme](src/core/components/DokumentAufnahme.tsx)) erkennt jetzt **Verbund-FKZ UND alle TV-FKZ** als zugehörig:

- **Substring-Match** auf dem normalisierten Dateinamen gegen die bekannten Kennungen (Verbund-ID + alle TV-Aktenzeichen) — fängt auch Verbund-IDs wie `ZEP…`, die der 16XX-FKZ-Extraktor nicht kennt.
- Ist der Dateiname **nicht eindeutig** zuzuordnen, ordnet der Bearbeiter per Klick zu („**Diesem Verbund zuordnen**") statt ein FKZ zu tippen (Prinzip „lieber entscheiden lassen als falsch raten").
- Hintergrund: dieselbe Projektbeschreibung wird oft je TV mit eigenem FKZ eingereicht (alles derselbe Verbund); TV-spezifische Dateien (z.B. Nachlieferungen) tragen das TV-FKZ.
- `classifyFkz(filename, knownIds[])` liefert `match` / `ambig`; `KurzfassungContext.knownIds` = Verbund-ID + TV-Aktenzeichen. Dev-only Testballon.

### v2.68.2 — Gutachten-Kurzfassung auf Verbund-Ebene (statt pro Teilvorhaben) (Juni 2026)

PATCH-Bump v2.68.2 — fachliche Korrektur: Ein Gutachten / eine Kurzfassung wird pro **Verbund** erstellt (die Vorhabensbeschreibung existiert nur einmal pro Verbund), nicht pro Teilvorhaben. Im Gutachten werden TV-Infos (Titel, Antragsteller) aufgelistet.

- Die Sektion „Kurzfassung (Gutachten)" sitzt jetzt in [VerbundDetail](src/plugins/antraege/VerbundDetail.tsx) **oberhalb der Felder-Liste** (vorher ganz unten in `TvDetailBlock`, pro TV).
- Persistenz + VB-Relation laufen über die **Verbund-ID** (bzw. das Aktenzeichen bei Solo-/Pseudo-Verbünden); `KurzfassungRecord.key` statt `aktenzeichen`.
- [`DokumentAufnahme`](src/core/components/DokumentAufnahme.tsx) generalisiert: `relationTag` (Verbund-ID) + `knownFkz` (Aktenzeichen aller TVs) — eine VB „gehört hierher", wenn ihr Datei-FKZ zu irgendeinem TV des Verbundes passt.
- Skill-Stammdaten enthalten Verbund-FKZ + Akronym + Titel + Konsortialführer + die TV-Liste; die DOCX-Feld-Zuordnung nutzt Verbund-FKZ/-Titel/-Konsortialführer.
- Dev-only Testballon (`gutachtenKurzfassung`) — keine Migration (es existieren noch keine produktiven Records).

### v2.68.1 — Antrag-Detail: „Alle Felder" einklappbar (Juni 2026)

PATCH-Bump v2.68.1: Die Feldliste im Antrag-Detail ([AlleFelderSection](src/plugins/antraege/AlleFelderSection.tsx)) ist jetzt per Chevron **einklappbar** (Default eingeklappt, Wahl pro Browser persistiert in `teamflow_antrag_allefelder_open`). Bei 120–300 Feldern war das Detail-Panel sonst sehr lang; eingeklappt sind die darunterliegenden Sektionen (Netzwerk, Dokumente, **Kurzfassung-Testballon**) ohne langes Scrollen erreichbar. Die Kopfzeile zeigt weiter „N Felder gesamt · M mit Werten".

### v2.68.0 — Gutachten-Testballon: Kurzfassung-Skill (Dokumenten-Aufnahme → Skill → Review → DOCX-Vorlage) (Juni 2026)

MINOR-Bump v2.68.0 — erster „Mini-Agent": Auf der Förderantrags-Detailseite erstellt ein Gutachter KI-gestützt die **Kurzfassung** eines ZIM-Gutachtens. Kompletter Durchstich, hinter Feature-Flag `gutachtenKurzfassung` (**nur dev**; demo/prod/kurator/pl = false). Additiv, keine Migration. Leitprinzip: Bausteine 1/3/4 funktionieren **ohne LLM**, nur die Generierung (Baustein 2) degradiert mit klarer Meldung, wenn kein Transport erreichbar ist.

- **Skill als Datenstruktur** (registry-ready, „static data over logic"): [src/core/services/skills/](src/core/services/skills/) — `SkillDefinition` + Prompt-Template (ZIM-Kontrakt, drei `###`-Ausgabeteile), `parseSkillOutput` (tolerant), deterministische Checks ([checks.ts](src/core/services/skills/checks.ts): Satzanzahl 8–12, keine Aufzählungen, Passiv-Hinweis — kein LLM), transport-agnostischer Runner ([run-skill.ts](src/core/services/skills/run-skill.ts): Ladder `submitConversation?` → `submitMessage`, non-streaming, Abort, VB-Cap 24k).
- **Wiederverwendbare Dokumenten-Aufnahmefläche** ([DokumentAufnahme.tsx](src/core/components/DokumentAufnahme.tsx)): Drag&Drop (PDF/DOCX), FKZ aus Dateiname (`extractFkz`, wiederverwendet), drei Fälle (match / anderer Antrag / kein FKZ → manuelle Zuordnung), Typ-Pills. Pipeline Converter → Dokumente-Store → Such-Index mit `tags:[fkz, typ]`. **Antrag-Zuordnung rein über die FKZ-Tag-Relation — kein Schreiben in den CSV-`Antrag`-Record.**
- **Review-/Freigabe-UI** ([src/plugins/antraege/kurzfassung/](src/plugins/antraege/kurzfassung/)): Zustände „VB fehlt" (eingebettete Aufnahme) / „VB vorhanden" / Review (Quellenanalyse, finaler Text, Prüf-Checkliste, Aktionen Freigeben/Neu/Kürzer/Länger/Prüfen). In [TvDetailBlock](src/plugins/antraege/TvDetailBlock.tsx) gegated eingebunden.
- **DOCX-Vorlagen-Füller** ([src/core/services/gutachten-vorlagen/](src/core/services/gutachten-vorlagen/)): `jszip` auf `word/document.xml`-String — Run-Splitting (Platzhalter über `<w:r>`-Grenzen, `&F:…&` / `&amp;F:…&amp;`), statische Feld-Mapping-Tabelle, Anker-Einfügung („Kurzfassung der Projektbeschreibung", whitespace-tolerant; fehlt der Anker → Vorlage trotzdem erstellbar), Dry-Run für die Dialog-Vorschau. Nur-lesende Verzeichnis-Quelle (eigener IDB-Slot, NICHT in `dms-sources`), Ablage in `ZAH/gutachten/` (Download-Fallback). **Keine neue Dependency.**
- **Persistenz** via `kv`-Präfix-Key `gutachten-kurzfassung:<aktenzeichen>` (wie `doc:*`) — bewusst **kein** dedizierter Object-Store/`version`-Bump (vermeidet das `file://`-`onblocked`-Upgrade-Risiko bei parallel offenen Varianten).
- `AntragDokumentTyp` additiv um `vorhabensbeschreibung` / `teilvorhabensbeschreibung` / `stellungnahme` erweitert (rückwärtskompatibel); `useDokumenteStore.add()` liefert jetzt die Doc-ID zurück.
- 33 neue Vitest-Tests (checks inkl. Abkürzungen, Parser, FKZ-Zuordnung, fill-template Run-Splitting+Escaping); tsc clean, gesamte Suite grün.

### v2.67.4 — Chat: einklappbare Eingaben, resizable Sidebar, dichtere Liste, Composer-Aufräumen (Juni 2026)

PATCH-Bump v2.67.4 — UX-Feinschliff am Chat:

- **Lange Eingaben einklappbar** ([UserMessage](src/plugins/chat/components/UserMessage.tsx)): User-Nachrichten > 360 Zeichen / > 6 Zeilen werden per `-webkit-line-clamp` auf ~6 Zeilen gekürzt, Umschalter „Mehr anzeigen" / „Weniger anzeigen".
- **Verlauf-Sidebar horizontal resizable** ([ConversationSidebar](src/plugins/chat/components/ConversationSidebar.tsx)): Griff an der rechten Kante (`ew-resize`), Breite 200–560 px, in `localStorage` (`tf-chat-sidebar-w`) persistiert. Umsetzung über `--side2-w`-Custom-Property, damit der Rail-Collapse (`width:0`) per Spezifität weiter greift.
- **Dichtere Konversations-Liste**: kleinere Schrift (`--tf-text-sm`) + geringere Zeilenhöhe (min 28 px) → mehr Chats sichtbar; `title`-Tooltip mit vollem Namen bei abgeschnittenem Titel.
- **Composer aufgeräumt**: separater Büroklammer-Button entfernt (Datei-Anhängen liegt im „+"-Menü „Dateien hinzufügen"; Drag&Drop bleibt).
- **System-Prompt-Resize ohne künstliche Kappung**: Obergrenze jetzt = sichtbarer Bildschirm (aus der Popover-Position berechnet) statt fixer 760×560 px.

### v2.67.3 — Chat: System-Prompt-Popover mit echten Edge-Resize-Handles (Juni 2026)

PATCH-Bump v2.67.3: Der Corner-Griff aus v2.67.2 ließ sich schlecht nach oben ziehen. Ersetzt durch **zwei Standard-Kanten-Handles** ([SystemPromptPopover](src/plugins/chat/components/SystemPromptPopover.tsx)): obere Kante (`ns-resize`) ändert die Höhe (wächst nach oben, da bottom-anchored), rechte Kante (`ew-resize`) die Breite. Total-Delta-Drag (kein Drift), Handles liegen im 6px-Padding-Rand → keine Klick-Kollision mit Tabs/X. Clamp 320–760 × 120–560 px.

### v2.67.2 — Chat: System-Prompt-Popover (schließbar/resizable/Vorschau) + Provider-Label (Juni 2026)

PATCH-Bump v2.67.2 — Verbesserungen am [SystemPromptPopover](src/plugins/chat/components/SystemPromptPopover.tsx) + Composer-Footer:

- **Schließbar ohne Speichern**: expliziter X-Button + `Escape` + Außenklick verwerfen den Entwurf (vorher nur „Speichern").
- **Resizable**: Griff oben-rechts (`⤢`, `ne-resize`) zieht das Popover **nach rechts** (Breite) und **nach oben** (Höhe) — Pointer-Drag mit Clamp (320–760 × 120–560 px); das Popover ist bottom-anchored, daher wächst Höhe nach oben.
- **Edit/Vorschau-Umschalter**: „Vorschau" rendert den Prompt als Markdown (marked + `sanitizeHtml`, `.ans`-Styling), damit man Struktur/Formatierung sieht.
- **Footer-Label** ([Composer](src/plugins/chat/components/Composer.tsx)): „via Cloud API" entfernt. Neu `providerLabel()` → **„internes GPT-OSS 120B"** (Streamlit-Bridge) bzw. **„lokaler LLM-Server"** (dev, lokaler llama.cpp/localhost). Cloud/OpenRouter-Namen werden nicht mehr angezeigt (in Prod ohnehin per `validateConfig` gesperrt).

### v2.67.1 — Chat-Reskin-Fix: fehlende Design-Tokens (Juni 2026)

PATCH-Bump v2.67.1: Der Chat-Reskin (v2.67.0) sah nicht wie das Handoff aus — kein Padding, keine Card-Borders, kein Floating-Shadow am Composer, falsche Schriftgrößen, ungerundete Pills, voll-breite statt kontrollierter Lese-Spalte.

**Ursache:** [chat.css](src/plugins/chat/chat.css) wurde 1:1 aus dem Handoff portiert und nutzt eine Token-Ebene (Spacing-/Type-Skala, `--tf-radius-pill`, `--tf-shadow-dialog`, `--tf-border-thin`, `--tf-weight-*`, `--tf-font-*`, Motion), die das Handoff-`colors_and_type.css` zwar definierte (Kommentar „Source: src/theme.css"), die aber **nie in der echten [theme.css](src/theme.css) existierte** — diese liefert nur Farb-Tokens + `--tf-radius/-lg/-sidebar-w`. Ein undefiniertes `var()` ohne Fallback macht die **gesamte** Deklaration ungültig → `font:`-Shorthands, `border: var(--tf-border-thin)…`, `box-shadow`, alle `padding/gap` fielen aus.

**Fix:** Die fehlenden Tokens lokal auf `.chat-app` gescopt definiert (Werte aus dem Handoff) — kein Leak in andere Plugins, Farb-Tokens (inkl. Dark) erben weiter aus theme.css. Reine CSS-Ergänzung, kein TS/Logik-Touch.

### v2.67.0 — Chat-Reskin: RAG-Gutachter-Oberfläche (Design-Handoff) (Juni 2026)

MINOR-Bump v2.67.0: Umsetzung des hi-fi Design-Handoffs aus `_design/handoff/chat` — die Chat-Seite wird zur RAG-Gutachter-Oberfläche. Rein additiv, keine Migration (neue optionale `chat:conv:*`-/`chat:settings`-Felder entstehen lazy). 5 Commits (Reskin PR-1…5/5):

- **Styling**: Co-located [chat.css](src/plugins/chat/chat.css) (Port aus dem Handoff, alle Regeln unter `.chat-app` gescopt, `--tf-*`-Tokens, Composer fest „floating", Gesprächsbreite 920px) — nach Vorbild [kompetenz-matrix.css](src/plugins/auslastung/components/kompetenz/kompetenz-matrix.css). `data-theme="dark"` + `prefers-reduced-motion` berücksichtigt.
- **Verlauf-Sidebar** (`.side2`): Suchfeld + Compose-Icon, Quick-Filter (Alle/Anträge/Angeheftet mit Count), Datums-Gruppen (Angeheftet/Heute/Letzte 7 Tage/Älter, [conversation-groups.ts](src/plugins/chat/conversation-groups.ts)), FKZ-Unterzeile, Pin-Toggle, Inline-Rename (friert Auto-Titel via `titleCustom` ein), Kontextmenü (Anheften/Umbenennen/Als-MD-kopieren/FKZ-lösen/Löschen).
- **Schwebender Composer** + Empty-State: „+"-Menü (Dateien, Werkzeuge: Archiv-Suche/Denkprozess/System-Prompt, Verzeichnis-Kontext), Paperclip, Archiv-Suche-Pill, Send↔Stop, Drag&Drop, Anhang-Pills; 4 Vorschlags-Chips.
- **RAG-Quellen** (real, soweit Daten da): strukturierte `ChatSource` aus Orama-Treffern (Titel, Relevanz %, Methode, generiertes Snippet mit «»-Highlight via [snippet.ts](src/plugins/chat/services/snippet.ts), FKZ aus Dateiname via [fkz-extractor](src/phase2/matcher/fkz-extractor.ts)). Quellen-Chips + „Verwendeter Kontext"-Aufklapper + Slide-over-[SourcePanel](src/plugins/chat/components/SourcePanel.tsx) mit „Antrag öffnen"-Deeplink (`useNavigation`). Inline-`[n]`-Zitate via Post-Pass auf dem marked-HTML ([citations.ts](src/plugins/chat/services/citations.ts), Tabellen/Code/Links bleiben erhalten) — Modell wird zum Zitieren angewiesen, UI bleibt ohne `[n]` sauber. Konversation wird automatisch mit dem dominanten FKZ verknüpft.
- **Nachrichten**: Denkprozess-Reconcile (Spinnerzeile „Sucht im Archiv …" bis Output, dann einklappbarer Reasoning-Block), Aktionsleiste (Copy/Regenerieren/Daumen hoch-runter lokal + Stats-Zeile).
- **Reuse**: bestehende Streaming-/Multi-Turn-/Anhang-/Stats-Logik (v2.65) unverändert; `sanitizeHtml` aus [MarkdownRenderer](src/ui/MarkdownRenderer.tsx) exportiert.

49 neue Unit-Tests (snippet/rag-sources/citations/conversation-groups/store-reskin). Weggelassen (bewusst, kein Backend): Assistenten-Auswahl, Teilen/Mehr-Menü, Diktier-Mikro.

### v2.66.0 — Chat-Server-Tuning: Qwen-Chat-Script, Thinking-Toggle, cache_prompt (Juni 2026)

MINOR-Bump v2.66.0: Lokales Qwen 3.6 35B-A3B (Thinking) auf llama.cpp war im Chat träge — User-Log (RTX 3060 12 GB) zeigte 108 s Prompt-Processing für einen 39k-Token-Anhang-Turn plus 210 s Generierung bis ans 4096-Token-Limit (überwiegend Denkprozess). Ursache: Der einzige Qwen-Server-Launcher war fürs **Indexieren** getunt (Port 9091, Kontext 8192, 4 Threads, Reasoning off).

- **Neues Script [Chat-Server-Qwen.bat](Chat-Server-Qwen.bat)** (chat-getunt, eigene `config-chat-qwen.json`, teilt Binary+GGUF mit den Indexier-Scripts): Port **9090** (App-Default „Intern API"), Kontext **49152** (App sendet bis ~40k Tokens: 24k-Zeichen-Historie + 60k-Zeichen-Anhänge), Threads **auto** (physische Kerne), KV **q8_0**, Reasoning **auto**, `--parallel 1`, **`-b 2048 -ub 2048`** (größter TTFT-Hebel bei CPU-MoE-Offload). In die Build-Kopier-Liste aufgenommen ([build-with-config.mjs](scripts/build-with-config.mjs)). Tuning-Guide inkl. `n_cpu_moe`-Tastanleitung + Erwartungswerten: **[docs/LLM_SERVER_SETUP.md](docs/LLM_SERVER_SETUP.md)**.
- **Thinking-Toggle im Chat** (Gehirn-Icon in der Input-Leiste, [ThinkingToggle.tsx](src/plugins/chat/components/ThinkingToggle.tsx)): Denkprozess an/aus, persistiert in `chat:settings` (`thinkingEnabled`, Default an), wirkt ab der nächsten Nachricht. Aus → DirectLLM sendet `chat_template_kwargs: { enable_thinking: false }` (llama.cpp/`--jinja`-Template-Switch, gegen Server-README verifiziert); OpenRouter bekommt weiter `reasoning.effort`.
- **`cache_prompt: true`** in allen DirectLLM-Bodies (neuer Helper `applyLlamaCppFields` in [direct-llm.ts](src/core/services/ai/transports/direct-llm.ts), endpoint-gated wie `stream_options`): Absicherung — aktuelle llama.cpp-Builds haben den Prefix-Cache default-an, ältere nicht. Folge-Turns im selben Gespräch verarbeiten damit nur den neuen Suffix statt Historie+Anhang komplett neu.

Kein Migrationsschritt: `chat:settings` wird additiv erweitert, Indexier-Scripts unverändert.

### v2.65.0 — Chat-Ausbau: Streaming, Verlauf, Anhänge, Thinking, Stats (Juni 2026)

MINOR-Bump v2.65.0: Das Chat-Plugin (dev+demo) wächst vom Single-Turn-MVP zum vollwertigen Chat. Aufgeteilt in 5 Commits (PR-1…5/5):

- **Multi-Turn-Gedächtnis**: Der Verlauf geht jetzt komplett ans LLM ([conversation-context.ts](src/plugins/chat/conversation-context.ts), Cap 24k Zeichen / 20 Messages) — vorher wurde jede Nachricht einzeln gesendet. Konfigurierbarer System-Prompt (Zahnrad-Popover, `chat:settings`).
- **Konversations-Liste + Persistenz**: ChatGPT-artige Sidebar, Verläufe in IndexedDB (`chat:conv:{id}`, [store.ts](src/plugins/chat/store.ts) mit Coalescing-Persist-Lock nach Pitfall #16/#20; Persist nur bei User-Send + Finalize, nie pro Token).
- **Token-Streaming**: `AITransport.streamConversation` (optional, Feature-Detection) + SSE-Parser/[Think-Tag-Splitter](src/core/services/ai/thinking-parser.ts) in [direct-llm.ts](src/core/services/ai/transports/direct-llm.ts). Abort resolved `{aborted:true}` statt zu werfen (useAsyncAction-Banner-Falle). Fallback-Ladder: streamen → submitConversation → submitMessage (Streamlit bleibt funktionsfähig). UI-Flush gedrosselt (80 ms) gegen marked-Re-Parse-Jank.
- **Thinking-Anzeige**: `reasoning_content` (llama.cpp `--reasoning-format`) / `reasoning` (OpenRouter) / inline `<think>`-Fallback → einklappbarer „Denkprozess"-Block. Thinking wird gespeichert, aber nie re-gesendet. Presets für Gemma 4 (31B / 26B-A4B) + Qwen 3.6 (27B / 35B-A3B, Thinking) in [AIProviderTab.tsx](src/plugins/einstellungen/AIProviderTab.tsx).
- **Stats-Zeile**: `42,3 tok/s · 256 Tokens · Prompt: 1.024 Tokens (0,8 s)` aus llama.cpp-`timings` (Final-Chunk) bzw. `usage`+Wall-Clock ([generation-stats.ts](src/core/services/ai/generation-stats.ts)); `stream_options` wird nur an OpenRouter gesendet (ältere llama.cpp-Builds lehnen unbekannte Params ab).
- **Anhänge**: PDF/DOCX/MD/TXT via vorhandenem `DocConverter`; `.doc` wird VOR der Konvertierung abgelehnt (Als-docx-speichern-Hinweis); Kürzung 30k Zeichen/Datei, 60k/Nachricht; Attachment-Text nur im API-Payload, Anzeige als Pills.
- **Bedienung**: Stop-Button (Partial bleibt + Badge „Abgebrochen"), Regenerieren, Copy-Button (rohes Markdown), Layout `max-w-2xl` → `max-w-4xl mx-auto` mit Assistant-Antworten in voller Breite.
- Nebeneffekt-Fix: `useSearch().search` gibt die Ergebnisse jetzt zurück — der Chat-RAG-Pfad las vorher veralteten React-State (Stale-Closure).

Kein Migrationsschritt: neue IDB-Keys (`chat:*`) entstehen lazy, bestehende Daten unberührt.

### v2.64.0 — dev-Variante: Hauptpasswort-Gate statt MA-Login-Wall (Juni 2026)

MINOR-Bump v2.64.0: Die dev-Variante verhält sich beim Start jetzt wie pl — EIN Hauptpasswort ([AppPasswordGate](src/core/AppPasswordGate.tsx)) statt der persönlichen MA-Login-Wall. Reine Config-/Script-Änderung, kein UI-Code angefasst:

- **[dev.config.json](configs/dev.config.json)**: `features.maLogin` `true → false` + `auth`-Block ergänzt (Salt+Verifier 1:1 aus [pl.config.json](configs/pl.config.json) gespiegelt → **gleiches Hauptpasswort wie pl**; die `role: 'pl'` im Verifier-Sentinel ist nur Verify-Anker, `verifyAppPassword` prüft sie nicht).
- Damit erscheint im Profil automatisch der **Kürzel-Dropdown mit „Alle"-Option** + „Inaktive einblenden" (bestehender `KuerzelEditor` in [ProfilTab.tsx](src/plugins/einstellungen/ProfilTab.tsx), greift sobald `maLoginActive` false ist) statt des read-only „Angemeldet als". Beliebige MA-Kürzel + Übersichtsmodus wie in pl.
- **Auto-Kurator bleibt**: dev hat `kuratorMenus: true`, das Gate eskaliert nach Passworteingabe wie in der kurator-Variante (`is_kurator=true` + Schreib-Session) — bewusst so gewählt (Entwickler-Komfort).
- **[set-app-password.mjs](scripts/set-app-password.mjs)**: `dev` als erlaubte Variante ergänzt (`npm run set-password -- dev "…"`), falls dev später ein eigenes Passwort bekommen soll. Bis dahin gilt: pl-Passwort-Rotation ⇒ auth-Block erneut nach dev kopieren oder dev-Passwort separat setzen.
- Unverändert: `DEFAULT_CONFIG` (`npm run dev`-Server bleibt ungated, MA-Login-Flow dort weiter entwickelbar/testbar), prod (MA-Login-Wall bleibt prod-Verhalten), AppPasswordGate-Code.

### v2.63.2 — Stream-Artefakte persistiert: 42-s-Lauf nur noch nach Daten-Änderung (Juni 2026)

PATCH-Bump v2.63.2: Test-Feedback zu v2.63.1 — der Stream blieb bei **42 s** (`cache.stream … 42237 ms`). Damit war klar: Nicht die Roundtrips sind der Engpass (v2.63.1-Fix), sondern der **rohe IDB-Lese-Durchsatz** auf Citrix-/Roaming-Profil-Systemen (~12 MB/s gemessen via Slim-Load-Timing; ~500 MB volle Records ≈ 40 s — physikalische Untergrenze, egal ob Cursor oder Bulk).

Lösung ([useAntraegeCache.ts](src/plugins/auslastung/hooks/useAntraegeCache.ts)): Die Stream-Artefakte (klein, ~2–5 MB) werden **in der IDB persistiert** (`auslastung-stream-artefakte-<programmId>`, Frische-Anker = Snapshot-Version + Slim-Count + aufgelöste Gate-Felder + Schema-Version `STREAM_ARTEFAKTE_VERSION`). Erster Lauf nach einer Daten-Änderung rechnet einmal (~40 s, Hintergrund); **jede weitere Sitzung lädt die Artefakte in Sekundenbruchteilen**. Konsole zeigt die Quelle: `cache.stream: … (Quelle: Artefakt-Cache | Voll-Records)`. Maschinen-lokal + jederzeit rebuildbar (Bug-Klasse „Embedding-Caches sind machine-lokal" beachtet). Beweis-Test in [antraege-cache-slim.test.ts](src/plugins/auslastung/__tests__/antraege-cache-slim.test.ts) (zweiter Refresh liest NICHT erneut die Voll-Records).

### v2.63.1 — Stream-Pass beschleunigt: gechunkte Bulk-Reads statt per-Record-Cursor (Juni 2026)

PATCH-Bump v2.63.1: Test-Feedback zu v2.63.0 — die Hintergrund-Stream-Passage des Slim-Caches brauchte auf pl-Echtdaten **46 s** (Konsole: `cache.stream … in 46022 ms`). Zwei Ursachen: (1) der `forEachAntragByProgramm`-Cursor kostet pro Record einen IDB-Roundtrip (~14k Roundtrips), während Bulk-`getAll` dieselben Records in ~2 s deserialisiert; (2) der ZT-Kandidaten-Scan (~600 Property-Probes pro Antrag) lief doppelt (`readAntragDeskriptoren` + `readTruthyZtKlartexte`).

- **Neu `forEachAntragChunkByProgramm`** ([idb-csv.ts](src/core/services/csv/idb-csv.ts)): Primary-Keys billig per `getAllKeys`, dann 500er-Chunks per `getAll(bound)` + `programm_id`-Filter — Bulk-Speed bei ~18 MB Chunk-Peak statt ~470 MB. Genutzt vom Cache-Stream ([useAntraegeCache.ts](src/plugins/auslastung/hooks/useAntraegeCache.ts)) UND vom einmaligen List-View-Rebuild ([list-view-migration.ts](src/core/services/csv/list-view-migration.ts)).
- **Einmal-ZT-Scan**: `readAntragDeskriptorenMitZt(rec, ztKlartexte)` ([profil-aggregator.ts](src/plugins/auslastung/services/profil-aggregator.ts)) nutzt die bereits ermittelten Klartexte weiter — Äquivalenz maschinell abgesichert (slim-aggregates-equivalence.test.ts).

Erwartung: Stream ~46 s → wenige Sekunden (Konsole `cache.stream`-Zeile zeigt es); damit ist auch das Auslastungs-Modul direkt nach App-Start ohne lange Skeleton-Phase nutzbar.

### v2.63.0 — Auslastungs-Cache verschlankt: −~400 MB RAM, List-View-Projektion v2 (Juni 2026)

MINOR-Bump v2.63.0 (Stufe 2 der Cold-Start-/RAM-Arbeit, nach v2.62.5): Der Auslastungs-Cache ([useAntraegeCache.ts](src/plugins/auslastung/hooks/useAntraegeCache.ts)) hielt ALLE ~13k **vollen** Antrag-Records (~450 MB Heap) dauerhaft im RAM — der größte Einzelposten des pl-Sockels (gemessen 1,7 GB nach frischem Load). Jetzt hält er nur noch:

- die **Slim-Projektion** (`AntragListItem`, erweitert um `t_hint`, `d_xtec`, `d_adv`, `tib_mail`, `verbund_titel` — **List-View-Projektion v2** mit Versions-Marker; siehe Migrationsnotiz unten), und
- **Stream-Artefakte** aus EINER Cursor-Passage über die vollen Records ohne Retention (`forEachAntragByProgramm`): `deskriptorenByAz`/`ztKlartexteByAz` (Stage-0/1-Klassifizierung als pure Lookup-Funktionen), `embeddableAz` (Korpus-Hash-Integrität fürs Share-Self-Heal), `xtecAzSet`/`advAzSet` (Vollständigkeits-Gate mit den über das CSV-Schema **aufgelösten** Feldern — custom-Mappings bleiben korrekt).

Schwere Texte (`projektbeschreibung_text`) kommen on-demand per `getAntrag`-Point-Read (Cockpit-Detail/Matching, Kürzel-Export) bzw. transienten Voll-Loads (Korpus-Build, Onboarding-HTML, Kalibrierungs-Report). Aggregate werden in-memory aus Slim+Lookups abgeleitet — eine spät ankommende kuerzel-map re-derived ohne erneuten Stream. `useAuslastungReady` wartet zusätzlich auf die Stream-Passage (sonst liefe Matching kurz mit leeren historische*-Maps, Bug-Klasse v2.46.1). Äquivalenz alt↔neu maschinell abgesichert: [slim-aggregates-equivalence.test.ts](src/plugins/auslastung/__tests__/slim-aggregates-equivalence.test.ts), [antraege-cache-slim.test.ts](src/plugins/auslastung/__tests__/antraege-cache-slim.test.ts).

**Migrationsnotiz:** Beim ersten Start nach dem Update läuft einmalig der List-View-Voll-Rebuild (`LIST_VIEW_PROJECTION_VERSION` 1→2, ~5 s bei 13k Anträgen, bestehende Boot-Statuszeile „Optimiere Anträge-Liste…"; crash-safe, Marker erst nach Erfolg). Kein Daten-Share-/Schema-Wechsel. Nebeneffekt-Fix: `ensureListViewProjection` lud bisher bei **jedem** Start alle 13k vollen Records nur für einen Längen-Vergleich — jetzt billiger Index-`count()`.

### v2.62.5 — Cold-Start entzerrt: Homepage-Anträge schneller sichtbar (Juni 2026)

PATCH-Bump v2.62.5 (Stufe 1 der Cold-Start-Arbeit): Auf pl dauerte es nach frischem Browser-Load ~4 s bis die Anträge erschienen. Die Homepage wartet nur auf den **schlanken** List-View-Load — aber parallel liefen beim App-Start zwei schwere Konkurrenten um Main-Thread + IndexedDB:

- **Auslastung-Warmup idle-deferred** ([auslastung/index.tsx](src/plugins/auslastung/index.tsx)): das Laden der ~13k **vollen** Antrag-Records (~450 MB deserialisieren) startet jetzt via `scheduleIdle` erst nach dem First-Paint statt sofort bei Plugin-`onInit`. Konsumenten unkritisch — `useAntraegeCache` triggert beim Mount ohnehin idempotent selbst.
- **Startup-Snapshot-Sync idle-deferred** ([App.tsx](src/core/App.tsx)): der tägliche Sync (am ersten Start des Tages mehrere Sekunden Store-Reload) startet ebenfalls erst im Idle-Window — Semantik unverändert, nur außerhalb des First-Paint-Fensters.
- **Always-on Timing-Logs** (`console.info`, tfPerf ist in Builds stumm): `loadAll`-Dauer (List-View), `cache.refresh`-Dauer (Voll-Records), `snapshot-sync`-Dauer pro Programm — der nächste Citrix-Lauf zeigt die Restverteilung des Budgets.

Stufe 2 (Cache-Verschlankung, −~400 MB RAM) folgt separat als v2.63.0.

### v2.62.4 — Adaptive Embedding-Schwelle: Ähnlichkeitssuche liefert auf dem v2-Korpus wieder Treffer (Juni 2026)

PATCH-Bump v2.62.4: Die v2.62.3-Diagnose lieferte den Beweis: pl-Echtdaten, Query „Bilderkennung" (Korpus 13.949, eindeutig relevante Anträge vorhanden) → **beste Cosine 0.437** — die starre 0.55-Schwelle (validiert auf dem alten v1-Korpus, nur Titel/Abstract) ließ auf dem v2-Korpus (lange Texte + Deskriptoren) bei kurzen Queries **keinen einzigen** Vector-Treffer durch; die Ähnlichkeitssuche wirkte tot.

Fix in [antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts): **adaptive Schwelle** statt starr — `max(Floor 0.35, 90% der besten Cosine des Laufs)` (`computeEmbeddingCutoff`, Top-50-Deckel bleibt). Kurze Queries bekommen ihr Qualitäts-Band (z.B. 0.39–0.44), lange Queries bleiben streng (z.B. 0.63–0.70), Garbage-Queries (beste < 0.35) liefern weiter 0 Treffer. Gilt für beide Konsumenten (Förderanträge-Suchfeld + Suchseite). Tests: [embedding-cutoff.test.ts](src/plugins/antraege/__tests__/embedding-cutoff.test.ts) (inkl. Regression auf den gemessenen 0.437-Fall).

### v2.62.3 — Vector-Diagnose: beste Cosine + Dim-Skips bei 0 Treffern loggen (Juni 2026)

PATCH-Bump v2.62.3: Test-Feedback zu v2.62.2 — Korpus vorhanden (13.949 Vektoren), Modell lief, aber 0 Vector-Treffer über der 0.55-Schwelle. `topKEmbeddingMatches` ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)) loggt im 0-Treffer-Fall jetzt die **beste gefundene Cosine** (+ Aktenzeichen) und die Anzahl still übersprungener Dimensions-fremder Vektoren. Die eine Zahl unterscheidet die drei Hypothesen: ~0.5 = Schwelle zu streng, ~0.1 = Vektorraum inkompatibel (lokaler Korpus mit altem Modell/Text-Schema → Rebuild/Re-Download), 0+Skips = Dim-Mismatch.

### v2.62.2 — Ähnlichkeitssuche: stille Leerlauf-Pfade sichtbar gemacht + Korpus-Bootstrap auf der Suchseite (Juni 2026)

PATCH-Bump v2.62.2: Test-Feedback zu v2.62.1 — Vector-Phase lief an (Spinner), ergänzte aber keine Treffer, ohne erkennbaren Grund. Die Stage hatte drei **stille** Leerlauf-Pfade (Modell-Init-Fehler geschluckt, Query-Embedding-Fehler → `null`, leerer lokaler Embedding-Korpus → stumm `[]`), und `pipelineLog` ist in Builds deaktiviert (`import.meta.env.DEV`) — unter `file://` gab es also keinerlei Spur (Pitfall-#15-Klasse).

- **[useUnifiedSearch.ts](src/core/hooks/useUnifiedSearch.ts):** neuer `semanticStatus` (`ok`/`model-failed`/`corpus-empty`) + always-on `console.info/warn`-Diagnose der Vector-Stage (Treffer-Anzahl + Korpus-Größe bzw. konkreter Fehlgrund).
- **[SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx):** sichtbarer ⓘ-Hinweis unter dem Suchfeld, wenn die Ähnlichkeitssuche eingeschaltet ist aber wirkungslos (Korpus fehlt lokal / Modell lädt nicht) — statt kommentarlos identischer Ergebnisse. Zusätzlich läuft der **Embedding-Korpus-Bootstrap** (Auto-Download vom Daten-Share, `autoBootstrapEmbeddingMirror`) jetzt auch im Suchseiten-Preload — bisher nur auf der Förderanträge-Seite; ein Rechner mit leerem lokalen Korpus blieb auf der Suchseite dauerhaft ohne Vector-Treffer.
- Hinweis zur Treffer-Anzeige: Anträge, die wörtlich UND semantisch matchen, behalten das Label „Stichwort" (Dedup per max-score, Substring=1.0). Semantik zeigt sich als **zusätzliche** Zeilen mit Score < 1.00 — sichtbar v.a. bei Queries, die nicht wörtlich vorkommen.

### v2.62.1 — Dropdown-Umschalten führt die laufende Suche neu aus (Juni 2026)

PATCH-Bump v2.62.1: Nachzug zu v2.62.0 — beide Such-Pipelines hingen nur an der Query, nicht am Ähnlichkeits-Modus. Folge: nach dem Umschalten auf „Mit Ähnlichkeitssuche" blieben die bereits angezeigten Treffer Substring-only („Stichwort"), bis der User die Query änderte. Fix: `semanticEnabled` in die Deps der Such-Effekte ([useUnifiedSearch.ts](src/core/hooks/useUnifiedSearch.ts) Hauptsuche, [useAntraegeHybridSearch.ts](src/plugins/antraege/useAntraegeHybridSearch.ts) Tipp-Suche) — das Umschalten re-triggert die Suche sofort; während das Modell noch lädt, wartet die Vector-Stage auf dieselbe Init-Promise (Phase-Badge „Embedding-Treffer…").

### v2.62.0 — Ähnlichkeitssuche opt-in: Embedding-Modell lädt erst auf User-Wunsch (Juni 2026)

MINOR-Bump v2.62.0: Folge-Maßnahme zur Citrix-RAM-Analyse (v2.61.5): Auch nach den OOM-Fixes belegte der pl-Tab im Steady-State viel Speicher, weil beim bloßen Öffnen von **Förderanträgen** bzw. der **Suchseite** ungefragt das Embedding-Modell (~200 MB Download, entpackt ~0,5–1 GB WASM/GPU) + die Embedding-Map im Idle vorgeladen wurden — auch wenn der User nur „schnell Metadaten checken" wollte.

- **Neu: Dropdown „Ohne/Mit Ähnlichkeitssuche"** rechts neben dem Suchfeld in [AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx) und [SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx). **Standard „Ohne"**, ein geteilter Session-Schalter ([useSemanticSearchMode.ts](src/core/hooks/useSemanticSearchMode.ts), bewusst nicht persistiert — jede Sitzung startet neutral). Erst beim Umschalten auf „Mit" laden Modell + Embedding-Korpus (sofort, mit Lade-Hinweis; Suchen liefern solange Wortlaut-Treffer).
- **Gates:** zentrales Laufzeit-Gate `isSemanticSearchActive()` ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)) = Build-Flag UND Opt-in; konsumiert von `searchAntraege` (früher Substring-only-Return, ohne irreführenden „Embedding fehlt"-Hinweis), [useUnifiedSearch.ts](src/core/hooks/useUnifiedSearch.ts) (Vector-Stage) und beiden Mount-Preloads ([useAntraegeHybridSearch.ts](src/plugins/antraege/useAntraegeHybridSearch.ts), SuchSeite). `STREAMING_CONSTS.SEMANTIC_SOURCES_ENABLED` entfällt.
- **Verhaltens-Änderung (bewusst):** Ohne Opt-in findet die Suche nur noch Wortlaut-/Substring-Treffer; semantische „inhaltlich ähnlich"-Treffer erscheinen erst nach Umschalten. Betrifft pl/dev/demo/kurator (prod hatte nie semantische Suche). Tooltip am Suchfeld erklärt den Modus.
- **Auslastungs-Modul unverändert:** dessen Stage-2-Matching lädt das Modell weiterhin selbst bei tatsächlicher Nutzung (Antrag-Auswahl im Zuweisen-Tab / Kürzel-Export) — wer Auslastung nicht öffnet, zahlt nichts.

Erwarteter Effekt auf RAM-knappen Citrix-Sessions: Förderanträge-Besuch ohne Opt-in bleibt nahe am Home-Sockel (vorher +0,5–1 GB durch den Idle-Preload). Test: [useSemanticSearchMode.test.ts](src/core/hooks/__tests__/useSemanticSearchMode.test.ts) (Default-AUS-Garantie).

### v2.61.5 — Out-of-Memory unter Citrix: CSV-Aktualisieren + Cold-Start entlasten (Juni 2026)

PATCH-Bump v2.61.5: Die **pl**-Variante crashte auf einem frischen, RAM-knappen **Citrix**-Renderer (~6 GB/User) mit Chrome „Oh nein! … Out of Memory" **beim Klick auf „CSV-Quellen aktualisieren"**; davor hing die Homepage nach dem Login („Seite reagiert nicht", erholt sich). Drei zusammenwirkende Ursachen behoben — Output/Verhalten identisch, kein Daten-Layout-/Schema-Wechsel.

- **Fix A — CSV-Merge speicherschonend (der OOM-Treiber):** `runMergeForDeltas` ([importer.ts](src/core/services/csv/importer.ts)) lud bisher über `loadAllSchemasWithRows` **jede** CSV-Quelle des Programms **komplett** vom Share in den RAM — auch für ein winziges Delta. Neu: `loadScopedSchemasWithRows` ([merger/loader.ts](src/core/services/csv/merger/loader.ts)) lädt nur die Rows der betroffenen `touchedAz` (+ deren Verbund-/Akronym-Sekundärzeilen, Superset-sicher), filtert direkt beim Parsen (Transient = eine Quelle statt Summe aller) und gibt die geparsten Rows der aktuellen Quelle **vor** dem Merge frei (kein Duplikat). Bit-identisches Merge-Ergebnis zum Voll-Loader — getestet in [merger-scoped-load.test.ts](src/core/services/csv/__tests__/merger-scoped-load.test.ts). Bei einem echten **Voll**-Re-Import (alle Zeilen geändert/Hash-Drift) wird weiterhin alles geladen → solche Großimporte besser auf einer Workstation (kurator) fahren, pl macht inkrementelle Refreshes.
- **Fix B — Cold-Start entlasten (Homepage-Hänger):** Der Embedding-Korpus-Autoload ([useAuslastungCorpusAutoload.ts](src/core/hooks/useAuslastungCorpusAutoload.ts)) startet jetzt erst nach First-Paint (`requestIdleCallback`); `downloadAndApply` ([useEmbeddingCorpusMirror.ts](src/core/hooks/useEmbeddingCorpusMirror.ts)) wendet den Korpus **streamend** an (`applyCorpusStreamed`, [mirror.ts](src/core/services/embedding-corpus/mirror.ts)) statt eine ~80-MB-`number[]`-Map zu materialisieren; die überflüssige 40-MB-Defensivkopie in `loadBin` entfällt.
- **Fix C — Build-Lock-Resilienz:** Stürzte der Tab mitten im Import ab, blieb der **share-weite** Lock 2 h liegen und blockierte das ganze Team (der Banner versprach fälschlich „in 2-3 Min"). Neu: stufen-spezifische Stale-Schwelle (CSV-Import **3 Min** statt 2 h, [build-lock.ts](src/core/services/infrastructure/build-lock.ts)), Heartbeat während des Imports (aktiver Import bleibt frisch, abgestürzter altert) und ein **„Trotzdem aktualisieren"**-Button im Lock-Konflikt-Banner ([CsvAutoRefreshBanner.tsx](src/plugins/csv-sources-kuration/components/CsvAutoRefreshBanner.tsx) + `forceRefresh`). **Sofort-Entsperrung** eines hängenden Locks weiterhin manuell: `<share>/_intern/build-lock.json` löschen.
- **Diagnose:** `logMem()` ([log-mem.ts](src/core/utils/log-mem.ts), guarded auf `performance.memory`) loggt den Heap an den Merge-/Korpus-Phasen-Grenzen für künftige Citrix-Testläufe.

**Dev reproduziert den OOM nicht** (Fixture-Blobs, viel RAM) — Echt-Test auf dem pl-`file://`-Build unter Citrix. Tests: [build-lock-stale.test.ts](src/core/services/infrastructure/__tests__/build-lock-stale.test.ts), [embedding-corpus-mirror.test.ts](src/plugins/auslastung/__tests__/embedding-corpus-mirror.test.ts) (Streaming-Apply).

### v2.61.2 — Passwort-Wall vor dem Berechtigungs-Stepper (pl/kurator) (Juni 2026)

PATCH-Bump v2.61.2: Beim pl-Neustart kam die Passwort-Abfrage (AppPasswordGate) **nach** den Browser-Berechtigungs-Prompts (dem Guided-Stepper) — erst anmelden, dann Ordner freigeben ist die erwartete (und sicherere) Reihenfolge. Ursache: die Render-Reihenfolge war `Onboarding → Welcome → StartupScreen(Stepper) → AppPasswordGate → …`, und `decideAppGate()` lief erst NACH dem StartupScreen.

- **[App.tsx](src/core/App.tsx):** `showAppGate` wird jetzt beim Init entschieden (pur: `runtimeConfig.auth.required` + `getAppGateSession()`), und der `AppPasswordGate`-Branch rendert **vor** Welcome/Startup (`Onboarding → AppGate → Welcome → Startup → MaGate → App`). `decideAppGate()` aus `handleStartupReady` entfernt (jetzt im Init). Der v2.27-Grund (CSV im sauberen Gate-Gesture nach dem Daten-Share) ist mit dem Guided-Stepper (ein Prompt pro Klick) hinfällig.
- **[AppPasswordGate.tsx](src/core/AppPasswordGate.tsx):** pl-CSV-Re-Grant entfernt — der Login macht für pl keine Permission-Arbeit mehr; der nachgelagerte Stepper gibt Datenordner + persönlich + CSV frei. kurator-Eskalation (`is_kurator` + `activateSynthetic` + `refreshAllPermissions`) unverändert.

Verhalten: **pl** = Passwort (kein Prompt) → Stepper (3 Ordner) → App. **kurator** = Passwort (Daten-Share-Prompt im Login-Gesture) → Stepper (persönlich, CSV); Nebeneffekt: der „nur lesend"-Downgrade-Pre-Login-Fall (Pitfall #25) entfällt, weil `is_kurator` beim Startup schon true ist. **prod** unverändert (Startup → MA-Login). **Dev reproduziert nur mit `auth.required`** — Echt-Test auf pl/kurator-`file://`-Build.

### v2.59.5 — „Einsammeln"-Buttons fangen verfallene Mitarbeiter-Ordner-Berechtigung ab (Juni 2026)

PATCH-Bump v2.59.5: Nachzug zu v2.59.4 — dieselbe Permission-Lapse-Klasse auf dem **User-Folders-Root** in den zwei button-getriggerten Auslastung-Flows. „Profile einsammeln" ([MaListSection.tsx](src/plugins/auslastung/views/uebersicht/MaListSection.tsx)) und „Übernahme-Wünsche einsammeln" ([ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx)) lasen ein **bestehendes** Handle direkt mit `collectUserProfiles` / `collectUebernahmeWuensche`, **ohne** vorher `requestPermission` zu rufen. Ist die Read-Permission unter `file://` nach Neustart verfallen, wirft das Verzeichnis-Iterieren `NotAllowedError` → der rohe Fehler erschien statt einer Re-Abfrage (obwohl ein Klick-Gesture vorliegt, das prompten dürfte).

Fix: im „Handle existiert"-Zweig zuerst `refreshUserFoldersRootPermission` (der v2.59.4-Helfer; queryPermission + bei Bedarf `requestPermission` im Gesture); bei `!== 'granted'` eine klare Fehlermeldung statt Crash. Der „Handle fehlt → Picker"-Zweig bleibt unverändert.

**Bereits sicher (geprüft, nicht angefasst):** die Auto-Pfade `usePendingUebernahmeWuensche` (queryPermission-Guard + try/catch) und `useAutoCollectTeamProfiles` (collect in try/catch, still-skip). Rein additiv. **Dev reproduziert nicht** (keine echten Handles).

### v2.59.4 — Online-Tab: verfallene Berechtigung auf den Mitarbeiter-Ordner abfangen (Juni 2026)

PATCH-Bump v2.59.4: Auf dem pl-Rechner zeigte der **Online**-Tab nach Browser-Neustart „Konnte den Online-Status nicht laden: The request is not allowed by the user agent or the platform in the current context" — ohne Berechtigungs-Abfrage. Gleiche Permission-Lapse-Klasse wie persönlich/CSV, jetzt auf dem **User-Folders-Root**: das Handle liegt in IDB, aber die Permission ist unter `file://` verfallen. `load` läuft beim Mount + alle 45 s **ohne User-Gesture** und ruft `collectHeartbeats`, dessen Verzeichnis-Iteration (`root.values()`, [collector.ts](src/core/services/presence/collector.ts)) bei nicht-granted Handle `NotAllowedError` wirft. Der Tab kannte nur „Handle fehlt → Verbinden-Button", aber keinen Re-Grant-Pfad für „Handle da, Permission verfallen".

- **[OnlineTab.tsx](src/plugins/einstellungen/OnlineTab.tsx):** `load` prüft jetzt zuerst non-invasiv `queryUserFoldersRootPermission` (kein Prompt); ist sie nicht `granted` → kein `collectHeartbeats` (kein Crash), stattdessen State `needsRegrant` → Box mit Button **„Erneut freigeben"** (Klick-Gesture). `regrant` ruft `refreshUserFoldersRootPermission` (re-grantet das bestehende Handle ohne erneutes Ordner-Auswählen) → bei `granted` Liste laden, sonst Fallback auf Re-Pick. `collectHeartbeats` zusätzlich in try/catch (Sicherheitsnetz gegen Race). Auto-Refresh wirft keinen Fehler mehr.
- **[smb-handle.ts](src/core/services/infrastructure/smb-handle.ts):** zwei Helfer (Spiegel von `refreshCsvSourceDirPermission`): `queryUserFoldersRootPermission` (non-invasiv) + `refreshUserFoldersRootPermission` (Gesture-Re-Grant). Unit-Tests [userFoldersRootPermission.test.ts](src/core/services/infrastructure/__tests__/userFoldersRootPermission.test.ts).

Rein additiv. **Dev reproduziert nicht** (keine echten Handles). Hinweis: die Auslastung-Flows „Profile/Übernahme einsammeln" nutzen denselben Ordner (button-getriggert) — separat zu verifizieren, nicht Teil dieses Fixes.

### v2.59.2 — Stepper kollabiert bei moderner Sammel-Berechtigungs-Box (Juni 2026)

PATCH-Bump v2.59.2: **Korrektur einer Einordnung aus v2.55.** Test in **Edge** zeigte eine konsolidierte Sammel-Box: ein `requestPermission()` bündelt ALLE zuvor gewährten Handles des Origins in EINE Box („Dateien des letzten Besuchs … anzeigen und bearbeiten"), mit der Option **„Bei jedem Besuch zulassen"** (persistente Permission → kein Re-Prompt nach Neustart). Das ist ein **browser-/kontextabhängiges** Chromium-Feature (persistente FSAPI-Permissions) — **in Chrome unter `file://` in der Praxis NICHT beobachtet** (getestet bis v149, ohne clear-site-data, auch am Folgetag kein Sammel-Dialog). Meine v2.55-Aussage „eine kombinierte Abfrage ist technisch unmöglich" war damit zu absolut: in manchen Browsern (Edge) geht es, in anderen (Chrome/`file://`) nicht — die App kann es nicht erzwingen.

Folge: wo der Browser die Sammel-Box zeigt (Edge), war der 2. Stepper-Schritt überflüssig (die Box hatte beim 1. Klick schon alles gewährt). Fix macht den Stepper **adaptiv**:

- **[GuidedGrantSteps.tsx](src/core/components/GuidedGrantSteps.tsx)** prüft nach jedem Grant per neuer `rescan`-Prop (non-invasives `listPendingGrants`) neu, markiert alle nun gewährten Slots als erledigt und schließt ab, sobald nichts mehr aussteht → **Edge** (Sammel-Box gewährt alles) **kollabiert auf EINEN Klick**; **Chrome** (keine Sammel-Box) bleibt Schritt-für-Schritt, ein Prompt je Ordner. Kernlogik als pure Funktion `resolveAfterGrant` ([guided-grant-progress.ts](src/core/components/guided-grant-progress.ts), Unit-Tests [guided-grant-progress.test.ts](src/core/components/__tests__/guided-grant-progress.test.ts)) — kein RTL/jsdom im Projekt.
- **Hinweistext** angepasst (weg von „lässt sich nicht abschalten"): Tipp auf „Bei jedem Besuch zulassen" → künftig keine Abfrage mehr.
- Doku korrigiert: [recurring-bug-classes.md §2](docs/architecture/recurring-bug-classes.md).

Kein Eingriff in den v2.56.1-Warm-Start-Fix. **Dev reproduziert nicht** (Fixture-Blobs → Stepper-Scan leer); Echt-Test auf einem `file://`-Build (Edge: ein Klick + „Bei jedem Besuch zulassen"; klassisch: Schritt-für-Schritt).

### v2.56.1 — Warm-Start lud fälschlich im Offline-Modus (v2.55-Regression) (Juni 2026)

PATCH-Bump v2.56.1: Regression aus dem v2.55-Guided-Grant-Stepper. Auf der pl-Variante lud die App nach **Tab-schließen + neu laden** (kein Browser-Neustart → FSAPI-Permissions in derselben Session noch gültig) direkt in den **Offline-Modus** — gelber Banner trotz erreichbarem Daten-Share; der ZAH-Berechtigungsdialog kam erst nach Klick auf „Verbindung herstellen".

Root-Cause: der **Warm-Start-Pfad** in [StartupScreen.tsx](src/core/StartupScreen.tsx) (`listPendingGrants` leer → alle Handles noch granted) rief `onReady()`, aber **nicht** `applyRefreshResult` → `useConnectionState.mode` blieb auf INITIAL `'offline'` ([connection-status.ts](src/core/services/connection-status.ts)) → [OfflineBanner](src/core/OfflineBanner.tsx) erschien. Vor v2.55 lief der Warm-Start über den „Starten"-Button (`refreshAllPermissions` + `applyRefreshResult`); das Auto-Skip verlor das State-Update, der Visibility-Probe rettet es nicht (feuert nur bei `visibilitychange`, nicht beim Reload).

Fix: gemeinsamer Abschluss-Helfer `finishStartup` (`applyRefreshResult(await queryAllPermissions(...))` + `onReady()`) für **beide** Pfade — Warm-Start und Stepper-Ende. `queryAllPermissions` ist non-invasiv → kein Prompt; der Reload lädt jetzt direkt online (kein Banner, kein Klick). Browser-Neustart (Permissions verfallen) zeigt weiter den Stepper. Kein Eingriff in den `scanFailed`-Fallback (nutzt schon `applyRefreshResult`).

### v2.56 — Themen-Vektoren-Korpus inkrementell im kurator-Build pflegbar (Juni 2026)

MINOR-Bump v2.56: Der **Embedding-Korpus** der Auslastungs-Klassifizierung (Themen-Vektoren) konnte bisher nur in **dev** und **pl** aktualisiert werden — das Auslastungs-Modul war in der **kurator**-Variante komplett aus (`auslastung:false`). Der Kurator soll den Katalog aber aktuell halten können (neue Anträge nachembedden), **ohne** MA-Auslastung zu sehen oder zuzuweisen. Neu: ein schlanker Korpus-only-Modus für den kurator-Build.

- **Neuer optionaler Flag `auslastungNurKorpus`** ([config-schema.mjs](scripts/config-schema.mjs) default false, [runtime-config.ts](src/config/runtime-config.ts) Interface, Helper `isAuslastungNurKorpusEnabled` in [feature-flags.ts](src/config/feature-flags.ts)). In [kurator.config.json](configs/kurator.config.json) zusammen mit `auslastung:true` gesetzt; sonst nirgends → andere Varianten unverändert.
- **Schlanker kurator-View** [AuslastungView.tsx](src/plugins/auslastung/views/AuslastungView.tsx): `AuslastungView` ist jetzt ein build-time-Dispatcher → `AuslastungKorpusView` (nur die Themen-Vektoren-Sektion via `EinstellungenView korpusOnly`) statt `AuslastungFullView`. Der schlanke View lässt die **MA-mutierenden** Mount-Hooks (`useReconcileZuweisungen` + `useAutoCollectTeamProfiles`, beide schreiben `auslastung.json`) bewusst **aus** — Schutz vor Parallel-Varianten-Clobber (`parallel-file-variants-share-storage`); nur read-only Frische-Hooks laufen.
- **Button-Aufteilung** [EmbeddingCorpusSection.tsx](src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx): „Corpus aufbauen" (Vollbuild ~47 min) ist jetzt zusätzlich `isDevContext()`-gated (dev-exklusiv), „Inkrementell" bleibt unter `isEmbeddingCorpusBuildEnabled()`. Ergebnis: **dev** = beide, **kurator** = nur Inkrementell, **pl** = beide aus (unverändert, `embeddingCorpusBuild:false`).
- **Sidebar-Eintrag** [index.tsx](src/plugins/auslastung/index.tsx): im Korpus-Modus „Themen-Vektoren" (Icon `Boxes`) statt „Auslastung".

Rein additiv, keine Migration, kein Schema-Change (optionaler Flag, kein `requiredFlags`-Eintrag). Caveat: der Korpus-Build schreibt weiterhin die Centroids nach `auslastung.json` (gewollt) — gleiche Zwei-Writer-Risikoklasse wie bei zwei PLs, minimiert durch den eingebundenen Share-Watcher + Build-Lock. **Dev reproduziert den kurator-Modus nicht** (Flag nur in kurator.config) — Echt-Test auf einem `file://`-kurator-Build.

### v2.55 — Geführter Berechtigungs-Freigabe-Flow beim Start (Guided-Grant-Stepper) (Juni 2026)

> **Korrektur (v2.59.2):** Die unten getroffene Aussage „eine einzige kombinierte Browser-Abfrage ist technisch unmöglich" war zu absolut. **Edge** zeigt sehr wohl eine konsolidierte Sammel-Box + persistente Permissions; **Chrome (`file://`, bis v149) NICHT** — also browser-/kontextabhängig, nicht universell. Details in v2.59.2.

MINOR-Bump v2.55: Auf einem neuen pl-Rechner verlangte Chrome am zweiten Tag drei separate Datei-Berechtigungen — Datenordner (readwrite), CSV-Quelle (read) und persönlicher Ordner (readwrite) —, die **chaotisch** kamen: der persönliche Ordner verhungerte im StartupScreen-Gesture (`refreshAllPermissions` fragt mehrere Handles sequenziell im selben Klick an, aber Chrome zeigt unter `file://` nur **einen** Prompt pro User-Gesture) und promptete deshalb zu einem zufälligen späteren Zeitpunkt. Eine einzige kombinierte Browser-Abfrage ist technisch unmöglich (ein Ordner pro Prompt, ein Prompt pro Klick, Freigaben verfallen je Browser-Neustart). Stattdessen: ein **geführter, vorhersehbarer Schritt-für-Schritt-Flow**.

- **Guided-Grant-Stepper** [GuidedGrantSteps.tsx](src/core/components/GuidedGrantSteps.tsx): der StartupScreen-Default-Zweig prüft beim Mount **non-invasiv** (`queryPermission`, kein Gesture), welche Handles noch ungranted sind, und rendert pro Handle **einen Klick-Schritt** mit Fortschritt („Schritt i/n") + Status-Liste. Jeder Klick = ein `requestPermission` = ein zuverlässiger Prompt in fester Reihenfolge (Datenordner → persönlich → CSV-Quelle). Sind alle granted (Warm-Start, z. B. zweiter Tab offen) → direkt durchstarten, kein Klick, kein Flackern. „Ohne Freigabe fortfahren" für den eingeschränkten Offline-Modus.
- **Neue Helfer** in [smb-handle.ts](src/core/services/infrastructure/smb-handle.ts): `listPendingGrants` (geordnete Liste der ungranted Handles, Mode-Logik identisch zu `refreshAllPermissions` via `canWriteDatenShare`, Pitfall #25), `grantPending` (Einzel-Grant), `queryAllPermissions` (non-invasiver Spiegel von `refreshAllPermissions` für den ConnectionState-Update nach Abschluss). Kurator-only-Slots (User-Folders-Root, DMS) bleiben bewusst außen vor — die laufen weiter über die Post-Login-Eskalation.
- **Behebt den persönlich-„Rest-Bug"** aus [recurring-bug-classes.md §2](docs/architecture/recurring-bug-classes.md): kein zufälliges Überraschungs-Popup mehr.
- **AppPasswordGate** [AppPasswordGate.tsx](src/core/AppPasswordGate.tsx): der CSV-Re-Grant beim Login bleibt als guarded Fallback (queryPermission-gated, no-op nach dem Stepper-Grant — kein Doppel-Prompt). Kurator-Eskalation unverändert.

Rein additiv, keine Migration, kein Schema-Change. **Dev reproduziert das nicht** (Fixture-Blobs → Stepper-Scan leer → Auto-Skip); Echt-Test nur auf einem `file://`-pl-Build mit real verknüpften Handles nach Browser-Neustart. Unit-Tests für `listPendingGrants` (Rollen pl/prod/kurator-pre-login, Reihenfolge/Modi, Warm-Start) in [listPendingGrants.test.ts](src/core/services/infrastructure/__tests__/listPendingGrants.test.ts). **Out of scope:** kurator-Post-Login-Eskalation (`refreshAllPermissions({isKurator:true})`) hat dieselbe Multi-Prompt-Starvation für User-Folders-Root + DMS — vorbestehend, nicht pl-relevant.

### v2.54.4 — Vorschlagszeile: mehr Platz für historische Antrags-Titel (Juni 2026)

PATCH-Bump v2.54.4: In der Vorschlagszeile des Zuweisungs-Cockpits ([VorschlagRow.tsx](src/plugins/auslastung/components/VorschlagRow.tsx)) wurden die Titel der verschachtelten „ähnlichen Projekte" (historische Anträge) früh mit Ellipse abgeschnitten. Die Passung-Spalte des Vier-Spalten-Rasters (`grid-cols-[minmax(0,1fr)_122px_156px_auto]`) wurde von `122px` auf `84px` verschmälert — da Spalte 1 (`minmax(0,1fr)`) den freigewordenen Platz aufnimmt, bekommen die Titel ~38 px mehr Breite und der linksbündige Passung-/Prozent-Block rückt entsprechend nach rechts. Der Passung-Inhalt (Balken `w-[60px]`, „100%", Label „Passung") passt sicher in die schmalere Spalte; Kapazitäts- und Aktionsspalte unverändert.

### v2.54.1 — Spaltenfilter „Erstentscheidung": leere Einträge wählbar (Juni 2026)

PATCH-Bump v2.54.1: Der Spaltenfilter der „Erstentscheidung"-Spalte zeigte nur die Jahre (2021–2026), aber keine Option für **Anträge ohne Erstentscheidung** — `deriveFilterCandidates` ([useColumnFilters.ts](src/components/data-table/useColumnFilters.ts)) überspringt leere Filterwerte (`if (v)`) als „kein Kandidat", und der `filterAccessor` der Spalte lieferte für datumslose Anträge `''`. Fix: der `filterAccessor` mappt leere/datumslose Werte jetzt auf den nicht-leeren Sentinel **„(leer)"** ([tableColumns.tsx](src/plugins/antraege/tableColumns.tsx) `yearOfOrEmpty`) — damit erscheint „(leer)" als wählbare Filter-Option und `applyColumnFilters` matcht die leeren Zeilen über denselben `filterAccessor`-Pfad zurück. Folgt dem bestehenden Sentinel-Muster (vgl. `'(kein)'` in [useColumnFilters.test.ts](src/components/data-table/__tests__/useColumnFilters.test.ts)); keine Änderung an der generischen Filter-Logik. Regressionstest [tableColumns-filter.test.ts](src/plugins/antraege/__tests__/tableColumns-filter.test.ts).

### v2.54 — Hinweis auf abgelehnte/zurückgezogene Vorgänger im Verbund-Detail (Juni 2026)

MINOR-Bump v2.54: Wird ein Projekt nach Ablehnung/Rückzug erneut eingereicht, führt das Foyer-Quellsystem den überholten Vorgänger unter **demselben Kurznamen, aber geklammert** (`(SCULPT)` vs. aktiv `SCULPT`), mit TV-Status `abgelehnt/zurückgezogen`. Dass es einen solchen Vorgänger gibt, war bisher nur über eine gezielte Akronym-Suche sichtbar. Neu: ein Warn-Hinweis direkt im Verbund-Detail.

- **Banner** [AbgelehnteVorgaengerBanner.tsx](src/plugins/antraege/AbgelehnteVorgaengerBanner.tsx) unter dem Header von [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx): listet frühere abgelehnte/zurückgezogene Einreichungen desselben Kurznamens (pro Vorgänger-Verbund: TV-Anzahl, jüngste Erstentscheidung, Antragsteller); jede Zeile öffnet per Klick den abgelehnten Verbund.
- **Match-Logik** [vorgaengerAntraege.ts](src/plugins/antraege/vorgaengerAntraege.ts): `normalizeAkronymForMatch` ignoriert umschließende Klammern + Groß/Klein + Whitespace (`(SCULPT)` == `SCULPT`); `findAbgelehnteVorgaenger` filtert die In-Memory-Slim-Liste (`useAntraegeStore.antraege`, aktuelles Programm) auf gleichen Kurznamen + Status abgelehnt/zurückgezogen, schließt den aktuellen Verbund/seine TVs aus und gruppiert pro Vorgänger-Verbund. Unit-Tests in [vorgaengerAntraege.test.ts](src/plugins/antraege/__tests__/vorgaengerAntraege.test.ts).
- **Status-Helper** `isAbgelehntZurueckgezogenStatus` in [status-canonical.ts](src/core/utils/status-canonical.ts) — präziser als `isClosedStatus` (das auch bewilligt + Schlussvermerk einschließt); kein Literal-Vergleich außerhalb des Canonical-Moduls (Pitfall #12).

Rein additiv, keine Migration, kein Daten-Backfill (Normalisierung passiert lesend im Konsumenten). Sichtbar überall, wo das Förderanträge-Detail rendert (prod/kurator/pl/dev). Scope: Vorgänger im selben Programm (Re-Einreichungen teilen das FKZ-Präfix); programm-übergreifende Vorgänger bewusst out of scope.

### v2.53 — Mapping-Editor: Spaltensuche + Gruppierung im Bearbeiten-Modus (Juni 2026)

MINOR-Bump v2.53: Im Schema-Detail-Dialog ([CsvSchemaDetailDialog.tsx](src/plugins/csv-sources-kuration/CsvSchemaDetailDialog.tsx), öffnet per Klick auf eine CSV-Quelle) zeigte der **read-only**-Modus die Spalten in kollabierbaren `group_path`-Gruppen, der **Bearbeiten**-Modus dagegen nur eine flache Liste — ohne Suche. Bei breiten CSVs (50+ Spalten) war die gesuchte Spalte schwer zu finden.

- **Spaltensuche in beiden Modi:** ein Suchfeld filtert nach CSV-Spaltenname, Label, Custom-Feldname und Standardfeld (Schlüssel + lesbares Label). Bei aktiver Suche werden alle Gruppen automatisch aufgeklappt; leere Gruppen fallen weg; „keine Treffer"-Hinweis.
- **Gruppierung im Bearbeiten-Modus:** der Edit-Modus rendert dieselben kollabierbaren Gruppen-Köpfe wie read-only (neues `EditBucketSection`), nur mit editierbaren `NewColumnRow`-Zeilen statt der read-only-Tabelle; Live-Zähler (Standard/Eigen/Ignore) pro Gruppe aus den noch nicht gespeicherten Entscheidungen.

Rein additiv, kein Datenmodell/Mapping-Verhalten geändert. kurator-only (kurator nach Login + dev).

### v2.52 — Ein-Klick „Spalten neu mappen" für CSV-Quellen (Juni 2026)

MINOR-Bump v2.52: Künftig werden laufend weitere CSV-Spalten zu Standardfeldern hochgestuft. Der bisherige Weg war Menü-Hopping (CSV neu wählen → Datei-Picker → Reimport-Review → „neue Spalten übernehmen" → Mapping → Import), und für eine bereits als Custom gemappte Spalte gab es gar keinen sauberen Editier-Pfad (`CsvSchemaDetailDialog` ist read-only). Neu: ein Button **„Spalten neu mappen"** pro CSV-Quelle ([CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx)).

- **Neuer Dialog** [RemapCsvColumnsDialog.tsx](src/plugins/csv-sources-kuration/RemapCsvColumnsDialog.tsx): lädt die zuletzt importierte CSV vom Share via `loadCsvSourceFile` (**kein Datei-Picker**), zeigt **alle** Spalten mit ihrem aktuellen Mapping vorbefüllt (`decisionFromEntry`), Suchfeld + Kind-Filter (Alle/Standardfeld/Eigenes Feld/Ignoriert) + Sample-Wert pro Spalte. „Speichern & neu verarbeiten" baut das Mapping via neuer `rebuildMapping`-Funktion ([new-column-mapping.ts](src/plugins/csv-sources-kuration/services/new-column-mapping.ts)) komplett neu (erhält XLS-`label`/`group_path`/`required`), `saveSchema` + force-Re-Import (`encodingOverride: 'UTF-8'`) in einem Schritt — Fortschritt + Buckets via `Step4Progress`.
- **Schutz:** Pflicht-Standardfelder (Join-Key; bei Master `aktenzeichen` + `unterprogramm_id`) sind im Editor gesperrt (read-only) und werden vor dem Speichern validiert — kein versehentliches Kaputt-Mappen der Identität.
- **Reuse:** generalisiert den additiven `CsvAddColumnsDialog`; `NewColumnRow` bekam optionale `sampleHint`/`locked`-Props. Funktioniert end-to-end dank des v2.51-Row-Hash-Fixes (Mapping-Änderung → „N geändert").

Rein additiv, keine Migration. kurator-only Plugin → sichtbar in `kurator` (nach Login) + `dev`. Unit-Tests für `rebuildMapping` + `decisionFromEntry` ([new-column-mapping.test.ts](src/plugins/csv-sources-kuration/services/__tests__/new-column-mapping.test.ts)).

### v2.51 — Re-Mapping einer CSV-Spalte propagiert beim Re-Import (Row-Hash-Fix) (Juni 2026)

MINOR-Bump v2.51: Der eigentliche Grund, warum die Spalte „Erstentscheidung" (v2.49/2.50) leer blieb. Der Kurator hatte `D_AZ1_1` im Wizard korrekt von Custom auf das Standardfeld `erstentscheidung` umgestellt und voll re-importiert — der Import meldete aber **„0 geändert · 12087 unverändert"**, also kein einziger Antrag wurde neu gemerged, das Feld nie geschrieben.

**Ursache:** `canonicalRowHash` ([hash.ts](src/core/services/csv/hash.ts)) bildete pro Zeile nur `Quellspalte=Wert` ab — **nicht** das Ziel-Feld der Zuordnung. Wird dieselbe Quellspalte (`D_AZ1_1`) bei unverändertem Wert von einem Custom-Feld auf ein Canonical-Feld umgehängt, blieb der Hash identisch → Row-Diff „unverändert" → `runMergeForDeltas` übersprungen (`hasDeltas=false`). Der `force`-Re-Import umgeht zwar den Datei-Checksum-Skip, aber der Row-Hash erkannte die Mapping-Änderung nicht (Doc-Kommentar behauptete fälschlich „Hash bezieht das Mapping ein" — galt nur für **hinzugefügte/entfernte** Spalten, nicht für **Ziel-Änderungen**).

**Fix:** Der Hash bezieht jetzt den aufgelösten Ziel-Feldschlüssel mit ein (`col>targetField=value`, `targetField` = canonical > custom > lowercase). Ein Re-Mapping derselben Spalte ändert damit den Hash → der force-Re-Import erkennt die betroffenen Zeilen als „geändert" und merged neu. Regressionstest in [hash.test.ts](src/core/services/csv/__tests__/hash.test.ts) (custom→canonical-Umhängung muss den Hash ändern).

**Einmaliger Effekt (selbstheilend, keine Migration, kein Datenverlust):** Weil sich das Hash-Format ändert, meldet der **nächste** Re-Import jeder CSV-Quelle alle Zeilen als „geändert" und merged einmalig komplett neu (13k-Recompute + Snapshot) — genau das macht hier die `erstentscheidung`-Werte sichtbar. Danach ist der Diff wieder stabil. **Roll-out für die leere Spalte:** kurator-Build v2.51 öffnen → `9097_AnB_AitisiGPT.csv` einmal re-importieren (Mapping ist bereits gespeichert, kein erneutes Zuordnen nötig) → jetzt zeigt der Dialog „12087 geändert", die Spalte „Erstentscheidung" füllt sich für Anträge mit Entscheidungs-Datum. Betrifft alle Varianten mit CSV-Import.

### v2.50 — Erstentscheidung: Mapping-Regressionstest + Klarstellung Re-Import (Juni 2026)

MINOR-Bump v2.50 (Nachzug zu v2.49): Beim Tester blieb die neue Spalte „Erstentscheidung" leer und das Standardfeld wurde im CSV-Wizard scheinbar nicht vorgeschlagen. Ursache ist **kein** Mapping-Defekt — die Name-/Alias-Auflösung ist korrekt (neuer Regressionstest [column-name-suggestions.test.ts](src/core/services/csv/__tests__/column-name-suggestions.test.ts): `buildSuggestionsFromColumnNames(['D_AZ1_1'])` → `erstentscheidung`, robust gegen Schreibvarianten). Die leere Spalte hat einen von zwei prozessualen Gründen:

- **Re-Import einer bestehenden CSV-Quelle behält die zuvor gespeicherte Spalten-Zuordnung.** War `D_AZ1_1` bei früheren Imports als Custom-Feld/ignoriert hinterlegt, bleibt diese Entscheidung beim Re-Import bestehen; die Auto-Suggestion ist nur ein Hinweis und überschreibt eine gespeicherte Zuordnung **nicht**. Der Kurator muss `D_AZ1_1` in Step 2 des Wizards **einmalig explizit** dem Standardfeld „Erstentscheidung" zuweisen und dann **voll** (nicht „überspringen") re-importieren. Erst danach trägt der Merger das Feld in alle Anträge ein.
- **Stale Build.** Parallel gebaute v2.49-Artefakte (Auslastungs-Arbeit ohne diese Spalte) tragen im Footer dieselbe Versionsnummer `v2.49`. Der sichtbar abweichende Footer `v2.50` macht eindeutig, dass die Erstentscheidung-Spalte enthalten ist.

Kein Code-Verhalten am Mapping geändert; rein additiv (Test + Doku + Versions-Disambiguierung). Betrifft alle Varianten mit Förderanträge-Plugin.

### v2.49 — Spalte „Erstentscheidung" in der Förderanträge-Tabelle (Juni 2026)

MINOR-Bump v2.49: Im Förderantrags-Workflow gibt es vor der finalen Entscheidung eine **vorläufige Erstentscheidung** (z.B. eine Ablehnung), gegen die noch Widerspruch eingelegt werden kann. Diese Information steht in der Master-CSV `9097_AnB_AitisiGPT.csv` in der Spalte **`D_AZ1_1`** (Datum der Erstentscheidung; leer = noch keine getroffen). Neu als optional einblendbare Tabellen-Spalte **„Erstentscheidung"** im „Spalten"-Picker der Förderanträge-Tabelle.

- **Neues kanonisches Standardfeld `erstentscheidung`** (`type: 'date'`, Antrag-Ebene) — modelliert exakt nach `bewilligung_datum`: `CanonicalField`-Union + `CANONICAL_FIELDS` ([constants.ts](src/core/services/csv/constants.ts)) + Name-Alias `d_az1_1` (Wizard-Auto-Suggestion beim Re-Import). Der CSV-Wizard bietet das Feld dadurch automatisch als Standard-Mapping-Slot an (kurator).
- **Slim-Store-Projektion** nachgezogen (die Tabelle liest nur aus `AntragListItem`, nicht aus dem vollen `Antrag`): `AntragListItem`-Interface ([types.ts](src/core/services/csv/types.ts)), `LIST_VIEW_FIELDS`-Whitelist, `toAntragListItem()` ([list-view.ts](src/core/services/csv/list-view.ts)).
- **Tabellen-Spalte** in `ANTRAG_TABLE_COLUMNS` ([tableColumns.tsx](src/plugins/antraege/tableColumns.tsx), `defaultVisible: false`, Jahr-Filter, Datums-Render) — Spalten-Picker, Persistenz-Store und XLSX-Export ziehen sie automatisch. Dev-Seed-Mapping in [schema-a.ts](docs/fixtures/schema-a.ts).

**Additiv, keine Migration** (Feld optional; bestehende `AntragListItem`/`auslastung.json` unberührt). **Roll-out-Schritt (kein Code):** damit die Spalte in der Echt-Installation Daten zeigt, muss ein Kurator die reale `9097_AnB_AitisiGPT.csv` über den CSV-Wizard **neu importieren** und `D_AZ1_1` dem Standardfeld „Erstentscheidung" zuordnen (per Alias auto-vorgeschlagen). Betrifft alle Varianten mit Förderanträge-Plugin (dev/demo/prod/kurator/pl).

### v2.48 — Matching transparent: Nebenkompetenz-Block + Score-Aufschlüsselung + „Nicht vorgeschlagen"-Liste (Juni 2026)

MINOR-Bump v2.48: Tester-Feedback aus der **pl-Variante** — das MA-Matching im Tab **Auslastung → Anträge zuweisen** sei „oft nicht nachvollziehbar" (ein MA mit Überkategorie DT + freier Kapazität wird nicht für einen DT-Antrag vorgeschlagen; unklar, wieviel Historie vs. Kompetenzmatrix zum Score beiträgt). Drei additive Maßnahmen, **keine Verhaltensänderung am bestehenden Haupt-Ranking** (bit-identisch):

- **(A) Nebenkompetenz-Pool sichtbar.** Der Eligible-Pool war hart auf `ma.hauptKategorie === antrag.freigegebenePrimaer` gegated ([matching-engine.ts](src/plugins/auslastung/services/matching-engine.ts)); `hauptKategorie` ist die *einzige stärkste* Überkategorie aus `deriveHauptNeben`. Ein MA mit DT nur als **Nebenkategorie** fiel damit still aus dem DT-Pool. Neu: `runMatchingWithContext` scort einen **zweiten, getrennt normalisierten** Nebenkompetenz-Pool (`primaer ∈ nebenKategorien`) und zeigt ihn im Cockpit als eigenen Block „Auch geeignet · Nebenkompetenz" (gleich zuweisbar, niedrigere Priorität). `runMatching` bleibt dünner Backwards-Kompat-Wrapper (`.vorschlaege`).
- **(B) „Nicht vorgeschlagen"-Liste.** Die bisher stillen Engine-Filter (`inaktiv`, `antragstyp`, `abgemeldet`, `kein-onboarding`, `rang`=Top-N-Schnitt) werden für kategorie-relevante MAs mit Grund zurückgegeben und im Cockpit als einklappbare Liste ([NichtVorgeschlagenListe.tsx](src/plugins/auslastung/components/NichtVorgeschlagenListe.tsx)) gezeigt — beantwortet „warum fehlt MA X?" direkt am echten Datenstand.
- **(C) Score-Aufschlüsselung.** `MatchResult.breakdown` (`histScore` = Historie · `matrixScore` = PL-Kompetenztabelle, `null` ohne Eintrag · `alpha` · `matchKind`) speist ein aufklappbares [ScoreBreakdownPanel.tsx](src/plugins/auslastung/components/ScoreBreakdownPanel.tsx) pro Vorschlag (Toggle am „Passung"-Label): zeigt den 50/50-Blend Historie↔Kompetenztabelle, den internen BM25↔Embedding-Mix und die Match-Stufe.

**Architektur:** Haupt- und Nebenpool werden in **separaten** `scorePool`-Pässen normalisiert → der Nebenpool verwässert das Haupt-Ranking nicht, und die Pre-v2.48-Engine-Tests bleiben grün (expliziter Parität-Test in [matching-engine-kontext.test.ts](src/plugins/auslastung/__tests__/matching-engine-kontext.test.ts)). **Additiv, keine Migration** (`breakdown?` optional; Alt-`auslastung.json` unberührt). Betrifft pl + dev (Varianten mit `features.auslastung`).

### v2.47.1 — Cold-Start-Fix: „Anträge zuweisen" zeigt sofort Match-MAs (Juni 2026)

PATCH-Bump v2.47.1: Im Tab **Auslastung → Anträge zuweisen** (pl) blieb das Vorschläge-Panel beim Cold-Start leer („Keine passenden MAs gefunden …"), obwohl aktive MAs mit Kapazität existierten — erst ein **Browser-Reload** brachte die Kandidaten. **Cold-Start-Store-Refresh-Klasse** (vgl. [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)): Der Plugin-`onInit` ruft `useKuerzelMap.load()` **vor** dem StartupScreen-Share-Grant; [loadKuerzelMap](src/plugins/auslastung/services/kuerzel-map.ts) schluckt den Permission-Fehler still und liefert `emptyKuerzelMap()`. [useKuerzelMap.load](src/plugins/auslastung/hooks/useKuerzelMap.ts) armte `loaded:true` aber **bedingungslos** → der `if (loaded) return;`-Guard fror die leere Map fest → leere `anonymMap` → leere `historischeDeskriptorenByAnon` → die Matching-Engine ([matching-engine.ts:189](src/plugins/auslastung/services/matching-engine.ts)) skippt **jeden** nicht-`onboardingAbgeschlossen` MA → leeres Panel bis Reload.

**Fix (spiegelt das v2.19.2-`isDatenShareReadable`-Gate von `useAuslastungData.load`):** `useKuerzelMap.load` setzt `loaded` jetzt nur, wenn der Daten-Share beim Read wirklich lesbar war — sonst bleibt `loaded:false`, und der Post-Grant-Mount lädt die echte Map nach. Zusätzlich lädt [AuslastungView](src/plugins/auslastung/views/AuslastungView.tsx) die kuerzel-map im Mount-Effekt explizit nach (symmetrisch zu `auslastung.json`). Regressionstest [kuerzelmap-coldstart-guard.test.ts](src/plugins/auslastung/__tests__/kuerzelmap-coldstart-guard.test.ts). Keine Migration, keine Verhaltensänderung außer „es ist jetzt sofort richtig". Betrifft pl + dev (Varianten mit `features.auslastung`).

### v2.47 — Themenkorpus-Build crasht Citrix-pl nicht mehr (Renderer-OOM) (Juni 2026)

MINOR-Bump v2.47: Fix für einen **„Aw, Snap!"-Renderer-Crash** (Out-of-Memory, URL `?p=e_awsnap`) beim **Themenkorpus-Build in der pl-Variante unter Citrix** (8 User auf 48 GB ≈ 6 GB/User). Der Build ist die speicher-intensivste Operation der App (~200-MB-Embedding-Modell im Main-Thread + 13k Vektoren + ~41-MB-Korpus). **Kern-Ursache:** der Build-Lock schützte nur den *Share-Upload*, nicht den *lokalen Build* — zwei User konnten gleichzeitig je ein 200-MB-Modell laden und gemeinsam den Renderer sprengen (die Fehlermeldung zeigte den parallelen „dev-user"-Build). Drei Maßnahmen:

- **(A) Build-Lock VOR dem lokalen Build.** `build()` in [EmbeddingCorpusSection.tsx](src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx) akquiriert jetzt zu Beginn `acquireBuildLock(idb, 'auslastung-corpus-build')` ([build-lock.ts](src/core/services/infrastructure/build-lock.ts)), hält ihn über den ganzen Build+Upload (`heartbeat` zwischen den Phasen, `releaseLock` im `finally`) und **bricht bei fremdem aktivem Lock ab** statt parallel zu bauen. Kein SMB/Schreibrecht (offline) → best-effort ohne Lock. `uploadFromIdb` ([useEmbeddingCorpusMirror.ts](src/core/hooks/useEmbeddingCorpusMirror.ts)) bekam dafür ein `opts.skipLock` (sonst sähe der Re-Acquire den eigenen Lock und würfe fälschlich „Build läuft bereits").
- **(B) Speicher-Warnung** als `confirm()` vor dem Build (200-MB-Modell, Citrix-Crash-Risiko).
- **(C) Neuer optionaler Flag `features.embeddingCorpusBuild`** (Helper `isEmbeddingCorpusBuildEnabled()`, [feature-flags.ts](src/config/feature-flags.ts); default `true`, `!== false`). In [configs/pl.config.json](configs/pl.config.json) auf **`false`** → die Buttons „Corpus aufbauen"/„Inkrementell" sind ausgeblendet, nur „Vom Datenspeicher laden" + „Cache leeren" bleiben (= dokumentiertes „einer baut, alle laden"-Modell). dev behält die Buttons (Flag fehlt = erlaubt).

**Recovery bei bereits abgestürztem Tab:** lokalen Embedding-Cache leeren („Cache leeren" bzw. `chrome://settings` Site-Data der `file://`-Seite). **Keine Datenmigration** (Flag optional, default true — nur pl-Verhalten ändert sich). **Build in pl wieder erlauben:** `embeddingCorpusBuild: true` in pl.config.json + `npm run build:pl` (dann tragen A+B die Sicherheit). Track-2-Folgearbeit (Embeddings als `Float32Array` statt `number[]` → halbierter Speicher, damit auch das Matching in 6 GB komfortabel läuft) ist als separater PR vorgemerkt.

### v2.42 — Screenshot-Anhänge mit Annotation im Feedback (Juni 2026)

MINOR-Bump v2.42: User (normal + PL) hängen einem Feedback **annotierte Screenshots** an — der Coding-Agent bekommt ein flaches Bild mit eingebrannter Markierung (oft wertvoller als Prosa). **Erfassung:** Clipboard-Paste (Win+Shift+S → Strg+V) + Datei-Upload ([FeedbackScreenshotInput.tsx](src/components/feedback/FeedbackScreenshotInput.tsx)); jedes Bild wird auf ≤1600px JPEG q0.85 runterskaliert (pure `computeScaledSize` + Canvas in [feedbackAttachments.ts](src/components/feedback/feedbackAttachments.ts)). **Annotation:** natives `<canvas>` 2D (Pfeil/Rechteck/Text/Stift) in [FeedbackAnnotator.tsx](src/components/feedback/FeedbackAnnotator.tsx) + [useAnnotationCanvas.ts](src/components/feedback/useAnnotationCanvas.ts) — Shapes werden flach ins Bild **gebrannt** (PNG), keine separate Persistenz, **keine externe Render-Lib** (file://-Constraint: kein html2canvas/getDisplayMedia). Globaler Shortcut **Strg+Alt+S** ([FeedbackButton.tsx](src/components/feedback/FeedbackButton.tsx) via `keyboardService`) öffnet das Panel mit fokussierter Paste-Fläche.

**Datenmodell:** neues optionales `FeedbackItem.attachments?: FeedbackAttachment[]` (`{ id, filename, caption?, mime, width, height, bytes }`) — **nur Referenz + Caption, kein base64** (sonst Aufblähen der gemergten `feedback.json`). Bilddateien liegen separat: Outbox neben den JSONs (`ZAH/feedback/outbox/${ticketId}-${attId}.${ext}`, `personal-storage:writeFeedbackAttachment`), Shared unter `_intern/feedback/attachments/` (`feedbackSharedFile:writeSharedAttachment`/`readSharedAttachment`). `submitFeedback` bekommt einen 4. Param `attachments` (Blobs), leitet die Dateinamen aus der finalen Ticket-id ab und schreibt die Blobs (Shared **oder** Outbox).

**Kurator-Einsammeln + Auto-Löschen (User-Wahl):** `autoCollectFeedbackOutboxes` kopiert die Bild-Bytes ins Shared, schreibt `feedback.json`, und löscht **erst danach** das Original am Ursprung (JSON + Bilder, `deleteOutboxItem`). **Kritische Invariante:** nur bei bestätigtem Shared-Write löschen — sonst `approved`-Fallback (Re-Import-Schutz), Bytes am Ursprung bleiben → kein Datenverlust. Kurator-Anzeige als Thumbnails + Lightbox ([TicketScreenshots.tsx](src/plugins/feedback/sections/TicketScreenshots.tsx)); `promptGenerator` listet die Screenshots (Dateiname + Caption) mit Hinweis zum manuellen Anhängen. Additiv, **keine Migration** (`attachments?` optional; Alt-Tickets gültig). Betrifft alle Varianten mit Feedback-Modul.

### v2.41 — Strukturiertes Typ-Formular für Feedback + sichtbare UX-Kategorie (Juni 2026)

MINOR-Bump v2.41: Der Feedback-Eingabe-Flow ist von einer leeren Textarea auf ein **typ-abhängiges Mini-Formular** umgestellt — **deterministisch + LLM-unabhängig** (in prod läuft fast nie ein echtes LLM, daher war `autoClassifyFeedback` dort ein No-Op und alles blieb „Unklassifiziert"). Der User wählt zuerst einen Typ (Bug/Feature/UX/Frage/Lob) und füllt 2–3 typspezifische Felder; genau ein Pflichtfeld pro Typ. Quelle ist `FEEDBACK_TYPES` ([constants.ts](src/components/feedback/constants.ts)); der ausgelagerte [FeedbackInputStep.tsx](src/components/feedback/FeedbackInputStep.tsx) hält das Formular (FeedbackPanel.tsx schrumpft wieder < 300 Z.). Die Feldwerte gehen als neues optionales `FeedbackItem.structured` (`Record<string,string>`) mit; `composeFeedbackText` baut parallel den lesbaren `item.text` (Board/Liste/Suche rendern darauf). `generateClaudeCodePrompt` rendert `structured` als typspezifische `###`-Abschnitte (Repro-Schritte beim Bug, Ziel/Begründung beim Feature, Problem/Verbesserung bei UX) — der eigentliche Qualitätsgewinn für den Coding-Agent. `autoClassifyFeedback` bleibt fire-and-forget, überschreibt aber die per Typ gewählte `category` NICHT mehr (nur noch `llm_summary`/`llm_classification`). `QUICK_TAGS` ist `@deprecated`; `FeedbackChatbot`/`feedbackLlm.ts` unverändert (optionaler Schärfen-Schritt).

**Bestands-Bug behoben (prod-Normalfall):** read-only Enduser → persönliche Outbox → Kurator sammelt ein. `submitToOutbox` ([feedbackService.ts](src/core/services/feedback/feedbackService.ts)) reicht jetzt `category` + `structured` mit, `FeedbackOutboxItem` ([personal-storage/types.ts](src/core/services/personal-storage/types.ts)) hat `structured?`, und `toFeedbackItem` ([feedbackOutboxCollect.ts](src/core/services/feedback/feedbackOutboxCollect.ts)) mappt beide ins `FeedbackItem` — vorher gingen sie verloren (alles „Unklassifiziert" trotz Typ-Wahl).

**Neue sichtbare Kategorie `ux`:** vorher nur LLM-Code (auf `idea` gemappt), jetzt eigene `FeedbackCategory` mit eigenem violettem Theme-Token `--tf-accent-*` ([theme.css](src/theme.css), Light+Dark), Label „UX", Icon `Wand2`. **Sponsorbar wie Features** — die Kopplung läuft über den neuen Helper `isSponsorableCategory(category)` = `idea || ux` ([feedbackSponsoring.ts](src/core/services/feedback/feedbackSponsoring.ts)) statt verstreuter `=== 'idea'`-Vergleiche (Board-Card/-Liste/-Page, Ticket-Detail, Sponsoring-Overview routen darüber). Keyword-Fallback `classifyByKeywords` bekommt einen `ux`-Cue-Block **vor** `idea`. Kategorie-Filter/-Zähler im Board + Kurator-Dashboard um „UX" erweitert. Cheatsheet [docs/agents/add-feedback-category.md](docs/agents/add-feedback-category.md) neu.

Additiv, **keine Migration**: `category?`/`structured?` sind optional, Alt-Tickets bleiben gültig (Badge „Unklassifiziert" bei undefined). Betrifft alle Varianten mit Feedback-Modul (dev/prod/kurator/pl/demo).

### v2.10 — Kurator-Login-Wall beim App-Start (Mai 2026)

> **Abgelöst durch v2.16** (siehe unten): Die Start-Gate-Logik läuft heute über das build-time Rollen-Passwort-Gate [AppPasswordGate](src/core/AppPasswordGate.tsx) + `isAppGateRequired()`. `KuratorLoginGate` ist deprecated; das Flag `features.requireKuratorLogin` bleibt nur als Legacy-Config-Feld (Deprecation-Warnung in `validateConfig`, [scripts/config-schema.mjs](scripts/config-schema.mjs)). Der TS-Helper `isKuratorLoginRequired()` wurde entfernt (war ohne Aufrufer). Block bleibt als Historie (append-only).

MINOR-Bump v2.10: Die **kurator-Variante** erzwingt beim Start einen Kurator-Login. Neuer Build-Flag `features.requireKuratorLogin` (nur in [configs/kurator.config.json](configs/kurator.config.json) `true`; dev hat zwar `kuratorMenus`, aber keine Wall — Auto-Kurator via Fixtures). Nach dem `StartupScreen` (Daten-Share-Permission steht, damit `kurator-config.enc` lesbar ist) entscheidet `decideKuratorGate` in [App.tsx](src/core/App.tsx): gültige rehydrierte Session → direkt App; konfiguriert + keine Session → **Pflicht-Login** via [KuratorLoginGate](src/core/KuratorLoginGate.tsx) (setzt bei Erfolg `profile.is_kurator` = Menüs frei + aktiviert die Session + stuft den Daten-Share-Handle per `refreshAllPermissions({isKurator:true})` auf `readwrite` hoch, vgl. Pitfall #25); nicht konfiguriert / offline (`isKuratorConfigured`=false) → still übersprungen. Da `kurator-config.enc` auf dem geteilten Daten-Share liegt, ist „konfiguriert" team-weit nach dem ersten Setup immer wahr. Additiv, keine Migration; dev/prod/pl/demo unverändert (`requireKuratorLogin: false`).

### v2.11 — MA-Login via Passwort (Kürzel-Ableitung) (Juni 2026)

MINOR-Bump v2.11: Die **prod-Variante** erzwingt beim Start eine MA-Login-Wall. Neuer Build-Flag `features.maLogin` (nur `prod` + `dev` `true`; demo/kurator/pl `false`). Das Bearbeiter-Kürzel wird nicht mehr frei im Profil getippt, sondern aus dem **persönlichen Passwort entschlüsselt** (Decrypt = Auth, kein Hash-Vergleich) — das verhindert beiläufiges Fremd-Eintragen durch normale User. Pro MA liegt in `_intern/auslastung-zugang.enc` ein eigenes Salt + AES-GCM-verschlüsseltes Kürzel (selbe Krypto wie `kurator-config.enc`, [crypto.ts](src/core/services/infrastructure/crypto.ts) wiederverwendet) + pseudonyme `anonId` für sauberes Replace/Revoke; kein Klartext-Kürzel/-Passwort/-Hint. `verifyPasswortAgainstAll` ([zugang-config.ts](src/core/services/infrastructure/zugang-config.ts)) probiert das eingegebene Passwort gegen alle Einträge durch (Early-Exit) — im Web Worker (`?worker&inline`, [zugang-worker.ts](src/core/services/infrastructure/zugang-worker.ts)) mit Main-Thread-Fallback. Nach dem `StartupScreen` (Daten-Share-Permission steht, damit die Zugangsdatei lesbar ist) entscheidet `decideMaGate` in [App.tsx](src/core/App.tsx): Flag aus → keine Wall; rehydrierte sessionStorage-Session (Same-Tab-Reload) → direkt App; Zugangsdatei vorhanden + nicht angemeldet → **Pflicht-Login** via [MaLoginGate](src/core/MaLoginGate.tsx); **Zugangsdatei fehlt → übersprungen** (sanfter Rollout: solange `_intern/auslastung-zugang.enc` nicht existiert, bleibt das alte editierbare Kürzelfeld aktiv). Mutual-exclusive zur Kurator-Wall (prod hat `maLogin`, kurator `requireKuratorLogin` — nie beides; `validateConfig()` warnt sonst). Session in `sessionStorage` ([useMAIdentity](src/core/hooks/useMAIdentity.ts), Key `tf-ma-kuerzel`): abgelegt wird NUR das **Kürzel**, nie Passwort/Key; TTL = Browser-Tab (Login pro Arbeitstag). Zentraler Getter [useMeinKuerzel](src/core/hooks/useMeinKuerzel.ts) (Session > Profilfeld) — alle Kürzel-Konsumenten lesen darüber statt `profile.bearbeiter_kuerzel` direkt (Pitfall #27); das Profil-Kürzelfeld ist im Login-Modus read-only. Die **PL** (pl-Variante, Flag `features.maVerwaltungPasswort`, nur `pl` + `dev`, braucht `datenShareSchreibrecht`) erzeugt im MA-Bearbeiten-Tab Passwörter (pro MA + Batch „für alle aktiven MAs", auf eine aktive De-Anon-Session gated) via [ZugangPasswortSection](src/plugins/auslastung/components/ZugangPasswortSection.tsx) + 2-Wort-Passphrase und zeigt das generierte Klartext-Passwort einmalig im PasswortAnzeigeDialog. Additiv, keine Migration; demo/kurator unverändert (`maLogin: false`).

### v2.15 — PL-Kompetenz-Vorbelegung per XLSX + editierbare Matrix (Juni 2026)

MINOR-Bump v2.15: Die **PL** lädt eine Kompetenz-XLSX (pro TIB-Kürzel: Antragstyp-Kontingent DL/DS/NW/FuE als Anträge/Jahr, Abschlag %, sowie Kompetenz-Level 1/2/3 je Unterkategorie über die fünf Überkategorien IT/DT/EU/LG/NM) hoch und kann die Werte danach in einer xlsx-ähnlichen, editierbaren Tabelle pflegen. Damit sind alle MAs sofort matchbar — auch ohne MA-Selbsteingabe. Neuer Tab **„Kompetenzen"** im Auslastungs-Plugin ([KompetenzMatrixView](src/plugins/auslastung/views/KompetenzMatrixView.tsx) + [KompetenzMatrix](src/plugins/auslastung/components/kompetenz/KompetenzMatrix.tsx) + [KompetenzImportDialog](src/plugins/auslastung/components/KompetenzImportDialog.tsx)). Die Matrix-Tabelle ist in `src/plugins/auslastung/components/kompetenz/` in Sub-Komponenten zerlegt (`MatrixRow`, `MatrixHeader`, `MatrixToolbar`, `MatrixControls`, `LevelCell`, `CapCell`, `HauptkatChip`, `RevealBar`). Additive optionale Felder auf `AnonymerMitarbeiter`: `kompetenzMatrix` (ÜberkatID → Unterkat.-Label → Level), `jahresKapazitaetProTyp` (Anträge/Jahr je Bucket), `kompetenzQuelle: 'pl-upload'`; sowie `config.kompetenzSchema` (Spalten-Schema aus dem XLSX-Header) + `config.kompetenzLevelGewicht`/`kontingentGewicht`. Parser [kompetenz-import.ts](src/plugins/auslastung/services/kompetenz-import.ts) liest das Merge-Header-Layout (Zeile 1 Überkat-Merges, Zeile 2 Unterkat-Labels), löst `TIB_KUERZ` → anonId via Kürzel-Map (NFC, Pitfall #22), unbekannte Kürzel → warnen+überspringen (keine Phantom-MAs); reine Ableitung in [kompetenz-derivation.ts](src/plugins/auslastung/services/kompetenz-derivation.ts) (`deriveHauptNeben`, `kompetenzTokens`, `normLevelForUeber`). Merge = **Überschreiben** über eine Batch-Store-Action `applyKompetenzMatrixBatch` (ein setState + ein persist, Pitfall #16/#20); leitet Haupt-/Nebenkategorie aus der Matrix ab + setzt `onboardingAbgeschlossen` (Matcher-Gate). Matcher: BM25-Profil-Doc bekommt level-gewichtete Unterkat.-Tokens (Level 3 = Token 3×), Engine skaliert den Kompetenz-Score mit dem Überkat.-Level der Primärkategorie und deckelt weich per Antragstyp-Kontingent ([kontingent.ts](src/plugins/auslastung/services/kontingent.ts)) — alles backward-kompatibel (ohne Matrix Faktor 1.0 = altes Verhalten). Datenschutz: Matrix-Tabelle zeigt anonIds; Klartext-Kürzel nur in Varianten mit Flag `deAnonymisierung` (pl/dev — seit v2.17 ohne zusätzliches De-Anon-Passwort). Additiv, keine Migration; bestehende `auslastung.json` ohne die Felder laden mit Defaults.

### v2.16 — Build-Time Rollen-Passwort-Wall für PL + Kurator (Juni 2026)

MINOR-Bump v2.16: Die **pl-** und die **kurator-Variante** sind jetzt passwortgeschützt — ohne korrektes Rollen-Passwort ist die App nicht nutzbar. Hintergrund: der geplante „geschützte SMB-Bereich" für die PL existiert nicht (alle haben AD-seitig read+write, Schutz nur clientseitig), daher Zugangskontrolle per Passwort statt SMB-Berechtigung. Ein **build-time eingebackener** Verifier (kein Klartext, keine SMB-Datei) löst die alte v2.10-Kurator-Wall ab und vereinheitlicht beide Rollen über **ein** generisches Vollbild-Gate [AppPasswordGate](src/core/AppPasswordGate.tsx).

Neuer optionaler Config-Block `auth: { required, salt, verifier, hint? }` ([runtime-config.ts](src/config/runtime-config.ts), `TeamflowAuthConfig`); fließt automatisch via Vite-`define` zur Laufzeit (kein Whitelist nötig). Gesetzt wird er **nie von Hand**, sondern via `npm run set-password -- <pl|kurator> "<passwort>"` ([scripts/set-app-password.mjs](scripts/set-app-password.mjs)) — berechnet Salt + AES-GCM-Verifier (selbe Krypto wie [crypto.ts](src/core/services/infrastructure/crypto.ts): PBKDF2-SHA256 200k, AES-GCM-256, Blob `[12B IV][ct+tag]`) und schreibt nur den Verifier in die Variant-Config. Runtime-Verify: [verifyAppPassword](src/core/services/infrastructure/app-password.ts) (decrypt = auth, Sentinel `{v:1,role}`; alle Fehler → `{ok:false}`). Helper `isAppGateRequired()` ([feature-flags.ts](src/config/feature-flags.ts)); `isKuratorLoginRequired` ist `@deprecated`.

Gate-Entscheidung `decideAppGate` ([App.tsx](src/core/App.tsx)) läuft NACH dem StartupScreen, **synchron + unbedingt**: kein `auth.required` → keine Wall; sessionStorage-Flag (`tf-app-gate`, [useAppGateSession](src/core/hooks/useAppGateSession.ts), TTL = Browser-Tab) → übersprungen; sonst Pflicht-Login. Render-Kette: Onboarding → Welcome → Startup → **AppPasswordGate** → MaLoginGate → AppRouter. **Rollenbewusst**: in der kurator-Variante (`isKuratorMenusEnabled()`) führt der Erfolg die volle Kurator-Eskalation aus — `is_kurator` (Menüs), Schreib-Session via neuer Store-Methode `useKuratorSession.activateSynthetic` (IDB-Meta + Audit `kurator_login_buildtime`, **ohne** SMB-Lesen von `kurator-config.enc`), readwrite-Handle-Upgrade (`refreshAllPermissions`, Pitfall #25) — exakt wie der alte [KuratorLoginGate](src/core/KuratorLoginGate.tsx) (deprecated, bleibt für `KuratorSessionPanel`-Referenz). Die pl-Variante schaltet nur frei (hat `datenShareSchreibrecht` build-time). Build-Guard in `validateConfig()`: `auth.required=true` ohne `salt`/`verifier` → ERROR (sonst wäre die App ausgesperrt).

**Audit-Identität:** bei Shared-Passwort gibt es keine Person → Audit-`user` = Build-Label (z.B. „ZAH Kurator"). **Sicherheits-Einordnung:** Casual-Access-Gate (verhindert versehentliches Öffnen durch normale MAs), konsistent mit dem Single-Team-Trust-Modell; der Verifier ist offline brute-forcebar (starkes Passwort wählen). Passwort wechseln = `set-password` + Rebuild. Additiv, keine Daten-/IDB-/SMB-Migration; dev/prod/demo unverändert (kein `auth` → keine Wall; prod behält die per-User-MA-Wall `maLogin`). Mutual-exclusive zur MA-Wall (pl/kurator haben `maLogin:false`).

### v2.17 — De-Anon-Passwort + anonymer Export entfernt (Juni 2026)

MINOR-Bump v2.17: Da der pl-Build seit v2.16 beim App-Start per Rollen-Passwort gated ist, ist die **zweite** Schutzschicht im Auslastungs-Modul redundant und entfällt:

- **De-Anon-Passwort/Session weg.** Die `useDeAnonSession`-Wall (24h-TTL, Chip „Klartext (Xh)" + Popover) ist gelöscht — samt [PrivacyChip]/[PrivacyPopover] und `deanon-config.ts` (+ `DEANON_*`-Konstanten in [types.ts](src/core/services/infrastructure/types.ts)). `useDeAnonName`/`useDeAnonResolver` ([AnonymIdBadge.tsx](src/plugins/auslastung/components/AnonymIdBadge.tsx)) gaten nur noch auf das **bestehende** Feature-Flag `deAnonymisierung` (true in pl/dev) → echte Kürzel werden dort **immer** angezeigt (kein zweites Passwort). Konsumenten (VorschlagCard, KompetenzMatrix, KalibrierungsReport, OnboardingImportDialog, MaListSection, ZugangPasswortSection) lesen unverändert über die Resolver — der MA-Login-Passwort-Generator ([ZugangPasswortSection](src/plugins/auslastung/components/ZugangPasswortSection.tsx)) ist nicht mehr auf die De-Anon-Session gated, nur noch auf `maVerwaltungPasswort`.
- **Anonymer Export weg.** „Export (anonym)" / „Anonym (XLSX)" sind aus beiden Oberflächen ([ZuweisungsCockpit](src/plugins/auslastung/views/ZuweisungsCockpit.tsx) + [admin/ImportExportSection](src/plugins/auslastung/views/admin/ImportExportSection.tsx)) entfernt; `exportAnonymousXlsx` ist gelöscht. Es bleibt nur der Kürzel-Export.

**Bewusst behalten:** die Anonymisierung der *gespeicherten* Daten (`auslastung.json` = MA01-IDs; echte Kürzel nur in `auslastung-kuerzel-map.json` + RAM) — schützt die Daten *at rest* auf dem geteilten Share, unabhängig vom Passwort. Additiv, keine Daten-/IDB-/SMB-Migration; ein evtl. vorhandenes `_intern/deanon-config.enc` verwaist harmlos (nichts liest es mehr). dev/prod/demo/kurator unverändert (kein De-Anon-Modul sichtbar).

### v2.18 — CSV-Auto-Refresh-Banner auch in der PL-Variante (Juni 2026)

MINOR-Bump v2.18: Der Homepage-**CSV-Auto-Refresh-Banner** (registrierte CSV-Quelle hat neueres `lastModified` → „Jetzt aktualisieren" → Import-Pipeline) läuft jetzt auch in der **pl-Variante**, nicht nur im Kurator-Build. Neuer Build-Flag `features.csvAutoRefresh` (default false; nur `pl` + `dev` true) — eine *zusätzliche* OR-Bedingung neben `kuratorMenus` für Render-Gate ([ShellLayout.tsx](src/core/ShellLayout.tsx)) und Hintergrund-Check ([useCsvAutoRefreshCheck.ts](src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts)). Helper `isCsvAutoRefreshEnabled()` ([feature-flags.ts](src/config/feature-flags.ts)). Die Import-Pipeline (`importCsvSource` → `acquireBuildLock` → Snapshot-Write) hat keinen Kurator-Session-Guard, braucht nur ein `readwrite`-Daten-Share-Handle — das hat die pl via `datenShareSchreibrecht` (`canWriteDatenShare`).

**v2.19.1-Fix:** Bereits verknüpfte CSV-Dateien lösten bei JEDEM Neustart erneut den „braucht Verknüpfung"-Banner aus — Ursache: FSAPI-Datei-Berechtigungen gehen unter `file://` pro Session verloren (`queryPermission` → `prompt` → `permission_required`), und die CSV-Handles wurden — anders als der Daten-Share — beim Start nicht neu freigegeben. `refreshAllPermissions` ([smb-handle.ts](src/core/services/infrastructure/smb-handle.ts)) re-grantet jetzt im selben Start-Gesture auch die `CSV_SOURCE_HANDLES_IDB_KEY`-Datei-Handles (gated `kuratorMenus || csvAutoRefresh`, best-effort) → der Banner erscheint danach nur noch für nie-verknüpfte Quellen oder echte Updates.

Drei Rollen-Unterschiede pl vs. kurator: (1) **Trigger ohne Kurator-Session** — im pl-Modus (`csvAutoRefresh` ohne `kuratorMenus`) genügt SMB-online beim Mount statt `session.isActive`; der Session-Reset-Effekt ist auf den Kurator-Modus gegated. (2) **Datei-Handle-Lücke** — die pl bekommt die Schemas per Share-Snapshot, aber nie ein `FileSystemFileHandle` (entsteht sonst nur im kurator-only Wizard). Ein schlanker Picker schließt die Lücke: der Banner listet Quellen ohne Handle, `pickAndLinkCsvSource` ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts)) öffnet `showOpenFilePicker` + speichert das Handle (validiert grob gegen `column_mapping`, überschreibt `source_last_modified` NICHT) — UI: [CsvSourceLinkDialog](src/plugins/csv-sources-kuration/components/CsvSourceLinkDialog.tsx). (3) **Keine Kuration-Navigation** — die pl hat das `csv-sources-kuration`-Plugin nicht; `permission_required`/`no_handle` routen über den Picker statt „Zu CSV-Sources", Drift kann nur gemeldet, nicht aufgelöst werden (Spalten-Remapping = Kurator-Wizard). **Audit-Identität** in der pl = Build-Label „ZAH PL" (konsistent mit v2.16 Shared-Passwort-Rollen). **Bekannte Kosmetik:** der Build-Lock-Owner kommt aus `readKuratorName() ?? 'dev-user'` — in der pl also `'dev-user'`. Additiv, keine Migration; demo/prod/kurator unverändert (`csvAutoRefresh: false`).

### v2.19 — Auslastungs-Embedding-Korpus: Selbstheilung auf neuem Rechner + Verbund-Mirror (Juni 2026)

MINOR-Bump v2.19: Fix für „automatische Klassifizierung fehlt + Kompetenz/Kapazität nicht verknüpft" bei einem **PL auf einem neuen Rechner**. Ursache: Die Embedding-Caches des Auslastungs-Moduls liegen **maschine-lokal in der IDB** und wurden auf einem frischen Rechner nicht (vollständig) vom Share rekonstruiert; der Download/Build steckte nur im zugeklappten „Erweitert"-Accordion. Zwei Lücken geschlossen ([corpus-share-sync.ts](src/plugins/auslastung/services/corpus-share-sync.ts)):

- **Verbund-Embeddings werden jetzt mitgespiegelt.** Die Klassifizierung matcht **Verbund-Embeddings** (`auslastung-emb-verbund:*`) gegen Kategorie-Centroids; der core-Mirror ([mirror.ts](src/core/services/embedding-corpus/mirror.ts)) deckt nur den **per-Antrag**-Korpus ab. Neue Sidecar-Dateien `_intern/auslastung-embedding-corpus-verbund.{manifest.json,bin}` (Reuse der key-agnostischen `serializeCorpus`/`parseCorpus`; Manifest-Feld `aktenzeichen` hält hier verbundIds). Upload in `EmbeddingCorpusSection.build()` direkt nach dem per-Antrag-`uploadMirror`.
- **Selbstheilung statt Accordion-Suche.** `ensureVerbundEmbeddings()` / `ensureAntragCorpus()` laden den jeweiligen Korpus „download-if-empty" vom Share (Modell-kompat-gegated, per-Antrag zusätzlich `aktenzeichenSetHash`-gegated), eingehängt direkt in die Lade-Pfade der Views ([KlassifizierungsReview](src/plugins/auslastung/views/KlassifizierungsReview.tsx) bzw. [useMatchingCorpus](src/plugins/auslastung/hooks/useMatchingCorpus.ts) für das Zuweisungs-Cockpit) — keine Race mit dem View-State, idempotent (Count-Guard) + Modul-Inflight-Dedupe. Schlägt der Download fehl (kein/inkompatibler Korpus auf dem Share), zeigt die Klassifizierung einen Hinweis-Banner mit dem Build-Pfad statt stiller 0-Vorschläge.

**Transition:** Bestehende Shares haben noch keinen Verbund-Mirror → ein Kurator/PL muss den Korpus **einmal neu aufbauen** (Tab „Auslastung MA" → „Erweitert" → „Corpus aufbauen"), danach laden neue Rechner Klassifizierung **und** Matching in Sekunden vom Share (ohne lokales Modell/Rebuild). Klassifizierung braucht nach dem Download kein Embedding-Modell mehr (Vergleich vorberechneter Vektoren); das Zuweisungs-Cockpit embedded die Antrags-Query weiterhin live (Modell nötig). Additiv, keine Migration; core `mirror.ts` unverändert. Schreib-Profil der Verbund-Sidecars: `skipBackup` (rebuildbar, Pitfall #23); Modell-Wechsel bleibt team-weiter Bruch (Pitfall #19).

**v2.21 (Tab „Einstellungen"):** Die Admin-/Konfig-Sektionen (Kategorien, CSV-Import/Export, Konfiguration, Themen-Vektoren/Embedding-Korpus) sind aus dem default-zugeklappten „Erweitert"-Aufklapper des Tabs „Auslastung MA" in einen **eigenen Tab „Einstellungen"** am Ende der Tab-Leiste gewandert ([EinstellungenView.tsx](src/plugins/auslastung/views/EinstellungenView.tsx)); [UebersichtView](src/plugins/auslastung/views/UebersichtView.tsx) zeigt nur noch Statistik + MA-Liste. Nebeneffekt: weil der Tab eager gemountet wird (v2.9-Pattern), läuft der Embedding-Korpus-Auto-Download/Manifest-Check jetzt beim Modul-Open statt erst beim Aufklappen — die Themen-Vektoren sind also leichter auffindbar UND der Share-Korpus wird früher gezogen. UI-Refactor, keine Daten-/Verhaltensänderung an den Sektionen selbst.

**v2.20 (Korpus 1-Klick vom Share laden):** Workflow „GPU-Build einmal auf dev → auf den zentralen Share kopieren → PL-Rechner laden nur noch" robuster gemacht. Neuer Button **„Vom Datenspeicher laden"** in [EmbeddingCorpusSection](src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx) (sichtbar wenn ein modell-kompatibles Share-Manifest existiert + lokal nicht voll synchron): räumt den lokalen Cache (ein angefangener CPU-Build würde den Auto-Download sonst blockieren) und zieht **per-Antrag- + Verbund-Korpus** in ~10 s — ignoriert bewusst den `aktenzeichenSetHash` (manueller „trotzdem laden"-Pfad; Modell-Kompat bleibt Pflicht via Button-Gate). Der Hash-Mismatch-Hinweis bietet den Download jetzt als schnelle Alternative zum Rebuild an. Lädt der Verbund-Teil nicht (Share-Korpus von vor dem v2.19-Verbund-Mirror), weist der Button darauf hin, dass auf einem aktuellen Build „Corpus aufbauen" laufen muss. Damit muss der GPU-intensive Build nur **einmal** auf einem starken Rechner laufen; alle PL-Rechner laden per Klick statt stundenlang auf CPU zu rebuilden.

**v2.19.2-Fix (Auslastung-Cold-Start):** Auf der pl zeigte das Auslastungs-Modul nach (Neu-)Start „0 MAs · 5 Kategorien · keine Centroids" — der Leer-/Default-Zustand. Ursache: der Plugin-`onInit` lädt `auslastung.json` schon bei `storage.init()`, also VOR dem StartupScreen-Permission-Grant; `loadAuslastungData` schluckt den Permission-Fehler still und liefert Leer-Daten, die der Store als `loaded:true` festschreibt — die Idempotenz-Guard (`if loaded && !error return`) blockt dann jeden Post-Grant-Reload. Fix: der Store setzt `loaded` nur noch scharf, wenn der Daten-Share beim Laden wirklich lesbar war (neuer Core-Helper [`isDatenShareReadable`](src/core/services/infrastructure/smb-handle.ts) — silent `queryPermission` read==='granted'); sonst bleibt `loaded:false` und der erste AuslastungView-Mount nach dem Grant lädt nach. **Hinweis:** zeigt der Rechner nach dem Fix weiter 0 MAs, fehlen die Setup-Daten (Kompetenz/Centroids) tatsächlich in `_intern/auslastung.json` auf dem zentralen Share → einmal auf einem Schreib-Rechner persistieren.

### v2.27 — CSV-Auto-Refresh: EIN Ordner-Handle statt N Per-Datei-Handles (Juni 2026)

MINOR-Bump v2.27: Behebt den hartnäckigen pl-Bug „nach jedem Browser-Neustart müssen die CSV-Quellen erneut verknüpft werden" (Folgebug des v2.19.1-Fixes). **Root Cause:** Unter `file://` verlieren FSAPI-Permissions bei jedem Browser-Neustart ihre Berechtigung, und Chromium verbraucht die transiente User-Activation **pro Permission-Prompt** — nur der **erste** Prompt pro User-Gesture wird angezeigt. In [`refreshAllPermissions`](src/core/services/infrastructure/smb-handle.ts) prompted der Daten-Share zuerst und verbrauchte den Gesture; die nachgelagerte CSV-Datei-Handle-Schleife (v2.19.1) schlug still fehl. Auf der pl half auch der zweite Boot-Gesture (AppPasswordGate-Login) nicht, weil dessen `refreshAllPermissions`-Aufruf hinter `isKuratorMenusEnabled()` gated war (pl: `kuratorMenus:false` → verschenkter Gesture). Auf dev unsichtbar, weil dort CSV-Quellen aus Fixture-Blobs geseedet werden (kein Datei-Handle in IDB).

**Fix:** Statt N Per-Datei-Handles wird **EIN** `FileSystemDirectoryHandle` für den Ordner verknüpft, in dem alle CSV-Quelldateien liegen (neuer IDB-Key `CSV_SOURCE_DIR_HANDLE_IDB_KEY`, [types.ts](src/core/services/infrastructure/types.ts)). FSAPI-Directory-Permission **kaskadiert** auf die Kind-Dateien (`dirHandle.getFileHandle(name)`), also deckt **ein** Re-Grant alle CSVs mit **einem** Prompt ab — das umgeht das one-prompt-per-gesture-Limit. Der Re-Grant läuft im **sauberen** pl-AppPasswordGate-Gesture über die neue [`refreshCsvSourceDirPermission`](src/core/services/infrastructure/smb-handle.ts) (NUR das Ordner-Handle — nicht `refreshAllPermissions`, sonst stiehlt der persoenlich-Handle den Prompt-Slot). [csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts): `resolveFileViaDir` (Match per `source_file_name`, Fallback Header-Validierung — `source_file_name` ist auf pl-Snapshot-Schemas nicht zuverlässig gesetzt), `pickAndLinkCsvFolder` (Ordner-Picker statt Datei-Picker), `checkSourceForUpdate`/`loadFileFromStoredHandle` lösen bevorzugt über das Ordner-Handle auf (Per-Datei-Handle bleibt Fallback). UI: [CsvSourceLinkDialog](src/plugins/csv-sources-kuration/components/CsvSourceLinkDialog.tsx) bietet primär „CSV-Ordner verknüpfen".

**Migration:** keine stille — der User verknüpft **einmalig** den Ordner über den Banner („CSV-Ordner verknüpfen"); gematchte Quellen verlieren ihr nun überflüssiges Per-Datei-Handle (`removeCsvSourceHandle`). Bis dahin läuft der Legacy-Per-Datei-Pfad als Fallback weiter (nichts regrediert). **Constraint:** die Kaskade ist nicht rekursiv — alle CSVs müssen **direkt** im gewählten Ordner liegen. Additiv, keine Daten-/IDB-/SMB-Migration; demo/prod/kurator unverändert (kurator nutzt weiter den Wizard-Per-Datei-Pfad, profitiert aber automatisch vom Dir-Handle, falls eins existiert).

**v2.27.1 (CSV-Ordner in Einstellungen/Speicher):** Der CSV-Quellen-Ordner erscheint jetzt in **Einstellungen → Speicher** als dritte Datenquelle neben „Datenordner" und „Persönlicher Ordner" (gated `csvAutoRefresh || kuratorMenus` → pl + kurator + dev), [SpeicherTab.tsx](src/plugins/einstellungen/SpeicherTab.tsx). Zeigt Ordnername + Online/Offline (silent `queryCsvSourceDirPermission`) und bietet „Verknüpfen"/„Ändern" (`pickAndLinkCsvFolder`, Picker direkt im Klick-Gesture — CSV-Schemas werden im Mount-Effect vorab geladen, damit kein `await` vor dem Picker die file://-User-Activation verbrennt) + „Trennen" (`clearCsvSourceDirHandle`). Reiner UI-Zusatz, keine Logik-/Daten-Änderung.

**v2.27.2-Fix (Cold-Start-Perf des Ordner-Scans):** Nach dem Ordner-Verknüpfen dauerte der erste Home-Load auf der pl ~10 s statt ~2 s (danach schnell, weil OS-SMB-Cache warm). Ursache: `resolveFileViaDir` fand die Datei zu einem Schema per **Header-Scan** (liest + parst JEDE CSV im Ordner) — und `checkSourceForUpdate` lief das bei **jedem** Mount für **jede** Quelle erneut, weil keine schemaId→Datei-Zuordnung persistiert war (`source_file_name` ist auf pl-Snapshot-Schemas leer). Auf kaltem SMB-Cache = mehrere Sekunden, schlecht skalierend. **Fix:** eine **lokale, nicht synchronisierte** IDB-Filemap `CSV_SOURCE_DIR_FILEMAP_IDB_KEY` (schemaId→Dateiname), geschrieben in `pickAndLinkCsvFolder` + **self-heal** beim ersten `checkSourceForUpdate`/`loadFileFromStoredHandle`. `resolveFileViaDir(dir, schema, knownFileName?)` nimmt damit den schnellen `getFileHandle`-Pfad (nur Metadaten, kein Scan/Parse) → auch bei kaltem Cache schnell. Bewusst ein **eigener** Key statt `source_file_name` auf dem Schema, damit der Share-Snapshot die Zuordnung nicht überschreibt. `clearCsvSourceDirHandle` löscht die Filemap mit. Reiner Perf-Fix, keine Datenänderung.

### v2.28 — CSV-Quellen: Dateinamen-Zuordnung team-weit auf dem Daten-Ordner (Juni 2026)

MINOR-Bump v2.28: Die schemaId→Dateiname-Zuordnung der CSV-Quellen wird **einmal team-weit** auf dem Daten-Ordner gespeichert, statt sie auf jedem PL-Rechner per Header-Scan neu zu ermitteln (Folge-Optimierung zum v2.27.2-Perf-Fix). Damit muss ein **neuer PL-Rechner nur noch den CSV-Ordner freigeben** — die App kennt die exakten Dateinamen aus der geteilten Datei und löst direkt per `getFileHandle(name)` auf (kein Scan, auch nicht einmalig).

Neue Sidecar-Datei `_intern/csv-source-filenames.json` (`{version, updatedAt, mappings: schemaId→fileName}`, [csv-source-filenames.ts](src/plugins/csv-sources-kuration/csv-source-filenames.ts), Schreib-Profil idempotent-overwrite/atomicWrite, Pitfall #23). **Zwei Schreib-Pfade:** (1) der Kurator bei der Erstregistrierung im Wizard ([CsvSourceWizard.tsx](src/plugins/csv-sources-kuration/wizard/CsvSourceWizard.tsx) — setzt zusätzlich `source_file_name`/`source_last_modified` am Schema, das via Snapshot zu den PLs fließt), (2) der **erste PL** beim Ordner-Verknüpfen (`pickAndLinkCsvFolder`, hat die echten Dateien → validierte Namen). Beide best-effort (braucht Daten-Share-Schreibrecht: Kurator-Session ODER `datenShareSchreibrecht`/pl). **Lese-Pfad:** `collectCandidates` ([useCsvAutoRefreshCheck.ts](src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts)) seedet beim Check die **lokale** Filemap (v2.27.2) aus der geteilten Datei — **lokale Einträge (eigener Scan/Heal) haben Vorrang** und werden nicht überschrieben. Danach nimmt `resolveFileViaDir` den schnellen Dateinamen-Pfad.

**Robust gegen Abweichungen:** passt ein geteilter Dateiname auf einem Rechner nicht (umbenannt / anderer Export), schlägt `getFileHandle` fehl → Fallback auf den lokalen Header-Scan + Self-Heal (v2.27.2). Der erste PL mit den echten Dateien korrigiert die geteilte Zuordnung beim Verknüpfen. Additiv, keine Migration; ein evtl. fehlendes Sidecar = altes Verhalten (lokaler Scan einmalig). demo/prod unverändert (kein CSV-Auto-Refresh).

**v2.28.1-Fix (Home zeigt importierte Daten erst nach Reload):** Auf einem frischen System lud `runRefresh` (Banner „Datenbestand aktualisieren") via `importCsvSource` die Anträge nach IDB, aber der In-Memory-`useAntraegeStore` wurde NICHT neu geladen — die Home blieb leer bis zum manuellen Browser-Reload (cold-start-store-refresh-Klasse, vgl. [cold-start-store-refresh-pattern]). Fix: `runRefresh` ([useCsvAutoRefreshCheck.ts](src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts)) ruft nach erfolgreichem Import pro betroffenem Programm `refreshAntraegeStoreAfterSync` ([snapshot-refresh.ts](src/plugins/antraege/snapshot-refresh.ts)) auf — dieselbe `force`-Reload-Logik (inkl. Cold-Start-Guard) wie nach dem Snapshot-Sync (v2.21.3). Die Home liest den Store reaktiv → Daten erscheinen sofort. Gilt für pl + kurator (gemeinsamer Banner-Pfad).

**v2.28.2-Fix (gleiche Store-Refresh-Lücke in den Kurator-Import-Pfaden):** Derselbe Reload fehlte in den beiden Kurator-only-Import-Pfaden, die NICHT über den Banner laufen — Registrierungs-Wizard ([CsvSourceWizard.tsx](src/plugins/csv-sources-kuration/wizard/CsvSourceWizard.tsx) `handleSave`) und Reimport-/„CSV neu wählen"-Dialog ([CsvSourceReimportDialog.tsx](src/plugins/csv-sources-kuration/CsvSourceReimportDialog.tsx) `runImport`). Beide rufen jetzt nach `importCsvSource` ebenfalls `refreshAntraegeStoreAfterSync(idb, schema.programm_id, ['antraege','verbuende'])` → Kurator-Home zeigt importierte Daten sofort, ohne TTL-Wartezeit/Reload. Reiner Bugfix, kurator-only.

**v2.28.3-Fix (Snapshot-„Jetzt laden" → Home erst nach Reload, Cold-Start):** Nach „clear site data" + frischem Start zeigte der Klick auf den Snapshot-Banner („Neuer Datenbestand · Jetzt laden", [NewSnapshotBanner](src/core/components/NewSnapshotBanner.tsx)/[useSnapshotWatcher](src/core/hooks/useSnapshotWatcher.ts)) die Daten erst nach manuellem Browser-Reload. **Ursache:** `syncProgrammSnapshot` ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts)) schreibt via `replaceStore` nur den **vollen** `ANTRAEGE`-Store — die **Slim-Projektion `ANTRAEGE_LIST_VIEW`** (die Home/Listen/Dashboards lesen) ist NICHT Teil des Snapshots und wird sonst nur beim App-Start von `ensureListViewProjection` ([list-view-migration.ts](src/core/services/csv/list-view-migration.ts)) aus dem vollen Store gebaut. Nach einem In-Session-Sync blieb die Projektion also leer → `loadAll`/Home leer bis zum Reload (der die Start-Migration neu laufen lässt). Der CSV-Import-Pfad (`importCsvSource`→Merger) war NIE betroffen, weil der Merger beide Stores schreibt — deshalb wirkte der v2.28.1-Fix nur dort. **Fix:** `syncProgrammSnapshot` ruft nach dem Reload des `antraege`-Stores `rebuildAntraegeListView` (clear + reproject aller Antraege) auf → die Projektion ist sofort konsistent, die Home zeigt ohne Reload. **Merke:** wer den `ANTRAEGE`-Store schreibt, MUSS die `ANTRAEGE_LIST_VIEW`-Projektion mitziehen (Merger tut das, Snapshot-`replaceStore` tat es nicht).

**v2.28.4 (Snapshot-Banner-Fortschritt von Anfang an):** Der „Jetzt laden"-Balken stand ~4 s bei 0 (SMB-Dir-Navigation + Manifest-Read + großer `antraege`-Store + v2.28.3-Rebuild meldeten keinen feinen Fortschritt). `SyncProgress` ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts)) trägt jetzt eine monotone `fraction` 0..1 über alle Phasen (Budget Manifest 5% / Stores 65% / List-View-Rebuild 30%) inkl. **Chunk-Fortschritt** innerhalb großer Stores (`replaceStore`/`rebuildAntraegeListView` mit `onChunk`-Callback). [NewSnapshotBanner](src/core/components/NewSnapshotBanner.tsx) zeigt zusätzlich einen ~5%-Floor, damit der Balken sofort sichtbar startet. Reine UX-Politur, keine Logik-/Daten-Änderung.

**v2.28.5-Fix (CSV-Auto-Refresh-Check läuft nur 1× → kein Banner nach Cold-Start, Verknüpfen wirkt erst nach Reload):** `useCsvAutoRefreshCheck` prüfte die CSV-Quellen nur EINMAL beim Mount (`checkedRef`; auf der pl gibt es keinen Kurator-Session-Reset, der den Check neu armt). Folge auf der pl: (a) nach „clear site data" erschien KEIN „CSV-Ordner verknüpfen"-Banner, weil die Schemas erst NACH dem Erst-Check per Snapshot-Sync in die IDB kamen; (b) das Ordner-Verknüpfen in Einstellungen → Speicher wirkte erst nach einem Browser-Reload. Fix: globaler Signal-Store [csv-sources-signal.ts](src/core/services/csv/csv-sources-signal.ts) (`useCsvSourcesSignal`/`bumpCsvSourcesSignal`), gebumpt vom Snapshot-Sync ([App.tsx](src/core/App.tsx) Startup-Sync + [useSnapshotWatcher](src/core/hooks/useSnapshotWatcher.ts) `applyNow`) und vom Ordner-Verknüpfen ([SpeicherTab](src/plugins/einstellungen/SpeicherTab.tsx)); `useCsvAutoRefreshCheck` re-triggert `runCheck` (idempotenter IDB-Read) bei jeder Signal-Änderung. **Hinweis zum Permission-Modell:** `showDirectoryPicker` IST die Freigabe — nach dem Verknüpfen gibt es bewusst KEIN separates „Zugriff erlauben"-Popup; ein Re-Grant-Prompt kommt erst nach einem vollständigen Browser-Neustart (AppPasswordGate, Pitfall #28/v2.27).

### v2.29 — Themen-Vektoren beim Start automatisch vom Daten-Share laden (Juni 2026)

MINOR-Bump v2.29: Der Auslastungs-**Embedding-Korpus** („Themen-Vektoren für Klassifizierung") wird nach einem Cold-Start (Browser „clear site data") jetzt **beim App-Start** automatisch vom Daten-Share geladen — nicht erst, wenn der User in Auslastung → Einstellungen/Klassifizierung navigiert. Hintergrund: die Embedding-Caches liegen maschine-lokal in der IDB (auf einem frischen Rechner leer); der Download lief bisher nur im `useEffect` der jeweiligen View ([EmbeddingCorpusSection](src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx) per-Antrag, [KlassifizierungsReview](src/plugins/auslastung/views/KlassifizierungsReview.tsx) Verbund) — es gab keinen Start-Trigger.

Neuer Shell-Level Background-Hook [useAuslastungCorpusAutoload](src/core/hooks/useAuslastungCorpusAutoload.ts) (gemountet in [ShellLayout.tsx](src/core/ShellLayout.tsx) neben `useSnapshotWatcher`): lädt einmalig, sobald SMB online ist — fire-and-forget, non-blocking. Reuse vorhandener Bausteine: `useEmbeddingCorpusMirror.loadManifest`/`downloadAndApply` (per-Antrag, [useEmbeddingCorpusMirror.ts](src/core/hooks/useEmbeddingCorpusMirror.ts)) + `ensureVerbundCorpus` (Verbund, [corpus-share-sync.ts](src/plugins/auslastung/services/corpus-share-sync.ts), eigener Count-/Inflight-Guard). **Reine Lade-Operation**: read vom Share / write nur in die lokale IDB → kein `readwrite`-Handle nötig.

**Kernentscheidung:** Der per-Antrag-Download läuft **bewusst OHNE** `aktenzeichenSetHash`-Gate (= Äquivalent zum manuellen Button „Vom Datenspeicher laden", [EmbeddingCorpusSection.tsx:277](src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx)). Begründung: der Korpus wird selten (GPU-schwer) neu gebaut, CSV-Importe sind häufig → der Hash-Mismatch (Share deckt z.B. 13931 von 13953 Anträgen ab) ist der häufige Normalzustand und blockierte bisher selbst im Einstellungen-Tab den Auto-Download (0%-Banner „Sätze unterscheiden sich"). Der vorhandene Share-Korpus wird jetzt automatisch geladen; die wenigen neueren Anträge bleiben un-embedded bis zum nächsten manuellen „Corpus aufbauen". Gegated nur durch **lokal-leer** (`countEmbeddings === 0` → kein Clobbern eines frisch gebauten lokalen Korpus) + **Modell-Kompatibilität** (`checkCompat`, Pitfall #19). Das Hash-Gate im manuellen Einstellungen-Tab bleibt unverändert (bewusste Wahl Rebuild vs. „trotzdem laden").

Gegated auf `isAuslastungEnabled()` ([feature-flags.ts](src/config/feature-flags.ts)) → läuft nur in **pl + dev** (wo das Modul existiert); kein neues Feature-Flag. Additiv, keine Daten-/IDB-/SMB-Migration; prod/demo/kurator unverändert (No-Op). Siehe Memory `embedding-caches-machine-local` (Ursache) + `cold-start-store-refresh-pattern` (Bug-Klasse).

**v2.29.1-Fix (Korpus-Daten erst nach Browser-Reload verfügbar):** Nach dem v2.29-Start-Autoload — und schon vorher beim manuellen „Vom Datenspeicher laden" — schrieb der Download die Embeddings in die IDB, aber die In-Memory-Konsumenten lasen sie NICHT nach: Klassifizierung/Matching blieben leer bis zu einem manuellen Browser-Reload (Reload = Remount = frischer IDB-Read). Klassische cold-start-store-refresh-Lücke. **Ursache:** [KlassifizierungsReview](src/plugins/auslastung/views/KlassifizierungsReview.tsx) hält die Verbund-Embeddings in `useState` (Effekt-Deps `[storage]`, Guard verhindert Re-Fire); [useMatchingCorpus](src/plugins/auslastung/hooks/useMatchingCorpus.ts) cached den per-Antrag-Korpus über die `antraege`-Array-Referenz, die sich beim Download NICHT ändert. **Fix:** globaler Signal-Store [corpus-signal.ts](src/plugins/auslastung/services/corpus-signal.ts) (`useAuslastungCorpusSignal`/`bumpAuslastungCorpusSignal`, Vorbild [csv-sources-signal.ts](src/core/services/csv/csv-sources-signal.ts)), gebumpt bei jeder Korpus-IDB-Mutation: Start-Autoload ([useAuslastungCorpusAutoload](src/core/hooks/useAuslastungCorpusAutoload.ts)) + „Vom Datenspeicher laden"/„Corpus aufbauen" ([EmbeddingCorpusSection](src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx)). Konsumenten re-lesen bei Bump: `KlassifizierungsReview` lädt die Verbund-Embeddings neu (ref-gegated, damit der Warm-Remount ohne Änderung keinen Loading-Flash bekommt), `useMatchingCorpus` verwirft seinen Cache (nächster `loadCorpus` liest frisch). Konsumenten, die den Download SELBST auslösen (Mount-Load), bumpen NICHT — kein Self-Trigger-Loop. **Merke:** wer Embeddings extern in die IDB schreibt, MUSS `bumpAuslastungCorpusSignal()` rufen (analog zur `ANTRAEGE_LIST_VIEW`-Regel in v2.28.3). Reiner Bugfix, keine Daten-/Migration; pl + dev (wo die Views existieren).

**v2.29.2 (Zuweisungs-Cockpit re-matcht automatisch):** Ergänzung zu v2.29.1 — bei einem Korpus-Bump verwarf [useMatchingCorpus](src/plugins/auslastung/hooks/useMatchingCorpus.ts) zwar seinen Cache, der nächste Match lief aber erst beim nächsten User-Trigger (Antrag re-selektieren). Jetzt steht `corpusVersion` in den `useCallback`-Deps von `loadCorpus` → die Funktion bekommt bei jedem Bump eine neue Identität, und der Matching-Effekt im [ZuweisungsCockpit](src/plugins/auslastung/views/ZuweisungsCockpit.tsx) (führt `loadCorpus` in seinen Deps) re-matcht die **aktuelle Selektion** automatisch — ohne Re-Klick/Reload. Das Query-Embedding ist pro Antrag gecacht (`queryEmbeddingCacheRef`), der Re-Match also ohne Modell-Inferenz. Cache-Invalidierung läuft jetzt ordering-unabhängig im Callback (Versions-Ref) statt über einen separaten Effekt.

### v2.30.1 — kurator-Variante schreibt auf den Daten-Share (Juni 2026)

PATCH-Bump v2.30.1: Die **kurator-Variante** zeigte beim Start die irreführende „Sicherheits-Update / Datenordner neu verbinden · … damit die App nur lesend zugreift"-Wall ([StartupScreen](src/core/StartupScreen.tsx) `needsDowngrade`-Branch). Falsch für die Rolle: **alle kurator-User haben AD-seitig SMB read+write** auf dem Daten-Share — Read-Only gilt nur für `prod` (End-User). **Ursache:** der Grant-Mode läuft ausschließlich über `canWriteDatenShare(isKurator)` (Pitfall #25), aber der `StartupScreen` rendert VOR dem `AppPasswordGate`-Login (Render-Kette `… → Startup → AppPasswordGate → …`), wo `profile.is_kurator` noch `false` ist → `canWriteDatenShare(false)` = `false` → `needsDatenShareDowngrade` schlug an, sobald ein bestehendes `readwrite`-Handle vorlag. Die spätere v2.16-Login-Eskalation stufte zwar wieder hoch, aber erst nach einem **zweiten** Ordner-Prompt + der falschen Read-Only-Re-Pick-Wall. **Fix:** `features.datenShareSchreibrecht: true` in [configs/kurator.config.json](configs/kurator.config.json) (wie `pl`) → `canWriteDatenShare` ist in der kurator-Variante durchgehend `true`, kein Startup-Downgrade, fremd gesetzte Downgrade-Flags werden weggeräumt ([App.tsx](src/core/App.tsx)), der Start grantet direkt `readwrite`. Die kurator-only-Blöcke (User-Folders-Root, DMS) in `refreshAllPermissions` bleiben bewusst an `opts.isKurator` (erst nach Login). Additiv, keine Daten-/IDB-/SMB-Migration; bestehende kurator-Installationen mit altem `read`-Handle werden beim nächsten Start transparent auf `readwrite` hochgestuft (ein Browser-Prompt). dev/prod/demo/pl unverändert (`prod` bleibt read-only).

### v2.31 — Förderanträge-Tabellenansicht mit konfigurierbaren Spalten (Juni 2026)

MINOR-Bump v2.31: Die **Kompakt-Ansicht** der Förderanträge ist jetzt eine echte **Header-Tabelle mit Spalten-Picker + Header-Klick-Sortierung** — gleiches Muster wie die Suche, gebaut auf der generischen Tabellen-Infrastruktur [src/components/data-table/](src/components/data-table/index.ts) (`SortableTable`/`ColumnPicker`/`useTableSort`), die schon Suche + Auslastung nutzen. Der View-Mode-Key bleibt `'compact'` (keine Persistenz-Migration), das Toggle-Icon/-Label wurde auf „Tabellenansicht" (lucide `Table`) umbenannt ([ViewModeToggle](src/plugins/antraege/ViewModeToggle.tsx)).

- **Spalten-Registry** [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx) (`ANTRAG_TABLE_COLUMNS: SortableColumn<AntragListItem>[]`, analog `SEARCH_COLUMNS`): FKZ (locked, mit Eingangs-Ampel-Punkt im Cell), Akronym, Antragsteller, Status, Frist default-sichtbar; zuschaltbar Typ, Bewilligungsdatum, Antragseingang, Ort AST, Zuwendung, Laufzeitbeginn/-ende, Branche, Fördergeber. Alle Felder sind in `LIST_VIEW_FIELDS` projiziert. Cell-Renderer reusen `getStatusLabel`/`getStatusVariant` (nur Label-Lookups, kein Status-Literal-Vergleich, Pitfall #12), `getEingangAmpel`, `daysUntilFristAware`, `getKategorieLabel`.
- **Sichtbare Spalten** in einem eigenen Zustand-Store [useAntraegeColumnsStore](src/plugins/antraege/useAntraegeColumnsStore.ts) (localStorage `teamflow_antraege_table_columns`, Locked-/Default-Enforcement, Muster aus `suche/store.ts`) — geteilt zwischen „Spalten"-Picker im Header ([AntraegeHeader](src/plugins/antraege/AntraegeHeader.tsx), nur im `compact`-Modus sichtbar) und Tabelle [AntraegeTable](src/plugins/antraege/AntraegeTable.tsx) in [AntraegeMain](src/plugins/antraege/AntraegeMain.tsx).
- **Sortierung:** flach (keine Gruppierung in diesem Modus → „Gruppiert"-Pille dort ausgeblendet, [QuickfilterToolbar](src/plugins/antraege/filter/QuickfilterToolbar.tsx)). `filtered` (Toolbar-Sort + Verbund-Clustering) ist die Default-Reihenfolge; ein Header-Klick überschreibt lokal via `useTableSort` (sortiert VOR dem Pagination-Slice → ganze Liste, nicht nur sichtbare Seite). Selektierte Zeile per neuem rückwärtskompatiblem `isRowSelected`-Prop auf `SortableTable` hervorgehoben.
- **Cleanup:** die durch den Umbau toten `CompactList`/`CompactGroup`/`CompactRow` entfernt.

Additiv, keine Daten-/IDB-/SMB-Migration; nur ein neuer localStorage-Key. Sichtbar in allen Varianten mit Förderanträge-Plugin (dev/demo/prod/kurator/pl).

### v2.32 — Feedback-Board-Sponsoring: Balken aktualisiert + Punkte hoch-/runterzählen + prod-Outbox (Juni 2026)

MINOR-Bump v2.32: Auf dem öffentlichen Feedback-Board ([FeedbackBoardPage](src/plugins/feedback-board/FeedbackBoardPage.tsx)) ließen sich Feature-Stimmen („+1 Punkt") **nicht wirksam vergeben**: das Budget sank, aber der Fortschrittsbalken blieb bei `0/5`, und die Stimme ging still verloren. **Zwei Ursachen** (beide gefixt): (1) `sponsorTicket`/`unsponsorTicket` ([feedbackSponsoring.ts](src/core/services/feedback/feedbackSponsoring.ts)) gateten ihren Shared-Write auf den Legacy-Handle `storage.fs`, der im modernen Flow **nie gesetzt** ist (Sponsoring wurde bei der `writeSharedFile`-Migration der übrigen Feedback-CRUD-Ops vergessen) → Stimmen landeten nur im localStorage; (2) `mergeItems` ([feedbackSharedFile.ts](src/core/services/feedback/feedbackSharedFile.ts)) war für `sponsors` „shared-wins" und verwarf den lokalen Stand beim nächsten Reload.

- **Persistenz-Fix:** beide Funktionen schreiben jetzt über `writeSharedFile` (self-gated wie die Geschwister-Ops). `mergeItems` macht einen **Union-Merge** der `sponsors` (neuer Helper `unionMergeSponsors`): der eigene lokale Eintrag überlebt den Reload, fremde Stimmen aus Shared bleiben. **Anti-Stale-Regel:** lokale Items tragen nur die **eigenen** Sponsor-Einträge des Users (`saveOwnSponsorsLocally`), damit der Union nie einen veralteten fremden Eintrag wiederbelebt.
- **Hoch-/Runterzählen (Stepper):** für Punkte ist `sponsor.amount` jetzt die **Ziel-Punktzahl** (Upsert): „+" gibt nur die Differenz aus dem Quartals-Budget aus, „−" erstattet sie zurück, bei 0 verschwindet der Eintrag ([SponsorButton](src/components/feedback/SponsorButton.tsx), compact-Stepper `[−] Du: N Pkt [+]`). **Stunden bleiben Single-Entry** (unverändert, hinter „Mehr…"). Punkte-absteigende Board-Sortierung greift damit automatisch (war schon da).
- **prod-Outbox + Einsammeln:** read-only prod-User können `_intern/feedback/feedback.json` nicht schreiben → ihre Stimmen landen in `ZAH/feedback/sponsor-wuensche.json` ([feedbackSponsorOutbox.ts](src/core/services/feedback/feedbackSponsorOutbox.ts), Map `ticketId → Punkte`, IDB-Cache-Fallback, Spiegelbild der Übernahme-Wünsche). Der **Kurator** sammelt sie über den User-Folders-Root ein (`autoCollectSponsorVotes` in [feedbackOutboxCollect.ts](src/core/services/feedback/feedbackOutboxCollect.ts), pure-Merge `mergeSponsorVotesIntoItems` mit Retraktion) — automatisch beim Öffnen des Feedback-Admins ([useAutoCollectFeedback](src/plugins/feedback/hooks/useAutoCollectFeedback.ts)) ODER manuell per Button „Sponsor-Stimmen einsammeln" im Inbox-Tab.
- **Identität** vereinheitlicht auf `useMeinKuerzel() ?? profile.name` (Sponsor-Eintrag, Outbox-Datei, Budget-Key; Pitfall #27).

Additiv, keine Daten-/IDB-/SMB-Migration; neue Sidecar `ZAH/feedback/sponsor-wuensche.json` (idempotent-overwrite, Pitfall #23). Sichtbar in allen Varianten mit Feedback-Board; Einsammeln nur im kurator-Build (kuratorOnly). Budget-Key wechselt ggf. von `profile.name` auf das Kürzel — verwaist alte Quartals-Budgets harmlos (Quartals-Reset).

### v2.33 — Stunden pro Teilvorhaben antragstyp-spezifisch (FuE/DS/DL/NW) (Juni 2026)

MINOR-Bump v2.33: Der bisher globale Faktor `config.stundenProTV` (pauschal 9 h) ist jetzt **pro Antragstyp** konfigurierbar. Neues optionales Config-Feld `stundenProTVProTyp?: Partial<Record<AntragstypBucket, number>>` neben dem `stundenProTV`-Standard + zentraler Aufloeser `stundenProTVFor(config, bucket?)` ([types.ts](src/plugins/auslastung/types.ts)): typ-spezifischer Wert > globaler Standard > 9. UI: vier Felder FuE/DS/DL/NW in der Sektion „Konfiguration" (Tab „Einstellungen", [KonfigurationSection.tsx](src/plugins/auslastung/views/admin/KonfigurationSection.tsx)), leer = Standard.

Der per-Typ-Faktor fliesst in alle **type-aware** Pfade ein (Bucket via `getKategorieLabel(vb_phase)` bekannt): Stundenbedarf + Pro-Typ-Kontingent-Deckel im Matcher ([matching-engine.ts](src/plugins/auslastung/services/matching-engine.ts)), per-Typ-Kapazitaetsbalken ([kapazitaet-pro-typ.ts](src/plugins/auslastung/services/kapazitaet-pro-typ.ts)), verbrauchte Stunden im Quartals-Index ([quartals-auslastung.ts](src/plugins/auslastung/services/quartals-auslastung.ts), per Verbund-Anteil), manuelle Zuweisung ([manual-match.ts](src/plugins/auslastung/services/manual-match.ts) + [ZuweisungsCockpit](src/plugins/auslastung/views/ZuweisungsCockpit.tsx)) und der Quartals-Index-Cache-Key ([useAuslastungIndex.ts](src/plugins/auslastung/hooks/useAuslastungIndex.ts)). **Typ-uebergreifende Aggregat-Anzeigen** („X TVs frei" in MaTile/Vorschlag/Statistik/Export, `computeKapazitaet.restTVs`) bleiben bewusst auf dem Standard-Faktor. Beispiel: bei DS = 4,5 h hat ein MA mit gleichem Stunden-Konto doppelt so viele freie DS-Teilvorhaben wie bei FuE = 9 h.

Voll abwaertskompatibel (leeres `stundenProTVProTyp` = altes Verhalten; Load-Merge gegen `DEFAULT_AUSLASTUNG_CONFIG` ergaenzt das Feld als `{}`). Keine Migration. Sichtbar/wirksam in **pl + dev** (wo das Auslastungs-Modul existiert); prod/demo/kurator unveraendert.

### v2.35 — Antragstyp-spezifische Vollständigkeits-Pflicht (D_XTEC / D_ADV): Freigabe + Zuweisung gesperrt bis vollständig (Juni 2026)

MINOR-Bump v2.35: Ein Verbund darf erst **freigegeben** (Tab „Anträge klassifizieren") bzw. **zugewiesen** (Tab „Anträge zuweisen") werden, wenn er *vollständig im System erfasst* ist — das Signal liegt **antragstyp-abhängig** in einer Datums-Spalte: **FuE** (vb_phase 3) + **DS** (vb_phase 5) → `D_XTEC`, **DL** (vb_phase 4) + **NW** (vb_phase 1|2) → `D_ADV`. Die bisherige zentrale „zu verteilen"-Regel (Antragsdatum im rollierenden Fenster + leeres `tib_kuerz` + Status, `istZuVerteilen`) bleibt unverändert — die Vollständigkeit ist eine **zusätzliche Aktions-Sperre**, kein Sichtbarkeits-Filter.

- **Sichtbar + gesperrt, nicht ausgefiltert:** Unvollständige Anträge bleiben in beiden Listen sichtbar und tragen ein (jetzt antragstyp-korrektes) gelbes Warndreieck (Tooltip „kein D_XTEC"/„kein D_ADV"), damit die PL „vergessene" Anträge sieht und nachfragen kann. Gesperrt ist nur die Aktion: „Freigeben" deaktiviert ([verbund-columns.tsx](src/plugins/auslastung/views/verbund-columns.tsx)) bzw. „Zuweisen"-Buttons + Hinweis-Banner im Detail ([ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx), Guard auch im `zuweisen()`-Choke-Point); Bulk-Freigabe überspringt unvollständige. „Ablehnen" bleibt erlaubt.
- **Neue Logik** in [verbund-aggregation.ts](src/plugins/auslastung/services/verbund-aggregation.ts): `hatDAdvDatum`, `istVollstaendigFuerTyp(antrag, gate)` (bucket via `getKategorieLabel(vb_phase)`), `istUnvollstaendig(antrag, gate)` (bucket-aware, ersetzt die reine D_XTEC-Prüfung), `VerbundKlassifizierungsView.vollstaendig` = `tvs.every(...)`. `istZuVerteilen` (Sichtbarkeit) bleibt **unangetastet**.
- **Transitions-Schutz (`VollstaendigkeitsGate`):** Das Gate greift pro Bucket nur, wenn die zugehörige Spalte im Datenbestand überhaupt befüllt ist (`antraege.some(hatDXtecDatum)` / `hatDAdvDatum`) — sonst (Spalte noch nicht gemappt) bleibt alles freigeb-/zuweisbar (keine leeren Sperren). Antragstypen außerhalb FuE/DS/DL/NW (vb_phase ≠ 1–5; Irrläufer/9 ist per Status schon raus) bleiben ungated.
- **Neues CanonicalField** `d_adv` (Spiegel von `d_xtec`, type `date`) in [types.ts](src/core/services/csv/types.ts) + [constants.ts](src/core/services/csv/constants.ts) + `CANONICAL_D_ADV` in [auslastung/types.ts](src/plugins/auslastung/types.ts). Direct-Key-Match `D_ADV`→`d_adv` (kein Alias). **Operativ:** damit das DL/NW-Gate greift, muss die reale CSV-Quelle die `D_ADV`-Spalte enthalten + gemappt sein (ggf. CSV-Source neu mappen/re-importieren).

Additiv, keine Daten-/IDB-/SMB-Migration; bestehende `auslastung.json` lädt unverändert. Wirksam in **pl + dev** (Auslastungs-Modul); prod/demo/kurator unverändert.

**v2.38.1 (Status-Filter „Unvollständig"):** Die Status-Pill-Leiste im Tab „Anträge klassifizieren" ([KlassifizierungsReview.tsx](src/plugins/auslastung/views/KlassifizierungsReview.tsx)) hat eine fünfte Option **„Unvollständig (N)"** neben Alle/Review nötig/LLM-Vorschlag/Freigegeben. Auswahl filtert auf `!v.vollstaendig` (die v2.35-Pro-Verbund-Flag) → zeigt genau die Verbünde, die sichtbar aber noch nicht freigeb-/zuweisbar sind (D_XTEC/D_ADV fehlt), damit die PL gezielt nachfassen kann. Reuse von `v.vollstaendig` + `counts` + `filtered`, kein neuer State; komponiert mit den Kategorie-/Antragstyp-Facetten. Default bleibt „Alle". Transitions-bewusst (Spalte nirgends befüllt → 0). Reiner UI-Zusatz, keine Daten-/Verhaltensänderung am Gate selbst. Zuweisen-Tab ohne diesen Filter (unvollständige Verbünde sind dort per v2.35-Freigabe-Sperre nie sichtbar).

### v2.34 — Klassifizierung: manuelle PL-Vergabe = grüner „Von Hand"-Punkt + Auto-Save-Bestätigung (Juni 2026)

MINOR-Bump v2.34: In der Klassifizierungs-Tabelle (Tab „Anträge klassifizieren", [KlassifizierungsReview.tsx](src/plugins/auslastung/views/KlassifizierungsReview.tsx)) zählt ein PL-Pill-Klick jetzt als **menschliche Klassifizierung**: `applyVerbundOverride` schreibt die Primär mit `methode: 'manuell'` (statt `'regel'`). Der bisher nie gesetzte `methode`-Wert `'manuell'` ([PrimaerVorschlag](src/plugins/auslastung/types.ts)) ist damit endlich aktiv.

- **Grüner Punkt + Tooltip:** Die Aggregation ([verbund-aggregation.ts](src/plugins/auslastung/services/verbund-aggregation.ts)) liefert pro Verbund-Zeile ein neues `manuell`-Flag (`vorgeschlagenePrimaer.methode === 'manuell'`, Helper `istManuell`) auf `VerbundKlassifizierungsView` + `VerbundZuweisungRow`. [ConfidenceDot](src/plugins/auslastung/components/ConfidenceDot.tsx) bekommt einen optionalen `manuell`-Prop → **immer grün** (eine menschliche Entscheidung gilt als sicher, überschreibt auch eine vorherige rote LLM-/Low-Conf-Bewertung) mit Tooltip **„Von Hand klassifiziert"** statt „Hohe Sicherheit". Durchgereicht in [verbund-columns.tsx](src/plugins/auslastung/views/verbund-columns.tsx) (Klassifizierungs-Tabelle) + [ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx) (Zuweisungs-Tab).
- **Auto-Save-Bestätigung:** Die Persistenz nach SMB (`_intern/auslastung.json`) lief schon zuverlässig (debounced `schedulePersist` + `flushPersist` beim Verlassen der Tabelle → andere PL sehen die Änderung nach Reload). Neu: `schedulePersist(storage, onSaved?)` ([useAuslastungData.ts](src/plugins/auslastung/hooks/useAuslastungData.ts)) feuert einen Completion-Callback nach erfolgreichem Write; die View zeigt dann ~1,5 s ein dezentes **„✓ gespeichert"** in der Toolbar.

Additiv, keine Daten-/IDB-/SMB-Migration (das `methode`-Feld existierte schon im Schema). pl + dev (Auslastungs-Modul); prod/demo/kurator unverändert.

### v2.36 — Verbund-Frist startet ab dem zuletzt eingegangenen TV (Juni 2026)

MINOR-Bump v2.36: Das maßgebliche **Antragsdatum eines Verbundes** (und damit die antragsdatum-basierte Bearbeitungs-Frist) wird nicht mehr vom **ersten/frühesten** Teilvorhaben (TV) abgeleitet, sondern vom **zuletzt eingegangenen TV** = `max(antragsdatum)` über alle TVs. Fachlich: Ein Verbund kann erst bearbeitet werden, wenn das letzte TV eingegangen ist — vorher darf keine Frist laufen.

- **Zentraler Helper** im csv-Layer ([frist.ts](src/core/services/csv/frist.ts)): `verbundAntragsdatum(tvs)` (spätestes `antragsdatum`, ignoriert leere/ungültige Werte) + `computeVerbundFristDatum(tvs, representative)` (Antragsphase: `max-antragsdatum + 90 Tage`; **Begleitphase per-TV** wie gehabt — die Regel gilt nur für die Antragsphase). Für einen Solo-Antrag identisch zu `computeFristDatum` (kein Regress).
- **Betroffen (Verbund als EIN Eintrag):** Home „Meine Anträge" ([dashboardAggregate.ts](src/plugins/home/dashboardAggregate.ts)) — Verbund-Frist + „Fristen diese Woche"/„dringend"/„nächster Schritt" zählen einen Verbund **einmal** mit der vom letzten TV abgeleiteten Frist (Frist-Kandidaten pro `verbund_id` dedupliziert; `stats`-Status-Counts bleiben per-TV); Verbund-Detail-Feld „Antragsdatum" ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)); Zuweisungs-Cockpit-Sort „Antragsdatum (Neu→Alt)" ([verbund-aggregation.ts](src/plugins/auslastung/services/verbund-aggregation.ts)).
- **Bewusst NICHT betroffen:** die flache Anträge-Liste / Filter / Eingangs-Ampel / Views „Überfällig"·„Diese Woche" zeigen einzelne TVs weiter mit deren eigenem `frist_datum` (kein Merger-Eingriff). „Neue Anträge für dich" nutzt die **Selbsteintragungs-Frist** (`freigegebenAm + selbsteintragungFristTage`), nicht das Antragsdatum — unverändert.

Additiv, keine Daten-/IDB-/SMB-Migration. Wirksam überall, wo Förderanträge als Verbund gebündelt erscheinen (prod/kurator/pl/dev); Zuweisungs-Cockpit nur pl + dev.

**v2.36.1-Fix (Tab „Anträge klassifizieren"):** Die Klassifizierungs-Tabelle zeigte im Verbund-Header weiter das Datum des FKZ-Lead-TV statt des zuletzt eingegangenen TV (die Spalte las `leadAntrag(v).antragsdatum`). Neu: `VerbundKlassifizierungsView.antragsdatum` (= `verbundAntragsdatum(tvs)`, vorberechnet in `buildVerbundClassificationViews`, [verbund-aggregation.ts](src/plugins/auslastung/services/verbund-aggregation.ts)); die „Datum"-Spalte ([verbund-columns.tsx](src/plugins/auslastung/views/verbund-columns.tsx)) liest für den Header `v.antragsdatum` (Sort + Anzeige), die TV-Sub-Rows weiter ihr eigenes Datum. Damit konsistent zum Zuweisungs-Cockpit (v2.36). pl + dev.

### v2.37 — Gruppieren in der Tabellen-Ansicht (Verbund / Status) (Juni 2026)

MINOR-Bump v2.37: Die „Gruppiert"-Pille ist jetzt auch in der **Tabellen-Ansicht** (`viewMode === 'compact'`) der Förderanträge sichtbar — bisher war sie dort bewusst ausgeblendet (flache Tabelle). Eigene, kleinere Options-Liste **Keine / Verbund / Status** mit eigenem persistierten Store-Slot (localStorage `teamflow_antraege_table_grouping_by_view`), getrennt von der List-View-Pille (Keine/Status/NW/NW-Größe), weil die Optionen abweichen: „Verbund" gibt es als Top-Level-Option nur hier, „NW/NW-Größe" sind hier nicht gewünscht.

- **Verbund**: pro Verbund eine Zeile — Multi-TV-Verbünde werden zu EINER aggregierten Zeile kollabiert (FKZ-Range + „·N"-Count, worst-Ampel, dominanter Status, spätestes Antragsdatum via `verbundAntragsdatum`, kritischste Frist via `criticalFristAware`, Summe `sumFoerdersumme`); Solo-Anträge (1 TV) bleiben eine normale Zeile. Klick öffnet die Verbund-Detail. Reuse der Gruppierungs-Engine `buildAntragGroups({ mode:'verbund' })` + der Cluster-Aggregat-Helfer ([groupAggregates.ts](src/plugins/antraege/groupAggregates.ts)).
- **Status**: jedes TV bleibt eine eigene Zeile, nur in Status-Bänder (Offen/Nachforderung/Bewilligt/…) einsortiert (Per-TV via `statusPhaseForAntrag`, **keine** Verbund-Zusammenfassung — bewusste Abgrenzung zur List-View). Header-Klick-Sortierung wirkt section-stabil (innerhalb der Bänder).

Neue Bausteine: [tableGrouping.ts](src/plugins/antraege/tableGrouping.ts) (`TableGroupingMode`, `AntragTableRow`, `buildVerbundTableRows`, `buildStatusSectionRows`), Spalten-Registry [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx) auf `SortableColumn<AntragTableRow>` umgestellt (FKZ-/Frist-Zelle grouping-aware), generische [SortableTable](src/components/data-table/SortableTable.tsx) um optionale, rückwärtskompatible Section-Header (`sectionKeyOf` + `renderSectionHeader`) erweitert. Store-Slot + Getter/Action in [store.ts](src/plugins/antraege/store.ts), Pille in [QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx). `statusPhaseForAntrag` + `STATUS_PHASE_ORDER` aus [antragGroups.ts](src/plugins/antraege/antragGroups.ts) exportiert. Additiv, keine Daten-/IDB-/SMB-Migration; nur ein neuer localStorage-Key. Sichtbar in allen Varianten mit Förderanträge-Plugin (dev/demo/prod/kurator/pl).

### v2.38 — PL-„alle"-Bearbeiter-Übersicht: Kürzel-Dropdown + Inaktiv-Ausblendung + MA-Anzeige (Juni 2026)

MINOR-Bump v2.38: In der **pl-Variante** (Projektleitung; auch dev) wird das Bearbeiter-Kürzel in Einstellungen → Profil zu einem **Dropdown** (Option „Alle" + jede(r) MA mit Klartext-Kürzel), und der „alle"-/Übersichtsmodus wird MA-bewusst.

- **Dropdown statt Freitext** ([ProfilTab.tsx](src/plugins/einstellungen/ProfilTab.tsx) `KuerzelEditor`): Optionen aus der kuerzel-map (= MAs mit Anträgen) + `aktiv`-Flag aus `auslastung.json` ([useKuerzelFilterOptions](src/plugins/auslastung/hooks/useKuerzelFilterOptions.ts)); MA wählen = dessen Anträge, „Alle" = Übersicht. Gated auf `isAuslastungEnabled()` (pl/dev); kurator/demo behalten das Freitextfeld (auch Fallback bei leerer kuerzel-map), prod bleibt MA-Login-read-only. Comma-Vertretung („MUE,SCH") ist im Dropdown bewusst nicht mehr eintippbar (bewusste Scope-Reduktion).
- **Inaktive MAs (`aktiv===false`) standardmäßig ausgeblendet** — als Dropdown-Option UND als geladene Anträge —, per **geteiltem** Toggle „Inaktive einblenden" einblendbar ([useShowInaktiveMasStore](src/plugins/antraege/useShowInaktiveMasStore.ts), localStorage `teamflow_show_inaktive_mas`; Toggle in ProfilTab + [AntraegeHeader](src/plugins/antraege/AntraegeHeader.tsx)). Neue reine Stufe `applyInaktiveExclusion` ([bearbeiterFilter.ts](src/plugins/antraege/bearbeiterFilter.ts)) entfernt im „alle"-Modus Anträge inaktiver MAs (Match `tib_kuerz` gegen NFC-Set [useInaktiveKuerzelSet](src/plugins/auslastung/hooks/useInaktiveKuerzelSet.ts)); wirkt in der Liste ([useFilteredAntraege](src/plugins/antraege/useFilteredAntraege.ts) inkl. `countBase` + Tab-Counts) und im Home-Dashboard ([useDashboardData](src/plugins/home/useDashboardData.ts)). Außerhalb pl/dev liefert der Hook ein leeres Set → No-op (prod/kurator/demo unberührt).
- **MA-Kürzel sichtbar im „alle"-Modus** in **allen drei** Förderanträge-Ansichten: auto-eingeblendete Tabellen-Spalte „MA" ([MA_COLUMN](src/plugins/antraege/tableColumns.tsx) bewusst NICHT im Spalten-Picker + [AntraegeTable](src/plugins/antraege/AntraegeTable.tsx) `showMaColumn`), gruppierte Liste (MA-Badge je TV-Zeile, [AntragGroupCard](src/plugins/antraege/AntragGroupCard.tsx) `TvRow`), Kacheln ([AntragTile](src/plugins/antraege/AntragTile.tsx)) — alle via [MaKuerzelBadge](src/plugins/antraege/MaKuerzelBadge.tsx). `showMa = isAuslastungEnabled() && !bearbeiterFilter.active` wird einmal in [AntraegeMain](src/plugins/antraege/AntraegeMain.tsx) berechnet + per Prop durchgereicht (kein Store-Subscribe in Leaf-Komponenten). `tib_kuerz` ist bereits in `AntragListItem` projiziert (`LIST_VIEW_FIELDS`) → kein Daten-Schritt.
- **Home im „alle"-Modus** ([HomePage](src/plugins/home/HomePage.tsx)): listet die offenen Anträge **aller aktiven MAs** (Sektion „Meine Anträge" → „Alle Anträge", MA-Badge je Zeile, [MeineAntraegeSection](src/plugins/home/MeineAntraegeSection.tsx) `alleMode`) statt des „Kürzel setzen"-Hinweises (nur in pl/dev; sonst Hinweis wie gehabt). `AntragVorgang` ([dashboardAggregate.ts](src/plugins/home/dashboardAggregate.ts)) trägt nun `tib_kuerz`. Statistik/Fristen spiegeln „alle" inkl. Inaktiv-Ausblendung.

Identität läuft weiter über `useMeinKuerzel` (Pitfall #27); ProfilTab schreibt das Profilfeld (Convention-whitelisted). Additiv, keine Daten-/IDB-/SMB-Migration; nur ein neuer localStorage-Key. Wirksam in **pl + dev**; prod/kurator/demo unverändert (kein Dropdown / keine MA-Spalte / Home-„Kürzel setzen" wie bisher).

### v2.39 — Tabellen-Ansicht: Spalten-Resize, Picker über der Tabelle, Filter-Pillen-UX (Juni 2026)

MINOR-Bump v2.39: Vier UX-Verfeinerungen der Förderanträge-Tabellen-Ansicht (`viewMode === 'compact'`), nachdem die Header seit v2.37/v2.38 sortierbar sind:

- **„Sortiert nach"-Pille im Compact-Modus ausgeblendet** ([QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx)) — redundant, weil jeder Header sortierbar ist. Der persistierte `sortByView` bleibt als Default-Reihenfolge wirksam; der Header-Klick (`useTableSort`) überschreibt ihn. List-/Karten-View behalten die Pille.
- **Spalten horizontal resizable** ([AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx)): `useColumnWidths('teamflow_antraege_table_col_widths', {})` verdrahtet, `columnWidths` + `onColumnWidthChange` an die `SortableTable` durchgereicht → die bereits vorhandenen Drag-Handles werden aktiv (Live-DOM-Mutation während Drag, Commit on mouseup → localStorage). Mit `fitContentWidth` wächst/schrumpft die Tabelle + scrollt horizontal. Persistenz-Muster wie im Suche-Plugin.
- **„Spalten"-Picker über die Tabelle verlagert** (rechtsbündig, `flex justify-end` direkt über der `SortableTable`, [AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx)) statt oben rechts in der Header-Leiste ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx) — Block + ungenutzte Imports entfernt). Zustand bleibt im globalen `useAntraegeColumnsStore`; MA-Spalte bleibt auto-verwaltet (nicht im Picker).
- **Filter-Pillen bleiben gleichzeitig offen + nutzen die volle Breite** ([CollapsibleSeg.tsx](src/plugins/antraege/filter/CollapsibleSeg.tsx) + [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx)): Der Outside-Mousedown-Handler schließt eine transient offene Pille nur noch bei einem echten Außen-Klick (Liste/Tabelle) — nicht mehr, wenn auf eine **andere** Pille geklickt wird (neues Marker-Attribut `data-collapsible-seg` + `target.closest(...)`-Guard). Der Toolbar-Wrapper ist `flex-1 min-w-0` → expandierte Pillen nutzen die volle Zeilenbreite statt neben den `ActiveFilterChips` gestaucht zu werden.

Reiner UI/UX-Zusatz, keine Daten-/IDB-/SMB-Migration; nur ein neuer localStorage-Key (`teamflow_antraege_table_col_widths`). Sichtbar in allen Varianten mit Förderanträge-Plugin (dev/demo/prod/kurator/pl); der `CollapsibleSeg`-Fix wirkt in allen Views.

**v2.39.1-Fix (Tabellen-Ausrichtung):** Der „Spalten"-Picker ist von der eigenen Zeile über der Tabelle in die **Filter-Toolbar-Zeile** gewandert (rechts, compact-only, [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx) — aus [AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx) entfernt). Außerdem fluchten jetzt Header-Icons (Download/Ansicht/Filter), „Spalten"-Dropdown und Tabellen-Rand auf **einem** rechten Rand: Root-Cause war, dass [AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx) `px-8` **außen** + `max-w-6xl` **innen** (+ `pr-4`) nutzte, während Toolbar + Content `max-w-6xl px-8` (Padding innen) verwenden. Fix: Header-Box auf dasselbe Schema (`max-w-6xl px-8`, Border bleibt auf dem padding-freien Outer voll durchlaufend), Toolbar-Zeile bekommt `max-w-6xl` (non-cards/non-narrow), und das `pr-4` der Icon-Zeile ist jetzt konditional (List/Cards behalten die Badge-Bündigkeit, Compact ohne `pr` trifft den Tabellen-Rand). Reine Layout-Ausrichtung, keine Logik-/Daten-Änderung.

**v2.39.5-Fix (D_XTEC/D_ADV-Leerwert robust erkennen — Auslastung):** Der „Unvollständig"-Filter (v2.38.1) blieb leer, obwohl neue FuE/DS-Anträge mit leerem D_XTEC existierten. Ursache: `hatDXtecDatum`/`hatDAdvDatum` ([verbund-aggregation.ts](src/plugins/auslastung/services/verbund-aggregation.ts)) prüften nur `v.trim().length > 0` — eine „leer aussehende" Datumszelle, die in Wahrheit einen Platzhalter (`00.00.0000`, `0`, `.`) oder ein unsichtbares Zeichen (z.B. U+200B, das `String.trim()` nicht entfernt) trägt, wertete `coerceValue` als nicht-leeren Rohstring (`parseGermanDate(s) ?? s`) → fälschlich „D_XTEC gesetzt" → Antrag galt als vollständig. Fix: beide Helfer verlangen jetzt ein **gültiges Datum** via `parseGermanDate(v) !== null` (akzeptiert ISO + `DD.MM.YYYY`). Echte Datumswerte bleiben unverändert „gesetzt", das Gate (`some(hatDXtecDatum)`) bleibt an; Platzhalter/unsichtbare Zeichen zählen korrekt als „nicht gesetzt" → die betroffenen Verbünde erscheinen unter „Unvollständig", tragen das Warndreieck und sind freigabe-/zuweisungs-gesperrt. Reiner Bugfix, keine Daten-/Verhaltensänderung am Gate-Konzept; Regressions-Tests für Platzhalter/ZWSP/`00.00.0000` ergänzt.

### v2.40 — Vollständigkeits-Felder (D_XTEC/D_ADV) schema-basiert auflösen (Juni 2026)

MINOR-Bump v2.40: Die Auslastungs-Vollständigkeitsprüfung liest D_XTEC/D_ADV **nicht mehr fest** aus den kanonischen Feldern `d_xtec`/`d_adv`, sondern löst das tatsächliche Antrag-Feld **über das CSV-Schema** auf — egal ob der Kurator die Spalte als **Standardfeld** (`d_xtec`/`d_adv`) oder als **Eigenes Feld** (z.B. aus der Spalten-Beschreibung abgeleitet wie `alle_antrage_in_c16_eingegeben` / `antrag_in_c16_eingestellt`) gemappt hat. Hintergrund: Bei einem realen Datensatz waren D_XTEC/D_ADV als Eigene Felder gemappt → `d_xtec`/`d_adv` blieben bei allen 13.953 Anträgen leer → das Gate schaltete ab → „Unvollständig" blieb leer (obwohl die Werte unter Custom-Keys vorhanden waren).

- **Neuer Resolver** [vollstaendigkeit-felder.ts](src/plugins/auslastung/services/vollstaendigkeit-felder.ts): durchsucht die Programm-Schemas (Master zuerst) nach der Spalte mit Code **`D_XTEC`** bzw. **`D_ADV`** und ermittelt via `resolveFieldKey` das Antrag-Feld (`canonical` → `custom` → `col.toLowerCase()`). Fallback `d_xtec`/`d_adv`, wenn keine passende Spalte existiert (= bisheriges Verhalten für sauber gemappte Quellen). Spalten-Code-Match case-insensitiv + ohne `_`/`-`/Space.
- **Neuer Hook** [useVollstaendigkeitsFelder.ts](src/plugins/auslastung/hooks/useVollstaendigkeitsFelder.ts): lädt die Schemas pro aktivem Programm (Modul-Cache gegen Re-Mount-Flackern) und liefert die aufgelösten Feld-Keys.
- `VollstaendigkeitsGate` trägt jetzt die aufgelösten Feld-Keys (`xtecFeld`/`advFeld`); `istVollstaendigFuerTyp` liest über das generische `hatGueltigesDatum(antrag, feldKey)` (ersetzt das fest auf `d_xtec`/`d_adv` verdrahtete Lesen — `hatDXtecDatum`/`hatDAdvDatum` bleiben als Default-Wrapper). Beide Views ([KlassifizierungsReview.tsx](src/plugins/auslastung/views/KlassifizierungsReview.tsx) + [ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx)) bauen das Gate aus den aufgelösten Feldern; der Klassifizierungs-Cache keyt zusätzlich auf `xtecFeld`/`advFeld`.

Additiv, keine Daten-/IDB-/SMB-Migration. Wirksam in **pl + dev** (Auslastungs-Modul). Damit funktioniert „Unvollständig" + Warndreieck + Freigabe-/Zuweisungs-Sperre, ohne dass der Kurator D_XTEC/D_ADV zwingend als Standardfeld mappen muss.

**v2.40.1 (Selbst-Diagnose gegen stumme Fehlkonfiguration):** Damit ein leeres Gate nicht mehr **lautlos** ins Leere läuft (die Klasse Bug, die zu v2.40 führte), zeigt der Klassifizieren-Tab jetzt einen Hinweis-Banner „**Vollständigkeits-Prüfung inaktiv**", wenn eine D_XTEC/D_ADV-Spalte im Schema gemappt ist (= gewollt), aber das aufgelöste Feld bei KEINEM Antrag des betroffenen Antragstyps ein gültiges Datum trägt → dann greifen „Unvollständig"/Warndreieck/Freigabe-Sperre nicht, und der Banner nennt das aufgelöste Feld + bittet ums Mapping-Prüfen ([KlassifizierungsReview.tsx](src/plugins/auslastung/views/KlassifizierungsReview.tsx)). Der Resolver liefert dazu `xtecGefunden`/`advGefunden` ([vollstaendigkeit-felder.ts](src/plugins/auslastung/services/vollstaendigkeit-felder.ts)). Zusätzlich als wiederkehrende Bug-Klasse #5 „Stumme Feature-Deaktivierung bei abweichendem CSV-Mapping" dokumentiert ([docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)) — Fix-Pattern: Feld schema-basiert auflösen statt fest verdrahten + Off-Zustand sichtbar machen.

**v2.40.2 (erwartete TV-Anzahl bei unvollständigen Verbünden):** Im Klassifizieren-Tab zeigt ein **unvollständiger** Verbund unter dem Aktenzeichen jetzt „**X TVs (von Y erwarteten)**" statt nur „X TVs" — Y = erwartete TV-Gesamtzahl aus der Master-Spalte **`T_XAT`** (per-TV gleich). Macht sichtbar, wie viele TVs noch fehlen (z.B. „2 TVs (von 3 erwarteten)"). `T_XAT` wird — wie D_XTEC/D_ADV — **schema-basiert** über den Spalten-Code aufgelöst (real als Eigenes Feld `anz_erw_tv` gemappt), nicht fest verdrahtet (`erwarteteTvsFeld`/`erwarteteTvsGefunden` in [vollstaendigkeit-felder.ts](src/plugins/auslastung/services/vollstaendigkeit-felder.ts), Anzeige in [verbund-columns.tsx](src/plugins/auslastung/views/verbund-columns.tsx)). `T_XAT+` (inkl. Assoz.) matcht bewusst nicht. Graceful: fehlt T_XAT oder der Wert → kein Suffix. Vollständige Verbünde unverändert „X TVs". Nur Klassifizieren-Tab (Zuweisen zeigt nur vollständige Verbünde).

### v2.40.3 — CSV-Auto-Refresh: `source_last_modified` vor Snapshot-Write stempeln (Juni 2026)

PATCH-Bump v2.40.3: Fix für den Auto-Refresh-Banner **„CSV-Quelle hat neue Daten" / „Jetzt aktualisieren"**, der auf der **pl-Variante** (und auf jedem Rechner nach „clear site data") bei JEDEM frischen Start fälschlich für eine unveränderte Quelle erschien. Der Klick auf „Jetzt aktualisieren" half nur bis zum nächsten clear-site-data.

Ursache (Asymmetrie in [importCsvSource](src/core/services/csv/importer.ts)): `file_checksum` wird korrekt auf `updatedSchema` **vor** `saveSchema`/`writeProgrammSnapshot` gestempelt, aber `source_last_modified` (die Baseline für [`checkSourceForUpdate`](src/plugins/csv-sources-kuration/csv-source-handle.ts) — reiner `file.lastModified`-Vergleich) wurde nur **nach** Rückkehr aus `importCsvSource` über `persistCsvSourceMeta`/`persistSourceMeta` gesetzt — also nur in die **lokale IDB** des Importeurs. Der team-geteilte Snapshot trug damit einen veralteten oder leeren `source_last_modified`; **Snapshot-only-Konsumenten** (pl / Cold-Start nach clear-site-data) lasen `undefined` → `recorded == null` → unbedingt `update_available`. Der Importeur selbst sah das Banner nie (lokale IDB hatte den frischen Wert) — nur Snapshot-Leser. **Nur Add-Columns/Reimport/Auto-Refresh** waren betroffen; der **Wizard** stempelt schon seit v2.28 vor dem Snapshot — deshalb nur eine von mehreren Quellen (die per „Neue Spalten übernehmen" gemappte).

Fix: `source_file_name` + `source_last_modified` werden jetzt zentral in `importCsvSource` auf `updatedSchema` gesetzt (vor `saveSchema`/`writeProgrammSnapshot`), guarded auf `csvBlob instanceof File` — der Recompute-/SMB-Reimport-Pfad mit reinem `Blob` bleibt unangetastet (überschreibt die Original-Baseline nicht). Deckt alle Import-Pfade in einer Stelle ab. Die bestehenden `persist*`-Aufrufe bleiben (persistieren weiterhin das File-Handle, setzen `source_*` idempotent auf denselben Wert). **Bestands-Heilung:** ein Kurator re-importiert die betroffene Quelle einmal per „CSV neu wählen" → der Snapshot wird mit korrektem Baseline neu publiziert → pl-Cold-Start liest danach `up_to_date`. Bug-Klasse analog `b353ac2` (Tracking-Baseline unabhängig vom Artefakt geschrieben, das ihn tragen muss). Test: [importer-source-baseline.test.ts](src/core/services/csv/__tests__/importer-source-baseline.test.ts). Additiv, keine Daten-/IDB-/SMB-Migration.

### v2.40.5 — CSV-Auto-Refresh: Inhalts-Vergleich statt nur `lastModified` (Juni 2026)

PATCH-Bump v2.40.5: Follow-up zu v2.40.3 — der „CSV-Quelle hat neue Daten"-Banner kam auf der **pl** nach jedem Cold-Start trotzdem zurück. v2.40.3 stempelt `source_last_modified` zwar vor dem Snapshot, aber die mtime-Baseline erreicht den geteilten Snapshot **nur über einen Import-mit-Deltas** — eine unveränderte Datei erzeugt keine Deltas (`if (hasDeltas)`, [importer.ts](src/core/services/csv/importer.ts)), und der pl-Auto-Refresh (`force:false`) skippt byte-gleiche Dateien ohnehin vor jedem Snapshot-Write. Tiefere Ursache: `File.lastModified` ist über die Snapshot-Grenze **nicht portabel** (jede Datei-Kopie/jeder Rechner hat eine eigene mtime).

Fix: [`checkSourceForUpdate`](src/plugins/csv-sources-kuration/csv-source-handle.ts) bestätigt jetzt per **Inhalt**. Neuer Helper `decideSourceUpdateState` — billig zuerst (`file.lastModified <= source_last_modified` → `up_to_date`, kein Read), sonst (mtime neuer ODER Baseline fehlt) per **`file_checksum`** (SHA-1 der Rohbytes, **portabel** und bereits korrekt im Snapshot, da in `importCsvSource` vor dem Snapshot gestempelt): stimmt der SHA der Live-Datei überein → byte-gleich → `up_to_date` (kein Banner). Nur echter Inhalts-Unterschied (oder fehlendes `file_checksum`) → `update_available`. **Kein Re-Publish/Heal nötig** — der bestehende Snapshot trägt schon ein gültiges `file_checksum`, der Banner verschwindet sofort nach dem Deploy (auch nach „clear site data"). Der SHA-Read liest die Datei nur, wenn der billige Pfad nicht greift, und nur einmal pro Background-Check. Annahme: der pl-verknüpfte Ordner zeigt auf dieselbe physische CSV wie beim Import (Normalfall). Bug-Klasse #6 ([recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)) um den Leitsatz „Baseline über geteiltes Artefakt → per portablem Inhalt vergleichen, nicht per mtime" ergänzt. Test: [decide-source-update-state.test.ts](src/plugins/csv-sources-kuration/__tests__/decide-source-update-state.test.ts). Additiv, keine Migration.

## Ältere Releases (v2.0–v2.6.2)

*Historie, chronologisch absteigend. Bei Konflikt mit einem neueren Block oben gilt der neuere.*

### v2.0 — 2-Handle-Architektur (Persoenlicher Ordner + Offline-Modus + Feedback-Inbox)

MAJOR-Bump v2.0 erzwingt Re-Pick beim Start. Neuer Handle-Slot `SMB_HANDLE_PERSOENLICH` pro User für `ZAH/{profile,einstellungen}.json` + Feedback-Outbox. Nicht-Kurator-Daten-Share-Handle wird automatisch von `readwrite` auf `read` heruntergestuft. Details: [docs/architecture/v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md).

### v2.6.2 — Persönlicher Unterordner `teamflow/` → `ZAH/` (Mai 2026)

PATCH-Bump v2.6.2: Der im persönlichen Ordner angelegte Unterordner heißt jetzt `ZAH/` (App-Branding) statt `teamflow/`. Betrifft alle `PERSOENLICH_*`-Pfade ([types.ts](src/core/services/infrastructure/types.ts), Konstante `PERSOENLICH_ZAH_DIR`), `ensurePersoenlichFolders`, den Feedback-Inbox-Reader und die `personalFolder.subfolder`-Defaults in allen `configs/*.json`. **Keine Auto-Migration**: bestehende `teamflow/`-Ordner werden nicht umbenannt — profile/einstellungen werden beim nächsten Save neu unter `ZAH/` geschrieben (IDB-Cache bleibt Quelle), eine noch nicht eingesammelte Feedback-Outbox unter `teamflow/` würde verwaisen. Bei produktivem Einsatz mit bestehenden persönlichen Ordnern vorab klären, ob ein Migrationsschritt nötig ist.

### v2.6 — MA-Selbst-Profil über persönlichen Ordner (Mai 2026)

MINOR-Bump v2.6: Der Tab „Meine Technologien" schreibt nicht mehr direkt nach `_intern/auslastung.json` (für Nicht-Kuratoren seit v2.0 read-only), sondern nach `ZAH/auslastung-profil.json` im persönlichen Ordner. Die PL sammelt die Profile über den User-Folders-Root ein (Button „Team-Profile einsammeln" in der Auslastungs-Übersicht) und merged sie in `auslastung.json`. Additive Änderung, keine User-Aktion oder Migration nötig — fehlt das neue File, bleibt der bisherige `auslastung.json`-Stand. Details: Pitfall #24 + [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md).

### v2.3 — Auslastungs-Modul Deprecation-Cleanup (Mai 2026)

MINOR-Bump v2.3 entfernt die seit v2.1 deprecated Felder im Auslastungs-Modul: `AnonymerMitarbeiter.ueberKategorien` sowie `Klassifizierung.vorgeschlageneKategorien` / `freigegebeneKategorien`. Die `withLegacyFields()`-Wrapper-Funktion im Save-Path ist weg, der Save schreibt nur noch das v2.1-Schema (Primaer + Aspekte / hauptKategorie + nebenKategorien). Die Migrations-Funktionen `normalizeMitarbeiterRecord` + `normalizeKlassifizierungArray` lesen Pre-v2.1-Roh-JSON weiterhin (für Legacy-IDB/SMB-Daten), heben es aber jetzt sofort auf das aktuelle Schema. Keine User-Aktion nötig.

