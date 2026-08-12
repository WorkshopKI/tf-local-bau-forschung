# Status-System neu — Übersicht

Ersetzt die früher hartkodierte Status→Kategorie-Map durch **kuratierbare Daten +
Historie + deterministische Ableitung**. Rein deterministisch, kein LLM. Gated
hinter dem Flag `statusCockpit` (dev/pl/kurator).

**Der Katalog ist Team-Daten, die Historie ist gerätelokal.** Seit v2.332 liegt
der kuratierte Katalog als Sidecar `_intern/status-katalog.json` auf dem
Daten-Share — vorher wirkte eine Kuration nur auf dem Rechner, auf dem sie
stattfand, sodass entweder niemand kuratierte oder jeder neu. Das Event-Log
wandert bewusst NICHT mit: es hält fest, wann *diese Installation* eine Änderung
beobachtet hat, und ergäbe zusammengeführt eine widersprüchliche Historie.

**Die Fassungsdatei rotiert (seit v2.414).** Eine `MappingVersion` wiegt rund
250 KB; ungebremst wuchs die Datei, die bei jedem App-Start vollständig gelesen
und geparst wird. Die jüngsten
[`FASSUNGEN_IN_HAUPTDATEI`](../../src/core/status/katalog-rotation.ts) = 8
bleiben in der Hauptdatei, ältere wandern nach
`_intern/status-katalog-archiv.json` — **gelöscht wird nichts**, und die aktive
Fassung bleibt immer in der Hauptdatei, damit kein Client zum Start das Archiv
braucht. Geschrieben wird Archiv zuerst; scheitert das (kein Schreibrecht, IO),
wird nicht rotiert und die Hauptdatei bleibt vollständig. Das Versions-Panel
lädt das Archiv nach, sobald es offen ist, und `reaktivieren` fällt darauf
zurück — sonst wäre eine Fassung auf einem frisch aufgesetzten Rechner
unerreichbar. Schreib-Profil: [add-sidecar-persistence.md](../agents/add-sidecar-persistence.md).

## Zwei Schichten

1. **Katalog** ([katalog-store.ts](../../src/core/status/katalog-store.ts), Seed
   [seed.ts](../../src/core/status/seed.ts)) — jedes Statusfeld + jeder Statuswert
   bekommt Kategorie, ZAH-Phase und Prominenz; Statuswerte zusätzlich Zieltage.
   Versioniert im
   dedizierten IDB-Store `status_katalog`. Unbekanntes wird beim Import als
   `unkuratiert` gesammelt, nie automatisch gemappt.
   Seit v2.348 führt er die **505 Codes des Fachsystems** aus der Kürzel-Zuarbeit
   in einem Ordnerbaum (Verbund und Teilvorhaben getrennt), jeweils mit den
   Rollen, die den Eintrag setzen dürfen — Herkunft, Spalten-Konvention und
   Wirkung: [KATALOG-CODES.md](KATALOG-CODES.md).
2. **Historie** ([HISTORIE.md](../_archiv/HISTORIE.md)) — append-only `StatusEvent`-Log
   (`status_event`), per idempotentem Post-Import-Reconcile befüllt.

