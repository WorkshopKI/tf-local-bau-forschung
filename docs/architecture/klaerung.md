# Klärungs-Modul „Zu klären"

> Companion-Doku: [vorgangssystem.md](vorgangssystem.md) · Code: [src/plugins/zu-klaeren/](../../src/plugins/zu-klaeren/)

Ein Ort für Fachfragen, die das Team **asynchron** beantwortet. Eine *Klärung* ist
ein Fragebogen mit festen Punkten; jede Person trägt ihr Urteil ein und kann
kommentieren. Erste und bislang einzige Klärung: der **ZAH-Phasenschnitt**.

## 1. Warum es das gibt

Der Phasenschnitt (Status-Code → ZAH-Phase, [zah-phasen.ts](../../src/core/status/zah-phasen.ts))
bestimmt Gruppierung im Vorgangs-Board, Filter, Zieltage-Vorschläge und die
Kategorie-Ableitung. Er stand im Code — und war in der App **nirgends sichtbar**.
Drei Stellen behaupteten sogar, er sei im Cockpit editierbar; ein Bedienelement
dafür gab es nie.

**Editierbar soll er auch nicht werden.** `prod` lädt keine Katalog-Fassung, ein in
`pl` geänderter Schnitt wäre eine zweite stille Wahrheit, die nur ein Teil des
Teams sieht. Gefehlt hat nicht das Ändern, sondern das **Prüfen**. Der
Änderungsweg ist deshalb:

    Klärung  →  Export  →  Seed-Änderung  →  Release

Nichts in diesem Modul schreibt in die Katalog-Fassung oder in den Seed.

## 2. Eine Datei je Autor — die tragende Entscheidung

Ablage: `_intern/klaerung/<klaerungId>/<autor>.jsonl`, append-only über
`haengeAnSidecar` ([sidecar-datei.ts](../../src/core/status/sidecar-datei.ts)) —
dieselbe Mechanik wie Katalog, Trigger und Journal.

**Warum nicht eine Datei je Klärung:** `appendToFile`
([atomic-write.ts](../../src/core/services/infrastructure/atomic-write.ts)) ist
read-modify-write — ganze Datei lesen, anhängen, ganze Datei schreiben. Auf einer
gemeinsamen Datei überschreibt bei zwei gleichzeitigen Antworten der zweite Write
den ersten: die Zeile ist weg, `haengeAnSidecar` meldet trotzdem `true`, und der
Verlierer sieht seine Antwort weiter auf seinem Bildschirm. Über SMB ist dieses
Fenster zehner- bis hunderter Millisekunden breit. Für ein Werkzeug, dessen
einzige Aufgabe das Einsammeln fremder Antworten ist, ist das der Fehler, der das
Vertrauen kostet.

Mit einer Datei je Person schreiben zwei nie dieselbe Datei — das Rennen
verschwindet **konstruktiv statt per Abmilderung**. Nachlesen-und-Wiederholen wäre
echt schlechter: ein zweiter Voll-Read je Antwort, und das Fenster wird kleiner,
ohne je zu schließen. Das Journal kommt mit einer Datei aus, weil es genau einen
Schreiber hat (den Nachtlauf).

Der Dateiname transliteriert Umlaute (`THÜ` → `THUE.jsonl`), bevor der Rest auf
`[A-Z0-9]` reduziert wird — ein bloßes `_` für alles Nicht-ASCII ließe `THÜ` und
`TH-` auf denselben Namen fallen und brächte das Rennen für diese zwei zurück. Der
maßgebliche Autor steht ohnehin **in** jeder Zeile, nicht im Dateinamen.

## 3. Faltung: Dateireihenfolge, nicht Zeitstempel

[fold.ts](../../src/plugins/zu-klaeren/fold.ts) liest alle Autor-Dateien und faltet
sie in **einem** Durchlauf zu zwei Projektionen: je `(autor, punktId)` das letzte
Urteil, und je Punkt alle Beiträge.

**Die Reihenfolge in der Datei entscheidet.** Mehrere Kollegen an mehreren
Windows-Rechnern haben mehrere Uhren; sortierte die Faltung nach `ts`, könnte die
nachgehende Uhr eines Rechners eine neuere Meinung dauerhaft und stillschweigend
überschreiben. `ts` ist reine Anzeige. Über Autor-Dateien hinweg spielt die
Reihenfolge für Urteile keine Rolle (Schlüssel ist der Autor); nur die
Kommentarliste wird zur Anzeige nach `ts` gemischt, wo Uhren-Schiefe kosmetisch ist.

Kaputte Zeilen werden übersprungen, nie geworfen — eine append-only Datei kann auf
einem abgebrochenen Schreibvorgang enden, und eine halbe letzte Zeile darf nicht
die Antworten aller anderen unlesbar machen.

**Kein `null` im Drahtformat.** `JSON.stringify` verschluckt `undefined` und behält
`null`; ein nullbares Feld hätte zwei unsichtbar verschiedene „leer"-Arme.
Zurückziehen ist deshalb ein **Wert** (`urteil: 'zurueckgezogen'` bzw.
`kommentarZurueck: true`) und löscht nie eine Zeile.

## 4. Einigkeit misst den Zielwert, nicht den Knopf

[konsens.ts](../../src/plugins/zu-klaeren/konsens.ts) reduziert jedes Urteil auf
einen **Zielwert**: `passt` → die Seed-Phase des Codes, `andere` → die gewählte
Phase; `unklar` und `zurueckgezogen` zählen nicht mit. Strittig ist ein Punkt bei
**≥ 2 verschiedenen Zielwerten**.

Damit ist `andere→Prüfung` gegen `andere→Entscheidung` strittig — aber
`andere→Prüfung` gegen `passt`, wo der Seed ohnehin Prüfung sagt, **nicht**. Ohne
diese Normalisierung verbrennt der Termin Zeit an Nicht-Konflikten.

