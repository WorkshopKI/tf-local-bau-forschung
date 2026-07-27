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

Die **Kürzel-Zuarbeit** des Fachsystems
([kuerzel-zuarbeit-20260724.csv](kuerzel-zuarbeit-20260724.csv), Spalten
`Kürzel;Beschreibung;wird gesetzt von:`) ist die maßgebliche Quelle für
Bezeichnung und Rolle. Sie wird **wortgetreu** übernommen, inklusive Abkürzungen
und Tippfehler — jede „Verbesserung" zerstörte die Wiedererkennung gegen das
Fachsystem.

Neue Zuarbeit einarbeiten: CSV nach `docs/status-system/` legen, `QUELLE` in
[gen-status-codes.mjs](../../scripts/gen-status-codes.mjs) anpassen,
`npm run gen:status-codes` laufen lassen, Diff prüfen. Die Kuration überlebt das
unangetastet; im Cockpit zeigt der Block „Bei N Feldern weichen Bezeichnung oder
Rollen ab" die Differenz zur laufenden Fassung an.

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
Felder auf denselben Record-Key, gewinnt das kanonische.

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
folgt dem Verfahren: Eingang 10 → Vollständigkeit 20–25 → Fachprüfung 30–39 →
Bewilligung 40–46 → Schluss 50. Der Filter „nur mit Rang" im Felder-Tab ist die
Abnahme-Liste dazu.

**Konflikte bleiben eine Frage der Wert-Felder.** Ein Wert behauptet „hier steht
der Vorgang gerade", ein Datum hält fest „dieser Punkt wurde passiert". Zählte
man Daten mit, meldete praktisch jeder Antrag einen Konflikt — fast alle haben
ein Eingangsdatum neben einem späteren Bearbeitungsstand.

Die Kategorie eines Feld-Beitrags leitet
[spine-kategorie.ts](../../src/core/status/spine-kategorie.ts) aus der Phase ab;
ein terminales Feld in der Fachprüfung gilt als Ablehnung. Am Feld lässt sich die
Kategorie überschreiben, wo eine Phase mehrere trägt.

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
Sortierschlüssel) — dieselbe Mechanik wie „FB Status"/„PreCheck Status", nur
kuratiert statt im Code.

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
| Phase ↔ Kategorie | [spine-kategorie.ts](../../src/core/status/spine-kategorie.ts) |
| Ordner-Spalten der Tabelle | [kategorie-projektion.ts](../../src/core/status/kategorie-projektion.ts) |
| Kuration | [FelderTab.tsx](../../src/plugins/status-cockpit/FelderTab.tsx), [KategorieEditor.tsx](../../src/plugins/status-cockpit/KategorieEditor.tsx) |
| Anzeige am Antrag | [StatusCodeListe.tsx](../../src/plugins/antraege/status/StatusCodeListe.tsx) |

## Abgrenzung

Die CSV-Spalten `MS01_*`/`MS02_*`/`MS03_*` sind **Projekt**-Meilensteine der
Begleitphase, nicht Statuseinträge — sie gehören weder hierher noch zu den
[Bearbeitungs-Meilensteinen](../architecture/meilensteine.md). Ebenso bleibt
`Prominenz = 'meilenstein'` ein reiner **Anzeige**-Begriff (Timeline-Marker).
