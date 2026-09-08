# CONTEXT.md — Entwickler-Glossar

Nur Begriffe: was ein Wort in diesem Repo bedeutet, was man stattdessen **nicht** sagt, und wo das Detail lebt. Keine Implementierung, kein Spec, kein Scratchpad. Gepflegt vom Skill `grillen` in derselben Runde, in der ein Begriff aufgelöst wird; das nutzerseitige Glossar der App ist [docs/feedback-kontext/glossar.md](docs/feedback-kontext/glossar.md) und etwas anderes. Prozess: [docs/architecture/entwicklungsprozess.md](docs/architecture/entwicklungsprozess.md).

Format je Eintrag: **Begriff** — Bedeutung in einem Satz. *Nicht sagen:* Synonyme oder Fehllesarten. → Quelle.

## Daten und Fachsystem

- **Fachsystem C16** — das führende System, in dem Bearbeiter Vorgangskürzel setzen und Trigger Status ändern; die App liest den nächtlichen CSV-Export und ist Companion, nicht zweite Workflow-Engine; seit v3.23 auch die alleinige Regelquelle. *Nicht sagen:* „die App leitet den Status ab" — `STATUS_TV`/`STATUS_VB` gelten wie importiert. → [vorgangssystem.md](docs/architecture/vorgangssystem.md) §1, §14.7
- **Antrag** — der Teilvorhaben-Datensatz aus dem CSV-Import (Store `ANTRAEGE`), gejoined über das Aktenzeichen; Route `/antraege/:aktenzeichen`. *Nicht sagen:* Antrag ≠ Verbund; das Legacy-Shape `Vorgang` nur noch für die Home-Aggregation. → [csv-import.md](docs/architecture/csv-import.md)
- **Aktenzeichen** — Join-Schlüssel und Route-Id eines Antrags. *Nicht sagen:* Verbund-Nummer oder Akronym als Aktenzeichen. → [csv-import.md](docs/architecture/csv-import.md)
- **Verbund** — Bündelung mehrerer Teilanträge unter einer gemeinsamen Projektbeschreibung, erkannt über Akronym + Teilantragsindex; der Verbund-Record führt nur Titel und Status. *Nicht sagen:* „Projekt" als Datenmodell-Begriff; EP/DL sind bewusst Ein-TV-Verbünde, kein Datenfehler. → [csv-import.md](docs/architecture/csv-import.md) § Verbund-Aggregation, [vorgangssystem.md](docs/architecture/vorgangssystem.md) §14.7
- **Teilvorhaben (TV)** — die auswertende Einheit: Regeln lesen TV-Spalten, To-do, Chronik und Verlauf werden je TV gerechnet und danach zum Verbund gefaltet. *Nicht sagen:* „Teilprojekt". → [vorgangssystem.md](docs/architecture/vorgangssystem.md)
- **Programm / Richtlinie** — derselbe Nummernraum (`FM_NUMMER`, kanonisch `unterprogramm_id`); Trigger sind je Richtlinie geschlüsselt. **Richtlinien-Generation** ist der Maßstab des Betrachtungsbereichs (`RICHTLINIEN_GENERATIONEN`, Seed = die drei jüngsten). *Nicht sagen:* Bereich „nach Trigger-Abdeckung geschnitten". → [vorgangssystem.md](docs/architecture/vorgangssystem.md) §3a, §10
- **Daten-Share** — der SMB-Share mit allen geteilten Daten und Configs (`programm/`, `_intern/`, `backups/`), getrennt vom App-Share mit der HTML; Share = Source of Truth, IndexedDB = Cache. *Nicht sagen:* CSV-Import-Ordner (liegt außerhalb). → [data-layout.md](docs/architecture/data-layout.md)
- **Sidecar** — persistente Datei auf dem Daten-Share neben dem IDB-Cache, geschrieben über `atomicWrite()`, mit bewusst gewähltem Schreibprofil. *Nicht sagen:* Datei unter `programm/` (reserviert für Antrags-Artefakte). → [add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md)
- **List-View (Slim-Projektion)** — die abgeleitete Zweitprojektion `ANTRAEGE_LIST_VIEW`, die Home und Listen lesen; wer `ANTRAEGE` schreibt, zieht sie mit. *Nicht sagen:* „Store-Reload hilft". → [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)

## Status und Kürzel

