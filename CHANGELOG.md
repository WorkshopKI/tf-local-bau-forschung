# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v2.275.0 — Startup-Freigabe: Wizard oben, weniger Mausweg und Klicks (Juli 2026)

MINOR — Das Browser-Popup zur Ordner-Freigabe erscheint oben am Bildschirm, die Wizard-Karte stand aber mittig: bei drei Ordnern pendelte der User sechsmal über die halbe Bildschirmhöhe. Echtes Auto-Abfragen aller Ordner ist browserseitig blockiert (Chromium verbraucht die User-Activation pro `requestPermission`) — also Weg verkürzen statt Schritte streichen.

- **Karte im Stepper-Zweig oben statt zentriert** (`items-start pt-[210px]`, direkt unter der Popup-Zone) plus fehlendes `overflow-y-auto` ([StartupScreen.tsx](src/core/StartupScreen.tsx)).
- **Auto-Fokus auf den Freigabe-Button ab Schritt 2** — nach „Zulassen" genügt Enter, kein Mausweg zurück ([GuidedGrantSteps.tsx](src/core/components/GuidedGrantSteps.tsx)).
- **Optimistische Auto-Kette**: nach einem Erfolg wird der nächste Ordner sofort probiert; in Chrome/`file://` folgenlos, in Browsern mit gebündelten Permissions spart es Klicks.
- **Stiller Fehlschlag wird nie als „abgelehnt" gebucht** (`ketteAbgebrochenOhnePrompt`, 300ms-Schwelle) — sonst wäre der Ordner dauerhaft übersprungen ([guided-grant-progress.ts](src/core/components/guided-grant-progress.ts)).
- Beide Zusätze in der Bug-Klasse dokumentiert; der erste Grant pro Klick bleibt bewusst unverändert ([recurring-bug-classes.md §2](docs/architecture/recurring-bug-classes.md)).

### v2.274.0 — KI-Variante wirkt jetzt auch im Chat (Juli 2026)

MINOR — Der Umschalter „Standard/Agentisch" war im Chat ein toter Schalter: der Chat bevorzugt `streamConversation`, und genau diese Methode sendete kein `ziel` — der Tab wurde nie gewechselt. Der Zweig, der die Präferenz durchreichte, war für die Bridge unerreichbar.

- **`ConversationOptions.ziel`** ergänzt und in `streamConversation` gesendet; ohne gesetztes Ziel fehlt das Feld weiterhin ganz ([streamlit.ts](src/core/services/ai/transports/streamlit.ts)).
- **Rein app-seitig**: das Snippet wertet `ziel` bei jedem `tf-request` aus — kein `BRIDGE_REV`-Bump, keine Neu-Installation des Lesezeichens.
- **Batch-Job übergibt `ziel`** wie alle anderen Runner — sonst rechnete er mit dem Kontext des einen Tabs und sendete an den anderen ([useBatchJob.ts](src/plugins/antraege/gutachten-batch/useBatchJob.ts)).
- Die überholte Begründung „`ConversationOptions` trägt bewusst kein `ziel`" im Bridge-Doc ersetzt statt ergänzt ([streamlit-bridge.md](docs/architecture/streamlit-bridge.md)).
- Regressionstest an der Naht, gegen den alten Stand als fehlschlagend verifiziert ([streamlit-ziel.test.ts](src/core/services/ai/__tests__/streamlit-ziel.test.ts)).

### v2.273.1 — Agentisches Kontextfenster 262k statt 260k (Juli 2026)

PATCH — Die Streamlit-Seite weist die Chatlänge selbst aus: „0k von 62k" bzw. „1k von 262k". Die im Repo verstreuten „260k" waren also gerundet bzw. falsch.

- **`BRIDGE_AGENTISCH_CONTEXT_TOKENS` 260.000 → 262.000**; alle „260k"-Labels in Eval-Panels und Docs mitgezogen ([llm-context.ts](src/core/services/ai/llm-context.ts)).
- Kommentar korrigiert: die Werte sind **nicht abfragbar**, aber sehr wohl sichtbar — sie stammen aus den llama.cpp-Konfigurationen hinter der Streamlit-App.
- **Ausbaupfad notiert**: das Bookmarklet scrapt die Seite ohnehin und könnte die Chatlänge mitmelden; kostet einen `BRIDGE_REV`-Bump ([streamlit-bridge.md](docs/architecture/streamlit-bridge.md)).

### v2.273.0 — Kontextfenster je KI-Variante (agentisch 260k) (Juli 2026)