**`unklar` ist keine Gegenstimme, sondern fehlende Information** — eigene Achse,
eigener Marker, eigener Filter. „Zwei sagen passt, einer unklar" braucht eine
Rückfrage, nicht eine Entscheidung. Der Zeilen-Filter ist deshalb dreiwertig
(`alle | strittig | unklar`), kein Häkchen. Freitext-Punkte sind nie strittig —
sonst versteckte „nur strittige" ausgerechnet die Grundsatzfragen.

Antworten darf nur, wessen Kürzel **eine Person** meint (`istAntwortfaehig`): leer,
`alle` oder eine Vertretungsliste mit Komma sind gesperrt, sonst teilten sich zwei
Menschen ein Faltungsfach. Lesen bleibt für alle offen.

## 5. Zahlen und ihr Stempel

Die Vorkommen-Spalte zählt **Vorgänge je Statuscode** über
[`jederVorgang`](../../src/core/status/vorgangs-quelle.ts) — nicht Verbünde wie die
`vorkommen`-Map des Katalog-Tabs, und **ohne Betrachtungsbereich-Filter**
(Pitfall #46: Evidenz folgt dem Bereich nicht). Zwei Personen mit verschiedenen
Bereichs-Einstellungen sollen dieselbe Zahl sehen.

Gelesen wird die **lokale** Datenbank. Wer Montag importiert hat, hat andere Zahlen
als wer Donnerstag importiert hat — deshalb trägt die Spalte den Bestandsstand als
Stempel. Der Zähl-Lauf startet **nach** dem ersten Rendern; scheitert er, bleiben
die Zahlen leer („—") und die Klärung funktioniert weiter.

## 6. Ergebnis mitnehmen

Drei Ausgaben ([export.ts](../../src/plugins/zu-klaeren/export.ts)), weil drei
verschiedene Leute etwas anderes brauchen:

| Ausgabe | Für wen | Inhalt |
|---|---|---|
| Arbeitsmappe (XLSX) | den Termin | Zuordnungen mit einer Spalte je Person, Grundsatzfragen, Rohdaten |
| Kurzfassung (Markdown) | das Protokoll | nur abweichende Zeilen und kommentierte Fragen |
| Seed-Änderungen (Text) | die Umsetzung | pastefähige `[38, 'entscheidung'],`-Zeilen für `zah-phasen.ts` |

Der Seed-Diff enthält **nur einige** Punkte, deren Konsens abweicht. Strittiges
bleibt ausdrücklich draußen: ein offener Streit ist kein Änderungsauftrag, und wer
ihn dort fände, übernähme ihn versehentlich. Ein Wechsel auf „ohne Phase" erscheint
als Entfernung plus `SEED_MARKER_CODES`-Eintrag — die Phasen-Map kennt diesen Wert
nicht.

Die Arbeitsmappe nutzt [core/status/export/arbeitsmappe.ts](../../src/core/status/export/arbeitsmappe.ts)
(mit v2.407 aus dem Status-Cockpit hochgezogen, als der zweite Konsument kam).

## 7. Eine neue Klärung anlegen

Zwei Sachen im Code — es gibt bewusst **kein** Bedienelement dafür. Klärungen sind
Seed-Daten; ihre Beantwortung ist die Arbeit, nicht ihr Anlegen.

1. Ein `Klaerung`-Objekt (`klaerungId`, `titel`, `datum` als Feld — nicht im Titel).
2. Eine Funktion, die ihre `KlaerungPunkt[]` baut. Punkte, die sich auf Daten
   beziehen, werden **zur Laufzeit erzeugt**, nie abgeschrieben — eine kopierte
   Liste driftet beim ersten neuen Statuscode
   ([seed-phasenschnitt.ts](../../src/plugins/zu-klaeren/seed-phasenschnitt.ts) ist
   das Muster).

`antwortTyp` hat heute zwei Ausprägungen (`phasenzuordnung`, `freitext`). Weitere
kommen, wenn eine Klärung sie braucht — nicht vorher.

## 8. Was hier nicht passiert

- **Keine automatische Übernahme** — kein Schreibpfad in Katalog-Fassung oder Seed.
- **Kein Live-Sync, kein Polling** — neu gelesen wird bei Fensterfokus und per
  Knopf, mit sichtbarer Stand-Zeit. Mehrere Clients, die ein SMB-Verzeichnis
  pollen, sind ein schlechter Nachbar.
- **Kein Löschen** — Zurückziehen nimmt eine Aussage aus der Auswertung, die Zeile
  bleibt in der Datei.
- **Keine anonymen Einträge und kein stiller No-op** — fehlt das Kürzel oder das
  Schreibrecht, steht das als Satz über der Tabelle; ein fehlgeschlagener
  Share-Write wird angezeigt, statt Erfolg vorzutäuschen.

## Technik

Flag `vorgangssystem` (dev, pl, as); in prod und kurator unsichtbar. Beide
Zielvarianten haben `datenShareSchreibrecht: true`, können also lesen und
antworten. Sidebar-Gruppe **`tools`**, nicht `erprobung`: die Erprobungs-Gruppe ist
zuklappbar und bei Bestandsnutzern womöglich seit Monaten zu — ein Fragebogen, der
beantwortet werden soll, darf nicht in einer Schublade liegen.

Der Share-Zugriff läuft ausschließlich über `sidecar-datei.ts`; der Guard
`status-katalog-share-only` deckt `src/plugins/zu-klaeren/` mit ab, und
`_intern/klaerung` steht als Pfad-Konstante genau einmal im Code
([pfade.ts](../../src/plugins/zu-klaeren/pfade.ts)).
