# Gutachten-Kurzfassung — Testballon (erster „Mini-Agent")

Auf der **Verbund**-Detailseite erstellt ein Gutachter KI-gestützt die **Kurzfassung** eines ZIM-Gutachtens — kompletter Durchstich von der Dokumenten-Aufnahme bis zur ausgefüllten Word-Vorlage. Der Durchstich validiert vier Bausteine, die später generalisiert werden (Skill-Registry, Workflow-Runner). Hinter Feature-Flag `gutachtenKurzfassung` (**nur dev** + `npm run dev`; demo/prod/kurator/pl = false). Eingeführt v2.68.0, re-leveled auf Verbund-Ebene v2.68.2, FKZ-Erkennung v2.68.3.

## Leitprinzip: LLM ist optional

LLM-Verfügbarkeit in Produktion ist nahe null und nie garantiert. **Bausteine 1, 3 und 4 funktionieren vollständig OHNE LLM**; nur Baustein 2 (Generierung) braucht einen Transport und degradiert mit klarer Meldung („KI nicht erreichbar — Generierung derzeit nicht möglich"), wenn keiner erreichbar ist. Aufnahmefläche, ein bereits freigegebener Stand und der Vorlagen-Dialog bleiben jederzeit nutzbar.

## Ebene: Verbund, nicht Teilvorhaben

Ein Gutachten / eine Kurzfassung wird pro **Verbund** erstellt — die Vorhabensbeschreibung (VB / Projektbeschreibung) existiert nur **einmal pro Verbund**. Im Gutachten werden trotzdem TV-Infos (Titel, Antragsteller) aufgelistet; sie fließen in den Skill-Prompt ein.

- Die Sektion sitzt in [VerbundDetail.tsx](../../src/plugins/antraege/VerbundDetail.tsx) **oberhalb** der Felder-Liste (`VerbundAlleFelder`), nicht in `TvDetailBlock`.
- **Key** (Persistenz + VB-Relations-Tag) = die **Verbund-ID** (`verbund.verbund_id`), bei Solo-/Pseudo-Verbünden das echte Aktenzeichen (`aktenzeichenFromPseudoVerbundId`).
- Der Kontext wird in `VerbundDetail` als [`KurzfassungContext`](../../src/plugins/antraege/kurzfassung/types.ts) gebaut: `key`, `akronym`, `titel`, `antragsteller` (Konsortialführer), `foerderkennzeichen` (= Verbund-ID), `knownIds` (Verbund-ID + alle TV-Aktenzeichen), `teilvorhaben[]`.

## Datenfluss (end-to-end)

```
VB ablegen (Aufnahme)  →  „Kurzfassung erstellen" (Skill)  →  Prüfen/Kürzer/Länger  →  Freigeben  →  Gutachten-Vorlage erstellen (DOCX)
Baustein 1 (kein LLM)     Baustein 2 (LLM)                    Baustein 2/3            Baustein 3   Baustein 4 (kein LLM)
```

## Baustein 1 — Dokumenten-Aufnahmefläche

Wiederverwendbare Komponente [src/core/components/DokumentAufnahme.tsx](../../src/core/components/DokumentAufnahme.tsx) (Props: `relationTag`, `knownIds`, `onIngested?`).

- Drag&Drop + Dateiauswahl (PDF/DOCX, Mehrfach) über die kanonische `FileDropZone` aus `@/ui`.
- **Zuordnung** rein über eine **Tag-Relation** im Dokumente-Store — **kein** Schreiben in den CSV-`Antrag`-Record (siehe Pitfall #29). Pro Datei: `new DocConverter().convert(file)` → `useDokumenteStore.add({ tags:[relationTag, typ], source:'upload' })` → `indexDocument({ tags:[relationTag, typ] })`. `relationTag` = Verbund-ID.
- **FKZ-Erkennung** (pure, testbar) in [dokumentAufnahmeFkz.ts](../../src/core/components/dokumentAufnahmeFkz.ts): `classifyFkz(filename, knownIds)` → `match | ambig`. Eine Datei „gehört hierher", wenn ihr Dateiname (normalisiert) **irgendeine** bekannte Kennung enthält — **Verbund-FKZ ODER ein TV-FKZ** (Substring-Match, fängt auch Verbund-IDs wie `ZEP…`, die der 16XX-`extractFkz` nicht kennt). Hintergrund: dieselbe Projektbeschreibung wird oft je TV mit eigenem FKZ eingereicht; TV-spezifische Dateien (z.B. Nachlieferungen) tragen das TV-FKZ.
- **Uneindeutig (`ambig`) → der Bearbeiter ordnet zu** per Klick („Diesem Verbund zuordnen" / „Verwerfen") statt ein FKZ zu tippen. Prinzip „lieber entscheiden lassen als falsch raten".
- Typ-Pills pro Datei: Vorhabensbeschreibung / Teilvorhabensbeschreibung / Stellungnahme / Sonstiges (Werte additiv in `AntragDokumentTyp`, [csv/types.ts](../../src/core/services/csv/types.ts)). Pill-Wechsel re-tagged das Dokument (`updateTags`).
- WIEDERVERWENDET: `extractFkz` ([phase2/matcher/fkz-extractor.ts](../../src/phase2/matcher/fkz-extractor.ts)), `DocConverter` ([converter/index.ts](../../src/core/services/converter/index.ts), Main-Thread), `useDokumenteStore.add` (gibt seit v2.68 die Doc-ID zurück), `indexDocument` ([useSearch.ts](../../src/core/hooks/useSearch.ts)).

## Baustein 2 — Skill (Datenstruktur + deterministische Checks)

[src/core/services/skills/](../../src/core/services/skills/) — bewusst „static data over logic", Registry-ready.

- [`SkillDefinition`](../../src/core/services/skills/types.ts): `id`, `name`, `version`, `systemPrompt`, `promptTemplate` (mit `{{stammdaten}}`/`{{vbMarkdown}}`-Slots), `modifiers` (`neu`/`kuerzer`/`laenger`), `runChecks`, `parse`, `maxTokens`. Konkrete Definition: [kurzfassung-skill.ts](../../src/core/services/skills/kurzfassung-skill.ts) (deutscher ZIM-Kontrakt, drei `###`-Ausgabeteile Quellenanalyse/Entwurf/Finaler Text).
- `parseSkillOutput(raw)`: zerlegt an den `###`-Überschriften; tolerant gegenüber fehlendem Entwurf; unparsebar → alles als `finalerText` + `warnung`.
- **Deterministische Checks** ([checks.ts](../../src/core/services/skills/checks.ts), KEIN LLM): `satzanzahl` (8–12, Abkürzungs-tolerante Satzgrenzen-Heuristik), `keineAufzaehlungen`, `passivStil` (Hinweis mit Satz-Nr.). Ergebnis-Typ `CheckResult { level: 'ok'|'hinweis'|'fehler', label, detail? }`.
- **Runner** ([run-skill.ts](../../src/core/services/skills/run-skill.ts)): transport-agnostisch. Baut die Messages (System-Rolle + gefülltes Template + ggf. Modifier-Instruktion + vorheriger finaler Text), kappt VB-Markdown am Absatzende (`VB_CHAR_CAP` ~24.000), fährt die bestehende **Transport-Ladder** (`submitConversation?` → `submitMessage`, non-streaming genügt) via `bridge.getActiveTransport()` ([useChatController.ts](../../src/plugins/chat/useChatController.ts) als Nutzungsmuster), reicht `AbortSignal` durch. **Keine modell-spezifische Sonderlogik.**

## Baustein 3 — Review-/Freigabe-UI + Persistenz

[src/plugins/antraege/kurzfassung/](../../src/plugins/antraege/kurzfassung/):

- [`useKurzfassung(ctx)`](../../src/plugins/antraege/kurzfassung/useKurzfassung.ts) — Orchestrator: lädt Record + VB-Status, probt LLM-Verfügbarkeit (`transport.ping()`, lazy), Aktionen `generate/modify/pruefen/freigeben/verwerfen/stop/refreshVb`. Alle self-catching (Fehler → `error`-Banner, Pitfall #15). **Persist nach jedem Statuswechsel, NIE während der Generierung.**
- [`KurzfassungSection`](../../src/plugins/antraege/kurzfassung/KurzfassungSection.tsx) (Zustände VB-fehlt / VB-vorhanden / Review), [`ReviewCard`](../../src/plugins/antraege/kurzfassung/ReviewCard.tsx) (Quellenanalyse-Collapsible, finaler Text + Meta, Aktionsleiste Freigeben/Neu/Kürzer/Länger/Prüfen), [`CheckList`](../../src/plugins/antraege/kurzfassung/CheckList.tsx).
- **VB-Lookup**: [`findVorhabensbeschreibung(idb, key)`](../../src/plugins/antraege/kurzfassung/vbDokument.ts) scannt `doc:*` nach `tags.includes(key) && tags.includes('vorhabensbeschreibung')` (ok bei wenigen Uploads; Generalisierung → Tag-Index).
- **Persistenz** ([kurzfassung-store.ts](../../src/plugins/antraege/kurzfassung/kurzfassung-store.ts)): `KurzfassungRecord` (Output-Teile, `checks`, `status` entwurf/freigegeben, Zeitstempel, `modell`) im generischen `kv`-Store unter `gutachten-kurzfassung:<verbund-key>` — **bewusst KEIN dedizierter Object-Store/`version`-Bump** (analog `doc:*`; ein Bump triggert unter `file://` mit parallel offenen Varianten ein `onblocked`-Upgrade, siehe [recurring-bug-classes.md](recurring-bug-classes.md)).

## Baustein 4 — Vorlagen-Verzeichnis + DOCX-Füller

[src/core/services/gutachten-vorlagen/](../../src/core/services/gutachten-vorlagen/) — **keine neue Dependency** (vorhandenes `jszip`).

- **Vorlagen-Quelle** ([vorlagen-quelle.ts](../../src/core/services/gutachten-vorlagen/vorlagen-quelle.ts)): eigener, schlanker Verzeichnis-Handle in eigenem IDB-Slot (`gutachten-vorlagen-dir`) — **NICHT** in `dms-sources` gemischt. Nur lesend; Vorlagen werden bei Dialog-Öffnung LIVE gelistet (`.docx` + `lastModified`), nie gecacht.
- **Feld-Mapping** ([field-mapping.ts](../../src/core/services/gutachten-vorlagen/field-mapping.ts)): statische Tabelle Code → Wert (`VMS VB Projekt`→Titel, `VMS AD FKZ`→Verbund-FKZ, `ADA.FD.Langname`→Konsortialführer). Unbekannte `&F:…&`/`&C:…&`-Codes bleiben unverändert + werden als „nicht befüllbar" zurückgemeldet.
- **Füller** ([fill-template.ts](../../src/core/services/gutachten-vorlagen/fill-template.ts)): verarbeitet `word/document.xml` als **String** (kein DOM/XML-Lib). Kern ist die pure, vollständig getestete `processDocumentXml(xml, antrag, finalerText)`:
  - **Run-Splitting**: pro `<w:p>` die `<w:t>`-Texte konkatenieren, Platzhalter dort suchen, Wert in den ERSTEN beteiligten Run injizieren, Platzhalter-Zeichen über alle beteiligten Runs entfernen — `<w:rPr>` unangetastet. Akzeptiert `&`- UND `&amp;`-Delimiter (Word escaped `&` → `&amp;`), robust gegen Splits an beliebiger Stelle.
  - **Anker**: Absatz „Kurzfassung der Projektbeschreibung" (whitespace-tolerant auf konkateniertem Text) → finaler Text als neue `<w:p>` direkt danach. Anker fehlt → Warnung, Vorlage trotzdem erstellbar.
  - **Dry-Run-Modus** (nur Analyse, kein Blob) für die Mapping-/Anker-Vorschau im Dialog.
- **Ablage** ([save-docx.ts](../../src/core/services/gutachten-vorlagen/save-docx.ts)): `ZAH/gutachten/Gutachten_EP_<verbund-fkz>.docx` via `atomicWrite(..., { skipBackup: true })` im persönlichen Ordner; Fallback Browser-Download, wenn kein Personal-Handle.
- **Dialog** [`VorlageDialog`](../../src/plugins/antraege/kurzfassung/VorlageDialog.tsx): Vorlagen-Liste, Feld-Mapping-Statustabelle (Dry-Run-Ist-Werte), Anker-Status, Erstellen/Abbrechen, Erfolgs-Zustand.

## Persistenz-Keys & Tags (Übersicht)

| Was | Wo | Key/Tag |
|-----|-----|---------|
| Kurzfassung-Record | `kv`-Store | `gutachten-kurzfassung:<verbund-key>` |
| Aufgenommenes Dokument | `kv`-Store (Dokumente) | `doc:<uuid>`, `tags:[<verbund-key>, <typ>]` |
| Vorlagen-Verzeichnis-Handle | `kv`-Store | `gutachten-vorlagen-dir` |
| Fertige DOCX | Persönlicher Ordner | `ZAH/gutachten/Gutachten_EP_<verbund-fkz>.docx` |

## Feature-Flag & Einbindung

- Flag `gutachtenKurzfassung` (optional, default false via `=== true`): [config-schema.mjs](../../scripts/config-schema.mjs) (`DEFAULT_CONFIG.features`, NICHT in `requiredFlags`), [runtime-config.ts](../../src/config/runtime-config.ts) (`TeamflowFeatures`), [feature-flags.ts](../../src/config/feature-flags.ts) (`isGutachtenKurzfassungEnabled()`), in allen `configs/*` explizit gesetzt (dev = true, sonst false).
- Kein neues Plugin / kein Routing — die Sektion ist in `VerbundDetail` eingebettet und per `isGutachtenKurzfassungEnabled()` gegated.

## Generalisierung (vorbereitet, NICHT umgesetzt)

- `SkillDefinition` + `runSkill` sind transport-agnostisch und registry-ready (nur `id`-Lookup statt Hard-Wire fehlt).
- `DokumentAufnahme` ist props-gesteuert (`relationTag`/`knownIds`) und außerhalb des Gutachten-Flows wiederverwendbar.
- `fill-template` + `field-mapping` sind skill-unabhängig; Mapping-Tabelle könnte später kurator-konfigurierbar werden.
- **Bewusst ausgelassen**: generische Skill-Registry, Workflow-Engine, Kurator-UI für Mapping/Skills, weitere Gutachten-Abschnitte (B–G), **TV-spezifisches Dokument-Scoping** (Nachlieferungen werden aktuell dem Verbund zugeordnet, nicht einem einzelnen TV).

## Tests

- `src/core/services/skills/__tests__/` — `checks.test.ts` (inkl. Abkürzungs-Fälle), `parse-skill-output.test.ts`.
- `src/core/components/__tests__/dokumentAufnahmeFkz.test.ts` — FKZ-Zuordnung (Verbund-/TV-FKZ-Match, `ZEP…`-Fall, ambig).
- `src/core/services/gutachten-vorlagen/__tests__/fill-template.test.ts` — Run-Splitting, `&amp;`-Form, XML-Escaping, Anker vorhanden/fehlend.
- Lokale Test-Vorlage (DOCX mit Platzhaltern + Anker, dev-only Helfer): `_design/handoff/gutachten-kurzfassung/make-test-vorlage.mjs`.