MINOR — Der Cap kannte bisher nur EINEN Wert und ignorierte, wohin der Lauf geht. Über die Bridge galt ersatzweise der lokale llama.cpp-Default (81.920) — für den agentischen Qwen-Tab (260k) viel zu klein, für den Standard-Tab (62k) zu gross. Ergebnis: agentische Läufe wurden grundlos gekürzt, Standard-Läufe zu spät gewarnt.

- **`getVbCharCap(ziel)` / `getLlmContextTokens(ziel)`** unterscheiden Bridge-Tab und lokalen Server; Präzedenz manuell > Bridge-Tab > erkannt > Default ([llm-context.ts](src/core/services/ai/llm-context.ts)).
- **`istBridgeAktiv()`** an der Bridge + `kontextZielFuerLauf(bridge)` als einzige Ableitung ([bridge.ts](src/core/services/ai/bridge.ts), [ki-ziel.ts](src/core/services/ai/ki-ziel.ts)).
- **Alle Läufe und Warnhinweise** ziehen nach: Gutachten, Kurzfassung, NF, Batch, Aufbereitung, MAP, Upload-Dialoge ([useVbCharCap.ts](src/core/hooks/useVbCharCap.ts)).
- **Agentisch: ~767.700 statt ~233.500 Zeichen** — das Dreifache; eine übliche VB samt Zusatzdokumenten wird damit praktisch nicht mehr gekürzt.
- Die Einstellung „Kontextfenster" weist bei aktiver Bridge aus, dass dort die Tab-Werte gelten ([AIProviderTab.tsx](src/plugins/einstellungen/AIProviderTab.tsx)).

### v2.272.1 — Warnung bei zu grossem Dokumenten-Korpus (Juli 2026)

PATCH — Die Baustein-Schiene (`runBaustein`) umgeht `runSkill` und damit `capVbMarkdown`: sie kürzt nicht und warnt nicht. Die Upload-Warnung prüft jede Datei einzeln, nie ihre Summe. VB plus Marketingkonzept liefen deshalb ungekürzt und unbemerkt über das Kontextfenster — das Modell sah das Ende nicht.

- **`misseKorpus` als geteilte, reine Messung** neben `baueKorpus`; MAP und Aufbereitung nutzen dieselbe Definition ([quellen.ts](src/plugins/antraege/aufbereitung/quellen.ts)).
- **Warnung im Quellen-Panel** der Aufbereitung, bewusst ausserhalb der einklappbaren Sektion ([QuellenPanel.tsx](src/plugins/antraege/aufbereitung/QuellenPanel.tsx)).
- **`korpusMass` am Hook**, gesetzt beim Auflösen des Korpus ([useAufbereitung.ts](src/plugins/antraege/aufbereitung/useAufbereitung.ts)).
- Bewusst nur **messen, nicht kürzen**: eine stille Kürzung wäre der schlechtere Fehler und würde bestehende Ergebnisse verändern.

### v2.272.0 — MAP: Vorhabensbeschreibung aus mehreren Dateien (Juli 2026)

MINOR — Die Vorhabensbeschreibung ist bei diesen Anträgen fast nie eine Datei: Marktkonzept, Verwertung und Wirkung liegen meist als eigene PDFs bei. Der MAP hielt bisher genau ein Dokument. Nur dev (`mapFoerderfaehig`).

- **Hauptdokument plus beliebig viele Zusatzdokumente**; die Zuordnung trägt `zusatz` additiv, ältere Zuordnungen laden unverändert ([store.ts](src/plugins/map-foerderfaehig/store.ts)).
- **Korpus über die geteilte `baueKorpus`** der Aufbereitung statt eines zweiten Formats — ohne Zusatzdokument byte-identisch, Sektions-IDs des Hauptdokuments bleiben stabil ([korpus.ts](src/plugins/map-foerderfaehig/vb/korpus.ts)).
- **Steckbrief, Aspekte, Infografik, Lesemodus und Fundstellen lesen den Korpus**, nicht mehr das Hauptdokument allein ([useMapVb.ts](src/plugins/map-foerderfaehig/useMapVb.ts)).
- **Cap-Warnung über die Summe**: die Baustein-Schiene kürzt nicht und der Upload-Check prüft nur je Datei — ein zu grosser Korpus wird jetzt sichtbar gemeldet statt still abgeschnitten ([korpus.ts](src/plugins/map-foerderfaehig/vb/korpus.ts)).

### v2.271.1 — VB direkt im Reiter ablegen (MAP, dev) (Juli 2026)

