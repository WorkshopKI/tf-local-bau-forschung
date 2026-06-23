# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

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

