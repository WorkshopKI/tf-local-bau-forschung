# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v2.259.0 — Antrag-Aufbereitung: Übersicht-Cockpit + Tab-Gating (dev) (Juli 2026)

MINOR — Start von Paket 5 (Recherche & Cockpit): Die KI-Läufe dauern Minuten, aber man sah nur `kiFertig/5` im Button. Neuer erster Tab „Übersicht" mit vertikalem Stepper zeigt live, was läuft/fertig ist; baustein-gebundene Tabs sind während eines Laufs erst klickbar, wenn ihr Baustein fertig ist. Nur dev.

- **Neuer Default-Tab „Übersicht"** (Cockpit): Stepper über die KI-Bausteine + deterministischer Zeitplan-/Quellen-Status, dieselben Start-Actions ([UebersichtTab.tsx](src/plugins/antraege/aufbereitung/UebersichtTab.tsx) + reines [uebersicht.ts](src/plugins/antraege/aufbereitung/uebersicht.ts)).
- **Dynamisches Tab-Gating** aus dem Baustein-Status (reine `deriveTabZustaende`): gesperrt bis fertig; nie vor dem ersten Lauf, nie der aktive Tab, `fehler` bleibt klickbar ([tab-gating.ts](src/plugins/antraege/aufbereitung/tab-gating.ts) + [AufbereitungTabs.tsx](src/plugins/antraege/aufbereitung/AufbereitungTabs.tsx)).
- Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) (folgt in Phase 5).

### v2.258.0 — Assistent-Panel: routen-sensitive Quick-Action-Leiste (Topf 1) (Juli 2026)

MINOR — Die statischen Beispielfragen des Assistent-Panels werden zu routen-sensitiven Quick Actions: vorgefertigte Fragen über dem ohnehin assemblierten Kontext, je nach Ansicht/Entität. Kein neuer LLM-/Transport-Mechanismus — ein Klick schickt nur einen Fragetext durch denselben Turn-Pfad. Nur dev.

- **Reiner Quick-Action-Katalog** (5 Aktionen, ausblenden statt ausgrauen) statt `BASIS_BEISPIELE` ([quickActions.ts](src/plugins/chat/assistent/quickActions.ts), verdrahtet in [AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)).
- **Deterministischer Arbeitsvorrat-Übersichtsblock** für den Kein-Entität-Fall (Liste/Startseite), damit „Fristen"/„Was ist heute dran?" faktengestützt sind ([arbeitsvorratUebersicht.ts](src/plugins/chat/assistent/arbeitsvorratUebersicht.ts) + [assembliere.ts](src/core/services/assistent/kontext/assembliere.ts)).
- **„Plan bis Bewilligung" bewusst weggelassen** — keine Spine-Restschritt-Ableitung vorhanden (STOPP-Bedingung, keine neue Statusmaschine). Detail: [assistent-panel.md](docs/architecture/assistent-panel.md).

### v2.257.1 — Gedächtnis-Eval: Transport-Default auf Intern (gpt-oss) (Juli 2026)

PATCH — Die Baseline zeigte: der agentische Qwen-Tab liefert für die strukturierte JSON-Konsolidierung teils Reasoning-Prosa statt JSON + Loop-Detector-Abbruch. Der Standard-Chat (gpt-oss) ist zuverlässig — und die Produktion nutzt ihn ohnehin. Also der passendere Panel-Default.

- **Panel-Transport-Default `agentisch` → `intern`** (gpt-oss / Standard-Chat) ([GedaechtnisEvalPanel.tsx](src/plugins/einstellungen/GedaechtnisEvalPanel.tsx)); `agentisch`/`openrouter` bleiben wählbar.

### v2.257.0 — KI-Assistent inkl. Gedächtnis in dev aktiviert (Juli 2026)

MINOR — Abschluss der KI-Assistent-dev-Aktivierung: nachdem die In-App-Gedächtnis-Eval (interne gpt-oss-Baseline, n=3) die Schwelle erreichte — fortschreibung/widerspruch/poisoning 3/3, kaltstart 2/3 — wird die Gedächtnis-Konsolidierung (Phase 2) in **dev** scharfgeschaltet. Weiterhin **opt-in + doppelt gegatet**; der Assistent ist per Default „nicht verbunden".

- **`assistentGedaechtnis: true`** in [configs/dev.config.json](configs/dev.config.json) (einzige Flag-Änderung; keine Schema-Änderung — steht schon in `DEFAULT_CONFIG`). Konsolidierung intern via `getTransportForKonsolidierung()` (Standard-Chat, kein `ziel`), `BridgeMutex`-serialisiert, Poisoning-Guard aktiv, Store nie im Snapshot.
- **Nur dev.** `pl/prod/kurator/as` unverändert — der Behörden-Rollout wartet auf DSB/Personalrat (viel später).
- Vorausgegangen: In-App-Eval-Panel (v2.256.0) + Baseline-Korrekturen (v2.256.2 Harness-Recalibrierung + Kontext-Wechsel-Prompt, v2.256.4 realistischere kaltstart-Fixture). Detail: [assistent-gedaechtnis.md](docs/architecture/assistent-gedaechtnis.md).

### v2.256.4 — Gedächtnis-Eval: kaltstart-Fixture realistischer (Skill 3× gestartet) (Juli 2026)

PATCH — Der gpt-oss-Baseline-Lauf (n=3) war 3/4 rock-solid; kaltstart scheiterte 2/3 nur an `praeferenzen:Kurzfassung`. Ursache: die Fixture nannte einen *einmaligen* Skill-Start ein „klares Arbeitsmuster" — überzogen. Statt die Assertion zu lockern, wird das Signal realistisch: der Skill wird mehrfach gestartet, dann ist die Präferenz-Erwartung berechtigt.

- **kaltstart-Fixture**: Skill „kurzfassung" jetzt **3× gestartet** (k4/k5/k6) statt 1× → echtes wiederkehrendes Muster; stubOps-Belege + Text angepasst; Erwartung + `maxHinzugefuegt` unverändert ([gedaechtnis-fixtures.ts](src/core/services/skill-eval/gedaechtnis-fixtures.ts)).
- Dry-Run bleibt 100 %, voller Gate grün (3713 Tests). Flag-Flip (`assistentGedaechtnis` in dev) folgt nach dem Nutzer-Re-Run (gpt-oss, n=3).

### v2.256.3 — Gedächtnis-Eval: Judge-einschließen-Schalter (Default aus, schnellerer Lauf) (Juli 2026)

PATCH — Der Baseline-Lauf dauerte über die Bridge sehr lang: jeder Fixture-Lauf machte reset + Generierung + reset + Judge, der Judge verdoppelte die Bridge-Runden. Für die Schwellen-Frage sind die deterministischen Assertions das harte Gate — der Judge ist optionale Zusatz-Sicht.

- **„Judge einschließen"-Schalter** im Panel (Default **aus**): ohne Judge ist ein Lauf nur reset + Generierung je Fixture → grob halbe Bridge-Last; Judge bei Bedarf zuschaltbar ([GedaechtnisEvalPanel.tsx](src/plugins/einstellungen/GedaechtnisEvalPanel.tsx)).

### v2.256.2 — Gedächtnis-Eval: Harness-Recalibrierung + Kontext-Wechsel-Prompt (dev) (Juli 2026)

PATCH — Konsequenzen der ersten Qwen-Baseline (v2.256.0/.1): ein Teil der roten Assertions waren Mess-Artefakte, nicht Modellfehler. Poisoning „scheiterte", obwohl Qwen die Injektion korrekt ignorierte; Judge-Parse-Fehler drückten den Schnitt. Der einzige echte Rotpunkt (Kontext-Wechsel) bekommt einen Prompt-Tweak. Flag-Flip in dev folgt erst nach zufriedenstellender Re-Baseline.

- **`guardMussGreifen` outcome-basiert**: gilt als bestanden, wenn der Guard verwarf ODER kein instruktiver Eintrag aktiv wurde — ein resistentes Live-Modell (0 verworfen, sauberer Bestand) ist nicht mehr fälschlich rot; nur durchgerutschte Injektion fällt durch ([gedaechtnis-assertions.ts](src/core/services/skill-eval/gedaechtnis-assertions.ts)).
- **Judge-Parse-Fehler** (nicht-JSON-Antwort → 0/0) fließen nicht mehr ins Judge-Mittel, sondern werden separat gezählt/angezeigt ([gedaechtnis-eval-runner.ts](src/core/services/skill-eval/gedaechtnis-eval-runner.ts), [GedaechtnisEvalPanel.tsx](src/plugins/einstellungen/GedaechtnisEvalPanel.tsx)).
- **Prompt-Tweak Kontext-Wechsel**: bei Wechsel des Arbeitsfokus (andere Entität als der Bestands-Eintrag) UPDATE/INVALIDATE auf den alten Eintrag — kein Nebeneinander von altem und neuem Fokus ([prompt.ts](src/core/services/assistent/gedaechtnis/prompt.ts)).
- Tests: Guard-Recalibrierung (resistent/dry-run/durchgerutscht) + Judge-Parse-Fehler-Exklusion; CLI-Dry-Run bleibt 100 % ([gedaechtnis-assertions.test.ts](src/core/services/skill-eval/__tests__/gedaechtnis-assertions.test.ts), [gedaechtnis-eval-runner.test.ts](src/core/services/skill-eval/__tests__/gedaechtnis-eval-runner.test.ts)).

### v2.256.1 — Gedächtnis-Eval: responsives Abbrechen + Fixture-Auswahl (dev) (Juli 2026)

PATCH — Beim ersten Baseline-Lauf klebte der Eval an `degradation-1` (20 Zyklen × n=3 = bis zu 60 Bridge-Runden); „Abbrechen" wirkte erst nach dem laufenden Durchgang, weil das AbortSignal nicht in die Innenschleife durchgereicht war.

- **Responsives Abbrechen**: AbortSignal fließt in `laufeFixture` → `submitMessage` + Prüfung zwischen den Zyklen; ein abgebrochener (Teil-)Lauf/Fixture wird verworfen, nicht gewertet ([gedaechtnis-eval-lib.ts](src/core/services/skill-eval/gedaechtnis-eval-lib.ts), [gedaechtnis-eval-runner.ts](src/core/services/skill-eval/gedaechtnis-eval-runner.ts), [gedaechtnis-judge.ts](src/core/services/skill-eval/gedaechtnis-judge.ts)).
- **Fixture-Auswahl** im Panel (Checkboxen je Szenario, `degradation` Default AUS) — schnelle Baseline aus den 4 Ein-Zyklus-Fixtures, Degradation optional ([GedaechtnisEvalPanel.tsx](src/plugins/einstellungen/GedaechtnisEvalPanel.tsx)).
- Tests: Vorab-Abort bricht `laufeFixture` vor dem ersten Submit ab und `laufeGedaechtnisEval` ohne Aggregat ([gedaechtnis-eval-runner.test.ts](src/core/services/skill-eval/__tests__/gedaechtnis-eval-runner.test.ts)); CLI-Dry-Run byte-identisch.

### v2.256.0 — In-App-Gedächtnis-Eval-Panel (dev) (Juli 2026)

MINOR — Die Gedächtnis-Qualität (Assistent Phase 2) muss vor dem dev-Scharfschalten gemessen werden — aber der Rechner mit Zugang zur internen KI hat kein Node, das CLI `eval:gedaechtnis` läuft dort nicht. Daher ein In-App-Eval-Panel, das die fiktiven Fixtures über die laufende Bridge (Qwen) fährt. Nur Messung — keine Aktivierung. Detail: [assistent-gedaechtnis.md](docs/architecture/assistent-gedaechtnis.md).

- **Gedächtnis-Eval-Panel** (Einstellungen → KI, gegated `isDevFixturesEnabled()`): 5 fiktive Fixtures über die interne Bridge (Default `agentisch`/Qwen), Generator + Judge intern, resetChat pro Submit, Report + JSONL-Download ([GedaechtnisEvalPanel.tsx](src/plugins/einstellungen/GedaechtnisEvalPanel.tsx)).
- **Geteilte, node-freie Eval-Orchestrierung** — CLI und Panel teilen Läufe-/Judge-Logik + JSONL-Feldform ([gedaechtnis-eval-runner.ts](src/core/services/skill-eval/gedaechtnis-eval-runner.ts), [gedaechtnis-judge.ts](src/core/services/skill-eval/gedaechtnis-judge.ts)); die CLI ist nur noch der Node-Rahmen ([gedaechtnis-eval.ts](src/core/services/skill-eval/gedaechtnis-eval.ts)).
- **`laufeFixture`** nahm einen additiven `{ ziel, resetVorZyklus }`-Parameter auf (Bridge-Reset + Qwen-Tab); CLI-Aufrufe byte-identisch ([gedaechtnis-eval-lib.ts](src/core/services/skill-eval/gedaechtnis-eval-lib.ts)).
- Transport intern-only via `getTransportForAssistent()` (Guard #30); `openrouter` nur gespiegelt in dev (fiktiv-Provenienz-Guard); Panel schreibt **nicht** in den Gedächtnis-Store und braucht das Flag nicht.

### v2.255.2 — Assistent-Spine: schwarzes Custom-Tooltip entfernt, natives Label behalten (Juli 2026)

PATCH — Korrektur zu v2.255.1: dort war die Diagnose verdreht — entfernt wurde das native `title`-Tooltip (das dezente, das bleiben sollte), während das hart schwarze Custom-Bubble (`--tf-text`-Grund) übrig blieb. Jetzt umgekehrt richtig.

- **Schwarzes Custom-Tooltip-Bubble entfernt, natives `title` wiederhergestellt** ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)): beim Überfahren der Spine erscheint nur noch **ein** Label — nativ wie bei allen anderen Icon-Buttons der App (kein zweites, hart schwarzes Bubble).

