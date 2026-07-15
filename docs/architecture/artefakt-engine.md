# Artefakt-Engine (Substrat + NF + GA-QS)

Die Gutachten-Maschine ist zu einem generischen **Artefakt-Substrat** verallgemeinert: eine Achse
„Artefakt-Typ" trennt sich von der amtlichen Status-Wirbelsäule. Darauf laufen heute zwei Artefakte —
**GA** (ZIM-Gutachten A–G, Bestand) und **NF** (ZIM-Nachforderungen, dev-Testballon) — über denselben
Skill-Runner, dieselbe Run-Persistenz und denselben DOCX-Füller. Eingeführt mit v2.108.0, additiv,
**GA byte-identisch**, kein neuer IDB-Object-Store.

## Zwei Achsen

- **Amtlicher Status** (Precheck/NF/Gutachten/QS) — unberührt.
- **Artefakt-Achse** — `WorkflowDef.artefaktTyp` (`'ga'|'nf'|'abl'|'rne'`, Default `'ga'`) +
  `WorkflowDef.ebene` (`'verbund'|'tv'`, Default `'verbund'`). `QualitaetsRegel.pruefart`
  (`'textlich'|'fachlich'|'administrativ'`, Default `'textlich'`) klassifiziert, WIE eine QS-Regel läuft.
  Alle drei additiv + normalize-tolerant ([types.ts](../../src/core/services/skills/registry/types.ts));
  Default-Resolver `artefaktTypOf`/`ebeneOf`/`pruefartOf` in
  [selectors.ts](../../src/core/services/skills/registry/selectors.ts) (fehlendes Feld → Default).

## Run-Keying je (Typ, Scope) + GA-Migration

[workflow-store.ts](../../src/plugins/antraege/gutachten/workflow-store.ts): ein `WorkflowRun` je
(Artefakt-Typ, Scope) im `kv`-Store unter `workflow-run:<typ>:<scopeId>`. `typ` defaultet `'ga'` →
bestehende GA-Aufrufer unverändert. **Migration**: Pre-Engine-GA-Runs lagen unter dem Alt-Key
`gutachten-workflow:<az>`; `getWorkflowRun` liest ihn weiter und promotet ihn lazy auf den neuen Key
(verlustfrei, GA byte-identisch). NF (`ebene:'tv'`) ist mit Scope = TV-Aktenzeichen disjunkt gekeyt.

Personal-Mirror je Typ disjunkt ([personal-layout.ts](../../src/core/services/personal-storage/personal-layout.ts)):
`ga`→`…/gutachten/workflow-run.json` (byte-identisch), `nf`→`…/nachforderungen/workflow-run.json`. Der
Cold-Start-Backup-Sweep ([gutachten-backup.ts](../../src/core/services/personal-storage/gutachten-backup.ts))
spiegelt beide Key-Formate (neu `workflow-run:` + Alt-`gutachten-workflow:`).

## Vorlage als Ground-Truth + Audit + generische Füllung

[fill-template.ts](../../src/core/services/gutachten-vorlagen/fill-template.ts): die Vorlage wird **frisch**
gelesen (nie gecacht) und mit einem SHA-256-Stempel (`FillResult.hash`) versehen → in
`WorkflowRun.vorlageRef` (`{ pfad, hash, gelesenAm }`) gestempelt (Audit/Reproduzierbarkeit). `fillTemplate`/
`processDocumentXml` nehmen generische `ArtefaktBlock[]` (Abschnitt ODER Baustein, offene `id`). Dateiname
je Typ über `opts.dateiPrefix` (Default `Gutachten_EP` → GA byte-identisch). Fehlende/kaputte Vorlage →
`FillResult.fehler` statt Throw (Aufrufer degradiert).

## NF — ZIM-Nachforderungen (dev-Flag `nfNachforderungen`)

- **Baustein-Katalog** ([nf-bausteine.seed.ts](../../src/core/services/skills/registry/nf-bausteine.seed.ts)):
  72 Bausteine **wortgetreu** als kuratierte App-Daten (Quelle der Wahrheit; nicht aus Word-Dateien).
  `scope` aus dem ID-Präfix (`G…`→verbund, `T…`→tv); Platzhalter (`fill`/`choose`/`optional`/`wert`)
  deterministisch via `extractPlatzhalter` abgeleitet (verbatim-Text = einzige Quelle).
