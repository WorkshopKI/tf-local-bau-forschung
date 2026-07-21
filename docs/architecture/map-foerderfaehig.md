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
| `aufbereitung:map:<einreichungId>:steckbrief:<korpusHash>` | KI-Steckbrief |
| `aufbereitung:map:<einreichungId>:aspekte:<korpusHash>` | KI-Aspekt-Zuordnung |
| `map:<einreichungId>:infografik:<korpusHash>` | Canvas, SdT-Delta, Wirkungskette |

Alles **gerätelokal**: kein Spiegel in den persönlichen Ordner, kein
Snapshot-Anteil. MAP-Daten sind Prüfstände, keine geteilten Stammdaten.

### Die KI-Ergebnisse überleben die Navigation

Die drei KI-Bausteine haben keine eigene Entität — ihr **Baustein-Cache ist
zugleich ihre Persistenz** (`getOrComputeBaustein` schreibt jedes erfolgreiche
Ergebnis in den `kv`-Store). Damit sie nach einem Seitenwechsel wieder erscheinen,
liest [`vb/analyse-cache.ts`](../../src/plugins/map-foerderfaehig/vb/analyse-cache.ts)
sie beim Öffnen zurück (`leseMapAnalyse`, aufgerufen aus `useMapVb`) — **ohne
Transport und ohne LLM-Lauf**. Ein Miss lässt den Zustand unangetastet; die
Rehydrierung schreibt nur Treffer und löscht nie.

Gekeyt wird auf dem **Korpus-Hash**, nicht auf dem Hash des Hauptdokuments: ein
zugeordnetes Zusatzdokument ändert den Korpus und damit fachlich das Ergebnis. Der
Hash ist die Invalidierung — ein geänderter Korpus liefert einen Miss, nie ein
veraltetes Ergebnis. Wer ein Zusatzdokument wieder entfernt, bekommt die frühere
Analyse zum alten Korpus sofort zurück.

Die zwei Key-Schemata (`aufbereitung:map:…` für die von der Antrag-Aufbereitung
geerbten Bausteine, `map:…:infografik:` für den MAP-eigenen) bleiben bewusst wie
sie sind — ein umbenannter Key liesse alle vorhandenen Ergebnisse verwaisen. Beide
leben nur in `analyse-cache.ts`, Schreib- und Lesepfad teilen sich dieselben Bauer.
`deleteEinreichung` räumt beide Präfixe über alle Hash-Stände mit ab.

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

### Die VB ist mehrere Dateien

In der Praxis liegt die Vorhabensbeschreibung fast nie als eine Datei vor:
Hauptdokument plus Marktkonzept, Verwertung und Wirkung als eigene PDFs sind der
Normalfall. Für die inhaltliche Prüfung sind sie **ein** Text — ob eine Aussage
im Hauptdokument oder im Marktkonzept steht, darf das Ergebnis nicht verändern.

Die Zusammenführung kommt wörtlich aus der Antrag-Aufbereitung (`baueKorpus`):
Hauptdokument als Präfix, jedes Zusatzdokument per `---` und
`## [Quelle: <name>]` angehängt. Zwei Eigenschaften hängen daran: ohne
Zusatzdokument ist der Korpus **byte-identisch** zum Hauptdokument (bereits
berechnete Bausteine bleiben gültig, der Cache keyt auf dem Korpus-Hash), und die
Dokumentgrenze erscheint als reguläre Überschrift in der Gliederung. Ein zweites
Korpus-Format im MAP wäre stille Drift gewesen.

Anders als die Aufbereitung löst der MAP die Zusatzdokumente **nicht** über Tags
auf — die Einreichung trägt kein Aktenzeichen, an dem eine Tag-Relation hinge.
Der Prüfer ordnet von Hand zu, aus denselben Gründen wie beim Hauptdokument.

Der Cap-Check in `vb/korpus.ts` schliesst eine reale Lücke: `runBaustein` umgeht
`runSkill` und damit `capVbMarkdown` — es kürzt nicht und warnt nicht. Die
Upload-Warnung prüft jede Datei einzeln, nie ihre Summe. Bei vier Dokumenten ist
das Kontextfenster erreichbar, und ein stillschweigend abgeschnittener Korpus
wäre in einer Förderprüfung der schlechteste denkbare Fehler: das Modell urteilte
über einen Text, dessen Ende es nie gesehen hat. Deshalb ein sichtbarer Hinweis
statt stiller Kürzung.

Die Messung selbst (`misseKorpus`) liegt seit v2.272.1 neben `baueKorpus` in der
Aufbereitung und wird von beiden Modulen genutzt — die Aufbereitung warnt im
Quellen-Panel, der MAP im VB-Reiter. Gekürzt wird weiterhin nirgends: das würde
bestehende Ergebnisse verändern, und was mit einem zu grossen Korpus geschieht,
ist eine fachliche Entscheidung.

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

## Substanzcheck (Anti-Prosa-Paket)

Der Hebel gegen KI-glattgeschriebene Anträge. **Leitidee: nicht Textqualität
bewerten, sondern Behauptungen gegen harte Daten und gegen Quantifizierungspflicht
halten.** Die KI liest und konfrontiert, der Mensch bewertet.

Vier Bausteine, alle auf dem **bestehenden** Infografik-Lauf — es kommt kein
zusätzlicher LLM-Aufruf hinzu:

