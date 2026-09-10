# Ein Durchgang, viele Mitfahrer — der geteilte Roh-Halter des Bestands

Stand: 2026-09-10 · Ausgangspunkt: die Vorgangs-Regeln-Seite liest denselben Bestand ein zweites Mal, statt den laufenden Durchgang mitzubenutzen.

## 0. Anlass

Offener Posten aus v6.47.0, festgehalten in [vorgangssystem.md §17](../../architecture/vorgangssystem.md)
und im Plan `ultracode-for-performance-issues`:

> „Die Vorgangs-Regeln-Seite bleibt kalt bei ~12–15 s — sie fährt einen zweiten,
> eigenen Voll-Durchgang neben `laufeBestand` (`cockpit ladeBestand: 11238ms,
> io 5073ms`). Das ist kein Quick Win mehr: es braucht einen gemeinsamen
> Roh-Halter für beide Durchgänge oder eine schmale Projektion — beides mit
> eigener Spec."

Der Nutzer hatte „Menü Vorgangsregeln" als ersten von vier Schmerzpunkten
genannt. v6.47 hat die Seite gemessen, aber nicht repariert. Freigabe für die
eigene Spec am 09.09.2026 („Ja").

## 1. Warum

Die wörtliche Bitte sagt „zweiter Durchgang neben `laufeBestand`". Die Messung
sagt etwas Allgemeineres und Schlimmeres: **es gibt 13 unabhängige Leser
derselben drei Stores**, und wenn zwei davon gleichzeitig laufen, werden sie
nicht schneller geteilt, sondern **gegenseitig langsamer**.

Der Grund ist die Bauform. `jederVorgang` ([vorgangs-quelle.ts:73](../../../src/core/status/vorgangs-quelle.ts:73))
ist als geteilte Vorarbeit gedacht und wird von 12 Stellen benutzt — aber es ist
eine **Funktion**, kein Halter: jeder Aufruf liest die Stores neu.
`ladeBestand` ([ladeBestand.ts:57](../../../src/plugins/status-cockpit/ladeBestand.ts:57))
ist der 13. Leser und benutzt `jederVorgang` nicht einmal, sondern **dupliziert
dessen Lesecode**.

Was daraus folgt: Der Engpass ist nicht die Rechnung und nicht ein einzelner
Bildschirm. Es ist, dass ein Lesevorgang über 14 225 Anträge **3,1 s** kostet,
**nichts davon gecacht wird** und die App ihn mehrfach parallel bezahlt.

## 2. Befunde aus dem Bestand

Gemessen am 09./10.09.2026 in `dev:local` (Variante `zah-local`, Port 5179) gegen
den echten Stand: **14 225 Anträge · 7 535 Verbünde · 3 Schemas · 1 Programm**.

### 2.1 Der Boden: ein Roh-Durchgang kostet 3,1 s, und IndexedDB cacht nichts

Direkt gegen die IDB gemessen (`getAll` über `antraege`, `verbuende`,
`csv_schemas`), vier Runden hintereinander im Leerlauf:

| Runde | `antraege` | `verbuende` | `csv_schemas` | Summe |
|---|---|---|---|---|
| 1 | 2 971 ms | 62 ms | 1 ms | **3 035 ms** |
| 2 | 3 117 ms | 62 ms | 2 ms | **3 181 ms** |
| 3 | 3 018 ms | 69 ms | 3 ms | **3 089 ms** |
| 4 | 3 146 ms | 63 ms | 2 ms | **3 211 ms** |

Die vierte Runde ist nicht schneller als die erste. **Die Deserialisierung fällt
jedes Mal voll an** — es gibt keine Ersparnis, auf die man hoffen könnte, und
damit ist jeder vermiedene Durchgang volle 3,1 s wert.

### 2.2 Die Regeln-Seite allein: 6,4 s, und §17 war zu hoch

Sauberer Einzellauf über „neu berechnen" (Klick-Handler, **kein**
StrictMode-Zwilling), auf einer gesetzten Seite:

```
[tf-perf] cockpit ladeBestand: 7535 Verbünde, 3 Schemas in 6447ms (io 3105ms)
[status-cockpit] gesamt 6884 ms | fassung 17 | versionen 29 (25)
                 | bestand 6843 (7535 Verbünde) | trigger 6867
```

