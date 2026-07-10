# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v2.218.0 — Antrag-Aufbereitung: Lesemodus-Tab + „Im Antrag öffnen"-Sprung (dev) (Juli 2026)

MINOR — Der **Lesemodus** liest die Vorhabensbeschreibung als navigierbares Dokument (Gliederung links, Lesepane rechts) und schaltet den seit Paket 2 vorbereiteten **Fundstellen-Sprung** frei: ein Klick auf einen `§`-Chip in Steckbrief / Abdeckung / Zahlen / Fragen wechselt in den Lesemodus und scrollt zur Sektion (kurz hervorgehoben). Additiv, dev-only (`antragAufbereitung`), keine Migration.

- **Lesemodus** ([LesemodusTab.tsx](src/plugins/antraege/aufbereitung/LesemodusTab.tsx)): rendert die VB abschnittsweise über den geteilten `MarkdownRenderer` (sanitized, Tabellen-Support); jeder Abschnitt trägt seine `sektionId` als `data-sek`-Anker. Slicing = reine, getestete `sliceLesemodus` ([lesemodus.ts](src/plugins/antraege/aufbereitung/lesemodus.ts)) entlang der Gliederungs-Offsets (`s-toc` aus, robust gegen veraltete Offsets). Gliederungs-Navigation scrollt zum Abschnitt.
- **„Im Antrag öffnen" ohne Prop-Drilling:** der geteilte `FundstelleChip` wird über einen kleinen Context ([lesemodusSprung.ts](src/plugins/antraege/aufbereitung/lesemodusSprung.ts)) klickbar, statt einen Callback durch sechs Konsumenten zu reichen. Ist ein Lesemodus verfügbar (VB vorhanden), springt der Chip; sonst bleibt er ein reiner Hover-Chip. Das Popover ersetzt den „Sprung folgt"-Hinweis durch „Klick öffnet die Stelle im Lesemodus".
- Tab `lesemodus` von `inaktiv` → `aktiv` ([AufbereitungTabs.tsx](src/plugins/antraege/aufbereitung/AufbereitungTabs.tsx)); Verdrahtung in [AufbereitungPage.tsx](src/plugins/antraege/aufbereitung/AufbereitungPage.tsx) (Provider + Sprungziel-State). Offen bleiben die Tabs Recherche/Glossar.
- Verifiziert per `npm run check` (typecheck + `npx vitest run` inkl. `lesemodus.test.ts` Slice-Tests + `build:dev`) + `build:pl`.

### v2.217.5 — Antrag-Aufbereitung: Zahlen-Prompt fordert KOMPAKTES JSON (Claim-Ausbeute ~4×) (Juli 2026)

PATCH — Der Eval-Lauf mit `maxTokens = 4096` bestätigte, dass `skill.maxTokens` auf dem Bridge-Pfad wirkungslos ist (Claims **sanken** sogar: 003 33→4, 006 19→5), und deckte die tatsächliche Ursache auf: **das Antwort-Format**. Bei Pretty-Print (jedes Feld eigene eingerückte Zeile, ~8 Zeilen/Claim) passen im fixen Server-Budget nur 4–5 Claims; bei kompakter Ausgabe (ein Claim pro Zeile) im selben Budget ~17. Das Modell wählte das Format nichtdeterministisch → stark schwankende Claim-Zahlen.