> **Eine dritte Schicht gab es bis v2.384**: eine Ableitungs-Engine, die aus dem
> ganzen Feld-Ensemble einen Hauptstatus errechnete (höchster Rang gewinnt,
> `terminal` schlägt Rang, Widerspruch ⇒ Konflikt). Sie lief dem amtlichen Status
> regelmäßig voraus — bei 485 von 7 534 Verbünden sagten beide etwas anderes —
> und ist mit dem Rückbau entfallen. Die App leitet keinen Status ab
> (Pitfall #44); was von der Achse bleibt, ist die **ZAH-Phase** am amtlichen
> Code: [vorgangssystem.md §7](../architecture/vorgangssystem.md#7-der-rückbau-der-alten-ableitung-p6-umgesetzt).

## Anzeigeflächen

- **Cockpit** (Plugin `status-cockpit`, [status-cockpit.md](../feedback-kontext/status-cockpit.md)) —
  Katalog/Kürzel/To-dos kuratieren, Versionieren, JSON-Export/Import.
  Der Ordnerbaum ist seit v2.351 ein **echter Baum** ([KategorieEditor.tsx](../../src/plugins/status-cockpit/KategorieEditor.tsx)):
  Zweige klappen zu, umgehängt wird per Ziehen (Regeln rein in
  [ordnerDrag.ts](../../src/plugins/status-cockpit/ordnerDrag.ts) — Ebenen bleiben
  getrennt, kein Nachfahre als Elternknoten).
- **Detailseite** — `#status`-Abschnitt (ZAH-Phase + Verlauf + Navigator).
  Zwei Sichten auf **dieselben** Termine aus den Datumsfeldern: die **Chronik**
  (Standard, [chronik.ts](../../src/core/status/chronik.ts)) listet sie — mit
  Rollenspalte und fehlenden Gegenstücken —, der **Zeitstrahl**
  ([VerlaufsBand.tsx](../../src/plugins/antraege/verlauf-band/VerlaufsBand.tsx))
  zeichnet sie als Bahn. Bis v3.48 hieß die Bahn „Band" und daneben stand eine
  dritte Sicht auf das gerätelokale Ereignis-Protokoll; die blieb leer, solange
  eine Installation nichts mitgeschrieben hatte, und ist entfallen.
- **Fördertabelle** — Info-Icon je Zeile mit der Status-Erklärung.
- **Home-Widget** „Status & Verlauf".

## Harte Regeln

- **`getStatusCategory` ist snapshot-basiert** ([status-canonical.ts](../../src/core/utils/status-canonical.ts)):
  liest den aktiven Katalog-Snapshot, Fallback = eingebaute `CATEGORY_MAP`; bei
  identischem Mapping **bitweise identisch** (Test `byte-identitaet`).
- **Der Katalog geht auf genau einem Weg auf den Share**: die Sidecar
  ([katalog-share.ts](../../src/core/status/katalog-share.ts)), Profil
  idempotent-overwrite + Backup-Rotation, self-gated über `queryPermission`.
  Nie `registry.json`, nie SMB-Snapshot, nie Personal-Mirror (Guard
  `status-katalog-share-only`). Der Abgleich läuft **einmal beim App-Start**
  (`initStatusKatalog`) — `ladeAktiveVersion` bleibt IDB-only, weil sie an jedem
  Import hängt. Vor der ersten Übernahme sichert
  `uebernehmeKatalogVomShare` den lokalen Stand einmalig unter
  `status-katalog:vor-share-uebernahme`; lokale Fassungen mit Nummern, die der
  Share nicht kennt, bleiben stehen.
- **Veröffentlichen ist read-before-write** ([katalog-konflikt.ts](../../src/core/status/katalog-konflikt.ts)),
  seit den Katalog mehrere PL-Personen asynchron pflegen. Jeder Schreibvorgang
  liest die Datei zuerst und **vereinigt die Fassungsliste** — fremde Fassungen,
  die der lokale Cache nicht kennt, kommen hinein (auch wenn der Konflikt danach
  bewusst übergangen wird). Vereinigt wird nur die **Liste**, nie der Inhalt: eine
  feldweise Mischung ergäbe einen Katalog, den niemand beschlossen hat. Die
  Vereinigung steht **vor** der Nummernvergabe, damit `naechsteVersionsnummer`
  keine Nummer zweimal ausgibt.
  Erkannt wird optimistisch wie im Journal (`aktiv > basisVersion`, plus
  Nummern-Kollision), geprüft ein zweites Mal unmittelbar vor dem Schreiben —
  dafür reicht `leseKatalogNummer` mit 4 KB Dateikopf statt der ~2,9 MB dahinter.
  **Gelöst wird nichts automatisch**: der Konflikt kommt mit Nummer, Autor,
  Zeitpunkt und der Zahl abweichender Einträge vor den Menschen, und beide Wege
  („fremde laden" / „trotzdem veröffentlichen") lassen beide Fassungen in der
  Datei stehen. Die Frühwarnung beim Fensterfokus liest nur diese Nummer — kein
  Intervall, kein automatisches Umschalten.
- **Das Event-Log bleibt gerätelokal** — nie Share/Snapshot/Personal-Mirror
  (Guard `status-event-log-local-only`). Ebenso der Unkuratiert-Puffer: er hält
  fest, was *diese* Installation gesehen hat; was die PL inzwischen team-weit
  kuratiert hat, räumt `pruneKuratierte` beim nächsten Import heraus.
- **JSON-Export/Import im Cockpit bleibt** — nicht mehr als einziger
  Portabilitätsweg, sondern für Sicherung und Transfer zwischen Installationen.
- **Event-Log ist append-only** — nie mutieren/löschen (auch kein „Aufräumen"
  ignorierter Felder).
- **Eine Phasen-Achse**: die ZAH-Phase am amtlichen Code. Die Verfahrensleiste
  speist sich seit v2.384 daraus, statt eine zweite Wirbelsäule zu führen. Das
  Zwei-Achsen-Prinzip bleibt — amtlicher Status **vs. Artefakte** (GA/NF/ABL/RNE),
  nicht amtlicher Status vs. abgeleitete Position.
- **Der Verfahrensschritt ist kuratierbar, die Arbeitsliste nicht** (seit
  v2.409): 3 bis 9 Phasen mit freier Beschriftung in der Fassung, `StatusCategory`
  fest im Code. Warum das so asymmetrisch ist, und wie die Bezeichnungen
  zusammenhängen: [status-achsen.md](../architecture/status-achsen.md)
  (Pitfall #50).
- **Wie ein Rohstatus heißt, steht an einer Stelle** (seit v3.16): die Kurzform
  für enge Flächen kommt aus `StatusCodeEintrag.kurz` (Auslieferung), überlagert
  von `StatusWertEintrag.kurzLabel` (Kuration, je **Code**); gelesen über
  `statusKurzLabel()` / `statusLabel()`. Bis dahin lag sie dreifach hartkodiert —
  eine Kopie mit Tippfehler, eine auf eine Schreibweise geschlüsselt, die im
  Bestand nicht vorkommt. Gepflegt wird sie im Reiter *Statuswerte* (Spalte
  „Kurzform" + Pflegeliste nach Vorkommen).
- **Die Drift gegenüber der Auslieferung wird ausgewiesen, nicht zurückgesetzt**
  (seit v3.1, [katalog-drift.ts](../../src/core/status/katalog-drift.ts)). Weil der
  Schnitt seit v2.409 in der App kuratiert wird und `prod` weiter auf dem Seed
  läuft, wächst der Abstand zwischen beiden — sichtbar war er nirgends.
  `katalogDrift(fassung, seed)` bilanziert ihn nach Phasen, Zuordnungen,
  Zieltagen, Statuswerten und Prominenz; angezeigt als ausklappbare Zeile über dem
  Ansichtsumschalter im Statuswerte-Tab. Drei Regeln:
  - **Sie stellt fest, sie ändert nichts.** Anders als bei
    `todoRegelDrift`/`zieheTodoRegelnNach` gibt es **kein** Nachzieh-Gegenstück:
    hier ist die Kuration der spätere Stand, und „Drift zurücksetzen" verwürfe
    genau die Arbeit, die die Bilanz sichtbar macht.
  - **Keine zweite Vergleichslogik**: der Code→Phase-Schnitt kommt für beide
    Seiten aus `schnittVon`, die Phasenliste aus `zahPhasenVon`. Denselben Aufruf
    nutzt die Klärungsseite für ihren Ist-Stand-Vermerk
    ([klaerung.md](../architecture/klaerung.md)).
  - **Gezählt wird die Sache, nicht die Katalogzeile.** Ein Status steht zweimal
    im Katalog (TV- und Verbund-Feld); ungefiltert meldete die Bilanz jeden
    gepflegten Zieltag doppelt. Entdoppelt wird nach Code **und** Aussage — sagen
    beide Zeilen dasselbe, zählt es einmal; sagen sie Verschiedenes, bleiben
    beide, sonst verschwiege die Bilanz ein Auseinanderlaufen. `w.kategorie` ist
    bewusst **nicht** Teil des Vergleichs: das Feld ist abgeleitet und wird vom
    Snapshot neu gerechnet (Pitfall #45).

## Weitere Docs

- [KATALOG-CODES.md](KATALOG-CODES.md) — die ~180 Codes des Fachsystems:
  Spalten-Konvention (`D_`/`T_`/`X`), Ordnerbaum, AB/FB, ZAH-Phase je Feld,
  Ordner-Spalten in der Fördertabelle.
- [KATALOG-V1.md](KATALOG-V1.md) — Seed-Defaults. **Historisch**: die dort beschriebenen Rang-/Spine-/Terminal-Defaults sind mit v2.385 entfallen.
- Im Archiv (Momentaufnahmen, nicht beim Arbeiten am Code lesen): [BESTANDSAUFNAHME.md](../_archiv/BESTANDSAUFNAHME.md) — verifizierter Ausgangszustand; [HISTORIE.md](../_archiv/HISTORIE.md) — Event-Modell + Reconcile.
