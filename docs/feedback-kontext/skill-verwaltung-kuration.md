# Skill-Verwaltung

## Zweck

Kuratoren (bzw. PL im Schreib-Build) pflegen die KI-Skills, Qualitätsregeln und Textbausteine der Gutachten-/Bescheid-Erzeugung und testen Skills per Sandbox-Testlauf gegen echte Anträge, bevor sie live gehen.

## UI-Elemente & Begriffe

- **Reiter:** „Skills", „Qualitätsregeln", „Workflows", „Textbausteine" (dev zusätzlich „Skill-Eval").
- **Skill-Liste:** Ansichts-Umschalter (Liste/Tabelle/Karten; Start Tabelle), Facetten (Reifegrad, Kategorie mit Zähler, „nutzt Regel", Sortierung), Tabelle mit Name/Kategorie/Status + Reifegrad-Badge/Version/Regeln.
- **Skill-Editor** (Detail-Kopf mit Umschalter „Team | Persönlich"):
  - Prompt-Template, Modifier (neu/kürzer/länger), Kategorie (leer = abgeleitet).
  - Sektion **„Umfang & Form"**: An/Aus-Pille je Vorgabe mit Zahlenfeld + Häkchen „persönlich anpassbar".
  - Zugeordnete Bibliotheks-Regeln.
  - **„Abnahme-Kriterien (KI-QS)"**: ein prüfbarer Satz je Zeile (leer = generisch) + „Kriterien aus Prompt ableiten" (Vorschläge zum Anklicken).
  - **Persönlich-Ansicht:** freigegebene Werte verschieben + eigene Stil-Hinweise.
- **Weitere Werkzeuge:** Regel-Editor, Workflow-Editor (Schritte, Freigabe), Testlauf-Panel („VB ✓"/„keine VB"), Bundle-Import/-Export, „Ungespeicherte Änderungen"-Dialog.
- **Reiter „Textbausteine":** Liste (Filter Typ NF/RNE/ABL, Status, Aspekt, Suche) + Editor (Thema, Aspekt-Chips A–J, Stichworte, Rechtstext mit Platzhaltern), Freigeben/Stilllegen mit Begründung, Versions-Historie mit Diff/Rollback, „Neuer Baustein" + „Aus Word importieren" (verbatim, erzeugt Entwürfe).

## Typische Aktionen

- Skill/Regel bearbeiten und speichern, Skill duplizieren/löschen/exportieren
- Regel aktivieren/deaktivieren, Sandbox-Testlauf starten
- Umfangs-Vorgabe setzen/persönlich freigeben, Abnahme-Kriterien pflegen/ableiten
- Workflow-Schritte anlegen/umsortieren, Workflow freigeben
- Baustein anlegen/bearbeiten/freigeben/stilllegen/zurücksetzen, Word-Datei importieren

## Technik

**Datenmodell dahinter:** `SkillRegistryFile` mit `skills: SkillRecord[]` (Prompt, Modifiers, `regelIds`, `vorgaben?`, `qsKriterien?`, optionale `kategorie`), `regeln`, `workflows`; über `useSkillRegistry`, persönlich über `SkillTweak`. Textbausteine getrennt: `TextbausteinKatalog` (Sidecar `textbausteine.json`, Status/Version/Historie) über `useTextbausteinKatalog`.

**Code:** `plugins/skill-verwaltung-kuration/` — `SkillVerwaltungPage.tsx`, `SkillEditor.tsx`, `qsKriterienAbleitung.ts`, `Textbaustein*`; Fachlogik in `core/services/skills/`. Siehe `docs/architecture/skill-vorgaben.md`, `textbaustein-katalog.md`.