### v2.255.1 — Assistent-Spine: doppelten Tooltip entfernt (Juli 2026)

PATCH — *(Diagnose verdreht — korrigiert durch v2.255.2)* Nach der v2.255.0-Abnahme zeigte die neue Assistent-Spine beim Überfahren **zwei** Tooltips. Dieser Patch entfernte fälschlich das native `title` statt des schwarzen Custom-Bubbles.

- **Natives `title`-Tooltip der Spine entfernt** ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)): war die falsche Hälfte — in v2.255.2 rückgängig gemacht, stattdessen das schwarze Custom-Bubble entfernt.

### v2.255.0 — Home-Redesign (optimiert): Hero-Band + Karten-Restyle + Assistent-Spine (Juli 2026)

MINOR — Umsetzung des Design-Handoffs „Home optimiert". Da die Startseite bereits ein reifes, konfigurierbares Widget-System ist, ist das ein visueller Restyle + wenige neue Präsentations-Elemente, kein Rebuild — die Konfigurierbarkeit bleibt. Additiv; Handoff-Abweichungen an den DESIGN_GUIDE angeglichen (kein Verlauf, keine Deko-Schatten, Gewicht 500). Detail: [home-widgets.md](docs/architecture/home-widgets.md).

- **Hero-Band** (fixes Element, kein Widget): Resume-Karte „Weiter, wo du aufgehört hast" + Alert-Karte mit drei klickbaren Chips (kritisch / nähern sich / QS-Freigaben offen) ([HomeHero.tsx](src/plugins/home/HomeHero.tsx)).
- **Config v2:** `weitermachen` aus dem Default (Hero ersetzt es, bleibt Opt-in im Katalog); v1→v2-Migration blendet eine sichtbare Instanz einmalig aus ([homeWidgetsStore.ts](src/plugins/home/widgets/homeWidgetsStore.ts)); geteilter [useQsFreigaben.ts](src/plugins/home/widgets/useQsFreigaben.ts)-Hook (Hero-QS-Zahl = Widget-Zahl).
- **Widget-Karten-Restyle** ([WidgetShell.tsx](src/plugins/home/widgets/WidgetShell.tsx)): Titel 14px/500, Karten-Fläche `--tf-card-surface`, eingeklappt nur noch Titel + Zähler.
- **Kanban** ([AntragKanbanWidget.tsx](src/plugins/home/widgets/AntragKanbanWidget.tsx) / [KanbanBoard.tsx](src/components/kanban/KanbanBoard.tsx)): neutraler grauer Karten-Streifen statt Lane-Farbe, kein Deko-Schatten, Köpfe/Karten 500 statt 600.
- **Assistent-Dock** ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)): schwebender Reiter → dauerhafte 48px-Spine mit Primär-Badge + Hover-Tooltip; das Blatt reserviert die 48px ([ShellLayout.tsx](src/core/ShellLayout.tsx), dev-Flag `assistentPanel`).

### v2.254.1 — Umfang single-source auch für Abschnitt C + D (Folgepaket) (Juli 2026)

PATCH — Zieht die Umfang-Single-Source aus v2.254.0 auf die Abschnitte C (Technische Risiken) und D (Markt) nach: auch dort stand die feste „300–350 Wörter"-Angabe zusätzlich in der Prompt-Prosa und lief bei Regel-Edits auseinander. Eigener, append-only Migrations-Marker (die A/B-Migration war bereits ausgeliefert).

- **Feste „300–350 Wörter" aus C/D-Prosa entfernt** ([seed.ts](src/core/services/skills/registry/seed.ts)): Umfang kommt allein aus den Regeln (`seed-c-umfang` hinweis / `seed-d-wortanzahl`); Struktur (C: 3-Abschnitt Entwurf→Fließtext) unverändert. Alt-Wortlaut eingefroren als `C_ABSCHNITT_OPTS_NEU_UMFANG_ALT` / `D_ABSCHNITT_OPTS_UMFANG_ALT`.
- **Migration `ga-umfang-dedup-cd-2026-07`** ([migrations.ts](src/core/services/skills/registry/migrations.ts)): eigener Marker, hebt nur unveränderte C/D-Prompts byte-genau nach; greift auch nach `applyRisikenEntwurf` (C landet direkt de-dupliziert).
- Der Editor-Warnhinweis aus v2.254.0 deckt C/D bereits generisch mit ab.

### v2.254.0 — Umfang single-source: Regel statt doppelter Prompt-Prosa (A/B) (Juli 2026)

MINOR — Regel-Edits im Workflow-Werkstatt/Skill-Editor (z. B. Wortanzahl 750 → 450–550) wirkten nur halb: die neue Zahl erschien im Auto-Block „Formale Vorgaben", aber der Prompt-Text trug die alte Zahl weiter. Grund war eine Doppelquelle — die Wort-/Absatz-/Satzzahl stand zusätzlich fest in der Prompt-Prosa (Seed). Jetzt ist die Regel die EINZIGE numerische Quelle. Additiv (einmalige, kuratier-sichere Migration), keine Datenmigration im Layout-Sinn.

- **Feste Umfangs-Zahlen aus der Prompt-Prosa entfernt (A + B)** ([seed.ts](src/core/services/skills/registry/seed.ts)): „Gesamtumfang mindestens 750 Wörter"/„vier Absätze" (B) und „ca. 10 Sätze" (A/Kurzfassung) fallen weg; Umfang kommt allein aus den Regeln. Weiche Teil-Richtwerte (≥150/≥150/≥450) bleiben.
- **Byte-genaue Reconcile-Migration `ga-umfang-dedup-2026-07`** ([migrations.ts](src/core/services/skills/registry/migrations.ts)): hebt nur UNVERÄNDERTE A/B-Prompts auf dem Share auf die de-duplizierte Fassung; kuratierte Edits bleiben unangetastet.
- **Skill-Editor warnt bei Prosa↔Regel-Konflikt** ([SkillEditor.tsx](src/plugins/skill-verwaltung-kuration/SkillEditor.tsx) + `findeUmfangKonflikte` in [check-engine.ts](src/core/services/skills/registry/check-engine.ts)): nennt der Prompt-Text eine Zahl abweichend zur Regel, erscheint ein Hinweis (Sicherheitsnetz für kuratierte Templates).

### v2.253.0 — Bundle-Diaet: ONNX-WASM gzip-inline + Dependency-Hygiene (Juli 2026)

MINOR — Die Single-File-HTML war ~73 MB (dev) und wird bei jedem Start komplett vom SMB-Share geladen; dominiert von der ~21-MB-ONNX-WASM, die zweimal byte-identisch als base64-`data:`-URL im Bundle lag. Zusätzlich tote Pakete + offene npm-audit-Findings bereinigt.

- **ONNX-WASM als Inline-gzip + `wasmBinary`** ([ort-wasm-init.ts](src/core/services/search/ort-wasm-init.ts) + [generate-ort-wasm-module.mjs](scripts/generate-ort-wasm-module.mjs)): Post-Build-Strip leert die inlined `data:`-URLs ([strip-inline-wasm.mjs](scripts/strip-inline-wasm.mjs)) → Bundle dev 73→19,5 MB, prod 71→17,4 MB (−73/−75 %). Detail: [runtime-layers.md](docs/architecture/runtime-layers.md), Pitfall #39.
- **4 tote Pakete entfernt** ([package.json](package.json)): `@zip.js/zip.js`, `file-saver`, `@types/file-saver`, `docx` (nirgends importiert); `shadcn` bleibt (build-relevant via `theme.css`).
- **`xlsx` 0.18.5 → 0.20.3** (SheetJS-Registry-Tarball) — behebt High-Findings (Prototype-Pollution + ReDoS).
- **`npm audit` 15 → 0 Findings** via `audit fix` (react-router/qs/vite); akzeptierte/beobachtete Findings dokumentiert ([docs/audit-akzeptiert.md](docs/audit-akzeptiert.md)).

### v2.252.0 — Aufbereitung-Einstieg zuerst + gesamte KI-Aufbereitung auf einen Klick; Kurzbeschreibung ohne Titel-Fallback (Juli 2026)

MINOR — Der Antrag-Verstehen-Schritt (Aufbereitung) gehört an den Anfang, und die KI-Abschnitte der Aufbereitung sollen auf einen Klick laufen statt einzeln pro Tab. Zudem soll eine fehlende Kurzbeschreibung nicht durch den Projekt-Titel vorgetäuscht werden. Additiv, dev-only, keine Datenmigration.

- **„Antrag-Aufbereitung öffnen" nach oben** ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx)): direkt unter dem Kopf, VOR der Kurzbeschreibung — erst den Antrag verstehen, dann NF/Gutachten.
- **Kurzbeschreibung ohne Titel-Fallback** ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx) + [KurzbeschreibungCard.tsx](src/plugins/antraege/KurzbeschreibungCard.tsx)): fehlt VB_INHALT, bleibt die Karte sichtbar mit dezentem „wird nach Abschluss des Gutachtens erstellt"-Hinweis statt des Projekt-Titels; der Titel erscheint wieder als Untertitel im Kopf.
- **„Mit KI aufbereiten" (ein Klick)** ([AufbereitungPage.tsx](src/plugins/antraege/aufbereitung/AufbereitungPage.tsx)): neuer primärer Seitenkopf-Button fährt alle 5 KI-Bausteine sequenziell (bestehende `bausteine`-Aktion) mit Live-Fortschritt „(n/5)"; „Neu aufbereiten" bleibt der schnelle KI-freie Refresh.

### v2.251.1 — Kurzfassung/Gutachten: echten Projekt-Titel statt generischem VB_TITEL ans LLM (Juli 2026)

PATCH — Beim Erstellen der Kurzfassung/Gutachten-Stammdaten wurde als „Verbund-Titel" das Feld `verbund_titel` (CSV `VB_TITEL`) ans LLM gesendet — in Verbünden ohne Projektbeschreibungs-Enrichment oft ein generischer Platzhalter („Muster VB Titel N"). Der aussagekräftige Titel steckt im Lead-TV-Thema (`THEMA_AD`).

- **Projekt-Titel bevorzugt Lead-TV-Thema** ([context-builder.ts](src/plugins/antraege/kurzfassung/context-builder.ts)): `ctx.titel = lead.titel (THEMA_AD) ?? verbund.titel (VB_TITEL)` (Priorität getauscht); `akronym` behält bewusst Verbund-Vorrang. Wirkt auf beide Prompt-Pfade ([skill-context.ts](src/plugins/antraege/gutachten/skill-context.ts) + [useKurzfassung.ts](src/plugins/antraege/kurzfassung/useKurzfassung.ts)).
- Header-Anzeige in [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx) unverändert (Verbund-Titel zuerst) — Divergenz im Docstring dokumentiert.

### v2.251.0 — Frisch hochgeladene Dokumente wieder entfernen (Juli 2026)

MINOR — Frisch hochgeladene Antragsdokumente ließen sich nicht wieder entfernen. Nötig, wenn eine PDF-Konvertierung schlecht ist (als DOCX neu ablegen) oder man die falsche Datei erwischt hat. Additiv, keine Datenmigration.

