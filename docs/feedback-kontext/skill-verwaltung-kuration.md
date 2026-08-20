# Skill-Verwaltung

## Zweck

Kuratoren (bzw. PL im Schreib-Build) pflegen die KI-Skills, Qualitätsregeln und Textbausteine der Gutachten-/Bescheid-Erzeugung und testen Skills per Sandbox-Testlauf gegen echte Anträge, bevor sie live gehen.

## UI-Elemente & Begriffe

- **Reiter:** „Skills", „Qualitätsregeln", „Workflows", „Textbausteine" (dev zusätzlich „Skill-Eval").
- **Skill-Liste:** Ansichts-Umschalter (Liste/Tabelle/Karten; Start Tabelle), Facetten (Reifegrad, Kategorie mit Zähler, „nutzt Regel", Sortierung), Tabelle mit Name/Kategorie/Status + Reifegrad-Badge/Version/Regeln.
- **Skill-Editor** (Detail-Kopf mit Umschalter „Team | Persönlich"):
  - Prompt-Template, Modifier (neu/kürzer/länger), Kategorie (leer = abgeleitet).
  - Sektion **„Umfang & Form"**: An/Aus-Pille je Vorgabe mit Zahlenfeld + Häkchen „persönlich anpassbar".
  - Sektion **„Formale Vorgaben (automatisch)"**: der Block, der aus den Regeln erzeugt und dem Prompt angehängt wird. Darunter erscheinen bei Bedarf drei Hinweise: der Prompt-Text nennt eine andere Zahl als die Regel; die Vorgaben schließen einander aus (etwa Satzzahl mal Satzlänge gegen das Zeichenlimit); der Prompt-Text nennt eine Zahl doppelt, die ohnehin aus der Regel kommt.
  - Zugeordnete Bibliotheks-Regeln.
  - **„Abnahme-Kriterien (KI-QS)"**: ein prüfbarer Satz je Zeile (leer = generisch) + „Kriterien aus Prompt ableiten" (Vorschläge zum Anklicken).
  - **Persönlich-Ansicht:** freigegebene Werte verschieben + eigene Stil-Hinweise.
- **Weitere Werkzeuge:** Regel-Editor, Workflow-Editor (Schritte, Freigabe, je Schritt **„Kontext aus der Vorhabensbeschreibung"**: vollständig oder nur die einschlägigen Abschnitte), Testlauf-Panel („VB ✓"/„keine VB"), Bundle-Import/-Export, „Ungespeicherte Änderungen"-Dialog.
- **Knopf „Paket…"** (in der Kopfzeile, auf jedem Reiter): überträgt einen ganzen kuratierten Stand auf einen anderen Daten-Share. Zwei Hälften:
  - **Erstellen:** Häkchen je Gruppe (Skills, Regeln, Workflows, Textbausteine) mit Anzahl, „Paket herunterladen" legt eine Datei ab. Ohne Fassungs-Historie, ohne Antragsdaten.
  - **Einspielen:** Datei wählen → Vorschau je Eintrag mit „neu" / „geändert" / „unverändert" und der Wahl übernehmen · aktualisieren · als Kopie · überspringen (je Gruppe auch „alle übernehmen" / „alle überspringen"). Unveränderte Einträge sind zunächst ausgeblendet. Geschrieben wird erst mit „Einspielen"; danach steht ein Bericht, was neu, aktualisiert und übersprungen wurde. **Aktualisieren löscht nichts:** der bisherige Stand bleibt als Fassung erhalten und lässt sich in der Versions-Historie zurückholen.
- **Reiter „Textbausteine":** Filterleiste (Typ NF/RNE/ABL, Status, Aspekt, Suche) über einem **Baum** Bereich → Überkategorie → Thema → Baustein (Blatt zeigt ID + Textanfang + Status-Badge, Gruppenknoten die Anzahl) + Editor rechts (Thema, Aspekt-Chips A–J, Stichworte, Rechtstext mit Platzhaltern), Freigeben/Stilllegen mit Begründung, Versions-Historie mit Diff/Rollback, „Neuer Baustein" + „Aus Word importieren" (verbatim, erzeugt Entwürfe).
  - **Thema umbenennen:** F2 oder Doppelklick auf einen Thema-Knoten; betrifft es mehrere Bausteine, fragt ein Dialog mit Anzahl und IDs nach. **Bausteine sind nicht inline umbenennbar** — ihre Zeile zeigt die ID, und die ist unveränderlich; das Thema eines einzelnen Bausteins ändert der Dialog „Thema ändern …" aus dem Kontextmenü.
  - **Verschieben:** Baustein per Ziehen in ein anderes Thema **derselben Überkategorie**. Bereichswechsel, Überkategorie-Wechsel und G↔T sind gesperrt — das wäre eine fachliche Umwidmung, kein Umsortieren.
  - **Kontextmenü** (Rechtsklick): Thema ändern · Freigeben · Zurück in Entwurf · Stilllegen. **Kein Löschen** — der Katalog kennt keins, stillgelegte Bausteine bleiben lesbar.

## Typische Aktionen

- Skill/Regel bearbeiten und speichern, Skill duplizieren/löschen/exportieren
- Regel aktivieren/deaktivieren, Sandbox-Testlauf starten
- Umfangs-Vorgabe setzen/persönlich freigeben, Abnahme-Kriterien pflegen/ableiten
- Workflow-Schritte anlegen/umsortieren, Workflow freigeben
- Baustein anlegen/bearbeiten/freigeben/stilllegen/zurücksetzen, Word-Datei importieren
- Kuratur-Paket erstellen und auf einem anderen Daten-Share einspielen (Vorschau je Eintrag)

## Technik

**Datenmodell dahinter:** `SkillRegistryFile` mit `skills: SkillRecord[]` (Prompt, Modifiers, `regelIds`, `vorgaben?`, `qsKriterien?`, optionale `kategorie`), `regeln`, `workflows`; über `useSkillRegistry`, persönlich über `SkillTweak`. Textbausteine getrennt: `TextbausteinKatalog` (Sidecar `textbausteine.json`, Status/Version/Historie) über `useTextbausteinKatalog`.

**Code:** `plugins/skill-verwaltung-kuration/` — `SkillVerwaltungPage.tsx`, `SkillEditor.tsx`, `qsKriterienAbleitung.ts`, `Textbaustein*`, `PaketDialog.tsx` + `PaketImportPanel.tsx`; Fachlogik in `core/services/skills/` (Paket: `core/services/skills/paket/`, rein — Vergleich kanonisch über den ganzen Record, Aktualisieren schreibt die Fassung fort, Workflow-Schritt-IDs bleiben stabil). Siehe `docs/architecture/skill-vorgaben.md`, `textbaustein-katalog.md`, `gutachten-kurzfassung.md` (Abschnitt „Kuratur-Paket").
