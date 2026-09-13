# Bearbeitungs-Meilensteine & Fristen-Monitoring

Zweite Achse neben dem amtlichen Status: der Status sagt **wo** ein Verbund steht,
der Meilenstein-Plan sagt, ob er dort **rechtzeitig** steht. Ziel ist die
vollständige Bearbeitung binnen `gesamtfristTage` (Default 90 =
[`ANTRAG_SLA_DAYS`](../../src/core/services/csv/frist.ts)) ab Antragseingang.

Rein deterministisch, kein LLM. Gated hinter `meilensteinMonitoring`
(dev/pl/as/kurator; prod erst nach Abnahme).

## Drei Abgrenzungen

1. Die Anzeige-`Prominenz = 'meilenstein'` des Status-Katalogs
   ([status/typen.ts](../../src/core/status/typen.ts)) bleibt ein reiner
   Timeline-Marker und wird hier **nicht** umgedeutet.
2. Die CSV-Spalten `MS01_*`–`MS03_*` (Begleitphase, `*_DPLAN`/`*_DIST`) sind
   **Projekt**-Meilensteine des bewilligten Vorhabens — eigener Lebenszyklus,
   nicht Gegenstand dieses Moduls.
3. Die Erfüllungs-Bedingung ist die bestehende `Bedingung` des Status-Systems,
   ausgewertet vom geteilten Evaluator
   ([status/bedingung.ts](../../src/core/status/bedingung.ts)). Es gibt genau
   diesen einen — ein zweiter würde bei der ersten Änderung auseinanderlaufen.

## Datenmodell

`MeilensteinKnoten` ([typen.ts](../../src/core/meilensteine/typen.ts)): flacher
Baum über `elternId`, Tiefe frei. Je Knoten `sollWoche` (Ende der n-ten Woche
nach Antragseingang), `relevantFuerFrist`, `nurTypen` (FuE/DS/DL/NW, leer = alle),
`aktiv`, `bedingung` und optional `istDatumFeld` sowie `unbestaetigt`
(die Spalten-Zuordnung ist vorbelegt und noch nicht geprüft).

`MeilensteinPlan`: versioniert + freigebbar wie der
[Textbaustein-Katalog](textbaustein-katalog.md) — `status` ist eine eigene Achse
neben der Version, `historie` newest-first, gekappt auf `MAX_HISTORIE` — **mit
einer Ausnahme**: die jüngste freigegebene Fassung bleibt stehen, auch wenn sie
aus dem Fenster fiele (`kappeHistorie`, v4.118). Ohne sie kostete die 21.
Entwurfs-Speicherung in Folge den geltenden Plan: die Auswertung fällt auf die
Historie zurück, und mit dem letzten `freigegeben`-Snapshot verschwand ihre
Grundlage — alle Reiter meldeten „Noch kein Plan freigegeben", die Zähler standen
auf 0, und die Fassung war nicht nur aus dem Blick, sondern aus der Datei.

## Bewertung ([bewertung.ts](../../src/core/meilensteine/bewertung.ts))

- **Anker** = der **wirksame Eingang** des Verbunds: je Teilvorhaben das spätere
  aus `D_AAE` (Antragseingang) und `D_XTE` („alle Anträge da"), über die
  Teilvorhaben das späteste (`verbundWirksamerEingang`, gelesen über
  `baueAnkerLeser` in [anker.ts](../../src/core/meilensteine/anker.ts)). Vorher
  ist der Verbund nicht vollständig bearbeitbar. `sollDatum = anker + sollWoche * 7`;
  die Dauern der Auswertung zählen ab demselben Anker. Die **Frist** kommt nicht
  aus dem Anker, sondern aus der Frist-Spalte (nächster Punkt).
  - **Ein Anker für alle drei Rechenstellen** — Projektion, Verbund-Detailseite
    und Auswertung. Bis v6.49 las der Anker nur `D_AAE`, während die
    Frist-Spalte der Tabelle und der Bestandslauf schon `wirksamerEingang`
    nutzten: zweimal „90 Tage ab Eingang" aus verschiedenen Quellspalten.
  - `D_XTE` ist custom gemappt (produktiv `alle_an_trage_da`); der Record-Key
    wird über `loeseFelderAuf` aufgelöst, nie geraten. Mappt kein Schema die
    Spalte, bleibt es beim Antragsdatum.
  - `VerbundMeilensteine.antragsdatum` (spätestes `D_AAE`) bleibt daneben
    stehen — nur für die Einordnung nach Eingangsjahr (Zeitraum-Filter).
  - **Gemessen** (10.09.2026, dev:local, 14 225 Anträge, Plan-Fassung 30, alt
    und neu auf DENSELBEN Daten gerechnet): 28 von 2 082 offenen Verbünden
    (1,3 %) bekommen einen späteren Anker, +1 bis +61 Tage (Median +8); dabei
    kippt **kein** Meilenstein-Zustand und keine Prognose. Auswertung (ganzer
    Bestand, ohne Bereichs-/Jahresfilter): 125 von 5 969 Dauern werden kürzer
    (Median −5 T); Ø 132 → 131 T, Median 117 T unverändert, im Soll 32 → 33 %.
- **Frist = die Bearbeitungsfrist der Frist-Spalte** (seit v6.66,
  [frist-lage.ts](../../src/core/meilensteine/frist-lage.ts)). Das Pflichtfeld
  `BewertungsEingabe.frist` füllt `verbundFristLage`: die Teilvorhaben laufen
  durch die Listen-Projektion und dieselbe Faltung wie die Fördertabelle
  (`verbundFristErgebnis` in
  [frist-ergebnis.ts](../../src/core/services/csv/frist-ergebnis.ts),
  `criticalFristErgebnis` delegiert dorthin) — die knappste laufende Uhr, sonst
  angehalten, sonst nicht berechenbar. Die Brücke `fristErgebnisVon`/`FristQuelle`
  wohnt dafür im csv-Layer; `fristAnzeige.ts` reicht sie nur weiter.
  `fristDatum` und `restTage` stehen **nur bei laufender Uhr**, sonst `null`;
  `fristZustand` trägt den Zustand. Die Soll-Wochen zählen weiter ab dem Anker.
  - **Warum:** vorher rechnete `bewerteVerbund` `anker + gesamtfristTage` ohne
    Halt — zweimal „90 Tage" mit verschiedenen Regeln. **Gemessen** (13.09.2026,
    dev:local, 14 225 Anträge, Plan-Fassung 43): von 2 081 offenen Verbünden
    nannte diese Uhr 1 917 „über der Frist"; die Frist-Spalte zeigte davon
    1 348× „angehalten", 90× „nicht berechenbar", 151× „noch in der Frist" und
    nur 328× ebenfalls „über".
- **Zustände**: `erreicht` · `gerissen` (Soll überschritten) · `faellig`
  (Soll in ≤ `FAELLIG_FENSTER_TAGE` = 7) · `offen` · `nichtRelevant` (inaktiv
  oder typ-fremd) · `ohneBedingung`. Ein inaktiver Knoten wird nie als gerissen
  gezählt.
- **`ohneBedingung` (v4.134) ist ein Urteil über den PLAN, nicht über den
  Vorgang**: der Knoten trägt keine auswertbare Bedingung (`bedingungIstLeer` —
  `{einige: []}` ist immer falsch, `{alle: []}` immer wahr, beide ohne Bezug zu
  den Daten) **und** keine aktiven Kinder, aus denen sich eine ergäbe. Solche
  Knoten galten ab ihrer Soll-Woche für immer als `gerissen`: im ausgelieferten
  Plan waren es **4 von 11** aktiven Knoten, und sie stellten **108 von 124**
  Anlässen des Fristen-Widgets — jede sichtbare Zeile nannte denselben
  Meilenstein (gemessen 20.08.2026). Der Prüfstein steht **vor** `erreicht`,
  sonst hätte ein leeres `{alle: []}` dauerhaft „erreicht" gemeldet, ohne je ein
  Datum gesehen zu haben. Sie zählen **nicht** in die Prognose und nicht in
  `planEndeTage`; `knotenOhneBedingung(knoten)` liefert die Liste für die
  Fußzeile des Fristen-Widgets und die Marke „ohne Bedingung" im Editor.
  Häufigste Ursache: ein Sammel-Knoten, dessen Kinder ausgerückt wurden — sein
  `nurUeberKinder()` bleibt stehen und misst danach nichts mehr.
- **Eltern-ODER-Regel**: ein Sammel-Knoten gilt als erreicht, wenn seine eigene
  Bedingung zutrifft **oder** alle relevanten Kinder erreicht sind. Sein
  Ist-Termin ist dann das **späteste** Kind-Datum.
- **Ist-Termin aus den Daten, nicht aus einem Log**: `istDatumFeld`, sonst der
  Tag, an dem die Bedingung wahr wurde (`erfuellungsDatum`). Ein Blatt liefert
  das früheste Datum **seines** Feldes über die Teilvorhaben — bei „A nach B"
  (`datumNachFeld`) also A, nicht das per Definition frühere Vergleichsfeld.
  Eine „alle"-Gruppe nimmt das **späteste** Datum ihrer Teile (wahr erst, wenn
  der letzte zutrifft), eine „eine"-Gruppe das **früheste** der **zutreffenden**
  Teile. Teile ohne Datum (Status-, Förderart-Vergleiche) fallen heraus. Warum
  nicht das früheste aller Bedingungsfelder: bei „alle" maß das den ersten statt
  den letzten Schritt, und die Abweichung sah besser aus, als sie war (im
  ausgelieferten Plan MST 3 — „alle" über zwei „eine"-Gruppen aus vier
  Datumsspalten). Allgemein steht die Regel als `IST_AUS_BEDINGUNG` im
  Quellspalten-Tooltip; übersetzt auf die jeweilige Regel (`istTerminErklaerung`,
  [ist-termin.ts](../../src/core/meilensteine/ist-termin.ts)) steht sie in der
  Ist-Termin-Zeile des Regelbereichs neben der Auswahl (siehe Probe am
  Bestand). Bewusste Abweichung vom ursprünglichen Entwurf — ein
  Event-Log beginnt beim ersten Import und wüsste über Altfälle nichts; so ist
  auch der Bestand auswertbar.