- **Pro-Zeile „Entfernen"** in der geteilten Aufnahmefläche ([DokumentAufnahme.tsx](src/core/components/DokumentAufnahme.tsx)): dezenter Text-Link neben „Konvertierung prüfen" (indexierte Zeilen) bzw. in Fehler-Zeilen; wirkt automatisch in allen Aufrufern (Gutachten/Kurzfassung/Nachforderungen/Aufbereitungs-Quellen/Zeitplan).
- **Vollständige Löschung**: raus aus dem Such-Index (Orama, `removeDocument`) UND aus dem Dokumente-Store (IDB, `store.remove`) — kein Rückstand im Korpus; Rückfrage vor dem Löschen, `useAsyncAction` (Pitfall #15).
- **Neu-Rechnen gleich gegated wie Ingest/Re-Tag**: in der Aufbereitung sofort, in `offenHalten`-Sektionen erst bei „Fertig" (kein vorzeitiger Status-Flip).

### v2.250.0 — Steckbrief ↔ Eckdaten user-resizable (geteilte Zwei-Spalten-Komponente) (Juli 2026)

MINOR — Auf der Antrag-Aufbereitung (Tab Steckbrief) war die Grenze zwischen der linken Inhaltsspalte und der rechten „Eckdaten"-Sidebar fix. Sie ist jetzt per Zieh-Griff verstellbar. Die dafür schon auf der Startseite vorhandene Zieh-Logik wurde in eine geteilte Komponente gehoben (DRY, kein paralleles Layout). Additiv, keine Datenmigration.

- **Steckbrief ↔ Eckdaten ziehbar** ([SteckbriefTab.tsx](src/plugins/antraege/aufbereitung/SteckbriefTab.tsx)): Griff an der linken Kante der Eckdaten-Spalte verschiebt die Aufteilung; Doppelklick setzt zurück; Breite gerätelokal in localStorage (`teamflow_aufbereitung_eckdaten_breite`), Start = bisherige 320px.
- **Geteilte Zwei-Spalten-Komponente** ([ZweiSpaltenResizable.tsx](src/components/zwei-spalten/ZweiSpaltenResizable.tsx) + [zweiSpaltenResize-logic.ts](src/components/zwei-spalten/zweiSpaltenResize-logic.ts)): `1fr`+variable-Sidebar-Grid mit Pointer-Drag (re-render-frei), Tastatur (Pfeiltasten), Doppelklick-Reset; ab `lg` aktiv, darunter gestapelt.
- **Home auf die geteilte Komponente umgestellt** ([HomeZweiSpalten.tsx](src/plugins/home/HomeZweiSpalten.tsx)): jetzt dünner Wrapper mit den Home-Parametern; Storage-Key/Breiten unverändert (keine verlorenen Nutzer-Breiten), `clampSeiteBreite` bleibt als Re-Export.

### v2.249.0 — Dokumente einmal hochladen → überall verfügbar; PDF-Tabellen; KI-Guard + agentische KI; Assistent-Dokumente (Juli 2026)

MINOR — Sammel-Folge aus der file://-Abnahme (v2.248.1): Antragsdokumente sollen EINMAL hochgeladen überall verfügbar sein, PDF-Anlagen als Tabelle nutzbar, und die interne KI überall bewusst verbunden/gewählt werden. Additiv, keine Datenmigration.

- **Einmal hochladen → überall**: DokumentAufnahme bietet das VOLLE Typ-Vokabular (inkl. Arbeitsplan/Marketing, [DokumentAufnahme.tsx](src/core/components/DokumentAufnahme.tsx)/[dokumentAufnahmeFkz.ts](src/core/components/dokumentAufnahmeFkz.ts)); Dateiname-Heuristik `typAusDateiname` tagt Anlage 5 automatisch; Re-Tag (`setTyp`) rechnet die Aufbereitung sofort neu (kein „Übernehmen"-Klick). In Gutachten getaggte Anlage 5 erscheint jetzt in der Aufbereitung.
- **Zeitplan „hinterlegt ≠ fehlt"** ([VerbundZeitplan.tsx](src/plugins/antraege/aufbereitung/VerbundZeitplan.tsx)/[store.ts](src/plugins/antraege/aufbereitung/store.ts)): eine erkannte, aber nicht auslesbare Anlage 5 zeigt „hinterlegt, Tabelle nicht auslesbar → DOCX" statt „fehlt"; „X/Y mit Anlage 5" zählt vorhandene Dokumente.
- **PDF-Tabellen-Rekonstruktion** ([pdf-tables.ts](src/core/services/converter/pdf-tables.ts) → [converter/index.ts](src/core/services/converter/index.ts)): PDF-Tabellen werden zu Markdown-Pipe-Tabellen rekonstruiert (Vorschau + Zeitplan-Ernte) statt Flattext; konservativ, sonst Fließtext-Fallback.
- **KI-CTA-Preflight** ([ki-guard.ts](src/core/services/ai/ki-guard.ts) + [KiConnectPromptDialog.tsx](src/core/components/KiConnectPromptDialog.tsx)): CTA ohne verbundene KI warnt + bietet „Jetzt verbinden" (kein stiller Tab + Retry-Loop); an Aufbereitung/Gutachten/Kurzfassung/Chat.
- **Agentische interne KI wählbar** ([ki-ziel.ts](src/core/services/ai/ki-ziel.ts) + [KiVariantSelector.tsx](src/core/components/KiVariantSelector.tsx)): globale Präferenz „Standard | Agentisch" (Default Standard = byte-identisch), durchgereicht in alle Skill-Läufe + Chat, wählbar an allen Verbindungs-Stellen. **Assistent** kennt jetzt die Verbund-Dokumente deterministisch ([assembliere.ts](src/core/services/assistent/kontext/assembliere.ts)/[vorhaben-dokumente.ts](src/core/services/assistent/vorhaben-dokumente.ts)).

### v2.248.1 — Dokumenten-Aufnahme bleibt offen — Konvertierung pro Datei prüfbar (Gutachten/Kurzfassung/NF) (Juli 2026)

PATCH — Bei der Gutachten-Erstellung legt der Bearbeiter mehrere Dokumente ab. Die Fläche mit der Pro-Datei-Erkennung (FKZ/Zuordnung) und dem „Konvertierung prüfen"-Link verschwand aber sofort wieder, sobald die erste VB erkannt war — die übrigen Datei-Ergebnisse waren nicht mehr einsehbar. Die Aufnahmefläche bleibt jetzt offen, bis der Bearbeiter explizit übernimmt.

- **Aufnahmefläche bleibt offen**: neuer opt-in Prop `offenHalten` an [DokumentAufnahme](src/core/components/DokumentAufnahme.tsx) — das die Sektion umschaltende `onIngested` feuert erst beim expliziten „Fertig", nicht mehr sofort nach der ersten Aufnahme.
- **Pro Datei prüfbar**: die bereits vorhandene „Konvertierung prüfen"-Schaltfläche je `IntakeRow` (read-only Markdown-Vorschau via [KonvertierungReviewDialog](src/core/components/KonvertierungReviewDialog.tsx) → `MarkdownRenderer`) bleibt jetzt für **jede** abgelegte Datei erreichbar.
- **In drei Flüssen aktiv** (je VB-fehlt- und „VB ersetzen"-Mount): Gutachten ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)), Kurzfassung ([KurzfassungSection.tsx](src/plugins/antraege/kurzfassung/KurzfassungSection.tsx)), Nachforderungen ([NachforderungenSection.tsx](src/plugins/antraege/nachforderungen/NachforderungenSection.tsx)).
- **Andere Aufrufer unverändert**: die Aufbereitungs-Quellen (`QuellenPanel`/`VerbundZeitplan`) übergeben den Prop nicht → Default = bisheriges Sofort-Verhalten (byte-gleich).
- Reine UI-Änderung, keine neuen Abhängigkeiten, kein Datenmodell-/Persistenz-Touch. Typecheck + Lint + volle Test-Suite + `build:dev`/`build:pl` grün. **Noch offen**: file://-Abnahme (Thomas).

### v2.248.0 — Workflow-Beschleunigung: Zwei-Stufen-Gate, Vitest-Split, Code-Map, CLAUDE.md-Diät, Changelog-Tooling (Juli 2026)

MINOR — Der `npm run check`-Loop war spürbar langsam geworden; Ziel: Sekunden im inneren Loop, ~1 min am Phasen-Gate, plus schlankere, jede Session geladene Kontext-Docs.

- **Zwei-Stufen-Gate**: `check:quick` (inkrementeller Typecheck + gecachtes Lint + `--changed`-Tests) neben dem vollen `check` ([package.json](package.json), [docs/agents/README.md](docs/agents/README.md)).
- **Vitest-Zwei-Projekte-Split** (`fast` ohne Isolation / `isolated`): Test-Dauer 34,9 s → 9,5 s ([vitest.config.mts](vitest.config.mts)).
- **Code-Map-Generator** für Explorer-Agents ([scripts/generate-code-map.mjs](scripts/generate-code-map.mjs) → generierte `docs/architecture/code-map.md`).
- **CLAUDE.md-Diät** 68,6 KB → 43,5 KB: Detail in Themen-Docs + verschachtelte CLAUDE.md + Link-Guard ([src/__tests__/doc-links.test.ts](src/__tests__/doc-links.test.ts)).
- **Changelog-Tooling** ([scripts/version-bump.mjs](scripts/version-bump.mjs)): Bump + Kompakt-Skeleton + Rotation; CHANGELOG.md von ~404 KB auf ~78 KB rotiert.

### v2.247.0 — Workflow/Skill inline in der Gutachten-Werkstatt bearbeiten (dev) + Skill-/Workflow-Export/Import (Juli 2026)

MINOR — Während der Entwicklung am ZIM-Gutachten-Workflow (A–G) fallen laufend kleine Prompt-/Schritt-Änderungen an. Bisher führte der einzige Bearbeitungsweg aus der Gutachten-Werkstatt **heraus** ins Kuration-Plugin (`navigate('skill-verwaltung-kuration', …)`). Neu lässt sich der aktive Workflow — Struktur, Schritt-Konfiguration und Skill-Prompt/Regeln — **direkt in der Gutachten-Ansicht** bearbeiten (nur dev). Zusätzlich sind jetzt **Workflows** (nicht nur einzelne Skills) exportier-/importierbar — für Cross-Browser-Nutzung und Versions-Backups.

- **dev-Inline-Werkstatt** ([WorkflowWerkstattDialog.tsx](src/plugins/antraege/gutachten/WorkflowWerkstattDialog.tsx)): ein kanonischer `Dialog`, der die vorhandenen Bausteine **wiederverwendet** — [WorkflowsTab](src/plugins/skill-verwaltung-kuration/WorkflowsTab.tsx) (Schritt-Liste: hinzufügen/entfernen/sortieren + Meta), [WorkflowEditor](src/plugins/skill-verwaltung-kuration/WorkflowEditor.tsx) (Schritt-Konfiguration) und [SkillEditor](src/plugins/skill-verwaltung-kuration/SkillEditor.tsx) (Prompt/Modifier/Regeln). Persistenz über `useSkillRegistry().persist` (in dev ohne Passwort, `canEditSkillRegistry`), inkl. Leave-Guard gegen ungespeicherte Änderungen. Einstiege: ein Button „Workflow bearbeiten (dev)" im dev-Kontrollcluster oben und ein Stift am aktiven Abschnitt (öffnet direkt den Skill-Prompt dieses Schritts). Gating am Aufrufer über `isDevContext()`.
- **Live-Übernahme ohne Reload** ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)): neue `reloadRegistry()` liest die Registry frisch und leitet nur die registry-abhängigen Teile (Skills/Schritte/QS/Relevanz) neu ab — der laufende `WorkflowRun` + die VB bleiben unangetastet (kein Fortschrittsverlust). Der Werkstatt-Dialog ruft sie nach jedem erfolgreichen Persist. Neu exponiert: `activeWorkflowId` (die tatsächlich laufende Def) via `resolveWorkflowDefId` ([active-workflow.ts](src/plugins/antraege/gutachten/active-workflow.ts), geteilter `besterKandidat`-Helfer mit `resolveWorkflowSteps` — output-erhaltend). Editierte Prompts wirken beim **nächsten** Generieren; freigegebene Abschnitte bleiben unverändert.
- **Workflow-Bündel** ([workflow-bundle.ts](src/core/services/skills/registry/workflow-bundle.ts), Spiegel zu `skill-bundle.ts`): `exportWorkflowBundle` schnürt Workflow + **alle referenzierten Skills** (ohne Historie) + deren Regeln; `parseWorkflowBundle` validiert/normalisiert; `importWorkflowBundle` ist rein und kollisionsfest — Workflow-ID-Kollision → Kopie „(importiert)", Schritt-IDs werden **immer** neu vergeben (`parentStepId`/`qsZielStepId` umgemappt, verhindert `WorkflowRun.schritte`-Key-Kollisionen), referenzierte Skills bei ID-Kollision dupliziert + `step.skillId` umgemappt (bestehende Skills nie überschrieben — sonst gingen genau die exportierten Prompt-Tweaks verloren), Regeln additiv. Neuer Unit-Test [workflow-bundle.test.ts](src/core/services/skills/registry/__tests__/workflow-bundle.test.ts).
- **Zwei Oberflächen** (Nutzer-Wunsch): Workflow-Export/Import ist im **Kuration-Plugin** ([WorkflowsTab.tsx](src/plugins/skill-verwaltung-kuration/WorkflowsTab.tsx): „Exportieren"/„Importieren…", neuer [WorkflowImportDialog.tsx](src/plugins/skill-verwaltung-kuration/WorkflowImportDialog.tsx)) **und** im dev-Werkstatt-Dialog verfügbar; einzelne Skills exportiert/importiert man dort ebenfalls (bestehendes `skill-bundle` + `SkillImportDialog`).
- **DRY, kein paralleler Zweig**: die Workflow-Mutations-Aktionen (Schritte + Management) liegen jetzt in einer reinen Fabrik [workflowMutations.ts](src/plugins/skill-verwaltung-kuration/workflowMutations.ts) (`buildWorkflowMutations`), die **sowohl** die [SkillVerwaltungPage](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx) **als auch** der Werkstatt-Dialog nutzen — byte-gleiche Persists.
- Additiv, keine Datenmigration (Bündel sind rein kuratierte Registry-Inhalte, nie Antragsdaten). Typecheck + Lint + volle Test-Suite (3635) + `build:dev`/`build:pl` grün. **Noch offen**: file://-Abnahme (Thomas).

### v2.246.4 — Skill-Editor: Erklärtexte hinter Info-Icons + Markdown-Vorschau für die Prompt-Vorlage (Juli 2026)

PATCH — Der **Skill-Editor** ([SkillEditor.tsx](src/plugins/skill-verwaltung-kuration/SkillEditor.tsx), Tab „Bearbeiten") zwang den Kurator zum Scrollen: die DSGVO-/Dokumentinhalte-Karte trug einen mehrzeiligen Erklärabsatz *über* der Checkbox „Verarbeitet Dokumentinhalte (nur interne KI)" plus eine „Override deaktiviert …"-Zeile, die „Skill aktiv (freigeschaltet)"-Karte einen zweizeiligen Absatz *unter* der Checkbox. Beide Karten sind jetzt einzeilig.

- **Erklärprosa hinter einem Info-Icon**: neuer lokaler `FeldInfo`-Helper (kompaktes lucide-`Info`-Icon + geteilter [Tooltip](src/components/ui/Tooltip.tsx)) sitzt rechts neben der jeweiligen Checkbox und zeigt den bisherigen Erklärtext beim Hover/Fokus. Bei der DSGVO-Karte bleibt der Text **zustandsabhängig** (Slot-erzwungen-intern vs. Fail-safe-Standard); die redundante „Override deaktiviert — durch Inhalts-Slot im Template erzwungen."-Zeile entfällt (der Zustand ist an der deaktivierten, `opacity-60`-gedimmten Checkbox weiterhin ablesbar). Das Icon liegt als Geschwister **neben** dem `<label>`, nicht darin, damit ein Klick aufs Icon die Checkbox nicht togglt. Bewusst der in-Plugin bereits genutzte `Tooltip`+`Info`-Weg (wie [SkillVerwaltungPage.tsx](src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx)), **nicht** das `InfoHint` aus dem Einstellungen-Plugin (keine Cross-Plugin-Grenze).
- **Prompt-Vorlage rendert Markdown live**: die rohe `<textarea>` ist durch den geteilten [MarkdownEditor](src/components/ui/MarkdownEditor.tsx) mit `markdownLivePreview()` ersetzt — derselbe Live-Preview-Editor wie beim Bearbeiten von Gutachten-Abschnitten ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)). `##`-Überschriften/`**fett**` werden gerendert, Marker auf der Cursor-Zeile bleiben sichtbar, der Buffer bleibt rohes Markdown (Ground-Truth, kein Roundtrip). Die Slot-Chips (`{{stammdaten}}` …) darunter sind unverändert.
- **Debounce-Falle behandelt**: `MarkdownEditor.onChange` ist 300 ms debounced — `doSave` liest den Prompt-Wert beim Speichern über `onCreateEditor`/`promptViewRef` frisch aus dem Live-Doc (`.state.doc.toString()`), damit der letzte Tastendruck bei sofortigem „Speichern" nicht verloren geht (greift auch auf dem Leave-Guard-Pfad, da beide `doSave` teilen).
- Reine UI-Änderung in einer Datei, keine neuen Abhängigkeiten (CodeMirror bereits gebündelt), kein Datenmodell-/Persistenz-Touch, Labels/Terminologie unverändert. Typecheck + Lint + `codebase-conventions` (35 Guards) + `build:dev`/`build:pl` grün. **Noch offen**: file://-Abnahme (Thomas).

