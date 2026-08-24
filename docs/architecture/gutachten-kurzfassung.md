# Gutachten-Kurzfassung — Testballon (erster „Mini-Agent")

Auf der **Verbund**-Detailseite erstellt ein Gutachter KI-gestützt die **Kurzfassung** eines ZIM-Gutachtens — kompletter Durchstich von der Dokumenten-Aufnahme bis zur ausgefüllten Word-Vorlage. Der Durchstich validierte vier Bausteine, die inzwischen generalisiert wurden (Skill-Registry + Workflow-Runner — siehe Abschnitt „Generalisierung" unten). Hinter Feature-Flag `gutachtenKurzfassung` (**dev + pl** + `npm run dev`; demo/prod/kurator = false). Eingeführt v2.68.0, re-leveled auf Verbund-Ebene v2.68.2, FKZ-Erkennung v2.68.3, persönliche Stil-Schicht (User-Tweaks v2) v2.72.0.

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

[src/core/services/skills/](../../src/core/services/skills/) — Dach mit drei Submodulen: **`run/`** (Ausführung/Parsing — `run-skill.ts`, `parse.ts`, `types.ts`), **`registry/`** (Skill-/Regel-Datenmodell, Check-Engine, Seed, Storage) und **`tweaks/`** (private User-Tweaks). Konsumenten importieren ausschließlich über das Dach-Barrel `@/core/services/skills`. Bewusst „static data over logic", Registry-ready.

- **Skill = Daten** ([`SkillRecord`](../../src/core/services/skills/registry/types.ts)): `id`, `name`, `beschreibung`, `version`, `promptTemplate` (mit `{{stammdaten}}`/`{{vbMarkdown}}`-Slots), `modifiers` (`neu`/`kuerzer`/`laenger`), `regelIds` (Verweise in die gemeinsame Regel-Bibliothek), `slots`, optional `systemPrompt`/`maxTokens`. **Keine** `runChecks`/`parse`-Funktion im Record — die Laufzeit-Logik liegt im Service (Check-Engine + `parseSkillOutput`). Der konkrete Kurzfassung-Skill (`KURZFASSUNG_SKILL_ID = 'gutachten-kurzfassung'`, deutscher ZIM-Kontrakt, drei `###`-Ausgabeteile Quellenanalyse/Entwurf/Finaler Text) ist der Seed [`SEED_SKILL`](../../src/core/services/skills/registry/seed.ts) — Read-only-Fallback solange keine `registry.json` existiert, sonst kurator-pflegbar (Seed-on-open).
- `parseSkillOutput(raw)`: zerlegt an den `###`-Überschriften; tolerant gegenüber fehlendem Entwurf; unparsebar → alles als `finalerText` + `warnung`.
- **Deterministische Checks** ([check-engine.ts](../../src/core/services/skills/registry/check-engine.ts), KEIN LLM): `runRegelChecks(text, regeln)` interpretiert parametrisierte [`QualitaetsRegel`](../../src/core/services/skills/registry/types.ts) über dem finalen Text; `buildPromptVorgaben()` erzeugt aus **denselben** Regeln den Prompt-Vorgaben-Block (eine Quelle, keine Drift). Bekannte `typ`-Werte: `satzanzahl`/`zeichen_max`/`wortanzahl`/`satzlaenge_max`/`verbotenes_muster`/`pflicht_anfang`/`keine_aufzaehlungen`/`absatz_min` (Leser tolerieren unbekannte Typen → Vorwärts-Kompat). Seed-Regeln ([`SEED_REGELN`](../../src/core/services/skills/registry/seed.ts)) = die **geteilte** Bibliothek (Ein-Skill-Werte wie Satzanzahl 8–12 / Zeichenlimit 1000 / Satzlänge ≤ 25 Wörter / keine Aufzählungen leben seit v2.296 als `SkillRecord.vorgaben` am Skill): Passiv-Floskeln/„AP1"-Muster (`verbotenes_muster`, hinweis) und **Semikolon & Gedankenstrich** (`verbotenes_muster`, fehler, `INTERPUNKTION_REGEL_ID`). Letztere ist die **generelle Vorgabe für jeden KI-Fließtext** (v2.297) und hängt an ALLEN sieben generativen Schritten des `zim-ep`-Workflows; Guard + Muster-Gegenproben in [interpunktion.test.ts](../../src/core/services/skills/registry/__tests__/interpunktion.test.ts). Die Muster treffen bewusst nur `;` und den Gedankenstrich **zwischen Leerzeichen** (`–`/`—`/` - `/`--`), nicht Wortverbindungen („KI-gestützt") oder Zahlenbereiche („2024–2026"). Repariert wird über den Lektor („Sprachlicher Feinschliff"), dessen Template den Auftrag seit v2.297 als Pflicht-Block führt; der Nachweis fällt gratis an, weil nach dem Feinschliff die Regeln DES ABSCHNITTS erneut laufen. Rollout auf Bestands-Shares: `ga-interpunktion-2026-07`. Satzgrenzen Abkürzungs-tolerant (`splitSentences`). Ergebnis-Typ `CheckResult { id, level: 'ok'|'hinweis'|'fehler', label, detail?, regelId? }`. **Umfang single-source (2026-07)**: die Wort-/Satz-/Absatzzahl ist EINZIG die Regel — der `promptTemplate` nennt sie NICHT zusätzlich fest in der Prosa (sonst lief sie bei Regel-Edits auseinander und der Prompt trug den alten Wert weiter). Die Seeds A–D geben die Zahl daher nicht mehr im Text an (weiche Teil-Richtwerte wie „≥ 150 Wörter" bleiben); die einmaligen Migrationen `ga-umfang-dedup-2026-07` (A/B) und `ga-umfang-dedup-cd-2026-07` (C/D, eigener append-only Marker) ([migrations.ts](../../src/core/services/skills/registry/migrations.ts)) heben unveränderte Bestands-Prompts byte-genau nach, und der Skill-Editor warnt via `findeUmfangKonflikte`, falls ein (kuratierter) Prompt-Text doch eine von der Regel abweichende Zahl nennt.
- **Runner** ([run-skill.ts](../../src/core/services/skills/run/run-skill.ts)): transport-agnostisch. Baut die Messages über die EINE, reine, exportierte Kompositionsfunktion `composeSkillPrompt` (System-Rolle + gefülltes Template + ggf. persönlicher Tweak-Block + Formale Vorgaben + Modifier-Instruktion + vorheriger finaler Text — Rangfolge siehe „User-Tweaks v2"), kappt VB-Markdown am Absatzende (Schwellwert via `SkillRunInput.vbCharCap` = `getVbCharCap()` aus der vom Nutzer gemeldeten LLM-Kontextlänge, Einstellungen → KI-Assistent, [llm-context.ts](../../src/core/services/ai/llm-context.ts); `VB_CHAR_CAP` ist nur noch der statische Fallback. Bei Überschreitung: `vbGekuerzt` → proaktives + post-Generierungs-Warn-Banner mit `VB_KUERZEN_HINWEIS` in beiden Pfaden), fährt die bestehende **Transport-Ladder** (`submitConversation?` → `submitMessage`, non-streaming genügt) via `bridge.getActiveTransport()` ([useChatController.ts](../../src/plugins/chat/useChatController.ts) als Nutzungsmuster), reicht `AbortSignal` durch. **Keine modell-spezifische Sonderlogik.**
- **Reasoning/Thinking** (v2.80): `SkillRunInput.thinkingBudget` (default `'none'` → Verhalten byte-identisch zu vorher) steuert, ob das Modell „nachdenkt". Die **Einstellung** (`getLlmThinkingEnabled()` / `budgetForThinking()`, [llm-thinking.ts](../../src/core/services/ai/llm-thinking.ts), per-Maschine `localStorage`, An → `'medium'`; UI-Switch „Thinking nutzen" in [AntwortverhaltenGruppe.tsx](../../src/plugins/einstellungen/ki/AntwortverhaltenGruppe.tsx)) ist nur der **Standardwert**: `useKurzfassung` hält einen **pro-Generierung-Schalter** (`thinkingEnabled`, init aus der Einstellung, nicht persistiert), der via [`ThinkingToggle`](../../src/plugins/antraege/kurzfassung/ThinkingToggle.tsx) neben den Generieren-Buttons (initial + „Neu"/„Kürzer"/„Länger") übersteuert wird (v2.80.1). Bei `!== 'none'` fährt der Runner den **Streaming-Pfad** (`streamConversation`, no-op `onDelta`), nur um den **Denkprozess zu erfassen** — die Streaming-Schicht trennt Reasoning robust (Feld `reasoning_content`/`reasoning` UND `<think>`-Fallback via [thinking-parser.ts](../../src/core/services/ai/thinking-parser.ts)); inline-`<think>` wird sonst per `extractThinking` abgetrennt. Abbruch (`streamConversation` liefert `aborted:true`, wirft nicht) wird zu `AbortError` re-thrown, damit kein Teil-Record entsteht. Ergebnis: `SkillRunResult.thinking` → `record.denkprozess`; lief Thinking ohne Reasoning-Ausgabe (`denkprozessAngefordert` ohne `denkprozess`), zeigt die ReviewCard einen Hinweis statt der Collapsible. **Der volle Gutachten-Workflow A–G ist identisch verdrahtet** (v2.81.1): `useGutachtenWorkflow` hält denselben pro-Generierung-Schalter, `StepRun`/`GenerationInput` tragen `denkprozess`/`denkprozessAngefordert`, und [`SectionReviewCard`](../../src/plugins/antraege/gutachten/SectionReviewCard.tsx) + die „… generieren"-Fläche in [`GutachtenSection`](../../src/plugins/antraege/gutachten/GutachtenSection.tsx) zeigen Toggle + Denkprozess wie die Kurzfassung.
  - **Über die interne KI kam bis v6.4 nie ein Denkprozess an** — nicht, weil keiner entstand, sondern weil die Bridge weder `submitConversation` noch (mangels Delta-Konsument) den Streaming-Zweig fährt: der Runner nimmt `submitMessage`, und dessen String hatte für das Reasoning keinen Platz. Seit v6.5 reicht `SubmitMessageOptions.onReasoning` es durch ([ki-bridge.md](ki-bridge.md)); der Runner setzt `thinking` daraus, alles ab `SkillRunResult.thinking` bleibt unverändert. Der `extractThinking`-Rückfall greift nur noch für inline-`<think>`, denn die KI-Seite trennt ihr Reasoning bereits selbst ab.
  - **Angezeigt wird er an der Fassung, nicht im Panel** (v6.5): der Schalter „Denkprozess" sitzt in [`AbschnittFuss`](../../src/plugins/antraege/gutachten/AbschnittFuss.tsx) neben den Kennzahlen, der Text klappt darunter auf (`.g-denk-text`, gedeckelt auf 320 px mit eigenem Scroll). Ohne `denkprozess`, aber mit `denkprozessAngefordert` steht dort die gedämpfte Zeile „· kein Denkprozess geliefert" — der Unterschied zwischen „nicht gedacht" und „gedacht, nichts geliefert" bleibt sichtbar. **Genau eine** Darstellung: das `KontextPanel` trug ihn bis v6.4 mit, ist aber einklappbar und im Alltag zu (gleiche Begründung wie beim QS-Rückbau in v2.337).

### Widersprüchliche Umfangs-Vorgaben (v2.372, entschärft v6.26)

Die Vorgaben von Abschnitt A schlossen einander an ihren Obergrenzen aus: 8–9 Sätze × höchstens 25 Wörter ergeben rund 1.500 Zeichen, das Zeichenlimit steht auf 1.000. Welche Vorgabe gewinnt, stand nirgends — `## Formale Vorgaben` listete beide gleichrangig. Im Ergebnis brach das Modell regelmäßig die Vorgabe, an der die Word-Vorlage hängt.

**Seit v6.26 ist der eigentliche Grund benannt statt überdeckt**: das Zeichenlimit ist die einzige Vorgabe der Kette, die aus der Außenwelt kommt — die Kurzfassung wird in ein Formularfeld der Fachprüfung kopiert, das 1.200 Zeichen fasst. Es steht jetzt auf **1.100** („900 ± 200") und trägt diesen Satz als `herkunft` (siehe [skill-vorgaben.md](skill-vorgaben.md)). Damit ist am Befund selbst ablesbar, welche der beiden Zahlen hart ist; der Vorrang-Satz unten bleibt als Rückfall bestehen, muss den Konflikt aber nicht mehr allein tragen.

- `buildPromptVorgaben` hängt jetzt **einen** Vorrang-Satz an, wenn ein `zeichen_max` mit `satzanzahl`/`satzlaenge_max`/`wortanzahl` zusammentrifft: die Zeichenzahl gewinnt. Eine Quelle, gilt für alle betroffenen Skills.
- Zwei reine Editor-Hinweise ([check-engine.ts](../../src/core/services/skills/registry/check-engine.ts), gerendert im [SkillEditor](../../src/plugins/skill-verwaltung-kuration/SkillEditor.tsx)): `findeVorgabenWidersprueche` rechnet den Konflikt aus (Warnton), `findeUmfangDopplungen` meldet eine Zahl, die der Prompt-Text nennt, obwohl der Auto-Block sie ohnehin erzeugt (neutraler Ton — heute korrekt, beim nächsten Regel-Edit die alte Doppelquelle). Abgrenzung zu `findeUmfangKonflikte`: dort geht es um Abweichung, hier um Dopplung bzw. Unerfüllbarkeit. Beide render-only, blocken nichts; kuratierte Prompt-Texte werden **nicht** migriert.
- Der Editor zeigt den Vorgaben-Block jetzt vollständig statt nur seine `- `-Zeilen — mehrzeilige Hinweise (Pflicht-Anfang) fielen still aus der Vorschau, standen aber im Prompt.

## Baustein 3 — Review-/Freigabe-UI + Persistenz

[src/plugins/antraege/kurzfassung/](../../src/plugins/antraege/kurzfassung/):

- [`useKurzfassung(ctx)`](../../src/plugins/antraege/kurzfassung/useKurzfassung.ts) — Orchestrator: lädt Record + VB-Status, probt LLM-Verfügbarkeit (`transport.ping()`, lazy), Aktionen `generate/modify/pruefen/freigeben/verwerfen/stop/refreshVb`. Alle self-catching (Fehler → `error`-Banner, Pitfall #15). **Persist nach jedem Statuswechsel, NIE während der Generierung.**
- [`KurzfassungSection`](../../src/plugins/antraege/kurzfassung/KurzfassungSection.tsx) (Zustände VB-fehlt / VB-vorhanden / Review), [`ReviewCard`](../../src/plugins/antraege/kurzfassung/ReviewCard.tsx) (Quellenanalyse-Collapsible, finaler Text + Meta, **„Denkprozess"-Collapsible** wenn `record.denkprozess` vorhanden, Versionsverlauf, Aktionsleiste Freigeben/Neu/Kürzer/Länger/Prüfen), [`CheckList`](../../src/plugins/antraege/kurzfassung/CheckList.tsx).
- **VB-Lookup**: [`findVorhabensbeschreibung(idb, key)`](../../src/plugins/antraege/kurzfassung/vbDokument.ts) scannt `doc:*` nach `tags.includes(key) && tags.includes('vorhabensbeschreibung')` (ok bei wenigen Uploads; Generalisierung → Tag-Index). Tragen **mehrere** Dokumente den VB-Tag, entscheidet die reine `pickAktiveVb`: der explizit gewählte Datensatz (`vb-auswahl:<key>`) gewinnt, solange er existiert und noch VB-getaggt ist; sonst **DOCX vor PDF** (v6.15), dann das jüngste, bei gleichem `created` deterministisch nach Dateiname. Der Format-Vorrang kommt aus einer Messung derselben VB in beiden Fassungen (22.08.2026): DOCX 44 Überschriften und 80 Fettauszeichnungen, PDF **null und null** — ohne Überschriften kann die Relevanz-Map keine Abschnitts-Spans bilden, der Auszug für `kontextBedarf: 'relevant'` hat auf einer PDF-Quelle nichts zum Schneiden. Der eine Fall, in dem das überrascht, ist benannt und in Kauf genommen: liegt eine **neuere** PDF-Fassung neben einer älteren DOCX-Fassung, gewinnt die ältere — der Bearbeiter überstimmt es im Korpus-Inventar, wo beide Kandidaten mit Datum stehen. Alle Konsumenten (Gutachten, Kurzfassung, NF, Batch, Aufbereitung) erben den Pick über dieselbe Signatur — die maßgebliche VB ist eine **Verbund-Tatsache**, nicht eine je Artefakt.

### Dokument-Inventar & Gutachten-Korpus (v2.282)

Die Aufnahmefläche bietet sechs Dokumenttypen an, der Gutachten-Pfad las aber genau **ein** Dokument — und zeigte auch nur dieses an. Wer fünf Dateien ablegte, sah danach eine und konnte nicht erkennen, was mit den übrigen geschah. Verschärft wurde das durch `typAusDateiname`: jeder nicht erkannte Dateiname fällt auf `defaultTyp='vorhabensbeschreibung'` zurück, sodass „Projektbeschreibung"/„Wirkung" ebenfalls VB-getaggt wurden und die Auswahl faktisch am Konvertierungstempo hing.

- **Auflösung** [`resolveGutachtenKorpus`](../../src/plugins/antraege/gutachten/korpusQuelle.ts): `resolveVb` (unverändert, inkl. Ordner-Fallback) + Inventar aller verbund-getaggten Dokumente + die persistierte Mitgliedschaft → `markdown` = `baueKorpus(vb, zusatz)`.
- **Reine Logik** [`korpusAuswahl.ts`](../../src/plugins/antraege/gutachten/korpusAuswahl.ts): `baueInventar` (stabile Reihenfolge `created` asc, dann Dateiname — ein Toggle darf die Position der übrigen im Prompt nicht verschieben), `waehleZusatzIds` (die aktive VB ist **nie** dabei, sie ist der Präfix; verwaiste docIds fallen still raus), `schalteAufnahme`, `nimmAlleAuf`, `zaehleAufgenommen`, `zeigeSammelHinweis`.
- **Opt-in ist eine harte Eigenschaft, keine Voreinstellung**: leere Auswahl ⇒ `baueKorpus(vb, [])` gibt `vb.markdown` byte-identisch zurück ⇒ gleicher `hashText` ⇒ die **Relevanz-Map-Caches** aller Bestands-Verbünde bleiben gültig und kein freigegebener Abschnitt ändert unbemerkt seinen Kontext. Gegengewicht ist der **persistente** Sammel-Hinweis (`hinweisErledigt`) — kein Flash nach dem Upload, er übersteht den Reload.
- **Relevanz-Map-Kopplung**: `vbBrauchtRelevanzMap` / `getOrComputeRelevanzMap` / `buildVbRelevant` in [useGutachtenWorkflow.ts](../../src/plugins/antraege/gutachten/useGutachtenWorkflow.ts) müssen **dieselbe** Zeichenkette sehen — die Map rechnet Heading-Spans in den übergebenen String, `assembleVbRelevant` sliced später mit genau diesen Offsets. Wer nur einen Aufruf umstellt, bekommt keinen Fehler, sondern still den falschen Ausschnitt (verankert in `korpus-kontext.test.ts`). Weil die VB **Präfix** bleibt, behalten alle VB-Headings id *und* span.
- **DSGVO (Pitfall #30/#35)**: die Umstellung füllt den bestehenden `{{vbMarkdown}}`-Slot mit einem anderen String und fasst weder Template noch `INHALTS_SLOTS` an ⇒ `skillEnthaeltDokumentInhalte` bleibt `true` ⇒ Transport bleibt intern. Ein neuer `{{korpus}}`-Slot wäre **nicht** als Inhalts-Slot erkannt und liefe bis zum Nachtrag als „inhaltsfrei" durch — Guard: `korpus-transport-guard.test.ts`.
- **UI** [`KorpusInventar.tsx`](../../src/plugins/antraege/gutachten/KorpusInventar.tsx): Kopf „N Dokumente · M im Gutachten-Kontext" (behebt allein schon den Anzeige-Defekt), VB-Radios **nur** bei mehreren VB-Kandidaten, Checkbox „ins Gutachten aufnehmen" je Zusatzdokument, „Konvertierung prüfen" pro Zeile, Cap-Fußzeile aus `misseKorpus` gegen den **Korpus** (vorher maß die Warnung nur die VB).
- **Neu-Aufnahme = neue Fassung, kein zweites Dokument** (v2.284, [dokumentDubletten.ts](../../src/core/components/dokumentDubletten.ts)): `add` vergab pro Aufnahme eine frische UUID, sodass jede erneut abgelegte Datei einen weiteren Record anlegte — unsichtbar, solange der Gutachten-Pfad ohnehin nur ein Dokument las, ab dem Inventar dann als Dublettenliste. `DokumentAufnahme` sucht deshalb vor dem Anlegen ein gleichnamiges Dokument **desselben Verbundes** (`findeGleichnamiges`) und überschreibt es über `ersetzeInhalt` — **`id` und `created` bleiben**, damit VB-Wahl und Korpus-Auswahl nicht ins Leere zeigen und das Inventar nicht umsortiert. Identität ist der Dateiname, nicht der Inhalt: die korrigierte Neu-Konvertierung hat anderen Inhalt und ist trotzdem dasselbe Dokument. Für Altbestand gruppiert `gruppiereDubletten` gleichnamige Zeilen; „Ältere Fassungen entfernen" zieht erst die Verweise um (`ziehePickUm`/`zieheAuswahlUm`), löscht dann aus IDB **und** Orama — nie automatisch beim Laden, es sind Nutzerdaten.
- **Pflicht-Anfang in Abschnitt G steht in einem eigenen Block** (v2.284.1): der Wortlaut stand als zitierte Inline-Regel im Prompt (`Beginne den finalen Text **exakt** mit: „… im Bereich …"`) — eine nicht erfüllbare Anweisung, weil der geforderte Wortlaut mitten im Satz endet und sein Ende zusätzlich von einem Auslassungszeichen verdeckt wurde. Qwen suchte darauf im Reasoning wiederholt die String-Grenze und verbrauchte das Ausgabebudget: Lauf ohne Antwort. Neu rendert `abschnittTemplate` einen `pflichtAnfang`-Block — unzitiert, auf eigener Zeile, mit dem expliziten Hinweis, dass der Wortlaut absichtlich mitten im Satz endet. Dasselbe gilt für `pflicht_anfang.hint` der Check-Engine (KI-Korrektur-Pfad). Bestands-Registries hebt `GA_PFLICHT_ANFANG_KLAR_MIGRATION` (pristine-only, zwei Alt-Stände mit/ohne Stilbeispiel); Guard `keine-elidierte-wortlaut-vorgabe`. Zweiter Fall dieser Klasse nach dem Beleg-Kontrakt-Rückbau → [recurring-bug-classes.md](recurring-bug-classes.md#13-prompt-verlangt-einen-wortlaut-exakt-und-zeigt-ihn-zugleich-abgeschnitten).
- **Versionsverlauf** (v2.71): vor jeder Re-Generierung (Neu/Kürzer/Länger) wird die noch aktive Fassung als `KurzfassungVersion`-Schnappschuss an `record.verlauf` angehängt (bounded, `MAX_VERLAUF = 5`). [`VersionVerlauf`](../../src/plugins/antraege/kurzfassung/VersionVerlauf.tsx) zeigt sie aufklappbar; `uebernehmen(index)` (→ `restoreVersion`) macht eine Vorfassung wieder aktiv und schiebt die bisherige in den Verlauf (Swap, nichts geht verloren). Reine Helfer + Tests: [kurzfassung-verlauf.ts](../../src/plugins/antraege/kurzfassung/kurzfassung-verlauf.ts).
- **Vorfassungs-Diff** (v2.80): die Vorfassungen werden **zweispaltig** verglichen statt als Volltext-Liste — links die aktuelle Fassung (Einfügungen grün), rechts per **Tabs** die gewählte Vorfassung (Löschungen rot durchgestrichen) inkl. Meta + Prüf-Ergebnis + „Diese Fassung übernehmen". Reiner Diff-Helfer + Tests: [kurzfassung-diff.ts](../../src/plugins/antraege/kurzfassung/kurzfassung-diff.ts) (`computeFinalerTextDiff`/`diffStats`, kapselt `diff-match-patch` wie [DiffView.tsx](../../src/ui/DiffView.tsx)). `ReviewCard` reicht `aktuellerText`/`aktuellErstelltAm` als Diff-Basis durch. Dieselbe Komponente wird auch vom Gutachten-Workflow ([SectionReviewCard.tsx](../../src/plugins/antraege/gutachten/SectionReviewCard.tsx)) genutzt.
- **Persistenz** ([kurzfassung-store.ts](../../src/plugins/antraege/kurzfassung/kurzfassung-store.ts)): `KurzfassungRecord` (Output-Teile, `checks`, `status` entwurf/freigegeben, Zeitstempel, `modell`, `verlauf`, `modifier`, optional `denkprozess`) im generischen `kv`-Store unter `gutachten-kurzfassung:<verbund-key>` — **bewusst KEIN dedizierter Object-Store/`version`-Bump** (analog `doc:*`; ein Bump triggert unter `file://` mit parallel offenen Varianten ein `onblocked`-Upgrade, siehe [recurring-bug-classes.md](recurring-bug-classes.md)). Der Verlauf ist additiv im selben Record → alte Records ohne `verlauf` bleiben ladbar.

### Werkstatt-Layout + Inline-Bearbeiten (v2.109, Workflow A–G)

Der Gutachten-Workflow rendert im **„Werkstatt"-Layout** (Design-Handoff `_design/handoff/workflow-mit-bearbeiten/`): 3-spaltiges Grid **Stepper-Rail · Entwurf-Karte · einklappbares „Quelle & KI-Hinweise"-Panel**, oben die Fortschrittsleiste mit Export. Die deterministische **Regelprüfung** sitzt seit v2.283 links unter dem Entwurf ([PruefBlock.tsx](../../src/plugins/antraege/gutachten/PruefBlock.tsx), aufklappbar über den Meta-Zeilen-Trigger „prüft N Regeln" — zu bei grüner Prüfung, offen bei Befund); das rechte Panel trägt nur noch Quellen und beratende KI-QS-Hinweise (der Denkprozess sitzt seit v6.5 in der Fußzeile der Karte). (Die TV-/Verbund-Kontextkarte des Handoffs entfällt bewusst — `VerbundDetail` rendert den Verbund-/TV-Kontext bereits oberhalb der Sektion.) Styling als **co-located gescopte CSS** [gutachten.css](../../src/plugins/antraege/gutachten/gutachten.css) (`.gutachten-werkstatt`, Konvention `chat.css`); fehlende `--tf-*`-Tokens lokal auf dem Scope-Root definiert (Token-Falle, siehe [recurring-bug-classes.md](recurring-bug-classes.md) bzw. Memory `design-handoff-styling`). Einspaltiger Fallback über die **gemessene Container-Breite** (`WERK_MIN_WIDTH`, kein `@media` — die Sektion ist eingebettet).

- [GutachtenSection.tsx](../../src/plugins/antraege/gutachten/GutachtenSection.tsx) hält das Grid + `ctxOpen`-State; [AbschnittNav.tsx](../../src/plugins/antraege/gutachten/AbschnittNav.tsx) ist die `.g-rail`-Stepper-Rail; [KontextPanel.tsx](../../src/plugins/antraege/gutachten/KontextPanel.tsx) zeigt Antragsbezug (= `quellenanalyse`), Prüfung (`checks`), QS + Provenance — **echtes Substrat, keine Prototyp-Fiktion** (Inline-Beleg-Popover bewusst NICHT gebaut, da `finalerText` keine strukturierten Claim→Quelle-Daten trägt).
- **Inline-Bearbeiten** ([SectionReviewCard.tsx](../../src/plugins/antraege/gutachten/SectionReviewCard.tsx)): „Bearbeiten" → **Plain-Text**-Editor (kein contentEditable-HTML — kompatibel zu Markdown-Render + DOCX-Füller + Checks). `StepRun.originalText` snapshottet beim ersten Edit den generierten Text (additiv → alte Runs ladbar); reine Reducer `applyBearbeitung`/`applyZuruecksetzen` ([runner.ts](../../src/plugins/antraege/gutachten/runner.ts)), die Checks rechnet der Hook nach jedem Save über `runRegelChecks` frisch (ein `setState` + ein `persist`, Pitfall #16/#20). „bearbeitet"-Badge mit „Zurücksetzen"; eine Re-Generierung baut einen frischen `StepRun` (Edit verfällt). Der **Export nutzt `finalerText`** → übernimmt den editierten Stand automatisch.
- **Persönlicher-Stil-Dialog** ([TweakEditor.tsx](../../src/plugins/antraege/kurzfassung/TweakEditor.tsx)) v2.109: kanonischer, **zentrierter** `Dialog` (560px) statt Slide-Over — Preset-Chips, visuelle „So wird kombiniert"-Schichtung (Kurator-Lock), „Technische Ansicht"-Toggle; die Tweak-Rangfolge/Persistenz (siehe „User-Tweaks v2") bleibt unverändert.
- **Inline-Werkstatt** (v2.247 dev-only, seit v2.396 auch **pl/as/local + Kurator-mit-Session**): Anweisung (Prompt · Umfang &amp; Form · Abnahme-Kriterien · **Regeln des Abschnitts**) und dahinter die Workflow-Struktur direkt in der Gutachten-Ansicht bearbeitbar, ohne Kontextwechsel ins Kuration-Plugin. Der [WorkflowWerkstattDialog.tsx](../../src/plugins/antraege/gutachten/WorkflowWerkstattDialog.tsx) **wiederverwendet** die Kuration-Editoren (`WorkflowsTab`/`WorkflowEditor`/`SkillEditor`/`RegelEditor`) + die geteilten Mutations-Fabriken [workflowMutations.ts](../../src/plugins/skill-verwaltung-kuration/workflowMutations.ts) und [regelMutations.ts](../../src/plugins/skill-verwaltung-kuration/regelMutations.ts) (DRY mit der `SkillVerwaltungPage` — insbesondere putzt `deleteRegel` die `regelIds` **aller** Skills mit) und persistiert über `useSkillRegistry().persist`. Nach jedem Persist ruft er `ctrl.reloadRegistry()` ([useGutachtenWorkflow.ts](../../src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)) — lädt die Registry frisch und leitet nur Skills/Schritte/QS/Relevanz neu ab; `WorkflowRun` + VB bleiben (kein Fortschrittsverlust). Editierte Prompts wirken beim **nächsten** Generieren; freigegebene Abschnitte bleiben unverändert.
  - **Zugang** ([registry-zugang.ts](../../src/config/registry-zugang.ts), Hook [useWerkstattZugang.ts](../../src/plugins/antraege/gutachten/useWerkstattZugang.ts)): `sichtbar = skillVerwaltung && registryEditierbar(…)` — die reine Schwester von `canEditSkillRegistry`, das jetzt selbst dorthin delegiert. **Kein neuer Feature-Flag**; Konfig-Lesen (`registryUmgebung`) und Entscheiden sind getrennt, weil Vitest `variant: 'development'` fest verdrahtet und ein Prädikat mit `runtimeConfig`-Zugriff sonst nicht über die Varianten-Matrix testbar wäre. Sichtbar = editierbar (eine read-only-Tür wäre Rauschen — zum reinen Lesen gibt es „Prompt ansehen", das mehr zeigt).
  - **Landung ist der Skill des offenen Abschnitts**, nicht der Workflow-Baum; die Schritt-Liste liegt hinter „← Alle Schritte". Einstiege: Stift am Abschnittskopf ([AbschnittKopf.tsx](../../src/plugins/antraege/gutachten/AbschnittKopf.tsx)) und der Footer-Knopf „Anweisung bearbeiten" in der Prompt-Ansicht. Der frühere freistehende dev-Knopf entfällt.
  - **„Was daraus wirklich an die KI geht"** ([PromptVorschauSpalte.tsx](../../src/plugins/antraege/gutachten/PromptVorschauSpalte.tsx)): rechnet `renderSkillPrompt` über `promptAnsichtFuer(stepId, entwurf)` gegen den **ungespeicherten** Stand — inkl. frisch aufgelöster `regelIds`, damit ein gerade an-/abgewähltes Regel-Häkchen sofort im Vorgaben-Block sichtbar wird. Rein gerechnet, kein KI-Aufruf. Als Render-Prop `nebenPrompt` vom Gutachten-Plugin geliefert, damit keine Kante `skill-verwaltung-kuration → gutachten` entsteht (Zyklen-Guard).
  - **Slot-Warnung** ([promptSlotWarnung.ts](../../src/plugins/skill-verwaltung-kuration/promptSlotWarnung.ts)): vergleicht gegen den GESPEICHERTEN Template-Text (nicht gegen `skill.slots` — sonst Fehlalarm auf Bestandsdaten). Der eigentliche Schaden ist nicht die DSGVO-Seite (die ist per `?? true` fail-safe), sondern dass der Lauf ohne `{{vbMarkdown}}` den Antrag nicht mehr sieht und still aus dem Nichts schreibt.
  - **Nachwirkung** ([werkstattNachwirkung.ts](../../src/plugins/antraege/gutachten/werkstattNachwirkung.ts)): reine Funktion über (Version vorher, Version nachher, Abschnitts-Status). Band erst, wenn die Version nach `reloadRegistry` wirklich gestiegen ist; Entwurf → „Abschnitt neu erzeugen", freigegeben → „Erneut öffnen", nie automatisch.
  - **„Gilt für alle"** steht als persistentes Band im Dialog-Body statt in der `description` (dort wurde es überlesen) und trägt den Gegenweg „Nur für Sie? → Persönlicher Stil" zum `TweakEditor`.
- **Skill-/Workflow-Export/Import** (v2.247): einzelne Skills (bestehend, [skill-bundle.ts](../../src/core/services/skills/registry/skill-bundle.ts)) UND ganze Workflows ([workflow-bundle.ts](../../src/core/services/skills/registry/workflow-bundle.ts) — Workflow + referenzierte Skills + Regeln, rein, kollisionsfest: Schritt-IDs immer neu, referenzierte Skills bei ID-Kollision dupliziert + umgemappt, damit exportierte Prompt-Tweaks nicht verloren gehen) lassen sich als `.json` sichern und wieder einspielen — im Kuration-Plugin ([WorkflowsTab.tsx](../../src/plugins/skill-verwaltung-kuration/WorkflowsTab.tsx) + [WorkflowImportDialog.tsx](../../src/plugins/skill-verwaltung-kuration/WorkflowImportDialog.tsx)) wie im Werkstatt-Dialog (dort in der Schritt-Liste hinter „← Alle Schritte"). Zweck: Cross-Browser-Nutzung + Versions-Backups. Bündel tragen **nur** kuratierte Registry-Inhalte, nie Antragsdaten.

## Kuratur-Paket — einen ganzen Stand übertragen (v4.130)

Die Einzel-Bündel oben lösen „nimm diesen einen Prompt mit". Sie lösen **nicht**
„bring den Stand meines Entwicklungs-Shares auf den Produktiv-Share": ein Seed
ergänzt nur fehlende IDs (`mergeMissingSeeds` überschreibt nie), und ein
Einzel-Bündel legt bei ID-Kollision bewusst eine Kopie an — 23 Skills so zu
übertragen ergäbe 23 Downloads und ein Ziel voller Doubletten.

Das **Kuratur-Paket** ([paket/](../../src/core/services/skills/paket/)) trägt
Skills + Regeln + Workflows + Textbausteine in EINER Datei
(`kind: 'teamflow-kuratur-paket'`) und kann je Eintrag **aktualisieren**. Vier
reine Module ohne IO: `typen` · `schnueren` · `vergleich` · `einspielen`.
Bedient wird es über den Knopf „Paket…" in der Skill-Verwaltung
([PaketDialog.tsx](../../src/plugins/skill-verwaltung-kuration/PaketDialog.tsx),
Hälfte „Einspielen" in
[PaketImportPanel.tsx](../../src/plugins/skill-verwaltung-kuration/PaketImportPanel.tsx)).

Je Eintrag entscheidet die **Vorschau vor dem Schreiben** — wer ein Paket auf
einen fremden Share spielt, weiß meist nicht, was dort steht:

| Zustand | Vorschlag | Alternativen |
|---|---|---|
| **neu** (ID fehlt im Ziel) | übernehmen | überspringen |
| **geändert** | aktualisieren | als Kopie (nur Skill/Workflow) · überspringen |
| **identisch** | überspringen | — (standardmäßig ausgeblendet) |

Vier Regeln, die das tragen:

1. **Der Vergleich ist kanonisch, nicht feldweise.** Verglichen wird der ganze
   normalisierte Record ohne Fassung/Zeitstempel/Historie. Ein Diff über
   `diffSkillVersions` sähe nur Template, Regeln, Modifikatoren und Kriterien —
   `vorgaben`, `teilStruktur`, `systemPrompt`, `aktiv` fielen still durchs Raster
   und ein geänderter Skill käme als „identisch" an (dieselbe Klasse, gegen die
   `normalizeSkill` seine expliziten Zeilen hat).
2. **Aktualisieren verliert den Ziel-Stand nie**: neue Fassung (`version + 1`),
   der bisherige Stand rückt über `appendHistorie` / `mitFassung` in die
   Historie und ist per Rollback erreichbar. Die Historie der **Quelle** reist
   nicht mit — sie gehört dem Stand, auf dem sie entstand.
3. **Workflow-Schritt-IDs bleiben stabil.** `WorkflowRun.schritte` ist über
   `WorkflowStep.id` gekeyt; beim Aktualisieren werden Schritte über
   `ankerKey` → `nr` → `label+skillId` zugeordnet und behalten die ID des Ziels.
   Nur der Kopie-Pfad vergibt alle IDs neu (Bestands-Semantik der Einzel-Bündel).
4. **Zwei Ablagen, zwei Writes.** Registry und Textbaustein-Katalog bleiben
   getrennte Sidecars; das Paket bündelt nur den Transport. Scheitert der zweite
   Write, sagt die Meldung ausdrücklich, dass der erste bereits gelaufen ist.

Wie die Einzel-Bündel trägt ein Paket **nur** kuratierte Inhalte, nie
Antragsdaten. Auf dem Share entsteht dadurch keine neue Datei.

**Weg für den Transfer dev → Produktiv-Share**: Paket auf dem Dev-Rechner
erstellen, `npm run build:dev` öffnen, im Ordner-Picker den echten Daten-Share
wählen, Paket einspielen. Ein Team-Rollout ist dafür nicht nötig — die Clients
lesen den neuen Stand beim nächsten Laden (`loadSkillRegistry` liest Share vor
Cache).

## User-Tweaks v2 — persönliche Stil-Schicht (v2.72)

Der Original-Skill gehört dem Kurator; der Nutzer (Gutachter) ergänzt einen **privaten Tweak** (eigene Stil-Hinweise + Beispiel-Formulierungen), der lokal bleibt und die Kurator-Kontrakte **nie aufhebt**. Tweak-Ebene = pro **`skillId`** (nicht pro Verbund) — ein Tweak gilt für alle Verbünde, die der Nutzer mit diesem Skill bearbeitet.

- **Feste Rangfolge im Prompt** (nicht konfigurierbar, kein Schalter), EINE Kompositionsstelle [`composeSkillPrompt`](../../src/core/services/skills/run/run-skill.ts) (vormals `buildUserContent`, jetzt exportiert + getestet): **(1)** gefülltes Kurator-Template → **(2)** Tweak-Block „Persönliche Stil-Präferenzen des Bearbeiters (heben die formalen Vorgaben nicht auf)" — nur bei `aktiv` + nicht-leer → **(3)** `buildPromptVorgaben` (Formale Vorgaben, bewusst ZULETZT → die Kurator-Regeln behalten per Recency Instruktions-Vorrang) → Re-Invocation (vorheriger Text, Modifier). **Ohne / leerer / inaktiver Tweak ist die Ausgabe byte-identisch** zum tweaklosen Lauf. `buildTweakBlock` wird von Runner UND Editor-Vorschau genutzt (eine Quelle, keine Drift).
- **Checks unverändert** — laufen immer gegen den Kurator-Kontrakt; kein Tweak kann sie abschalten oder parametrisieren. Der **Sandbox-Testlauf** ([SkillTestlauf.tsx](../../src/plugins/skill-verwaltung-kuration/SkillTestlauf.tsx)) reicht nie einen Tweak durch (der Kurator beurteilt den kuratierten Stand; 11px-Notiz „Testlauf ohne persönliche Stil-Anpassungen").
- **Ablage** [src/core/services/skills/tweaks/](../../src/core/services/skills/tweaks/): `SkillTweak { skillId, angelegtFuerSkillVersion, aktiv, stilHinweise, beispielFormulierungen, geaendert_am, hinweisAusgeblendetFuerVersion? }` (Freitextfelder ≤ `TWEAK_FELD_MAX` = 2000, beim Speichern geklemmt). **IDB-primär** (`kv` `skill-tweaks:<skillId>`) + **best-effort Spiegel** `ZAH/skill-tweaks.json` im persönlichen Ordner (Last-Writer-Wins über `geaendert_am`, Muster [persoenliches-profil.ts](../../src/plugins/auslastung/services/persoenliches-profil.ts)). Ohne persönlichen Ordner IDB-only ohne Fehler — **nie** auf dem Daten-Share, **nie** in der Registry-Datei, nie für andere sichtbar (kein PL-Einsammeln, rein privat).
- **UI**: [`TweakEditor`](../../src/plugins/antraege/kurzfassung/TweakEditor.tsx) Slide-Over (zwei Textareas + Zeichenzähler, Aktiv-Toggle, schreibgeschützte „So wird es der KI mitgegeben"-Vorschau = Tweak-Block + ausgegraute Vorgaben — **NICHT** der volle Kurator-Prompt, nur die Schichtung; Save/Entfernen via `useAsyncAction`). In der Review-Karte: Chip „persönlicher Stil" (wenn `aktiv` + nicht-leer), Meta-Zusatz „· mit persönlichem Stil" an Tweak-Läufen, Einstiegs-Link in der Aktionsleiste. **Versions-Hinweis** (`shouldShowVersionHint`): bei `skill.version > tweak.angelegtFuerSkillVersion` eine neutrale (NICHT warnfarbene) Zeile mit „Ansehen" (öffnet Editor) + Schließen-X; Speichern aktualisiert `angelegtFuerSkillVersion` (Hinweis verschwindet), Schließen-X setzt `hinweisAusgeblendetFuerVersion` (nur diese Version stummgeschaltet).
- **Persistenz-Spur**: `KurzfassungRecord` += optional `mitTweak` / `tweakGeaendertAm` (alte Läufe ohne diese Felder bleiben ladbar).
- Mockups: `_design/handoff/persoenlicher-stil/mockup-tweak-{editor,zustaende}.html`. Tests: [compose-prompt.test.ts](../../src/core/services/skills/run/__tests__/compose-prompt.test.ts) (Rangfolge + byte-Identität), [tweaks/__tests__/store.test.ts](../../src/core/services/skills/tweaks/__tests__/store.test.ts) (Round-trip, LWW, Versions-Hinweis).

## Sprachlicher Feinschliff — Lektor-Skill (v2.294, seit v2.335 automatisch)

Der letzte, **rein sprachliche** Arbeitsgang vor der Freigabe: „Neu · Kürzer · Länger" generiert aus der Vorhabensbeschreibung NEU (Inhalt kann sich verschieben), der Feinschliff fasst nur die Formulierung an. Seit v2.335 **hängt er automatisch an jeder frischen Generierung** — der Gutachter sieht als Ergebnis direkt den polierten Text; manuell bleibt er im ⋯-Menü der Karte erreichbar. Kein eigener Feature-Flag (lebt mit dem GA-Workflow).

- **Prompt ohne VB** ([ga-lektor.seed.ts](../../src/core/services/skills/registry/ga-lektor.seed.ts), Skill-ID `ga-lektor`, kurator-editierbar wie jeder Registry-Skill): das Template trägt **nur** `{{zielText}}` (den abgenommenen Abschnitt) + `{{abschnittszweck}}`. Der Lauf kann strukturell nichts aus der VB nachziehen — das ist die eigentliche Zusicherung, nicht die Prompt-Prosa. `maxTokens: 4096` (der redigierte Abschnitt muss VOLLSTÄNDIG zurückkommen); `regelIds: []` — geprüft wird mit den Regeln **des Abschnitts**. DSGVO: `zielText` ist Inhalts-Slot → `skillEnthaeltDokumentInhalte` = true → intern-pflichtig (Pitfall #30/#35). `aktiv: false` = Kurator-Kill-Switch, dann entfällt der Knopf.
- **Drei Tore VOR dem Schreiben** (`lektoriereEinmal` in [workflow-generierung.ts](../../src/plugins/antraege/gutachten/workflow-generierung.ts)): leeres Ergebnis, `istVerdaechtigGekuerzt` (< 60 % der Ausgangslänge = abgeschnittene Antwort) und `gebrocheneRegeln` → Fehlermeldung, **kein** Write, Abschnitt bleibt unverändert.
- **Der Feinschliff darf nichts brechen, was der Entwurf schon erfüllte** (v6.15, `gebrocheneRegeln` in [lektorat.ts](../../src/plugins/antraege/gutachten/lektorat.ts)). Gemessen am 22.08.2026 an Abschnitt G: der Rohentwurf trug den Pflicht-Anfang wörtlich (`ok`), der Lektor formulierte genau diesen Wortlaut stilistisch um („wird sehr positive Auswirkungen … haben" → „wird … erheblich stärken"), die Prüfung meldete danach `fehler: Pflicht-Anfang fehlt` — und der beschädigte Stand war der angezeigte. Verglichen werden die Checks vorher/nachher **je Regel-ID**; verworfen wird nur bei einer **Verschlechterung** auf `fehler` (ein schon vorher bestehender Fehler zählt nicht, eine vorher gar nicht vorhandene Regel kann nicht erfüllt gewesen sein, `hinweis` blockiert nie). Bewusst hier statt im Lektor-Prompt: der Lektor kennt die Regeln des Abschnitts nicht, und jede künftige `fehler`-Regel müsste dort erneut nachgetragen werden. Der verworfene Lauf degradiert wie jedes gezogene Tor zum Rohentwurf (`feinschliffUebersprungen`).
- **Deterministischer Wächter** ([lektorat.ts](../../src/plugins/antraege/gutachten/lektorat.ts), rein + node-testbar): vergleicht Zahlen-Inventar (Multiset, deutsche Formate inkl. Tausenderpunkt/Dezimalkomma/Einheiten-Suffix) und Längen-Delta zwischen Vor- und Nachfassung. Über 10 % Längen-Drift oder bei verschwundenen/neuen Zahlen erscheint eine **beratende** Hinweiszeile an der Karte (`befundText`) — sie blockiert nie und wird **live** gegen den letzten Verlaufs-Eintrag gerechnet (nichts zusätzlich persistiert).
- **Persistenz** (`applyLektorat` in [runner.ts](../../src/plugins/antraege/gutachten/runner.ts)): kein frischer `StepRun` — Status, Belege, QS-Hinweise, `originalText` und Denkprozess bleiben; ersetzt werden Text, Checks, Modell, Zeitstempel. `teile` werden verworfen (der flache Text ist danach maßgeblich, gleiche Regel wie bei `applyBearbeitung`). Die Vorfassung wandert per `appendVerlauf` in den Verlauf ⇒ **Diff + „Diese Fassung übernehmen"** im [VersionVerlauf](../../src/plugins/antraege/kurzfassung/VersionVerlauf.tsx) gelten unverändert; additives Flag `lektoriert` treibt Pipeline-Status und `versionLabel` → „Sprachlich überarbeitet" (Vorrang vor dem Modifier-Label).

### Die automatische Kette (v2.335, Reichweite geschnitten in v6.9)

`generateInto` hängt nach erfolgreicher Generierung `laufLektorat` an — **eine** Busy-Phase, **dieselbe** `AbortSignal`-Kette. Die Entscheidungs-Logik steckt in der reinen [`mitFeinschliff`](../../src/plugins/antraege/gutachten/workflow-generierung.ts): der Lektor-Lauf kommt als **Thunk** herein, deshalb ist sie ohne Transport/Bridge testbar.

- **Nur eine FRISCHE Generierung bekommt das zweite Bein.** Eine Überarbeitung — Modifier (Neu/Kürzer/Länger) oder freie Anweisung, beides `istUeberarbeitung(o)` — setzt auf einem bereits lektorierten Text auf; ein zweiter Lektor-Lauf zöge eine bewusst gekürzte Fassung wieder glatt und kostete einen ganzen Lauf. `generateInto` reicht dann `null` statt des Thunks, und `mitFeinschliff` gibt den Stand **1:1** zurück: kein Verlaufs-Eintrag, **keine** `feinschliffUebersprungen`-Marke (die sagt „hat nicht getragen", nicht „war nicht geplant") — die Karte zeigt schlicht „Formuliert". Manuell bleibt der Feinschliff im ⋯-Menü. `istUeberarbeitung` trägt **beide** davon abhängigen Entscheidungen (auch den Ausschluss der Teil-Generierung), damit sie nicht auseinanderlaufen.
- **Jedes Scheitern eines vorgesehenen Laufs degradiert zum Rohentwurf, keines blockiert**: gezogenes Tor (`null`), Wurf — und **Abbruch**. Letzteres ist der subtile Fall: der Rohentwurf ist zu diesem Zeitpunkt bereits berechnet, ein durchgereichter `AbortError` würde ihn verwerfen (`runGeneration` liefert bei `aborted` `null` ⇒ kein Persist). Deshalb fängt `mitFeinschliff` auch Abbrüche und gibt den Generierungsstand zurück.
- **Kein Fehlerbanner**: der angehängte Lauf bekommt `stilleDeps` (verschlucktes `setError`); sichtbar wird nur das additive `StepRun.feinschliffUebersprungen` → „Feinschliff übersprungen — angezeigter Text ist der Rohentwurf". Ein späterer manueller Feinschliff löscht die Markierung.
- **Die zurückgegebenen `checks` stammen immer vom final ANGEZEIGTEN Text** (nach erfolgreichem Feinschliff also die des Lektor-Laufs) — sonst entschiede der Auto-Retry-Orchestrator über eine Fassung, die niemand sieht.
- **Rohentwurf im Verlauf**: leistet das vorhandene `applyLektorat` → `appendVerlauf(step)`; dafür kam kein neuer Code dazu, nur ein Kontrakt-Test. Nebenwirkung: ein Generierungs-Zyklus schreibt jetzt ZWEI Verlaufs-Einträge, `MAX_VERLAUF = 5` füllt sich doppelt so schnell (`slice(-5)` hält den Rohentwurf immer).
- **Reichweite**: der Bulk-Lauf `generiereAlle` und die Zweitfassung (anderes Ziel/andere Temperatur, aber frisch) gehen durch die volle Kette. **Nicht** dabei: Modifier- und Anweisungs-Läufe (siehe oben), der reine QS-Lauf und das manuelle Lektorat. Bewusst **kein** Ein/Aus-Setting.
- **Fortschritt** ist strukturiert, nicht geraten: `LaufPhase` (`'formulieren' | 'feinschliff'`) in [useStreamingBuffer.ts](../../src/plugins/antraege/kurzfassung/useStreamingBuffer.ts); `lektoriereEinmal` setzt sie je VERSUCH (ein Fallback-Retry resettet die Senke).
- **Beide Beine stehen in der Prompt-Ansicht**: `lektoriereEinmal` meldet seinen Prompt wie die Generierung über `merkeGesendet` — mit `bein: 'feinschliff'`. Der Hook hält daraus **Slots** statt einer Liste (Generierung ersetzt alles, Feinschliff ersetzt nur sich selbst — retry-fest), die Beschriftung im Dialog kommt aus der reinen `beschrifteGesendet` ([promptAnsicht.ts](../../src/plugins/antraege/gutachten/promptAnsicht.ts)), deren Teil-Nummerierung den Feinschliff nicht mitzählt. Grund: im Chat der internen KI ist vom ersten Prompt nichts mehr zu sehen (jeder Lauf startet einen frischen Chat, Pitfall #36) — wer dort nur den Lektor-Prompt findet, hält ihn sonst für den einzigen gesendeten.

## Der Veröffentlichungs-Kontrakt von A (v6.30, gemessen)

Abschnitt A wird **veröffentlicht** — unter anderem zur Prüfung auf Doppelförderung — und steht dort allein, ohne den Antrag daneben. Das stand nirgends. Ohne den Zweck war auch nicht begründbar, warum so vieles nicht hineingehört: der Judge des Messlaufs vermisste Antragsteller, FuE-Risiko und Abgrenzung zum Stand der Technik, während das Zeichenlimit bereits gerissen war. **Fachentscheidung des Teams: diese drei gehören nicht hinein**, der Platz reicht dafür nicht. Inhalt sind genau die fünf Punkte des Prompts.

Drei Befunde lagen darunter, alle drei gemessen (Haiku 4.5 als Modell, Opus 5 als Judge, die drei fiktiven EP-Fixtures):

1. **Der kuratierte Share hatte den Ausgabeformat-Block verloren.** Ohne `### Finaler Text` findet [parse.ts](../../src/core/services/skills/run/parse.ts) keine Überschrift und nimmt die **ganze** Antwort als finalen Text — samt der vom Modell erfundenen Hülle aus Titelzeile, Förderkennzeichen, Akronym und einer Antragsteller-Zeile. Jeder Lauf trug die Warnung „Antwort ohne erwartete Abschnitte"; das Zeichenlimit riss an dieser Hülle, nicht am Text. Gemessen wurde also nie die Kurzfassung.
2. **Kein Weglass-Gebot.** Ein Prompt, der nur sagt, was hinein soll, lädt zum Ergänzen ein ([[erfundene-achse-fehlte-das-weglass-gebot]]).
3. **Das Zeichenlimit stand als Nachkontrolle statt als Schreib-Anweisung.** „Zähle nach und kürze" half nicht — Modelle zählen Zeichen schlecht. Was half: die Rechnung vorweg. 1.100 Zeichen auf zehn Sätze sind rund 15 Wörter je Satz.

Ein vierter Befund lag **nicht** am Prompt, sondern an der Messung: der Eval-Judge sah die VB nur bis 12.000 Zeichen, bei 100.000–120.000 Zeichen echter Länge also 10–12 %. Kennzahlen, die das Modell korrekt aus Kapitel 9 übernommen hatte, standen hinter dem Schnitt und wurden als „nicht belegt" abgewertet — die Note war nach oben gedeckelt. Der Default zeigt jetzt die ganze VB, `--judge-vb-cap` senkt ihn für billige Durchläufe, und ein gekürzter Prompt sagt es ausdrücklich ([judge.ts](../../src/core/services/skill-eval/judge.ts)).

**Die `beschreibung` ist nicht nur Anzeige-Text.** Der Judge bekommt ausschließlich sie, um zu wissen, was der Abschnitt leisten soll. Solange der Umfang nicht darin stand, wertete er gegen seine eigene Vorstellung und zog Punkte für genau das ab, was das Team weggelassen hatte — bei identischem Text `vollstaendigkeit` 3,00 mit der alten Beschreibung, 4,00 mit der neuen.

Gemessen, alles mit vollem Judge-Kontext:

| | Nullpunkt | nach der Migration |
|---|---|---|
| Zeichen (max. 1.100) | 1272 / 1132 / 1281 | 951 / 1093 / **1181** |
| Läufe ohne Check-Fehler | 0 von 3 | **2 von 3** |
| fachliche Korrektheit | 3,00 | **4,67** |
| Vollständigkeit | 4,00 | 4,00 |
| Sprachqualität | 4,00 | 4,00 |
| Regeltreue | 3,00 | **4,33** |

Der eine verbleibende Überhang (81 Zeichen) ist der Fall, für den der beschränkte **Auto-Retry** da ist (`kuerzer`, ein Versuch je Schritt).

Umgesetzt in `mitVeroeffentlichungsKontrakt` ([gutachten-kurzfassung.seed.ts](../../src/core/services/skills/registry/gutachten-kurzfassung.seed.ts)) — **eine** reine, idempotente Funktion für Seed **und** Migration, damit beide nicht auseinanderlaufen. `buildKurzfassungPrompt` bleibt byte-identisch: zwei ältere Migrationen vergleichen ihre Ausgabe. Rollout über `ga-a-veroeffentlichung-2026-08`, additiv und zeilenweise über Anker, die den kuratierten Share **und** den Seed tragen — A ist der eine live kuratierte Gutachten-Prompt, ein Voll-Template-Guard könnte hier nie greifen. Eine selbst geschriebene `beschreibung` bleibt stehen.

## B und C: die zwei Abschnitte, die 3/3 zu kurz lieferten (v6.32, gemessen)

Nach A wurden B und C durch dieselbe Schleife geschickt — mit derselben ersten Frage: **misst die Messung den Text oder die Hülle?** Bei A war es die Hülle. Bei B und C nicht: alle sechs Nullpunkt-Läufe parsten sauber, die Abschnitte waren wirklich zu kurz. Die Gründe lagen im Prompt, und in beiden Fällen war es **eine Zahl, die einen Formwechsel überlebt hat**.

**B — die Teile widersprachen dem Ganzen.** Der Prompt forderte in der Aufgabe „Richtwert ≥ 150 / ≥ 150 / ≥ 450 Wörter", zusammen also mindestens 750. Die Regel, vom Team im Editor kuratiert, stand auf **400–500**. Teil 3 allein riss die Obergrenze. Entstanden ist das durch eine halbe Ent-Dopplung: `applyUmfangDedup` nahm 2026-07 die Total-Zahl aus der Prosa, ließ die Teil-Richtwerte aber als absolute Wortzahlen stehen — und die waren auf den alten 750er-Stand geeicht.

**C — der Umfang gehörte einer Form, die es nicht mehr gab.** Die 300–350 Wörter stammen aus der Zeit, als der finale Text **alle** Risiken mit Kurztitel trug. Heute ist er eine gefilterte Teilmenge (höchstens fünf, als Fließtext). `applyCFuenfRisiken` hatte das bereits einmal zu heilen versucht, indem es den Deckel von drei auf fünf hob — mit der Rechnung „fünf Risiken à zwei bis drei Sätze treffen die 300–350 Wörter". Nachgemessen trug sie nicht: das Modell hielt die Satzzahl exakt ein (12–14 Sätze), die Rechnung unterstellte nur rund 24 Wörter je Satz statt der geschriebenen 15 bis 17. Der eigentliche Grund lag tiefer — „2–3 Sätze je Risiko" steht am **Entwurf**, der finale Text hatte gar keine eigene Tiefenangabe und erbte die Rate des Entwurfs.

Gemessen (Haiku 4.5, drei fiktive VBs, je ein Lauf):

| | Nullpunkt | Anteile / Budget | + Zuschreibung an den finalen Text |
|---|---|---|---|
| **B**, Ziel 400–500 | 360 / 364 / 364 | 310 / 328 / 364 | 440 / 321 / 337 |
| **C**, Ziel 300–350 | 203 / 235 / 218 | 282 / 249 / 255 | **309 / 244 / 283** |

**C ist besser geworden, B nicht.** C legt in allen drei Dokumenten gegenüber dem Nullpunkt zu (+106 / +9 / +65); B schwankt ohne Richtung (+80 / −43 / −27). Der Widerspruch in B ist beseitigt — das ist für sich richtig —, aber er war nicht die Ursache der Kürze. Über drei Konfigurationen und neun Läufe landet B zwischen 310 und 440 mit einem Mittel um 350: **das Ziel 400–500 liegt über dem, was Haiku für diesen Abschnitt schreibt, unabhängig vom Prompt.** Die Quelle ist nicht der Engpass — die Fixture-VBs tragen 12.000–14.000 Wörter mit 400–600-Wort-Abschnitten.

**Warum keine Selbstkorrektur greift:** `chooseRetryModifier` ([retry-policy.ts](../../src/plugins/antraege/gutachten/retry-policy.ts)) startet einen Versuch nur bei `level === 'fehler'`. Die Wortanzahl ist an B und C ein **`hinweis`**. Der `laenger`-Retry existiert, ist verdrahtet und feuert bei zu kurzem Text nie — die gemessenen Zahlen sind damit exakt das, was im Programm ankommt. Wer die Zielzahl durchsetzen will, hat den Hebel in einem Feld: `schweregrad` auf `fehler`. Das kostet einen zweiten Modell-Lauf je Abschnitt und ist eine Fachentscheidung, keine Prompt-Frage.

Rollout über `ga-b-teil-anteile-2026-08` und `ga-c-final-umfang-2026-08`, beide pristine-only. Die kuratierten Wortzahl-Vorgaben wurden **nicht** angefasst.

### Der Wächter, der das hätte fangen müssen

`findeUmfangKonflikte` gibt es seit 2026-07 genau für „Prosa-Zahl weicht von der Regel ab" — und es schloss weiche Teil-Richtwerte ausdrücklich aus, damit „(Richtwert ≥ 150 Wörter)" keinen Fehlalarm auslöst. Die Begründung stimmt für einen einzelnen Richtwert und übersieht, dass Teile sich **summieren**. Seit v6.32 prüft der Wächter mehrere Wort-Richtwerte zusätzlich als Summe gegen die Obergrenze der Regel; ein einzelner bleibt bewusst stumm.

Zweitens sah diese Warnung beim Messen niemand: sie lebt im Skill-Editor, und der Eval-Lauf fragt sie nicht. Das hat jetzt zweimal einen vollständigen Messlauf gekostet (A ohne Ausgabeformat-Block, B mit der Summe). `npm run eval:skills` hält die Prompts der zu messenden Abschnitte darum **vor dem ersten Modell-Aufruf** gegen `findeUmfangKonflikte` + `findeVorgabenWidersprueche` und meldet, was es findet — ohne abzubrechen, denn ein Widerspruch kann der Gegenstand der Messung sein.

### Die Wortzahl-Zeile nennt jetzt ihren Bezug

`zeichen_max`, `absatz_min`, `keine_aufzaehlungen` und `platzhalter_frei` schrieben seit jeher „**der finale Text** …". Die beiden Größen-Regeln sagten „Schreibe 400 bis 500 Wörter." — ohne Bezug, während `runRegelChecks` ausschließlich `parsed.finalerText` misst. Bei mehrteiliger Ausgabe (Quellenanalyse / Entwurf / Finaler Text) war damit offen, worauf sich die Zahl bezieht. `wortanzahl` und `satzanzahl` sprechen jetzt wie ihre vier Geschwister.

## Was der Messlauf 08/2026 an den Vorgaben geändert hat (v6.15)

Erster gemessener Lauf der Kette A–G gegen die interne KI, geeicht an Haiku 4.5 / Sonnet 5 /
Opus 5 ([Bericht](../_archiv/gutachten-modellvergleich-2026-08.md)). Vier der Befunde waren
Vorgaben-Defekte, keine Modellgrenzen — sie sind hier repariert. Rollout auf Bestands-Shares
über vier marker-gesicherte Migrationen ([migrations.ts](../../src/core/services/skills/registry/migrations.ts),
Tests in [migrations-messlauf-2026-08.test.ts](../../src/core/services/skills/registry/__tests__/migrations-messlauf-2026-08.test.ts)).

- **C: Risiko-Deckel drei → fünf** (`ga-c-fuenf-risiken-2026-08`). Der Abschnitt forderte, was
  er selbst verbot: der Prompt deckelte auf höchstens drei Risiken, die Vorgabe verlangte
  300–350 Wörter — drei Risiken à zwei bis drei Sätze ergeben rund 200. **Alle vier** Modelle
  unterschritten (interne KI 106 Wörter, Haiku 188, Sonnet 248, Opus 288); ein Befund, der über
  die Modellklassen hinweg gleich ausfällt, ist kein Modelldefekt. Aufgelöst über die
  Risiko-Grenze, nicht über die Wortzahl — die Vorgabe ist eine Kurator-Entscheidung.
- **A: Satzzahl einheitlich 9–11** (`ga-a-umfang-kuratiert-2026-08`). Sie stand an **drei**
  Stellen und an zweien falsch: Prompt-Prosa „ca. 10 Sätze (Toleranz 8–12)", Vorgabe des Teams
  9–11, Modifier-Richtwerte 8 und 12. Haiku lieferte 8 Sätze — nach dem Prompt-Text korrekt,
  nach der Regel ein Hinweis. Die Prosa nennt jetzt gar keine Zahl mehr (Umfang single-source,
  siehe oben), die Modifier zeigen auf die Ränder der Vorgabe. **Ausnahme von der Regel „ganzes
  Template vergleichen"**: A ist der einzige Gutachten-Skill, dessen Prompt auf dem Share
  kuratiert ist (823 statt 1.609 Zeichen) — ein Voll-Template-Guard könnte dort nie greifen,
  genau deshalb trug A die Dopplung, die `ga-umfang-dedup-2026-07` beseitigen sollte, bis
  heute. Die Migration tauscht darum **nur die eine nachweislich falsche Zeile** und lässt den
  Rest des kuratierten Textes stehen; Modifier und Vorgabe sind separat pristine-geschützt.
- **E + F bekommen erstmals eigene Vorgaben** (`ga-ef-vorgaben-2026-08`). Vorher prüfte an
  beiden NUR die Interpunktions-Regel — je ein Check gegen sechs an A. Beide Abschnitte
  skalieren mit der Partnerzahl („je Partner 2–3 Sätze", „je Firma 3 Sätze"), eine Obergrenze
  wäre also falsch. Gesetzt ist nur ein **Boden** (`hinweis`, E ≥ 40, F ≥ 60 Wörter), geeicht am
  kleinsten rechtmäßigen Fall (ein Antragsteller: gemessen 48 bzw. 85 Wörter) — er fängt den
  entarteten Lauf, nicht den normalen. `keineAufzaehlungen` ist dagegen hart, wie überall sonst.
- **Ein automatischer Korrektur-Versuch je Schritt** (`ga-ep-auto-retry-2026-08`). Der
  beschränkte Auto-Retry existiert seit v4.124, war aber an **keinem** ZIM-EP-Schritt
  eingeschaltet: eine verletzte `fehler`-Regel blieb stehen. Gemessen an A — die interne KI
  lieferte 1.243 statt höchstens 1.000 Zeichen, und der vorhandene regelgebundene
  Korrektur-Lauf reparierte das in 23 Sekunden auf 996. `maxRetries: 1` statt des Defaults 2:
  ein Abschnitt über die Bridge dauert 25–90 s, und jeder Versuch resettet zuerst den Chat.
- **Die Regel-Zahl der Skill-Liste zählt jetzt, was prüft**: `regelIds.length` unterschlug seit
  v2.296 alles, was als `vorgaben` am Skill hängt (Umfang, Satzzahl, Zeichenlimit,
  Pflicht-Anfang) — A stand mit „2 Regeln" da, während sechs Checks liefen. Karte und Tabelle
  lesen die Zahl jetzt aus `resolveRegeln` ([SkillsTab.tsx](../../src/plugins/skill-verwaltung-kuration/SkillsTab.tsx)).

## Freie Überarbeitungs-Anweisung — „Bearbeiten mit KI" (v2.370)

Vierter Knopf neben Neu/Kürzer/Länger: der Bearbeiter formuliert **selbst**, was mit dem
Abschnitt geschehen soll („technische Risiken auf die des Lösungswegs beschränken, die
anderen entfernen", „Lösungsweg vertiefen"). Technisch ein **Modifier-Lauf ohne Modifier** —
kein neuer Pfad, kein neuer Transport, keine neue Persistenz-Ebene.

- **Prompt**: `SkillRunInput.anweisung` → eigener Block direkt nach dem Modifier-Block
  ([`buildAnweisungBlock`](../../src/core/services/skills/run/run-skill.ts)). Bewusst **nicht**
  `zusatzAnweisung` (die regel-abgeleitete Korrektur-Vorgabe aus Journey-Paket 3) mitbenutzt:
  beide Blöcke können gemeinsam auftreten. Ohne Wert No-op → Bestandsläufe byte-identisch.
- **Der Rahmentext des Blocks ist der Wirkstoff**, nicht Höflichkeit: er bindet die Anweisung
  an den darüberstehenden „Bisherigen finalen Text", verlangt Unverändert-Übernahme des nicht
  Betroffenen und hält den Erfindungs-Riegel für die Vertiefungs-Fälle vor. Ohne ihn liest das
  Modell die Anweisung als Themenwunsch und schreibt den Abschnitt neu.
- **Zwei Stellen in `generiereEinmal` behandeln die Anweisung wie einen Modifier**: sie zieht
  `vorherigerText` in den Prompt (ohne ihn gäbe es nichts zu überarbeiten) und **schließt die
  Teil-Generierung aus** — über den Teil-Pfad entstünde Abschnitt B frisch in Teilen statt
  fortgeschrieben. Letzteres ist der Hauptfall, nicht der Randfall.
- **Provenienz**: additives `StepRun.anweisung` + `KurzfassungVersion.anweisung`; `versionLabel`
  zeigt „Überarbeitet: „…"" mit **Vorrang vor `lektoriert`**. Seit v6.9 hängt an einem
  Anweisungs-Lauf ohnehin kein Feinschliff mehr (er ist eine Überarbeitung), der Vorrang bleibt
  aber richtig: eine spätere manuelle Politur soll die Herkunft der Fassung nicht überschreiben.
  Die Anweisung gilt für **genau einen Lauf** und wird nie erneut angewendet.
- **UI**: [`AnweisungLeiste`](../../src/plugins/antraege/gutachten/AnweisungLeiste.tsx) erscheint
  inline **anstelle** der Werkzeugzeile (Text bleibt sichtbar, nie zwei offene Eingaben in einer
  Karte). Die letzten 5 Anweisungen liegen als Chips in `localStorage`
  ([anweisungVerlauf.ts](../../src/plugins/antraege/gutachten/anweisungVerlauf.ts)) — gerätelokal,
  abschnitts- und verbundübergreifend, **nie** auf dem Share/im Snapshot.

## Transport-Fallback agentisch → standard (v2.334)

Scheitert ein Lauf mit aktiver agentischer KI-Präferenz, übernimmt still die Standard-KI — statt den Lauf mit rotem Banner zu verlieren. Wiederverwendbar in [ziel-fallback.ts](../../src/core/services/ai/ziel-fallback.ts) (`mitZielFallback`), eingesetzt für Generierung, QS und Feinschliff.

- **GENAU EIN Retry**, immer agentisch → standard, nie umgekehrt, nie mehrfach, **nie bei Nutzer-Abbruch** (`AbortSignal`/`AbortError` — ein Stopp ist kein Ausfall).
- **Nur wenn `ziel` überhaupt wirkt** (`zielWirktAuf`, Streamlit-Bridge): `ziel` wählt nur den Bridge-Tab; auf DirectLLM wäre der zweite Lauf byte-identisch zum ersten und damit reine Verschwendung.
- **Auslöser**: Wurf ODER ein vom Aufrufer gemeldetes unbrauchbares Ergebnis (leerer `finalerText`; beim Lektorat ein gezogenes Tor).
- **Fehler werden je Versuch gepuffert** (`mitFallbackLauf`): ein gescheiterter erster Versuch darf kein Banner hinterlassen, wenn der zweite trägt. Preflight (`kiVerbindungBereit`) + `ping` bleiben EINMAL in der äußeren Hülle — der Verbinden-Dialog darf sich nicht pro Versuch öffnen.
- Additives `StepRun.zielFallback` (gesetzt, wenn Generierung ODER Feinschliff zurückfiel) → Badge „Standard-KI (Fallback)" im Karten-Kopf. Der reine QS-Lauf stempelt nichts (er ändert den Text nicht).

## Prompt-Ansicht — „was geht wirklich an die KI?" (v2.372)

Der Skill-Editor zeigt die **Vorlage**, nicht den **Lauf**. Dazwischen liegen bis zu neun angehängte Blöcke und die im Volltext eingesetzte Vorhabensbeschreibung, die am Kontextfenster gekappt wird. Wer die Qualität eines Abschnitts beurteilen will, braucht diese Differenz. Erreichbar im ⋯-Menü der Karte **und** neben „… generieren" an der noch leeren Karte (dort kostet der Blick Sekunden, danach hat er Minuten gekostet). dev + pl, kein eigener Flag.

- **Eine Kette, zwei Konsumenten.** [`renderSkillPrompt`](../../src/core/services/skills/run/run-skill.ts) kapselt, was `runSkillInner` vorher inline tat (VB kappen → `composeSkillPrompt` → Ausgabe-Budget) und wird vom Runner selbst gerufen; [`baueSkillEingabe`](../../src/plugins/antraege/gutachten/laufEingabe.ts) ist die einzige Stelle, an der aus dem Abschnitts-Zustand ein `SkillRunInput` wird. Die Vorschau ist damit **per Konstruktion** deckungsgleich mit dem Lauf — eine Vorschau, die ihren Text selbst nachbaut, weicht bei neun bedingten Blöcken irgendwann unbemerkt ab. Guards: [render-prompt.test.ts](../../src/core/services/skills/run/__tests__/render-prompt.test.ts), [prompt-ansicht.test.ts](../../src/plugins/antraege/gutachten/__tests__/prompt-ansicht.test.ts).
- **Zwei Sichten**: „Vorschau — nächster Lauf" (immer verfügbar, auch ohne KI) und „Zuletzt gesendet" aus `SkillRunResult.gesendet`. Letzteres ist der tatsächlich abgesendete Text, nicht seine Rekonstruktion; bei Teil-Generierung stehen **alle** Teil-Prompts da.
- **Nur RAM.** Der gesendete Prompt trägt Dokumentinhalt und lebt in einer `useRef`-Map für die Sitzung — nie IDB, nie Share, nie Snapshot, nie Personal-Mirror. Guard `prompt-nur-im-ram` ([conventions-daten.test.ts](../../src/__tests__/conventions-daten.test.ts)) verbietet ein `gesendet`-Feld in `runner.ts`/`types.ts`/`workflow-persistenz.ts`.
- **Maße vor Wortlaut** ([promptAnsicht.ts](../../src/plugins/antraege/gutachten/promptAnsicht.ts)): Zeichen gesamt · davon VB · davon Anweisungen · geschätzte Tokens (`schaetzeTokens` — dieselbe Quote wie die Cap-Rechnung, keine zweite) · Cap des Ziels. Darunter `beschreibeBloecke` — welche der neun Blöcke im Prompt stehen, **auch die abwesenden**. Die VB-Passage ist per `trennePromptAmVb` abgetrennt und eingeklappt; ein `<pre>` mit sechsstelliger Zeichenzahl macht den Dialog sonst unbenutzbar.

## Sampling-Temperatur (v2.373, gemessen v2.373.1)

Bis v2.372 sendete die App **keinen** Sampling-Parameter — der Body bestand aus `model`, `messages`, `max_tokens`. Damit lief jeder Skill-Lauf auf der Server-Voreinstellung (internes llama.cpp: `temperature: 1.0`), während die Node-Eval, mit der dieselben Skills vermessen wurden, auf `temperature: 0` fuhr. Welcher Wert wirkte, hing an den Startflags des Servers und stand nirgends im Projekt. Zwei Werte, fest im Code ([sampling.ts](../../src/core/services/ai/sampling.ts)), bewusst **ohne** Einstellung in der Oberfläche; `runSkill` setzt `TEMPERATUR_STANDARD`, wenn der Aufrufer nichts vorgibt, und die Prompt-Ansicht zeigt den Wert in der Fußzeile.

**Der Wert steuert die Regeltreue nicht.** v2.373 senkte den Standard auf 0,4 in der Annahme, ein streng quellenbasierter Text brauche wenig Streuung. Die Messung widerlegt das:

| Temperatur | sauber¹ | alle 6 Regeln | Zeichen Median (max) | über 1000 |
|---|---|---|---|---|
| 0,2 | 92 % | 84 % | 806 (1045) | 8 % |
| 0,4 | 88 % | 80 % | 835 (1203) | 12 % |
| 0,6 | 88 % | 84 % | 847 (1126) | 12 % |
| 0,8 | 92 % | 88 % | 841 (1262) | 8 % |
| 1,0 | 96 % | 84 % | 865 (1189) | 4 % |

> ¹ ohne Verstoß gegen eine der drei **Fehler**-Regeln (Zeichengrenze 1000, keine Aufzählungen, keine Semikolon/Gedankenstriche). 125 Läufe: 25 fiktive Vorhabensbeschreibungen × fünf Temperaturen, Abschnitt A, Skill „Kurzfassung (Gutachten) v4", Qwen 3.6 35B-A3B Q4_K_M, Rohentwurf ohne Feinschliff. Der gesamte Abstand zwischen bester und schlechtester Spalte ist kleiner als der Standardfehler von rund sechs Punkten bei 25 Läufen — es gibt **keinen** messbaren Effekt.

Daraus `TEMPERATUR_STANDARD = 1.0`: der Wert, der vor v2.372 ohnehin wirkte, jetzt ausdrücklich gesetzt statt vom Server geerbt. Das ist eine Reproduzierbarkeits-Entscheidung, keine Qualitätsaussage — wer die Ausgabe besser treffen will, ändert Prompt und Regeln, nicht diese Zahl. Ein Test hält den Wert auf 1,0 fest, damit die nächste Änderung erst wieder misst.

**Zwei Fallen dieser Messung**, beide zuerst falsch gemacht:

- **Die Messung muss die Body-Form der App haben.** Der erste Anlauf lief über `runOneSection`/`NodeOpenAITransport` — die fahren fest `thinkingBudget: 'medium'` und senden den Denkprozess-Schalter gar nicht weiter, der Server denkt dann per `--reasoning auto` mit. Die App schickt `chat_template_kwargs.enable_thinking = false`. Unterschied auf demselben Modell: 209 s gegen 31 s pro Lauf, also ein anderes Regime, nicht nur ein langsameres.
- **Ein zweiter Messprozess auf demselben Server verfälscht alles.** Zwei parallele Läufe teilen sich einen llama.cpp-Slot; die Dauer versechsfacht sich und der Prompt-Cache (`cache_prompt`) trägt nicht mehr. Vor dem Messen prüfen, dass nur ein Prozess spricht.

## Kontext-Warnung VOR dem Lauf (v2.372)

Dass die Vorhabensbeschreibung nicht ins Fenster passt, stand bisher erst am fertigen Abschnitt („Auf gekürzter VB-Basis entstanden"). Bei einem sehr langen Antrag reißt der Cap der Standard-KI (238.617 Zeichen) regelmäßig, und die naheliegende Abhilfe — auf die agentische KI mit rund vierfachem Fenster wechseln — wäre vorher **ein Klick** gewesen.

- Reine [`pruefeKontextPasst`](../../src/plugins/antraege/gutachten/kontextWarnung.ts) misst den KORPUS (VB + aufgenommene Zusatzdokumente) gegen den Cap des aktuell gewählten Ziels und sagt zusätzlich, ob das Fenster der **anderen** internen KI reichen würde. `null`, wenn alles passt — der Normalfall erzeugt keine Zeile.
- Gerendert in [GutachtenSection](../../src/plugins/antraege/gutachten/GutachtenSection.tsx) über der Karte, reaktiv auf den KI-Umschalter (`useKontextZiel`). **Blockiert nie.**
- **Benennt nur ein Fenster, das es gibt** (`KontextBefund.fensterLabel`): ohne Bridge kennt der Lauf weder Standard- noch agentische KI, dann heißt es „ins Fenster **des Modells**". Dieselbe Bedingung wie die Wechsel-Empfehlung (`capAndere === undefined`), damit es keine zweite Ableitung gibt.
- **Relevanz-Map jetzt kuratierbar**: `kontextBedarf` (`voll` | `relevant`) steht als Auswahl je Schritt im [WorkflowEditor](../../src/plugins/skill-verwaltung-kuration/WorkflowEditor.tsx). Der Seed-Default bleibt `'voll'` — das Umschalten ist eine Kurator-Entscheidung nach Messung, kein stiller Verhaltenswechsel für alle Installationen. Erst dadurch wird auch das vorhandene „Vollständigen Kontext erzwingen" sinnvoll.

## Zweitfassung mit der anderen KI (v2.372)

Denselben Abschnitt ein zweites Mal erzeugen, mit der jeweils **anderen** internen KI, und die beiden Fassungen vergleichen. Bewusst **kein** neuer Vergleichs-Bildschirm: der Versionsverlauf ist bereits Diff + „Diese Fassung übernehmen", und `applyGeneration` schiebt die Vorfassung ohnehin hinein.

- **Erzwungenes Ziel schaltet den Fallback aus** (`ZielFallbackOptions.zielOverride`, [ziel-fallback.ts](../../src/core/services/ai/ziel-fallback.ts)): wer ausdrücklich die andere KI verlangt, darf bei deren Ausfall nicht still die Fassung der ersten zurückbekommen — verglichen würde sonst eine Fassung mit sich selbst.
- **Der angehängte Feinschliff folgt demselben Ziel** (`laufLektorat(..., zielOverride)`), sonst trüge die Zweitfassung den Schliff der ersten KI.
- **Was variiert wird, hängt am Transport** ([zweitfassung.ts](../../src/plugins/antraege/gutachten/zweitfassung.ts), seit v2.373): über die Bridge der Tab (andere KI), an einer direkt angebundenen KI die **Sampling-Temperatur** (`TEMPERATUR_ZWEITFASSUNG`). Bis v2.372 entfiel der Eintrag ohne Bridge ersatzlos — ausgerechnet am lokalen Modell, wo ein zweiter Lauf am billigsten ist. Die Beschriftung nennt die Art („Zweitfassung mit anderer Einstellung"), und `StepRun.fassung` hält sie am Lauf fest; ohne den Marker sind die beiden Fassungen im Verlauf nicht auseinanderzuhalten. Der Marker `'mutig'` aus v2.373 wird nur noch gelesen (`FassungMarker`) — beide Werte heißen für den Leser dasselbe.
- **Herkunft am Verlauf**: additives `KurzfassungVersion.ziel` (aus `StepRun.ziel`, von `snapshotOf` mitgeführt) → KI im Tab-Label und in beiden Meta-Zeilen. Ohne das trügen zwei Fassungen desselben Zyklus dieselbe Beschriftung.
- **Der Stempel wird ENTFERNT, wo das Ziel nicht wirkt** (`applyLaufZiel(..., null)`, [runner.ts](../../src/plugins/antraege/gutachten/runner.ts)): der Schritt wird fortgeschrieben, nicht ersetzt — ein Rest aus einem früheren Bridge-Lauf schriebe sonst „· Standard-KI" unter einen Text, der am lokalen llama.cpp entstanden ist (so am 01.08.2026 in der local-Variante beobachtet).
- **Ehrlich über den Vergleich**: unterscheiden sich die beiden Fassungen in `vbGekuerzt`, steht das im Verlauf — die Fenster der internen KIs unterscheiden sich um etwa das Vierfache, man vergleicht dann „gekürzt gegen vollständig" und nicht zwei Modelle.
- `MAX_VERLAUF` 5 → 8: seit dem automatischen Feinschliff schreibt ein Zyklus zwei Verlaufs-Einträge; bei 5 fiel das Fassungs-Paar als erstes hinten raus.
- DSGVO unverändert: beide Ziele sind dieselbe **interne** Klasse, der Transport kommt weiter aus `getTransportForSkillRun` (Pitfall #30).

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
| Skill-Tweak (User-Tweaks v2, privat) | `kv`-Store + persönl. Ordner | `skill-tweaks:<skillId>` + `ZAH/skill-tweaks.json` (LWW) |
| Aufgenommenes Dokument | `kv`-Store (Dokumente) | `doc:<uuid>`, `tags:[<verbund-key>, <typ>]` |
| Maßgebliche VB (Wahl) | `kv`-Store + persönl. Ordner | `vb-auswahl:<verbund-key>` + `…/antraege/<key>/vb-auswahl.json` |
| Gutachten-Korpus (Mitgliedschaft) | `kv`-Store + persönl. Ordner | `gutachten-korpus:<verbund-key>` + `…/gutachten/korpus-auswahl.json` |
| Vorlagen-Verzeichnis-Handle | `kv`-Store | `gutachten-vorlagen-dir` |
| Fertige DOCX | Persönlicher Ordner | `ZAH/gutachten/Gutachten_EP_<verbund-fkz>.docx` |

## Feature-Flag & Einbindung

- Flag `gutachtenKurzfassung` (optional, default false via `=== true`): [config-schema.mjs](../../scripts/config-schema.mjs) (`DEFAULT_CONFIG.features`, NICHT in `requiredFlags`), [runtime-config.ts](../../src/config/runtime-config.ts) (`TeamflowFeatures`), [feature-flags.ts](../../src/config/feature-flags.ts) (`isGutachtenKurzfassungEnabled()`), in allen `configs/*` explizit gesetzt (dev = true, sonst false).
- Kein neues Plugin / kein Routing — die Sektion ist in `VerbundDetail` eingebettet und per `isGutachtenKurzfassungEnabled()` gegated.

## Generalisierung — vom Testballon zur Registry (Ist-Zustand)

Der ursprünglich „vorbereitet, aber nicht umgesetzt"-Teil ist inzwischen realisiert:

- **Skill-Registry umgesetzt** (v2.69): Skills + Regeln sind kurator-pflegbare Daten in `_intern/skills/registry.json` ([registry/](../../src/core/services/skills/registry/)). Die Aufrufer lösen den Skill per `id` aus der Registry auf (`loadSkillRegistry` → `getSkillById`/`resolveRegeln`) und reichen den `SkillRecord` + die aufgelösten Regeln an den transport-agnostischen `runSkill`; der Seed ist nur noch Fallback.
- **Kurator-UI umgesetzt**: Skill-/Regel-Verwaltung im Plugin [skill-verwaltung-kuration/](../../src/plugins/skill-verwaltung-kuration/) (Flag `skillVerwaltung`, dev + kurator + pl) inkl. Sandbox-Testlauf.
- **Workflow A–G umgesetzt**: der volle Gutachten-Workflow ([useGutachtenWorkflow.ts](../../src/plugins/antraege/gutachten/useGutachtenWorkflow.ts), Flag `gutachtenWorkflow`) löst die Kurzfassung-Sektion ab — pro Schritt ein Registry-Skill (Seed-Abschnitte B–G: `SEED_SKILLS_BG`/`SEED_REGELN_BG` in [seed.ts](../../src/core/services/skills/registry/seed.ts)).
- `DokumentAufnahme` ist props-gesteuert (`relationTag`/`knownIds`) und außerhalb des Gutachten-Flows wiederverwendbar.
- **Noch offen**: `fill-template` + `field-mapping` sind skill-unabhängig, aber die Mapping-Tabelle ist **nicht** kurator-konfigurierbar; **TV-spezifisches Dokument-Scoping** fehlt (Nachlieferungen werden dem Verbund zugeordnet, nicht einem einzelnen TV).

## „Alle Abschnitte als Entwurf erstellen" (Bulk, v2.106)

Ein-Klick-Aktion auf der Verbund-Detailseite, die die noch **fehlenden** Abschnitte nacheinander als **Entwurf** erzeugt — **ohne Zwischen-Freigabe**. Gedacht für „erst alles als Rohentwurf, dann reviewen". Button im Sektionskopf von [GutachtenSection.tsx](../../src/plugins/antraege/gutachten/GutachtenSection.tsx) (nur wenn fehlende Abschnitte da sind; während des Laufs → „Stopp" + Fortschrittszeile, der aktive Abschnitt zeigt den Live-Stream).

- **Kern geteilt**: Der Generierungs-Kern eines Abschnitts liegt in `generateInto(base, stepId, …)` ([useGutachtenWorkflow.ts](../../src/plugins/antraege/gutachten/useGutachtenWorkflow.ts)) — arbeitet auf einem **übergebenen** Run (kein Closure-`run`), damit der Bulk-Lauf den frischen Stand durchreicht (Abschnitt B sieht A's gerade erzeugten Entwurf). `runGeneration` (Einzellauf + Auto-Retry) und `generiereAlle` (Bulk) nutzen denselben Kern; das Einzellauf-Verhalten bleibt unverändert (`quelle:'freigegeben'`).
- **Umfang „nur fehlende"** (reine Auswahl `leereSchritte` in [runner.ts](../../src/plugins/antraege/gutachten/runner.ts)): bestehende Entwürfe **und** freigegebene Abschnitte bleiben unangetastet und dienen als Kontext. Damit **idempotent fortsetzbar** — Transport weg / Stopp → erneut klicken macht bei den restlichen leeren Abschnitten weiter.
- **Kontext-Kette**: jeder neue Entwurf bekommt die vorherigen Abschnitte (auch Entwürfe) via `buildVorherigeAbschnitte(base, stepId, steps, 2000, 'entwurf')`. Das ist derselbe `quelle:'entwurf'`-Pfad wie der Batch (siehe unten) — nur inline auf EINEN Verbund und auf der live gehaltenen `run`-State (Single Source of Truth, UI füllt sich progressiv). Persist pro Abschnitt (Pitfall #16/#20), nie während des Streams.
- **Single-pass** (kein Auto-Retry im Bulk — schneller/vorhersehbar; der User nutzt danach pro Abschnitt Kürzer/Länger/Neu). **STOPP** statt Skip bei Transport-weg/Abbruch/Fehler (ein übersprungener Abschnitt würde die Kette der folgenden brechen); fertige Entwürfe bleiben persistiert. Thinking-Budget + DSGVO-Transport-Wahl (`getTransportForSkillRun`, Pitfall #30) gelten unverändert pro Abschnitt.
- **Abgrenzung zum Batch-Stack** (`src/core/services/gutachten-batch/` + [useBatchJob.ts](../../src/plugins/antraege/gutachten-batch/useBatchJob.ts)): Der Batch erzeugt A–G als Entwürfe über eine **Liste** von Anträgen (eigener Job-Store, BatchMonitor, Pause/Resume, Disk-Spiegel). Der Bulk-Lauf hier ist bewusst **nicht** der Batch — er teilt zwar das `quelle:'entwurf'`-Ketten-Prinzip, läuft aber inline im Detail-Hook auf demselben `run`-State (sonst würde ein paralleler Fremd-Write auf `gutachten-workflow:<key>` die Detail-UI veralten lassen, vgl. [recurring-bug-classes.md](recurring-bug-classes.md)).

## LLM-QS (beratend) + beschränkter Auto-Retry (v2.102)

Zwei optionale, komponierbare Erweiterungen des Workflows — beide **additiv** (kein Schema-Bump), beide **Enhancement** der deterministischen Checks (ersetzen sie nicht). Aktivierung pro Schritt über den **Workflow-Kurations-Tab** (kein Seed-Default — `WorkflowStep.rolle`/`autoRetry` sind opt-in).

- **LLM-QS-Schritt** (`WorkflowStep.rolle: 'llm_qs'` + `qsZielStepId`): bewertet den finalen Text eines Generierungs-Schritts **qualitativ + beratend** entlang fester Dimensionen (Erdung in der VB / Kohärenz / Vollständigkeit / Ton) über **denselben internen Transport** wie die Generierung — markierter `###`-Freitext, tolerant geparst ([`parseQsBefunde`](../../src/plugins/antraege/gutachten/qs.ts), kein Throw → `'unklar'`). Seed-Skill `qs-basis` (`QS_BASIS_SKILL_ID`, additiv via `mergeMissingSeeds`); Prompt-Slots `{{zielText}}`/`{{abschnittszweck}}` in `composeSkillPrompt` (No-op ohne Platzhalter → Bestands-Skills byte-identisch). Befunde additiv an `StepRun.qsHinweise` (`QsBefund[]`), reiner Reducer `applyQsHinweise` (am **Ziel**-Schritt, No-op bei leerem Schritt — man bewertet nur Generiertes). `llm_qs`-Schritte sind reine Konfiguration und **aus der Generierungs-Schrittfolge der Laufzeit gefiltert** (stören `firstNonFreigegeben`/`freigeben`/Stepper nicht). UI: manueller **„QS prüfen"**-Knopf in der Werkzeugzeile; Befunde im **QS-Strip** am Text ([QsStrip.tsx](../../src/plugins/antraege/gutachten/QsStrip.tsx) + [QsHinweisList.tsx](../../src/plugins/antraege/gutachten/QsHinweisList.tsx)), getrennt von den Checks. **Kein** Auto-Overwrite, **kein** Auto-Trigger.

### Abnahme-Kriterien am Skill (v2.336)

Die vier Dimensionen hingen an keinem Skill und sagten nie, welcher Satz gemeint ist. Optional pflegt der Kurator je Abschnitts-Skill prüfbare Kriterien (`SkillRecord.qsKriterien`, additiv) — dann bewertet die QS **genau die** und darf Satz-Nummern nennen. Fehlen sie, läuft alles byte-identisch wie vorher.

- **Kein Seed-Write.** Der Kriterien-Block wird in [qs.ts](../../src/plugins/antraege/gutachten/qs.ts) (`buildQsKriterienBlock`) gebaut und von `composeSkillPrompt` als **autoritativer Anhang** ans Prompt-Ende gehängt (Muster `teilAufgabe`). Einen Slot in `qs-basis.promptTemplate` zu ergänzen wäre eine Änderung an einem LIVE-Skill und würde zwischen frischen und kuratierten Installationen driften.
- **Kriterien hängen am ABSCHNITTS-Skill** (A–G), der Lauf fährt weiter über `qs-basis`; `laufQs` holt sie aus `deps.skillMap`.
- **Satz-Referenzen**: das Modell nennt sie 1-basiert (`Sätze: 3, 5`), `parseQsBefunde(raw, satzAnzahl)` rechnet auf 0-basiert um und validiert gegen `splitSentences(finalerText).length` — Unplausibles fällt still weg, **nie** ein Throw. `QsBefund.satzIndizes` nutzt dieselbe Konvention wie `QuellenBeleg.satzIndizes`/`CheckResult.fundstellen`, damit der bestehende Sprung-/Highlight-Pfad trägt.
- **Deterministische Vorarbeit**: Sätze ohne Beleg-Zuordnung (`saetzeOhneBeleg` in [belege.ts](../../src/plugins/antraege/gutachten/belege.ts)) gehen als *Prüfkandidaten* mit — Auswahl-Hilfe, ausdrücklich keine Vorverurteilung.
- **Abnahme** `StepRun.qsAbnahme` (`bestanden` ⇔ alle Befunde `ok`; nur bei kuratierten Kriterien): STRENG beratend, wirkt nur auf das Badge am Freigeben-Knopf. Jede Textänderung (`applyBearbeitung`/`applyLektorat`/`applyZuruecksetzen`) markiert sie als `veraltet` — **markieren statt löschen**, „war abgenommen, gilt nicht mehr" ist ehrlicher als „nie geprüft".
- **Pflege + Ableitung** im Skill-Editor (ein Satz je Zeile) samt Knopf „Kriterien aus Prompt ableiten": ein einmaliger **interner** Lauf ([qsKriterienAbleitung.ts](../../src/plugins/skill-verwaltung-kuration/qsKriterienAbleitung.ts)), registry-frei (kein Seed-Skill), liefert nur **Vorschläge** — gespeichert wird ausschließlich über den normalen Verwaltungs-Pfad (neue Skill-Version). Kriterien sind in Snapshot, Diff, Rollback und Bundle-Rundlauf mitgeführt.
- `QS_DIMENSIONEN` ist kein toter Konstant mehr, sondern per Drift-Wächter an den `qs-basis`-Seed gebunden (`qs-parse.test.ts`) — der Parser akzeptiert jede Überschrift, ein Auseinanderlaufen wäre sonst unsichtbar.

## Abschnitts-Karte: vier Ebenen (v2.337)

**Kopf · Text · Werkzeugzeile · Fußzeile**, plus zwei optionale Bänder am Text. Vorher: sieben Ebenen, drei getrennte Werkzeug-Orte, bis zu fünf einzelne Banner. [SectionReviewCard.tsx](../../src/plugins/antraege/gutachten/SectionReviewCard.tsx) komponiert nur noch.

- **Kopf** ([AbschnittKopf.tsx](../../src/plugins/antraege/gutachten/AbschnittKopf.tsx)): Titel · Status-Chip · Version · Pipeline-Status („Formuliert · Feinschliff") · Fallback-Badge · ⋯-Menü (Kopieren/Feinschliff/Stil/Vorfassungen/Verwerfen; handgerollt mit `useClickOutside` — Radix `DropdownMenu` ist nicht installiert). Von **beiden** Zuständen genutzt (leerer Abschnitt in `GutachtenSection`, Review-Karte) ⇒ eine Implementierung.
- **Hinweis-Streifen** ([HinweisStreifen.tsx](../../src/plugins/antraege/gutachten/HinweisStreifen.tsx)): alle Meldungen in EINER Liste; amber nur, wenn wirklich etwas zu prüfen ist, reine Provenienz bleibt gedämpft.
- **Bewertungs-Band**: QS-Strip + `PruefBlock`, beide selbst-einklappend (`AmpelGruppe`, grün zu). Klick auf einen QS-Befund nutzt den **bestehenden** Fundstellen-Mechanismus — zwei Auslöser (Prop von außen, Strip von innen), aber EINE Implementierung (`markiereSatz`).
- **Werkzeugzeile** ([WerkzeugZeile.tsx](../../src/plugins/antraege/gutachten/WerkzeugZeile.tsx)): `Neu · Kürzer · Länger | Bearbeiten · QS prüfen` — rechts „Freigeben und weiter" mit QS-Badge.
- **Fußzeile** ([AbschnittFuss.tsx](../../src/plugins/antraege/gutachten/AbschnittFuss.tsx)): Kennzahlen + Provenienz, rechts 👍/👎. Die bleiben **ausdrücklich** sichtbar und wandern nicht ins Menü — das System lernt daraus (Skill-Reifegrad).
- Alle Sichtbarkeits-Entscheidungen liegen in der reinen [abschnittAnzeige.ts](../../src/plugins/antraege/gutachten/abschnittAnzeige.ts): das Repo hat **keine** Render-Tests (`@testing-library` ist nicht installiert), also muss das Entscheidbare daneben liegen, statt eine neue Test-Infrastruktur einzuführen.
- Der QS-Block im `KontextPanel` **entfällt** (eine Anzeige, dort wo die Sätze stehen); das Panel behält Belege/Antragsbezug und startet eingeklappt.
- **Beschränkter Auto-Retry** (`WorkflowStep.autoRetry`/`maxRetries`): generieren → prüfen → bei `fehler` und Versuch < N automatisch mit passendem Modifier neu generieren, sonst STOPP + neutraler Vermerk. Harte Decke N (`normalizeStepRolle` klemmt `[0..3]`, Default 2); **kein** offener Loop, **keine** LLM-Entscheidung über den Ablauf, Transport weg / Abbruch ⇒ sofort STOPP. Richtungssignal aus der Check-Engine ([`CheckResult.richtung`](../../src/core/services/skills/registry/check-engine.ts) `'zu_lang'`/`'zu_kurz'`, von den Größen-Handlern gesetzt) → reine [`chooseRetryModifier`](../../src/plugins/antraege/gutachten/retry-policy.ts) (alle `zu_lang` → `kuerzer`, alle `zu_kurz` → `laenger`, richtungslos/widersprüchlich → `neu`). Bewusst in `retry-policy.ts` statt `runner.ts` (dessen State-Machine explizit keinen Auto-Retry kennt); der Loop mit Zähler lebt in [useGutachtenWorkflow.ts](../../src/plugins/antraege/gutachten/useGutachtenWorkflow.ts) (`runGenerateMitRetry`).
- **Kurations-UI** ([WorkflowEditor.tsx](../../src/plugins/skill-verwaltung-kuration/WorkflowEditor.tsx)): Rolle-Select, `qsZielStepId`-Dropdown (nur Generierungs-Schritte), Auto-Retry-Toggle + `maxRetries`; Normalisierung beim Speichern (`normalizeStepRolle`, eine Quelle). QS-Ausprägungen über die Regeln/Dimensionen des `qs-basis`-Skills (kein neues Vererbungssystem).

## Tests

- `src/core/services/skills/run/__tests__/` — `parse-skill-output.test.ts`, `compose-prompt.test.ts` (inkl. QS-Slot-Byte-Identität), `run-skill.test.ts`; `registry/__tests__/` — `check-engine.test.ts` (inkl. Abkürzungs-Fälle + `richtung`), `registry.test.ts`, `seed-merge.test.ts`, `workflows.test.ts` (inkl. `normalizeStepRolle`/`clampMaxRetries`).
- `src/plugins/antraege/gutachten/__tests__/` — `runner.test.ts` (inkl. `applyQsHinweise` + `applyLektorat`), `qs-parse.test.ts` (toleranter QS-Parser + `QS_DIMENSIONEN`-Drift-Wächter), `retry-policy.test.ts` (`chooseRetryModifier` + Loop-Terminierung), `lektorat.test.ts` (Zahlen-Inventar, Längen-Drift, Kapp-Verdacht), `feinschliff-kette.test.ts` (Degradation bei Tor/Wurf/Abbruch, Verlaufs-Kontrakt), `qs-kriterien.test.ts` (Kriterien-Block, Satz-Referenzen, Abnahme + Invalidierung), `abschnittAnzeige.test.ts` (Pipeline-Status, QS-Badge, Hinweis-Streifen).
- `src/core/services/ai/__tests__/ziel-fallback.test.ts` — genau ein Retry, kein Fallback bei Abbruch / `standard` / wirkungslosem `ziel`.
- `src/core/services/skills/registry/__tests__/qs-kriterien.test.ts` — `qsKriterien` überlebt Normalisierung, Snapshot, Diff, Rollback und Bundle-Rundlauf.
- `src/core/components/__tests__/dokumentAufnahmeFkz.test.ts` — FKZ-Zuordnung (Verbund-/TV-FKZ-Match, `ZEP…`-Fall, ambig).
- `src/core/services/gutachten-vorlagen/__tests__/fill-template.test.ts` — Run-Splitting, `&amp;`-Form, XML-Escaping, Anker vorhanden/fehlend.
- Lokale Test-Vorlage (DOCX mit Platzhaltern + Anker, dev-only Helfer): `_design/handoff/gutachten-kurzfassung/make-test-vorlage.mjs`.

---

## CLAUDE.md-Pitfalls (Detail)

### Pitfall #29 — Verbund-Ebene, Relation über `kv`-Tag — kein CSV-Write

Ein Gutachten / eine Kurzfassung gilt pro **Verbund** (die Vorhabensbeschreibung existiert nur einmal pro Verbund), NICHT pro Teilvorhaben: die Sektion sitzt in [VerbundDetail.tsx](../../src/plugins/antraege/VerbundDetail.tsx), nicht in `TvDetailBlock`. Persistenz-Key **und** VB-Relations-Tag = die **Verbund-ID** (`verbund.verbund_id`; bei Solo/pseudo das echte Aktenzeichen). Aufgenommene Dokumente werden über eine **Tag-Relation** im Dokumente-Store zugeordnet (`doc:*` mit `tags:[<verbund-key>, <typ>]`) — **niemals** in `Antrag.dokumente` (CSV-Record) schreiben: prod-User sind read-only (`NotAllowedError`, vgl. Pitfall #24) und es verletzt die `_field_sources`-Disziplin. Der Kurzfassung-Record liegt im generischen `kv`-Store unter `gutachten-kurzfassung:<key>` — bewusst **kein** dedizierter Object-Store + `version`-Bump (vermeidet das `file://`-`onblocked`-Upgrade bei parallel offenen Varianten, vgl. [recurring-bug-classes.md](recurring-bug-classes.md)). Die FKZ-Erkennung der Aufnahmefläche akzeptiert Verbund-FKZ UND alle TV-FKZ (`knownIds`, Substring-Match — fängt auch `ZEP…`-Verbund-IDs); uneindeutig → der Bearbeiter ordnet manuell zu. Detail in den Abschnitten oben.