PATCH — Der Reiter „Vorhabensbeschreibung" konnte bisher nur aus dem globalen Dokumenten-Index wählen. Wer die VB noch nicht aufgenommen hatte, sah eine Sackgasse und musste das Plugin verlassen. Nur dev (`mapFoerderfaehig`).

- **Aufnahmefläche direkt im Reiter** über die geteilte `DokumentAufnahme` — Drag & Drop, `offenHalten`, Typ vorbelegt auf „Vorhabensbeschreibung" ([VbPanel.tsx](src/plugins/map-foerderfaehig/components/VbPanel.tsx)).
- **Nachreichen bei bereits zugeordneter VB** über einen Umschalter neben „Zuordnung lösen" ([VbPanel.tsx](src/plugins/map-foerderfaehig/components/VbPanel.tsx)).
- Leerer Zustand verweist jetzt auf die Ablagefläche statt nur „keine Dokumente aufgenommen" zu melden.

### v2.271.0 — MAP: Testleitfaden, Architektur-Doku, Abnahme (Juli 2026)

MINOR — Abschluss des MAP: Drehbuch für die Vorführung, Architektur-Doku mit den tragenden Entscheidungen und ihren Begründungen, Abnahme über alle Build-Varianten. Nur dev (`mapFoerderfaehig`).

- **Testleitfaden** als 20-Minuten-Drehbuch mit Editor- und Schema-Moment; Ziel der Runde ist ausdrücklich Widerspruch, nicht Zustimmung ([map-testleitfaden.md](docs/map-testleitfaden.md)).
- **Architektur-Doku** hält fest, *warum* so entschieden wurde — Marker-Erkennung, fünf Status, Fundstellen ohne Orama — samt Ausbaupfaden ([map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md)).
- **Abnahme**: Flag nachweislich nur im dev-Bundle gesetzt, in prod/pl/as/kurator gar nicht vorhanden; `npm run check` grün, `build:dev` + `build:pl` gebaut.
- **CLAUDE.md-Ceiling 47.000 → 47.500** bewusst angehoben, nachdem der Eintrag auf zwei harte Regeln plus Themen-Doc-Link eingedampft war ([doc-links.test.ts](src/__tests__/doc-links.test.ts)).

### v2.270.0 — MAP: Canvas, SdT-Delta, Wirkungskette, Portfolio-Prinzipansicht (dev) (Juli 2026)

MINOR — Drei Ansichten machen das Vorhaben auf einen Blick prüfbar — und zeigen dabei vor allem, wo die Vorhabensbeschreibung nichts hergibt. Dazu eine Portfolio-Prinzipansicht mit erfundenen Demo-Daten. Nur dev (`mapFoerderfaehig`). Detail: [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md).

- **Ein Lauf für drei Ansichten** statt drei Läufen: Canvas-Texte, Delta-Zeilen und Wirkungsketten-Glieder kommen aus einem internen Extraktions-Skill, je VB-Hash gecacht ([map-infografik.seed.ts](src/core/services/skills/registry/map-infografik.seed.ts), [schema.ts](src/plugins/map-foerderfaehig/infografik/schema.ts)).
- **Lücken zeigen, nicht füllen**: eine Aussage ohne gültige Fundstelle gilt nie als belegt, erfundene Abschnitts-IDs werden verworfen, vage Felder erscheinen amber und gestrichelt ([schema.ts](src/plugins/map-foerderfaehig/infografik/schema.ts), [ProjektCanvas.tsx](src/plugins/map-foerderfaehig/components/ProjektCanvas.tsx)).
- **Richtwerte deterministisch** gegen die importierten Projektkosten; „nicht beziffert" wird ausdrücklich von „verfehlt" unterschieden ([richtwerte.ts](src/plugins/map-foerderfaehig/infografik/richtwerte.ts)).
- **Verdächtig-Guard**: eine formal gültige, inhaltlich leere Antwort wird nicht gecacht — sonst friert ein Fehlversuch die Ansicht dauerhaft ein ([useMapVb.ts](src/plugins/map-foerderfaehig/useMapVb.ts)).
- **Portfolio-Sunburst** aus fest verdrahteten Demo-Daten, hand-rolled SVG, dauerhaft gelabelt; die Ansicht liest bewusst nichts aus dem Store ([portfolio-demo.ts](src/plugins/map-foerderfaehig/infografik/portfolio-demo.ts)).

### v2.269.0 — MAP: Vorhabensbeschreibung, Steckbrief, Fundstellen, Reader Lite (dev) (Juli 2026)