| Baustein | Wo | Was |
|---|---|---|
| **Fakten-Block** | `infografik/fakten.ts` | Laufzeit, Σ PM, PM je AP mit Namen, Kostenarten, Fördersatz, Zuwendung — deterministisch aus dem Strukturmodell, im Prompt als „verbindliche Fakten aus der Einreichung" vor der VB. |
| **Widersprüche** | `infografik/substanz.ts` → Reiter „Rechenchecks", Gruppe „VB ↔ Einreichungsdaten" | Abweichungen `zahl`/`zeitraum`/`bezeichnung` zwischen Fliesstext und Formular. Ein Klick hängt den Befund über `substanz/zuordnung.ts` an das passende Prüfkriterium (`nf-notwendig` + Bemerkung). |
| **Unschärfe-Liste** | Reiter „Vorhaben kompakt" | Anspruchsformeln ohne Zahl oder Definition, max. 10. Bewusst **ohne Score** — eine Liste zum Durchgehen, keine Textnote. |
| **Zielkriterien + Präzisions-NF** | `substanz/zielkriterien.ts`, `substanz/nf-praezision.ts` | Quantifizierte Delta-Zeilen wandern als Tabelle „Kontrollfähige Zielkriterien (RL 4.5.1)" ins Gutachten; unbezifferte werden per Klick zur Nachforderung. |

Vier Entscheidungen, die man kennen muss:

1. **Leere Listen sind ein gutes Ergebnis.** `istInhaltsleer` (Verdächtig-Guard)
   ignoriert die Substanz-Felder bewusst — sonst löste ein sauberer Antrag einen
   Retry aus und würde nie gecacht.
2. **Formulierungs-Leitplanke im Code, nicht im Prompt.** Jede erzeugte
   NF-Frage verlangt eine konkrete Angabe **und** Messverfahren/Bezugsgrösse;
   „bitte näher erläutern" ist ausgeschlossen. Kein Modell-Lauf kann das
   aufweichen. Registry-Bausteine werden dabei nie umformuliert (Pitfall #34) —
   sie stehen wortgetreu daneben.
3. **Zielkriterien speichern die ABWAHL**, nicht die Auswahl: quantifizierte
   Zeilen sind per Vorgabe an, und eine Zeile aus einem späteren Lauf fällt nicht
   still heraus.
4. **Cache-Invalidierung über `INFOGRAFIK_SCHEMA_VERSION`** (im Key via
   `vb/analyse-cache.ts`). Der Korpus-Hash allein genügt nicht: eine v1-Antwort
   passt weiter zum unveränderten Korpus und lieferte dauerhaft leere Listen.

**Messung: dev-Panel statt npm-Script.** Der Reiter „Substanz-Smoke" (nur bei
`features.devFixtures`) fährt vier fiktive VB-Fassungen gegen dieselbe fiktive
Einreichung — drei mit je einer eingebauten Abweichung, eine saubere. Die saubere
Fassung ist die **Falsch-Positiv-Kontrolle** und der eigentliche Härtetest: ein
Widerspruchscheck, der überall etwas findet, ist wertlos. Eine Node-CLI kann das
nicht leisten, weil die interne KI an der browser-gebundenen Streamlit-Bridge
hängt. `npm run check` bleibt LLM-frei; geprüft wird dort nur die deterministische
Seite (`__tests__/substanz.test.ts`, `substanz-aktionen.test.ts`).

## Testbarkeit

Die Vitest-Umgebung ist `node` ohne jsdom und sammelt nur `.test.ts` ein —
React-Component-Tests sind nicht möglich. Daraus folgt die harte Modulregel:
**keine `.tsx` in diesem Plugin rechnet.** Jede Ableitung liegt in einer reinen
`.ts` daneben (`ansicht/`, `checkliste/`, `infografik/`, `substanz/`, `vb/`), die
Komponenten ordnen nur zu und stellen dar.

Der modul-lokale Convention-Test (`__tests__/konventionen.test.ts`) prüft davon
**drei** Dinge maschinell: die `normiertemonatskosten`-Sperre, die
Datenschutz-Deny-Liste und die 400-Zeilen-Grenze — dazu seit dem Substanzcheck
die Fixture-Herkunft des Smoke-Panels. Die Regeln „keine `.tsx` rechnet" und
„kein `Antrag`-Record" gelten weiterhin, werden aber **nicht** vom Test erzwungen;
sie stehen als Konvention in den Datei-Headern.

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
  useMapEinreichungen.ts  useMapPruefung.ts  useMapVb.ts  useSubstanzAnsicht.ts
  import/       Adapter, Schema-Definitionen, Erkennung, Redaktion, Rechenchecks
  checkliste/   Typen, Seed, Bewertung, Editor, Verlauf
  vb/           Zuordnung, Fundstellen, Analyse-Cache
  infografik/   Schema + Prompt + Parser, Fakten-Block, Substanz, Richtwerte
  substanz/     Zuordnung, Präzisions-NF, Zielkriterien, Kontrast-Fixtures, Smoke
  abschluss/    NF-Suche, Markdown-Entwürfe
  ansicht/      Gantt-Daten, Kosten-Segmente
  components/   nur Darstellung
```

Testleitfaden für die Vorführung: [map-testleitfaden.md](../map-testleitfaden.md).