- **Prognose** (`imPlan` · `gefaehrdet` · `nichtHaltbar` · `angehalten` ·
  `abgeschlossen` · `unbekannt`): nach `abgeschlossen` kommt `angehalten` —
  steht die Uhr der Frist-Spalte, gibt es nichts vorherzusagen. Sonst ist eine
  schon überschrittene Frist (`restTage < 0`) `nichtHaltbar`; läuft sie noch,
  wird der größte aktuelle Verzug auf den Plan-Endpunkt aufgeschlagen, und
  überschreitet die Summe `gesamtfristTage`, ist sie ebenfalls `nichtHaltbar`.
  Nur **Blätter** zählen — ein Sammel-Knoten würde denselben
  Verzug ein zweites Mal in die Rechnung tragen. Das Modell ist bewusst
  pessimistisch: es unterstellt, dass eine verlorene Woche nicht aufgeholt wird.
  - **Die Anzeige trennt die beiden Ursachen von `nichtHaltbar`**
    ([labels.ts](../../src/plugins/meilensteine/labels.ts)): im Kopf des
    Meilenstein-Abschnitts der Verbund-Detailseite und unter „Diese Woche" (dort
    über `WochenPunkt.fristTage`) sagt `prognoseText` „Über der Frist"
    (`restTage < 0`, schon passiert) oder
    „Frist nicht mehr zu halten" (Vorhersage) — beides „Frist nicht haltbar" zu
    nennen, las sich bei einer längst überschrittenen Frist wie eine Vorhersage.
    Filter-Chips und Verteilungen zählen eine Menge und bleiben bei
    `PROGNOSE_LABEL` („Frist nicht zu halten", „Frist angehalten").

## Feld-Auflösung ([felder.ts](../../src/core/meilensteine/felder.ts))

Eine Bedingung nennt ihr Feld entweder als **kanonischen Key** (`antragsdatum`,
`status`, …) oder als rohen **CSV-Spalten-CODE** (`D_PC+`, `D_QS`). Codes werden
über die Programm-Schemas aufgelöst (`resolveStatusDatumFelder`, dieselbe
NFC-/Sonderzeichen-Normalisierung wie die Datums-Status-Gruppen) — nie hart
verdrahtet (recurring-bug-classes Klasse 5). Ein unbekannter Code wird zu einem
nie gefüllten Key: die Bedingung evaluiert zu `false`, statt zu werfen.

## Persistenz

| Was | Wo | Profil |
|---|---|---|
| Plan (Team) | `_intern/meilensteine.json` | `atomicWrite` + Backup-Rotation, self-gated über `queryPermission`; IDB-`kv`-Cache, **kein** DB-Version-Bump |
| Projektion | `kv`: `meilenstein-stand:<programmId>` | nur nicht-terminale Verbünde, Signatur-Guard |
| Risiko-Meldungen | persönlicher Ordner `ZAH/meilenstein-risiken.json` + `kv`-Spiegel | Muster Übernahme-Wünsche (Pitfall #24/#26) |

**Der Plan ist Team-Daten**: eine Frist-Definition, die auf jedem Rechner anders
lautet, wäre wertlos. Geschrieben wird nur mit `canWriteDatenShare` (Pitfall #25).
Der Status-Katalog nebenan ist seit v2.332 ebenfalls Team-Sidecar — der
Unterschied liegt nicht im Speicherort, sondern in der Freigabe (siehe unten).
Gerätelokal bleibt dort nur das Event-Log.

**Ausgewertet wird nur eine freigegebene Fassung** (`freigegebeneFassung`) —
sonst sähen alle Zahlen, die auf einem halbfertigen Entwurf beruhen. Das ist der
Unterschied zum Katalog, der mit dem Speichern gilt, und die häufigste Ursache
für „meine neuen Meilensteine kommen nicht an": gespeichert ist nicht
freigegeben. Bis dahin gilt die jüngste freigegebene Fassung aus der Historie;
gibt es keine, meldet die Seite „Noch kein Plan freigegeben."

**Tolerante Normalisierung — mit einer Zusage** (seit v4.3): **alle neun**
`Bedingung`-Operatoren überleben den Neustart. Bis dahin kannte
`normalisiereBedingung` nur sechs, während der Editor neun anbot; `tageSeit`,
`datumNachFeld` und `foerdervarianteIn` verschwanden beim nächsten **Lesen**.
Und eine UND-Gruppe, die dabei einen Zweig verlor, wurde zu `{alle: []}` —
`[].every(…)` ist `true`, der Meilenstein galt also für jeden Verbund als
erreicht. Deshalb gilt jetzt: verliert eine UND-Gruppe einen Zweig, wird sie
`{einige: []}` = nie erfüllt. Ein Roundtrip-Test über `Bedingung['op']` hält die
Operator-Liste vollständig — ein zehnter bricht den Typecheck.

Ebenso übersteht der **Gruppenname** das Lesen: `normalisiereBedingung` behält
ihn (getrimmt, auf `MAX_GRUPPENNAME` gekappt), auch am Sicherheits-Rückfall
`{einige: []}` — dort zeigt er, WELCHE Gruppe beim Laden zerbrach. Builds vor
v6.59 kennen das Feld nicht und verwerfen es beim Lesen; die Aussage der Regel
bleibt dieselbe. Weil `schreibePlanAufShare` den geladenen, normalisierten Plan
schreibt, speichert ein solcher Build den Plan ohne Namen zurück.

Aus demselben Grund verwirft die Normalisierung seit v4.118 auch ein
`ist`/`istNicht` **ohne Wert** (wie `datumNachFeld` ohne zweites Feld):
`istNicht` ohne Wert ist `!werte.some(v => v === '')` und damit für jeden
Vorgang wahr — auch für den, dem das Feld ganz fehlt. Der Editor legt genau
diesen Zustand an, wenn man den Operator wählt und den Wert noch nicht; der
Meilenstein sprang portfolioweit auf „erreicht", während das Wertfeld sichtbar
leer stand. Der Editor markiert das Blatt jetzt zusätzlich als unvollständig.
Wer „Feld ist leer" meint, hat dafür `leer`/`gefuellt`.

**Signatur-Guard** ([projektion.ts](../../src/core/meilensteine/projektion.ts)):
`BEWERTUNGS_VERSION | planVersion@stand | schemaId:checksum:spaltenzahl | Kalendertag`.
Der Tages-Anteil muss hinein, weil die Bewertung zeitabhängig ist — ohne ihn
bliebe „fällig" stehen, während der Meilenstein längst gerissen ist (Lehre aus
der stale List-View). **Die Bewertungs-Version kam mit v4.134 dazu**: eine
geänderte Regel ist für die Ablage dasselbe wie ein geänderter Plan — ohne sie
zeigte das Fristen-Widget nach der Engine-Änderung unverändert die 108 Anlässe
von vorhin, weil Plan, Schema und Tag dieselben waren. Wer die Semantik von
`bewerteVerbund` ändert, zählt `BEWERTUNGS_VERSION` hoch — zuletzt 4 → 5 mit
v6.66 (Frist aus der Frist-Spalte, Prognose `angehalten`), die Projektion
rechnet danach einmal neu. Gepflegt wird die Projektion in einem eigenen Post-Import-Pass neben
`nachImportStatusPflege` (andere Flags, andere Datenquelle).

## Oberfläche

- **Plugin `meilensteine`** (`/meilensteine`): Übersicht (Master/Detail mit
  Zustands-Punkten und Zeitstrahl), „Diese Woche" (gerissen/fällig über alle
  Verbünde), Auswertung (Ø-Dauer je Antragstyp, Soll gegen Ist je Knoten),
  Konfiguration (Baum-Editor, Regelbereich als Karten mit Ist-Termin-Zeile und
  Probe am Bestand, Fassungen, Freigabe).
- **Home-Widget „Fristen"** — eine Liste für beide Fristsysteme (Zieltage +
  Meilensteine), Auszug für die eigenen Verbünde, **je Vorgang eine Zeile**
  (gebündelt wie im Modul, `buendleNachVerbund`). Das frühere Einzel-Widget
  „Meilensteine diese Woche" ist seit v4.87 abgelöst.