MINOR — Die inhaltliche Seite der Prüfung: Vorhabensbeschreibung zuordnen, Steckbrief erzeugen, Abschnitte je Prüfaspekt lesen, Fundstellen an den Kriterien. Alle KI-Anteile sind optional und degradieren sichtbar. Nur dev (`mapFoerderfaehig`). Detail: [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md).

- **Zuordnung statt Automatik**: Kandidaten werden nach Akronym, Dateinamensmuster und Titelwörtern vorgeschlagen, bestätigt wird von Hand — ein falsch zugeordnetes Dokument stützte die ganze Prüfung auf den falschen Antrag ([zuordnung.ts](src/plugins/map-foerderfaehig/vb/zuordnung.ts)).
- **Steckbrief und Aspekt-Zuordnung** über die bestehenden Aufbereitungs-Bausteine, mit eigenem Cache-Präfix `map:<id>` gegen Kollisionen mit echten Anträgen ([useMapVb.ts](src/plugins/map-foerderfaehig/useMapVb.ts)).
- **Fundstellen deterministisch** über die Achse Kriterium → Prüfaspekt → VB-Sektion; Orama liefert weder Überschriftenpfad noch Antragsbezug und wird bewusst nicht genutzt ([fundstellen.ts](src/plugins/map-foerderfaehig/vb/fundstellen.ts)).
- **Reader Lite** mit sichtbarem „0 Fundstellen"-Zustand — ein Aspekt ohne Abschnitt ist selbst ein Befund ([ReaderLite.tsx](src/plugins/map-foerderfaehig/components/ReaderLite.tsx)).
- **Direkt-Importe statt Aufbereitungs-Barrel**: das Barrel zieht den PDF-Stack nach, den der MAP nicht braucht ([fundstellen.ts](src/plugins/map-foerderfaehig/vb/fundstellen.ts)).

### v2.268.0 — MAP: editierbare Checkliste, Pruef-Stepper, Abschluss-Entwuerfe (dev) (Juli 2026)

MINOR — Die Prüfung selbst kommt in die App: Kriterien aus der Papiervorlage, Bewertung durch den Menschen, Abschluss als kopierbarer Entwurf. Kern der Demo ist der Editor — ein fehlendes Kriterium lässt sich im Gespräch ergänzen, die Fassung zählt hoch. Nur dev (`mapFoerderfaehig`). Detail: [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md).