`io 3105 ms` trifft den Boden aus 2.1 auf 1 % genau. Bleiben **3 342 ms
Rechnung**.

**Korrektur an §17**: die dort notierten „12–15 s" stammen aus dem
Dev-StrictMode — `ladeAlles` läuft beim Mount zweimal
([useStatusCockpit.ts:433](../../../src/plugins/status-cockpit/useStatusCockpit.ts:433)),
und beide Läufe treffen den noch leeren Cache. Produktiv ist die Seite kalt bei
**~6,4 s**. Die Zahl in §17 wird richtiggestellt.

### 2.3 Der Verstärker: zwei gleichzeitige Läufe kosten je 1,6×

Der StrictMode-Zwilling ist dafür der saubere Naturversuch — zwei **identische**
Durchgänge, gleichzeitig gestartet:

| | `io` | gesamt |
|---|---|---|
| ein Durchgang allein (2.2) | 3 105 ms | 6 447 ms |
| zwei gleichzeitig, erster | 4 975 ms | 10 268 ms |
| zwei gleichzeitig, zweiter | 7 694 ms | 14 008 ms |

Zwei Durchgänge **nebeneinander** sind teurer als zwei **nacheinander**
(14 008 ms Wanduhr gegen 2 × 6 447 = 12 894 ms Threadzeit). Gleichzeitigkeit ist
hier kein Vorteil, den man nutzt, sondern ein Schaden, den man vermeidet.

### 2.4 `trigger` ist Wartezeit, nicht Arbeit — §17 behält recht

