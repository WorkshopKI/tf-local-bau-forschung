# Der Code-Katalog des Fachsystems

Der Status-Katalog führt seit v2.349 die **505 Statuseinträge**, die das
Fachsystem verwaltet — v2.340 waren es 177 aus Bildschirmfotos, davor sieben
Felder. Dieses Doc beschreibt, woher sie kommen, wie sie auf CSV-Spalten treffen
und was davon auf die Statusableitung wirkt.

## Die Spalten-Konvention

Der Ordner-Code **ist** das Spalten-Suffix. Verifiziert gegen
[docs/fixtures/](../fixtures/):

| Muster | Bedeutung | Beispiel |
|---|---|---|
| `D_<CODE>` | Datum des Ereignisses | `[XTEC]` → `D_XTEC` |
| `T_<CODE>` | Texteintrag dazu | `[AAI]` → `D_AAI` + `T_AAI` |
| `X` am Codeanfang | Verbund-Ebene | `[XPC+]` gegen `[PC+]` |
| ohne `X` | Teilvorhaben-Ebene | `[AAE]` → `D_AAE` |

Manche Codes führen **nur** einen Texteintrag (`T_XAT` „Anzahl der erwarteten
Teilvorhaben", `T_HINT` „Bemerkung") — dort ist `T_` die Primärspalte.

## Zwei Quellen, sauber getrennt

|  | Was | Wo |
|---|---|---|
| **Fremddaten** | Code, Bezeichnung, wer den Eintrag setzt | [seed-codes.data.ts](../../src/core/status/seed-codes.data.ts) — generiert aus der Zuarbeit |
| **Unsere Kuration** | Ordner, Prominenz, Spine-Phase, Rang, terminal | [seed-codes.ts](../../src/core/status/seed-codes.ts) |

Die **Kürzel-Zuarbeit** des Fachsystems (`kuerzel-zuarbeit-20260724.csv`,
Spalten `Kürzel;Beschreibung;wird gesetzt von:`) ist die maßgebliche Quelle für
Bezeichnung und Rolle. Sie wird **wortgetreu** übernommen, inklusive Abkürzungen
und Tippfehler — jede „Verbesserung" zerstörte die Wiedererkennung gegen das
Fachsystem.

Die CSV selbst ist **nicht versioniert** (`.gitignore`): Zuarbeit bleibt lokal,
im Repo steht nur ihr generiertes Ergebnis. Zum Neugenerieren muss sie unter
`docs/status-system/` liegen — der Generator sagt sonst, welche Datei fehlt.

Neue Zuarbeit einarbeiten: CSV nach `docs/status-system/` legen, `QUELLE` in
[gen-status-codes.mjs](../../scripts/gen-status-codes.mjs) anpassen,
`npm run gen:status-codes` laufen lassen, Diff prüfen. Die Kuration überlebt das
unangetastet; im Cockpit zeigt der Block „Bei N Feldern weichen Bezeichnung oder
Rollen ab" die Differenz zur laufenden Fassung an.

### Zwei Zuarbeiten, und keine gewinnt pauschal

Die App führt **zwei** Dokumente des Fachsystems nebeneinander, und sie
überschneiden sich:

| | Dokument | Schlüssel | Codes | wirkt auf |
|---|---|---|---|---|
| flach | `kuerzel-zuarbeit-20260724.csv` | Code | 505 | `StatusFeldEintrag.label` — **jede** Anzeigefläche |
| form-bewusst | `Janne-Gelbe_Karte_Kürzel.xlsx` | Kürzel × Projektform | 608 | `kuerzelAuskunft()` — Verlauf, Klärfragen |

Gemessen über alle 505 Codes (Test `seed-label-korrekturen`): **335** sagen
wortgleich dasselbe, **58** unterscheiden sich zu Recht je Projektform, **36**
kennt nur die flache Quelle — und **76 widersprechen sich**, obwohl der
form-bewusste Katalog dort über alle Formen einstimmig ist.