- **Seed wörtlich aus den Papier-Checklisten** (26 Kriterien, drei Skala-Kategorien mit den Ankertexten B0–B3); Ergänzungen der App tragen `herkunft: 'app'` und sind damit unterscheidbar ([seed.ts](src/plugins/map-foerderfaehig/checkliste/seed.ts)).
- **Fünf Status wie im Formular** (erfüllt / nicht erfüllt / n. z. / NF notw. / NF erfüllt) — bewusst abweichend vom Konzeptdokument: der Item-Verlauf macht so unterscheidbar, ob eine Nachforderung erledigt oder neu bewertet wurde ([typen.ts](src/plugins/map-foerderfaehig/checkliste/typen.ts)).
- **Drei Regeln an einer Stelle**: eine einzige B0-Stufe setzt die Punktzahl auf 0, bedingte Blöcke entfallen vollständig, „n. z." senkt die erreichbare Punktzahl ([bewertung.ts](src/plugins/map-foerderfaehig/checkliste/bewertung.ts)).
- **Editor mit Versions-Stempel**: jede Speicherung zählt die Fassung hoch; laufende Prüfungen bleiben auf ihrer Fassung, Bewertungen zu entfernten Kriterien bleiben erhalten ([editor.ts](src/plugins/map-foerderfaehig/checkliste/editor.ts), [verlauf.ts](src/plugins/map-foerderfaehig/checkliste/verlauf.ts)).
- **Abschluss ohne KI**: Gutachten, Nachforderung und Ablehnung deterministisch als Markdown; NF-Bausteine wortgetreu (Pitfall #34), ohne Treffer `[TODO Baustein zuordnen]` statt Erfundenem ([markdown.ts](src/plugins/map-foerderfaehig/abschluss/markdown.ts)).

### v2.267.0 — MAP Foerderfaehigkeit: Einreichungs-Import, Rechenchecks, Kompaktansicht (dev) (Juli 2026)

MINOR — Die Fachprüfung läuft heute über eine xlsx-Liste. Der MAP zieht sie in die App: Einreichungs-JSON per Drag & Drop, deterministische Rechenchecks, Kompaktansicht. Eigene kv-Entität ohne `Antrag`-Record — die CSV-/Antrags-Pipeline bleibt unberührt. Nur dev (`mapFoerderfaehig`). Detail: [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md).

- **PII-Absicherung zuerst**: alle Plattform-Rohexporte, die internen Prüf-DOCX und die MAP-Screenshots ignoriert — der Echtfall war untracked, aber *nicht* ignoriert; getrackt wird nur die gescrubbte, strukturgleiche Fixture ([.gitignore](.gitignore)).
- **Schema-Erkennung über diskriminierende Marker** statt über Pflichtfeld-Quoten: beide Generationen tragen die importrelevanten Felder auf identischen Pfaden, eine Quoten-Erkennung liefert immer Gleichstand ([schema-erkennung.ts](src/plugins/map-foerderfaehig/import/schema-erkennung.ts)).
- **Alias-Ketten je Zielfeld** als Drift-Puffer; der Import-Report weist jeden gegriffenen Alias, jedes fehlende Pflichtfeld und jeden nicht ausgewerteten Bereich aus ([adapter.ts](src/plugins/map-foerderfaehig/import/adapter.ts)).
- **Datenschutz als Pfad-Präfix-Deny-Liste + Nachweis-Scan** über das Ergebnis; übernommen werden nur PM-Summen und Personalnummer/N.N. ([redaktion.ts](src/plugins/map-foerderfaehig/import/redaktion.ts)).
- **Fünf Rechenchecks** und die Kompaktansicht (Eckdaten, Gantt über die geteilte `GanttAchse`, Kostenbalken über `DistributionBar`) ([rechenchecks.ts](src/plugins/map-foerderfaehig/import/rechenchecks.ts), [KompaktAnsicht.tsx](src/plugins/map-foerderfaehig/components/KompaktAnsicht.tsx)).

### v2.266.0 — Aufbereitung: Zeitplan pausiert, Zahlen auf prüfrelevante Bereiche fokussiert (Juli 2026)

MINOR — Der Zeitplan liest die Arbeitspakete aus den PDF-Quellen zu unzuverlässig; er wird pausiert, bis der Antrag als JSON vorliegt. Das Zahlen-Inventar liefert außerhalb von „Leistung & Technik" + „Markt & Absatz" sehr viele nicht prüfrelevante Werte. Beides ist ein reines Anzeige-Gate (keine Migration, kein Cache-Verlust), nur dev (`antragAufbereitung`). Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

- **Pause an einer Stelle**: `ZEITPLAN_PAUSIERT` + `ZAHL_KATEGORIEN_PRUEFRELEVANT` als einzige Rücknahme-Stelle, import-frei ([pausierte-module.ts](src/plugins/antraege/aufbereitung/pausierte-module.ts)).
- **Zeitplan-Tab dauerhaft inaktiv** mit Grund im Tooltip — Check vor der activeTab-Ausnahme ([tab-gating.ts](src/plugins/antraege/aufbereitung/tab-gating.ts)).
- **Übersicht ohne „Zeitplan öffnen"**: der Einstieg wäre sonst ein Umgehungsweg an der gesperrten Tab-Leiste vorbei ([UebersichtTab.tsx](src/plugins/antraege/aufbereitung/UebersichtTab.tsx)).
- **Zahlen-Tab**: nicht prüfrelevante Kategorien ausgegraut + zugeklappt (Zähler sichtbar, Claims aufklappbar) ([ZahlenTab.tsx](src/plugins/antraege/aufbereitung/ZahlenTab.tsx)).
- **Zahlen-Widersprüche pausiert** (Gate an den Konsumenten, reine `pruefeZahlWidersprueche` bleibt intakt + getestet) ([ZahlenTab.tsx](src/plugins/antraege/aufbereitung/ZahlenTab.tsx), [fragen.ts](src/plugins/antraege/aufbereitung/fragen.ts)).
- **Alle Zeitplan-Befunde stumm**: auch die deterministischen Zeitplan-/Kapazitäts-Befunde (`run.befunde`) schweigen im Fragen- und Abdeckungs-Tab, solange der Zeitplan pausiert ist — geteilter `sichtbareZeitplanBefunde`-Helper ([pausierte-module.ts](src/plugins/antraege/aufbereitung/pausierte-module.ts), [AbdeckungTab.tsx](src/plugins/antraege/aufbereitung/AbdeckungTab.tsx)).

### v2.265.3 — Assistenten-Spine: Icon monochrom & dezent (Juli 2026)

PATCH — Feinschliff nach v2.265.2: die türkise Primär-Kachel war für den ruhigen Spine-Streifen zu präsent. Nur dev (`assistentPanel`).

- **Icon monochrom & dezent**: Primär-Badge-Füllung entfernt, Sparkles-Glyph im gedämpften `--tf-text-secondary` (Hover → `--tf-text`), abgestimmt aufs vertikale Label ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)).

