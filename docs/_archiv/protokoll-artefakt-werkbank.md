# Protokoll — Artefakt-Werkbank (NF / RNE / ABL) + Textbaustein-Katalog

Laufendes Arbeitsprotokoll des Mehr-Phasen-Umbaus. Hält fest, **welche Default-Entscheidung
wo getroffen wurde** und **was bewusst verschoben** ist — damit die Nachfolge nicht rät.

Startpunkt: v2.307.0, Branch `master`, Baseline `npm run check` grün.

---

## Ausgangs-Inventur (Read-first, gegen den Klon verifiziert)

Fünf Befunde weichen vom Auftrags-Stand (v2.305.2) ab und haben den Zuschnitt geändert:

| Befund | Konsequenz |
|---|---|
| `MapEinreichung` trägt **kein** FKZ/Aktenzeichen (`map-foerderfaehig/types.ts`) — nur `titel`/`akronym`. Es gibt aber `map-vb:<einreichungId>` → `{docId, zusatz[]}` und `IDBStore.entries(prefix)`. | Verbund↔Einreichung als **Rückwärtssuche** über die VB-Doc-ID. Trägt Phase 1 (Zeitplan-Prädikat), Phase 4 (Punkt-Übernahme), Phase 5 (Konsistenz-Checks). |
| RNE/ABL brauchen **keinen** neuen `VorlagenTyp`: `VorlageDialog` nimmt freie `ArtefaktBlock[]` mit eigenem `anker` + `dateiPrefix`; `ANKER_EP` gilt nur für GA (NF beweist das Muster). | `anchor-mapping.ts` bleibt unangetastet; Phase 5.2 schrumpft auf „anderer Präfix + Anker". |
| `sucheNfBausteine` ist **rein** über das Modul-globale `NF_BAUSTEINE`; der Katalog-Service lädt async. | Der geteilte Suchkern bleibt rein und bekommt den Katalog als **Argument** — kein `async` in den MAP-Aufrufpfad. |
| `pausierte-module.ts` ist bewusst **import-frei** (Zyklus-Schutz). | `zeitplanVerfuegbar(hatEinreichungsJson: boolean)` nimmt ein Boolean und ermittelt nichts selbst. |
| `ArtefaktTyp` enthält bereits `'precheck'`; `extractPlatzhalter` ist exportiert. | Kein Typ-Bump; **kein** zweiter Platzhalter-Parser. |

---

## Arbeitsmodus

- Gate je Phase: `npm run check` grün, danach `npm run build:dev` + `npm run build:pl`.
- **Visuelle Abnahme liegt beim Nutzer** (die App braucht SMB-Onboarding unter `file://`,
  Screenshots sind aus der Entwicklungs-Session nicht erzeugbar). Je Phase steht unten eine
  Abnahme-Checkliste; offene Abnahmen bleiben markiert, bis der Nutzer sie bestätigt.
- **STOPP-R** vor jedem Schreibvorgang in `_intern/skills/registry.json` oder
  `_intern/skills/textbausteine.json` — Diff zeigen, Freigabe abwarten.

---

## Phase 0 — Baseline

- `npm run check` auf unverändertem v2.307.0: **grün** (Typecheck, Lint, Zyklen, Vitest,
  `build:dev`).
- Protokollblock angelegt (diese Datei).

**Default-Entscheidungen:** keine.
**Offene Punkte:** keine.

---

## Phase 1 — Ehrliche Gates: Fragen, Abdeckung, Zeitplan (v2.308.0)

**Default-Entscheidungen**

1. **Zeitplan wird nicht nur freigeschaltet, sondern umgestellt.** Ein Gate, das den Tab
   öffnet und darin weiter die PDF-geernteten Zeilen zeigt, hätte genau das ausgeliefert,
   was die Pause verhindern soll. Liegt eine Einreichungs-JSON vor, zeigt der Tab
   **ausschliesslich** die JSON-Zeilen (`EinreichungsPlan.tsx`), sonst bleibt er gesperrt.