- **Statuskürzel (Vorgangskürzel)** — ein Code des Fachsystems, dessen Setzung als Spalte im Export flachliegt: `D_<CODE>` Datum, `T_<CODE>` Text; `X` am Codeanfang = Verbund-Ebene. *Nicht sagen:* `D_<code>` als Literal im Code — nur `todoFeld()`. → [KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md)
- **Bearbeiter-Kürzel** — die Personenkennung in den Zuständigkeits-Spalten (`tib_kuerz`/ZTP = FB, `bib_kuerz`/BFM/PFM = AB), gelesen nur über `useMeinKuerzel()`, immer NFC-normalisiert. *Nicht sagen:* „Kürzel" ohne Zusatz, wenn beides gemeint sein könnte (siehe Mehrdeutigkeiten). → [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md), [auslastung.md](docs/architecture/auslastung.md)
- **Kürzel-Zuarbeit** — das Fremddaten-Dokument des Fachsystems, aus dem der Code-Katalog generiert wird; wortgetreu übernommen. *Nicht sagen:* „von Hand pflegen" — unsere Kuration (Ordner, Phase, Rang) lebt getrennt. → [KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md)
- **Rohstatus** — der CSV-Rohwert aus C16 (`beantragt`, `VN geprüft`, …), branded als `AntragStatusRaw`. *Nicht sagen:* Vergleich gegen ein Literal — nur Kategorie-Helfer. → [antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md)
- **Die eine Achse** — Rohtext → amtlicher Code → ZAH-Phase → StatusCategory; Verfahrensschritt und Arbeitsliste führen beide vom Code weg. *Nicht sagen:* „Spine-Phase" (entfallen v2.385), zweite Handtabelle neben dem Code-Katalog. → [status-achsen.md](docs/architecture/status-achsen.md)
- **ZAH-Phase (Verfahrensschritt)** — die Lesebrille der App: kuratierbare Zuordnung Code → Phase (3–9 Phasen), sagt, **wo im Verfahren** der Vorgang steht; leitet nichts ab. *Nicht sagen:* `VB_PHASE` (das ist der Antragstyp NW/FuE/DL/DS). → [vorgangssystem.md](docs/architecture/vorgangssystem.md) §5
- **StatusCategory (Arbeitsliste)** — die feste 9er-Achse im Code („Wer ist am Zug?"), steuert Reiter, Farben, Kanban-Lanes; nicht kuratierbar. *Nicht sagen:* Aggregatnamen („Vor Entscheidung", „Beendet") als Kategoriename; `abgelehnt` ist unbesetzt. → [status-achsen.md](docs/architecture/status-achsen.md)
- **Fassung** — die versionierte Katalog-Fassung (`MappingVersion`): ZAH-Phasen, Code→Phase-Schnitt, Kürzel-Kuration, Zieltage, To-do-Regeln, Betrachtungsbereich; gelöscht wird nichts. *Nicht sagen:* feldweise Mischung beim Veröffentlichen — vereinigt wird nur die Liste. → [docs/status-system/README.md](docs/status-system/README.md)
- **Schnitt** — die Zuordnung Code → ZAH-Phase; entwurfsbezogen über `schnittVon(version)`, modul-global über `geltenderSchnitt`/`phaseFuerCode` (einziger Schreiber `snapshot.ts`). *Nicht sagen:* Snapshot-Lesart in einer Ansicht, die einen Entwurf zeigt (Pitfall #55). → [status-achsen.md](docs/architecture/status-achsen.md)
- **Entwurf** — der im Cockpit bearbeitete, ungespeicherte Katalogstand. *Nicht sagen:* „harmloser Rückfall auf den Snapshot". → [pitfalls.md](docs/architecture/pitfalls.md) #55
- **Zieltage** — eine Zahl je Status-Code, Grundlage des Stillstands-Wächters; misst Stillstand. *Nicht sagen:* mit dem Meilenstein verrechnen — der misst einen Termin ab Eingang. → [status-achsen.md](docs/architecture/status-achsen.md)
- **Bearbeitungs-Meilenstein** — Knoten eines versionierten, freigebbaren Plans mit Sollwoche ab Antragseingang (Anker: spätestes Antragsdatum aller TVs). *Nicht sagen:* Prominenz-Wert `meilenstein` (UI: „Hauptereignis") oder die CSV-Projekt-Meilensteine `MS01_*`. → [meilensteine.md](docs/architecture/meilensteine.md)
- **Betrachtungsbereich** — die Menge der Richtlinien-Generationen, die zum **Arbeitsvorrat** zählen; expliziter Parameter jedes Konsumenten, mit Chip im Seitenkopf. *Nicht sagen:* stiller Filter im Daten-Layer; die Suche bleibt am Vollbestand (**Evidenz**). → [vorgangssystem.md](docs/architecture/vorgangssystem.md) §10
- **Regelsatz** — die Rollen-Spur einer To-do-Regel (fehlend = AB); eine Rolle ohne eigene Regel bekommt einen **abgeleiteten Platzhalter**. *Nicht sagen:* Regelsatz als Vorfilter; `giltFuer` leer heißt „alle". → [vorgangssystem.md](docs/architecture/vorgangssystem.md) §11
- **Journal** — der auf dem Share mitgeführte Stand des letzten Exports plus append-only Monatsdateien mit fünf Aussagen (gesetzt, geändert, geleert, Antrag neu, Antrag fehlt). *Nicht sagen:* gerätelokal; Personen-Achse. → [vorgangssystem.md](docs/architecture/vorgangssystem.md) §12
- **Klärung** — ein Fragebogen mit festen Punkten, den das Team asynchron beantwortet; Weg: Klärung → Export → Seed → Release, nie Rückschreiben in Fassung oder Seed. *Nicht sagen:* Autor = Rolle — Autor ist eine Person. → [klaerung.md](docs/architecture/klaerung.md)

## Sichtbarkeit, Rollen, Varianten

- **Variante** — ein pro Einsatz-Kontext gebauter Build: `dev` (alles + OpenRouter), `pl` (voller Fach-Stack), `prod` (End-User); `local` wird nie gebaut. *Nicht sagen:* `as`, `kurator` — seit v3.0 Freischaltungen, keine Varianten. → [build-varianten.md](docs/architecture/build-varianten.md)
- **Flag** — Bauzeit-Schalter `features.<modul>`, einkompiliert; beantwortet nicht „darf gesehen werden". *Nicht sagen:* Flag lesen, wo Freischaltung gemeint ist. → [modul-freischaltung.md](docs/architecture/modul-freischaltung.md)
- **Freischaltung** — Laufzeit-Öffnung eines Moduls per Zusatzpasswort, 12 h in der Browser-Sitzung; vorhandener Slot = gesperrt, fehlender Slot = offen. *Nicht sagen:* Verschlüsselung — es ist eine Sichtbarkeitssperre. → [modul-freischaltung.md](docs/architecture/modul-freischaltung.md)
- **Beta / Experte** — die vierte Sichtbarkeits-Achse („will ich das sehen?"): zwei UND-verknüpfte Marken mit Schalter im Profil; schützt nichts. *Nicht sagen:* „Stufe"; Ableitung aus `category: 'erprobung'`; Doppelmarke neben einer gleich engen Sperre. → [sichtbarkeitsstufen.md](docs/architecture/sichtbarkeitsstufen.md)
- **`kuratorOnly`** — Plugin-Manifest-Flag für die Kurator-Rolle. *Nicht sagen:* zusammen mit `beta`/`experte` am selben Wirt. → [sichtbarkeitsstufen.md](docs/architecture/sichtbarkeitsstufen.md)
- **Die vier Achsen** — Flag · Freischaltung · Beta/Experte · `kuratorOnly`; ein Feature ist sichtbar, wenn alle vier es zulassen. Abnahme mit ausgeschaltetem Beta-Schalter. → [sichtbarkeitsstufen.md](docs/architecture/sichtbarkeitsstufen.md), Pitfall #54
- **Kurator** — App-Rolle mit Schreibrecht auf dem Daten-Share und Zugriff auf die Kuration; 12-h-Session plus Profil-Flagge. *Nicht sagen:* Gate-Session = Kurator-Session. → [infrastructure-layer.md](docs/architecture/infrastructure-layer.md)
- **PL (Projektleitung)** — die Rolle, die Fassungen kuratiert und persönliche Ordner einsammelt. *Nicht sagen:* PL = Fachrolle (AB/FB/QS/PA/Juristen). → [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md)

## Artefakte und App-Skills

- **App-Skill** — kuratierte **Daten** (`SkillRecord`: Prompt-Vorlage, Modifier, Regeln, Slots), ausgeführt vom transport-agnostischen Runner `runSkill`. *Nicht sagen:* Funktion mit eigener Parse-Logik; nicht mit dem Claude-Code-Skill verwechseln (siehe Mehrdeutigkeiten). → [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md)
- **Skill-Vorgabe** — Umfang & Form **eines** Skills, zur Laufzeit als synthetische Regel materialisiert. *Nicht sagen:* Bibliotheks-Regel (mehrfach genutzt) oder persönliche Ebene (`SkillTweak`, nur Zahlen). → [skill-vorgaben.md](docs/architecture/skill-vorgaben.md)
- **Artefakt** — die Achse `artefaktTyp` (`ga`/`nf`/`abl`/`rne`), orthogonal zum amtlichen Status; ein Run ist je (Typ, Scope) gekeyt. *Nicht sagen:* Artefakt als Statuswert. → [artefakt-engine.md](docs/architecture/artefakt-engine.md)
- **Prüfart** — wie eine QS-Regel läuft: `textlich` (deterministisch), `fachlich` (LLM), `administrativ`. *Nicht sagen:* Prüfart = Kategorie (die kommt nur aus `effektiveKategorie()`). → [artefakt-engine.md](docs/architecture/artefakt-engine.md)

## Entwicklungsprozess

- **Gate** — die gestufte Prüfung vor dem Commit: `check:docs` → `check:quick` → `check`; der Bundle-Nachweis ist `build:devpl` mit Exit-Code. *Nicht sagen:* „gestarteter Build" als Beleg. → [CLAUDE.md](CLAUDE.md) § Entwicklungs-Gate
- **Abnahme** — jede sichtbare Änderung selbst in der Variante `local` ansehen, gerenderte Zeichenkette und `window.__tf.fehler()` = 0. *Nicht sagen:* „bitte manuell prüfen". → [CLAUDE.md](CLAUDE.md) § Abnahme
- **Guard** — ein Convention-Test unter `src/__tests__/`, der eine Regel maschinell erzwingt; Ausnahme nur inline `// allow-<rule>: <grund>`; jeder neue Guard wurde einmal rot gesehen. → [pitfalls.md](docs/architecture/pitfalls.md)
- **Pitfall** — nummerierte, append-only Ein-Satz-Regel mit Link ins Themen-Doc; mit Guard in `pitfalls.md`, ohne Guard in CLAUDE.md. → [CLAUDE.md](CLAUDE.md) § Common Pitfalls
- **Cheatsheet** — Touch-Point-Checkliste unter `docs/agents/` für Erweiterungen mit mehreren synchronen Stellen; die acht riskantesten haben einen **Zeiger-Skill**, der sie auto-lädt. → [docs/agents/README.md](docs/agents/README.md)
- **Anlass / Spec / Plan** — die leichte Artefakt-Kette: `## 0. Anlass` in den Worten des Auslösers, Spec und Plan ab Schwelle im Repo. → [docs/superpowers/README.md](docs/superpowers/README.md)

## Mehrdeutigkeiten (geflaggt, bewusst nicht aufgelöst)

- **Kürzel** — (a) Statuskürzel des Fachsystems (`D_AAE`) · (b) Bearbeiter-Kürzel einer Person („THÜ"). Beide heißen in UI und Code „Kürzel"; im Zweifel den Zusatz sagen.
- **Skill** — (a) App-Skill = Prompt-Vorlage der Anwendung (`SkillRecord`, Skill-Registry auf dem Share) · (b) Claude-Code-Skill = `.claude/skills/<name>/SKILL.md`, steuert den Agenten. In Docs und Commits den Zusatz sagen.
- **Phase** — (a) ZAH-Phase = Verfahrensschritt · (b) `VB_PHASE` = Antragstyp NW/FuE/DL/DS · (c) Begleitphase = Lebenszyklus nach Bewilligung mit eigener Frist-Uhr.
- **Begleitung** — ZAH-Phase „Begleitung" **und** StatusCategory `begleitung`; die Kollision ist bekannt und bleibt ([status-achsen.md](docs/architecture/status-achsen.md)).
- **Ebene** — (a) `StatusFeldEintrag.ebene` (worüber ein Eintrag spricht, ≠ `herkunft`) · (b) `WorkflowDef.ebene` (Scope eines Artefakts) · (c) Bauzeit- vs. Laufzeit-Ebene der Sichtbarkeit · (d) die drei Ebenen der App-Skills.
- **Snapshot** — (a) Programm-Snapshot auf dem Share (Team-Datenstand) · (b) Katalog-Snapshot = modul-globale Momentaufnahme der aktiven Fassung (`snapshot.ts`) · (c) Backup-Ordner `backups/YYYY-MM-DD/`.
- **Gate** — (a) Entwicklungs-Gate (`npm run check`) · (b) Zugangs-Gate zur Laufzeit (`AppPasswordGate`, `ModulSchlossGate`) · (c) Daten-Gate (`requireOnline()`, Daten-Mutations-Gate).
- **Rolle** — (a) Fachrolle AB/FB/QS/PA/Juristen (deskriptiv, leer = jeder) · (b) App-Rolle Kurator/PL.
- **Meilenstein** — (a) Bearbeitungs-Meilenstein · (b) Prominenz `meilenstein` (UI: Hauptereignis) · (c) Projekt-Meilensteine `MS01_*`–`MS03_*` der Begleitphase.