### v2.265.2 — Assistenten-Spine: Icon-Kachel 2px kleiner (18px) (Juli 2026)

PATCH — Feinschliff nach v2.265.1: die Primär-Badge-Kachel in der schmalen Spine war einen Tick zu prominent. Nur dev (`assistentPanel`).

- **Icon-Kachel 20px → 18px** in der Dock-Spine ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)); Sparkles-Glyph unverändert.

### v2.265.1 — Assistenten-Spine schmal (28px) + sichtbar bei offenem Panel (Juli 2026)

PATCH — Nachgezogener Design-Handoff für die rechte Assistenten-Spalte: die dauerhafte Dock-Spine wird von 48px auf 28px verschlankt und trägt statt eines Hover-Tooltips ein dauerhaft sichtbares vertikales „ASSISTENT"-Label. Zusätzlich bleibt die Spine jetzt bei offenem Panel stehen (Panel als Overlay daneben). Nur dev (`assistentPanel`).

- **Schmale 28px-Spine** mit Mini-Primär-Badge + vertikalem Label (kein Tooltip); Breite als Single-Source `SPINE_WIDTH` ([panelUiStore.ts](src/plugins/chat/assistent/panelUiStore.ts), [AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)).
- **Spine bleibt bei offenem Panel sichtbar** und togglet; das Panel öffnet als Overlay links daneben (`right: SPINE_WIDTH`) statt bündig-rechts — breite Tabellen behalten ihre Breite ([AssistentPanelHost.tsx](src/plugins/chat/assistent/AssistentPanelHost.tsx)).
- **Reservierter `<main>`-Rand** zieht auf `SPINE_WIDTH` nach ([ShellLayout.tsx](src/core/ShellLayout.tsx)); Doku: [assistent-panel.md](docs/architecture/assistent-panel.md) (Dock-Form).

### v2.265.0 — In-App-Eval: Kontext-Achse (Relevanz-Map A/B) + interner Judge (Juli 2026)

MINOR — Die Relevanz-Map (kuratierter VB-Kontext statt Volltext) war produktiv verdrahtet, aber schlafend und nur in der Node-CLI messbar. Der Bridge-Rechner (gpt-oss) hat kein Node → das A/B (hält „relevant" die Gutachten-Qualität?) braucht ein In-App-Vehikel. Phase 0: nur das Mess-Panel; die kuratierte Umstellung folgt separat nach dem Nutzer-A/B. Nur dev.

- **Kontext-Achse** `voll · relevant · beide` im Skill-Eval-Panel: der `relevant`-Arm rechnet die Relevanz-Map je Fixture (Reuse `computeRelevanzMap`/`assembleVbRelevant`, kein Fork) + Schwellen-Override (nur Eval) ([eval-batch.ts](src/core/services/skill-eval/eval-batch.ts), [SkillEvalPanel.tsx](src/plugins/skill-verwaltung-kuration/SkillEvalPanel.tsx)).
- **Ehrlichkeits-Pflicht**: „Map angewandt: n/m" + Kontextgröße voll→relevant je Fixture; 0/m wird als „beide Arme identisch, kein A/B" markiert (`relevanzInfos`).
- **Judge Default intern-agentisch (Qwen)** über einen Adapter (frischer Chat + `ziel:'agentisch'` + Thinking-Strip, hält `runJudge` unangetastet); OpenRouter nur noch als gespiegelte Alternative hinter `isOpenRouterEnabled()`; „Judge einschließen"-Schalter (Default aus), `judgeModellId`-Tag.
- **JSONL-Export** (CLI-feldkompatibel, `kontext`-Tag) + Ergebnis-Matrix mit Kontext-Spalte + Δ (relevant − voll).
- Tests: `both`-Arme, Schwellen-No-op, Map angewandt (< Volltext), Map-Fehler → Volltext-Degradation, Adapter (Reset + `ziel` + `<think>`-Strip). Doku: [skill-eval-gui.md](docs/architecture/skill-eval-gui.md).

### v2.264.0 — Antrag-Aufbereitung: Lesemodus-Silhouette-Nav + Fundstellen-Overlay + Doku (dev) (Juli 2026)

MINOR — Paket 5, Phase 5 (Abschluss): Der Lesemodus wird von „Gliederung + Text" zu einer echten Navigation — schmale Silhouette als Scroll-Navigation (aktueller Abschnitt hervorgehoben) + Marginalien-Marker, die je Abschnitt zeigen, welche Bausteine ihn referenzieren. Nur dev.

- **Silhouette-Scroll-Nav** im Lesemodus: proportionale Ebene-1-Blöcke, aktueller Viewport-Abschnitt via `IntersectionObserver` hervorgehoben, Klick scrollt hin ([LesemodusSilhouette.tsx](src/plugins/antraege/aufbereitung/LesemodusSilhouette.tsx)); Massen-Kern geteilt mit der Abdeckungs-Silhouette ([silhouette-core.ts](src/plugins/antraege/aufbereitung/silhouette-core.ts), behavior-preserving refaktoriert).
- **Fundstellen-Overlay**: deterministische Aggregation (Abdeckung/Steckbrief/Zahlen/Verwertung/Glossar je Sektion) → Zähler-Marker + Popover ([lesemodus-fundstellen.ts](src/plugins/antraege/aufbereitung/lesemodus-fundstellen.ts) + [LesemodusTab.tsx](src/plugins/antraege/aufbereitung/LesemodusTab.tsx)).
- **Doku**: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) um Paket 5 (Cockpit, DR-Fluss + DSGVO, externe Schicht, Zahlen-Relevanz, Zeitplan-Degradation, Lesemodus) erweitert.
- Tests: Fundstellen-Aggregation (mehrere Bausteine, fremde IDs, leer, Kürzung).

