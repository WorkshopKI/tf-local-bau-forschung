# Eigene Spalten der Fördertabelle

Der Nutzer legt Spalten an, die die Registry nicht kennt. Flag `eigeneSpalten` (**dev + pl**), Modul [src/core/spalten/](../../src/core/spalten/), UI in [src/plugins/antraege/](../../src/plugins/antraege/eigene-spalten/).

Drei Arten, eine Mechanik:

| Art | Was sie zeigt | Zustand |
|---|---|---|
| `feld` | ein rohes Feld unverändert | v4.55 |
| `sammel` | jüngstes/ältestes Datum aus einer Feldmenge (wie „FB Status", nur mit eigener Auswahl) | v4.55 |
| `regel` | Text der ersten zutreffenden Regel einer geordneten Kaskade | Stufe C, offen |

---

## Die Wand und die Tür

Die Tabelle rendert aus der Slim-Projektion `ANTRAEGE_LIST_VIEW` mit fester Feld-Whitelist ([constants.ts](../../src/core/services/csv/constants.ts) `LIST_VIEW_FIELDS`). Ein beliebiges CSV-Feld steht dort nicht — eine Spalte darauf bliebe leer. **Das ist die Wand.**

Die Tür daneben sind die Ordner-Spalten (`katstatus:*`): Config → Projektionszeit → Beutel → Signatur-Guard erzwingt Rebuild. Dasselbe Muster, mit **einer Abweichung**.

## Die tragende Entscheidung: Rohwerte projizieren, Anzeige rendern

> Projiziert wird `frei_roh` — die **Rohwerte** der Felder, die irgendeine eigene Spalte liest (nach `feldId` gekeyt, über alle Spalten dedupliziert). **Nicht** das Ergebnis.

Drei Gründe, und alle drei zählen:

1. **Datumsregeln bleiben frisch.** `tageSeit`/`datumVor heute` zur Projektionszeit eingefroren wäre still falsch, bis jemand neu importiert. Beim Rendern ist „heute" heute.
2. **Regeln bearbeiten kostet keinen Rebuild.** Beschriftung, Text, Farbe, Reihenfolge ändern die Anzeige, nicht die gelesenen Felder. Nur ein **neu referenziertes Feld** ändert die Signatur. Gemessen: 6,0 s Neuaufbau bei 14.225 Anträgen — das will man nicht für eine Textkorrektur.
3. **Verbund-Zeilen können über alle Teilvorhaben werten.** `baueKontext(roh, tvRoh)` bekommt beim Rendern die schon vorhandenen `_verbund.tvs`; zur Projektionszeit läge nur der eine Record vor.

Kosten: ein kleiner zusätzlicher Beutel je Zeile, begrenzt durch das, was Nutzer konfigurieren. Sortieren und Filtern rufen ohnehin je Zeile den `accessor` über den vollen Bestand.

## Module

| Datei | Verantwortung |
|---|---|
| [typen.ts](../../src/core/spalten/typen.ts) | Datenmodell; `spaltenId` legt die **Herkunft in die Id** (`frei:ich:` / `frei:team:`) — dadurch ist eine Kollision zwischen persönlicher und Team-Spalte strukturell unmöglich, es gibt keine Vorrang-Regel aufzulösen |
| [ableitung.ts](../../src/core/spalten/ableitung.ts) | `feldRefs` (was muss projiziert werden) + `hilfeAus` (wie erklärt sich die Spalte) — **eine** Datei, weil beides dieselbe Frage beantwortet; getrennt liefen sie auseinander, und eine Spalte, die ein Feld liest, das ihre Erklärung nicht nennt, ist genau der Defekt, den die Herkunftsangabe verhindern soll |
| [aufloesung.ts](../../src/core/spalten/aufloesung.ts) | `feldId` → Record-Key gegen die Schemas; teilt sich `baueSpaltenIndex` mit dem Statuskatalog (zwei Indizes liefen bei der ersten Mapping-Feinheit auseinander) |
| [anzeige.ts](../../src/core/spalten/anzeige.ts) | `berechneZelle` — rein, Stichtag injiziert, **kein `new Date()`** |
| [projektion.ts](../../src/core/spalten/projektion.ts) | `baueFreiRoh` — leerer Beutel wird weggelassen, kein leeres Objekt je Antrag |
| [store.ts](../../src/core/spalten/store.ts) | persönliche Persistenz, toleranter Leser |
| [programm.ts](../../src/core/spalten/programm.ts) | **der eine Einstieg** für alle Schreibpfade |

## Anzeige und Sortierung sind getrennt

Wie bei den eingebauten Spalten: `accessor` trägt den Sortierwert, `exportValue` den lesbaren Text.

- **Feld**: Datum sortiert nach ISO (angezeigt bleibt die Schreibweise der Zelle); Zahlen ordnet der Collator (`numeric: true`) korrekt, auch über verschiedene Stellenzahlen — gemessen an 60 Zeilen mit 4- und 5-stelligen Beträgen.
- **Sammel**: sortiert nach Datum, angezeigt wird das **Label des gewinnenden Feldes**, das Datum steht im Zell-Tooltip.
- **Regel**: sortiert nach dem **Rang der Regel**, nicht nach ihrem Text. Die Reihenfolge ist die Aussage des Autors („dringend" vor „läuft"); alphabetisch stünde sie zufällig.

Gefiltert wird nach dem, was in der Zelle **steht** — sonst böte das Filtermenü einer Regel-Spalte die Zahlen 0, 1, 2 an.

## Der Rebuild

`putAntraegeListView` ist immer ein **Vollersatz**. Deshalb müssen **alle** Schreibpfade den Beutel mitschreiben; sonst verliert genau der frisch importierte Antrag ihn, und die Spalte wird lückenhaft statt falsch — die Sorte Defekt, die im Betrieb nicht auffällt.

Vier Pfade, ein gemeinsamer Einstieg (`loeseFreieFelderFuer`): [list-view-migration.ts](../../src/core/services/csv/list-view-migration.ts) · [merger/batched.ts](../../src/core/services/csv/merger/batched.ts) · [merger/single.ts](../../src/core/services/csv/merger/single.ts) · [snapshot-sync.ts](../../src/core/services/csv/snapshot-sync.ts) (beide Diff-Zweige). Regressionstest: [merge-behaelt-freie-spalten.test.ts](../../src/core/services/csv/__tests__/merge-behaelt-freie-spalten.test.ts).

Wer selbst neu baut, **stempelt danach den Stand** (`stempleProjektionsStand`) — sonst sieht der Boot-Guard eine veraltete Signatur und baut dieselbe Projektion beim nächsten Start ein zweites Mal, diesmal im Startfenster.

## Reichweite

- **Persönlich** (v4.55): IDB `eigene-spalten:personal`, gerätelokal. Keine Bequemlichkeit, sondern Funktionsbedingung — in prod hat ein normaler Nutzer keine Schreibrechte auf den Daten-Share, eine geteilte Ablage wäre dort tot. Guard `eigene-spalten-lokal`.
- **Team** (Stufe C, offen): Sidecar über `atomicWrite`, Schreiben nur mit `canWriteDatenShare`, Lesen für alle. Übernahme ist eine **Einweg-Kopie** auf eine neue `frei:team:`-Id, keine lebende Verknüpfung.

## Fallen

- **Der Sichtbarkeits-Store filtert unbekannte Keys.** `istGueltigerKey` ([useAntraegeColumnsStore.ts](../../src/plugins/antraege/useAntraegeColumnsStore.ts)) muss das `frei:`-Präfix kennen — sonst ist eine angelegte, eingeblendete Spalte nach dem nächsten Neuladen weg. Genau so verhielt sich die erste Fassung.
- **Die Vorschau kann nur zeigen, was schon projiziert ist.** Für ein noch nie gelesenes Feld sagt der Dialog das ausdrücklich, statt „überall leer" zu behaupten.
- **Die Id wird nie nachgeführt.** Ändert der Autor die Beschriftung, bleibt der Slug — an der Id hängen gespeicherte Sichtbarkeit und Breite.