**Diese 76 gehen in beide Richtungen**, und das ist der Punkt. Mal ist die flache
Quelle veraltet (`XKS` trug „DL-Gutachten fertig - FB/AB" für alle Formen), mal
trägt der form-bewusste Katalog den Tippfehler (`Biref NF`, `Verwedungsnachweis`,
`allgmeine Ablehnung`) oder die falsche Sache (`IVW2` „starker Verwalter" statt
„Sachwalter"). Wer eine der beiden Quellen global übernähme, tauschte also Fehler
gegen Fehler. Deshalb gibt es **keine** Vorrangregel, sondern eine belegte Liste
in [seed-label-korrekturen.ts](../../src/core/status/seed-label-korrekturen.ts).
Jeder Eintrag sagt, **welche Seite** danebenlag (`seedFalsch` / `katalogFalsch`);
beide Seiten sind optional, weil beide Richtungen vorkommen.

**Die restlichen 66 sind eine Frage an den Fachbereich, keine an uns.** Dort
unterscheidet sich die *Aussage*, nicht die Schreibung: `XFB` „max. 2 Bew. in 12
Monaten" gegen „max. 1 in 24", `SART` führt zwei völlig verschiedene Wertelisten,
`ABLWG+` „Freigabe erfolgt" gegen „Hinweise/Rückfragen". Der Test hält die Zahl
als **Wasserstand** fest: sinkt sie, wurde geklärt; steigt sie, hat eine neue
Zuarbeit Widersprüche mitgebracht.

### Was der Quellen-Vergleich strukturell NICHT findet

Das Ministerium heißt **BMWE**; `BMWK` ist der frühere Name. Betroffen sind 14
Kürzel im Seed — und **zwölf davon schreiben `BMWK` in beiden Quellen**. Sie
zählten damit zu den 335 „wortgleichen" und tauchten in keiner Konfliktliste auf.

Übereinstimmung zweier veralteter Quellen ist eben keine Richtigkeit. Ein
Vergleich findet nur, worin sich zwei Dokumente *unterscheiden* — was beide
gleich falsch führen, ist für ihn unsichtbar, und die einzige Prüfung, die es
findet, ist die fachliche. Die Umbenennung steht deshalb als **Regel**
(`BEHOERDEN_UMBENENNUNG`) statt als 14 Listeneinträge: es ist ein Urteil, kein
Dutzend, und ein neues Kürzel der nächsten Zuarbeit erbt sie. Ein Test pinnt die
betroffene Code-Menge, damit die Wirkung sichtbar bleibt.

**Ein einheitlicher Kürzel-Katalog ist damit noch nicht erreicht** — er setzt
voraus, dass die 66 entschieden sind. Bis dahin bleibt `kuerzelAuskunft()` die
eine Tür für die *form-abhängige* Bedeutung und der Seed die Quelle der
*angezeigten Bezeichnung*; beide lesen dieselben Entscheidungen.

### Auf dem Bildschirm gilt die kuratierte Fassung

Die beiden Quellen oben beschreiben, was **ausgeliefert** wird. Davon getrennt
ist die Frage, welcher Text auf der Seite steht — und dort gewinnt seit v4.45 die
**kuratierte Fassung**, also das, was die PL im Kürzel-Tab bearbeitet, speichert
und für das Team freigibt.

Nötig wurde das, weil dieselbe Sektion des Verbund-Detail zwei Reiter hat, die
ihren Text aus verschiedenen Quellen zogen: die **Chronik** aus
`StatusFeldEintrag.label` (Fassung), der **Zeitstrahl** aus `kuerzelAuskunft()`
(einkompiliert). Gemessen an der laufenden Fassung 18 mit 505 Kürzeln liefen
**111** auseinander — `ALQ` las sich links „NF von PL gelesen", rechts „NF von QS
gelesen". Eine Freigabe erreichte den Zeitstrahl gar nicht; nur ein neuer Build
änderte ihn.

`ueberlagereKuration()` in [kuerzel-katalog.ts](../../src/core/status/kuerzel-katalog.ts)
legt den kuratierten Wortlaut über die Auskunft. Aufgerufen wird sie in
[uebergaenge.ts](../../src/core/status/verlauf/uebergaenge.ts) mit
`eintrag.feld.label` — **demselben Feld**, das die Chronik rendert. Beide
Ansichten zeigen damit dieselbe Zeichenkette per Konstruktion, nicht zufällig.

Zwei Grenzen, beide gewollt:

- **Form-divergente Kürzel bleiben beim Katalog.** Die Fassung kennt einen
  Wortlaut je Code; `AB` heißt in DL aber etwas anderes als in NW. Sie hier
  gewinnen zu lassen, gäbe jedem DL-Antrag wieder den NW-Text — der Zustand vor
  v3.13, der 78,9 % der Anträge betraf. Nach der Überlagerung bleiben deshalb
  **26** Kürzel mit zwei Texten auf einer Seite, und das ist die richtige Zahl.
- **Rollen folgen nicht.** `rollenLage` unterscheidet „jede Rolle" von „Rolle
  unbekannt"; ein Feld der Fassung trägt immer eine (leere = neutrale)
  Rollenliste, überlagert verschwände die zweite Aussage.

Eine **stale Fassung** zeigt danach ihren alten Text in beiden Reitern statt in
einem — das ist Absicht. Ein Stand, der einheitlich veraltet ist und im Cockpit
als „Bei N Feldern weichen Bezeichnung oder Rollen ab → Zuarbeit übernehmen"
gemeldet wird, ist ehrlicher als zwei Texte nebeneinander, von denen die Seite
nicht sagt, welcher gilt. Die offenen Sachwidersprüche (`XFB` & Co.) bleiben
davon unberührt: sie werden weiter zwischen den **Quellen** gemessen, nicht
zwischen den Ansichten.

**Vorbehalt bleibt die Ordner-Zuordnung**: sie ist aus Bildschirmfotos der
Fachsystem-Ordnerbäume übertragen — eine Vorbelegung, die die Projektleitung
bestätigt, genau wie beim Meilenstein-Seed. Die Zuarbeit führt **keine** Ordner.
Deshalb sind nur die 175 in den Vorlagen sichtbaren Codes einsortiert; die
übrigen 330 liegen im Sammelordner **„Nicht zugeordnet"**, bis die PL sie
einsortiert. Vier Ordner waren eingeklappt und bleiben leer angelegt:
*internationale Projekte* (Verbund), *Vor-Ort-Besuch*, *Verwendungsnachweis*,
*SV - Keller - Archiv* (Teilvorhaben).

**Nicht jeder Code steht in jedem Programm.** Ein Code, den ein Programm-Schema
nicht mappt, löst nicht auf und trägt nie einen Wert — das ist kein Fehler. Die
drei Fixture-Exporte decken die Antragsbearbeitung ab, nicht die Kommunikations-
und Widerspruchs-Familien.

## Was wir sehen können: die ruhenden Kürzel

Der Satz oben stimmt nicht nur für Fixtures, sondern für den Produktionsbestand,
und er wiegt schwerer als er klingt. Gemessen an Fassung 22 (509 Felder) und den
drei Import-Quellen `9097-anb`, `7737-bgl`, `9052-prjbsp`:

| Lage | Kürzel |
|---|---|
| **keine `D_`/`T_`-Spalte in irgendeinem Schema-Mapping** | **243** |
| Spalte vorhanden, im ganzen Bestand nie gesetzt | 4 (`VRM`, `P2M`, `WZBS`, `WZBTS`) |
| Spalte vorhanden, zuletzt vor Richtlinie 2020 gesetzt | 11 (`INFOB` 305×, `PBDB` 70×, `XBG` 10×, …) |
| in Richtlinie 2020/2025 gesetzt | 247 |

Die 243 sind **nicht** „außer Gebrauch". Es sind die Kommunikations-Familie
(`YE`, `YT`, `YB`, `YF`), Widerspruch (`YWSP*`), Rückzahlung (`RZ*`),
Aktennotizen (`AKT*`) — C16 setzt sie sehr wahrscheinlich täglich, nur exportiert
es die Spalten nicht. Für uns sind sie trotzdem tot: keine Phase kann greifen,
keine To-do-Regel kann zutreffen, keine Klärfrage kann belegt werden.

Sichtbar wurde das an der Kuration selbst — **85 dieser 243 trugen ein von Hand
gesetztes Relevanz-Häkchen** und sieben eine ZAH-Phase. Kein Fehler im Code, ein
Fehler in der Aufmerksamkeit: die Tabelle bot 511 Zeilen gleichrangig an, und
niemand konnte ihr ansehen, welche davon je etwas tragen können.

### Die Ruhe-Achse

[ruhende-kuerzel.ts](../../src/core/status/ruhende-kuerzel.ts) leitet daraus ein
Urteil ab, und `StatusFeldEintrag.ruht` ist die dreiwertige Ausnahme dazu:

| `ruht` | gilt |
|---|---|
| fehlend | Ableitung: ohne gemappte Spalte ruht das Kürzel |
| `true` | die PL hat es ruhen lassen (Bestandsvorschlag angenommen) |
| `false` | „trotzdem beachten" — übersteuert auch die Ableitung |

Der Regelfall ist damit **abgeleitet und nicht gespeichert** (Pitfall #45): ein
neu gemapptes Kürzel wacht auf, sobald das Schema es führt. Gespeichert wird nur
die Entscheidung — und die trifft die PL mit einem Knopf, nicht 500-mal einzeln.
Die 15 gemessenen kommen aus dem Einsatz-Bestandslauf
([useEinsatzErhebung](../../src/plugins/status-cockpit/useEinsatzErhebung.ts)),
der gegen die jüngsten `EINSATZ_GENERATIONEN` (2) misst — **nicht** gegen den
persönlichen Betrachtungsbereich, sonst sähe jede Person eine andere Liste
(Pitfall #46).

**Wirkung genau dort, wo Aufmerksamkeit verteilt wird**: Ordnerbaum des
Kürzel-Tabs, Auswahlliste des Regel-Editors (`baueTodoFeldVorrat`), Klärfragen
(`bedeutungsFragen`, `ktFragen`). **Nirgends sonst** — Chronik, Zeitstrahl,
Navigator, Wächter, `reconcile` und `referenzierbareFelder` kennen `ruht` nicht,
und ein Guard hält das fest (Pitfall #53). Ein Altantrag von 2017 behält seinen
`D_INFOB`-Eintrag; eine bestehende To-do-Regel auf ein ruhendes Feld bleibt beim
Share-Import gültig.

## Vier Spalten gehören schon kanonischen Feldern

`D_AAE`, `D_ABB`, `D_AZ1_1` und `D_VBE` sind app-weit auf `antragsdatum`,
`bewilligung_datum`, `erstentscheidung` und `vn_eingang_datum` gemappt
(`CANONICAL_FIELD_NAME_ALIASES`). Die Zuarbeit führt diese vier Codes natürlich
mit — `baueSeedVersion` **filtert sie deshalb aus dem Code-Katalog heraus**, und
zwar abgeleitet aus den kanonischen Feldern selbst (`codeFelderOhneKanonische`),
nicht über eine gepflegte Ausschlussliste. Ein neues kanonisches Feld mit `code`
wirkt dort automatisch. Die kanonischen Felder tragen ihren `code` selbst und
hängen im Baum; ein zweiter Eintrag auf derselben Spalte zählte jedes Ereignis
doppelt.

Denselben Fall fängt zur Laufzeit der **Kollisionsschutz** in
[feld-aufloesung.ts](../../src/core/status/feld-aufloesung.ts): zeigen zwei
Felder **derselben Herkunft** auf denselben Record-Key, gewinnt das kanonische.

### Der Schlüssel darf keine Satzzeichen wegwerfen

Bis v4.82.0 lief die Auflösung über `normCode`, das `-`, `_` und Leerzeichen
streift. Im Vokabular des Fachsystems tragen diese Zeichen aber Bedeutung: `QS`
heißt „kaufm. QS erfolgt", `QS-` heißt „kaufm. QS zurück an AB" — zwei Kürzel,
zwei Spalten. `D_QS` und `D_QS-` fielen auf denselben Index-Schlüssel, der
Kollisionsschutz warf eines hinaus, und der Verlierer trug in der **ganzen App**
nie einen Wert. Gemessen an Fassung 22:

| Kürzel | Zeilen im Export | davon Richtlinie 2020/2025 |
|---|---|---|
| `QS` | 7 135 | 3 954 |
| `AQ4` | 6 758 | 3 954 |
| `VQK` | 3 208 | 2 047 |
| `ARQ` | 1 260 | 857 |
| `ABLQ` | 821 | 474 |

Schlimmer als das Verschwinden war die **Fehl-Lesung**: `D_ARQ-` und `D_VQK-`
haben gar keine eigene Spalte im Export. Über den unscharfen Schlüssel griffen
sie die Spalte ihres Geschwisters ab und zeigten dessen Daten unter ihrem Namen.

Gebraucht wurde die Unschärfe nur für **Groß-/Kleinschreibung** (`vb_phase` gegen
die Spalte `VB_PHASE`) — gemessen fünf Felder, vier davon genau die schädlichen.
`spaltenSchluessel` normalisiert deshalb nur noch Unicode-Form, Rand-Leerraum und
Groß-/Kleinschreibung. `normCode` selbst bleibt unverändert: wo Kürzel-*Schreib­
weisen* verglichen werden, ist es richtig.

**Zweiter Teil: die Herkunft gehört in den Kollisions-Schlüssel.**
`verbund_status` liest `status` aus dem Verbund-Record, das kanonische `status`
aus dem TV-Record — derselbe Key, zwei Records, kein Konflikt. Trotzdem fiel
`verbund_status` heraus, und der Verlaufs-Bestandslauf, der es namentlich sucht,
bekam immer den leeren String.

Von 12 unauflösbaren Feldern bleiben damit **vier**, und die sind kein
Auflösungsfehler: `D_XRN-`/`D_XRN+`, `D_YPM_A`/`D_XYPM_A`, `D_LZX`/`D_ÄZX` und
`D_LG`/`D_ÄG` sind Paare, die das **Mapping** auf denselben kanonischen Key legt.
Ihre Werte sind schon beim Import verschmolzen; das kann die Auflösung nicht
rückgängig machen.

## Ebene gegen Herkunft

- **`ebene`** sagt, *worüber* ein Eintrag spricht: Verbund oder Teilvorhaben.
- **`herkunft`** sagt, *wo er steht*.

Beides fällt auseinander, weil die Verbund-Codes nicht im Verbund-Record stehen —
der führt nur Titel und Status. Sie stehen identisch auf **jeder TV-Zeile** der
CSV. `sammleVorkommen` meldet sie deshalb genau einmal, ohne `tvId`.

## Wer den Eintrag setzt: die Rollen

Die Zuarbeit führt **fünf Rollen und neutral**, in beliebigen Kombinationen
(`AB/FB/QS`, `AB/QS/Juristen`):

| Rolle | Bedeutung | Codes |
|---|---|---|
| `ab` | administrative/kaufmännische Bearbeitung | 153 |
| `fb` | fachliche/technische Bearbeitung | 130 |
| `qs` | Qualitätssicherung | 100 |
| `pa` | Projektadministration | 103 |
| `jur` | Juristen | 22 |
| — | neutral | 143 |

> **`neutral` heißt „jeder darf setzen", nicht „niemand".** Deshalb ist es kein
> eigener Enum-Wert, sondern das **leere** `rollen`-Array — und deshalb ist ein
> neutraler Eintrag unter *jeder* Rollenwahl sichtbar. Wer das umdreht, blendet
> 143 der 505 Codes überall aus. Einzige Lesestelle:
> [rollen.ts](../../src/core/status/rollen.ts).

Die Spalte heißt „wird gesetzt von", nicht „ist zuständig für" — das ist enger:
`[AN]` „NF an ASt" setzen AB/FB/QS, betreffen tut der Eintrag alle.

Die Facette ist **rein deskriptiv**: sie filtert und sortiert die Anzeige,
sperrt nichts und geht nicht in die Ableitung ein. Im Profil hinterlegt jede
Person unter „Meine Rolle" ihre eigene — das ist eine **Vorauswahl der Liste,
keine Sperre**; ohne Angabe bleibt alles sichtbar.

Vorgänger war `zustaendigkeit: 'ab'|'fb'|'beide'` (v2.344), das nur die AB/FB-
Achse kannte und alles Übrige auf `beide` zwang. Bestandsfassungen tragen es
noch; `rollenVonFeld` übersetzt es zur Lesezeit (`beide` → AB+FB), geschrieben
wird es nicht mehr.

## Was auf die Statusableitung wirkt

Datums- und Textfelder haben kein Wert-Enum: dort trägt das **Feld** die
Spine-Phase. Ein Feld trägt bei, wenn es aktiv ist und **`rang > 0`** hat; bei
`typ: 'datum'` zusätzlich nur mit einem lesbaren Datum.

Ausgeliefert haben **22 von 508 Feldern** einen Rang — Antragseingang
(`AAE`/`AAI`), Vollständigkeit (`ADV`, `XTEC`, `XANT`, `PC+`, `XPC+`),
Fachprüfung (`AT4`, `AK4`, `AQ4`, `QS`, `XKS`, `XQS`), Bewilligung (`AB`, `ABB`,
`AZBE`, `AZBZ`) und die terminalen Ausgänge (`ABLZ`, `ABLD`, `AAR`, `RZZ`,
`XVE`). Alles andere ist Rang 0 und damit wirkungslos, bis die Projektleitung es
im Cockpit gegen die Simulation freigibt.

Der Rang ist beides in einer Zahl: **Schalter** (0 = trägt nicht bei) und
**Reihenfolge** (bei mehreren gesetzten Feldern gewinnt der höchste). Die Skala
orientiert sich am Verfahrensablauf: Eingang 10 → Vollständigkeit 20–25 →
fachliche Prüfung 30–39 → Bewilligung 40–46 → Schluss 50. Der Filter „nur mit
Rang" im Felder-Tab ist die Abnahme-Liste dazu.

> Diese Bezeichnungen sind **Merkhilfen für die Rang-Skala**, keine
> Verfahrensschritte. Welche ZAH-Phasen es gibt und wie sie heißen, entscheidet
> die Katalog-Fassung ([status-achsen.md](../architecture/status-achsen.md));
> „fachliche Prüfung" und „Bewilligung" sind dort keine Phasenlabels.

**Konflikte bleiben eine Frage der Wert-Felder.** Ein Wert behauptet „hier steht
der Vorgang gerade", ein Datum hält fest „dieser Punkt wurde passiert". Zählte
man Daten mit, meldete praktisch jeder Antrag einen Konflikt — fast alle haben
ein Eingangsdatum neben einem späteren Bearbeitungsstand.

Die Kategorie eines Feld-Beitrags leitet
[spine-kategorie.ts](../../src/core/status/spine-kategorie.ts) aus der Phase ab;
ein terminales Feld im Prüfungs-Rangbereich gilt dort als Ablehnung. Am Feld
lässt sich die Kategorie überschreiben, wo eine Phase mehrere trägt.

## Zwei Wege, wie ein Feld in den Katalog kommt

1. **Auslieferung** — der Seed. Frische Installationen starten vollständig.
   Bestandsinstallationen führen eine kuratierte Fassung > 1; die bekommt neue
   Felder über den Block „Die Auslieferung führt N Statusfelder …" im
   Felder-Tab. `ergaenzeSeedFelder` fügt nur Fehlendes an und fasst kuratierte
   Einträge nie an — **auch nicht deren Bezeichnung**. Dafür gibt es den
   zweiten Block: „Bei N Feldern weichen Bezeichnung oder Rollen ab" übernimmt
   genau diese beiden Angaben aus der Zuarbeit (`uebernimmSeedTexte`) und lässt
   Ordner, Phase und Rang unberührt.
2. **Entdeckung** — beim Import. Jede gemappte `D_`/`T_`-Spalte, die der Katalog
   nicht kennt, landet im gerätelokalen Puffer
   (`status-katalog:unkuratierte-felder`) und wird im Cockpit zum Einsortieren
   angeboten. Entdeckte Felder sind **inaktiv und ohne Ordner**, bis die PL sie
   übernimmt — sonst tauchten unbenannte Spalten unvermittelt in Timeline und
   Tabelle auf.

Beide Wege enden bei einer gespeicherten Fassung, die über die bestehende
Sidecar team-weit gilt. Automatisch wirkt nichts.

## Ordner-Spalten in der Fördertabelle

Je kuratiertem Ordner gibt es eine einblendbare Spalte mit dem **jüngsten**
Termin des Ordners (Bezeichnung als Badge, Datum im Tooltip und als
Sortierschlüssel) — dieselbe Mechanik wie „FB Status"/„PreCheck TV"/„PreCheck
Verbund", nur kuratiert statt im Code.

Zwei Konsequenzen daraus:

- Die Spalten-Keys (`katstatus:<kategorieId>`) sind nicht im Code aufzählbar.
  `useAntraegeColumnsStore` prüft sie deshalb am **Präfix**, nicht gegen eine
  feste Liste — sonst wäre die Auswahl nach jedem Reload weg.
- Der Katalog geht in die **Projektions-Signatur** ein
  ([list-view-migration.ts](../../src/core/services/csv/list-view-migration.ts)).
  Hängt die PL ein Feld um, ändert sich kein einziger Antrag-Record; ohne die
  Signatur blieben die Spalten auf dem alten Stand stehen.

## Wo was liegt

| Was | Datei |
|---|---|
| Ordnerbaum (Seed) | [seed-kategorien.ts](../../src/core/status/seed-kategorien.ts) |
| Zuarbeit (Fremddaten, generiert) | [seed-codes.data.ts](../../src/core/status/seed-codes.data.ts) ← [gen-status-codes.mjs](../../scripts/gen-status-codes.mjs) |
| Kuration über den Codes | [seed-codes.ts](../../src/core/status/seed-codes.ts) |
| Rollen (einzige Lesestelle, Migration) | [rollen.ts](../../src/core/status/rollen.ts) |
| Baum-Mechanik (Pfad, Kinder, Zyklenschutz) | [kategorien.ts](../../src/core/status/kategorien.ts) |
| Code → Record-Key, Ebene/Herkunft-Regel | [feld-aufloesung.ts](../../src/core/status/feld-aufloesung.ts) |
| Spalten-Entdeckung | [entdecke.ts](../../src/core/status/entdecke.ts) |
| Ruhe-Achse (abgeleitet + Ausnahme) | [ruhende-kuerzel.ts](../../src/core/status/ruhende-kuerzel.ts), [RuhendeKuerzel.tsx](../../src/plugins/status-cockpit/RuhendeKuerzel.tsx) |
| Phase ↔ Kategorie | [spine-kategorie.ts](../../src/core/status/spine-kategorie.ts) |
| Ordner-Spalten der Tabelle | [kategorie-projektion.ts](../../src/core/status/kategorie-projektion.ts) |
| Kuration | [FelderTab.tsx](../../src/plugins/status-cockpit/FelderTab.tsx), [KategorieEditor.tsx](../../src/plugins/status-cockpit/KategorieEditor.tsx) |
| Anzeige am Antrag | [StatusCodeListe.tsx](../../src/plugins/antraege/status/StatusCodeListe.tsx) |

## Abgrenzung

Die CSV-Spalten `MS01_*`/`MS02_*`/`MS03_*` sind **Projekt**-Meilensteine der
Begleitphase, nicht Statuseinträge — sie gehören weder hierher noch zu den
[Bearbeitungs-Meilensteinen](../architecture/meilensteine.md). Ebenso bleibt
`Prominenz = 'meilenstein'` ein reiner **Anzeige**-Begriff (Timeline-Marker).
