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

Der Dateiname transliteriert Umlaute (`Thomas Hübsch` → `THOMAS_HUEBSCH.jsonl`),
bevor der Rest auf `[A-Z0-9]` reduziert wird — ein bloßes `_` für alles
Nicht-ASCII ließe `Hübsch` und `Hu-bsch` auf denselben Namen fallen und brächte
das Rennen für diese zwei zurück. Der maßgebliche Autor steht ohnehin **in** jeder
Zeile, nicht im Dateinamen.

### Der Autor ist eine Person, keine Rolle (seit v2.414)

Autorschaft kommt aus `UserProfile.name`, **nicht** aus `bearbeiter_kuerzel`. Das
Kürzel ist eine Rolle im Fachsystem: PL und Kurator haben keines und waren damit
von der Klärung ausgesperrt — ausgerechnet die zwei Rollen, die den Phasenschnitt
kuratieren. Es zwang außerdem zu Sonderfällen (`alle`, `MUE,SCH`), weil das Feld
legitim auch Sammelwerte trägt. Ein Name meint immer genau einen Menschen; für die
Klärung spielt das Kürzel keine Rolle mehr.

Name und Schlüssel sind zwei Formen: `normalisiereAutor` (NFC, getrimmt,
Großbuchstaben, innere Leerzeichen vereinheitlicht) ist die **Vergleichsform** und
keyt Faltung und Dateinamen; `anzeigeAutor` ist die **Schreibweise des Profils**
und steht in der Datei, in den Spaltenköpfen und im Export. `KlaerungStand.namen`
hält die Zuordnung — ohne sie stünde „THOMAS HÜBSCH" in der Tabelle.

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

**Punkt-Ids sind stabil, und alte werden beim Lesen übersetzt.** Eine Id darf nie
aus einer Position entstehen: die Zeilen auf dem Share zeigen darauf, und ein
eingefügter Punkt verschöbe alle Antworten dahinter — lautlos, in einer Datei, die
sich nicht korrigieren lässt. Bis v2.412 galt das für die Grundsatzfragen nicht
(`frage-${i + 1}`); die bereits geschriebenen Zeilen laufen seither über
`ALT_PUNKT_IDS` aus dem Seed, ausgewertet an **genau einer** Stelle in `falte`.
Damit sehen Urteil, Kommentar und Widerruf denselben Schlüssel, der Schreibpfad
bleibt unberührt, und eine Jahre später eingespielte Archivdatei stimmt weiterhin.
Ein Konventionstest (`no-index-punkt-id`) hält die Zusage fest; aus **Daten**
abgeleitete Ids (`code-${code}`) sind ausdrücklich erlaubt.

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

Antworten darf, wer einen **Namen** im Profil hat (`istAntwortfaehig`) — mehr
verlangt die Sperre nicht. Lesen bleibt für alle offen; der Grund steht als Satz
auf der Seite, nicht als grauer Knopf.

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

## 5a. Ist-Stand: was der Katalog dazu heute führt (seit v3.1)

Beschlossen wird hier, **vollzogen wird im Baum** — und bis v3.0 war zwischen
beidem keine Verbindung. In der Klärung stand bei Code 29 „einig → Abgeschlossen",
im Baum stand er weiterhin ohne Phase; beides stimmte für sich, der Widerspruch
fiel nirgends auf. Die Spalte **Ist-Stand** stellt ihn daneben: die gepflegte Phase
des Codes plus einen von drei Vermerken.

| Lage | Vermerk |
|---|---|
| Konsens und Fassung stimmen überein | **umgesetzt** |
| Konsens weicht ab, die Fassung steht noch auf der Auslieferung | **noch offen** |
| Die Fassung trägt eine Änderung, zu der es keinen oder einen anderen Konsens gibt | **abweichend beschlossen** |

Die drei Lagen sind **disjunkt** ([`istStandVon`](../../src/plugins/zu-klaeren/gruppen.ts)).
Der Fall Code 29 landet unter *noch offen* — der Beschluss steht da, vollzogen ist
er nicht; ihn *abweichend* zu nennen unterstellte dem Katalog eine Änderung, die er
nicht trägt. Beide Lagen zählen zum Filter **„Nicht umgesetzt"**, mit dem sich am
Ende einer Sitzung in einem Klick zeigen lässt, was noch offen ist.

Zwei Regeln dazu:

- **Nichts wird angeglichen.** Weder wird die Fassung nach dem Konsens geändert
  noch umgekehrt. Der Vermerk stellt fest; die Entscheidung bleibt beim Menschen.