2. **Der `aspekte`-Baustein läuft weiter**, obwohl sein Tab gesperrt ist — er füllt Caches
   und den Kontext anderer Bausteine. Un-Pausieren bleibt dadurch eine reine
   Anzeige-Änderung ohne Neuberechnung. Im Stepper trägt der Schritt statt des
   „Tab öffnen"-Links den Pausen-Grund.
3. **Keine `maNr` im JSON-Zeitplan.** Die Einsatzplanung führt je Arbeitspaket mehrere
   Personen, `ApZeile` trägt eine. Eine willkürlich gewählte erste Person wäre schlechter
   als der (bereits vorhandene) deaktivierte „Nach Person"-Umschalter.
4. **Nur Typ-Importe aus dem MAP-Plugin.** Die Laufzeit-Import-Richtung bleibt
   map → antraege; `map-verknuepfung.ts` liest ausschliesslich `kv`-Keys. `datumAbsolut`/
   `monatslaenge` wurden aus `tabellen.ts` exportiert statt nachgebaut — die
   Positions-Herleitung bleibt dadurch single-source mit `normalisiereAnlage5`.
5. **Bestehende Gating-Tests auf `zahlen`/`glossar` umgestellt.** `abdeckung` ist jetzt
   pausiert und hätte die Lauf-Gating-Aussagen überdeckt; die Logik wird weiter geprüft,
   nur über einen nicht pausierten gebundenen Tab.

**Gate:** `npm run check` grün (413 Test-Dateien, 4671 Tests, 0 Zyklen), `build:dev` +
`build:pl` grün.

**Abnahme-Checkliste (offen, beim Nutzer)**
- [ ] Aufbereitung öffnen: **Fragen** und **Abdeckung** ausgegraut mit Hinweis-Tooltip.
- [ ] **Zeitplan** ohne zugeordnete MAP-Einreichung weiter gesperrt (Hinweistext unverändert).
- [ ] Mit zugeordneter Einreichung: Zeitplan klickbar, zeigt Gantt + Kennzahlen aus der
      JSON, Quelle namentlich benannt, keine Plausibilitäts-Sektion.
- [ ] Übersicht: Aspekte-Schritt ohne „Tab öffnen", dafür mit Pausen-Grund; Block 3 nennt
      Zeitplan- und Fragen-Pause.
- [ ] Übrige Tabs unverändert nutzbar.

**Verschoben**
- Die Einsatzplanung (Personen je Arbeitspaket) bleibt ungenutzt — Kandidat für eine
  spätere „Nach Person"-Ansicht aus der JSON.
- Ein Verbund mit mehreren TV bekommt aktuell den Plan **einer** Einreichung; die
  TV-Aufteilung aus JSON-Quellen ist nicht abgebildet.

---

## Phase 2 — Textbaustein-Katalog (v2.309.0)

**Default-Entscheidungen**

1. **Eigene Sidecar `_intern/skills/textbausteine.json`** neben der Registry (nicht in ihr).
   STOPP-R **freigegeben** (Erst-Nutzlast 78 Bausteine, ~109 KB, Rechtstext byte-identisch
   zum Seed). Erst-Write **beim ersten Speichern** — `loadTextbausteinKatalog` füllt nur den
   IDB-Cache, `writeTextbausteinKatalog` hat in dieser Phase noch keinen Aufrufer.
2. **Migrierte NF-Bausteine starten `freigegeben`**, nicht `entwurf` — sie sind seit v2.283
   im Einsatz und wären als Entwurf über Nacht aus jeder NF verschwunden. Neue Bausteine
   (Phase 3) starten dagegen immer als `entwurf`.