### v2.263.0 — Antrag-Aufbereitung: Zahlen straffen + Zeitplan ehrlich degradieren (dev) (Juli 2026)

MINOR — Paket 5, Phase 4. Prüfer-Feedback „zu viele Zahlen": Prompt auf prüfrelevante Auswahl geschärft + neues Claim-Feld `relevanz` (kern/detail) → UI-Filter „Kernzahlen" (Default). Zeitplan: eine unsicher ausgelesene Anlage 5 (PDF-Tabelle zerfallen) täuschte per Gantt Vollständigkeit vor — jetzt ehrlich „nicht auslesbar" + Roh-Tabellen statt Diagramm. Nur dev.

- **Zahlen-Prompt geschärft** (erwünscht/unerwünscht) + optionales `relevanz` (Parser tolerant, fehlend→`detail`, alte Caches gültig) ([zahlen.ts](src/plugins/antraege/aufbereitung/zahlen.ts)).
- **ZahlenTab-Filter** „Kernzahlen"/„Alle" (ScopeTabs) + Zähler „X von Y angezeigt" + Kategorie-Gruppen bei >8 eingeklappt ([ZahlenTab.tsx](src/plugins/antraege/aufbereitung/ZahlenTab.tsx)).
- **Zeitplan-Degradation**: `zeitplanUnsicher` (0 AP-Zeilen ODER >50 % ohne Laufzeit-Spanne) → kein Gantt, Hinweis + Roh-Tabellen ([Rohtabellen.tsx](src/plugins/antraege/aufbereitung/Rohtabellen.tsx) via `MarkdownRenderer`); Ghost-Toggle „Rohtabellen anzeigen" auch bei gelungener Extraktion ([zeitplan-qualitaet.ts](src/plugins/antraege/aufbereitung/zeitplan-qualitaet.ts), Solo + Verbund).
- **Keine Seed-Migration nötig**: der Zahlen-Prompt lebt in `buildZahlenPrompt` (Code), nicht im Seed-`promptTemplate` — die Änderung deployt mit dem Build.
- Tests: `zeitplanUnsicher`/`tabelleAlsMarkdown`, `relevanz`-Parse (fehlend→detail).

### v2.262.0 — Antrag-Aufbereitung: Verwertung/Markt gegen externe Schicht spiegeln (dev) (Juli 2026)

MINOR — Paket 5, Phase 3: Der Verwertung/Markt-Tab stellt je Kategorie „Laut Antrag" den importierten externen Aussagen („Extern · nicht verifiziert") gegenüber. Zuordnung ausschließlich über die geteilte Kategorie — KEIN Fuzzy-Matching, KEINE automatische Widerspruchs-Wertung; der Prüfer vergleicht selbst. Nur dev.