- **Verglichen wird genau einmal.** Die gepflegte Phase je Code kommt aus
  [`katalogDrift`](../../src/core/status/katalog-drift.ts) — dieselbe Funktion, die
  im Statuswerte-Tab die Bilanz zeigt. Bis v3.0 stand in `useKlaerung` daneben eine
  eigene Filterschleife über `zahPhaseId`, also eine zweite Wahrheit über dieselbe
  Frage.

Die Spalte erscheint nur, wenn eine Zeile etwas zu vermerken hat
(`zeigtIstStand`, dieselbe Mechanik wie bei „Stand"). Ohne geladene Fassung
schweigt sie ganz, statt „steht auf Auslieferungsstand" zu behaupten. Beschriftet
wird sie gegen die **Fassung** (`fassungLabel`) und nicht gegen die Auslieferung —
sonst hieße ein selbst angelegter Verfahrensschritt „Marker (ohne Phase)".

## 6. Ergebnis mitnehmen

Drei Ausgaben, weil drei verschiedene Leute etwas anderes brauchen:

| Ausgabe | Für wen | Quelle | Inhalt |
|---|---|---|---|
| Arbeitsmappe (XLSX) | den Termin | die Antworten | Zuordnungen mit einer Spalte je Person, Grundsatzfragen, Rohdaten |
| Kurzfassung (Markdown) | das Protokoll | die Antworten | nur abweichende Zeilen und kommentierte Fragen |
| Seed-Änderungen (Text) | die Umsetzung | die **Fassung** | die neue Phasen-Tabelle und die Zuordnungen, einfügefertig für `zah-phasen.ts` |

Die ersten beiden liegen in [export.ts](../../src/plugins/zu-klaeren/export.ts), die
Seed-Änderungen seit v3.1 in [seedExport.ts](../../src/plugins/zu-klaeren/seedExport.ts)
— andere Quelle, andere Datei.

**Warum die Seed-Änderungen aus der Fassung kommen und nicht aus den Antworten:**
bis v3.0 baute der Export seine Zeilen aus dem Konsens. Am 05.08. nannte er
deshalb fünf Änderungen, während der Baum zehn Umhängungen und drei
Phasenänderungen trug. Nur der Baum ist der Stand, der wirken soll. Was besprochen,
aber nie vollzogen wurde, steht weiterhin in der Kurzfassung und als „noch offen"
an der Zeile — aber nicht in einem Änderungsauftrag an den Code.

Der Text hat drei Abschnitte:

1. **Verfahrensschritte** — die **ganze** neue `SEED_ZAH_PHASEN`-Liste, nicht nur
   die Unterschiede: Entfernung, Umbenennung und Reihenfolge einzeln einzusetzen
   wären vier Gelegenheiten, eine zu übersehen. Der alte Wert steht als Kommentar
   an der Zeile, Entfernungen als Kommentar darüber.
2. **Zuordnungen** — je umgehängtem Code eine `[32, 'pruefung'],`-Zeile mit dem
   alten Wert. Ein Wechsel auf „ohne Phase" erscheint als Entfernung plus
   `SEED_MARKER_CODES`-Eintrag; die Phasen-Map kennt diesen Wert nicht.
3. **Zieltage** — deutlich abgesetzt und ausdrücklich **nicht einfügefertig**: die
   Auslieferung hat dafür noch keine Struktur, diese Kuration lebt bislang
   ausschließlich in der Fassung. Information für die Entscheidung, kein Code.

„Nichts zu ändern" und „Fassung nicht geladen" sind zwei verschiedene Ausgaben —
die falsche davon beruhigt.

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
  Auch der Ist-Stand-Vermerk gleicht nichts an: er sagt, dass Beschluss und Katalog
  auseinandergehen, und überlässt die Entscheidung dem Menschen.
- **Kein Live-Sync, kein Polling** — neu gelesen wird bei Fensterfokus und per
  Knopf, mit sichtbarer Stand-Zeit. Mehrere Clients, die ein SMB-Verzeichnis
  pollen, sind ein schlechter Nachbar.
- **Kein Löschen** — Zurückziehen nimmt eine Aussage aus der Auswertung, die Zeile
  bleibt in der Datei.
- **Keine anonymen Einträge und kein stiller No-op** — fehlt der Name im Profil
  oder das Schreibrecht, steht das als Satz über der Tabelle; ein fehlgeschlagener
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