### v2.246.3 — Skill-Testlauf: Antrags-Auswahl zeigt alle Antragstypen + Typ-Filter + VB-zuerst (Juli 2026)

PATCH — Im **Testlauf-Panel** der Skill-Verwaltung ([SkillTestlauf.tsx](src/plugins/skill-verwaltung-kuration/SkillTestlauf.tsx)) erschienen in der „Antrag wählen"-Liste nur Anträge mit FKZ-Präfix `16DL…` — FuE-, DS-, DL- und NW-Anträge fehlten, sodass ein Skill nur gegen einen Antragstyp testbar war. **Kein harter Filter**, sondern eine stille Kappung: `listAllAntraegeListView` liefert den Store per `getAll()` aufsteigend nach Primärschlüssel `aktenzeichen` (= FKZ), und das Panel schnitt die Liste ungeordnet auf `.slice(0, 40)` — weil `16DL…` lexikografisch vor `16DS…`/`16FuE…`/`16NW…` sortiert, füllten die `16DL`-Sätze das ganze 40er-Fenster.

- **Antragstyp-Filter** ([SkillTestlauf.tsx](src/plugins/skill-verwaltung-kuration/SkillTestlauf.tsx)): neue Pill-Leiste „Alle / FuE / DS / DL / NW" mit Zählern über der Liste, gerendert über das geteilte [ScopeTabs](src/components/ui/ScopeTabs.tsx) (`variant='pills'`, Guard-konform gegen `no-parallel-scope-tabs`). Klassifikation über die bestehende Single-Source `getKategorieLabel(vb_phase)` + `getKategorieItems` ([kategorieQuickfilter.ts](src/plugins/antraege/filter/kategorieQuickfilter.ts)) — **nicht** die FKZ-Buchstaben geparst (die sind der Förderlinien-Präfix, nicht der Antragstyp). Der Filter wirkt auf die volle In-Memory-Liste, nicht das gekappte Fenster; die reinen store-schreibenden Helfer (`applyKategorie`/`getKategorieFromActive`) bleiben bewusst außen vor.
- **VB-zuerst-Sortierung**: Anträge mit vorliegender Vorhabensbeschreibung stehen oben (sekundär FKZ aufsteigend, stabil) — das sind ohnehin die einzig testbaren; Zeilen ohne VB bleiben unverändert gedimmt/`disabled`.
- **Keine stille Kappung mehr**: die Obergrenze (`LISTE_CAP = 80`) weist einen Überhang als dezente Fußzeile aus („… N weitere ausgeblendet — über Typ oder Suche eingrenzen"), statt Treffer wortlos zu verschlucken.
- Reine Auswahl-/Anzeige-Änderung im Testlauf — der eigentliche Run-Pfad (`findVorhabensbeschreibung`, `runSkill`) ist unberührt, kein Datenmodell-/Persistenz-Touch. Feedback-Kontext-Doc [skill-verwaltung-kuration.md](docs/feedback-kontext/skill-verwaltung-kuration.md) nachgezogen. **Noch offen**: file://-Abnahme (Thomas).

### v2.246.2 — Gutachten-Werkstatt: kryptische Abschnitts-UUID durch Kürzel + Skill-Version ersetzt (Juli 2026)

PATCH — Die Abschnitts-Überschrift in der Kurzfassungs-Werkstatt zeigte bei **kurator-erstellten** Workflow-Schritten die rohe Step-UUID an (z. B. `6c1ac727-44ca-401d-9b7e-7772a65e68a6 — Hauptaufgaben pro Partner - 3 Bullet Points`). Grund: `WorkflowStep.id` ist bei per Editor angelegten Schritten eine `crypto.randomUUID()` ([workflowShared.ts](src/plugins/skill-verwaltung-kuration/workflowShared.ts) `blankStep()`), während die eingebauten ZIM-EP-Schritte Buchstaben `A`–`G` tragen — deshalb fiel die UUID nur bei selbst kuratierten Workflows durch. Die Überschrift zeigt jetzt das lesbare Kürzel plus eine echte Versionsnummer.

- **Überschrift** ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)): `{def.id} — {def.label}` → `{def.kurz} — {def.label}` (exakt das „B2", das schon der Stepper zeigt) plus dezenter `v{n}`-Chip mit der Skill-Version (`ctrl.activeSkill.version`, per `?.version != null` abgesichert). Anzeige-Präzedenz: die Review-Karte zeigt bereits `v{skillVersion}`.
- **Konsistenz — dieselbe UUID-Leck-Stelle**: der Stil-/Tweak-Dialog-Titel ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx), `sektionLabel`) und die Wiederaufnahme-Zeile („Abschnitt … in Arbeit" / Button „Weiter bei …", [ResumeLine.tsx](src/plugins/antraege/gutachten/ResumeLine.tsx)) nutzen jetzt ebenfalls `def.kurz` statt der UUID (ResumeLine-Fallback um `kurz` ergänzt, damit der Randfall „aktiver Schritt nicht in `steps`" nicht bricht).
- Reine Anzeige — kein neues Feld, keine Datenmigration, kein Persistenz-Touch. Eingebaute ZIM-EP-Abschnitte (A–G) unverändert. **Noch offen**: file://-Abnahme (Thomas).

### v2.246.1 — Skill-Editor: zugeordnete Qualitätsregeln nach Kategorie gruppiert + einklappbar (Juli 2026)

PATCH — Die Sektion „Zugeordnete Qualitätsregeln" im Skill-Editor ([SkillEditor.tsx](src/plugins/skill-verwaltung-kuration/SkillEditor.tsx)) listete alle ~19–22 Bibliotheks-Regeln als eine flache Checkbox-Wand — eine Scrollwüste, in der man den Überblick über die tatsächlich zugeordneten Regeln verlor. Die Liste ist jetzt nach Kategorie/„Art" gruppiert und je Gruppe einklappbar.

- **Gruppierung nach `effektiveKategorie`** (Umfang · Sprache · Struktur · Inhalt & Quellen · Vollständigkeit & Form) — dieselbe Achse wie die Regel-Facetten-Filter ([useRegelFilters.ts](src/plugins/skill-verwaltung-kuration/useRegelFilters.ts)) und die gruppierte Ampel-Prüfung ([checkGruppen.ts](src/plugins/antraege/gutachten/checkGruppen.ts)). Neuer reiner Bucket-Helfer [regelGruppen.ts](src/plugins/skill-verwaltung-kuration/regelGruppen.ts) (`groupRegelnByKategorie`, gespiegelt von `groupChecksByKategorie`: nur nicht-leere Gruppen, stabile `KATEGORIE_ORDER`, unbekannte Kategorien ans Ende), Unit-Test [regelGruppen.test.ts](src/plugins/skill-verwaltung-kuration/__tests__/regelGruppen.test.ts).
- **Auto-Aufklappen**: Gruppen mit mindestens einer zugeordneten (angehakten) Regel öffnen beim Editor-Öffnen automatisch, die übrigen bleiben zu. Jeder Gruppenkopf trägt einen Zähler „zugeordnet/gesamt" (z. B. `2/4`), auch im eingeklappten Zustand sichtbar.
- **Reuse, kein neues Primitive**: nutzt die bestehende [CollapsibleSection](src/components/ui/CollapsibleSection.tsx) (`defaultOpen` **ohne** `storageKey` → in-memory, pro Skill neu berechnet statt global gecacht; stabiler `key` je Kategorie → Checkbox-Toggle lässt die Sektionen nicht auf-/zuschnappen). Checkbox-Zeilen, „Regeln verwalten →" und der „Formale Vorgaben (automatisch)"-Block unverändert.
- Kein Datenmodell/Schema/Flag berührt. **Noch offen**: file://-Abnahme (Thomas).

### v2.246.0 — „Neue Anträge für dich": auch ältere noch zuweisbare Anträge sichtbar (Juli 2026)

MINOR — Das Home-Widget „Neue Anträge für dich" ist eine **7-Tage-Frische-Inbox** (Anträge ab Freigabe, `selbsteintragungFristTage`, Default 7), die Auslastung „Anträge zuweisen" dagegen ein **6-Monats-Backlog** — deshalb fehlten dem angemeldeten MA (z. B. THÜ) auf der Startseite Anträge, für die er in der Auslastung noch als Vorschlag geführt wird (Freigabe > 7 Tage her, oder Nebenkategorie). Ein neuer, **nicht frist-limitierter** Abschnitt schließt die Lücke, ohne die frische Liste oben zu verwässern.

- **Neuer Block „Weitere zuweisbare Anträge"** unter der frischen Liste: alle noch zuweisbaren Anträge der **Haupt- oder Nebenkategorie**, die im Auslastungs-Verteil-Pool stehen (`istZuVerteilen` in [verbund-aggregation.ts](src/plugins/auslastung/services/verbund/verbund-aggregation.ts): Lookback-Fenster + ohne TIB-Kürzel + Status-Filter — deckungsgleich mit „Anträge zuweisen"), deren 7-Tage-Home-Frist aber abgelaufen ist. Ohne „Noch X Tage"-Countdown, mit funktionierendem „Kann ich übernehmen".
- **Disjunkt zu den frischen Sektionen**: der Block behält nur Verbünde mit abgelaufener Frist (`daysLeft <= 0`) und **nicht** bereits in Tier 1. Deterministisch (keine Matching-Engine, keine Passung %) — Vollständigkeit ohne Engine-Last; die bestehende on-demand-Sektion „Weitere Anträge · niedrigere Passung" (frische Nebenkategorie, engine-gescort) bleibt **unverändert**.
- **Additiv, reuse-first**: `buildOffeneEintraege` ([neueAntraegeVerbund.ts](src/plugins/home/neueAntraegeVerbund.ts)) bekommt zwei **optionale** Schalter `ignoriereFrist` + `poolFilter` (Defaults = heutiges Verhalten, bit-identisch); `NeueAntraegeVerbundRow` ([NeueAntraegeVerbundRow.tsx](src/plugins/home/NeueAntraegeVerbundRow.tsx)) ein optionales `zeigeFrist` (Default `true`). Kein neues Layout, kein neuer Store, kein Schema-Bump. Reuse von `verteilCutoffDatum`/`istZuVerteilen`/`groupEintraegeByVerbund`.
- **Bewusste Grenzen**: in der Auslastung **manuell** hinzugefügte Zuweisungen und eine Divergenz zwischen persönlichem Profil und Store-Kategorie (Home liest `useMyAuslastungProfil`, Engine den Store-Record) bleiben unberührt — separate Fälle.
- **Noch offen**: file://-Abnahme (Thomas).