3. **`platzhalter` wird nie aus der Datei übernommen**, sondern immer aus `text` abgeleitet —
   der verbatim-Text ist die einzige Quelle (Pitfall #34). Das gilt auch beim Laden, nicht
   nur beim Bearbeiten.
4. **`kategorie` ins Modell aufgenommen** (im Prompt nicht vorgesehen, aber der Slot-Input
   `formatBausteinKatalog` trägt sie in der Baustein-Überschrift — ohne sie sähe der Katalog,
   den das Modell liest, anders aus als vor dem Umbau).
5. **Suchkern geteilt, MAP-Aufrufer bleiben auf dem Seed.** `bewerteBausteine` ist die eine
   Quelle; `nf-suche.ts` ist jetzt eine Schale darum, liest aber weiter `NF_BAUSTEINE` (die
   MAP-Aufrufer sind rein/synchron, der Katalog lädt async). Solange beide Stände identisch
   sind, folgenlos — Paritäts-Test grün (47 Tests).
6. **Rollback rollt den Status NICHT mit zurück** — ob ein Baustein freigegeben ist, gilt dem
   heutigen Stand, nicht dem alten Text.
7. **`katalogRef` am `WorkflowRun`** additiv-optional (Muster `vorlageRef`, kein Schema-Bump);
   NF stempelt Stand + verwendete Baustein-Fassungen.

**Gate:** `npm run check` grün (414 Test-Dateien, 4697 Tests, 0 Zyklen), `build:dev` + `build:pl`.

**Abnahme-Checkliste (offen, beim Nutzer — greift erst mit Phase 3 sichtbar)**
- [ ] NF-Generierung nutzt weiter die 78 Bausteine (nichts fehlt, nichts umformuliert).
- [ ] Erzeugte NF-`WorkflowRun`s tragen `katalogRef` mit Stand + Baustein-Versionen.

**Verschoben**
- MAP-Aufrufer (`markdown.ts`, `nf-praezision.ts`) auf den kuratierten Katalog umstellen —
  gehört in dieselbe Phase wie die Bearbeitbarkeit dort, braucht einen async-fähigen Aufrufpfad.

---

## Phase 3 — Verwaltungs-Tab + Word-Import (v2.310.0)

**Default-Entscheidungen**

1. **Tab selbst-verwaltend**, nicht in die Skill-`DetailZustand`-Union eingehängt. Der
   Katalog hat eigene Sidecar, Persistenz und Lebenszyklus — er teilt mit Skills/Regeln nur
   die Seite. Hält `SkillVerwaltungPage.tsx` klein (Diff: TabId + tabDef + eine Render-Zeile).
2. **Text im Editor editierbar** (der Kurator pflegt den Wortlaut). Die Verbatim-Regel
   (#34) bindet LLM-Pfad + Import, nicht die Kuration; im **Import** ist der Text read-only.
3. **`useTextbausteinKatalog` seedet NICHT beim Öffnen** (anders als `useSkillRegistry`) —
   deckt sich mit der STOPP-R-Entscheidung „Erst-Write erst beim Speichern".
4. **Word-Import via mammoth** (bereits im Bundle, statischer Import wie `converter/index.ts`
   — kein dynamisches `import()` unter file://, Pitfall #1). Heuristik rein/testbar
   (`htmlZuBloecke`/`bausteinKandidatAus`); der mammoth-Aufruf ist ein dünner Mantel.
5. **`diffLines` aus `registry/versioning.ts` exportiert** und für den Baustein-Text-Diff
   wiederverwendet — eine Diff-Implementierung, nicht zwei.
6. **`PRUEF_ASPEKTE` aus dem Aufbereitungs-Barrel** importiert (kein core→plugin: die
   Aspekt-Validierung bleibt in der UI-Schicht, der core-Service akzeptiert `string[]`).
   Kein neuer Zyklus (Wächter grün).
7. **e2e-Word-Test ruft mammoth direkt mit Node-Buffer** (Vitest=node, dort `{ buffer }`);
   der App-Wrapper nutzt bewusst `{ arrayBuffer }` (Browser) und wird nicht node-getestet.
8. **Doc-Diät-Ceiling** 47_900 → 48_300 (CLAUDE.md-Decision-Tree-Zeile, sanktioniertes
   Wachstum).

**Gate:** `npm run check` grün (417 Test-Dateien, 4716 Tests, 0 Zyklen), `build:dev` + `build:pl`.

**Abnahme-Checkliste (offen, beim Nutzer)**
- [ ] Skill-Verwaltung → Reiter „Textbausteine": 78 migrierte NF-Bausteine sichtbar, alle
      `freigegeben`; Filter (Typ/Status/Aspekt/Suche) greifen.
- [ ] Editor: Text ändern → Speichern erzeugt neue Version + Historien-Eintrag mit Diff.
- [ ] Freigeben/Stilllegen verlangt eine Begründung und erzeugt einen Snapshot.
- [ ] „Aus Word importieren": Kandidaten erscheinen, Text read-only, Übernahme erzeugt nur
      Entwürfe; ID-Kollision landet als neue Version.
- [ ] Tab in dev + pl + kurator sichtbar; ohne Schreibrecht nur lesbar.
- [ ] Erste Speicherung legt `_intern/skills/textbausteine.json` auf dem Share an.

---

## Phase 4 — Werkbank NF (v2.311.0)

**Default-Entscheidungen**

1. **Flag `artefaktWerkbank`** (dev `true`, sonst false). Aktiv ⇒ `WerkbankSection` ersetzt
   `NachforderungenSection` in `VerbundDetail.tsx`; Flag aus ⇒ byte-identisch zu heute (die
   NF-Section bleibt unverändert erreichbar). **pl-Aktivierung nach Pilot = die Zeile in
   `configs/pl.config.json` von `false` auf `true` (Ein-Zeilen-Change).**
2. **Reuse statt Fork:** `useNachforderungen.generiere(auftrag?)` ist der gemeinsame Kern.
   Ohne `auftrag` voller Katalog + freie LLM-Wahl (unverändert); mit `auftrag` die bestätigte
   Werkbank-Auswahl — das LLM füllt nur Platzhalter. Zweiter Pfad vermieden (Anti-Pattern).
3. **Punkte rein IDB-lokal** (`werkbank-punkte:<az>`, kein Share/Mirror) — es ist der offene
   Arbeitsvorrat EINES Prüfers, nicht team-weit geteilte Daten.
4. **TV-Zuordnung der bestätigten Bausteine:** G-Bausteine einmal am Verbund (wie NF), die
   bestätigten T-Bausteine gehen an JEDES TV (der Mensch bestätigt am Verbund, nicht pro TV).
   Bewusste Vereinfachung des Demonstrators — im Protokoll als Grenze vermerkt.
5. **`quelle: 'map-kriterium'`/`'rechencheck'`/`'aufbereitung'`** sind im Modell vorhanden, aber
   nur `'manuell'` ist in Phase 4 aktiv. MAP-/Rechencheck-Übernahme = Folgearbeit (hängt an
   derselben Phase-1-Rückwärtssuche); die Werkbank funktioniert mit manuellen Punkten voll.
6. **Fundstellen-Assist-Skill (Plan-Punkt 4.2) verschoben:** die manuelle Erfassung + die
   deterministischen Vorschläge tragen den Durchstich; der optionale KI-Fundstellen-Vorschlag
   (Seed `aktiv:false` + STOPP-R) folgt zusammen mit dem Phase-6-Assist (gleicher Skill-Ansatz),
   um nicht zweimal denselben Seed zu schreiben.
7. **Leaf-Extraktion `aspekt-katalog.ts`:** der Prüfaspekt-Katalog wurde aus `aspekte.ts`
   (zieht pdfjs/Transport-Kette) in ein dep-freies Leaf gelöst, sonst schleppt jeder
   Katalog-Konsument den ganzen Aufbereitungs-Stack in den Modulgraphen (Node-Tests scheitern
   am pdfjs-Worker). `aspekte.ts` + Barrel re-exportieren; eine Quelle bleibt.

**Gate:** `npm run check` grün (418 Test-Dateien, 4726 Tests, 0 Zyklen), `build:dev` + `build:pl`.
Feature-Flag-Baseline 34 → 35, `no-raw-async-onclick`/Zyklen grün.

**Abnahme-Checkliste (offen, beim Nutzer)**
- [ ] Verbund-Detail: Sektion „Artefakt-Werkbank" statt „Nachforderungen" (dev); ohne VB die
      Aufnahme-Fläche.
- [ ] Punkt erfassen (Text + Aspekt) → erscheint in der Aspekt-Gruppe; „alle wählen" greift.
- [ ] Punkt ankreuzen → Baustein-Vorschläge mit Treffer-Begründung; bestätigen/entfernen;
      kein Treffer ⇒ TODO-Markierung.
- [ ] „Entwurf erzeugen" → je TV ein NF-Entwurf (bestehende Karten + Export/mailto); ≤ 4 Schritte.
- [ ] RNE/ABL im Schalter deaktiviert mit Hinweis.
- [ ] Flag aus (prod-artige Config) ⇒ alte `NachforderungenSection` unverändert.

**Verschoben** (siehe Defaults 5/6): MAP-/Rechencheck-Punkt-Übernahme; Fundstellen-Assist-Skill
(mit Phase 6); TV-genaue Baustein-Zuordnung.

---

## Phase 5 — RNE + ABL (v2.314.0)

*(Hinweis: v2.312.0 kam von einer Parallel-Session, CSV-Schema-Wipe-Fix — nicht Teil dieses Laufs.)*

**STOPP-R freigegeben:** vier neue Registry-Seeds (Skills `zim-rne-fueller`/`zim-abl-fueller`
`aktiv:false`, WorkflowDefs `zim-rne`/`zim-abl` `freigabe:entwurf`); Diff 7483 Bytes, gemerged beim
nächsten Kurator-Öffnen. Freigegeben durch den Nutzer.

**Default-Entscheidungen**

1. **Reuse ohne Fork:** `useNachforderungen.generiere(auftrag?)` löst den Skill je Bescheid-Typ auf
   (`SKILL_ID_BY_TYP`); der Flag-aus-NF-Pfad bleibt byte-identisch. Eine Tabelle `artefakt-typ.ts`
   hält Skill/Dateiname/Anker/Label zusammen — kein verstreutes `=== 'rne'`.
2. **Kein neuer `VorlagenTyp`** (Read-first-Befund): `VorlageDialog` nimmt freien Anker + `dateiPrefix`;
   `anchor-mapping.ts` (GA A–G) unberührt.
3. **Bescheid-Skills reusen die NF-Tore** (`nf-keine-platzhalter`/`nf-keine-meta`) — kein zweiter
   Platzhalter-Parser, keine eigenen Regel-Records (Regel-Zahl bleibt 10).
4. **Neue Skill-Kategorie `bescheid`** (id-Präfix `zim-rne`/`zim-abl`) — sonst landeten die Skills in
   „Sonstige" (Guard `skill-kategorien`).
5. **Konsistenz-Checks über die Phase-1-Rückwärtssuche** (`map-pruefung:*` lose gelesen,
   `map-bewertung.ts`): Aspekt-Grund vs. gute MAP-Bewertung (B2/B3) ⇒ Warnung; keine Bewertung ⇒
   ehrlicher „übersprungen"-Hinweis. Die Ziel-Heuristik („fehlende messbare Ziele" trotz quantifizierter
   Zielkriterien) ist bewusst NICHT umgesetzt — sie braucht die MAP-Substanz-Analyse; der Tor ist
   erweiterbar, das „u. a." des Auftrags erlaubt die Teilmenge (dokumentiert statt still).
6. **TODO blockiert bei RNE/ABL** die Generierung (Bescheid braucht je Punkt eine tragende Begründung);
   bei NF bleibt TODO erlaubt (→ `[TODO]`-Markierung).
7. **Pflicht-Checkbox + Warnungs-Quittierung** gaten den DOCX-Export je Bescheid-Entwurf
   (`BescheidFreigabe.tsx`, reines `bescheidFreigabeTor`).

**Gate:** `npm run check` grün (420 Test-Dateien, 4743 Tests, 0 Zyklen), Typecheck/Lint/Cycles grün;
`build:dev` + `build:pl` grün **mit isolierten Phase-5-Änderungen** (die Parallel-Session hatte ein
kaputtes `snapshot-empty-guard.test.ts` uncommittet im Baum — nicht mein Code, per Stash verifiziert).

**Abnahme-Checkliste (offen, beim Nutzer)**
- [ ] Kurator legt RNE/ABL-Bausteine im Katalog an + gibt sie frei (ohne sie hat die Werkbank leere Vorschläge).
- [ ] Werkbank-Schalter RNE/ABL erzeugt einen Bescheid-Entwurf über die NF-Maschine.
- [ ] TODO blockiert die Generierung bei RNE/ABL; Konsistenz-Warnungen einzeln quittierbar; ohne
      MAP-Bewertung erscheint der „übersprungen"-Hinweis; Export erst nach Pflicht-Checkbox.
- [ ] Export nutzt die richtige Vorlage (`ZIM-Ruecknahmeempfehlung`/`ZIM-Ablehnung`, Anker „Tragende Gründe").

**Verschoben:** Ziel-Heuristik im Konsistenz-Tor (braucht MAP-Substanz); scharfe Aktivierung der Seeds.

---

## Phase 6 — Widerspruch/Stellungnahme (v2.315.0)

**Default-Entscheidungen**

1. **Tragende Gründe aus der Provenienz** (Phase-5-Stempel `WorkflowRun.werkbankPunkte`) + dem
   Werkbank-Punkte-Store aufgelöst — keine neue Persistenz der Grund-Texte; ein gelöschter Punkt fällt
   auf einen Roh-Key-Platzhalter zurück (nichts verschwindet still).
2. **Sektion nur bei RNE/ABL-Run** (`WiderspruchSection` → `null` sonst); NF löst keine aus.
   Überschrift per Typ-Label (kein Roh-Status-Vergleich, Pitfall #12 n/a).
3. **„Antwort vorbereiten" über einen gelifteten `vorbelegung`-State** in `VerbundDetail` (nonce-getriggert,
   damit erneuter Klick erneut greift) + Scroll zur Werkbank. Die Werkbank bekam eine additive
   `vorbelegung`-Prop; ohne sie unverändert.
4. **Abgleich rein IDB-lokal** (`widerspruch:<az>`), wie die Werkbank-Punkte — Arbeitsstand eines Prüfers.
5. **Antwort-Tor = Reuse der Begründungs-Vollständigkeit** (jeder offene Grund muss adressiert sein);
   `ausgeraeumt` fällt aus den offenen heraus.

**Vorfall (Parallel-Session):** eine parallele Session hat mit `git stash` mitten in meinem Phase-6-Bau
kurz alle uncommitteten Dateien beiseitegelegt (Working Tree sah leer aus). Die 5 neuen `widerspruch/`-
Dateien waren untracked und lagen im Untracked-Teil des Stash — byte-exakt aus dem dangling Tree-Objekt
zurückgeholt (`git cat-file -p <tree>:<pfad>`); die zwei getrackten Edits kamen mit dem Stash-Pop zurück.
Lehre: neue Phase-Dateien früher committen, wenn eine Parallel-Session aktiv stasht.

**Gate:** `npm run check` grün (421 Test-Dateien, 4752 Tests, 0 Zyklen), `build:dev` grün.

**Abnahme-Checkliste (offen, beim Nutzer)**
- [ ] Nach einem RNE/ABL-Entwurf erscheint die Widerspruchs-/Stellungnahme-Sektion; ohne Bescheid nicht.
- [ ] Drei Zustände + Notiz je tragendem Grund, persistiert.
- [ ] Stellungnahme-PDF ablegbar, Text rechts sichtbar.
- [ ] „Antwort in der Werkbank vorbereiten" kreuzt die offenen Gründe in der Werkbank an + scrollt hin.

---

## Abschluss

Alle sechs Phasen umgesetzt (v2.308.0 → v2.315.0). Offene Punkte team-weit: die `file://`-Abnahmen je
Phase (Checklisten oben), das Anlegen von RNE/ABL-Bausteinen im Katalog durch Kuratoren, und die
verschobenen Andockpunkte (MAP-/Rechencheck-Punkt-Übernahme, Fundstellen-Assist-Skill, Ziel-Heuristik
im Konsistenz-Tor, TV-genaue Baustein-Zuordnung, scharfe Seed-Aktivierung).