- **Verbund-Detailseite**, Abschnitt `#meilensteine` unter `#status`: Zeitstrahl,
  Frist (`restzeitText`: dieselbe Frist und dasselbe Wort wie die Frist-Spalte,
  „Frist angehalten" bei stehender Uhr; das Fristdatum nur bei laufender) und
  Risiko-Meldung.

### Was die Anzeige nicht behaupten darf (v4.118)

Aus einer Bug-Jagd auf genau diese Oberfläche. Alle Regeln haben dieselbe Wurzel:
**die Anzeige darf nichts sagen, was das Modell nicht trägt.**

- **Keine Zahl ohne Deckung.** Bei Prognose `unbekannt` gilt kein Meilenstein des
  Plans für diesen Verbund — dann steht dort das Label, nicht die Tageszahl der
  Frist (`restzeitText`). 300 von 1767 Verbünden traf
  das, 44 davon mit einer freundlichen positiven Tageszahl.
- **Ein Wort je Uhr** (v6.66, [uhrWorte.ts](../../src/core/utils/uhrWorte.ts)).
  Ein Meilenstein ist „gerissen" bzw. „fällig in N T" — in der Gliederung und
  unter „Diese Woche" steht die Dauer („gerissen seit N T", im Titel „seit N
  Tagen gerissen"), nie „N T über" oder „überfällig". Die Frist sagt
  `fristTageWort` („N Tage über der Frist" / „noch N Tage" / „heute fällig"),
  der Stillstand `bewegungWort`. Die Gruppe unter „Diese Woche" heißt „Gerissen",
  die gebündelte Zeile „zuerst gerissen …" (vorher „hängt seit", das Wort des
  Stillstands). Guard `ueberfaellig-nur-fuer-die-frist`.
- **Kein Nenner im Verborgenen.** Die Reißquote je Knoten teilt durch
  `betrachtet`; die Spalte steht deshalb in der Tabelle. Vorher las man
  „0 | 1158 | 79 %".
- **Der heutige Tag ist ein eigener Fall.** `restTageBis` normalisiert `-0` zu
  `0`, die Anzeige schreibt „heute fällig" — `Math.ceil` liefert für einen
  Termin von heute Mitternacht `-0`, und `-0 < 0` ist `false`.
- **Geklemmt heißt markiert.** Ein Ist-Termin vor Woche 0 (Anker = spätester
  wirksamer Eingang, Ist-Feld datiert früher) wird in der Leiste als Dreieck am
  Achsenanfang gezeichnet und in der Auswertung mit ⚠ + `VOR_EINGANG_HINWEIS`
  erklärt, statt als Punkt auf „Eingang" zu sitzen (471 Ergebnisse in 426 von
  1767 Verbünden).
- **Zähler und Kachel zählen dasselbe.** Der Auswertungs-Reiter zählt nur
  Abschlüsse mit rechenbarer Dauer; die übrigen (Abschluss vor Eingang) werden
  benannt statt verschwiegen.
- **Ein Filter darf keine Tatsache behaupten.** Die Leere der Wochenliste sagt,
  dass „nur meine" sie zuschneidet, wenn das der Fall ist.
- **Text braucht Text-Tokens.** Beschriftete Zustände nutzen
  `ZUSTAND_TEXT_FARBE`, nicht die Marken-Palette (Rahmen-Tokens kamen als Schrift
  auf 1,2–1,4:1).
- **Der Plan sagt, wenn er sich selbst widerspricht.** Liegt die späteste
  fristrelevante Soll-Woche hinter der Gesamtfrist (`planEndeTage`), steht das in
  Konfiguration und Auswertung — sonst ist jeder Verbund „nicht haltbar" und drei
  der fünf Prognose-Chips filtern dauerhaft ins Leere.
- **Es steht da, welche Fassung gilt.** Die Auswertungs-Reiter nennen die
  ausgewertete Fassung und einen abweichenden Entwurf; die Speicherleiste bleibt
  auf jedem Reiter sichtbar, solange der Entwurf abweicht.

### Eingangs-Zeitraum und gemerkte Ansicht