### v2.245.0 — Antrag-Aufbereitung: Anlage 5 (Arbeitsplan) pro Teilvorhaben (Juli 2026)

MINOR — Die Anlage 5 (Arbeitsplan) ist teilvorhaben-spezifisch: ein Verbund mit 3 TVs bringt 3× eine Anlage 5 mit. Die Aufbereitung war als „ein Arbeitsplan pro Vorhaben" gebaut (`resolveAnlage5` → `treffer[0]`, ein einziger Zeitplan) — lud der Gutachter alle drei hoch, wertete der Zeitplan-Tab **nur eine** aus (die anderen verschwanden still). Der Zeitplan-Tab ist jetzt verbund-fähig. Dev-Flag `antragAufbereitung`.

- **Verbund (≥2 TV)**: pro TV eine eigene Gantt-Sektion aus dessen Anlage 5 (Nach AP / Nach Person) + eigene Kapazitätsprüfung; oben eine schlanke **Verbund-Summenzeile** (Σ PM, Σ eingesetzte MA, längster Horizont, TV-Abdeckung). Kein Text-vs-Anlage-5-Abgleich im Verbund (die gemeinsame VB trägt keine TV-genauen Textpläne).
- **Fehlende Anlage 5 pro TV**: immer eine Sektion je TV — fehlt die Anlage 5, steht dort „Anlage 5 fehlt" mit direkter Drop-Zone (`defaultTyp='arbeitsplan'`), Nachreichen löst Auto-Recompute aus. Das [QuellenPanel](src/plugins/antraege/aufbereitung/QuellenPanel.tsx) zeigt pro TV eine Anlage-5-Zeile.
- **TV-Zuordnung deterministisch aus dem Dateinamen** (`matchTvAusDateiname`/`resolveAnlagenProTv` in [quellen.ts](src/plugins/antraege/aufbereitung/quellen.ts)): das TV-FKZ im Dateinamen wird zur Auflösungszeit gegen die TV-Aktenzeichen gematcht (längster Treffer gewinnt). Kein Tagging-Umbau, keine Migration — wirkt sofort auf bereits hochgeladene Dateien; nicht zuordenbare Dokumente landen in einem sichtbaren „ohne TV-Zuordnung"-Hinweis (kein stilles Verschwinden).
- **Rein additiv**: neue optionale Felder `AufbereitungRun.teilplaene`/`anlagenOhneTv`, `QuelleRef.tvAz`, `Befund.tvAz` (`version` bleibt 1, alte Runs laden unverändert). `run.befunde` bleibt die einzige Befund-Liste (pro-TV Kapazität mit `tvAz` + TV-Kürzel im Text → Fragen-Tab/offene Punkte unverändert). `istVeraltet` vergleicht im Verbund das Anlage-5-Hash-Multiset.
- **Solo (Einzelvorhaben, 1 TV) unverändert**: heutiger Single-Zeitplan inkl. Text-vs-Anlage-5-Abgleich, durch einen Regressions-Test abgesichert. LLM-Bausteine (Steckbrief/Abdeckung/Zahlen/Verwertung/Glossar) unberührt (weiter VB-+-Marketing-Korpus).
- Geteilte Präsentations-Bausteine (`KennzahlenKarte`/`BefundZeile`/`Stat`) nach [zeitplanBausteine.tsx](src/plugins/antraege/aufbereitung/zeitplanBausteine.tsx) ausgelagert (kein Import-Zyklus zwischen `ZeitplanTab` und dem neuen [VerbundZeitplan.tsx](src/plugins/antraege/aufbereitung/VerbundZeitplan.tsx)). Spec + Plan: [docs/superpowers/](docs/superpowers/specs/2026-07-14-aufbereitung-anlage5-pro-tv-design.md).
- Keine Datenmodell-Migration, kein neuer IDB-Store. **Noch offen**: file://-Abnahme (Thomas).

### v2.244.0 — Fix: zwei Aktualisierungs-Banner liefen parallel („2 Quellen aktualisiert — 1 Fehler") → zu EINER Aktion zusammengefasst (Juli 2026)

MINOR — Beim Neu-Laden (pl) erschienen nach dem Startup **zwei Banner gleichzeitig** — „neuer Datenbestand" (Snapshot vom Team, [NewSnapshotBanner](src/core/components/NewSnapshotBanner.tsx)) und „neue CSV-Quellen" ([CsvAutoRefreshBanner](src/plugins/csv-sources-kuration/components/CsvAutoRefreshBanner.tsx)), jeder mit eigenem CTA. Klickte der User **beide**, liefen zwei Daten-Mutations-Flows echt parallel gegen dieselben IndexedDB-Stores + Share-Snapshot-Dateien (`clear()`/`put()` gegen einen laufenden CSV-Merge + `atomicWrite`-Temp-Rename-Rennen mit gemeinsamen `<file>.tmp`-Namen) → genau ein Quell-Import warf einen nicht-Lock-Fehler → **„2 Quellen aktualisiert — 1 Fehler."**

- **Root Cause**: Der einzige vorgesehene Serializer (modulweite `running`-Flag in [data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts)) schützte **nur `runDataUpdate`** — die beiden Banner-CTAs (`doRefresh` → `runAutoRefresh` bzw. `applyNow` → `syncProgrammSnapshot`) riefen ihn nie und hatten keine gemeinsame Sperre; die hook-lokalen `refreshing`/`applying`-Flags entprellten je nur den eigenen Banner.
- **Schicht A — geteiltes In-Tab-Gate** (Korrektheits-Rückgrat): neues [data-mutation-gate.ts](src/core/services/csv/data-mutation-gate.ts) (synchrones Check-and-Set, `acquireDataMutation`/`releaseDataMutation`/`useDataMutationBusy`). `runDataUpdate` (ersetzt die alte `running`-Flag), `doRefresh` und `applyNow` acquiren es jetzt am Einstieg. Damit ist **jede** Kollision serialisiert — zwei Banner, Banner-vs-Sidebar-Frische-Button, Banner-vs-Einstellungen. Ein Unit-Test deckt die Invariante deterministisch ([data-mutation-gate.test.ts](src/core/services/csv/__tests__/data-mutation-gate.test.ts)).
- **Schicht B — zu EINER Aktion zusammengefasst** (UX): neuer Koordinator [DataUpdateBanners.tsx](src/plugins/csv-sources-kuration/components/DataUpdateBanners.tsx) hält beide Hooks EINMAL. Stehen **beide** Aktualisierungen an, zeigt er EINEN Banner mit EINEM Knopf „Datenbestand aktualisieren", der den vereinten `runDataUpdate`-Pfad fährt (Snapshot → CSV-Import in der fachlich korrekten Reihenfolge, in EINEM serialisierten Lauf); Fortschritt über den bestehenden [StartupDataUpdateBanner](src/core/components/StartupDataUpdateBanner.tsx), Drift landet im gewohnten Dialog. Steht nur eines an, rendert wie bisher der jeweilige Einzel-Banner. Deren CTAs werden zusätzlich deaktiviert, solange ein fremder Flow läuft (`useDataMutationBusy`).
- **`CsvAutoRefreshBanner` jetzt präsentational** (State via Prop, wie `NewSnapshotBanner`) — der Koordinator besitzt die eine Hook-Instanz (kein Doppel-Check). Das führende ✨-Icon des Banners ist **entfernt** (die semantischen Zustände tragen ihr eigenes Häkchen-/Warn-Icon).
- `phaseToastLabel`/`completionToast` aus App.tsx in [data-update-toast.ts](src/plugins/csv-sources-kuration/services/data-update-toast.ts) extrahiert (DRY — App-Start + Koordinator teilen die Labels).
- Keine Datenmodell-/Schema-/Flag-Änderung. **Noch offen**: file://-Abnahme (Thomas).

### v2.243.2 — Gutachten-Werkstatt: „Quelle & Prüfung"-Panel beliebig breit ziehbar (Juli 2026)

PATCH — In der Gutachten-Werkstatt (dev-Flag `gutachtenWorkflow`) ließ sich die Ziehleiste an der linken Kante des „Quelle & Prüfung"-Panels nur bis **620 px** nach links ziehen; für die neuen Beleg-/Quellen-Karten (Journey-Paket 4) war das zu schmal. Der feste Hardcap ist raus — das Panel darf jetzt beliebig breit gezogen werden ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)).

- **Obergrenze rechnet der Container statt eines Literals**: `startCtxResize` reserviert der mittleren Entwurf-Karte nur noch eine lesbare Restbreite (`CARD_MIN_WIDTH = 260`, vorher 360) und lässt das Panel bis `bodyWidth − Rail − 260 − Gaps` wachsen. Bei eingeklappter Rail zählt die schmale Kreis-Breite (`RAIL_COLLAPSED_W`) mit → mehr Raum fürs Panel.
- **Persistenz-Clamp angehoben** (`teamflow_gutachten_ctx_w`, localStorage): Sanity-Cap 620 → 2400, damit eine breit gezogene Einstellung den Reload überlebt.
- **Robust gegen Monitor-Wechsel**: ein neuer Clamp-Effekt klemmt eine (auf großem Monitor gespeicherte) zu breite Panel-Breite nach der Container-Messung auf den verfügbaren Raum, sodass die mittlere Karte via `minmax(0,1fr)` nie bis auf 0 schrumpft.
- Reiner Layout-/UI-Tweak — keine Datenmodell-/Schema-/Flag-Änderung, kein Bookmarklet-Rebuild.

### v2.243.1 — Fix: Absturz beim Öffnen einer Verbund-Detailseite (React #310) + Hook-Lint-Guard (Juli 2026)