- **Skill + WorkflowDef** ([nf-skill.seed.ts](../../src/core/services/skills/registry/nf-skill.seed.ts)):
  Auswahl/Füll-Skill (erkannte Lücke → Baustein wählen → Platzhalter füllen / Alternative wählen —
  **wortgetreu**, Rechtstext nie umformuliert; **keine** Konversations-/Befehls-/Freigabe-Schicht — die
  liefert der Runner). `WorkflowDef` `zim-nf` (`artefaktTyp:'nf'`, `ebene:'tv'`, **Draft** `aktiv:false`).
  Neue Slots `{{nfBausteine}}`/`{{tvKontext}}`/`{{verbundKontext}}` in `INHALTS_SLOTS`
  ([transport-policy.ts](../../src/core/services/ai/transport-policy.ts)) → dokument-tragend → intern
  (Pitfall #30; NF-Hook zieht den Transport über `getTransportForSkillRun`).
- **QS + Merge + Ausgabe** ([nachforderungen/](../../src/plugins/antraege/nachforderungen/)):
  NF-QS-Regelsatz mit `pruefart` — administrativ (`nf_keine_platzhalter_reste`: **kein ungefüllter
  Platzhalter passiert das Tor**, reuse `extractPlatzhalter`), textlich (keine Befehls-/Meta-Reste),
  fachlich (Baustein-Passung, LLM-QS). **Verbund-Merge**: `G…`-Bausteine **einmal** am Verbund-Kontext
  gefüllt, wortgleich in **jede** TV-NF eingefügt; `T…`-Bausteine TV-spezifisch. **Pro TV**: gefülltes
  DOCX (generische Füllung) + **E-Mail-Entwurf** (mailto, `buildMailtoUrl`). `n` TV → `n` Entwürfe.
  **Entwurf ≠ Entscheidung**: es wird nichts versendet; der Mensch öffnet/prüft/sendet.
- **UI**: schlanke `NachforderungenSection` auf der Verbund-Detailseite (eigene Sektion neben Gutachten),
  gegated `isNfNachforderungenEnabled()`. Kein neues Plugin/Routing.

## GA-QS (aus QS v2)

[ga-qs.seed.ts](../../src/core/services/skills/registry/ga-qs.seed.ts): die 5 Prüfabschnitte als
`QualitaetsRegel` mit `pruefart` (Vollständigkeit→administrativ; Quellenabgleich/Konsistenz→fachlich/
LLM-QS; Formalia→textlich/deterministischer Muster-Check; Finales Review→administrativ), gebunden an
`artefaktTyp='ga'` über `qsRegelnFuerArtefakt('ga')`. Die **Abschnittszuordnung** (intern A–G ↔
tatsächliche Gutachten-Überschriften, inkl. der abweichenden `6.x`-Überschriften) ist übernommen, damit
die Vollständigkeits-QS keine Phantom-Lücken meldet. GA-Skill-Abgleich gegen das Referenz-Prompt:
3-teilige B-Struktur + 750-Wörter-Selbstprüfung + L=+50%-Modifier bestätigt vorhanden, **Stilbeispiele**
in A/C/G additiv ergänzt (klar als Schreibstil markiert) — GA-Verhalten unverändert.

## QS-Regel-Bindung je Artefakt

`qsRegelnFuerArtefakt(file, typ)` ([selectors.ts](../../src/core/services/skills/registry/selectors.ts)):
- `'ga'` → der dedizierte GA-QS-Dimensionssatz (per ID).
- sonst (`'nf'` …) → die `regelIds` der Skills des Artefakt-Workflows (NF: der NF-Skill trägt die NF-QS-Regeln).

## Grenzen / nicht im Scope

ABL/RNE-Artefakte (späterer Prompt); produktive (scharfe) Aktivierung der NF-Seeds (bleiben Draft);
automatischer Versand (Mensch versendet). Generalisierungs-Notizen + der Gutachten-Testballon-Ursprung:
[gutachten-kurzfassung.md](gutachten-kurzfassung.md).

## Kategorie-Modell + Journey-Paket 3/4 (Regel→Korrektur, Belege↔Satz)

- **Kategorie-Modell** (Einzelquelle [kategorien.ts](../../src/core/services/skills/registry/kategorien.ts)): `effektiveKategorie()` reconciled die Regel-„Art" aus **explizite `kategorie` > `typ`-Map (`TYP_ZU_KATEGORIE`) > `pruefart`-Fallback > `'sonstige'`** — der Default wird NIE in die Registry-Daten geschrieben. Kein zweites typ→kategorie-Mapping (Pitfall #31).
- **Prüfpanel-Kopplung Regel→Korrektur (Journey-Paket 3)**: `regelKorrekturAnweisung(check, regel)` ([korrektur.ts](../../src/core/services/skills/registry/korrektur.ts)) leitet aus einem verletzten `CheckResult` + seiner Regel deterministisch einen **bestehenden** Modifier (`neu`/`kuerzer`/`laenger`) + deutsche Zusatz-Anweisung ab — **`null`** bei `verbotenes_muster` (Stil bleibt beim Gutachter), unbekannten Typen, `pruefart` `fachlich`/`administrativ` und fehlenden Params (nie werfen). **Keine** neuen Modifier-Keys erfinden. Zielwert aus `regel.params` (`regelLimit`), Ist-Wert aus dem additiven `CheckResult.messwert` — **nie** aus `detail`-Strings parsen. Der Modify-Pfad reicht die Anweisung als `SkillRunInput.zusatzAnweisung` durch; `composeSkillPrompt` hängt sie **unmittelbar NACH** dem Modifier-Block als eigene Zeile „Zusätzliche Vorgabe: …" an (verschärft ihn, ersetzt ihn nicht). `StepRun.korrekturRegelId` hält die auslösende Regel fest (nur Anzeige). Lokalisierbare Befunde tragen `CheckResult.fundstellen` (0-basierter `satzIndex` über die **geteilte** `splitSentences`) — das UI-Highlight ([satzSegmente.ts](../../src/plugins/antraege/gutachten/satzSegmente.ts) → [SectionReviewCard.tsx](../../src/plugins/antraege/gutachten/SectionReviewCard.tsx)) nutzt **exakt dieselbe** Funktion, nie im UI nachgebaut. `messwert`/`korrekturRegelId`/`fundstellen`/`zusatzAnweisung` sind alle additiv-optional (kein Schema-Bump, alte Runs bleiben lesbar). Geschichte: CHANGELOG „Journey-Paket 3" (v2.184–v2.187).
- **Quellen-Belege ↔ Satz-Verknüpfung (Journey-Paket 4; Marker-Kontrakt 2026-07 zurückgebaut)**: Der Beleg→Satz-**Marker-Kontrakt** (Zitat-Zeilen mit `→ stützt Satz {n}` abschließen) ist aus den live A/B-Skills **entfernt** — das interne Modell lief damit in einen langen Reasoning-Loop und lieferte keine verwertbare Ausgabe mehr; der Quellenbezug wird jetzt **primär deterministisch** abgeleitet (s. u.). Für Alt-Läufe bleibt der Marker-Pfad erhalten (nie regressiv): `parseSkillOutput` liest additiv `ParsedSkillOutput.belege?: QuellenBeleg[]` (`{zitat, abschnittRef?, satzIndizes}`) aus etwaigen `→ stützt Satz`-Marken — die flache `quellenanalyse` bleibt UNVERÄNDERT (Anzeige-Fallback). **Konvention (überall gültig): Format 1-basiert, `satzIndizes` intern 0-basiert** (aligned zu `data-satz-index` + `CheckResult.fundstellen`), validiert gegen `splitSentences(finalerText).length`; ungültig/außerhalb → `satzIndizes: []` („ohne Zuordnung"); der Parser toleriert nachgestellte Satzzeichen nach der Satznummer (`→ stützt Satz 2.` — die Form aus dem Template-Beispiel) und wirft nie. **Deterministischer Primärpfad** (neue Läufe tragen keine Marken mehr): die UI leitet die Satz↔Zitat-Zuordnung selbst aus Wortüberlappung ab ([belegAbleitung.ts](../../src/plugins/antraege/gutachten/belegAbleitung.ts), rein lexikalisch nach Vorbild `aufbereitung/risiken.ts`, konservative Schwelle → unter Schwelle „ohne Zuordnung"), rendert sie als interaktive Beleg-Karten und kennzeichnet sie sichtbar als „automatisch zugeordnet" (`QuellenBeleg.abgeleitet`, reine Anzeige/`useMemo` in [KontextPanel.tsx](../../src/plugins/antraege/gutachten/KontextPanel.tsx), nicht persistiert → wirkt rückwirkend). Nur ganz ohne extrahierbare Zitate bleibt das flache Rendering; nie regressiv. `StepRun.belege?` überlebt manuelle Text-Bearbeitung (anders als `teile`) — veraltete Indizes degradieren erst beim **Rendern** live über [belege.ts](../../src/plugins/antraege/gutachten/belege.ts) (`belegeFuerSatz`/`belegBetrifftSaetze`/`belegAbdeckung`, **dieselbe** `splitSentences`, nie im UI nachgebaut). UI: Beleg-Karten ([BelegKarten.tsx](../../src/plugins/antraege/gutachten/BelegKarten.tsx)) mit Hover-Highlight (Token `--tf-beleg-highlight`, Light+Dark) + Pin über den **bestehenden** `fundstelle`-Mechanismus (kein zweiter Scroll-Pfad). **Rückbau auf Bestands-Shares**: der ursprüngliche `GA_BELEG_KONTRAKT_MIGRATION`-Rollout ist neutralisiert (No-op); die marker-gesicherte `GA_BELEG_KONTRAKT_REVERT_MIGRATION` ([migrations.ts](../../src/core/services/skills/registry/migrations.ts)) setzt A/B **nur** auf den Vor-Paket-4-Stand zurück, wenn ihr Template exakt dem Kontrakt-Stand gleicht (kuratierte Edits unberührt). Geschichte: CHANGELOG „Journey-Paket 4" (v2.192–v2.194) + Rückbau v2.241.5 + [eval/paket4-eval-report.md](../../eval/paket4-eval-report.md).