`gesamt 6884` bei `trigger 6867`: `ladeTrigger` liegt mit `ladeBestand` im
selben `Promise.all` ([useStatusCockpit.ts:399](../../../src/plugins/status-cockpit/useStatusCockpit.ts:399))
und wird fertig, wenn der Thread frei wird. Die Maßnahme M4 aus dem
Performance-Plan („Trigger-Sidecar cachen") bleibt zu Recht zurückgestellt.

### 2.5 Ein sitzungslanger Halter ist ausgeschlossen

Über alle 14 225 Records gemessen: **375 Felder je Antrag, davon 167 gesetzt.**

| | Größe im Speicher (UTF-16) |
|---|---|
| die Roh-Records vollständig | **284 MB** |
| nur die gesetzten Feldwerte (Schlüssel + Wert) | **142 MB** |

Beide von der Ausgangsfrage angebotenen Wege — „gemeinsamer Roh-Halter" und
„schmale Projektion" — scheitern als **sitzungslanger** Halter an dieser Zahl.
Genau deshalb hält `jederVorgang` heute nichts fest und arbeitet mit Callback
statt Rückgabe-Array (dort so begründet). Ein **laufzeit-begrenzter** Halter ist
dagegen gratis: die Arrays eines Programms sind während eines Durchgangs ohnehin
im Speicher.

### 2.6 Die acht Erhebungen sind nicht das Problem

`useEinsatzErhebung`, `useFristErhebung`, `usePlatzhalterErhebung`,
`useRegelAenderung`, `useRegelProbelauf`, `useRegelWirkung`, `useTerminErhebung`,
`useVerlaufErhebung` laufen alle **auf Knopfdruck**, keine beim Reiterwechsel.
Sie kollidieren selten und der Nutzer erwartet dort eine Wartezeit. Sie bleiben
in diesem Durchgang unangetastet (Entscheidung des Nutzers, 09.09.2026).

### 2.7 Der Schnitt kann NICHT bei `jederVorgang` liegen

Naheliegend wäre, `ladeBestand` auf `jederVorgang` zu heben. **Das änderte die
Ausgabe** und verstieße gegen Pitfall #44/#45:
`sammleVorkommenGeplant` behandelt die Verbund-Codes im TV-Record
(`art: 'verbund-aus-tv'`) mit **einem** Eintrag je Verbund — dem **ersten**
Teilvorhaben, das einen Wert trägt ([feld-aufloesung.ts:302](../../../src/core/status/feld-aufloesung.ts:302)):

```ts
for (const a of antraege) {
  const treffer = vorkommenAusRecord(s, a.record);
  if (treffer) { out.push(treffer); break; }   // erster Treffer genügt
}
```

`jederVorgang` ruft das **je Antrag** mit `[einem]` Antrag auf; `ladeBestand`
ruft es **je Verbund** mit allen seinen TVs auf. Tragen zwei TVs verschiedene
Werte in derselben `X`-Spalte, liefert die Zerlegung ein anderes Ergebnis. Der
gemeinsame Nenner liegt deshalb **unter** beiden: bei den Roh-Arrays je Programm.

## 3. Entwurf

Ein neues Modul unter `src/core/status/` hält die Roh-Arrays **eines Programms**
für die Dauer der Durchgänge, die sie gerade brauchen — nicht länger.

### 3.1 `roh-halter.ts` (neu)

```ts
export interface ProgrammRoh {
  programmId: string;
  verbuende: Verbund[];
  antraege: Antrag[];
  schemas: CsvSchema[];
}

export async function* jedesProgrammRoh(
  idb: IDBStore,
  leser?: RohLeser,          // injiziert, nie eine IDB im Rechenkern
): AsyncGenerator<{ roh: ProgrammRoh; takt: RohTakt }>
```

**Generator, nicht Callback — nachgemessen.** Die erste Fassung nahm ein
`besuche`-Callback. Damit wanderte der Rumpf der Programm-Schleife aus dem
Aufrufer in eine Closure, und seine Zähler (`vf`, `ioMs`,
`antraegeOhneProgramm` …) lagen in einem Heap-Kontextobjekt statt in
Stack-Slots. Bei **byte-identischem Rumpf** kostete das ~400 ms auf 3 400 ms
Rechenzeit. Mit `for await (… of …)` bleibt der Rumpf im Scope seines Aufrufers;
die Rechenzeit ist danach auf 1 ms identisch zum Stand vorher (3 413 vs.
3 414 ms). Der Generator bringt dafür einen Fall mit, den das Callback nicht
hatte: ein Aufrufer, der `break`t oder wirft — `for await` schließt den
Generator, das `finally` räumt die Runde auf, und beides ist getestet.

**Die Runde.** Ein modul-lokaler Eintrag hält je `bestandGeneration()` eine
`Map<programmId, Promise<ProgrammRoh>>` und einen **Nutzerzähler**. Ein Aufrufer
zählt beim Eintritt hoch, im `finally` herunter; bei 0 wird die Runde
weggeworfen. Solange mindestens ein Durchgang läuft, bekommt jeder weitere
dieselben Arrays — **ohne zweiten `getAll`**.

Das ist der Punkt, an dem sich 2.5 und die Ersparnis vertragen: der Halter
verlängert die Lebensdauer der Arrays **nicht über den letzten Mitfahrer
hinaus**. Der Speicherbedarf ist damit derselbe wie heute bei einem einzelnen
Lauf — heute halten zwei parallele Läufe **zwei** Kopien, künftig eine.

**Generation als Schlüssel.** Ein Import bumpt `bestandGeneration()`
([bestand-generation.ts](../../../src/core/services/bestand-generation.ts)); eine
Runde mit alter Generation nimmt keine neuen Mitfahrer mehr auf. Laufende
Durchgänge fahren ihre Runde zu Ende — ein Durchgang, der mitten im Bestand die
Datenbasis wechselt, wäre schlimmer als einer, der eine Sekunde alt ist.

**Fehlerfall.** Scheitert der Lesevorgang eines Programms, scheitert er für alle
Mitfahrer gleich (dieselbe abgelehnte Promise), und die Runde wird verworfen —
kein halb gefüllter Halter überlebt.

### 3.2 `vorgangs-quelle.ts` — `jederVorgang` fährt auf dem Halter

Die Schleife über `listProgramme` + das `Promise.all` der drei Lesefunktionen
wandert in den Halter. **Alles darunter bleibt Zeile für Zeile, wie es ist** —
Plan-Kompilierung je Programm, `vbRecords`-Map, die Antrags-Schleife, `takt`.
`VorgangsRohsatz` und `VorgangsTakt` ändern sich nicht; die 11 anderen Aufrufer
merken nichts.

### 3.3 `ladeBestand.ts` — der 13. Leser gibt seinen Lesecode ab

Dieselbe Operation: die drei `list…`-Aufrufe werden durch `jedesProgrammRoh`
ersetzt. **Der Rumpf der Programm-Schleife bleibt unverändert** — `aufloesung`,
`byVb`-Gruppierung, `programmAntraege`, `antraegeOhneProgramm`,
`programmUneinheitlich`, die drei `baueVerbundFelder`-Schleifen. Weil der
Rechenteil nicht angefasst wird, ist die Ausgabe strukturell identisch; der Test
in 3.5 nagelt es trotzdem fest.

`ioMs` misst künftig die Zeit **im Halter** — für einen Mitfahrer nahe 0. Das ist
die gewünschte Aussage und muss im Log erkennbar sein: die Zeile bekommt einen
Zusatz, ob gelesen oder mitgefahren wurde.

### 3.4 Was ausdrücklich NICHT passiert

- **Kein Chunking** — gemessen ~7 s teurer (§17), die Warnung bleibt stehen.
- **Keine TTL, kein sitzungslanger Cache** — 2.5.
- **Keine Änderung an `sammleVorkommen`** — 2.7.
- **Keine Umstellung der acht Erhebungen** — 2.6. Sie erben die Mitfahrt
  trotzdem, weil sie über `jederVorgang` gehen.
- **Kein Anfassen der 3,3 s Rechnung** — offener Posten, siehe 5.

### 3.5 Tests

| Test | Was er festnagelt |
|---|---|
| `roh-halter.test.ts` (neu) | Zwei gleichzeitige Durchgänge lösen **einen** Lesevorgang je Programm aus (Zähler am injizierten Leser). Nach dem letzten Mitfahrer liest der nächste Durchgang **neu** — kein Cache. Ein Generationswechsel trennt die Runden. Ein Lesefehler erreicht alle Mitfahrer und verwirft die Runde. |
| `bestandslaufBefund.test.ts` (vorhanden) | unverändert grün |
| `hoistung-byte-identitaet.test.ts` (vorhanden) | unverändert grün — der Beweis, dass `sammleVorkommen` nicht angefasst wurde |

Der neue Test wird **einmal absichtlich rot gesehen** (Nutzerzähler sabotieren),
bevor er zählt.

## 4. Verifikation

1. `npm run check:quick` nach jedem Teilschritt, `npm run check` als Phasen-Gate.
2. **Dieselbe Messung wie in 2.2/2.3**, in `dev:local` gegen denselben Bestand:
   - Regeln-Seite kalt: die **zwei** StrictMode-Läufe müssen künftig **einen**
     Lesevorgang teilen — erwartet: erster `io ≈ 3 100 ms`, zweiter `io ≈ 0 ms`,
     und die Gesamtzeit fällt von 14 008 ms in Richtung 2 × Rechnung.
   - `window.__tf.fehler()` muss 0 sein.
3. Gegenprobe auf **Wahrheit**, nicht nur Tempo: `7535 Verbünde, 3 Schemas` muss
   unverändert dastehen, und die Vorkommen-Zahlen im Katalog-Tab müssen gleich
   bleiben (Pitfall #44/#45 — geändert wird, *wann* gelesen wird, nie *was*
   herauskommt).
4. `npm run build:devpl`, **Exit-Code prüfen**.
5. Version bumpen, CHANGELOG, und §17 fortschreiben — inklusive der Korrektur
   aus 2.2.

**Was der Dev-Server nicht zeigt**: nichts Spezifisches. Das Modul fasst weder
`file://`, noch FSAPI, noch Bundle-Größe an; es gibt keinen dynamischen Import
und keinen Worker.

## 5. Offen, bewusst nicht in diesem Durchgang

**Die 3 342 ms Rechnung der Regeln-Seite** (2.2). Auffällig, weil `laufeBestand`
über dieselben Daten in 938 ms sammelt (v6.47-Messung). Der Unterschied liegt
vermutlich in `baueVerbundFelder` × 7 535 plus `zaehleVorkommen`, ist aber **nicht
aufgeschlüsselt**. Erst die Aufschlüsselung, dann der Hebel — sonst wiederholt
sich der Fehler aus v6.47, wo der bestbelegte Befund am Ende 1–3 % wert war.
Entscheidung des Nutzers vom 09.09.2026: in dieser Spec nur benennen und messen.