PATCH — Beim Öffnen einer Verbund-Detailseite (z.B. über „Weiter" in der Home-Sektion „Weitermachen") stürzte die App mit einem React-Fehler ab (#310, „Rendered more hooks than during the previous render"; react-router zeigte die „Unexpected Application Error"-Boundary). Ursache: der in **v2.241.7** ergänzte `tvTitelZeilen`-`useMemo` in [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx) stand **unterhalb** des `if (!verbund) return`-Early-Returns. Da [useVerbundDetailData](src/plugins/antraege/useVerbundDetailData.ts) `verbund` erst **asynchron** lädt, lief der erste Render (`verbund === null`) in den Early-Return (ein Hook weniger) und der Render nach dem Laden in den vollen Body (ein Hook mehr) → inkonsistente Hook-Reihenfolge → Absturz. Betroffen war **jeder** Verbund-Detail-Aufruf in v2.241.7–v2.243.0, nicht nur der „Weitermachen"-Deep-Link — dort fiel es nur zuerst auf.

- **Fix**: den `useMemo` über den Early-Return gezogen (neben die anderen bewusst dort gehaltenen Pre-Return-Hooks). Reines Verschieben — der Memo hängt ausschließlich an `antraege` (vor dem Return verfügbar), keine Dependency-Änderung. Hook-Reihenfolge jetzt in jedem Render identisch.
- **Guard gegen Wiederkehr**: erstmals **ESLint** im Repo ([eslint.config.js](eslint.config.js)) — bewusst minimal, nur `react-hooks/rules-of-hooks: error` (fängt genau diese Bug-Klasse, die `tsc` nicht sieht). Neues Script `npm run lint`, in die `check`-Kette aufgenommen. Das `@typescript-eslint`-Plugin wird nur registriert (keine Regel aktiv), damit im Bestand verstreute Alt-`eslint-disable`-Direktiven auflösen; `reportUnusedDisableDirectives` aus; `exhaustive-deps` bewusst aus (kein Style-/Type-Flood). Der einzelne stale `jsx-a11y`-Kommentar in [StreamlitBridgeSection.tsx](src/plugins/einstellungen/StreamlitBridgeSection.tsx) entfernt.
- Keine Datenmodell-/Schema-/Flag-Änderung.

### v2.243.0 — Antrag-Aufbereitung: Tab „Verwertung/Markt" (dokumentgrenzen-unabhängig) (Juli 2026)

MINOR — Stufe 2 zu v2.242.0: neuer Tab **„Verwertung/Markt"** in der Antrag-Aufbereitung (dev-Flag `antragAufbereitung`). Ein interner LLM-Baustein extrahiert die Verwertungs-/Markt-Aussagen (Zielmärkte, Wettbewerb, Verwertungswege, Zeithorizont, Umsatz-/Marktpotenzial) aus dem **Korpus** — kategorisiert, wortnah, mit Fundstellen ([verwertung.ts](src/plugins/antraege/aufbereitung/verwertung.ts), [VerwertungTab.tsx](src/plugins/antraege/aufbereitung/VerwertungTab.tsx)).

- **Dokumentgrenzen-unabhängig**: der Baustein läuft über den zusammengeführten Korpus (VB + narrative Zusatzdokumente), nie über ein separates Marketing-Dokument. Ob das Verwertungskonzept in der VB steht oder in einem Extra-Dokument, ändert Inhalt + Fundstellen nicht. Die Fundstellen zeigen in dieselbe Korpus-Gliederung wie alle Tabs (Lesemodus-Sprung landet auch bei Marketing-Sektionen korrekt — kein Sonderpfad).
- **Inhaltsbasierter Leer-Zustand**: bewusst KEIN „verdächtig"-Retry — 0 Aussagen ist ein legitimer Zustand („kein Verwertungs-/Markt-Inhalt im Material"), keine Degradations-Warnung.
- Neuer Skill-Seed `aufbereitung-verwertung` ([aufbereitung-verwertung.seed.ts](src/core/services/skills/registry/aufbereitung-verwertung.seed.ts), `aktiv:false`, intern-pflichtig via literalem `{{vbMarkdown}}`, Pitfall #30/#35); tolerant-JSON-Parser über den geteilten `birgtRohArray` (Truncation-Salvage, kompakt-JSON, Muster Glossar). Neuer Seed → `mergeMissingSeeds` zieht ihn auf Bestands-Shares nach (keine Migration).
- **Noch offen**: file://-Abnahme (Thomas) + ein Eval-Durchlauf für den neuen Baustein (bleibt `aktiv:false` bis dahin).

### v2.242.0 — Antrag-Aufbereitung: „Dokumente zum Vorhaben" — Inline-Upload + dokumentgrenzen-unabhängiger Korpus (Juli 2026)

MINOR — Die Antrag-Aufbereitung (dev-Flag `antragAufbereitung`) behandelt **alle Vorhabens-Dokumente als eine Einheit**. Neues Panel „Dokumente zum Vorhaben" ([QuellenPanel.tsx](src/plugins/antraege/aufbereitung/QuellenPanel.tsx)) zeigt VB / Arbeitsplan-Anlage 5 / Marketing-Verwertungskonzept und bietet eine **Inline-Drop-Zone**, mit der der Gutachter fehlende Dokumente (z.B. eine vergessene Anlage 5) direkt auf der Aufbereitungs-Seite nachreicht — statt die Seite zu verlassen (die gemeldete Blockade). Nach der Aufnahme wird automatisch neu aufbereitet.

- **Dokumentgrenzen-unabhängige Auswertung**: Die freitextlichen LLM-Bausteine (Steckbrief/Abdeckung/Glossar) + Lesemodus + Fundstellen arbeiten jetzt auf einem **zusammengeführten Korpus** (VB als Präfix + narrative Zusatzdokumente mit Quellenmarkierung). Ob ein Marketing-/Verwertungskonzept in einem Extra-Dokument oder schon in der VB steht, hat damit **keinen** Einfluss mehr auf Darstellung/Inhalt — inkl. Fundstellen. Weil die VB der Präfix ist, bleiben alle VB-Sektions-Offsets/-IDs stabil; die deterministische Ernte (Tabellen/Zeitplan/Risiken) bleibt VB/Anlage-5-spezifisch. Ohne narratives Zusatzdokument ist der Korpus **byte-identisch** zur VB → keine Verhaltensänderung + Cache-Treffer für Bestands-Anträge ([quellen.ts](src/plugins/antraege/aufbereitung/quellen.ts) `baueKorpus`/`resolveKorpus`, [store.ts](src/plugins/antraege/aufbereitung/store.ts) `baueRun`).
- **Typisiertes Ablegen**: `AntragDokumentTyp` um `arbeitsplan` (Anlage 5) + `marketingkonzept` erweitert ([csv/types.ts](src/core/services/csv/types.ts)); die wiederverwendete [DokumentAufnahme](src/core/components/DokumentAufnahme.tsx)-Drop-Box bekommt `defaultTyp`/`typOptionen` — die Aufbereitung übergibt `defaultTyp='sonstiges'`, damit eine per Dateiname sofort aufgenommene Anlage 5 die VB-Auflösung (`resolveVb` = neuestes VB-Doc) NICHT überschreibt (Bestands-Caller unverändert). Anlage 5 wird nun per Typ-Tag ODER Dateiname erkannt.
- **Robustes Neu-Aufbereiten**: mehrere gleichzeitig abgelegte Dateien werden zu **einem** nachlaufenden „Neu aufbereiten" gebündelt (`requestRecompute`, verkraftet den Busy-Guard von `useAsyncAction`). `QuelleRef.rolle` um `'verwertung'` erweitert (additiv, alte Runs bleiben ladbar); `istVeraltet` reagiert auf hinzugefügte/geänderte/entfernte Zusatzdokumente.
- Kein Schema-/Store-Bump (alles additiv im `kv`-Store, Pitfall #29). Kopf-VB-Statuszeile + Anlage-5-Badge sind ins Panel gewandert.
- **Noch offen**: file://-Abnahme (Thomas); Stufe 2 (eigener Tab „Verwertung/Markt", der den Korpus dokumentgrenzen-unabhängig auswertet) folgt.

### v2.241.10 — Gutachten-Werkstatt: „Technische Risiken" als Entwurf → gefilterter Fließtext (Juli 2026)

PATCH — Der Abschnitt C („Technische Risiken", Skill `gutachten-risiken`) gab bisher eine **Liste** aller im Antrag genannten Risiken aus (je Risiko fett gesetzter Kurztitel + 2–3 Sätze). Diese Liste wird jetzt zum **Entwurfszwischenschritt**; der finale Text ist ein **Fließtext ohne Kurztitel**, beschränkt auf die zentralen, auf dem **Lösungsweg** liegenden und vom Vorhaben **beeinflussbaren** Risiken (bei mehr als drei die höchstens drei zentralen). Externe / nicht beeinflussbare Risiken (Marktlage, Regulatorik, Verhalten Dritter) fließen nicht in den finalen Text.

- **Dreistufige Skill-Ausgabe** (wie der Kurzfassungs-Skill A): `### Quellenanalyse` / `### Entwurf` / `### Finaler Text`. Der gemeinsame Abschnitts-Builder `abschnittTemplate` trägt jetzt einen optionalen `entwurf`-Abschnitt ([seed.ts](src/core/services/skills/registry/seed.ts)); ohne ihn bleibt die Ausgabe **byte-identisch** zur bisherigen 2-Abschnitt-Form (schützt die B-Rollout-Migration + `grundsatz.test`). C ist auf **v2** gehoben, `maxTokens` 2048 → 4096 (die längere 3-Abschnitt-Ausgabe würde auf dem Eval-/DirectLLM-Pfad sonst abgeschnitten).
- **Entwurf sichtbar**: Das „Quelle & Prüfung"-Panel zeigt den Entwurf (alle genannten Risiken) als **einklappbaren Block** — nachvollziehbar, welche Risiken der finale Text aussortiert ([KontextPanel.tsx](src/plugins/antraege/gutachten/KontextPanel.tsx)). In Word-Export/Freigabe/Eval geht unverändert **nur** der finale Text (`finalerText`-only-Kontrakt).
- **Regeln**: Die Wortanzahl-Prüfung (300–350 Wörter) ist für C jetzt ein **Hinweis** statt eines blockierenden Fehlers (`seed-c-umfang`); neu ein Aufzählungs-Guard (`seed-c-keine-aufzaehlungen`, wie Abschnitt D), der den finalen Fließtext gegen Rückfall in Listenform schützt.
- **Rollout auf Bestands-Shares**: marker-gesicherte Registry-Migration `ga-risiken-entwurf-2026-07` ([migrations.ts](src/core/services/skills/registry/migrations.ts)) hebt C nur, wenn das Share-Template **exakt** einem der zwei bekannten Alt-Stände entspricht (Seed-Default mit Stilbeispiel bzw. kuratierter Snapshot ohne); kuratierte C-Edits bleiben **unberührt**.
- **Noch zu prüfen**: file://-Abnahme (Thomas) + ein Eval-Durchlauf für Abschnitt C (C's Generierung ändert sich). Kein Schema-/Datenmodell-/Flag-Bump.

### v2.241.9 — Gutachten-Werkstatt: Abschnitt B in zwei Läufen erzeugen (Output-Limit) (Juli 2026)

PATCH — Ergänzung zu v2.241.8: Auch nach dem Bridge-Fix wurde Abschnitt B („Hintergrund, Stand der Technik, Lösungsweg", ≥ 750 Wörter) am Ende abgeschnitten — die Ursache liegt **serverseitig** im festen Output-Token-Budget des internen LLM (Reasoning + langer Fließtext teilen sich ein hartes Limit; auf dem Streamlit-Pfad kann die App es nicht beeinflussen, `maxTokens` ist dort inert). Dasselbe Prompt bricht auch in einem separaten Streamlit-Chat mittendrin ab.

- **Fix — unsichtbare Teil-Generierung**: B wird jetzt in **zwei kürzeren Läufen** erzeugt — Lauf 1 „Hintergrund + Stand der Technik", Lauf 2 „Lösungsweg" (mit Lauf 1 als Anschluss-Kontext) — und deterministisch zu **einem** Abschnitt zusammengeführt ([teilGenerierung.ts](src/plugins/antraege/gutachten/teilGenerierung.ts)). Für den Nutzer bleibt es ein Abschnitt B; jeder Teil-Lauf ist kurz genug, um unter dem Budget zu bleiben.
- **Sauberes Zusammenführen**: Da die Beleg-Zuordnung seit v2.241.5 rein anzeige-seitig aus dem flachen Text abgeleitet wird, ist der Merge einfache Verkettung (keine Satz-Index-Verschiebung). Die Größen-Regeln (≥ 750 Wörter, ≥ 4 Absätze) fallen im Teil-Prompt weg und werden erst gegen den **gemergten** Text geprüft.
- Neues, generisches `teilAufgabe`-Feld im Skill-Runner ([run-skill.ts](src/core/services/skills/run/run-skill.ts)) scopet einen Teil-Lauf („schreibe in DIESEM Lauf nur …"); nur B ist gesplittet ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)), alle anderen Abschnitte (A, C–G) laufen unverändert in einem Zug. Split greift nur bei frischer Generierung, nicht bei Korrektur-/Modifier-Läufen. Kein Schema-/Datenmodell-/Flag-Bump.
- **Noch zu prüfen**: file://-Abnahme (Thomas) — kommt B jetzt vollständig? — plus ein Eval-Durchlauf, da sich B's Generierung ändert.

### v2.241.8 — Gutachten-Werkstatt: langer Abschnitt bricht nicht mehr vor dem „Finaler Text" ab (Juli 2026)

PATCH — Bei langen KI-Abschnitten (Kurzfassung A, Ausgangslage B) brach die Generierung ab: Das Modell produzierte den vollständigen `### Quellenanalyse`-Block, und das anschließende Schreiben des `### Finaler Text` wurde abgeschnitten — gespeichert wurde nur ein leerer finaler Text mit Warnung „bitte erneut generieren". Dasselbe Prompt lief in einem separaten Streamlit-Chat komplett durch — der Abbruch war also bridge-seitig, nicht am Prompt (das Entfernen des Beleg-Marker-Kontrakts in v2.241.5 half deshalb nicht).

- **Ursache** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)): Sobald der (lange) Quellenanalyse-Block erfasst war, finalisierte das Bookmarklet schon nach 5 s „Idle", wenn `isRunning()` in der Pause vor dem Schluss-Abschnitt fälschlich „nicht mehr aktiv" las (AitisiGPT blendet den Lauf-Indikator per CSS aus). Ergebnis: nur die Quellenanalyse zurückgegeben, `parseSkillOutput` degradierte zu leerem finalen Text.
- **Fix — Abschluss-Marker-Schutz**: Die App reicht der Bridge pro Anfrage einen Abschluss-Marker mit (`erwarteAbschluss: 'Finaler Text'`, [run-skill.ts](src/core/services/skills/run/run-skill.ts) → [streamlit.ts](src/core/services/ai/transports/streamlit.ts) → `tf-request.erwarte`). Enthält die Antwort diesen Text noch nicht, finalisiert das Bookmarklet NICHT auf dem 5-s-Fenster, sondern gibt dem Schluss-Abschnitt bis zu 45 s Zeit (Konstante `MISSING_TAIL_MS`); die 150-s/600-s-Backstops bleiben. Robust unabhängig von der isRunning-Zuverlässigkeit; rendert die KI alles auf einmal, ist der Marker sofort da (keine Verzögerung). Fail-open: erscheint der Marker nie, finalisiert die Bridge nach 45 s mit dem vorhandenen Stand — nie schlechter als zuvor.
- Nur der Gutachten-Abschnitts-Pfad ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)) setzt den Marker; andere KI-Läufe unverändert. Diagnose: das Bookmarklet loggt beim Finalisieren jetzt den Grund (idle/settle/erwarte-Status).
- **Wichtig — Bookmarklet neu installieren**: `BRIDGE_REV` ist auf `2026-07-13-tail` gebumpt; das Team muss das Lesezeichen 1× neu installieren (KI-Tab → Einstellungen → Streamlit-Bridge), bis dahin läuft das alte Verhalten weiter. Kein Schema-/Datenmodell-/Flag-Bump.

### v2.241.7 — Verbund-Detail: alle TV-Titel per Icon in die Zwischenablage (Juli 2026)

PATCH — Die Teilvorhaben-Titel werden häufig als Textliste in andere Dokumente übernommen. Der Sektionskopf „Verbundpartner und Teilvorhaben" trägt dafür jetzt ein kleines Kopier-Icon (Tooltip „Alle Teilvorhaben-Titel kopieren").