- **`buildZahlenPrompt`** ([zahlen.ts](src/plugins/antraege/aufbereitung/zahlen.ts)) fordert jetzt explizit **kompaktes JSON** (ein Claim in genau EINER Zeile, kein Pretty-Print/keine Einrückung — „nur so passen ALLE Zahlen ins Antwort-Limit") UND das **Beispiel selbst ist kompakt** (das Modell mimt das Ausgabeformat). Reine Code-Änderung → wirkt beim Redeploy, keine Migration. Der Parser (`extractLastJsonObject`/`parseJsonArrayTolerant`) ist whitespace-agnostisch — kein Parser-Umbau.
- **Grenze bleibt server-seitig:** kompaktes JSON hebt die Ausbeute im fixen Budget (~4×), löst aber sehr zahlenreiche Anträge (~78 Werte) nicht vollständig — dafür braucht es ein größeres Server-Budget (via Qwen-Tab-A/B, v2.217.4) oder Output-Chunking.
- Verifiziert per `npm run check` (typecheck + `npx vitest run` inkl. `buildZahlenPrompt`-Kompakt-Assertion + `build:dev`) + `build:pl`.

### v2.217.4 — Antrag-Aufbereitung: Eval-A/B gegen den agentischen Qwen-Tab (dev) + maxTokens-Klarstellung (Juli 2026)

PATCH — Ein dev-only Schalter im Eval-Panel schickt die Aufbereitungs-Bausteine wahlweise an den **agentischen Qwen-Tab (260k Kontext)** statt an den Standard-Chat (gpt-oss), damit sich Vollständigkeit/Truncation/Zuverlässigkeit des Zweit-LLM **messen** lassen (nicht adoptieren — nur A/B). Reine Erprobung, dev-only, keine Prod-/Verhaltensänderung im Standardpfad.

- **Ziel-Durchreichung** ([bausteine.ts](src/plugins/antraege/aufbereitung/bausteine.ts)): `runBaustein(…, ziel?)` gibt das `BridgeZiel` an `starteFrischenChat` UND `submitMessage` weiter (Reset + Submit treffen denselben Tab). Ohne `ziel` = unverändert der Standard-Tab (Produktivpfad rührt sich nicht). Runner ([runner.ts](src/plugins/antraege/aufbereitung/eval-panel/runner.ts)) reicht `opts.ziel` an alle drei Läufe durch; Panel-Schalter „Agentisch (Qwen, 260k)"; der Report-Kopf nennt den Ziel-Tab.
- **maxTokens-Klarstellung (Befund):** Die Streamlit-Bridge implementiert kein `submitConversation` → `runBaustein` läuft über `submitMessage`, und weder `submitMessage` noch die `tf-request`-Nachricht tragen ein Token-Budget. **Die Ausgabelänge ist auf dem Bridge-Pfad SERVER-seitig (Backend-Config des KI-Tabs) — `skill.maxTokens` greift dort NICHT** (nur auf dem DirectLLM-`submitConversation`-Pfad). Die maxTokens-Anhebung aus v2.217.1/v2.217.3 bleibt als korrekter Wert für DirectLLM bestehen, ist aber NICHT der Hebel gegen die Bridge-Truncation. Der Weg zu mehr Ausgabe auf der Bridge ist ein größeres Server-Budget — genau das lässt sich mit dem Qwen-Tab jetzt A/B-testen.
- Verifiziert per `npm run check` (typecheck + `npx vitest run` inkl. Runner-`ziel`-Durchreichungstests: „agentisch"→Reset+Submit, ohne→undefined + `build:dev`) + `build:pl`.

### v2.217.3 — Antrag-Aufbereitung: Zahlen-maxTokens 2048→4096 auf Bestands-Shares (Migration) (Juli 2026)

PATCH — Die Diagnose (v2.217.2) belegte per Prod-Eval: die Prompt-Härtung entfernte die Tabellen-Präambel (alle Fixtures nur noch `JSON abgeschnitten`, kein `Tabellen-Präambel`), aber der JSON-Teil trunkierte weiter am persistierten `maxTokens = 2048` (Claim-Zahl sprang durch den Wegfall der Tabelle bereits von 3 auf 20–33). Der Seed steht seit v2.217.1 auf 4096, greift via `mergeMissingSeeds` aber nur für Fresh-Seeds — ein Bestands-Share behält den persistierten Wert. Diese marker-gesicherte Migration holt die Anhebung einmalig nach.

- **Migration** `AUFBEREITUNG_ZAHLEN_MAXTOKENS_MIGRATION` ([migrations.ts](src/core/services/skills/registry/migrations.ts)): hebt `aufbereitung-zahlen` von `maxTokens: 2048` auf `4096` (+ version ≥ 2) — **pristine-only** (nur wenn der Wert exakt der Alt-Seed 2048 ist; ein bewusst anders gesetzter Kurator-Wert bleibt UNBERÜHRT). Läuft team-weit genau einmal (Marker in `angewandteMigrationen`), respektiert spätere Änderungen.
- **Wirkung** ([useAnfrageAnonAktivierung.ts](src/plugins/anfragen/useAnfrageAnonAktivierung.ts)): das Reconcile-Gate deckt jetzt auch Aufbereitungs-Varianten ab (`isAntragAufbereitungEnabled()`), sodass die Migration nach Share-Grant auf schreibberechtigten Clients automatisch greift.
- Rein additiv, dev-only Skill, kein Store-Umbau/keine Nutzeraktion. Verifiziert per `npm run check` (typecheck + `npx vitest run` inkl. Migrations-Tests: pristine→4096, Kurator-Wert unberührt, Fresh-4096 unberührt, idempotent, Skill-abwesend + „alle drei Migrationen zusammen" + `build:dev`) + `build:pl`.

### v2.217.2 — Antrag-Aufbereitung: Eval-Diagnose für „ok, aber wenige Claims" (dev) (Juli 2026)

PATCH — Nach dem Truncation-Fix (v2.217.1) parsen alle Zahlen-Fixtures wieder (`ok`), aber ein Fixture lieferte auffällig **wenige** Claims (3 statt Dutzende). Das In-App-Eval zeigte für `ok`-Läufe bisher keinen Rohtext → man konnte die Ursache (Tabellen-Präambel frisst Budget / JSON abgeschnitten) nicht sehen. Diese dev-only Diagnose macht sie sichtbar. Rein additiv, keine Prod-/Verhaltensänderung.

- **Diagnose-Funktion** `zahlenAntwortDiagnose` ([zahlen.ts](src/plugins/antraege/aufbereitung/zahlen.ts), rein): `abgeschnitten` (der Happy-Path-Objekt-Parser fand kein vollständiges claims-Objekt, obwohl `"claims"` da ist → Salvage lief, Claims sind Teilstand) + `hatTabelle` (≥ 2 Tabellen-Zeilen im Vorspann vor `"claims"`).
- **Eval-Runner** ([runner.ts](src/plugins/antraege/aufbereitung/eval-panel/runner.ts)): `ZahlenSmokeErgebnis` trägt `hatTabelle?`/`abgeschnitten?` (auch bei `ok`); bei auffälligem `ok` wird die Roh-Antwort (gekappt) mitgegeben.
- **Report** ([report.ts](src/plugins/antraege/aufbereitung/eval-panel/report.ts)): `ok`-Zahlen-Zeile mit Suffix „⚠ Tabellen-Präambel + JSON abgeschnitten" + 400-Zeichen-Roh-Auszug — direkt im kopierbaren Block sichtbar. Saubere Läufe bleiben unverändert.
- **Panel** ([AufbereitungEvalPanel.tsx](src/plugins/antraege/aufbereitung/eval-panel/AufbereitungEvalPanel.tsx)): einklappbare „Rohantworten (auffällige Läufe)" jetzt auch für `ok`-Zahlen mit Tabelle/Truncation; Fortschritts-Zeile markiert sie mit „⚠".
- Verifiziert per `npm run check` (typecheck + `npx vitest run` inkl. `zahlenAntwortDiagnose`-Tests + Runner-Diagnose-Test + `build:dev`) + `build:pl`.

### v2.217.1 — Antrag-Aufbereitung: Zahlen-Inventar truncation-tolerant (Prod-Eval-Fix) (Juli 2026)

PATCH — Die erste Prod-Eval des Zahlen-Inventars (In-App, interne KI, 3 Fixtures) zeigte den Baustein bei **allen 3** als „degradiert (nicht parsebar)", während Aspekt-Mapping (F1 = 0,935) und Steckbrief-Smoke (7–8/8) sauber liefen. Ursachenanalyse der Rohantworten ergab zwei Fehlerbilder — der dominante ist jetzt deterministisch behoben.

- **Truncation-Salvage (Hauptursache, 2/3 Fixtures):** das `claims`-Array wuchs über das Token-Limit (`maxTokens: 2048`) und wurde mitten drin abgeschnitten — das äußere `{` schloss nie, also lieferte `extractLastJsonObject` `null` und der ganze Lauf ging verloren, **obwohl die ersten Claims vollständig übertragen waren**. `parseZahlen` ([zahlen.ts](src/plugins/antraege/aufbereitung/zahlen.ts)) bergt das Array jetzt truncation-tolerant über den **bereits vorhandenen, geteilten** `parseJsonArrayTolerant` ([json-tolerant.ts](src/core/services/ai/json-tolerant.ts)): schlägt der Objekt-Extraktor fehl, wird ab dem `[` hinter `"claims"` jedes balancierte `{…}` gesammelt und das angeschnittene letzte verworfen. **Reine Code-Änderung → wirkt auf prod beim Redeploy, keine Seed-Migration.**
- **Tabellen-Präambel (2. Fehlerbild, 1/3 Fixtures):** das dritte Fixture stellte der JSON-Ausgabe eine **Markdown-Tabelle mit denselben Claims voran** („Tabelle DANN JSON-Export") — die Präambel fraß Token-Budget und trieb den JSON-Teil erst recht in die Truncation. Der Salvage keyt auf `"claims"` (die Tabelle trägt das nicht) → auch hier werden die vollständigen JSON-Claims geborgen, die Tabelle leckt nicht als Pseudo-Claims ein. Gegen die verschwenderische Präambel härtet der Prompt: `buildZahlenPrompt` + System-Prompt fordern jetzt explizit „ausschließlich JSON-Codeblock — keine Tabelle/Aufzählung/Fließtext"; `maxTokens` 2048→4096 (Seed v1→v2) senkt die Truncation-Rate zusätzlich (greift für Fresh-Seeds; auf bereits geseedeten Shares zählt der persistierte Registry-Wert — der Salvage macht die Erhöhung nicht load-bearing). Echte Degradation (`null`) bleibt nur, wenn **gar kein** JSON-Teil da ist (reine Prosa/Tabelle ohne `"claims"`).
- Verifiziert per `npm run check` (typecheck + `npx vitest run` inkl. `zahlen.test.ts` mit den exakten Roh-Antworten aller drei Prod-Eval-Fixtures als Regressions-Fixtures — abgeschnittenes Array, angeschnittenes letztes Objekt, „Tabelle DANN JSON", reine Tabelle → Degradation — + `build:dev`) + `build:pl`. Erwartung nächste Prod-Eval: alle drei (003/006/017) → `ok`.

### v2.217.0 — Antrag-Aufbereitung Paket 4/Phase 2: Fragen-Tab (Juli 2026)

MINOR — Ein neuer dev-only **Fragen-Tab** bündelt alle offenen Punkte eines Aufbereitungs-Runs an einem Ort — rein deterministisch aus dem vorhandenen Run + den gelaufenen Bausteinen, **kein** neuer LLM-Aufruf. Vorstufe der späteren Nachforderungs-Anbindung (in diesem Paket ohne NF-Integration). Additiv, ein optionales Run-Feld, keine Migration.

- **Aggregation** `sammleFragen` ([fragen.ts](src/plugins/antraege/aufbereitung/fragen.ts), rein): Zeitplan-/Kapazitäts-Befunde (→ Aspekt H), fehlende Pflichtangaben (`aspekt-fehlt`) + unabgedeckte Prüfaspekte (`aspekt-leer:<id>`), Lösungswege ohne Risiko (`risiko-fehlt`) + unzuordenbare Risiken (`risiko-unzugeordnet:<slug>`, neuer Key), Zahlen-Widersprüche (`zahl-widerspruch`). Je Eintrag ein deterministisch generierter Fragetext + Quell-Baustein + `FundstelleChip` wo ein Sektionsbezug existiert. Gruppierung nach Aspekt A–J (+ „Allgemein"), Zuordnung deterministisch herleitbar — **nie geraten**. Degradierte/nicht gelaufene Frage-Bausteine als Meta-Hinweis.
- **„Erledigt" als eigene Achse:** neues optionales `AufbereitungRun.erledigtePunkte?` (additiv → alte Runs laden), **getrennt** von `offenePunkte` (sonst würde ein in der Abdeckung als offen übernommener Punkt hier fälschlich „erledigt" erscheinen). Persistenz + Survival über „Neu aufbereiten" spiegeln `offenePunkte` (`uebernehmeErledigtePunkte` + geteilte Prefix-Whitelist).
- **UI** ([FragenTab.tsx](src/plugins/antraege/aufbereitung/FragenTab.tsx)): einklappbare Aspekt-Gruppen (`SectionHeader`), Zähler offen/gesamt, erledigte Einträge dezent (durchgestrichen), ehrliche Leerzustände („keine offenen Punkte" vs. „Bausteine nicht/teilweise gelaufen"), Export „Als Markdown kopieren" (`formatFragenMarkdown`, `[x]`/`[ ]` + Sektions-IDs). Monochrom, keine neuen Tokens.
- Verifiziert per `npm run check` (typecheck + `npx vitest run` inkl. `fragen.test.ts` Aggregations-/Gruppierungs-/Export-Tests + `erledigtePunkte`-Survival + `build:dev`) + `build:pl`. Damit ist Paket 4 (Phasen 0–2) abgeschlossen; Live-Eval + `file://`-Abnahme macht Thomas auf prod.

### v2.216.0 — Antrag-Aufbereitung Paket 4/Phase 1: Zahlen-Inventar (3. LLM-Baustein) (Juli 2026)

MINOR — Ein dritter dev-only LLM-Baustein `aufbereitung-zahlen` (Seed `aktiv:false`) sammelt die Claims mit Zahlenwerten der VB — jeder wörtlich ausgewählt und per Sektions-ID verankert; die deterministischen Quervergleiche rechnet der Code. Additiv, keine Run-Schema-Änderung, keine Migration.

- **Auswählen, nicht rechnen:** `buildZahlenPrompt` + `parseZahlen` ([zahlen.ts](src/plugins/antraege/aufbereitung/zahlen.ts)) — `ZahlClaim{wert (wörtlich), einheit?, kategorie, kontext, sektionIds}`, JSON mit `schemaVersion`. Parser nutzt die **geteilte** `extractLastJsonObject` (aus `steckbrief.ts`, kein zweiter Parser), verwirft Claims ohne Wert/gültige Fundstelle. Kategorien-Katalog `leistung|zeit|personal|kosten|markt|sonstig` als Code-Konstante. Transport intern-pflichtig (`{{vbMarkdown}}`, Pitfall #30); `computeZahlenBaustein` mit 0-Claims-Guard + Retry aus Phase 0.
- **Deterministische Quervergleiche** (`pruefeZahlWidersprueche`, reine Funktion): Laufzeit-Claim vs. Zeitplan-Horizont, PM-Claim vs. Anlage-5-Summe (geteilte `summePm`, aus `ZeitplanTab` extrahiert). Nur **sicher parsebare** Werte erzeugen einen Befund — kein Fuzzy-Matching. Abweichung → `zahl-widerspruch:*`-Kandidat, reiht sich in die `offenePunkte`-Mechanik ein (überlebt „Neu aufbereiten").
- **Zahlen-Tab** ([ZahlenTab.tsx](src/plugins/antraege/aufbereitung/ZahlenTab.tsx)): nach Kategorie gruppiert, je Claim Wert/Einheit/Kontext/Fundstellen-Chip + Widerspruch-`StatusDot`; Zustände nicht-gelaufen/lädt/degradiert/leer/gefüllt. Monochrom, keine neuen Tokens.
- **In-App-Eval** um einen **Zahlen-Smoke** erweitert (analog Steckbrief: Parse ok, `schemaVersion` + Claims + katalog-valide sektionIds), inkl. „Zahlen einschließen"-Schalter. Kein eigenes Zahlen-Goldset in diesem Paket (Fixtures bleiben fiktiv).
- Verifiziert per `npm run check` (typecheck + `npx vitest run` inkl. `zahlen.test.ts` Parser-/Quervergleichs-Tests + Runner-Smoke + `offenePunkte`-Survival + Seed-Inventar-Tests + `build:dev`) + `build:pl`.

### v2.215.0 — Antrag-Aufbereitung Paket 4/Phase 0: Eval-Härtung & Mehrfach-Aspekt-Fix (Juli 2026)

MINOR — Härtet die dev-only Aufbereitungs-Bausteine + In-App-Eval anhand der ersten Live-Baseline (zwei stabile Befunde: Mehrfach-Aspekt-Sektionen bekamen nur einen Aspekt; ein Lauf lieferte R=0.00 bei Status `ok`, Rohantwort nicht rekonstruierbar). Additiv, kein Skill `aktiv:true`, keine Migration; alle neuen Result-Felder sind optional (alte Runs/Ergebnisse bleiben lesbar).

- **Mehrfach-Aspekt-Instruktion:** `buildAspektePrompt` ([aspekte.ts](src/plugins/antraege/aufbereitung/aspekte.ts)) fordert jetzt explizit ALLE zutreffenden Aspekte je Sektion (nicht nur den dominantesten) + ein Zwei-Zeilen-Beispiel (`I: k-11.1` / `J: k-11.1`). Der **wirksame** Prompt ist Code → erreicht prod beim Redeploy, **keine** Seed-Migration nötig; der Seed-`promptTemplate` ([aufbereitung-aspekte.seed.ts](src/core/services/skills/registry/aufbereitung-aspekte.seed.ts)) ist nur Policy-Subjekt und wurde für Konsistenz nachgezogen (`version` 1→2). Parser-Robustheit: `parseAspektMapping` splittet zusätzlich zusammengeklebte Tokens (`IJ:` → I, J) defense-in-depth.
- **Null-Zuordnungs-Guard + einmaliger Retry:** `getOrComputeBaustein` nimmt optional `verdaechtig={pruefe,grund}` ([bausteine.ts](src/plugins/antraege/aufbereitung/bausteine.ts)). Für Aspekte = **0 Zuordnungen bei ≥1 Sektion** (`aspekteVerdaechtig`, geteilt mit dem Eval-Runner) → **ein** automatischer Retry mit frischem Chat (Pitfall #36), sonst `degradiert` (statt fälschlich `ok`) mit `retryAnzahl` + `begruendung`. Ohne `verdaechtig` unverändert.
- **Roh-Response-Persistenz:** bei Auffälligkeit wird die Rohantwort am Ergebnis mitgeführt (gekappt auf `ROHTEXT_MAX` = 64 kB); im Eval-Panel je betroffenem Fixture **einklappbar + kopierbar**.
- **Trailing-Artefakt-Härtung:** die bekannte Bridge-Endung (`` ``` :help[] `` / ` :help[]`) ist jetzt für beide Parser regressionsgetestet (beide schlucken sie strukturell) + in [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) als bekannter prod-Streamlit-Suffix dokumentiert.
- **Wiederholungs-Parameter `n`** (1…5, Default 1) im Eval-Panel: fährt Aspekte je Fixture n× (Varianz), weist Einzel-/Median-/Worst-F1 aus; Gesamt = Median-Lauf, Worst-Case separat. Bei `n=1` bleibt das Markdown-Format byte-identisch.
- Verifiziert per `npm run check` (typecheck + `npx vitest run` inkl. neuer Parser-/Guard-/Retry-/Wiederholungs-Tests + `build:dev`) + `build:pl`. Live-Eval (`n=3` über die Bridge) + `file://`-Abnahme macht Thomas auf prod.

### v2.214.0 — Bridge: frischer Chat pro Skill-Lauf (Kontext-Überlauf-/Kontaminations-Fix) (Juli 2026)

MINOR — Skill-Läufe sind stateless designt (voller Kontext im Prompt), die Streamlit-Bridge schreibt sie aber in eine **stateful** Chat-UI (AitisiGPT). Ohne Reset akkumuliert der Verlauf: beobachtet als Kontext-Überlauf beim In-App-Eval (mehrere komplette VBs in einem Chat) und als Kontamination beim Gutachten-„Neu" (die VB des vorherigen Laufs lag noch im Chat). Ab sofort beginnt **jeder Einzel-Skill-Lauf** über einen Streamlit-Transport mit einem Chat-Reset. **Rein app-seitig — kein Bookmarklet-/`BRIDGE_REV`-Change, keine Neu-Installation.** Additiv, keine Migration.

- **Ein gemeinsamer Helfer** `starteFrischenChat(transport, ziel?)` ([chat-reset.ts](src/core/services/ai/chat-reset.ts)) statt verstreuter Kopien: liefert `'ok' | 'nicht-gefunden' | 'nicht-unterstuetzt' | 'timeout'`, wirft nie. Dazu `resetChat` von `Promise<boolean>` auf eine Status-Union aufgebohrt ([streamlit.ts](src/core/services/ai/transports/streamlit.ts)) — rein app-seitig (das Bookmarklet meldet `{found}` bereits; Timeout / kein-Fenster sind app-seitige Zustände).
- **Eingebaut an allen echten Submit-Pfaden** (es gibt keinen gemeinsamen Wrapper): der zentrale Skill-Runner `runSkill` (deckt Gutachten A–G, KI-QS, Kurzfassung, Nachforderungen, Batch, Testlauf, Anonymisieren, Metadaten), die Aufbereitungs-Bausteine `runBaustein`, die Relevanz-Map `runRelevanzMap` und der In-App-Eval-Runner. Die bisherigen Einzel-Resets in Anonymisierung/Metadaten entfallen (jetzt durch `runSkill` gedeckt, auch pro Retry).
- **Best-effort, sichtbar markiert:** `'nicht-gefunden'`/`'timeout'` bricht den Lauf NIE ab, markiert das Ergebnis aber — Warn-Banner an der Gutachten-Sektion ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)) und der Aufbereitungs-Seite ([AufbereitungPage.tsx](src/plugins/antraege/aufbereitung/AufbereitungPage.tsx)), Reset-Status-Zeile je Lauf im kopierbaren Eval-Report ([report.ts](src/plugins/antraege/aufbereitung/eval-panel/report.ts)). `'nicht-unterstuetzt'` (DirectLLM/llama.cpp — ohnehin stateless) erzeugt keine Warnung.
- **Bewusst ausgenommen:** das mehrturnige Such-Chat-Panel; die Batch-Analyse `begruendung.ts` behält ihre adaptive ~30K-Token-Strategie; die Auslastungs-Klassifizierung resettet bereits selbst.
- Neuer **Pitfall #36**; Invariante dokumentiert in [streamlit-bridge.md](docs/architecture/streamlit-bridge.md). Neue Tests (Helfer-Status-Mapping, Reset-vor-Submit-Reihenfolge in `runSkill` + Eval-Runner). Verifiziert per `npm run check` + `build:dev`/`build:pl`.

### v2.213.1 — Einstellungen: „Interne KI"-Lesezeichen als ziehbares Objekt statt CTA-Button (Juli 2026)

PATCH — Reiner UI-Feinschliff im **Einstellungen → KI**-Installer für die interne KI. Der „Interne KI"-Knopf, den man **in die Lesezeichenleiste ziehen** soll, trug bisher `variant="primary"` und sah damit identisch zum CTA „Speichern & Aktivieren" darüber aus — er las sich als klickbar, obwohl ein Klick nichts tut (der `javascript:`-Bookmarklet-href wird per `onClick`-`preventDefault` geblockt). Keine Verhaltens-, Bridge- oder Datenmodell-Änderung; **kein `BRIDGE_REV`-Bump, keine Neu-Installation** nötig (das Bookmarklet selbst ist unverändert).

- **Affordanz statt CTA** ([StreamlitBridgeSection.tsx](src/plugins/einstellungen/StreamlitBridgeSection.tsx)): das Element ist jetzt eine neutrale (`variant="secondary"` = outline) Fläche mit führenden Greif-Punkten (`GripVertical`) + Lesezeichen-Icon (`Bookmark`, in der Profil-Akzentfarbe `--tf-primary`) und `cursor-grab` — es liest sich als ziehbares Objekt, nicht als Knopf, und kollidiert optisch nicht mehr mit dem primären CTA.
- **Anleitung nachgezogen**: Schritt 2 zeigt eine Mini-Repräsentation desselben Chips inline und formuliert „… in die Lesezeichenleiste **ziehen** (nicht anklicken)"; der Zieh-Hinweis neben dem Element ebenso.
- Kein Guard-Konflikt: `no-raw-cta-fill` bleibt grün (kein hand-gebauter Fill, kanonische `<Button>`-Komponente). Verifiziert per `build:dev`/`build:pl`.

### v2.213.0 — Antrag-Aufbereitung: In-App-Baustein-Eval (dev-only, Bridge-Baseline per Knopfdruck) (Juli 2026)

MINOR — Ein dev-only Eval-Panel in **Einstellungen → KI → „Aufbereitung: Baustein-Eval"** ([eval-panel/](src/plugins/antraege/aufbereitung/eval-panel/)) macht die bislang fehlende **Live-Baseline** der Aufbereitungs-Bausteine dort produzierbar, wo sie gebraucht wird: Node (dev) hat keinen gpt-oss-Zugang, der interne gpt-oss (prod) läuft nur im Browser über die Streamlit-Bridge — die Node-CLI `eval:aufbereitung` kann in Thomas' Umgebung nicht laufen. Additiv, kein neuer Skill, keine Registry-/Seed-/Slot-Änderung, keine Migration; nur die bestehenden Bausteine (`aufbereitung-aspekte`, `aufbereitung-steckbrief`) werden über den bestehenden Policy-Pfad gemessen.

- **Geteilte, IO-freie Metrik** [aspekte-metrik.ts](src/core/services/skill-eval/aspekte-metrik.ts) (`paare`/`metriken`/`fasseZusammen`/`fehlzuordnungen`) aus der Node-CLI [aufbereitung-eval.ts](src/core/services/skill-eval/aufbereitung-eval.ts) herausgelöst — CLI **behavior-preserving** umgestellt (byte-gleicher JSONL-Output), Panel und CLI rechnen jetzt identisch. Neu unit-getestet (Partialität des Goldsets, Aggregation, Fehlzuordnungs-Format).
- **Browser-Runner** [runner.ts](src/plugins/antraege/aufbereitung/eval-panel/runner.ts): jagt die 3 fiktiven Goldset-Fixtures **strikt sequentiell** (die Bridge ist ein einzelnes postMessage-Fenster) durch Prompt-Bau → `runBaustein` → Parser — **OHNE** `getOrComputeBaustein` (kein Cache, kein `antragKey`, keine Runs). Aspekte gegen das partielle Goldset (P/R/F1), Steckbrief als **Smoke-Test** (nur Status + Anzahl gefüllter Felder). Wirft nie: Transport-/Parse-Fehler eines Fixtures werden zur Ergebniszeile, der Gesamtlauf läuft weiter; Abbrechen wirkt zwischen den Läufen. Rein bis auf den Transport → mit Stub-Transport getestet (happy path, Degradation, Fehler-mittendrin, Abbruch, `limit`).
- **Transport nur intern**: der Transport kommt ausschließlich über `bridge.getTransportForSkillRun(skill)` (Policy wirft bei externem Provider → Banner, kein Lauf; Pitfall #30). Start-Button ist deaktiviert, solange die interne KI nicht verbunden ist (`useBridgeStatus`). Ergebnis als kopierbarer **Markdown-Block** (Datum, Transport, Fixture-Zeilen mit P/R/F1 + Fehlzuordnungen, Steckbrief-Smoke, Gesamtmetrik, bei Degradation die ersten ~400 Zeichen der Rohantwort) — [report.ts](src/plugins/antraege/aufbereitung/eval-panel/report.ts).
- **Bundle**: die ~2-MB-Fixtures bleiben über den bestehenden dev-Guard `loadEvalFixtures()` aus prod/pl/as/kurator getreeshaked (statt eines rohen `import.meta.glob`, das sie in ALLE Bundles gezogen hätte); das Panel ist auf `isDevFixturesEnabled()` gegated. Nur das ~1,6-KB-Goldset (fiktive Buchstaben-Maps, kein VB-Inhalt) wird neu über `?raw` gebündelt ([aspekte-goldset.ts](src/core/services/skill-eval/fixtures/aspekte-goldset.ts), eine Quelle mit der CLI).
- **Aktivierungs-Gate** in [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) umformuliert: eine bestandene Live-Eval jetzt „über den In-App-Eval (Bridge, prod-Umgebung) ODER die Node-Eval (direkter interner Endpoint)".
- Verifiziert per `npm run check` (typecheck + `npx vitest run` inkl. neue Metrik-/Runner-Tests + `codebase-conventions` + `build:dev`) + `build:pl` inkl. **Bundle-Beweis** (Fixture-Marker im pl-HTML nicht vorhanden, im dev-HTML vorhanden). Offen: In-App-/`file://`-Abnahme + echte Live-Baseline durch Thomas (Dev-Server hat keinen erreichbaren internen Endpoint).

### v2.212.0 — Bridge-Statusleiste: drei Pills → eine dezente Status-Pill (Juli 2026)

MINOR — Die vom Bookmarklet in die interne KI-Seite injizierte Statusleiste ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)) zeigt statt **drei** Pills (Badge + „ZAH-App testen" + „Chat-Test") nur noch **eine** dezente Status-Pill. Reine UI-Änderung an der injizierten Leiste; kein React, kein Datenmodell, keine Migration. `BRIDGE_REV` gebumpt (`2026-07-09-robust3` → `2026-07-10-pill`) → einmalige Neu-Installation des Lesezeichens nötig.

- **Eine Pill statt drei** (`#tf-bridge-badge`): kleiner farbiger Status-Punkt (Ton grün/amber/rot) + neutraler Text auf hellem Grund, feine Umrandung + weicher Schatten, im Ruhezustand leicht gedämpft (`opacity:.85`), beim Hover voll sichtbar. Angepasst an die Streamlit-Optik, damit die Pill unauffällig sitzen kann. Die zwei Test-**Buttons** entfallen — ihre Aufrufe wandern in die Funktionen `runAppReachTest()` (ZAH-App-Ping) und das bestehende `runSelfTest()` (Chat-Test).
- **Statuszyklus in einer Pill**: die Pill durchläuft im Zeitverlauf alle Zustände (Interne KI → Prüfe ZAH-App… → ZAH App erreichbar → Chat-Test läuft… → Chat-Test OK → **Verbunden**; dazu Arbeitet… / Zeitüberschreitung / Fehler). Beide Selbsttests laufen wie bisher automatisch beim Aktivieren (300 ms / 1500 ms); `setBadge` färbt jetzt nur noch den Punkt (Ton) + Text, die Pill-Fläche bleibt neutral.
- **Klick = Checks neu**: ein Klick auf die Pill löst beide Selbsttests erneut aus (ersetzt die zwei entfallenen Buttons als manuellen Fallback). Ohne `window.opener` weiterhin Hinweis „Tab aus der App öffnen".
- **Position nach links eingerückt** (`right:12px` → `right:220px`, bottom bleibt 12px): Chrome zeichnet seine Bildschirmfreigabe-Anzeige unten rechts (außerhalb der Seite, nicht per JS messbar) — die Pill weicht ihr per festem `right`-Versatz aus und überlappt sie nicht mehr. Der 4-s-Watchdog re-asserted dieselbe `BAR_CSS`-Konstante (unverändert).
- Docs mitgezogen: [streamlit-bridge.md](docs/architecture/streamlit-bridge.md) (Leisten-Beschreibung) + Installer-Schritt in [StreamlitBridgeSection.tsx](src/plugins/einstellungen/StreamlitBridgeSection.tsx). Echo-/Answer-Selection-Logik unberührt (`echo-match.test.ts` grün). Verifiziert per `build:dev`/`build:pl`; manuelle `file://`-Abnahme an der echten AitisiGPT-Seite offen (Thomas).

### v2.211.1 — Einstellungen: „Profil" → „Mein Profil", KI-Assistent ans Ende der System-Gruppe (Juli 2026)

PATCH — Zwei kleine Feinschliffe an der Settings-Sidebar ([settingsPanels.tsx](src/plugins/einstellungen/settingsPanels.tsx)); reine Beschriftung/Reihenfolge, kein Verhaltens-/Datenmodell-Change.

- **Panel „Profil" heißt jetzt „Mein Profil"** (nur der Nav-Label; Panel-`id` bleibt `profil` → Deep-Links/Suche unberührt).
- **KI-Assistent ist das letzte System-Panel**: Reihenfolge der System-Gruppe jetzt Darstellung & Bedienung → Daten & Verbindungen → KI-Assistent (die Sidebar rendert Panels in Push-Reihenfolge je Gruppe). Standard-Panel bleibt „Mein Profil".
- Screen-Kontext-Doc [einstellungen.md](docs/feedback-kontext/einstellungen.md) mitgezogen (Ist-Zustand: Label + Gruppen-Reihenfolge).

### v2.211.0 — Home: persönlicher Rückstands-Balken (Quartals-Altlasten) mit Hover-Detail (Juli 2026)

MINOR — Die Home-Page ([HomePage.tsx](src/plugins/home/HomePage.tsx)) bekommt über „Meine Anträge" den **Rückstands-Balken** aus dem PL-Auslastungsmodul — jetzt aber personalisiert auf die **eigenen** offenen Anträge, sodass jeder User (auch prod/as/kurator ohne Auslastungs-Modul) seine „Altlasten" auf einen Blick sieht. Additiv, kein neuer Store, keine Schema-Änderung, keine Migration, kein Feature-Flag. Vorlage: Design-Handoff `_design/handoff/homepage-balken` (Balken) + der Auslastungs-Altlast-Tooltip (Hover-Tabelle).

- **4-Segment-Balken** (alt→neu, links→rechts): `Ab Q-3 · Q-2 · Q-1 · akt. Quartal` — Segmentbreite proportional zur Antragszahl, Zahl im Segment, Legende darunter. Kopf zeigt „N Anträge · M TVS" + Link „Zu meinen Anträgen →" (gleiche Navigation wie „Alle →": View „Offen" + Frist-Sort). Datenquelle ist das bereits Kürzel-gefilterte, offen-only, Verbund-geclusterte `meineAntraege` aus `useDashboardData` — pro Zeile FKZ (`id`), Akronym, Status, Antragsdatum, TVs.
- **Hover-Tooltip je Segment** (spiegelt `AltlastSegmentTooltip`): kompakte Mini-Tabelle FKZ / Akronym / Status / Datum / TVs der konkreten Anträge dieses Quartals, gekappt bei 10 + „+N weitere".
- **Bucketing** rein per Kalender-Arithmetik in der neuen, unit-getesteten [quartalBuckets.ts](src/plugins/home/quartalBuckets.ts) (`year*4 + quartalIndex`, `now` in UTC → TZ-fest): `0` = aktuell, `1` = Q-1, `2` = Q-2, `3` = **Q-3 und älter** (kein Q-7-Cap). Undatierbare/zukünftige Anträge fallen aus Balken **und** Header-Summen (Balken + Header konsistent). Bewusst **ohne** Auslastungs-Imports → prod-sicher.
- **Generischer Balken im Shared-Layer**: neuer domänenfreier [DistributionBar.tsx](src/components/ui/DistributionBar.tsx) (`src/components/ui/`) — nimmt Segmente `{count, color, textColor, legendLabel, tooltip}`, nutzt die shared `Tooltip`-Primitive, kennt keine Farben/Domäne. Die Home-Schicht [MeineAntraegeBalken.tsx](src/plugins/home/MeineAntraegeBalken.tsx) liefert Buckets, Farb-/Label-Zuordnung und den Antrags-Tooltip. Auslastungs-`ColBars.tsx` bleibt unverändert (anderes Modell: Kohorten-Skala + separater Aktuell-Balken); eine spätere Migration darauf ist optionaler Folge-Schritt.
- **Farben**: die bestehende `--tf-altlast-band-1/2/3`-Rampe wiederverwendet (eine Farbquelle, Dark-mode-korrekt) + **ein** neuer heller 4.-Stufen-Token `--tf-altlast-band-akt` (+ `-text`) fürs aktuelle Quartal in [theme.css](src/theme.css) (Light + Dark). Keine hartkodierten Farben in Komponenten (Token mit Fallback, `theme-token-contract` grün), font-weight 500 (nicht der Handoff-`600`).
- Verifiziert per `tsc --build` (grün) + `npx vitest run` (inkl. neue `quartalBuckets` 10/10 + `codebase-conventions`) + `build:dev`/`build:pl`. Offen: visuelle + `file://`-Abnahme durch Thomas (Dev-Server zeigt Home mangels SMB-Onboarding nicht).

### v2.210.0 — Feedback-Board-Redesign „feedback-optimiert": Sponsoring auf den Karten, Fortschritts-Stepper, Glocke (Juli 2026)

MINOR — Das öffentliche Feedback-Board ([FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)) übernimmt den Design-Handoff `_design/handoff/feedback-optimiert`. Additiv, keine Daten-/Schema-Änderung, keine Migration; Votes/Sponsoring/Outbox-Sync unverändert. Umgesetzt in Tailwind (keine co-located CSS — das Feedback-Modul führt keine), neue Farb-Familie `--tf-fb-*` global in [theme.css](src/theme.css) (Light + Dark).

- **Sponsoring sichtbar auf den Karten** (Hybrid): sponsorbare Ideen/UX mit Aufwand tragen rechts eine Fortschrittsleiste „X/Y Pkt · N Sponsoren" (grün, „Ziel erreicht") — [FeedbackSponsorBar.tsx](src/components/feedback/FeedbackSponsorBar.tsx). Problem/Frage/Lob behalten die budgetfreie Vote-Pill („ich auch"). Im Detail ein volles Panel mit großem X/Y, +/−-Vergabe (über den bestehenden `SponsorButton`) und Budget-Hinweis — [FeedbackSponsorPanel.tsx](src/components/feedback/FeedbackSponsorPanel.tsx).
- **Fortschritts-Stepper** (Neu → Geplant → In Bearbeitung → Umgesetzt; Abgelehnt als Seitenpfad): Mini-Stepper auf eigenen Karten, voller (dateloser) Stepper im Detail. Position deterministisch aus dem Status über [feedbackStepper.ts](src/core/services/feedback/feedbackStepper.ts) (`feedbackStepperPosition`, Pitfall #21-sicher via `FEEDBACK_STATUS`, kein Literal). Kein Status-Verlaufs-Datenmodell nötig.
- **Benachrichtigungen für eigene Feedbacks**: Glocke im Kopf ([NotificationBell.tsx](src/components/feedback/NotificationBell.tsx)) mit Zähler ungelesener Team-Antworten → springt auf „Von mir"; „Antwort"-Marker auf der Karte; rot hervorgehobene Antwort-Box + „Neu" im Detail; „Dein Fortschritt"-Leiste in der Sicht „Von mir" ([MyProgressBar.tsx](src/components/feedback/MyProgressBar.tsx)). Ungelesen-Tracking gerätelokal über localStorage-Signatur des Antworttexts ([useUnreadReplies.ts](src/components/feedback/useUnreadReplies.ts)) — kein Schema, kein Kurator-Schreibpfad.
- **Filter & Sortierung**: Scope als gefülltes Segmented-Control (neue `variant="segmented"` in [ScopeTabs.tsx](src/components/ui/ScopeTabs.tsx) — kein paralleler Tab-Bau, `no-parallel-scope-tabs` bleibt grün); Sortier-Dropdown mit 5 Ordnungen (Neueste · Meiste Punkte · Kurz vor dem Ziel · Meiste Sponsoren · Meiste Kommentare) statt 2-fach-Toggle; Status-Filter-Dropdown (nur Liste) — beide über die kanonische shadcn-`Select`.
- **Kanban** ([FeedbackKanban.tsx](src/components/feedback/FeedbackKanban.tsx)): eigene **Lob**-Spalte; leere Spalten klappen auf eine schmale 46px-Schiene mit vertikalem Label zusammen.
- **Scannbarere Karten**: Titel + **eine** gekürzte Vorschauzeile (statt bis zu 4 Q&A-Segmente); Statusfarben deckungsgleich mit dem Stepper (`STATUS_TINT`/`STATUS_DOT` in [constants.ts](src/components/feedback/constants.ts)).
- **Produkt-Entscheidungen (Thomas)**: Hybrid Votes+Sponsoring · nur Dichte „Ruhig" (kein Kompakt-Umschalter) · Stepper ohne Datum.
- Verifiziert per `tsc --noEmit` (grün) + `npx vitest run` (309 Dateien / 3216 Tests grün, inkl. `codebase-conventions` 30/30: theme-token-contract, no-parallel-scope-tabs, no-raw-cta-fill, no-raw-modal, no-direct-feedback-status-compare) + `build:dev`/`build:pl`. Offen: visuelle + `file://`-Abnahme durch Thomas (Dev-Server zeigt das Board mangels SMB-Onboarding nicht) + ggf. `feedback-kontext-pflege` prüfen.

### v2.209.1 — Fix: „Weitere Anträge" klappte bei jedem „Kann ich übernehmen" zu (Juli 2026)

PATCH — In der Home-Sektion „Neue Anträge für dich" ([NeueAntraegeFuerDich.tsx](src/plugins/home/NeueAntraegeFuerDich.tsx)) klappte der Tier-2-Block „Weitere Anträge · niedrigere Passung" nach **jedem** Klick auf „Kann ich übernehmen" komplett auf den Such-Button zurück — der User musste die Suche jedes Mal neu starten.

- **Ursache**: Ein Claim wächst optimistisch in `claimedSet` → der vorgemerkte Verbund fällt aus `weitereKandidaten` → die Kandidaten-Signatur in [useWeitereAntraege.ts](src/plugins/home/useWeitereAntraege.ts) änderte sich → der „bei Daten-Refresh verwerfen"-Effekt setzte das Ergebnis auf `null` → `status` zurück auf `idle`.
- **Fix**: Das Ranking wird jetzt nur noch bei **echtem** Daten-Refresh verworfen (wenn NEUE Kandidaten-IDs auftauchen — `seen`-Ref wächst nur), nicht mehr beim reinen Schrumpfen durch einen Claim. Der Hook liefert statt voller Verbund-Objekte ein stabiles `ranking` (verbundId + Passung); die Anzeige-Zeilen joinen es beim Rendern gegen die **aktuelle** Verbund-Sicht ([`weitereRows`]). Ein Claim lässt die Zeile damit in-place auf „Vorgemerkt / Rückgängig" flippen (konsistent mit Tier 1), statt das Ergebnis wegzuwerfen. Die Sektion bleibt außerdem sichtbar, solange es Ergebnisse zu zeigen gibt (auch nach dem Claim des letzten Kandidaten).
- Verifiziert per `tsc --noEmit` (grün) + `npx vitest run src/plugins/home src/__tests__/codebase-conventions.test.ts` (Home 4/4 + Conventions grün; einziger roter Punkt = paralleler Feedback-Board-Redesign, nicht Teil dieses Changes) + `build:dev`/`build:pl`.

### v2.209.0 — Home „Neue Anträge für dich": mehr anzeigen + weitere (nicht-Platz-1) Anträge + Hover-Tooltip (Juli 2026)

MINOR — Die Homepage-Sektion „Neue Anträge für dich" ([NeueAntraegeFuerDich.tsx](src/plugins/home/NeueAntraegeFuerDich.tsx)) bekommt drei additive Erweiterungen für die MA-Selbsteintragung (nur wo `auslastungSelbstEintragung` aktiv, pl/dev). Keine Daten-/Schema-Änderung, keine Migration; Claim-Pfad unverändert (Wunsch → persönlicher Ordner, PL sammelt ein).

- **In-Page „+N mehr anzeigen"** statt „Alle"-Modal: die Liste wächst jetzt inkrementell wie „Meine Anträge" (`visibleCount`, +10/Klick, „X von Y"-Zähler) — der bisherige `NeueAntraegeAlleModal` entfällt.
- **Tier 2 „Weitere Anträge · niedrigere Passung"** (neuer Hook [useWeitereAntraege.ts](src/plugins/home/useWeitereAntraege.ts)): Ein Button „Weitere passende Anträge suchen (N)" blendet auf Wunsch die Anträge ein, für die der User **nicht der Primär-Pick** ist — fachlich die Anträge, deren freigegebene Primärkategorie in seinen **Nebenkategorien** liegt. Genau der Fall „in meiner Hauptkategorie ist gerade nichts frei". Die Reihenfolge liefert das echte Matching: pro Kandidat-Verbund läuft `runMatchingWithContext` (BM25-only, kein Query-Embedding) einmal, die **eigene** Passung (`kompetenzScore`) sortiert absteigend und erscheint als „Passung X %"-Pill. Asynchron mit Spinner „Suche weitere passende Anträge für Dich …" (Point-Read + Engine je Kandidat, gedeckelt auf 50, geyieldet). Datenschutz: nur die eigene Passung, nie andere MAs/Rang. Die Sektion bleibt jetzt auch sichtbar, wenn Tier 1 leer ist, aber Neben-Kandidaten existieren.
- **Hover-Tooltip pro Zeile** ([NeueAntraegeVerbundRow.tsx](src/plugins/home/NeueAntraegeVerbundRow.tsx)): voller Verbund-Titel + Antragsteller + Eingangsdatum + alle TV-Titel (reuse `Tooltip` `content`-Prop; Daten aus dem bestehenden `VerbundEintrag`-View-Model) — löst den bisherigen nativen `title`-Tooltip am „N TV"-Badge ab.
- **Refactor**: der per-TV-Filter hinter Tier 1 + Tier 2 lebt jetzt gemeinsam in `buildOffeneEintraege` ([neueAntraegeVerbund.ts](src/plugins/home/neueAntraegeVerbund.ts), Kategorie-Test als Prädikat) — Tier 1 byte-identisch zu vorher, mit Unit-Test.
- Verifiziert per `tsc --noEmit` (grün) + `npx vitest run src/plugins/home src/__tests__/codebase-conventions.test.ts` (70/70 grün) + `build:dev`/`build:pl`. Offen: `file://`-Abnahme durch Thomas (Dev-Server zeigt die Sektion mangels SMB-Onboarding nicht).

### v2.208.0 — Sidebar-Feinschliff: Feedback-Nav zurück, Reihenfolge, Icons, kompakte Rail-Ampeln (Juli 2026)

MINOR — Mehrere gezielte Verbesserungen an der linken Sidebar (`ShellLayout`). Rein visuell/Nav-strukturell, keine Daten-/Schema-Änderung, keine Migration.

- **Feedback wieder als Menüpunkt** ([feedback-board/index.ts](src/plugins/feedback-board/index.ts)): `hideFromNav` entfernt + `featureFlag: 'feedback'` ergänzt → „Feedback" erscheint im oberen Arbeits-Block (tools-Gruppe, `order: 75`, nach den workflow-Items), sichtbar wo `features.feedback` aktiv ist (dev + pl true). Das redundante Chat-Bubble-Icon im Sidebar-Footer (öffnete das Board via `navigate('/feedback-board')`) ist aus [ShellLayout.tsx](src/core/ShellLayout.tsx) entfernt; „Feedback geben" bleibt auf dem globalen FAB unten rechts.
- **Nav-Reihenfolge** ([auslastung/index.tsx](src/plugins/auslastung/index.tsx)): Auslastung `order: 25` → `order: 4` → sitzt jetzt direkt nach Förderanträge (order 2) und vor E-Mail Anfragen (order 6).
- **Schreibweise** ([anfragen/index.ts](src/plugins/anfragen/index.ts)): Menüpunkt „E-Mail-Anfragen" → „E-Mail Anfragen" (ohne Bindestrich vor „Anfragen"); beide Vorkommen (Modul + Kuration). `id`/`route` (`anfragen`/`/anfragen`) unverändert.
- **Globus entfernt** ([skill-verwaltung-kuration/index.ts](src/plugins/skill-verwaltung-kuration/index.ts)): `navHint: 'global'` entfernt → kein Globus-Icon mehr neben „Skill-Verwaltung". Der generische `navHint`-Render-Pfad in `ShellLayout` bleibt (dokumentierte Plugin-API, aktuell ohne Nutzer).
- **Einklapp-Icon zustandsabhängig** ([ShellLayout.tsx](src/core/ShellLayout.tsx)): statt statischem `PanelLeft` jetzt `PanelLeftClose` (ausgeklappt) / `PanelLeftOpen` (eingeklappt) — das Icon zeigt die Klick-Aktion.
- **Kompakte Rail-Ampeln**: im eingeklappten Zustand sitzen die Status-Punkte (Sync/CSV/KI) enger — Container `gap-1.5` → `gap-0.5` und `compact`-abhängiges `px-0.5` statt `px-1.5` in den drei Ampel-Buttons ([SyncStatusIndicator](src/components/ui/SyncStatusIndicator.tsx) · [CsvFreshnessIndicator](src/components/ui/CsvFreshnessIndicator.tsx) · [BridgeStatusIndicator](src/components/ui/BridgeStatusIndicator.tsx)). Die nativen Hover-Tooltips (`title`/`aria-label`) bleiben erhalten.
- Verifiziert per `tsc --build` (grün) + `npx vitest run src/__tests__/codebase-conventions.test.ts` (30/30 grün) + `build:dev`/`build:pl`. Offen: visuelle/`file://`-Abnahme durch Thomas.

### v2.207.1 — Feedback-Verbesserung erreicht auch read-only-Enduser (Outbox-Rewrite) (Juli 2026)

PATCH — Schließt die in v2.206.0 offen gebliebene Grenze: bei **read-only prod-Endusern** (ohne Daten-Share-Schreibrecht) sammelte der Kurator bislang den **Roh-Text** ein, obwohl der Nutzer sein Feedback per KI verbessert hatte. Ursache: das Roh-Feedback landet beim Absenden in der persönlichen Outbox, und der Speichern-Schritt der Verbesserung (`updateFeedback`) ist share-self-gated → schrieb nur lokal, ließ die Outbox-Datei unberührt. Jetzt überschreibt der Verbessern-Ablauf zusätzlich die noch offene Outbox-Datei mit der polierten Fassung. Additiv (nur optionale Felder auf `FeedbackOutboxItem`), keine Migration, alte Outbox-Dateien bleiben lesbar. Detail: [feedback-system.md](docs/architecture/feedback-system.md).

- **Outbox-Rewrite** ([updateOutboxFeedback](src/core/services/personal-storage/service.ts)): schreibt ein bereits abgeschicktes, **noch nicht eingesammeltes** (`status:'pending'`) Outbox-Item neu — `text` (poliert) + `original_text` (Roh) + `llm_summary` + `llm_classification`, unter Erhalt von `submitted_at`/`attachments`/`status` (gleicher Dateiname → Overwrite) und Fortschreiben von `meine-feedbacks.json`. **Nur bei `pending`** (schon eingesammelt/gelöscht → No-Op, kein Wieder-Auferstehen eines geschlossenen Eintrags); best-effort (wirft nie, `false` bei jedem IO-Fehler — die lokal gespeicherte Verbesserung geht dabei nicht verloren).
- **Verdrahtung**: [FeedbackVerbessernFlow](src/components/feedback/FeedbackVerbessernFlow.tsx) bekommt `outboxHandle` und ruft nach `updateFeedback` zusätzlich `updateOutboxFeedback` auf — aber **nur** wenn der Client ohne Share-Schreibrecht war (`FeedbackPanel` merkt sich den pers. Handle aus dem Submit; bei Kurator/PL/dev ist er `null`, der direkte Shared-Write greift).
- **Einsammeln** ([FeedbackOutboxItem](src/core/services/personal-storage/types.ts) + [toFeedbackItem](src/core/services/feedback/feedbackOutboxCollect.ts)): die Outbox trägt jetzt `original_text`/`llm_summary`/`llm_classification` (additiv, optional) und `autoCollectFeedbackOutboxes` mappt sie ins zentrale `FeedbackItem` — Parität zum direkten Shared-Write-Pfad.
- Verifiziert per `tsc --build` (grün) + `npx vitest run` (neue Tests: Outbox-Rewrite nur bei `pending`, No-Op bei approved/unbekannt, best-effort kein Wurf; Collect-Mapping der KI-Felder) + `build:dev`/`build:pl`. Offen: `file://`-Roundtrip-Abnahme (read-only-Client → Verbesserung → Kurator sammelt polierte Fassung ein) durch Thomas.

### v2.207.0 — Auslastung: Tab „Einstellungen" → „Verwaltung" + Passwort-Verwaltung dorthin (Juli 2026)

MINOR — Der letzte Tab des Auslastungs-Moduls heißt jetzt **„Verwaltung"** (bis v2.205 „Einstellungen" — wurde mit den **persönlichen** App-Einstellungen in der Sidebar verwechselt). Die interne `TabId` bleibt `einstellungen` (kein Persistenz-Bruch, keine Migration). Zusätzlich wandert der Button **„Passwörter für alle aktiven MAs"** aus dem Kopf des Tabs „Auslastung MA" in die Sektion „Zugangspasswort-E-Mail-Vorlage" der Verwaltung, damit Erzeugen/Versenden und die zugehörige Vorlage beieinander liegen. Rein UI-Reorg, additiv, keine Daten-/Schema-Änderung.

- **Tab-Umbenennung** ([AuslastungView.tsx](src/plugins/auslastung/views/AuslastungView.tsx)): nur `label` + Tooltip + Doc-Kommentar; die `TabId`-Union und die Render-Zweige bleiben unverändert (`einstellungen`).
- **Passwort-Verwaltung verschoben**: identische Logik (`openZugangVerwaltung` + [ZugangVerwaltungDialog](src/plugins/auslastung/components/ZugangVerwaltungDialog.tsx)) liegt jetzt in [KonfigurationSection.tsx](src/plugins/auslastung/views/admin/KonfigurationSection.tsx) unter der E-Mail-Vorlagen-Überschrift (weiterhin per `isMaVerwaltungPasswortEnabled()` + aktive De-Anon-Session gegated). Aus [MaListSection.tsx](src/plugins/auslastung/views/uebersicht/MaListSection.tsx) entfernt (Button/State/Dialog + ungenutzte Imports; `useDeAnonResolver`/`resolveName` bleiben für die MA-Tabelle).
- Der UI-Reorg selbst ist bereits als eigener Commit gemergt; dieser Eintrag trägt Version + Changelog nach (beim Reorg lag der v2.206.0-Feedback-Commit noch nicht vor → keine Kollision mit-committen). Verifiziert per `tsc --build` + `npx vitest run` (screen-context-Guard grün) + `build:dev`/`build:pl`. Screen-Kontext-Doc [auslastung.md](docs/feedback-kontext/auslastung.md) nachgezogen.

### v2.206.0 — Feedback „mit KI verbessern": verschmolzener geführter Ablauf + interne-KI-Fix (Juli 2026)

MINOR — Reaktion auf Thomas' eigenes Feedback („die KI-Verbesserung hat nicht funktioniert, obwohl über die interne KI eine Antwort kam"; „Details mit KI ergänzen" verlangte OpenRouter). Die zwei getrennten KI-Funktionen des Feedback-Panels sind zu **einem geführten Ablauf** über die interne KI verschmolzen, dabei wurden **zwei Transport-Bugs** behoben. Additiv — nur ein optionales Feld (`FeedbackItem.original_text?`), alte Shared-Files bleiben lesbar, keine Migration. Detail: [feedback-system.md](docs/architecture/feedback-system.md), [transport-policy.md](docs/architecture/transport-policy.md).

- **Bug A — „Verbessern" lieferte stillen Fehlschlag** ([feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts)): `improveFeedback` lief korrekt intern-only, gab den System-Prompt (App-Kontext + JSON-Format) aber als 2. `submitMessage`-Arg mit — den die **Streamlit-Bridge ignoriert** (`_systemPrompt` ungenutzt). Die interne KI bekam nur den Roh-Text ohne Format-Vorgabe → freie Prosa → `parseFeedbackSummary` scheiterte → „fehlgeschlagen". Fix: der System-Prompt wird jetzt **in die Message inlined** (Codebase-Konvention: run-skill.ts, suche/analyse/llm-client.ts, gutachten/relevanz-map.ts), 2. Arg bleibt für DirectLLM.
- **Bug B — „Details ergänzen" verlangte OpenRouter** (entfernte `FeedbackChatbot.tsx`): der Chatbot gated auf `transport.submitConversation` (Multi-Turn), das nur `DirectLLMTransport` implementiert → auf der internen Bridge erschien „Der Chatbot benötigt einen OpenRouter- oder lokalen LLM-Provider". Behoben durch die Verschmelzung: der neue Ablauf nutzt ausschließlich single-turn `submitMessage`.
- **Verschmolzener Ablauf** ([FeedbackVerbessernFlow.tsx](src/components/feedback/FeedbackVerbessernFlow.tsx) + [FeedbackImproveEditor.tsx](src/components/feedback/FeedbackImproveEditor.tsx)): „Feedback speichern & verbessern" speichert das Roh-Feedback sofort (nie verlieren) und startet dann (1) **Rückfragen** — die interne KI stellt 0–3 gezielte Rückfragen (aus `FEEDBACK_TYPES`-Dimensionen + App-Kontext + Bildschirmseiten-Doc), (2) **Generieren** — klare Feedback-Fassung PLUS Anforderung (Ist/Soll + Akzeptanzkriterien), (3) **Bearbeiten** — der Nutzer passt beides an und speichert. Beide KI-Calls sind eigenständige, kontext-vollständige `submitMessage`-Aufrufe (die interne Bridge ist single-turn) und **intern-only** (`transport.name === 'Streamlit'`, DSGVO — Feedback ist Echt-Nutzertext, nie OpenRouter).
- **Persistenz**: Speichern schreibt die polierte Fassung nach `item.text`, bewahrt das Original in `item.original_text` (neu, additiv) und die Anforderung in `llm_classification`. `updateFeedback`-Whitelist um `text`/`original_text` erweitert; `mergeItems` behandelt `original_text` user-lokal-wins. **Bekannte Grenze**: für read-only-prod-Enduser landet die Verbesserung nur lokal (localStorage) — die Kurator-Outbox trägt den Roh-Text (wie schon beim alten `improveFeedback`); voll wirksam für Kurator/PL/dev mit Share-Schreibrecht.
- **Aufgeräumt**: `improveFeedback`/`buildFeedbackImprovePrompt` (Einschuss-Verbesserer) + `FeedbackChatbot`/`FeedbackConfirmCard`/`FeedbackImproveResult` entfernt — vom geführten Ablauf abgelöst; `FeedbackChatbot` aus der `no-raw-async-onclick`-Legacy-Whitelist genommen.
- Verifiziert per `tsc --build` (grün) + `npx vitest run` (feedback + Convention-Guards grün, inkl. neuer Regressions-Tests: System-Prompt wird inlined, Intern-only-Gate, tolerante Parse, Retry, Fallback) + `build:dev`/`build:pl`. Offen: visuelle/`file://`-Abnahme des geführten Ablaufs (Rückfragen → Editor → Speichern, Dark-Mode) durch Thomas + optionale Outbox-Propagation der Verbesserung für read-only-Enduser.

### v2.205.0 — Auslastung MA: Altlasten-Balken mit Antrags-Tooltip je Segment (Juli 2026)

MINOR — Hover über ein Segment des **Altlasten-Balkens** (Tab „Auslastung MA") zeigt jetzt eine **kompakte Mini-Tabelle der konkreten offenen Anträge** dieses Dringlichkeits-Bands — so sieht die PL sofort, WELCHE Anträge zum Rückstand gehören, ohne die Zeile aufklappen zu müssen. Additiv, keine Daten-/Schema-Änderung.

- **Segment-Tooltip** ([ColBars.tsx](src/plugins/auslastung/views/uebersicht/ColBars.tsx), `AltlastSegmentTooltip`): pro Band (Q-1 · Q-2 · Q-3–7) die zugehörigen `MaAltlastBucket.verbuende` gefiltert nach `altlastBand`, als Grid FKZ · Akronym · Status · Datum · TVs — gekappt bei 10 Zeilen mit „+N weitere". Spiegelt die Detail-Liste [AltlastInlineList](src/plugins/auslastung/views/AltlastInlineList.tsx) (gleiche Felder/Formatierung: `getStatusLabel`, `formatGermanDate`), nur auf ein Band verdichtet.
- **Geteilte `Tooltip`-Komponente erweitert** ([Tooltip.tsx](src/components/ui/Tooltip.tsx)): additive optionale Props `content` (reicher ReactNode statt nur `text`), `maxWidth`, `wrapperClassName`/`wrapperStyle` — Letztere erlauben, den Trigger als **Flex-Item** (`flexGrow` proportional zu den TVs) zu betreiben, sodass das Balken-Layout erhalten bleibt. Default-Verhalten unverändert (Text, `max-w` 300, `inline-block`); Bestandsaufrufer bleiben byte-gleich.
- `MaCompactRow` reicht `altlast.verbuende` (stabile Leer-Referenz als memo-freundlicher Fallback) an `AltlastColBar` durch. Der frühere native `title` je Segment entfällt (vom Rich-Tooltip abgelöst).
- Verifiziert per `tsc --build` + `npx vitest run` (3201 grün, inkl. Convention-Guards) + `build:dev`/`build:pl`. Screen-Kontext-Doc [auslastung.md](docs/feedback-kontext/auslastung.md) nachgezogen (inkl. Korrektur der Rampen-Richtung auf „dunkel→hell = alt→neu" nach dem v2.197.2-Flip).

### v2.204.1 — Auslastung MA: vertikale Bündigkeit der beiden Balken (Juli 2026)

PATCH — Reiner Optik-Schliff im Tab „Auslastung MA": der **Altlasten-Balken** sitzt jetzt exakt auf gleicher Höhe wie der **Aktuelles-Quartal-Balken** rechts daneben.

- Ursache: Die Aktuell-Zelle ist durch die per-Typ-Balken (`TypKapazitaetBars`) darunter höher; bei `align-middle` zentrierte sich der einzelne 13px-Altlasten-Balken tiefer als der oben verankerte Aktuell-Balken. Fix: beide Balken-Zellen ([MaCompactRow.tsx](src/plugins/auslastung/views/uebersicht/MaCompactRow.tsx)) auf `align-top` — bei identischem oberem Zell-Padding (7px) starten beide Balken bündig, unabhängig davon ob per-Typ-Balken vorhanden sind.
- Nur CSS-Vertikalausrichtung, keine Logik-/Daten-/Token-Änderung. Verifiziert per `tsc --build` + `npx vitest run` (grün) + `build:dev`/`build:pl`.

### v2.204.0 — Antrag-Aufbereitung Paket 3: Silhouette · Schwimmbahnen · Risiko-Punkte (Juli 2026)

MINOR — Drei **rein deterministische** Visualisierungen auf den vorhandenen Aufbereitungs-Daten (kein LLM, keine Skills/Seeds, keine Transport-Fragen). Route `/antraege/:aktenzeichen/aufbereitung`, weiterhin **nur dev** hinter `antragAufbereitung`. Additiv — nur optionale Feld-Erweiterungen (`ApZeile.posStart/posEnde`, `AufbereitungRun.risiken?`), `version: 1` unverändert, alte persistierte Runs bleiben ladbar, **kein neuer Object-Store, keine Migration**. Detail: [docs/architecture/antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

- **Silhouette** (dritte Abdeckungs-Ansicht, [SilhouetteAnsicht.tsx](src/plugins/antraege/aufbereitung/SilhouetteAnsicht.tsx)): die Gliederung als proportionale Flächenverteilung — ein Block je Ebene-1-Kapitel, Höhe ∝ kontinuierlicher Zeichenmasse (inkl. Unterabschnitte, bis zum nächsten Ebene-1-Kapitel), `s-toc` aus / `s-intro` nur > 1 %, eingebettete Anlagen als tertiäre Sammelzeile, separate Anlage-5-Datei als Fußzeile. Aspekt-/„dünn"-/„ohne Aspekt"-/„Detail in Anlage 5"-Badges (deterministisch); monochrom, Warndot als Token. Dritter Pill im bestehenden `ScopeTabs`-Umschalter (Liste · Karte · Silhouette).
- **Schwimmbahnen** („Nach Person", [PersonenZeitplan.tsx](src/plugins/antraege/aufbereitung/PersonenZeitplan.tsx)): eine Bahn je MA (mit Summen-PM), Balken **tagesgenau** aus neuen fraktionalen Positionen `ApZeile.posStart/posEnde` (aus den Anlage-5-Datumswerten; Fallback ganze Monate), AP-Nummer am Balken, Bahn-Kapazitäts-Warndot aus der geteilten `kapazitaetProMaMonat`-Aggregation (nie aus Befund-Texten geparst). Umschalter „Nach AP | Nach Person"; ohne MA-Zuordnung ist der Person-Pill deaktiviert (`ScopeTabItem.disabled?/title?`). Achse/Gridlines/Leerflächen-Annotation aus dem neuen geteilten [GanttAchse.tsx](src/plugins/antraege/aufbereitung/GanttAchse.tsx) — „Nach AP" wurde behavior-preserving darauf umgestellt (Optik unverändert, ganze `monatStart`/`monatEnde`).
- **Risiko-Punkte** ([risiken.ts](src/plugins/antraege/aufbereitung/risiken.ts) / [StrukturKarte.tsx](src/plugins/antraege/aufbereitung/StrukturKarte.tsx)): `ernteRisiken` (im `baueRun`) liest je `klasse:'risiko'`-Tabellenzeile Titel/Beschreibung/Herkunftssektion; `zuordneRisiken` (im UI, da das LLM-Aspekt-Mapping nötig ist) heftet jedes Risiko per Titel-Token-Overlap (Stamm-Präfixe ≥ 5 Zeichen, Schwelle 0,35) an einen Lösungsweg-Abschnitt (Aspekt C, Ebene ≥ 2). Ebene-2-Knoten der Karte zeigen eine Punkt-Gruppe je zugeordnetem Risiko (max. 5 + „+n", Hover = Titel) bzw. „keine Risiken" (Warndot); Legende + aufklappbare Liste **unzugeordneter** Risiken darunter (ehrlich, nie „irgendwo" angeheftet). Lösungsweg-Abschnitte ohne Risiko → `risiko-fehlt:<sektionId>`-Kandidaten (Aspekt D) in „OFFENE PUNKTE" (`uebernehmeOffenePunkte` whitelistet das neue Prefix).
- **Geteilte/entkoppelte Bausteine**: `kapazitaetProMaMonat` aus `pruefeKapazitaet` extrahiert (Befund-Logik byte-identisch); `GanttAchse` (`macheAchse`/`GanttGrid`/`GanttLeerAnnotation`) von beiden Zeitplan-Ansichten genutzt; `ScopeTabs` um optionales `disabled?`/`title?` je Tab erweitert (backward-kompatibel, beide Varianten). Das hartkodierte `WARN_DOT = '#f59e0b'` in der Struktur-Karte auf `StatusDot` + `var(--tf-warning-text)` umgestellt (kein neues Farb-Hex).
- Verifiziert per `tsc --build` (grün) + `npx vitest run` (grün, inkl. neuer Suite `risiken` + erweiterter `tabellen`-Suite: fraktionale Halbmonats-Positionen, `kapazitaetProMaMonat`) + Convention-Guards (theme-token-contract, no-parallel-scope-tabs, no-raw-async-onclick, no-raw-modal) + `build:dev`/`build:pl`. **Rein deterministisch.** Offen: die Risiko-Zuordnungs-Heuristik ist auf fiktiven Fixtures kalibriert (Schwelle 0,35 als Default) und die visuelle/`file://`-Abnahme der drei Ansichten (Silhouetten-Proportionen, Bahn-Dot, Karten-Punkte, M1-Ursprung, Dark-Mode) durch Thomas — Ausbaupfad bei zu häufigem „ohne Zuordnung": die Risiko-Zuordnung in den Aspekte-LLM-Lauf falten. *(Anmerkung: Paket-3-Fallen sind modul-lokal in [antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) dokumentiert statt als projektweite CLAUDE.md-Pitfalls — CLAUDE.md-Konvention: nummerierte Pitfalls nur bei projektweiter Geltung.)*

### v2.203.2 — Bridge: Lauf-Erkennung über Streamlit-Skript-Zustand (Agent-Reasoning-Pausen) (Juli 2026)

PATCH — Zweiter Prod-Dump (Agentischer Tab, **während** der Generierung): AitisiGPT blendet ALLE sichtbaren Lauf-Indikatoren aus (`stStatusWidget`/Stop-Button/Spinner = 0) → `isRunning()` war auf dieser Oberfläche blind. Folge: lange Reasoning-Pausen des Agenten (> 5–10 s ohne Textausgabe, vom Nutzer real beobachtet) hätten **verfrüht mit einem Teilstand finalisiert**. **Bookmarklet-Änderung ⇒ Lesezeichen erneut einmal neu installieren** (`BRIDGE_REV 2026-07-09-robust3`).

- `isRunning()` prüft jetzt **primär** das UI-unabhängige Streamlit-Attribut `stApp[data-test-script-state="running"]` (semantisch dasselbe Signal wie das ausgeblendete Status-Widget, aber nicht per CSS versteckbar); die sichtbaren Indikatoren bleiben als Fallback für andere Streamlit-Versionen. Fail-safe: fehlt das Attribut, verhält sich alles wie zuvor; Stuck-true-Backstop bleibt `HARD_MAX_MS` (600 s).
- Dump-Validierung im Übrigen positiv: Panel-Sichtbarkeit kippt sauber, `role="tabpanel"`-Container vorhanden (Panel-Scoping greift), User-Avatar `user avatar` auch im agentischen Tab (Echo-Stufe 1 intakt).
- Verifiziert per `tsc --build` + `npx vitest run` (grün) + `build:dev`/`build:pl`. Offen: Bestätigung des Attribut-Werts während einer echten Generierung (Konsolen-Einzeiler) + Agentisch-Rundlauf durch Thomas.

### v2.203.1 — Bridge: Tab-Panel-Scoping nach Prod-Dump-Kalibrierung (Juli 2026)

PATCH — Kalibrierung des v2.203.0-Ziel-Routings anhand des Konsolen-Dumps vom echten AitisiGPT (Thomas): die Oberfläche hält **beide Chat-Panels dauerhaft gemountet** (bestätigt), Tabs sind echte `role="tab"`-Buttons mit `aria-selected` (Tab-Matching bestätigt), der agentische Reset-Button heißt real „🗑️ Chat zuruecksetzen" (ue-Variante bestätigt), „Login (setzt Chat zurück!)" matcht kein Reset-Muster (sicher). **Bookmarklet-Änderung ⇒ Lesezeichen erneut einmal neu installieren** (`BRIDGE_REV 2026-07-09-robust2`).

- **Panel-Scoping** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js), `panelScopeOf` + `qav(list, root)`): `runRequest`/`runSelfTest` binden das Nachrichten-Roster ans Tab-Panel der Ziel-textarea — ein manueller Tab-Wechsel **mitten im Lauf** kippt den Scrape nicht mehr aufs andere Panel (unsichtbares Panel → qav-Fallback liefert die Panel-eigenen Nachrichten).
- **Submit-Fallback**: ohne gefundenen Chat-Input-Container kein dokumentweiter Erst-Treffer mehr (wäre in DOM-Ordnung der ggf. versteckte Standard-Button), sondern direkt der sichtbarkeits-bevorzugte `q1v`-Pfad.
- Verifiziert per `tsc --build` + `npx vitest run` (grün; Drift-Tests answer-selection/echo-match unverändert grün) + `build:dev`/`build:pl`. Agentisch-Rundlauf am echten System durch Thomas weiterhin offen.

### v2.203.0 — Streamlit-Bridge-Härtung (Leiste, lastfeste Ende-Erkennung) + Zweit-LLM-Erprobung „Agentischer Chat" (Juli 2026)

MINOR — Härtung der Streamlit-Bridge gegen die zwei realen Vorfälle (Leiste unsichtbar nach UI-Umbau; „Ende der Response nicht erkannt" bei 1–2-min-Antworten unter Server-Last) + Protokoll-Naht für das Zweit-LLM im neuen AitisiGPT-Tab „Agentischer Chat" (Qwen). **Bookmarklet-Änderung ⇒ Lesezeichen „Interne KI" einmal neu installieren** (`BRIDGE_REV 2026-07-09-robust`; Prüfung: Badge-Tooltip / `window.__teamflowBridgeRev`). Detail: [docs/architecture/streamlit-bridge.md](docs/architecture/streamlit-bridge.md).

- **Leiste unten rechts + Watchdog** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js)): `#tf-bridge-bar` wandert von oben rechts (Kollisionszone Streamlit-Header/Status) nach **unten rechts**; ein 4-s-Watchdog re-appended sie nach UI-Umbauten, rückt sie ans body-Ende (Paint-Order-Gewinn bei z-index-Gleichstand) und re-asserted die Inline-Styles.
- **Lastfeste Ende-Erkennung**: (a) **Zweistufiger Echo-Anker** — findet die Avatar-Heuristik (`img[alt*="user"]`) nach einem UI-Umbau kein Prompt-Echo, markiert Stufe 2 das Echo über den gesendeten Text selbst (neues [echo-match.ts](src/core/services/ai/streamlit-bridge/echo-match.ts), im Snippet zwischen `<echo-match-core>`-Markern gespiegelt, Drift-Test wie answer-selection); `selectAnswerIndex` selbst bleibt byte-identisch. (b) **Progressbewusste Deadlines** statt absolutem 180-s-Deckel: Abbruch erst nach 150 s ohne jeden Fortschritt bzw. 600 s absolut; neuer `tf-progress`-Heartbeat (~10 s). (c) App-seitig **aktivitätsbasierte Timeouts** (neues [deadline.ts](src/core/services/ai/transports/deadline.ts), `createActivityDeadline`): tf-stream/tf-progress schieben das 200-s-Idle-Timeout (Hard-Cap 660 s) — Idle-Expiry heißt jetzt „Tab tot", nie „Lauf zu langsam". (d) `isRunning()` mit Spinner-Fallbacks; Konsolen-Roster-Dump zusätzlich im **Timeout**-Zweig (`~E`-Echo-Flags).
- **Sichtbarkeits-bevorzugte Queries** (`q1v`/`qav` mit Any-Match-Fallback): verhindern Cross-Tab-Bleed, wenn beide Chat-Panels im DOM stehen; Submit-Button im Container der eigenen textarea gescoped; `resetChat` überspringt unsichtbare Buttons und kennt zusätzlich `zuruecksetzen` (ue — der reale Agentischer-Chat-Button).
- **Zweit-LLM-Naht (Erprobung)**: `tf-request`/`tf-reset` tragen optional `ziel: 'standard'|'agentisch'` — das Bookmarklet aktiviert den passenden Tab (`ensureZiel`, Fuzzy-Tab-Match, 10-s-Wartefenster auf sichtbare textarea) und fährt den geteilten Scrape-Pfad. App-seitig nur `SubmitMessageOptions.ziel` + `resetChat(ziel?)` (kein `ConversationOptions.ziel` — produktive QS-Verdrahtung erst nach Erprobung). Dev-only Testfläche „Zweit-LLM (Erprobung)" in [StreamlitBridgeSection.tsx](src/plugins/einstellungen/StreamlitBridgeSection.tsx) (`isDevContext`, `useAsyncAction`). Ohne `ziel` ist alles byte-kompatibel zu alten Builds/Bookmarklets.
- Dev-Harness (`_reference/.../streamlit-dev-chat/app.py`): zwei Tabs wie die echte Oberfläche, `RESPONSE_DELAY_S`-Lastsimulation, Avatar-los-Checkbox für den Echo-Fallback-Test. Doku [streamlit-bridge.md](docs/architecture/streamlit-bridge.md) auf Ist-Zustand (Timing-Tabelle statt stale „60 s"; Dateiname `bridge-snippet.source.js`).
- Verifiziert per `tsc --build` (grün) + `npx vitest run` (grün, inkl. neuer Suiten echo-match/deadline/streamlit-deadline; answer-selection unverändert grün = `selectAnswerIndex`-Spiegel stabil) + `build:dev`/`build:pl`. Abnahme am echten AitisiGPT (Leiste, lange Läufe, Agentisch-Test) durch Thomas offen — vorab liefert ein Konsolen-Diagnose-Snippet die echte DOM-Struktur des Agentischer-Chat-Tabs zur Selektor-Kalibrierung.

### v2.202.0 — Antrag-Aufbereitung Paket 2: Steckbrief + Abdeckung (LLM-Bausteine) + Kapazitäts-Befund (Juli 2026)

MINOR — Füllt die zwei Platzhalter-Tabs der Antrag-Aufbereitung (Route `/antraege/:aktenzeichen/aufbereitung`, weiterhin **nur dev** hinter `antragAufbereitung`) mit den **ersten LLM-Bausteinen** und ergänzt einen deterministischen Kapazitäts-Befund im Zeitplan. Additiv, **kein neuer Object-Store**, keine Migration. Beide LLM-Läufe tragen VB-Volltext → **zwingend interner Transport** (Pitfall #30, kein OpenRouter). Detail: [docs/architecture/antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

- **Kapazitäts-Befund (deterministisch)** ([tabellen.ts](src/plugins/antraege/aufbereitung/tabellen.ts) / [store.ts](src/plugins/antraege/aufbereitung/store.ts)): neuer Befund-Typ `kapazitaet` + reine `pruefeKapazitaet` — bündelt die anteiligen Personenmonate je (MA, Kalendermonat) und warnt über `KAPAZITAET_GRENZE_PM` (1,2 PM/Monat); verschiedene MAs werden nie zusammengezählt (Doppelbesetzung eines APs bleibt zulässig). Erscheint automatisch in der typ-agnostischen Plausibilitäts-Liste. `computeAufbereitung` **erhält** jetzt die vom Nutzer markierten offenen Punkte über „Neu aufbereiten" hinweg (`uebernehmeOffenePunkte`, verwaiste Keys verworfen) — vorher wurden sie gelöscht.
- **LLM-Baustein-Rahmen** ([bausteine.ts](src/plugins/antraege/aufbereitung/bausteine.ts)): generisches `getOrComputeBaustein<T>` nach dem Relevanz-Map-Muster (VB-Hash-Cache, `ok`/`degradiert`/`fehler`, cachet nur `ok`, wirft nie) mit getrennten Cache-Keys `aufbereitung:<key>:aspekte|steckbrief:<vbHash>`. Zwei Skill-Seeds (`aufbereitung-aspekte`, `aufbereitung-steckbrief`) **`aktiv:false`** in der geteilten Registry, `{{vbMarkdown}}` als Policy-Subjekt; dev-Freischaltung über `istAufbereitungBausteinFreigeschaltet` (Runtime-Override wie beim Anonymisierer). Bausteine laufen sequentiell (Streamlit = ein postMessage-Fenster).
- **Abdeckung** ([aspekte.ts](src/plugins/antraege/aufbereitung/aspekte.ts) / [AbdeckungTab.tsx](src/plugins/antraege/aufbereitung/AbdeckungTab.tsx) / [StrukturKarte.tsx](src/plugins/antraege/aufbereitung/StrukturKarte.tsx)): fester Prüfaspekt-Katalog **A–J als Code-Konstante**; ein interner Lauf ordnet Sektionen zu und benennt fehlende Pflichtangaben. **Substanz-Anteil + „dünn"-Schwelle (< 3 % / < 1200 Zeichen) rechnet der Code**, nicht das LLM. Listen-Sicht (Fundstellen-Chips + monochromer Substanz-Balken + Warning/Info-Badges, „NICHT IM PRÜFRASTER", „OFFENE PUNKTE") und Karten-Sicht (horizontaler Baum, die zwei kinderreichsten/aspekt-tragenden Kapitel ausgeklappt) über den `ScopeTabs`-Umschalter. Fehlt-Angaben werden zu offenen Punkten mit stabilen Keys.
- **Steckbrief** ([steckbrief.ts](src/plugins/antraege/aufbereitung/steckbrief.ts) / [SteckbriefTab.tsx](src/plugins/antraege/aufbereitung/SteckbriefTab.tsx)): hybrider Steckbrief — Antragsteller/FKZ/Projektform deterministisch aus dem Store, die VB-abgeleiteten Felder (ein Satz, Innovation, FuE-Gegenstand, Laufzeit, Kern-Zielwert, Zielmärkte, Schlüsselpersonal, Aufträge an Dritte) vom LLM als strukturiertes JSON, **jede Aussage mit Fundstelle**. Toleranter Parser (letzter JSON-Codeblock, Truncation-Salvage); leere Felder zeigen „[Im Antrag nicht gefunden]".
- **Fundstellen-Popover** ([FundstelleChip.tsx](src/plugins/antraege/aufbereitung/FundstelleChip.tsx)): monochromer `§ 3.1`-Chip mit Auszug-Popover (Kapiteltitel + ~300 Zeichen ab Span-Beginn, kein Dialog/Modal, kein Sprung — der Lesemodus folgt); von Abdeckung und Steckbrief geteilt.
- **Mini-Eval** `npm run eval:aufbereitung` ([aufbereitung-eval.ts](src/core/services/skill-eval/aufbereitung-eval.ts)) misst Precision/Recall der Aspekt-Zuordnung gegen ein 3-Fixture-Goldset ([eval/eval-goldset-aspekte.json](eval/eval-goldset-aspekte.json)); `--dump`/`--dry-run`/live (interner Endpoint, nie OpenRouter). Baseline: Harness-Selbsttest grün; die **echte Live-Baseline** über den internen LLM steht aus und ist Voraussetzung jeder Aktivierung jenseits dev.
- Verifiziert per `tsc --build` (grün) + `npx vitest run` (3171 Tests grün, inkl. neuer Suiten für Kapazität, Bausteine, Aspekte, Steckbrief, Struktur-Karten-Layout) + Convention-Guards (theme-token-contract, no-parallel-scope-tabs, no-raw-async-onclick, no-raw-modal) + `build:dev`/`build:pl`. Volle In-App-/`file://`-Abnahme gegen einen echten Antrag (inkl. interner KI) durch Thomas offen.

### v2.201.0 — Antrag-Aufbereitung Paket 1: Fundament + Zeitplan-Tab (Juli 2026)

MINOR — Neue **Vollbild-Seite pro Förderantrag** (`/antraege/:aktenzeichen/aufbereitung`), die die Vorhabensbeschreibung (VB) strukturiert aufbereitet — deterministisch geerntet, im Original verankert. Hinter neuem Feature-Flag `antragAufbereitung` (**nur dev**; prod/kurator/pl/as = false). Additiv, kein neuer Object-Store, keine Migration. **Paket 1 ist rein deterministisch (KEIN LLM)** — Steckbrief- + Abdeckungs-Tab folgen als Paket 2 (LLM) und sind hier Platzhalter. Detail: [docs/architecture/antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md).

- **Gliederungs-Parser** ([gliederung.ts](src/plugins/antraege/aufbereitung/gliederung.ts)): `parseVbGliederung` zerlegt das VB-Markdown in im Original verankerte Sektionen mit Zeichen-Spans (H1–H3 + Nummerierungs-Inferenz für als Fließtext angekommene Überschriften + Inhaltsverzeichnis-Ausschluss + stabile Nummern-IDs). Bewusst **getrennt** von `parseVbHeadings` (relevanz-map), an dessen positionalen IDs die Caches hängen.
- **Tabellen-Ernte** ([tabellen.ts](src/plugins/antraege/aufbereitung/tabellen.ts)): Pipe-Tabellen-Parser, Klassifikation (`anlage5`/`ap-zeitplan-text`/`risiko`/`ap-taetigkeiten`/`auftraege-dritte`/`unbekannt`), Zeitplan-Normalisierung (Anlage-5-Datumswerte → M1 aus frühestem Beginn; VB-Monatszahlen inkl. `Laufzeit`-Range-Form) und `verglichZeitplaene` (Text↔Anlage-5-Plausibilität: `zeitraum-abweichung`/`nur-im-text`/`nur-in-anlage`/`horizont`).
- **Datenmodell + Storage** ([types.ts](src/plugins/antraege/aufbereitung/types.ts) / [store.ts](src/plugins/antraege/aufbereitung/store.ts)): ein `AufbereitungRun` pro Antrag im `kv`-Store unter `aufbereitung:<antragKey>` (Pitfall #29), Quellen gestempelt (`QuelleRef{name,hash,gelesenAm,rolle}`, Hash via `hashText`), `istVeraltet`-Check (nur Hinweis). VB via `resolveVb` (wiederverwendet); **Anlage 5** neu über FKZ-Tag + Dateiname-Regex `/anlage 5/i` + Ordner-Fallback ([quellen.ts](src/plugins/antraege/aufbereitung/quellen.ts)).
- **Route + Rahmen** ([Router.tsx](src/core/Router.tsx) / [AufbereitungPage.tsx](src/plugins/antraege/aufbereitung/AufbereitungPage.tsx)): flag-gated Child unter `ShellLayout`; Kopf (Zurück-Link + Titel/Meta + Quellen-Status + „Neu aufbereiten") + Section-Tab-Strip (aktiv = `--tf-text`-Unterstrich, DESIGN_GUIDE-konform, NICHT primary). Einstieg via Button auf [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx).
- **Zeitplan-Tab** ([ZeitplanTab.tsx](src/plugins/antraege/aufbereitung/ZeitplanTab.tsx) / [GanttZeitplan.tsx](src/plugins/antraege/aufbereitung/GanttZeitplan.tsx)): handgebauter SVG-Gantt (pure, **keine** Chart-Library) mit exaktem M1-Ursprung, Ober-AP-Klammern vs. solide Unter-AP-Balken (monochrom), Warning-Dot bei Zeitraum-Abweichung, Leerflächen-Annotation; Kennzahlen-Karte (Gesamt-PM ohne Doppelzählung, AP-/MA-Zahl, Quell-Hash) und Plausibilitäts-Sektion (Befund + Quellen-Chips + „Als offenen Punkt übernehmen").
- Verifiziert per `tsc --build` (grün) + `npx vitest run` (grün, inkl. 3 neuer Test-Suiten für Gliederung/Ernte/Store + Gantt-Render-Selbstprüfung) + Convention-Guards (theme-token-contract, no-parallel-scope-tabs, no-raw-async-onclick, no-raw-cta-fill, no-raw-modal) + `build:dev`/`build:pl`. Volle In-App-/`file://`-Abnahme gegen einen echten Antrag mit VB/Anlage 5 durch Thomas offen.

### v2.200.1 — Feedback-Board: Layout-Feinschliff (Toolbar, Kanban, kompaktere Liste) (Juli 2026)

PATCH — Vier Nachbesserungen am v2.199-Board nach dem ersten Blick am echten Datensatz. Nur Anordnung/Optik am öffentlichen Board, keine Daten-/Merge-/Service-Logik, keine Migration; Kurator-Ansicht unberührt.

- **Toolbar zweizeilig geordnet** ([FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)): Scope-Tabs (Alle/Von mir/Vom Team) stehen allein in Zeile 1; Suche + Sortier-Umschalter + Liste/Board-Toggle wandern in Zeile 2 nach rechts **neben die Typ-Filter-Chips** (statt in die Scope-Zeile).
- **Kanban ohne Lob-Spalte** ([FeedbackKanban.tsx](src/components/feedback/FeedbackKanban.tsx)): Das Board ist eine Status-Pipeline; Lob hat keinen Workflow und erscheint jetzt **nur noch in der Liste**, nicht mehr als Board-Spalte.
- **Kanban klarer abgegrenzt**: Jede Spalte sitzt in einer dezent getönten Lane (`--tf-bg-secondary`), die Mini-Karten heben sich als hellere Kacheln mit feiner Erhebung davon ab — Spalten und Karten verschwimmen nicht mehr.
- **Kompaktere Listen-Karten** ([FeedbackCard.tsx](src/components/feedback/FeedbackCard.tsx)): kurze Frage/Antwort-Paare stehen **nebeneinander** in zwei Spalten (statt gestapelt) und etwas straffere vertikale Abstände → niedrigere Karten, die freie rechte Fläche wird genutzt. Der Volltext bleibt im Detail-Drawer.
- Verifiziert per `tsc` + `npx vitest run` (grün) + Convention-Guards (theme-token-contract, no-parallel-scope-tabs, no-raw-cta-fill, screen-context-coverage) + `build:dev`/`build:pl`. Visuelle Abnahme am `file://`-Build durch Thomas offen.

### v2.200.0 — Einstellungen neu gestaltet: Sidebar-Navigation, 5 Gruppen, Suche (Juli 2026)

MINOR — Der Einstellungs-Bereich wurde nach dem Design-Handoff (`_design/handoff/einstellungen-gesamt`, „Variante B") neu aufgebaut: die horizontale 9-Tab-Leiste weicht einer **Settings-Sidebar** mit zwei Gruppen und **5 konsolidierten Panels** plus **Einstellungs-Suche**. Rein strukturell/visuell — keine Logik-/Datenmodell-Änderung, alle Feature-Flag-Sichtbarkeiten unverändert, keine Migration.

- **Neuer Rahmen** ([EinstellungenPage.tsx](src/plugins/einstellungen/EinstellungenPage.tsx), [SettingsNav.tsx](src/plugins/einstellungen/SettingsNav.tsx), [settingsPanels.tsx](src/plugins/einstellungen/settingsPanels.tsx)): links sticky Sidebar mit Suchfeld + Gruppen **Persönlich** (Profil, Meine Technologien) / **System** (Darstellung & Bedienung, KI-Assistent, Daten & Verbindungen), rechts das aktive Panel. Panel-/Such-Registry ist die Single Source of Truth; Sichtbarkeit der Panels/Abschnitte folgt exakt den bisherigen Flags (`isKuratorMenusEnabled`, `isLlmKontextSettingEnabled`, `isStreamlitBridgeEnabled`, `isDevContext`, `isOnlineStatusTabEnabled`, `isCsvAutoRefreshEnabled`).
- **Konsolidierung (9 → 5):** „Darstellung" + „Tastatur" → **Darstellung & Bedienung**; „Speicher" + „Dokumentenquellen" + „Tags" + „Online" → **Daten & Verbindungen**. „Online" heißt jetzt **Team-Status**. Die „Datenaktualisierung" (Letzter CSV-Import + „Jetzt aktualisieren") ist in die **Datenordner-Zeile** gefaltet — kein eigener Abschnitt mehr. Bestehende Kurator-/Dev-Abschnitte (Arbeitsverlauf, Verbundene Verzeichnisse, Verzeichnis hinzufügen inkl. OPFS) bleiben erhalten, nur neu gestylt.
- **Einstellungs-Suche** (`Strg + Komma` fokussiert): filtert ab 2 Zeichen einen aus der Registry abgeleiteten Index (Label + Synonyme inkl. **alter Tab-Namen** wie „speicher"/„online"/„tastatur" + Gruppenname), `↑/↓` + Enter oder Klick springt zum Abschnitt und hebt ihn ~1,8 s hervor (`.tf-settings-flash`, respektiert `prefers-reduced-motion`; Scroll via `scrollIntoView` + `scroll-mt` wegen des `overflow-y-auto`-Containers).
- **Einheitlicher Inhaltsstil:** alle Settings-Section-Header auf den Trailing-Hairline-`SettingsSectionHeader` (Caps 10.5px, tertiär) umgestellt; neue Bauteile `SettingsFileRow` (Handoff `.frow` — Icon-Kachel + Name·Wert + Status-Punkt + Aktionen) und `SettingsNoteCard` in [_shared/settings-primitives.tsx](src/plugins/einstellungen/_shared/settings-primitives.tsx). „Darstellung"-Inhalt in [DarstellungTab.tsx](src/plugins/einstellungen/DarstellungTab.tsx) ausgelagert; KI-Panel fasst „LLM & Reasoning" zusammen, die Interne-KI-Anleitung ist jetzt aufklappbar (`<details>`).
- Flash-Keyframe `tf-settings-flash` global in [theme.css](src/theme.css) (Light+Dark tokengespeist). Feedback-Kontext-Doc [einstellungen.md](docs/feedback-kontext/einstellungen.md) auf die neue Struktur gezogen.
- Verifiziert per `tsc --build` (grün) + `npx vitest run` (297 Dateien / 3102 Tests grün) + Convention-Guards (theme-token-contract, no-raw-cta-fill, no-parallel-scope-tabs, no-new-tf-ui-files u.a.) + `build:dev`/`build:pl`. Visuelle Abnahme am `file://`-Build (dev + pl) durch Thomas noch offen.

### v2.199.1 — Feedback: Dateien anhängen (PDF/Word/Excel/PowerPoint/CSV/TXT/MD) (Juli 2026)

PATCH — Beim Feedback-Geben lassen sich jetzt **Dateien neben Screenshots** anhängen (erläuterndes Dokument, Tabelle, Präsentation …). Additiv, keine Migration (Alt-Anhänge ohne `kind` gelten als Bild).

- **Erfassung** ([FeedbackFileInput.tsx](src/components/feedback/FeedbackFileInput.tsx), neu): eigener Bereich „Dateien anhängen" unter dem Screenshot-Bereich ([FeedbackInputStep.tsx](src/components/feedback/FeedbackInputStep.tsx)) — Upload + Drag&Drop, **Whitelist** (pdf, docx, xlsx, pptx, csv, txt, md) + **≤ 10 MB/Datei**, Liste mit Typ-Icon + Name + Größe + Entfernen. Screenshots (Paste/Annotieren) unverändert.
- **Anzeige** ([FeedbackFiles.tsx](src/components/feedback/FeedbackFiles.tsx), neu): im Board- + Kurator-Detail als **Download-Chips** (Typ-Icon + Name + Größe, Klick = Download via Object-URL, `file://`-tauglich). `FeedbackScreenshots` rendert nur noch Bilder; Karten zeigen ein Büroklammer-Zeichen bei angehängten Dateien.
- **Datenmodell/Storage:** `FeedbackAttachment` um `kind?: 'image'|'file'` + `name?` erweitert, `mime` auf `string` geweitet ([feedback.ts](src/core/types/feedback.ts)). Die Bytes laufen durch **dieselbe** Storage-/Outbox-/Merge-/Einsammel-Pipeline wie Screenshots (mime-agnostisch) — nur die Storage-Endung wird bei Dateien aus dem Original-Namen abgeleitet ([feedbackService.ts](src/core/services/feedback/feedbackService.ts)). Konstanten `FEEDBACK_FILE_TYPES` + `FEEDBACK_MAX_FILE_BYTES` + reine Validierung `validateFeedbackFile` in [feedbackAttachments.ts](src/components/feedback/feedbackAttachments.ts).
- Claude-Code-Prompt listet Screenshots + Dateien getrennt (`### Screenshots` / `### Dateien`).
- Verifiziert per `tsc` + `npx vitest run` (297 Dateien / 3102 Tests grün, inkl. neuer Validierungs-Tests) + Convention-Guards + `build:dev`/`build:pl`/`build:kurator`.

### v2.199.0 — Feedback-Board neu gestaltet: Karten, Votes, Kommentare, Kanban (Juli 2026)

MINOR — Das öffentliche Feedback-Board wurde nach dem Design-Handoff (`_design/handoff/feedback`) neu aufgebaut, plus zwei neue team-geteilte Features. Additiv/backward-kompatibel (neue optionale Felder auf `FeedbackItem`, keine Migration).

- **Neues Board-Layout** ([FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)): `PageHeader` „Feedback" + Zähler + Budget-Badge; Toolbar mit **Scope-Tabs** (Alle/Von mir/Vom Team, `ScopeTabs`), **Suche**, **Sortierung** (Neueste ↔ Meiste Votes), **Ansicht-Toggle Liste/Board**; **Typ-Filter-Chips** ([FeedbackTypeChips.tsx](src/components/feedback/FeedbackTypeChips.tsx), aktiv = `--tf-primary`). Ersetzt die frühere Split/Karten/Tabelle-Trias.
- **Scannbare Karten** ([FeedbackCard.tsx](src/components/feedback/FeedbackCard.tsx)): Typ-Icon-Quadrat, **Titel**, kompakte Q&A-Kurzzeilen (Kurz-Labels „Gemacht/Passiert/Möchte/…"), Status-Badge, Bereich-Chip, **Avatar** ([FeedbackAvatar.tsx](src/components/feedback/FeedbackAvatar.tsx), Farbe deterministisch aus Name), Kommentar-Zähler, Vote-Pill, Screenshot-Thumbnail (Lightbox). Eigenes Feedback mit Akzentstrich links.
- **Kanban-Board** ([FeedbackKanban.tsx](src/components/feedback/FeedbackKanban.tsx)): Spalten nach amtlichem `kurator_status` (Pitfall #12) + eigene Lob-Spalte.
- **Detail-Drawer** ([FeedbackBoardDetail.tsx](src/components/feedback/FeedbackBoardDetail.tsx)): Titel, Autor, alle Antworten ausgeschrieben, Screenshot, „Antwort vom Team", **Kommentar-Thread + Eingabe**, Sponsoring-Block (bleibt), **Vote-Footer**.
- **Votes (neu, budgetfrei)** — eine „Ich auch"-Stimme je Nutzer je Feedback, **getrennt** vom Sponsoring (beide bleiben). `FeedbackVote[]` auf `FeedbackItem`; Aktion `toggleVote` ([feedbackVoting.ts](src/core/services/feedback/feedbackVoting.ts)) spiegelt das Sponsor-Vote-Muster (shared-Write self-gated, Anti-Stale, Read-only-Prod → Outbox `vote-wuensche.json`, Merge `unionMergeVotes` + Collector `autoCollectFeedbackVotes` mit Retraktion).
- **Kommentare (neu)** — append-only Thread je Feedback, distinkt von `kurator_response`. `FeedbackComment[]`; Aktion `addComment` ([feedbackComments.ts](src/core/services/feedback/feedbackComments.ts)); Outbox `kommentar-outbox.json`, Merge `unionMergeComments` (union-by-id) + Collector `autoCollectFeedbackComments`.
- **Titel-Feld (neu)** — optionales „Titel"-Feld im Erfassungs-Formular ([FeedbackInputStep.tsx](src/components/feedback/FeedbackInputStep.tsx)); Bestands-Feedback fällt über `feedbackTitle()` auf die Hauptantwort zurück.
- **Kurator-Ansicht angeglichen**: Kurator-Liste ([FeedbackTicketRow.tsx](src/components/feedback/FeedbackTicketRow.tsx)) im neuen Karten-Look (Votes/Kommentare read-only + „Abhaken"-Knopf); Kurator-Detail ([FeedbackTicketDetail.tsx](src/plugins/feedback/sections/FeedbackTicketDetail.tsx)) zeigt Titel + Kommentar-Thread.
- Merge-Precedence (`mergeItems`) + `updateFeedback`-Whitelist um `title`/`votes`/`comments` erweitert; Collectors an denselben Stellen wie `autoCollectSponsorVotes` verdrahtet (Auto + Inbox-Tab).
- Verifiziert per `tsc --noEmit` (grün) + `npx vitest run` (296 Dateien / 3093 Tests grün, inkl. neuer Merge-/Präsentations-Tests) + Convention-Guards (theme-token-contract, no-parallel-scope-tabs, no-raw-cta-fill, no-raw-async-onclick, no-raw-modal, screen-context-coverage) + `build:dev`/`build:pl`/`build:kurator`. Am echten Datensatz visuell + Votes/Kommentare-Roundtrip (Prod-Outbox → Kurator-Einsammeln) noch abzunehmen.

### v2.198.5 — Förderanträge: Titel→Untertitel-Abstand auf 8px (Juli 2026)

PATCH — Feinschliff zu v2.198.4: Abstand Titel→Untertitel im Detailkopf von 10px (`mt-2.5`) auf 8px (`mt-2`) reduziert ([VerbundKopf.tsx](src/plugins/antraege/VerbundKopf.tsx), inkl. XSW-Fallback-Zweig). Reiner Spacing-Tweak.

### v2.198.4 — Förderanträge: Titel→Untertitel-Abstand auf 10px (Juli 2026)

PATCH — Feinschliff zu v2.198.3: Abstand Titel→Untertitel im Detailkopf von 12px (`mt-3`) auf 10px (`mt-2.5`) reduziert ([VerbundKopf.tsx](src/plugins/antraege/VerbundKopf.tsx), inkl. XSW-Fallback-Zweig). Reiner Spacing-Tweak.

### v2.198.3 — Förderanträge: Detailkopf luftiger (vertikaler Abstand) (Juli 2026)

PATCH — Der obere Teil der Verbund-Detailseite (Titelzeile · Untertitel · Stepper · Kurzbeschreibung) stand textlich vertikal zu gedrängt. Reine Abstands-Korrektur ([VerbundKopf.tsx](src/plugins/antraege/VerbundKopf.tsx) + [KurzbeschreibungCard.tsx](src/plugins/antraege/KurzbeschreibungCard.tsx)): Titel→Untertitel `mt-2`→`mt-3`, Untertitel-`leading` 1.5→1.6, Untertitel→Stepper `mt-3.5`→`mt-5`, Kopf-Unterrand `mb-4`→`mb-6`, Titelzeilen-Umbruch-`gap-y` 1→1.5, Karten-Label `mb-1.5`→`mb-2`. Keine Struktur-/Logik-Änderung.

### v2.198.2 — Förderanträge: Kurzbeschreibungs-Karte erscheint wieder zuverlässig (Juli 2026)

PATCH — Nachschliff zu v2.198.0: Auf der Verbund-Detailseite fehlte bei manchen Verbünden die Kurzbeschreibungs-Karte, sodass unter dem Kopf nur die dünne Titel-Zeile stand („zu kurz, nicht in einer Karte"). Zwei Ursachen behoben ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx) + [fieldLookup.ts](src/plugins/antraege/fieldLookup.ts)):

- **VB_INHALT über ALLE Teilvorhaben suchen** statt nur am Lead-TV (neuer Helfer `findFieldValueAcross`): Die Kurzzusammenfassung ist auf Verbund-Ebene gedacht, im CSV-Export aber oft nur an einem Partner-TV gefüllt — hatte der Lead sie leer, verschwand die Karte still.
- **Titel-Fallback für die Karte**: Fehlt eine eigene VB_INHALT-Kurzzusammenfassung ganz, tritt der Projekt-Titel als Karteninhalt ein — so erscheint **immer** eine Karte, solange es überhaupt Beschreibungstext gibt. Der Titel wird dann **nicht** zusätzlich als Untertitel-Zeile im Kopf wiederholt (Dedup gegen die Karte, `sameText` = trim + Whitespace + case-insensitiv), sonst stünde er doppelt.
- Verifiziert per `npm run typecheck` (grün) + `npx vitest run` + neuer Unit-Test [fieldLookup.test.ts](src/plugins/antraege/__tests__/fieldLookup.test.ts) (`findFieldValueAcross`: Partner-TV-Fallback, Reihenfolge, leere Strings) + `build:dev`/`build:pl`. Am echten Datensatz visuell abzunehmen.

### v2.198.1 — Feedback-Übersicht: Vorschau nach Fragen umgebrochen + „Dein Feedback" ganz links (Juli 2026)

PATCH — Die kompakte Feedback-Vorschauzeile (Feedback-Übersicht/Board, Split-Ansicht + Kurator-Liste — geteilte [FeedbackTicketRow.tsx](src/components/feedback/FeedbackTicketRow.tsx)) ist lesbarer:

- **„Dein Feedback"-Badge steht jetzt ganz links** (vor dem Kategorie-Badge) statt dazwischen.
- **Text nach jeder Frage umgebrochen**: Statt einer langen truncate-Zeile („Was hast du gemacht? … Was ist passiert? …") steht jetzt **je Frage-/Antwort-Paar eine Zeile** — die **Frage fett**, die Antwort normal. Bild-Icon + Datum wandern in die Badge-Zeile darüber.
- Neuer geteilter Helfer `feedbackQaSegments` ([feedbackUi.ts](src/components/feedback/feedbackUi.ts)): zerlegt ein Feedback in Frage/Antwort-Paare — **primär aus den strukturierten Formularfeldern** (`structured` + Labels aus `FEEDBACK_TYPES`, robust gegen mehrzeilige Antworten), mit Fallback auf den komponierten `text` (Alt-Tickets) bzw. `llm_summary` (Ein-Zeiler ohne Q&A). Ein-Feld-Typen (Lob/Frage) bleiben ohne Frage-Präfix.
- Verifiziert per neuem Unit-Test [feedbackQaSegments.test.ts](src/components/feedback/__tests__/feedbackQaSegments.test.ts) (7 grün) + `tsc --noEmit` + `build:dev`/`build:pl`.

### v2.198.0 — Förderanträge: Detailseite umgebaut + Kompaktliste nach Verbund gruppiert (Juli 2026)

MINOR — Die Verbund-Detailseite und die schmale Kompakt-Liste (bei geöffnetem Detail) wurden überarbeitet.

- **Kompaktliste nach Verbund gruppiert** ([KompaktListe.tsx](src/plugins/antraege/KompaktListe.tsx) + [kompaktRows.ts](src/plugins/antraege/kompaktRows.ts)): Bei geöffnetem Detail steht **ein Eintrag pro Verbund** statt einer Zeile je Teilvorhaben — die TVs eines Verbundes erscheinen ohnehin im Detail, sobald man den Verbund öffnet. Klick auf eine Verbund-Zeile öffnet den Verbund (`onOpenVerbund`), Solo-Anträge bleiben je eine eigene Zeile. Clustering über den geteilten `buildAntragGroups(mode:'verbund')`-Pfad (neue reine Helfer `buildKompaktGroups` / `filterKompaktGroups`, node-getestet). TV-Zähler (> 1) rechts neben dem Akronym; der Kopf-Zähler bleibt auf TV-Ebene (deckungsgleich zum Tab-Zähler).
- **Kurzbeschreibung wieder als Karte** ([KurzbeschreibungCard.tsx](src/plugins/antraege/KurzbeschreibungCard.tsx), neu): Die Kurzzusammenfassung (VB_INHALT) steht als eigene Karte direkt unter dem Kopf (4-Zeilen-Clamp + „Volltext lesen") statt inline in die Kopf-Beschreibung gemischt.
- **Eckdaten in die Titelzeile** ([VerbundKopf.tsx](src/plugins/antraege/VerbundKopf.tsx)): Programm/Typ · TV-Anzahl · Antragsdatum · Beantragt wandern hinter das FKZ in die Titelzeile; darunter der Projekt-Titel (Untertitel), dann der Stepper. Der Kopf trägt keine gemischte Titel-+-Inhalt-Beschreibung mehr.
- **Gutachten-Karte + -Sektion verschmolzen** ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx) + [ArtefaktLeiste.tsx](src/plugins/antraege/artefakte/ArtefaktLeiste.tsx) + [GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx)): Die frühere Gutachten-Übersichts-Karte entfällt; die volle Gutachten-Werkstatt rückt nach oben (direkt unter Kopf + Kurzbeschreibung). Der Fortschrittsbalken bleibt erhalten (jetzt im Sektionskopf, auch bei eingeklappter Sektion sichtbar), die „Weiter bei X"-Aktion über die bestehende Wiederaufnahme-Zeile. Die Artefakt-Leiste trägt nur noch die Nachforderung.
- **Sektionen umbenannt / gestrafft**: „Antragsdaten und Verbundpartner" → **„Antragsdaten"** (die redundante Verbundpartner-Tabelle entfällt — die Partner stehen ohnehin in der TV-Liste), „Teilvorhaben" → **„Verbundpartner und Teilvorhaben"** (die TV-Liste zeigt die Rolle Konsortialführer/Verbundpartner). Die Werkstatt-Rückzeile „← {Akronym} · {Phase}" über Gutachten/NF entfällt (redundant zu Kopf + Sektionstitel).
- Verifiziert per `npm run typecheck` (grün) + `npx vitest run` (290 Dateien / 3060 Tests grün, inkl. neuer `buildKompaktGroups`/`filterKompaktGroups`-Tests) + `build:dev`/`build:pl`. Am echten Datensatz visuell abzunehmen.

### v2.197.2 — Auslastung MA: Altlasten-Rampe gedreht — ältestes = kräftigste Farbe (Juli 2026)

PATCH — Folgeschliff zu v2.197.1: Nachdem die Segmente chronologisch laufen (ältestes links), folgt jetzt auch die **Farbe** dem Alter — das älteste Band (Q-3–7, links) ist am dunkelsten/prominentesten, das jüngste (Q-1, rechts) am hellsten. Umgesetzt durch Vertauschen der `--tf-altlast-band-1`↔`-band-3`-Tokens (Fläche + Text, Light + Dark) in [theme.css](src/theme.css); Band-2 unverändert. Alle Konsumenten (Tabelle, Karten, Legende, Inline-Liste) folgen automatisch über [altlast-colors.ts](src/plugins/auslastung/views/uebersicht/altlast-colors.ts) (Fallback-Werte + Doku mitgezogen).

### v2.197.1 — Auslastung MA: Altlasten-Segmente chronologisch (ältestes links) (Juli 2026)

PATCH — Die Segmente im Altlasten-Balken (Tab „Auslastung MA") laufen jetzt chronologisch links→rechts: **ganz links die ältesten Quartale (Q-3–7), dann Q-2, rechts Q-1 (neuestes)** — umgekehrt zur ersten Fassung von v2.196.0. Reine Reihenfolge; die Farbe je Band bleibt unverändert (dunkel = neu). Gedreht in [ColBars.tsx](src/plugins/auslastung/views/uebersicht/ColBars.tsx) (`AltlastColBar`, Tabelle), [GesamtauslastungBar.tsx](src/plugins/auslastung/views/uebersicht/GesamtauslastungBar.tsx) (Karten-Balken + Tooltip) und der Legende in [MaTileGrid.tsx](src/plugins/auslastung/views/uebersicht/MaTileGrid.tsx) (Swatch-Reihenfolge + Label „alt → neu").

### v2.197.0 — Auslastung MA: Balken-Spalten-Grenze „Altlasten ↔ Aktuelles Quartal" ziehbar (Juli 2026)

MINOR — In der MA-Tabelle („Auslastung MA") lässt sich die Grenze zwischen den beiden Balken-Spalten „Altlasten (Rückstand)" und „Aktuelles Quartal" per Griff verschieben — wer die Altlasten-Spalte schmaler will, zieht die Kante nach links; die frei werdende Breite bekommt „Aktuelles Quartal". Breite pro Rechner persistiert (localStorage), Doppelklick auf den Griff setzt auf den 30-%-Default zurück.

- [MaTable.tsx](src/plugins/auslastung/views/uebersicht/MaTable.tsx): `table-layout: fixed` + `<colgroup>`; die Altlasten-Spalte trägt die einzige variable Breite (`--altlast-w`, Default 30 %), „Aktuelles Quartal" ist `auto` und füllt den Rest → schmalere Altlasten = breiteres Aktuelles Quartal. Resize-Griff an der Spaltenkante (Muster wie `SortableTable`); Live-Drag mutiert **nur** die CSS-Var am `<table>` (kein Row-Re-Render — Zeilen sind memoized), Commit on mouseup über [useColumnWidths](src/components/data-table/useColumnWidths.ts) (`auslastung_ma_colwidths`). Untergrenze 96px, Obergrenze hält „Aktuelles Quartal" ≥ 150px. Header kürzen bei schmaler Spalte mit Ellipse; Status-Spalte auf 124px verbreitert (unter fixed-layout bräche „Ohne Buchung" sonst um).
- [MaCompactRow.tsx](src/plugins/auslastung/views/uebersicht/MaCompactRow.tsx): feste Zellbreiten der Balken-Zellen entfernt (das `<colgroup>` ist unter `table-layout: fixed` autoritativ); Altlasten- + MA-Zelle clippen (`overflow: hidden`).
- Verifiziert per `npm run check` (Typecheck + 3053 Tests grün) + `build:dev`/`build:pl`. Drag/Persistenz/Reset visuell noch am echten Datensatz abzunehmen.

### v2.196.0 — Auslastung MA: zwei getrennte Balken-Spalten + gedämpfte Blau-Rampe (Design-Handoff) (Juli 2026)

MINOR — Der Tab „Auslastung MA" übernimmt die Balken-Darstellung aus dem Design-Handoff `_design/handoff/auslastung-balken` (Layout C). Die frühere **eine** Spalte „Auslastung" (zwei gestapelte Balken) + separate Spalte „Belegt %" weicht **zwei nebeneinanderliegenden Balken-Spalten** mit je eigener linker Grundlinie: „Altlasten (Rückstand)" und „Aktuelles Quartal". Die warme Gelb→Orange→Rot-Altanträge-Rampe (Severity-/Ampel-Konnotation, kollidierte mit Status-/Kategorie-Farben) weicht einer **gedämpften Blau-Rampe** auf dem Primär-Hue (dunkel = neu → hell = alt); Zahlen stehen jetzt in den Balken.

- **Zwei Balken-Spalten** ([ColBars.tsx](src/plugins/auslastung/views/uebersicht/ColBars.tsx), neu): `AltlastColBar` skaliert die Rückstand-Summe relativ zum größten Rückstand aller sichtbaren MAs (`maxBl`, in [MaTable.tsx](src/plugins/auslastung/views/uebersicht/MaTable.tsx) je gefilterter Liste berechnet) → direkter Zeilenvergleich; Zahl je Segment ab ≥ 10 % Anteil. `AktuellColBar` bleibt bewusst **Kapazitäts-Auslastung %** (rot bei Überbuchung > 100 %, belegt % im Balken) — der %-Wert wandert aus der entfallenen Spalte „Belegt %" in den Balken.
- **Spalten** ([MaCompactRow.tsx](src/plugins/auslastung/views/uebersicht/MaCompactRow.tsx)): MA · Altlasten (Rückstand) · Aktuelles Quartal · Aktuell · Altlast. · Frei · Kat. · Status · ⋮. „Aktuelles Quartal" mit Akzent-Header + Zonentrenner links; Aktuell/Altlast./Frei in Akzent/Sekundär/Primär gefärbt.
- **Palette app-weit** ([altlast-colors.ts](src/plugins/auslastung/views/uebersicht/altlast-colors.ts) → neue Tokens `--tf-altlast-band-1/2/3(-text)` + `--tf-akt-bar` in [theme.css](src/theme.css), Light+Dark, alle über `--tf-primary-h`): Karten-Sicht ([GesamtauslastungBar.tsx](src/plugins/auslastung/views/uebersicht/GesamtauslastungBar.tsx)), Kachel-Legende ([MaTileGrid.tsx](src/plugins/auslastung/views/uebersicht/MaTileGrid.tsx)) und Inline-Altlasten-Liste ([AltlastInlineList.tsx](src/plugins/auslastung/views/AltlastInlineList.tsx)) übernehmen die Blau-Rampe **und** die neu-links-Reihenfolge (Q-1 dunkel links → Q-3–7 hell rechts).
- Verifiziert per `npm run check` (Typecheck + Vitest grün) + `build:dev`/`build:pl`. Visuelle Abnahme im Tab „Auslastung MA" (Light + Dark) gegen die Handoff-Referenz steht noch aus (App braucht SMB-Daten zum Rendern).

### v2.195.0 — Auslastung: Embedding-Score fließt wieder ins MA-Ranking ein (alpha aus absoluter Konfidenz) (Juli 2026)

MINOR — Folgeschritt zu v2.194.5. Der Stage-2-Embedding-Score beeinflusste das MA-Ranking faktisch **nie**: `computeAlpha` bandete den pool-**normalisierten** BM25-Score, und weil `runBm25Matching` durch den Pool-Max teilt (Top-MA also immer exakt `1.0`), war `alpha` bei jedem nicht-leeren BM25 = `1.0`. Im Blend `alpha*bm25 + (1-alpha)*emb` fiel der Embedding-Anteil damit weg; der `0.5`-Zweig war toter Code. Jetzt bandet `computeAlpha` ein **absolutes** Signal — die Profil-Coverage `deckung ∈ [0,1]` (Anteil der distinkten Profil-Tokens des besten Kandidaten, die im Query vorkommen) — sodass `alpha` wieder variiert (1.0 / 0.5 / 0.2) und der Embedding-Score bei schwacher/mittlerer lexikalischer Evidenz ins Ranking einfließt (wie ursprünglich vorgesehen).

- [bm25-matcher.ts](src/plugins/auslastung/services/matching/bm25-matcher.ts): `runBm25Matching` liefert pro MA zusätzlich `deckung` (Profil-Coverage, un-normalisiert); `score` bleibt die relative Rangordnung.
- [matching-engine.ts](src/plugins/auslastung/services/matching/matching-engine.ts): `computeAlpha` bandet `max(deckung)` gegen `BM25_DECKUNG_HOCH = 0.5` / `BM25_DECKUNG_MITTEL = 0.2` (Kalibrier-Knöpfe, an Echtdaten justierbar). Bei starken lexikalischen Treffern (Coverage ≥ 0.5) bleibt `alpha = 1.0` → dortiges Ranking **unverändert**; nur schwächere Treffer verschieben sich (Embedding blendet ein). Der Score-Beitrag `emb` bleibt wie in v2.194.5 alpha-gegated (`emb = alpha < 1.0 ? … : 0`) — bei `alpha = 1.0` also weiterhin 0.
- **Lektion (wiederkehrende Bug-Klasse):** ein POOL-normalisierter Wert (Top immer `1.0`) darf nie gegen ABSOLUTE Schwellen (`> 0.5` „high") gebandet werden — die Bedingung ist sonst trivial wahr. Das Schwellen-Signal muss un-normalisiert sein.
- `computeAlpha`-Unit-Tests auf die Coverage-Semantik umgestellt (inkl. Regressionsfall „Top-Score 1.0 aber niedrige Coverage → 0.2"); volle Auslastungs-Suite grün (722 Tests). **Ranking-Verschiebung an Echtdaten prüfen** (Vorher/Nachher im Zuweisungs-Cockpit, `alpha` im PASSUNG-Breakdown variiert jetzt); Schwellen bei Bedarf nachziehen.

### v2.194.5 — Auslastung: „ähnliche Projekte" erscheinen wieder (Anzeige vom Ranking-Gate entkoppelt) (Juli 2026)

PATCH — Im Zuweisungs-Cockpit („Anträge zuweisen") zeigte seit dem Quartalswechsel **jede** MA-Karte für **jeden** Antrag „keine ähnlichen Projekte", obwohl das Matching (PASSUNG, matchende Technologien) funktionierte und der Themen-Vektoren-Korpus frisch war. Ursache: `aehnlicheProjekte` ist eine reine **Anzeige**-Liste, wurde aber technisch nur in der Embedding-**Scoring**-Stufe befüllt — und die läuft nur bei `alpha < 1.0`. Da `runBm25Matching` auf `[0,1]` normalisiert (Top-MA immer exakt `1.0`), liefert `computeAlpha` bei **jedem** nicht-leeren BM25-Ergebnis `alpha = 1.0` → Embedding-Stufe übersprungen → Liste leer. Mit über das Quartal gewachsenen MA-Profilen trifft BM25 inzwischen praktisch immer → die Anzeige verschwand flächendeckend (deshalb half auch der Korpus-Neuaufbau nicht: der Korpus ist gesund, er wurde nur nie gelesen).

- [matching-engine.ts](src/plugins/auslastung/services/matching/matching-engine.ts) `scorePool`: die Embedding-Stufe läuft jetzt, sobald `stage2Aktiv` + `queryEmbedding` + Korpus + `antraegeIndex` vorhanden sind (Bedingung `alpha < 1.0` entfernt) → `aehnlicheProjekte` werden wieder gefüllt. **Score-Parität gewahrt:** der Embedding-Beitrag `emb` fließt weiterhin nur bei `alpha < 1.0` ins Ranking (`emb = alpha < 1.0 ? … : 0`) — `finalScore`/`embeddingScore` bleiben byte-identisch, es kommt ausschließlich die Anzeige-Liste hinzu.
- [VorschlagRow.tsx](src/plugins/auslastung/components/VorschlagRow.tsx) unverändert (rendert `aehnlicheProjekte` bereits korrekt). Kein Korpus-Neuaufbau nötig.
- Regressionstest ([matching-engine.test.ts](src/plugins/auslastung/__tests__/matching-engine.test.ts)): starker BM25-Match (`alpha=1.0`) + ähnliches Alt-Projekt → `aehnlicheProjekte` gefüllt, `embeddingScore` bleibt 0 (Parität). Volle Auslastungs-Suite grün (722 Tests).
- Hinweis: dass der Embedding-Score wegen dieser BM25-Normalisierung faktisch **nie** ins Ranking einfließt, ist ein separater, tiefer liegender Qualitäts-Punkt und folgt als eigener, eval-abgesicherter Schritt (v2.195).

### v2.194.4 — Suche: Ergebnistabelle staucht Spalten statt sofort zu scrollen (Juli 2026)

PATCH — Bei breit aufgezogenem Assistent-Panel lief die Suchergebnis-Tabelle sofort in einen horizontalen Scrollbalken und rechte Spalten wurden abgeschnitten, statt sich zu stauchen. Ursache: `table-layout: fixed` nimmt als genutzte Breite das GRÖSSERE aus `width` und der **Summe der `<col>`-Breiten** (CSS 2.1 §17.5.2.1) — mit festen Pixel-Spalten war das ein harter Boden, den `width: min(100%, …)` nicht unterschreiten konnte (der reine `min(100%)`-Vorversuch blieb deshalb wirkungslos).

- [SearchResultsTable.tsx](src/plugins/suche/SearchResultsTable.tsx): Die `<col>` werden als **Prozent** der Pixel-Summe (`totalWidth`) gerendert statt als Pixel. Dann ist die Spaltensumme = 100 % der Tabellenbreite (kein Pixel-Boden), und `width: min(100%, totalWidth)` + `min-width`-Floor (`RESPONSIVE_MIN_WIDTH = 720`) stauchen die Spalten proportional, sobald der Bereich schmaler wird (z.B. breites Assistent-Panel); erst unter dem Floor greift der horizontale Scrollbalken. Die *bevorzugten* Breiten bleiben Pixel im State — Spalten-Resize + Persistenz unverändert.
- `applyLiveColumnWidth` rechnet die neue Gesamtbreite direkt aus `columns`/`columnWidths` (statt `parseFloat` über die DOM-`<col>`-Styles, das Prozent-Werte als Pixel fehlgedeutet hätte) und setzt beim Live-Drag ebenfalls Prozent-Cols + `min()`-Tabellenbreite — konsistent zum committeten Render, kein Overflow-Flackern beim Ziehen.
- Verifiziert per Chrome-Layout-A/B (900px-Container: Pixel-Cols → Tabelle 1400px + Scroll; Prozent-Cols → Tabelle 900px, Spalten gestaucht) + 54 suche-Tests + `build:dev`/`build:pl`. Doc-Kommentar im Dateikopf erklärt die greater-of-W-and-column-sum-Falle.

### v2.194.3 — Gutachten: Zitat↔Satz-Verknüpfungs-UI im Werkstatt-Layout (Journey-Paket 4, Phase 6) (Juli 2026)

MINOR — Der „Antragsbezug" im Gutachten-Werkstatt-Panel (dev, Feature-Flag `gutachtenWorkflow`) zeigt die Quellen-Belege jetzt als **Karten mit Satz-Zuordnung** statt als flache Zitat-Wand: Hover verbindet Beleg ↔ Satz, Klick pinnt zum gestützten Satz. Mockup `_reference/journey-paket-4/zitat-text.png`. Vollständig additiv — Alt-Läufe (ohne `belege`) rendern exakt wie bisher.

- **Beleg-Karten** ([BelegKarten.tsx](src/plugins/antraege/gutachten/BelegKarten.tsx), im [KontextPanel.tsx](src/plugins/antraege/gutachten/KontextPanel.tsx)): Zitat + `Abschn. x.y` links, „stützt Satz {n}" / „Sätze {n}, {m}" rechts (1-basierte Anzeige); ohne gültige Zuordnung → gedämpft „ohne Zuordnung" + Tooltip. Ohne `belege`-Feld → flaches `MarkdownRenderer`-Rendering wie heute.
- **Hover (flüchtig)** verbindet beidseitig: Beleg-Karte hovern → zugeordnete Sätze im Entwurf amber ([--tf-beleg-highlight](src/theme.css), Light+Dark, nur Hintergrund — kein Layout-Shift); Satz-Span hovern → zugehörige Karten highlighten. Reine, getestete Zuordnung in [belege.ts](src/plugins/antraege/gutachten/belege.ts) (`belegeFuerSatz`/`belegBetrifftSaetze`, **dieselbe** `splitSentences`).
- **Klick pinnt** über den **bestehenden** `fundstelle`-Mechanismus (kein zweiter Scroll-/Highlight-Pfad); bei mehreren Sätzen zyklisch. Darunter der **Abdeckungs-Zähler** „{x} von {y} Sätzen mit Beleg verknüpft".
- **Satz-Alignment + Live-Degradation**: alle Nummerierung über `splitSentences(finalerText)`. Nach manueller Textbearbeitung liegen manche Indizes außerhalb → sie fallen beim Rendern auf „ohne Zuordnung" zurück (Anzeige-Logik, keine Datenänderung); der Zähler rechnet mit dem Live-Text. `StepRun.belege` bleibt bei manueller Bearbeitung erhalten (anders als `teile`).
- Zuordnungs-/Abdeckungs-/Degradations-Logik getestet ([belege.test.ts](src/plugins/antraege/gutachten/__tests__/belege.test.ts)). CLAUDE.md um den `QuellenBeleg`-Kontrakt + die 1-/0-basiert-Konvention + Eval-Gate-Kriterien ergänzt.

### v2.194.2 — Gutachten: Beleg-Kontrakt-Rollout für Bestands-Shares (Journey-Paket 4, Phase 5) (Juli 2026)

PATCH — Eval-Gate gefahren (reduziert: gpt-oss-120b-**Proxy**, n=6 fiktive Fixtures, Judge Sonnet 4.6). Ergebnis: der Beleg→Satz-Kontrakt funktioniert (A 97 % / B 95 % gültige Referenzen, 91–95 % Satz-Abdeckung); A-Judge stabil (+0,08), B knapp unter der Schwelle (−0,25, getrieben von 1 Ausreißer-Fixture bei n=6); der eine erlaubte Instruktions-Retry verschlechterte A deutlich und wurde verworfen (V1 beibehalten). **Entscheidung** (dokumentiert in [eval/paket4-eval-report.md](eval/paket4-eval-report.md)): V1 akzeptiert, Rollout vollzogen; ein Voll-Eval auf dem Produktions-Qwen (`--limit 20`) bleibt als Bestätigung empfohlen.

- **Marker-gesicherte Rollout-Migration** ([migrations.ts](src/core/services/skills/registry/migrations.ts)): `reconcileEinmaligeAktivierungen` wendet jetzt eine **Liste** einmaliger Migrationen an (append-only); neu `GA_BELEG_KONTRAKT_MIGRATION` — hebt A/B `promptTemplate` auf Bestands-Shares auf den Neu-Stand + Version 2, aber **NUR wenn der Stand exakt dem Vor-Paket-4-Template gleicht** (`buildKurzfassungPrompt(false)` / `abschnittTemplate(B_ABSCHNITT_OPTS)`) — **kuratierte Edits bleiben unberührt** (Pitfall/Anti-Pattern: Seed-Migration überschreibt Kurator-Skills nie).
- **Trigger** ([useAnfrageAnonAktivierung.ts](src/plugins/anfragen/useAnfrageAnonAktivierung.ts)): reconcilt jetzt ALLE ausstehenden Registry-Migrationen (nicht nur die Anonymisierer-Freischaltung); das Feature-Gate umfasst zusätzlich die Gutachten-Varianten; das Audit-Log hält die angewandten Marker fest.
- **Eval-Scaffolding** (reproduzierbar, dev-only): OpenRouter-/Lokal-Modell-Configs, Baseline-Registry-Generator, Beleg-Metrik-Skript, Bericht — alle unter `eval/`.
- Migrations-Kuratorenschutz getestet ([migrations.test.ts](src/core/services/skills/registry/__tests__/migrations.test.ts)): pristine A/B → migriert; editiert → unberührt; Marker einmalig; beide Migrationen zusammen.

### v2.194.1 — Gutachten: Skill-Kontrakt A + B um Satz-Referenzen erweitert (Journey-Paket 4, Phase 4) (Juli 2026)

PATCH — Die Abschnitts-Skills A (Kurzfassung) und B (Ausgangslage) instruieren das Modell jetzt, jedes Zitat der Quellenanalyse mit der gestützten Satz-Referenz abzuschließen (` → stützt Satz N`, 1-basiert). Kein Nutzer-sichtbarer Effekt (die UI folgt in Phase 6); die Wirksamkeit für Bestands-Shares ist bis zum Eval-Gate (Phase 5) zurückgehalten.

- **Template-Ergänzung (nur A + B):** der `### Quellenanalyse`-Kontrakt trägt den knappen Satz-Referenz-Zusatz + ein Beispiel ([seed.ts](src/core/services/skills/registry/seed.ts)). Der A-Prompt kommt jetzt aus dem Builder `buildKurzfassungPrompt(belegKontrakt)`, B aus `abschnittTemplate({ …, belegKontrakt: true })`. **C–G bleiben byte-identisch** (`belegKontrakt` default `false`) — gegen den Vor-Paket-4-Stand verifiziert. Seed-Version A + B → `2`; `### Finaler Text`-Kontrakt und B's Nicht-`teilStruktur`-Entscheidung unverändert.
- **Rollout gestaffelt:** `mergeMissingSeeds` überschreibt bestehende Skills NIE — der Seed-Edit erreicht Bestands-Shares also NICHT von selbst, nur `SEED_REGISTRY` (neue Installationen + der Eval-Lauf, der gegen Seeds auflöst). Die marker-gesicherte Rollout-Migration für Bestands-Shares (überschreibt A/B nur, wenn der Share-Stand `buildKurzfassungPrompt(false)` bzw. `abschnittTemplate(B_ABSCHNITT_OPTS)` gleicht → **kuratierte Edits bleiben unberührt**) wird erst nach bestandenem Eval-Gate (Phase 5) verdrahtet.
- Template-Snapshot getestet ([seed-belegkontrakt.test.ts](src/core/services/skills/registry/__tests__/seed-belegkontrakt.test.ts)): Instruktion in A + B vorhanden, C–G ohne, `buildKurzfassungPrompt(false)` = Alt-Stand.

### v2.194.0 — Gutachten: strukturierte Quellen-Belege im Parser (Journey-Paket 4, Phase 3, additiv) (Juli 2026)

MINOR — Rein additive Parser-Erweiterung als Grundlage der Zitat↔Satz-Verknüpfung (die UI folgt in Phase 6). Der Skill-Parser versteht jetzt Zitat-Zeilen der Quellenanalyse mit Satz-Referenz-Suffix; alles Bestehende bleibt byte-identisch. Kein Nutzer-sichtbarer Effekt in dieser Version.

- **Format-Kontrakt:** eine Zitat-Zeile darf mit ` → stützt Satz {n}` bzw. ` → stützt Sätze {n}, {m}` enden (deutsch, 1-basiert). [parse.ts](src/core/services/skills/run/parse.ts) liest daraus `ParsedSkillOutput.belege?: QuellenBeleg[]` (`{ zitat, abschnittRef?, satzIndizes }`); die flache `quellenanalyse` bleibt UNVERÄNDERT befüllt (Rückwärtskompatibilität, Alt-Läufe, Anzeige-Fallback).
- **Konvention (überall dokumentiert):** Format **1-basiert**, `satzIndizes` intern **0-basiert** (aligned zu `data-satz-index` + `CheckResult.fundstellen`), validiert gegen `splitSentences(finalerText).length`; ungültige/außerhalb-liegende Referenzen → `satzIndizes: []` („ohne Zuordnung"). Nutzt das Modell den neuen Kontrakt NICHT (keine `→ stützt`-Zeile) → gar keine Belege (`belege` undefiniert = heutiges flaches Rendering, nie regressiv). Der Parser wirft NIE.
- **`StepRun.belege?`** additiv (kein Schema-Bump): fließt `parseSkillOutput` → `GenerationInput` ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)) → `applyGeneration` ([runner.ts](src/plugins/antraege/gutachten/runner.ts)). Bleibt bei manueller Text-Bearbeitung ERHALTEN (anders als `teile`, das verworfen wird) — Grundlage für die Live-Degradation veralteter Indizes in der Phase-6-UI.
- Parser-Matrix getestet ([parse-belege.test.ts](src/core/services/skills/run/__tests__/parse-belege.test.ts)): ein/mehrere Sätze, Pfeil-Variante, ohne Suffix, ungültiger Index, gemischte Zeilen, Alt-Format ohne Referenzen, Round-Trip der flachen `quellenanalyse`.

### v2.193.0 — Suche: positiver Leerzustand + dezenter Index-Hinweis (Journey-Paket 4, Phase 2) (Juli 2026)

MINOR — Der Leerzustand der **Suche** zeigte bisher nur eine karge Diagnose-Zeile („N Textabschnitte im Index · M Anträge geladen") — inklusive der für Nutzer verwirrenden „0 Textabschnitte", wenn kein Dokumentenindex vorliegt. Neu betont der Leerzustand, was AKTIV geht (die Antragssuche), mit klickbaren Beispielen; der fehlende Dokumentenindex ist nur noch eine dezente Info-Zeile OHNE Handlungsaufforderung (Index-Einrichtung ist Kurator-Aufgabe). Mockup `_reference/journey-paket-4/suche-leerzustand.png`.

- **Neue Komponente** [SucheLeerzustand.tsx](src/plugins/suche/SucheLeerzustand.tsx): Titel „{n} Anträge durchsuchbar" (aus `indexInfo.antraegeGeladen`, NICHT der Textabschnitt-Zahl), ein Satz zu den Suchfeldern, 3 klickbare Beispiel-Chips (thematisch · FKZ · Mehrwort), zwei dezente Hinweis-Items (Verlauf, Assistent). Beispiel-Chip-Klick läuft über EXAKT denselben Suchpfad wie getippte Eingaben (`setQuery` + `addRecentSearch`, inkl. Verlaufs-Eintrag).
- **Index-Hinweis** nur bei leerem Index (`textabschnitteImIndex === 0`), abgesetzt über Trennlinie, `text-muted` + Info-Icon, KEIN Button/Anleitung/Kurator-Verweis im Text. Ausnahme Kurator-Build (`kuratorMenus` + `dokumentenscan`): zusätzlich dezenter Link „Dokumentenquellen öffnen" → `/kuration/dokumentenquellen`.
- **Konsolidierung** der zwei Diagnose-Zeilen-Vorkommen in EINE [IndexInfoZeile.tsx](src/plugins/suche/IndexInfoZeile.tsx) (reine, getestete `buildIndexInfoText`): die Zahl „0 Textabschnitte" wird Nutzern NIE mehr angezeigt (Segment fällt bei leerem Index weg). Stammdaten-/Substring-Suche funktioniert im Leerzustand voll — Tippen blendet den Leerzustand aus.

### v2.192.0 — Einstellungen: „Meine Technologien" — einheitliche Toggle-Chips (Journey-Paket 4, Phase 1) (Juli 2026)

MINOR — Der Tab **„Meine Technologien"** (Einstellungen) mischte drei verschiedene Chip-Stile (farbcodierte `KategoriePill`, Inline-Buttons, durchgestrichene Auto-Tags) und markierte gesperrte Chips mit `opacity-40` (wirkt wie „disabled", DESIGN_GUIDE Kap. 5 / Pitfall #14). Alle Toggle-Gruppen laufen jetzt über EIN neutrales `ToggleChip` mit drei klaren Zuständen (an / aus / nicht wählbar). Reine Darstellungs-/Interaktionsänderung — Datenmodell + Auto-Save („Automatisch gespeichert") unverändert. Mockup `_reference/journey-paket-4/einstellungen-chips.png`.

- **Neue Komponente** [ToggleChip.tsx](src/components/ui/ToggleChip.tsx) (domänenfrei, `src/components/ui/`): **an** = Surface-Füllung + Häkchen (Single-Select-Hauptkategorie `variant='dark'` = dunkle Voll-Füllung zur Unterscheidung); **aus** = Outline / `text-secondary`, KEIN Durchstreichen, kein Icon; **nicht wählbar** = gedämpft + `title`-Tooltip (kein `opacity-40`). Layout-stabil (Häkchen-Slot immer gerendert, im Aus-Zustand `invisible`), `aria-pressed`. Der dunkle Fill trägt eine `// allow-cta-fill`-Ausnahme (Toggle-Pill, kein Klick-CTA).
- **Rewire** [MeineTechnologienTab.tsx](src/plugins/einstellungen/MeineTechnologienTab.tsx): Hauptkategorie, Ergänzende Erfahrungen, Antragstypen und „Aus deinen bisherigen Anträgen" nutzen jetzt alle `ToggleChip`. `KategoriePill` / `AutoTagToggleWand` bleiben für ihre Auslastungs-Verwendung ([MaInlineDetail.tsx](src/plugins/auslastung/views/MaInlineDetail.tsx)) unangetastet — das Durchstreichen ist nur im Einstellungen-Tab weg (dort war es via die geteilte Komponente sichtbar).
- **„Aus deinen bisherigen Anträgen"**: Kopf zeigt Gesamtzahl + rechtsbündig „{n} gewählt"; die Chip-Wand ist initial auf ~10 gekürzt mit „+ N weitere"-Aufklapper — **gewählte Chips bleiben IMMER sichtbar** (Kürzung trifft nur ungewählte). Reine, getestete Kürzungs-Logik in [autoTagVisibility.ts](src/plugins/einstellungen/autoTagVisibility.ts).
- `SettingsSectionHeader` um optionalen rechtsbündigen `right`-Slot ergänzt ([settings-primitives.tsx](src/plugins/einstellungen/_shared/settings-primitives.tsx)); `truncateWZ` aus `AutoTagToggleWand` exportiert (Reuse ohne Render-Änderung).

### v2.191.2 — Auslastung: MA-Detail — „Auslastung pro Antragstyp" mit „Aktuelle Buchung" verschmolzen (Juli 2026)

PATCH — Im aufgeklappten MA-Detail (Tab „Detail") stand die Karte **„Auslastung pro Antragstyp"** bisher voll-breit *über* dem Zwei-Spalten-Block; die kurze linke Karte „Aktuelle Buchung" ließ daneben viel vertikalen Leerraum, während rechts die (oft lange) Altanträge-Spalte stand. Beide sind jetzt zu **einer** Karte in der linken Spalte verschmolzen — die Antragstyp-Balken sitzen über der Buchungsliste, getrennt durch eine feine Linie. Spart vertikalen Platz, füllt die sonst leere Spalte. Reiner Layout-Tweak, keine Datenänderung.

- **Merge in der linken Spalte** ([MaInlineDetail.tsx](src/plugins/auslastung/views/MaInlineDetail.tsx)): Die voll-breite Antragstyp-Karte entfällt; ihr Inhalt wandert als Sektion in die „Aktuelle Buchung"-Karte (darüber, mit dünnem Trenner). `VerbundSection` wurde in einen chrome-freien `VerbundBody` (Headline + Liste + Footer) und den Karten-Wrapper gesplittet, damit sich Sektionen ohne doppelte Karten-Umrandung verschmelzen lassen. Rechte Spalte („Eigene Eintragungen (pending)" + Altanträge) unverändert.

### v2.191.1 — Auslastung: Altanträge-Balken umgedreht (ältestes/Rot links) + gedämpfte Farben (Juli 2026)

PATCH — Feinschliff am alters-gestaffelten Altanträge-Balken (Tab „Auslastung MA", eingeführt in v2.190.0). Reiner Optik-Tweak, keine Datenänderung.

- **Segment-Reihenfolge umgedreht** ([GesamtauslastungBar.tsx](src/plugins/auslastung/views/uebersicht/GesamtauslastungBar.tsx)): Der Balken liest jetzt **ältestes zuerst** — links **Rot** (Q-3…Q-7) → **Orange** (Q-2) → **Gelb** (Q-1) rechts. Das Dringlichste liegt vorn; der Tooltip schlüsselt in derselben Reihenfolge auf.
- **Farben gedämpft** ([altlast-colors.ts](src/plugins/auslastung/views/uebersicht/altlast-colors.ts)): Sättigung der 3-Farben-Rampe zurückgenommen (Gelb/Orange/Rot weicher, weiterhin in Light + Dark lesbar).
- **Balken 1 px dicker** (4 → 5 px, beide Balken in Tabelle + Karte); die Karten-Legende folgt der neuen Balken-Reihenfolge (Rot → Orange → Gelb = „alt → neu") ([MaTileGrid.tsx](src/plugins/auslastung/views/uebersicht/MaTileGrid.tsx), [MaTile.tsx](src/plugins/auslastung/views/uebersicht/MaTile.tsx)).

### v2.191.0 — Flächen-System „Desk & Blatt": Arbeitsbereich schwebt als weißes Blatt (Juli 2026)

MINOR — App-weites Chrome-Redesign aus dem Design-Handoff [_design/handoff/homepage](_design/handoff/homepage/README.md) (Option E · Neutral · Trennung 65 %). Sidebar und Arbeitsbereich teilten sich bisher exakt dasselbe Weiß → flache Wirkung, keine Zonierung. Neu: Die **Sidebar liegt transparent auf einer leicht getönten grauen Grundfläche** (dem „Desk"), der **Arbeitsbereich schwebt als abgerundetes weißes „Blatt"** mit Haarlinie + dezentem Schatten darüber. Klare Trennung Navigation ↔ Arbeit, ohne dass Text je auf getönter Fläche steht. Rein visuell, additiv, keine Datenmigration; gilt für **alle** Screens (Shell-Prinzip).

- **Neue Surface-Tokens** ([theme.css](src/theme.css), Light + `[data-theme="dark"]`): `--tf-desk` (Grundfläche `#F4F4F4`, Dark `#222220` — dunkler als das Blatt, damit es hell darüber schwebt), `--tf-sheet` (Blatt = trackt `--tf-bg`), `--tf-sheet-border` (`#EDEDED`), `--tf-sheet-shadow` (zwei weiche Lagen), `--tf-card-surface` (Karten `#FBFBFB`), `--tf-nav-active-bg`/`--tf-nav-active-border` (aktives Item als kleines weißes Blatt). Alle global definiert → Guard `theme-token-contract` erfüllt.
- **Shell** ([ShellLayout.tsx](src/core/ShellLayout.tsx)): App-Wurzel bekommt den Desk-Grauton; die Sidebar wird transparent (zeigt den Desk); der `<main>`-Bereich schwebt als Blatt (`margin:10px 12px 10px 0`, `border-radius:14px`, Haarlinie, Schatten, Scroll bleibt im inneren Container → klippt an den runden Ecken). Das **aktive Sidebar-Item** ist jetzt ein kleines weißes Blatt (bg + Haarlinie) statt der Primary-Light-Füllung + linker Akzent-Kante — hebt sich vom grauen Desk ab (Base-Border transparent hält die Zeilenhöhe konstant, `aria-current="page"` ergänzt). Der Resize-Teiler verliert seine sichtbare Kante (Desk-Spalt + Blatt-Rahmen trennen die Zonen).
- **Home-Karten** ([EingangAmpelCard.tsx](src/plugins/home/EingangAmpelCard.tsx), [AiAssistantCard.tsx](src/plugins/home/AiAssistantCard.tsx)): Antragseingang- und AI-Assistent-Karte nutzen den neuen `--tf-card-surface`-Ton (kaum sichtbare Absetzung auf dem Blatt) statt `--tf-bg-secondary`.
- Home- und Förderanträge-Inhalte bleiben unverändert — sie erben das neue Flächen-System automatisch über die Shell (die zwei Handoff-Screens sind Demonstrationen desselben Chrome-Prinzips im dünnen Dashboard- wie im dichten Tabellen-Fall).

### v2.190.1 — Suche: Assistent-Panel ohne festen Breiten-Deckel (Juli 2026)

PATCH — Das andockende **Assistent**-Panel rechts in der Suche ließ sich per Teiler bisher nur bis **560 px** aufziehen. Der feste Deckel entfällt: Das Panel ist jetzt — analog zum List↔Detail-Split der Förderanträge — bis fast zum Fensterrand ziehbar (die Ergebnis-Tabelle behält eine Mindestbreite und verschwindet nie). Reiner UX-Tweak, keine Datenmigration.

- **Dynamischer Max statt 560-px-Deckel** ([assistentPanel.ts](src/plugins/suche/assistentPanel.ts)): `ASSISTENT_MAX_WIDTH` entfällt; neu ist `ASSISTENT_TABELLE_MIN` (360 px, für die Tabelle reservierte Mindestbreite). `clampAssistentWidth(v, viewportWidth)` und das neue `effectiveAssistentWidth(width, viewportWidth)` delegieren an die generischen `clampDragWidth`/`effectiveListWidth` aus [master-detail](src/components/master-detail/masterDetailLayout-logic.ts) (dieselbe Klemm-Mathematik wie Förderanträge, keine Duplikat-Logik). `parseAssistentWidth` akzeptiert jetzt Werte oberhalb des früheren 560-Deckels; eine für ein kleineres Fenster zu breite gespeicherte Breite deckelt die Render-Klemme.
- **Viewport-Tracking + Render-Klemme** ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx)): neuer `viewportWidth`-State + Resize-Listener (1:1 aus `MasterDetailLayout`); der Drag-Handler reicht die Fensterbreite an den Clamp durch, und die `<aside>`-Breite wird beim Rendern über `effectiveAssistentWidth` gegen das aktuelle Fenster geklemmt. Der bereits vorhandene 4-px-Resize-Teiler und `chat.css` bleiben unverändert.
- Tests angepasst ([assistentPanel.test.ts](src/plugins/suche/__tests__/assistentPanel.test.ts)): dynamischer Max, kein fester Oberbound in `parseAssistentWidth`, neue `effectiveAssistentWidth`-Fälle.

### v2.190.0 — Auslastung: Altanträge-Balken alters-gestaffelt eingefärbt (Juli 2026)

MINOR — Im Tab „Auslastung MA" ist der bisher **graue** Altanträge-Balken jetzt **nach Alter der offenen Anträge eingefärbt** (Gelb → Orange → Rot = je älter desto dringlicher), und ältere Anträge (bis zu 7 Quartale zurück) werden mit einbezogen. Additiv, keine Datenmigration.

- **Dringlichkeits-Bänder** ([altlast.ts](src/plugins/auslastung/services/kapazitaet/altlast.ts)): neuer reiner Helper `quartalBand(antragQ, aktuellesQ)` stuft jeden offenen Altantrag relativ zum aktuellen Quartal ein — Band 1 = Q-1 (letztes Quartal), Band 2 = Q-2 (vorletztes), Band 3 = Q-3…**Q-7** (älter). Anträge älter als Q-7 werden **gekappt** (nicht mehr gezählt). Der Filter zählt jetzt Q-1…Q-7 statt nur Q-1/Q-2 (vorher: alles > 2 Quartale unsichtbar) → die „Altanträge"-Summe + Tabellen-Spalte „ALTANTRÄGE" wachsen entsprechend. `MaAltlastBucket` trägt additiv `tvsProBand: [number, number, number]` (Summe = `tvs`), `AuslastungVerbund` ein optionales `altlastBand` ([quartals-auslastung.ts](src/plugins/auslastung/services/kapazitaet/quartals-auslastung.ts)).
- **Segmentierter Balken** ([GesamtauslastungBar.tsx](src/plugins/auslastung/views/uebersicht/GesamtauslastungBar.tsx)): Balken 2 („Altanträge") ist jetzt **ein pill-geclippter Track mit bis zu 3 farbigen Segmenten** (Gelb Q-1 → Orange Q-2 → Rot Q-3+), proportional zur Band-Zusammensetzung; der Tooltip schlüsselt die TVs je Band auf. Kein Layout-Shift (Track wie bisher immer gerendert). Rampe zentral in [altlast-colors.ts](src/plugins/auslastung/views/uebersicht/altlast-colors.ts) (`ALTLAST_BAND_COLORS`/`ALTLAST_BAND_LABELS`), geteilt von Balken, Legende und Inline-Liste; ersetzt die frühere einzelne graue `ALTLAST_COLOR`-Konstante.
- **Legende + Inline-Liste** ([MaTileGrid.tsx](src/plugins/auslastung/views/uebersicht/MaTileGrid.tsx), [AltlastInlineList.tsx](src/plugins/auslastung/views/AltlastInlineList.tsx)): Karten-Legende (Kopf + Fuß) zeigt statt eines grauen Swatches die 3-Farben-Rampe „Altanträge (neu → alt)"; die Altanträge-Detail-Liste bekommt pro Zeile einen Dringlichkeits-Farbpunkt.
- Tests erweitert ([altlast.test.ts](src/plugins/auslastung/__tests__/altlast.test.ts): `quartalBand`-Grenzfälle inkl. Q-7/Q-8-Kappung, `tvsProBand`-Verteilung) + Feedback-KI-Kontext nachgezogen ([docs/feedback-kontext/auslastung.md](docs/feedback-kontext/auslastung.md)).

### v2.189.0 — Feedback-Übersicht: Sidebar-Zugang zurück + eigenes Feedback hervorgehoben (Juli 2026)

MINOR — Das öffentliche **Feedback-Board** ist wieder direkt aus der Sidebar erreichbar, und in der Liste ist das **eigene Feedback** markiert, damit man den Bearbeitungs-Status seiner Tickets verfolgen kann. Additiv, keine Datenmigration.

- **Fußzeilen-Icon → Board** ([ShellLayout.tsx](src/core/ShellLayout.tsx)): Das (bisher zum FAB doppelte) Feedback-Icon in der Sidebar-Fußzeile öffnet jetzt **direkt die Feedback-Übersicht** (`/feedback-board`) statt des Geben-Dialogs — mit passenderem Icon (`MessagesSquare`) + Tooltip „Feedback-Übersicht". Feedback *geben* bleibt auf dem globalen FAB unten rechts. Der ungenutzte `useFeedbackDialog`-Import wurde entfernt. Das Board-Plugin bleibt `hideFromNav` (kein Nav-Menüpunkt); die Route ist unverändert registriert.
- **„Mein Feedback"-Sicht + Hervorhebung** ([FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)): neuer Filter-Chip „Sicht: Alle/Mein Feedback" (mit Zähler, im bestehenden `CollapsibleSeg`-Idiom, in localStorage `tf-feedback-board-mine-filter`). Das eigene Feedback (`user_id == profile.name`) ist in **allen drei Ansichten** markiert — Split-Liste ([FeedbackTicketRow.tsx](src/components/feedback/FeedbackTicketRow.tsx)) + Karte ([FeedbackBoardCard.tsx](src/components/feedback/FeedbackBoardCard.tsx)) mit Primary-Akzent + „Dein Feedback"-Badge, Tabelle ([FeedbackBoardListView.tsx](src/components/feedback/FeedbackBoardListView.tsx)) mit „Du"-Chip in der „Von"-Spalte. Identität wie beim bestehenden „Mein Feedback"-Tab; anonyme Absender (kein Profilname) matchen bewusst nicht — dann ist der „Sicht"-Chip ausgeblendet und nichts hervorgehoben.
- Feedback-KI-Kontext nachgezogen ([docs/feedback-kontext/feedback-board.md](docs/feedback-kontext/feedback-board.md)).

### v2.188.0 — VB-Kontext: 80k-Default + Server-Auto-Detect, „zu lang"-Warnung beim Konvertieren (Juli 2026)

MINOR — Behebt, dass eine ~50k-Token-Vorhabensbeschreibung trotz 80k-Kontextfenster des internen llama.cpp gekürzt wurde. Ursache: die App hatte einen **eigenen** Kontext-Default von **62.000** Tokens (las `config-chat-qwen.json` nie) → Zeichen-Cap `(62000−4096)×3 = 173.712`; dt. Text mit Tabellen läuft ~4 Zeichen/Token, sprengt das. Additiv, keine Datenmigration; die per-Maschine-`localStorage`-Einstellung bleibt gültig.

- **Default 80k + Auto-Detect** ([llm-context.ts](src/core/services/ai/llm-context.ts)): `DEFAULT_LLM_CONTEXT_TOKENS` **62_000 → 81_920** (= Config `kontext_groesse`) → Cap `233.472` Zeichen. Neue Präzedenz **manuell > erkannt > Default** über einen zweiten Key `teamflow_llm_context_detected` (`setDetectedLlmContextTokens`/`clearManualLlmContextTokens`/`getLlmContextSource`). `RESERVE_TOKENS`/`CHARS_PER_TOKEN` bewusst unverändert (die 3er-Quote ist die Sicherheitsmarge).
- **`/props`-Probe** ([direct-llm.ts](src/core/services/ai/transports/direct-llm.ts)): neue `getContextWindow()` liest `default_generation_settings.n_ctx` vom laufenden llama.cpp-Server (gleiche Fetch-/CORS-Bahn wie `getActiveModel()`; Bridge/OpenRouter/nicht erreichbar → `null` → Fallback). In [AIProviderTab.tsx](src/plugins/einstellungen/AIProviderTab.tsx): Button **„Vom Server erkennen"** (`useAsyncAction`) + **„Auf Automatik zurücksetzen"** + Quelle-Anzeige; best-effort Auto-Probe beim Provider-Speichern.
- **Warnung beim Konvertieren statt nachträglich** — die große gelbe „…wurde gekürzt — der Schluss floss nicht ein"-Meldung nach der Generierung ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx), [ReviewCard.tsx](src/plugins/antraege/kurzfassung/ReviewCard.tsx)) weicht einem **dezenten Marker** („⚠ auf gekürzter VB-Basis", Detail im Tooltip). Die laute Warnung erscheint jetzt **beim Hochladen/Prüfen** ([KonvertierungReviewDialog.tsx](src/core/components/KonvertierungReviewDialog.tsx) + [DokumentAufnahme.tsx](src/core/components/DokumentAufnahme.tsx), Check über `vbUeberschreitetCap(markdown, getVbCharCap())`) mit dem „extern kürzen & neu hochladen"-Hinweis. Die proaktiven Section-Banner ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx), [KurzfassungSection.tsx](src/plugins/antraege/kurzfassung/KurzfassungSection.tsx)) sind auf eine kompakte Zeile entschärft.
- **Bilder** — sichtbar gemacht, dass eingebettete Bilder bei der Konvertierung verworfen werden (0 Tokens, nie die Ursache): [DokumentAufnahme.tsx](src/core/components/DokumentAufnahme.tsx) zeigt „🖼 N Bilder ignoriert · N Tabellen als Text" direkt in der Aufnahme-Zeile.
- **Batch-Bugfix** ([useBatchJob.ts](src/plugins/antraege/gutachten-batch/useBatchJob.ts)): der Batch-Lauf reicht jetzt `vbCharCap: getVbCharCap()` durch (nutzte zuvor den statischen Fallback statt der Einstellung). Statischer Fallback `VB_CHAR_CAP` 86_000 → 233_000 + Kommentar-Korrektur ([run-skill.ts](src/core/services/skills/run/run-skill.ts)).
- **Bewusst offen (Folge-Task):** In-App-Teil-Analyse (Chunking) für Dokumente jenseits des Kontextfensters; Auto-Detect über die Streamlit-Bridge (kein HTTP-Endpoint probebar → dort greift der 80k-Default).
- Tests: [llm-context.test.ts](src/core/services/ai/__tests__/llm-context.test.ts) (80k-Default, Cap 233.472, Präzedenz manuell/erkannt/Default, clamp, Quelle), [direct-llm-stream.test.ts](src/core/services/ai/__tests__/direct-llm-stream.test.ts) (`getContextWindow`: `/props`-URL ohne `/v1`, `n_ctx`-Fallback, non-ok/Netzwerkfehler/ungültig → null).

### v2.187.0 — Journey-Paket 3 Phase 4: Fundstellen + „Anzeigen"-Sprung zum Satz (Juli 2026)

MINOR — Lokalisierbare Befunde (`verbotenes_muster`, z.B. Passiv-Floskeln) bekommen im Prüfpanel einen **„Anzeigen"**-Link, der im Entwurf **zum beanstandeten Satz springt** und ihn ~2 s hervorhebt. Additiv, keine Datenmigration; alte gespeicherte Läufe ohne das Feld bleiben gültig.

- **`CheckResult.fundstellen?`** ([check-engine.ts](src/core/services/skills/registry/check-engine.ts)): der `verbotenes_muster`-Handler sammelt jetzt **alle** Treffer-Sätze (eine Fundstelle je Satz, 0-basierter `satzIndex` über `splitSentences` — dieselbe Segmentierung, die das UI zum Highlighten nutzt) statt nur des ersten. Bei **genau einem** Treffer ist das `detail` byte-identisch zum Bestand; bei mehreren „N Stellen (u.a. …)". Additiv, kein Schema-Bump.
- **Neuer Token `--tf-highlight`** ([theme.css](src/theme.css), Light + Dark) — weiches Warm-Gelb; das temporäre Satz-Highlight (`.g-satz-hl`, [gutachten.css](src/plugins/antraege/gutachten/gutachten.css)) blendet per CSS-Transition rückstandslos aus.
- **Satzweise adressierbarer Entwurf** ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)): der Entwurf wird als `data-satz-index`-Spans gerendert (neue reine [satzSegmente.ts](src/plugins/antraege/gutachten/satzSegmente.ts) über der **geteilten** `splitSentences`-Funktion; Inline-Markdown je Satz via `marked.parseInline`, Absätze über `whitespace-pre-wrap` erhalten). In der Teile-Darstellung laufender globaler Offset je Teil. Der „Anzeigen"-Klick scrollt zum Satz + highlightet (nonce-getriggert, zyklisch bei mehreren Stellen: „Anzeigen (N)"). Edit-Modus / nicht-adressierbar → graceful no-op; Highlight wird beim Abschnittswechsel verworfen.
- **„Anzeigen"-Link** ([CheckList.tsx](src/plugins/antraege/kurzfassung/CheckList.tsx)) an `hinweis`/`fehler`-Zeilen mit nicht-leeren `fundstellen`; die Hinweis-Zeile trägt Titel aus Regel-Name + Stellen-Anzahl (Mockup „Passiv-Floskel — 1 Stelle"). `verbotenes_muster` behält seine „kein KI-Button"-Regel — nur Anzeigen.
- Tests: [check-engine.test.ts](src/core/services/skills/registry/__tests__/check-engine.test.ts) (ein/mehrere Treffer, erster+letzter Satz, **Segmentierer-Gleichheit Engine↔UI**, Detail-Byte-Identität bei einem Treffer), [satzSegmente.test.ts](src/plugins/antraege/gutachten/__tests__/satzSegmente.test.ts) (Index-Alignment, Rekonstruktion, Absatz-Sep, `segmentierungAligned`, `zyklischerIndex`).

### v2.186.0 — Journey-Paket 3 Phase 3: Prüfpanel — Schweregrad, Inline-KI-Aktion, Offline (Juli 2026)

MINOR — Das Gutachten-Prüfpanel ([gutachten-pruefpanel.png]) bekommt die Mockup-Darstellung: `ok` grüner Haken, `hinweis` amber Punkt, **`fehler` als zarte rote Karte** mit Messwert/Limit + Inline-**„Mit KI korrigieren/kürzen/erweitern"**-Button. Die Kopfzeile zählt jetzt `{f} Fehler · {h} Hinweise` statt „{n} offen". Der lose Offline-Warnsatz weicht einer positiven Zeile. Additiv, keine Datenmigration. Bewusste Mockup-Abweichung: der „Erneut prüfen"-Footer wird **nicht** gebaut — Checks laufen bereits automatisch bei Generieren/Editieren/Restore.

- **CheckList opt-in `aktion`** ([CheckList.tsx](src/plugins/antraege/kurzfassung/CheckList.tsx)): ohne `aktion` **byte-identisch** zum Bestand (schützt die 4 weiteren Konsumenten ReviewCard/VersionVerlauf/QsHinweisList); mit `aktion` (nur der Gutachten-`KontextPanel`) die Schweregrad-Darstellung. Die Fehler-Karte zeigt Titel (Regel-Name), Messwert/Limit mono, Detail und — wenn `regelKorrekturAnweisung` ≠ null — einen `ghost sm`-Button mit Sparkles-Icon; während eines Laufs Spinner + disabled, offline disabled mit `title="KI nicht erreichbar"`. **`verbotenes_muster` bekommt keinen KI-Button** (Stil-Entscheidung bleibt beim Gutachter).
- **Verdrahtung ohne Parallel-Leitung** ([GutachtenSection.tsx](src/plugins/antraege/gutachten/GutachtenSection.tsx) → [KontextPanel.tsx](src/plugins/antraege/gutachten/KontextPanel.tsx)): der Button-Klick geht über die **bestehende** `ctrl.modify`-Leitung — `onKorrektur(c, k)` ruft `ctrl.modify(aktiverAbschnitt, k.modifier, { anweisung, regelId })` (Phase 2). Dadurch: Vorfassung (Undo) + Auto-Re-Check **gratis**. `regelFor` löst die auslösende Regel per `c.regelId` gegen die aktiven Regeln auf.
- **Kopfzeilen-Summary** (neue reine [pruefSummary.ts](src/plugins/antraege/gutachten/pruefSummary.ts)): `{f} Fehler` (danger) + `{h} Hinweise` (warning), bei 0 ausgeblendet.
- **Offline** ([SectionReviewCard.tsx](src/plugins/antraege/gutachten/SectionReviewCard.tsx)): der lose Satz „KI nicht erreichbar — …" weicht der positiven Zeile „Offline: manuell bearbeiten und prüfen weiter möglich." (Stift-Icon). Die deterministische Prüfung + manuelle Bearbeitung laufen offline unverändert; die KI-Buttons sind disabled.
- **Styling** ausschließlich über bestehende Tokens (`--tf-danger-soft/-border/-text`, `--tf-warning-text`, `--tf-success-text`) + `g-btn ghost sm` — keine neuen Hex-Farben, keine neuen Tokens.
- **Testansatz (Default statt Rückfrage):** das Repo hat keine React-Render-Test-Infra; die „Rendering-Matrix" ist auf **Logik-Ebene** abgedeckt (`pruefSummary`, `regelKorrekturAnweisung`/`regelLimit` aus Phase 1) — [pruefSummary.test.ts](src/plugins/antraege/gutachten/__tests__/pruefSummary.test.ts). Kein neuer Test-Stack.

### v2.185.0 — Journey-Paket 3 Phase 2: Regel-Kontext im Modify-Pfad (Juli 2026)

MINOR — Der bestehende Modifier-Lauf (Neu/Kürzer/Länger) kann jetzt eine **regel-gebundene Zusatz-Anweisung** mitführen — die konkrete Korrektur-Vorgabe aus Phase 1. Ergebnis läuft wie jeder Modify durch Vorfassung + Auto-Checks (Undo + Re-Check **gratis**, nichts zusätzlich gebaut). Keine UI-Änderung (Verdrahtung folgt in Phase 3). Additiv, keine Datenmigration.

- **`SkillRunInput.zusatzAnweisung?`** ([run-skill.ts](src/core/services/skills/run/run-skill.ts)): `composeSkillPrompt` hängt sie — nur wenn gesetzt — als eigene Zeile `Zusätzliche Vorgabe: …` **unmittelbar NACH** dem Modifier-Block (`## Zusätzliche Anweisung`) an. Sie **verschärft** den Modifier (ersetzt ihn nicht); die Kompositions-Rangfolge (Template → Tweak → Formale Vorgaben → Struktur → vorheriger Text → Modifier) bleibt unangetastet. Ohne Wert byte-identisch zum Bestandslauf. **Entscheidung (statt Rückfrage):** Injektion nach dem Modifier, damit die Regel-Vorgabe als letztes/spezifischstes Signal steht.
- **Durchreichung** ([useGutachtenWorkflow.ts](src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)): `modify(stepId, modifier, kontext?: KorrekturKontext)` → `runGeneration` → `generateInto` → `runSkill({ zusatzAnweisung })`. `KorrekturKontext = { anweisung; regelId? }` — die `anweisung` (aus `regelKorrekturAnweisung`) wird zur `zusatzAnweisung`, die `regelId` zur Nachvollziehbarkeit. Transport-Ping, Vorfassung (`appendVerlauf`), Auto-Re-Check (`runRegelChecks` nach Generieren) **unverändert**.
- **`StepRun.korrekturRegelId?`** (additiv, [types.ts](src/plugins/antraege/gutachten/types.ts) + `GenerationInput` → `applyGeneration`, [runner.ts](src/plugins/antraege/gutachten/runner.ts)): hält fest, welche Regel den Lauf ausgelöst hat — **nur Anzeige**, kein Verhalten. Round-Trip-sicher (Voll-JSON-Persistenz, kein Whitelist), alte Runs bleiben gültig.
- Tests: [compose-prompt.test.ts](src/core/services/skills/run/__tests__/compose-prompt.test.ts) (Platzierung nach dem Modifier, No-op ohne/whitespace, Regression byte-identisch), [runner.test.ts](src/plugins/antraege/gutachten/__tests__/runner.test.ts) (`korrekturRegelId` persistiert / absent).

### v2.184.0 — Journey-Paket 3 Phase 1: Regel→Korrektur-Ableitung + Messwert (Juli 2026)

MINOR — Substrat für das Gutachten-Prüfpanel ([gutachten-pruefpanel.png]): aus einem verletzten Check + seiner Regel deterministisch ableiten, OB und WIE die KI korrigieren kann. Reine Funktion, kein LLM, keine UI-Änderung (Verdrahtung folgt in Phase 3). Additiv, keine Datenmigration.

- **Neue reine Ableitung** ([korrektur.ts](src/core/services/skills/registry/korrektur.ts), Stil-Vorbild `kategorien.ts`): `regelKorrekturAnweisung(check, regel): RegelKorrektur | null` bildet einen verletzten `CheckResult` + seine `QualitaetsRegel` auf einen **bestehenden** `SkillModifierKey` (`neu`/`kuerzer`/`laenger`) + deutsche Zusatz-Anweisung mit Zielwert (aus `regel.params`) + Ist-Wert (aus `check.messwert`) + Button-Label ab. Größen-Regeln richtungsabhängig (`zu_lang`→kürzen, `zu_kurz`→erweitern); `satzlaenge_max`/`pflicht_anfang`/`keine_aufzaehlungen`→`neu`; **`verbotenes_muster`→`null`** (bekommt in Phase 4 „Anzeigen", Stil-Entscheidung bleibt beim Gutachter); unbekannte Typen / `pruefart` `fachlich`|`administrativ` / fehlende Pflicht-Parameter → `null` (nie werfen). `regelLimit(regel, richtung?)` liefert den Zielwert für die Mono-Anzeige „{ist} / {limit}".
- **Messwert additiv in der Check-Engine** ([check-engine.ts](src/core/services/skills/registry/check-engine.ts)): `CheckResult.messwert?: number` (+ internes `CheckOutcome`-Feld) — die Größen-Handler (`zeichen_max`/`wortanzahl`/`satzanzahl`/`absatz_min`) befüllen den gemessenen Ist-Wert (auch bei `ok`); `runRegelChecks` spreadt ihn wie `richtung`. **Kein Schema-Bump**, kein `detail`-String-Parsen mehr nötig, alte gespeicherte Checks bleiben gültig. `absatz_min` bleibt bewusst **ohne** `richtung` (kein Eingriff in `chooseRetryModifier`); die Korrektur-Ableitung behandelt es als Min-Regel per Typ.
- **Contract-Regel (neu):** die Zusatz-Anweisung ist eine ZUSATZ-Anweisung auf dem bestehenden Modifier-Pfad — hier werden **keine** neuen Modifier-Keys erfunden.
- Tests: [korrektur.test.ts](src/core/services/skills/registry/__tests__/korrektur.test.ts) (tabellengetrieben je Typ × zu_lang/zu_kurz/ok × fehlende Params → null, Wortlaut mit Zielwerten; `regelLimit`), Messwert-Assertions in [check-engine.test.ts](src/core/services/skills/registry/__tests__/check-engine.test.ts).

[gutachten-pruefpanel.png]: _reference/journey-paket-3/gutachten-pruefpanel.png

### v2.183.0 — Anfragen: Antwort formatiert kopieren + Ein-Klick-Mail, „Glätten" raus (Juli 2026)

MINOR — Die Antwort-/Finalisierungs-Leiste der Anfrage-Antwort ([AntwortView.tsx](src/plugins/anfragen/AntwortView.tsx)) ist auf den echten Outlook-Workflow zugeschnitten: die externe ZIM-FAQ-Antwort kommt als **Markdown**, wurde bisher aber nur als **Plain-Text** kopiert (rohe `**`-Marker in Outlook), und die Direkt-Mail scheiterte quasi immer an der mailto-Body-Grenze. Additiv, keine Datenmigration.

- **Rich-Text-Kopie** (neu [clipboard.ts](src/plugins/anfragen/services/clipboard.ts)): `copyAntwortReich` wandelt die finale Antwort per `marked` + `sanitizeHtml` (Reuse aus [MarkdownRenderer.tsx](src/components/ui/MarkdownRenderer.tsx)) in HTML und legt sie als `text/html` + `text/plain` via `ClipboardItem` ab → Outlook/Word übernehmen fette Überschriften + Absätze statt roher Marker. Fallback auf `writeText` bei fehlendem `ClipboardItem`-Support (nie schlechter als bisher). Der Knopf „Finale Antwort kopieren" zeigt bei Erfolg kurz einen **Haken**.
- **Ein-Klick „Kopieren & Mail öffnen"**: kopiert die formatierte Antwort UND öffnet einen adressierten Leer-Entwurf (An + „Re:"-Betreff, **kein** Body) — der User fügt nur noch mit Strg+V ein. Die frühere Meldung „Antwort zu lang für Direkt-Mail" entfällt: der mailto-Body war die falsche Transportgrenze (~1800 Zeichen nach URL-Encoding, von de-anonymisierten Antworten fast immer überschritten). [mailto.ts](src/plugins/anfragen/services/mailto.ts) trägt jetzt nur noch `buildMailtoLeer` (`buildMailto`/`mailtoBodyZuLang`/`MAILTO_MAX_BODY` entfernt).
- **„Vor dem Einsetzen intern glätten" entfernt**: die Checkbox + der dahinterliegende interne KI-Polish (`polishAntwort`/`POLISH_SKILL`) sind raus; [finalisierung.ts](src/plugins/anfragen/services/finalisierung.ts) `finalisiere()` ist jetzt rein deterministisch (Find-Replace, kein LLM). Die Anfrage-Antwort hat damit **keinen KI-Pfad mehr** — Kopieren/Mail sind vollständig lokal.
- Export-Guard: die neuen `clipboard.writeText`-/`mailto:`-Stellen tragen den `// allow-anfrage-export:`-Marker (finale, bewusst de-anonymisierte Antwort an den Original-Absender, kein externer Leak). Tests: [mailto.test.ts](src/plugins/anfragen/services/__tests__/mailto.test.ts) auf `buildMailtoLeer` umgestellt.

### v2.182.0 — Journey-Paket 2 Phase 8: Kompakt-Listenmodus bei offenem Detail (Juli 2026)

MINOR — Wenn ein Antrag/Verbund im Split geöffnet ist, schrumpfte die Liste bisher zur **schmaler skalierten Voll-Tabelle** (resizable). Neu: eine dedizierte **Kompakt-Spalte** (Mockup [split-kompaktliste.png]) — feste ~230px, eine Zeile pro Antrag (Ampel-Punkt · Akronym · relative Frist), aktive Zeile im **exakten Sidebar-Nav-Aktiv-Stil**. Additiv, keine Datenmigration.

- **Neue reine Logik** ([kompaktRows.ts](src/plugins/antraege/kompaktRows.ts)): `kompaktLabel` (Akronym → Aktenzeichen-Fallback), `matchesKompaktFilter` / `filterKompaktItems` (clientseitiger Substring-Sicht-Filter auf Label + Aktenzeichen, **kein** Eingriff in Facetten/Sidebar-Filter/Hybrid-Suche/Sortierung), `buildKompaktRow` (Zeilen-VM: Label + relative Frist über das bestehende `fristAnzeige`; terminal/fristlos → `frist: null` = leerer rechter Slot).
- **Kompakt-Komponente** ([KompaktListe.tsx](src/plugins/antraege/KompaktListe.tsx)): Kopf mit schmalem Client-Filter-Feld (`Filtern …`) + Einklapp-Icon (Liste → „Anträge einblenden"-Leiste) + View-Label mit Zähler (`OFFEN · 47`). Zeile = Ampel-Punkt + Akronym (Ellipsis + `title`) + relative Frist rechts, **beide gefärbt aus `AMPEL_COLOR`** (im Gegensatz zur grauen Tabellen-Frist — bewusst, damit die Dringlichkeit in der dichten Spalte lesbar bleibt). Aktive Zeile trägt **exakt** den Sidebar-Nav-Aktiv-Stil (Links-Balken `--tf-primary` + `--tf-primary-light`-Fläche + `--tf-text` + `font-medium`; der 2px-Balken ist bei jeder Zeile transparent reserviert → kein Layout-Shift). FKZ- und Formel-Spalte werden hier **nicht** gerendert. Lokale Pagination + Auto-Scroll zur aktiven Zeile. **Keine neuen Tokens.**
- **Umschaltung** ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx)): im Narrow-Modus (Detail offen) rendert die Kompakt-Spalte bei fester Breite `KOMPAKT_WIDTH = 232` statt der resizable Voll-Tabelle. Reihenfolge/Umfang bleiben die der Vollansicht (`filtered`, bereits Toolbar-sortiert). Der frühere Narrow-Resize (`teamflow_antraege_narrow_width` + Drag-Handle + Viewport-Cap) ist entfallen.
- **Scroll-Stand erhalten:** Da der Narrow-Modus einen anderen Teilbaum rendert (der Voll-Scroll-Container wird aus-/eingehängt), sichert ein `onScroll`-Ref den Stand der Voll-Tabelle und stellt ihn per `useLayoutEffect` beim Zurückschalten wieder her — Schließen des Details bringt die volle Tabelle **an der vorherigen Scroll-Position** zurück.
- **Abweichung/Default:** (1) Feste 230px statt resizable — der Plan verlangt „Breite fix ~230px"; der frühere Resize entfällt ersatzlos. (2) Das Kopf-Icon **klappt die Liste ein** (bestehende `onCollapse`-Affordanz, matcht das Mockup-Panel-Icon) — „zurück zur vollen Tabelle" bleibt über die Detail-Schließen-Aktion (X) erreichbar. (3) Der Client-Filter ist transient (lebt nur während das Detail offen ist); der Zähler zeigt den gefilterten Sicht-Umfang.
- Tests: [kompaktRows.test.ts](src/plugins/antraege/__tests__/kompaktRows.test.ts) (Label-Fallback, Substring-Filter case-insensitiv auf Akronym + Aktenzeichen, Reihenfolge-/Umfang-Erhalt, Zeilen-VM inkl. **terminal → Frist null**, fristlos → null, Verbund-Id-Ableitung).

[split-kompaktliste.png]: _reference/journey-paket-2/split-kompaktliste.png

### v2.181.0 — Journey-Paket 2 Phase 7: Artefakt-Leiste + kollabierte Daten-Sektionen (Juli 2026)

MINOR — Die Verbund-Detailseite ([detail-kopf.png]) zeigt jetzt zwischen Kopf und Daten eine **Artefakt-Leiste**: kompakte Fortschritts-Karten für Gutachten + Nachforderung (nur für **erreichte** Artefakte — kein grauer Platzhalter). Die vier Daten-Sektionen (Antragsdaten & Verbundpartner, Teilvorhaben, Alle Felder, Historie) sind zu **kollabierten Zeilen mit Kontext-Vorschau** geworden (Default eingeklappt), und der 702-Zeilen-Monolith `VerbundDetail.tsx` ist auf **347 Zeilen** Orchestrierung zerlegt. Additiv, keine Datenmigration (persistierte Auf-/Zu-Zustände bleiben gültig).

- **Artefakt-Leiste** ([ArtefaktLeiste.tsx](src/plugins/antraege/artefakte/ArtefaktLeiste.tsx) + [ArtefaktKarte.tsx](src/plugins/antraege/artefakte/ArtefaktKarte.tsx)), gespeist aus der reinen VM-Ableitung [artefaktKarten.ts](src/plugins/antraege/artefakte/artefaktKarten.ts) + IO-Hook [useArtefaktLeiste.ts](src/plugins/antraege/artefakte/useArtefaktLeiste.ts):
  - **Gutachten:** `{freigegeben}/{gesamt} freigegeben` (aus `WorkflowRun.schritte`), 3px-Fortschrittsbalken, Zustandszeile aus dem aktiven Abschnitt („Abschnitt D (Markt) im Entwurf"), Button „Weiter bei {X}" → setzt `?abschnitt=` (bestehender Deep-Link-Pfad der GutachtenSection) + scrollt. In Fachprüfung **ohne** Run → Karte „Noch nicht begonnen" + „Erstellen".
  - **Nachforderung:** `{versendet}/{tvGesamt} TVs versendet` (versendet = TV-`nf`-Run mit `schritte.NF.status==='freigegeben'`), Frist als **amber Badge** `Frist DD.MM.` (einzige Farbe im Kopf, `--tf-warning-*`), Button „TV {n} vorbereiten".
  - **Sichtbarkeit:** GA nur bei aktivem Flag **und** (Run vorhanden ∨ Fachprüfung), NF nur bei aktivem Flag **und** mindestens einem TV-NF-Run — nicht erreichte Artefakte werden **gar nicht** gerendert. Zahlen deckungsgleich mit den Sektionen (dieselben Primitive `resolveWorkflowSteps`/`getWorkflowRun`/`computeFristDatum`, kein Fork). **Keine neuen Tokens.**
- **Kollabierte Daten-Sektionen** ([CollapsibleDataSection.tsx](src/plugins/antraege/CollapsibleDataSection.tsx)): eine Zeile Chevron + Titel + Kontext-Vorschau rechts (Antragsdaten → „{Koordinator} · {n} weitere", Teilvorhaben → TV-Anzahl, Alle Felder → „{gesamt} · {mitWerten} mit Werten", Historie → „zuletzt {Datum}"). `useCollapsedSection` um `defaultOpen` erweitert (abwärtskompatibel) — die Sektionen starten **eingeklappt**, ein bereits persistierter Zustand gewinnt. Teilvorhaben aus dem alten „Antragsdaten"-Sammelblock in eine **eigene** Sektion gelöst; „Alle Felder" ist neu einklappbar.
- **Werkstatt-Breadcrumb** ([ArtefaktBreadcrumb.tsx](src/plugins/antraege/ArtefaktBreadcrumb.tsx)): schlanke sticky Zeile `← {Akronym} · {Phase}` über den GA-/NF-Werkstätten, Klick scrollt zurück zum Kopf (die Artefakt-Leiste sitzt im Kopf und ist beim Arbeiten weggescrollt).
- **Zerlegung** von [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx) (702 → 347 Zeilen, **verschoben statt kopiert**): Daten-Schicht → [useVerbundDetailData.ts](src/plugins/antraege/useVerbundDetailData.ts), TV-Liste → [TeilvorhabenListe.tsx](src/plugins/antraege/TeilvorhabenListe.tsx), Historie → [VerbundHistorie.tsx](src/plugins/antraege/VerbundHistorie.tsx), Verbund-Feld-Aggregation → reines [verbundMerge.ts](src/plugins/antraege/alleFelder/verbundMerge.ts) (`mergeAntraegeForDisplay` + neuer `verbundFelderStats`). `VerbundAlleFelder` nutzt jetzt diese geteilte Quelle.
- **Abweichung/Default:** (1) Die frühere sticky **Sprung-Nav** (Unterstrich-Tabs Stammdaten/Teilvorhaben/Gutachten/Nachforderungen) ist entfallen — die Artefakt-Karten (mit „Weiter"-Buttons) + die kompakten kollabierten Zeilen sind der Navigations-Ersatz; das entspricht dem bindenden Mockup, das keine Sprung-Nav zeigt. (2) Die vier Daten-Sektionen sind zu **einer** kompakten Gruppe direkt unter der Leiste zusammengezogen, die GA/NF-Werkstätten stehen darunter. (3) „Workspace" = Inline-Abschnitt derselben Seite (keine separate Route); die Breadcrumb scrollt zum Kopf statt eine Route zu poppen.
- Tests: [artefaktKarten.test.ts](src/plugins/antraege/artefakte/__tests__/artefaktKarten.test.ts) (GA-Sichtbarkeitsmatrix Run × Fachprüfung, Fortschritt, NF-Versand-Zählung + nächstes offenes TV, Frist-Kurzformat), [verbundMerge.test.ts](src/plugins/antraege/alleFelder/__tests__/verbundMerge.test.ts) (divergente Aggregation, TV-spezifische Ausblendung, „mit Werten"-Zählung).

### v2.180.0 — Journey-Paket 2 Phase 6: Verbund-Detail-Kopf mit amtlichem Stepper (Juli 2026)

MINOR — Der Kopf der Verbund-Detailseite ([detail-kopf.png]) trug ein Status-**Badge**, das dem amtlichen Status widersprach: ein alter „Schlussvermerk"-Antrag stand im 5-Schritt-Stepper auf Schritt 1/5, weil die alte `STATUS_TO_STEP`-Map **nur Bauantrag-snake_case** kannte und jeden Förderantrag-Roh-Status still auf Station 1 fallen ließ. Neu: ein aufgeräumter Kopf mit Identität + Beschreibung + Eckdaten + einem 5-Stationen-**Stepper, der aus dem amtlichen Status abgeleitet wird und damit IST die Statusanzeige** (das Badge entfällt). Additiv, keine Datenmigration.

- **Reine Status→Stepper-Ableitung** ([statusZuStepperPosition.ts](src/plugins/antraege/statusZuStepperPosition.ts)): `statusZuStepperPosition(status)` → `{ station: 1..5, terminal? }` über die Kategorie-Helper aus [status-canonical.ts](src/core/utils/status-canonical.ts) (kein Status-Literal-Vergleich, Pitfall #12). Stationen Eingang → Vollständigkeit → Fachprüfung → Bewilligung → Schluss; Feinlookup `beantragt`→1, `bearbeitungsreif`/`NL eingegangen`→2; `in_pruefung`/`nachforderung`/`entscheidung`→3; `bewilligt`/`begleitung`→4; `abgeschlossen`→5; unbekannt/leer→1 (Fallback). **Terminal-negativ** (`abgelehnt` bzw. `abgelehnt/zurückgezogen`) → Abbruch an Station 3 mit `terminal`-Flag (der Terminal-Check läuft **vor** dem Kategorie-Switch, sonst würde `abgelehnt/zurückgezogen` als Kategorie `abgeschlossen` auf Station 5 landen).
- **WorkflowStepper visuell neu** ([WorkflowStepper.tsx](src/plugins/antraege/WorkflowStepper.tsx)): Kreis-und-Linie-Stepper analog Mockup — passierte Stationen Häkchen, aktive betonter Ring (fett), künftige leerer Ring (gedämpft); Terminal-negativ rendert ein rotes **X** an der Abbruch-Station + das Status-Label als Beschriftung, Folgestationen gedämpft. `STATUS_TO_STEP` ist entfallen; der `collapsible`-Modus (Kompakt-Pille „● Station, Schritt n/5" bzw. „✕ Status") bleibt für spätere Narrow-Kontexte erhalten. **Keine neuen Tokens** (bestehende `--tf-success/-warning/-info/-danger/-text/-border`).
- **Neuer Kopf** ([VerbundKopf.tsx](src/plugins/antraege/VerbundKopf.tsx)): Akronym + ZKN (mono, tertiär, **kein Status-Badge mehr**), eine 3-Zeilen-geklammte Beschreibung (Titel + Kurzzusammenfassung in **einem** Block, exakte Duplikate zusammengefasst) mit „… mehr"/„↑ weniger" (wiederverwendeter `kbOpen`-State), Eckdaten-Zeile, Stepper. Der Kopf-Stepper ist **Verbund-Ebene** (amtliches Aggregat), unabhängig vom gerade expandierten TV.
- **Reine Eckdaten-Ableitung** ([kopfEckdaten.ts](src/plugins/antraege/kopfEckdaten.ts)): `buildKopfEckdaten` → „Programm/Typ · TV-Anzahl · Antragsdatum · Beantragt {T€}", **fehlende Werte werden ausgelassen** (kein „—"); nutzt dieselben Primitive wie `glanceFacts` (`sumBeantragteKosten`, `verbundAntragsdatum`, `getVbPhaseLabel`) + kompakter `formatEuroKompakt` (`812.000` → `812 T€`).
- **Aufräumen in [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx):** Der alte Kopf-Block + die separate „Kurzbeschreibung"-Sektion (in den Kopf gefaltet) + die Body-Sektion „Status & Workflow" (der Stepper sitzt jetzt im Kopf) entfallen; die Sprung-Nav verliert die Einträge `kurz` und `workflow` (übrig: Stammdaten · Teilvorhaben · ↓ Gutachten · ↓ Nachforderungen).
- **Abweichung/Default:** Die Kopf-Beschreibung fasst Titel **und** VB-Inhalt in einem geklammten Block zusammen (statt zwei getrennter Textblöcke) — Konsequenz aus „Kurzbeschreibung in den Kopf + `kbOpen` wiederverwenden"; kein Informationsverlust, exakte Duplikate werden entdoppelt.
- Tests: [statusZuStepperPosition.test.ts](src/plugins/antraege/__tests__/statusZuStepperPosition.test.ts) (alle kanonischen Kategorien beider Domänen inkl. Terminal + unbekannt/leer/`null`; Terminal-Check-Vorrang), [kopfEckdaten.test.ts](src/plugins/antraege/__tests__/kopfEckdaten.test.ts) (Segment-Komposition + Auslassen fehlender Werte, Kosten-Summe über TVs, `formatEuroKompakt`).

[detail-kopf.png]: _reference/journey-paket-2/detail-kopf.png

### v2.179.0 — Journey-Paket 2 Phase 5: Arbeitsvorrat/Archiv-Split im „Alle"-Tab (Juli 2026)

MINOR — Der „Alle"-Tab der Förderanträge-Liste ([liste-quickfilter.png]) mischt heute aktive Anträge mit längst abgeschlossenen; der Arbeitsvorrat verschwindet im Archiv-Rauschen. Neu: zwei Sektionen **In Arbeit** (nicht-terminal, oben) und **Abgeschlossen** (terminal, unten, standardmäßig eingeklappt) — in Listen- **und** Tabellen-Ansicht. Additiv, keine Datenmigration.

- **Neue reine Sektionierungs-Schicht** ([arbeitsvorrat.ts](src/plugins/antraege/arbeitsvorrat.ts)): `arbeitsvorratSectionOf` (terminal → Archiv via `isTerminalStatus`, Kategorie `abgeschlossen` ∪ `abgelehnt`, **bewusst OHNE bewilligt** — nach der Bewilligung folgt die Begleitphase, der Antrag bleibt „in Arbeit"), `partitionArbeitsvorrat` (stabiler Zwei-Wege-Split), `archivAufschluesselung` + `formatArchivAufschluesselung` (Archiv-Kopf-Rechts „Schlussvermerk n · abgelehnt/zurückgez. m"), `isArchivCollapsedEffective` (Auto-Aufklappen bei aktiver Suche mit Archiv-Treffern — sonst wirken Treffer im eingeklappten Archiv „verschwunden") und das Gate `isArbeitsvorratView` (nur `alle` + Gruppierung `none`).
- **Einklappbares Archiv:** eigener 1-Boolean-Store ([useArbeitsvorratCollapsed.ts](src/plugins/antraege/useArbeitsvorratCollapsed.ts), localStorage `teamflow_antraege_archiv_collapsed`, Default eingeklappt) + geteilter Header ([ArbeitsvorratSectionHeader.tsx](src/plugins/antraege/ArbeitsvorratSectionHeader.tsx), Optik wie `StatusSectionHeader`, **keine neuen Tokens**). Bewusst **nicht** `useStatusSectionCollapsed` (das ist per `StatusPhaseLabel` gekeyt + trägt eine Phase-Migration; der binäre Split hat andere Semantik und würde das Label „Abgeschlossen" kollidieren lassen).
- **List-View** ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx) → `GroupedList`): Bänder „IN ARBEIT · n" + „ABGESCHLOSSEN · n"; Pagination läuft auf der umsortierten Gruppenliste (Arbeitsvorrat zuerst), eingeklapptes Archiv bleibt aus der Pagination draußen.
- **Tabellen-View** ([AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx)): Sektionierung über den bestehenden `sectionKeyOf`/`renderSectionHeader`-Pfad der `SortableTable` (section-stabile Header-Sortierung generalisiert von Status- auf beide Sektionsmodi). Eingeklapptes Archiv → seine Zeilen bleiben aus der Tabelle draußen (kein Pagination-Verbrauch, kein Endlos-Sentinel), der Kopf erscheint als Streifen unter der Tabelle.
- **Vorrang-Regeln:** Aktive Gruppierung (Verbund/Status/NW) **ersetzt** die Arbeitsvorrat-Sektionierung (keine Verschachtelung). Ohne Archiv-Zeilen (z. B. „Alle" nur mit aktiven Anträgen) keine Sektion. Bei leerem Arbeitsvorrat (nur terminale Anträge) wird das Archiv erzwungen aufgeklappt.
- **Abweichung:** die Karten-Ansicht (Tiles, „alles auf einen Blick") bleibt bewusst unsektioniert (Sektionsbänder würden das dichte Grid zerreißen); der Plan nennt nur Liste + Tabelle.
- Tests: [arbeitsvorrat.test.ts](src/plugins/antraege/__tests__/arbeitsvorrat.test.ts) (Sektions-Zuordnung inkl. bewilligt→Arbeitsvorrat, Partition-Stabilität, Aufschlüsselung, Format, effektiver Collapsed-Zustand inkl. Such-Auto-Aufklappen, View-/Gruppierungs-Gate).

[liste-quickfilter.png]: _reference/journey-paket-2/liste-quickfilter.png

### v2.178.0 — Journey-Paket 2 Phase 4: relative Frist-Spalte + View-Default-Sortierung (Juli 2026)

MINOR — Die Frist-Spalte der Förderanträge-Tabelle ([liste-quickfilter.png]) zeigt statt roher Tage (`+45d` / `-2807d`) eine **relative, ampel-gefärbte** Angabe (`in 45 T` / `seit 12 T` / `heute` + farbiger Punkt), und die View-Defaults sortieren jetzt sinnvoll pro Tab. Additiv, keine Datenmigration.

- **Neue reine Frist-Anzeige** ([fristAnzeige.ts](src/plugins/antraege/fristAnzeige.ts)): `fristAnzeige(antrag)` → `{ text, ampel } | null`. **Terminale** Anträge (`isTerminalStatus`) und Anträge ohne berechenbare Frist → `null` (leere Zelle — eine unbekannte VN-Frist wird nicht erfunden). Text und Ampel werden aus **denselben** phasen-bewussten „Tagen bis zur Frist" (`daysUntilFristAware`: Antragsphase = Antragseingang + 90 Tage, Begleitphase = VN-Eingang + 6 Monate) abgeleitet — konsistent über beide Phasentypen. Ampel-Stufen frist-relativ: überfällig → rot, ≤ 14 T → orange, ≤ 30 T → gelb, sonst grün; Punkt-Farbe aus dem bestehenden `AMPEL_COLOR` (**keine neuen Tokens**).
- **Frist-Spalte** ([tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)): Ampel-Punkt + relativer Text; überfällig zusätzlich in `danger` + `font-medium`. Der numerische Sortier-`accessor` bleibt „Tage bis zur Frist" (aufsteigend = dringendste zuerst); terminale/fristlose Anträge sinken ans Ende (Sentinel `MAX_SAFE_INTEGER`, deckungsgleich mit der leeren Anzeige). `exportValue` liefert den lesbaren relativen Text (nie den Sentinel). Verbund-Zeilen nutzen weiter die kritischste TV-Frist (`criticalFristAware`). Der lokale `formatFrist`-Roh-Helfer entfällt.
- **View-Default-Sortierung** ([sort.ts](src/plugins/antraege/sort.ts)): „Alle" sortiert jetzt nach **Antragseingang absteigend** (`antrag_desc`, neueste zuerst) statt FKZ-alphabetisch; „Offen" bleibt Frist aufsteigend. Umgesetzt über das bestehende `DEFAULT_SORT_BY_VIEW` (kein paralleler `defaultSort`-Mechanismus). Bestehende explizite Nutzer-Overrides pro View behalten Vorrang (`getEffectiveSortKey` / `sortByView`). Der Default-Tab „Offen" (`meine_offenen`) war bereits gesetzt — unverändert.
- Tests: [fristAnzeige.test.ts](src/plugins/antraege/__tests__/fristAnzeige.test.ts) (Text/Ampel-Schwellen, terminale + fristlose Zellen, Antrags- und VN-Frist mit injiziertem `nowMs`), [sortDefaults.test.ts](src/plugins/antraege/__tests__/sortDefaults.test.ts) (View-Defaults + Override-Vorrang).

[liste-quickfilter.png]: _reference/journey-paket-2/liste-quickfilter.png

### v2.177.0 — Journey-Paket 2 Phase 3: kombinierte „Status und nächster Schritt"-Spalte (Juli 2026)

MINOR — Die verstreute Statusinfo der Förderanträge-Tabelle (drei Spalten Status / FB Status / PreCheck Status) wird zu **einer** aussagekräftigen Spalte „Status und nächster Schritt" ([liste-quickfilter.png]) verdichtet: amtliches Status-Badge + die konkrete nächste Handlung. Additiv — die alten Spalten bleiben als Picker-Optionen erhalten, gespeicherte Spalten-Configs bleiben unangetastet, keine Datenmigration.

- **Neue Spalte `status_naechster_schritt`** ([tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)): Badge = amtliche Phase (`getStatusLabel` + `getStatusVariant`, **keine neuen Farben**), dahinter ` → {Aktion}` aus `naechsterSchritt(status, precheck_status_label)` in `text-secondary`, einzeilig mit `title`-Tooltip. Bei **terminalem** Status (`isTerminalStatus`) kein Badge, nur ruhiger grauer Status-Text — abgeschlossene Anträge fordern keine Handlung mehr. Der PreCheck-Stand fließt in die Aktion ein (früher Antrag ohne PreCheck → „PreCheck durchführen", mit positivem PreCheck → „Vollständigkeit prüfen").
- **Spalten-Defaults verschoben:** `status_naechster_schritt` ist Default-sichtbar, das alte reine `status`-Badge (sowie `fb_status`/`precheck_status`) sind per Default AUS. Alle drei bleiben im Spalten-Picker wählbar. **Migration:** `useAntraegeColumnsStore` behält gespeicherte Keys (validiert gegen die Registry) unverändert — bestehende Nutzer sehen ihre gewählten Spalten weiter, nur der Default für neue/zurückgesetzte Ansichten ändert sich.
- **Kanonischer Sortier-Rang** `statusRang(status)` neu in [status-canonical.ts](src/core/utils/status-canonical.ts): Rang 1–9 entlang des Lebenszyklus (offen → Prüfung → Nachforderung → Entscheidung → bewilligt → Begleitung → abgeschlossen → abgelehnt → sonstige). Der Spalten-`accessor` faltet Rang (2-stellig gepolstert, dominiert) + Aktion (alphabetischer Tie-Break) in einen Sortier-String; `exportValue` liefert stattdessen den lesbaren „{Status} → {Aktion}"-Text (kein Sortier-Sentinel im XLSX). Kein String-Literal-Status-Vergleich (Pitfall #12).
- Tests: [statusSchrittColumn.test.ts](src/plugins/antraege/__tests__/statusSchrittColumn.test.ts) (accessor-Sortierung/Rang-Polsterung, exportValue inkl. PreCheck-Durchreichung + terminaler Grau-Zweig, render-Verzweigung via Tooltip) + `statusRang`-Matrix in [statusCanonical.test.ts](src/plugins/antraege/__tests__/statusCanonical.test.ts).

[liste-quickfilter.png]: _reference/journey-paket-2/liste-quickfilter.png

### v2.176.0 — Journey-Paket 2 Phase 2: Quickfilter-Akkordeon + PreCheck-Facette (Juli 2026)

MINOR — Der Quickfilter der Förderanträge-Liste ([liste-quickfilter.png]) wird von einem Stapel gleichzeitig offener Segmente zu **einer Akkordeon-Zeile** (immer höchstens eine Pille offen), bekommt eine neue **PreCheck**-Facette und verschiebt die Gruppieren-Steuerung in ein ruhiges Dropdown. Additiv, keine Datenmigration.

- **CollapsibleSeg controlled-fähig** ([CollapsibleSeg.tsx](src/plugins/antraege/filter/CollapsibleSeg.tsx)): neue optionale Props `expanded` + `onExpandToggle`. Kein Fork — ohne die Props verhält sich die Pille exakt wie bisher (uncontrolled: Sticky-Open/manual-close). Alle bestehenden Nutzer (Suche, Skill-Verwaltung, Auslastung, Feedback-Board) bleiben unverändert.
- **Akkordeon** ([QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx) + neue [quickfilterExpanded.ts](src/plugins/antraege/filter/quickfilterExpanded.ts)): Segmente Status · Antragstyp · PreCheck · (nur List-/Karten-Ansicht) Sortiert-nach in EINER Zeile. Zustand ist ein einzelner `QuickfilterSegId | null` → „nie zwei offen" ist strukturell garantiert. Pro View persistiert (`teamflow_antraege_quickfilter_expanded_{viewId}`, Muster wie `useAntraegeColumnsStore`); Erstnutzung: Status offen.
- **PreCheck-Facette (NEU)** ([precheckQuickfilter.ts](src/plugins/antraege/filter/precheckQuickfilter.ts)): Buckets **Alle / positiv / negativ / offen** (die Kern-Klassifikation `normalisierePrecheck` faltet „ohne"=leer und „offen"=ausstehend in EINEN Bucket „offen" — konsistent mit der „nächster Schritt"-Formel, partitioniert die Liste exakt). Eigener Store-Slot `precheckBucket` (global, in-memory) + Pipeline-Schritt in [useFilteredAntraege.ts](src/plugins/antraege/useFilteredAntraege.ts) statt generischer Filter-Engine — weil das Label Label-XLS-getrieben ist (exakter Feld-Match wäre fragil) und ein Quickfilter **keinen** Filter-Chip erzeugen soll.
- **Gruppieren → Dropdown** ([GruppierenDropdown.tsx](src/plugins/antraege/filter/GruppierenDropdown.tsx)): raus aus der Quickfilter-Zeile, rein in ein „Gruppierung: Keine ▾"-Dropdown rechts neben dem Spalten-Picker ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx), visuelle Familie `ColumnPicker`). Verhalten/State (per-View `groupingByView`/`tableGroupingByView`) unverändert.
- **Chips + Zähler eigene Zeile:** aktive Sidebar-Filter-Chips ([ActiveFilterChips.tsx](src/plugins/antraege/filter/ActiveFilterChips.tsx), jetzt mit `className`-Override) sitzen in einer eigenen Zeile UNTER dem Quickfilter, der Trefferzähler `{n} Anträge` rechts daneben. Quickfilter-Segmente (Status/Antragstyp) erzeugen **keinen** Chip mehr — ein `system-status`/`system-vb-phase`-Filter wird nur noch gezeigt, wenn ihn keine Pille „absorbiert" (nicht-Bucket-konforme Sidebar-Kombination).
- Tests: [precheckQuickfilter.test.ts](src/plugins/antraege/filter/__tests__/precheckQuickfilter.test.ts) (Klassifikation/Counts/Partition/Apply), [quickfilterExpanded.test.ts](src/plugins/antraege/filter/__tests__/quickfilterExpanded.test.ts) (Akkordeon-Reducer + Persistenz-Parser).

[liste-quickfilter.png]: _reference/journey-paket-2/liste-quickfilter.png

### v2.175.0 — Journey-Paket 2 Phase 1: „nächster Schritt" im Core + PreCheck-Formel (Juli 2026)

MINOR — Die Handlungs-Formel „Phase → nächster Schritt" wird von der Home in den Core gehoben und lernt den **PreCheck-Stand** kennen. Erste Phase von Journey-Paket 2; gemeinsame Infrastruktur für Home UND die (in Phase 3 kommende) kombinierte Listen-Spalte. Additiv, abwärtskompatibel, keine Datenmigration.

- **Verschiebung + `@deprecated`-Brücke:** `naechsterSchritt` + `NaechsterSchritt` leben jetzt in [src/core/utils/naechsterSchritt.ts](src/core/utils/naechsterSchritt.ts); [src/plugins/home/naechsterSchritt.ts](src/plugins/home/naechsterSchritt.ts) re-exportiert nur noch (`@deprecated`, Verweis Core). Home-Aufrufer ([MeineAntraegeSection.tsx](src/plugins/home/MeineAntraegeSection.tsx)) importieren aus dem Core.
- **PreCheck-Erweiterung (abwärtskompatibel):** neue Signatur `naechsterSchritt(status, precheckStatus?)`. Neuer Helper `normalisierePrecheck(label)` klassifiziert das List-View-Label `precheck_status_label` (NICHT ein Roh-Status) → `'positiv' | 'negativ' | 'offen' | 'ohne'` (Wort-Match vor Roh-Code-Fallback, damit „PreCheck positiv - Verbund" nicht am Bindestrich als negativ zählt). Neue Regeln VOR den Status-Regeln, nur für nicht-terminale Anträge: negativ → „PreCheck-Ergebnis klären"; fehlend/ausstehend + Eingangs-Phase → „PreCheck durchführen". **Opt-in-Kontrakt:** ohne 2. Argument (`undefined`) exakt das Legacy-Verhalten; erst ein explizit übergebener Wert (auch `''`/`null`) aktiviert die PreCheck-Regeln. Home übergibt `precheck_status_label ?? ''`.
- **`isTerminalStatus` + `TERMINAL_STATUS_CATEGORIES`** neu in [status-canonical.ts](src/core/utils/status-canonical.ts): Kategorie `abgeschlossen` ∪ `abgelehnt` (bewusst OHNE `bewilligt` — Begleitphase folgt). Einzelquelle für die PreCheck-Regeln und den Arbeitsvorrat/Archiv-Split (Phase 5).
- **Threading:** `AntragVorgang` ([dashboardAggregate.ts](src/plugins/home/dashboardAggregate.ts)) trägt jetzt `precheck_status_label` (projiziert in `antragToVorgangLike`). Ergebnis (Mockup `liste-quickfilter.png`): frühe Anträge ohne PreCheck zeigen „PreCheck durchführen", mit positivem PreCheck „Vollständigkeit prüfen".
- Tests: [naechsterSchritt.test.ts](src/core/utils/__tests__/naechsterSchritt.test.ts) verschoben + tabellengetrieben erweitert (PreCheck positiv/negativ/offen/ohne × Eingang/fortgeschritten/terminal; `normalisierePrecheck`-Matrix inkl. Bindestrich-Falle).

### v2.174.1 — Assistent-Verlauf: Anheften + Umbenennen (Juli 2026)

PATCH — Das Verlauf-Dropdown des Suche-Assistenten ([ChatPanelHost.tsx](src/plugins/chat/ChatPanelHost.tsx)) bekommt die beiden Konversations-Aktionen zurück, die beim Umbau von der Vollbild-Sidebar zum kompakten Panel (v2.173.0) weggefallen waren. Rein additive UI-Verdrahtung bestehender Store-Methoden (`togglePin` / `renameConversation`, [store.ts](src/plugins/chat/store.ts)) — keine neuen Felder, kein Datenmodell-Change.

- **Anheften** je Zeile (Pin-Icon): schaltet `pinned` um; angeheftete Unterhaltungen erscheinen über `groupConversations({filter:'all'})` weiterhin oben in der Gruppe „Angeheftet".
- **Umbenennen** je Zeile (Stift-Icon): inline-Editor (Enter speichert, Escape verwirft, Blur speichert) → `titleCustom: true`, friert den Titel gegen die Auto-Ableitung ein. Leerer Titel wird ignoriert.
- Verlauf-Schließen verwirft eine laufende Umbenennung; Löschen bleibt unverändert. Store-Logik ist bereits durch [store-reskin.test.ts](src/plugins/chat/__tests__/store-reskin.test.ts) abgedeckt (togglePin/rename/`loadAll`-pinned).

### v2.174.0 — Anfragen: internes KI-Tagging + Filter-Tabelle + Export-Präambel (Juli 2026)

MINOR — Das Modul „Anfragen" bekommt strukturierte Metadaten und eine filterbare Tabelle. Additiv, keine Datenmigration (Metadaten sind ein optionales `Anfrage.metadaten`-Feld im `kv`-Store, kein Store-Version-Bump).

- **Auto-Tagging beim Aufnehmen** ([AnfrageAufnahme.tsx](src/plugins/anfragen/AnfrageAufnahme.tsx) + [services/metadaten.ts](src/plugins/anfragen/services/metadaten.ts)):
  direkt nach dem `.msg`-Import extrahiert ein **interner** KI-Lauf vier Metadaten — Antragsart, Name, Firma, Themengruppe —
  und speichert sie lokal an der Anfrage (`metadaten` mit `status` getaggt/ausstehend/fehlgeschlagen). Härtung 1:1 wie
  `runAnonymisierung` (Ping-Guard → `safeResetChat` → Bounded Retry, balanciertes JSON, kein `response_format`). DSGVO:
  neuer Seed-Skill `anfrage-metadaten` trägt `{{zielText}}` + `enthaeltDokumentInhalte: true` → `getTransportForSkillRun`
  erzwingt internen Transport (Pitfall #30); `name`/`firma` sind Klartext-PII und verlassen das System nie. Der Skill ist
  ab Werk `aktiv: true` (rein interner Lauf, kein Recall-Gate). Fail-safe: KI unerreichbar → Anfrage bleibt erhalten,
  Tagging-Status `fehlgeschlagen`, im Detail per „Erneut taggen" nachholbar.
- **Themengruppe = festes Vokabular** ([anfrage-metadaten.seed.ts](src/core/services/skills/registry/anfrage-metadaten.seed.ts)):
  `THEMENGRUPPEN`-Liste (Antragstellung & Formalitäten, Förderfähigkeit & Voraussetzungen, Finanzen & Abrechnung,
  Fristen & Projektänderungen, Technik & Inhaltliches, Kooperation & Partner, Sonstiges); `parseMetadaten` normalisiert
  Unbekanntes → „Sonstiges", `antragsart` semi-offen (trim + Erst-Buchstabe groß).
- **Metadaten-Streifen im Detail** ([AnfrageMetadatenStrip.tsx](src/plugins/anfragen/AnfrageMetadatenStrip.tsx)):
  Art · Thema · Firma · Name + Tagging-Status, „(Erneut) taggen"-Button (im Detail-Kopf, statusunabhängig sichtbar).
- **Filter-/Sortier-Tabelle** ([AnfrageTabelle.tsx](src/plugins/anfragen/AnfrageTabelle.tsx)):
  die getaggten Metadaten sind automatisch Spalten-Filter (Art/Thema/Firma + Status via Header-Dropdown), Name sortierbar;
  Muster wie `FeedbackBoardListView` (`useColumnFilters` + `useColumnWidths`, Sentinel „(nicht getaggt)" für ungetaggte Zeilen).
- **Export-Präambel für den externen Assistenten** ([services/anrede.ts](src/plugins/anfragen/services/anrede.ts)):
  der zum ZIM-FAQ-Assistenten kopierte Text (beide Export-Pfade in [AnonymisierungView.tsx](src/plugins/anfragen/AnonymisierungView.tsx))
  bekommt einen Hinweis vorangestellt — Anrede ans Team ignorieren, nur die Fragen beantworten, Antwort-Mail an den Absender,
  UND alle Platzhalter (`[PERSON_1]`, `[FIRMA_1]`, `[ORT_1]` …) unverändert erhalten (Claude „verschluckte" bislang manche).
  Verlustfrei: gespeicherter `anonymisiertMd` + Export-Guard bleiben unberührt.

### v2.173.0 — Journey-Paket 1, Phase 4: Chat als andockendes „Assistent"-Panel in der Suche (Juli 2026)

MINOR — Der Chat lebt nicht mehr als eigener Vollbild-Screen, sondern als andockendes Panel rechts neben den Suchtreffern, entlang `_reference/journey-paket-1/suche-assistent.png`. Additiv, keine Datenmigration; die Chat-Persistenz (IDB `chat:conv:*`) bleibt unverändert.

- **Andockendes Assistenten-Panel in der Suche** ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx) + [ChatPanelHost.tsx](src/plugins/chat/ChatPanelHost.tsx)):
  neuer Button „Assistent" (rechts im Suchkopf) blendet ein rechtsbündiges, resizebares Panel ein
  (Breite 300–560 px, Default 380; Offen-Flag + Breite in localStorage `teamflow_suche_assistent_open`/`_width`,
  reine Parser in [assistentPanel.ts](src/plugins/suche/assistentPanel.ts)). Das Panel nutzt `useChatController` +
  `useChatStore` **unverändert** (kein Fork) und dieselben Bausteine (MessageList/Composer/EmptyState/SourcePanel);
  die breite Verlauf-Sidebar weicht einem **Verlauf-Dropdown** im Kopf (Unterhaltungen wählen, neue starten, löschen).
- **Kontext aus den Suchtreffern** ([assistentKontext.ts](src/plugins/suche/assistentKontext.ts)): bei offenem Panel
  mit aktiver Suche heftet ein Chip „Kontext: N Suchtreffer" die obersten Treffer (FKZ + Titel + Snippet) über den
  bestehenden RAG-`extraContext`-Pfad an die nächste Nachricht — **nicht** über `setConversationFkz` (single-FKZ).
  Der Chip ist entfernbar; eine neue Suche heftet den Kontext wieder an. `useChatController` bekam dafür eine rein
  additive Option `getPinnedContext` (ohne Option unverändertes Verhalten).
- **Chat aus der Nav genommen, Route bleibt** ([chat/index.ts](src/plugins/chat/index.ts)): das Chat-Plugin ist
  `hideFromNav: true`; `/chat` bleibt als **@deprecated Redirect** auf `/suche?assistent=1`
  ([ChatRedirect.tsx](src/plugins/chat/ChatRedirect.tsx)) für alte Feld-Bookmarks. Die Command-Palette
  ([ShellLayout.tsx](src/core/ShellLayout.tsx)) bekam einen expliziten „Assistent öffnen"-Befehl; der frühere
  „An Chatbot… (Kommt bald)"-Platzhalter in der Suche ist entfallen.
- **Aufgeräumt**: die frühere Chat-Vollseite (`ChatView`, `ConversationHeader`, `ConversationSidebar`,
  `conversation-markdown`) ist entfernt — ihre Bausteine (Controller/Store/MessageList/Composer/EmptyState/
  SourcePanel/`groupConversations`) leben im Panel weiter. Der bestehende „Mit KI analysieren"-Flow der Suche
  bleibt unangetastet.
- Tests: `buildTrefferKontext`/`kontextChipLabel` (Kontext-Block + Chip-Label), `assistentPanel`-Parser
  (Offen-Flag + Breite, Default/Clamp), Chat-Nav-Vertrag (`hideFromNav`, Route `/chat`, Redirect-Ziel).

### v2.172.0 — Journey-Paket 1, Phase 3: Home-Kopf vereinheitlicht + „Phase → nächster Schritt" (Juli 2026)

MINOR — Eine einheitliche Dringlichkeits-Sprache auf der Startseite, entlang `_reference/journey-paket-1/home-weitermache.png`. Additiv, keine Datenmigration.

- **Kopfzeilen-Subtitle aus den Eingangs-Ampel-Aggregaten** ([HomePage.tsx](src/plugins/home/HomePage.tsx)):
  statt „{n} offene Vorgänge · {k} Fristen diese Woche" jetzt „{n} offene Vorgänge · {k} über der 90-Tage-Frist ·
  {w} nähern sich". `n` = frisch + warnung + kritisch (= Gesamtzahl der Ampel-Karte), `k` = kritisch (> 90 T,
  in `--tf-danger-text`), `w` = warnung (31–90 T). Null-Teile entfallen; bei k = 0 ∧ w = 0 bleibt nur „{n} offene
  Vorgänge". Kopfzeile und Sidebar-Karte teilen sich jetzt **eine** Zählquelle
  ([useEingangAmpelCounts.ts](src/plugins/home/useEingangAmpelCounts.ts)) — die Zahlen können nicht mehr driften
  (die Karte hängt dadurch auch nicht mehr an der schweren `useFilteredAntraege`-Pipeline). Reine Formatierung:
  [homeSubtitle.ts](src/plugins/home/homeSubtitle.ts).
- **„Phase → nächster Schritt"-Formel statt Status-Badge** ([MeineAntraegeSection.tsx](src/plugins/home/MeineAntraegeSection.tsx)):
  jede Zeile in „Meine Anträge" zeigt jetzt Ampel-Punkt (Farbe = Eingangs-Ampel) + Akronym + „{Phase} → {Aktion}"
  (z.B. „Fachprüfung → Gutachten beginnen", einzeilig mit Ellipsis) + Eingangsalter „vor N T" rechts. Die Formel
  ([naechsterSchritt.ts](src/plugins/home/naechsterSchritt.ts)) ist ein **reiner Record-Lookup** (Roh-Status →
  {phase, aktion}, kein `=== 'literal'`, Pitfall #12 unberührt); nicht gemappte Stati fallen auf `{ getStatusLabel,
  '' }` zurück (nur Phase, keine erratene Aktion). Entfernt in der Zeile: Status-Badge, Frist-Icon/VB-Phase-Badge,
  Aktenzeichen-Zeile, MA-Kürzel-Badge, Wiedereinreicher-Hinweis — bewusst reduziert auf die einzeilige Mockup-Form
  (die volle Info bleibt einen Klick entfernt in der Förderanträge-Liste). Sortierung unverändert.
- **`AntragVorgang`-Projektion** trägt jetzt `antragsdatum` + `bewilligung_datum`
  ([dashboardAggregate.ts](src/plugins/home/dashboardAggregate.ts)); `getEingangAmpel`/`daysSinceEingang` akzeptieren
  ein strukturelles Minimal-Shape (`EingangAmpelInput`) — die Home-Liste nutzt so dieselbe Ampel-Logik ohne echten
  `AntragListItem`.
- Tests: `naechsterSchritt` (tabellengetrieben: alle gemappten Stati + Fallback + null), `formatHomeSubtitle`
  (Mockup-Fall 47/38/9, Singular/Plural, Null-Teile, de-DE-Zahlformat).

### v2.171.0 — Journey-Paket 1, Phase 2: „Weitermachen"-Karte + lokales Arbeitskontext-Log (Juli 2026)

MINOR — Schneller Wiedereinstieg in die zuletzt bearbeiteten Artefakte, entlang `_reference/journey-paket-1/home-weitermache.png`. Additiv.

- **Rein lokales Arbeitskontext-Log** ([arbeitskontext-log.ts](src/core/services/personal-storage/arbeitskontext-log.ts)):
  IDB-only (kv-Key `arbeitskontext-log`), **NIE** auf den Daten-Share / in den persönlichen Ordner gespiegelt und
  **NIE** exportiert (Datenschutz-Leitplanke, Präzedenz `embedding-caches-machine-local`; struktureller Guard
  `arbeitskontext-log-idb-only`). Speichert **ausschließlich Metadaten**: Artefakt-Typ, Verbund-Key, optional der
  zuletzt berührte Gutachten-Abschnitt und der Zeitstempel — **keine** Textinhalte/Prompts/Entwürfe. Dedupe pro
  `(typ, verbundKey)`, Cap 200.
- **Instrumentierung** (fire-and-forget, bricht nie eine Arbeitsaktion): Gutachten (Generieren/Freigeben/Verwerfen,
  je Abschnitt), Nachforderungen (je Verbund) und Kurzfassung (Generieren/Freigeben/Übernehmen).
- **„Weitermachen"-Karte** ([WeitermachenSection.tsx](src/plugins/home/WeitermachenSection.tsx)): oberste Section der
  Home-Hauptspalte, die drei jüngsten Arbeitskontexte mit Akronym + Kontextzeile (der **Live**-Abschnitts-Status
  kommt aus dem Workflow-Store, nie der geloggte) + relativer Zeit; „Weiter →" deep-linkt zurück in die Werkstatt.
  Leerer Verlauf ⇒ Karte unsichtbar. Datenschutz-Zeile („nur lokal auf diesem Gerät · verwalten") verlinkt in die
  Einstellungen.
- **Deep-Link** über Query-Params `?ziel=gutachten|nf&abschnitt=<A–G>`: die Verbund-Detailseite scrollt zur Ziel-
  Sektion; die Gutachten-Sektion springt (einmalig) den Abschnitt. Echter Verbund → Verbund-Route, Solo/Pseudo →
  Antrags-Route.
- **Einstellungen → Speicher → „Arbeitsverlauf"**: Liste der Einträge + „Verlauf löschen" (mit Bestätigung); nur
  sichtbar, wenn Einträge existieren.

### v2.170.0 — Journey-Paket 1, Phase 1: Sidebar-Gruppierung + Feedback im Footer (Juli 2026)

MINOR — Neuordnung der Sidebar-Navigation entlang des Mockups `_reference/journey-paket-1/sidebar-v2.png`.
Additiv: bestehende Routen/Bookmarks bleiben erreichbar.

- **Nav-Kategorie `system`** neben `workflow`/`tools`/`kuration` ([plugin.ts](src/core/types/plugin.ts)): Skill-Verwaltung
  + Einstellungen liegen jetzt unten in einer eigenen Gruppe (Trennlinie, **ohne** Label), von der Arbeits-Gruppe
  oben durch einen Flex-Spacer getrennt. Arbeits-Gruppe oben = Home, Förderanträge, E-Mail-Anfragen, Auslastung,
  Suche (+ Chat temporär bis Phase 4).
- **Pure `groupNavPlugins()`** ([src/core/nav/groupNavPlugins.ts](src/core/nav/groupNavPlugins.ts)): einzige Quelle der
  Nav-Gruppierung/-Sortierung (getestet); ShellLayout rendert nur noch. Command-Palette-Nav-Items leiten sich aus
  derselben `navVisiblePlugins()`-Liste ab.
- **`hideFromNav?: boolean`** (Manifest-Feld): Plugin fällt aus Nav + Nav-Commands, Route bleibt registriert.
  `feedback-board` ist jetzt `hideFromNav` — erreichbar über den Feedback-Dialog (Footer-Icon → „Feedback-Board →").
- **`navHint?: 'global'`** (Manifest-Feld): rechtsbündiges Globus-Icon mit Tooltip „Änderungen wirken für alle
  Nutzer" — gesetzt an der Skill-Verwaltung. Kein id-Sonderfall im ShellLayout.
- **Feedback-Icon im Sidebar-Footer** (zwischen „Zeig es mir" und Version): öffnet denselben Dialog wie der globale
  FAB über den neuen geteilten Store [useFeedbackDialog](src/components/feedback/useFeedbackDialog.ts) — keine
  Duplikat-Öffnen-Logik.
- **Rename** „Anfragen" → **„E-Mail-Anfragen"** (Workflow- + Kuration-Plugin + Feedback-Bereichs-Label).

### v2.169.0 — Anonymisierer-Freischaltung reconciled Bestands-Shares automatisch (Juli 2026)

MINOR — Follow-up zu v2.168.0: Der Seed steht auf `aktiv: true`, aber `mergeMissingSeeds` überschreibt
bestehende Registry-Einträge nie — ein Daten-Share, dessen `_intern/skills/registry.json` den Skill schon mit
`aktiv: false` trägt, bliebe ohne Zutun gesperrt. Statt eines manuellen Toggles holt die App das jetzt
**automatisch** nach:

- **`reconcileEinmaligeAktivierungen`** ([migrations.ts](src/core/services/skills/registry/migrations.ts)):
  einmalige, marker-gesicherte Registry-Migration — setzt `anfrage-anonymisieren` von `aktiv:false → true`.
  Ein neues, additives Feld `SkillRegistryFile.angewandteMigrationen` (von `normalizeRegistryFile` bewahrt)
  macht das **team-weit genau einmal** und respektiert eine spätere bewusste Deaktivierung (Marker gesetzt →
  nie wieder anfassen).
- **Shell-Hook `useAnfrageAnonAktivierung`** ([useAnfrageAnonAktivierung.ts](src/plugins/anfragen/useAnfrageAnonAktivierung.ts)):
  im `ShellLayout` gemountet, läuft nach dem Share-Grant für schreibberechtigte Clients (pl/kurator/dev),
  wendet die Reconciliation an und schreibt bei Änderung zurück (atomicWrite + Audit). Kein manueller Handgriff
  mehr; der Weg über Kuration → Skill-Verwaltung bleibt als Fallback.
- Rein additiv (optionales Registry-Feld, kein Schema-Bump), 6 neue Unit-Tests für die Reconciliation-Invarianten.

### v2.168.0 — Anfragen-Anonymisierer produktiv freigeschaltet (Juli 2026)

MINOR — Das Recall-Gate für den `anfrage-anonymisieren`-Skill (Zwei-Stufen-Modell, version 2) wurde am
2026-07-03 gefahren und **bestanden** (0 Leaks über die fiktiven Fixtures). Damit ist die Produktiv-Freigabe
die bewusste Entscheidung von Thomas — der Seed steht jetzt auf `aktiv: true`
([anfrage-anonymisieren.seed.ts](src/core/services/skills/registry/anfrage-anonymisieren.seed.ts)):

- **In allen Varianten, in denen das Modul läuft** (dev + pl + as + kurator), ist der Anonymisieren-Lauf jetzt
  freigeschaltet. dev war über den Runtime-Override (`isDevContext`) ohnehin frei; prod/pl/kurator/as folgen
  nun dem gesetzten `aktiv: true`. Der interne-Transport-Zwang (Dokumentinhalte via `{{zielText}}`) bleibt
  unverändert — echter Mailtext erreicht nie ein externes Modell.
- **Bestands-Installationen brauchen einen einmaligen Handgriff:** `mergeMissingSeeds` überschreibt bestehende
  Registry-Einträge NIE (Schutz kuratierter Edits). Ein Daten-Share, dessen `_intern/skills/registry.json` den
  Skill noch mit `aktiv: false` trägt, bleibt gesperrt, bis er einmal zur Laufzeit freigeschaltet wird
  (Kuration → Skill-Verwaltung → „Anfrage anonymisieren" → aktiv → Speichern). Ein Share = team-weit für alle
  Varianten. Frische Installationen starten direkt frei.
- Invarianten-Tests + Doku (anfragen-modul.md, Seed-Kommentare) auf den freigeschalteten Ist-Zustand gezogen.
  Reine Freischaltung — Skill-Inhalt/Prompt/Version unverändert.

### v2.167.0 — Anfragen-Modul in der kurator-Variante aktiv (Juli 2026)

MINOR — `features.anfragen` ist jetzt auch in `configs/kurator.config.json` `true` (vorher nur dev + pl + as).
Beide Anfragen-Plugins hängen am selben `featureFlag: 'anfragen'` ([index.ts](src/plugins/anfragen/index.ts)) —
das bisherige `false` in kurator blendete darum **auch die Kuration-Settings-Seite** aus, obwohl kurator die
Kuratoren-/Admin-Variante ist. Damit war die team-weite ZIM-FAQ-Assistent-URL in keinem Produktions-Build
setzbar (nur dev). Mit dem Flag erscheint in kurator jetzt:

- das **Anfragen-Workflow-Plugin** in der Sidebar (`.msg` → Anonymisieren → externe Runde → Wiedereinsetzen), und
- die **Kuration-Seite „Anfragen"** (nach Kurator-Login) zum Setzen der externen URL, die
  [AnfragenEinstellungenPage](src/plugins/anfragen/AnfragenEinstellungenPage.tsx) team-weit nach
  `_intern/anfragen-settings.json` auf den Daten-Share schreibt (`atomicWrite` + Audit).

Reiner Config-/Sichtbarkeits-Flip — kein Code geändert. Der `anfrage-anonymisieren`-Skill bleibt seed-seitig
`aktiv: false` (Recall-Gate, bewusste Kurator-Entscheidung) — in kurator also identisch zu pl/as: Modul sichtbar,
Anonymisierung erst nach Skill-Freischaltung. `openrouter.enabled: false` in kurator → Sicherheits-Gate unberührt.

### v2.166.0 — Anfragen: Original-Mailtext vor dem Anonymisieren bearbeitbar (Juli 2026)

MINOR — Im Modul „Anfragen" ließ sich bisher nur die anonyme Fassung (rechte Spalte) editieren; der
Original-Mailtext links war read-only. Damit man Anrede/Signatur oder Text, der die KI irritiert, vor dem
Anonymisieren entfernen kann, ist die linke Spalte jetzt ebenfalls ein Inline-Editor:

- **Editierbarer Original-Mailtext** ([AnonymisierungView.tsx](src/plugins/anfragen/AnonymisierungView.tsx)):
  dieselbe Textarea-mit-PII-Highlight-Backdrop wie das anonyme Pane (kein neues Layout), auto-persistiert
  on-blur nach `originalMd`. `runAnonymisierung()` nimmt den (ggf. editierten) Text als Basis und schreibt
  Original + anonyme Fassung + Basis-Hash in **einem** `upsert` (Save-Lock-Disziplin, Pitfall #16/#20).
  Editierbar in jedem Status (auch nach dem Anonymisieren, um nach einem schlechten Ergebnis nachzubessern).
- **Stale-Gate nach Original-Edit** ([original-hash.ts](src/plugins/anfragen/original-hash.ts)): Beim
  Anonymisieren wird ein synchroner Non-Crypto-Hash (`hashText`, FNV-1a) des Originals als neues optionales
  Feld `Anfrage.anonBasisHash` gestempelt. Weicht der Text danach ab, meldet `istOriginalStale()` die anonyme
  Fassung als veraltet → Badge/Hinweis „Originaltext geändert — erneut anonymisieren", **Export gesperrt**
  (orthogonal zum PII-Export-Guard) bis zur Re-Anonymisierung. Rück-Edit auf den identischen Text löst das
  Gate wieder. Bestandsschutz: Alt-Records ohne `anonBasisHash` gelten nie als veraltet.
- Rein **additiv** (optionales Feld, `normalizeAnfrage` unverändert), keine Migration. Kein Eingriff in
  Transport/Export-Guard/DSGVO-Pfade — `originalMd` bleibt rein lokal, der Guard `anfrage-no-mapping-in-transport`
  ist nicht betroffen. Neuer Unit-Test für `hashText`/`istOriginalStale`; Doku + Screen-Kontext-Doc mitgezogen.

### v2.165.0 — Feedback-Verbesserung via interne KI + Screen-Kontext-Docs (Juli 2026)

MINOR — Die KI-Anreicherung im Feedback-System war bisher wirkungslos (`autoClassifyFeedback`
bricht auf dem internen Streamlit-Transport bewusst ab — genau der Transport, der in Produktion
läuft) und ihr System-Prompt beschrieb noch die alte lernapp-Domäne. Zwei Ergänzungen beheben das,
ohne den bestehenden einfachen Speichern-Pfad anzufassen:

- **Zwei-Button-Submit:** Ist die interne KI verbunden (`useBridgeStatus === 'connected'`), zeigt
  [FeedbackInputStep.tsx](src/components/feedback/FeedbackInputStep.tsx) zusätzlich zum bisherigen
  „Feedback speichern" den CTA **„Feedback speichern & verbessern"**. [FeedbackPanel.tsx](src/components/feedback/FeedbackPanel.tsx)
  zeigt den Verbesserungs-Status danach inline (Spinner → Ergebnis-Karte
  [FeedbackImproveResult.tsx](src/components/feedback/FeedbackImproveResult.tsx) → oder stiller
  Fehlschlags-Hinweis, kein Fehler-Modal). Läuft fire-and-forget sicher weiter, auch wenn das Panel
  geschlossen wird (unmountet bei `!open` nicht).
- **`improveFeedback`-Service** ([feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts)):
  formt das Roh-Feedback in eine Ist/Soll-Anforderung + Akzeptanzkriterien für Claude Code um.
  **Läuft ausschließlich über den internen Streamlit-Transport** — bewusst umgekehrte
  Transport-Polarität zu `autoClassifyFeedback` (DSGVO: Feedback-Text ist in Produktion
  Echt-Nutzertext), kein OpenRouter-Fallback. `LLMClassification` um `anforderung`/
  `akzeptanzkriterien`/`verbessert` erweitert (optional, backward-kompatibel).
  [promptGenerator.ts](src/core/services/feedback/promptGenerator.ts) rendert die neuen Felder im
  „Claude Code Prompt" der Kuratoren.
- **Bildschirmseiten-Kontext-Docs** ([docs/feedback-kontext/](docs/feedback-kontext/)): ein
  kompaktes, versioniertes Markdown-Doc pro nutzer-sichtbarem Plugin (+ globaler `_app.md`-Überblick),
  statisch gebundelt via `import.meta.glob` in [screenContext.ts](src/core/services/feedback/screenContext.ts)
  — liefert der KI-Verbesserung aktuelles App-Wissen statt der bisherigen, im Code eingebrannten und
  veralteten Beschreibung. `DEFAULT_SYSTEM_PROMPT` (Chatbot) bezieht dieselbe Quelle jetzt über einen
  `{{APP_OVERVIEW}}`-Platzhalter. Pflege-Cheatsheet [update-screen-context.md](docs/agents/update-screen-context.md)
  + Claude-Code-Skill + Convention-Guard `screen-context-coverage` (Vollständigkeit + Prompt-Budget).
- Keine Migration, keine neuen Pflichtfelder — bestehendes Auto-Klassifizieren (`autoClassifyFeedback`)
  bleibt inhaltlich unverändert.

### v2.164.0 — Konsolidierungs-Pass (Juli 2026)

MINOR — Wartungs-/Konsolidierungs-Release nach dem Feature-Sprint seit v2.131. **Verhaltens-invariant**
(keine User-sichtbare Änderung); Ziel: weniger Fehler bei künftigen Feature-Arbeiten durch Ist-Zustand-Doku,
Regressionstests an nachweislichen Bug-Hotspots, konservativen Dead-Code-Abbau und Dekomposition der zwei
größten Mixed-Responsibility-Dateien. Keine Migration, keine neuen Stores/Sidecars, keine Registry-Änderung.

- **Doku (Ist-Zustand):** Architektur-Doc [anfragen-modul.md](docs/architecture/anfragen-modul.md) neu
  (`.msg` → interne Anonymisierung → externer ZIM-FAQ-Assistent → deterministische Wiedereinsetzung, mit
  Export-Guard + 3-stufiger URL-Auflösung + Varianten-/Skill-Gate); [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md)
  neu (Tages-Import, Frische-Ampel „● CSV", Projektions-Rebuild bei Mapping-Nachzug — kohäsionsgetrennt von
  [csv-import.md](docs/architecture/csv-import.md)); [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)
  um **Klasse 9** (abgeleitete Daten rebuilden nicht bei Config-Nachzug) + **Klasse 10** (DOM-Scraping fremder
  UIs ist positionsfragil) ergänzt; CLAUDE.md-Decision-Tree nachgezogen. CHANGELOG.md auf v2.131+ gekürzt
  (v2.130.x abwärts ins [Archiv](docs/CHANGELOG-ARCHIV.md) verschoben).
- **Bridge-Antwort-Auswahl testbar** ([answer-selection.ts](src/core/services/ai/streamlit-bridge/answer-selection.ts)
  + [Tests](src/core/services/ai/streamlit-bridge/__tests__/answer-selection.test.ts)): die Echo-Anker-Logik
  (erste Nicht-User-Nachricht nach dem Prompt-Echo, v2.159.4) als **pure Funktion** extrahiert und im
  Bookmarklet gespiegelt, mit **Co-Ausführungs-Drift-Test** (JS + TS gegen dieselben Roster-Fixtures). Kein
  Verhaltens-Umbau — `BRIDGE_REV` unverändert.
- **Regressionstests + Guard-Härtung:** Cross-Programm-Signatur-Rebuild-Test (Klasse 9,
  [list-view-rebuild.test.ts](src/core/services/csv/__tests__/list-view-rebuild.test.ts)); der `no-raw-cta-fill`-
  Guard fängt jetzt auch **opake Schwarz-Inline-Fills** (`#000`/`black`/`rgb(0,0,0)`) — rgba-Overlays + Pastell-
  Boxen bleiben ausgenommen.
- **Dead-Code:** 12 nachweislich tote Dateien entfernt (Komponenten nirgends gerendert, ganze Service-Dateien
  ungenutzt) — konservativ; Feature-Flag-Prädikate, Test-Helfer, string-/IDB-gebundene Konstanten und
  Migrations-Aliase bewusst behalten.
- **Dekomposition** entlang der dokumentierten Verantwortungs-Grenzen: [SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx)
  (643→372 LOC → `SearchInput` + `useSearchResults`), [CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx)
  (568→225 LOC → `SourceList` + `MaintenanceSection` + `SourceModals` + `csv-file-picker`). FS-API-Gesten-Ketten
  unverändert (Bug-Klasse 2).

### v2.163.0 — Feedback-Kurator: Detail-Panel ziehbar + „Abhaken"-Haken deutlicher (Juli 2026)

MINOR — Die Kurator-Feedback-Tickets nutzen jetzt das kanonische resizable Split-Layout
([MasterDetailLayout](src/components/master-detail/MasterDetailLayout.tsx)) statt eines starren 50/50-Grids:
die Grenze zwischen Ticket-Liste und Detail-Panel lässt sich per Drag-Handle verschieben (Breite
persistiert, `teamflow_feedback_kurator_list_width`), Escape schließt das Detail. Ohne Auswahl nimmt die
Liste die volle Breite ein. Außerdem ist der „Umgesetzt"-Abhaken-Haken (v2.162.0) jetzt deutlich sichtbar.

- Die Filter-Chips (Status/Kategorie/Bereich + „Archivierte einblenden") wandern in den Seitenkopf des
  Tickets-Tabs (bleiben beim Scrollen der Liste stehen) — analog zum öffentlichen Board
  ([FeedbackBoardPage](src/plugins/feedback-board/FeedbackBoardPage.tsx)). [FeedbackTicketList](src/plugins/feedback/sections/FeedbackTicketList.tsx)
  ist dadurch reine Zeilen-Liste (wie `FeedbackBoardList`); die Scroll-Pane stellt `MasterDetailLayout`.
- Der Abhaken-Haken ([FeedbackTicketRow](src/components/feedback/FeedbackTicketRow.tsx)) hat jetzt einen
  klar sichtbaren Rahmen (`--tf-text-tertiary`, 1,5 px) statt des kaum sichtbaren `--tf-border`; beim Hover
  erscheint ein Haken-Preview + dezenter Hintergrund. Umgesetzt = grüner Haken (unverändert).
- Kein neues Layout gebaut (CLAUDE.md „Neue Module bauen KEIN eigenes Layout") — der Testballon
  [AntraegePage](src/plugins/antraege/) bleibt die einzige verbliebene Eigen-Implementierung.

### v2.162.0 — Feedback-Kurator: Tickets per 1-Klick als „Umgesetzt" abhaken (Juli 2026)

MINOR — In der Kurator-Feedback-Liste bekommt jede Zeile links einen Checkbox-artigen Haken. Ein Klick
setzt den Status **sofort** auf „Umgesetzt" (kein Ticket öffnen, kein „Speichern"), nochmal klicken macht
rückgängig (→ „Neu"). Vorher brauchte das 4 Schritte (Ticket wählen → Status-Dropdown → „Umgesetzt" →
Speichern). Feinere Stati (Geplant/In Bearbeitung/Abgelehnt) bleiben dem Status-Dropdown im Detail
vorbehalten.

- Neuer Statushelfer `toggleUmgesetzt` in [feedback-status.ts](src/core/services/feedback/feedback-status.ts)
  (schaltet `umgesetzt` ↔ `neu`; Pitfall #21-konform, keine Status-Literale). Test:
  [feedback-status.test.ts](src/core/services/feedback/__tests__/feedback-status.test.ts).
- Die geteilte [FeedbackTicketRow](src/components/feedback/FeedbackTicketRow.tsx) bekommt eine **optionale**
  `onToggleDone`-Prop → der Haken erscheint nur in der Kurator-Liste, das öffentliche Board bleibt
  unverändert. Der Haken ist ein eigener Button **neben** dem Zeilen-Button (kein verschachteltes
  `<button>`); ein Klick darauf wählt die Zeile nicht aus. Umgesetzte Zeilen zeigen einen grünen Haken +
  dezent abgeschwächten Titel.
- Schreiben über `useAsyncAction` (Doppelklick-Schutz) + `updateFeedback` in
  [FeedbackAdminPage.tsx](src/plugins/feedback/FeedbackAdminPage.tsx): optimistisch sofort umgeschaltet, bei
  Schreibfehler Fehlerzeile + Reload (kein Silent-Fail). Umgesetzte Tickets bleiben in der Liste sichtbar
  (`umgesetzt` ≠ archiviert).

### v2.161.6 — Feedback-Kurator: Filter-Chip-Zähler stimmen jetzt mit der Liste überein (Juli 2026)

PATCH — In der Kurator-Feedback-Verwaltung zeigten die Filter-Chips (Status/Kategorie/Bereich) andere
Zahlen als die Anzahl der tatsächlich gelisteten Tickets: „Bug 5", aber nur 1 sichtbares Bug. Ursache:
die Liste blendet **archivierte** Tickets standardmäßig aus, die Zähler zählten aber über **alle** Tickets
(inkl. archivierte) und ignorierten zudem die anderen aktiven Filter. Mit eingeblendeten Archivierten
passte es zufällig — daher die beobachtete Diskrepanz.

- Neues geteiltes Prädikat + Facetten-Zähler in [feedback-filter.ts](src/plugins/feedback/feedback-filter.ts)
  (`matchesFeedbackFilters` + `countForCategory`/`countForStatus`/`countForArea`). Liste **und** Chip-Zähler
  in [FeedbackAdminPage.tsx](src/plugins/feedback/FeedbackAdminPage.tsx) leiten jetzt aus **derselben** Quelle
  ab: jeder Zähler beantwortet „wie viele zeigt die Liste, wenn ich diese Facette wähle?" (andere aktive
  Filter bleiben fix, die eigene Facette filtert sich nicht selbst) → die ausgewählte Chip-Zahl == angezeigte
  Zeilenzahl, auch beim Kombinieren mehrerer Filter.
- Der frühere Sonderfall für den Status-„Alle"-Zähler (respektierte `showArchived`) fällt weg — die Regel
  gilt nun einheitlich für alle drei Chip-Gruppen. Regressionsschutz: 9 Fälle in
  [feedback-filter.test.ts](src/plugins/feedback/__tests__/feedback-filter.test.ts) inkl. des gemeldeten
  „Bug 5 → 1 sichtbar"-Szenarios.

### v2.161.5 — Such-Spalte „Programm" zeigt jetzt „Programm/Unterprogramm" (Juli 2026)

PATCH — Die Spalte **Programm** in der übergreifenden Suche war wenig aussagekräftig, weil sie für alle
Treffer desselben aktiven Programms denselben Wert (`ZIM`) zeigte. Sie zeigt jetzt zusätzlich das
**Unterprogramm-Label** im Format `Programm/Unterprogramm` (z.B. `ZIM/ZIM FuE-Projekte 2025`); ohne
Unterprogramm bleibt es beim reinen Programm-Namen. Reine Anzeige-Verbesserung, keine Datenänderung.

- Neues optionales Feld `unterprogramm` an [UnifiedSearchResult](src/core/types/search-result.ts). In
  [useUnifiedSearch.ts](src/core/hooks/useUnifiedSearch.ts) trägt `mapAntragHit`/`mapDokumentHit` den rohen
  `unterprogramm_id`-Code mit; das sprechende Label wird **nach** der Streaming-Pipeline in einem reinen
  `useMemo` über den bestehenden Hook [useUnterprogrammLabels](src/plugins/antraege/useUnterprogrammLabels.ts)
  aufgelöst (Fallback = Code). Der Effekt-Dep-Array bleibt unberührt → kein zusätzlicher Such-Re-Run.
- `unterprogramm_id` liegt bereits in der Slim-List-View → **kein** `LIST_VIEW_PROJECTION_VERSION`-Bump,
  keine Migration. Die Suche ist auf ein aktives Programm gescoped, daher genügt eine Label-Map.
- Die `programm`-Spalte in [columns.tsx](src/plugins/suche/columns.tsx) kombiniert Accessor + Render zum
  `Programm/Unterprogramm`-Wert (breiter, `truncate` + Tooltip). Sort/Filter/Export laufen über den
  kombinierten Wert — Filtern nach Unterprogramm wird dadurch erstmals möglich.

### v2.161.4 — „Letzter Monat"-Filter aus dem Changelog-Modal entfernt (Juli 2026)

PATCH — Der Zeit-Filter „Letzter Monat" im „Was ist neu?"-Modal ist **ersatzlos entfernt** (wurde nicht
gebraucht). Die Kategorie-Filter (Alle / Neu & Verbesserungen / Bugfixes) und „Alle auf-/zuklappen"
bleiben. Rein UI, keine Verhaltensänderung an den Daten.

- Gelöscht in [ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx): `timeFilter`-State,
  `TimeFilterKey`, `nowMonthIndex`, der `withinTime`-Filter, der Button und die `timeFilter`-Referenzen in
  den Collapsible-Keys. Der „Alle auf-/zuklappen"-Knopf sitzt jetzt direkt via `ml-auto` rechts.
- Die Datums-Ableitung im Parser (`dateIso`/`monthIndex` in
  [deriveChangelog.ts](src/core/components/changelog/deriveChangelog.ts)) bleibt unangetastet — generische,
  getestete Metadaten, nicht Teil des entfernten Filters.

### v2.161.3 — „Mit KI glätten"-Editor aus dem Changelog-Modal entfernt (Juli 2026)

PATCH — Der In-App-Editor „Mit KI glätten / Auf Share speichern" (dev + Kurator-Session) ist **ersatzlos
entfernt**. Er hing an der instabilen Streamlit/AitisiGPT-Bridge und ist überflüssig, seit der geglättete
Nutzer-Changelog hand-gepflegt in der committed [changelog-user.md](src/core/components/changelog/changelog-user.md)
liegt (v2.161.2). Der Changelog ist damit rein **build-eingebettet** — kein Runtime-Share-Weg mehr.

- Gelöscht: `ChangelogPolishPanel.tsx`, `changelogShare.ts` (Read+Write des Share-Sidecars), das Prädikat
  `canPolishChangelog` ([feature-flags.ts](src/config/feature-flags.ts)) und der Share-Lese-Effekt im
  [ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx). Anzeige jetzt schlicht
  `getDisplayChangelog(derived, committedOverride)`.
- Sidecar `_intern/changelog-user.md` ist damit **obsolet** (wird nicht mehr gelesen/geschrieben); eine
  evtl. vorhandene Datei wird ignoriert und darf gelöscht werden. Pflege-Weg: neue Versionen in der
  committed `changelog-user.md` ergänzen (zusammen mit CHANGELOG.md), Rebuild.

### v2.161.2 — Nutzer-Changelog ab v2.100 durchgängig geglättet + gepflegt (Juli 2026)

PATCH — Der Nutzer-Changelog (`changelog-user.md`) ist ab v2.100 vollständig in nutzerfreundliche
Sprache übersetzt und wird ab jetzt **hand-gepflegt zusammen mit CHANGELOG.md** — der unzuverlässige
„Mit KI glätten"-Bridge-Weg ist damit kein Pflichtschritt mehr. Endnutzer sehen im „Was ist neu?"-Modal
durchgängig verständliche Einträge (Nutzen statt Technik), rein interne Umbauten sind zu je einer
schlichten Zeile eingedampft.

- **`changelog-user.md` gefüllt** (62 Minor-Abschnitte v2.100–v2.161, kanonisches `## vX.Y — JJJJ-MM`
  + `### Neu`/`### Verbesserungen`/`### Bugfixes`). Ältere Versionen (< v2.100) leitet das Modal weiter
  automatisch aus CHANGELOG.md ab.
- **Committed Fassung ist jetzt AUTORITATIV** ([ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx)):
  `override = mergeChangelog(committedOverride, shareStand)` — die gepflegte Fassung gewinnt je Version, ein
  (evtl. veralteter) Share-`_intern/changelog-user.md` füllt nur noch Versionen, die sie nicht kennt. Damit
  kann eine alte Share-Datei die gepflegte Fassung **nicht** mehr überschatten (ergänzt v2.161.1).

### v2.161.1 — Changelog-Modal zeigt die neueste Version wieder zuverlässig (Juli 2026)

PATCH — Behebt, dass das „Was ist neu?"-Modal auf einer älteren Version hängen blieb, obwohl der
Build bereits neuer war. Ursache: Ein kuratierter/geglätteter Changelog-Override (der geglättete
`_intern/changelog-user.md` auf dem Share **oder** die committed Fassung) **ersetzte** die aus
CHANGELOG.md abgeleitete Anzeige komplett — und **verdeckte** damit jede Version, die nach dem letzten
Glätten dazukam (z.B. v2.161, während der Override nur bis v2.160 reichte). Kein KI-Glätten und kein
Rebuild konnte das aus Nutzersicht heilen.

- **Anzeige mischt statt ersetzt** (`getDisplayChangelog`, [deriveChangelog.ts](src/core/components/changelog/deriveChangelog.ts)):
  Der Override **gewinnt weiterhin je Version** (behält die schöne Prosa), aber Versionen, die er nicht
  enthält, werden aus der Build-Ableitung **ergänzt**. Die Anzeige hinkt dem Build damit nie wieder
  hinterher — die neueste Version erscheint immer, geglättet oder (noch) roh. Verdrahtet in
  [ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx); der committed-Override greift
  nur noch mit echten `## vX.Y`-Abschnitten.
- **Glätten warnt statt still zu schlucken** ([ChangelogPolishPanel.tsx](src/core/components/changelog/ChangelogPolishPanel.tsx)):
  Nach dem Merge wird geprüft, ob **jede** frisch selektierte Version den Merge überlebt hat. Kam eine
  nicht als parsebarer `## v…`-Kopf von der KI zurück (Bridge/Modell), wird sie jetzt sichtbar als
  fehlend gemeldet statt kommentarlos aus dem zu speichernden Stand zu fallen.
- **Inkrementell-Basis = angezeigter Override** statt nur des Share-Stands: verhindert, dass das Glätten
  bei leerem Share degeneriert und plötzlich „alles ab v2.6" an die KI schickt.

### v2.161.0 — Förderanträge-Tabelle: Gesamtbreite per Griff ziehbar (Juli 2026)

MINOR — Ergänzt v2.159.2 (Tabelle füllt die Fensterbreite): Am **rechten Tabellenrand** sitzt jetzt ein
Griff, mit dem sich die **gesamte** Tabelle breiter/schmaler ziehen lässt — die Spalten skalieren dabei
**proportional** mit (CSS `table-layout: fixed` verteilt die Gesamtbreite auf die Spalten-Gewichte). So passt
man die Tabelle mit einer Geste an einen breiten Monitor an, statt jede Spalte einzeln.

- **Neue Opt-in-Props an `SortableTable`** ([SortableTable.tsx](src/components/data-table/SortableTable.tsx)):
  `totalWidth` (gepinnte Pixel-Breite, `null` = Default/füllen) + `onTotalWidthChange`. Nur wenn gesetzt,
  rendert der rechte Rand den Griff. Die ~7 anderen `SortableTable`-Nutzer (Skills, Regeln, Feedback-Board,
  Auslastung, Anfragen) übergeben nichts → **unverändert** (früher Early-Return auf das bisherige Markup).
- **Verhalten**: Ziehen nach rechts über die Fensterbreite hinaus → horizontaler Scroll; nach links →
  Tabelle schmaler, Weißraum rechts. **Doppelklick** auf den Griff = Reset auf „Fensterbreite füllen".
  Persistiert pro Nutzer ([useTotalTableWidth.ts](src/components/data-table/useTotalTableWidth.ts),
  localStorage `teamflow_antraege_table_total_width`).
- **Komposition mit dem Spalten-Resize**: Beides bleibt. Die `<col>`-Breiten wirken als Gewichte — der
  Einzel-Griff ändert das Gewicht einer Spalte, der Gesamt-Griff die Tabellenbreite; `table-layout:fixed`
  verteilt immer proportional, die zwei Controls kollidieren nicht.
- Verdrahtet in [AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx).

### v2.160.0 — „Mit KI glätten" auch im Kurator-Build (Juli 2026)

MINOR — Der Editor „Mit KI glätten" im Changelog-Modal (schreibt die geglättete `_intern/changelog-user.md`
auf den Share, die alle Varianten zur Laufzeit lesen) war bisher **nur im Dev-Build** sichtbar — daher blieb
der Nutzer-Changelog auf dem Prod-Share beim letzten Dev-Glätten stehen (zuletzt v2.126). Jetzt kann auch der
**Kurator** in seinem Build den Changelog aktuell halten, ohne dass ein Entwickler einspringt.

- **Freigabe erweitert** ([ChangelogDialog.tsx](src/core/components/changelog/ChangelogDialog.tsx)): das Panel
  rendert jetzt via neuem Prädikat `canPolishChangelog(sessionActive)` ([feature-flags.ts](src/config/feature-flags.ts)) —
  dev immer, Kurator-Build zusätzlich mit **aktiver Kurator-Session**. prod/pl/as bleiben außen vor (Nutzer-Changelog
  ist eine Kurations-Aufgabe). Kein neues Auth-Muster; komponiert `isKuratorMenusEnabled()` + Session wie
  `canEditSkillRegistry`.
- **Sicher ohne Crash-Risiko:** der `AIBridge`-Provider hängt app-global über dem Router ([App.tsx](src/core/App.tsx)),
  daher ist `useAIBridge()` im Kurator-Build genauso sicher wie im Dev-Build. Physischer Schreib-Guard bleibt
  `atomicWrite`/`queryPermission`.

### v2.159.4 — Bridge nimmt die ERSTE Antwort nach dem Prompt (AitisiGPT hängt Folge-Begrüßung an) (Juli 2026)

PATCH — Endgültige Ursache, per Live-Console-Dump der AitisiGPT-Seite bewiesen: **AitisiGPT hängt NACH der
eigentlichen Antwort noch eine kanned Folge-Begrüßung an** („Hi! Ich bin Aitisi und recherchiere für dich…").
Das DOM-Roster war `[0] Begrüßung · [1] User-Prompt · [2] JSON-Antwort · [3] Folge-Begrüßung`. Bisher nahm das
Bookmarklet die *letzte* Assistant-Nachricht (v2.159.3: letzte nach dem Echo = `[3]` = Folge-Begrüßung; früher
schlicht die letzte). `isUser` funktioniert korrekt — die Antwort steht nur in der **Mitte**, nicht am Ende.

- **Erste Antwort statt letzter** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  `lastAssistant`): liefert die **erste** Nicht-User-Nachricht **nach** dem Prompt-Echo (`msgs[lastUser+1…]`
  vorwärts). Begrüßung `[0]` steht davor, Folge-Begrüßung `[3]` danach → beide ausgeschlossen; die Antwort `[2]`
  wird getroffen. `lastUser < 0` (Echo nicht gefunden) → `null` statt raten.
- **Marker** `BRIDGE_REV` → `2026-07-02-first-answer`. Diagnose-Roster-Log bleibt.

> ⚠️ **Re-Install nötig** (KI-Tab F5 + Bookmarklet neu ziehen/klicken; Tooltip muss `…first-answer` zeigen).
> Sofort-Alternative ohne Bookmarklet: „Manuell ▾ → Prompt kopieren" + „LLM-Ergebnis einfügen".

### v2.159.3 — Bridge ankert die Antwort am Prompt-Echo statt an einer Zähl-Baseline (Juli 2026)

PATCH — Nachtrag zu v2.159.1: Die LLM-Klassifizierung bekam weiter die AitisiGPT-**Begrüßung** zurück statt
der Antwort (Fehler-Snippet „…Hi! Ich bin Aitisi…"). Bestätigt (Badge-Marker `…baseline` sichtbar → neues
Bookmarklet lief): die v2.159.1-**Zähl-Baseline** ist eine **Race Condition** — sie wird direkt nach dem
Chat-Reset-Rerun erfasst; rendert die Begrüßung auf dem ausgelasteten internen Server erst danach, ist der
Zähler 0 und die Begrüßung gilt fälschlich als „neu" → gegriffen.

- **Prompt-Echo-Anker** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  `lastAssistant`): statt Nachrichten zu zählen, wird die Antwort als **letzte Nicht-User-Nachricht *nach* dem
  Prompt-Echo** (der letzten User-Nachricht) bestimmt. Die Begrüßung steht immer *vor* unserem Prompt →
  render-timing-**unabhängig** ausgeschlossen. Ersetzt die Zähl-Baseline (v2.159.1).
- **Diagnose-Netz:** Beim Finalisieren loggt das Bookmarklet das Nachrichten-Roster (Anzahl, je User/Assistant
  + erste 30 Zeichen) + die gewählte Antwort in die Konsole (F12) — falls es *doch* bricht, sehen wir die echte
  AitisiGPT-Struktur statt zu raten.
- **Marker** `BRIDGE_REV` → `2026-07-02-echo-anchor` (Re-Install im Badge-Tooltip verifizierbar).

> ⚠️ **Re-Install nötig** (KI-Tab F5 + Bookmarklet neu ziehen/klicken; Tooltip muss `…echo-anchor` zeigen).
> Sofort-Alternative ohne Bookmarklet: „Manuell ▾ → Prompt kopieren" + „LLM-Ergebnis einfügen".

### v2.159.2 — Förderanträge-Tabelle nutzt die volle Browserbreite (Juli 2026)

PATCH — Die Tabellen-Ansicht der Förderanträge (`viewMode === 'compact'`) war auf `max-w-6xl` (~1152px)
gedeckelt. Sobald über den Spalten-Picker mehr Spalten eingeblendet wurden, als in diese Box passen
(z.B. FKZ · TIB · Akronym · Status · FB Status · PreCheck Status · Frist · Erstentscheidung), wurden die
rechten Spalten abgeschnitten — und ein breiteres Browserfenster half nicht, weil der Cap die zusätzliche
Breite ignorierte.

- **Cap nur noch für die List-View** ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx),
  `toolbarClass` + `contentClass`): der `max-w-6xl`-Lesbarkeits-Cap wandert vom „list+compact"-Zweig in
  einen `viewMode === 'list'`-only-Zweig. Tabelle (Compact) + Karten nutzen jetzt die **volle** verfügbare
  Breite; auf breiten Monitoren werden alle eingeblendeten Spalten ohne horizontalen Scroll sichtbar.
- **Keine neue Mechanik nötig**: `AntraegeTable` rendert bereits über `SortableTable` mit `fitContentWidth`
  (Tabelle füllt den Container, scrollt erst bei Spaltensumme > Container) + Spalten-Resize inkl.
  Drag-Handle an der letzten Spalte — „am rechten Rand der letzten Spalte breiter ziehen" funktioniert damit
  direkt. Die List-View behält ihren Lesbarkeits-Cap (lange Text-Zeilen).

### v2.159.1 — Bridge greift die Begrüßung statt der Antwort (Baseline-Fix) (Juli 2026)

PATCH — Nachtrag zu v2.157.1: die LLM-Klassifizierung kam trotz sichtbar korrektem JSON weiterhin nicht in
der App an (am echten Rechner reproduziert: 3× Prompt+Reset, jedes Mal „0/0, 1 Fehler"). Bestätigte Ursache:
Das Bookmarklet las **die falsche Chat-Nachricht**.

- **Baseline im Bookmarklet** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  `runRequest`): `lastAssistant()` lieferte schlicht die *letzte* Nicht-User-Nachricht — nach jedem Reset ist das
  die AitisiGPT-**Begrüßung** („Informationen sprechen…"), bis die echte Antwort kommt. Die Bridge finalisierte
  darauf → `parseLLMResponse` fand kein `[` → Fehler → Retry → dasselbe. Neu wird **vor dem Absenden** die
  Nachrichtenzahl als `baseline` gemerkt; nur Nachrichten **ab** diesem Index gelten als Antwort auf diese
  Anfrage. Schützt auch bei fehlgeschlagenem Reset und im Chat-Modus mit Verlauf. (Die Doku beschrieb diese
  „Baseline-Nachrichtenzahl vor dem Senden" bereits — im Code fehlte sie.)
- **Versions-Marker im Bookmarklet** (`BRIDGE_REV`): Badge-Tooltip im KI-Tab + `window.__teamflowBridgeRev` +
  Konsolen-Log beim Aktivieren — damit „läuft das neue Bookmarklet?" ohne Rätselraten prüfbar ist.
- **Diagnostischer Fehler** ([llm-klassifizierung.ts](src/plugins/auslastung/services/klassifizierung/llm-klassifizierung.ts)
  + [LLMKlassifizierungButtons.tsx](src/plugins/auslastung/components/LLMKlassifizierungButtons.tsx)):
  `parseLLMResponse`-Fehler tragen jetzt einen Antwort-Snippet („Antwort-Anfang: „…""), und die UI zeigt bei
  0 Ergebnissen die **erste** Fehlermeldung persistent statt nur „(N Fehler)".

> ⚠️ **Re-Install nötig:** Bookmarklet erst nach KI-Tab-Reload (F5) + Neu-Ziehen + Klick aktiv. Verifizieren
> über den Badge-Tooltip (zeigt `rev 2026-07-02-baseline`).

### v2.159.0 — Sidebar-Statusleiste zweizeilig + kontextuelles „Zeig es mir" (Juli 2026)

MINOR — Die Sidebar-Fußzeile war einzeilig überfüllt (`Neu hier?` + Ampeln `● Sync ● CSV ● KI` +
Versionsnummer), und ab Breite < 200 px wurde `Neu hier?` ganz ausgeblendet. Weil der User die Sidebar oft
schmal zieht (Bildschirmbreite für die Listenansichten), fehlte dann der Einstieg. Neu ist die Fußzeile
**zweizeilig**, damit auch schmal alles sichtbar bleibt:

- **Zeile 1**: „Neu hier?" / „Zeig es mir" (links, **ohne** Icon) + Versionsnummer (rechts).
- **Zeile 2**: nur die Status-Ampeln `● Sync ● CSV ● KI`, linksbündig (Punkt+Wort „Variante D" bleibt).
- **Kontextuell**: auf **Home** heißt der Button „Neu hier?" und startet die Onboarding-Tour; auf jeder
  **anderen** Seite heißt er „Zeig es mir" und öffnet einen kleinen Info-Dialog, der ankündigt, dass hier
  bald ein seitenspezifischer Anwendungsfall gezeigt wird (Suche: Suche + Trefferfilterung/KI-Suche ·
  Auslastung: kompletter Zuweisungs-Weg über alle Tabs). Die eigentlichen Use-Case-Touren sind Folgearbeit.
- **Rail (eingeklappt, 52 px)**: die drei Ampeln nur noch als reine Punkte (neues optionales `compact`-Flag
  an `SyncStatusIndicator`/`CsvFreshnessIndicator`/`BridgeStatusIndicator`), zentriert.
- Additiv, keine User-Aktion, kein Daten-Share-/IDB-Layout-Wechsel. Neu: [FooterShowcaseButton.tsx](src/core/components/FooterShowcaseButton.tsx);
  Umbau der Fußzeile in [ShellLayout.tsx](src/core/ShellLayout.tsx) (`FOOTER_NARROW_THRESHOLD`/`footerNarrow` entfallen).

### v2.158.2 — Spalten „FB Status" / „PreCheck Status" bleiben nicht mehr leer nach Mapping-Nachzug (Juli 2026)

PATCH — Auf manchen Rechnern/Varianten blieben die einblendbaren Tabellen-Spalten **„FB Status"** und
**„PreCheck Status"** leer, obwohl Schema-Mapping **und** Rohdaten vorhanden waren (belegt: auf demselben
Rechner `kurator`-DB befüllt, `pl`-DB leer bei identischem Schema + 11.633 Roh-Datumswerten). Ursache: Die
FB/PC-Label werden bei der **List-View-Projektion** berechnet, indem die Legacy-Datums-Codes (`D_PC+`,
`D_XPC+`, …) gegen die Schema-`column_mapping` aufgelöst werden. Wurden diese Spalten **nachträglich**
gemappt, ändert das **keinen** Antrag-Record → weder der count-basierte Backfill noch der inkrementelle
Snapshot-Diff bauen die Projektion neu, und der Code-Versions-Marker blieb gleich ⇒ der Altbestand behielt
dauerhaft leere `fb_/precheck_status_label`.

- **Sofort-Fix (flotten-weit)**: `LIST_VIEW_PROJECTION_VERSION` **4 → 5** ([list-view-migration.ts](src/core/services/csv/list-view-migration.ts))
  → Marker-Mismatch löst beim ersten Start je Variante **einen** Voll-Rebuild aus (~5 s bei 14k, bestehende
  Boot-Statuszeile; crash-safe, Marker erst nach Erfolg). Danach sind die Spalten befüllt.
- **Härtung (schließt die Bug-Klasse)**: zusätzlicher **Schema-Signatur-Guard** — eine deterministische
  Signatur der aufgelösten FB/PC-Felder (code→feld→label über alle Programme, `murmurhash3`) wird neben dem
  Marker persistiert (`list-view-projection-schema-sig`). Ändert sich die Signatur (Mapping neu/ge-`ignore`d/
  Label geändert), erzwingt der Boot-Guard automatisch einen Rebuild — **ohne** künftig den Code-Marker von
  Hand bumpen zu müssen. Eine *fehlende* Signatur (Bestand vor v2.158.2) löst **keinen** Rebuild aus (das
  deckt der v4→v5-Bump ab) und wird nur lazy nachgetragen; der „Marker aktuell → No-op/Backfill"-Pfad bleibt
  unangetastet. `isListViewProjectionCurrent` (inkrementeller Sync) bleibt bewusst marker-only — Mapping-
  Änderungen greifen beim nächsten Start.
- Additiv, **keine User-Aktion**, kein Daten-Share-/IDB-Layout-Wechsel (nur ein neuer `kv`-Key). Tests:
  [list-view-rebuild.test.ts](src/core/services/csv/__tests__/list-view-rebuild.test.ts) (Signatur-Guard löst
  Rebuild aus / fehlende Signatur ist No-op).

### v2.158.1 — Aktuelles Quartal rollt automatisch mit dem Kalender (Juli 2026)

PATCH — `config.aktuellesQuartal` wurde beim Setup einmal aus dem Datum abgeleitet und danach nie
weitergerollt: nach dem Quartalswechsel am 1.7. hing das ganze Auslastungs-Modul auf `2026-Q2`, obwohl
schon Q3 war (Übersicht, Zuweisung, Matching, Home-Selbsteintragung). Neu wird der Wert **read-time beim
Laden** nie mehr hinter das heutige Kalenderquartal zurückfallen — `effektivesAktuellesQuartal()`
([types.ts](src/plugins/auslastung/types.ts)) hebt einen veralteten Wert auf das heutige Quartal an, lässt
ein bewusst in die **Zukunft** gesetztes Quartal (Voraus-Planung) aber unberührt (fixed-width-Format →
lexikalischer = chronologischer Vergleich, auch über Jahresgrenzen). Angewandt im Load-Chokepoint
`normalizeAuslastungData()` ([auslastung-store.ts](src/plugins/auslastung/services/auslastung-store.ts)),
daher greift es modulweit ohne Änderung der vielen `aktuellesQuartal`-Leser und **ohne erzwungenen
Config-Write** (read-only-User bekommen das korrekte Quartal ebenfalls). Der Quartals-Vergleich aus v2.158.0
bietet damit korrekt Q2 + Q1 an. Tests: [statistik.test.ts](src/plugins/auslastung/__tests__/statistik.test.ts).

### v2.158.0 — Statistik-Übersicht: Quartals-Vergleich (Delta-Overlay) (Juli 2026)

MINOR — Die Statistik-Übersicht im Auslastungs-Tab „Auslastung MA" zeigt weiterhin standardmäßig das
aktuelle Quartal, bietet aber jetzt ein Dropdown „Vergleichen mit" mit den **vergangenen Quartalen des
aktuellen Jahres** an. Wählt der User eines aus, wird es als dezentes **Delta-Overlay** eingeblendet — kein
zweiter Datenspeicher, nur ein zusätzlicher Aufruf der bereits reinen, per `quartal` parametrisierten
Aggregatoren.

- **Reiner Helper** `vergangeneQuartaleImJahr(aktuellesQuartal)` in [statistik.ts](src/plugins/auslastung/services/kapazitaet/statistik.ts):
  `2026-Q2 → ['2026-Q1']`, `2026-Q4 → ['2026-Q3','2026-Q2','2026-Q1']`, Q1/ungültig → `[]`.
- **Vergleichs-Statistik-Hook** [useVergleichStatistik.ts](src/plugins/auslastung/hooks/useVergleichStatistik.ts):
  ruft `computeQuartalsAuslastung` + `computeQuartalsStatistik` direkt für das gewählte Quartal auf (NICHT über
  den auf `aktuellesQuartal` gekeyten `cachedIndex` aus [useAuslastungIndex.ts](src/plugins/auslastung/hooks/useAuslastungIndex.ts)
  — der würde sonst thrashen). Kosten O(antraege) fallen nur bei aktivem Vergleich an.
- **UI**: Dropdown [StatistikVergleichControl.tsx](src/plugins/auslastung/views/uebersicht/StatistikVergleichControl.tsx)
  (shadcn-Select, nur gerendert wenn es frühere Quartale im Jahr gibt); Delta-Overlay in
  [HeadlineInsight.tsx](src/plugins/auslastung/views/uebersicht/HeadlineInsight.tsx) (zweite Balkenmarkierung +
  Referenz-/Δ-Zeile) und [KpiGrid.tsx](src/plugins/auslastung/views/uebersicht/KpiGrid.tsx)/[KpiCard.tsx](src/plugins/auslastung/views/uebersicht/KpiCard.tsx)
  (dezente `Q1: …`-Vergleichszeile je Karte). Abschnitts-Kopf zeigt bei aktivem Vergleich `2026-Q2 vs 2026-Q1`.
- **Caveat (bewusst)**: MA-Bestand + Kapazitäts-Config sind Ist-Zustand und werden rückwirkend angewandt
  (Näherung; `abgemeldet` ist quartalsgenau); ein vergangenes Quartal ist zu 100 % verstrichen → der Vergleich
  zeigt den End-Buchungsstand. Alles additiv — ohne gewähltes Vergleichsquartal ändert sich nichts.
- Tests: [statistik.test.ts](src/plugins/auslastung/__tests__/statistik.test.ts) (Helper + Vergangenheits-Quartal-Sanity).

### v2.157.1 — Bridge erkennt Generierungs-Ende im Auslastungs-Modul wieder (Juli 2026)

PATCH — Seit der Bridge-„Optimierung" für das Modul Anfragen (v2.134.1, `SETTLE_MS 2500→5000`) kam die
„Anträge mit LLM klassifizieren"-Antwort nicht mehr in der App an: die vollständige JSON-Antwort stand
sichtbar im KI-Tab, wurde aber nie zurückgesendet. Ursache + Fix in drei Schichten:

- **Bookmarklet — Ende an Inhalts-Stabilität statt DOM-Ruhe** ([bridge-snippet.source.js](src/core/services/ai/streamlit-bridge/bridge-snippet.source.js),
  `runRequest`): Der Finalisierungs-Timer hing an einem modul-weiten `lastDomActivity`, das ein
  MutationObserver auf den **gesamten** Streamlit-Container bei *jeder* DOM-Mutation zurücksetzte. Generierungs-
  unabhängige Churn der KI-Seite (Status-Widget, Reruns) hielt `idle` dauerhaft unter dem — seit v2.134.1
  strengeren — 5-s-Fenster → es wurde nie finalisiert (180-s-Hard-Cap bzw. 200-s-App-Timeout). Neu misst der
  Timer nur noch die **Inhalts-Stabilität der Antwort** (`lastContentChange`, zurückgesetzt bei echter
  Antwort-Änderung + laufendem `isRunning()` als Pausen-Schutz). `isRunning()` bleibt das Pausen-Signal.
- **Auslastungs-Caller gehärtet wie Anfragen** ([llm-klassifizierung.ts](src/plugins/auslastung/services/klassifizierung/llm-klassifizierung.ts),
  `klassifiziereBatch`): **Ping-Guard** vor dem Lauf (getrennte KI ⇒ sofort „Interne KI nicht erreichbar"
  statt Endlos-Spinner durch einen bookmarklet-losen Auto-Tab); **Chat-Reset je Versuch** (`safeResetChat`,
  keine `lastAssistant()`-Staleness über Batches); **bounded Retry** nur auf Parse-Fehler (Timeout/Abort werden
  NICHT retryt). Test [llm-klassifizierung.test.ts](src/plugins/auslastung/services/klassifizierung/__tests__/llm-klassifizierung.test.ts).
- **Button spiegelt Live-Status** ([LLMKlassifizierungButtons.tsx](src/plugins/auslastung/components/LLMKlassifizierungButtons.tsx)):
  bei explizit getrennter KI (`useBridgeStatus === 'disconnected'`) deaktiviert + Hinweis „Interne KI nicht
  verbunden" — nicht bei `'unknown'` (Boot); der Ping-Guard bleibt der Backstop.

> ⚠️ **Re-Install nötig:** Die Bookmarklet-Änderung wirkt erst nach **einmaligem Neu-Installieren** des
> Bridge-Bookmarklets im KI-Tab (Einstellungen → Streamlit-Bridge). Bis dahin läuft das alte Bookmarklet weiter.

### v2.157.0 — Auslastungs-Filter überleben die Session (Juli 2026)

MINOR — Die Filter-Segmente der Auslastungs-Tabs lagen bisher in reinem `useState` und gingen bei jedem
Reload verloren. Neu werden sie pro Tab in localStorage gehalten und beim nächsten Aufruf wieder angewandt
— und Segmente mit einem vom Standard abweichenden Wert klappen dabei automatisch auf, sodass der User
sieht „hier ist etwas gefiltert".

- **Neuer Helfer [filterPersistence.ts](src/plugins/auslastung/views/filterPersistence.ts)** — eine Heimat
  für die Filter-Persistenz des Moduls: safe `readJson`/`writeJson` (try/catch + defensive Enum-Validierung,
  Fallback auf Default bei Müll) und drei typisierte Read/Persist-Paare. Reine UI-Preference in localStorage
  (kein Varianten-Suffix, origin-weit wie `SPLIT_STORAGE_KEY`). Keys `tf-auslastung-{zuweisung,klassifizierung,maliste}-filters`.
- **Verdrahtet** in [ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx) (Kategorie/
  Antragstyp/Status/Sortierung), [KlassifizierungsReview.tsx](src/plugins/auslastung/views/KlassifizierungsReview.tsx)
  (Sicht-Filter/Kategorie/Antragstyp) und [MaListSection.tsx](src/plugins/auslastung/views/uebersicht/MaListSection.tsx)
  (Kategorie/Antragstyp/Inaktive-Toggle; die View-Umschaltung war schon persistiert): Lazy-Init aus dem Store,
  ein `useEffect` schreibt Änderungen zurück.
- **Kein Eingriff in `CollapsibleSeg`:** das Auto-Aufklappen bei `value !== defaultValue` existiert bereits;
  der Auf-/Zuklapp-Zustand (`manualClosed`) wird bewusst **nicht** persistiert (Reset beim Reload). Das
  „Sortiert nach"-Segment bleibt bewusst eingeklappt (`startCollapsed`) — Wert wird persistiert & angewandt,
  die eingeklappte Pille zeigt ihn ohnehin; eine Sortierung blendet keine Daten aus.
- **Härtung:** eine zwischenzeitlich entfernte Überkategorie wird beim Laden gegen `config.ueberKategorien`
  abgeglichen (Cold-Start-safe) und auf „Alle" zurückgesetzt, statt still 0 Ergebnisse zu filtern.
- Test [filter-persistence.test.ts](src/plugins/auslastung/__tests__/filter-persistence.test.ts).

### v2.156.1 — „Erzwungen neu prüfen" nur noch in dev + kurator (Juli 2026)

PATCH — Der ● CSV-Panel-Knopf „Erzwungen neu prüfen" (v2.155) ist ein Diagnose-/Kurations-Werkzeug und
verwirrte End-User in pl/as/prod. Er wird jetzt hinter `isKuratorMenusEnabled()` gegated
([CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx)) → sichtbar nur in dev + kurator,
weg in pl/as/prod. „Jetzt importieren" (bei neuen Exporten) + die Fixture-/Datei-fehlt-Warnzeilen bleiben in
allen Varianten.

### v2.156.0 — Leerer Unterprogramm-Store verwirft nicht mehr den ganzen Master-Import (Juli 2026)

MINOR (Bugfix + Härtung) — Root-Cause des Prod-Vorfalls „Import läuft durch, neue Anträge fehlen": Der
Master-Import baut aus den **aktiven** Unterprogramm-Codes eine Allowlist und verwirft jede Zeile, deren
`unterprogramm_id` (Spalte `FM_NUMMER`) nicht darin steht ([importer.ts](src/core/services/csv/importer.ts),
[unterprogrammRegistry.ts](src/core/services/csv/unterprogrammRegistry.ts) `getActiveUnterprogrammCodes`). Auf
Prod war der `unterprogramme`-Store nach dem Fixture-Vorfall **leer** → **leere Allowlist** → **jede** neue
Master-Zeile fiel durch → seit Tagen kamen 0 neue Anträge rein (Stand eingefroren), ohne Fehler. Dev (16 aktive
Codes) importierte normal.

- **Fix:** `getActiveUnterprogrammCodes` liefert bei **leerem** Store (`all.length === 0`) jetzt `null` =
  **kein Filter** (alles importieren) statt einer leeren, alles-verwerfenden Allowlist. „Nie konfiguriert" ≠
  „alle deaktiviert" — Letzteres (Einträge vorhanden, alle `aktiv:false`) bleibt bewusst Skip-all. Damit heilt
  sich eine Umgebung ohne kuratierte Unterprogramme beim nächsten Import selbst. Test `unterprogramm-registry.test.ts`.
- **Sichtbarkeit (gleiche Klasse wie v2.155):** der aufsummierte `skippedInactiveUnterprogramm`-Zähler wandert in
  den `RefreshReport` ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)), die
  `[data-update]`-Zeile und `localStorage.teamflow_last_data_update_timing` (`csv.skippedInactiveUnterprogramm`).
  >0 heißt: die Allowlist greift und schluckt Anträge — jetzt diagnostizierbar statt still.

### v2.155.0 — CSV-Auto-Refresh: still übersprungene Quellen sichtbar + erzwungener Re-Import (Juli 2026)

MINOR — Härtung gegen den „Import läuft durch, aber nichts kommt an"-Fall (Fixtures-Nachgang / Citrix-False-
Negative): der Auto-Refresh verwarf bisher drei Skip-Zustände **still** — Fixture-Quellen (`local_fixture`,
hart ausgeschlossen), unerreichbare Dateien (`file_missing`) und als „unverändert" erkannte Quellen
(`up_to_date`). Auf einem Produktions-pl konnte so eine Fehlkonfiguration (echte Exporte werden nie importiert)
als grünes „Aktuell" erscheinen, ohne Weg, den Erkennungs-Fast-Path zu umgehen.

- **`collectCandidates` meldet die verschluckten Zustände** ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)):
  `CollectResult` trägt jetzt zusätzlich `fixtures` / `fileMissing` / `upToDate` (bisher stillschweigend verworfen).
- **● CSV-Panel ist ehrlich** ([CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx)): In einem
  Prod-Build (`!isDevFixturesEnabled()`) ist der Punkt bei Fixture-/`file_missing`-Quellen **nicht mehr grün**,
  sondern rot mit Warn-Zeile („N Quelle(n) sind Demo-/Fixture-Quellen — vom Import ausgeschlossen"). Reine
  Entscheidungslogik ausgelagert nach [csv-freshness-state.ts](src/plugins/csv-sources-kuration/services/csv-freshness-state.ts)
  (`deriveCsvFreshnessState`), Test `csv-freshness-state.test.ts` (Regression: prod-Fixture ⇒ nie „fresh").
- **„Erzwungen neu prüfen"** im ● CSV-Dialog: neuer `forceRecheck`-Pfad
  ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts) `decideSourceUpdateState`/
  `checkSourceForUpdate`, durchgereicht via `collectCandidates` + `runDataUpdate`), der mtime/Größe/Checksum
  komplett umgeht → jede erreichbare, verknüpfte Quelle wird re-importiert (Importer difft per Row-Hash,
  schreibt nur bei echtem Delta). Selbstbedienungs-Weg für pl gegen einen Citrix-False-Negative, ohne kurator-
  Build. Fixtures/Permission bleiben ausgeschlossen. Test in `decide-source-update-state.test.ts`.
- **Diagnose ohne DevTools**: die `[data-update]`-Zeile + `localStorage.teamflow_last_data_update_timing` führen
  jetzt `skipped(fixtures/fileMissing/upToDate)` bzw. `csv.fixturesExcluded/fileMissing/upToDate`
  ([data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts) `logTiming`) — „warum wurde 0
  importiert" ist damit ablesbar.

### v2.154.0 — CSV-Schema-Konfiguration zwischen Umgebungen übertragbar (Export/Import) (Juli 2026)

MINOR — Neuer Weg, eine kuratierte CSV-Quellen-Konfiguration (Anzeige-Name, Spalten-Mapping **inkl.
Labels/Gruppen**, join_key, priority, encoding, separator) von einer Umgebung in eine andere zu übernehmen —
gedacht für den Fixture-Überschreib-Nachgang, bei dem Produktion falsche Namen + Teil-Mapping trägt, die
korrekte Konfiguration aber lokal liegt.

- Im CSV-Quellen-Detaildialog ([CsvSchemaDetailDialog.tsx](src/plugins/csv-sources-kuration/CsvSchemaDetailDialog.tsx))
  neuer Abschnitt „Konfiguration übertragen": **Exportieren** (JSON-Download) + **Importieren** (JSON-Datei).
- Der Import übernimmt Name + Mapping **in das bestehende Schema hinein** und **behält dessen ID** — keine
  Row-Hash-/Snapshot-Migration, kein Daten-Reset. Instanz-Felder (id, programm_id, created_at, source_file_name,
  Checksums, last_*) und das strukturelle `is_master` bleiben beim Ziel. Weil das Mapping danach neu ist, ist
  **ein** Re-Import nötig („CSV neu wählen") — Hinweis wird angezeigt.
- Reine Funktionen + Validierung in [schema-config-transfer.ts](src/plugins/csv-sources-kuration/services/schema-config-transfer.ts)
  (`buildSchemaConfigExport` / `parseSchemaConfig` / `applyConfigToSchema`, Kennung `teamflow-csv-schema-config` v1),
  Tests: `schema-config-transfer.test.ts`. Audit-Actions `csv_schema_config_exported` / `csv_schema_config_imported`.

### v2.153.2 — CSV-Status zeigt importierte Datei + Export-Datum pro Quelle (Juli 2026)

PATCH — Der Sidebar-CSV-Status (● CSV → Dialog „CSV-Datenimport") zeigte bisher nur den Zeitpunkt des
letzten Import-*Laufs*. Damit man sieht, ob wirklich der nächtliche Export eingelesen wurde, listet der Dialog
jetzt **pro Quelle**: Dateiname, **„Export vom …"** (Datei-mtime `source_last_modified`), Import-Zeitpunkt
(`last_imported_at`) und Zeilenzahl (`last_row_count`). Reine Anzeige vorhandener Schema-Felder in
[CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx) — kein Datenmodell-/Verhaltens-Change.
Das „Export vom"-Datum ist der Beleg, welche Datei-Version tatsächlich importiert wurde.

### v2.153.1 — CSV-Auto-Refresh: reine Zusatzspalten blockieren den Tages-Import nicht mehr (Juli 2026)

PATCH — Der tägliche automatische CSV-Import zeigte in kurator/pl/as jeden Morgen den blockierenden Dialog
„Auto-Refresh abgeschlossen — N Quellen brauchen deine Aufmerksamkeit" (z. B. „139/190 neue Spalten"),
sobald die echte CSV mehr Spalten hatte als im Schema gemappt. Ursache: `hasDrift()` blockierte bei **jeder**
nicht gemappten Zusatzspalte hart ([auto-refresh.ts](src/plugins/csv-sources-kuration/services/auto-refresh.ts)
`continue`), obwohl der Importer solche Spalten ohnehin ignoriert — und nichts persistierte eine Auflösung,
also wiederholte es sich täglich (Nachwirkung des Fixture-Überschreib-Vorfalls v2.139/v2.140: die 2 Quellen
tragen ein unvollständiges, aus Fixtures konvertiertes Mapping).

- **Reine `newColumns`-Drift** (nichts fehlt, nur Zusatzspalten) wird im Auto-Refresh jetzt **headless als
  `{ ignore: true }` ins Schema übernommen** (`adoptNewColumnsAsIgnored` → reuse `mergeNewColumns`), dann
  normal importiert. Drift verschwindet dauerhaft (idempotent), kein Start-Modal. Audit: neue Action
  `csv_schema_columns_auto_ignored`. Nicht-blockierende Info-Zeile im Dialog (falls dieser aus anderem Grund
  öffnet).
- **`missingFromCsv > 0`** (eine gemappte Spalte verschwindet) bleibt **blockierend** (`report.drift` → Modal) —
  der gefährliche Fall, der echte Felder leeren kann.
- Neuer Klassifikator `isNewColumnsOnlyDrift` ([csv-drift-check.ts](src/plugins/csv-sources-kuration/services/csv-drift-check.ts)),
  Tests: `csv-drift-check.test.ts` (neu) + `new-column-mapping.test.ts` (Auto-Adopt + Drift-Idempotenz).
- **Ergänzend (Daten, einmalig durch Kurator/PL):** die 2 Quellen „Antragsbasis (Master)" / „Bewilligungsdetails"
  über „CSV neu wählen" sauber gegen den echten Export registrieren (Encoding Windows-1252), damit tatsächlich
  benötigte Felder gemappt sind statt nur ignoriert.

### v2.153.0 — Anfragen-Modul auch in pl + as verfügbar (Juni 2026)

MINOR — `features.anfragen` ist jetzt in den Varianten **pl** und **as** aktiv (vorher nur dev). Das
Workflow-Plugin „Anfragen" (id `anfragen`, `kuratorOnly:false`) erscheint damit in der pl- und as-Sidebar;
das Kuration-Pendant (`anfragen-kuration`, `category:'kuration'`) bleibt mangels Kurator-Menüs unsichtbar.
Reine Config-Änderung (`configs/pl.config.json` + `configs/as.config.json`). **Das Recall-Gate des
Anonymisierers gilt unverändert:** pl/as sind `variant:'production'` → der Skill bleibt `aktiv:false`, die
Anonymisierung zeigt „Skill nicht freigeschaltet", bis Thomas manuell freigibt (vgl. v2.152.1: dev-only
Runtime-Override). Aufnahme/Review/Wiedereinsetzung funktionieren auch ohne aktiven Skill.

### v2.152.1 — Anfragen: Anonymisierer in dev immer freigeschaltet (Gate nur Produktion) (Juni 2026)

PATCH — Der Anonymisierungs-Skill ist in **dev** (`isDevContext()`) jetzt immer freigeschaltet, sobald
er geladen ist — damit der Entwickler testen kann, ohne den geteilten Seed anzufassen. Das Recall-Gate
(`aktiv: true` erst nach manueller Freigabe) gilt unverändert für alle **Produktions-Varianten**
(prod/pl/kurator/as). Reiner Runtime-Override (`istAnonymisiererFreigeschaltet`, anonymisierung.ts); der
Seed bleibt `aktiv: false`. Die pure `istAnonymisiererAktiv`-Semantik (und ihr Gate für Produktion) ist
unverändert.

### v2.152.0 — Anfragen: Zwei-Stufen-Anonymisierung (Pseudonymisieren + Verallgemeinern) (Juni 2026)

MINOR — Die interne KI im Modul „Anfragen" trennt jetzt zwei Mechanismen in EINEM Lauf, damit der
externe ZIM-FAQ-Assistent den fachlichen Sinn behält (bisher schluckten opake `[SONSTIGES_N]`-Platzhalter
den Inhalt). Skill bleibt `aktiv: false` (Recall-Gate ausstehend — Freischaltung manuell durch Thomas).

- **Stufe A — Pseudonymisieren** (`mapping`, unverändert): harte Identifikatoren → `[TYP_N]`, werden
  wörtlich wiedereingesetzt.
- **Stufe B — Verallgemeinern** (`verallgemeinerungen`, NEU): beschreibender Freitext wird inline auf die
  fachliche Abstraktionsebene gehoben (Branche/Technologiefeld bleibt, Identität weg). Wird NIE
  wiedereingesetzt, hat keinen Platzhalter, verunreinigt `mapping` nicht. `verallgemeinerungen[].original`
  ist sensibel (nur lokal) — vom Convention-Guard `anfrage-no-mapping-in-transport` mitgeschützt.
- **Skill-Seed** auf Zwei-Stufen-Vertrag gehoben (`version: 2`, Entscheidungsregel im System-Prompt,
  JSON-Beispiel mit beiden Stufen). Parser parst `verallgemeinerungen` additiv-tolerant (fehlt → `[]`,
  Stufe-A-only bleibt gültig); `normalizeAnfrage` macht Alt-Records migrationssicher.
- **UI:** Verallgemeinerungs-Drawer (Original → Verallgemeinert) analog zum Mapping-Drawer; dezenter
  Platzhalter-Export-Hinweis („Diese Platzhalter müssen in der Antwort erhalten bleiben") + Kopier-Button.
- **AntwortView:** fehlende Platzhalter werden zur deutlichen Warnung verschärft (externe KI hat sie
  aufgelöst → kein Wiedereinsetzen); weicher Längen-Hinweis ab ~0,5 A4 (`MAX_ANTWORT_ZEICHEN = 1800`).

### v2.151.2 — App-weit: kein Schwarz/Weiß mehr in Aktiv-/Emphasis-Flächen (Juni 2026)

PATCH — Letzter Schliff: auch die übrigen schwarzen **Aktiv-/Emphasis-Flächen** tragen jetzt den
Profil-Akzent (`--tf-primary`) statt `--tf-text`. Body-Text + Hintergründe bleiben unverändert (Lesbarkeit).

- **Tab-Unterstriche → Akzent:** `ScopeTabs` (Förderanträge + Chat, `variant='tabs'`) und die generische
  `Tabs`-Komponente (Einstellungen-/Section-Nav) — aktiver Tab = `--tf-primary`-Text + `--tf-primary`-
  Unterstrich. Ebenso die hand-gebauten Tab-Leisten (SkillVerwaltung, SkillEditor, KalibrierungsReport)
  und der Reifegrad-Facet-Filter.
- **Badges/Kreise → Akzent:** `empfohlen`-Reifegrad-Badge + der Nummernkreis im Tweak-Editor
  (`bg-[var(--tf-primary)]` + weißer Text).
- **Progress + Step-Dots → Akzent:** `ProgressBar`, Onboarding-Step-Dots, CSV-Wizard- + Filter-Dialog-
  Step-Dots, CSV-Step4-Fortschrittsbalken.
- **Toggles/Inputs → Akzent:** der Regel-Switch (on-Zustand), der Thinking-Toggle (aktiv = Akzent-Light),
  Input-Focus-Border im Antrag-Autocomplete.
- **Guard `no-parallel-scope-tabs`** auf die neue Akzent-Signatur (`border-b-2 border-[var(--tf-primary)]`)
  umgestellt, damit hand-gebaute Unterstrich-Tabs weiter gefangen werden.

### v2.151.1 — App-weit: schwarz-aktive Pills + Segment-Toggles auf Akzent-Light (Juni 2026)

PATCH — Abschluss des Schwarz→Akzent-Durchgangs: alle verbliebenen **Selektions-Pills** und
**Segment-Toggles** mit schwarzem Aktiv-Zustand (`bg-[var(--tf-text)] text-[var(--tf-bg)]`) tragen jetzt
die **Akzent-Light**-Auswahl (`bg-[var(--tf-primary-light)]` + `text-[var(--tf-primary)]`) — konsistent mit
Suche/Auslastung/Alle-Felder und den `ScopeTabs`-Pills. Rein kosmetisch, keine Verhaltensänderung.

- **Filter-Pills:** ReviewPanel (Gutachten), ChangelogDialog (3×), DokumentAufnahme, DokumenteListe,
  dokument-review/FilterBar (inkl. Aktiv-Border → transparent), csv-sources (`PILL_ACTIVE` in NewColumnRow
  + RemapCsvColumnsDialog + Step1Metadata), AdminPanel (dev), FeedbackAnnotator (2×).
- **Segment-Toggles:** MarkdownEditor-View-Mode (2×), Schweregrad (RegelEditor), Modus
  (MusterErkennungEditor), Artefakt-Typ (WorkflowsTab), Abschnitte (StartDialog), Aufnahme-Zuordnung
  (AufnahmeZeile), Setup-StepDots (SetupWizard), Workflow-Stepper (neutrale Aktiv-Stufe).
- **Bewusst gelassen:** der `empfohlen`-Reifegrad-Badge (semantische Skala) + der dekorative
  Nummernkreis im Tweak-Editor; die `SegmentedToggle`-Komponente (Tabelle|Karten) war bereits
  neutral-weiß-aktiv (kein Schwarz).

### v2.151.0 — Auslastung-Modul: CTAs + Filter-Pills auf Profil-Akzent (Juni 2026)

MINOR — Fortsetzung von v2.150: das **Auslastungs-Modul** trug seine Primär-CTAs noch schwarz —
hier aber über **inline `style={{ background: 'var(--tf-text)' }}`** (nicht Tailwind-Klassen), weshalb
sie sowohl die v2.150-Migration als auch den `no-raw-cta-fill`-Guard umgingen. Jetzt durchgängig Akzent.

- **~19 inline-Style-CTAs → `<Button variant="primary">`** über das ganze Modul: „LLM-Klassifizierung
  starten", „Export (mit Kürzeln)" (Cockpit + Import/Export), „HTML generieren", „Mit Kürzeln (XLSX)",
  „+MA hinzufügen", „Corpus aufbauen", „Freigeben" (Klassifizierungs-/Verbund-Tabellen), „Zuweisen",
  „Speichern" (MA-Detail / Antragstyp-Override), Dialog-CTAs (Passwort, Zugang, Onboarding-/Kompetenz-
  Import inkl. Datei-Wähler als `<Button asChild><label>`), Setup-Wizard-Schritte, Kalibrierungs-Report.
  Inline-Style entfernt, `busy → loading`, Icons via `icon={…}`; co-lokalisierte Zweitaktionen → Outline.
- **Filter-Pills auf Akzent-Light** (Selektion, nicht gefüllter CTA-Akzent): die Status-Pills der
  Klassifizierungs-Review („Alle/Review nötig/LLM-Vorschlag/Freigegeben/Unvollständig") und die
  Förderanträge-„Alle Felder"-Tabs (`.af-tab.on`, [felder.css](src/plugins/antraege/alleFelder/felder.css))
  — `--tf-primary-light`-Fläche + `--tf-primary`-Text, wie die `ScopeTabs`-Pills (analog v2.150.1 Suche).
- **Guard `no-raw-cta-fill` gehärtet:** erkennt jetzt auch die **inline-Style**-Variante
  (`background:'var(--tf-text)',color:'var(--tf-bg)'`), nicht nur Tailwind-Klassen — schließt die
  Recall-Lücke, durch die die Auslastungs-Buttons durchrutschten.
- **Bewusst NICHT geändert:** Segment-Toggles (Tabelle|Karten, Manuell ▾, Setup-StepDots,
  Schweregrad/Modus/Artefakt-Typ), Kategorie-Chips (✓ IT/DT/…), Status-Badges, Confidence-Dots,
  Progress-Bars/Marker. Andere Module mit schwarz-aktiven Filter-Pills (ReviewPanel, ChangelogDialog,
  csv-sources, dokument-review, FeedbackAnnotator …) bleiben vorerst — separater App-weiter Sweep offen.

### v2.150.1 — Suche: Typ-Filter-Chips auf Akzent statt Schwarz (Juni 2026)

PATCH — Die Typ-Filter-Pillen auf der Suche-Seite („Alle · Förderanträge · Dokumente",
[SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx)) trugen im Aktiv-Zustand noch einen schwarzen Fill
(`bg-[var(--tf-text)]`) — hand-gebaut am kanonischen `ScopeTabs` vorbei. Jetzt die gleiche **Akzent-Light**-
Auswahl wie die `ScopeTabs`-Pills (Chat-Historie): `bg-[var(--tf-primary-light)]` + `--tf-primary`-Text.
Selektionszustand = subtiler Profil-Akzent (nicht der laute gefüllte CTA-Akzent — der bleibt Aktions-
Buttons vorbehalten). Border immer 0,5px (transparent wenn aktiv) → kein Größen-Sprung; `aria-pressed`
ergänzt. Andere hand-gebaute Segment-Toggles (Schweregrad, Modus, Artefakt-Typ) bleiben vorerst schwarz.

### v2.150.0 — CTA-Buttons app-weit auf die Profil-Primärfarbe (Juni 2026)

MINOR — Reiner Style-/Komponenten-Refactor, keine Verhaltensänderung. Die im Profil/Darstellung
wählbare **Primärfarbe `--tf-primary`** (Akzent) erschien bisher nur auf den CTAs, die schon die
kanonische `<Button>`-Komponente nutzten (z.B. Einstellungen). Viele Module bauten Primär-CTAs aber
hand-gebaut nach — entweder mit `bg-[var(--tf-text)]` (wirkte **schwarz** statt Akzent) oder roh mit
`bg-[var(--tf-primary)]` (Farbe ok, aber an der Komponente vorbei). Jetzt durchgängig über `<Button>`.

- **~70 hand-gebaute CTAs migriert** auf `<Button variant="primary|secondary|ghost">` aus
  `@/components/ui/button` (Vorbild: v2.149-Anfrage-Detail-Migration). Betroffen: Skill-/Workflow-/
  Regel-Verwaltung (`skill-verwaltung-kuration/`), Kurzfassung + Nachforderungen (lokale
  `BTN_PRIMARY`/`BTN_SECONDARY`-Klassen-Konstanten **entfernt**), Aufnahme + Gutachten-Batch,
  Anfragen-Einstellungen/Recall-Eval, Suche-Analyse-Dialog, `data-table/ColumnFilterDropdown`,
  `ErrorBoundary`, alle Feedback-Touchpoints (FAB-Panel, Sponsoring, FAQ, Tickets) und der
  Streamlit-Bookmarklet-Anker (`<Button asChild>`). `loading`-Prop ersetzt die `busy`-Text-Swaps,
  Icons via `icon={…}`.
- **DESIGN_GUIDE** „Button"-Tabelle korrigiert: Primary = `--tf-primary` (wählbarer Akzent) über
  `<Button>`, nicht mehr `--tf-text` (schwarz). Hand-gebaute gefüllte CTAs ausdrücklich verboten.
- **Neuer Convention-Guard `no-raw-cta-fill`** ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)):
  flaggt `bg-[var(--tf-text)]`/`bg-[var(--tf-primary)]`-Fill **mit** `hover:opacity` in `.tsx`. Die
  `hover:opacity`-Signatur trifft nur gefüllte Klick-CTAs — Toggle-Pills, Badges, Switch-Thumbs,
  Chat-Bubbles und der Vorschau-Chip (ohne `hover:opacity`) bleiben unberührt. Inline `// allow-cta-fill`.
- Bewusst NICHT migriert: die `.g-btn.primary`-Buttons der Gutachten-Werkstatt (scoped CSS, rendern
  bereits `var(--tf-primary)`).

### v2.149.1 — Feedback-Board: Status-Filter „Offen" als Default (Juni 2026)

PATCH — Öffentliches Board „Feedback Übersicht" ([FeedbackBoardPage.tsx](src/plugins/feedback-board/FeedbackBoardPage.tsx)):
Status-Filter startet jetzt auf **„Offen"** statt „Alle" (offene Themen zuerst); der Chip ist dadurch
standardmäßig aufgeklappt (CollapsibleSeg expandiert bei `value ≠ defaultValue`). Die Auswahl des
Users wird in `localStorage` (`tf-feedback-board-status-filter`) gemerkt — wie schon Ansicht +
Kategorie-Collapse. Kein Datenmodell-Eingriff.

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
