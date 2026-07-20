# MAP „Neuer Prüf-Workflow" — Förderfähigkeitsprüfung

Plugin `map-foerderfaehig`, Flag `mapFoerderfaehig` (**nur dev**). Bringt die
Fachprüfung von Förderanträgen in die App: Einreichungs-JSON per Drag & Drop,
deterministische Rechenchecks, eine im Betrieb editierbare und versionierte
Checkliste, Abschluss als kopierbarer Entwurf.

Der MAP ist ein **Demonstrator**, kein Produktivmodul. Er soll dem Prüfteam
zeigen, dass der Weg trägt — und dabei den Satz einlösen: „Fehlt ein Kriterium?
Ergänzt es gleich."

## Die tragenden Entscheidungen

### Eigene Entität, kein `Antrag`-Record

Es gibt keinen Nicht-CSV-Anlagepfad für `Antrag`: `putAntraege` wird nur aus
CSV-Merge, Snapshot-Delta und List-View-Rebuild aufgerufen, der handgeschriebene
Seed wurde mit Pitfall #13 bewusst entfernt. Die Einreichung ist deshalb eine
eigene Entität im `kv`-Store — kein Eingriff in die produktive Datenpipeline,
kein Snapshot-Risiko (Pitfall #32), kein IDB-Version-Bump.

| Schlüssel | Inhalt |
|---|---|
| `map-einreichung:<id>` | Strukturmodell nach dem Import |
| `map-report:<id>` | Import-Report (gross, wird erst beim Öffnen geladen) |
| `map-pruefung:<einreichungId>` | Prüfstand samt Verlauf |
| `map-vb:<einreichungId>` | Zuordnung der Vorhabensbeschreibung |
| `map-checkliste:aktuell` | Aktuelle Checklisten-Fassung |

Alles **gerätelokal**: kein Spiegel in den persönlichen Ordner, kein
Snapshot-Anteil. MAP-Daten sind Prüfstände, keine geteilten Stammdaten.

### Schema-Erkennung über diskriminierende Marker

Der Prompt-Map ging von zwei Generationen mit unterschiedlichen Feldpfaden aus.
Die Bestandsaufnahme zeigte das Gegenteil: **alle importrelevanten Felder liegen
in beiden bekannten Generationen auf identischen Pfaden.** Die Unterschiede
betreffen ausschliesslich Felder, die der MAP gar nicht liest — die
Finanzjahres-Blöcke unter `data.finanzierungsubersicht`, das Adressobjekt je
`mode`, neue Telemetrie.

Eine Erkennung über „wenigste fehlende Pflichtfelder" liefert damit immer
Gleichstand und wäre reine Tie-Break-Willkür. Stattdessen entscheiden **Marker**:
Pfade, die es nachweislich nur in genau einer Generation gibt.

| Generation | Marker |
|---|---|
| 2025 | `data.istVorjahr`, `data.werteUbertragen` |
| 2026 | `data.finanzierungsubersicht`, `antragsteller.handwerk_confirm`, `auftraegeDritter.istEinAuftragAnDritteGeplant` |

Erkennt keine Definition eindeutig, **bricht der Import nicht ab**: er läuft über
die gemeinsame Feldzuordnung weiter und meldet die Unsicherheit. Die Alias-Ketten
je Zielfeld sind der Drift-Puffer für die *nächste* Generation, nicht für die
Unterschiede der beiden bekannten.

### Datenschutz als Pfad-Präfix-Deny-Liste plus Nachweis

Die Einreichung enthält weit mehr, als die Prüfung braucht: Personalbögen mit
Geburtsdatum, Gehalt und VWL, die Bankverbindung, Ansprechpartner mit
Telefonnummern, Browser-Telemetrie. Übernommen werden nur PM-Summen und
Personalnummer beziehungsweise das N.N.-Kennzeichen.

Zwei getrennte Mechanismen: `VERBOTENE_PFADE` sind **Pfad-Präfixe**, keine
Feldnamen (ein Feldname-Filter liesse ein umbenanntes Feld im gesperrten Teilbaum
durch), und `findeVerdaechtigeWerte` scannt das **fertige Ergebnis** — die
Deny-Liste sagt, was nicht gelesen werden soll, der Scan prüft, was tatsächlich
drin gelandet ist. Ein Convention-Test verbietet ausserdem Quellpfad-Literale aus
gesperrten Teilbäumen im übrigen Modulcode.

Anlagen tragen nur den Präsenz-Nachweis; `url` und `data.fileUrl` bleiben
draussen (letzteres zeigt im Echtfall auf einen Quarantäne-Bucket).

### Fünf Status statt vier

`docs/konzepte/brainstorming-pruefaspekte.md` argumentiert (Befund 1) für vier
Status plus Event-Historie: „NF notw." sei `unklar`, „NF erfüllt" ein Übergang.
Der MAP weicht **bewusst** ab und führt beide NF-Spalten als eigene Status.

Begründung: der Item-Verlauf wird ohnehin geführt, der NF-Zeitpunkt ist also in
beiden Modellen auswertbar. Fünf Status sind darüber hinaus **informativer** —
im Vier-Status-Modell ist `unklar → erfuellt` mehrdeutig (Nachforderung erledigt
oder Neubewertung?), im Fünf-Status-Modell nicht, und die NF-Dauer ergibt sich
direkt als `t(nf-erfuellt) − t(nf-notwendig)`.

Folge für `bewertung.ts`: `nf-notwendig` blockiert den Abschluss, `nf-erfuellt`
zählt wie erfüllt.

### Drei Bewertungsregeln an genau einer Stelle

`checkliste/bewertung.ts` ist die einzige Stelle, die über Punkte, Gates und
Vollständigkeit entscheidet. Drei Regeln daraus, die man leicht falsch
implementiert:

1. **Eine einzige B0-Stufe setzt die Gesamtpunktzahl auf 0.** Die
   Entscheidungshilfe summiert nicht einfach — fällt eine der drei Kategorien auf
   „unzureichend", ist der Innovationsgrad unzureichend, unabhängig vom Rest.
2. **Bedingte Blöcke entfallen vollständig.** Ein Item, dessen Bedingung nicht
   zutrifft, ist weder offen noch unvollständig und blockiert den Abschluss
   nicht. Der Aufträge-Block leitet sich aus `kosten.dritte` ab, die vertiefte
   Prüfung aus der Punktzahl, die Doppelförderung aus einer manuellen Antwort.
3. **„n. z." senkt die erreichbare Punktzahl**, statt als erfüllt zu zählen.

### Fundstellen über die Aufbereitung, nicht über Orama

Orama-Chunks tragen weder Überschriftenpfad noch Seitenzahl noch Antragsbezug —
das `heading` wird beim `insertDoc` verworfen, und ein Filter auf einen Antrag
existiert nicht. Für Fundstellen in genau einem Dokument ist die geparste
Gliederung die bessere Grundlage.

Die Achse ist **Kriterium → Prüfaspekt A–J → VB-Sektion**. Das Aspekt-Mapping
kommt aus dem bestehenden Baustein der Antrag-Aufbereitung (ein interner Lauf,
der nur auswählt), die Abbildung Kriterium → Aspekt ist eine kuratierte Tabelle
im Seed. Kriterien ohne Aspekt-Achse — etwa rein externe Recherchen — zeigen
bewusst **keine** Fundstellen; beliebige wären schlechter als keine.

### Lücken zeigen, nicht füllen

Alle LLM-Anteile sind optional und degradieren sichtbar. Ohne Bridge bleiben
Import, Rechenchecks, Gliederung und Checkliste vollständig nutzbar.

Der Infografik-Parser setzt die Leitplanke **durch**, statt sie nur im Prompt zu
erbitten: eine Aussage ohne gültige Fundstelle wird auf „vage" herabgestuft, auch
wenn das Modell „belegt" behauptet; erfundene Abschnitts-IDs werden gegen die
Gliederung geprüft und verworfen; leerer Text gilt als „fehlt". Ein
Verdächtig-Guard verhindert, dass eine formal gültige, inhaltlich leere Antwort
gecacht wird.

Cache-Präfix ist `map:<einreichungId>` — `getOrComputeBaustein` keyt auf dem
übergebenen Schlüssel, ohne Präfix kollidierten die Bausteine mit denen echter
Anträge.

### Transport

Dokument-tragende Läufe ausschliesslich über `bridge.getTransportForSkillRun`
(Pitfall #30); der Chat-Reset vor jedem Lauf (Pitfall #36) passiert innerhalb von
`getOrComputeBaustein`. Der Abschluss (Gutachten, Nachforderung, Ablehnung)
arbeitet **ohne** LLM.

## Testbarkeit

Die Vitest-Umgebung ist `node` ohne jsdom und sammelt nur `.test.ts` ein —
React-Component-Tests sind nicht möglich. Daraus folgt die harte Modulregel:
**keine `.tsx` in diesem Plugin rechnet.** Jede Ableitung liegt in einer reinen
`.ts` daneben (`ansicht/`, `checkliste/`, `infografik/`, `vb/`), die Komponenten
ordnen nur zu und stellen dar. Ein modul-lokaler Convention-Test bewacht das
zusammen mit der `normiertemonatskosten`-Sperre und der Deny-Liste.

Fixtures: `__tests__/fixtures/` ist committet und rein fiktiv (die Dummy-Fixture
ist eine gescrubbte, strukturgleiche Fassung des Plattform-Exports);
`__tests__/fixtures-local/` ist gitignored und trägt den Echtfall. Echtfall-Tests
überspringen sich sauber, wenn die Datei fehlt.

## Bewusste Vereinfachungen und Ausbaupfade

| Vereinfachung | Ausbaupfad |
|---|---|
| Nur die KMU-/Einzelprojekt-Checkliste | Verbund-Gesamtprüfung, FE-Variante und der vorgelagerte PreCheck als eigene Definitionen |
| Praxis-Richtwerte als benannte Konstanten | kuratorpflegbare Parameter-Ablage (Konzept-Delta 3) |
| Portfolio-Sunburst mit erfundenen Themen | deterministische Dimensionen: Projektform × Grössenklasse als Abbild der Fördersatzmatrix, Befund-Landkarte über echte Prüfergebnisse |
| Patentsituations-Checkboxen ohne Beschriftung | Zuordnung der Indizes `"0"`–`"4"` pflegen, sobald sie belastbar vorliegt |
| VB-Zuordnung von Hand bestätigt | bleibt bewusst so — ein falsch zugeordnetes Dokument stützte die ganze Prüfung auf den falschen Antrag |

## Dateien

```
src/plugins/map-foerderfaehig/
  MapPage.tsx  index.ts  store.ts  types.ts
  useMapEinreichungen.ts  useMapPruefung.ts  useMapVb.ts
  import/       Adapter, Schema-Definitionen, Erkennung, Redaktion, Rechenchecks
  checkliste/   Typen, Seed, Bewertung, Editor, Verlauf
  vb/           Zuordnung, Fundstellen
  infografik/   Schema + Prompt + Parser, Richtwerte, Portfolio-Demo
  abschluss/    NF-Suche, Markdown-Entwürfe
  ansicht/      Gantt-Daten, Kosten-Segmente
  components/   nur Darstellung
```

Testleitfaden für die Vorführung: [map-testleitfaden.md](../map-testleitfaden.md).