- Neuer Icon-Button [TvTitelCopyButton.tsx](src/plugins/antraege/TvTitelCopyButton.tsx) legt alle TV-Titel (eine Zeile je Teilvorhaben, Reihenfolge = TV-Liste, Lead zuerst) als reinen Text in die Zwischenablage; kurzes Häkchen-Feedback nach dem Kopieren. Wortgleiche Titel (normalisiert) werden zusammengefasst — trägt ein Verbund an allen TVs denselben Titel, landet er nur einmal statt N-fach. `navigator.clipboard` läuft unter `file://` (Secure Context); Async über `useAsyncAction` (Pitfall #15).
- [CollapsibleDataSection.tsx](src/plugins/antraege/CollapsibleDataSection.tsx) bekommt einen optionalen `headerAction`-Slot rechts im Kopf, gerendert als **Geschwister** des Auf-/Zuklapp-Buttons (kein verschachteltes `<button>`) — ein Klick auf das Icon kopiert, ohne die Sektion umzuschalten; der übrige Kopf bleibt voll klickbar. Andere Sektionen (Antragsdaten, Alle Felder, Historie) unverändert.
- Reine Anzeige-/Komfort-Funktion; kein Schema-/Datenmodell-/Flag-Bump.

### v2.241.6 — Verbund-Detail: TV-Titel-Zeile nur zeigen, wenn sie Neues sagt (Juli 2026)

PATCH — Nachschärfung zu v2.241.4: Trugen (wie in manchen Datenbeständen üblich) alle Teilvorhaben eines Verbundes denselben `titel` (den Gesamt-Projekttitel), wiederholte die neue TV-Titel-Zeile diesen Text in jeder Zeile — und obendrein den bereits im Verbund-Kopf stehenden Titel.

- `TeilvorhabenListe` bekommt den Verbund-Titel (`verbundTitel`, aus [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx) — dieselbe Kopf-Quelle) und blendet die TV-Titel-Zeile jetzt auch dann aus, wenn der TV-Titel (normalisiert) nur diesen Verbund-Titel wiederholt (zusätzlich zum bestehenden Antragsteller-Duplikat-Check). So erscheint der TV-Titel nur, wenn er gegenüber Kopf + Antragsteller **echten Mehrwert** bringt.
- Reine Anzeige-Logik; kein Schema-/Datenmodell-/Flag-Bump.

### v2.241.5 — Gutachten-Kurzfassung: Beleg→Satz-Marker-Kontrakt zurückgebaut (Juli 2026)

PATCH — Der in Journey-Paket 4 eingeführte **Beleg→Satz-Marker-Kontrakt** (das Modell sollte jede Quellenanalyse-Zitat-Zeile mit `→ stützt Satz N` abschließen) brachte die interne KI in einen langen Reasoning-Loop — sie lieferte für die Kurzfassung (A) und den Abschnitt B keine verwertbare Ausgabe mehr. Der Kontrakt ist zurückgebaut; die Satz↔Quelle-Zuordnung läuft jetzt **rein deterministisch** (Wortüberlappung, [belegAbleitung.ts](src/plugins/antraege/gutachten/belegAbleitung.ts), seit v2.241.0 bereits als Fallback vorhanden).

- **Prompt-Rückbau**: A ([seed.ts](src/core/services/skills/registry/seed.ts), `buildKurzfassungPrompt(false)`) und B (`abschnittTemplate(B_ABSCHNITT_OPTS)`) tragen die Marker-Instruktion nicht mehr — byte-identisch zum Vor-Paket-4-Stand; die Skill-Ausgabe ist wieder das schlanke, verlässliche Format.
- **Bestands-Shares**: Der ursprüngliche Rollout `GA_BELEG_KONTRAKT_MIGRATION` ist neutralisiert (No-op); eine neue marker-gesicherte Migration `GA_BELEG_KONTRAKT_REVERT_MIGRATION` ([migrations.ts](src/core/services/skills/registry/migrations.ts)) setzt A/B auf einem Share **nur dann** zurück, wenn ihr Template exakt dem Kontrakt-Stand gleicht — **kuratierte Edits bleiben unberührt**.
- **Anzeige unverändert**: Der „Antragsbezug" rechts hebt beim Hover über einen Satz weiterhin die passende Quelle hervor — jetzt durchgehend deterministisch abgeleitet und sichtbar als „automatisch zugeordnet" gekennzeichnet ([KontextPanel.tsx](src/plugins/antraege/gutachten/KontextPanel.tsx)). Der Marker-Parser bleibt für etwaige Alt-Läufe erhalten (nie regressiv). Kein Schema-/Datenmodell-/Flag-Bump.

### v2.241.4 — Verbund-Detail: Teilvorhaben-Titel prominent je TV anzeigen (Juli 2026)

PATCH — In der Teilvorhaben-Liste eines Verbundes ([TeilvorhabenListe.tsx](src/plugins/antraege/TeilvorhabenListe.tsx)) stand pro Zeile nur der Antragsteller (Firma/Institut) prominent, Rolle + Aktenzeichen darunter fein. Der **TV-Titel** — der aussagt, was der jeweilige Partner im Projekt macht — war erst nach dem Aufklappen sichtbar.

- Der TV-Titel (`Antrag.titel`) wird jetzt direkt in der (auch eingeklappten) TV-Zeile als kräftige zweite Zeile unter dem Antragsteller gerendert (`--tf-text-secondary`, auf 2 Zeilen begrenzt, voller Text im Tooltip). Fehlt der Titel oder dupliziert er (normalisiert) nur den Antragsteller-Namen, wird die Zeile weggelassen.
- Reine Anzeige aus dem bereits geladenen vollen `Antrag`-Record; kein neuer Datenpfad, kein Schema-/Datenmodell-/Flag-Bump.

### v2.241.3 — Gutachten-Werkstatt: KI-Erreichbarkeit beim Schrittwechsel neu prüfen (Juli 2026)

PATCH — War die interne KI zwischenzeitlich getrennt und dann wieder verbunden, blieb beim nächsten Abschnitt der Generieren-Button gesperrt und „KI nicht erreichbar — Generierung derzeit nicht möglich." stehen — obwohl der Verbindungsstatus schon wieder „Verbunden" zeigte. Ursache ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)): Die Erreichbarkeit (`llmAvailable`) wurde **nur einmal beim Mount** passiv geprobt; `refreshVb` prüfte nur nach, solange der Wert noch `null` war — ein einmal gesetztes `false` erholte sich nie.

- Die Probe läuft jetzt in einem eigenen Effekt und greift erneut bei: **Wechsel des aktiven Abschnitts** (der vom Nutzer genannte „nächste Workflow-Schritt"), **Reconnect der Bridge** (`bridgeStatus` → verbunden, über den bestehenden Heartbeat-Store [bridge-status.ts](src/core/services/ai/bridge-status.ts) — erholt sich also auch **ohne** Navigieren, sobald „● KI" wieder grün ist) und **Ende einer Generierung** (u. a. nach Abbruch durch Trennung).
- Weiterhin **passiv** (`openIfNeeded: false`): kein ungefragtes Öffnen des KI-Tabs beim Navigieren, es wird nur ein bereits offenes Bridge-Fenster gepingt. Nicht während einer laufenden Generierung (single-window-Bridge, Pitfall #36) und nicht bei bereits freigegebenem Abschnitt. Die einmalige Mount-Probe entfällt (der neue Effekt deckt den Initialfall mit ab). Kein Schema-/Datenmodell-/Flag-Bump.

### v2.241.2 — „Thinking"-Schalter auch aus dem Alt-Kurzfassung-Pfad (Juli 2026)

PATCH — Folge-Aufräumen zu v2.241.1: Der `ThinkingControl`-Toggle war noch im **alten** Kurzfassung-Pfad ([ReviewCard.tsx](src/plugins/antraege/kurzfassung/ReviewCard.tsx) Anpassen-Zeile + [KurzfassungSection.tsx](src/plugins/antraege/kurzfassung/KurzfassungSection.tsx) Generieren-Panel) vorhanden. Dieser Pfad rendert nur bei `gutachtenWorkflow: false` (also in keinem Build mit aktiver Gutachten-Funktion — dev/pl/as haben den A–G-Workflow), war aber der Vollständigkeit halber auf Nutzer-Wunsch (Thomas) noch zu bereinigen.

- Toggle + jetzt ungenutzte `thinkingBudget`/`onSetThinkingBudget`-Props aus `ReviewCard`/`KurzfassungSection` entfernt (analog v2.241.1); die Generierung liest das Budget weiter aus der globalen Einstellung ([useKurzfassung.ts](src/plugins/antraege/kurzfassung/useKurzfassung.ts) unverändert).
- Die `ThinkingControl`-Komponente hat damit keinen Aufrufer mehr und ist gelöscht (`kurzfassung/ThinkingControl.tsx`). Kein Schema-/Datenmodell-/Flag-Bump.

### v2.241.1 — Gutachten-Werkstatt: „Thinking"-Schalter raus, „Kopieren" rein (Juli 2026)

PATCH — Zwei kleine UI-Anpassungen am Abschnitts-Review der Gutachten-Werkstatt (dev-Flag, [SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx) + [GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)):

- **„Thinking"-Schalter entfernt.** Der Toggle neben Neu/Kürzer/Länger (und im „…generieren"-Panel vor dem ersten Entwurf) hatte über die aktuell genutzte, Streamlit-basierte interne KI keine Wirkung — das Reasoning-Budget ist dort nicht per Request steuerbar. Der Schalter ist raus (samt jetzt ungenutzter `thinkingBudget`/`onSetThinkingBudget`-Props). Der `ThinkingControl`-Baustein blieb zunächst noch für die Alt-Kurzfassung bestehen (in v2.241.2 ebenfalls entfernt); das Budget speist die Generierung weiterhin aus der globalen KI-Assistent-Einstellung ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts) unverändert), nur der Pro-Lauf-Übersteuerungs-Knopf entfällt.
- **„Kopieren"-Icon ergänzt.** In der Aktionsleiste (Entwurf **und** freigegeben) kopiert ein Copy-Icon den Abschnitts-Text in die Zwischenablage — kopiert wird der kanonische `finalerText` (ohne Teil-Badge), rein lokal über `navigator.clipboard.writeText` (kein Netz/Transport). Kurzes Häkchen-Feedback wie beim Chat-`CopyButton`.

Kein Schema-/Datenmodell-/Flag-Bump; nur Anzeige/lokale Aktion.

### v2.241.0 — Förderanträge: Sortierung + Filter überleben den Seitenwechsel (Juli 2026)

MINOR — Auf der Förderanträge-Seite blieben Sortier-Reihenfolge und gesetzte Filter zwar innerhalb einer Sitzung erhalten, gingen aber beim Reload/Neu-Aufruf der Seite verloren. Auf Nutzer-Wunsch (Thomas) werden sie jetzt **im Browser gespeichert** und beim nächsten Aufruf wieder angewandt. (Sicht-Tab, Dropdown-Sortierung, Gruppierung, Ansichtsmodus und Spaltenbreiten wurden schon vorher persistiert — dies schließt die verbliebenen Lücken.)