- **Reine Gegenüberstellung** `gruppiereVergleich` (Kategorie-Gruppierung; `sdt` bleibt draußen) ([verwertung-vergleich.ts](src/plugins/antraege/aufbereitung/verwertung-vergleich.ts)).
- **VerwertungTab zwei Spalten** je Kategorie (Antrag mit Fundstelle · extern mit Quellen-Link + „nicht verifiziert"); Leer-Hinweis mit Link auf den Recherche-Tab ([VerwertungTab.tsx](src/plugins/antraege/aufbereitung/VerwertungTab.tsx)).
- Tests: Kategorie-Gruppierung, leere Schicht, nur-extern-Kategorie, mehrere Importe, `sdt`-Ausschluss.

### v2.261.0 — Antrag-Aufbereitung: DR-Rückweg (Import JSON/Datei/Rohtext) (dev) (Juli 2026)

MINOR — Paket 5, Phase 2: Deep-Research-Ergebnisse kommen von außen zurück in die App (Report-Text, PDF oder Word — kein verlässliches JSON). Toleranter Import: enthaltener JSON-Block direkt → sonst interner Strukturierungs-Lauf → sonst Rohtext. Als dritte Wissensschicht „extern · nicht verifiziert". Externe Quellen bleiben strikt aus dem VB-Korpus. Nur dev.

- **Run-Erweiterung** `extern?: ExterneRecherche[]` (additiv, alte Runs ladbar) + geteiltes DR-JSON-Schema/Parser ([types.ts](src/plugins/antraege/aufbereitung/types.ts) + [recherche-schema.ts](src/plugins/antraege/aufbereitung/recherche-schema.ts)).
- **Import-Pfade** (Text einfügen / PDF-Word-Upload via bestehendem `DocConverter`) + toleranter Orchestrator ([recherche-import.ts](src/plugins/antraege/aufbereitung/recherche-import.ts)); Recherche-Tab „Ergebnis zurückbringen" mit Import-Liste (löschbar, SdT-Aussagen inline) ([RechercheTab.tsx](src/plugins/antraege/aufbereitung/RechercheTab.tsx)).
- **Interner Strukturierungs-Lauf** (`aufbereitung-recherche-import`, `aktiv:false`) über den neuen intern-pflichtigen Slot `{{externText}}` ([INHALTS_SLOTS](src/core/services/ai/transport-policy.ts)); Cache über den Hash des externen Texts.
- **Keine Korpus-Vermischung**: externe Dokumente werden NUR als Text extrahiert (kein Korpus-Tag, keine Indexierung, kein `vbHash`-Einfluss).
- Tests: Parser-Matrix + Import-Orchestrierung + Run-Kompatibilität alt→neu.

### v2.260.0 — Antrag-Aufbereitung: Deep-Research-Prompt + Recherche-Tab-Umbau (dev) (Juli 2026)

MINOR — Paket 5, Phase 1: Der Prüfer lässt sich als ALLERERSTES einen anonymen Deep-Research-Auftrag von der internen KI erzeugen und trägt ihn per Zwischenablage in ChatGPT/Claude/Mistral (5–10 Min externe Recherche parallel zur internen Aufbereitung). DSGVO: Anonymisierungs-Constraints im Skill + deterministischer Leak-Check + Pflicht-Review. Nur dev.

- **Neuer DR-Prompt-Baustein** (`aktiv:false`, agentische Variante + Standard-Fallback), läuft zuerst; erzeugt den anonymen Auftrag ([recherche-prompt.ts](src/plugins/antraege/aufbereitung/recherche-prompt.ts) + [aufbereitung-recherche-prompt.seed.ts](src/core/services/skills/registry/aufbereitung-recherche-prompt.seed.ts)).
- **Deterministischer Leak-Check** vor dem Kopieren: erzeugter Prompt case-insensitiv gegen Stammdaten (Name/FKZ/Az/Titel/Namensbestandteile ≥4); Treffer → degradiert, nur einsehbar ([recherche-leak.ts](src/plugins/antraege/aufbereitung/recherche-leak.ts)).
- **Recherche-Tab umgebaut**: „Deep Research starten" (Review-Hinweis + Kopieren-&-Öffnen), „Marktzugang des KMU" (kurator-gated, Default AUS, identifizierend/deterministisch), Import-Platzhalter, Einzel-Suchanfragen eingeklappt ([RechercheTab.tsx](src/plugins/antraege/aufbereitung/RechercheTab.tsx)).
- **Kurator-Config** (DR-Ziel-URLs + Marktzugang-Schalter) team-weit auf dem Share ([aufbereitung-settings.ts](src/plugins/antraege/aufbereitung/aufbereitung-settings.ts) + [AufbereitungRechercheSettings.tsx](src/plugins/antraege/aufbereitung/AufbereitungRechercheSettings.tsx)); agentische Variante pro Baustein durchgereicht ([bausteine.ts](src/plugins/antraege/aufbereitung/bausteine.ts)).
- Detail: [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) (folgt in Phase 5).

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