Der **Eingangs-Zeitraum** (Jahres-Chips, taggenaue Von-Bis-Felder, „Alle
Eingänge") liegt auf der Seite und nicht in den Tabs: einmal eingrenzen, Ergebnis
durchreichen. Er gilt für **alle drei Auswertungs-Reiter**, „Diese Woche"
eingeschlossen (seit v2.358) — Vorgänge von vor drei Jahren sind kein Rückstand,
sondern Altbestand mit unsauber gesetzten Status, und sie stellten 1771 der 1836
Zeilen der Arbeitsliste. Über „Alle Eingänge" bleiben sie einen Klick entfernt.
Vorbelegt sind das laufende Jahr und die beiden davor — deckungsgleich mit der
Chip-Leiste, damit die Vorauswahl sichtbar ist.

Der **Betrachtungsbereich** (Chip im Seitenkopf) liegt darüber und gilt für
beide Hälften des Stands: offene Verbünde **und** Abschlüsse. Bis v4.118 lief die
Dauer-Auswertung über den Vollbestand, während die Übersicht daneben gefiltert
war (2.046 gegen 5.885) — zwei Grundgesamtheiten unter einem Chip.

Die **Ansicht wird gemerkt**
([ansichtPersistenz.ts](../../src/plugins/meilensteine/ansichtPersistenz.ts)):
aktiver Tab (Standard „Diese Woche"), Zeitraum, die Pills der Übersicht und „nur
meine" beider Listen. Reine UI-Preference → ein localStorage-Key
`teamflow_meilensteine_ansicht`, defensiv gelesen, unbekannte Werte fallen still
weg. Drei Feinheiten, die den Code erklären:

- **Der Suchtext wird bewusst NICHT gemerkt.** Ein Zeitraum und eine Pill sind
  beim Öffnen als aktiv erkennbar, ein alter Suchbegriff filtert unauffällig
  weiter. Verworfen wird er im Persistenz-Modul, nicht beim Aufrufer.
- **„Alle Eingänge" braucht einen Sentinel** (`'alle'`): sonst wäre die bewusste
  Wahl beim Lesen nicht von „noch nie etwas gespeichert" zu unterscheiden und
  spränge jedes Mal auf den Jahres-Standard zurück.
- **„nur meine" startet an, sobald ein eigenes Kürzel gesetzt ist**
  (`standardFilter`), ohne Kürzel immer aus — sonst blendete der Filter alles aus
  und der Schalter dazu ist gar nicht sichtbar.
- **Ein gemerkter Zeitraum muss ein echter Tag sein.** Die Ziffernform allein
  genügt nicht (`2024-13-99` besteht sie): ein solcher Wert filterte die Seite
  auf null, ohne sichtbar zu sein — kein Chip aktiv, beide Datumsfelder leer,
  weil `<input type="date">` ihn nicht annimmt. `istIsoTag` prüft darum den Tag
  selbst und `von <= bis` dazu.
- **Ein unsichtbarer Reiter überschreibt die gemerkte Wahl nicht.**
  `useSichtbareReiter` bekommt den reinen State-Setter, nicht den merkenden:
  die Korrektur auf einen sichtbaren Reiter ist eine Notlage der Sitzung, keine
  Wahl des Nutzers.

**Das eigene Kürzel folgt dem app-weiten Vertrag**
([bearbeiterFilter.ts](../../src/plugins/antraege/bearbeiterFilter.ts)): getrimmt,
**uppercase**, komma-getrennt (Vertretung), und `alle` heißt „kein Kürzel". Die
Kürzel der Verbünde kommen aus `tib_kuerz` **und** `bib_kuerz` und liegen in
zwei Formen vor — `kuerzel` (Vergleich, NFC+upper) und `kuerzelAnzeige`
(Schreibweise der Daten, nur zum Beschriften, Guard
`anzeigetokens-nur-anzeigen`). Bis v4.118 verglich das Modul roh und
zeichengenau: `ATh` traf, `ATH` nicht — bei 81 gemischt geschriebenen Kürzeln von
112 war „nur meine" für die meisten eine leere Liste.

Der **Bedingungs-Editor**
([BedingungEditor.tsx](../../src/plugins/meilensteine/BedingungEditor.tsx)) ist
domänenfrei gegenüber den Meilensteinen — er kennt nur `Bedingung` und bedient
deshalb auch die To-do-Regeln des Status-Cockpits und den Dialog „Eigene Spalte".
Zahlen platziert er nur: sie kommen als Render-Funktionen herein — `probe(gruppe)`
für den Kopf einer Karte, `trefferBlatt(blatt, pfad)` für eine Bedingung,
`kennzahlFeld(feldId)` für die Feld-Suche. Der Editor weiß nichts von
„offen/abgeschlossen"; die beiden anderen Aufrufer reichen nichts herein und
zeigen deshalb keine Zahlen.

### Der Bedingungs-Bereich

Der Bereich unter „Erfüllt, wenn" ist viermal an derselben Frage umgebaut worden
— vollständig, aber nicht zu bedienen (v5.3), Geschwister lasen sich als
Untergruppen (v6.3), „noch nicht intuitiv und übersichtlich genug, gerade bei
komplexeren und verschachtelten Gruppen" (v6.59), „immer noch nicht sehr
übersichtlich" (v6.60: vier Entwürfe und ein klickbarer Prototyp mit echten
Zahlen, gewählt „Karten nebeneinander" mit den Schaltern aus Variante C3 —
[Spec](../superpowers/specs/2026-09-11-regelbereich-karten.md)). Der
Feld-Wähler war dabei das, was die PL lobte. Der Ist-Zustand:

**Karten statt eingerückter Liste.** Die Regeln des Plans haben fast immer die
Form „alle von: eine von …" — eine Wurzel über wenigen Gruppen. Das liest sich
nebeneinander auf einen Blick:

- **Der Kopfsatz** über allem (`bedingungKopfsatz`,
  [bedingung-text.ts](../../src/core/status/bedingung-text.ts)): „Erfüllt, wenn
  „PreCheck AB" und „PreCheck FB" zutreffen." Er nennt nur die Teile der
  **obersten** Ebene — eine Gruppe mit ihrem Namen oder als „Gruppe n", eine
  Einzelbedingung mit ihrem Satz; was in einer Gruppe steht, sagt deren Karte.
  Das Verb folgt der Verknüpfung („zutreffen" / „zutrifft"); ab vier Teilen
  wird der Satz generisch („Erfüllt, wenn alle 4 Teile zutreffen."), sonst läse
  er sich als Aufzählung. Überfahren zeigt die Quellspalten.
- **Jedes Kind der Wurzel ist eine Karte**, nebeneinander und umbrechend: eine
  Gruppe als Karte mit Name, Verknüpfungstext („alle müssen zutreffen" / „eine
  genügt", ab zwei Bedingungen), ⋯, Probe-Slot und ihren Bedingungen; eine
  Einzelbedingung als kleine Karte ohne Kopf. Beide äußeren Karten wachsen mit
  der Reihe (`KARTEN_BREITE`: Grundbreite 380 px, höchstens 480, mindestens
  260): bei voller Fensterbreite stehen drei nebeneinander, in schmalen Wirten
  (To-do-Detail, Dialog „Eigene Spalte") eine je Zeile. Maßstab ist der
  Feldname — feste 320 px schnitten ihn ab. Eine Gruppe in einer Gruppe ist
  eine **Innenkarte** (getönt, Platzhalter „Gruppe 1.1"), rekursiv bis zum
  Deckel von 6 Ebenen, der sich ansagt. Eine Innenkarte mit genau einer
  Bedingung sagt „wirkt wie die Bedingung allein" und bietet „Auflösen" an.
- **Angelegt wird an zwei Stellen**: „+ Bedingung" und „+ Gruppe" **unter** der
  Kartenreihe legen auf oberster Ebene an, der Fuß jeder Karte „+ Bedingung"
  und — nur in äußeren Karten — „+ Gruppe". Die gestrichelte Karte am
  Zeilenende ist mit v6.64 entfallen: sie hielt rund 140 px — 12 % der
  Bereichsbreite von 1 195 px — für zwei Knöpfe frei, die den Blick nichts
  angehen, solange man liest; die Karten sind dadurch von 458 auf 480 px
  gewachsen (gemessen 12.09.2026, dev:local, 1500 × 1100). Eine leere
  Gruppe sagt, was sie wert ist: „Leer = immer erfüllt" unter „alle", „Leer =
  nie erfüllt" unter „eine".
  **Alle vier Knöpfe sind Angebote, keine Aussagen** (`ANLEGEN_STIL`): mager
  (400) und sekundärfarben statt der halbfetten Knopf-Vorgabe (500), Textfarbe
  erst beim Überfahren — sie standen sonst kräftiger da als die Bedingung, um
  die es geht. **Der Fuß einer Karte erscheint erst unter der Maus**
  (`FUSS_AUF_HOVER`, dazu `group/karte` für äußere und `group/innenkarte` für
  innere Karten, damit eine Innenkarte den Fuß der Elternkarte nicht mitzieht):
  ohne das standen innen und außen zwei gleich aussehende Paare rund 40 px
  übereinander, die Verschiedenes tun — in diese Gruppe einfügen vs. eine neue
  Karte anlegen. Verborgen wird per `opacity`, nicht per `display`: der Platz
  bleibt reserviert (kein Springen) und die Tastatur erreicht die Knöpfe über
  `focus-within`. Die Knöpfe **unter** der Reihe bleiben immer sichtbar.
  Bekannte Grenze: Tailwind hängt `group-hover` an `@media (hover: hover)` — auf
  einem reinen Tastbildschirm bliebe der Fuß unsichtbar, für eine `file://`-App
  auf Windows-Arbeitsplätzen in Kauf genommen.
- **Eine Bedingung ist eine Zelle**
  ([BlattZeile.tsx](../../src/plugins/meilensteine/BlattZeile.tsx)): oben das
  Feld, darunter Vergleich, Wert und — bei den Meilensteinen — die Treffer. Der
  Feld-Wähler steht dort in der `variante: 'leise'` (nur der Feldname mit
  gepunkteter Unterkante): ein Dutzend gerahmter Felder übertönte die Regel.
  Dort bricht der Name um statt abgeschnitten zu werden — er ist das, was die
  Bedingung ausmacht, und muss ohne Tooltip lesbar sein. Aus demselben Grund
  trägt er `font-medium`: 500 ist das schwerste Gewicht der Skala im
  [DESIGN_GUIDE](../../DESIGN_GUIDE.md) (Bold kennt das System nicht), also
  dasselbe wie ein Kartentitel. Das gilt in jeder Bedingungs-Karte, auch im
  To-do-Regel-Detail und im Dialog „Eigene Spalte".
  **Griff und ⋯ erscheinen nur an der Zelle unter der Maus oder im Fokus**
  (`focus-within`, per Tab erreichbar) — ein Dutzend Bündel nebeneinander war
  das Rauschen, das die PL „nicht übersichtlich" fand.
- **Gruppen klappen nicht zu.** Die Karten sind kompakt, und der Kopfsatz sagt
  die Regel; eine Klappe je Gruppe hätte nur Pfade gemerkt, die jeder Umbau
  verschiebt.

**Der Verbinder ist der Schalter**
([BedingungsFugen.tsx](../../src/plugins/meilensteine/BedingungsFugen.tsx)).
Zwischen zwei Karten und zwischen zwei Bedingungen einer Karte steht eine Pille
„UND" / „ODER". Ein Klick schaltet über `mitVerknuepfung` (Kinder und Name
bleiben) die Verknüpfung **der ganzen Gruppe** — alle Verbinder derselben
Gruppe wechseln zugleich, weil es EINE Verknüpfung ist. Der `title` sagt vorher,
was der Klick tut; über dem Kopfsatz steht „„und" / „oder" anklicken schaltet
um". Die Pille ist getönt (`--tf-primary-light` / `--tf-primary`), ungetönt
läse sie sich als Text. Damit steht die Verknüpfung genau **einmal** da, dort,
wo man die Regel liest — nicht zusätzlich als Schalter „alle | eine" im Kopf
und als Wort in einer Rinne. **Die Schreibweise trennt Schalter von Text**
(v6.64): die schaltbare Pille schreibt groß, wie es der Kurzsatz des
Formatierers und die Zelle „Erfüllt, wenn" längst tun („TIB gefüllt UND BIB
gefüllt"); ohne `onSchalte` bleibt der Verbinder ein bloßes, klein
geschriebenes Wort (zwischen den Unter-Meilensteinen eines Sammel-Meilensteins,
siehe unten).

**Gruppen tragen einen Namen** (`name?: string` an `{alle}`/`{einige}`,
[typen.ts](../../src/core/status/typen.ts)), direkt im Kartenkopf editierbar.
Ohne Namen steht der Platzhalter „Gruppe n" (in einer Innenkarte „Gruppe n.m")
— 1-basiert unter den Geschwister-Gruppen derselben Liste, nie gespeichert, er
wandert mit der Position; der Kopfsatz zählt genauso. Übernommen wird mit Enter
oder beim Verlassen, Esc verwirft: jede Übernahme ist eine Änderung am Plan, und
ein halb getippter Name soll nicht im Kopfsatz stehen. Die Wurzel hat keinen
Namen — sie ist der Meilenstein.

- **Ohne Wirkung, aber sichtbar.** `pruefeBedingung` liest den Namen nie. Im
  Kurzsatz steht er **vor** dem Inhalt, nie statt seiner — „PreCheck AB: (…
  ODER …)" ([bedingung-text.ts](../../src/core/status/bedingung-text.ts)); der
  Name allein verbärge, was geprüft wird, und genau dort entstehen falsche
  Regeln. Der Kopfsatz darf ihn allein nennen, weil die Karte darunter den
  Inhalt zeigt.
- **Er übersteht jeden Umbau**, weil jede Gruppe über die eine Stelle
  `baueGruppe` entsteht ([bedingung-baum.ts](../../src/core/status/bedingung-baum.ts)):
  `mitGruppenKindern`, `mitVerknuepfung`, `benenneBedingungsGruppe` und
  `dupliziereBedingung` laufen hindurch. Umschalten, Kinder-Tausch und Laden
  sind die drei Stellen, an denen ein Name sonst still verloren ginge (Laden:
  siehe Persistenz). `benenneBedingungsGruppe` trimmt, kappt auf
  `MAX_GRUPPENNAME` (80, eine Quelle für Editor und Normalisierung) und
  **entfernt** das Feld bei leerem Namen, statt `name: ''` zu speichern.
  Verpacken legt eine **unbenannte** Hülle um eine benannte Gruppe.

**Das ⋯-Menü — die Einträge bestimmt der Aufrufer**
([ZeilenAktionen.tsx](../../src/plugins/meilensteine/ZeilenAktionen.tsx)).
`ZeilenAktionen` nimmt eine Liste von `AktionsEintrag` (Icon, Beschriftung,
gesperrt mit Grund, Gefahr, Trennlinie davor); dieselbe Machart, verschiedene
Wörter:

- **Karte**: Nach links · Nach rechts · Duplizieren · „Auflösen — ändert
  nichts" bzw. „Auflösen — ändert die Aussage" · Aus der Gruppe lösen (nur
  Innenkarten) · Gruppe entfernen. Äußere Karten haben keinen Griff — sie
  wandern über das Menü.
- **Bedingung**: Nach oben · Nach unten (als Einzelkarte: Nach links · Nach
  rechts) · „Zur Gruppe machen" (Einzelkarte) bzw. „In eine eigene Gruppe
  verpacken" · In die Gruppe davor · Aus der Gruppe lösen · Bedingung
  entfernen.
- **Duplizieren** (`dupliziereBedingung`) setzt die Kopie direkt hinter das
  Original; eine benannte Gruppe heißt danach „Name (Kopie)", sonst wären zwei
  Karten im Kopfsatz nicht zu unterscheiden. Anlass: FB- und AB-Schriftstück
  (MST 4.1 und 4.2) sind spiegelgleich gebaut.
- **Auflösen** (`loeseGruppeAuf`) setzt die Kinder an die Stelle der Gruppe, in
  ihrer Reihenfolge. **Die Beschriftung sagt vorher die Wahrheit**
  (`aufloesenAendertAussage`): „ändert nichts" nur, wenn die Gruppe genau ein
  Kind hat oder dieselbe Verknüpfung wie ihre Eltern trägt. Auch eine **leere**
  Gruppe ändert die Aussage — eine leere „eine" unter „alle" ist immer falsch
  und hält die Eltern falsch; fällt sie weg, kann die Regel plötzlich zutreffen.
- **Eingerückt wird nur in eine Gruppe, die schon dasteht** („In die Gruppe
  davor"). Vorgänger und Knoten stillschweigend in eine neu erfundene Gruppe zu
  stecken, änderte die Aussage der Regel, ohne dass jemand eine Verknüpfung
  gewählt hätte. **Genau einen** Knoten zu verpacken
  (`verpackeBedingungInGruppe`) ist dagegen bedeutungsneutral — eine Gruppe mit
  einem Kind wertet unter `alle` wie unter `einige` identisch aus. Der Umbau
  rechnet in der reinen [bedingung-baum.ts](../../src/core/status/bedingung-baum.ts)
  über Kind-Index-Pfade (`Bedingung` kennt keine Ids).
- **Ohne Maus erreichbar** (Radix-DropdownMenu: Tab auf ⋯, Enter,
  Pfeiltasten). Tastatur-Ereignisse enden am Menü: es liegt im Portal, React
  reicht seine Ereignisse aber durch den Komponenten-Baum, und dort verschöben
  die Pfeiltasten des Meilenstein-`TfTree` die Auswahl.
- **Ein gesperrter Eintrag sagt, warum.** Er bleibt sichtbar und nennt den
  Grund in einer zweiten Zeile, statt zu verblassen („Nur möglich, wenn direkt
  davor eine Gruppe steht."). Gesperrt `--tf-text-tertiary`, der Grund
  `--tf-text-secondary` (5,33:1), weil er Bedeutung trägt.
- **[dropdown-menu.tsx](../../src/components/ui/dropdown-menu.tsx) ist nach
  `context-menu.tsx` gebaut, ohne Animation.** Die shadcn-CLI (4.21)
  installierte ein fremdes npm-Paket `cn` und importierte `cn` von dort (wieder
  deinstalliert), und ihre Ausblend-Animation hielt das geschlossene Menü über
  eine Sekunde mit `pointer-events: auto` im DOM.

**Gezogen wird ohne `TfTree`.** Er wäre die architekturtreue Wahl, liefe hier
aber INNERHALB des `body`-Slots des äußeren Meilenstein-`TfTree` — zwei
Drag-Instanzen im selben Ereignispfad. Stattdessen native Drag-Ereignisse, an
der Wurzel des Editors gestoppt, mit dem gezogenen Pfad im **Zustand** statt im
`dataTransfer`: der Zug verlässt diesen Editor nicht, und eine aus dem
Betriebssystem gezogene Datei bleibt wirkungslos. Gezogen werden Bedingungen
und Innenkarten am Griff. Abgelegt wird, vom Feinen zum Groben: auf
Einfüge-Marken **zwischen** den Bedingungen einer Karte, an der **näheren Kante**
einer Zelle (obere Hälfte = davor), auf die **Karte selbst** (an ihr Ende) und
auf die **Kartenreihe** (ans Ende der Wurzel, greift in den Lücken). Die feinere
Geste gewinnt, weil Marken und Zellen ihre Ereignisse stoppen. Nie auf einer
Zelle selbst — „davor" und „hinein" wären nicht zu unterscheiden. Ziele zeigen
sich, sobald ein Zug läuft: wer nicht weiß, dass es Ziele gibt, sucht keine.

**Klicks im Regelbereich meinen den Regelbereich.** Die Karten sind Flächen; ein
Klick daneben, auf die Karte statt auf ein Feld, klappte den ganzen
Regelbereich zu, weil der Zeilen-Klick des Konfigurations-Reiters nur
Bedienelemente ausnahm. Der Regelbereich trägt deshalb `data-regelbereich`, und
`[data-regelbereich]` steht neben `[role="menu"]` in den `BEDIENELEMENTE` —
ohne `[role="menu"]` klappte „Nach oben" den Bereich zu.

- **Ein Feld wird gewählt, nicht gesucht.** Das nackte `<select>` ist dem
  geteilten [FeldWaehler](../../src/components/ui/FeldWaehler.tsx) gewichen:
  Suche über Kürzel, Beschreibung und rohen Spalten-Code, sortierbare Köpfe
  (Kürzel · Beschreibung · Programm-Deckung, dritter Klick zurück in die
  Katalog-Reihenfolge), Filter-Chips für Typ und Herkunft, Tastatur ↑/↓/Enter.
  Er sitzt im `BedingungEditor` und wirkt damit an **allen drei** Aufrufern,
  zusätzlich am „Ist-Termin aus Feld" (`nurTyp: 'datum'`, dort in der
  gerahmten Standard-Variante). Die Deckungs-Spalte blendet sich aus, wo der
  Vorrat synthetisch ist (To-do-Regeln) — eine leere Spalte behauptete sonst
  eine Zahl, die es nicht gibt. **Bei den Meilensteinen ersetzt eine Kennzahl
  die Deckung** (`kennzahl` + `kennzahlTitel`): die Spalte „offen · abg."
  nennt je Feld, bei wie vielen Verbünden es gefüllt ist (`zaehleFeld`, siehe
  Probe am Bestand) — auch für ein Feld, das der Plan noch nicht benutzt.
- **Vorschläge aus Bezeichnung + Schema**
  ([feld-vorschlag.ts](../../src/core/meilensteine/feld-vorschlag.ts), rein):
  Token-Abgleich gegen Spalten-Label, `feldId` und `quellCodes`, plus eine
  benannte Synonym-Tabelle für das, was der Spaltenname nicht hergibt
  („zugewiesen" → `tib_kuerz`). **Kein Zugriff auf Antrags-Daten** — der Plan
  wird bearbeitet, bevor ein Bestand geladen ist. Zwei Filter halten den
  Vorschlag ehrlich: Benennungs-Felder (Titel, Kennzeichen, ausführende Stelle)
  scheiden aus, weil sie ab Tag eins gefüllt sind, und Wörter, die jeden
  Meilenstein betreffen („Antrag"), zählen nicht. Trifft nichts, steht nichts da.
  Ein Meilenstein ohne Bedingung bekommt die Zeile „Vorschlag … [Übernehmen]" —
  ein Klick, nie automatisch.

**Der Meilenstein um den Regelbereich**
([MeilensteinZeile.tsx](../../src/plugins/meilensteine/MeilensteinZeile.tsx),
[KonfigurationTab.tsx](../../src/plugins/meilensteine/KonfigurationTab.tsx)).
Die zugeklappte Liste folgt einem Entwurf von Claude Design (v6.62), der
aufgeklappte Regelbereich nicht. Bis dahin trug jede Zeile ihre eigenen
Beschriftungen („Woche", „gilt für"). Bei 1 360 px brach der rechte Block in
jeder Zeile um, und die Regel wurde abgeschnitten:

- **Die Liste ist eine Tabelle mit Spaltenköpfen** (`SpaltenKopf`,
  `KnotenZeile`): Nummer · Meilenstein · Erfüllt, wenn · Zuordnung · Woche ·
  Zustand (aktiv, Frist) · Gilt für. Kopf und Zeile lesen dieselben festen
  Spaltenbreiten (`SP`). Der Kopf baut außerdem das Gerüst der Zeile (Griff,
  Chevron, ⋯) mit Platzhaltern gleicher Breite nach — ein Kopf mit eigenen
  Maßen liefe beim ersten geänderten Abstand still auseinander.
- **Bündig über alle Ebenen.** Der Baum rückt Unter-Meilensteine um `EINZUG`
  (18 px) je Ebene ein, und die Titelspalte wird um genau diesen Einzug schmaler
  (`clamp(200px, 28cqw, 420px)` minus Einzug). Sonst stünde „Erfüllt, wenn" je
  Ebene versetzt. `cqw` misst den Tabellen-Container, nicht das Fenster. Unter
  990 px Tabellenbreite (Summe der Mindestbreiten; „Erfüllt, wenn" hält 220 px)
  scrollt die Tabelle im eigenen Container waagerecht, die Seite nicht.
- **Felder sehen wie Text aus**, bis man sie überfährt oder fokussiert
  (Bezeichnung, Woche). Die Bezeichnung wächst auf bis zu drei Zeilen, darunter
  steht „N Unter-Meilensteine". Die Höhe misst ein Callback-Ref, der Rand
  zählt mit — ohne ihn lief jedes einzeilige Feld 2 px über und zeigte einen
  Scrollbalken. In einer inaktiven Zeile stehen Bezeichnung und Regel in
  Sekundärfarbe.
- **„Erfüllt, wenn" zeigt die oberste Ebene der Regel** (`bedingungUebersicht`).
  Einzelbedingungen stehen als Satz, Gruppen nur mit Namen oder „Gruppe n",
  dazwischen ein kleines UND/ODER, Feldnamen hervorgehoben. Darunter stehen
  „N Bedingungen in M Gruppen" und „Ist-Termin: …". Den vollen Satz und die
  Quellspalten nennt der Tooltip (`knotenQuellen`). Die Zelle bleibt auch bei
  offenem Regelbereich stehen: sie ist die Zeile, der Bereich ihr Detail. Ohne
  Bedingung steht beim Sammel-Meilenstein „wenn alle aktiven Unter-Meilensteine
  erreicht sind", sonst „keine Bedingung — wird nicht geprüft" (rot nur bei
  aktivem Knoten).
- **Befunde der Probe stehen als Warn-Dreieck** am Ende von „Erfüllt, wenn"
  (`knotenBefunde`, dieselben Fakten wie in der Probe-Zeile, siehe Probe am
  Bestand; der Tooltip nennt sie). Sie melden die Regel, nicht die Woche. Ein
  Dreieck statt eines Punkts, weil gleich daneben der Punkt der Zuordnung in
  derselben Farbe steht.
- **Die Zuordnung wird in der Oberfläche bestätigt.** Die Spalte zeigt
  „● unbestätigt" bzw. „● bestätigt", ein Klick schaltet `unbestaetigt` um;
  derselbe Schalter steht im ⋯-Menü. Bis v6.61 setzte nur der
  Auslieferungs-Plan das Feld, und die Oberfläche kannte keinen Weg zurück.
  Bestätigen ist eine Planänderung im Entwurf wie jede andere: gespeichert als
  neue Fassung, wirksam erst mit der Freigabe. `aktiv` bleibt davon unberührt.
  Die Pille „N Zuordnungen unbestätigt" in der Werkzeugleiste zählt mit.
- **„Gilt für" ist eine verbundene Mehrfachauswahl** (`TypSchalter`,
  `aria-pressed` je Typ; nicht `SegmentedToggle`, das ist eine Einfachauswahl).
  Gewählt ist dunkel gefüllt wie eine aktive Filter-Pill. Die Abwahl des letzten
  Typs ist gesperrt, weil leer „gilt für alle" hieße; der gesperrte Knopf bleibt
  gefüllt. Alle vier gewählt wird wieder zur leeren Liste.
- **Griff und ⋯ erscheinen beim Überfahren.** Sie werden über die Deckkraft
  eingeblendet, damit die Breite bleibt; bei Tastaturfokus, offenem Menü und
  offenem Regelbereich stehen sie fest. Die Umbau-Schalter liegen im ⋯-Menü
  (`ZeilenAktionen`), und das Kontextmenü zeigt dieselbe Liste
  (`meilensteinAktionen`): Nach oben · Nach unten · Eine Ebene höher ·
  Unter-Meilenstein anlegen · Zuordnung bestätigen bzw. wieder als unbestätigt
  markieren · Stilllegen bzw. Wieder aktivieren · Löschen. „Nach oben/unten"
  sind der Weg ohne Maus. Ein gesperrter Eintrag bleibt stehen und nennt seinen
  Grund („Ist schon ein Haupt-Meilenstein.").
- **Ein Sammel-Meilenstein** (keine eigene Bedingung, aber Unter-Meilensteine)
  zeigt seine Unter-Meilensteine als Karten: Nummer, Bezeichnung, „erfüllt bei
  … offen · … abgeschl."; ein Klick öffnet den Unter-Meilenstein. Die Zahlenzeile
  steht in EINER Zeile (Karte 208 px breit, gemessen 12.09.2026: die Zeile misst
  179 px und brach in der alten Karte dreifach um), alle Karten der Reihe bleiben
  dadurch gleich hoch. Zwischen den
  aktiven steht „und" als bloßes Wort — die Eltern-ODER-Regel verlangt immer
  alle relevanten Kinder, da gibt es nichts zu schalten —, inaktive stehen
  gestrichelt am Ende und „zählen nicht mit". Darunter „Oder eine eigene
  Bedingung — dann ist er auch erreicht, sobald sie zutrifft" mit dem Editor.

Zelle und Tooltip gehen durch den EINEN Formatierer
([bedingung-text.ts](../../src/core/status/bedingung-text.ts)). Eine
Einzelbedingung entsteht als Folge von `SatzTeil`en mit Rolle (feld, wert,
text, verknuepfung, gruppe). `bedingungAlsText` fügt genau diese Teile zum Satz
zusammen, `bedingungUebersicht` gibt sie der Zelle zum Hervorheben — wortgleich,
belegt je Operator in
[bedingung-uebersicht.test.ts](../../src/core/status/__tests__/bedingung-uebersicht.test.ts).
Kopfsatz und Übersicht zählen Gruppen über dieselbe Aufzählung (`obereEbene`),
damit „Gruppe 2" an beiden Stellen dieselbe Karte meint. Der Formatierer nimmt
seit v5.2 wahlweise eine Katalog-Fassung **oder** einen Namens-Auflöser
(`FeldLabelQuelle`) — der Meilenstein-Plan hat keine Fassung, und ein zweiter
Formatierer liefe beim ersten neuen Operator still auseinander. Der Guard
`quellspalten-an-bedingungen` zählt `bedingungUebersicht(` mit.

Aus dem Entwurf bewusst **nicht** übernommen:

- „nur bei positiver Ersteinschätzung" als Eigenschaft mit Link-Symbol. Das ist
  nur Titeltext; die Bewertung kennt allein `aktiv` und den Antragstyp
  (`istRelevant` in [bewertung.ts](../../src/core/meilensteine/bewertung.ts)).
  Gemessen (11.09.2026, dev:local, Richtlinie 2025, Fassung 41 vom Share,
  `bewerteVerbund` über den Ladeweg der Probe): 459 der 1 793 Verbünde haben
  4.5 „Abl/RNE versendet" erreicht (200 offen, 259 abgeschlossen). Davon stehen
  an MST 5 184 offene und 258 abgeschlossene auf „gerissen", an MST 6 102 und
  259. Zum Maßstab: auch ohne sie sind 864 von 1 117 übrigen offenen an MST 5
  gerissen — die negativen machen 184 von 1 048 gerissenen offenen aus. Und die
  Regeln sind selbst nicht „nur positiv": MST 5 prüft auch „Widerspruch zur
  Ablehnung" und „Stellungnahme zur Rücknahmeempf.", MST 6 auch
  „ablehnungsreif"; eine positive Ersteinschätzung hat keinen eigenen Knoten
  (der Sammel-MST 4 „Ersteinschätzung positiv …" enthält 4.5 selbst). Titel und
  Bedingung widersprechen sich — ob MST 5/6 für negative Verbünde gelten,
  entscheidet die PL, bevor eine Voraussetzung ins Datenmodell kommt.
- Der Satz „erscheint im Antragsdetail" am Beschreibungsfeld: die Beschreibung
  liest nur der Editor. Der Platzhalter bleibt „Beschreibung (optional)".
- Verkürzte Bedingungstexte ohne „ist": sie hätten den einen Formatierer überall
  geändert. Außerdem der Befund-Punkt an der Woche, der Pfeil als Öffner des
  Regelbereichs (bei uns klappt er die Unter-Meilensteine auf) und der
  weggelassene Knopf „+ Meilenstein".

Aus dem **zweiten** Entwurf („die Zusatz-Dinge leiser, die Bedingungen lauter",
v6.64) ist alles übernommen, was ein echtes Delta war — leise Zeile statt
Kasten, Ist-Termin als eigene Zeile, Gruppen-Zahl im Kartenkopf, „+ Bedingung"
unter den Karten. **Nicht** übernommen:

- „abg." statt „abgeschl.": `zahlenText` ist geteilt — das gäbe zwei
  Schreibweisen im selben Bild.
- Der Kopfsatz „TIB UND BIB zutreffen" ohne Operator. Bei „ist nicht gefüllt"
  wäre der Satz schlicht falsch; er behält „TIB gefüllt".
- „kein Datum" als Satzpräfix statt gelber Marke. Die **Befund-Marke** ist in
  [CONTEXT.md](../../CONTEXT.md) definiert und bleibt eine Marke.
- Die Kartenbreite aus dem Bild abgeleitet: ein Entwurfsbild ohne bekannten
  Maßstab liefert keine Pixel.

### Probe am Bestand

Anlass (PL, 11.09.2026): „Würde man dann beim Bauen der Meilensteine sehen,
welche Auswirkungen diese haben?" Bis dahin zeigte sich eine Regel erst nach
Speichern, Freigeben und Neuberechnen. Jetzt stehen die Zahlen an drei Stellen
des Regelbereichs, und **jede Zahl trägt ihre Beschriftung** — die PL fragte am
Prototyp „warum sind immer zwei zahlen hinter den feldnamen?":

- im **Kopf jeder Karte**, rechts, „trifft 1.000 offen · 359 abgeschl." — als
  bloße Zeile, **ohne Balken** (v6.64): er stand unter derselben Zahl, die
  daneben schon in Worten steht, und nahm jeder Karte zwei Zeilen Höhe;
- an **jeder Bedingung** „872 offen · 213 abgeschl.";
- in der **Probe-Zeile** unter den Karten (Bauteil `Wirkungsleiste`),
  aufgeklappt in zwei Spalten: **Probe** („erfüllt bei 988 von 1.094 offenen" /
  „347 von 429 abgeschlossenen", je mit Balken) · **gegenüber Fassung n** (siehe
  Vergleich). Die Regel bleibt oben unter sich; was sie am Bestand bewirkt,
  steht an EINER Stelle darunter.

**Die Beschriftung heißt „Probe am Bestand", nicht „Wirkung"** (v6.64): das Wort
gehört laut [CONTEXT.md](../../CONTEXT.md) der Regel-Wirkung der To-do-Regeln —
auf Knopfdruck, über den ganzen Bereich. Zwei Dinge unter einem Namen wären der
Anfang einer Verwechslung. Der Bauteil-Name `Wirkungsleiste` bleibt.

Der Titel jeder Zahl nennt die Gesamtzahlen („… von 1.094 offenen und … von 429
abgeschlossenen Verbünden") und den Satz zur Kontrollgruppe. Dazu kommt die
Spalte „offen · abg." der Feld-Suche (Treffer je Feld, unten). Rechnung rein in
[probe.ts](../../src/core/meilensteine/probe.ts) und
[ist-termin.ts](../../src/core/meilensteine/ist-termin.ts), Laden in
[useMeilensteinProbe.ts](../../src/plugins/meilensteine/useMeilensteinProbe.ts),
Anzeige in [ProbeAnzeige.tsx](../../src/plugins/meilensteine/ProbeAnzeige.tsx);
Entscheidungen und Abweichungen in den Specs
[Probe](../superpowers/specs/2026-09-11-bedingungs-editor-gruppen.md) und
[Karten](../superpowers/specs/2026-09-11-regelbereich-karten.md). Nur das
Meilenstein-Modul reicht Zahlen in den Editor.

- **Die Probe-Zeile startet zugeklappt** (PL, 12.09.2026: „card probe bitte
  collapsible machen, und standard einklappen"). Wer eine Regel schreibt, sieht
  zuerst die Regel; ein Klick klappt die zwei Spalten auf. Der Zustand gilt für
  den ganzen Reiter und überlebt den Reload (`wirkungOffen` im bestehenden
  Ansichts-Schlüssel,
  [ansichtPersistenz.ts](../../src/plugins/meilensteine/ansichtPersistenz.ts)).
  **Zugeklappt ist sie eine leise Zeile, kein Kasten** (v6.64): ohne Rahmen,
  ohne Füllung, ohne Kolben-Symbol, 25 px statt 33 — Rahmen und Tönung machten
  die Nebensache zum lautesten Element des Regelbereichs. Der Kasten erscheint
  erst beim Aufklappen, wo er die Spalten trennt.
- **Die Kurzfassung sagt beide Zahlen und das Vergleichswort**: „erfüllt bei
  988 von 1.094 offenen · 347 von 429 abgeschlossenen · unverändert gegenüber
  Fassung 43", dazu der Befund der Regel (erfüllt bei allen/keinem). Auch
  „unverändert" steht da — das ist eine Auskunft, kein Nichts (`vergleichsWort`,
  ein Wort für Spalte **und** Kurzfassung). Die Grundmenge steht nicht mehr vor
  jeder Zahl, sondern im Titel der Zeile und weiter in der Probe-Spalte
  (`probeErklaerung`, ein Titel für beide). Die Marken des Ist-Termins trägt
  seine eigene Zeile, die ohnehin immer sichtbar ist. Damit Kopf und Spalte
  nicht auseinander laufen, steht der Fall-Unterschied in je einer Kaskade
  (`probeZustand`, `vergleichStand`), aus der beide lesen; nur Balken, Deltas
  und Sätze bleiben dem offenen Streifen vorbehalten.
- **Die Grundmenge ist die aktuelle Richtlinie, nicht der Chip im Seitenkopf**
  (`AKTUELLE_RICHTLINIE`, heute Richtlinie 2025 = Programme 136–139); auch der
  Eingangs-Zeitraum wirkt nicht. Die Probe prüft eine Regel und ist kein
  Arbeitsvorrat; der Bereich bleibt ein expliziter Parameter (Pitfall #46), hier
  bewusst ein fester — und die PL wollte es so: „nur für die aktuelle richtlinie,
  dann sind es weniger daten zu laden". Die Anzeige nennt die Grundmenge an jeder
  Zahl.
- **Kein zweiter Evaluator.** Gruppen zählen über `pruefeBedingung`, mit dem
  Nenner des Meilensteins (`nurTypen` über `giltFuerTyp`, dafür aus
  [bewertung.ts](../../src/core/meilensteine/bewertung.ts) exportiert — eine
  zweite Fassung liefe beim ersten neuen Typ still auseinander). Meilensteine
  zählen über `bewerteVerbund`: Eltern-ODER-Regel, `nurTypen` und
  `ohneBedingung` gelten wie in Übersicht und Auswertung; `nichtRelevant` und
  `ohneBedingung` zählen in keinen Nenner („ohne Bedingung — nichts zu zählen").
  Eine Gruppenzahl tragen nur die Karten der obersten Ebene. Die Wurzel nicht:
  in der Probe-Zeile steht die des ganzen Meilensteins, die mit
  Unter-Meilensteinen rechnet — zwei Zahlen für scheinbar dasselbe wären ein
  Widerspruch. Innenkarten nicht: ihre Bedingungen tragen je ihre eigene.
- **Lesepfad.** Der Antrags-Store hat keinen Index auf `unterprogramm_id`, und im
  Bestand steht EIN Programm („default-programm") mit allen 14 225 Anträgen — ein
  Lesen je Programm läse alles. Deshalb wird die Listen-Projektion (24 Felder,
  `getAll` 222 ms) nach Richtlinie gefiltert; nur deren 2 537 Schlüssel
  (1 793 Verbünde: 1 317 offen, 476 abgeschlossen) liest `getAntraegeByKeys` in
  Blöcken zu 500 voll, und jeder Block wird sofort auf die Felder des
  Spalten-Katalogs projiziert — die 461-Feld-Records bleiben nie im Speicher.
  Ladezeit 0,8 s (gemessen 11.09.2026, dev:local, echter Bestand).
- **Einmal laden, dann live.** Angestoßen wird beim ersten Aufklappen eines
  Regel-Bereichs oder Anlegen eines Meilensteins — ein Ereignis, kein
  Mount-Effekt: wer nur die Liste ansieht, lädt nichts. Danach bleibt der Bestand
  im Speicher; die Kontexte werden neu gebaut, wenn sich die **Feldmenge** von
  Entwurf oder Fassung ändert, nicht bei jedem Tastendruck. Stichtag ist der
  Ladezeitpunkt; der Tooltip nennt Umfang, Stand und Ladezeit. Scheitert das
  Laden, steht „nicht möglich — …" mit „Erneut versuchen" (`useAsyncAction`,
  Pitfall #15). Das trennt die Probe von der Regel-Wirkung der To-do-Regeln: die
  läuft auf Knopfdruck über den ganzen Bereich.
- **Vergleich mit der freigegebenen Fassung.** Entwurf und
  `freigegebeneFassung` werden über denselben Bestand gezählt; die rechte
  Spalte der Probe-Zeile sagt „unverändert" oder „geändert", darunter
  „offen ±n · abgeschlossen ±n"; „neu", wenn der Knoten in der Fassung fehlt,
  und „noch keine freigegeben", wenn es keine gibt. Belegt (11.09.2026,
  dev:local, Entwurf zu Fassung 37): MST 3 mit dem Verbinder „oder" statt „und"
  erfüllt 1.080 offen · 415 abgeschl. (+92 / +68).
- **Offen und abgeschlossen getrennt — als Plausibilitätsprüfung.**
  „Abgeschlossen" ist der terminale Leit-Status (Verbund-Status, sonst der des
  ersten Teilvorhabens), derselbe Schnitt wie in der Projektion. Dort müsste fast
  jeder Meilenstein erfüllt sein; trifft eine Bedingung dort wenig, liest sie
  vermutlich die falsche Spalte — die Prüfung, die ein „unbestätigt" im Plan
  nicht leisten kann.
- **Inaktive Knoten zählen in je einem eigenen Lauf**, in dem nur sie aktiv sind
  („inaktiv — gezählt, als wäre er aktiv"). Gerade sie baut die PL: die
  unbestätigten Knoten des Auslieferungs-Plans sind inaktiv. Die übrigen Knoten
  behalten die Zahl des echten Plans — ein zusätzlich aktivierter Kind-Knoten
  verschöbe sonst die Eltern-ODER-Regel seiner Eltern, und die Probe
  widerspräche der Auswertung.
- **Befunde sind Fakten, keine Schwellen** (`probeBefund`). Eine Zahl wird nur
  dann zur gelben **Befund-Marke**, wenn sie nichts unterscheidet: eine
  Bedingung oder Karte „trifft keinen Verbund" / „trifft jeden Verbund", der
  Meilenstein ist „erfüllt bei allen" / „erfüllt bei keinem"; ohne Nenner kein
  Befund. Trifft eine Bedingung jeden Verbund, zählt die Probe die Regel ohne
  sie mit („ohne sie trifft die Regel 870 offen · 220 abgeschl."). Welcher
  Anteil sonst plausibel ist, hängt am Meilenstein und ist nicht gemessen — die
  Zahl steht da, das Urteil fällt die PL. Anlass war der ausgelieferte Plan
  (11.09.2026): „VB Kurzname ist gefüllt" machte MST 4.3 bei allen 1 094
  offenen Verbünden erfüllt, „Status ist Stellungnahme zur Rücknahmeempf." in
  MST 5 traf keinen. Dieselben Befunde sammelt `knotenBefunde` für das
  Warn-Dreieck in der Meilenstein-Zeile.
- **Ausnahme: ein Meilenstein, der nur einen Zeitpunkt misst**
  (`misstNurZeitpunkt`, [ist-termin.ts](../../src/core/meilensteine/ist-termin.ts)).
  Verlangt seine Regel allein, dass das Ist-Termin-Feld gefüllt ist — MST 9
  „Antrag im System eingegeben": Antragseingang gefüllt, Ist-Termin =
  Antragseingang; Gruppen mit genau einem Kind werden dabei durchschaut —, SOLL
  sie bei jedem Verbund zutreffen. Dort gibt es keinen Befund, weder an der
  Bedingung noch in der Probe-Zeile noch in der Meilenstein-Zeile: der Lärm
  entwertete die echten Befunde.
- **„N ohne Termin" ist gezählt, nicht geschätzt** (`KnotenProbe.ohneDatum`):
  je Verbund „erreicht, aber `istDatum === null`" aus demselben Bewertungslauf,
  offen und abgeschlossen getrennt. Solche Verbünde trafen die Regel nur über
  eine datumslose Bedingung (Status, Kürzel, „VB Kurzname") und fehlen still in
  jeder Abweichung der Auswertung — MST 4.3: 224 offene. Der Prototyp rechnete
  „Regel minus Regel ohne datumslose Bedingungen"; das stimmt nur, wo diese
  unter „eine" hängen.
- **Der Ist-Termin ist eine eigene Zeile im Regelbereich** (`IstTerminZeile`,
  v6.64), über der Probe-Zeile und immer sichtbar: Kapitälchen-Beschriftung,
  die Auswahl des Datumsfelds, seine Marken („kein Datum", „N ohne Termin") und
  der Satz für genau diese Regel — eine Zeile, 24 px. Er gehört zur Regel
  („wann gilt sie als erreicht"), nicht zur Messung, und lag in der zugeklappten
  Probe unerreichbar.
- **Der Ist-Termin als Satz für genau diese Regel** (`istTerminErklaerung`).
  Die Zeile übersetzt die Bewertung auf die Regel, die dasteht — „Hier:
  das spätere Datum von Gruppe 1 und Gruppe 2; je Gruppe das frühere ihrer
  gefüllten Datumsspalten." —, datumslose Bedingungen nennt ein Nachsatz. Prüft
  die Bedingung keine Datumsspalte, sagt die Zeile das und trägt die Marke
  „kein Datum" (MST 2: Kürzel TIB/BIB — Ist-Termin und Abweichung blieben dort
  für immer leer). Welche Felder Datumsspalten sind,
  entscheidet `istDatumsFeldAus`: `typ: 'datum'` im Spalten-Katalog **oder** die
  Code-Konvention `D_…` — das Inventar führt einige `D_`-Spalten aus seinen
  Stichproben als „wert". Ein Sammel-Meilenstein nennt „das späteste Datum
  seiner aktiven Unter-Meilensteine".
- **Ein Status ist eine Momentaufnahme, kein Ereignis** (`momentaufnahme`,
  v6.65). Der schärfere Fall von „kein Datum": `status` und `verbund_status`
  tragen den Wert von **heute**. Ein Meilenstein, der `status ist
  „Stellungnahme zur Rücknahmeempf."` prüft, ist nur an den Tagen erreicht, an
  denen der Vorgang zufällig dort steht; zieht er weiter, fällt der Meilenstein
  auf `gerissen` zurück — und bleibt es. Gemessen am Export vom 11.09.2026:
  **9 145** Teilvorhaben tragen den Datumsbeleg für „Rückmeldung des
  Antragstellers" (`D_ARW`/`D_AL`/`D_ABLW`), aber nur **72** stehen heute auf
  einem der drei Statuswerte — 9 074 gelten dauerhaft als überfällig, obwohl
  derselbe Export den Termin führt. Die Zeile trägt dann die Marke **„nur
  Status"** statt „kein Datum" (der gravierendere Fall darf sich nicht wie der
  harmlosere lesen) und nennt den Ausweg: die Datumsspalte des Ereignisses
  ergänzen, den Status als zusätzlichen Zweig stehen lassen. `vb_phase` zählt
  **nicht** dazu — die Fördervariante wandert nicht.
- **Treffer je Feld für die Feld-Suche** (`zaehleFeld`). Die Probe-Kontexte
  kennen nur die Felder, die der Plan benutzt; ein noch nicht gewähltes Feld
  stünde dort immer auf 0. Der Hook baut deshalb beim ersten Aufruf einmal
  Kontexte über **alle** Felder des Spalten-Katalogs, gemerkt je Bestand (ein
  Modul-Cache statt eines Refs, weil die Feld-Suche während des Renderns fragt),
  und zählt `{feldId, op: 'gefuellt'}` mit dem vorhandenen `zaehleBedingung` —
  kein zweiter Evaluator, Nenner wie überall `nurTypen` des Meilensteins.
- **Nachbarzahl** (11.09.2026): der Offen-Nenner der Probe, 1 317, ist genau die
  Zahl offener Verbünde der gespeicherten Projektion in Richtlinie 2025; nach
  FuE/DS gefiltert sind es beidseitig 1 094 — der Nenner an Meilenstein 3.

### Der Baum-Editor (v4.4)

Vier Zusagen, die alle aus derselben Beobachtung stammen — der Editor ist ein
**Arbeitsgerät**, keine Anzeige:

- **Angelegt heißt sichtbar.** Ein Unter-Meilenstein entsteht unter einer
  zugeklappten Zeile; bis v4.4 passierte auf den Klick hin nichts Sichtbares und
  er tauchte erst nach dem nächsten Laden auf. `ergaenze()` klappt jetzt die
  Elternzeile auf, öffnet den Regel-Bereich des Neuen und setzt den Cursor in
  seine Bezeichnung (per Effekt, **nicht** per `autoFocus` — dessen
  Fokus-Ereignis feuert im Commit, bevor React die Handler der Zeile kennt).
- **Mehrere Regel-Bereiche bleiben offen.** Sie hängen an einem eigenen Satz
  (`koerperOffen`), nicht mehr an der Auswahl — sonst schloss jedes Aufklappen
  das vorige, und zwei Regeln ließen sich nie vergleichen. Geschaltet wird über
  `onZeilenKlick` (Capture-Phase) mit einem `closest()`-Filter auf die
  Bedienelemente der Zeile.
- **Der Rückweg aus der Unterordnung** ist ein Menüeintrag „Eine Ebene höher"
  (`hebeKnotenAn`, im ⋯- und im Kontextmenü), nicht nur ein Zug mit der Maus:
  der Knoten wird Geschwister seines Elternteils und landet direkt dahinter.
- **Beide Ausgänge des Ziehens sind sichtbar**: die Einfüge-Marke des `TfTree`
  für „dazwischen", der Rahmen der Zeile für „hinein". Die linke Kante der
  offenen Zeile weicht dabei zurück — sie ist ein Inline-`box-shadow` und würde
  den Rahmen sonst verdecken.

## Auslieferungs-Plan v1 ([seed.ts](../../src/core/meilensteine/seed.ts))

Die **Struktur** (MST 1 … 6 inkl. 1.1–1.4.3, Soll-Wochen) ist fachlich
verbindlich. Die **Zuordnung** zu CSV-Spalten ist es nicht: welcher der ~150
`D_*`-Codes wofür steht, weiß nur das Team. Deshalb sind nur eindeutig belegbare
Knoten bestätigt und aktiv (1.1 Antragseingang, 1.2 Zuweisung, 6 Bewilligung);
plausible Zuordnungen tragen `unbestaetigt`, und wo keine plausible Quelle
existierte, ist der Knoten zusätzlich inaktiv (1.4.2, 4, 5). Ein geratener
Meilenstein wäre schlimmer als ein fehlender. Hat das Team eine Zuordnung
geprüft, bestätigt es sie in der Spalte „Zuordnung" des Konfigurations-Reiters
(siehe Der Meilenstein um den Regelbereich).

**MST 5 und MST 6 lesen seit v6.65 zuerst ein Datum.** Beide hingen allein an
Status-Werten und waren damit Momentaufnahmen (siehe Probe am Bestand): MST 5
trägt jetzt `D_ARW`/`D_AL`/`D_ABLW` **vor** seinen drei Status-Zweigen, MST 6
`D_XKS`/`erstentscheidung` vor seinen. Die Status-Zweige bleiben stehen — sie
fangen die Fälle, in denen der Beleg fehlt; `{einige}` macht das Hinzufügen rein
additiv. Beide Knoten bleiben `unbestaetigt`: die Spalten sind plausibel, geprüft
hat sie das Team noch nicht.

## Guards

Modul-lokal ([konventionen.test.ts](../../src/core/meilensteine/__tests__/konventionen.test.ts)):
`meilenstein-plan-share-only` (Plan-Pfad nur im Storage-Modul, nie im Snapshot
oder Personal-Mirror), `meilenstein-risiken-personal-only` (nur persönlicher
Handle, kein Löschen), `no-hardcoded-antragstyp` (vb_phase-Zuordnung nur in
[vb-phase-mappings.ts](../../src/core/utils/vb-phase-mappings.ts)).