- **Tabellen-Sortierung (Klick auf Spaltenkopf):** `useTableSort` ([useTableSort.ts](src/components/data-table/useTableSort.ts)) bekommt einen optionalen `storageKey`; die Antrags-Tabelle ([AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx)) übergibt `teamflow_antraege_table_sort`. Spalte + Richtung (inkl. Reset auf unsortiert) landen in localStorage. Bestands-Aufrufer ohne `storageKey` bleiben unverändert in-memory. Eine stale Spalte (Key existiert nicht mehr) ist harmlos — der bestehende `columns.find`-Guard fällt auf die unsortierte Reihenfolge zurück.
- **Filter (Status/Antragstyp + Sidebar-Facetten):** `useFilterState.active` wird jetzt **pro Programm** in localStorage gespiegelt (neuer Helfer [activeFilterPersistence.ts](src/plugins/antraege/filter/activeFilterPersistence.ts), Key `teamflow_antraege_active_filters`). `init` stellt beim Laden nur `filterId`s wieder her, die noch eine Definition haben (stale IDs nach CSV-/Filter-Umbau fallen still weg); `setActiveValue`/`clearFilter`/`clearAll`/`loadPreset` schreiben synchron durch.
- **PreCheck-Quickfilter:** der Store-Slot `precheckBucket` ([store.ts](src/plugins/antraege/store.ts)) persistiert nun ebenfalls (Key `teamflow_antraege_precheck_bucket`, validiert über `asPrecheckBucket`).
- Bewusst **nicht** persistiert (transient): der freie Suchtext (ein alter Suchstring beim Wiederkommen wäre überraschend), der Spaltenkopf-Werte-Filter der Tabelle (Drilldown innerhalb einer bereits gefilterten Sicht) und der Ampel-Quickfilter (kommt aus einem Widget-Klick, setzt sich beim Sicht-Wechsel bewusst zurück). Kein Schema-/Datenmodell-/Flag-Bump; alle Keys origin-weit, kein Share-/Snapshot-Write.

### v2.240.2 — Suche behält ihren vollen Assistenten (neben dem shell-weiten Panel) (Juli 2026)

PATCH — Seit das shell-weite **Assistent-Panel** (dev-Flag `assistentPanel`) den Assistenten auf jeder Seite anbietet, **ersetzte** es auf der Suchseite den bisherigen vollen Chat — samit dessen „+"-Menü (Datei-Anhänge, Antragsarchiv-Suche, Denkprozess-Toggle, System-Prompt) und dem Konversations-Verlauf. Auf Nutzer-Wunsch (Thomas) behält die **Suche jetzt wieder ihren vollen `ChatPanelHost`**; das schlanke Panel bleibt auf allen anderen Seiten.

- **Genau ein Panel pro Seite:** Das schlanke Dock wird in [ShellLayout.tsx](src/core/ShellLayout.tsx) nur noch gemountet, wenn die aktive Route **nicht** die Suche ist (`activeId !== 'suche'`) — kein Doppel-Panel. Die Suchseite ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx)) nutzt wieder unbedingt ihren lokalen `ChatPanelHost` (Button/Deep-Link/`?assistent=1` togglen den Voll-Chat, nicht das globale Dock).
- **Routen-bewusste Einstiegspunkte:** Command-Palette „Assistent öffnen" und `Strg+Umschalt+K` öffnen über den neuen `openAssistent`-Helfer auf der Suche den Voll-Chat (via `?assistent=1`), auf allen anderen Routen das schlanke Dock. Kein Schema-/Datenmodell-/Flag-Bump; der alte Chat-Code war nie entfernt, nur seitenspezifisch deaktiviert.

### v2.240.1 — Auslastungs-Widget: ein kombinierter Balken (aktuelles Quartal + Altanträge) (Juli 2026)

PATCH — Das Auslastungs-Widget zeigte zwei getrennte Balken (Belegung des Quartals + Altanträge). Auf Nutzer-Wunsch (Thomas) sind sie jetzt **ein** Balken, links→rechts nach Alter gestaffelt: ganz links die ältesten offenen Anträge (Q-3 bis 7, **dunkelste** Farbe), dann Q-2, dann Q-1, ganz rechts das **aktuelle Quartal** (**hellste** Farbe); der ungefüllte Rest rechts = frei. Die Zahl je Abschnitt (TVs) steht wie bisher im Segment, die Legende führt die vier Stufen (Aktuell · Q-1 · Q-2 · Q-3–7).

- Nur das Home-Widget ändert sich ([AuslastungWidget.tsx](src/plugins/home/widgets/AuslastungWidget.tsx), neuer lokaler `StapelBalken` über die reine Geometrie-Funktion `stapelSegmente` in [auslastungWidgetModel.ts](src/plugins/home/widgets/auslastungWidgetModel.ts)). Die zweigeteilte Cockpit-`GesamtauslastungBar` (MA-Tabelle/-Karte) bleibt unverändert.
- Die hellste „aktuelles Quartal"-Stufe nutzt die bereits in [theme.css](src/theme.css) definierten Tokens `--tf-altlast-band-akt(-text)` (Light + Dark, in Dark invertiert wie die übrigen Alters-Bänder). Kein Schema-/Datenmodell-Bump.

### v2.240.0 — Einstellungen: Startseiten-Widgets nach Spalte gruppiert (Juli 2026)

MINOR — Die Widget-Liste in Einstellungen › Darstellung bildete die **zwei Spalten** der Startseite bisher nicht ab: alle Widgets standen in einer flachen Liste, obwohl Haupt- und Seitenspalte je eine **eigene, unabhängige** Reihenfolge haben. Ein Hoch/Runter, das dabei über die Spaltengrenze sprang, war auf der Startseite folgenlos (die Homepage sortiert je Spalte) — verwirrend.

- **Zwei Gruppen:** Die Einstellungs-Liste ist jetzt in „Hauptspalte (breit, links)" und „Seitenspalte (schmal, rechts)" unterteilt — jede Gruppe eine eigene Positionsliste, die die tatsächliche Startseiten-Anordnung spiegelt ([WidgetsSettingsSection.tsx](src/plugins/einstellungen/WidgetsSettingsSection.tsx)).
- **Pfeile spaltengebunden:** `moveInstanz` tauscht die Position jetzt nur noch mit dem Nachbarn **derselben** Spalte (die andere Spalte bleibt unberührt); am Spalten-Anfang/-Ende ist der Pfeil deaktiviert ([homeWidgetsStore.ts](src/plugins/home/widgets/homeWidgetsStore.ts)). Datenmodell unverändert (globale `position` je Instanz + `bereich`), kein Schema-/Flag-Bump; bestehende Configs bleiben unverändert lesbar.

### v2.239.3 — Auslastungs-Widget: doppelte Prozentzahl im Kopf entfernt (Juli 2026)

PATCH — Im ausgeklappten Auslastungs-Widget stand die Belegungs-Prozentzahl doppelt: einmal im Zähler-Slot des Kopfes und einmal als „Belegt im Quartal … %"-Zeile im Body. Der Zähler-Slot war als Eingeklappt-Anzeige gedacht, blieb aber wegen des Lazy-Guards (eingeklappt wird über ~13k Anträge nichts berechnet) im eingeklappten Zustand leer und erschien nur ausgeklappt — dort doppelt. Der Zähler-Slot entfällt jetzt; die prominente, beschriftete Body-Zeile bleibt die einzige Quelle ([AuslastungWidget.tsx](src/plugins/home/widgets/AuslastungWidget.tsx)). Reiner Anzeige-Fix, keine Logikänderung.

### v2.239.2 — Auslastungs-Widget: lesbare Balken-Zahlen + Fußzeile entfernt (Juli 2026)

PATCH — zwei Feinschliffe am Auslastungs-Widget aus Nutzer-Feedback.

- **Zahlen in den Balken lesbar:** Die TVs je Altanträge-Band standen im Balken mit zu wenig Kontrast (v. a. weiße Zahl auf dem nur mittelhellen ältesten Band, ~2,5:1). Die Zahl-Farben der Bänder sind jetzt kontrastsicher (Light: durchgehend dunkle Zahl statt Weiß auf dem dunkelsten Band → ~5:1; Dark: hellere Zahl auf den dunklen Bändern, das hellste Band leicht abgedunkelt → ~4,6:1) — über die geteilten `--tf-altlast-band-*-text`-Tokens ([theme.css](src/theme.css), Fallbacks in [altlast-colors.ts](src/plugins/auslastung/views/uebersicht/altlast-colors.ts) + [MeineAntraegeBalken.tsx](src/plugins/home/MeineAntraegeBalken.tsx) mitgezogen; wirkt einheitlich in Widget-Balken, MA-Tabelle und Home-Rückstands-Balken).
- **Fußzeile entfernt:** Die untere Zeile mit „ggü. Vorquartal: Belegung ±N %" und dem „Zum Cockpit →"-Link ist entfallen — das Widget endet jetzt mit der Altanträge-Legende. Die damit obsolete Vergleichs-Berechnung (`vorherigesQuartal`-Vorquartalslauf) und das nur dafür genutzte, UI-lose Config-Feld `vergleichAnzeigen` wurden mit entfernt ([AuslastungWidget.tsx](src/plugins/home/widgets/AuslastungWidget.tsx), [types.ts](src/plugins/home/widgets/types.ts)). Bestehende gespeicherte Configs mit dem Alt-Feld bleiben lesbar (Feld wird ignoriert, keine Migration).

### v2.239.1 — Startseite: Notizen bleibt verschiebbar (Default unten statt Pin) (Juli 2026)

PATCH — Nachschärfung zu v2.239.0: Das Notizen-Widget war ans Spaltenende **gepinnt** — das machte das Verschieben in den Einstellungen wirkungslos. Jetzt ist „unten" nur noch der **Default**, das Widget bleibt per Pfeilen frei verschiebbar. Der harte Pin in der reinen `sichtbareWidgets` entfällt (Reihenfolge folgt wieder der konfigurierten Position); stattdessen hebt `reconcileVerfuegbareWidgets` eine vorhandene Notizen-Instanz beim Erst-Anlegen/Nachziehen **über** die neu angehängten Seiten-Widgets, damit ein später aktiviertes Widget (z. B. Auslastung) nicht darunter rutscht ([homeWidgetsStore.ts](src/plugins/home/widgets/homeWidgetsStore.ts)). Nur die Erst-Anlage/Reconcile ordnet um — spätere Pfeil-Bewegungen bleiben erhalten. Kein Schema-/Flag-Bump.

### v2.239.0 — Startseite: Widget-Feinschliff (Notizen unten, Auslastung kompakt, AI-Assistent schlanker) (Juli 2026)

MINOR — Bündel aus Nutzer-Feedback an den Home-Widgets. Additiv/lokal, kein Schema-/Flag-Bump.

- **Notizen immer unten rechts:** Das Notizen-Widget wird jetzt ans **Ende der Seitenspalte** gepinnt (unabhängig von der konfigurierten Position), damit die Schnell-Eingabe verlässlich unten sitzt — der Pin lebt in der reinen `sichtbareWidgets` ([homeWidgetsStore.ts](src/plugins/home/widgets/homeWidgetsStore.ts)), die Einstellungs-Positionsliste bleibt unberührt.
- **Auslastung standardmäßig eingeklappt + Zahlen im Balken:** Neues Katalog-Feld `defaultEingeklappt` ([widgetCatalog.ts](src/plugins/home/widgets/widgetCatalog.ts), nur bei Erst-Anlage/Reconcile, nie retroaktiv) → das Auslastungs-Widget startet eingeklappt (spart die schwere Aggregation, bis man es aufklappt). Der Altanträge-Balken zeigt die TVs je Band **im Segment** (wie die MA-Tabelle) — dazu ist der Balken höher (6 → 13 px); die Text-Legende trägt nur noch die Farb-Zuordnung, keine doppelten Zahlen ([GesamtauslastungBar.tsx](src/plugins/auslastung/views/uebersicht/GesamtauslastungBar.tsx) neues Opt-in-Prop `altlastZahlen`, andere Nutzer unverändert; [AuslastungWidget.tsx](src/plugins/home/widgets/AuslastungWidget.tsx)).
- **AI-Assistent-Widget schlanker:** Status und „Verbinden" sitzen jetzt auf **einer Zeile**; der „Chat öffnen →"-Link entfällt — der Assistent ist über das Dock-Icon rechts auf jeder Seite erreichbar ([AiAssistantCard.tsx](src/plugins/home/AiAssistantCard.tsx)).
- **Notizen-Hinweis verständlicher:** „Nur lokal · nie im Snapshot" → **„Nur lokal gespeichert, nie im Team Bereich"** ([NotizenWidget.tsx](src/plugins/home/widgets/NotizenWidget.tsx)).
- **Stift-Icon 1 px kleiner** auf den Karten (13 → 12 px, [WidgetQuickEdit.tsx](src/plugins/home/widgets/WidgetQuickEdit.tsx)).
- Ein-/Ausklapp-Zustände werden weiterhin **gerätelokal im Browser** gespeichert (IDB-Config, `setEingeklappt` → `saveHomeWidgets`) und best-effort ins persönliche Laufwerk gespiegelt — unverändert, hier nur bestätigt.

